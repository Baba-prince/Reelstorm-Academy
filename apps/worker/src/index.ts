import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(root, ".env") });
config();

const ffmpeg = resolve(root, "bin/ffmpeg");
const ffprobe = resolve(root, "bin/ffprobe");
const ytdlp = resolve(root, "bin/yt-dlp");
const binDir = resolve(root, "bin");
if (existsSync(ffmpeg)) {
  process.env.FFMPEG_PATH = ffmpeg;
} else if (existsSync("/usr/bin/ffmpeg")) {
  process.env.FFMPEG_PATH = "/usr/bin/ffmpeg";
}
if (existsSync(ffprobe)) {
  process.env.FFPROBE_PATH = ffprobe;
} else if (existsSync("/usr/bin/ffprobe")) {
  process.env.FFPROBE_PATH = "/usr/bin/ffprobe";
} else if (process.env.FFMPEG_PATH) {
  const sibling = resolve(dirname(process.env.FFMPEG_PATH), "ffprobe");
  if (existsSync(sibling)) process.env.FFPROBE_PATH = sibling;
}
process.env.PATH = `${binDir}:/usr/bin:${process.env.PATH || ""}`;
if (existsSync(ytdlp)) process.env.YTDLP_PATH = ytdlp;

async function ensureRedis() {
  // Prefer URL written by API bootstrap so both share one Redis
  try {
    const { readFileSync } = await import("node:fs");
    const marker = resolve(root, "tmp/redis-data/memory-server.json");
    if (existsSync(marker)) {
      const j = JSON.parse(readFileSync(marker, "utf8")) as { memUrl?: string };
      if (j.memUrl) process.env.REDIS_URL = j.memUrl;
    }
  } catch {
    /* ignore */
  }

  const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  try {
    const IORedis = (await import("ioredis")).default;
    const probe = new IORedis(url, { maxRetriesPerRequest: 1, connectTimeout: 1500, lazyConnect: true });
    await probe.connect();
    await probe.ping();
    await probe.quit();
    process.env.REDIS_URL = url;
    console.log(`[worker redis] connected ${url}`);
    return;
  } catch {
    /* start own memory server as last resort */
  }
  const { RedisMemoryServer } = await import("redis-memory-server");
  const server = new RedisMemoryServer({ instance: { port: Number(process.env.REDIS_PORT || 6379) } });
  const host = await server.getHost();
  const port = await server.getPort();
  process.env.REDIS_URL = `redis://${host}:${port}`;
  (globalThis as unknown as { __rsRedis?: unknown }).__rsRedis = server;
  console.log(`[worker redis] started ${process.env.REDIS_URL}`);
}

await ensureRedis();

const { configureFfmpegPaths } = await import("@reelstorm/media");
const bins = await configureFfmpegPaths(process.env.FFMPEG_PATH);
console.log(`[worker] ffmpeg=${bins.ffmpeg} ffprobe=${bins.ffprobe}`);

const { Worker } = await import("bullmq");
const { redis, trackJob, bullPrefix } = await import("./lib.js");
const { analyzeVideoJob } = await import("./jobs/analyzeVideo.js");
const { extractTemplateJob } = await import("./jobs/extractTemplate.js");
const { generateVideoJob } = await import("./jobs/generateVideo.js");
const { archiveBlockJob } = await import("./jobs/archiveBlock.js");
const { mergeMasterJob } = await import("./jobs/mergeMaster.js");
const { soundStudioJob } = await import("./jobs/soundStudio.js");

const connection = redis();
const prefix = bullPrefix();

function start(name: string, processor: (job: never) => Promise<unknown>) {
  const worker = new Worker(name, processor as never, {
    connection,
    prefix,
    concurrency: Number(
      process.env.WORKER_CONCURRENCY || (process.env.NODE_ENV === "production" ? 8 : 2),
    ),
  });
  worker.on("ready", () => console.log(`[worker] ${name} ready (prefix=${prefix})`));
  worker.on("failed", (job, err) => {
    console.error(`[worker] ${name} failed`, job?.id, err.message);
    if (job?.id) {
      trackJob(name, String(job.id), "FAILED", job.data, { error: err.message }).catch(() => undefined);
    }
  });
  worker.on("completed", (job) => console.log(`[worker] ${name} completed`, job.id));
  return worker;
}

start("analyzeVideo", analyzeVideoJob);
start("extractTemplate", extractTemplateJob);
start("generateVideo", generateVideoJob);
start("archiveBlock", archiveBlockJob);
start("mergeMaster", mergeMasterJob);
start("soundStudio", soundStudioJob);

console.log("REELSTORM Worker online — queues ready");
