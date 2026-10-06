# BOT Director Wizard + Production Fix Pack (v1.2)

## Wizard
- Live UI: `/wizard`
- API: `POST /api/blueprint/generate` → Movie Blueprint JSON
- Feed: `POST /api/projects/from-blueprint`
- Live Engine WS: `/ws/blueprint/:id`
- Stages: Welcome → Idea → Script/VO → World → Scenes → Shots → Feed Factory

## Env keys for 95% scorecard

```bash
# Media
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
WORKER_CONCURRENCY=8
MOCK_VIDEO_GEN=0

# Cloudflare R2
STORAGE_PROVIDER=R2
R2_ACCOUNT_ID=…
R2_ACCESS_KEY_ID=…
R2_SECRET_ACCESS_KEY=…
R2_BUCKET=reelstorm-archive5-prod
R2_PUBLIC_URL=https://archive5.reelstorm.uk

# AI
DASHSCOPE_API_KEY=sk-…
SEEDANCE_API_KEY=…   # or reuse DashScope
ELEVENLABS_API_KEY=…
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# Stripe live
STRIPE_SECRET_KEY=sk_live_…
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…
```

See also: [docs/PRODUCTION_APIS_1K.md](./PRODUCTION_APIS_1K.md)

## Scripts
- `bash scripts/smoke.sh`
- `bash scripts/check-production-apis.sh`
- `bash scripts/close-mvp-gaps.sh`
