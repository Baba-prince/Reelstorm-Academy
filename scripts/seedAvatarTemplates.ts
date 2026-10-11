/**
 * Seed Avatar Model Studio templates (MissTechy / HeyGen workflow).
 * Usage: npx tsx scripts/seedAvatarTemplates.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env") });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEMPLATES = [
  {
    slug: "unknown-to-expert",
    name: "Unknown to Expert WITHOUT FILMING",
    category: "General",
    thumbnailUrl: "https://videos.reelstorm.uk/videos/835b782996b24d4c81655f507e1acf62.mp4",
    hookTemplate: "HOW TO GO FROM {UNKNOWN} TO {EXPERT} WITHOUT FILMING",
    scriptPromptTemplate:
      "LOOK FOR A LOCAL NEWS OR UPDATE AND BUILD A 30 SECOND SCRIPT AROUND IT WITH A GREAT HOOK AND VIRALITY. Open with the Unknown→Expert WITHOUT FILMING hook. End with a clear CTA.",
    backgroundJson: {
      type: "transformation",
      from: "bedroom",
      to: "glass-office",
      hologram: true,
      captionStyle: "yellow-handwritten",
    },
    duration: 30,
    rtcCost: 5,
    sortOrder: 1,
  },
  {
    slug: "news-update-authority",
    name: "News Update Authority",
    category: "AI",
    thumbnailUrl: "https://videos.reelstorm.uk/videos/835b782996b24d4c81655f507e1acf62.mp4",
    hookTemplate: "ON AIR — {NICHE} update your audience needs today",
    scriptPromptTemplate:
      "LOOK FOR A LOCAL NEWS OR UPDATE AND BUILD A 30 SECOND SCRIPT AROUND IT WITH A GREAT HOOK AND VIRALITY. Style: ON AIR newsroom authority with B-roll inset. Start with a visual hook (e.g. empty driver's seat / shocking detail), then 2 key facts, then COMMENT EXPERT CTA.",
    backgroundJson: {
      type: "newsroom",
      bRoll: true,
      captionStyle: "yellow-handwritten",
      onAir: true,
    },
    duration: 30,
    rtcCost: 5,
    sortOrder: 2,
  },
  {
    slug: "outfit-carousel",
    name: "Split Outfit Carousel",
    category: "Coaching",
    thumbnailUrl: "https://videos.reelstorm.uk/videos/0b38629b428140499c1305916ec98314.mp4",
    hookTemplate: "Same face. Fresh daily look. Zero re-filming.",
    scriptPromptTemplate:
      "Build a 30 second script that showcases one expert tip while rotating outfit energy. Hook first line in under 2 seconds. End with follow for daily niche updates.",
    backgroundJson: {
      type: "split-carousel",
      clones: 3,
      captionStyle: "white-bold",
    },
    duration: 30,
    rtcCost: 5,
    sortOrder: 3,
  },
  {
    slug: "expert-cta-army",
    name: "Expert CTA Army",
    category: "Coaching",
    thumbnailUrl: "https://videos.reelstorm.uk/videos/835b782996b24d4c81655f507e1acf62.mp4",
    hookTemplate: "Comment EXPERT for the blueprint",
    scriptPromptTemplate:
      "Build a 30 second script ending with three clones holding COMMENT EXPERT signs. Strong hook, one niche insight, hard CTA: comment EXPERT for the blueprint.",
    backgroundJson: {
      type: "cta-army",
      signs: ["COMMENT EXPERT"],
      captionStyle: "yellow-handwritten",
    },
    duration: 30,
    rtcCost: 5,
    sortOrder: 4,
  },
  {
    slug: "pizza-box-ceo",
    name: "Pizza Box to CEO",
    category: "Finance",
    thumbnailUrl: "https://videos.reelstorm.uk/videos/0b38629b428140499c1305916ec98314.mp4",
    hookTemplate: "FROM PIZZA BOX BEDROOM TO BOARDROOM — WITHOUT FILMING",
    scriptPromptTemplate:
      "LOOK FOR A LOCAL NEWS OR UPDATE AND BUILD A 30 SECOND SCRIPT AROUND IT WITH A GREAT HOOK AND VIRALITY. Frame as messy-bedroom strategist → glass-office CEO transformation. Hook in first 3 seconds.",
    backgroundJson: {
      type: "before-after",
      from: "messy-bedroom",
      to: "boardroom",
      captionStyle: "yellow-handwritten",
    },
    duration: 30,
    rtcCost: 5,
    sortOrder: 5,
  },
];

async function main() {
  for (const t of TEMPLATES) {
    await prisma.avatarTemplate.upsert({
      where: { slug: t.slug },
      create: t,
      update: {
        name: t.name,
        category: t.category,
        thumbnailUrl: t.thumbnailUrl,
        hookTemplate: t.hookTemplate,
        scriptPromptTemplate: t.scriptPromptTemplate,
        backgroundJson: t.backgroundJson,
        duration: t.duration,
        rtcCost: t.rtcCost,
        sortOrder: t.sortOrder,
      },
    });
    console.log("upsert", t.slug);
  }
  console.log("Avatar templates seeded:", TEMPLATES.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
