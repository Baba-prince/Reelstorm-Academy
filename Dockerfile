FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm install && npm run build -w @reelstorm/domain -w @reelstorm/media -w @reelstorm/providers -w @reelstorm/db
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe
ENV WORKER_CONCURRENCY=8
CMD ["npm", "run", "start", "-w", "@reelstorm/api"]
