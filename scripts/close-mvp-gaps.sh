#!/usr/bin/env bash
# Close LOCAL MVP gaps on the VPS: yt-dlp + MinIO + staging env flags.
# Run on the server: bash scripts/close-mvp-gaps.sh
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/reelstorm-os}"
cd "$APP_DIR"

echo "==> yt-dlp"
mkdir -p "$APP_DIR/bin"
if [[ ! -x "$APP_DIR/bin/yt-dlp" ]]; then
  curl -fsSL -o "$APP_DIR/bin/yt-dlp" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
  chmod +x "$APP_DIR/bin/yt-dlp"
fi
"$APP_DIR/bin/yt-dlp" --version || true
# symlink for PATH resolves
ln -sfn "$APP_DIR/bin/yt-dlp" /usr/local/bin/yt-dlp

echo "==> MinIO (local object storage staging)"
if ! command -v minio >/dev/null 2>&1 && [[ ! -x /usr/local/bin/minio ]]; then
  curl -fsSL -o /usr/local/bin/minio https://dl.min.io/server/minio/release/linux-amd64/minio
  chmod +x /usr/local/bin/minio
fi
if ! command -v mc >/dev/null 2>&1 && [[ ! -x /usr/local/bin/mc ]]; then
  curl -fsSL -o /usr/local/bin/mc https://dl.min.io/client/mc/release/linux-amd64/mc
  chmod +x /usr/local/bin/mc
fi

mkdir -p /opt/minio/data
if ! pm2 describe reelstorm-minio >/dev/null 2>&1; then
  pm2 start /usr/local/bin/minio --name reelstorm-minio -- server /opt/minio/data --address 127.0.0.1:9000 --console-address 127.0.0.1:9001
else
  pm2 restart reelstorm-minio --update-env || true
fi
sleep 2
export MINIO_ROOT_USER="${MINIO_ROOT_USER:-minio}"
export MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minio123}"
# MinIO defaults when env not set use minioadmin — set via pm2 env
pm2 delete reelstorm-minio 2>/dev/null || true
MINIO_ROOT_USER=minio MINIO_ROOT_PASSWORD=minio123 pm2 start /usr/local/bin/minio --name reelstorm-minio -- server /opt/minio/data --address 127.0.0.1:9000 --console-address 127.0.0.1:9001
sleep 2
mc alias set local http://127.0.0.1:9000 minio minio123 2>/dev/null || true
mc mb -p local/reelstorm 2>/dev/null || true
mc anonymous set download local/reelstorm 2>/dev/null || true

set_kv() {
  local k="$1" v="$2"
  if grep -q "^${k}=" .env; then
    sed -i "s|^${k}=.*|${k}=${v}|" .env
  else
    echo "${k}=${v}" >> .env
  fi
}

set_kv S3_ENDPOINT http://127.0.0.1:9000
set_kv S3_REGION us-east-1
set_kv S3_BUCKET reelstorm
set_kv S3_ACCESS_KEY_ID minio
set_kv S3_SECRET_ACCESS_KEY minio123
set_kv S3_PUBLIC_URL http://127.0.0.1:9000/reelstorm
set_kv S3_FORCE_PATH_STYLE true
set_kv S3_LOCAL_OK 1
set_kv MOCK_VIDEO_GEN 1
set_kv YTDLP_PATH "$APP_DIR/bin/yt-dlp"
set_kv FFMPEG_PATH /usr/bin/ffmpeg
set_kv FFPROBE_PATH /usr/bin/ffprobe
set_kv PATH_EXTRA "$APP_DIR/bin"

pm2 save
echo "DONE — restart api/worker after deploy"
