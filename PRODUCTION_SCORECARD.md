# REELSTORM ACADEMY OS — Production Build Scorecard

**Version:** v1.5 (smoke + production API scripts closed)  
**Live UI:** `/scorecard`  
**API probe:** `GET /api/readiness` → `production1k`

## Gaps closed in v1.5

| Gap | Fix |
|-----|-----|
| Smoke + production API scripts PARTIAL | `scripts/smoke.sh` full live probes · `check-production-apis.sh` offline + `--live` |

## Gaps closed in v1.4

| Gap | Fix |
|-----|-----|
| Template Forge stuck at 0% | VPS `apt install ffmpeg` + ffprobe path wiring |
| Redis DB 17 out of range | `databases 32` in redis.conf |
| Forge buttons / WS dead | Same-origin `getApiBase` / `getWsBase` + nginx `/ws/` |
| Scorecard offline on app host | Scorecard uses `getApiBase()` not hard-coded api DNS |
| No 1k visibility | Production 1k gate panel + blocking chips |

## Gaps closed in v1.3

| Gap | Fix |
|-----|-----|
| No 1k API gate | `packages/domain/src/production.ts` + readiness `production1k` |
| Mock video forced on VPS | `MOCK_VIDEO_GEN=0` in deploy + stamp script |
| Worker scale | `WORKER_CONCURRENCY=8` (prod default) |
| MinIO-only storage | S3/R2 probe; docs for Cloudflare R2 |
| Stripe webhook path | nginx `/api/` proxy on app host |

## Launch (production 1k)

```bash
bash scripts/stamp-production-1k-env.sh
# fill DASHSCOPE_API_KEY, ELEVENLABS_API_KEY, sk_live_*, R2 S3_*
npm run check:apis
npm run check:apis:live
API_URL=https://app.reelstorm.uk WEB_URL=https://app.reelstorm.uk npm run smoke
curl -sS https://app.reelstorm.uk/api/readiness | jq .production1k
```

See [docs/PRODUCTION_APIS_1K.md](docs/PRODUCTION_APIS_1K.md).
