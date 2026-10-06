/**
 * Pexels Video API — Template Room intro PRIMARY
 * Rate limit: ~200 req/hour. Requires PEXELS_API_KEY.
 * License: free commercial use, no attribution required (Pexels License).
 */

const PEXELS_ENDPOINT = "https://api.pexels.com/videos/search";

export type PexelsVideoFile = {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
};

export type PexelsVideo = {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  image: string;
  user: { id: number; name: string; url: string };
  video_files: PexelsVideoFile[];
  video_pictures?: Array<{ id: number; picture: string; nr: number }>;
};

export function bestPexelsVideoUrl(video: PexelsVideo): string | null {
  const files = [...(video.video_files || [])].filter((f) => f.file_type?.includes("mp4") || f.link?.endsWith(".mp4"));
  if (!files.length) return video.video_files?.[0]?.link || null;
  // Prefer HD-ish without grabbing huge 4K first (faster cache)
  files.sort((a, b) => {
    const score = (f: PexelsVideoFile) => {
      const area = (f.width || 0) * (f.height || 0);
      if (area >= 1280 * 720 && area <= 1920 * 1080) return 3;
      if (area > 1920 * 1080) return 2;
      return 1;
    };
    return score(b) - score(a);
  });
  return files[0]?.link || null;
}

export function pexelsThumbnailUrl(video: PexelsVideo): string | null {
  return video.video_pictures?.[0]?.picture || video.image || null;
}

export async function fetchPexelsVideos(
  query: string,
  perPage = 15,
  page = 1,
): Promise<PexelsVideo[]> {
  const key = (process.env.PEXELS_API_KEY || "").trim();
  if (!key) {
    throw Object.assign(new Error("PEXELS_API_KEY missing"), { status: 401 });
  }

  const params = new URLSearchParams({
    query,
    per_page: String(Math.min(perPage, 80)),
    page: String(page),
    orientation: "landscape",
  });

  const res = await fetch(`${PEXELS_ENDPOINT}?${params.toString()}`, {
    headers: {
      Authorization: key,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 429) {
    const err = new Error("Pexels rate limit (200/hour)");
    (err as Error & { status: number }).status = 429;
    throw err;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(new Error(`Pexels HTTP ${res.status}: ${body.slice(0, 200)}`), {
      status: res.status,
    });
  }

  const data = (await res.json()) as { videos?: PexelsVideo[] };
  return data.videos || [];
}
