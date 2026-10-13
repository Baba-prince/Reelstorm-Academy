/** AI Podcast Debate Studio — Audio Overview / Multi-Agent / Dual Host */

export const DEBATE_RTC_AUDIO = 15;
export const DEBATE_RTC_VIDEO = 25;

export const DEBATE_PIPELINE_STEPS = [
  "EXTRACTING",
  "ANALYZING",
  "SCRIPTING",
  "GENERATING_AUDIO",
  "GENERATING_VIDEO",
  "MUXING",
  "DONE",
] as const;

export type DebatePipelineStep = (typeof DEBATE_PIPELINE_STEPS)[number];

export const DEBATE_MODES = [
  {
    id: "AUDIO_ONLY",
    label: "Audio Only",
    tip: "Audio Overview — two AI voices (NotebookLM-style podcast)",
  },
  {
    id: "VIDEO_TWO_AVATARS",
    label: "Video · Two Avatars",
    tip: "Two animated AI presenters debating with lip/body sync",
  },
  {
    id: "VIDEO_ONE_AVATAR_SPLIT",
    label: "Video · One Avatar Split",
    tip: "Single twin switches personality / framing mid-episode",
  },
] as const;

export const DEBATE_STYLES = [
  {
    id: "EXPLORE_TOPIC",
    label: "Explore Topic",
    tip: "Hosts discover and unpack the material together",
  },
  {
    id: "EXPLAIN_ARGUMENTS",
    label: "Explain Arguments",
    tip: "Hosts teach the arguments clearly for learners",
  },
  {
    id: "DEBATE_OPPOSING",
    label: "Debate Opposing Viewpoints",
    tip: "AI Debate Simulation — Host A vs Host B",
  },
] as const;

export const DEBATE_PERSONALITIES_A = ["Optimist", "Expert", "Enthusiast"] as const;
export const DEBATE_PERSONALITIES_B = ["Skeptic", "Critic", "Devil's Advocate"] as const;

export type DebatePersona = {
  name: string;
  voiceId?: string;
  avatarId?: string;
  variantId?: string;
  personality: string;
};

export function defaultHostA(): DebatePersona {
  return {
    name: "Alex",
    voiceId: "library-host-a",
    personality: "Optimist",
  };
}

export function defaultHostB(): DebatePersona {
  return {
    name: "Blake",
    voiceId: "library-host-b",
    personality: "Skeptic",
  };
}

export function debateRtcCost(mode: string): number {
  return mode === "AUDIO_ONLY" ? DEBATE_RTC_AUDIO : DEBATE_RTC_VIDEO;
}

export function classifyDebateSource(
  url?: string,
  mimeOrName?: string,
  textTopic?: string,
): "DOCUMENT" | "TRANSCRIPT" | "RECORDING" | "YOUTUBE_URL" | "INSTAGRAM_URL" | "TEXT_TOPIC" | "UPLOAD" {
  const u = (url || "").toLowerCase();
  const m = (mimeOrName || "").toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YOUTUBE_URL";
  if (u.includes("instagram.com") || u.includes("instagr.am")) return "INSTAGRAM_URL";
  if (m.includes("pdf") || m.includes("docx") || m.endsWith(".pdf") || m.endsWith(".docx")) {
    return "DOCUMENT";
  }
  if (
    m.includes("audio") ||
    m.includes("video") ||
    m.endsWith(".mp3") ||
    m.endsWith(".mp4") ||
    m.endsWith(".wav") ||
    m.endsWith(".m4a")
  ) {
    return "RECORDING";
  }
  if (m.endsWith(".txt") || m.includes("text/plain")) return "TRANSCRIPT";
  if ((textTopic || "").trim()) return "TEXT_TOPIC";
  if (url) return "UPLOAD";
  return "TEXT_TOPIC";
}

export const DEBATE_GLOSSARY = [
  {
    term: "Audio Overview",
    def: "Google NotebookLM's name for an AI-generated podcast from your sources (audio only).",
  },
  {
    term: "AI-Generated Podcast",
    def: "Broader term — AI creates a podcast-style conversation from material you provide.",
  },
  {
    term: "Multi-Agent AI Conversation",
    def: "Two AI personas interact with each other, not just read a monologue.",
  },
  {
    term: "AI Debate Simulation",
    def: "AI voices argue different sides — optimist vs skeptic, expert vs critic.",
  },
  {
    term: "Dual Host AI Show",
    def: "ReelStorm format — two hosts, optional Avatar Studio video with body sync.",
  },
] as const;
