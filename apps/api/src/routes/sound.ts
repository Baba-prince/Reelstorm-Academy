import type { FastifyInstance } from "fastify";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { prisma } from "@reelstorm/db";
import { ALLOWED_AUDIO_MIME, MAX_AUDIO_UPLOAD_BYTES } from "@reelstorm/domain";
import { uploadFile, publicUrl } from "@reelstorm/media";
import { listVoices } from "@reelstorm/providers";
import { enqueue } from "../lib/queue.js";

const TMP = process.env.UPLOAD_TMP_DIR || path.join(process.cwd(), "../../tmp/uploads");

function isAudioMime(mime: string) {
  return (
    ALLOWED_AUDIO_MIME.includes(mime as (typeof ALLOWED_AUDIO_MIME)[number]) ||
    mime.startsWith("audio/")
  );
}

export async function soundRoutes(app: FastifyInstance) {
  /** POST /api/sound/upload — upload external audio (mp3/wav/m4a…) */
  app.post("/api/sound/upload", async (req, reply) => {
    const mp = await req.file();
    if (!mp) return reply.code(400).send({ error: "No audio file uploaded" });
    const mime = mp.mimetype;
    if (!isAudioMime(mime)) {
      return reply.code(415).send({ error: `Unsupported audio type ${mime}` });
    }

    const fields = mp.fields as Record<string, { value?: string } | undefined>;
    const projectId =
      fields?.projectId && "value" in fields.projectId ? fields.projectId.value : undefined;
    const label = fields?.label && "value" in fields.label ? fields.label.value : "external";

    await mkdir(TMP, { recursive: true });
    const id = randomUUID();
    const safeName = (mp.filename || "audio.wav").replace(/[^\w.\-]+/g, "_");
    const localPath = path.join(TMP, `sound_${id}_${safeName}`);

    let bytes = 0;
    mp.file.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_AUDIO_UPLOAD_BYTES) mp.file.destroy(new Error("Audio exceeds 200MB limit"));
    });
    try {
      await pipeline(mp.file, createWriteStream(localPath));
    } catch (e) {
      return reply.code(413).send({ error: (e as Error).message });
    }

    const s3Key = `sound/${id}/${safeName}`;
    try {
      await uploadFile(s3Key, localPath, mime);
    } catch (e) {
      app.log.warn({ err: e }, "S3 audio upload failed — local only");
    }

    const asset = await prisma.asset.create({
      data: {
        projectId: projectId || null,
        type: "audio",
        key: s3Key,
        url: publicUrl(s3Key),
        mimeType: mime,
        bytes: BigInt(bytes),
        labels: ["sound-studio", "external", label || "external"],
        meta: { localPath, source: "upload", soundId: id },
      },
    });

    return reply.code(201).send({
      asset: { ...asset, bytes: bytes.toString() },
      soundId: id,
      localPath,
    });
  });

  /** POST /api/sound/from-url — pull audio from YouTube / podcast / direct link */
  app.post("/api/sound/from-url", async (req, reply) => {
    const body = (req.body || {}) as { url?: string; projectId?: string };
    if (!body.url) return reply.code(400).send({ error: "url required" });

    const soundId = randomUUID();
    const job = await enqueue("soundStudio", {
      action: "fromUrl",
      soundId,
      url: body.url,
      projectId: body.projectId || null,
    });

    return reply.code(202).send({
      soundId,
      jobId: job.id,
      status: "queued",
      message: "External audio sync queued",
    });
  });

  /** POST /api/sound/extract — extract stems / full track from a video upload or local path */
  app.post("/api/sound/extract", async (req, reply) => {
    const body = (req.body || {}) as {
      uploadId?: string;
      videoAssetId?: string;
      localPath?: string;
      projectId?: string;
      format?: "wav" | "mp3" | "m4a";
      stems?: boolean;
    };
    if (!body.uploadId && !body.videoAssetId && !body.localPath) {
      return reply.code(400).send({ error: "uploadId, videoAssetId, or localPath required" });
    }

    const soundId = randomUUID();
    const job = await enqueue("soundStudio", {
      action: "extract",
      soundId,
      uploadId: body.uploadId || null,
      videoAssetId: body.videoAssetId || null,
      localPath: body.localPath || null,
      projectId: body.projectId || null,
      format: body.format || "wav",
      stems: body.stems !== false,
    });

    return reply.code(202).send({ soundId, jobId: job.id, status: "queued" });
  });

  /** POST /api/sound/sync — mux external audio onto video (lip/bed sync) */
  app.post("/api/sound/sync", async (req, reply) => {
    const body = (req.body || {}) as {
      videoLocalPath?: string;
      videoAssetId?: string;
      uploadId?: string;
      audioLocalPath?: string;
      audioAssetId?: string;
      projectId?: string;
      replace?: boolean;
      offsetSec?: number;
    };
    if (!body.audioLocalPath && !body.audioAssetId) {
      return reply.code(400).send({ error: "audioLocalPath or audioAssetId required" });
    }
    if (!body.videoLocalPath && !body.videoAssetId && !body.uploadId) {
      return reply.code(400).send({ error: "videoLocalPath, videoAssetId, or uploadId required" });
    }

    const soundId = randomUUID();
    const job = await enqueue("soundStudio", {
      action: "sync",
      soundId,
      ...body,
      replace: body.replace !== false,
      offsetSec: body.offsetSec || 0,
    });

    return reply.code(202).send({ soundId, jobId: job.id, status: "queued" });
  });

  /** POST /api/sound/clone — create VoiceProfile from sample asset(s) */
  app.post("/api/sound/clone", async (req, reply) => {
    const body = (req.body || {}) as {
      name?: string;
      projectId?: string;
      sampleAssetIds?: string[];
      sampleLocalPaths?: string[];
      description?: string;
    };
    if (!body.name) return reply.code(400).send({ error: "name required" });
    if (!body.sampleAssetIds?.length && !body.sampleLocalPaths?.length) {
      return reply.code(400).send({ error: "sampleAssetIds or sampleLocalPaths required" });
    }

    const profile = await prisma.voiceProfile.create({
      data: {
        name: body.name,
        projectId: body.projectId || null,
        sampleAssetIds: body.sampleAssetIds || [],
        status: "cloning",
        meta: { description: body.description || null },
      },
    });

    const job = await enqueue("soundStudio", {
      action: "clone",
      voiceProfileId: profile.id,
      name: body.name,
      projectId: body.projectId || null,
      sampleAssetIds: body.sampleAssetIds || [],
      sampleLocalPaths: body.sampleLocalPaths || [],
      description: body.description || null,
    });

    return reply.code(202).send({ voiceProfile: profile, jobId: job.id });
  });

  /** POST /api/sound/tts — synthesize speech with cloned or stock voice */
  app.post("/api/sound/tts", async (req, reply) => {
    const body = (req.body || {}) as {
      text?: string;
      voiceId?: string;
      voiceProfileId?: string;
      projectId?: string;
    };
    if (!body.text?.trim()) return reply.code(400).send({ error: "text required" });

    let voiceId = body.voiceId;
    if (!voiceId && body.voiceProfileId) {
      const profile = await prisma.voiceProfile.findUnique({ where: { id: body.voiceProfileId } });
      if (!profile?.providerVoiceId) {
        return reply.code(400).send({ error: "Voice profile not ready or missing providerVoiceId" });
      }
      voiceId = profile.providerVoiceId;
    }

    const soundId = randomUUID();
    const job = await enqueue("soundStudio", {
      action: "tts",
      soundId,
      text: body.text,
      voiceId: voiceId || null,
      voiceProfileId: body.voiceProfileId || null,
      projectId: body.projectId || null,
    });

    return reply.code(202).send({ soundId, jobId: job.id, status: "queued" });
  });

  /** GET /api/sound/voices — library + local VoiceProfiles */
  app.get("/api/sound/voices", async (_req, reply) => {
    const [profiles, remote] = await Promise.all([
      prisma.voiceProfile.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      listVoices(),
    ]);
    return reply.send({
      profiles,
      elevenlabs: remote.voices,
      elevenlabsError: remote.error || null,
    });
  });

  /** GET /api/sound/library — audio assets from Sound Studio */
  app.get("/api/sound/library", async (req, reply) => {
    const q = req.query as { projectId?: string };
    const assets = await prisma.asset.findMany({
      where: {
        type: { in: ["audio", "voice_stem", "tts", "synced_video"] },
        ...(q.projectId ? { projectId: q.projectId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    });
    return reply.send({
      assets: assets.map((a) => ({
        ...a,
        bytes: a.bytes != null ? a.bytes.toString() : null,
      })),
    });
  });

  /** GET /api/sound/job/:id — poll job record */
  app.get("/api/sound/job/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await prisma.jobRecord.findUnique({ where: { jobId: id } });
    if (!job) return reply.code(404).send({ error: "Job not found" });
    return reply.send({ job });
  });

  /** Demo fixture — write a silent wav marker when no media available */
  app.post("/api/sound/demo-bed", async (req, reply) => {
    const body = (req.body || {}) as { projectId?: string };
    await mkdir(TMP, { recursive: true });
    const id = randomUUID();
    const localPath = path.join(TMP, `demo_bed_${id}.txt`);
    await writeFile(localPath, "REELSTORM Sound Studio demo bed placeholder\n", "utf8");
    const s3Key = `sound/demo/${id}.txt`;
    const asset = await prisma.asset.create({
      data: {
        projectId: body.projectId || null,
        type: "audio",
        key: s3Key,
        mimeType: "text/plain",
        labels: ["sound-studio", "demo"],
        meta: { localPath, note: "Replace with real audio upload" },
      },
    });
    return reply.code(201).send({ asset });
  });
}
