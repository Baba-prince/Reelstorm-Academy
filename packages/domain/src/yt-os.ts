/**
 * REELSTORM YT-OS v2 — 11 Bot Skills (/rs-*)
 * Inside the OS (Seedance + Pixabay + Sound Studio + SystemBank). No external Claude.
 */

import { YT_HOOK_FORMULAS } from "./yt-hooks.js";

export const CLONE_ANALYZE_RTC = 1;
export const CLONE_REPRODUCE_RTC = 5;

export type YtOsSkillId =
  | "rs-viral"
  | "rs-script"
  | "rs-package"
  | "rs-video"
  | "rs-voice"
  | "rs-thumb"
  | "rs-comments"
  | "rs-plan"
  | "rs-publish"
  | "rs-analytics"
  | "rs-clone";

export type YtOsSkill = {
  id: YtOsSkillId;
  slash: `/${YtOsSkillId}`;
  title: string;
  blurb: string;
  rtcCost: number;
  badge: "REELSTORM";
  href: string;
};

export const YT_OS_SKILLS: YtOsSkill[] = [
  {
    id: "rs-viral",
    slash: "/rs-viral",
    title: "Virality Engine",
    blurb: "Find viral in niche, break down TITLE/HOOK/STRUCTURE, rebuild in your voice",
    rtcCost: 1,
    badge: "REELSTORM",
    href: "/yt-os?skill=rs-viral",
  },
  {
    id: "rs-script",
    slash: "/rs-script",
    title: "21 Hook Formulas",
    blurb: "Scripts with 21 proven hooks — Shorts + longform teleprompter",
    rtcCost: 1,
    badge: "REELSTORM",
    href: "/yt-os?skill=rs-script",
  },
  {
    id: "rs-package",
    slash: "/rs-package",
    title: "Titles + Thumbnails + SEO",
    blurb: "5 title variants, 3 thumb concepts, tags + description",
    rtcCost: 2,
    badge: "REELSTORM",
    href: "/yt-os?skill=rs-package",
  },
  {
    id: "rs-video",
    slash: "/rs-video",
    title: "Auto Edit",
    blurb: "Remove dead air / umm, burn captions, retention zoom",
    rtcCost: 1,
    badge: "REELSTORM",
    href: "/yt-os?skill=rs-video",
  },
  {
    id: "rs-voice",
    slash: "/rs-voice",
    title: "Voice Clone",
    blurb: "Sound Studio TTS + clone in your voice / kids / gaming",
    rtcCost: 1,
    badge: "REELSTORM",
    href: "/sound-studio?tab=tts",
  },
  {
    id: "rs-thumb",
    slash: "/rs-thumb",
    title: "Thumbnail AB Lab",
    blurb: "3 variants — shock / curiosity / before-after",
    rtcCost: 1,
    badge: "REELSTORM",
    href: "/yt-os?skill=rs-thumb",
  },
  {
    id: "rs-comments",
    slash: "/rs-comments",
    title: "Comment Bot",
    blurb: "Draft (or auto) replies in your voice + CTA",
    rtcCost: 0,
    badge: "REELSTORM",
    href: "/yt-os?skill=rs-comments",
  },
  {
    id: "rs-plan",
    slash: "/rs-plan",
    title: "Content Calendar",
    blurb: "30-day Long/Short plan from bank RTC budget",
    rtcCost: 0,
    badge: "REELSTORM",
    href: "/yt-os/plan",
  },
  {
    id: "rs-publish",
    slash: "/rs-publish",
    title: "Auto Publish",
    blurb: "YouTube OAuth upload + schedule at best time",
    rtcCost: 0,
    badge: "REELSTORM",
    href: "/yt-os?skill=rs-publish",
  },
  {
    id: "rs-analytics",
    slash: "/rs-analytics",
    title: "Analytics Loop",
    blurb: "Retention + CTR signals feed Strategy Bot",
    rtcCost: 0,
    badge: "REELSTORM",
    href: "/yt-os?skill=rs-analytics",
  },
  {
    id: "rs-clone",
    slash: "/rs-clone",
    title: "Link-to-Video Clone",
    blurb: "Paste viral link → analyze → transformative remake",
    rtcCost: CLONE_ANALYZE_RTC + CLONE_REPRODUCE_RTC,
    badge: "REELSTORM",
    href: "/tools/clone",
  },
];

export const CLONE_STYLES = ["original", "kids", "gaming", "a24"] as const;
export type CloneStyle = (typeof CLONE_STYLES)[number];

export function skillById(id: string): YtOsSkill | undefined {
  return YT_OS_SKILLS.find((s) => s.id === id || s.slash === id || s.slash === `/${id}`);
}

export { YT_HOOK_FORMULAS };
