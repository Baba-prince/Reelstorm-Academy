import ffmpeg from "fluent-ffmpeg";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ARCHIVE5_BLOCK_SECONDS } from "@reelstorm/domain";

if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}

export type ProbeResult = {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  videoCodec?: string;
  audioCodec?: string;
  bitrate?: number;
};

export function probeVideo(filePath: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const video = data.streams.find((s) => s.codec_type === "video");
      const audio = data.streams.find((s) => s.codec_type === "audio");
      const durationSec = Number(data.format.duration || 0);
      let fps = 24;
      if (video?.r_frame_rate) {
        const [n, d] = video.r_frame_rate.split("/").map(Number);
        if (d) fps = n / d;
      }
      resolve({
        durationSec,
        width: video?.width || 0,
        height: video?.height || 0,
        fps,
        videoCodec: video?.codec_name,
        audioCodec: audio?.codec_name,
        bitrate: data.format.bit_rate ? Number(data.format.bit_rate) : undefined,
      });
    });
  });
}

/** Split long video into ARCHIVE5 5-min blocks */
export async function splitIntoArchive5Blocks(
  inputPath: string,
  outDir: string,
  blockSeconds = ARCHIVE5_BLOCK_SECONDS,
): Promise<{ index: number; path: string; startSec: number; durationSec: number }[]> {
  await mkdir(outDir, { recursive: true });
  const probe = await probeVideo(inputPath);
  const blocks: { index: number; path: string; startSec: number; durationSec: number }[] = [];
  const count = Math.max(1, Math.ceil(probe.durationSec / blockSeconds));

  for (let i = 0; i < count; i++) {
    const startSec = i * blockSeconds;
    const durationSec = Math.min(blockSeconds, probe.durationSec - startSec);
    if (durationSec <= 0.5) break;
    const outPath = path.join(outDir, `block_${String(i + 1).padStart(3, "0")}.mp4`);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startSec)
        .duration(durationSec)
        .outputOptions(["-c", "copy", "-avoid_negative_ts", "make_zero"])
        .on("end", () => resolve())
        .on("error", reject)
        .save(outPath);
    });
    blocks.push({ index: i + 1, path: outPath, startSec, durationSec });
  }
  return blocks;
}

/** Extract audio stems (best-effort via ffmpeg filters) */
export async function extractAudioStems(
  inputPath: string,
  outDir: string,
): Promise<{ voice?: string; music?: string; sfx?: string; full: string }> {
  await mkdir(outDir, { recursive: true });
  const full = path.join(outDir, "full.wav");
  const voice = path.join(outDir, "voice.wav");
  const music = path.join(outDir, "music.wav");

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec("pcm_s16le")
      .on("end", () => resolve())
      .on("error", reject)
      .save(full);
  });

  // Approximate vocal / accompaniment split using center-channel extraction heuristics
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioFilters("pan=mono|c0=0.5*c0+-0.5*c1")
      .audioCodec("pcm_s16le")
      .on("end", () => resolve())
      .on("error", () => resolve()) // soft-fail
      .save(voice);
  });

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioFilters("pan=mono|c0=0.5*c0+0.5*c1")
      .audioCodec("pcm_s16le")
      .on("end", () => resolve())
      .on("error", () => resolve())
      .save(music);
  });

  return { full, voice, music };
}

/** Concat demuxer merge for MERGE STUDIO */
export async function mergeBlocks(
  blockPaths: string[],
  outputPath: string,
): Promise<string> {
  const listPath = outputPath + ".txt";
  const list = blockPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  await writeFile(listPath, list, "utf8");
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .outputOptions(["-c", "copy"])
      .on("end", () => resolve())
      .on("error", reject)
      .save(outputPath);
  });
  return outputPath;
}

export async function extractFrame(
  inputPath: string,
  atSec: number,
  outputPath: string,
): Promise<string> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(atSec)
      .frames(1)
      .on("end", () => resolve())
      .on("error", reject)
      .save(outputPath);
  });
  return outputPath;
}

export type AudioFormat = "wav" | "mp3" | "m4a";

/** Extract a single audio track from video or audio source */
export async function extractAudioTrack(
  inputPath: string,
  outputPath: string,
  format: AudioFormat = "wav",
): Promise<string> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const codec =
    format === "mp3" ? "libmp3lame" : format === "m4a" ? "aac" : "pcm_s16le";
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec(codec)
      .on("end", () => resolve())
      .on("error", reject)
      .save(outputPath);
  });
  return outputPath;
}

/**
 * Sync / mux external audio onto a video.
 * replace=true drops original audio; false mixes both.
 * offsetSec shifts the external track relative to video start.
 */
export async function muxAudioOntoVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  opts?: { replace?: boolean; offsetSec?: number },
): Promise<string> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const replace = opts?.replace !== false;
  const offset = opts?.offsetSec || 0;

  await new Promise<void>((resolve, reject) => {
    const cmd = ffmpeg().input(videoPath).input(audioPath);
    if (offset > 0) {
      cmd.inputOptions([`-itsoffset`, String(offset)]);
    }
    if (replace) {
      cmd.outputOptions([
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
      ]);
    } else {
      cmd
        .complexFilter([
          "[0:a][1:a]amix=inputs=2:duration=shortest:dropout_transition=2[aout]",
        ])
        .outputOptions(["-map", "0:v:0", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac"]);
    }
    cmd.on("end", () => resolve()).on("error", reject).save(outputPath);
  });
  return outputPath;
}

/** Loudness-normalize audio for voice clone / TTS beds */
export async function normalizeAudio(inputPath: string, outputPath: string): Promise<string> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters("loudnorm=I=-16:TP=-1.5:LRA=11")
      .audioCodec("pcm_s16le")
      .on("end", () => resolve())
      .on("error", reject)
      .save(outputPath);
  });
  return outputPath;
}
