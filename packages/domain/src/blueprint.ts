/**
 * BOT Director Wizard — 7-stage Movie Blueprint domain
 * Stages: Welcome → Idea → Script/VO → World → Scenes → Shots → Feed Factory
 */

export const BOT_DIRECTOR_STAGES = [
  { id: "welcome", step: "00", title: "Welcome", meta: "Director bot greets you", engine: "SCRIPT" },
  { id: "idea", step: "01", title: "1st Scene · Idea", meta: "Raw idea or video → 3 loglines", engine: "SCRIPT" },
  { id: "script", step: "02", title: "Script · Voice", meta: "Forge script + ElevenLabs VO", engine: "SCRIPT" },
  { id: "world", step: "03", title: "Hand Scene · World", meta: "Characters + 4-angle locations", engine: "WORLD" },
  { id: "scenes", step: "04", title: "Scene Map", meta: "1st Scene → Hand Scene timeline", engine: "STUDIO" },
  { id: "shots", step: "05", title: "Shot List", meta: "Durations · framing · budget", engine: "ARCHIVE" },
  { id: "feed", step: "06", title: "Feed Factory", meta: "Blueprint → Studio · Archive · Merge", engine: "MERGE" },
] as const;

export type BotDirectorStageId = (typeof BOT_DIRECTOR_STAGES)[number]["id"];

export type BlueprintLogline = {
  id: string;
  text: string;
  tone: string;
  durationSec: number;
  audience: string;
};

export type BlueprintCharacter = {
  id: string;
  stableId: string;
  name: string;
  role: string;
  notes?: string;
};

export type BlueprintLocation = {
  id: string;
  stableId: string;
  name: string;
  angles: number;
  notes?: string;
};

export type BlueprintScene = {
  id: string;
  from: string;
  to: string;
  prompt: string;
  type: "HOOK" | "BUILD" | "PAYOFF" | "CTA";
  startSec: number;
  endSec: number;
};

export type BlueprintShot = {
  id: string;
  sceneId: string;
  type: string;
  dur: number;
  framing: string;
  camera: string;
  status: "ready" | "needs_voice" | "queued";
  note?: string;
};

export type MovieBlueprint = {
  title: string;
  selectedLogline: string;
  loglines: BlueprintLogline[];
  worldBible: {
    characters: BlueprintCharacter[];
    locations: BlueprintLocation[];
    style: { lut: string; grain: number; accent: string };
  };
  sceneMap: BlueprintScene[];
  shotList: BlueprintShot[];
  templateDNA: { templateId?: string; stylePreset: string; aspectRatio: string };
  stableIds: Record<string, string>;
  budget: { rtcEstimate: number; archive5Blocks: number; notes: string };
  voiceover?: { text: string; voiceId?: string };
};

export function slugStable(prefix: string, name: string, index: number): string {
  const clean = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 12);
  return `${prefix}_${clean || "X"}_${String(index).padStart(2, "0")}`;
}
