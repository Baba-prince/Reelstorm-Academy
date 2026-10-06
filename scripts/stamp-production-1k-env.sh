#!/usr/bin/env bash
# Stamp production-1k defaults into a .env file (local or on VPS).
# Does NOT invent secrets — only sets safe operational defaults + prints gaps.
#
#   bash scripts/stamp-production-1k-env.sh [/path/to/.env]
set -euo pipefail

ENV_FILE="${1:-$(cd "$(dirname "$0")/.." && pwd)/.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy .env.example first"
  exit 1
fi

set_kv() {
  local k="$1" v="$2"
  if grep -q "^${k}=" "$ENV_FILE"; then
    # portable sed
    if sed --version >/dev/null 2>&1; then
      sed -i "s|^${k}=.*|${k}=${v}|" "$ENV_FILE"
    else
      sed -i '' "s|^${k}=.*|${k}=${v}|" "$ENV_FILE"
    fi
  else
    echo "${k}=${v}" >> "$ENV_FILE"
  fi
}

echo "==> Stamping production-1k defaults into $ENV_FILE"
set_kv MOCK_VIDEO_GEN 0
set_kv WORKER_CONCURRENCY 8
set_kv VIDEO_PROVIDER auto
set_kv S3_FORCE_PATH_STYLE true
# Template Room stock intros — Pixabay PRIMARY (Pexels paused). Key must be set separately.
set_kv INTRO_STOCK_PRIMARY pixabay
if [[ -n "${PIXABAY_API_KEY:-}" ]]; then
  set_kv PIXABAY_API_KEY "$PIXABAY_API_KEY"
fi

# If still on local MinIO, leave endpoint but warn — operator must replace with R2
if grep -qE '^S3_ENDPOINT=http://(127\.0\.0\.1|localhost)' "$ENV_FILE"; then
  echo "WARN: S3_ENDPOINT is localhost MinIO — replace with Cloudflare R2 HTTPS endpoint for 1k users"
fi

echo ""
echo "==> Current production gate values:"
grep -E '^(MOCK_VIDEO_GEN|WORKER_CONCURRENCY|VIDEO_PROVIDER|S3_ENDPOINT|S3_BUCKET|S3_PUBLIC_URL|S3_FORCE_PATH_STYLE|STRIPE_SECRET_KEY|DASHSCOPE_API_KEY|ELEVENLABS_API_KEY|GOOGLE_CLIENT_ID)=' "$ENV_FILE" \
  | sed -E 's/(SECRET|KEY|TOKEN)=.*/\1=***/'

echo ""
echo "Next: fill DASHSCOPE_API_KEY, ELEVENLABS_API_KEY, live Stripe, R2 S3_* — then:"
echo "  bash scripts/check-production-apis.sh"
echo "  GET /api/readiness → production1k.ready"
