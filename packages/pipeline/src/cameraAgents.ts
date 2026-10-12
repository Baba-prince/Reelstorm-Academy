/**
 * Camera Angle Prompt Studio — UPLOAD → EXTRACT → ANALYZE → GENERATE_PROMPTS
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma, type CameraStatus } from "@reelstorm/db";
import {
  downloadReferenceVideo,
  classifyVideoUrl,
  uploadFile,
  uploadBuffer,
  publicUrl,
  probeVideo,
  extractFrame,
  resolveFfmpeg,
  ensurePodAliveOrFallback,
  markGpuJobActivity,
  generateWithAutonomousPod,
} from "@reelstorm/media";
import { orchestrate } from "@reelstorm/providers";
import {
  CAMERA_COMMANDS,
  CAMERA_SEED_ANALYSIS,
  buildPromptPack,
  type CameraPromptRow,
} from "@reelstorm/domain";

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
  const job = await prisma.cameraAngleJob.findUnique({ where: { id: jobId }, select: { logs: true } });
  const logs = Array.isArray(job?.logs) ? [...(job!.logs as string[])] : [];
  logs.push(`[${new Date().toISOString()}] ${line}`);
  await prisma.cameraAngleJob.update({
    where: { id: jobId },
    data: { logs: logs.slice(-80) },
  });
}

async function setStatus(jobId: string, status: CameraStatus, patch: Record<string, unknown> = {}) {
  return prisma.cameraAngleJob.update({
    where: { id: jobId },
    data: { status, ...patch },
  });
}

async function failJob(jobId: string, error: string) {
  await appendLog(jobId, `FAILED: ${error}`);
  return setStatus(jobId, "FAILED", { error });
}

async function extractKeyframes(localVideo: string, workDir: string, jobId: string, count = 5) {
  let duration = 12;
  try {
    duration = (await probeVideo(localVideo)).durationSec || 12;
  } catch {
    /* */
  }
  const frames: Array<{ time: number; r2Url: string; key: string }> = [];
  for (let i = 0; i < count; i++) {
    const t = Number(((duration * (i + 0.5)) / count).toFixed(2));
    const out = path.join(workDir, `frame_${i}.jpg`);
    try {
      await extractFrame(localVideo, t, out);
      const key = `camera/frames/${jobId}_${i}.jpg`;
      await uploadFile(key, out, "image/jpeg");
      frames.push({ time: t, r2Url: publicUrl(key), key });
    } catch {
      /* skip frame */
    }
  }
  return frames;
}

export async function stepCameraIngest(jobId: string): Promise<{
  sourceR2Url: string;
  keyframes: Array<{ time: number; r2Url: string; key: string }>;
}> {
  const job = await prisma.cameraAngleJob.findUniqueOrThrow({ where: { id: jobId } });
  await setStatus(jobId, "EXTRACTING");
  await appendLog(jobId, `Ingest ${job.sourceType} ${job.originalUrl || job.sourceUrl || ""}`);

  const work = path.join(process.env.UPLOAD_TMP_DIR || "./tmp/uploads", "camera", jobId);
  await mkdir(work, { recursive: true });
  let keyframes: Array<{ time: number; r2Url: string; key: string }> = [];
  let sourceR2Url = job.sourceR2Url || "";
  let sourceR2Key = job.sourceR2Key || "";

  if (job.sourceType === "IMAGE" && job.sourceR2Url) {
    sourceR2Url = job.sourceR2Url;
    keyframes = [{ time: 0, r2Url: sourceR2Url, key: job.sourceR2Key || "" }];
  } else if (
    (job.sourceType === "YOUTUBE_URL" || job.sourceType === "INSTAGRAM_URL") &&
    job.originalUrl
  ) {
    const kind = classifyVideoUrl(job.originalUrl);
    await appendLog(jobId, `yt-dlp ${kind}`);
    const dl = await downloadReferenceVideo(job.originalUrl, work);
    const vKey = `camera/source/${jobId}.mp4`;
    await uploadFile(vKey, dl.localPath, "video/mp4");
    sourceR2Key = vKey;
    sourceR2Url = publicUrl(vKey);
    keyframes = await extractKeyframes(dl.localPath, work, jobId, 5);
  } else if (job.sourceType === "VIDEO" && job.sourceR2Url) {
    sourceR2Url = job.sourceR2Url;
    const local = path.join(work, "source.mp4");
    const res = await fetch(job.sourceR2Url);
    if (!res.ok) throw new Error(`Fetch video failed ${res.status}`);
    await writeFile(local, Buffer.from(await res.arrayBuffer()));
    keyframes = await extractKeyframes(local, work, jobId, 5);
  } else if (job.sourceR2Url) {
    sourceR2Url = job.sourceR2Url;
    keyframes = [{ time: 0, r2Url: sourceR2Url, key: job.sourceR2Key || "" }];
  } else {
    throw new Error("No source image/video/url for camera job");
  }

  if (!keyframes.length && sourceR2Url) {
    keyframes = [{ time: 0, r2Url: sourceR2Url, key: sourceR2Key }];
  }

  await setStatus(jobId, "ANALYZING", {
    sourceR2Url,
    sourceR2Key: sourceR2Key || undefined,
    keyframes: keyframes as object,
  });
  await appendLog(jobId, `Keyframes ${keyframes.length} · ${sourceR2Url}`);
  return { sourceR2Url, keyframes };
}

export async function stepCameraAnalyze(jobId: string) {
  const job = await prisma.cameraAngleJob.findUniqueOrThrow({ where: { id: jobId } });
  await setStatus(jobId, "ANALYZING");
  await appendLog(jobId, "Vision analyze current angle…");

  const frames = (job.keyframes as Array<{ r2Url: string }> | null) || [];
  const imageUrl = frames[0]?.r2Url || job.sourceR2Url || "";

  let analysis: Record<string, unknown> = { ...CAMERA_SEED_ANALYSIS, imageUrl };

  try {
    const raw = await orchestrate(
      [
        {
          role: "system",
          content:
            'You are a cinematography analyst. Return ONLY JSON: {"currentAngle":"...","detectedLens":"...","composition":"...","lighting":"...","subject":"short noun phrase","confidence":0.0-1.0}',
        },
        {
          role: "user",
          content: `Analyze camera angle for this frame URL (describe as if you can see it — use cinematic judgment from typical still content): ${imageUrl}\nIf unknown, assume eye-level medium of the hero subject.`,
        },
      ],
      { json: true, timeoutMs: 45_000 },
    );
    const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim()) as Record<
      string,
      unknown
    >;
    if (parsed.currentAngle) {
      analysis = { ...CAMERA_SEED_ANALYSIS, ...parsed, engine: "llm", imageUrl };
    }
  } catch {
    await appendLog(jobId, "Vision LLM soft-fail — using seed analysis");
  }

  // Optional pod vision endpoint
  const engine = await ensurePodAliveOrFallback();
  const saverBase = (process.env.RUNPOD_SAVER_URL || "").replace(/\/generate\/?$/, "");
  if (engine === "pod" && saverBase && imageUrl) {
    try {
      const res = await fetch(`${saverBase}/vision-angle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl }),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) {
        const j = (await res.json()) as Record<string, unknown>;
        if (j.currentAngle) {
          analysis = { ...analysis, ...j, engine: "pod-vision" };
          markGpuJobActivity();
        }
      }
    } catch {
      /* */
    }
  }

  await setStatus(jobId, "GENERATING_PROMPTS", { analysis: analysis as object });
  await appendLog(
    jobId,
    `Angle=${analysis.currentAngle} lens=${analysis.detectedLens} conf=${analysis.confidence}`,
  );
  return { analysis };
}

export async function stepCameraGeneratePrompts(jobId: string) {
  const job = await prisma.cameraAngleJob.findUniqueOrThrow({ where: { id: jobId } });
  await setStatus(jobId, "GENERATING_PROMPTS");
  const analysis = (job.analysis || CAMERA_SEED_ANALYSIS) as {
    subject?: string;
    currentAngle?: string;
  };
  const subject = analysis.subject || "the main subject in frame";

  let prompts: CameraPromptRow[] = buildPromptPack(subject, CAMERA_COMMANDS);

  // Enrich a few with LLM polish
  try {
    const raw = await orchestrate(
      [
        {
          role: "system",
          content:
            "Polish camera prompts. Return JSON array of {command, prompt} for /LowAngle /Droneview /BTS only. Keep ComfyUI Flux ready.",
        },
        {
          role: "user",
          content: `Subject: ${subject}. Current angle: ${analysis.currentAngle}. Polish prompts for /LowAngle, /Droneview, /BTS.`,
        },
      ],
      { json: true, timeoutMs: 40_000 },
    );
    const polished = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim()) as Array<{
      command: string;
      prompt: string;
    }>;
    if (Array.isArray(polished)) {
      prompts = prompts.map((p) => {
        const hit = polished.find((x) => x.command === p.command);
        return hit?.prompt ? { ...p, prompt: hit.prompt } : p;
      });
    }
  } catch {
    /* taxonomy pack is enough */
  }

  await setStatus(jobId, "DONE", { prompts: prompts as object, error: null });
  await appendLog(jobId, `DONE — ${prompts.length} angle prompts`);
  return { prompts };
}

export async function stepCameraPreview(jobId: string, command: string) {
  const job = await prisma.cameraAngleJob.findUniqueOrThrow({ where: { id: jobId } });
  const prompts = (job.prompts || []) as CameraPromptRow[];
  const row = prompts.find((p) => p.command === command || p.command === `/${command.replace(/^\//, "")}`);
  if (!row) throw new Error(`Unknown command ${command}`);

  await appendLog(jobId, `Preview ${row.command}`);
  const slug = row.command.replace(/^\//, "").toLowerCase();
  const key = `camera/preview/${jobId}_${slug}.jpg`;

  // Try GPU generate; soft-launch: stamp a text card PNG-like JPEG via ffmpeg
  let previewUrl = "";
  try {
    const gen = await generateWithAutonomousPod({
      prompt: row.prompt.slice(0, 800),
      duration: 2,
      resolution: "720x1280",
    });
    if (gen.r2_url) {
      previewUrl = gen.r2_url;
      markGpuJobActivity();
    }
  } catch {
    /* */
  }

  if (!previewUrl) {
    const ffmpeg = await resolveFfmpeg();
    const work = path.join(process.env.UPLOAD_TMP_DIR || "./tmp/uploads", "camera", jobId);
    await mkdir(work, { recursive: true });
    const out = path.join(work, `preview_${slug}.jpg`);
    const label = row.command.replace(/'/g, "");
    await run(ffmpeg, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=0x12121a:s=1280x720:d=1`,
      "-vf",
      `drawtext=text='${label}':fontcolor=0x00D9FF:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2`,
      "-frames:v",
      "1",
      out,
    ]);
    try {
      await uploadFile(key, out, "image/jpeg");
      previewUrl = publicUrl(key);
    } finally {
      await unlink(out).catch(() => undefined);
    }
  }

  const previews = {
    ...((job.previews as Record<string, string>) || {}),
    [row.command]: previewUrl,
  };
  const updatedPrompts = prompts.map((p) =>
    p.command === row.command ? { ...p, previewR2Url: previewUrl } : p,
  );
  await prisma.cameraAngleJob.update({
    where: { id: jobId },
    data: { previews: previews as object, prompts: updatedPrompts as object },
  });
  return { previewR2Url: previewUrl, command: row.command };
}

export async function runCameraOrchestrator(jobId: string) {
  try {
    await stepCameraIngest(jobId);
    await stepCameraAnalyze(jobId);
    await stepCameraGeneratePrompts(jobId);
    return prisma.cameraAngleJob.findUniqueOrThrow({ where: { id: jobId } });
  } catch (e) {
    await failJob(jobId, e instanceof Error ? e.message : String(e));
    throw e;
  }
}
