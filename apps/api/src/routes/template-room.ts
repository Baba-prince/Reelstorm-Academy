import type { FastifyInstance } from "fastify";
import { prisma } from "@reelstorm/db";
import {
  IDEAL_TEMPLATES,
  TEMPLATE_ROOM_CATEGORIES,
  getIdealTemplate,
  idealCoverDataUri,
  idealToTemplateJson,
  listIdealTemplates,
  type TemplateRoomCategory,
} from "@reelstorm/domain";
import { enqueue } from "../lib/queue.js";
import { withIdealCover } from "./templates.js";

const CATALOG_UPLOAD_ID = "tmpl_room_catalog_root";

async function ensureCatalogUpload() {
  const existing = await prisma.videoUpload.findUnique({ where: { id: CATALOG_UPLOAD_ID } });
  if (existing) return existing;
  return prisma.videoUpload.create({
    data: {
      id: CATALOG_UPLOAD_ID,
      filename: "templates-room-catalog.json",
      mimeType: "application/json",
      bytes: BigInt(0),
      s3Key: "catalog/templates-room/root.json",
      status: "READY",
      progressPct: 100,
      progressMsg: "Templates Room catalog root",
      analysisJson: { source: "templates-room" },
    },
  });
}

async function ensureIdealAsVideoTemplate(idealId: string) {
  const ideal = getIdealTemplate(idealId);
  if (!ideal) return null;

  await ensureCatalogUpload();

  const existing = await prisma.videoTemplate.findFirst({
    where: {
      sourceUploadId: CATALOG_UPLOAD_ID,
      name: ideal.name,
      stylePreset: ideal.stylePreset,
    },
  });
  if (existing) return { ideal, template: existing };

  const json = idealToTemplateJson(ideal);
  const template = await prisma.videoTemplate.create({
    data: {
      name: ideal.name,
      stylePreset: ideal.stylePreset,
      sourceUploadId: CATALOG_UPLOAD_ID,
      durationSec: ideal.durationSec,
      fps: 24,
      aspectRatio: ideal.aspectRatio,
      lut: ideal.lut,
      templateJson: json,
      thumbnailUrl: idealCoverDataUri({
        name: ideal.name,
        category: ideal.category,
        accent: ideal.accent,
        tagline: ideal.tagline,
      }),
    },
  });

  await prisma.asset.create({
    data: {
      type: "videoTemplate",
      key: `catalog/templates-room/${ideal.id}.json`,
      mimeType: "application/json",
      labels: ["templates-room", ideal.category, ...ideal.genreTags],
      meta: { idealId: ideal.id, templateId: template.id, ...json.metadata },
    },
  });

  return { ideal, template };
}

export async function templateRoomRoutes(app: FastifyInstance) {
  /** GET /api/templates/room — curated ideals */
  app.get("/api/templates/room", async (req) => {
    const q = req.query as { category?: string; q?: string };
    let list = listIdealTemplates(
      q.category && q.category !== "all" ? (q.category as TemplateRoomCategory) : "all",
    );
    if (q.q?.trim()) {
      const needle = q.q.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(needle) ||
          t.tagline.toLowerCase().includes(needle) ||
          t.idealUse.toLowerCase().includes(needle) ||
          t.region.toLowerCase().includes(needle) ||
          t.category.toLowerCase().includes(needle) ||
          t.genreTags.some((g) => g.includes(needle)) ||
          t.mood.some((m) => m.includes(needle)),
      );
    }
    return {
      categories: TEMPLATE_ROOM_CATEGORIES,
      templates: list.map(withIdealCover),
      total: list.length,
      introsHint: "GET /api/templates?type=intro&category=nollywood — R2-cached stock openers",
    };
  });

  /** GET /api/templates/room/:id */
  app.get("/api/templates/room/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const ideal = getIdealTemplate(id);
    if (!ideal) return reply.code(404).send({ error: "Ideal template not found" });
    return { template: withIdealCover(ideal), dna: idealToTemplateJson(ideal) };
  });

  /** POST /api/templates/room/seed — materialize all ideals as VideoTemplates */
  app.post("/api/templates/room/seed", async (_req, reply) => {
    const created: string[] = [];
    for (const ideal of IDEAL_TEMPLATES) {
      const row = await ensureIdealAsVideoTemplate(ideal.id);
      if (row) created.push(row.template.id);
    }
    return reply.send({ seeded: created.length, templateIds: created });
  });

  /**
   * POST /api/templates/room/:id/use
   * Create or attach a project using this ideal (script + DNA + optional generate).
   */
  app.post("/api/templates/room/:id/use", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as {
      projectId?: string;
      title?: string;
      script?: string;
      ownerEmail?: string;
      generate?: boolean;
    };

    const packed = await ensureIdealAsVideoTemplate(id);
    if (!packed) return reply.code(404).send({ error: "Ideal template not found" });
    const { ideal, template } = packed;

    let owner = await prisma.user.findFirst({
      where: body.ownerEmail ? { email: body.ownerEmail } : undefined,
      orderBy: { createdAt: "asc" },
    });
    if (!owner) {
      owner = await prisma.user.create({
        data: {
          email: body.ownerEmail || `producer+${Date.now()}@reelstorm.local`,
          name: "Templates Room Producer",
        },
      });
    }

    const script = body.script?.trim() || ideal.sampleScript;
    let project;

    if (body.projectId) {
      project = await prisma.project.update({
        where: { id: body.projectId },
        data: {
          templateId: template.id,
          script,
          title: body.title || undefined,
          status: "GENERATING",
        },
      });
    } else {
      project = await prisma.project.create({
        data: {
          title: body.title || `${ideal.name} · Ideal`,
          logline: ideal.tagline,
          script,
          status: "GENERATING",
          ownerId: owner.id,
          templateId: template.id,
        },
      });
    }

    let jobId: string | undefined;
    if (body.generate !== false) {
      const job = await enqueue("generateVideo", {
        projectId: project.id,
        templateId: template.id,
        script,
        idealId: ideal.id,
      });
      jobId = job.id;
    }

    return reply.code(201).send({
      project,
      template: {
        id: template.id,
        name: template.name,
        stylePreset: template.stylePreset,
        durationSec: template.durationSec,
        aspectRatio: template.aspectRatio,
      },
      ideal: { id: ideal.id, category: ideal.category, name: ideal.name },
      jobId,
      next: {
        worldBuilder: `/world-builder`,
        storyboard: `/storyboard`,
        forge: `/template-forge`,
      },
    });
  });
}
