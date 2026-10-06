#!/usr/bin/env bash
set -euo pipefail
API="${API_URL:-http://localhost:4000}"

echo "== REELSTORM smoke =="
curl -sf "$API/health" | grep -q LIVE && echo "OK health"
curl -sf "$API/api/readiness" | tee /tmp/rs-readiness.json | head -c 400; echo
curl -sf -X POST "$API/api/projects" -H 'Content-Type: application/json' \
  -d '{"title":"Smoke","script":"INT. TEST"}' | grep -q '"id"' && echo "OK projects"
curl -sf -X POST "$API/api/auth/dev-login" -H 'Content-Type: application/json' \
  -d '{}' | grep -q token && echo "OK auth"
curl -sf -X POST "$API/api/upload/video/from-url" -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/not-a-real-video.mp4","analyze":false}' | grep -q uploadId && echo "OK from-url route"
echo "== smoke done =="
