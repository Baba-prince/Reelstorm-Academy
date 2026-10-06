/**
 * YT-OS v2 — 11 /rs-* skill endpoints
 */

import type { FastifyInstance } from "fastify";
import { prisma } from "@reelstorm/db";
import {
  YT_HOOK_FORMULAS,
  YT_OS_SKILLS,
  hookById,
  skillById,
  CLONE_ANALYZE_RTC,
} from "@reelstorm/domain";
import { orchestrate } from "@reelstorm/providers";
import { ensureUserWallet, debitRtc } from "../lib/rtc.js";

async function resolveUser(authorization?: string, ownerEmail?: string) {
  const { resolveUserFromAuthHeader } = await import("./auth.js");
  const authed = await resolveUserFromAuthHeader(authorization);
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
    type: "DEBIT_YT_OS",
    note,
    refType: "yt-os",
    refId,
  });
  await prisma.user.update({ where: { id: userId }, data: { rtcBalance: after.balanceRtc } });
  return after;
}

export async function ytOsRoutes(app: FastifyInstance) {
  app.get("/api/yt-os/skills", async () => ({
    version: "2.0",
    connectedBadge: "REELSTORM",
    skills: YT_OS_SKILLS,
    hooks: YT_HOOK_FORMULAS.length,
    bankHint: "4600 RTC SystemBank — Pixabay intros $0 · Seedance billed per RTC",
  }));

  app.get("/api/yt-os/hooks", async () => ({ hooks: YT_HOOK_FORMULAS }));

  /** POST /api/yt-os/skill/:id — run a skill */
  app.post("/api/yt-os/skill/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const skill = skillById(id.replace(/^\//, ""));
    if (!skill) return reply.code(404).send({ error: "Unknown skill", skills: YT_OS_SKILLS.map((s) => s.slash) });

    const body = (req.body || {}) as Record<string, unknown>;
    const user = await resolveUser(req.headers.authorization, body.ownerEmail as string | undefined);

    try {
      if (skill.id === "rs-viral") {
        const niche = String(body.niche || body.query || "youtube automation");
        await charge(user.id, skill.rtcCost, "/rs-viral analyze", niche);
        const raw = await orchestrate(
          [
            {
              role: "system",
              content:
                "You are REELSTORM Virality Engine. Return JSON: {videos:[{title,hook,structure:{hook,setup,proof,payoff},whyViral,viewsEstimate}],rebuilds:[{title,hook,outline}]} with 3 rebuilds in original voice. No copying real video scripts verbatim.",
            },
            {
              role: "user",
              content: `Niche: ${niche}\nAudience: ${body.audience || "general"}\nVoice: ${body.voice || "confident creator"}`,
            },
          ],
          { json: true, timeoutMs: 35_000 },
        );
        let parsed: unknown = { raw };
        try {
          parsed = JSON.parse(raw);
        } catch {
          /* keep raw */
        }
        const row = await prisma.viralBreakdown.create({
          data: {
            niche,
            title: `Viral scan: ${niche}`,
            hook:
              typeof parsed === "object" && parsed && "rebuilds" in (parsed as object)
                ? "see rebuilds"
                : niche,
            structure: (parsed ?? {}) as object,
            whyViral: "curiosity gap + retention pattern",
            rebuiltConcepts: ((parsed as { rebuilds?: unknown })?.rebuilds ||
              parsed ||
              {}) as object,
          },
        });
        return { skill: skill.slash, viralBreakdownId: row.id, result: parsed, rtcCost: skill.rtcCost };
      }

      if (skill.id === "rs-script") {
        const topic = String(body.topic || "growth tip");
        const hookNum = Math.min(21, Math.max(1, Number(body.hookFormula || body.hook || 7)));
        const formula = hookById(hookNum);
        await charge(user.id, skill.rtcCost, `/rs-script #${hookNum}`, topic);
        const raw = await orchestrate(
          [
            {
              role: "system",
              content:
                "Write a YouTube script. Return JSON: {fullScript,shortsScript,timestamps:[{t,line}],teleprompter}. Hook 0-3s, setup 3-10s, 3 body points, payoff, CTA.",
            },
            {
              role: "user",
              content: `Hook #${formula.id} ${formula.name}: ${formula.pattern}\nTopic: ${topic}\nNiche: ${body.niche || "creator"}`,
            },
          ],
          { json: true, timeoutMs: 35_000 },
        );
        let parsed: {
          fullScript?: string;
          shortsScript?: string;
          timestamps?: unknown;
          teleprompter?: string;
        } = {};
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { fullScript: raw, shortsScript: raw.slice(0, 500) };
        }
        const row = await prisma.ytScript.create({
          data: {
            userId: user.id,
            hookFormula: hookNum,
            topic,
            niche: String(body.niche || ""),
            fullScript: parsed.fullScript || raw,
            shortsScript: parsed.shortsScript || null,
            timestamps: (parsed.timestamps as object) || undefined,
            rtcCost: 1,
          },
        });
        return { skill: skill.slash, scriptId: row.id, formula, result: parsed, rtcCost: 1 };
      }

      if (skill.id === "rs-package") {
        const topic = String(body.topic || body.title || "AI ran my channel");
        await charge(user.id, skill.rtcCost, "/rs-package", topic);
        const raw = await orchestrate(
          [
            {
              role: "system",
              content:
                'Return JSON: {titles: string[5], description: string, tags: string[12], thumbConcepts: [{label,text,mood}]} — titles max 60 chars, curiosity gap, one CAPS word.',
            },
            { role: "user", content: `Package for: ${topic}` },
          ],
          { json: true },
        );
        let parsed: {
          titles?: string[];
          description?: string;
          tags?: string[];
          thumbConcepts?: unknown[];
        } = {};
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { titles: [topic], description: raw, tags: [] };
        }
        const row = await prisma.ytPackage.create({
          data: {
            titles: parsed.titles || [],
            description: parsed.description,
            tags: parsed.tags || [],
            thumbnails: [],
          },
        });
        return { skill: skill.slash, packageId: row.id, result: parsed, rtcCost: skill.rtcCost };
      }

      if (skill.id === "rs-thumb") {
        const topic = String(body.topic || "STOP DOING THIS");
        await charge(user.id, Math.max(1, skill.rtcCost), "/rs-thumb", topic);
        const variants = [
          { id: "A", mood: "shock", text: topic.slice(0, 24).toUpperCase() },
          { id: "B", mood: "curiosity", text: "WAIT FOR IT" },
          { id: "C", mood: "before-after", text: "BEFORE → AFTER" },
        ];
        const row = await prisma.thumbnailAb.create({
          data: {
            variantAUrl: `concept://A/${encodeURIComponent(variants[0].text)}`,
            variantBUrl: `concept://B/${encodeURIComponent(variants[1].text)}`,
            variantCUrl: `concept://C/${encodeURIComponent(variants[2].text)}`,
          },
        });
        return { skill: skill.slash, thumbnailAbId: row.id, variants, rtcCost: 1 };
      }

      if (skill.id === "rs-comments") {
        const comment = String(body.comment || "Bhai setup kaise kiya?");
        const raw = await orchestrate(
          [
            {
              role: "system",
              content:
                "Draft a helpful YouTube comment reply in the creator's voice. Short, friendly, add soft CTA. Support Hinglish if needed. Return plain text only.",
            },
            { role: "user", content: comment },
          ],
          { timeoutMs: 15_000 },
        );
        const row = await prisma.commentReply.create({
          data: {
            videoId: String(body.videoId || ""),
            commentId: String(body.commentId || ""),
            originalComment: comment,
            replyText: (raw || "Thanks! Link pinned — takes 2 mins.").trim(),
            autoReplied: false,
          },
        });
        return { skill: skill.slash, replyId: row.id, reply: row.replyText, rtcCost: 0 };
      }

      if (skill.id === "rs-plan") {
        const days = Number(body.days || 30);
        const entries = [];
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        for (let i = 0; i < days; i++) {
          const d = new Date(start);
          d.setUTCDate(start.getUTCDate() + i);
          const dow = d.getUTCDay(); // 0 Sun
          const type = dow === 1 || dow === 3 || dow === 5 ? "Long" : "Short";
          const rtcEstimate = type === "Long" ? 5 : 1;
          const row = await prisma.contentCalendarEntry.create({
            data: {
              userId: user.id,
              date: d,
              type,
              status: "planned",
              rtcEstimate,
              title: `${type} · day ${i + 1}`,
            },
          });
          entries.push(row);
        }
        const totalRtc = entries.reduce((a, e) => a + e.rtcEstimate, 0);
        return {
          skill: skill.slash,
          days,
          totalRtc,
          entries: entries.slice(0, 14),
          note: "Full 30-day calendar saved — Pixabay intros keep Short cost near $0",
        };
      }

      if (skill.id === "rs-video") {
        await charge(user.id, 1, "/rs-video edit");
        return {
          skill: skill.slash,
          status: "queued_spec",
          pipeline: ["whisper-stt", "silero-vad", "ffmpeg-cut-fillers", "burn-captions", "retention-zoom"],
          message: "Pass r2Url of raw Seedance clip — worker edit skill applies cuts",
          r2Url: body.r2Url || null,
          rtcCost: 1,
        };
      }

      if (skill.id === "rs-publish") {
        return {
          skill: skill.slash,
          status: "oauth_required",
          message: "Connect YouTube (youtube.upload + youtube.analytics scopes) from YT-OS Connected badge",
          scopes: ["youtube.upload", "youtube.force-ssl", "yt-analytics.readonly"],
        };
      }

      if (skill.id === "rs-analytics") {
        return {
          skill: skill.slash,
          signals: [
            { metric: "avgViewDuration", weakBelow: "30%", action: "kill topic /rs-viral" },
            { metric: "CTR", weakBelow: "4%", action: "regenerate /rs-thumb" },
            { metric: "retention0_30", strongAbove: "70%", action: "double down niche" },
          ],
          message: "Wire YouTube Analytics API after OAuth — feedback loops into Strategy Bot",
        };
      }

      if (skill.id === "rs-voice") {
        return {
          skill: skill.slash,
          redirect: "/sound-studio?tab=tts",
          message: "Use Sound Studio for clone + TTS",
        };
      }

      if (skill.id === "rs-clone") {
        return {
          skill: skill.slash,
          redirect: "/tools/clone",
          analyzeRtc: CLONE_ANALYZE_RTC,
          reproduceRtc: 5,
          message: "Paste viral link in Viral Clone Factory",
        };
      }

      return { skill: skill.slash, ok: true };
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  app.get("/api/yt-os/calendar", async (req) => {
    const q = req.query as { userId?: string };
    const where = q.userId ? { userId: q.userId } : {};
    const entries = await prisma.contentCalendarEntry.findMany({
      where,
      orderBy: { date: "asc" },
      take: 60,
    });
    return { entries };
  });
}
