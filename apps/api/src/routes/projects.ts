import type { FastifyInstance } from "fastify";
import { prisma, type ProjectStatus } from "@reelstorm/db";

const CLEARABLE: ProjectStatus[] = [
  "DRAFT",
  "FAILED",
  "WORLD_BUILDING",
  "STORYBOARD",
  "GENERATING",
];

export async function projectRoutes(app: FastifyInstance) {
  app.get("/api/projects", async () => {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      include: { blocks: true, template: true },
    });
    return { projects };
  });

  app.post("/api/projects", async (req, reply) => {
    const body = (req.body || {}) as {
      title?: string;
      logline?: string;
      script?: string;
      ownerId?: string;
      ownerEmail?: string;
    };
    if (!body.title) return reply.code(400).send({ error: "title required" });

    let ownerId = body.ownerId;
    if (!ownerId) {
      const email = body.ownerEmail || "producer@reelstorm.academy";
      const user = await prisma.user.upsert({
        where: { email },
        create: { email, name: "Producer" },
        update: {},
      });
      ownerId = user.id;
    }

    const project = await prisma.project.create({
      data: {
        title: body.title,
        logline: body.logline,
        script: body.script,
        ownerId,
      },
    });
    return reply.code(201).send({ project });
  });

  /** Bulk clear drafts / failed / stuck — register before /:id */
  app.post("/api/projects/clear", async (req, reply) => {
    const body = (req.body || {}) as { statuses?: string[] };
    const wanted = (body.statuses?.length ? body.statuses : ["DRAFT", "FAILED"]) as ProjectStatus[];
    const statuses = wanted.filter((s) => CLEARABLE.includes(s));
    if (!statuses.length) {
      return reply.code(400).send({ error: "No clearable statuses", allowed: CLEARABLE });
    }
    const targets = await prisma.project.findMany({
      where: { status: { in: statuses } },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    });
    let deleted = 0;
    const errors: string[] = [];
    for (const t of targets) {
      try {
        await deleteProjectCascade(t.id);
        deleted += 1;
      } catch (e) {
        errors.push(`${t.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return { deleted, attempted: targets.length, errors };
  });

  app.get("/api/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        blocks: { orderBy: { index: "asc" } },
        template: true,
        uploads: { orderBy: { createdAt: "desc" } },
        soulIds: true,
        rooms: true,
        storyboards: { orderBy: { shotIndex: "asc" } },
        masters: true,
        assets: true,
      },
    });
    if (!project) return reply.code(404).send({ error: "Not found" });
    return { project };
  });

  app.patch("/api/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const project = await prisma.project.update({
      where: { id },
      data: {
        title: body.title as string | undefined,
        logline: body.logline as string | undefined,
        script: body.script as string | undefined,
        status: body.status as never,
        templateId: body.templateId as string | undefined,
      },
    });
    return { project };
  });

  app.delete("/api/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return reply.code(404).send({ error: "Not found" });
    try {
      await deleteProjectCascade(id);
    } catch (e) {
      return reply.code(500).send({ error: e instanceof Error ? e.message : "Delete failed" });
    }
    return reply.code(204).send();
  });
}

async function deleteProjectCascade(id: string) {
  await prisma.$transaction(async (tx) => {
    const sets = await tx.studioSet.findMany({ where: { projectId: id }, select: { id: true } });
    const setIds = sets.map((s) => s.id);
    if (setIds.length) {
      await tx.imageryPack.deleteMany({ where: { studioSetId: { in: setIds } } });
      await tx.artistProfile.deleteMany({ where: { studioSetId: { in: setIds } } });
      await tx.sceneSet.deleteMany({ where: { studioSetId: { in: setIds } } });
      await tx.studioSet.deleteMany({ where: { id: { in: setIds } } });
    }

    await tx.storyboardFrame.deleteMany({ where: { projectId: id } });
    await tx.masterCut.deleteMany({ where: { projectId: id } });
    await tx.soulIdentity.deleteMany({ where: { projectId: id } });
    await tx.roomPlate.deleteMany({ where: { projectId: id } });
    await tx.asset.deleteMany({ where: { projectId: id } });
    await tx.voiceProfile.deleteMany({ where: { projectId: id } });
    await tx.block.deleteMany({ where: { projectId: id } });
    await tx.blueprint.deleteMany({ where: { projectId: id } });

    // Detach uploads (templates may still reference them — null project, keep files)
    await tx.videoUpload.updateMany({ where: { projectId: id }, data: { projectId: null } });

    await tx.project.update({ where: { id }, data: { templateId: null } });
    await tx.project.delete({ where: { id } });
  });
}
