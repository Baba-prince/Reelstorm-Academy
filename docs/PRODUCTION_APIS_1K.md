# Production APIs for ~1000 users

Probe: `GET /api/readiness` → `production1k`  
Stamp defaults: `bash scripts/stamp-production-1k-env.sh`  
Offline check: `npm run check:apis` / `bash scripts/check-production-apis.sh`  
Live check: `npm run check:apis:live`  
Smoke: `API_URL=https://app.reelstorm.uk WEB_URL=https://app.reelstorm.uk npm run smoke`

## Tier A — platform (must)

| Service | Env | Action |
|---|---|---|
| **Supabase Pro** | `SUPABASE_*`, `DATABASE_URL` (pooler `:6543`) | Upgrade project off Free before 1k users |
| **Google OAuth** | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Enable in Supabase Auth → Google; add callback URIs |
| **Stripe live** | `STRIPE_SECRET_KEY=sk_live_…`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…`, `STRIPE_TIER_WEBHOOK_SECRET` | Webhook URL: `https://app.reelstorm.uk/api/billing/stripe-webhook` |
| **Redis** | `REDIS_URL` (VPS db 17) | Keep `BULLMQ_PREFIX=reelstorm` |
| **Cloudflare R2 or AWS S3** | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`, `S3_FORCE_PATH_STYLE=true`, `S3_REGION=auto` (R2) | Do **not** use MinIO `127.0.0.1:9000` in prod |

### R2 example

```bash
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_FORCE_PATH_STYLE=true
S3_BUCKET=reelstorm
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
S3_PUBLIC_URL=https://media.reelstorm.uk
```

## Tier B — AI generation

| Service | Role | Required? |
|---|---|---|
| **DashScope** | LLM + Seedance video | Yes for real video |
| **Sound Studio** | Sync · stem extract · mux · clone · TTS | **Yes — owns all voice** |
| **ElevenLabs** | Optional provider *under* Sound Studio | No — only if you want hosted TTS/clone |

Sound Studio is the product surface for voice. Do **not** treat ElevenLabs as a launch blocker.

## Tier C — optional

- `KLING_API_KEY` — video fallback  
- `VEO_API_KEY` / `GOOGLE_API_KEY` — premium path  

## Scale

```bash
WORKER_CONCURRENCY=8   # start here; raise to 16 under load
VIDEO_PROVIDER=auto
```

Ensure ≥50 GiB free on `UPLOAD_TMP_DIR` (ffmpeg/yt-dlp scratch).

## Go-live order

1. Supabase Pro + Google provider  
2. Stripe **live** keys + webhook  
3. DashScope + ElevenLabs Creator+  
4. R2/S3 `S3_*`  
5. `bash scripts/stamp-production-1k-env.sh` → `MOCK_VIDEO_GEN=0`, concurrency 8  
6. Redeploy / `pm2 restart reelstorm-api reelstorm-worker reelstorm-web`  
7. Confirm `production1k.ready === true` on `/api/readiness`
