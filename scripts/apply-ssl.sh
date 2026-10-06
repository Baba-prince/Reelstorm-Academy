#!/usr/bin/env bash
# Issue Let's Encrypt SSL for reelstorm.uk hosts on the IONOS VPS.
# Requires: SSH as root, nginx installed, DNS A records → this server.
#
#   export VPS=root@87.106.103.43
#   # prefer SSH key; or: export SSHPASS='…' with sshpass installed
#   bash scripts/apply-ssl.sh
set -euo pipefail

VPS="${VPS:-root@87.106.103.43}"
EMAIL="${SSL_EMAIL:-admin@reelstorm.uk}"
DOMAINS=(reelstorm.uk www.reelstorm.uk app.reelstorm.uk api.reelstorm.uk)

ssh_cmd() {
  if [[ -n "${SSHPASS:-}" ]] && command -v sshpass >/dev/null; then
    sshpass -e ssh -o StrictHostKeyChecking=accept-new "$@"
  else
    ssh -o StrictHostKeyChecking=accept-new "$@"
  fi
}

echo "==> Checking SSH to $VPS"
if ! ssh_cmd "$VPS" 'echo ok'; then
  echo "SSH failed. Add your public key to root authorized_keys or set a working SSHPASS, then rerun."
  exit 1
fi

echo "==> Install nginx + certbot if needed"
ssh_cmd "$VPS" 'export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y nginx certbot python3-certbot-nginx
  mkdir -p /var/www/html
  systemctl enable --now nginx'

echo "==> Ensure HTTP vhosts exist (certbot needs them)"
ssh_cmd "$VPS" 'bash -s' <<'REMOTE'
set -euo pipefail
cat > /etc/nginx/sites-available/reelstorm <<'NGX'
upstream rs_web { server 127.0.0.1:3000; }
upstream rs_api { server 127.0.0.1:4000; }

server {
  listen 80;
  listen [::]:80;
  server_name reelstorm.uk www.reelstorm.uk app.reelstorm.uk;
  client_max_body_size 2G;
  location /.well-known/acme-challenge/ { root /var/www/html; }
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
  listen [::]:80;
  server_name api.reelstorm.uk;
  client_max_body_size 2G;
  location /.well-known/acme-challenge/ { root /var/www/html; }
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

DOMAIN_ARGS=()
for d in "${DOMAINS[@]}"; do DOMAIN_ARGS+=(-d "$d"); done

echo "==> Request Let's Encrypt certificates"
ssh_cmd "$VPS" "certbot --nginx ${DOMAIN_ARGS[*]} --non-interactive --agree-tos -m '$EMAIL' --redirect --keep-until-expiring"

echo "==> Verify"
ssh_cmd "$VPS" 'certbot certificates; curl -sI https://reelstorm.uk | head -5; curl -sI https://app.reelstorm.uk | head -5; curl -sI https://api.reelstorm.uk/health | head -8 || true'

echo "SSL applied. Renewals: certbot.timer (systemctl status certbot.timer)"
