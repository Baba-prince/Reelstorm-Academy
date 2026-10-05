import path from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import type { Job } from "bullmq";
import { prisma } from "@reelstorm/db";
import { analyzeVideo, uploadFile, publicUrl, splitIntoArchive5Blocks } from "@reelstorm/media";
import { publishProgress, trackJob } from "../lib.js";

export type AnalyzeVideoPayload = {
  uploadId: string;
  localPath?: string;
  s3Key: string;
  projectId?: string | null;
};

export async function analyzeVideoJob(job: Job<AnalyzeVideoPayload>) {
  const { uploadId, s3Key, projectId } = job.data;
  await trackJob("analyzeVideo", String(job.id), "ACTIVE", job.data, { progress: 1 });

  let localPath = job.data.localPath;
  if (!localPath) {
    throw new Error("localPath required for analyzeVideo (download-from-S3 not wired in MVP)");
  }

  const workDir = path.join(
    process.env.UPLOAD_TMP_DIR || path.join(process.cwd(), "../../tmp/uploads"),
    uploadId,
    "analysis",
  );
  await mkdir(workDir, { recursive: true });

  try {
    const analysis = await analyzeVideo(localPath, workDir, async (stage, percent, message) => {
      await publishProgress(uploadId, { stage: stage as never, percent, message });
      await job.updateProgress(percent);
    });

    await prisma.videoUpload.update({
      where: { id: uploadId },
      data: {
        durationSec: analysis.probe.durationSec,
        width: analysis.probe.width,
        height: analysis.probe.height,
        fps: analysis.probe.fps,
        analysisJson: analysis as object,
        status: "ANALYZING",
        progressPct: 96,
        progressMsg: "Analysis stored — extracting template",
      },
    });

    // Auto-split into ARCHIVE5 if long enough and project linked
    if (projectId && analysis.probe.durationSec >= 300) {
      await publishProgress(uploadId, {
        stage: "block_split",
        percent: 97,
        message: "Splitting into 5-min ARCHIVE5 blocks",
      });
      const blockDir = path.join(workDir, "blocks");
      const blocks = await splitIntoArchive5Blocks(localPath, blockDir);
      for (const b of blocks) {
        const key = `archive5/${projectId}/${uploadId}/block_${String(b.index).padStart(3, "0")}.mp4`;
        try {
          await uploadFile(key, b.path, "video/mp4");
        } catch {
          /* local ok */
        }
        await prisma.block.upsert({
          where: { projectId_index: { projectId, index: b.index } },
          create: {
            projectId,
            uploadId,
            index: b.index,
            title: `ARCHIVE5::BLOCK_${String(b.index).padStart(3, "0")}`,
            durationSec: b.durationSec,
            status: "ARCHIVED",
            videoS3Key: key,
            archive5Json: {
              startSec: b.startSec,
              durationSec: b.durationSec,
              sourceUploadId: uploadId,
            },
          },
          update: {
            uploadId,
            durationSec: b.durationSec,
            status: "ARCHIVED",
            videoS3Key: key,
          },
        });
        await prisma.asset.create({
          data: {
            projectId,
            type: "block",
            key,
            url: publicUrl(key),
            mimeType: "video/mp4",
            labels: ["archive5", `block_${b.index}`],
            meta: { uploadId, index: b.index },
          },
        });
      }
    }

    await publishProgress(uploadId, {
      stage: "complete",
      percent: 100,
      message: "Video intelligence complete",
    });

    // Chain extractTemplate
    const { Queue } = await import("bullmq");
    const q = new Queue("extractTemplate", { connection: (await import("../lib.js")).redis() });
    await q.add("extractTemplate", {
      uploadId,
      localPath,
      s3Key,
      projectId,
    });
    await q.close();

    await trackJob("analyzeVideo", String(job.id), "COMPLETED", job.data, {
      progress: 100,
      result: { scenes: analysis.scenes.length, durationSec: analysis.probe.durationSec },
    });

    return analysis;
  } catch (err) {
    const message = (err as Error).message;
    await publishProgress(uploadId, { stage: "failed", percent: 0, error: message });
    await trackJob("analyzeVideo", String(job.id), "FAILED", job.data, { error: message });
    throw err;
  }
}
