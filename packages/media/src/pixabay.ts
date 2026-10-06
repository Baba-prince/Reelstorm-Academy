/**
 * Pixabay Video API — Template Room intro PRIMARY
 * Rate limit with key: 100 req / 60 sec (~6,000/hour).
 * License: free commercial use, no attribution (Pixabay Content License).
 *
 * NEVER hardcode keys — use PIXABAY_API_KEY from env.
 */

const PIXABAY_VIDEO_ENDPOINT = "https://pixabay.com/api/videos/";
const PIXABAY_IMAGE_ENDPOINT = "https://pixabay.com/api/";

export type PixabayVideoSize = {
  url: string;
  width: number;
  height: number;
  size: number;
  thumbnail?: string;
};

export type PixabayVideo = {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  duration: number;
  videos: {
    large?: PixabayVideoSize;
    medium?: PixabayVideoSize;
    small?: PixabayVideoSize;
    tiny?: PixabayVideoSize;
  };
  views: number;
  downloads: number;
  likes: number;
  user: string;
  picture_id?: string;
};

function apiKey(): string {
  return (process.env.PIXABAY_API_KEY || "").trim();
}

export function bestPixabayVideoUrl(video: PixabayVideo): string | null {
  return (
    video.videos.large?.url ||
    video.videos.medium?.url ||
    video.videos.small?.url ||
    video.videos.tiny?.url ||
    null
  );
}

/** Pixabay serves preview stills as `https://i.vimeocdn.com/video/{picture_id}_…jpg` */
export function pixabayThumbnailUrl(video: PixabayVideo): string | null {
  if (video.picture_id) {
    return `https://i.vimeocdn.com/video/${video.picture_id}_295x166.jpg`;
  }
  return (
    video.videos.tiny?.thumbnail ||
    video.videos.small?.thumbnail ||
    video.videos.medium?.thumbnail ||
    null
  );
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch popular videos for Template Room intros.
 * Retries once after 2s on HTTP 429.
 */
export async function fetchPixabayVideos(
  query: string,
  perPage = 20,
  page = 1,
  attempt = 0,
): Promise<PixabayVideo[]> {
  const key = apiKey();
  const params = new URLSearchParams({
    q: query,
    per_page: String(Math.min(perPage, 200)),
    page: String(page),
    safesearch: "true",
    order: "popular",
    video_type: "all",
  });
  if (key) params.set("key", key);

  const url = `${PIXABAY_VIDEO_ENDPOINT}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 429) {
    if (attempt < 2) {
      console.warn(`[pixabay] 429 — retry in 2s (attempt ${attempt + 1})`);
      await sleep(2000);
      return fetchPixabayVideos(query, perPage, page, attempt + 1);
    }
    console.warn("[pixabay] rate limit exhausted after retries");
    return [];
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (!key && (res.status === 400 || res.status === 401 || res.status === 403)) {
      console.warn(`[pixabay] missing PIXABAY_API_KEY — HTTP ${res.status}`);
      return [];
    }
    throw new Error(`Pixabay HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { hits?: PixabayVideo[] };
  return data.hits || [];
}

/** Smoke: pull 3 hits for intro logo reveal */
export async function testPixabayConnection(): Promise<{
  ok: boolean;
  count: number;
  sampleUrl: string | null;
  error?: string;
}> {
  try {
    const hits = await fetchPixabayVideos("intro logo reveal", 3);
    return {
      ok: hits.length > 0,
      count: hits.length,
      sampleUrl: hits[0] ? bestPixabayVideoUrl(hits[0]) : null,
    };
  } catch (e) {
    return { ok: false, count: 0, sampleUrl: null, error: (e as Error).message };
  }
}

/** Optional image search (same key) */
export async function fetchPixabayImages(query: string, perPage = 20, page = 1) {
  const key = apiKey();
  if (!key) return [];
  const params = new URLSearchParams({
    key,
    q: query,
    per_page: String(Math.min(perPage, 200)),
    page: String(page),
    safesearch: "true",
    order: "popular",
    image_type: "photo",
  });
  const res = await fetch(`${PIXABAY_IMAGE_ENDPOINT}?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { hits?: unknown[] };
  return data.hits || [];
}
