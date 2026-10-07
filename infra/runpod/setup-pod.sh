#!/usr/bin/env bash
# Run INSIDE LIVE pod xuvnute4l51iog only (volume reelstorm-weights @ /workspace).
# DO NOT create a new volume or pod.
set -euo pipefail

cd /workspace
echo "==> Dual-saver setup on $(hostname) cwd=$(pwd)"

# 0) Env — never invent secrets; captain pastes R2_* into /workspace/.env
if [[ ! -f /workspace/.env ]]; then
  if [[ -f /workspace/reelstorm-os/infra/runpod/env.dual-saver.example ]]; then
    cp /workspace/reelstorm-os/infra/runpod/env.dual-saver.example /workspace/.env
    echo "CREATED /workspace/.env from example — PASTE live R2_* before start"
  else
    echo "WARN: no env example — create /workspace/.env with R2_* + RUNPOD_*"
  fi
fi

# shellcheck disable=SC1091
set -a
# Prefer existing keys; do not override
source /workspace/.env 2>/dev/null || true
set +a

# 1) Weights on THIS volume
WEIGHTS="${SKYREELS_CKPT:-/workspace/skyreels-1.3b-4.2GB}"
if [[ ! -d "$WEIGHTS" ]] || [[ -z "$(ls -A "$WEIGHTS" 2>/dev/null || true)" ]]; then
  pip install -q "huggingface_hub[cli]"
  huggingface-cli download Skywork/SkyReels-V2-DF-1.3B-540P --local-dir "$WEIGHTS"
else
  echo "OK: weights at $WEIGHTS"
fi

# 2) ComfyUI
if [[ ! -d /workspace/ComfyUI ]]; then
  git clone https://github.com/comfyanonymous/ComfyUI /workspace/ComfyUI
fi
mkdir -p /workspace/ComfyUI/custom_nodes /workspace/ComfyUI/models/checkpoints /workspace/ComfyUI/output
if [[ ! -d /workspace/ComfyUI/custom_nodes/SkyReels-V2 ]]; then
  git clone https://github.com/SkyworkAI/SkyReels-V2.git /workspace/ComfyUI/custom_nodes/SkyReels-V2 || true
fi
cd /workspace/ComfyUI
pip install -q -r requirements.txt || true
FIRST=$(find "$WEIGHTS" -iname '*.safetensors' 2>/dev/null | head -1 || true)
if [[ -n "${FIRST}" ]]; then
  ln -sfn "$FIRST" /workspace/ComfyUI/models/checkpoints/skyreels_v2_df_1.3b_540p.safetensors
fi

# 3) FastAPI dual-saver wrapper
mkdir -p /workspace/api
SRC=""
for cand in \
  /workspace/reelstorm-os/infra/runpod/api/server.py \
  /workspace/infra/runpod/api/server.py \
  /opt/reelstorm-os/infra/runpod/api/server.py
 do
  [[ -f "$cand" ]] && SRC="$cand" && break
done
if [[ -n "$SRC" ]]; then
  cp "$SRC" /workspace/api/server.py
  echo "Installed server.py from $SRC"
else
  echo "ERROR: server.py not found — clone Reelstorm-Academy into /workspace/reelstorm-os"
  exit 1
fi
pip install -q fastapi uvicorn boto3 requests pydantic python-dotenv

cat > /workspace/api/start.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd /workspace
set -a
# shellcheck disable=SC1091
source /workspace/.env
set +a
export RUNPOD_COMFYUI_INTERNAL="${RUNPOD_COMFYUI_INTERNAL:-http://127.0.0.1:8188}"
export COMFY_URL="$RUNPOD_COMFYUI_INTERNAL"
export SKYREELS_CKPT="${SKYREELS_CKPT:-/workspace/skyreels-1.3b-4.2GB}"
export PORT="${PORT:-8000}"

# ComfyUI internal (pod already may expose 3000 — we bind 8188 for API wrapper)
if ! curl -sf "${RUNPOD_COMFYUI_INTERNAL}/system_stats" >/dev/null 2>&1; then
  echo "Starting ComfyUI on 8188…"
  cd /workspace/ComfyUI
  python main.py --listen 127.0.0.1 --port 8188 &
  sleep 5
fi

cd /workspace/api
exec python server.py
EOF
chmod +x /workspace/api/start.sh

echo "==> Next"
echo "  1) Edit /workspace/.env — paste LIVE R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY"
echo "  2) Expose HTTP 8000 on pod xuvnute4l51iog"
echo "  3) bash /workspace/api/start.sh"
echo "  4) curl -s http://127.0.0.1:8000/health"
echo "  5) VPS RUNPOD_SAVER_URL=https://xuvnute4l51iog-8000.proxy.runpod.net/generate"
