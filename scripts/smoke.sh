#!/usr/bin/env bash
# Smoke: health + readiness + BOT Director blueprint
set -euo pipefail
API="${API_URL:-http://127.0.0.1:4017}"
if ! curl -sf "$API/health" >/dev/null 2>&1; then
  API="${API_URL:-http://127.0.0.1:4000}"
fi

echo "==> health"
curl -sf "$API/health" | head -c 200; echo

echo "==> readiness"
curl -sf "$API/api/readiness" | tee /tmp/rs-readiness.json | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('grade'),d.get('pct'),d.get('production1k',{}).get('blocking'))"

echo "==> dashscope health"
curl -sf "$API/api/health/dashscope" | head -c 240; echo

echo "==> video health"
curl -sf "$API/api/health/video" | head -c 240; echo

echo "==> elevenlabs health"
curl -sf "$API/api/health/elevenlabs" | head -c 240; echo || true

echo "==> blueprint generate"
curl -sf -X POST "$API/api/blueprint/generate" \
  -H 'Content-Type: application/json' \
  -d '{"rawIdea":"Vexo Garage FOMO 30s ad","audience":"Lagos drivers"}' \
  | tee /tmp/rs-blueprint.json \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('blueprint',d.get('blueprintId'),'shots',len(d.get('movie',{}).get('shotList') or []))"

echo "SMOKE OK"
