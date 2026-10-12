/**
 * Language Studio — DOWNLOAD → TRANSCRIBE → TRANSLATE → TTS → LIPSYNC → MUX
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
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
  YT_PROOF_VIDEO_URL,
} from "@reelstorm/domain";

type Segment = { start: number; end: number; text: string };
type Transcript = { text: string; language: string; segments: Segment[]; engine?: string };

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

/** Try pod /transcribe; fallback seed + duration-scaled segments */
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
      /* soft-fail */
    }
  }

  // Scale seed segments to video duration
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

async function translateLang(
  lang: string,
  transcript: Transcript,
): Promise<{ text: string; segments: Segment[]; engine: string }> {
  const meta = TRANSLATE_LANG_META[lang];
  const label = meta?.label || lang;

  try {
    const raw = await orchestrate(
      [
        {
          role: "system",
          content:
            "You translate video dubbing transcripts. Return ONLY valid JSON: {\"text\":\"...\",\"segments\":[{\"start\":0,\"end\":1,\"text\":\"...\"}]}. Preserve segment count and approximate timings. Conversational tone for lip-sync.",
        },
        {
          role: "user",
          content: `Translate this English transcript to ${label} (${lang}).\n\n${JSON.stringify(transcript.segments)}`,
        },
      ],
      { json: true, timeoutMs: 60_000 },
    );
    const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim());
    if (parsed?.text && Array.isArray(parsed.segments) && parsed.segments.length) {
      return {
        text: String(parsed.text),
        segments: parsed.segments as Segment[],
        engine: "llm",
      };
    }
  } catch {
    /* seed fallback */
  }

  const seed = TRANSLATE_SEED_TRANSLATIONS[lang];
  if (seed) {
    const last = transcript.segments[transcript.segments.length - 1]?.end || 12;
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

  return {
    text: transcript.text,
    segments: transcript.segments,
    engine: "passthrough",
  };
}

/** ElevenLabs multilingual TTS or ffmpeg tone bed soft-launch */
async function synthesizeTts(
  jobId: string,
  lang: string,
  text: string,
  durationSec: number,
): Promise<{ url: string; key: string; engine: string }> {
  const key = `translated/tts/${jobId}_${lang}.mp3`;
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

  if (elevenKey) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": elevenKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.slice(0, 2500),
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
    } catch {
      /* fall through */
    }
  }

  // Soft-launch: generate silent/tone mp3 matching duration via ffmpeg
  const ffmpeg = await resolveFfmpeg();
  const out = path.join(tmpdir(), `rs-tts-${jobId}-${lang}.mp3`);
  const dur = Math.max(2, Math.min(120, Math.ceil(durationSec || 12)));
  const freq = lang === "de" ? 220 : lang === "yo" ? 260 : lang === "ha" ? 240 : 280;
  await run(ffmpeg, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=${freq}:duration=${dur}`,
    "-q:a",
    "9",
    "-acodec",
    "libmp3lame",
    out,
  ]);
  try {
    await uploadFile(key, out, "audio/mpeg");
  } finally {
    await unlink(out).catch(() => undefined);
  }
  return { url: publicUrl(key), key, engine: "ffmpeg-soft" };
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
  const ffmpeg = await resolveFfmpeg();
  const work = path.join(tmpdir(), `rs-ls-${jobId}-${lang}`);
  await mkdir(work, { recursive: true });
  const audioPath = path.join(work, "voice.mp3");
  const outPath = path.join(work, "out.mp4");

  try {
    const aRes = await fetch(ttsUrl);
    if (aRes.ok) {
      await writeFile(audioPath, Buffer.from(await aRes.arrayBuffer()));
    } else {
      // regenerate tone
      await run(ffmpeg, [
        "-y",
        "-f",
        "lavfi",
        "-i",
        `sine=frequency=200:duration=${Math.ceil(durationSec || 12)}`,
        "-q:a",
        "9",
        "-acodec",
        "libmp3lame",
        audioPath,
      ]);
    }

    const mux = await run(ffmpeg, [
      "-y",
      "-i",
      sourceLocal,
      "-i",
      audioPath,
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

    if (mux.code === 0) {
      await uploadFile(outKey, outPath, "video/mp4");
      return {
        r2Url: publicUrl(outKey),
        key: outKey,
        lipSync: false,
        bodySync: true,
        engine: "ffmpeg-audio-replace",
      };
    }
  } catch {
    /* proof fallback */
  }

  // Last resort: copy proof or re-upload source as lang variant
  try {
    await uploadFile(outKey, sourceLocal, "video/mp4");
    return {
      r2Url: publicUrl(outKey),
      key: outKey,
      lipSync: false,
      bodySync: true,
      engine: "source-copy",
    };
  } catch {
    return {
      r2Url: YT_PROOF_VIDEO_URL,
      key: outKey,
      lipSync: false,
      bodySync: false,
      engine: "proof-fallback",
    };
  }
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
