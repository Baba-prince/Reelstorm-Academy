# Final arch — 0MB web + 120MB desktop via saver

**Decision:** Users never download the 4.2GB SkyReels V2 weights. Weights live on the **RunPod Network Volume**. VPS is the **brain** (license + minutes). RunPod is the **muscle** (RTX 4090 inference).

```
User
  ├─→ [WEB] 0 MB     app.reelstorm.uk/generate
  └─→ [DESKTOP] ~120MB  Electron /download
Both → POST https://api.reelstorm.uk/api/generate
         ↓  VPS validates RSTUDIO license + remaining minutes
         ↓  Proxy → https://xuvnute4l51iog-8000.proxy.runpod.net/generate
                  [GPU SAVER · pod xuvnute4l51iog · RTX 4090]
                  /workspace/skyreels-1.3b-4.2GB  (Network Volume 70GB)
         ↓  Upload MP4 → R2 reelstorm-videos
         ↓  Return { r2_url, remaining }
Both → video player (R2 URL). Minute meter = Supabase StudioLicense.usedThisMonth
```

## Live infra (2026-10-07)

| Plane | Where | Role |
|-------|--------|------|
| Control | VPS `/opt/reelstorm-os` · API 4017 · Web 3017 | License JWT, heartbeat, usage, `/api/generate` proxy |
| GPU | RunPod **xuvnute4l51iog** · EU-RO-1 · RTX 4090 | SkyReels inference |
| Volume | **reelstorm-weights** 70GB @ `/workspace` | 4.2GB checkpoint + ComfyUI |
| Output | R2 `reelstorm-videos` | Public MP4 URLs |

**Do not** create a new volume/pod — use `xuvnute4l51iog` + existing 70GB volume.

## Env (VPS)

```bash
RUNPOD_SAVER_URL=https://xuvnute4l51iog-8000.proxy.runpod.net/generate
STUDIO_LICENSE_SECRET=…
# R2 creds also on the pod for direct upload
```

## Pod setup

```bash
# Jupyter / SSH on xuvnute4l51iog
bash /workspace/reelstorm-os/infra/runpod/setup-pod.sh
# expose HTTP 8000, set R2_* , then:
bash /workspace/api/start.sh
curl -X POST http://127.0.0.1:8000/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"test","duration":60}'
```

Wrapper: `infra/runpod/api/server.py`  
Until Comfy+SkyReels nodes are wired, set `MOCK_GENERATE=1` for end-to-end smoke (still hits R2 when creds exist).

## Cost (order of magnitude)

| Item | Est. |
|------|------|
| Volume 70GB | ~$4.90/mo (already live) |
| R2 video storage | ~$15/mo per TB class |
| RTX 4090 | ~$0.69/hr while pod running |
| Per ~60s clip | ~$0.05–0.06 GPU + $0 Seedance |

**No video API key.** Investment = savers only.

## Client surfaces

| Surface | Size | Path |
|---------|------|------|
| Web | 0 MB download | `/generate` |
| Desktop thin | ~120MB installer | `packages/desktop` → `/download` |
| License UI | — | `/settings/studio` |

## API

- `POST /api/generate` — body `{ prompt, duration, license_key?, fingerprint?, engine:"studio" }` **or** `Authorization: Bearer <activated_token>`
- `POST /api/studio/generate` — same handler (explicit)
- `GET /api/studio/saver-health` — proxy probe
- Existing `/api/license/*` unchanged (source of truth for seats + minutes)

Factory `projectId` generate still works on the same `/api/generate` URL when `projectId` is present.
