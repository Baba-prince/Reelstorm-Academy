import IORedis from "ioredis";
import { prisma } from "@reelstorm/db";
import type { AnalysisProgress } from "@reelstorm/domain";

// ioredis default export typing breaks under NodeNext — runtime is fine
const Redis = IORedis as any;

let connection: any = null;

export function redis() {
  if (!connection) {
    connection = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

/** Same prefix as API Queue — keeps BullMQ off other VPS projects' Redis keys */
export function bullPrefix(): string {
  return process.env.BULLMQ_PREFIX || "reelstorm";
}

export async function publishProgress(uploadId: string, progress: Omit<AnalysisProgress, "uploadId">) {
  const payload: AnalysisProgress = { uploadId, ...progress };
  await redis().publish(`analysis:${uploadId}`, JSON.stringify(payload));

  const statusMap: Record<string, "ANALYZING" | "EXTRACTING" | "READY" | "FAILED" | "UPLOADED"> = {
    queued: "ANALYZING",
    uploading: "UPLOADED",
    probing: "ANALYZING",
    scene_detect: "ANALYZING",
    style_dna: "ANALYZING",
    faces: "ANALYZING",
    rooms: "ANALYZING",
    audio: "ANALYZING",
    template_extract: "EXTRACTING",
    block_split: "EXTRACTING",
    complete: "READY",
    failed: "FAILED",
  };

  await prisma.videoUpload.update({
    where: { id: uploadId },
    data: {
      progressPct: progress.percent,
      progressMsg: progress.message,
      error: progress.error,
      status: statusMap[progress.stage] || "ANALYZING",
    },
  }).catch(() => undefined);
}

export async function trackJob(
  queue: string,
  jobId: string,
  status: "QUEUED" | "ACTIVE" | "COMPLETED" | "FAILED",
  payload: unknown,
  extra?: { progress?: number; result?: unknown; error?: string },
) {
  await prisma.jobRecord.upsert({
    where: { jobId },
    create: {
      queue,
      jobId,
      status,
      payload: payload as object,
      progress: extra?.progress ?? 0,
      result: extra?.result as object | undefined,
      error: extra?.error,
    },
    update: {
      status,
      progress: extra?.progress,
      result: extra?.result as object | undefined,
      error: extra?.error,
    },
  });
}
