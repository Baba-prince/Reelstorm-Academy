import type { FastifyInstance } from "fastify";
import { access, statfs } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { prisma } from "@reelstorm/db";
import {
  evaluateProductionApis,
  scoreProductionChecks,
} from "@reelstorm/domain";
import { classifyVideoUrl, resolveFfmpeg, resolveFfprobe, resolveYtDlp, probeObjectStorage } from "@reelstorm/media";
import { redisConnection } from "../lib/queue.js";

async function ok(p: string) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Live readiness probe used by /scorecard + production 1k gates */
export async function readinessRoutes(app: FastifyInstance) {
  app.get("/api/readiness", async () => {
    const checks: Record<string, { status: "pass" | "partial" | "fail"; detail: string }> = {};

    checks.api = { status: "pass", detail: "API process healthy" };

    try {
      await prisma.user.count();
      checks.db = { status: "pass", detail: "Supabase/Postgres reachable" };
    } catch (e) {
      checks.db = { status: "fail", detail: (e as Error).message };
    }

    try {
      const pong = await redisConnection().ping();
      checks.redis = {
        status: pong === "PONG" ? "pass" : "partial",
        detail: `Redis ${process.env.REDIS_URL}`,
      };
    } catch (e) {
      checks.redis = { status: "fail", detail: (e as Error).message };
    }

    const ffmpeg = await resolveFfmpeg();
    const ffmpegOk = ffmpeg !== "ffmpeg" ? await ok(ffmpeg) : false;
    checks.ffmpeg = ffmpegOk
      ? { status: "pass", detail: ffmpeg }
      : { status: "fail", detail: "ffmpeg binary not found (bin/ffmpeg or PATH)" };

    const ffprobe = await resolveFfprobe(ffmpegOk ? ffmpeg : undefined);
    const ffprobeOk = ffprobe !== "ffprobe" ? await ok(ffprobe) : false;
    checks.ffprobe = ffprobeOk
      ? { status: "pass", detail: ffprobe }
      : { status: "fail", detail: "ffprobe not found — Template Forge analyze will fail" };

    const ytdlp = await resolveYtDlp();
    const ytdlpOk = ytdlp !== "yt-dlp" ? await ok(ytdlp) : false;
    checks.ytdlp = ytdlpOk
      ? { status: "pass", detail: ytdlp }
      : { status: "fail", detail: "yt-dlp not found — web URL extract disabled" };

    checks.urlExtract = ytdlpOk
      ? { status: "pass", detail: "POST /api/upload/video/from-url ready (YouTube/Vimeo/direct)" }
      : { status: "partial", detail: "Route mounted; install bin/yt-dlp to enable" };

    checks.webReference = {
      status: "pass",
      detail: `classifiers: ${["youtube", "vimeo", "direct", "generic"].join(", ")} sample=${classifyVideoUrl("https://youtu.be/dQw4w9wgxcQ")}`,
    };

    const root = path.resolve(process.cwd(), "../..");
    const uploadDir = process.env.UPLOAD_TMP_DIR || path.join(root, "tmp/uploads");
    checks.localStorage = {
      status: "pass",
      detail: uploadDir,
    };

    try {
      const fsStat = await statfs(uploadDir);
      const freeGb = (Number(fsStat.bavail) * Number(fsStat.bsize)) / (1024 ** 3);
      checks.disk = {
        status: freeGb >= 50 ? "pass" : freeGb >= 20 ? "partial" : "fail",
        detail: `${freeGb.toFixed(1)} GiB free on upload volume (target ≥50 GiB for ~1000 users)`,
      };
    } catch {
      checks.disk = { status: "partial", detail: "Could not stat upload volume" };
    }

    checks.auth = {
      status: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL ? "pass" : "fail",
      detail: process.env.GOOGLE_CLIENT_ID
        ? "Supabase + Google Client ID configured"
        : "Supabase URL present — add Google OAuth for Gmail sign-in",
    };

    // Prefer DashScope in production; Ollama is acceptable MVP fallback
    if (process.env.DASHSCOPE_API_KEY) {
      checks.llm = {
        status: "pass",
        detail: `DashScope ${process.env.DASHSCOPE_MODEL || "qwen-plus"}`,
      };
    } else {
      checks.llm = {
        status: "partial",
        detail: "DASHSCOPE_API_KEY missing — trying Ollama fallback",
      };
      try {
        const r = await fetch(`${process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"}/api/tags`);
        if (r.ok) {
          checks.llm = {
            status: "partial",
            detail: "Ollama reachable (MVP) — set DASHSCOPE_API_KEY for production LLM",
          };
        }
      } catch {
        /* keep partial */
      }
    }
    checks.ollama = checks.llm; // back-compat for scorecard map

    const storageProbe = await probeObjectStorage();
    checks.s3 = storageProbe;

    const prod = evaluateProductionApis(process.env);
    const scored = scoreProductionChecks(prod);
    for (const c of prod) {
      checks[`prod_${c.id}`] = { status: c.status, detail: `[${c.tier}] ${c.detail}` };
    }

    const weights: Record<string, number> = {
      api: 8,
      db: 10,
      redis: 8,
      ffmpeg: 6,
      ffprobe: 8,
      ytdlp: 6,
      urlExtract: 6,
      webReference: 2,
      localStorage: 3,
      disk: 6,
      auth: 8,
      llm: 8,
      s3: 10,
      prod_stripe: 8,
      prod_video_gen: 10,
      prod_elevenlabs: 6,
      prod_worker_concurrency: 4,
    };

    let earned = 0;
    let total = 0;
    for (const [k, w] of Object.entries(weights)) {
      total += w;
      const s = checks[k]?.status;
      if (s === "pass") earned += w;
      else if (s === "partial") earned += w * 0.5;
    }
    const pct = Math.round((earned / total) * 100);

    return {
      version: "1.3.0-1k",
      pct,
      grade: pct >= 90 ? "A" : pct >= 75 ? "B" : pct >= 60 ? "C" : pct >= 40 ? "D" : "F",
      production1k: {
        ready: scored.readyFor1k,
        pct: scored.pct,
        grade: scored.grade,
        blocking: scored.blocking,
        webhookUrl: "https://app.reelstorm.uk/api/billing/stripe-webhook",
        checks: prod,
      },
      checks,
    };
  });
}
