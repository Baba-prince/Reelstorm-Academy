# REELSTORM ACADEMY OS

**Production OS Factory — not a course.**  
Version **v1.1** with **Video Upload Engine** (Template Forge v2).

Source: Brand Kit 01 + Full Architecture (STORM OS pipeline).  
Repo target: https://github.com/Beeplus7/Reelstorm-Academy

## What it does

Producer flow (success criteria):

1. **Drag-drop** a reference video (YouTube / music / advert) in `/template-forge`
2. System **analyzes** (scenes, style DNA, faces, rooms, audio stems)
3. **Extracts** a reusable JSON template + style preset (e.g. “MrBeast Fast Cut”)
4. Producer types a **new script** → STORM rebuilds in that style (Seedance / Kling / Veo)
5. Long videos **auto-split** into 5-min **ARCHIVE5** blocks
6. **Merge Studio** concatenates blocks into a 15–30 min master

Local orchestration works with **Ollama `llama3.1:8b`** when DashScope is unset.

## Monorepo

```
apps/
  web/          Next.js 14 — Brand Kit UI (11 pages)
  api/          Fastify — auth, projects, upload/video, templates, world, storyboard, generate, archive, merge + WS
  worker/       BullMQ — analyzeVideo, extractTemplate, generateVideo, archiveBlock, mergeMaster
packages/
  domain/       StoryContract, VideoTemplate, AssetCenter, ARCHIVE5
  db/           Prisma schema (VideoUpload, VideoTemplate, Block, …)
  media/        ffmpeg, S3, video-analyzer, template-extractor, 5-min splitter
  providers/    dashscope, seedance, kling, veo, elevenlabs
  pipeline/     videoUpload → analyze → template → generate → archive → merge
infra/
  docker-compose.yml   Redis + MinIO (+ optional Postgres)
reelstorm-tokens.json  Brand Kit 01 tokens
```

## Pages

| Route | Purpose |
|-------|---------|
| `/dashboard` | Factory floor |
| `/projects/[id]` | Project detail |
| `/world-builder` | Perfect Room + Soul ID |
| `/template-forge` | **Video upload + analysis + template gallery** |
| `/storyboard` | First-frame lock |
| `/studio` | Vibe Direct chat |
| `/archive-vault` | ARCHIVE5 blocks |
| `/merge-studio` | FFmpeg merge |
| `/model-center` | 2 API keys |
| `/team` | Crew seats |
| `/brand` | Brand Kit 01 |

## Quick start

### 1. Prerequisites

- Node.js 20+
- Docker (Redis + MinIO)
- `ffmpeg` on PATH
- Optional: Ollama with `llama3.1:8b`
- Optional: Python `scenedetect` for PySceneDetect

### 2. Env

```bash
cp .env.example .env
# .env is pre-wired for your Supabase project when provided by the agent
```

**2 API keys to go live (Model Center):**

1. `DASHSCOPE_API_KEY` — orchestrator + Seedance path  
2. `ELEVENLABS_API_KEY` — Voice Forge fallback  

Without DashScope, API/worker use **Ollama** at `OLLAMA_BASE_URL`.

### 3. Infra

```bash
docker compose -f infra/docker-compose.yml up -d
```

### 4. Install + DB

```bash
npm install
npm run db:generate
npm run db:push
```

### 5. Dev (web + api + worker)

```bash
npm run dev
```

- Web: http://localhost:3000  
- API: http://localhost:4000/health  
- Template Forge: http://localhost:3000/template-forge  
- Analysis WS: `ws://localhost:4000/ws/analysis/:uploadId`

## Video upload API

```http
POST /api/upload/video          multipart file (MP4/MOV ≤ 2GB)
POST /api/upload/video/analyze  { "uploadId": "..." }
POST /api/templates/from-video  { "uploadId": "..." }
GET  /api/templates
POST /api/templates/:id/apply   { "projectId", "script" }
```

Workers publish progress on Redis channel `analysis:{uploadId}` → WebSocket.

## Brand

Tokens live in `reelstorm-tokens.json`:

- Deep Black `#0A0A0A` / Void `#080808`
- Storm Violet `#7C3AED`
- Electric Cyan `#00D9FF`
- Signal Orange `#FF7A00`
- Display: Montserrat ExtraBold • Body: Inter
- Radius: 16px / 24px • Grid: 72px • Logo: **RS**

## Security note

Never commit `.env`. Rotate Supabase keys if they were shared in chat.
