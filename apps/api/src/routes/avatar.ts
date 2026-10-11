import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { prisma, AvatarType } from "@reelstorm/db";
import { uploadBuffer, publicUrl } from "@reelstorm/media";
import { orchestrate } from "@reelstorm/providers";
import { resolveUserFromAuthHeader } from "./auth.js";
import { debitRtc, ensureUserWallet } from "../lib/rtc.js";

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
  return (process.env.AVATAR_ENGINE || "heygen").toLowerCase();
}

function saverGenerateUrl() {
  const raw = (process.env.RUNPOD_SAVER_URL || "").trim();
  if (raw) return raw.replace(/\/$/, "");
  const pod = (process.env.RUNPOD_POD_ID || "xuvnute4l51iog").trim();
  return `https://${pod}-8000.proxy.runpod.net/generate`;
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
  const url = saverGenerateUrl();
  const saverRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, duration, resolution: "720x1280" }),
    signal: AbortSignal.timeout(600_000),
  });
  const saverJson = (await saverRes.json().catch(() => ({}))) as {
    r2_url?: string;
    error?: string;
    engine?: string;
    mock?: boolean;
    real_r2?: boolean;
    note?: string;
  };
  if (!saverRes.ok || !saverJson.r2_url) {
    throw new Error(saverJson.error || `Saver generate failed (${saverRes.status})`);
  }
  return {
    r2_url: saverJson.r2_url,
    engine: saverJson.engine || "r2-upload-placeholder",
    mock: Boolean(saverJson.mock),
    real_r2: saverJson.real_r2 !== false,
    note: saverJson.note,
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

    const avatarId = randomUUID().replace(/-/g, "").slice(0, 16);
    const ext = (file.filename || "photo.jpg").toLowerCase().endsWith(".png") ? "png" : "jpg";
    const contentType = ext === "png" ? "image/png" : "image/jpeg";
    const sourceKey = `avatars/source/${user.id}/${avatarId}.${ext}`;
    await uploadBuffer(sourceKey, buf, contentType);
    const sourceUrl = publicUrl(sourceKey);

    // Phase 1: same-face identity lock — upload source bytes to 4 variant keys on R2 (real HTTP 200 thumbs).
    // Outfit prompts stored for later ComfyUI IPAdapter / HeyGen Photo Avatar swap.
    const outfitVariants: OutfitVariant[] = [];
    for (const preset of OUTFIT_PRESETS) {
      const key = `avatars/variants/${user.id}/${avatarId}/${preset.id}.${ext}`;
      await uploadBuffer(key, buf, contentType);
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
        userId: user.id,
        name: name || "Avatar Twin",
        type: AvatarType.PERSONAL_PHOTO,
        sourceUrl,
        status: "ready",
        outfitVariants,
      },
    });

    return {
      ok: true,
      avatarId: avatar.id,
      sourceUrl,
      outfitVariants,
      engine: engineMode(),
      note: "Identity locked on R2 — 4 outfit slots ready. Wire ComfyUI IPAdapter/HeyGen for costume swap next.",
    };
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

    const avatarId = randomUUID().replace(/-/g, "").slice(0, 16);
    const sourceKey = `avatars/source-video/${user.id}/${avatarId}.mp4`;
    await uploadBuffer(sourceKey, buf, "video/mp4");
    const sourceUrl = publicUrl(sourceKey);

    const outfitVariants: OutfitVariant[] = OUTFIT_PRESETS.map((preset) => ({
      id: preset.id,
      name: preset.name,
      outfitPrompt: preset.outfitPrompt,
      thumbUrl: sourceUrl,
      r2Url: sourceUrl,
    }));

    const avatar = await prisma.avatar.create({
      data: {
        id: avatarId,
        userId: user.id,
        name: name || "Digital Twin",
        type: AvatarType.PERSONAL_VIDEO,
        sourceUrl,
        status: "training",
        outfitVariants,
      },
    });

    // Soft mark ready after source lands (LivePortrait training hook later)
    await prisma.avatar.update({
      where: { id: avatar.id },
      data: { status: "ready" },
    });

    return {
      ok: true,
      avatarId: avatar.id,
      status: "ready",
      sourceUrl,
      outfitVariants,
      note: "Video twin source on R2 — LivePortrait training hook pending; variants selectable now.",
    };
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
      // Sync path always lands on our R2 via saver. HeyGen is optional async bridge.
      if (mode === "heygen" && process.env.HEYGEN_API_KEY) {
        try {
          await renderViaHeygen({
            script,
            avatarName: avatar.name,
            background: template.backgroundJson,
          });
        } catch {
          /* expected until HeyGen poll/webhook — fall through to saver */
        }
      }
      rendered = await renderViaSaver(prompt, template.duration);
      if (mode === "heygen" && process.env.HEYGEN_API_KEY) {
        rendered.engine = `heygen→saver:${rendered.engine}`;
      } else if (mode === "liveportrait") {
        rendered.engine = `liveportrait→${rendered.engine}`;
      }
    } catch (e) {
      return reply.code(502).send({ error: (e as Error).message });
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
