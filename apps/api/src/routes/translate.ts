/**
 * Language Studio — /api/translate/*
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "@reelstorm/db";
import {
  TRANSLATE_LANG_META,
  TRANSLATE_PIPELINE_STEPS,
  TRANSLATE_PRIMARY_LANGS,
  TRANSLATE_RTC_PER_LANG,
  translateRtcCost,
  classifyTranslateSource,
} from "@reelstorm/domain";
import { uploadBuffer, publicUrl } from "@reelstorm/media";
import { resolveUserFromAuthHeader } from "./auth.js";
import { debitRtc, ensureUserWallet } from "../lib/rtc.js";
import { enqueue } from "../lib/queue.js";
import {
  stepDownload,
  stepTranscribe,
  stepTranslate,
  stepTts,
  stepLipsync,
  stepMuxSubtitles,
  runTranslateOrchestrator,
} from "@reelstorm/pipeline";

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

async function chargeTranslate(userId: string, amount: number, note: string, refId?: string) {
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
    type: "DEBIT_TRANSLATE",
    note,
    refType: "translate",
    refId,
  });
  await prisma.user.update({ where: { id: userId }, data: { rtcBalance: after.balanceRtc } });
  return after;
}

export async function translateRoutes(app: FastifyInstance) {
  app.get("/api/translate/meta", async () => ({
    langs: TRANSLATE_LANG_META,
    primary: TRANSLATE_PRIMARY_LANGS,
    steps: TRANSLATE_PIPELINE_STEPS,
    rtcPerLang: TRANSLATE_RTC_PER_LANG,
    whisperModel: process.env.WHISPER_MODEL || "large-v3",
    nllbModel: process.env.NLLB_MODEL || "facebook/nllb-200-3.3B",
  }));

  app.get("/api/translate/list", async (req) => {
    const user = await resolveUser(req);
    const jobs = await prisma.translationJob.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    return { jobs };
  });

  app.get("/api/translate/job/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await prisma.translationJob.findUnique({ where: { id } });
    if (!job) return reply.code(404).send({ error: "Not found" });
    return { job };
  });

  app.get("/api/translate/status", async (req) => {
    const q = req.query as { id?: string };
    if (!q.id) return { ok: false, error: "id required" };
    const job = await prisma.translationJob.findUnique({
      where: { id: q.id },
      select: {
        id: true,
        status: true,
        error: true,
        sourceR2Url: true,
        finalVideos: true,
        logs: true,
        rtcCost: true,
        updatedAt: true,
      },
    });
    return { ok: Boolean(job), job };
  });

  /** Create job + optional upload bytes */
  app.post("/api/translate/download", async (req, reply) => {
    const body = (req.body || {}) as {
      url?: string;
      targetLangs?: string[];
      ownerEmail?: string;
      fileBase64?: string;
      fileName?: string;
      avatarId?: string;
      useAvatarTwin?: boolean;
      voiceMode?: string;
    };
    const user = await resolveUser(req, body.ownerEmail);
    const langs = (body.targetLangs?.length ? body.targetLangs : [...TRANSLATE_PRIMARY_LANGS]).map(
      (l) => l.toLowerCase(),
    );
    const url = (body.url || "").trim();
    let sourceType = classifyTranslateSource(url);
    let sourceR2Url: string | undefined;
    let sourceR2Key: string | undefined;

    if (body.fileBase64) {
      sourceType = "UPLOAD";
      const buf = Buffer.from(body.fileBase64, "base64");
      const idHint = `up_${Date.now()}`;
      sourceR2Key = `translated/source/${idHint}.mp4`;
      await uploadBuffer(sourceR2Key, buf, "video/mp4");
      sourceR2Url = publicUrl(sourceR2Key);
    } else if (!url) {
      return reply.code(400).send({ error: "url or fileBase64 required" });
    }

    const job = await prisma.translationJob.create({
      data: {
        userId: user.id,
        sourceType,
        sourceUrl: url || sourceR2Url || "",
        sourceR2Url,
        sourceR2Key,
        targetLangs: langs,
        status: "DOWNLOADING",
        avatarId: body.avatarId,
        useAvatarTwin: Boolean(body.useAvatarTwin),
        voiceMode: body.voiceMode || "clone",
        rtcCost: translateRtcCost(langs),
        logs: [`Created — langs=${langs.join(",")}`],
      },
    });

    // Upload path already has source — skip yt-dlp later but still normalize key
    if (sourceType === "UPLOAD" && sourceR2Url) {
      const key = `translated/source/${job.id}.mp4`;
      if (body.fileBase64) {
        await uploadBuffer(key, Buffer.from(body.fileBase64, "base64"), "video/mp4");
        const finalUrl = publicUrl(key);
        await prisma.translationJob.update({
          where: { id: job.id },
          data: { sourceR2Url: finalUrl, sourceR2Key: key, status: "TRANSCRIBING" },
        });
        return {
          ok: true,
          jobId: job.id,
          sourceR2Url: finalUrl,
          status: "TRANSCRIBING",
        };
      }
    }

    try {
      const { sourceR2Url: r2 } = await stepDownload(job.id);
      return { ok: true, jobId: job.id, sourceR2Url: r2, status: "TRANSCRIBING" };
    } catch (e) {
      await prisma.translationJob.update({
        where: { id: job.id },
        data: { status: "FAILED", error: e instanceof Error ? e.message : String(e) },
      });
      return reply.code(500).send({
        ok: false,
        jobId: job.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.post("/api/translate/transcribe", async (req, reply) => {
    const body = (req.body || {}) as { jobId?: string };
    if (!body.jobId) return reply.code(400).send({ error: "jobId required" });
    try {
      const out = await stepTranscribe(body.jobId);
      return { ok: true, jobId: body.jobId, ...out, status: "TRANSLATING" };
    } catch (e) {
      return reply.code(500).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/translate/translate-text", async (req, reply) => {
    const body = (req.body || {}) as { jobId?: string; targetLangs?: string[] };
    if (!body.jobId) return reply.code(400).send({ error: "jobId required" });
    if (body.targetLangs?.length) {
      await prisma.translationJob.update({
        where: { id: body.jobId },
        data: { targetLangs: body.targetLangs.map((l) => l.toLowerCase()) },
      });
    }
    try {
      const out = await stepTranslate(body.jobId);
      return { ok: true, jobId: body.jobId, ...out, status: "TTS" };
    } catch (e) {
      return reply.code(500).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/translate/tts", async (req, reply) => {
    const body = (req.body || {}) as { jobId?: string };
    if (!body.jobId) return reply.code(400).send({ error: "jobId required" });
    try {
      const out = await stepTts(body.jobId);
      return { ok: true, jobId: body.jobId, ...out, status: "LIPSYNC" };
    } catch (e) {
      return reply.code(500).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/translate/lipsync", async (req, reply) => {
    const body = (req.body || {}) as { jobId?: string };
    if (!body.jobId) return reply.code(400).send({ error: "jobId required" });
    try {
      const out = await stepLipsync(body.jobId);
      return { ok: true, jobId: body.jobId, ...out, status: "MUXING" };
    } catch (e) {
      return reply.code(500).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/translate/mux-subtitles", async (req, reply) => {
    const body = (req.body || {}) as { jobId?: string };
    if (!body.jobId) return reply.code(400).send({ error: "jobId required" });
    try {
      const out = await stepMuxSubtitles(body.jobId);
      return { ok: true, jobId: body.jobId, ...out, status: "DONE" };
    } catch (e) {
      return reply.code(500).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  /** Master loop — sync by default; ?async=1 enqueues BullMQ */
  app.post("/api/translate/orchestrate", async (req, reply) => {
    const body = (req.body || {}) as {
      url?: string;
      targetLangs?: string[];
      ownerEmail?: string;
      fileBase64?: string;
      avatarId?: string;
      useAvatarTwin?: boolean;
      voiceMode?: string;
      skipRtc?: boolean;
    };
    const q = req.query as { async?: string };
    const user = await resolveUser(req, body.ownerEmail);
    const langs = (body.targetLangs?.length ? body.targetLangs : [...TRANSLATE_PRIMARY_LANGS]).map(
      (l) => l.toLowerCase(),
    );
    const cost = translateRtcCost(langs);
    const url = (body.url || "").trim();

    if (!url && !body.fileBase64) {
      return reply.code(400).send({ error: "url or fileBase64 required" });
    }

    if (!body.skipRtc) {
      try {
        await chargeTranslate(user.id, cost, `Language Studio ×${langs.length}`, undefined);
      } catch (e) {
        const err = e as Error & { statusCode?: number };
        return reply.code(err.statusCode || 402).send({ error: err.message });
      }
    }

    const sourceType = body.fileBase64 ? "UPLOAD" : classifyTranslateSource(url);

    const job = await prisma.translationJob.create({
      data: {
        userId: user.id,
        sourceType,
        sourceUrl: url,
        targetLangs: langs,
        status: "DOWNLOADING",
        avatarId: body.avatarId,
        useAvatarTwin: Boolean(body.useAvatarTwin),
        voiceMode: body.voiceMode || "clone",
        rtcCost: cost,
        logs: [`Orchestrate start — ${langs.join(",")} — ${cost} RTC`],
      },
    });

    if (body.fileBase64) {
      const sourceR2Key = `translated/source/${job.id}.mp4`;
      await uploadBuffer(sourceR2Key, Buffer.from(body.fileBase64, "base64"), "video/mp4");
      const sourceR2Url = publicUrl(sourceR2Key);
      await prisma.translationJob.update({
        where: { id: job.id },
        data: {
          sourceType: "UPLOAD",
          sourceUrl: sourceR2Url,
          sourceR2Url,
          sourceR2Key,
          status: "TRANSCRIBING",
        },
      });
    }

    if (q.async === "1") {
      await enqueue(
        "translateAutomation",
        { jobId: job.id, userId: user.id },
        { jobId: `translate-${job.id}`, attempts: 2 },
      );
      return {
        ok: true,
        jobId: job.id,
        status: "DOWNLOADING",
        async: true,
        rtcCost: cost,
        poll: `/api/translate/status?id=${job.id}`,
      };
    }

    try {
      const done = await runTranslateOrchestrator(job.id);
      return {
        ok: true,
        jobId: job.id,
        status: done.status,
        sourceR2Url: done.sourceR2Url,
        transcriptOriginal: done.transcriptOriginal,
        translations: done.translations,
        ttsUrls: done.ttsUrls,
        finalVideos: done.finalVideos,
        subtitleUrls: done.subtitleUrls,
        rtcCost: cost,
        logs: done.logs,
      };
    } catch (e) {
      return reply.code(500).send({
        ok: false,
        jobId: job.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });
}
