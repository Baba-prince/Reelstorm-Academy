import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { Job } from "bullmq";
import { prisma } from "@reelstorm/db";
import { splitIntoArchive5Blocks, uploadFile, publicUrl } from "@reelstorm/media";
import { trackJob } from "../lib.js";

export type ArchiveBlockPayload = {
  uploadId: string;
  projectId: string;
  localPath?: string;
  mode?: "split" | "single";
};

export async function archiveBlockJob(job: Job<ArchiveBlockPayload>) {
  const { uploadId, projectId, mode = "split" } = job.data;
  await trackJob("archiveBlock", String(job.id), "ACTIVE", job.data);

  const upload = await prisma.videoUpload.findUnique({ where: { id: uploadId } });
  if (!upload) throw new Error("Upload not found");

  const asset = await prisma.asset.findFirst({ where: { key: upload.s3Key } });
  const localPath =
    job.data.localPath || ((asset?.meta as { localPath?: string } | null)?.localPath);
  if (!localPath) throw new Error("localPath required");

  const workDir = path.join(
    process.env.UPLOAD_TMP_DIR || path.join(process.cwd(), "../../tmp/uploads"),
    uploadId,
    "archive",
  );
  await mkdir(workDir, { recursive: true });

  const blocks =
    mode === "split"
      ? await splitIntoArchive5Blocks(localPath, workDir)
      : [{ index: 1, path: localPath, startSec: 0, durationSec: upload.durationSec || 300 }];

  const saved = [];
  for (const b of blocks) {
    const key = `archive5/${projectId}/${uploadId}/block_${String(b.index).padStart(3, "0")}.mp4`;
    try {
      await uploadFile(key, b.path, "video/mp4");
    } catch {
      /* ok */
    }
    const row = await prisma.block.upsert({
      where: { projectId_index: { projectId, index: b.index } },
      create: {
        projectId,
        uploadId,
        index: b.index,
        title: `ARCHIVE5::BLOCK_${String(b.index).padStart(3, "0")}`,
        durationSec: b.durationSec,
        status: "ARCHIVED",
        videoS3Key: key,
        archive5Json: { startSec: b.startSec, durationSec: b.durationSec },
      },
      update: {
        status: "ARCHIVED",
        videoS3Key: key,
        durationSec: b.durationSec,
      },
    });
    await prisma.asset.create({
      data: {
        projectId,
        type: "archive5",
        key,
        url: publicUrl(key),
        mimeType: "video/mp4",
        labels: ["archive5"],
        meta: { blockId: row.id },
      },
    });
    saved.push(row);
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "ARCHIVED" },
  });

  await trackJob("archiveBlock", String(job.id), "COMPLETED", job.data, {
    progress: 100,
    result: { count: saved.length },
  });
  return saved;
}
