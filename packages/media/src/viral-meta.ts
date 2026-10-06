/**
 * Viral metadata — yt-dlp JSON + oEmbed. Metadata/captions only.
 * NEVER download full source video bytes for clone factory.
 */

import { spawn } from "node:child_process";
import { resolveYtDlp, classifyVideoUrl } from "./url-download.js";

export type ViralMeta = {
  title: string;
  description: string;
  durationSec: number;
  thumbnailUrl: string | null;
  tags: string[];
  webpageUrl: string;
  extractor?: string;
  viewCount?: number;
  channel?: string;
  transcriptHint: string;
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

async function oembed(url: string): Promise<Partial<ViralMeta> | null> {
  const kind = classifyVideoUrl(url);
  let endpoint: string | null = null;
  if (kind === "tiktok") endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  if (kind === "instagram") {
    endpoint = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`;
  }
  if (kind === "youtube") {
    endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  }
  if (!endpoint) return null;
  try {
    const res = await fetch(endpoint, {
      headers: { Accept: "application/json", "User-Agent": "ReelStormOS/1.2" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
      html?: string;
    };
    return {
      title: j.title || "Untitled",
      channel: j.author_name,
      thumbnailUrl: j.thumbnail_url || null,
      transcriptHint: j.title || "",
      webpageUrl: url,
      durationSec: 30,
      description: "",
      tags: [],
    };
  } catch {
    return null;
  }
}

/** yt-dlp -J --skip-download — metadata only (no media bytes). */
export async function fetchViralMetadata(url: string): Promise<ViralMeta> {
  const ytdlp = await resolveYtDlp();
  const { code, stdout, stderr } = await run(ytdlp, [
    "-J",
    "--skip-download",
    "--no-warnings",
    "--no-playlist",
    url,
  ]);

  if (code === 0 && stdout.trim()) {
    try {
      const j = JSON.parse(stdout) as {
        title?: string;
        description?: string;
        duration?: number;
        thumbnail?: string;
        thumbnails?: Array<{ url?: string }>;
        tags?: string[];
        categories?: string[];
        webpage_url?: string;
        extractor?: string;
        view_count?: number;
        channel?: string;
        uploader?: string;
        automatic_captions?: Record<string, Array<{ url?: string }>>;
        subtitles?: Record<string, Array<{ url?: string }>>;
      };

      let transcriptHint = (j.description || "").slice(0, 4000);
      // Prefer auto-caption VTT/JSON3 URL text fetch (first en track)
      const caps = j.subtitles || j.automatic_captions || {};
      const en =
        caps.en || caps["en-US"] || caps["en-GB"] || Object.values(caps)[0] || [];
      const capUrl =
        en.find((c) => c.url && String(c.url).includes("json3"))?.url ||
        en.find((c) => c.url)?.url;
      if (capUrl) {
        try {
          const capRes = await fetch(capUrl, { signal: AbortSignal.timeout(15_000) });
          if (capRes.ok) {
            const raw = await capRes.text();
            let text = "";
            if (raw.trim().startsWith("{")) {
              try {
                const j3 = JSON.parse(raw) as {
                  events?: Array<{ segs?: Array<{ utf8?: string }> }>;
                };
                text = (j3.events || [])
                  .flatMap((e) => e.segs || [])
                  .map((s) => s.utf8 || "")
                  .join(" ")
                  .replace(/\s+/g, " ")
                  .trim();
              } catch {
                /* fall through */
              }
            }
            if (!text) {
              const lines = raw
                .split("\n")
                .map((l) => l.trim())
                .filter(
                  (l) =>
                    l &&
                    !l.startsWith("WEBVTT") &&
                    !l.startsWith("NOTE") &&
                    !/^\d+$/.test(l) &&
                    !l.includes("-->") &&
                    !l.startsWith("{"),
                );
              text = lines.join(" ");
            }
            if (text.length > 20) transcriptHint = text.slice(0, 8000);
          }
        } catch {
          /* keep description */
        }
      }

      const thumb =
        j.thumbnail ||
        j.thumbnails?.[j.thumbnails.length - 1]?.url ||
        j.thumbnails?.[0]?.url ||
        null;

      return {
        title: j.title || "Untitled",
        description: j.description || "",
        durationSec: Math.max(1, Math.round(j.duration || 30)),
        thumbnailUrl: thumb,
        tags: [...(j.tags || []), ...(j.categories || [])].slice(0, 24),
        webpageUrl: j.webpage_url || url,
        extractor: j.extractor,
        viewCount: j.view_count,
        channel: j.channel || j.uploader,
        transcriptHint,
      };
    } catch {
      /* fall through */
    }
  }

  const oe = await oembed(url);
  if (oe?.title) {
    return {
      title: oe.title,
      description: oe.description || "",
      durationSec: oe.durationSec || 30,
      thumbnailUrl: oe.thumbnailUrl || null,
      tags: oe.tags || [],
      webpageUrl: oe.webpageUrl || url,
      channel: oe.channel,
      transcriptHint: oe.transcriptHint || oe.title,
    };
  }

  throw new Error(`Could not fetch metadata: ${stderr.slice(0, 200) || "unknown"}`);
}
