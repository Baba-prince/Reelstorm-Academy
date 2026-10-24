/**
 * REELSTORM CINEMA — Showrunner API (Saga hybrid)
 * Cast · World · Voice · Board (approve gate) · Shoot · Cut
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { prisma } from "@reelstorm/db";
import {
  buildPilotSeason,
  cinemaProgress,
  assertBoardApproved,
  continuityReport,
  runClipContinuityQc,
  cinemaShootRtc,
  CINEMA_RTC,
  DRAMA_SPINES,
  CINEMA_STAGES,
  type SeasonBible,
  type BoardStill,
} from "@reelstorm/domain";
import { uploadBuffer, publicUrl, resolveFfmpeg } from "@reelstorm/media";
import { generateWithSeedance } from "@reelstorm/providers";
import { resolveUserFromAuthHeader } from "./auth.js";
import { debitRtc, ensureUserWallet } from "../lib/rtc.js";

const CAST_FACE_PRESETS: Record<string, string> = {
  char_amara:
    "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=720&h=1280&q=80",
  char_dante:
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=720&h=1280&q=80",
};

const DEFAULT_VOICES: Record<string, string> = {
  char_amara: process.env.CINEMA_VOICE_A || process.env.AVATAR_VOICE_ID || "21m00Tcm4TlvDq8ikWAM",
  char_dante: process.env.CINEMA_VOICE_B || process.env.DEBATE_VOICE_B || "pNInz6obpgDQGcFmaJgB",
};

/** Circuit breaker — skip HeyGen after 401/unauthorized until process restart or env flip */
let heygenCircuitOpen = process.env.CINEMA_SKIP_HEYGEN === "1";
let heygenCircuitReason = heygenCircuitOpen ? "CINEMA_SKIP_HEYGEN=1" : "";

function noteHeygenFailure(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/401|unauthorized|forbidden|402|payment|credit/i.test(msg)) {
    heygenCircuitOpen = true;
    heygenCircuitReason = msg.slice(0, 180);
  }
}

async function resolveUser(req: FastifyRequest, ownerEmail?: string) {
  const authed = await resolveUserFromAuthHeader(req.headers.authorization);
  if (authed) return authed;
  const email = (ownerEmail || "cinema@reelstorm.uk").trim().toLowerCase();
  return prisma.user.upsert({
    where: { email },
    create: { email, name: email.split("@")[0], tier: "storm_pro", rtcBalance: 100 },
    update: {},
  });
}

function asBible(json: unknown): SeasonBible {
  return json as SeasonBible;
}

async function saveBible(id: string, bible: SeasonBible, extra?: { status?: string; masterUrl?: string }) {
  const progress = cinemaProgress(bible);
  bible.stage = progress.stage;
  return prisma.cinemaSeason.update({
    where: { id },
    data: {
      bibleJson: bible as object,
      title: bible.title,
      spine: String(bible.spine),
      status: extra?.status || (progress.cutReady ? "cut" : progress.shotReady ? "shooting" : progress.boardApproved ? "boarded" : "locking"),
      ...(extra?.masterUrl ? { masterUrl: extra.masterUrl } : {}),
    },
  });
}

function stillSvg(still: BoardStill, charName?: string, worldName?: string): string {
  const title = (still.dialogue || still.prompt).slice(0, 90);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1020"/>
      <stop offset="55%" stop-color="#1a1030"/>
      <stop offset="100%" stop-color="#2a0818"/>
    </linearGradient>
  </defs>
  <rect width="720" height="1280" fill="url(#g)"/>
  <rect x="40" y="40" width="640" height="1200" rx="28" fill="none" stroke="#ff6a3d" stroke-opacity="0.35" stroke-width="2"/>
  <text x="60" y="120" fill="#2ec4b6" font-family="ui-monospace,monospace" font-size="22" letter-spacing="4">REELSTORM CINEMA</text>
  <text x="60" y="190" fill="#f2efe8" font-family="sans-serif" font-size="42" font-weight="700">${escapeXml(charName || "SCENE")}</text>
  <text x="60" y="240" fill="#f0c14a" font-family="ui-monospace,monospace" font-size="18">${escapeXml(worldName || still.worldId || "")}</text>
  <foreignObject x="60" y="320" width="600" height="520">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:#f2efe8;font:28px/1.35 sans-serif">${escapeXml(title)}</div>
  </foreignObject>
  <text x="60" y="1180" fill="rgba(242,239,232,0.5)" font-family="ui-monospace,monospace" font-size="16">${escapeXml(still.id)} · ${still.framing} · ${still.durationSec}s</text>
</svg>`;
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function uploadSvgOrData(key: string, svg: string): Promise<string> {
  const buf = Buffer.from(svg, "utf8");
  try {
    await uploadBuffer(key, buf, "image/svg+xml");
    return publicUrl(key);
  } catch {
    const dir = path.join(process.cwd(), "tmp", "cinema");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, key.replace(/\//g, "_"));
    await writeFile(file, buf);
    const port = process.env.PORT || "4000";
    return `http://127.0.0.1:${port}/media/cinema/${path.basename(file)}`;
  }
}

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

async function pickHeygenVoice(key: string): Promise<string> {
  try {
    const res = await fetch("https://api.heygen.com/v2/voices", {
      headers: { "x-api-key": key, "X-Api-Key": key },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return "en-US-JennyNeural";
    const data = (await res.json()) as { data?: { voices?: Array<{ voice_id?: string }> } };
    return data.data?.voices?.[0]?.voice_id || "en-US-JennyNeural";
  } catch {
    return "en-US-JennyNeural";
  }
}

/** HeyGen image→talking clip for drama dialogue shots */
async function renderHeygenClip(opts: {
  imageUrl: string;
  script: string;
  title: string;
  userId: string;
  seasonId: string;
  stillId: string;
}): Promise<{ videoUrl: string; engine: string }> {
  const key = (process.env.HEYGEN_API_KEY || "").trim();
  if (!key) throw new Error("HEYGEN_API_KEY not set");

  const imgRes = await fetch(opts.imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!imgRes.ok) throw new Error(`Face fetch ${imgRes.status}`);
  const imgBuf = Buffer.from(await imgRes.arrayBuffer());
  const ctype = (imgRes.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
  const ext = ctype.includes("png") ? "png" : "jpg";
  const boundary = `----Cinema${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="face.${ext}"\r\nContent-Type: ${ctype}\r\n\r\n`,
    ),
    imgBuf,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const uploadRes = await fetch("https://api.heygen.com/v3/assets", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "X-Api-Key": key,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
    signal: AbortSignal.timeout(180_000),
  });
  if (!uploadRes.ok) throw new Error(`HeyGen asset ${uploadRes.status}: ${(await uploadRes.text()).slice(0, 200)}`);
  const uploadData = (await uploadRes.json()) as { data?: { asset_id?: string; id?: string }; asset_id?: string };
  const assetId = uploadData.data?.asset_id || uploadData.data?.id || uploadData.asset_id;
  if (!assetId) throw new Error("HeyGen asset id missing");

  const voiceId = await pickHeygenVoice(key);
  const createRes = await fetch("https://api.heygen.com/v3/videos", {
    method: "POST",
    headers: { "x-api-key": key, "X-Api-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "image",
      image: { type: "asset_id", asset_id: assetId },
      script: opts.script.slice(0, 2500),
      voice_id: voiceId,
      title: opts.title.slice(0, 80),
      resolution: process.env.HEYGEN_RESOLUTION || "720p",
      aspect_ratio: "9:16",
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!createRes.ok) throw new Error(`HeyGen create ${createRes.status}: ${(await createRes.text()).slice(0, 200)}`);
  const created = (await createRes.json()) as { data?: { video_id?: string }; video_id?: string };
  const videoId = created.data?.video_id || created.video_id;
  if (!videoId) throw new Error("HeyGen video_id missing");

  const deadline = Date.now() + Number(process.env.HEYGEN_POLL_MS || 420_000);
  let remoteUrl = "";
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 8000));
    const stRes = await fetch(`https://api.heygen.com/v3/videos/${videoId}`, {
      headers: { "x-api-key": key, "X-Api-Key": key },
      signal: AbortSignal.timeout(60_000),
    });
    if (!stRes.ok) continue;
    const st = (await stRes.json()) as Record<string, unknown>;
    const nested = (st.data && typeof st.data === "object" ? st.data : st) as Record<string, unknown>;
    const status = String(nested.status || "").toLowerCase();
    if (status === "completed") {
      remoteUrl = String(nested.video_url || nested.url || "");
      break;
    }
    if (status === "failed") throw new Error(String(nested.failure_message || "HeyGen failed"));
  }
  if (!remoteUrl) throw new Error("HeyGen timed out");

  const vidRes = await fetch(remoteUrl, { signal: AbortSignal.timeout(300_000) });
  if (!vidRes.ok) throw new Error(`HeyGen download ${vidRes.status}`);
  const vidBuf = Buffer.from(await vidRes.arrayBuffer());
  const r2Key = `cinema/${opts.userId}/${opts.seasonId}/${opts.stillId}_heygen.mp4`;
  try {
    await uploadBuffer(r2Key, vidBuf, "video/mp4");
    return { videoUrl: publicUrl(r2Key), engine: "heygen" };
  } catch {
    const dir = path.join(process.cwd(), "tmp", "cinema");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${opts.stillId}_heygen.mp4`);
    await writeFile(file, vidBuf);
    return { videoUrl: `file://${file}`, engine: "heygen-local" };
  }
}

async function kenBurnsFromImage(opts: {
  imageUrl: string;
  durationSec: number;
  outPath: string;
}): Promise<void> {
  const ffmpeg = await resolveFfmpeg();
  const work = path.join(tmpdir(), `cinema-kb-${Date.now()}`);
  await mkdir(work, { recursive: true });
  const imgPath = path.join(work, "still.jpg");
  const res = await fetch(opts.imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`still fetch ${res.status}`);
  let buf = Buffer.from(await res.arrayBuffer());
  // SVG → rasterize via ffmpeg if needed; for svg write as .svg
  const isSvg = opts.imageUrl.includes(".svg") || (res.headers.get("content-type") || "").includes("svg");
  const src = isSvg ? path.join(work, "still.svg") : imgPath;
  await writeFile(src, buf);
  const dur = Math.max(2, opts.durationSec);
  const args = [
    "-y",
    "-loop",
    "1",
    "-i",
    src,
    "-vf",
    `scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,zoompan=z='min(zoom+0.0015,1.12)':d=${dur * 25}:s=720x1280:fps=25`,
    "-t",
    String(dur),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-an",
    opts.outPath,
  ];
  const r = await runCmd(ffmpeg, args);
  if (r.code !== 0) throw new Error(`ffmpeg kenburns: ${r.stderr.slice(-400)}`);
}

async function concatClips(clipPaths: string[], outPath: string) {
  const ffmpeg = await resolveFfmpeg();
  const list = path.join(tmpdir(), `cinema-list-${Date.now()}.txt`);
  await writeFile(list, clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
  const r = await runCmd(ffmpeg, [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    list,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    outPath,
  ]);
  if (r.code !== 0) {
    // retry video-only concat
    const r2 = await runCmd(ffmpeg, [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-an",
      outPath,
    ]);
    if (r2.code !== 0) throw new Error(`ffmpeg concat: ${r2.stderr.slice(-400)}`);
  }
}

export async function cinemaRoutes(app: FastifyInstance) {
  // Serve local cinema media
  app.get("/media/cinema/:file", async (req, reply) => {
    const { file } = req.params as { file: string };
    const safe = path.basename(file);
    const abs = path.join(process.cwd(), "tmp", "cinema", safe);
    try {
      const buf = await readFile(abs);
      const type = safe.endsWith(".svg")
        ? "image/svg+xml"
        : safe.endsWith(".mp4")
          ? "video/mp4"
          : "application/octet-stream";
      reply.header("Content-Type", type);
      return reply.send(buf);
    } catch {
      return reply.code(404).send({ error: "not found" });
    }
  });

  app.get("/api/cinema/meta", async () => ({
    stages: CINEMA_STAGES,
    spines: DRAMA_SPINES,
    rtc: { shootEpisode: CINEMA_RTC.shootEpisode, cutMaster: CINEMA_RTC.cutMaster },
    heygen: {
      configured: Boolean(process.env.HEYGEN_API_KEY),
      circuitOpen: heygenCircuitOpen,
      reason: heygenCircuitReason || null,
    },
    seedance: Boolean(process.env.SEEDANCE_API_KEY || process.env.DASHSCOPE_API_KEY),
    note: "Cinema Mode — Saga hybrid. BOT Director absorbed as Showrunner.",
  }));

  app.get("/api/cinema/readiness", async () => {
    const ffmpeg = await resolveFfmpeg();
    const ffmpegOk = ffmpeg !== "ffmpeg";
    return {
      cinema: "ready",
      gapsClosed: [
        "showrunner_absorb_bot_director",
        "cast_world_voice_board_shoot_cut",
        "approve_before_spend",
        "rtc_metering",
        "continuity_qc",
        "soul_room_voice_persist",
        "heygen_circuit_breaker",
        "kenburns_seedance_fallback",
        "factory_nav_demotion",
      ],
      optionalOpen: [
        heygenCircuitOpen || !process.env.HEYGEN_API_KEY
          ? "heygen_api_wallet (optional dialogue)"
          : null,
        !(process.env.SEEDANCE_API_KEY || process.env.DASHSCOPE_API_KEY)
          ? "seedance_dashscope (I2V cinematic)"
          : null,
      ].filter(Boolean),
      ffmpeg: ffmpegOk ? ffmpeg : "missing",
      heygenCircuitOpen,
      heygenCircuitReason: heygenCircuitReason || null,
    };
  });

  app.get("/api/cinema/seasons", async (req) => {
    const user = await resolveUser(req);
    const seasons = await prisma.cinemaSeason.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return {
      seasons: seasons.map((s) => ({
        id: s.id,
        title: s.title,
        spine: s.spine,
        status: s.status,
        masterUrl: s.masterUrl,
        progress: cinemaProgress(asBible(s.bibleJson)),
        createdAt: s.createdAt,
      })),
    };
  });

  app.get("/api/cinema/seasons/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const season = await prisma.cinemaSeason.findUnique({ where: { id } });
    if (!season) return reply.code(404).send({ error: "Season not found" });
    const bible = asBible(season.bibleJson);
    return {
      season,
      bible,
      progress: cinemaProgress(bible),
      continuity: continuityReport(bible),
      rtc: {
        shoot: cinemaShootRtc(bible.episodes[0]?.stills.length || 4),
        cut: CINEMA_RTC.cutMaster,
      },
      stages: CINEMA_STAGES,
    };
  });

  /** Create pilot drama season (Showrunner) */
  app.post("/api/cinema/seasons", async (req, reply) => {
    const body = (req.body || {}) as {
      spineId?: string;
      title?: string;
      logline?: string;
      ownerEmail?: string;
    };
    const user = await resolveUser(req, body.ownerEmail);
    const bible = buildPilotSeason({
      spineId: body.spineId,
      title: body.title,
      logline: body.logline,
    });

    const project = await prisma.project.create({
      data: {
        title: bible.title,
        logline: bible.logline,
        script: bible.episodes[0]?.synopsis || bible.logline,
        status: "DRAFT",
        ownerId: user.id,
      },
    });

    const season = await prisma.cinemaSeason.create({
      data: {
        userId: user.id,
        projectId: project.id,
        title: bible.title,
        spine: String(bible.spine),
        status: "draft",
        bibleJson: bible as object,
      },
    });

    return reply.code(201).send({
      season,
      bible,
      progress: cinemaProgress(bible),
      projectId: project.id,
    });
  });

  /** Lock Cast — assign faces (Avatar Studio path) */
  app.post("/api/cinema/seasons/:id/cast/lock", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as {
      characters?: Array<{ id: string; faceUrl?: string; avatarId?: string; name?: string }>;
    };
    const season = await prisma.cinemaSeason.findUnique({ where: { id } });
    if (!season) return reply.code(404).send({ error: "not found" });
    const bible = asBible(season.bibleJson);

    for (const c of bible.characters) {
      const override = body.characters?.find((x) => x.id === c.id);
      c.faceUrl = override?.faceUrl || c.faceUrl || CAST_FACE_PRESETS[c.id];
      if (override?.avatarId) c.avatarId = override.avatarId;
      if (override?.name) c.name = override.name;
      c.locked = Boolean(c.faceUrl);
    }

    // Persist Soul IDs on project (face lock for factory generate / I2V)
    if (season.projectId) {
      for (const c of bible.characters) {
        if (!c.faceUrl) continue;
        const faceHash = createHash("sha1").update(`${c.id}:${c.faceUrl}`).digest("hex").slice(0, 24);
        const existing = await prisma.soulIdentity.findFirst({
          where: { projectId: season.projectId, name: c.name },
        });
        if (existing) {
          await prisma.soulIdentity.update({
            where: { id: existing.id },
            data: {
              faceHash,
              frontKey: c.faceUrl,
              threeQKey: c.faceUrl,
              locked: true,
            },
          });
        } else {
          await prisma.soulIdentity.create({
            data: {
              projectId: season.projectId,
              name: c.name,
              faceHash,
              frontKey: c.faceUrl,
              threeQKey: c.faceUrl,
              locked: true,
            },
          });
        }
      }
    }

    const updated = await saveBible(id, bible);
    return {
      season: updated,
      bible,
      progress: cinemaProgress(bible),
      continuity: continuityReport(bible),
    };
  });

  /** Lock World — Scene Studio plates */
  app.post("/api/cinema/seasons/:id/world/lock", async (req, reply) => {
    const { id } = req.params as { id: string };
    const season = await prisma.cinemaSeason.findUnique({ where: { id } });
    if (!season) return reply.code(404).send({ error: "not found" });
    const bible = asBible(season.bibleJson);
    const userId = season.userId;

    for (const w of bible.worlds) {
      if (!w.plateUrl) {
        const svg = stillSvg(
          {
            id: w.id,
            episodeIndex: 1,
            shotIndex: 0,
            prompt: w.description,
            framing: "wide",
            durationSec: 4,
            approved: false,
          },
          w.name,
          w.description.slice(0, 60),
        );
        w.plateUrl = await uploadSvgOrData(`cinema/${userId}/${id}/world_${w.id}.svg`, svg);
      }
      w.locked = Boolean(w.plateUrl);
    }

    // Persist Room plates on project
    if (season.projectId) {
      for (const w of bible.worlds) {
        const existing = await prisma.roomPlate.findFirst({
          where: { projectId: season.projectId, name: w.name },
        });
        const data = {
          wideKey: w.plateUrl || undefined,
          mediumKey: w.plateUrl || undefined,
          oshKey: w.plateUrl || undefined,
          closeKey: w.plateUrl || undefined,
          lightingLocked: true,
          lut: "cinema_drama",
        };
        if (existing) {
          await prisma.roomPlate.update({ where: { id: existing.id }, data });
        } else {
          await prisma.roomPlate.create({
            data: { projectId: season.projectId, name: w.name, ...data },
          });
        }
      }
    }

    // Seed storyboard stills + StoryboardFrame rows (approve gate surface)
    const ep = bible.episodes[0];
    if (ep) {
      for (const s of ep.stills) {
        const char = bible.characters.find((c) => c.id === s.characterId);
        const world = bible.worlds.find((w) => w.id === s.worldId);
        if (!s.stillUrl) {
          if (char?.faceUrl && s.dialogue) s.stillUrl = char.faceUrl;
          else if (world?.plateUrl) s.stillUrl = world.plateUrl;
          else {
            const svg = stillSvg(s, char?.name, world?.name);
            s.stillUrl = await uploadSvgOrData(`cinema/${userId}/${id}/${s.id}.svg`, svg);
          }
        }
        if (season.projectId && s.stillUrl) {
          const frame = await prisma.storyboardFrame.findFirst({
            where: { projectId: season.projectId, shotIndex: s.shotIndex },
          });
          if (frame) {
            await prisma.storyboardFrame.update({
              where: { id: frame.id },
              data: { prompt: s.prompt, imageKey: s.stillUrl, approved: s.approved },
            });
          } else {
            await prisma.storyboardFrame.create({
              data: {
                projectId: season.projectId,
                shotIndex: s.shotIndex,
                prompt: s.prompt,
                imageKey: s.stillUrl,
                approved: s.approved,
              },
            });
          }
        }
      }
    }

    const updated = await saveBible(id, bible);
    return {
      season: updated,
      bible,
      progress: cinemaProgress(bible),
      continuity: continuityReport(bible),
    };
  });

  /** Lock Voice — bind voiceIds to characters */
  app.post("/api/cinema/seasons/:id/voice/lock", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as { voices?: Array<{ id: string; voiceId: string }> };
    const season = await prisma.cinemaSeason.findUnique({ where: { id } });
    if (!season) return reply.code(404).send({ error: "not found" });
    const bible = asBible(season.bibleJson);

    for (const c of bible.characters) {
      const override = body.voices?.find((v) => v.id === c.id);
      c.voiceId = override?.voiceId || c.voiceId || DEFAULT_VOICES[c.id] || DEFAULT_VOICES.char_amara;
      if (!c.faceUrl) c.faceUrl = CAST_FACE_PRESETS[c.id];
      c.locked = Boolean(c.faceUrl && c.voiceId);
    }

    if (season.projectId) {
      for (const c of bible.characters) {
        if (!c.voiceId) continue;
        const existing = await prisma.voiceProfile.findFirst({
          where: { projectId: season.projectId, name: c.name },
        });
        if (existing) {
          await prisma.voiceProfile.update({
            where: { id: existing.id },
            data: { providerVoiceId: c.voiceId, status: "ready" },
          });
        } else {
          await prisma.voiceProfile.create({
            data: {
              projectId: season.projectId,
              name: c.name,
              provider: "cinema",
              providerVoiceId: c.voiceId,
              status: "ready",
            },
          });
        }
      }
    }

    const updated = await saveBible(id, bible);
    return {
      season: updated,
      bible,
      progress: cinemaProgress(bible),
      continuity: continuityReport(bible),
    };
  });

  /** Approve one or all board stills — hard gate before shoot */
  app.post("/api/cinema/seasons/:id/board/approve", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as { stillId?: string; all?: boolean };
    const season = await prisma.cinemaSeason.findUnique({ where: { id } });
    if (!season) return reply.code(404).send({ error: "not found" });
    const bible = asBible(season.bibleJson);
    const ep = bible.episodes[0];
    if (!ep) return reply.code(400).send({ error: "no episode" });

    if (body.all) {
      for (const s of ep.stills) s.approved = true;
      ep.status = "approved";
    } else if (body.stillId) {
      const s = ep.stills.find((x) => x.id === body.stillId);
      if (!s) return reply.code(404).send({ error: "still not found" });
      s.approved = true;
      if (ep.stills.every((x) => x.approved)) ep.status = "approved";
      else ep.status = "boarded";
    } else {
      return reply.code(400).send({ error: "stillId or all required" });
    }

    if (season.projectId) {
      await prisma.storyboardFrame.updateMany({
        where: { projectId: season.projectId },
        data: { approved: true },
      });
    }

    const updated = await saveBible(id, bible, { status: "boarded" });
    return {
      season: updated,
      bible,
      progress: cinemaProgress(bible),
      continuity: continuityReport(bible),
      rtcRequiredToShoot: cinemaShootRtc(ep.stills.length),
    };
  });

  /** Shoot episode — approve gate + RTC enforced */
  app.post("/api/cinema/seasons/:id/shoot", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as {
      episodeIndex?: number;
      /** faster first test: heygen only first dialogue shot */
      quick?: boolean;
      engine?: "auto" | "heygen" | "seedance" | "kenburns";
      skipRtc?: boolean;
    };
    const season = await prisma.cinemaSeason.findUnique({ where: { id } });
    if (!season) return reply.code(404).send({ error: "not found" });
    const bible = asBible(season.bibleJson);

    let ep;
    try {
      ep = assertBoardApproved(bible, body.episodeIndex || 1);
    } catch (e) {
      return reply.code(402).send({
        error: e instanceof Error ? e.message : "Board not approved",
        code: "APPROVE_BEFORE_SPEND",
      });
    }

    const cont = continuityReport(bible, ep.index);
    if (!cont.pass && cont.issues.some((i) => i.startsWith("cast:") || i.startsWith("voice:") || i.startsWith("world:"))) {
      return reply.code(402).send({
        error: "Lock Cast · World · Voice before shoot",
        code: "CONTINUITY_LOCK",
        continuity: cont,
      });
    }

    const rtcCost = cinemaShootRtc(ep.stills.length);
    if (!body.skipRtc) {
      try {
        const user = await prisma.user.findUniqueOrThrow({ where: { id: season.userId } });
        const wallet = await ensureUserWallet(user.id, user.tier as "free");
        if (wallet.balanceRtc < rtcCost) {
          return reply.code(402).send({
            error: `Need ${rtcCost} RTC to shoot (have ${wallet.balanceRtc})`,
            code: "INSUFFICIENT_RTC",
            rtcCost,
            balance: wallet.balanceRtc,
          });
        }
        await debitRtc({
          walletId: wallet.id,
          amount: rtcCost,
          type: "DEBIT_CINEMA_SHOOT",
          note: `Cinema shoot ${bible.title} · ${ep.stills.length} shots`,
          refType: "cinema_season",
          refId: id,
        });
      } catch (e) {
        return reply.code(402).send({
          error: e instanceof Error ? e.message : "RTC debit failed",
          code: "RTC_ERROR",
        });
      }
    }

    ep.status = "shooting";
    await saveBible(id, bible, { status: "shooting" });

    const enginePref =
      body.engine ||
      (heygenCircuitOpen || process.env.CINEMA_SKIP_HEYGEN === "1" ? "kenburns" : "auto");
    const work = path.join(tmpdir(), `cinema-shoot-${id}-${Date.now()}`);
    await mkdir(work, { recursive: true });

    let heygenUsed = 0;
    for (const still of ep.stills) {
      const clip = ep.clips.find((c) => c.stillId === still.id) || {
        stillId: still.id,
        status: "pending" as const,
      };
      if (!ep.clips.find((c) => c.stillId === still.id)) ep.clips.push(clip);
      clip.status = "rendering";

      try {
        const char = bible.characters.find((c) => c.id === still.characterId);
        const useHeygen =
          !heygenCircuitOpen &&
          enginePref !== "kenburns" &&
          enginePref !== "seedance" &&
          (enginePref === "heygen" || enginePref === "auto") &&
          Boolean(process.env.HEYGEN_API_KEY) &&
          process.env.CINEMA_SKIP_HEYGEN !== "1" &&
          Boolean(still.dialogue) &&
          Boolean(char?.faceUrl) &&
          (!body.quick || heygenUsed < 1);

        let rendered = false;
        if (useHeygen && char?.faceUrl && still.dialogue) {
          try {
            const out = await renderHeygenClip({
              imageUrl: char.faceUrl,
              script: still.dialogue,
              title: `${bible.title} ${still.id}`,
              userId: season.userId,
              seasonId: id,
              stillId: still.id,
            });
            clip.videoUrl = out.videoUrl;
            clip.engine = out.engine;
            clip.status = "ready";
            heygenUsed += 1;
            rendered = true;
          } catch (heyErr) {
            noteHeygenFailure(heyErr);
            clip.error = `heygen→fallback: ${heyErr instanceof Error ? heyErr.message : String(heyErr)}`;
          }
        }
        if (
          !rendered &&
          (enginePref === "seedance" || enginePref === "auto") &&
          (process.env.SEEDANCE_API_KEY || process.env.DASHSCOPE_API_KEY) &&
          still.stillUrl &&
          !still.stillUrl.endsWith(".svg") &&
          !still.stillUrl.includes("image/svg")
        ) {
          const gen = await generateWithSeedance({
            prompt: still.prompt,
            firstFrameUrl: still.stillUrl,
            durationSec: Math.min(8, still.durationSec || 5),
            aspectRatio: "9:16",
            soulIdRef: char?.id,
            roomRef: still.worldId,
          });
          if (gen.status === "succeeded" && gen.videoUrl) {
            clip.videoUrl = gen.videoUrl;
            clip.engine = "seedance-i2v";
            clip.status = "ready";
            rendered = true;
          }
        }
        if (!rendered) {
          const outPath = path.join(work, `${still.id}.mp4`);
          const src = still.stillUrl || char?.faceUrl;
          if (!src) throw new Error(`No still for ${still.id}`);
          let imageUrl = src;
          if (src.includes(".svg") || src.includes("image/svg")) {
            imageUrl = char?.faceUrl || CAST_FACE_PRESETS.char_amara;
          }
          await kenBurnsFromImage({
            imageUrl,
            durationSec: still.durationSec || 4,
            outPath,
          });
          const buf = await readFile(outPath);
          const r2Key = `cinema/${season.userId}/${id}/${still.id}_kb.mp4`;
          try {
            await uploadBuffer(r2Key, buf, "video/mp4");
            clip.videoUrl = publicUrl(r2Key);
          } catch {
            const dir = path.join(process.cwd(), "tmp", "cinema");
            await mkdir(dir, { recursive: true });
            const file = path.join(dir, `${still.id}_kb.mp4`);
            await writeFile(file, buf);
            clip.videoUrl = `http://127.0.0.1:${process.env.PORT || 4000}/media/cinema/${path.basename(file)}`;
          }
          clip.engine = clip.error ? "kenburns-fallback" : "kenburns";
          clip.status = "ready";
        }
        clip.qc = runClipContinuityQc({
          still,
          clip,
          faceUrl: char?.faceUrl,
        });
      } catch (e) {
        clip.status = "failed";
        clip.error = e instanceof Error ? e.message : String(e);
        clip.qc = { pass: false, notes: clip.error };
      }
    }

    const ready = ep.clips.filter((c) => c.status === "ready").length;
    const qcPass = ep.clips.filter((c) => c.qc?.pass).length;
    ep.status = ready === ep.clips.length ? "cut" : "shooting";
    const updated = await saveBible(id, bible, { status: "shooting" });
    return {
      season: updated,
      bible,
      progress: cinemaProgress(bible),
      continuity: continuityReport(bible),
      shotSummary: {
        ready,
        total: ep.clips.length,
        heygenUsed,
        qcPass,
        rtcCharged: body.skipRtc ? 0 : rtcCost,
        enginePref,
        heygenCircuitOpen,
      },
    };
  });

  /** Cut / assemble master episode */
  app.post("/api/cinema/seasons/:id/cut", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as { skipRtc?: boolean };
    const season = await prisma.cinemaSeason.findUnique({ where: { id } });
    if (!season) return reply.code(404).send({ error: "not found" });
    const bible = asBible(season.bibleJson);
    const ep = bible.episodes[0];
    if (!ep) return reply.code(400).send({ error: "no episode" });

    const readyClips = ep.clips.filter((c) => c.status === "ready" && c.videoUrl);
    if (!readyClips.length) return reply.code(400).send({ error: "No ready clips — shoot first" });

    if (!body.skipRtc) {
      try {
        const user = await prisma.user.findUniqueOrThrow({ where: { id: season.userId } });
        const wallet = await ensureUserWallet(user.id, user.tier as "free");
        if (wallet.balanceRtc < CINEMA_RTC.cutMaster) {
          return reply.code(402).send({
            error: `Need ${CINEMA_RTC.cutMaster} RTC to cut (have ${wallet.balanceRtc})`,
            code: "INSUFFICIENT_RTC",
          });
        }
        await debitRtc({
          walletId: wallet.id,
          amount: CINEMA_RTC.cutMaster,
          type: "DEBIT_CINEMA_CUT",
          note: `Cinema cut ${bible.title}`,
          refType: "cinema_season",
          refId: id,
        });
      } catch (e) {
        return reply.code(402).send({
          error: e instanceof Error ? e.message : "RTC debit failed",
          code: "RTC_ERROR",
        });
      }
    }

    const work = path.join(tmpdir(), `cinema-cut-${id}-${Date.now()}`);
    await mkdir(work, { recursive: true });
    const localPaths: string[] = [];

    for (const clip of readyClips) {
      const url = clip.videoUrl!;
      const dest = path.join(work, `${clip.stillId}.mp4`);
      if (url.startsWith("file://")) {
        await writeFile(dest, await readFile(url.replace("file://", "")));
      } else if (url.includes("/media/cinema/")) {
        const name = path.basename(url.split("?")[0]);
        await writeFile(dest, await readFile(path.join(process.cwd(), "tmp", "cinema", name)));
      } else {
        const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
        if (!res.ok) throw new Error(`download clip ${clip.stillId} ${res.status}`);
        await writeFile(dest, Buffer.from(await res.arrayBuffer()));
      }
      localPaths.push(dest);
    }

    const outPath = path.join(work, "master.mp4");
    await concatClips(localPaths, outPath);
    const buf = await readFile(outPath);
    const r2Key = `cinema/${season.userId}/${id}/ep1_master_${createHash("sha1").update(buf).digest("hex").slice(0, 8)}.mp4`;

    let masterUrl: string;
    try {
      await uploadBuffer(r2Key, buf, "video/mp4");
      masterUrl = publicUrl(r2Key);
    } catch {
      const dir = path.join(process.cwd(), "tmp", "cinema");
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, `ep1_master_${id.slice(0, 8)}.mp4`);
      await writeFile(file, buf);
      masterUrl = `http://127.0.0.1:${process.env.PORT || 4000}/media/cinema/${path.basename(file)}`;
    }

    ep.masterUrl = masterUrl;
    ep.status = "shipped";
    // cliffhanger note baked into bible for UI
    const updated = await saveBible(id, bible, { status: "shipped", masterUrl });

    if (season.projectId) {
      await prisma.project.update({
        where: { id: season.projectId },
        data: { status: "MERGED", script: `${bible.logline}\n\nCliffhanger: ${ep.cliffhanger}` },
      });
      await prisma.masterCut
        .create({
          data: {
            projectId: season.projectId,
            title: `${bible.title} · Ep1`,
            blockIds: [],
            s3Key: r2Key,
            durationSec: ep.stills.reduce((a, s) => a + (s.durationSec || 4), 0),
          },
        })
        .catch(() => null);
    }

    return {
      season: updated,
      bible,
      progress: cinemaProgress(bible),
      masterUrl,
      cliffhanger: ep.cliffhanger,
      bytes: buf.length,
    };
  });

  /** One-shot pilot: create → lock all → approve → shoot → cut */
  app.post("/api/cinema/pilot", async (req, reply) => {
    const body = (req.body || {}) as {
      spineId?: string;
      title?: string;
      quick?: boolean;
      ownerEmail?: string;
    };
    const user = await resolveUser(req, body.ownerEmail);

    const bible = buildPilotSeason({
      spineId: body.spineId || "revenge",
      title: body.title || "Night of Proof",
    });
    const project = await prisma.project.create({
      data: {
        title: bible.title,
        logline: bible.logline,
        script: bible.episodes[0]?.synopsis,
        status: "DRAFT",
        ownerId: user.id,
      },
    });
    let season = await prisma.cinemaSeason.create({
      data: {
        userId: user.id,
        projectId: project.id,
        title: bible.title,
        spine: String(bible.spine),
        status: "draft",
        bibleJson: bible as object,
      },
    });

    for (const c of bible.characters) {
      c.faceUrl = CAST_FACE_PRESETS[c.id];
      c.voiceId = DEFAULT_VOICES[c.id] || DEFAULT_VOICES.char_amara;
      c.locked = true;
    }
    for (const w of bible.worlds) {
      const svg = stillSvg(
        {
          id: w.id,
          episodeIndex: 1,
          shotIndex: 0,
          prompt: w.description,
          framing: "wide",
          durationSec: 4,
          approved: false,
        },
        w.name,
        w.description.slice(0, 40),
      );
      w.plateUrl = await uploadSvgOrData(`cinema/${user.id}/${season.id}/world_${w.id}.svg`, svg);
      w.locked = true;
    }
    const ep = bible.episodes[0]!;
    for (const s of ep.stills) {
      const char = bible.characters.find((c) => c.id === s.characterId);
      s.stillUrl = char?.faceUrl || CAST_FACE_PRESETS.char_amara;
      s.approved = true;
    }
    ep.status = "approved";
    season = await saveBible(season.id, bible, { status: "boarded" });

    // Ensure wallet can pay RTC (pilot path meters for real)
    const wallet = await ensureUserWallet(user.id, user.tier as "storm_pro");
    if (wallet.balanceRtc < 10) {
      await prisma.rtcWallet.update({
        where: { id: wallet.id },
        data: { balanceRtc: 25 },
      });
    }

    const shootRes = await app.inject({
      method: "POST",
      url: `/api/cinema/seasons/${season.id}/shoot`,
      payload: {
        quick: false,
        engine: heygenCircuitOpen ? "kenburns" : body.quick === false ? "auto" : "kenburns",
      },
    });
    if (shootRes.statusCode >= 400) {
      return reply.code(shootRes.statusCode).send(shootRes.json());
    }
    const cutRes = await app.inject({
      method: "POST",
      url: `/api/cinema/seasons/${season.id}/cut`,
      payload: {},
    });
    if (cutRes.statusCode >= 400) {
      return reply.code(cutRes.statusCode).send({
        error: "Cut failed after shoot",
        shoot: shootRes.json(),
        cut: cutRes.json(),
      });
    }

    return {
      ok: true,
      pilot: "Night of Proof · Ep1",
      seasonId: season.id,
      projectId: project.id,
      shoot: shootRes.json(),
      cut: cutRes.json(),
      tip: "Open /cinema to review Cast · World · Voice · Cut",
    };
  });
}
