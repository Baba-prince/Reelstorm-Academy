#!/usr/bin/env bash
# Safe VPS restart — always re-source /opt/reelstorm-os/.env and wait until :4017 is live.
# Usage (on VPS): bash scripts/restart-reelstorm-api.sh
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/reelstorm-os}"
cd "$APP_DIR"

pm2 delete reelstorm-api 2>/dev/null || true
# Clear stale listeners
if command -v ss >/dev/null; then
  for p in $(ss -tlnp 2>/dev/null | awk '/:4017/ {print}' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u); do
    kill "$p" 2>/dev/null || true
  done
fi

pm2 start bash --name reelstorm-api -- -lc \
  "cd $APP_DIR && set -a && source .env && set +a && export API_PORT=4017 API_HOST=127.0.0.1 && npm run start -w @reelstorm/api"
pm2 save >/dev/null

echo "Waiting for http://127.0.0.1:4017/health …"
ok=0
for i in $(seq 1 20); do
  if curl -sf --max-time 2 http://127.0.0.1:4017/health >/dev/null 2>&1; then
    echo "ready after ${i}s"
    ok=1
    break
  fi
  sleep 1
done
if [[ "$ok" != "1" ]]; then
  echo "ERROR: API did not become ready"
  pm2 logs reelstorm-api --err --lines 30 --nostream || true
  exit 1
fi

echo "=== /health ==="
curl -sS http://127.0.0.1:4017/health; echo
echo "=== /api/studio/saver-health ==="
curl -sS http://127.0.0.1:4017/api/studio/saver-health; echo
