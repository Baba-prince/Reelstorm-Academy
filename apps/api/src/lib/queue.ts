import { Queue } from "bullmq";
import IORedis from "ioredis";

export const QUEUES = {
  analyzeVideo: "analyzeVideo",
  extractTemplate: "extractTemplate",
  generateVideo: "generateVideo",
  archiveBlock: "archiveBlock",
  mergeMaster: "mergeMaster",
  soundStudio: "soundStudio",
  fetchTemplateIntros: "fetchTemplateIntros",
  cloneReproduce: "cloneReproduce",
} as const;

export type QueueName = keyof typeof QUEUES;

/** Isolate BullMQ keys from other apps sharing the same Redis (VPS multi-project). */
export function bullPrefix(): string {
  return process.env.BULLMQ_PREFIX || "reelstorm";
}

// ioredis default export typing breaks under NodeNext — runtime is fine
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let connection: any = null;

export function redisConnection() {
  if (!connection) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Redis = IORedis as any;
    connection = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

const queues = new Map<string, Queue>();

export function getQueue(name: QueueName) {
  const qName = QUEUES[name];
  let q = queues.get(qName);
  if (!q) {
    q = new Queue(qName, {
      connection: redisConnection(),
      prefix: bullPrefix(),
    });
    queues.set(qName, q);
  }
  return q;
}

export async function enqueue<T extends Record<string, unknown>>(
  name: QueueName,
  data: T,
  opts?: { jobId?: string },
) {
  const queue = getQueue(name);
  return queue.add(name, data, {
    jobId: opts?.jobId,
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  });
}
