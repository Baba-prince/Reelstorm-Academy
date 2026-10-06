#!/usr/bin/env bash
# Deploy REELSTORM to IONOS VPS (reelstorm.uk / app.reelstorm.uk)
# Usage (from laptop, after you can SSH as root):
#   export VPS=root@87.106.103.43
#   export SSHPASS='…'   # or use ssh keys
#   bash scripts/deploy-vps.sh
set -euo pipefail

VPS="${VPS:-root@87.106.103.43}"
APP_DIR="${APP_DIR:-/opt/reelstorm-os}"
REPO="${REPO:-https://github.com/Beeplus7/Reelstorm-Academy.git}"
BRANCH="${BRANCH:-main}"

ssh_cmd() {
  if [[ -n "${SSHPASS:-}" ]] && command -v sshpass >/dev/null; then
    sshpass -e ssh -o StrictHostKeyChecking=accept-new "$@"
  else
    ssh -o StrictHostKeyChecking=accept-new "$@"
  fi
}

scp_cmd() {
  if [[ -n "${SSHPASS:-}" ]] && command -v sshpass >/dev/null; then
    sshpass -e scp -o StrictHostKeyChecking=accept-new "$@"
  else
    scp -o StrictHostKeyChecking=accept-new "$@"
  fi
}

echo "==> Probe $VPS"
ssh_cmd "$VPS" 'uname -a && free -h | head -2'

echo "==> Bootstrap Node 20 + redis + nginx + pm2"
ssh_cmd "$VPS" 'bash -s' <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git build-essential nginx redis-server ca-certificates
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm i -g pm2
systemctl enable --now redis-server || true
node -v && npm -v && redis-cli ping
REMOTE

echo "==> Sync repo to $APP_DIR"
ssh_cmd "$VPS" "mkdir -p $APP_DIR && if [[ -d $APP_DIR/.git ]]; then cd $APP_DIR && git fetch origin && git checkout $BRANCH && git reset --hard origin/$BRANCH; else git clone -b $BRANCH $REPO $APP_DIR; fi"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  echo "==> Upload .env (not committed)"
  scp_cmd "$ROOT/.env" "$VPS:$APP_DIR/.env"
else
  echo "WARN: no local .env — create $APP_DIR/.env on server before start"
fi

# Production public URLs
ssh_cmd "$VPS" "cd $APP_DIR && \
  sed -i 's|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=https://api.reelstorm.uk|' .env || true; \
  sed -i 's|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://app.reelstorm.uk|' .env || true; \
  sed -i 's|^APP_URL=.*|APP_URL=https://app.reelstorm.uk|' .env || true; \
  sed -i 's|^MARKETING_URL=.*|MARKETING_URL=https://reelstorm.uk|' .env || true; \
  sed -i 's|^NEXT_PUBLIC_MARKETING_URL=.*|NEXT_PUBLIC_MARKETING_URL=https://reelstorm.uk|' .env || true; \
  grep -q '^REDIS_URL=' .env || echo 'REDIS_URL=redis://127.0.0.1:6379' >> .env; \
  grep -q '^MOCK_VIDEO_GEN=' .env || echo 'MOCK_VIDEO_GEN=1' >> .env"

echo "==> Install + build + prisma"
ssh_cmd "$VPS" "cd $APP_DIR && npm install && npm run build -w @reelstorm/domain && npm run db:generate && npx prisma db push --schema packages/db/prisma/schema.prisma --accept-data-loss && npm run build -w @reelstorm/api -w @reelstorm/worker -w @reelstorm/web"

echo "==> PM2 processes"
ssh_cmd "$VPS" 'bash -s' <<REMOTE
set -euo pipefail
cd $APP_DIR
cat > /tmp/reelstorm.ecosystem.cjs <<'EOF'
module.exports = {
  apps: [
    { name: 'rs-api', cwd: '$APP_DIR/apps/api', script: 'dist/index.js', env: { NODE_ENV: 'production' }, max_memory_restart: '512M' },
    { name: 'rs-worker', cwd: '$APP_DIR/apps/worker', script: 'dist/index.js', env: { NODE_ENV: 'production' }, max_memory_restart: '512M' },
    { name: 'rs-web', cwd: '$APP_DIR/apps/web', script: 'node_modules/next/dist/bin/next', args: 'start -p 3000', env: { NODE_ENV: 'production', PORT: '3000' }, max_memory_restart: '768M' },
  ],
};
EOF
# Prefer built JS; fall back to tsx if dist missing
if [[ ! -f apps/api/dist/index.js ]]; then
  sed -i "s|script: 'dist/index.js'|script: 'npx', args: 'tsx src/index.ts'|" /tmp/reelstorm.ecosystem.cjs || true
fi
pm2 delete rs-api rs-worker rs-web 2>/dev/null || true
# Run via npm workspaces start if available
pm2 start bash --name rs-api -- -lc "cd $APP_DIR && set -a && source .env && set +a && npm run start -w @reelstorm/api"
pm2 start bash --name rs-worker -- -lc "cd $APP_DIR && set -a && source .env && set +a && npm run start -w @reelstorm/worker"
pm2 start bash --name rs-web -- -lc "cd $APP_DIR && set -a && source .env && set +a && npm run start -w @reelstorm/web"
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || true
pm2 status
REMOTE

echo "==> Nginx vhosts"
ssh_cmd "$VPS" 'bash -s' <<'REMOTE'
set -euo pipefail
cat > /etc/nginx/sites-available/reelstorm <<'NGX'
map $host $rs_backend {
  default 3000;
}
upstream rs_web { server 127.0.0.1:3000; }
upstream rs_api { server 127.0.0.1:4000; }

server {
  listen 80;
  server_name reelstorm.uk www.reelstorm.uk app.reelstorm.uk;
  client_max_body_size 2G;
  location / {
    proxy_pass http://rs_web;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}

server {
  listen 80;
  server_name api.reelstorm.uk;
  client_max_body_size 2G;
  location / {
    proxy_pass http://rs_api;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
NGX
ln -sf /etc/nginx/sites-available/reelstorm /etc/nginx/sites-enabled/reelstorm
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
REMOTE

echo "==> Optional TLS (needs DNS pointed first)"
ssh_cmd "$VPS" 'command -v certbot >/dev/null || apt-get install -y certbot python3-certbot-nginx; \
  certbot --nginx -d reelstorm.uk -d www.reelstorm.uk -d app.reelstorm.uk -d api.reelstorm.uk --non-interactive --agree-tos -m admin@reelstorm.uk --redirect || echo "certbot skipped — point DNS then rerun"'

echo "==> Health"
ssh_cmd "$VPS" 'curl -sS http://127.0.0.1:4000/health || true; echo; curl -sS -o /dev/null -w "web:%{http_code}\n" http://127.0.0.1:3000/ || true'

echo "DONE. Point DNS A records to this VPS, then reopen https://reelstorm.uk and https://app.reelstorm.uk"
