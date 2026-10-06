#!/usr/bin/env bash
# Deploy REELSTORM to IONOS VPS WITHOUT clashing with other projects.
#
# Isolation contract:
#   Dir:     /opt/reelstorm-os
#   PM2:     reelstorm-api | reelstorm-worker | reelstorm-web  (only these are touched)
#   Ports:   WEB 3017 · API 4017  (not 3000/4000 — leave those for other apps)
#   Redis:   redis://127.0.0.1:6379/17 + BULLMQ_PREFIX=reelstorm
#   Nginx:   ONLY sites-available/reelstorm + server_name *.reelstorm.uk
#            NEVER deletes other sites-enabled entries
#   SSL:     certbot only for reelstorm.uk hosts
#
#   export VPS=root@87.106.103.43
#   export SSHPASS='…'   # or SSH key
#   bash scripts/deploy-vps.sh
set -euo pipefail

VPS="${VPS:-root@87.106.103.43}"
APP_DIR="${APP_DIR:-/opt/reelstorm-os}"
REPO="${REPO:-https://github.com/Beeplus7/Reelstorm-Academy.git}"
BRANCH="${BRANCH:-main}"
RS_WEB_PORT="${RS_WEB_PORT:-3017}"
RS_API_PORT="${RS_API_PORT:-4017}"
RS_REDIS_DB="${RS_REDIS_DB:-17}"
RS_PM2_API="${RS_PM2_API:-reelstorm-api}"
RS_PM2_WORKER="${RS_PM2_WORKER:-reelstorm-worker}"
RS_PM2_WEB="${RS_PM2_WEB:-reelstorm-web}"

ssh_cmd() {
  local opts=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=30)
  if [[ -n "${SSHPASS:-}" ]] && command -v sshpass >/dev/null; then
    # Password path: don't attempt keys first (IONOS often rejects mixed auth)
    opts+=(-o PreferredAuthentications=password -o PubkeyAuthentication=no)
    sshpass -e ssh "${opts[@]}" "$@"
  else
    ssh "${opts[@]}" "$@"
  fi
}

scp_cmd() {
  local opts=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=30)
  if [[ -n "${SSHPASS:-}" ]] && command -v sshpass >/dev/null; then
    opts+=(-o PreferredAuthentications=password -o PubkeyAuthentication=no)
    sshpass -e scp "${opts[@]}" "$@"
  else
    scp "${opts[@]}" "$@"
  fi
}

echo "==> Probe $VPS (inventory — do not disturb other projects)"
ssh_cmd "$VPS" 'bash -s' <<'REMOTE'
set -euo pipefail
echo "--- host ---"; uname -a; free -h | head -2
echo "--- listening ports (existing apps) ---"
ss -tlnp 2>/dev/null | awk 'NR==1 || /LISTEN/' | head -40 || netstat -tlnp 2>/dev/null | head -40
echo "--- pm2 (other projects) ---"
pm2 jlist 2>/dev/null | python3 -c "import sys,json
try:
  apps=json.load(sys.stdin)
  for a in apps: print(a.get('name'), a.get('pm2_env',{}).get('status'), a.get('pm2_env',{}).get('pm_cwd',''))
except Exception as e: print('(pm2 empty or unavailable)', e)
" || echo "(no pm2)"
echo "--- nginx sites-enabled ---"
ls -la /etc/nginx/sites-enabled 2>/dev/null || echo "(no nginx sites yet)"
REMOTE

echo "==> Bootstrap packages (safe — shared nginx/redis OK; we isolate by port/db/vhost)"
ssh_cmd "$VPS" 'bash -s' <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git build-essential nginx redis-server ca-certificates ffmpeg
# Allow Redis DB index 17 for ReelStorm isolation (default max is 15)
if grep -q '^databases ' /etc/redis/redis.conf 2>/dev/null; then
  sed -i 's/^databases .*/databases 32/' /etc/redis/redis.conf
elif [[ -f /etc/redis/redis.conf ]]; then
  echo 'databases 32' >> /etc/redis/redis.conf
fi
systemctl restart redis-server || true
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null || npm i -g pm2
systemctl enable --now redis-server nginx || true
node -v; npm -v; redis-cli ping
REMOTE

echo "==> Sync repo ONLY into $APP_DIR"
ssh_cmd "$VPS" "mkdir -p $APP_DIR && if [[ -d $APP_DIR/.git ]]; then cd $APP_DIR && git fetch origin && git checkout $BRANCH && git reset --hard origin/$BRANCH; else git clone -b $BRANCH $REPO $APP_DIR; fi"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  echo "==> Upload .env → $APP_DIR/.env only"
  scp_cmd "$ROOT/.env" "$VPS:$APP_DIR/.env"
else
  echo "WARN: no local .env"
fi

echo "==> Stamp isolation env (ports / redis db / bull prefix / public URLs)"
ssh_cmd "$VPS" "bash -s" <<REMOTE
set -euo pipefail
cd $APP_DIR
touch .env
set_kv() {
  local k="\$1" v="\$2"
  if grep -q "^\$k=" .env; then
    sed -i "s|^\$k=.*|\$k=\$v|" .env
  else
    echo "\$k=\$v" >> .env
  fi
}
set_kv NODE_ENV production
set_kv API_HOST 127.0.0.1
set_kv API_PORT $RS_API_PORT
set_kv PORT $RS_WEB_PORT
set_kv NEXT_PUBLIC_API_URL https://api.reelstorm.uk
set_kv NEXT_PUBLIC_APP_URL https://app.reelstorm.uk
set_kv NEXT_PUBLIC_MARKETING_URL https://reelstorm.uk
set_kv APP_URL https://app.reelstorm.uk
set_kv MARKETING_URL https://reelstorm.uk
set_kv REDIS_URL redis://127.0.0.1:6379/$RS_REDIS_DB
set_kv BULLMQ_PREFIX reelstorm
set_kv UPLOAD_TMP_DIR $APP_DIR/tmp/uploads
# Production 1k defaults — real video gen + worker scale
set_kv MOCK_VIDEO_GEN 0
set_kv WORKER_CONCURRENCY 8
set_kv VIDEO_PROVIDER auto
mkdir -p $APP_DIR/tmp/uploads
echo "Isolation:"
grep -E '^(API_PORT|PORT|REDIS_URL|BULLMQ_PREFIX|NEXT_PUBLIC_API_URL|UPLOAD_TMP_DIR|MOCK_VIDEO_GEN|WORKER_CONCURRENCY)=' .env
REMOTE

echo "==> Install + build (inside $APP_DIR only)"
ssh_cmd "$VPS" "cd $APP_DIR && npm install && npm run build -w @reelstorm/domain && npm run db:generate && npx prisma db push --schema packages/db/prisma/schema.prisma --accept-data-loss && npm run build -w @reelstorm/api -w @reelstorm/worker -w @reelstorm/web"

echo "==> PM2 — restart ONLY ReelStorm apps (leave other projects alone)"
ssh_cmd "$VPS" "bash -s" <<REMOTE
set -euo pipefail
cd $APP_DIR
# Delete only our named processes
pm2 delete $RS_PM2_API $RS_PM2_WORKER $RS_PM2_WEB 2>/dev/null || true
# Also clean legacy short names from earlier scripts if present
pm2 delete rs-api rs-worker rs-web 2>/dev/null || true

pm2 start bash --name $RS_PM2_API -- -lc "cd $APP_DIR && set -a && source .env && set +a && export API_PORT=$RS_API_PORT API_HOST=127.0.0.1 && npm run start -w @reelstorm/api"
pm2 start bash --name $RS_PM2_WORKER -- -lc "cd $APP_DIR && set -a && source .env && set +a && npm run start -w @reelstorm/worker"
pm2 start bash --name $RS_PM2_WEB -- -lc "cd $APP_DIR && set -a && source .env && set +a && export PORT=$RS_WEB_PORT && npm run start -w @reelstorm/web -- -p $RS_WEB_PORT"

pm2 save
pm2 status
echo "--- confirming other PM2 apps still listed ---"
pm2 jlist | python3 -c "import sys,json; apps=json.load(sys.stdin); print('total_apps', len(apps));
[print(' ',a.get('name'), a.get('pm2_env',{}).get('status')) for a in apps]"
REMOTE

echo "==> Nginx — write ONLY reelstorm site (do not remove other sites)"
ssh_cmd "$VPS" "bash -s" <<REMOTE
set -euo pipefail
cat > /etc/nginx/sites-available/reelstorm <<NGX
# REELSTORM only — other projects keep their own server_name blocks
upstream reelstorm_web { server 127.0.0.1:${RS_WEB_PORT}; keepalive 8; }
upstream reelstorm_api { server 127.0.0.1:${RS_API_PORT}; keepalive 8; }

server {
  listen 80;
  listen [::]:80;
  server_name reelstorm.uk www.reelstorm.uk app.reelstorm.uk;
  client_max_body_size 2G;
  location /.well-known/acme-challenge/ { root /var/www/html; }
  # Same-origin API proxy (Stripe webhook, readiness, Templates Room)
  location /api/ {
    proxy_pass http://reelstorm_api;
    proxy_http_version 1.1;
    proxy_set_header Host \\\$host;
    proxy_set_header X-Real-IP \\\$remote_addr;
    proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \\\$scheme;
    proxy_request_buffering off;
  }
  location /ws/ {
    proxy_pass http://reelstorm_api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \\\$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \\\$host;
    proxy_set_header X-Real-IP \\\$remote_addr;
    proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \\\$scheme;
    proxy_read_timeout 3600s;
  }
  location / {
    proxy_pass http://reelstorm_web;
    proxy_http_version 1.1;
    proxy_set_header Host \\\$host;
    proxy_set_header X-Real-IP \\\$remote_addr;
    proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \\\$scheme;
    proxy_set_header Upgrade \\\$http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}

server {
  listen 80;
  listen [::]:80;
  server_name api.reelstorm.uk;
  client_max_body_size 2G;
  location /.well-known/acme-challenge/ { root /var/www/html; }
  location / {
    proxy_pass http://reelstorm_api;
    proxy_http_version 1.1;
    proxy_set_header Host \\\$host;
    proxy_set_header X-Real-IP \\\$remote_addr;
    proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \\\$scheme;
  }
}
NGX
ln -sfn /etc/nginx/sites-available/reelstorm /etc/nginx/sites-enabled/reelstorm
# IMPORTANT: do NOT rm other sites-enabled entries
echo "sites-enabled after link:"
ls -la /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
REMOTE

echo "==> Health on isolated ports"
ssh_cmd "$VPS" "curl -sS http://127.0.0.1:$RS_API_PORT/health || true; echo; curl -sS -o /dev/null -w 'web:%{http_code}\n' http://127.0.0.1:$RS_WEB_PORT/ || true"

echo ""
echo "DONE — multi-project safe."
echo "  App dir:  $APP_DIR"
echo "  Ports:    web $RS_WEB_PORT · api $RS_API_PORT"
echo "  Redis:    db $RS_REDIS_DB · prefix reelstorm"
echo "  PM2:      $RS_PM2_API / $RS_PM2_WORKER / $RS_PM2_WEB"
echo "  Nginx:    only server_name *.reelstorm.uk"
echo "Next: bash scripts/apply-ssl.sh  (only reelstorm domains)"
