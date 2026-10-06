# REELSTORM ACADEMY OS — Production Build Scorecard

**Version:** v1.3 (Production APIs · ~1000 users)  
**Live UI:** `/scorecard`  
**API probe:** `GET /api/readiness` → `production1k`

## Gaps closed in v1.3

| Gap | Fix |
|-----|-----|
| No 1k API gate | `packages/domain/src/production.ts` + readiness `production1k` |
| Mock video forced on VPS | `MOCK_VIDEO_GEN=0` in deploy + stamp script |
| Worker scale | `WORKER_CONCURRENCY=8` (prod default) |
| MinIO-only storage | S3/R2 probe; docs for Cloudflare R2 |
| Stripe webhook path | nginx `/api/` proxy on app host |
| Scorecard | Stripe / Seedance / ElevenLabs / R2 / concurrency rows |

## Launch (production 1k)

```bash
bash scripts/stamp-production-1k-env.sh
# fill DASHSCOPE_API_KEY, ELEVENLABS_API_KEY, sk_live_*, R2 S3_*
bash scripts/check-production-apis.sh
curl -sS https://app.reelstorm.uk/api/readiness | jq .production1k
```

See [docs/PRODUCTION_APIS_1K.md](docs/PRODUCTION_APIS_1K.md).
