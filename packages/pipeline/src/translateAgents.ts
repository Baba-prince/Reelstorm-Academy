/**
 * Language Studio — DOWNLOAD → TRANSCRIBE → TRANSLATE → TTS → LIPSYNC → MUX
 */
import { spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { prisma, type TranslationStatus } from "@reelstorm/db";
import {
  downloadReferenceVideo,
  classifyVideoUrl,
  uploadFile,
  uploadBuffer,
  publicUrl,
  probeVideo,
  ensurePodAliveOrFallback,
  getPodStatus,
  wakePod,
  markGpuJobActivity,
  resolveFfmpeg,
} from "@reelstorm/media";
import { orchestrate } from "@reelstorm/providers";
import {
  TRANSLATE_LANG_META,
  TRANSLATE_RTC_PER_LANG,
  TRANSLATE_SEED_TRANSCRIPT,
  TRANSLATE_SEED_TRANSLATIONS,
  translateRtcCost,
  classifyTranslateSource,
} from "@reelstorm/domain";

type Segment = { start: number; end: number; text: string };
type Transcript = { text: string; language: string; segments: Segment[]; engine?: string };

const MMS_LANGS = new Set(["yo", "ha", "ig", "de"]);

function run(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    proc.on("error", (err) => resolve({ code: 1, stdout, stderr: err.message }));
  });
}

/** Resolve tools/lang-studio Python venv (VPS) or python3 fallback */
async function langStudioPython(): Promise<{ python: string; root: string } | null> {
  const candidates = [
    process.env.LANG_STUDIO_ROOT,
    path.resolve(process.cwd(), "tools/lang-studio"),
    path.resolve(process.cwd(), "../../tools/lang-studio"),
    "/opt/reelstorm-os/tools/lang-studio",
  ].filter(Boolean) as string[];

  // When running from packages/pipeline dist
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(path.resolve(here, "../../../tools/lang-studio"));
  } catch {
    /* ignore */
  }

  for (const root of candidates) {
    const venvPy = path.join(root, ".venv", "bin", "python");
    try {
      await access(venvPy);
      return { python: venvPy, root };
    } catch {
      /* try next */
    }
  }
  return null;
}

async function appendLog(jobId: string, line: string) {
  const job = await prisma.translationJob.findUnique({ where: { id: jobId }, select: { logs: true } });
  const logs = Array.isArray(job?.logs) ? [...(job!.logs as string[])] : [];
  logs.push(`[${new Date().toISOString()}] ${line}`);
  await prisma.translationJob.update({
    where: { id: jobId },
    data: { logs: logs.slice(-80) },
  });
}

async function setStatus(jobId: string, status: TranslationStatus, patch: Record<string, unknown> = {}) {
  return prisma.translationJob.update({
    where: { id: jobId },
    data: { status, ...patch },
  });
}

async function failJob(jobId: string, error: string) {
  await appendLog(jobId, `FAILED: ${error}`);
  return setStatus(jobId, "FAILED", { error });
}

/** Local Whisper (tools/lang-studio venv) — real speech, not seed */
async function whisperLocal(localPath: string): Promise<Transcript | null> {
  const studio = await langStudioPython();
  if (!studio) return null;
  const ffmpeg = await resolveFfmpeg();
  const work = path.join(tmpdir(), `rs-whisper-${Date.now()}`);
  await mkdir(work, { recursive: true });
  const wav = path.join(work, "audio.wav");
  const outJson = path.join(work, "transcript.json");
  try {
    const extract = await run(ffmpeg, [
      "-y",
      "-i",
      localPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      wav,
    ]);
    if (extract.code !== 0) return null;

    const model = process.env.WHISPER_LOCAL_MODEL || "base";
    const script = path.join(studio.root, "whisper_transcribe.py");
    const res = await run(studio.python, [
      script,
      "--audio",
      wav,
      "--model",
      model,
      "--language",
      "en",
      "--out",
      outJson,
    ]);
    if (res.code !== 0) return null;
    const parsed = JSON.parse(await readFile(outJson, "utf8")) as Transcript;
    if (!parsed.text?.trim()) return null;
    return {
      text: parsed.text.trim(),
      language: parsed.language || "en",
      segments: Array.isArray(parsed.segments) ? parsed.segments : [],
      engine: parsed.engine || `whisper-local-${model}`,
    };
  } catch {
    return null;
  } finally {
    await unlink(wav).catch(() => undefined);
    await unlink(outJson).catch(() => undefined);
  }
}

/** Try pod /transcribe → local Whisper → seed (last resort only) */
async function whisperOrFallback(localPath: string, durationSec: number): Promise<Transcript> {
  const engine = await ensurePodAliveOrFallback();
  const saverBase = (process.env.RUNPOD_SAVER_URL || "").replace(/\/generate\/?$/, "");
  if (engine === "pod" && saverBase) {
    try {
      const buf = await readFile(localPath);
      const b64 = buf.toString("base64");
      const res = await fetch(`${saverBase}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_b64: b64.slice(0, 4_000_000),
          model: process.env.WHISPER_MODEL || "large-v3",
          language: "en",
        }),
        signal: AbortSignal.timeout(180_000),
      });
      if (res.ok) {
        const j = (await res.json()) as {
          text?: string;
          segments?: Segment[];
          language?: string;
        };
        if (j.text && j.segments?.length) {
          markGpuJobActivity();
          return {
            text: j.text,
            language: j.language || "en",
            segments: j.segments,
            engine: "whisper-pod",
          };
        }
      }
    } catch {
      /* soft-fail → local */
    }
  }

  const local = await whisperLocal(localPath);
  if (local) return local;

  // Scale seed segments to video duration — ONLY when STT unavailable
  const seed = TRANSLATE_SEED_TRANSCRIPT;
  const last = seed.segments[seed.segments.length - 1]?.end || 12;
  const scale = Math.max(1, durationSec / last);
  return {
    text: seed.text,
    language: "en",
    engine: "soft-launch-seed",
    segments: seed.segments.map((s) => ({
      start: Number((s.start * scale).toFixed(2)),
      end: Number((s.end * scale).toFixed(2)),
      text: s.text,
    })),
  };
}

async function translatePlainChunk(lang: string, label: string, english: string): Promise<string> {
  const raw = await orchestrate(
    [
      {
        role: "system",
        content: `You are a professional dubbing translator into ${label}. Reply with ONLY the ${label} translation — no quotes, no English, no commentary.`,
      },
      {
        role: "user",
        content: english,
      },
    ],
    {
      json: false,
      timeoutMs: 90_000,
      model: process.env.OLLAMA_MODEL || process.env.TRANSLATE_LLM_MODEL || "qwen2.5:1.5b",
    },
  );
  return raw
    .replace(/^```[\w]*\s*|\s*```$/g, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

async function translateLang(
  lang: string,
  transcript: Transcript,
): Promise<{ text: string; segments: Segment[]; engine: string }> {
  const meta = TRANSLATE_LANG_META[lang];
  const label = meta?.label || lang;
  const segs = transcript.segments?.length
    ? transcript.segments
    : [{ start: 0, end: 12, text: transcript.text }];

  // Chunk by segments so small local models (qwen2.5:1.5b) don't time out / drop JSON
  try {
    const outSegs: Segment[] = [];
    const batchSize = 6;
    for (let i = 0; i < segs.length; i += batchSize) {
      const batch = segs.slice(i, i + batchSize);
      const joined = batch.map((s, idx) => `${idx + 1}. ${s.text}`).join("\n");
      const translated = await translatePlainChunk(
        lang,
        label,
        `Translate each numbered line to ${label}. Keep the same numbering.\n\n${joined}`,
      );
      const lines = translated
        .split(/\n+/)
        .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
        .filter(Boolean);
      batch.forEach((s, idx) => {
        outSegs.push({
          start: s.start,
          end: s.end,
          text: lines[idx] || lines[0] || s.text,
        });
      });
    }
    const text = outSegs.map((s) => s.text).join(" ").trim();
    if (text && text !== transcript.text) {
      return { text, segments: outSegs, engine: "llm-chunked" };
    }
  } catch {
    /* try whole-text */
  }

  try {
    const whole = await translatePlainChunk(lang, label, transcript.text.slice(0, 6000));
    if (whole && whole.length > 20) {
      const scale = segs.length || 1;
      const parts = whole.split(/(?<=[.!?。])\s+/).filter(Boolean);
      const segments = segs.map((s, i) => ({
        start: s.start,
        end: s.end,
        text: parts[i] || parts[Math.min(i, parts.length - 1)] || whole,
      }));
      return { text: whole, segments, engine: "llm-plain" };
    }
  } catch {
    /* fall through */
  }

  // Seed ONLY when STT itself was seed (demo path). Never dub wrong script over a real reel.
  const usedSeedStt = (transcript.engine || "").includes("seed");
  const seed = TRANSLATE_SEED_TRANSLATIONS[lang];
  if (usedSeedStt && seed) {
    const last = segs[segs.length - 1]?.end || 12;
    const seedLast = seed.segments[seed.segments.length - 1]?.end || 12;
    const scale = last / seedLast;
    return {
      text: seed.text,
      engine: "seed",
      segments: seed.segments.map((s) => ({
        start: Number((s.start * scale).toFixed(2)),
        end: Number((s.end * scale).toFixed(2)),
        text: s.text,
      })),
    };
  }

  throw new Error(
    `Translate → ${lang} failed (Ollama/DashScope). Set OLLAMA_MODEL=qwen2.5:1.5b or DASHSCOPE_API_KEY. Refusing seed dub over real transcript.`,
  );
}

/** Meta MMS-TTS (yo/ha/ig/de) via tools/lang-studio — real voice, no beep */
async function synthesizeMmsTts(
  jobId: string,
  lang: string,
  text: string,
): Promise<{ url: string; key: string; engine: string } | null> {
  if (!MMS_LANGS.has(lang)) return null;
  const studio = await langStudioPython();
  if (!studio) return null;

  const key = `translated/tts/${jobId}_${lang}.mp3`;
  const work = path.join(tmpdir(), `rs-mms-${jobId}-${lang}`);
  await mkdir(work, { recursive: true });
  const wav = path.join(work, "voice.wav");
  const mp3 = path.join(work, "voice.mp3");
  const script = path.join(studio.root, "mms_tts.py");
  const ffmpeg = await resolveFfmpeg();

  try {
    const tts = await run(studio.python, [
      script,
      "--lang",
      lang,
      "--text",
      text.slice(0, 8000),
      "--out",
      wav,
    ]);
    if (tts.code !== 0) {
      await appendLog(jobId, `MMS-TTS ${lang} failed: ${(tts.stderr || tts.stdout).slice(0, 240)}`);
      return null;
    }
    const enc = await run(ffmpeg, ["-y", "-i", wav, "-q:a", "4", "-acodec", "libmp3lame", mp3]);
    if (enc.code !== 0) return null;
    await uploadFile(key, mp3, "audio/mpeg");
    return { url: publicUrl(key), key, engine: `mms-tts-${lang}` };
  } catch (e) {
    await appendLog(jobId, `MMS-TTS ${lang} error: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  } finally {
    await unlink(wav).catch(() => undefined);
    await unlink(mp3).catch(() => undefined);
  }
}

/** ElevenLabs (DE / supported langs) → MMS (yo/ha/ig/de) — never ship a silent sine beep */
async function synthesizeTts(
  jobId: string,
  lang: string,
  text: string,
  _durationSec: number,
): Promise<{ url: string; key: string; engine: string }> {
  const key = `translated/tts/${jobId}_${lang}.mp3`;
  const elevenKey = (process.env.ELEVENLABS_API_KEY || "").trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const spoken = (text || "").trim();
  if (!spoken) {
    throw new Error(`TTS ${lang}: empty translation text — cannot synthesize voice`);
  }

  // ElevenLabs does not support Yoruba/Hausa/Igbo — skip for those langs
  const elevenOkLang = !["yo", "ha", "ig"].includes(lang);
  if (elevenKey && elevenOkLang) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": elevenKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: spoken.slice(0, 2500),
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.45, similarity_boost: 0.75 },
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        await uploadBuffer(key, buf, "audio/mpeg");
        return { url: publicUrl(key), key, engine: "elevenlabs" };
      }
      await appendLog(jobId, `ElevenLabs ${lang} HTTP ${res.status} — trying MMS`);
    } catch (e) {
      await appendLog(
        jobId,
        `ElevenLabs ${lang} error: ${e instanceof Error ? e.message : String(e)} — trying MMS`,
      );
    }
  }

  const mms = await synthesizeMmsTts(jobId, lang, spoken);
  if (mms) return mms;

  // Google Translate TTS for Hausa/German when MMS unavailable
  if (lang === "ha" || lang === "de") {
    const ggl = await synthesizeGoogleTts(jobId, lang, spoken, key);
    if (ggl) return ggl;
  }

  throw new Error(
    `TTS ${lang} failed — set ELEVENLABS_API_KEY (de) or install tools/lang-studio MMS-TTS (yo/ha/ig). Refusing beep/source-echo.`,
  );
}

/** Chunked Google translate_tts (ha/de). Yoruba/Igbo return 400 — use MMS. */
async function synthesizeGoogleTts(
  jobId: string,
  lang: string,
  text: string,
  key: string,
): Promise<{ url: string; key: string; engine: string } | null> {
  const ffmpeg = await resolveFfmpeg();
  const work = path.join(tmpdir(), `rs-ggl-${jobId}-${lang}`);
  await mkdir(work, { recursive: true });
  const chunks = text.match(/.{1,160}(?:\s|$)/g) || [text.slice(0, 160)];
  const parts: string[] = [];
  try {
    for (let i = 0; i < Math.min(chunks.length, 40); i++) {
      const q = encodeURIComponent(chunks[i]!.trim());
      if (!q) continue;
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${q}&tl=${lang}&client=tw-ob`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ReelStorm/1.0)" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) continue;
      const part = path.join(work, `p${i}.mp3`);
      await writeFile(part, Buffer.from(await res.arrayBuffer()));
      parts.push(part);
    }
    if (!parts.length) return null;
    const list = path.join(work, "list.txt");
    await writeFile(list, parts.map((p) => `file '${p}'`).join("\n"));
    const out = path.join(work, "voice.mp3");
    const cat = await run(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", out]);
    if (cat.code !== 0) return null;
    await uploadFile(key, out, "audio/mpeg");
    return { url: publicUrl(key), key, engine: `google-tts-${lang}` };
  } catch (e) {
    await appendLog(jobId, `Google TTS ${lang}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** Lip-sync via pod /lipsync or ffmpeg audio replace (body preserved from source video) */
async function lipsyncLang(
  jobId: string,
  lang: string,
  sourceLocal: string,
  ttsUrl: string,
  durationSec: number,
): Promise<{ r2Url: string; key: string; lipSync: boolean; bodySync: boolean; engine: string }> {
  const outKey = `translated/${jobId}_${lang}.mp4`;
  const engine = await ensurePodAliveOrFallback();
  const saverBase = (process.env.RUNPOD_SAVER_URL || "").replace(/\/generate\/?$/, "");

  if (engine === "pod" && saverBase) {
    try {
      const res = await fetch(`${saverBase}/lipsync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: publicUrl(`translated/source/${jobId}.mp4`),
          audio_url: ttsUrl,
          lang,
          liveportrait: true,
          wav2lip: true,
        }),
        signal: AbortSignal.timeout(600_000),
      });
      if (res.ok) {
        const j = (await res.json()) as { r2_url?: string; key?: string };
        if (j.r2_url) {
          markGpuJobActivity();
          return {
            r2Url: j.r2_url,
            key: j.key || outKey,
            lipSync: true,
            bodySync: true,
            engine: "wav2lip+liveportrait",
          };
        }
      }
    } catch {
      /* mux fallback */
    }
  }

  // Preserve video (body motion) + replace audio track = soft body-sync path
  // NEVER source-copy (that echoes the original English / source voice).
  const ffmpeg = await resolveFfmpeg();
  const work = path.join(tmpdir(), `rs-ls-${jobId}-${lang}`);
  await mkdir(work, { recursive: true });
  const audioPath = path.join(work, "voice.mp3");
  const paddedPath = path.join(work, "voice_pad.m4a");
  const outPath = path.join(work, "out.mp4");

  const aRes = await fetch(ttsUrl);
  if (!aRes.ok) {
    throw new Error(`Lip-sync ${lang}: TTS fetch failed HTTP ${aRes.status}`);
  }
  await writeFile(audioPath, Buffer.from(await aRes.arrayBuffer()));

  const dur = Math.max(2, Math.ceil(durationSec || 12));
  // Pad/trim TTS to picture length so we don't leave original audio or cut mid-scene oddly
  const pad = await run(ffmpeg, [
    "-y",
    "-i",
    audioPath,
    "-af",
    `apad=whole_dur=${dur}`,
    "-t",
    String(dur),
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    paddedPath,
  ]);
  const audioForMux = pad.code === 0 ? paddedPath : audioPath;

  const mux = await run(ffmpeg, [
    "-y",
    "-i",
    sourceLocal,
    "-i",
    audioForMux,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-shortest",
    "-movflags",
    "+faststart",
    outPath,
  ]);

  if (mux.code !== 0) {
    throw new Error(`Lip-sync ${lang}: ffmpeg mux failed — ${(mux.stderr || "").slice(-300)}`);
  }

  await uploadFile(outKey, outPath, "video/mp4");
  return {
    r2Url: publicUrl(outKey),
    key: outKey,
    lipSync: false,
    bodySync: true,
    engine: "ffmpeg-audio-replace",
  };
}

function segmentsToVtt(segments: Segment[], lang: string): string {
  const lines = ["WEBVTT", `Language: ${lang}`, ""];
  segments.forEach((s, i) => {
    const fmt = (t: number) => {
      const h = Math.floor(t / 3600);
      const m = Math.floor((t % 3600) / 60);
      const sec = t % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${sec.toFixed(3).padStart(6, "0")}`;
    };
    lines.push(String(i + 1));
    lines.push(`${fmt(s.start)} --> ${fmt(s.end)}`);
    lines.push(s.text);
    lines.push("");
  });
  return lines.join("\n");
}

export async function stepDownload(jobId: string): Promise<{ sourceR2Url: string }> {
  const job = await prisma.translationJob.findUniqueOrThrow({ where: { id: jobId } });
  await setStatus(jobId, "DOWNLOADING");
  await appendLog(jobId, `Download start — ${job.sourceType} ${job.sourceUrl || "(upload)"}`);

  const work = path.join(process.env.UPLOAD_TMP_DIR || "./tmp/uploads", "translate", jobId);
  await mkdir(work, { recursive: true });
  let localPath = "";

  if (job.sourceType === "UPLOAD" && job.sourceR2Key) {
    // Already uploaded — download from R2 public URL if present
    if (job.sourceR2Url) {
      const res = await fetch(job.sourceR2Url);
      if (!res.ok) throw new Error(`Source fetch failed ${res.status}`);
      localPath = path.join(work, "source.mp4");
      await writeFile(localPath, Buffer.from(await res.arrayBuffer()));
    } else {
      throw new Error("Upload job missing sourceR2Url");
    }
  } else {
    const kind = classifyVideoUrl(job.sourceUrl);
    await appendLog(jobId, `yt-dlp classify=${kind}`);
    const dl = await downloadReferenceVideo(job.sourceUrl, work);
    localPath = dl.localPath;
    await appendLog(jobId, `Downloaded “${dl.title}”`);
  }

  const key = `translated/source/${jobId}.mp4`;
  await uploadFile(key, localPath, "video/mp4");
  const sourceR2Url = publicUrl(key);
  await setStatus(jobId, "TRANSCRIBING", {
    sourceR2Url,
    sourceR2Key: key,
  });
  await appendLog(jobId, `R2 source ${sourceR2Url}`);
  return { sourceR2Url };
}

export async function stepTranscribe(jobId: string): Promise<{ transcriptOriginal: Transcript }> {
  const job = await prisma.translationJob.findUniqueOrThrow({ where: { id: jobId } });
  await setStatus(jobId, "TRANSCRIBING");
  await appendLog(jobId, "Whisper / soft-launch transcript…");

  const work = path.join(process.env.UPLOAD_TMP_DIR || "./tmp/uploads", "translate", jobId);
  await mkdir(work, { recursive: true });
  let localPath = path.join(work, "source.mp4");

  // Prefer local copy; else re-fetch from R2
  try {
    await readFile(localPath);
  } catch {
    if (!job.sourceR2Url) throw new Error("No source video for transcribe");
    const res = await fetch(job.sourceR2Url);
    if (!res.ok) throw new Error(`Fetch source for STT failed ${res.status}`);
    await writeFile(localPath, Buffer.from(await res.arrayBuffer()));
  }

  let durationSec = 12;
  try {
    const probe = await probeVideo(localPath);
    durationSec = probe.durationSec || 12;
  } catch {
    /* default */
  }

  const transcript = await whisperOrFallback(localPath, durationSec);
  await setStatus(jobId, "TRANSLATING", { transcriptOriginal: transcript as object });
  await appendLog(jobId, `Transcript engine=${transcript.engine} chars=${transcript.text.length}`);
  return { transcriptOriginal: transcript };
}

export async function stepTranslate(jobId: string): Promise<{ translations: Record<string, unknown> }> {
  const job = await prisma.translationJob.findUniqueOrThrow({ where: { id: jobId } });
  await setStatus(jobId, "TRANSLATING");
  const transcript = (job.transcriptOriginal || TRANSLATE_SEED_TRANSCRIPT) as Transcript;
  const langs = job.targetLangs?.length ? job.targetLangs : ["de", "yo", "ha", "ig"];
  const translations: Record<string, unknown> = {};

  for (const lang of langs) {
    await appendLog(jobId, `Translate → ${lang}`);
    translations[lang] = await translateLang(lang, transcript);
  }

  await setStatus(jobId, "TTS", { translations: translations as object });
  return { translations };
}

export async function stepTts(jobId: string): Promise<{ ttsUrls: Record<string, unknown> }> {
  const job = await prisma.translationJob.findUniqueOrThrow({ where: { id: jobId } });
  await setStatus(jobId, "TTS");
  const translations = (job.translations || {}) as Record<
    string,
    { text: string; segments: Segment[] }
  >;
  const langs = job.targetLangs?.length ? job.targetLangs : Object.keys(translations);
  const ttsUrls: Record<string, unknown> = {};

  let durationSec = 12;
  const segs = (job.transcriptOriginal as Transcript | null)?.segments;
  if (segs?.length) durationSec = segs[segs.length - 1]!.end;

  for (const lang of langs) {
    const pack = translations[lang];
    const text = pack?.text || TRANSLATE_SEED_TRANSLATIONS[lang]?.text || "…";
    await appendLog(jobId, `TTS → ${lang}`);
    ttsUrls[lang] = await synthesizeTts(jobId, lang, text, durationSec);
  }

  await setStatus(jobId, "LIPSYNC", { ttsUrls: ttsUrls as object });
  return { ttsUrls };
}

export async function stepLipsync(jobId: string): Promise<{ finalVideos: Record<string, unknown> }> {
  const job = await prisma.translationJob.findUniqueOrThrow({ where: { id: jobId } });
  await setStatus(jobId, "LIPSYNC");

  const status = await getPodStatus();
  if (status === "SLEEPING" || status === "WAKING") {
    await wakePod();
    await appendLog(jobId, `Pod ${status} — wake requested`);
  }

  const work = path.join(process.env.UPLOAD_TMP_DIR || "./tmp/uploads", "translate", jobId);
  await mkdir(work, { recursive: true });
  let localPath = path.join(work, "source.mp4");
  try {
    await readFile(localPath);
  } catch {
    if (!job.sourceR2Url) throw new Error("No source for lipsync");
    const res = await fetch(job.sourceR2Url);
    await writeFile(localPath, Buffer.from(await res.arrayBuffer()));
  }

  let durationSec = 12;
  try {
    durationSec = (await probeVideo(localPath)).durationSec || 12;
  } catch {
    /* */
  }

  const ttsUrls = (job.ttsUrls || {}) as Record<string, { url: string }>;
  const langs = job.targetLangs?.length ? job.targetLangs : Object.keys(ttsUrls);
  const finalVideos: Record<string, unknown> = {};

  for (const lang of langs) {
    const tts = ttsUrls[lang];
    if (!tts?.url) continue;
    await appendLog(jobId, `Lip+body sync → ${lang}`);
    finalVideos[lang] = {
      ...(await lipsyncLang(jobId, lang, localPath, tts.url, durationSec)),
      duration: durationSec,
      lang,
      label: TRANSLATE_LANG_META[lang]?.label || lang,
    };
  }

  await setStatus(jobId, "MUXING", { finalVideos: finalVideos as object });
  return { finalVideos };
}

export async function stepMuxSubtitles(jobId: string): Promise<{ subtitleUrls: Record<string, string> }> {
  const job = await prisma.translationJob.findUniqueOrThrow({ where: { id: jobId } });
  await setStatus(jobId, "MUXING");
  const translations = (job.translations || {}) as Record<
    string,
    { text: string; segments: Segment[] }
  >;
  const subtitleUrls: Record<string, string> = {};

  for (const [lang, pack] of Object.entries(translations)) {
    const vtt = segmentsToVtt(pack.segments || [], lang);
    const key = `translated/subs/${jobId}_${lang}.vtt`;
    await uploadBuffer(key, Buffer.from(vtt, "utf8"), "text/vtt");
    subtitleUrls[lang] = publicUrl(key);
  }

  await setStatus(jobId, "DONE", { subtitleUrls: subtitleUrls as object, error: null });
  await appendLog(jobId, "DONE — all languages packaged");
  return { subtitleUrls };
}

export async function runTranslateOrchestrator(jobId: string) {
  try {
    await stepDownload(jobId);
    await stepTranscribe(jobId);
    await stepTranslate(jobId);
    await stepTts(jobId);
    await stepLipsync(jobId);
    await stepMuxSubtitles(jobId);
    return prisma.translationJob.findUniqueOrThrow({ where: { id: jobId } });
  } catch (e) {
    await failJob(jobId, e instanceof Error ? e.message : String(e));
    throw e;
  }
}

export { translateRtcCost, TRANSLATE_RTC_PER_LANG, classifyTranslateSource };
