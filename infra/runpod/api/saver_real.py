#!/usr/bin/env python3
"""
ReelStorm saver — REAL R2 upload (mock only if you set ALLOW_MOCK=1).

Why you saw mock:true:
  upload_file raised SSLV3_ALERT_HANDSHAKE_FAILURE → except returned mock.
  That TLS alert means the R2 *hostname* is wrong (not a CA/certifi issue).
  verify=False does NOT fix handshake failure on a bad Account ID.

Fix:
  1) Cloudflare dashboard → copy Account ID (exactly 32 hex chars)
  2) Set R2_ENDPOINT=https://<32char>.r2.cloudflarestorage.com
  3) Re-create R2 API token if Access Key Id looks truncated (<32 chars)
  4) Restart uvicorn on :8000

Paste to /workspace/saver.py then:
  pip install -q boto3 botocore fastapi uvicorn python-dotenv requests
  pkill -f 'uvicorn saver'; sleep 1
  set -a; source /workspace/.env; set +a
  nohup uvicorn saver:app --host 0.0.0.0 --port 8000 --proxy-headers >/tmp/saver.log 2>&1 &
"""

from __future__ import annotations

import os
import uuid
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

from dotenv import load_dotenv

load_dotenv("/workspace/.env")

from fastapi import FastAPI, HTTPException, Request

app = FastAPI(title="ReelStorm Saver REAL")

ALLOW_MOCK = os.getenv("ALLOW_MOCK", "0") == "1"
R2_ACCOUNT_ID = (os.getenv("R2_ACCOUNT_ID") or "").strip()
R2_ACCESS = (os.getenv("R2_ACCESS_KEY_ID") or os.getenv("R2_KEY") or "").strip()
R2_SECRET = (os.getenv("R2_SECRET_ACCESS_KEY") or os.getenv("R2_SECRET") or "").strip()
R2_BUCKET = os.getenv("R2_BUCKET_VIDEOS") or os.getenv("R2_BUCKET") or "reelstorm-videos"
R2_PUBLIC = (
    os.getenv("R2_PUBLIC_URL") or "https://videos.reelstorm.uk"
).rstrip("/").replace("https://", "").replace("http://", "")
POD_ID = os.getenv("RUNPOD_POD_ID") or "xuvnute4l51iog"


def r2_endpoint() -> str:
    ep = (os.getenv("R2_ENDPOINT") or "").strip().rstrip("/")
    if ep:
        return ep
    if R2_ACCOUNT_ID:
        return f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    raise HTTPException(503, "R2_ENDPOINT or R2_ACCOUNT_ID missing")


def diagnose() -> dict:
    ep = ""
    try:
        ep = r2_endpoint()
    except Exception as e:
        ep = f"ERR:{e}"
    return {
        "account_id_len": len(R2_ACCOUNT_ID),
        "account_id_ok": len(R2_ACCOUNT_ID) == 32 and all(c in "0123456789abcdef" for c in R2_ACCOUNT_ID.lower()),
        "access_key_len": len(R2_ACCESS),
        "secret_len": len(R2_SECRET),
        "endpoint": ep,
        "bucket": R2_BUCKET,
        "hint": None
        if len(R2_ACCOUNT_ID) == 32
        else "R2_ACCOUNT_ID must be exactly 32 hex chars from Cloudflare dashboard (yours looks truncated/extra)",
    }


def s3_client():
    import boto3
    from botocore.config import Config

    d = diagnose()
    if not d["account_id_ok"] and not (os.getenv("R2_ENDPOINT") or "").strip():
        raise RuntimeError(
            f"Bad R2_ACCOUNT_ID len={d['account_id_len']} (need 32). "
            "Copy Account ID from Cloudflare → R2. SSL handshake failure is expected until fixed."
        )
    if len(R2_ACCESS) < 16 or len(R2_SECRET) < 16:
        raise RuntimeError("R2 access/secret missing or truncated — recreate API token")

    # Prefer explicit endpoint from .env
    return boto3.client(
        "s3",
        endpoint_url=r2_endpoint(),
        aws_access_key_id=R2_ACCESS,
        aws_secret_access_key=R2_SECRET,
        config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
        region_name="auto",
    )


@app.get("/health")
def health():
    d = diagnose()
    r2_ok = False
    r2_err = None
    try:
        s3_client().list_buckets()
        r2_ok = True
    except Exception as e:
        r2_err = str(e)[:240]
    return {
        "ok": True,
        "pod": POD_ID,
        "mode": "REAL",
        "mock_default": False,
        "allow_mock": ALLOW_MOCK,
        "r2_ok": r2_ok,
        "r2_error": r2_err,
        "diag": d,
    }


@app.get("/")
def root():
    return health()


@app.post("/generate")
async def generate(req: Request):
    try:
        body = await req.json()
    except Exception:
        body = {}
    prompt = (body.get("prompt") or "cinematic storm").strip()
    duration = int(body.get("duration") or 60)

    try:
        s3 = s3_client()
        # Placeholder bytes until ComfyUI/SkyReels is wired — still REAL R2 object
        out = Path(f"/tmp/reelstorm-{uuid.uuid4().hex}.mp4")
        out.write_bytes(
            b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom\x00\x00\x00\x08free" + b"\x00" * 8192
        )
        key = f"videos/{uuid.uuid4().hex}.mp4"
        s3.upload_file(str(out), R2_BUCKET, key, ExtraArgs={"ContentType": "video/mp4"})
        out.unlink(missing_ok=True)
        return {
            "ok": True,
            "mock": False,
            "real_r2": True,
            "r2_url": f"https://{R2_PUBLIC}/{key}",
            "prompt": prompt,
            "duration": duration,
            "engine": "r2-upload-placeholder",
            "note": "R2 upload real — wire ComfyUI/SkyReels for GPU frames next",
        }
    except Exception as e:
        if ALLOW_MOCK:
            return {
                "ok": False,
                "mock": True,
                "error": str(e)[:800],
                "r2_url": f"https://{R2_PUBLIC}/videos/mock-{uuid.uuid4().hex[:8]}.mp4",
                "diag": diagnose(),
            }
        # Fail loud — do NOT pretend success with mock
        raise HTTPException(
            status_code=502,
            detail={
                "mock": False,
                "error": str(e)[:800],
                "diag": diagnose(),
                "fix": "Fix R2_ACCOUNT_ID (32 hex) + R2_ENDPOINT, then retry. Set ALLOW_MOCK=1 only for UI smoke.",
            },
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
