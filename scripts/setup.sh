#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> REELSTORM ACADEMY OS setup"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example — fill Supabase + API keys"
fi

echo "==> Installing deps"
npm install

echo "==> Prisma generate + push"
export $(grep -v '^#' .env | grep -v '^$' | xargs)
npm run db:generate
npm run db:push

echo "==> Building packages"
npm run build -w @reelstorm/domain -w @reelstorm/media -w @reelstorm/providers -w @reelstorm/pipeline -w @reelstorm/db

echo ""
echo "Next:"
echo "  1. docker compose -f infra/docker-compose.yml up -d   # Redis + MinIO"
echo "  2. brew install ffmpeg                                # required for analyze/split/merge"
echo "  3. ollama pull llama3.1:8b                             # local orchestrator"
echo "  4. npm run dev                                        # web :3000 + api :4000 + worker"
echo "  5. open http://localhost:3000/template-forge"
