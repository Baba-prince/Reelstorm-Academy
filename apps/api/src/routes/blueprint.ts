import type { FastifyInstance } from "fastify";
import { prisma } from "@reelstorm/db";
import {
  BOT_DIRECTOR_STAGES,
  slugStable,
  type MovieBlueprint,
  type BlueprintLogline,
  type BlueprintScene,
  type BlueprintShot,
} from "@reelstorm/domain";
import { orchestrate } from "@reelstorm/providers";
import { redisConnection } from "../lib/queue.js";

async function publishBlueprint(blueprintId: string, payload: Record<string, unknown>) {
  try {
    const redis = redisConnection();
    await redis.publish(`blueprint:${blueprintId}`, JSON.stringify(payload));
  } catch {
    /* non-fatal */
  }
}

function heuristicBlueprint(rawIdea: string, audience?: string, templateId?: string): MovieBlueprint {
  const idea = rawIdea.trim() || "Untitled storm reel";
  const title = idea.slice(0, 64);
  const aud = audience || "global social";
  const loglines: BlueprintLogline[] = [
    {
      id: "ll_01",
      text: `${idea} — cold open hook in 3 seconds, payoff before the scroll.`,
      tone: "urgent",
      durationSec: 30,
      audience: aud,
    },
    {
      id: "ll_02",
      text: `A character-led take on: ${idea}. Emotion first, product second.`,
      tone: "intimate",
      durationSec: 45,
      audience: aud,
    },
    {
      id: "ll_03",
      text: `${idea} as ARCHIVE5-ready short: one location, one reveal, one CTA.`,
      tone: "cinematic",
      durationSec: 60,
      audience: aud,
    },
  ];
  const characters = [
    {
      id: "char_01",
      stableId: slugStable("CH", "HOST", 1),
      name: "Host",
      role: "protagonist",
      notes: "Face-to-cam + performance beats",
    },
    {
      id: "char_02",
      stableId: slugStable("CH", "SUPPORT", 2),
      name: "Support",
      role: "foil",
      notes: "Reaction / social proof",
    },
  ];
  const locations = [
    {
      id: "loc_01",
      stableId: slugStable("LOC", "PRIMARY", 1),
      name: "Primary set",
      angles: 4,
      notes: "Wide · medium · OTS · close plates",
    },
  ];
  const sceneMap: BlueprintScene[] = [
    { id: "sc_01", from: "1st", to: "Hand", prompt: `${idea} — ignition hook`, type: "HOOK", startSec: 0, endSec: 5 },
    { id: "sc_02", from: "Hand", to: "Build", prompt: "Escalate stakes / desire", type: "BUILD", startSec: 5, endSec: 22 },
    { id: "sc_03", from: "Build", to: "Payoff", prompt: "Reveal + emotional land", type: "PAYOFF", startSec: 22, endSec: 40 },
    { id: "sc_04", from: "Payoff", to: "CTA", prompt: "Brand / follow CTA", type: "CTA", startSec: 40, endSec: 45 },
  ];
  const shotList: BlueprintShot[] = sceneMap.flatMap((sc, i) => {
    const dur = Math.max(3, sc.endSec - sc.startSec);
    return [
      {
        id: `sh_${String(i * 2 + 1).padStart(2, "0")}`,
        sceneId: sc.id,
        type: i === 0 ? "wide" : "medium",
        dur: Math.round(dur * 0.55),
        framing: i === 0 ? "wide" : "medium",
        camera: i % 2 === 0 ? "slow_push" : "static",
        status: "ready" as const,
        note: sc.prompt,
      },
      {
        id: `sh_${String(i * 2 + 2).padStart(2, "0")}`,
        sceneId: sc.id,
        type: "close",
        dur: Math.round(dur * 0.45),
        framing: "close",
        camera: "handheld_micro",
        status: i === 0 ? ("needs_voice" as const) : ("ready" as const),
        note: "Face / detail insert",
      },
    ];
  });
  const totalSec = shotList.reduce((a, s) => a + s.dur, 0);
  const blocks = Math.max(1, Math.ceil(totalSec / 300));
  return {
    title,
    selectedLogline: loglines[0].text,
    loglines,
    worldBible: {
      characters,
      locations,
      style: { lut: "storm_violet_03", grain: 0.12, accent: "#7C3AED" },
    },
    sceneMap,
    shotList,
    templateDNA: {
      templateId,
      stylePreset: templateId || "STORM Signature",
      aspectRatio: "9:16",
    },
    stableIds: Object.fromEntries([
      ...characters.map((c) => [c.id, c.stableId]),
      ...locations.map((l) => [l.id, l.stableId]),
      ...sceneMap.map((s) => [s.id, s.id.toUpperCase()]),
    ]),
    budget: {
      rtcEstimate: blocks * 5,
      archive5Blocks: blocks,
      notes: `${blocks} × ARCHIVE5 set @ 5 RTC (1 RTC = 1 min)`,
    },
    voiceover: { text: loglines[0].text },
  };
}

async function llmBlueprint(
  rawIdea: string,
  audience?: string,
  templateId?: string,
): Promise<MovieBlueprint> {
  const fallback = heuristicBlueprint(rawIdea, audience, templateId);
  try {
    const raw = await orchestrate(
      [
        {
          role: "system",
          content:
            "You are BOT Director for REELSTORM. Return ONLY valid JSON for a Movie Blueprint with keys: title, selectedLogline, loglines (3 items id/text/tone/durationSec/audience), worldBible {characters[{id,stableId,name,role}], locations[{id,stableId,name,angles}], style{lut,grain,accent}}, sceneMap[{id,from,to,prompt,type,startSec,endSec}], shotList[{id,sceneId,type,dur,framing,camera,status}], templateDNA{stylePreset,aspectRatio}, budget{rtcEstimate,archive5Blocks,notes}. Use stable IDs like CH_HOST_01, LOC_PRIMARY_01.",
        },
        {
          role: "user",
          content: JSON.stringify({ rawIdea, audience: audience || "global", templateId }),
        },
      ],
      { json: true, timeoutMs: 20_000 },
    );
    const parsed = JSON.parse(raw) as Partial<MovieBlueprint>;
    return {
      ...fallback,
      ...parsed,
      loglines: parsed.loglines?.length ? parsed.loglines : fallback.loglines,
      worldBible: parsed.worldBible || fallback.worldBible,
      sceneMap: parsed.sceneMap?.length ? parsed.sceneMap : fallback.sceneMap,
      shotList: parsed.shotList?.length ? parsed.shotList : fallback.shotList,
      templateDNA: { ...fallback.templateDNA, ...parsed.templateDNA, templateId },
      stableIds: parsed.stableIds || fallback.stableIds,
      budget: parsed.budget || fallback.budget,
      voiceover: parsed.voiceover || fallback.voiceover,
      selectedLogline: parsed.selectedLogline || parsed.loglines?.[0]?.text || fallback.selectedLogline,
      title: parsed.title || fallback.title,
    };
  } catch {
    return fallback;
  }
}

export async function blueprintRoutes(app: FastifyInstance) {
  app.get("/api/blueprint/stages", async () => ({ stages: BOT_DIRECTOR_STAGES }));

  app.get("/api/blueprints/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const bp = await prisma.blueprint.findUnique({ where: { id } });
    if (!bp) return reply.code(404).send({ error: "Not found" });
    return { blueprint: bp, stages: BOT_DIRECTOR_STAGES };
  });

  /** POST /api/blueprint/generate — BOT Director core */
  app.post("/api/blueprint/generate", async (req, reply) => {
    const body = (req.body || {}) as {
      rawIdea?: string;
      videoUrl?: string;
      videoFileId?: string;
      audience?: string;
      templateId?: string;
      userId?: string;
      ownerEmail?: string;
    };

    const rawIdea =
      body.rawIdea?.trim() ||
      (body.videoUrl ? `Rebuild style from ${body.videoUrl}` : "") ||
      (body.videoFileId ? `Rebuild from upload ${body.videoFileId}` : "");

    if (!rawIdea && !body.videoUrl && !body.videoFileId) {
      return reply.code(400).send({ error: "rawIdea, videoUrl, or videoFileId required" });
    }

    let userId = body.userId;
    if (!userId) {
      const email = body.ownerEmail || "producer@reelstorm.academy";
      const user = await prisma.user.upsert({
        where: { email },
        create: { email, name: "Producer" },
        update: {},
      });
      userId = user.id;
    }

    const draft = await prisma.blueprint.create({
      data: {
        userId,
        rawIdea: rawIdea || null,
        videoUrl: body.videoUrl || null,
        uploadId: body.videoFileId || null,
        templateId: body.templateId || null,
        audience: body.audience || null,
        status: "draft",
      },
    });

    await publishBlueprint(draft.id, {
      blueprintId: draft.id,
      stage: "welcome",
      engine: "SCRIPT",
      percent: 5,
      message: "BOT Director online — shaping your idea…",
    });

    await publishBlueprint(draft.id, {
      blueprintId: draft.id,
      stage: "idea",
      engine: "SCRIPT",
      percent: 25,
      message: "Generating loglines…",
    });

    const movie = await llmBlueprint(rawIdea || "Storm reel", body.audience, body.templateId);

    await publishBlueprint(draft.id, {
      blueprintId: draft.id,
      stage: "world",
      engine: "WORLD",
      percent: 55,
      message: "Locking world bible + stable IDs…",
    });
    await publishBlueprint(draft.id, {
      blueprintId: draft.id,
      stage: "scenes",
      engine: "STUDIO",
      percent: 70,
      message: "Mapping 1st Scene → Hand Scene…",
    });
    await publishBlueprint(draft.id, {
      blueprintId: draft.id,
      stage: "shots",
      engine: "ARCHIVE",
      percent: 85,
      message: "Building shot list + RTC budget…",
    });

    const blueprint = await prisma.blueprint.update({
      where: { id: draft.id },
      data: {
        status: "ready",
        loglines: movie.loglines,
        worldBible: movie.worldBible,
        sceneMap: movie.sceneMap,
        shotList: movie.shotList,
        templateDNA: movie.templateDNA,
        stableIds: movie.stableIds,
        budgetJson: movie.budget,
        voiceover: movie.voiceover || undefined,
      },
    });

    await publishBlueprint(draft.id, {
      blueprintId: draft.id,
      stage: "feed",
      engine: "MERGE",
      percent: 100,
      message: "Blueprint ready — Feed Factory",
      title: movie.title,
    });

    return reply.code(201).send({
      blueprintId: blueprint.id,
      blueprint,
      movie,
      stages: BOT_DIRECTOR_STAGES,
      wsChannel: `blueprint:${blueprint.id}`,
    });
  });

  /** POST /api/projects/from-blueprint — feed factory */
  app.post("/api/projects/from-blueprint", async (req, reply) => {
    const body = (req.body || {}) as {
      blueprintId?: string;
      ownerEmail?: string;
      userId?: string;
    };
    if (!body.blueprintId) return reply.code(400).send({ error: "blueprintId required" });

    const bp = await prisma.blueprint.findUnique({ where: { id: body.blueprintId } });
    if (!bp) return reply.code(404).send({ error: "Blueprint not found" });

    let ownerId = body.userId || bp.userId || undefined;
    if (!ownerId) {
      const email = body.ownerEmail || "producer@reelstorm.academy";
      const user = await prisma.user.upsert({
        where: { email },
        create: { email, name: "Producer" },
        update: {},
      });
      ownerId = user.id;
    }

    const movie = {
      title: (bp.rawIdea || "BOT Director Project").slice(0, 80),
      logline: Array.isArray(bp.loglines)
        ? String((bp.loglines as { text?: string }[])[0]?.text || bp.rawIdea || "")
        : String(bp.rawIdea || ""),
      script:
        typeof bp.voiceover === "object" && bp.voiceover && "text" in (bp.voiceover as object)
          ? String((bp.voiceover as { text?: string }).text)
          : String(bp.rawIdea || ""),
      templateId:
        bp.templateId ||
        (typeof bp.templateDNA === "object" && bp.templateDNA && "templateId" in (bp.templateDNA as object)
          ? String((bp.templateDNA as { templateId?: string }).templateId || "")
          : "") ||
        undefined,
    };

    const project = await prisma.project.create({
      data: {
        title: movie.title,
        logline: movie.logline,
        script: movie.script,
        ownerId,
        templateId: movie.templateId || null,
        status: "WORLD_BUILDING",
      },
    });

    const world = bp.worldBible as {
      characters?: Array<{ name: string; stableId: string; role?: string }>;
      locations?: Array<{ name: string; stableId: string }>;
    } | null;

    if (world?.characters?.length) {
      for (const c of world.characters) {
        await prisma.soulIdentity.create({
          data: {
            projectId: project.id,
            name: c.name,
            faceHash: c.stableId,
            locked: true,
          },
        });
      }
    }
    if (world?.locations?.length) {
      for (const loc of world.locations) {
        await prisma.roomPlate.create({
          data: {
            projectId: project.id,
            name: `${loc.name} (${loc.stableId})`,
            lightingLocked: true,
          },
        });
      }
    }

    const shots = (Array.isArray(bp.shotList) ? bp.shotList : []) as Array<{
      id: string;
      framing?: string;
      camera?: string;
      note?: string;
      dur?: number;
    }>;
    for (let i = 0; i < shots.length; i++) {
      const sh = shots[i];
      await prisma.storyboardFrame.create({
        data: {
          projectId: project.id,
          shotIndex: i + 1,
          prompt: `${sh.note || sh.id} · ${sh.framing || "medium"} · ${sh.camera || "static"} · ${sh.dur || 5}s`,
          approved: false,
        },
      });
    }

    await prisma.blueprint.update({
      where: { id: bp.id },
      data: { status: "fed", projectId: project.id },
    });

    await publishBlueprint(bp.id, {
      blueprintId: bp.id,
      stage: "fed",
      engine: "MERGE",
      percent: 100,
      message: `Factory project ${project.id} live`,
      projectId: project.id,
    });

    return reply.code(201).send({ project, blueprintId: bp.id });
  });
}
