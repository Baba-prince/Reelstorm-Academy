#!/usr/bin/env bash
# Offline check of production API gates for ~1000 users.
# Prefer live: curl -sS https://app.reelstorm.uk/api/readiness | jq .production1k
#
#   bash scripts/check-production-apis.sh [/path/to/.env]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env}"
cd "$ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No env file at $ENV_FILE"
  exit 1
fi

if [[ ! -f "$ROOT/packages/domain/dist/production.js" ]]; then
  echo "==> Building @reelstorm/domain"
  npm run build -w @reelstorm/domain
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

node --input-type=module <<NODE
const mod = await import("$ROOT/packages/domain/dist/index.js");
const checks = mod.evaluateProductionApis(process.env);
const scored = mod.scoreProductionChecks(checks);
console.log(JSON.stringify({ ...scored, checks }, null, 2));
process.exit(scored.readyFor1k ? 0 : 1);
NODE
