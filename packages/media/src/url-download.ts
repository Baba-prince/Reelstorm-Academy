import { spawn } from "node:child_process";
import { mkdir, access, readdir } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";

const ROOT = path.resolve(process.cwd(), "../..");
const BIN_YTDLP = path.join(ROOT, "bin", "yt-dlp");
const BIN_FFMPEG = path.join(ROOT, "bin", "ffmpeg");

async function exists(p: string) {
  try {
    await access(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveYtDlp(): Promise<string> {
  return (async () => {
    if (await exists(BIN_YTDLP)) return BIN_YTDLP;
    if (await exists("/usr/local/bin/yt-dlp")) return "/usr/local/bin/yt-dlp";
    if (await exists("/opt/homebrew/bin/yt-dlp")) return "/opt/homebrew/bin/yt-dlp";
    return "yt-dlp";
  })();
}

export function resolveFfmpeg(): Promise<string> {
  return (async () => {
    if (await exists(BIN_FFMPEG)) return BIN_FFMPEG;
    if (await exists("/usr/local/bin/ffmpeg")) return "/usr/local/bin/ffmpeg";
    if (await exists("/opt/homebrew/bin/ffmpeg")) return "/opt/homebrew/bin/ffmpeg";
    return "ffmpeg";
  })();
}

export type UrlDownloadResult = {
  localPath: string;
  title: string;
  webpageUrl: string;
  durationSec?: number;
  extractor?: string;
};

function run(cmd: string, args: string[], cwd?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
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

/** Detect YouTube / Vimeo / direct mp4 / generic page URL */
export function classifyVideoUrl(url: string): "youtube" | "vimeo" | "direct" | "generic" {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
    if (host.includes("vimeo.com")) return "vimeo";
    if (/\.(mp4|mov|webm|m4v)(\?|$)/i.test(u.pathname)) return "direct";
    return "generic";
  } catch {
    return "generic";
  }
}

/**
 * Download a reference video from a web URL (YouTube, Vimeo, direct MP4, etc.)
 * Uses bundled ./bin/yt-dlp when available.
 */
export async function downloadReferenceVideo(
  url: string,
  outDir: string,
  onProgress?: (percent: number, message: string) => void | Promise<void>,
): Promise<UrlDownloadResult> {
  await mkdir(outDir, { recursive: true });
  const kind = classifyVideoUrl(url);
  await onProgress?.(5, `Resolving ${kind} reference…`);

  // Direct file URL — fetch stream without yt-dlp
  if (kind === "direct") {
    const filename = path.basename(new URL(url).pathname) || "reference.mp4";
    const localPath = path.join(outDir, filename.replace(/[^\w.\-]+/g, "_"));
    await onProgress?.(20, "Downloading direct video file…");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Direct download failed: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const { writeFile } = await import("node:fs/promises");
    await writeFile(localPath, buf);
    await onProgress?.(90, "Direct download complete");
    return { localPath, title: filename, webpageUrl: url };
  }

  const ytdlp = await resolveYtDlp();
  const ffmpeg = await resolveFfmpeg();
  const outTpl = path.join(outDir, "reference.%(ext)s");

  await onProgress?.(15, "Fetching metadata with yt-dlp…");
  const meta = await run(ytdlp, ["--dump-json", "--no-playlist", url]);
  let title = "reference";
  let durationSec: number | undefined;
  let extractor: string | undefined;
  let webpageUrl = url;
  if (meta.code === 0 && meta.stdout.trim()) {
    try {
      const j = JSON.parse(meta.stdout.split("\n").filter(Boolean).pop() || "{}") as {
        title?: string;
        duration?: number;
        extractor?: string;
        webpage_url?: string;
      };
      title = (j.title || title).slice(0, 120);
      durationSec = j.duration;
      extractor = j.extractor;
      webpageUrl = j.webpage_url || url;
    } catch {
      /* ignore */
    }
  }

  await onProgress?.(35, `Downloading “${title}”…`);
  const args = [
    "--no-playlist",
    "--newline",
    "-f",
    "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
    "--merge-output-format",
    "mp4",
    "-o",
    outTpl,
    "--restrict-filenames",
  ];
  // Prefer project ffmpeg if present
  if (await exists(ffmpeg) || ffmpeg === "ffmpeg") {
    args.push("--ffmpeg-location", path.dirname(ffmpeg === "ffmpeg" ? "/usr/bin/ffmpeg" : ffmpeg));
  }
  // Soft-fail ffmpeg-location if missing — yt-dlp may still get progressive mp4
  const dl = await run(ytdlp, [...args.filter((a, i, arr) => {
    // drop --ffmpeg-location pair if binary missing
    if (a === "--ffmpeg-location") {
      return false;
    }
    if (arr[i - 1] === "--ffmpeg-location") return false;
    return true;
  }), url]);

  if (dl.code !== 0) {
    // Retry simpler format
    await onProgress?.(50, "Retrying with best progressive format…");
    const retry = await run(ytdlp, [
      "--no-playlist",
      "-f",
      "best[ext=mp4]/best",
      "-o",
      outTpl,
      "--restrict-filenames",
      url,
    ]);
    if (retry.code !== 0) {
      throw new Error(`yt-dlp failed: ${(retry.stderr || dl.stderr).slice(-800)}`);
    }
  }

  const files = await readdir(outDir);
  const video = files.find((f) => /\.(mp4|mkv|webm|mov)$/i.test(f));
  if (!video) throw new Error("Download finished but no video file found in output dir");

  await onProgress?.(95, "Reference video ready for intelligence");
  return {
    localPath: path.join(outDir, video),
    title,
    webpageUrl,
    durationSec,
    extractor: extractor || kind,
  };
}

/**
 * Pull audio-only from a web URL (YouTube, podcasts, direct mp3/m4a).
 * Uses yt-dlp `-x` when available; falls back to fetch for direct audio links.
 */
export async function downloadExternalAudio(
  url: string,
  outDir: string,
  onProgress?: (percent: number, message: string) => void | Promise<void>,
): Promise<UrlDownloadResult & { format: string }> {
  await mkdir(outDir, { recursive: true });
  await onProgress?.(5, "Resolving external audio…");

  try {
    const u = new URL(url);
    if (/\.(mp3|wav|m4a|aac|ogg|flac)(\?|$)/i.test(u.pathname)) {
      const filename = path.basename(u.pathname) || "external.mp3";
      const localPath = path.join(outDir, filename.replace(/[^\w.\-]+/g, "_"));
      await onProgress?.(25, "Downloading direct audio…");
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Direct audio download failed: HTTP ${res.status}`);
      const { writeFile } = await import("node:fs/promises");
      await writeFile(localPath, Buffer.from(await res.arrayBuffer()));
      await onProgress?.(100, "External audio ready");
      return {
        localPath,
        title: filename,
        webpageUrl: url,
        extractor: "direct",
        format: path.extname(filename).slice(1) || "mp3",
      };
    }
  } catch (e) {
    if ((e as Error).message?.startsWith("Direct")) throw e;
  }

  const ytdlp = await resolveYtDlp();
  const ffmpegBin = await resolveFfmpeg();
  const outTpl = path.join(outDir, "audio.%(ext)s");

  await onProgress?.(20, "Extracting audio stream with yt-dlp…");
  const args = [
    "--no-playlist",
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "0",
    "-o",
    outTpl,
    "--restrict-filenames",
  ];
  if (ffmpegBin !== "ffmpeg" && (await exists(ffmpegBin))) {
    args.push("--ffmpeg-location", path.dirname(ffmpegBin));
  }
  const dl = await run(ytdlp, [...args, url]);
  if (dl.code !== 0) {
    throw new Error(`yt-dlp audio extract failed: ${dl.stderr.slice(-800)}`);
  }

  const files = await readdir(outDir);
  const audio = files.find((f) => /\.(mp3|m4a|wav|opus|ogg|flac)$/i.test(f));
  if (!audio) throw new Error("Audio extract finished but no audio file found");

  await onProgress?.(100, "External audio ready");
  return {
    localPath: path.join(outDir, audio),
    title: audio,
    webpageUrl: url,
    extractor: "yt-dlp",
    format: path.extname(audio).slice(1),
  };
}
