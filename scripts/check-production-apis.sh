#!/usr/bin/env bash
# Production API gate check for ~1000 users.
#
# Modes:
#   Offline (default) — evaluate .env via @reelstorm/domain
#   Live              — also hit /api/readiness production1k
#
#   bash scripts/check-production-apis.sh [/path/to/.env]
#   bash scripts/check-production-apis.sh --live https://app.reelstorm.uk [/path/to/.env]
#   bash scripts/check-production-apis.sh --offline-only
#
# Exit 0 when offline gate readyFor1k (and live ready when --live).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
LIVE_URL=""
OFFLINE_ONLY=0
MODE="offline"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --live)
      MODE="live"
      LIVE_URL="${2:-}"
      if [[ -z "$LIVE_URL" || "$LIVE_URL" == --* ]]; then
        LIVE_URL="${API_URL:-${NEXT_PUBLIC_API_URL:-https://app.reelstorm.uk}}"
      else
        shift
      fi
      ;;
    --offline-only)
      OFFLINE_ONLY=1
      MODE="offline"
      ;;
    --help|-h)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      ENV_FILE="$1"
      ;;
  esac
  shift
done

cd "$ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No env file at $ENV_FILE"
  exit 1
fi

if [[ ! -f "$ROOT/packages/domain/dist/production.js" ]] && [[ ! -f "$ROOT/packages/domain/dist/index.js" ]]; then
  echo "==> Building @reelstorm/domain"
  npm run build -w @reelstorm/domain
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "==> Offline production gate ($ENV_FILE)"
set +e
node --input-type=module <<NODE
import { writeFileSync } from "node:fs";
const mod = await import("$ROOT/packages/domain/dist/index.js");
const checks = mod.evaluateProductionApis(process.env);
const scored = mod.scoreProductionChecks(checks);
const keys = mod.PRODUCTION_1K_ENV_KEYS || [];
const missing = [];
for (const k of keys) {
  const v = process.env[k];
  if (!v || !String(v).trim()) missing.push(k);
}
const out = {
  mode: "offline",
  envFile: "$ENV_FILE",
  ...scored,
  missingEnvKeys: missing,
  checks,
};
writeFileSync("/tmp/rs-prod-apis.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  mode: out.mode,
  pct: out.pct,
  grade: out.grade,
  readyFor1k: out.readyFor1k,
  blocking: out.blocking,
  missingEnvKeys: missing,
  checkCount: checks.length,
  fails: checks.filter((c) => c.status === "fail").map((c) => c.id),
  partials: checks.filter((c) => c.status === "partial").map((c) => c.id),
}, null, 2));
process.exit(scored.readyFor1k ? 0 : 2);
NODE
OFFLINE_RC=$?
set -e

echo "    full report → /tmp/rs-prod-apis.json"

if [[ "$OFFLINE_ONLY" == "1" || "$MODE" != "live" ]]; then
  if [[ "$OFFLINE_RC" -eq 0 ]]; then
    echo "PRODUCTION APIS OK (offline)"
    exit 0
  fi
  echo "PRODUCTION APIS NOT READY (offline) — exit $OFFLINE_RC"
  exit "$OFFLINE_RC"
fi

LIVE_URL="${LIVE_URL%/}"
echo "==> Live readiness ($LIVE_URL)"
set +e
curl -sf --max-time 25 "$LIVE_URL/api/readiness" -o /tmp/rs-readiness-live.json
CURL_RC=$?
set -e
if [[ "$CURL_RC" -ne 0 ]]; then
  if ! curl -sf --max-time 25 "$LIVE_URL/health" >/dev/null; then
    echo "LIVE FAIL: cannot reach $LIVE_URL/api/readiness"
    exit 1
  fi
  echo "LIVE FAIL: /health ok but /api/readiness failed"
  exit 1
fi

set +e
python3 - <<'PY'
import json, sys
d = json.load(open("/tmp/rs-readiness-live.json"))
p1 = d.get("production1k") or {}
print(json.dumps({
  "mode": "live",
  "version": d.get("version"),
  "pct": d.get("pct"),
  "grade": d.get("grade"),
  "production1k": {
    "ready": p1.get("ready"),
    "pct": p1.get("pct"),
    "grade": p1.get("grade"),
    "blocking": p1.get("blocking"),
  },
  "intro_cache": (d.get("checks") or {}).get("intro_cache"),
  "auth": (d.get("checks") or {}).get("auth"),
  "llm": (d.get("checks") or {}).get("llm"),
  "s3": (d.get("checks") or {}).get("s3"),
}, indent=2))
ready = bool(p1.get("ready"))
sys.exit(0 if ready else 3)
PY
LIVE_RC=$?
set -e

if [[ "$OFFLINE_RC" -eq 0 && "$LIVE_RC" -eq 0 ]]; then
  echo "PRODUCTION APIS OK (offline + live)"
  exit 0
fi

echo "PRODUCTION APIS GAP — offline_rc=$OFFLINE_RC live_rc=$LIVE_RC"
# Prefer live failure code if offline passed
if [[ "$LIVE_RC" -ne 0 ]]; then
  exit "$LIVE_RC"
fi
exit "$OFFLINE_RC"
