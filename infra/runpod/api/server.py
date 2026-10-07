#!/usr/bin/env python3
"""
ReelStorm Dual Saver — FastAPI on LIVE pod xuvnute4l51iog :8000

SAVER 1 (R2): videos (+ optional weights backup) — creds from /workspace/.env
SAVER 2 (this pod): SkyReels weights at /workspace/skyreels-1.3b-4.2GB → VRAM

NEVER hardcode secrets. Load:
  /workspace/.env  (RunPod)
  or process env injected by start.sh

POST /generate {prompt, duration}
  → ComfyUI 127.0.0.1:8188 (or RUNPOD_COMFYUI_INTERNAL)
  → upload mp4 to R2_BUCKET_VIDEOS
  → { r2_url, duration, engine }
"""

from __future__ import annotations

import os
import time
import uuid
from pathlib import Path
from typing import Any

# Load /workspace/.env before reading os.environ
def _load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


_load_dotenv(Path("/workspace/.env"))
_load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import boto3
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="ReelStorm Dual Saver", version="1.1.0")

COMFY = (
    os.getenv("RUNPOD_COMFYUI_INTERNAL")
    or os.getenv("COMFY_URL")
    or "http://127.0.0.1:8188"
).rstrip("/")
CKPT_DIR = Path(
    os.getenv("SKYREELS_CKPT")
    or f"{os.getenv('RUNPOD_VOLUME_PATH', '/workspace')}/skyreels-1.3b-4.2GB"
)
OUTPUT_DIR = Path(
    os.getenv("COMFY_OUTPUT")
    or f"{os.getenv('RUNPOD_VOLUME_PATH', '/workspace')}/ComfyUI/output"
)
MOCK = os.getenv("MOCK_GENERATE", "0") == "1"
R2_BUCKET = os.getenv("R2_BUCKET_VIDEOS") or os.getenv("R2_BUCKET") or "reelstorm-videos"
R2_PUBLIC = (os.getenv("R2_PUBLIC_URL") or "https://videos.reelstorm.uk").rstrip("/")
POD_ID = os.getenv("RUNPOD_POD_ID", "xuvnute4l51iog")


class GenerateBody(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    duration: int = Field(default=60, ge=5, le=180)


def _r2_creds() -> tuple[str, str, str]:
    endpoint = os.getenv("R2_ENDPOINT") or os.getenv("S3_ENDPOINT") or ""
    # Derive from account id if needed
    if not endpoint and os.getenv("R2_ACCOUNT_ID"):
        endpoint = f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"
    key = (
        os.getenv("R2_ACCESS_KEY_ID")
        or os.getenv("R2_KEY")
        or os.getenv("S3_ACCESS_KEY_ID")
        or ""
    )
    secret = (
        os.getenv("R2_SECRET_ACCESS_KEY")
        or os.getenv("R2_SECRET")
        or os.getenv("S3_SECRET_ACCESS_KEY")
        or ""
    )
    if not endpoint or not key or not secret:
        raise HTTPException(
            503,
            "R2 creds missing in /workspace/.env — need R2_ENDPOINT (or R2_ACCOUNT_ID), "
            "R2_ACCESS_KEY_ID (or R2_KEY), R2_SECRET_ACCESS_KEY (or R2_SECRET)",
        )
    if "127.0.0.1" in endpoint or "minio" in key.lower():
        raise HTTPException(503, "Refusing MinIO/local S3_* — set real Cloudflare R2_* on saver")
    return endpoint, key, secret


def r2_client():
    endpoint, key, secret = _r2_creds()
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=key,
        aws_secret_access_key=secret,
        region_name=os.getenv("R2_REGION", "auto"),
    )


def skyreels_workflow(prompt: str, frames: int) -> dict[str, Any]:
    frames = min(max(frames, 16), 97)
    return {
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt, "clip": ["10", 1]},
        },
        "10": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "skyreels_v2_df_1.3b_540p.safetensors"},
        },
        "20": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 544, "height": 960, "batch_size": 1},
        },
        "30": {
            "class_type": "KSampler",
            "inputs": {
                "seed": int(time.time()) % 2_147_483_647,
                "steps": 20,
                "cfg": 6.0,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1.0,
                "model": ["10", 0],
                "positive": ["3", 0],
                "negative": ["3", 0],
                "latent_image": ["20", 0],
            },
        },
        "40": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["30", 0], "vae": ["10", 2]},
        },
        "50": {
            "class_type": "VHS_VideoCombine",
            "inputs": {
                "images": ["40", 0],
                "frame_rate": 16,
                "filename_prefix": "reelstorm",
                "format": "video/h264-mp4",
                "pingpong": False,
                "save_output": True,
            },
        },
    }


def comfy_queue(prompt_graph: dict[str, Any]) -> str:
    r = requests.post(f"{COMFY}/prompt", json={"prompt": prompt_graph}, timeout=60)
    if r.status_code >= 400:
        raise HTTPException(502, f"ComfyUI rejected prompt: {r.text[:400]}")
    data = r.json()
    pid = data.get("prompt_id")
    if not pid:
        raise HTTPException(502, f"ComfyUI missing prompt_id: {data}")
    return pid


def comfy_wait(prompt_id: str, timeout_sec: int = 600) -> Path:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        h = requests.get(f"{COMFY}/history/{prompt_id}", timeout=30)
        if h.status_code == 200:
            hist = h.json().get(prompt_id) or {}
            outputs = hist.get("outputs") or {}
            for node_out in outputs.values():
                for vid in node_out.get("gifs") or node_out.get("videos") or []:
                    fname = vid.get("filename")
                    sub = vid.get("subfolder") or ""
                    if fname:
                        p = OUTPUT_DIR / sub / fname if sub else OUTPUT_DIR / fname
                        if p.exists():
                            return p
                for img in node_out.get("images") or []:
                    fname = img.get("filename")
                    if fname and str(fname).endswith(".mp4"):
                        p = OUTPUT_DIR / fname
                        if p.exists():
                            return p
        time.sleep(2)
    raise HTTPException(504, "ComfyUI generate timed out")


def upload_r2(local: Path) -> str:
    key = f"videos/{uuid.uuid4().hex}.mp4"
    client = r2_client()
    client.upload_file(
        str(local),
        R2_BUCKET,
        key,
        ExtraArgs={"ContentType": "video/mp4"},
    )
    return f"{R2_PUBLIC}/{key}"


@app.get("/health")
def health():
    weights_ok = CKPT_DIR.exists()
    comfy_ok = False
    r2_ok = False
    try:
        comfy_ok = requests.get(f"{COMFY}/system_stats", timeout=3).status_code == 200
    except Exception:
        pass
    try:
        _r2_creds()
        r2_ok = True
    except HTTPException:
        r2_ok = False
    return {
        "ok": True,
        "pod": POD_ID,
        "weights": str(CKPT_DIR),
        "weights_present": weights_ok,
        "comfy": comfy_ok,
        "comfy_url": COMFY,
        "r2_configured": r2_ok,
        "r2_bucket": R2_BUCKET,
        "mock": MOCK,
    }


@app.post("/generate")
def generate(body: GenerateBody):
    frames = min(97, max(16, int(body.duration * 97 / 60)))
    if MOCK:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        stub = OUTPUT_DIR / f"stub-{uuid.uuid4().hex}.mp4"
        stub.write_bytes(b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 512)
        url = upload_r2(stub)
        return {
            "r2_url": url,
            "duration": body.duration,
            "engine": "mock-stub",
            "note": "MOCK_GENERATE=1 — set 0 after SkyReels workflow validated",
            "cost_usd_est": 0.057,
        }

    if not CKPT_DIR.exists():
        raise HTTPException(
            503,
            f"Weights missing at {CKPT_DIR} — run setup-pod.sh on volume (do not create new volume)",
        )

    graph = skyreels_workflow(body.prompt, frames)
    pid = comfy_queue(graph)
    video = comfy_wait(pid, timeout_sec=600)
    url = upload_r2(video)
    return {
        "r2_url": url,
        "duration": body.duration,
        "engine": "SkyReels-V2-DF-1.3B-540P",
        "frames": frames,
        "cost_usd_est": round(0.74 * (body.duration / 60) / 12, 4),
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
