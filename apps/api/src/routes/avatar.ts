import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { prisma, AvatarType } from "@reelstorm/db";
import {
  uploadBuffer,
  uploadFile,
  publicUrl,
  generateWithAutonomousPod,
  getPodStatus,
  probePodHealth,
  downloadReferenceVideo,
  classifyVideoUrl,
  videoUrlKindLabel,
  extractFrame,
  probeVideo,
  resolveFfmpeg,
} from "@reelstorm/media";
import { orchestrate } from "@reelstorm/providers";
import { resolveUserFromAuthHeader } from "./auth.js";
import { debitRtc, ensureUserWallet } from "../lib/rtc.js";

function runCmd(cmd: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => resolve({ code: code ?? 1, stderr }));
    proc.on("error", (err) => resolve({ code: 1, stderr: err.message }));
  });
}

const OUTFIT_PRESETS = [
  {
    id: "red-bomber",
    name: "Red Bomber",
    outfitPrompt: "same identity, red bomber jacket, modern office background, cinematic",
  },
  {
    id: "navy-suit",
    name: "Navy Suit + Laptop",
    outfitPrompt: "same identity, navy business suit, holding laptop, glass office, cinematic",
  },
  {
    id: "pink-gym",
    name: "Pink Gym",
    outfitPrompt: "same identity, pink gym set, bright studio, fresh daily look, cinematic",
  },
  {
    id: "trench-hat",
    name: "Trench + Hat",
    outfitPrompt: "same identity, trench coat and fedora, street style, cinematic",
  },
] as const;

type OutfitVariant = {
  id: string;
  name: string;
  outfitPrompt: string;
  thumbUrl: string;
  r2Url: string;
  videoUrl?: string;
};

function engineMode() {
  return (process.env.AVATAR_ENGINE || "auto").toLowerCase();
}

/** Local fallback when RunPod host is full / HeyGen missing — photo Ken Burns + TTS → R2 */
async function renderStillTalkingFromImage(opts: {
  imageUrl: string;
  script: string;
  duration: number;
  userId: string;
  avatarId: string;
}): Promise<{
  r2_url: string;
  engine: string;
  mock: boolean;
  real_r2: boolean;
  note?: string;
}> {
  const work = path.join(tmpdir(), `rs-avatar-still-${opts.avatarId}-${Date.now()}`);
  await mkdir(work, { recursive: true });
  const imgPath = path.join(work, "face.jpg");
  const audioPath = path.join(work, "vo.mp3");
  const outPath = path.join(work, "out.mp4");

  const imgRes = await fetch(opts.imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!imgRes.ok) throw new Error(`Avatar image fetch failed ${imgRes.status}`);
  await writeFile(imgPath, Buffer.from(await imgRes.arrayBuffer()));

  const elevenKey = (process.env.ELEVENLABS_API_KEY || "").trim();
  const voice = process.env.AVATAR_VOICE_ID || process.env.DEBATE_VOICE_A || "21m00Tcm4TlvDq8ikWAM";
  let gotAudio = false;
  if (elevenKey) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
        method: "POST",
        headers: {
          "xi-api-key": elevenKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: opts.script.slice(0, 2500),
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.45, similarity_boost: 0.75 },
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (res.ok) {
        await writeFile(audioPath, Buffer.from(await res.arrayBuffer()));
        gotAudio = true;
      }
    } catch {
      /* fall through */
    }
  }
  if (!gotAudio) {
    const q = encodeURIComponent(opts.script.slice(0, 180));
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${q}&tl=en&client=tw-ob`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) {
      await writeFile(audioPath, Buffer.from(await res.arrayBuffer()));
      gotAudio = true;
    }
  }
  if (!gotAudio) {
    const ffmpeg = await resolveFfmpeg();
    const dur = Math.max(8, Math.min(45, opts.duration || 30));
    const tone = await runCmd(ffmpeg, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=220:duration=${dur}`,
      "-af",
      "volume=0.12",
      audioPath,
    ]);
    if (tone.code !== 0) throw new Error("Could not synthesize avatar voiceover");
  }

  const ffmpeg = await resolveFfmpeg();
  const dur = Math.max(8, Math.min(45, opts.duration || 30));
  const frames = Math.max(240, Math.round(dur * 25));
  const vf = `scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,zoompan=z='min(zoom+0.0008,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=720x1280:fps=25`;
  const mux = await runCmd(ffmpeg, [
    "-y",
    "-loop",
    "1",
    "-i",
    imgPath,
    "-i",
    audioPath,
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-tune",
    "stillimage",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    "-t",
    String(dur),
    "-movflags",
    "+faststart",
    outPath,
  ]);
  if (mux.code !== 0) {
    throw new Error(`Avatar still+TTS mux failed: ${mux.stderr.slice(0, 200)}`);
  }

  const key = `avatars/videos/${opts.userId}/${opts.avatarId}_${Date.now()}.mp4`;
  await uploadFile(key, outPath, "video/mp4");
  try {
    await unlink(imgPath);
    await unlink(audioPath);
    await unlink(outPath);
  } catch {
    /* */
  }
  return {
    r2_url: publicUrl(key),
    engine: "still+tts-fallback",
    mock: false,
    real_r2: true,
    note: "GPU host full — shipped photo Ken Burns + TTS. Wake RunPod later for full lip-sync.",
  };
}

function fingerprintFrom(req: FastifyRequest, body?: { fingerprint?: string }) {
  const fromBody = (body?.fingerprint || "").trim().toLowerCase();
  if (fromBody.length >= 16) return fromBody;
  const hdr = String(req.headers["x-device-fingerprint"] || "").trim().toLowerCase();
  if (hdr.length >= 16) return hdr;
  return "";
}

async function requireUser(req: FastifyRequest) {
  const user = await resolveUserFromAuthHeader(req.headers.authorization);
  if (!user) return null;
  return user;
}

async function createAvatarFromImageBuffer(opts: {
  userId: string;
  name: string;
  buf: Buffer;
  ext?: "jpg" | "png";
  contentType?: string;
  sourceNote?: string;
}) {
  const avatarId = randomUUID().replace(/-/g, "").slice(0, 16);
  const ext = opts.ext || "jpg";
  const contentType = opts.contentType || (ext === "png" ? "image/png" : "image/jpeg");
  const sourceKey = `avatars/source/${opts.userId}/${avatarId}.${ext}`;
  await uploadBuffer(sourceKey, opts.buf, contentType);
  const sourceUrl = publicUrl(sourceKey);

  const outfitVariants: OutfitVariant[] = [];
  for (const preset of OUTFIT_PRESETS) {
    const key = `avatars/variants/${opts.userId}/${avatarId}/${preset.id}.${ext}`;
    await uploadBuffer(key, opts.buf, contentType);
    const url = publicUrl(key);
    outfitVariants.push({
      id: preset.id,
      name: preset.name,
      outfitPrompt: preset.outfitPrompt,
      thumbUrl: url,
      r2Url: url,
    });
  }

  const avatar = await prisma.avatar.create({
    data: {
      id: avatarId,
      userId: opts.userId,
      name: opts.name || "Avatar Twin",
      type: AvatarType.PERSONAL_PHOTO,
      sourceUrl,
      status: "ready",
      outfitVariants,
    },
  });

  return {
    ok: true as const,
    avatarId: avatar.id,
    sourceUrl,
    outfitVariants,
    note:
      opts.sourceNote ||
      "Identity locked on R2 — 4 outfit slots ready. Wire ComfyUI IPAdapter/HeyGen for costume swap next.",
  };
}

/** Pull evenly spaced stills from a local video for character pick */
async function extractCharacterStills(
  localVideo: string,
  userId: string,
  sessionId: string,
  count = 8,
): Promise<Array<{ index: number; time: number; r2Url: string; key: string }>> {
  let duration = 12;
  try {
    duration = (await probeVideo(localVideo)).durationSec || 12;
  } catch {
    /* default */
  }
  const work = path.join(tmpdir(), `rs-avatar-frames-${sessionId}`);
  await mkdir(work, { recursive: true });
  const frames: Array<{ index: number; time: number; r2Url: string; key: string }> = [];
  const n = Math.max(4, Math.min(12, count));
  for (let i = 0; i < n; i++) {
    const t = Number(((duration * (i + 0.5)) / n).toFixed(2));
    const out = path.join(work, `frame_${i}.jpg`);
    try {
      await extractFrame(localVideo, t, out);
      const key = `avatars/extract/${userId}/${sessionId}/${i}.jpg`;
      await uploadFile(key, out, "image/jpeg");
      frames.push({ index: i, time: t, r2Url: publicUrl(key), key });
    } catch {
      /* skip bad frame */
    } finally {
      await unlink(out).catch(() => undefined);
    }
  }
  return frames;
}

async function generateScript(opts: {
  niche: string;
  templateSlug: string;
  localNews?: string;
  hookTemplate: string;
  scriptPromptTemplate: string;
  customScript?: string;
}) {
  if (opts.customScript?.trim()) return opts.customScript.trim();

  const prompt = [
    opts.scriptPromptTemplate,
    `Niche: ${opts.niche}.`,
    opts.localNews ? `Local news / update: ${opts.localNews}.` : "Invent a plausible local update for this niche.",
    `Hook style: ${opts.hookTemplate}`,
    "Return ONLY the spoken 30-second script (no markdown, no stage directions longer than one short bracketed beat).",
  ].join(" ");

  try {
    const text = await orchestrate(
      [
        {
          role: "system",
          content:
            "You write viral 30-second talking-head scripts for Avatar Model Studio. Strong hook in first 2 seconds. One niche insight. Clear CTA.",
        },
        { role: "user", content: prompt },
      ],
      { timeoutMs: 45_000 },
    );
    const cleaned = (text || "").trim();
    if (cleaned.length > 40) return cleaned;
  } catch {
    /* fall through */
  }

  const news = opts.localNews || `a breaking ${opts.niche} update`;
  return `[Show the detail immediately] Wait — ${news}? Here's what that means for ${opts.niche} in the next 30 days. Comment EXPERT and I'll send the blueprint.`;
}

async function renderViaSaver(prompt: string, duration = 30) {
  const out = await generateWithAutonomousPod({
    prompt,
    duration,
    resolution: "720x1280",
  });
  if (out.engine === "heygen") {
    throw new Error(
      out.note ||
        "Pod unavailable — HeyGen fallback selected (set AVATAR_ENGINE or wait for wake). Retry generate.",
    );
  }
  if (!out.r2_url) {
    const pod = await probePodHealth();
    throw new Error(
      out.error ||
        `Saver generate failed (pod ${pod.status}). Wake via POST /api/pod/wake or set RUNPOD_SERVERLESS_URL.`,
    );
  }
  return {
    r2_url: out.r2_url,
    engine: `${out.engine}:${out.saverEngine || "saver"}`,
    mock: Boolean(out.mock),
    real_r2: out.real_r2 !== false,
    note: out.note,
    podStatus: out.podStatus || (await getPodStatus()),
  };
}

async function renderViaHeygen(opts: {
  script: string;
  avatarName: string;
  background: unknown;
}) {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) throw new Error("HEYGEN_API_KEY not set");
  // Phase-1 bridge: call HeyGen when configured; fall back handled by caller.
  const res = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": key,
    },
    body: JSON.stringify({
      video_inputs: [
        {
          character: { type: "avatar", avatar_id: "default", avatar_style: "normal" },
          voice: { type: "text", input_text: opts.script },
          background: { type: "color", value: "#0a0a0a" },
        },
      ],
      dimension: { width: 720, height: 1280 },
      test: true,
      title: opts.avatarName,
      callback_id: String(opts.background || ""),
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(`HeyGen error ${res.status}: ${(await res.text()).slice(0, 240)}`);
  }
  // HeyGen is async; for production ship we still land on R2 via saver until webhook poll lands.
  throw new Error("HeyGen accepted — use AVATAR_ENGINE=liveportrait/saver for sync R2 until webhook poll ships");
}

export async function avatarRoutes(app: FastifyInstance) {
  app.get("/api/avatar/templates", async (_req, reply) => {
    const templates = await prisma.avatarTemplate.findMany({ orderBy: { sortOrder: "asc" } });
    if (!templates.length) {
      return reply.send({
        templates: [],
        hint: "Run: npx tsx scripts/seedAvatarTemplates.ts",
      });
    }
    return { templates };
  });

  app.get("/api/avatar/list", async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.code(401).send({ error: "Sign in required" });

    const mine = await prisma.avatar.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const stock = await prisma.avatar.findMany({
      where: { type: AvatarType.STOCK },
      orderBy: { createdAt: "desc" },
      take: 128,
    });

    return {
      avatars: mine,
      stock,
      engine: engineMode(),
      heygenConfigured: Boolean(process.env.HEYGEN_API_KEY),
    };
  });

  app.post("/api/avatar/create-from-image", async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.code(401).send({ error: "Sign in required" });

    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "image file required (multipart field: image)" });

    const fields = file.fields as Record<string, { value?: string } | undefined>;
    const name = String(
      fields?.name && "value" in fields.name ? fields.name.value : "Avatar Twin",
    ).trim();
    const buf = await file.toBuffer();
    if (!buf.length) return reply.code(400).send({ error: "empty image" });

    const ext = (file.filename || "photo.jpg").toLowerCase().endsWith(".png") ? "png" : "jpg";
    const created = await createAvatarFromImageBuffer({
      userId: user.id,
      name,
      buf,
      ext: ext as "jpg" | "png",
      contentType: ext === "png" ? "image/png" : "image/jpeg",
    });
    return { ...created, engine: engineMode() };
  });

  app.post("/api/avatar/create-from-video", async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.code(401).send({ error: "Sign in required" });

    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "video file required (multipart field: video)" });

    const fields = file.fields as Record<string, { value?: string } | undefined>;
    const name = String(
      fields?.name && "value" in fields.name ? fields.name.value : "Digital Twin",
    ).trim();
    const buf = await file.toBuffer();
    if (!buf.length) return reply.code(400).send({ error: "empty video" });

    const sessionId = randomUUID().replace(/-/g, "").slice(0, 12);
    const work = path.join(process.env.UPLOAD_TMP_DIR || tmpdir(), "avatar-video", user.id, sessionId);
    await mkdir(work, { recursive: true });
    const localPath = path.join(work, "source.mp4");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(localPath, buf);

    const avatarId = randomUUID().replace(/-/g, "").slice(0, 16);
    const sourceKey = `avatars/source-video/${user.id}/${avatarId}.mp4`;
    await uploadBuffer(sourceKey, buf, "video/mp4");
    const sourceUrl = publicUrl(sourceKey);

    const frames = await extractCharacterStills(localPath, user.id, sessionId, 8);
    const faceStill = frames[Math.floor(frames.length / 2)] || frames[0];
    let outfitVariants: OutfitVariant[] = OUTFIT_PRESETS.map((preset) => ({
      id: preset.id,
      name: preset.name,
      outfitPrompt: preset.outfitPrompt,
      thumbUrl: faceStill?.r2Url || sourceUrl,
      r2Url: faceStill?.r2Url || sourceUrl,
    }));

    if (faceStill?.r2Url) {
      try {
        const res = await fetch(faceStill.r2Url);
        if (res.ok) {
          const stillBuf = Buffer.from(await res.arrayBuffer());
          if (stillBuf.length) {
            outfitVariants = [];
            for (const preset of OUTFIT_PRESETS) {
              const key = `avatars/variants/${user.id}/${avatarId}/${preset.id}.jpg`;
              await uploadBuffer(key, stillBuf, "image/jpeg");
              const url = publicUrl(key);
              outfitVariants.push({
                id: preset.id,
                name: preset.name,
                outfitPrompt: preset.outfitPrompt,
                thumbUrl: url,
                r2Url: url,
              });
            }
          }
        }
      } catch {
        /* keep still thumbs */
      }
    }

    const avatar = await prisma.avatar.create({
      data: {
        id: avatarId,
        userId: user.id,
        name: name || "Digital Twin",
        type: AvatarType.PERSONAL_VIDEO,
        sourceUrl,
        status: "ready",
        outfitVariants,
      },
    });

    return {
      ok: true,
      avatarId: avatar.id,
      status: "ready",
      sourceUrl,
      frames,
      outfitVariants,
      note: "Video twin + character stills extracted — pick a better frame via Extract from link if needed.",
    };
  });

  /**
   * YouTube / Instagram / TikTok / Facebook / X / direct MP4 → character stills
   * Client picks a still → create-from-frame rebuilds Avatar Studio twin.
   */
  app.post("/api/avatar/extract-from-url", async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.code(401).send({ error: "Sign in required" });

    const body = (req.body || {}) as { url?: string; count?: number; name?: string };
    const url = (body.url || "").trim();
    if (!url) return reply.code(400).send({ error: "url required (YouTube, Instagram, TikTok, etc.)" });

    const kind = classifyVideoUrl(url);
    const sessionId = randomUUID().replace(/-/g, "").slice(0, 12);
    const work = path.join(
      process.env.UPLOAD_TMP_DIR || tmpdir(),
      "avatar-extract",
      user.id,
      sessionId,
    );

    try {
      const dl = await downloadReferenceVideo(url, work);
      const vKey = `avatars/extract/${user.id}/${sessionId}/source.mp4`;
      await uploadFile(vKey, dl.localPath, "video/mp4");
      const frames = await extractCharacterStills(
        dl.localPath,
        user.id,
        sessionId,
        Number(body.count) || 8,
      );
      if (!frames.length) {
        return reply.code(422).send({
          error: "Could not extract character frames from this video. Try another link or upload a photo.",
        });
      }
      return {
        ok: true,
        sessionId,
        sourceType: kind,
        sourceLabel: videoUrlKindLabel(kind),
        title: dl.title,
        sourceVideoUrl: publicUrl(vKey),
        sourceVideoKey: vKey,
        suggestedName: (body.name || dl.title || "Link Twin").slice(0, 80),
        frames,
        note: "Pick a clear face still → Rebuild as avatar (4 outfit slots).",
      };
    } catch (e) {
      return reply.code(500).send({
        error: e instanceof Error ? e.message : String(e),
        hint: "yt-dlp must resolve the link. Instagram/TikTok may need cookies on the VPS for private reels.",
      });
    }
  });

  /** Rebuild Avatar Studio twin from an extracted character still (R2 URL or key) */
  app.post("/api/avatar/create-from-frame", async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.code(401).send({ error: "Sign in required" });

    const body = (req.body || {}) as {
      frameUrl?: string;
      frameKey?: string;
      name?: string;
      sourceVideoUrl?: string;
    };
    const frameUrl = (body.frameUrl || "").trim();
    const frameKey = (body.frameKey || "").trim();
    if (!frameUrl && !frameKey) {
      return reply.code(400).send({ error: "frameUrl or frameKey required" });
    }

    let buf: Buffer;
    try {
      const fetchUrl = frameUrl || publicUrl(frameKey);
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`Frame fetch HTTP ${res.status}`);
      buf = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      return reply.code(400).send({
        error: e instanceof Error ? e.message : "Could not load extracted frame",
      });
    }
    if (!buf.length) return reply.code(400).send({ error: "empty frame" });

    const created = await createAvatarFromImageBuffer({
      userId: user.id,
      name: (body.name || "Link Twin").trim() || "Link Twin",
      buf,
      ext: "jpg",
      contentType: "image/jpeg",
      sourceNote: body.sourceVideoUrl
        ? `Rebuilt from social/YouTube still · source ${body.sourceVideoUrl}`
        : "Rebuilt from extracted character still — 4 outfit slots ready.",
    });
    return { ...created, engine: engineMode(), sourceVideoUrl: body.sourceVideoUrl || null };
  });

  app.post("/api/avatar/script", async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.code(401).send({ error: "Sign in required" });

    const body = (req.body || {}) as {
      niche?: string;
      templateSlug?: string;
      localNews?: string;
      customScript?: string;
    };
    const niche = (body.niche || "AI").trim();
    const slug = (body.templateSlug || "news-update-authority").trim();
    const template = await prisma.avatarTemplate.findUnique({ where: { slug } });
    if (!template) return reply.code(404).send({ error: "Template not found" });

    const script = await generateScript({
      niche,
      templateSlug: slug,
      localNews: body.localNews,
      hookTemplate: template.hookTemplate,
      scriptPromptTemplate: template.scriptPromptTemplate,
      customScript: body.customScript,
    });

    return { ok: true, script, niche, templateSlug: slug, duration: template.duration };
  });

  app.post("/api/avatar/generate", async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.code(401).send({ error: "Sign in required" });

    const body = (req.body || {}) as {
      avatarId?: string;
      variantId?: string;
      niche?: string;
      templateSlug?: string;
      customScript?: string;
      localNews?: string;
      fingerprint?: string;
      projectId?: string;
    };

    const fp = fingerprintFrom(req, body);
    if (!fp) {
      return reply.code(400).send({
        error: "Stable device fingerprint required (min 16 chars)",
        code: "fingerprint_invalid",
      });
    }

    const avatarId = (body.avatarId || "").trim();
    const variantId = (body.variantId || "red-bomber").trim();
    const niche = (body.niche || "AI").trim();
    const slug = (body.templateSlug || "news-update-authority").trim();

    const avatar = await prisma.avatar.findFirst({
      where: { id: avatarId, userId: user.id },
    });
    if (!avatar) return reply.code(404).send({ error: "Avatar not found" });

    const template = await prisma.avatarTemplate.findUnique({ where: { slug } });
    if (!template) return reply.code(404).send({ error: "Template not found" });

    const variants = (avatar.outfitVariants as OutfitVariant[]) || [];
    const variant = variants.find((v) => v.id === variantId) || variants[0];
    if (!variant) return reply.code(400).send({ error: "No outfit variant on avatar" });

    const wallet = await ensureUserWallet(user.id);
    if (wallet.balanceRtc < template.rtcCost) {
      return reply.code(402).send({
        error: `Need ${template.rtcCost} RTC — balance ${wallet.balanceRtc}`,
        rtcCost: template.rtcCost,
        balanceRtc: wallet.balanceRtc,
      });
    }

    const script = await generateScript({
      niche,
      templateSlug: slug,
      localNews: body.localNews,
      hookTemplate: template.hookTemplate,
      scriptPromptTemplate: template.scriptPromptTemplate,
      customScript: body.customScript,
    });

    const prompt = [
      `Avatar Model Studio · ${template.name}`,
      `Variant: ${variant.name}`,
      `Niche: ${niche}`,
      `Outfit: ${variant.outfitPrompt}`,
      `Script: ${script}`,
    ].join(" | ");

    let rendered: {
      r2_url: string;
      engine: string;
      mock: boolean;
      real_r2: boolean;
      note?: string;
    };

    const mode = engineMode();
    try {
      // Auto-wake pod (or serverless). HeyGen only if AVATAR_ENGINE=heygen + key set.
      if (mode === "heygen" && process.env.HEYGEN_API_KEY) {
        try {
          await renderViaHeygen({
            script,
            avatarName: avatar.name,
            background: template.backgroundJson,
          });
        } catch {
          /* expected until HeyGen poll/webhook — fall through to autonomous saver */
        }
      }
      rendered = await renderViaSaver(prompt, template.duration);
      if (mode === "heygen" && process.env.HEYGEN_API_KEY) {
        rendered.engine = `heygen→${rendered.engine}`;
      } else if (mode === "liveportrait") {
        rendered.engine = `liveportrait→${rendered.engine}`;
      }
    } catch (e) {
      // Host full / no HeyGen — still ship a real R2 video from photo + TTS
      try {
        const imageUrl = variant.r2Url || variant.thumbUrl || avatar.sourceUrl;
        if (!imageUrl) throw e;
        rendered = await renderStillTalkingFromImage({
          imageUrl,
          script,
          duration: template.duration,
          userId: user.id,
          avatarId: avatar.id,
        });
        rendered.note = `${rendered.note || ""} · prior GPU error: ${(e as Error).message}`.trim();
      } catch {
        const pod = await probePodHealth().catch(() => null);
        return reply.code(503).send({
          ok: false,
          error: (e as Error).message,
          podStatus: pod?.status || (await getPodStatus().catch(() => "UNKNOWN")),
          hint:
            "RunPod host has no free GPUs right now. Retry Wake Pod later, deploy a new pod on another host, or set RUNPOD_SERVERLESS_URL / HEYGEN_API_KEY.",
        });
      }
    }

    await debitRtc({
      walletId: wallet.id,
      amount: template.rtcCost,
      type: "DEBIT_GENERATE",
      note: `Avatar Studio · ${template.slug} · ${template.rtcCost} RTC`,
      refType: "avatar",
      refId: avatar.id,
    });

    const nextVariants = variants.map((v) =>
      v.id === variant.id ? { ...v, videoUrl: rendered!.r2_url, r2Url: rendered!.r2_url } : v,
    );

    await prisma.avatar.update({
      where: { id: avatar.id },
      data: {
        outfitVariants: nextVariants,
        lastVideoUrl: rendered.r2_url,
        lastScript: script,
      },
    });

    // Attach to project studio-set path when projectId provided (soft)
    if (body.projectId) {
      try {
        await prisma.project.update({
          where: { id: body.projectId },
          data: { status: "GENERATING" },
        });
      } catch {
        /* ignore bad project */
      }
    }

    return {
      ok: true,
      mock: rendered.mock,
      real_r2: rendered.real_r2,
      r2_url: rendered.r2_url,
      prompt: script,
      duration: template.duration,
      engine: rendered.engine,
      template: { slug: template.slug, name: template.name },
      variant: { id: variant.id, name: variant.name },
      niche,
      fingerprint: fp.slice(0, 8) + "…",
      rtcSpent: template.rtcCost,
      studioSetHint: "/studio-set",
      note: rendered.note,
    };
  });
}
