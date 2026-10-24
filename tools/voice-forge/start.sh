#!/usr/bin/env bash
# Start Voice Forge on VPS or RunPod (no ElevenLabs).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${VOICE_FORGE_PORT:-8090}"
DATA="${VOICE_FORGE_DATA:-$DIR/data}"
mkdir -p "$DATA/voices" "$DATA/tmp"
export VOICE_FORGE_DATA="$DATA"
cd "$DIR"

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  .venv/bin/pip install -q -U pip
  .venv/bin/pip install -q fastapi "uvicorn[standard]" python-multipart pydantic soundfile numpy
  # Try Coqui TTS (may be heavy); service still runs with piper/espeak fallback
  .venv/bin/pip install -q "TTS>=0.22.0" || echo "WARN: Coqui TTS not installed — piper/espeak fallback"
fi

# Prefer GPU torch on RunPod if present
exec .venv/bin/uvicorn app:app --host 0.0.0.0 --port "$PORT"
