import type { FastifyInstance } from "fastify";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { prisma } from "@reelstorm/db";
import { classifyVideoUrl, resolveFfmpeg, resolveYtDlp } from "@reelstorm/media";
import { redisConnection } from "../lib/queue.js";

async function ok(p: string) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Live readiness probe used by /scorecard */
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
    // also try which via spawn failure later — mark partial if PATH name only
    checks.ffmpeg = ffmpegOk
      ? { status: "pass", detail: ffmpeg }
      : { status: "fail", detail: "ffmpeg binary not found (bin/ffmpeg or PATH)" };

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
    checks.localStorage = {
      status: "pass",
      detail: process.env.UPLOAD_TMP_DIR || path.join(root, "tmp/uploads"),
    };

    checks.auth = {
      status: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL ? "partial" : "fail",
      detail: "Supabase URL present — prod JWT verification still soft/dev",
    };

    checks.ollama = { status: "partial", detail: process.env.OLLAMA_MODEL || "llama3.1:8b" };
    try {
      const r = await fetch(`${process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"}/api/tags`);
      if (r.ok) checks.ollama = { status: "pass", detail: "Ollama reachable" };
    } catch {
      /* keep partial */
    }

    const weights: Record<string, number> = {
      api: 10,
      db: 10,
      redis: 10,
      ffmpeg: 8,
      ytdlp: 8,
      urlExtract: 10,
      webReference: 4,
      localStorage: 5,
      auth: 6,
      ollama: 5,
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
      version: "1.2.0",
      pct,
      grade: pct >= 90 ? "A" : pct >= 75 ? "B" : pct >= 60 ? "C" : pct >= 40 ? "D" : "F",
      checks,
    };
  });
}
