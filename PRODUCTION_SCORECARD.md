# REELSTORM ACADEMY OS — Production Build Scorecard

**Version:** v1.2 (Video Upload + Web URL extract)  
**Live UI:** http://localhost:3000/scorecard  
**API probe:** `GET /api/readiness`

## Gaps closed in v1.2

| Gap | Fix |
|-----|-----|
| Redis missing | `redis-memory-server` auto-boot in API/worker |
| ffmpeg missing | Bundled `bin/ffmpeg` (evermeet 7.1) |
| Web reference extract | `POST /api/upload/video/from-url` + Template Forge URL bar (yt-dlp) |
| Auth | Supabase JWT soft-verify + dev login |
| Smoke tests | `scripts/smoke.sh` |
| Local storage | `tmp/uploads` AssetCenter path |

## Launch

```bash
export PATH="$PWD/bin:$PATH" FFMPEG_PATH="$PWD/bin/ffmpeg"
npm run dev
open http://localhost:3000/template-forge   # paste YouTube URL
open http://localhost:3000/scorecard
```

Still open for **A-grade:** Docker/MinIO S3, full Supabase session UI, CI, live DashScope/ElevenLabs keys.
