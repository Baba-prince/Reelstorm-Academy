/**
 * Seed helper — prints YT Automation winning topics (DB calendars created on Strategy run).
 * Usage: npx tsx scripts/seedYtOsTopics.ts
 */
import { YT_SEED_WINNING_TOPICS, YT_OS_NICHES, YT_THUMB_VARIANT_PRESETS } from "@reelstorm/domain";

console.log("YT niches:", YT_OS_NICHES.join(", "));
console.log("Thumb presets:", YT_THUMB_VARIANT_PRESETS.map((t) => t.text).join(" · "));
for (const [niche, topics] of Object.entries(YT_SEED_WINNING_TOPICS)) {
  console.log(`\n## ${niche}`);
  for (const t of topics) {
    console.log(`- [${t.winningScore}] ${t.title}`);
  }
}
console.log("\nOK — topics live in @reelstorm/domain; Strategy Agent materializes calendars on analyze.");
