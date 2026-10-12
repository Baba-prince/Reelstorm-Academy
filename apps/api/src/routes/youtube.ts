/**
 * YouTube Automation OS — /api/youtube/*
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "@reelstorm/db";
import { YT_OS_NICHES, YT_OS_RTC_PER_VIDEO, YT_OS_AGENTS } from "@reelstorm/domain";
import { resolveUserFromAuthHeader } from "./auth.js";
import { debitRtc, ensureUserWallet } from "../lib/rtc.js";
import { enqueue } from "../lib/queue.js";
import { getPodStatus, wakePod, ensurePodAliveOrFallback } from "@reelstorm/media";
import {
  agentStrategy,
  agentScript,
  agentThumbnail,
  agentSeo,
  agentProduction,
  agentPublish,
  agentAnalytics,
  runOrchestrator,
} from "@reelstorm/pipeline";

async function requireUser(req: FastifyRequest) {
  return resolveUserFromAuthHeader(req.headers.authorization);
}

async function resolveUser(req: FastifyRequest, ownerEmail?: string) {
  const authed = await requireUser(req);
  if (authed) return authed;
  const email = (ownerEmail || "producer@reelstorm.academy").trim().toLowerCase();
  return prisma.user.upsert({
    where: { email },
    create: { email, name: email.split("@")[0], tier: "free" },
    update: {},
  });
}

async function chargeYt(userId: string, amount: number, note: string, refId?: string) {
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
    type: "DEBIT_YT_OS",
    note,
    refType: "yt-automation",
    refId,
  });
  await prisma.user.update({ where: { id: userId }, data: { rtcBalance: after.balanceRtc } });
  return after;
}

export async function youtubeRoutes(app: FastifyInstance) {
  app.get("/api/youtube/meta", async () => ({
    agents: YT_OS_AGENTS,
    niches: YT_OS_NICHES,
    rtcPerVideo: YT_OS_RTC_PER_VIDEO,
    youtubeConfigured: Boolean(process.env.YOUTUBE_CLIENT_ID),
  }));

  /** POST /api/youtube/channel/connect — OAuth or mock channel */
  app.post("/api/youtube/channel/connect", async (req, reply) => {
    const body = (req.body || {}) as {
      niche?: string;
      title?: string;
      ownerEmail?: string;
      youtubeChannelId?: string;
      mock?: boolean;
    };
    const user = await resolveUser(req, body.ownerEmail);
    const niche = body.niche || "AI";
    const title = body.title || `${niche} Automation Channel`;

    const channel = await prisma.ytChannel.create({
      data: {
        userId: user.id,
        title,
        channelName: title,
        niche,
        youtubeChannelId: body.youtubeChannelId || `UC_mock_${user.id.slice(0, 8)}`,
        isConnected: true,
        connectedAt: new Date(),
        accessToken: process.env.YOUTUBE_CLIENT_ID ? "pending_oauth" : "mock_token",
      },
    });

    return {
      ok: true,
      channel,
      oauthUrl: process.env.YOUTUBE_CLIENT_ID
        ? `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.YOUTUBE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.YOUTUBE_REDIRECT_URI || "https://app.reelstorm.uk/api/youtube/callback")}&response_type=code&scope=${encodeURIComponent("https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/yt-analytics.readonly")}&access_type=offline&prompt=consent`
        : null,
      note: process.env.YOUTUBE_CLIENT_ID
        ? "Open oauthUrl to finish Google YouTube connect"
        : "Mock channel connected — set YOUTUBE_CLIENT_ID for live OAuth",
    };
  });

  app.get("/api/youtube/callback", async (req, reply) => {
    // Placeholder — exchange code when YOUTUBE_CLIENT_SECRET present
    const q = req.query as { code?: string; state?: string };
    return reply.redirect(
      `https://app.reelstorm.uk/yt-os?youtube_oauth=${q.code ? "ok" : "missing"}`,
    );
  });

  app.get("/api/youtube/list", async (req, reply) => {
    const user = await resolveUser(req);
    const channels = await prisma.ytChannel.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { videos: true, calendars: true } } },
    });
    const videos = await prisma.ytOsVideo.findMany({
      where: { channel: { userId: user.id } },
      orderBy: { updatedAt: "desc" },
      take: 40,
    });
    return { channels, videos, agents: YT_OS_AGENTS };
  });

  app.get("/api/youtube/calendar", async (req, reply) => {
    const q = req.query as { channelId?: string };
    if (!q.channelId) return reply.code(400).send({ error: "channelId required" });
    const calendars = await prisma.ytContentCalendar.findMany({
      where: { channelId: q.channelId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    return { calendars };
  });

  app.get("/api/youtube/video/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const video = await prisma.ytOsVideo.findUnique({
      where: { id },
      include: { agentRuns: { orderBy: { createdAt: "asc" } }, channel: true, calendar: true },
    });
    if (!video) return reply.code(404).send({ error: "not found" });
    return { video };
  });

  app.post("/api/youtube/strategy/analyze", async (req, reply) => {
    const body = (req.body || {}) as {
      channelId?: string;
      niche?: string;
      ownerEmail?: string;
    };
    const user = await resolveUser(req, body.ownerEmail);
    let channelId = body.channelId;
    if (!channelId) {
      const ch = await prisma.ytChannel.create({
        data: {
          userId: user.id,
          title: `${body.niche || "AI"} Channel`,
          channelName: `${body.niche || "AI"} Channel`,
          niche: body.niche || "AI",
          isConnected: true,
          connectedAt: new Date(),
          youtubeChannelId: `UC_auto_${user.id.slice(0, 6)}`,
        },
      });
      channelId = ch.id;
    }
    try {
      await chargeYt(user.id, 1, "strategy analyze", channelId);
    } catch (e) {
      return reply.code((e as { statusCode?: number }).statusCode || 500).send({
        error: (e as Error).message,
      });
    }
    const result = await agentStrategy({
      channelId: channelId!,
      niche: body.niche || "AI",
    });
    return result;
  });

  app.post("/api/youtube/script/generate", async (req, reply) => {
    const body = (req.body || {}) as {
      videoId?: string;
      hookStyle?: string;
      localNews?: string;
      ownerEmail?: string;
    };
    if (!body.videoId) return reply.code(400).send({ error: "videoId required" });
    const user = await resolveUser(req, body.ownerEmail);
    try {
      await chargeYt(user.id, 1, "script generate", body.videoId);
    } catch (e) {
      return reply.code((e as { statusCode?: number }).statusCode || 500).send({
        error: (e as Error).message,
      });
    }
    return agentScript({
      videoId: body.videoId,
      hookStyle: body.hookStyle,
      localNews: body.localNews,
    });
  });

  app.post("/api/youtube/thumbnail/generate", async (req, reply) => {
    const body = (req.body || {}) as { videoId?: string; variants?: number; ownerEmail?: string };
    if (!body.videoId) return reply.code(400).send({ error: "videoId required" });
    const user = await resolveUser(req, body.ownerEmail);
    try {
      await chargeYt(user.id, 1, "thumbnail generate", body.videoId);
    } catch (e) {
      return reply.code((e as { statusCode?: number }).statusCode || 500).send({
        error: (e as Error).message,
      });
    }
    return agentThumbnail({ videoId: body.videoId, variants: body.variants });
  });

  app.post("/api/youtube/seo/optimize", async (req, reply) => {
    const body = (req.body || {}) as { videoId?: string; ownerEmail?: string };
    if (!body.videoId) return reply.code(400).send({ error: "videoId required" });
    const user = await resolveUser(req, body.ownerEmail);
    try {
      await chargeYt(user.id, 1, "seo optimize", body.videoId);
    } catch (e) {
      return reply.code((e as { statusCode?: number }).statusCode || 500).send({
        error: (e as Error).message,
      });
    }
    return agentSeo({ videoId: body.videoId });
  });

  app.post("/api/youtube/production/assemble", async (req, reply) => {
    const body = (req.body || {}) as {
      videoId?: string;
      avatarId?: string;
      variantId?: string;
      ownerEmail?: string;
      async?: boolean;
    };
    if (!body.videoId) return reply.code(400).send({ error: "videoId required" });
    const user = await resolveUser(req, body.ownerEmail);

    // If GPU needed and pod sleeping — wake + optionally re-queue instead of hard 404
    if (body.avatarId) {
      const engine = await ensurePodAliveOrFallback();
      if (engine === "failed") {
        const status = await getPodStatus();
        if (status === "SLEEPING" || status === "WAKING") {
          void wakePod();
          if (body.async !== false) {
            const job = await enqueue(
              "youtubeAutomation",
              {
                channelId: "deferred",
                productionOnly: true,
                videoId: body.videoId,
                avatarId: body.avatarId,
                variantId: body.variantId,
                userId: user.id,
              },
              {
                jobId: `yt-prod-wake-${body.videoId}-${Date.now()}`,
                delay: 60_000,
                attempts: 5,
              },
            );
            // BullMQ delay via job opts — use queue.add with delay in enqueue extension
            return {
              status: "waking",
              message: "Pod was sleeping, waking up, job re-queued",
              podStatus: status,
              jobId: job.id,
              videoId: body.videoId,
            };
          }
        }
      }
    }

    try {
      await chargeYt(user.id, 10, "production assemble", body.videoId);
    } catch (e) {
      return reply.code((e as { statusCode?: number }).statusCode || 500).send({
        error: (e as Error).message,
      });
    }
    const result = await agentProduction({
      videoId: body.videoId,
      avatarId: body.avatarId,
      variantId: body.variantId,
    });
    if ((result.productionJson as { waking?: boolean })?.waking) {
      return {
        status: "waking",
        message: "Pod was sleeping, waking up — proof R2 ready; retry for GPU avatar render",
        ...result,
      };
    }
    return result;
  });

  app.post("/api/youtube/publish/upload", async (req, reply) => {
    const body = (req.body || {}) as {
      videoId?: string;
      scheduleAt?: string;
      visibility?: "public" | "private" | "unlisted";
      ownerEmail?: string;
    };
    if (!body.videoId) return reply.code(400).send({ error: "videoId required" });
    const user = await resolveUser(req, body.ownerEmail);
    try {
      await chargeYt(user.id, 2, "publish upload", body.videoId);
    } catch (e) {
      return reply.code((e as { statusCode?: number }).statusCode || 500).send({
        error: (e as Error).message,
      });
    }
    return agentPublish({
      videoId: body.videoId,
      scheduleAt: body.scheduleAt,
      visibility: body.visibility,
    });
  });

  app.post("/api/youtube/analytics/sync", async (req, reply) => {
    const body = (req.body || {}) as {
      videoId?: string;
      channelId?: string;
      ownerEmail?: string;
    };
    if (!body.videoId && !body.channelId) {
      return reply.code(400).send({ error: "videoId or channelId required" });
    }
    const user = await resolveUser(req, body.ownerEmail);
    try {
      await chargeYt(user.id, 1, "analytics sync", body.videoId || body.channelId);
    } catch (e) {
      return reply.code((e as { statusCode?: number }).statusCode || 500).send({
        error: (e as Error).message,
      });
    }
    return agentAnalytics({ videoId: body.videoId, channelId: body.channelId });
  });

  /** Master loop — sync by default; ?async=1 enqueues BullMQ */
  app.post("/api/youtube/orchestrator/run", async (req, reply) => {
    const body = (req.body || {}) as {
      channelId?: string;
      niche?: string;
      auto?: boolean;
      avatarId?: string;
      variantId?: string;
      topicTitle?: string;
      ownerEmail?: string;
      async?: boolean;
    };
    const user = await resolveUser(req, body.ownerEmail);

    let channelId = body.channelId;
    if (!channelId) {
      const ch = await prisma.ytChannel.create({
        data: {
          userId: user.id,
          title: `${body.niche || "AI"} Automation`,
          channelName: `${body.niche || "AI"} Automation`,
          niche: body.niche || "AI",
          isConnected: true,
          connectedAt: new Date(),
          youtubeChannelId: `UC_orch_${user.id.slice(0, 6)}`,
        },
      });
      channelId = ch.id;
    }

    try {
      await chargeYt(user.id, YT_OS_RTC_PER_VIDEO, "orchestrator full pipeline", channelId);
    } catch (e) {
      return reply.code((e as { statusCode?: number }).statusCode || 500).send({
        error: (e as Error).message,
      });
    }

    if (body.async) {
      const job = await enqueue("youtubeAutomation", {
        channelId,
        niche: body.niche || "AI",
        auto: Boolean(body.auto),
        avatarId: body.avatarId,
        variantId: body.variantId,
        topicTitle: body.topicTitle,
        userId: user.id,
      });
      return { ok: true, mode: "async", jobId: job.id, channelId };
    }

    const result = await runOrchestrator({
      channelId: channelId!,
      niche: body.niche,
      auto: body.auto,
      avatarId: body.avatarId,
      variantId: body.variantId,
      topicTitle: body.topicTitle,
    });
    return { ok: true, mode: "sync", ...result };
  });

  // Also support GET orchestrator/run as specified
  app.get("/api/youtube/orchestrator/run", async (req, reply) => {
    const q = req.query as {
      channelId?: string;
      niche?: string;
      auto?: string;
      ownerEmail?: string;
    };
    const user = await resolveUser(req, q.ownerEmail);
    let channelId = q.channelId;
    if (!channelId) {
      const ch = await prisma.ytChannel.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });
      channelId = ch?.id;
    }
    if (!channelId) {
      return reply.code(400).send({ error: "channelId required — connect a channel first" });
    }
    try {
      await chargeYt(user.id, YT_OS_RTC_PER_VIDEO, "orchestrator GET run", channelId);
    } catch (e) {
      return reply.code((e as { statusCode?: number }).statusCode || 500).send({
        error: (e as Error).message,
      });
    }
    const result = await runOrchestrator({
      channelId,
      niche: q.niche,
      auto: q.auto === "true" || q.auto === "1",
    });
    return { ok: true, mode: "sync", ...result };
  });
}
