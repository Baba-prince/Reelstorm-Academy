import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { Job } from "bullmq";
import { prisma } from "@reelstorm/db";
import { mergeBlocks, uploadFile, publicUrl } from "@reelstorm/media";
import { trackJob } from "../lib.js";

export type MergeMasterPayload = {
  projectId: string;
  blockIds: string[];
  title?: string;
};

export async function mergeMasterJob(job: Job<MergeMasterPayload>) {
  const { projectId, blockIds, title = "Master Cut" } = job.data;
  await trackJob("mergeMaster", String(job.id), "ACTIVE", job.data);

  const blocks = await prisma.block.findMany({
    where: { id: { in: blockIds }, projectId },
    orderBy: { index: "asc" },
  });
  if (blocks.length < 1) throw new Error("No blocks to merge");

  // Resolve local paths from assets meta when available
  const paths: string[] = [];
  for (const b of blocks) {
    if (!b.videoS3Key) continue;
    const asset = await prisma.asset.findFirst({ where: { key: b.videoS3Key } });
    const local = (asset?.meta as { localPath?: string } | null)?.localPath;
    if (local) paths.push(local);
  }

  const outDir = path.join(
    process.env.UPLOAD_TMP_DIR || path.join(process.cwd(), "../../tmp/uploads"),
    projectId,
    "masters",
  );
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `master_${Date.now()}.mp4`);

  let durationSec = blocks.reduce((a, b) => a + (b.durationSec || 0), 0);
  const s3Key = `masters/${projectId}/${path.basename(outPath)}`;

  if (paths.length >= 2) {
    await mergeBlocks(paths, outPath);
    try {
      await uploadFile(s3Key, outPath, "video/mp4");
    } catch {
      /* ok */
    }
  } else {
    // Manifest-only merge when binaries aren't local
    await writeFile(
      outPath + ".json",
      JSON.stringify({ blocks: blocks.map((b) => b.videoS3Key), title }, null, 2),
    );
  }

  const master = await prisma.masterCut.create({
    data: {
      projectId,
      title,
      blockIds: blocks.map((b) => b.id),
      s3Key,
      durationSec,
    },
  });

  await prisma.asset.create({
    data: {
      projectId,
      type: "master",
      key: s3Key,
      url: publicUrl(s3Key),
      mimeType: "video/mp4",
      labels: ["master", "merge"],
      meta: { masterId: master.id, blockIds },
    },
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "MERGED" },
  });

  await trackJob("mergeMaster", String(job.id), "COMPLETED", job.data, {
    progress: 100,
    result: { masterId: master.id, durationSec },
  });

  return master;
}
