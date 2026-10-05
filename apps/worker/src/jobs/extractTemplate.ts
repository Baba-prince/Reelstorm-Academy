import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { Job } from "bullmq";
import { prisma } from "@reelstorm/db";
import { extractTemplateFromVideo, uploadBuffer, publicUrl } from "@reelstorm/media";
import { publishProgress, trackJob } from "../lib.js";

export type ExtractTemplatePayload = {
  uploadId: string;
  localPath?: string;
  s3Key: string;
  name?: string;
  projectId?: string | null;
};

export async function extractTemplateJob(job: Job<ExtractTemplatePayload>) {
  const { uploadId, s3Key, name, projectId } = job.data;
  await trackJob("extractTemplate", String(job.id), "ACTIVE", job.data);

  const localPath = job.data.localPath;
  if (!localPath) throw new Error("localPath required for extractTemplate");

  const workDir = path.join(
    process.env.UPLOAD_TMP_DIR || path.join(process.cwd(), "../../tmp/uploads"),
    uploadId,
    "template",
  );
  await mkdir(workDir, { recursive: true });

  try {
    const { template } = await extractTemplateFromVideo({
      inputPath: localPath,
      workDir,
      sourceUploadId: uploadId,
      name,
      onProgress: async (stage, percent, message) => {
        await publishProgress(uploadId, { stage: stage as never, percent, message });
        await job.updateProgress(percent);
      },
    });

    const templateKey = `templates/${uploadId}/${template.id}.json`;
    try {
      await uploadBuffer(templateKey, JSON.stringify(template, null, 2), "application/json");
    } catch {
      /* local ok */
    }

    const saved = await prisma.videoTemplate.create({
      data: {
        id: template.id,
        name: template.name,
        stylePreset: template.stylePreset,
        sourceUploadId: uploadId,
        durationSec: template.durationSec,
        fps: template.fps,
        aspectRatio: template.aspectRatio,
        lut: template.lut,
        templateJson: template as object,
        s3Key: templateKey,
      },
    });

    await prisma.asset.create({
      data: {
        projectId: projectId || null,
        type: "videoTemplate",
        key: templateKey,
        url: publicUrl(templateKey),
        mimeType: "application/json",
        labels: ["template", template.stylePreset],
        meta: { templateId: saved.id, uploadId, stylePreset: template.stylePreset },
      },
    });

    if (projectId) {
      await prisma.project.update({
        where: { id: projectId },
        data: { templateId: saved.id },
      });
    }

    await prisma.videoUpload.update({
      where: { id: uploadId },
      data: {
        status: "READY",
        progressPct: 100,
        progressMsg: `Template ready: ${template.stylePreset}`,
      },
    });

    await publishProgress(uploadId, {
      stage: "complete",
      percent: 100,
      message: `Template extracted — ${template.stylePreset}`,
    });

    await trackJob("extractTemplate", String(job.id), "COMPLETED", job.data, {
      progress: 100,
      result: { templateId: saved.id, stylePreset: saved.stylePreset },
    });

    return saved;
  } catch (err) {
    const message = (err as Error).message;
    await publishProgress(uploadId, { stage: "failed", percent: 0, error: message });
    await trackJob("extractTemplate", String(job.id), "FAILED", job.data, { error: message });
    throw err;
  }
}
