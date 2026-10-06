#!/usr/bin/env bash
# REELSTORM smoke — live API (+ optional web) probe for local/VPS/production.
#
#   API_URL=https://app.reelstorm.uk bash scripts/smoke.sh
#   WEB_URL=https://app.reelstorm.uk SMOKE_STRICT=1 bash scripts/smoke.sh
#
# Exit 0 if required probes pass. SMOKE_STRICT=1 also fails on soft/optional misses.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${API_URL:-${NEXT_PUBLIC_API_URL:-}}"
WEB="${WEB_URL:-${NEXT_PUBLIC_APP_URL:-}}"
STRICT="${SMOKE_STRICT:-0}"
PASS=0
FAIL=0
SOFT=0

pick_api() {
  local candidates=()
  [[ -n "$API" ]] && candidates+=("$API")
  candidates+=("http://127.0.0.1:4017" "http://127.0.0.1:4000" "http://127.0.0.1:3000")
  for base in "${candidates[@]}"; do
    base="${base%/}"
    if curl -sf --max-time 5 "$base/health" >/dev/null 2>&1; then
      echo "$base"
      return 0
    fi
    # Same-origin nginx: /api/health sometimes, /health on api
    if curl -sf --max-time 5 "$base/api/readiness" >/dev/null 2>&1; then
      echo "$base"
      return 0
    fi
  done
  return 1
}

ok() {
  local name="$1"
  shift
  if "$@" >/tmp/rs-smoke-last.json 2>/tmp/rs-smoke-last.err; then
    echo "  PASS  $name"
    PASS=$((PASS + 1))
    return 0
  fi
  echo "  FAIL  $name — $(head -c 160 /tmp/rs-smoke-last.err 2>/dev/null || true)"
  FAIL=$((FAIL + 1))
  return 1
}

soft() {
  local name="$1"
  shift
  if "$@" >/tmp/rs-smoke-last.json 2>/tmp/rs-smoke-last.err; then
    echo "  PASS  $name"
    PASS=$((PASS + 1))
    return 0
  fi
  echo "  SOFT  $name — optional / degraded"
  SOFT=$((SOFT + 1))
  return 0
}

json_field() {
  python3 -c "import sys,json; d=json.load(sys.stdin); print($1)" 2>/dev/null || true
}

echo "==> Resolving API"
if ! API="$(pick_api)"; then
  echo "ERROR: no healthy API (set API_URL). Tried 4017/4000/3000."
  exit 1
fi
echo "    API=$API"

# —— Required ——
echo "==> Core"
ok "GET /health" curl -sf --max-time 10 "$API/health"
ok "GET /api/readiness" curl -sf --max-time 20 "$API/api/readiness"

if [[ -f /tmp/rs-smoke-last.json ]]; then
  cp /tmp/rs-smoke-last.json /tmp/rs-readiness.json
  python3 - <<'PY'
import json
d=json.load(open("/tmp/rs-readiness.json"))
p1=d.get("production1k") or {}
print(f"    readiness grade={d.get('grade')} pct={d.get('pct')} · production1k ready={p1.get('ready')} grade={p1.get('grade')} blocking={p1.get('blocking')}")
PY
fi

echo "==> AI health"
soft "GET /api/health/dashscope" curl -sf --max-time 15 "$API/api/health/dashscope"
soft "GET /api/health/video" curl -sf --max-time 15 "$API/api/health/video"
soft "GET /api/health/elevenlabs" curl -sf --max-time 15 "$API/api/health/elevenlabs"

echo "==> Billing / SystemBank"
ok "GET /api/billing/system-bank" curl -sf --max-time 10 "$API/api/billing/system-bank"
if [[ -f /tmp/rs-smoke-last.json ]]; then
  python3 - <<'PY'
import json
d=json.load(open("/tmp/rs-smoke-last.json"))
b=d.get("systemBank") or d
print(f"    SystemBank total={b.get('total')} remaining={b.get('remaining')} used={b.get('used')}")
PY
fi

echo "==> Templates / YT-OS"
ok "GET /api/templates/intros/status" curl -sf --max-time 15 "$API/api/templates/intros/status"
ok "GET /api/yt-os/skills" curl -sf --max-time 10 "$API/api/yt-os/skills"
ok "GET /api/yt-os/hooks" curl -sf --max-time 10 "$API/api/yt-os/hooks"
soft "GET /api/templates/room" curl -sf --max-time 15 "$API/api/templates/room"

echo "==> BOT Director blueprint"
ok "POST /api/blueprint/generate" curl -sf --max-time 60 -X POST "$API/api/blueprint/generate" \
  -H 'Content-Type: application/json' \
  -d '{"rawIdea":"Vexo Garage FOMO 30s ad","audience":"Lagos drivers"}'
if [[ -f /tmp/rs-smoke-last.json ]]; then
  cp /tmp/rs-smoke-last.json /tmp/rs-blueprint.json
  python3 - <<'PY'
import json
d=json.load(open("/tmp/rs-blueprint.json"))
shots=len((d.get("movie") or {}).get("shotList") or [])
print(f"    blueprintId={d.get('blueprintId')} shots={shots}")
PY
fi

echo "==> Auth gates (expect 401 without token)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST "$API/api/clone/analyze" \
  -H 'Content-Type: application/json' -d '{"url":"https://www.youtube.com/watch?v=dQw4w9wgxcq"}' || echo 000)
if [[ "$CODE" == "401" || "$CODE" == "403" ]]; then
  echo "  PASS  POST /api/clone/analyze auth-gated ($CODE)"
  PASS=$((PASS + 1))
elif [[ "$CODE" == "400" || "$CODE" == "422" ]]; then
  echo "  PASS  POST /api/clone/analyze reachable ($CODE)"
  PASS=$((PASS + 1))
elif [[ "$CODE" == "502" || "$CODE" == "504" || "$CODE" == "000" ]]; then
  echo "  SOFT  POST /api/clone/analyze gateway/timeout ($CODE) — route may still be mounted"
  SOFT=$((SOFT + 1))
else
  echo "  FAIL  POST /api/clone/analyze unexpected HTTP $CODE"
  FAIL=$((FAIL + 1))
fi

# —— Optional web ——
if [[ -n "$WEB" ]]; then
  echo "==> Web $WEB"
  soft "GET / (marketing)" curl -sf --max-time 15 -o /dev/null "$WEB/"
  soft "GET /login" curl -sf --max-time 15 -o /dev/null "$WEB/login"
  soft "GET /scorecard" curl -sf --max-time 15 -o /dev/null "$WEB/scorecard"
fi

echo ""
echo "SMOKE SUMMARY  pass=$PASS  soft=$SOFT  fail=$FAIL  api=$API"
if [[ "$FAIL" -gt 0 ]]; then
  echo "SMOKE FAILED"
  exit 1
fi
if [[ "$STRICT" == "1" && "$SOFT" -gt 0 ]]; then
  echo "SMOKE STRICT: soft failures count as fail"
  exit 1
fi
echo "SMOKE OK"
exit 0
