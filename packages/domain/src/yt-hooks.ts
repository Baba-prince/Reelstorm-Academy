/**
 * 21 proven YouTube hook formulas — /rs-script skill.
 * Transformative scripting templates (original wording always rewritten by LLM).
 */

export const YT_HOOK_FORMULAS: Array<{
  id: number;
  name: string;
  pattern: string;
  example: string;
}> = [
  { id: 1, name: "The Mistake", pattern: "I made this mistake so you don't have to…", example: "Stop doing X before it kills your channel" },
  { id: 2, name: "The Secret", pattern: "Nobody tells you this about…", example: "The secret creators hide about growth" },
  { id: 3, name: "The Countdown", pattern: "In the next N seconds…", example: "3…2…1 the tip that changed everything" },
  { id: 4, name: "Impossible", pattern: "This shouldn't be possible — but…", example: "I grew 10k with $0 ads" },
  { id: 5, name: "Before/After", pattern: "Before I did X vs after…", example: "From 12 views → 1M in 90 days" },
  { id: 6, name: "I Did X for 30 Days", pattern: "I tried X every day for 30 days…", example: "Posting Shorts daily for a month" },
  { id: 7, name: "Stop Doing This", pattern: "Stop doing this if you want…", example: "Stop posting without a hook" },
  { id: 8, name: "The $0 to $X", pattern: "From $0 to $X using only…", example: "From $0 to first $1k with Shorts" },
  { id: 9, name: "AI Ran My Channel", pattern: "I let AI run my channel for…", example: "AI ran my channel for 7 days" },
  { id: 10, name: "Nobody's Talking About This", pattern: "Nobody's talking about…", example: "The loophole creators ignore" },
  { id: 11, name: "The 2-Min Fix", pattern: "This 2-minute fix…", example: "Fix your CTR in 2 minutes" },
  { id: 12, name: "3 Tools That…", pattern: "3 tools that…", example: "3 tools that replaced my editor" },
  { id: 13, name: "Exposing…", pattern: "Exposing the truth about…", example: "Exposing fake gurus" },
  { id: 14, name: "The Truth About…", pattern: "The truth about…", example: "The truth about YouTube Shorts" },
  { id: 15, name: "How I…", pattern: "How I…", example: "How I batch 30 Shorts in a day" },
  { id: 16, name: "This is Insane", pattern: "This is insane — …", example: "This retention trick is insane" },
  { id: 17, name: "Don't…", pattern: "Don't do X until you…", example: "Don't upload until you watch this" },
  { id: 18, name: "The Hidden…", pattern: "The hidden reason…", example: "The hidden reason your Shorts flop" },
  { id: 19, name: "I Tried…", pattern: "I tried X so you don't have to…", example: "I tried every AI editor" },
  { id: 20, name: "What I Wish I Knew", pattern: "What I wish I knew before…", example: "What I wish I knew at 0 subs" },
  { id: 21, name: "The Last…", pattern: "The last tip you need…", example: "The last hook formula you'll need" },
];

export function hookById(id: number) {
  return YT_HOOK_FORMULAS.find((h) => h.id === id) || YT_HOOK_FORMULAS[0];
}
