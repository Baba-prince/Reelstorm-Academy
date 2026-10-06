#!/usr/bin/env bash
# Close LOCAL MVP gaps on the VPS: yt-dlp + local disk staging flags.
# Run on the server: bash scripts/close-mvp-gaps.sh
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/reelstorm-os}"
cd "$APP_DIR"

echo "==> yt-dlp"
mkdir -p "$APP_DIR/bin" "$APP_DIR/tmp/uploads"
if [[ ! -x "$APP_DIR/bin/yt-dlp" ]]; then
  curl -fsSL -o "$APP_DIR/bin/yt-dlp" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
  chmod +x "$APP_DIR/bin/yt-dlp"
fi
"$APP_DIR/bin/yt-dlp" --version || true
ln -sfn "$APP_DIR/bin/yt-dlp" /usr/local/bin/yt-dlp

set_kv() {
  local k="$1" v="$2"
  if grep -q "^${k}=" .env; then
    sed -i "s|^${k}=.*|${k}=${v}|" .env
  else
    echo "${k}=${v}" >> .env
  fi
}

# Local disk staging until Cloudflare R2 is wired (S3_* kept for future)
set_kv S3_LOCAL_OK 1
set_kv MOCK_VIDEO_GEN 1
set_kv YTDLP_PATH "$APP_DIR/bin/yt-dlp"
set_kv FFMPEG_PATH /usr/bin/ffmpeg
set_kv FFPROBE_PATH /usr/bin/ffprobe
set_kv UPLOAD_TMP_DIR "$APP_DIR/tmp/uploads"
# Keep existing MinIO endpoint values if present; probe uses S3_LOCAL_OK + disk fallback

echo "==> Stamped S3_LOCAL_OK=1 MOCK_VIDEO_GEN=1 YTDLP_PATH"
grep -E '^(S3_LOCAL_OK|MOCK_VIDEO_GEN|YTDLP_PATH|FFMPEG_PATH|FFPROBE_PATH)=' .env
echo "DONE — restart api/worker/web after package rebuild"
