/**
 * Template Room intro fetcher — Pexels primary, Pixabay backup.
 * Downloads best MP4 + thumbnail into R2 (or local staging).
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  bestPixabayVideoUrl,
  fetchPixabayVideos,
  pixabayThumbnailUrl,
  type PixabayVideo,
} from "./pixabay.js";
import {
  bestPexelsVideoUrl,
  fetchPexelsVideos,
  pexelsThumbnailUrl,
  type PexelsVideo,
} from "./pexels.js";
import { publicUrl, uploadBuffer } from "./s3.js";

export type IntroStockSource = "pexels" | "pixabay";

export type NormalizedIntroVideo = {
  source: IntroStockSource;
  externalId: string;
  durationSec: number;
  tags: string[];
  pageUrl: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  user: string;
};

export type IntroFetchResult = {
  source: IntroStockSource;
  videos: NormalizedIntroVideo[];
};

function tagsFrom(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw.map((t) => t.trim()).filter(Boolean);
  return raw
    .split(/[,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function normalizePexels(v: PexelsVideo): NormalizedIntroVideo | null {
  const videoUrl = bestPexelsVideoUrl(v);
  if (!videoUrl) return null;
  return {
    source: "pexels",
    externalId: String(v.id),
    durationSec: v.duration || 0,
    tags: [],
    pageUrl: v.url,
    videoUrl,
    thumbnailUrl: pexelsThumbnailUrl(v),
    user: v.user?.name || "pexels",
  };
}

function normalizePixabay(v: PixabayVideo): NormalizedIntroVideo | null {
  const videoUrl = bestPixabayVideoUrl(v);
  if (!videoUrl) return null;
  return {
    source: "pixabay",
    externalId: String(v.id),
    durationSec: v.duration || 0,
    tags: tagsFrom(v.tags || ""),
    pageUrl: v.pageURL,
    videoUrl,
    thumbnailUrl: pixabayThumbnailUrl(v),
    user: v.user || "pixabay",
  };
}

/** PRIMARY Pexels → BACKUP Pixabay on 429 / empty / missing key */
export async function fetchIntroWithFallback(
  query: string,
  opts?: { perPage?: number },
): Promise<IntroFetchResult> {
  const perPage = opts?.perPage ?? 12;

  try {
    const pexels = await fetchPexelsVideos(query, perPage);
    const videos = pexels.map(normalizePexels).filter(Boolean) as NormalizedIntroVideo[];
    if (videos.length > 0) return { source: "pexels", videos };
    console.warn(`[intros] Pexels empty for "${query}" — trying Pixabay`);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 429) {
      console.warn("[intros] Pexels 429 (200/hour) — falling back to Pixabay");
    } else if (status === 401) {
      console.warn("[intros] PEXELS_API_KEY missing — Pixabay backup");
    } else {
      console.warn(`[intros] Pexels error: ${(err as Error).message} — Pixabay backup`);
    }
  }

  const pixabay = await fetchPixabayVideos(query, perPage);
  const videos = pixabay.map(normalizePixabay).filter(Boolean) as NormalizedIntroVideo[];
  return { source: "pixabay", videos };
}

async function downloadBytes(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Download failed HTTP ${res.status} for ${url.slice(0, 80)}`);
  return Buffer.from(await res.arrayBuffer());
}

export type CachedIntroMedia = {
  r2Key: string;
  r2Url: string;
  coverKey?: string;
  coverUrl?: string;
  bytes: number;
};

/**
 * Download intro MP4 (+ optional cover still) → R2 or local staging.
 * Path: templates/intros/{category}/{source}_{externalId}.mp4
 */
export async function downloadAndCacheIntro(
  video: NormalizedIntroVideo,
  category: string,
): Promise<CachedIntroMedia> {
  const safeCat = category.replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "intros";
  const base = `templates/intros/${safeCat}/${video.source}_${video.externalId}`;
  const r2Key = `${base}.mp4`;

  const buf = await downloadBytes(video.videoUrl);
  const localOk = process.env.S3_LOCAL_OK === "1";

  let r2Url: string;
  try {
    await uploadBuffer(r2Key, buf, "video/mp4");
    r2Url = publicUrl(r2Key);
  } catch (e) {
    if (!localOk) throw e;
    const dir = process.env.UPLOAD_TMP_DIR || path.resolve("tmp/uploads");
    const abs = path.join(dir, r2Key);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, buf);
    r2Url = `/media/local/${r2Key}`;
    console.warn(`[intros] R2 upload failed — staged locally ${abs}`);
  }

  let coverKey: string | undefined;
  let coverUrl: string | undefined;
  if (video.thumbnailUrl) {
    try {
      const thumb = await downloadBytes(video.thumbnailUrl);
      coverKey = `${base}_cover.jpg`;
      await uploadBuffer(coverKey, thumb, "image/jpeg");
      coverUrl = publicUrl(coverKey);
    } catch {
      /* cover optional */
    }
  }

  return { r2Key, r2Url, coverKey, coverUrl, bytes: buf.length };
}
