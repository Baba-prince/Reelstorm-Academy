/**
 * Pixabay Video API — Template Room intro BACKUP
 * Rate limit with key: ~5,000 req/hour. Key optional for limited public probes.
 * License: free commercial use, no attribution required (Pixabay Content License).
 */

const PIXABAY_ENDPOINT = "https://pixabay.com/api/videos/";

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

export async function fetchPixabayVideos(
  query: string,
  perPage = 20,
  page = 1,
): Promise<PixabayVideo[]> {
  const key = (process.env.PIXABAY_API_KEY || "").trim();
  const params = new URLSearchParams({
    q: query,
    per_page: String(Math.min(perPage, 200)),
    page: String(page),
    safesearch: "true",
    order: "popular",
    video_type: "all",
  });
  if (key) params.set("key", key);

  const url = `${PIXABAY_ENDPOINT}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 429) {
    console.warn("[pixabay] rate limit hit");
    return [];
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Without a key Pixabay often returns 400 — treat as empty backup, not crash
    if (!key && (res.status === 400 || res.status === 401 || res.status === 403)) {
      console.warn(`[pixabay] no-key probe failed HTTP ${res.status} — set PIXABAY_API_KEY`);
      return [];
    }
    throw new Error(`Pixabay HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { hits?: PixabayVideo[] };
  return data.hits || [];
}
