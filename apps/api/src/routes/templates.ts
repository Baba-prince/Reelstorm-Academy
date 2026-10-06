import type { FastifyInstance } from "fastify";
import { prisma } from "@reelstorm/db";
import { idealCoverDataUri, TEMPLATE_ROOM_TO_INTRO_STOCK } from "@reelstorm/domain";
import { enqueue } from "../lib/queue.js";

export async function templateRoutes(app: FastifyInstance) {
  /**
   * GET /api/templates
   * ?type=intro&category=nollywood — cached stock intros from R2 (not live Pexels/Pixabay)
   * default — VideoTemplate DNA extracts
   */
  app.get("/api/templates", async (req) => {
    const q = req.query as { style?: string; type?: string; category?: string };

    if (q.type === "intro") {
      const category = q.category?.trim();
      const intros = await prisma.introTemplate.findMany({
        where: {
          type: "intro",
          ...(category ? { category } : {}),
        },
        orderBy: [{ category: "asc" }, { createdAt: "desc" }],
      });
      return {
        templates: intros.map((t) => ({
          id: t.id,
          type: "intro" as const,
          category: t.category,
          name: t.name,
          r2Url: t.r2Url,
          thumbnail: t.coverUrl || t.thumbnailUrl,
          coverUrl: t.coverUrl || t.thumbnailUrl,
          duration: t.durationSec,
          source: t.source as "pexels" | "pixabay",
          license: t.license,
          tags: t.tags,
          commercial: true,
          attribution: false,
        })),
        count: intros.length,
        byCategory: await categoryCounts(),
      };
    }

    const templates = await prisma.videoTemplate.findMany({
      where: q.style ? { stylePreset: { contains: q.style, mode: "insensitive" } } : undefined,
      orderBy: { createdAt: "desc" },
      include: { sourceUpload: { select: { id: true, filename: true, durationSec: true } } },
    });
    return { templates };
  });

  /** POST /api/templates/intros/fetch — enqueue Pexels→Pixabay→R2 fill job */
  app.post("/api/templates/intros/fetch", async (req, reply) => {
    const body = (req.body || {}) as {
      categories?: string[];
      perCategoryTarget?: number;
      perQuery?: number;
    };
    const job = await enqueue("fetchTemplateIntros", {
      categories: body.categories,
      perCategoryTarget: body.perCategoryTarget,
      perQuery: body.perQuery,
    });
    return reply.code(202).send({
      jobId: job.id,
      message: "fetchTemplateIntros queued — Pexels primary, Pixabay backup → R2",
    });
  });

  /** GET /api/templates/intros/status — fill progress for scorecard / room */
  app.get("/api/templates/intros/status", async () => {
    const byCategory = await categoryCounts();
    const total = byCategory.reduce((a, c) => a + c.count, 0);
    const target = 5 * 20;
    return {
      total,
      target,
      pct: target ? Math.min(100, Math.round((total / target) * 100)) : 0,
      byCategory,
      sources: {
        pexels: await prisma.introTemplate.count({ where: { source: "pexels" } }),
        pixabay: await prisma.introTemplate.count({ where: { source: "pixabay" } }),
      },
      note: "Stock intros are $0 API-cost media (Pexels/Pixabay free commercial) vs Seedance renders",
    };
  });

  app.get("/api/templates/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const intro = await prisma.introTemplate.findUnique({ where: { id } });
    if (intro) {
      return {
        template: {
          ...intro,
          type: "intro",
          thumbnail: intro.coverUrl || intro.thumbnailUrl,
          license: intro.license,
        },
      };
    }

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

async function categoryCounts() {
  const rows = await prisma.introTemplate.groupBy({
    by: ["category"],
    where: { type: "intro" },
    _count: { _all: true },
  });
  return rows.map((r) => ({ category: r.category, count: r._count._all }));
}

/** Attach SVG covers to ideal templates for Template Room cards */
export function withIdealCover<
  T extends { id: string; name: string; category: string; accent: string; tagline: string },
>(ideal: T) {
  return {
    ...ideal,
    coverUrl: idealCoverDataUri({
      name: ideal.name,
      category: ideal.category,
      accent: ideal.accent,
      tagline: ideal.tagline,
    }),
    stockIntroCategory: TEMPLATE_ROOM_TO_INTRO_STOCK[ideal.category] || "intros",
  };
}
