import type { FastifyInstance } from "fastify";
import { prisma } from "@reelstorm/db";
import { enqueue } from "../lib/queue.js";

export async function templateRoutes(app: FastifyInstance) {
  app.get("/api/templates", async (req) => {
    const q = req.query as { style?: string };
    const templates = await prisma.videoTemplate.findMany({
      where: q.style ? { stylePreset: { contains: q.style, mode: "insensitive" } } : undefined,
      orderBy: { createdAt: "desc" },
      include: { sourceUpload: { select: { id: true, filename: true, durationSec: true } } },
    });
    return { templates };
  });

  app.get("/api/templates/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const template = await prisma.videoTemplate.findUnique({
      where: { id },
      include: { sourceUpload: true },
    });
    if (!template) return reply.code(404).send({ error: "Not found" });
    return { template };
  });

  /** POST /api/templates/from-video — extract reusable template from upload */
  app.post("/api/templates/from-video", async (req, reply) => {
    const body = (req.body || {}) as {
      uploadId?: string;
      name?: string;
      localPath?: string;
    };
    if (!body.uploadId) return reply.code(400).send({ error: "uploadId required" });

    const upload = await prisma.videoUpload.findUnique({ where: { id: body.uploadId } });
    if (!upload) return reply.code(404).send({ error: "Upload not found" });

    const asset = await prisma.asset.findFirst({ where: { key: upload.s3Key } });
    const localPath =
      body.localPath || ((asset?.meta as { localPath?: string } | null)?.localPath);

    await prisma.videoUpload.update({
      where: { id: upload.id },
      data: { status: "EXTRACTING", progressMsg: "Template extraction queued" },
    });

    const job = await enqueue("extractTemplate", {
      uploadId: upload.id,
      localPath,
      s3Key: upload.s3Key,
      name: body.name,
      projectId: upload.projectId,
    });

    return reply.code(202).send({
      jobId: job.id,
      uploadId: upload.id,
      wsChannel: `analysis:${upload.id}`,
    });
  });

  app.post("/api/templates/:id/apply", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as { projectId?: string; script?: string };
    if (!body.projectId) return reply.code(400).send({ error: "projectId required" });

    const template = await prisma.videoTemplate.findUnique({ where: { id } });
    if (!template) return reply.code(404).send({ error: "Template not found" });

    const project = await prisma.project.update({
      where: { id: body.projectId },
      data: {
        templateId: id,
        script: body.script || undefined,
        status: "GENERATING",
      },
    });

    const job = await enqueue("generateVideo", {
      projectId: project.id,
      templateId: id,
      script: body.script || project.script,
    });

    return { project, jobId: job.id };
  });
}
