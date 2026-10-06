/**
 * BullMQ: cloneReproduce
 * Transformative remake — Seedance prompts + Pixabay B-roll + optional local merge.
 * NEVER downloads or re-encodes source viral video bytes.
 */

import { prisma } from "@reelstorm/db";
import { CLONE_WATERMARK } from "@reelstorm/domain";
import { downloadAndCacheIntro, fetchIntroWithFallback, publicUrl, uploadBuffer } from "@reelstorm/media";
import { generateVideoRouted } from "@reelstorm/providers";
import type { Job } from "bullmq";
import { trackJob } from "../lib.js";

export type CloneReproduceData = {
  cloneJobId: string;
  style: string;
  userCharacterId?: string;
  voiceId?: string;
  brollUrl?: string | null;
  rewritten?: string;
};

export async function cloneReproduceJob(job: Job<CloneReproduceData>) {
  const { cloneJobId, style, brollUrl, rewritten } = job.data;
  const clone = await prisma.cloneJob.findUniqueOrThrow({ where: { id: cloneJobId } });

  const points = (clone.bodyPoints as string[]) || [];
  const prompts = points.slice(0, 6).map(
    (p, i) =>
      `${style} cinematic vertical Short, original character, transformative remake beat ${i + 1}: ${p}. No logos or frames from the inspiration video.`,
  );

  const clipUrls: string[] = [];
  const mock = process.env.MOCK_VIDEO_GEN === "1" || !process.env.DASHSCOPE_API_KEY;

  for (let i = 0; i < prompts.length; i++) {
    await job.updateProgress({ stage: "seedance", i, total: prompts.length });
    if (mock) continue;
    try {
      const out = await generateVideoRouted({
        prompt: prompts[i],
        durationSec: 5,
        aspectRatio: "9:16",
      });
      if (out.videoUrl) clipUrls.push(out.videoUrl);
    } catch (e) {
      console.warn(`[cloneReproduce] Seedance clip ${i} failed: ${(e as Error).message}`);
    }
  }

  // Cache Pixabay intro matching style
  let introUrl = brollUrl || null;
  let introKey: string | undefined;
  try {
    const q =
      style === "kids"
        ? "kids colorful particles intro"
        : style === "gaming"
          ? "gaming neon intro"
          : style === "a24"
            ? "cinematic smoke opener"
            : "logo reveal particles";
    const { videos } = await fetchIntroWithFallback(q, { perPage: 4 });
    if (videos[0]) {
      const cached = await downloadAndCacheIntro(videos[0], "viral-clone");
      introUrl = cached.r2Url;
      introKey = cached.r2Key;
    }
  } catch (e) {
    console.warn(`[cloneReproduce] intro cache: ${(e as Error).message}`);
  }

  // Persist package (full ffmpeg merge can attach later)
  const packageJson = {
    transformative: true,
    compliance: "Transformative reproduction for inspiration, fair use, original assets",
    watermark: CLONE_WATERMARK,
    inspirationUrl: clone.sourceUrl,
    style,
    rewritten: rewritten || clone.rewrittenTranscript,
    seedancePrompts: prompts,
    clipUrls,
    introUrl,
    introKey,
    mock,
  };

  const manifestKey = `clones/${cloneJobId}/package.json`;
  let r2Url = introUrl || clipUrls[0] || null;
  try {
    await uploadBuffer(manifestKey, Buffer.from(JSON.stringify(packageJson, null, 2)), "application/json");
    r2Url = publicUrl(manifestKey);
  } catch {
    /* local / missing R2 */
  }

  const result = await prisma.cloneJob.update({
    where: { id: cloneJobId },
    data: {
      status: "completed",
      r2Url: r2Url || undefined,
      r2Key: manifestKey,
      rewrittenTranscript: rewritten || clone.rewrittenTranscript,
      watermarkNote: CLONE_WATERMARK,
      meta: packageJson,
    },
  });

  // DNA template row for Template Room
  try {
    await prisma.introTemplate.create({
      data: {
        type: "intro",
        category: "viral-clone",
        name: (clone.title || "Viral clone").slice(0, 120),
        source: "clone",
        externalId: cloneJobId,
        r2Key: introKey || manifestKey,
        r2Url: introUrl || r2Url || "",
        thumbnailUrl: clone.thumbnailUrl,
        coverUrl: clone.thumbnailUrl,
        durationSec: clone.durationSec || 30,
        tags: [...(clone.tags || []), "viral-clone", style],
        license: "transformative-remake",
        query: clone.sourceUrl,
        meta: {
          cloneJobId,
          watermark: CLONE_WATERMARK,
          inspirationOnly: true,
        },
      },
    });
  } catch {
    /* dup ok */
  }

  if (job.id) {
    await trackJob("cloneReproduce", String(job.id), "COMPLETED", job.data, { result });
  }
  return { ok: true, cloneJobId, r2Url, clipCount: clipUrls.length, mock };
}
