import type { FastifyInstance } from "fastify";
import { prisma } from "@reelstorm/db";

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
    await prisma.project.delete({ where: { id } });
    return reply.code(204).send();
  });
}
