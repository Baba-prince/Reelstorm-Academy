/**
 * Camera Angle Prompt Studio — /api/camera/*
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "@reelstorm/db";
import {
  CAMERA_COMMANDS,
  CAMERA_PIPELINE_STEPS,
  CAMERA_RTC_ANALYSIS,
  CAMERA_RTC_PREVIEW,
  classifyCameraSource,
} from "@reelstorm/domain";
import { uploadBuffer, publicUrl } from "@reelstorm/media";
import { resolveUserFromAuthHeader } from "./auth.js";
import { debitRtc, ensureUserWallet } from "../lib/rtc.js";
import { enqueue } from "../lib/queue.js";
import {
  stepCameraIngest,
  stepCameraAnalyze,
  stepCameraGeneratePrompts,
  stepCameraPreview,
  runCameraOrchestrator,
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
    type: "DEBIT_CAMERA",
    note,
    refType: "camera",
    refId,
  });
  await prisma.user.update({ where: { id: userId }, data: { rtcBalance: after.balanceRtc } });
  return after;
}

export async function cameraRoutes(app: FastifyInstance) {
  app.get("/api/camera/meta", async () => ({
    commands: CAMERA_COMMANDS.map((c) => ({
      command: c.command,
      label: c.label,
      category: c.category,
      useCase: c.useCase,
    })),
    steps: CAMERA_PIPELINE_STEPS,
    rtcAnalysis: CAMERA_RTC_ANALYSIS,
    rtcPreview: CAMERA_RTC_PREVIEW,
    count: CAMERA_COMMANDS.length,
  }));

  app.get("/api/camera/list", async (req) => {
    const user = await resolveUser(req);
    const jobs = await prisma.cameraAngleJob.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    return { jobs };
  });

  app.get("/api/camera/job/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await prisma.cameraAngleJob.findUnique({ where: { id } });
    if (!job) return reply.code(404).send({ error: "Not found" });
    return { job };
  });

  app.get("/api/camera/status", async (req) => {
    const q = req.query as { id?: string };
    if (!q.id) return { ok: false, error: "id required" };
    const job = await prisma.cameraAngleJob.findUnique({ where: { id: q.id } });
    return { ok: Boolean(job), job };
  });

  app.post("/api/camera/upload", async (req, reply) => {
    const body = (req.body || {}) as {
      url?: string;
      fileBase64?: string;
      fileName?: string;
      mimeType?: string;
      ownerEmail?: string;
    };
    const user = await resolveUser(req, body.ownerEmail);
    const url = (body.url || "").trim();
    if (!url && !body.fileBase64) {
      return reply.code(400).send({ error: "url or fileBase64 required" });
    }

    let sourceType = classifyCameraSource(url, body.mimeType || body.fileName);
    let sourceR2Url: string | undefined;
    let sourceR2Key: string | undefined;

    const job = await prisma.cameraAngleJob.create({
      data: {
        userId: user.id,
        sourceType,
        sourceUrl: url,
        originalUrl: url || null,
        status: "UPLOADING",
        rtcCost: CAMERA_RTC_ANALYSIS,
        logs: ["Upload created"],
      },
    });

    if (body.fileBase64) {
      const isImage =
        (body.mimeType || "").startsWith("image/") ||
        /\.(jpe?g|png|webp)$/i.test(body.fileName || "");
      sourceType = isImage ? "IMAGE" : "VIDEO";
      const ext = isImage
        ? /\.png$/i.test(body.fileName || "")
          ? "png"
          : /\.webp$/i.test(body.fileName || "")
            ? "webp"
            : "jpg"
        : "mp4";
      sourceR2Key = `camera/source/${job.id}.${ext}`;
      await uploadBuffer(
        sourceR2Key,
        Buffer.from(body.fileBase64, "base64"),
        isImage ? `image/${ext === "jpg" ? "jpeg" : ext}` : "video/mp4",
      );
      sourceR2Url = publicUrl(sourceR2Key);
      await prisma.cameraAngleJob.update({
        where: { id: job.id },
        data: {
          sourceType,
          sourceUrl: sourceR2Url,
          sourceR2Url,
          sourceR2Key,
          status: "EXTRACTING",
        },
      });
    }

    try {
      const out = await stepCameraIngest(job.id);
      return {
        ok: true,
        jobId: job.id,
        sourceR2Url: out.sourceR2Url,
        keyframes: out.keyframes,
        status: "ANALYZING",
      };
    } catch (e) {
      await prisma.cameraAngleJob.update({
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

  app.post("/api/camera/analyze", async (req, reply) => {
    const body = (req.body || {}) as { jobId?: string };
    if (!body.jobId) return reply.code(400).send({ error: "jobId required" });
    try {
      const out = await stepCameraAnalyze(body.jobId);
      return { ok: true, jobId: body.jobId, ...out, status: "GENERATING_PROMPTS" };
    } catch (e) {
      return reply.code(500).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/camera/generate-prompts", async (req, reply) => {
    const body = (req.body || {}) as { jobId?: string };
    if (!body.jobId) return reply.code(400).send({ error: "jobId required" });
    try {
      const out = await stepCameraGeneratePrompts(body.jobId);
      return { ok: true, jobId: body.jobId, ...out, status: "DONE" };
    } catch (e) {
      return reply.code(500).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/camera/generate-preview", async (req, reply) => {
    const body = (req.body || {}) as { jobId?: string; command?: string; ownerEmail?: string; skipRtc?: boolean };
    if (!body.jobId || !body.command) {
      return reply.code(400).send({ error: "jobId and command required" });
    }
    const user = await resolveUser(req, body.ownerEmail);
    if (!body.skipRtc) {
      try {
        await charge(user.id, CAMERA_RTC_PREVIEW, `Camera preview ${body.command}`, body.jobId);
      } catch (e) {
        const err = e as Error & { statusCode?: number };
        return reply.code(err.statusCode || 402).send({ error: err.message });
      }
    }
    try {
      const out = await stepCameraPreview(body.jobId, body.command);
      return { ok: true, jobId: body.jobId, ...out };
    } catch (e) {
      return reply.code(500).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/camera/orchestrate", async (req, reply) => {
    const body = (req.body || {}) as {
      url?: string;
      fileBase64?: string;
      fileName?: string;
      mimeType?: string;
      ownerEmail?: string;
      skipRtc?: boolean;
    };
    const q = req.query as { async?: string };
    const user = await resolveUser(req, body.ownerEmail);
    const url = (body.url || "").trim();
    if (!url && !body.fileBase64) {
      return reply.code(400).send({ error: "url or fileBase64 required" });
    }

    if (!body.skipRtc) {
      try {
        await charge(user.id, CAMERA_RTC_ANALYSIS, "Camera angle analysis", undefined);
      } catch (e) {
        const err = e as Error & { statusCode?: number };
        return reply.code(err.statusCode || 402).send({ error: err.message });
      }
    }

    let sourceType = classifyCameraSource(url, body.mimeType || body.fileName);
    const job = await prisma.cameraAngleJob.create({
      data: {
        userId: user.id,
        sourceType,
        sourceUrl: url,
        originalUrl: url || null,
        status: "UPLOADING",
        rtcCost: CAMERA_RTC_ANALYSIS,
        logs: [`Orchestrate — ${CAMERA_COMMANDS.length} commands`],
      },
    });

    if (body.fileBase64) {
      const isImage =
        (body.mimeType || "").startsWith("image/") ||
        /\.(jpe?g|png|webp)$/i.test(body.fileName || "");
      sourceType = isImage ? "IMAGE" : "VIDEO";
      const ext = isImage
        ? /\.png$/i.test(body.fileName || "")
          ? "png"
          : /\.webp$/i.test(body.fileName || "")
            ? "webp"
            : "jpg"
        : "mp4";
      const sourceR2Key = `camera/source/${job.id}.${ext}`;
      await uploadBuffer(
        sourceR2Key,
        Buffer.from(body.fileBase64, "base64"),
        isImage ? `image/${ext === "jpg" ? "jpeg" : ext}` : "video/mp4",
      );
      const sourceR2Url = publicUrl(sourceR2Key);
      await prisma.cameraAngleJob.update({
        where: { id: job.id },
        data: {
          sourceType,
          sourceUrl: sourceR2Url,
          sourceR2Url,
          sourceR2Key,
          status: "EXTRACTING",
        },
      });
    }

    if (q.async === "1") {
      await enqueue(
        "cameraAngleGenerator",
        { jobId: job.id, userId: user.id },
        { jobId: `camera-${job.id}`, attempts: 2 },
      );
      return {
        ok: true,
        jobId: job.id,
        status: "UPLOADING",
        async: true,
        rtcCost: CAMERA_RTC_ANALYSIS,
        poll: `/api/camera/status?id=${job.id}`,
      };
    }

    try {
      const done = await runCameraOrchestrator(job.id);
      return {
        ok: true,
        jobId: job.id,
        status: done.status,
        sourceR2Url: done.sourceR2Url,
        keyframes: done.keyframes,
        analysis: done.analysis,
        prompts: done.prompts,
        rtcCost: CAMERA_RTC_ANALYSIS,
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
