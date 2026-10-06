#!/usr/bin/env bash
# Let's Encrypt for REELSTORM domains only — does not touch other nginx sites.
#
#   export VPS=root@87.106.103.43
#   bash scripts/apply-ssl.sh
set -euo pipefail

VPS="${VPS:-root@87.106.103.43}"
EMAIL="${SSL_EMAIL:-admin@reelstorm.uk}"
RS_WEB_PORT="${RS_WEB_PORT:-3017}"
RS_API_PORT="${RS_API_PORT:-4017}"
CANDIDATES=(reelstorm.uk www.reelstorm.uk app.reelstorm.uk api.reelstorm.uk)

ssh_cmd() {
  if [[ -n "${SSHPASS:-}" ]] && command -v sshpass >/dev/null; then
    sshpass -e ssh -o StrictHostKeyChecking=accept-new "$@"
  else
    ssh -o StrictHostKeyChecking=accept-new "$@"
  fi
}

echo "==> Checking SSH"
ssh_cmd "$VPS" 'echo ok' >/dev/null

echo "==> Ensure reelstorm nginx site exists (no other sites removed)"
ssh_cmd "$VPS" "bash -s" <<REMOTE
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get install -y nginx certbot python3-certbot-nginx
mkdir -p /var/www/html
cat > /etc/nginx/sites-available/reelstorm <<NGX
upstream reelstorm_web { server 127.0.0.1:${RS_WEB_PORT}; }
upstream reelstorm_api { server 127.0.0.1:${RS_API_PORT}; }
server {
  listen 80; listen [::]:80;
  server_name reelstorm.uk www.reelstorm.uk app.reelstorm.uk;
  location /.well-known/acme-challenge/ { root /var/www/html; }
  location / {
    proxy_pass http://reelstorm_web;
    proxy_set_header Host \\\$host;
    proxy_set_header X-Forwarded-Proto \\\$scheme;
    proxy_set_header X-Real-IP \\\$remote_addr;
  }
}
server {
  listen 80; listen [::]:80;
  server_name api.reelstorm.uk;
  location /.well-known/acme-challenge/ { root /var/www/html; }
  location / {
    proxy_pass http://reelstorm_api;
    proxy_set_header Host \\\$host;
    proxy_set_header X-Forwarded-Proto \\\$scheme;
  }
}
NGX
ln -sfn /etc/nginx/sites-available/reelstorm /etc/nginx/sites-enabled/reelstorm
echo "Keeping all sites-enabled:"; ls /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
REMOTE

DOMAIN_ARGS=()
for d in "${CANDIDATES[@]}"; do
  if dig +short A "$d" 2>/dev/null | grep -qE '^[0-9.]+$' || getent hosts "$d" >/dev/null 2>&1; then
    DOMAIN_ARGS+=(-d "$d")
    echo "  + $d"
  else
    echo "  skip $d (no DNS yet)"
  fi
done

if [[ ${#DOMAIN_ARGS[@]} -eq 0 ]]; then
  echo "No reelstorm domains resolve — abort SSL (other projects untouched)."
  exit 1
fi

echo "==> certbot ONLY for: ${DOMAIN_ARGS[*]}"
ssh_cmd "$VPS" "certbot --nginx ${DOMAIN_ARGS[*]} --non-interactive --agree-tos -m '$EMAIL' --redirect --keep-until-expiring --cert-name reelstorm.uk"

echo "==> Verify"
ssh_cmd "$VPS" 'echo "--- certificates (reelstorm) ---"; certbot certificates 2>/dev/null | sed -n "/Certificate Name: reelstorm.uk/,/^$/p"; echo "--- sites still enabled ---"; ls /etc/nginx/sites-enabled/'

echo "SSL done for ReelStorm only. Other vhosts unchanged."
