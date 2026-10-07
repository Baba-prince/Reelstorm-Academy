# Final arch — Dual Saver (0MB web + 120MB desktop)

**Rule:** Never hardcode credentials. Load from `.env` on VPS and `/workspace/.env` on the pod.

```
User
  ├─→ Web 0MB          https://app.reelstorm.uk/generate
  └─→ Desktop ~120MB   Electron thin client
         │
         ▼
  VPS control plane (brain)  ·  /opt/reelstorm-os
  POST /api/generate
    · validate RSTUDIO-<JWT> / activated token / session license
    · check StudioLicense.usedThisMonth vs monthlyLimit  (source of truth)
    · Axios/fetch → RUNPOD_SAVER_URL  (600s timeout)
         │
         ▼
  SAVER 2 — RunPod GPU  ·  pod xuvnute4l51iog  ·  RTX 4090
  Volume reelstorm-weights 70GB @ /workspace
    · FastAPI :8000  infra/runpod/api/server.py
    · ComfyUI  RUNPOD_COMFYUI_INTERNAL (default 127.0.0.1:8188)
    · Weights  /workspace/skyreels-1.3b-4.2GB  (4.2GB — never downloaded by users)
         │
         ▼ upload via boto3 (R2_* from /workspace/.env)
  SAVER 1 — Cloudflare R2  ·  reelstorm-videos (+ reelstorm-weights backup)
    · R2_PUBLIC_URL → https://videos.reelstorm.uk/videos/<uuid>.mp4
         │
         ▼
  VPS writes StudioUsageLog.outputUrl + increments usedThisMonth
  Client plays r2_url
```

## Live IDs (2026-10-07)

| Piece | Value |
|-------|--------|
| VPS | IONOS · API 4017 · Web 3017 |
| Pod | `xuvnute4l51iog` — **reuse** (do not create new) |
| Volume | `reelstorm-weights` 70GB → `/workspace` |
| Saver URL | `https://xuvnute4l51iog-8000.proxy.runpod.net/generate` |

## Env blocks (both machines)

See `.env.example` and `infra/runpod/env.dual-saver.example`.

| Key | Where |
|-----|--------|
| `R2_ENDPOINT` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | VPS + `/workspace/.env` |
| `R2_BUCKET_VIDEOS` / `R2_PUBLIC_URL` | VPS + pod |
| `RUNPOD_SAVER_URL` / `RUNPOD_POD_ID` | VPS (proxy target) |
| `RUNPOD_API_KEY` | optional automation |
| `RUNPOD_COMFYUI_INTERNAL` | pod only |

## Pod bootstrap (on live volume)

```bash
# Jupyter terminal on xuvnute4l51iog
cp /workspace/reelstorm-os/infra/runpod/env.dual-saver.example /workspace/.env
# paste LIVE R2_* keys into /workspace/.env
bash /workspace/reelstorm-os/infra/runpod/setup-pod.sh
# Expose HTTP port 8000 on the pod template
bash /workspace/api/start.sh
curl -s http://127.0.0.1:8000/health
curl -X POST http://127.0.0.1:8000/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"test","duration":60}'
```

## VPS routes

| Route | Role |
|-------|------|
| `POST /api/generate` | Studio saver when `prompt` set; factory when `projectId` set |
| `POST /api/studio/generate` | Explicit studio path |
| `GET /api/studio/saver-health` | Probe RUNPOD_SAVER_URL `/health` |
| `/api/license/*` | Activate / heartbeat / usage (unchanged) |

Implementation: `apps/api/src/routes/generate.ts` → `studio-generate.ts`.

## Cost sketch

| Item | Notes |
|------|--------|
| Volume 70GB | ~$4.90/mo (live) |
| RTX 4090 | ~$0.74/hr while pod on |
| R2 storage | videos bucket |
| Seedance / video API keys | **$0 — not used** |
