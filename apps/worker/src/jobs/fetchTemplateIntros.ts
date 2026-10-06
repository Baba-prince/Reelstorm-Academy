/**
 * BullMQ job: fetchTemplateIntros
 * Pixabay PRIMARY (Pexels paused) → cache MP4 + cover to R2 → IntroTemplate rows
 */

import { prisma } from "@reelstorm/db";
import {
  INTRO_STOCK_CATEGORIES,
  INTRO_STOCK_QUERIES,
  INTROS_PER_CATEGORY_TARGET,
  INTROS_PER_QUERY,
  type IntroStockCategory,
} from "@reelstorm/domain";
import { downloadAndCacheIntro, fetchIntroWithFallback } from "@reelstorm/media";
import type { Job } from "bullmq";
import { trackJob } from "../lib.js";

export type FetchTemplateIntrosData = {
  categories?: IntroStockCategory[];
  perCategoryTarget?: number;
  perQuery?: number;
};

export async function fetchTemplateIntrosJob(job: Job<FetchTemplateIntrosData>) {
  const categories = job.data.categories?.length
    ? job.data.categories
    : [...INTRO_STOCK_CATEGORIES];
  const perCategoryTarget = job.data.perCategoryTarget ?? INTROS_PER_CATEGORY_TARGET;
  const perQuery = job.data.perQuery ?? INTROS_PER_QUERY;

  const summary: Array<{
    category: string;
    query: string;
    source: string;
    saved: number;
    skipped: number;
  }> = [];

  let totalSaved = 0;

  for (const category of categories) {
    const existing = await prisma.introTemplate.count({
      where: { type: "intro", category },
    });
    let remaining = Math.max(0, perCategoryTarget - existing);
    if (remaining <= 0) {
      summary.push({
        category,
        query: "(skip)",
        source: "cache",
        saved: 0,
        skipped: existing,
      });
      continue;
    }

    const queries = INTRO_STOCK_QUERIES[category] || [];
    for (const query of queries) {
      if (remaining <= 0) break;

      const { source, videos } = await fetchIntroWithFallback(query, {
        perPage: Math.max(perQuery * 3, 12),
      });

      let saved = 0;
      let skipped = 0;

      for (const video of videos) {
        if (remaining <= 0 || saved >= perQuery) break;

        const dup = await prisma.introTemplate.findUnique({
          where: {
            source_externalId: { source: video.source, externalId: video.externalId },
          },
        });
        if (dup) {
          skipped += 1;
          continue;
        }

        try {
          const cached = await downloadAndCacheIntro(video, category);
          const name =
            video.tags[0] ||
            `${category} intro ${video.externalId}`.replace(/\b\w/g, (c) => c.toUpperCase());

          await prisma.introTemplate.create({
            data: {
              type: "intro",
              category,
              name: name.slice(0, 120),
              source: video.source,
              externalId: video.externalId,
              r2Key: cached.r2Key,
              r2Url: cached.r2Url,
              thumbnailUrl: video.thumbnailUrl,
              coverUrl: cached.coverUrl || video.thumbnailUrl,
              durationSec: video.durationSec,
              tags: video.tags.length ? video.tags : query.split(/\s+/),
              license:
                video.source === "pixabay" ? "pixabay-free-commercial" : "free-commercial",
              query,
              bytes: BigInt(cached.bytes),
              meta: {
                pageUrl: video.pageUrl,
                user: video.user,
                commercial: true,
                attribution: false,
                attributionRequired: false,
                licenseNote: `${video.source}-free-commercial`,
              },
            },
          });
          saved += 1;
          remaining -= 1;
          totalSaved += 1;
        } catch (e) {
          console.warn(
            `[fetchTemplateIntros] skip ${video.source}:${video.externalId} — ${(e as Error).message}`,
          );
          skipped += 1;
        }
      }

      summary.push({ category, query, source, saved, skipped });
      await job.updateProgress({
        category,
        query,
        totalSaved,
        remaining,
      });
    }
  }

  const result = {
    ok: true,
    totalSaved,
    summary,
    counts: await Promise.all(
      INTRO_STOCK_CATEGORIES.map(async (c) => ({
        category: c,
        count: await prisma.introTemplate.count({ where: { type: "intro", category: c } }),
      })),
    ),
  };

  if (job.id) {
    await trackJob("fetchTemplateIntros", String(job.id), "COMPLETED", job.data, { result });
  }
  return result;
}
