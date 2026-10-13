/**
 * AI Podcast Debate Studio — /api/debate/*
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "@reelstorm/db";
import {
  DEBATE_GLOSSARY,
  DEBATE_MODES,
  DEBATE_PIPELINE_STEPS,
  DEBATE_STYLES,
  classifyDebateSource,
  debateRtcCost,
  defaultHostA,
  defaultHostB,
} from "@reelstorm/domain";
import { uploadBuffer, publicUrl } from "@reelstorm/media";
import {
  stepDebateAnalyze,
  stepDebateAudio,
  stepDebateScript,
  stepDebateVideo,
  runDebateOrchestrator,
} from "@reelstorm/pipeline";
import { resolveUserFromAuthHeader } from "./auth.js";
import { debitRtc, ensureUserWallet } from "../lib/rtc.js";
import { enqueue } from "../lib/queue.js";

async function resolveUser(req: FastifyRequest, ownerEmail?: string) {
  const authed = await resolveUserFromAuthHeader(req.headers.authorization);
  if (authed) return authed;
  const email = (ownerEmail || "producer@reelstorm.academy").trim().toLowerCase();
  return prisma.user.upsert({
    where: { email },
    create: { email, name: email.split("@")[0], tier: "free" },
    update: {},
  });
}

async function charge(userId: string, amount: number, note: string, refId?: string) {
  if (amount <= 0) return null;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const wallet = await ensureUserWallet(userId, user.tier as "free");
  if (wallet.balanceRtc < amount) {
    throw Object.assign(new Error(`Need ${amount} RTC (have ${wallet.balanceRtc})`), {
      statusCode: 402,
    });
  }
  const after = await debitRtc({
    walletId: wallet.id,
    amount,
    type: "DEBIT_DEBATE",
    note,
    refType: "debate",
    refId,
  });
  await prisma.user.update({ where: { id: userId }, data: { rtcBalance: after.balanceRtc } });
  return after;
}

function parseHost(raw: unknown, fallback: ReturnType<typeof defaultHostA>) {
  const o = (raw || {}) as Record<string, unknown>;
  return {
    name: String(o.name || fallback.name),
    voiceId: o.voiceId ? String(o.voiceId) : fallback.voiceId,
    avatarId: o.avatarId ? String(o.avatarId) : fallback.avatarId,
    variantId: o.variantId ? String(o.variantId) : fallback.variantId,
    personality: String(o.personality || fallback.personality),
  };
}

type CreateBody = {
  url?: string;
  textTopic?: string;
  fileBase64?: string;
  fileName?: string;
  mimeType?: string;
  mode?: string;
  debateStyle?: string;
  hostA?: unknown;
  hostB?: unknown;
  targetLangs?: string[];
  ownerEmail?: string;
  async?: boolean;
};

async function createDebateJob(req: FastifyRequest, body: CreateBody) {
  const user = await resolveUser(req, body.ownerEmail);
  const url = (body.url || "").trim();
  const textTopic = (body.textTopic || "").trim();
  if (!url && !textTopic && !body.fileBase64) {
    throw Object.assign(new Error("file, url, or textTopic required"), { statusCode: 400 });
  }

  const mode = (body.mode || "AUDIO_ONLY") as "AUDIO_ONLY" | "VIDEO_TWO_AVATARS" | "VIDEO_ONE_AVATAR_SPLIT";
  const debateStyle = (body.debateStyle || "DEBATE_OPPOSING") as
    | "EXPLORE_TOPIC"
    | "EXPLAIN_ARGUMENTS"
    | "DEBATE_OPPOSING";
  const cost = debateRtcCost(mode);
  await charge(user.id, cost, `Debate Studio ${mode}`);

  const sourceType = classifyDebateSource(url, body.mimeType || body.fileName, textTopic);
  let sourceText: string | null = textTopic || null;
  let sourceR2Url: string | undefined;
  let sourceR2Key: string | undefined;
  let sourceUrl = url;

  if (body.fileBase64) {
    const buf = Buffer.from(body.fileBase64, "base64");
    const name = body.fileName || "upload.bin";
    const key = `debate/source/${Date.now()}_${name.replace(/[^\w.\-]+/g, "_")}`;
    const mime = body.mimeType || "application/octet-stream";
    await uploadBuffer(key, buf, mime);
    sourceR2Key = key;
    sourceR2Url = publicUrl(key);
    sourceUrl = sourceR2Url;
    if (/\.txt$/i.test(name) || mime.includes("text/plain")) {
      sourceText = buf.toString("utf8").slice(0, 60_000);
    }
    // PDF/DOCX text extracted in worker stepDebateExtract from R2 bytes
  }

  const job = await prisma.debateJob.create({
    data: {
      userId: user.id,
      sourceType,
      sourceUrl,
      sourceR2Url,
      sourceR2Key,
      sourceText,
      mode,
      debateStyle,
      hostA: parseHost(body.hostA, defaultHostA()),
      hostB: parseHost(body.hostB, defaultHostB()),
      targetLangs: body.targetLangs || [],
      status: "EXTRACTING",
      rtcCost: cost,
      logs: [`[${new Date().toISOString()}] Created · ${cost} RTC`],
    },
  });

  return { user, job, cost };
}

export async function debateRoutes(app: FastifyInstance) {
  app.get("/api/debate/meta", async () => ({
    modes: DEBATE_MODES,
    styles: DEBATE_STYLES,
    steps: DEBATE_PIPELINE_STEPS,
    glossary: DEBATE_GLOSSARY,
    rtcAudio: debateRtcCost("AUDIO_ONLY"),
    rtcVideo: debateRtcCost("VIDEO_TWO_AVATARS"),
    note: "NotebookLM Audio Overview is audio-only; ReelStorm Debate Studio adds video two avatars.",
  }));

  app.get("/api/debate/list", async (req) => {
    const user = await resolveUser(req);
    const jobs = await prisma.debateJob.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    return { jobs };
  });

  app.get("/api/debate/job/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await prisma.debateJob.findUnique({ where: { id } });
    if (!job) return reply.code(404).send({ error: "Not found" });
    return { job };
  });

  app.get("/api/debate/status", async (req) => {
    const q = req.query as { id?: string };
    if (!q.id) return { ok: false, error: "id required" };
    const job = await prisma.debateJob.findUnique({ where: { id: q.id } });
    return { ok: Boolean(job), job };
  });

  app.post("/api/debate/upload", async (req, reply) => {
    try {
      const body = (req.body || {}) as CreateBody;
      const { job, cost } = await createDebateJob(req, body);
      if (body.async !== false) {
        await enqueue(
          "debateStudio",
          { jobId: job.id, userId: job.userId },
          { jobId: `debate-${job.id}`, attempts: 2 },
        );
      }
      return {
        ok: true,
        jobId: job.id,
        sourceText: job.sourceText,
        status: job.status,
        rtcCost: cost,
      };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode || 500).send({ error: e.message });
    }
  });

  app.post("/api/debate/analyze", async (req, reply) => {
    const body = (req.body || {}) as { jobId?: string };
    if (!body.jobId) return reply.code(400).send({ error: "jobId required" });
    try {
      const { analysis } = await stepDebateAnalyze(body.jobId);
      return { analysis, status: "ANALYZING" };
    } catch (err) {
      return reply.code(500).send({ error: (err as Error).message });
    }
  });

  app.post("/api/debate/generate-script", async (req, reply) => {
    const body = (req.body || {}) as { jobId?: string };
    if (!body.jobId) return reply.code(400).send({ error: "jobId required" });
    try {
      const { script } = await stepDebateScript(body.jobId);
      return { script, status: "SCRIPTING" };
    } catch (err) {
      return reply.code(500).send({ error: (err as Error).message });
    }
  });

  app.post("/api/debate/generate-audio", async (req, reply) => {
    const body = (req.body || {}) as { jobId?: string };
    if (!body.jobId) return reply.code(400).send({ error: "jobId required" });
    try {
      const out = await stepDebateAudio(body.jobId);
      return { ...out, status: "GENERATING_AUDIO" };
    } catch (err) {
      return reply.code(500).send({ error: (err as Error).message });
    }
  });

  app.post("/api/debate/generate-video", async (req, reply) => {
    const body = (req.body || {}) as { jobId?: string };
    if (!body.jobId) return reply.code(400).send({ error: "jobId required" });
    try {
      const out = await stepDebateVideo(body.jobId);
      await prisma.debateJob.update({ where: { id: body.jobId }, data: { status: "DONE" } });
      return { ...out, status: "DONE" };
    } catch (err) {
      return reply.code(500).send({ error: (err as Error).message });
    }
  });

  app.post("/api/debate/job/:id/retry", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await prisma.debateJob.findUnique({ where: { id } });
    if (!job) return reply.code(404).send({ error: "Not found" });
    await prisma.debateJob.update({
      where: { id },
      data: { status: "EXTRACTING", error: null },
    });
    const bullId = `debate-${id}-r${Date.now()}`;
    await enqueue("debateStudio", { jobId: id, userId: job.userId }, { jobId: bullId, attempts: 2 });
    return {
      ok: true,
      jobId: id,
      status: "EXTRACTING",
      message: "Re-queued debateStudio — poll GET /api/debate/job/:id",
    };
  });

  app.post("/api/debate/orchestrate", async (req, reply) => {
    try {
      const body = (req.body || {}) as CreateBody;
      const sync = body.async === false;
      const { job, cost } = await createDebateJob(req, { ...body, async: !sync });

      if (!sync) {
        await enqueue(
          "debateStudio",
          { jobId: job.id, userId: job.userId },
          { jobId: `debate-${job.id}`, attempts: 2 },
        );
        return {
          ok: true,
          jobId: job.id,
          status: "EXTRACTING",
          rtcCost: cost,
          message: "Queued on debateStudio BullMQ — poll GET /api/debate/job/:id",
        };
      }

      const done = await runDebateOrchestrator(job.id);
      return {
        ok: true,
        jobId: done.id,
        status: done.status,
        audioUrl: done.audioUrl,
        videoUrl: done.videoUrl,
        script: done.script,
        analysis: done.analysis,
        rtcCost: cost,
      };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode || 500).send({ error: e.message });
    }
  });

  app.post("/api/debate/translate", async (req, reply) => {
    const body = (req.body || {}) as { jobId?: string; langs?: string[] };
    if (!body.jobId) return reply.code(400).send({ error: "jobId required" });
    const job = await prisma.debateJob.findUnique({ where: { id: body.jobId } });
    if (!job) return reply.code(404).send({ error: "Not found" });
    if (!job.audioUrl && !job.videoUrl) {
      return reply.code(400).send({ error: "Debate not ready — generate audio/video first" });
    }
    const langs = (body.langs || job.targetLangs || ["de", "yo", "ha", "ig"]).filter(Boolean);
    const translatedVideos = {
      ...(typeof job.translatedVideos === "object" && job.translatedVideos
        ? (job.translatedVideos as object)
        : {}),
      handoff: {
        langs,
        sourceAudio: job.audioUrl,
        sourceVideo: job.videoUrl,
        translateStudio: "/translate",
        note: "Open Language Studio with this media for de/yo/ha/ig body sync",
      },
    };
    await prisma.debateJob.update({
      where: { id: job.id },
      data: { translatedVideos, targetLangs: langs },
    });
    return {
      ok: true,
      translatedVideos,
      href: `/translate?from=debate&debateId=${job.id}`,
    };
  });
}
