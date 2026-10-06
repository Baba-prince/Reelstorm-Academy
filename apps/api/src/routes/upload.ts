import type { FastifyInstance } from "fastify";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { prisma } from "@reelstorm/db";
import { ALLOWED_VIDEO_MIME, MAX_VIDEO_UPLOAD_BYTES } from "@reelstorm/domain";
import { uploadFile, publicUrl } from "@reelstorm/media";
import { enqueue } from "../lib/queue.js";

const TMP = process.env.UPLOAD_TMP_DIR || path.join(process.cwd(), "../../tmp/uploads");

export async function uploadRoutes(app: FastifyInstance) {
  /** POST /api/upload/video — multipart drag-drop up to 2GB */
  app.post("/api/upload/video", async (req, reply) => {
    const mp = await req.file();
    if (!mp) return reply.code(400).send({ error: "No file uploaded" });

    const mime = mp.mimetype;
    if (!ALLOWED_VIDEO_MIME.includes(mime as (typeof ALLOWED_VIDEO_MIME)[number]) && !mime.startsWith("video/")) {
      return reply.code(415).send({ error: `Unsupported type ${mime}. Use MP4 or MOV.` });
    }

    const fields = mp.fields as Record<string, { value?: string } | undefined>;
    const projectId = fields?.projectId && "value" in fields.projectId ? fields.projectId.value : undefined;
    const autoAnalyze =
      fields?.analyze && "value" in fields.analyze ? fields.analyze.value !== "false" : true;

    await mkdir(TMP, { recursive: true });
    const uploadId = randomUUID();
    const safeName = (mp.filename || "upload.mp4").replace(/[^\w.\-]+/g, "_");
    const localPath = path.join(TMP, `${uploadId}_${safeName}`);

    let bytes = 0;
    const limited = mp.file;
    limited.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_VIDEO_UPLOAD_BYTES) {
        limited.destroy(new Error("File exceeds 2GB limit"));
      }
    });

    try {
      await pipeline(limited, createWriteStream(localPath));
    } catch (e) {
      return reply.code(413).send({ error: (e as Error).message });
    }

    const s3Key = `uploads/video/${uploadId}/${safeName}`;
    try {
      await uploadFile(s3Key, localPath, mime);
    } catch (e) {
      // Allow local-only mode when S3 is down
      app.log.warn({ err: e }, "S3 upload failed — keeping local temp");
    }

    const record = await prisma.videoUpload.create({
      data: {
        id: uploadId,
        projectId: projectId || null,
        filename: safeName,
        mimeType: mime,
        bytes: BigInt(bytes),
        s3Key,
        s3Url: publicUrl(s3Key),
        status: "UPLOADED",
        progressPct: 5,
        progressMsg: "Uploaded — queued for analysis",
      },
    });

    await prisma.asset.create({
      data: {
        projectId: projectId || null,
        type: "video",
        key: s3Key,
        url: publicUrl(s3Key),
        mimeType: mime,
        bytes: BigInt(bytes),
        labels: ["upload", "source"],
        meta: { uploadId, localPath },
      },
    });

    let jobId: string | undefined;
    if (autoAnalyze) {
      const job = await enqueue("analyzeVideo", {
        uploadId,
        localPath,
        s3Key,
        projectId: projectId || null,
      });
      jobId = job.id;
      await prisma.videoUpload.update({
        where: { id: uploadId },
        data: { status: "ANALYZING", progressMsg: "Analysis queued" },
      });
    }

    return reply.code(201).send({
      upload: {
        ...record,
        bytes: bytes.toString(),
      },
      jobId,
      wsChannel: `analysis:${uploadId}`,
    });
  });

  /** POST /api/upload/video/analyze — re-trigger analysis */
  app.post("/api/upload/video/analyze", async (req, reply) => {
    const body = (req.body || {}) as { uploadId?: string; localPath?: string };
    if (!body.uploadId) return reply.code(400).send({ error: "uploadId required" });

    const upload = await prisma.videoUpload.findUnique({ where: { id: body.uploadId } });
    if (!upload) return reply.code(404).send({ error: "Upload not found" });

    const metaAsset = await prisma.asset.findFirst({
      where: { key: upload.s3Key },
    });
    const localPath =
      body.localPath ||
      ((metaAsset?.meta as { localPath?: string } | null)?.localPath);

    const job = await enqueue("analyzeVideo", {
      uploadId: upload.id,
      localPath,
      s3Key: upload.s3Key,
      projectId: upload.projectId,
    });

    await prisma.videoUpload.update({
      where: { id: upload.id },
      data: { status: "ANALYZING", progressPct: 0, progressMsg: "Re-queued", error: null },
    });

    return { jobId: job.id, uploadId: upload.id, wsChannel: `analysis:${upload.id}` };
  });

  /** Script upload */
  app.post("/api/upload/script", async (req, reply) => {
    const body = (req.body || {}) as { projectId?: string; script?: string; title?: string };
    if (!body.script) return reply.code(400).send({ error: "script required" });

    if (body.projectId) {
      const project = await prisma.project.update({
        where: { id: body.projectId },
        data: { script: body.script, title: body.title || undefined },
      });
      return { project };
    }

    const user = await prisma.user.upsert({
      where: { email: "producer@reelstorm.academy" },
      create: { email: "producer@reelstorm.academy", name: "Producer" },
      update: {},
    });
    const project = await prisma.project.create({
      data: {
        title: body.title || "Untitled Script",
        script: body.script,
        ownerId: user.id,
      },
    });
    return reply.code(201).send({ project });
  });

  app.get("/api/upload/video/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const upload = await prisma.videoUpload.findUnique({
      where: { id },
      include: { templates: true, blocks: true },
    });
    if (!upload) return reply.code(404).send({ error: "Not found" });
    return {
      upload: {
        ...upload,
        bytes: upload.bytes.toString(),
      },
    };
  });

  /**
   * POST /api/upload/video/from-url
   * Paste a YouTube / Vimeo / direct MP4 link → download → analyze → template extract
   */
  app.post("/api/upload/video/from-url", async (req, reply) => {
    const body = (req.body || {}) as {
      url?: string;
      projectId?: string;
      analyze?: boolean;
      name?: string;
    };
    const url = (body.url || "").trim();
    if (!url) return reply.code(400).send({ error: "url required" });
    try {
      // eslint-disable-next-line no-new
      new URL(url);
    } catch {
      return reply.code(400).send({ error: "Invalid URL" });
    }

    const autoAnalyze = body.analyze !== false;
    const uploadId = randomUUID();
    const workDir = path.join(TMP, uploadId, "reference");
    await mkdir(workDir, { recursive: true });

    const pending = await prisma.videoUpload.create({
      data: {
        id: uploadId,
        projectId: body.projectId || null,
        filename: "reference-pending",
        mimeType: "video/mp4",
        bytes: BigInt(0),
        s3Key: `uploads/video/${uploadId}/reference.mp4`,
        status: "PENDING",
        progressPct: 2,
        progressMsg: "Fetching web reference…",
        analysisJson: { sourceUrl: url },
      },
    });

    // Async download + enqueue (don't block HTTP forever on long YouTube pulls)
    void (async () => {
      try {
        const { downloadReferenceVideo, uploadFile, publicUrl } = await import("@reelstorm/media");
        const { enqueue: enq } = await import("../lib/queue.js");

        const result = await downloadReferenceVideo(url, workDir, async (pct, message) => {
          await prisma.videoUpload.update({
            where: { id: uploadId },
            data: { progressPct: Math.min(40, pct), progressMsg: message, status: "UPLOADED" },
          });
          // best-effort WS via redis publish
          try {
            const { redisConnection } = await import("../lib/queue.js");
            await redisConnection().publish(
              `analysis:${uploadId}`,
              JSON.stringify({
                uploadId,
                stage: "uploading",
                percent: Math.min(40, pct),
                message,
              }),
            );
          } catch {
            /* redis may be down during download */
          }
        });

        const { stat } = await import("node:fs/promises");
        const st = await stat(result.localPath);
        const safeName = path.basename(result.localPath);
        const s3Key = `uploads/video/${uploadId}/${safeName}`;

        try {
          await uploadFile(s3Key, result.localPath, "video/mp4");
        } catch {
          app.log.warn("S3 optional — local reference kept");
        }

        await prisma.videoUpload.update({
          where: { id: uploadId },
          data: {
            filename: safeName,
            bytes: BigInt(st.size),
            s3Key,
            s3Url: publicUrl(s3Key),
            durationSec: result.durationSec,
            status: autoAnalyze ? "ANALYZING" : "UPLOADED",
            progressPct: 45,
            progressMsg: `Downloaded “${result.title}” — ${autoAnalyze ? "queued for analysis" : "ready"}`,
            analysisJson: {
              sourceUrl: result.webpageUrl,
              title: result.title,
              extractor: result.extractor,
              localPath: result.localPath,
            },
          },
        });

        await prisma.asset.create({
          data: {
            projectId: body.projectId || null,
            type: "video",
            key: s3Key,
            url: publicUrl(s3Key),
            mimeType: "video/mp4",
            bytes: BigInt(st.size),
            labels: ["upload", "web-reference", result.extractor || "url"],
            meta: {
              uploadId,
              localPath: result.localPath,
              sourceUrl: result.webpageUrl,
              title: result.title,
            },
          },
        });

        if (autoAnalyze) {
          await enq("analyzeVideo", {
            uploadId,
            localPath: result.localPath,
            s3Key,
            projectId: body.projectId || null,
          });
        }
      } catch (err) {
        const message = (err as Error).message;
        app.log.error({ err }, "from-url failed");
        await prisma.videoUpload.update({
          where: { id: uploadId },
          data: { status: "FAILED", error: message, progressMsg: "Web reference failed", progressPct: 0 },
        });
        try {
          const { redisConnection } = await import("../lib/queue.js");
          await redisConnection().publish(
            `analysis:${uploadId}`,
            JSON.stringify({ uploadId, stage: "failed", percent: 0, error: message }),
          );
        } catch {
          /* ignore */
        }
      }
    })();

    return reply.code(202).send({
      upload: {
        ...pending,
        bytes: "0",
      },
      uploadId,
      wsChannel: `analysis:${uploadId}`,
      message: "Fetching web reference video — watch progress on WebSocket",
    });
  });
}
