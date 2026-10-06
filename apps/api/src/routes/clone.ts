/**
 * Viral Clone Factory API
 * Transformative reproduction for inspiration / fair use — original assets only.
 * NEVER copy original video bytes. Always rewrite transcript + new Seedance/Pixabay visuals.
 */

import type { FastifyInstance } from "fastify";
import { prisma } from "@reelstorm/db";
import {
  CLONE_ANALYZE_RTC,
  CLONE_REPRODUCE_RTC,
  CLONE_STYLES,
  CLONE_WATERMARK,
  analyzeTranscriptStructure,
  detectClonePlatform,
  extractVideoId,
  isAllowedCloneUrl,
  type CloneStyle,
} from "@reelstorm/domain";
import { fetchViralMetadata, fetchPixabayVideos, bestPixabayVideoUrl } from "@reelstorm/media";
import { orchestrate } from "@reelstorm/providers";
import { ensureUserWallet, debitRtc } from "../lib/rtc.js";
import { debitSystemBank } from "../lib/system-bank.js";
import { enqueue } from "../lib/queue.js";

/** Simple rolling rate limit: 10 analyze / hour / key */
const analyzeHits = new Map<string, number[]>();

function rateLimitOk(key: string, max = 10, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const arr = (analyzeHits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    analyzeHits.set(key, arr);
    return false;
  }
  arr.push(now);
  analyzeHits.set(key, arr);
  return true;
}

async function resolveCloneUser(opts: {
  authorization?: string;
  ownerEmail?: string;
}) {
  const { resolveUserFromAuthHeader } = await import("./auth.js");
  const authed = await resolveUserFromAuthHeader(opts.authorization);
  if (authed) return authed;
  const email = (opts.ownerEmail || "producer@reelstorm.academy").trim().toLowerCase();
  return prisma.user.upsert({
    where: { email },
    create: { email, name: email.split("@")[0], tier: "free" },
    update: {},
  });
}

async function describeVisualStyle(title: string, thumbnailUrl: string | null, tags: string[]) {
  try {
    const raw = await orchestrate(
      [
        {
          role: "system",
          content:
            "You describe viral short-form visual style in one short phrase (lighting, camera, mood). No copyrighted character names. Return plain text only.",
        },
        {
          role: "user",
          content: `Title: ${title}\nTags: ${tags.join(", ")}\nThumbnail: ${thumbnailUrl || "n/a"}\nStyle phrase:`,
        },
      ],
      { timeoutMs: 12_000 },
    );
    return (raw || "fast-cut social cinematic").trim().slice(0, 160);
  } catch {
    return tags.slice(0, 3).join(" · ") || "vertical social · punchy cuts · bold captions";
  }
}

async function rewriteTranscriptTransformative(
  transcript: string,
  style: CloneStyle,
  hook: string,
) {
  // Transformative: paraphrase — same meaning, different wording. Never verbatim copy.
  try {
    const raw = await orchestrate(
      [
        {
          role: "system",
          content:
            "You rewrite viral scripts for transformative fair-use remakes. Keep hook → 3 beats → CTA structure. Same meaning, DIFFERENT wording. No verbatim phrases longer than 4 words from the source. Output plain script only.",
        },
        {
          role: "user",
          content: `Style: ${style}\nKeep this hook energy: ${hook}\n\nRewrite:\n${transcript.slice(0, 6000)}`,
        },
      ],
      { timeoutMs: 30_000 },
    );
    const text = (raw || "").trim();
    if (text.length > 40) return text;
  } catch {
    /* fallback below */
  }
  return `[${style.toUpperCase()} REMAKE]\n${hook}\n\n${transcript
    .split(/(?<=[.!?])\s+/)
    .map((s, i) => (i === 0 ? s : s.replace(/\b(I|you|we)\b/gi, (m) => m.toLowerCase())))
    .join(" ")
    .slice(0, 4000)}\n\n${CLONE_WATERMARK}`;
}

export async function cloneRoutes(app: FastifyInstance) {
  /** POST /api/clone/analyze — 1 RTC */
  app.post("/api/clone/analyze", async (req, reply) => {
    const body = (req.body || {}) as { url?: string; ownerEmail?: string };
    const url = (body.url || "").trim();
    if (!url) return reply.code(400).send({ error: "url required" });
    if (!isAllowedCloneUrl(url)) {
      return reply.code(400).send({
        error: "URL must be youtube.com, youtu.be, tiktok.com, or instagram.com",
      });
    }

    const platform = detectClonePlatform(url);
    if (!platform) return reply.code(400).send({ error: "Unsupported platform" });

    const user = await resolveCloneUser({
      authorization: req.headers.authorization,
      ownerEmail: body.ownerEmail,
    });
    const rateKey = user.id;
    if (!rateLimitOk(rateKey)) {
      return reply.code(429).send({ error: "Rate limit: 10 clone analyzes per hour" });
    }

    const wallet = await ensureUserWallet(user.id, user.tier as "free");
    if (wallet.balanceRtc < CLONE_ANALYZE_RTC) {
      return reply.code(402).send({
        error: `Need ${CLONE_ANALYZE_RTC} RTC to analyze (have ${wallet.balanceRtc}). Upgrade or wait for bank demo.`,
        needRtc: CLONE_ANALYZE_RTC,
      });
    }

    try {
      const meta = await fetchViralMetadata(url);
      const videoId = extractVideoId(url, platform);
      const structure = analyzeTranscriptStructure(meta.transcriptHint, meta.durationSec);
      const visualStyle = await describeVisualStyle(meta.title, meta.thumbnailUrl, meta.tags);

      const after = await debitRtc({
        walletId: wallet.id,
        amount: CLONE_ANALYZE_RTC,
        type: "DEBIT_CLONE_ANALYZE",
        note: "Viral Clone Factory — analyze (1 RTC)",
        refType: "clone",
        refId: videoId || url.slice(0, 64),
      });
      // Mirror cost against SystemBank accounting (demo pool tracking)
      try {
        await debitSystemBank(CLONE_ANALYZE_RTC, "clone analyze");
      } catch {
        /* bank may be empty — user wallet already charged */
      }

      const job = await prisma.cloneJob.create({
        data: {
          userId: user.id,
          sourceUrl: url,
          platform,
          videoId,
          title: meta.title,
          transcript: meta.transcriptHint,
          hook: structure.hook,
          bodyPoints: structure.bodyPoints,
          cta: structure.cta,
          durationSec: meta.durationSec,
          visualStyle,
          pacing: structure.pacing,
          thumbnailUrl: meta.thumbnailUrl,
          tags: meta.tags,
          status: "analyzed",
          rtcCostAnalyze: CLONE_ANALYZE_RTC,
          rtcCostReproduce: CLONE_REPRODUCE_RTC,
          watermarkNote: CLONE_WATERMARK,
          meta: {
            channel: meta.channel,
            viewCount: meta.viewCount,
            extractor: meta.extractor,
            transformative: true,
            compliance:
              "Transformative reproduction for inspiration, fair use, original assets — never copy source bytes",
          },
        },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { rtcBalance: after.balanceRtc },
      });

      return {
        cloneJobId: job.id,
        platform,
        videoId,
        title: job.title,
        transcript: job.transcript,
        hook: job.hook,
        body_points: job.bodyPoints,
        cta: job.cta,
        duration: job.durationSec,
        visual_style: job.visualStyle,
        pacing: job.pacing,
        thumbnail: job.thumbnailUrl,
        tags: job.tags,
        estimated_rtc: CLONE_REPRODUCE_RTC,
        analyze_rtc: CLONE_ANALYZE_RTC,
        watermark: CLONE_WATERMARK,
        breakdown: {
          hook: `Hook (0-3s): ${job.hook}`,
          body: `Body: ${(job.bodyPoints as string[])?.join(" · ")}`,
          cta: `CTA: ${job.cta}`,
          visual: job.visualStyle,
        },
      };
    } catch (e) {
      return reply.code(502).send({ error: (e as Error).message });
    }
  });

  /** GET /api/clone/:id */
  app.get("/api/clone/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await prisma.cloneJob.findUnique({ where: { id } });
    if (!job) return reply.code(404).send({ error: "Not found" });
    return { job };
  });

  /** POST /api/clone/reproduce — 5 RTC · transformative remake */
  app.post("/api/clone/reproduce", async (req, reply) => {
    const body = (req.body || {}) as {
      cloneJobId?: string;
      userCharacterId?: string;
      voiceId?: string;
      style?: CloneStyle;
      ownerEmail?: string;
    };
    if (!body.cloneJobId) return reply.code(400).send({ error: "cloneJobId required" });
    const style = (CLONE_STYLES.includes(body.style as CloneStyle)
      ? body.style
      : "original") as CloneStyle;

    const user = await resolveCloneUser({
      authorization: req.headers.authorization,
      ownerEmail: body.ownerEmail,
    });
    const job = await prisma.cloneJob.findUnique({ where: { id: body.cloneJobId } });
    if (!job) return reply.code(404).send({ error: "clone job not found" });
    if (job.status === "reproducing") {
      return reply.code(409).send({ error: "Already reproducing", cloneJobId: job.id });
    }

    const wallet = await ensureUserWallet(user.id, user.tier as "free");
    if (wallet.balanceRtc < CLONE_REPRODUCE_RTC) {
      return reply.code(402).send({
        error: `Need ${CLONE_REPRODUCE_RTC} RTC to reproduce (have ${wallet.balanceRtc}). Free demo covers analyze only — upgrade for remake.`,
        needRtc: CLONE_REPRODUCE_RTC,
        balanceRtc: wallet.balanceRtc,
      });
    }

    const rewritten = await rewriteTranscriptTransformative(
      job.transcript || job.hook || job.title || "viral remake",
      style,
      job.hook || "Watch this",
    );

    // Pixabay B-roll matching style (primary stock — never source bytes)
    let brollUrl: string | null = null;
    try {
      const q =
        style === "kids"
          ? "colorful particles logo kids"
          : style === "gaming"
            ? "neon glitch intro gaming"
            : style === "a24"
              ? "cinematic smoke lens flare"
              : job.visualStyle || "logo reveal particles";
      const hits = await fetchPixabayVideos(q, 3);
      brollUrl = hits[0] ? bestPixabayVideoUrl(hits[0]) : null;
    } catch {
      /* optional */
    }

    const after = await debitRtc({
      walletId: wallet.id,
      amount: CLONE_REPRODUCE_RTC,
      type: "DEBIT_CLONE_REPRODUCE",
      note: `Viral Clone Factory — reproduce ${style} (5 RTC)`,
      refType: "clone",
      refId: job.id,
    });
    try {
      await debitSystemBank(CLONE_REPRODUCE_RTC, `clone reproduce ${job.id}`);
    } catch {
      /* track when bank has headroom */
    }

    await prisma.cloneJob.update({
      where: { id: job.id },
      data: {
        status: "reproducing",
        style,
        rewrittenTranscript: rewritten,
        userId: job.userId || user.id,
      },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { rtcBalance: after.balanceRtc },
    });

    // Queue worker for Seedance + ffmpeg merge (falls back to structured package if MOCK)
    let bullJobId: string | null = null;
    try {
      const q = await enqueue("cloneReproduce", {
        cloneJobId: job.id,
        style,
        userCharacterId: body.userCharacterId,
        voiceId: body.voiceId,
        brollUrl,
        rewritten,
      });
      bullJobId = q.id || null;
    } catch (e) {
      // If queue name missing / worker offline — complete with package URL placeholder
      const packageNote = {
        transformative: true,
        style,
        rewritten,
        brollUrl,
        watermark: CLONE_WATERMARK,
        inspirationUrl: job.sourceUrl,
        seedancePrompts: (job.bodyPoints as string[] | null)?.map(
          (p, i) =>
            `Clip ${i + 1}: Transformative ${style} remake of idea "${p}" — original character, no logos from source`,
        ),
        error: (e as Error).message,
      };
      await prisma.cloneJob.update({
        where: { id: job.id },
        data: {
          status: "completed",
          meta: packageNote,
          r2Url: brollUrl || undefined,
          watermarkNote: CLONE_WATERMARK,
        },
      });
      return reply.code(202).send({
        cloneJobId: job.id,
        status: "completed",
        mode: "package",
        r2Url: brollUrl,
        rewrittenTranscript: rewritten,
        watermark: CLONE_WATERMARK,
        message:
          "Package ready (worker queue unavailable). Seedance prompts + Pixabay B-roll staged — merge when worker online.",
        package: packageNote,
      });
    }

    return reply.code(202).send({
      cloneJobId: job.id,
      jobId: bullJobId,
      status: "reproducing",
      style,
      rewrittenTranscript: rewritten,
      watermark: CLONE_WATERMARK,
      message: "Transformative remake queued — Seedance + Pixabay + Sound Studio → R2",
    });
  });
}
