#!/usr/bin/env python3
"""
ReelStorm GPU Saver — FastAPI on RunPod pod xuvnute41511og :8000

Weights live on the Network Volume at /workspace/skyreels-1.3b-4.2GB (0 MB to users).
ComfyUI listens on localhost:8188. This wrapper:
  POST /generate {prompt, duration} → ComfyUI workflow → R2 upload → {r2_url, duration}

Env:
  COMFY_URL=http://127.0.0.1:8188
  R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_VIDEOS
  R2_PUBLIC_URL=https://videos.reelstorm.uk
  SKYREELS_CKPT=/workspace/skyreels-1.3b-4.2GB
  MOCK_GENERATE=1  # return stub without Comfy (smoke)
"""

from __future__ import annotations

import json
import os
import time
import uuid
from pathlib import Path
from typing import Any

import boto3
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="ReelStorm Saver", version="1.0.0")

COMFY = os.getenv("COMFY_URL", "http://127.0.0.1:8188").rstrip("/")
CKPT_DIR = Path(os.getenv("SKYREELS_CKPT", "/workspace/skyreels-1.3b-4.2GB"))
OUTPUT_DIR = Path(os.getenv("COMFY_OUTPUT", "/workspace/ComfyUI/output"))
MOCK = os.getenv("MOCK_GENERATE", "0") == "1"
R2_BUCKET = os.getenv("R2_BUCKET_VIDEOS", os.getenv("R2_BUCKET", "reelstorm-videos"))
R2_PUBLIC = os.getenv("R2_PUBLIC_URL", "https://videos.reelstorm.uk").rstrip("/")


class GenerateBody(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    duration: int = Field(default=60, ge=5, le=180)


def r2_client():
    endpoint = os.getenv("R2_ENDPOINT") or os.getenv("S3_ENDPOINT")
    key = os.getenv("R2_ACCESS_KEY_ID") or os.getenv("S3_ACCESS_KEY_ID") or os.getenv("R2_KEY")
    secret = os.getenv("R2_SECRET_ACCESS_KEY") or os.getenv("S3_SECRET_ACCESS_KEY") or os.getenv("R2_SECRET")
    if not endpoint or not key or not secret:
        raise HTTPException(503, "R2 credentials missing on saver (R2_ENDPOINT / KEY / SECRET)")
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=key,
        aws_secret_access_key=secret,
        region_name=os.getenv("R2_REGION", "auto"),
    )


def skyreels_workflow(prompt: str, frames: int) -> dict[str, Any]:
    """Minimal ComfyUI API graph — adjust node IDs once SkyReels custom node is installed."""
    # 97 frames ≈ 540P DF clip; scale loosely with duration (cap 97 for 1.3B pack)
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
        "_meta": {"frames": frames, "engine": "SkyReels-V2-DF-1.3B-540P"},
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
                    if fname and fname.endswith(".mp4"):
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
    try:
        comfy_ok = requests.get(f"{COMFY}/system_stats", timeout=3).status_code == 200
    except Exception:
        pass
    return {
        "ok": True,
        "pod": "xuvnute41511og",
        "weights": str(CKPT_DIR),
        "weights_present": weights_ok,
        "comfy": comfy_ok,
        "mock": MOCK,
    }


@app.post("/generate")
def generate(body: GenerateBody):
    frames = min(97, max(16, int(body.duration * 97 / 60)))
    if MOCK or not CKPT_DIR.exists():
        # Smoke path — no GPU burn; still validates R2 when creds present
        stub = OUTPUT_DIR / f"stub-{uuid.uuid4().hex}.mp4"
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        stub.write_bytes(b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 256)
        try:
            url = upload_r2(stub)
        except HTTPException:
            url = f"{R2_PUBLIC}/videos/mock-{uuid.uuid4().hex}.mp4"
        return {
            "r2_url": url,
            "duration": body.duration,
            "engine": "mock-stub",
            "note": "MOCK_GENERATE or weights missing — replace with real Comfy run",
            "cost_usd_est": 0.057,
        }

    graph = skyreels_workflow(body.prompt, frames)
    # strip meta before Comfy
    graph.pop("_meta", None)
    pid = comfy_queue(graph)
    video = comfy_wait(pid, timeout_sec=600)
    url = upload_r2(video)
    return {
        "r2_url": url,
        "duration": body.duration,
        "engine": "SkyReels-V2-DF-1.3B-540P",
        "cost_usd_est": round(0.69 * (body.duration / 60) / 12, 4),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
