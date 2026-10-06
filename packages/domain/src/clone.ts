/**
 * Viral Clone Factory — platform detect + structure analysis.
 * Transformative reproduction for inspiration / fair use — original assets only.
 * NEVER copy source video bytes.
 */

export type ClonePlatform = "youtube" | "shorts" | "tiktok" | "instagram";

const ALLOWED_HOSTS = [
  "youtube.com",
  "youtu.be",
  "m.youtube.com",
  "tiktok.com",
  "vm.tiktok.com",
  "instagram.com",
  "instagr.am",
];

export function isAllowedCloneUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function detectClonePlatform(url: string): ClonePlatform | null {
  if (!isAllowedCloneUrl(url)) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname.toLowerCase();
    if (host.includes("tiktok.com") || host === "vm.tiktok.com") return "tiktok";
    if (host.includes("instagram.com") || host === "instagr.am") return "instagram";
    if (host.includes("youtube.com") || host === "youtu.be" || host === "m.youtube.com") {
      if (path.includes("/shorts/")) return "shorts";
      return "youtube";
    }
  } catch {
    return null;
  }
  return null;
}

export function extractVideoId(url: string, platform: ClonePlatform): string | null {
  try {
    const u = new URL(url);
    if (platform === "shorts") {
      const m = u.pathname.match(/\/shorts\/([^/?#]+)/);
      return m?.[1] || null;
    }
    if (platform === "youtube") {
      if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("/")[0] || null;
      return u.searchParams.get("v");
    }
    if (platform === "tiktok") {
      const m = u.pathname.match(/\/video\/(\d+)/);
      return m?.[1] || null;
    }
    if (platform === "instagram") {
      const m = u.pathname.match(/\/(reel|p|tv)\/([^/?#]+)/);
      return m?.[2] || null;
    }
  } catch {
    return null;
  }
  return null;
}

export type CloneStructure = {
  hook: string;
  bodyPoints: string[];
  cta: string;
  pacing: {
    durationSec: number;
    wordsPerSec: number;
    estimatedCutsPerMin: number;
  };
};

/** Split transcript into Hook / 3 body points / CTA — heuristic, LLM may refine. */
export function analyzeTranscriptStructure(
  transcript: string,
  durationSec = 30,
): CloneStructure {
  const clean = transcript.replace(/\s+/g, " ").trim();
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const hook = sentences[0] || clean.slice(0, 120) || "Hook unavailable — paste richer captions";
  const cta =
    sentences.length > 1
      ? sentences[sentences.length - 1]
      : "Follow for more — transformative remake";

  const mid = sentences.slice(1, -1);
  const bodyPoints: string[] = [];
  if (mid.length === 0) {
    const chunk = clean.slice(hook.length).trim() || "Point 1 from viral DNA";
    bodyPoints.push(chunk.slice(0, 160), "Beat 2 — proof / example", "Beat 3 — payoff");
  } else if (mid.length <= 3) {
    while (mid.length < 3) mid.push(`Supporting beat ${mid.length + 1}`);
    bodyPoints.push(...mid.slice(0, 3));
  } else {
    const size = Math.ceil(mid.length / 3);
    for (let i = 0; i < 3; i++) {
      bodyPoints.push(mid.slice(i * size, (i + 1) * size).join(" ").slice(0, 200));
    }
  }

  const words = clean.split(/\s+/).filter(Boolean).length;
  const wordsPerSec = durationSec > 0 ? Math.round((words / durationSec) * 100) / 100 : 0;
  const punct = (clean.match(/[.!?]/g) || []).length;
  const estimatedCutsPerMin =
    durationSec > 0 ? Math.round((punct / (durationSec / 60)) * 10) / 10 : 8;

  return {
    hook,
    bodyPoints,
    cta,
    pacing: { durationSec, wordsPerSec, estimatedCutsPerMin },
  };
}

export const CLONE_WATERMARK =
  "Inspired by original — Transformative remake via REELSTORM (fair use · original assets)";
