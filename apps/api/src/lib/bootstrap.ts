import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = path.join(root, "tmp", "redis-data");
mkdirSync(dataDir, { recursive: true });

/** Point fluent-ffmpeg / PATH at bundled or system binaries */
export function ensureLocalBins() {
  const ffmpeg = path.join(root, "bin", "ffmpeg");
  const ffprobe = path.join(root, "bin", "ffprobe");
  const ytdlp = path.join(root, "bin", "yt-dlp");
  const binDir = path.join(root, "bin");
  const systemFfmpeg = "/usr/bin/ffmpeg";
  const systemFfprobe = "/usr/bin/ffprobe";

  if (existsSync(ffmpeg)) {
    process.env.FFMPEG_PATH = ffmpeg;
  } else if (existsSync(systemFfmpeg)) {
    process.env.FFMPEG_PATH = systemFfmpeg;
  }
  if (existsSync(ffprobe)) {
    process.env.FFPROBE_PATH = ffprobe;
  } else if (existsSync(systemFfprobe)) {
    process.env.FFPROBE_PATH = systemFfprobe;
  } else if (process.env.FFMPEG_PATH) {
    const sibling = path.join(path.dirname(process.env.FFMPEG_PATH), "ffprobe");
    if (existsSync(sibling)) process.env.FFPROBE_PATH = sibling;
  }
  if (process.env.FFMPEG_PATH || existsSync(binDir)) {
    process.env.PATH = `${binDir}:/usr/bin:${process.env.PATH || ""}`;
  }
  if (existsSync(ytdlp)) {
    process.env.YTDLP_PATH = ytdlp;
  }
  return {
    ffmpeg: Boolean(process.env.FFMPEG_PATH),
    ffprobe: Boolean(process.env.FFPROBE_PATH),
    ytdlp: existsSync(ytdlp),
    root,
  };
}

/**
 * Boot an in-process Redis (redis-memory-server) when REDIS_URL is unset or local and unreachable.
 */
export async function ensureRedis(): Promise<string> {
  ensureLocalBins();

  if (
    process.env.REDIS_URL &&
    !process.env.REDIS_URL.includes("127.0.0.1") &&
    !process.env.REDIS_URL.includes("localhost")
  ) {
    return process.env.REDIS_URL;
  }

  const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";

  try {
    const IORedisMod = (await import("ioredis")).default as any;
    const probe = new IORedisMod(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 800,
      lazyConnect: true,
    });
    await probe.connect();
    await probe.ping();
    await probe.quit();
    process.env.REDIS_URL = url;
    console.log(`[redis] using existing ${url}`);
    return url;
  } catch {
    /* fall through */
  }

  try {
    const { RedisMemoryServer } = await import("redis-memory-server");
    const preferredPort = Number(process.env.REDIS_PORT || 6379);
    const server = new RedisMemoryServer({
      instance: { port: preferredPort },
    });
    const host = await server.getHost();
    const port = await server.getPort();
    const memUrl = `redis://${host}:${port}`;
    process.env.REDIS_URL = memUrl;
    (globalThis as unknown as { __rsRedis?: unknown }).__rsRedis = server;
    writeFileSync(
      path.join(dataDir, "memory-server.json"),
      JSON.stringify({ host, port, memUrl }, null, 2),
    );
    console.log(`[redis] started redis-memory-server at ${memUrl}`);
    return memUrl;
  } catch (err) {
    console.warn("[redis] redis-memory-server unavailable:", (err as Error).message);
    process.env.REDIS_URL = url;
    return url;
  }
}

export function projectRoot() {
  return root;
}

export function uploadTmp() {
  const d = process.env.UPLOAD_TMP_DIR || path.join(root, "tmp", "uploads");
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}
