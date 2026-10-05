import type { FastifyInstance } from "fastify";
import { prisma } from "@reelstorm/db";
import { enqueue } from "../lib/queue.js";
import { breakScriptIntoShots } from "@reelstorm/providers";

export async function worldRoutes(app: FastifyInstance) {
  app.post("/api/world-builder/soul", async (req, reply) => {
    const body = (req.body || {}) as {
      projectId?: string;
      name?: string;
      faceHash?: string;
      angles?: { front?: string; left?: string; right?: string; threeQuarter?: string };
    };
    if (!body.projectId || !body.name) {
      return reply.code(400).send({ error: "projectId and name required" });
    }
    const soul = await prisma.soulIdentity.create({
      data: {
        projectId: body.projectId,
        name: body.name,
        faceHash: body.faceHash || `soul_${Date.now()}`,
        frontKey: body.angles?.front,
        leftKey: body.angles?.left,
        rightKey: body.angles?.right,
        threeQKey: body.angles?.threeQuarter,
        locked: true,
      },
    });
    await prisma.project.update({
      where: { id: body.projectId },
      data: { status: "WORLD_BUILDING" },
    });
    return reply.code(201).send({ soul });
  });

  app.post("/api/world-builder/room", async (req, reply) => {
    const body = (req.body || {}) as {
      projectId?: string;
      name?: string;
      plates?: { wide?: string; medium?: string; overShoulder?: string; close?: string };
      lut?: string;
    };
    if (!body.projectId || !body.name) {
      return reply.code(400).send({ error: "projectId and name required" });
    }
    const room = await prisma.roomPlate.create({
      data: {
        projectId: body.projectId,
        name: body.name,
        wideKey: body.plates?.wide,
        mediumKey: body.plates?.medium,
        oshKey: body.plates?.overShoulder,
        closeKey: body.plates?.close,
        lut: body.lut,
        lightingLocked: true,
      },
    });
    return reply.code(201).send({ room });
  });
}

export async function storyboardRoutes(app: FastifyInstance) {
  app.post("/api/storyboard/generate", async (req, reply) => {
    const body = (req.body || {}) as { projectId?: string };
    if (!body.projectId) return reply.code(400).send({ error: "projectId required" });
    const project = await prisma.project.findUnique({ where: { id: body.projectId } });
    if (!project?.script) return reply.code(400).send({ error: "Project needs a script" });

    const shots = (await breakScriptIntoShots(project.script)) as {
      shots?: Array<{ prompt?: string; index?: number }>;
    };
    const list = shots.shots?.length
      ? shots.shots
      : Array.from({ length: 12 }, (_, i) => ({
          index: i,
          prompt: `Shot ${i + 1} from: ${project.title}`,
        }));

    await prisma.storyboardFrame.deleteMany({ where: { projectId: project.id } });
    const frames = await Promise.all(
      list.map((s, i) =>
        prisma.storyboardFrame.create({
          data: {
            projectId: project.id,
            shotIndex: s.index ?? i,
            prompt: s.prompt || `Shot ${i + 1}`,
            approved: false,
          },
        }),
      ),
    );
    await prisma.project.update({
      where: { id: project.id },
      data: { status: "STORYBOARD" },
    });
    return { frames };
  });

  app.post("/api/storyboard/:id/approve", async (req, reply) => {
    const { id } = req.params as { id: string };
    const frame = await prisma.storyboardFrame.update({
      where: { id },
      data: { approved: true },
    });
    return { frame };
  });
}

export async function generateRoutes(app: FastifyInstance) {
  app.post("/api/generate", async (req, reply) => {
    const body = (req.body || {}) as {
      projectId?: string;
      templateId?: string;
      script?: string;
      vibe?: string;
    };
    if (!body.projectId) return reply.code(400).send({ error: "projectId required" });
    const job = await enqueue("generateVideo", {
      projectId: body.projectId,
      templateId: body.templateId,
      script: body.script,
      vibe: body.vibe,
    });
    await prisma.project.update({
      where: { id: body.projectId },
      data: { status: "GENERATING" },
    });
    return reply.code(202).send({ jobId: job.id });
  });
}

export async function archiveRoutes(app: FastifyInstance) {
  app.get("/api/archive", async (req) => {
    const q = req.query as { projectId?: string };
    const blocks = await prisma.block.findMany({
      where: q.projectId ? { projectId: q.projectId } : undefined,
      orderBy: [{ projectId: "asc" }, { index: "asc" }],
    });
    return { blocks };
  });

  app.post("/api/archive/split", async (req, reply) => {
    const body = (req.body || {}) as { uploadId?: string; projectId?: string; localPath?: string };
    if (!body.uploadId || !body.projectId) {
      return reply.code(400).send({ error: "uploadId and projectId required" });
    }
    const job = await enqueue("archiveBlock", {
      uploadId: body.uploadId,
      projectId: body.projectId,
      localPath: body.localPath,
      mode: "split",
    });
    return reply.code(202).send({ jobId: job.id });
  });
}

export async function mergeRoutes(app: FastifyInstance) {
  app.post("/api/merge", async (req, reply) => {
    const body = (req.body || {}) as {
      projectId?: string;
      blockIds?: string[];
      title?: string;
    };
    if (!body.projectId || !body.blockIds?.length) {
      return reply.code(400).send({ error: "projectId and blockIds required" });
    }
    const job = await enqueue("mergeMaster", {
      projectId: body.projectId,
      blockIds: body.blockIds,
      title: body.title || "Master Cut",
    });
    return reply.code(202).send({ jobId: job.id });
  });
}
