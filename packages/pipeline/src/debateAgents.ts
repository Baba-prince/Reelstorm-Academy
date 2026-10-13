/**
 * AI Podcast Debate Studio — EXTRACT → ANALYZE → SCRIPT → AUDIO → VIDEO → DONE
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma, type DebateStatus } from "@reelstorm/db";
import {
  downloadReferenceVideo,
  uploadBuffer,
  uploadFile,
  publicUrl,
  resolveFfmpeg,
  ensurePodAliveOrFallback,
  markGpuJobActivity,
  generateWithAutonomousPod,
} from "@reelstorm/media";
import { orchestrate } from "@reelstorm/providers";
import { defaultHostA, defaultHostB, type DebatePersona } from "@reelstorm/domain";

type DialogueLine = {
  host: "A" | "B";
  text: string;
  start?: number;
  end?: number;
  angle?: string;
};

type Analysis = {
  mainIdeas: string[];
  arguments: string[];
  opposingViewpoints: string[];
  summary: string;
};

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
  const job = await prisma.debateJob.findUnique({ where: { id: jobId }, select: { logs: true } });
  const logs = Array.isArray(job?.logs) ? [...(job!.logs as string[])] : [];
  logs.push(`[${new Date().toISOString()}] ${line}`);
  await prisma.debateJob.update({
    where: { id: jobId },
    data: { logs: logs.slice(-100) },
  });
}

async function setStatus(jobId: string, status: DebateStatus, patch: Record<string, unknown> = {}) {
  return prisma.debateJob.update({
    where: { id: jobId },
    data: { status, ...patch },
  });
}

async function failJob(jobId: string, error: string) {
  await appendLog(jobId, `FAILED: ${error}`);
  return setStatus(jobId, "FAILED", { error });
}

function parseJsonLoose<T>(raw: string, fallback: T): T {
  try {
    const m = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!m) return fallback;
    return JSON.parse(m[0]) as T;
  } catch {
    return fallback;
  }
}

function persona(raw: unknown, fallback: DebatePersona): DebatePersona {
  const o = (raw || {}) as Partial<DebatePersona>;
  return {
    name: o.name || fallback.name,
    voiceId: o.voiceId || fallback.voiceId,
    avatarId: o.avatarId || fallback.avatarId,
    variantId: o.variantId || fallback.variantId,
    personality: o.personality || fallback.personality,
  };
}

async function extractTextFromBuffer(buf: Buffer, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return buf.toString("utf8");
  }
  if (lower.endsWith(".pdf")) {
    try {
      const mod = await import("pdf-parse");
      const pdfParse = (mod as { default?: (b: Buffer) => Promise<{ text: string }> }).default || (mod as unknown as (b: Buffer) => Promise<{ text: string }>);
      const out = await pdfParse(buf);
      return (out.text || "").trim();
    } catch {
      // naive PDF text scrape
      const raw = buf.toString("latin1");
      const chunks = raw.match(/\((?:\\.|[^\\)]){3,}\)/g) || [];
      const text = chunks
        .map((c) => c.slice(1, -1).replace(/\\n/g, "\n").replace(/\\(.)/g, "$1"))
        .join(" ");
      return text.replace(/\s+/g, " ").trim().slice(0, 40_000);
    }
  }
  if (lower.endsWith(".docx")) {
    try {
      const mammoth = await import("mammoth");
      const out = await mammoth.extractRawText({ buffer: buf });
      return (out.value || "").trim();
    } catch {
      return buf.toString("utf8").replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ").slice(0, 40_000);
    }
  }
  return buf.toString("utf8").slice(0, 40_000);
}

async function whisperLocal(localPath: string): Promise<string | null> {
  const studioRoot = process.env.LANGUAGE_STUDIO_ROOT || path.join(process.cwd(), "infra/language-studio");
  const script = path.join(studioRoot, "whisper_transcribe.py");
  const python = process.env.LANGUAGE_STUDIO_PYTHON || "python3";
  const work = path.join(tmpdir(), `rs-debate-whisper-${Date.now()}`);
  await mkdir(work, { recursive: true });
  const outJson = path.join(work, "out.json");
  try {
    const r = await run(python, [script, localPath, "--out", outJson, "--model", process.env.WHISPER_MODEL || "base"]);
    if (r.code !== 0) return null;
    const j = JSON.parse(await readFile(outJson, "utf8")) as { text?: string };
    return (j.text || "").trim() || null;
  } catch {
    return null;
  }
}

async function synthesizeLine(
  jobId: string,
  host: "A" | "B",
  idx: number,
  text: string,
  voiceId?: string,
): Promise<{ url: string; key: string; engine: string }> {
  const key = `debate/audio/${jobId}_${host}_${idx}.mp3`;
  const elevenKey = (process.env.ELEVENLABS_API_KEY || "").trim();
  const voice =
    voiceId && !voiceId.startsWith("library-")
      ? voiceId
      : host === "A"
        ? process.env.DEBATE_VOICE_A || "21m00Tcm4TlvDq8ikWAM"
        : process.env.DEBATE_VOICE_B || "AZnzlk1XvdvUeBnXmlld";

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

  // Google translate_tts fallback (en)
  try {
    const q = encodeURIComponent(text.slice(0, 180));
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${q}&tl=en&client=tw-ob`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      await uploadBuffer(key, buf, "audio/mpeg");
      return { url: publicUrl(key), key, engine: "google-tts" };
    }
  } catch {
    /* fall through */
  }

  // Tone bed so mux always has audio (distinct pitch per host)
  const ffmpeg = await resolveFfmpeg();
  const work = path.join(tmpdir(), `rs-debate-tone-${jobId}-${host}-${idx}`);
  await mkdir(work, { recursive: true });
  const out = path.join(work, "tone.mp3");
  const freq = host === "A" ? 220 : 330;
  const dur = Math.min(12, Math.max(2, Math.ceil(text.split(/\s+/).length / 2.5)));
  await run(ffmpeg, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=${freq}:duration=${dur}`,
    "-af",
    "volume=0.15",
    out,
  ]);
  await uploadFile(key, out, "audio/mpeg");
  try {
    await unlink(out);
  } catch {
    /* */
  }
  return { url: publicUrl(key), key, engine: "tone-fallback" };
}

export async function stepDebateExtract(jobId: string): Promise<{ sourceText: string }> {
  const job = await prisma.debateJob.findUniqueOrThrow({ where: { id: jobId } });
  await setStatus(jobId, "EXTRACTING");
  await appendLog(jobId, `Extract ${job.sourceType}`);

  let text = (job.sourceText || "").trim();
  const work = path.join(process.env.UPLOAD_TMP_DIR || "./tmp/uploads", "debate", jobId);
  await mkdir(work, { recursive: true });

  if (!text && job.sourceUrl) {
    const url = job.sourceUrl;
    if (job.sourceType === "YOUTUBE_URL" || job.sourceType === "INSTAGRAM_URL" || /youtu|instagram/i.test(url)) {
      await appendLog(jobId, "yt-dlp download…");
      const dl = await downloadReferenceVideo(url, work);
      const local = dl.localPath;
      const whispered = await whisperLocal(local);
      if (whispered) {
        text = whispered;
      } else {
        text = `Source media from ${url}. Discuss the themes, claims, and counter-arguments implied by this reference.`;
      }
      const key = `debate/source/${jobId}.mp4`;
      try {
        await uploadFile(key, local, "video/mp4");
        await prisma.debateJob.update({
          where: { id: jobId },
          data: { sourceR2Url: publicUrl(key), sourceR2Key: key },
        });
      } catch {
        /* */
      }
    }
  }

  if (!text && (job.sourceR2Url || job.sourceUrl?.startsWith("http"))) {
    const fetchUrl = job.sourceR2Url || job.sourceUrl;
    try {
      const res = await fetch(fetchUrl!);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const name = job.sourceR2Key || fetchUrl || "source.bin";
        if (/\.(mp3|mp4|wav|m4a|webm)$/i.test(name) || job.sourceType === "RECORDING") {
          const local = path.join(work, "media.bin");
          await writeFile(local, buf);
          text = (await whisperLocal(local)) || text;
        } else {
          text = (await extractTextFromBuffer(buf, name)) || text;
        }
      }
    } catch (e) {
      await appendLog(jobId, `Source fetch failed: ${(e as Error).message}`);
    }
  }

  if (!text) {
    text =
      "Explain AI debate simulation: two AI hosts explore a topic, explain arguments, and debate opposing viewpoints — Audio Overview plus optional avatar video.";
    await appendLog(jobId, "No source text — using seed topic");
  }

  text = text.slice(0, 60_000);
  await prisma.debateJob.update({
    where: { id: jobId },
    data: { sourceText: text },
  });
  await appendLog(jobId, `Extracted ${text.length} chars`);
  return { sourceText: text };
}

export async function stepDebateAnalyze(jobId: string): Promise<{ analysis: Analysis }> {
  const job = await prisma.debateJob.findUniqueOrThrow({ where: { id: jobId } });
  await setStatus(jobId, "ANALYZING");
  await appendLog(jobId, "Analyzing material (Ollama/DashScope)…");

  const sourceText = (job.sourceText || "").slice(0, 12_000);
  const raw = await orchestrate(
    [
      {
        role: "system",
        content:
          "You analyze source material for an AI podcast debate. Return JSON only: {mainIdeas:string[], arguments:string[], opposingViewpoints:string[], summary:string}",
      },
      {
        role: "user",
        content: `Analyze this material:\n\n${sourceText}`,
      },
    ],
    { json: true, timeoutMs: 60_000 },
  );

  const analysis = parseJsonLoose<Analysis>(raw, {
    mainIdeas: ["AI debate simulation", "Multi-agent conversation", "Audio Overview"],
    arguments: [
      "Two AI hosts can explore a topic from uploaded material",
      "Debate opposing viewpoints improves understanding",
    ],
    opposingViewpoints: [
      "Optimist: AI podcasts democratize research summaries",
      "Skeptic: Without grounding, debates can hallucinate",
    ],
    summary: sourceText.slice(0, 400) || "Debate overview of the uploaded material.",
  });

  await setStatus(jobId, "ANALYZING", { analysis: analysis as object });
  await appendLog(
    jobId,
    `Analysis: ${analysis.mainIdeas?.length || 0} ideas · ${analysis.arguments?.length || 0} args`,
  );
  return { analysis };
}

export async function stepDebateScript(jobId: string): Promise<{
  script: { dialogue: DialogueLine[]; duration: number };
}> {
  const job = await prisma.debateJob.findUniqueOrThrow({ where: { id: jobId } });
  await setStatus(jobId, "SCRIPTING");
  const hostA = persona(job.hostA, defaultHostA());
  const hostB = persona(job.hostB, defaultHostB());
  const analysis = (job.analysis || {}) as Analysis;

  await appendLog(jobId, `Scripting ${job.debateStyle} · ${hostA.name} vs ${hostB.name}`);

  const raw = await orchestrate(
    [
      {
        role: "system",
        content:
          "You write multi-agent AI podcast scripts. Return JSON only: {dialogue:[{host:'A'|'B', text:string, angle?:string}], duration:number}. 12-20 turns, natural interruptions, 5-10 min spoken.",
      },
      {
        role: "user",
        content: `Style: ${job.debateStyle}
Host A (${hostA.name}, ${hostA.personality}): explores / explains
Host B (${hostB.name}, ${hostB.personality}): challenges / opposing viewpoint
Analysis: ${JSON.stringify(analysis).slice(0, 4000)}
Source excerpt: ${(job.sourceText || "").slice(0, 3000)}
Structure: Intro → Explore → Debate opposing → Conclusion.
Include camera angle hints like /OverShoulder /MediumShot /CloseUp on some lines.`,
      },
    ],
    { json: true, timeoutMs: 90_000 },
  );

  let script = parseJsonLoose<{ dialogue: DialogueLine[]; duration: number }>(raw, {
    dialogue: [],
    duration: 360,
  });

  if (!Array.isArray(script.dialogue) || script.dialogue.length < 4) {
    script = {
      duration: 420,
      dialogue: [
        {
          host: "A",
          text: `Welcome — I'm ${hostA.name}. Today we unpack: ${analysis.summary || "this material"}.`,
          angle: "/MediumShot",
        },
        {
          host: "B",
          text: `And I'm ${hostB.name}. I'll pressure-test every claim. First idea: ${analysis.mainIdeas?.[0] || "AI debate simulation"}.`,
          angle: "/OverShoulder",
        },
        {
          host: "A",
          text: `Here's the case for it: ${analysis.arguments?.[0] || "Two hosts make research more engaging."}`,
          angle: "/MediumShot",
        },
        {
          host: "B",
          text: `Counterpoint: ${analysis.opposingViewpoints?.[1] || analysis.opposingViewpoints?.[0] || "Without sources, this is theater."}`,
          angle: "/CloseUp",
        },
        {
          host: "A",
          text: `Fair — grounding matters. Still, Audio Overview formats help people explore faster.`,
          angle: "/OverShoulder",
        },
        {
          host: "B",
          text: `Then let's separate explanation from advocacy. What should listeners do next?`,
          angle: "/POV",
        },
        {
          host: "A",
          text: `Upload your own research, pick Explore / Explain / Debate, and ship a Dual Host AI Show.`,
          angle: "/MediumShot",
        },
        {
          host: "B",
          text: `And verify every claim. That's the skeptic signing off — debate complete.`,
          angle: "/CloseUp",
        },
      ],
    };
  }

  // timestamp estimate ~2.5 words/sec
  let t = 0;
  script.dialogue = script.dialogue.map((line) => {
    const words = (line.text || "").split(/\s+/).filter(Boolean).length;
    const dur = Math.max(2, words / 2.5);
    const start = t;
    const end = t + dur;
    t = end + 0.35;
    return {
      host: line.host === "B" ? "B" : "A",
      text: line.text,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      angle: line.angle || (line.host === "B" ? "/OverShoulder" : "/MediumShot"),
    };
  });
  script.duration = Math.ceil(t);

  await setStatus(jobId, "SCRIPTING", { script: script as object });
  await appendLog(jobId, `Script ${script.dialogue.length} lines · ~${script.duration}s`);
  return { script };
}

export async function stepDebateAudio(jobId: string): Promise<{
  audioUrl: string;
  audioSegments: Array<{ host: string; r2Url: string; start: number; end: number }>;
}> {
  const job = await prisma.debateJob.findUniqueOrThrow({ where: { id: jobId } });
  await setStatus(jobId, "GENERATING_AUDIO");
  const hostA = persona(job.hostA, defaultHostA());
  const hostB = persona(job.hostB, defaultHostB());
  const script = (job.script || { dialogue: [] }) as { dialogue: DialogueLine[] };
  const dialogue = script.dialogue || [];

  await appendLog(jobId, `TTS ${dialogue.length} segments (Sound Studio voices)…`);

  const segments: Array<{ host: string; r2Url: string; start: number; end: number; local?: string }> =
    [];
  const work = path.join(tmpdir(), `rs-debate-audio-${jobId}`);
  await mkdir(work, { recursive: true });

  for (let i = 0; i < dialogue.length; i++) {
    const line = dialogue[i];
    const voice = line.host === "A" ? hostA.voiceId : hostB.voiceId;
    const syn = await synthesizeLine(jobId, line.host, i, line.text, voice);
    segments.push({
      host: line.host,
      r2Url: syn.url,
      start: line.start ?? i * 4,
      end: line.end ?? i * 4 + 4,
    });
    await appendLog(jobId, `TTS ${line.host}#${i} · ${syn.engine}`);
  }

  // Concat via ffmpeg
  const ffmpeg = await resolveFfmpeg();
  const listPath = path.join(work, "list.txt");
  const locals: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const res = await fetch(segments[i].r2Url);
    const local = path.join(work, `seg_${i}.mp3`);
    await writeFile(local, Buffer.from(await res.arrayBuffer()));
    locals.push(local);
  }
  await writeFile(listPath, locals.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
  const outPath = path.join(work, "episode.mp3");
  const mux = await run(ffmpeg, [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c:a",
    "libmp3lame",
    "-q:a",
    "4",
    outPath,
  ]);
  if (mux.code !== 0) {
    // fallback: first segment only
    await writeFile(outPath, await readFile(locals[0]));
  }

  const audioKey = `debate/${jobId}_audio.mp3`;
  await uploadFile(audioKey, outPath, "audio/mpeg");
  const audioUrl = publicUrl(audioKey);
  await setStatus(jobId, "GENERATING_AUDIO", {
    audioUrl,
    audioSegments: segments.map(({ host, r2Url, start, end }) => ({ host, r2Url, start, end })),
  });
  await appendLog(jobId, `Audio ready ${audioUrl}`);
  return { audioUrl, audioSegments: segments };
}

async function renderTalkingClip(
  jobId: string,
  host: "A" | "B",
  idx: number,
  text: string,
  audioUrl: string,
  angle: string,
  hostName: string,
): Promise<{ r2Url: string; key: string; engine: string }> {
  const key = `debate/video/${jobId}_${host}_${idx}.mp4`;
  const engine = await ensurePodAliveOrFallback();

  if (engine === "pod" || engine === "serverless") {
    const prompt = `Cinematic podcast debate, ${angle} framing, host ${hostName} speaking to camera, brick wall neon studio set, dual monitors, professional lighting, ${text.slice(0, 120)}`;
    const gen = await generateWithAutonomousPod({
      prompt,
      duration: Math.min(12, Math.max(4, Math.ceil(text.split(/\s+/).length / 2.5))),
      resolution: "720x1280",
    });
    if (gen.r2_url) {
      markGpuJobActivity();
      // Remux with dialogue audio when possible
      try {
        const ffmpeg = await resolveFfmpeg();
        const work = path.join(tmpdir(), `rs-debate-v-${jobId}-${host}-${idx}`);
        await mkdir(work, { recursive: true });
        const vPath = path.join(work, "v.mp4");
        const aPath = path.join(work, "a.mp3");
        const out = path.join(work, "out.mp4");
        const vr = await fetch(gen.r2_url);
        const ar = await fetch(audioUrl);
        await writeFile(vPath, Buffer.from(await vr.arrayBuffer()));
        await writeFile(aPath, Buffer.from(await ar.arrayBuffer()));
        const mux = await run(ffmpeg, [
          "-y",
          "-i",
          vPath,
          "-i",
          aPath,
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-c:a",
          "aac",
          "-shortest",
          "-movflags",
          "+faststart",
          out,
        ]);
        if (mux.code === 0) {
          await uploadFile(key, out, "video/mp4");
          return { r2Url: publicUrl(key), key, engine: gen.saverEngine || gen.engine || "pod" };
        }
      } catch {
        /* use raw gen */
      }
      return { r2Url: gen.r2_url, key, engine: gen.saverEngine || gen.engine || "pod" };
    }
  }

  // Fallback: branded still + audio (still a valid debate video on R2)
  const ffmpeg = await resolveFfmpeg();
  const work = path.join(tmpdir(), `rs-debate-still-${jobId}-${host}-${idx}`);
  await mkdir(work, { recursive: true });
  const aPath = path.join(work, "a.mp3");
  const out = path.join(work, "out.mp4");
  const ar = await fetch(audioUrl);
  await writeFile(aPath, Buffer.from(await ar.arrayBuffer()));
  const color = host === "A" ? "0x0a2a33" : "0x1a1030";
  const label = `${hostName}  ${angle}`.replace(/:/g, " ");
  const draw = `drawtext=text='${label.replace(/'/g, "")}':fontcolor=0x00f0ff:fontsize=36:x=(w-text_w)/2:y=h*0.42:box=1:boxcolor=black@0.45`;
  await run(ffmpeg, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${color}:s=1280x720:d=1`,
    "-i",
    aPath,
    "-vf",
    draw,
    "-c:v",
    "libx264",
    "-tune",
    "stillimage",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    "-movflags",
    "+faststart",
    out,
  ]);
  await uploadFile(key, out, "video/mp4");
  return { r2Url: publicUrl(key), key, engine: "still+audio-fallback" };
}

export async function stepDebateVideo(jobId: string): Promise<{
  videoUrl: string | null;
  videoSegments: Array<{ host: string; r2Url: string; angle: string }>;
}> {
  const job = await prisma.debateJob.findUniqueOrThrow({ where: { id: jobId } });
  if (job.mode === "AUDIO_ONLY") {
    await setStatus(jobId, "MUXING");
    await appendLog(jobId, "AUDIO_ONLY — skip video");
    return { videoUrl: null, videoSegments: [] };
  }

  await setStatus(jobId, "GENERATING_VIDEO");
  const hostA = persona(job.hostA, defaultHostA());
  const hostB = persona(job.hostB, defaultHostB());
  const script = (job.script || { dialogue: [] }) as { dialogue: DialogueLine[] };
  const audioSegments = (job.audioSegments || []) as Array<{ host: string; r2Url: string }>;
  const dialogue = script.dialogue || [];

  await appendLog(jobId, `Video mode ${job.mode} · ${dialogue.length} clips`);

  const videoSegments: Array<{ host: string; r2Url: string; angle: string }> = [];
  const work = path.join(tmpdir(), `rs-debate-vid-${jobId}`);
  await mkdir(work, { recursive: true });
  const locals: string[] = [];

  for (let i = 0; i < dialogue.length; i++) {
    const line = dialogue[i];
    const audioUrl = audioSegments[i]?.r2Url || job.audioUrl;
    if (!audioUrl) continue;
    const name = line.host === "A" ? hostA.name : hostB.name;
    const clip = await renderTalkingClip(
      jobId,
      line.host,
      i,
      line.text,
      audioUrl,
      line.angle || "/MediumShot",
      name,
    );
    videoSegments.push({ host: line.host, r2Url: clip.r2Url, angle: line.angle || "/MediumShot" });
    const res = await fetch(clip.r2Url);
    const local = path.join(work, `v_${i}.mp4`);
    await writeFile(local, Buffer.from(await res.arrayBuffer()));
    locals.push(local);
    await appendLog(jobId, `Clip ${line.host}#${i} · ${clip.engine}`);
  }

  const ffmpeg = await resolveFfmpeg();
  const listPath = path.join(work, "vlist.txt");
  await writeFile(listPath, locals.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
  const outPath = path.join(work, "episode.mp4");
  const mux = await run(ffmpeg, [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    outPath,
  ]);
  if (mux.code !== 0) {
    await run(ffmpeg, [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outPath,
    ]);
  }

  const videoKey = `debate/${jobId}_video.mp4`;
  await uploadFile(videoKey, outPath, "video/mp4");
  const videoUrl = publicUrl(videoKey);
  await setStatus(jobId, "MUXING", { videoUrl, videoSegments: videoSegments as object });
  await appendLog(jobId, `Video ready ${videoUrl}`);
  return { videoUrl, videoSegments };
}

export async function runDebateOrchestrator(jobId: string) {
  try {
    await stepDebateExtract(jobId);
    await stepDebateAnalyze(jobId);
    await stepDebateScript(jobId);
    await stepDebateAudio(jobId);
    await stepDebateVideo(jobId);
    await setStatus(jobId, "DONE");
    await appendLog(jobId, "DONE — Dual Host AI Show ready");
    return prisma.debateJob.findUniqueOrThrow({ where: { id: jobId } });
  } catch (err) {
    await failJob(jobId, (err as Error).message);
    throw err;
  }
}
