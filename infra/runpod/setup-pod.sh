#!/usr/bin/env bash
# Run INSIDE Live RunPod pod xuvnute41511og (Jupyter terminal or SSH).
# Volume: /workspace (70GB reelstorm-weights) — DO NOT create a new volume/pod.
set -euo pipefail

cd /workspace
echo "==> Pod setup on $(hostname) workspace=$(pwd)"

# 1) Weights (4.2GB) — skip if already present
if [[ ! -d /workspace/skyreels-1.3b-4.2GB ]] || [[ -z "$(ls -A /workspace/skyreels-1.3b-4.2GB 2>/dev/null || true)" ]]; then
  pip install -q "huggingface_hub[cli]"
  huggingface-cli download Skywork/SkyReels-V2-DF-1.3B-540P \
    --local-dir /workspace/skyreels-1.3b-4.2GB
else
  echo "OK: weights already at /workspace/skyreels-1.3b-4.2GB"
fi

# 2) ComfyUI + SkyReels custom node
if [[ ! -d /workspace/ComfyUI ]]; then
  git clone https://github.com/comfyanonymous/ComfyUI /workspace/ComfyUI
fi
mkdir -p /workspace/ComfyUI/custom_nodes
if [[ ! -d /workspace/ComfyUI/custom_nodes/SkyReels-V2 ]]; then
  git clone https://github.com/SkyworkAI/SkyReels-V2.git /workspace/ComfyUI/custom_nodes/SkyReels-V2 || true
fi
cd /workspace/ComfyUI
pip install -q -r requirements.txt || true
mkdir -p models/checkpoints output
# Symlink/copy checkpoint name Comfy expects
if [[ -d /workspace/skyreels-1.3b-4.2GB ]]; then
  find /workspace/skyreels-1.3b-4.2GB -iname '*.safetensors' -o -iname '*.ckpt' | head -5
  # Best-effort link first safetensors into checkpoints
  FIRST=$(find /workspace/skyreels-1.3b-4.2GB -iname '*.safetensors' | head -1 || true)
  if [[ -n "${FIRST}" ]]; then
    ln -sfn "$FIRST" /workspace/ComfyUI/models/checkpoints/skyreels_v2_df_1.3b_540p.safetensors
  fi
fi

# 3) Saver FastAPI
mkdir -p /workspace/api
# Copy server.py from repo if present in /workspace/reelstorm-os, else expect uploaded
if [[ -f /workspace/reelstorm-os/infra/runpod/api/server.py ]]; then
  cp /workspace/reelstorm-os/infra/runpod/api/server.py /workspace/api/server.py
fi
pip install -q fastapi uvicorn boto3 requests pydantic

# 4) Launch helpers
cat > /workspace/api/start.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
# ComfyUI on 8188 (internal)
cd /workspace/ComfyUI
python main.py --listen 127.0.0.1 --port 8188 &
# Saver API on 8000 (expose via RunPod HTTP proxy …-8000.proxy.runpod.net)
cd /workspace/api
export COMFY_URL=http://127.0.0.1:8188
export SKYREELS_CKPT=/workspace/skyreels-1.3b-4.2GB
# Set MOCK_GENERATE=1 until Comfy+SkyReels workflow is validated
python server.py
EOF
chmod +x /workspace/api/start.sh

echo "==> Done. Next:"
echo "  1) Export R2_ENDPOINT R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_VIDEOS"
echo "  2) Expose HTTP port 8000 on the pod"
echo "  3) bash /workspace/api/start.sh"
echo "  4) curl -X POST http://127.0.0.1:8000/generate -H 'Content-Type: application/json' -d '{\"prompt\":\"test\",\"duration\":60}'"
echo "  5) VPS RUNPOD_SAVER_URL=https://xuvnute41511og-8000.proxy.runpod.net/generate"
