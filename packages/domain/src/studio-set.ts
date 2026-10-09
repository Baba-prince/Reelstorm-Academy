/**
 * Full Studio Set — Studio Room (scene backgrounds) + Artist Studio (cast)
 * + Imagery Studio (style packs). Locks production before Director generate.
 */

import { z } from "zod";

/** Angles the camera can touch on a set or artist */
export const StudioAngleSchema = z.enum([
  "wide",
  "medium",
  "osh",
  "close",
  "insert",
  "establishing",
  "reaction",
  "front",
  "left",
  "right",
  "threeQuarter",
]);
export type StudioAngle = z.infer<typeof StudioAngleSchema>;

export const CORE_SET_ANGLES: StudioAngle[] = [
  "establishing",
  "wide",
  "medium",
  "osh",
  "close",
];

export const CORE_ARTIST_ANGLES: StudioAngle[] = [
  "front",
  "left",
  "right",
  "threeQuarter",
];

export const PlateMapSchema = z.record(StudioAngleSchema, z.string().optional());
export type PlateMap = z.infer<typeof PlateMapSchema>;

export const SceneSetSchema = z.object({
  id: z.string(),
  studioSetId: z.string(),
  name: z.string().min(1),
  locationKind: z.string().default("generic"),
  requiredAngles: z.array(StudioAngleSchema).default(CORE_SET_ANGLES),
  plates: PlateMapSchema.default({}),
  promptDna: z.string().optional(),
  lightingNotes: z.string().optional(),
  lut: z.string().optional(),
  locked: z.boolean().default(false),
  seedPackId: z.string().optional(),
});
export type SceneSet = z.infer<typeof SceneSetSchema>;

export const ArtistProfileSchema = z.object({
  id: z.string(),
  studioSetId: z.string(),
  soulId: z.string().optional(),
  name: z.string().min(1),
  role: z.string().default("lead"),
  wardrobeNotes: z.string().optional(),
  bodyNotes: z.string().optional(),
  requiredAngles: z.array(StudioAngleSchema).default(CORE_ARTIST_ANGLES),
  plates: PlateMapSchema.default({}),
  importSource: z
    .enum(["upload", "image_url", "video_url", "manual", "seed"])
    .default("manual"),
  importUrl: z.string().optional(),
  locked: z.boolean().default(false),
});
export type ArtistProfile = z.infer<typeof ArtistProfileSchema>;

export const ImageryPackSchema = z.object({
  id: z.string(),
  studioSetId: z.string(),
  name: z.string().min(1),
  stylePreset: z.string(),
  aesthetic: z.string().optional(),
  prompt: z.string().min(1),
  customizedPrompt: z.string().optional(),
  sceneSetId: z.string().optional(),
  lut: z.string().optional(),
  mood: z.array(z.string()).default([]),
  locked: z.boolean().default(false),
});
export type ImageryPack = z.infer<typeof ImageryPackSchema>;

export const StudioSetSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string().default("Studio Set"),
  status: z.enum(["draft", "building", "ready", "applied"]).default("draft"),
  completenessPct: z.number().min(0).max(100).default(0),
  rooms: z.array(SceneSetSchema).default([]),
  artists: z.array(ArtistProfileSchema).default([]),
  imagery: z.array(ImageryPackSchema).default([]),
  appliedAt: z.string().datetime().optional(),
});
export type StudioSet = z.infer<typeof StudioSetSchema>;

export type AngleReadiness = {
  angle: StudioAngle;
  status: "pass" | "fail";
  key?: string;
};

export type EntityReadiness = {
  id: string;
  name: string;
  kind: "room" | "artist" | "imagery";
  pct: number;
  angles: AngleReadiness[];
  ready: boolean;
};

export type StudioSetReadiness = {
  studioSetId: string;
  pct: number;
  ready: boolean;
  softLaunchPartial: boolean;
  rooms: EntityReadiness[];
  artists: EntityReadiness[];
  imagery: EntityReadiness[];
  blocking: string[];
};

function plateReady(plates: Record<string, string | undefined>, angle: string): boolean {
  const v = plates[angle];
  return Boolean(v && v !== "pending" && v.trim().length > 0);
}

export function scoreEntityAngles(
  id: string,
  name: string,
  kind: "room" | "artist" | "imagery",
  required: StudioAngle[],
  plates: Record<string, string | undefined>,
): EntityReadiness {
  const angles: AngleReadiness[] = required.map((angle) => ({
    angle,
    status: plateReady(plates, angle) ? "pass" : "fail",
    key: plates[angle],
  }));
  const pass = angles.filter((a) => a.status === "pass").length;
  const pct = required.length ? Math.round((pass / required.length) * 100) : 100;
  return { id, name, kind, pct, angles, ready: pct >= 100 };
}

export function evaluateStudioSetReadiness(input: {
  id: string;
  rooms: Array<{
    id: string;
    name: string;
    requiredAngles: StudioAngle[];
    plates: Record<string, string | undefined>;
  }>;
  artists: Array<{
    id: string;
    name: string;
    requiredAngles: StudioAngle[];
    plates: Record<string, string | undefined>;
  }>;
  imagery: Array<{ id: string; name: string; prompt: string; locked?: boolean }>;
  softLaunch?: boolean;
}): StudioSetReadiness {
  const rooms = input.rooms.map((r) =>
    scoreEntityAngles(r.id, r.name, "room", r.requiredAngles, r.plates),
  );
  const artists = input.artists.map((a) =>
    scoreEntityAngles(a.id, a.name, "artist", a.requiredAngles, a.plates),
  );
  const imagery: EntityReadiness[] = input.imagery.map((i) => ({
    id: i.id,
    name: i.name,
    kind: "imagery",
    pct: i.prompt?.trim() ? 100 : 0,
    angles: [],
    ready: Boolean(i.prompt?.trim()),
  }));

  const entities = [...rooms, ...artists, ...imagery];
  const pct = entities.length
    ? Math.round(entities.reduce((s, e) => s + e.pct, 0) / entities.length)
    : 0;
  const blocking: string[] = [];
  for (const r of rooms) if (!r.ready) blocking.push(`room:${r.name}`);
  for (const a of artists) if (!a.ready) blocking.push(`artist:${a.name}`);
  for (const i of imagery) if (!i.ready) blocking.push(`imagery:${i.name}`);

  const softLaunchPartial = Boolean(input.softLaunch) && pct >= 60 && pct < 100;
  const ready =
    blocking.length === 0 && rooms.length > 0 && artists.length > 0
      ? true
      : softLaunchPartial;

  return {
    studioSetId: input.id,
    pct,
    ready: blocking.length === 0 && rooms.length > 0 && artists.length > 0,
    softLaunchPartial,
    rooms,
    artists,
    imagery,
    blocking,
  };
}

/** Seed pack: Courtroom Drama — complete multi-angle set before production */
export type CourtroomAngleSpec = {
  angle: StudioAngle;
  label: string;
  prompt: string;
  cameraTip: string;
};

export const COURTROOM_DRAMA_PACK = {
  id: "courtroom_drama",
  name: "Courtroom Drama",
  locationKind: "courtroom",
  stylePreset: "Legal Drama · Procedural",
  lut: "cool_contrast",
  mood: ["tense", "formal", "dramatic"],
  aesthetic:
    "Cinematic legal drama courtroom — oak bench, flags, gallery pews, cool practicals, 24mm–85mm coverage",
  basePrompt:
    "Cinematic courtroom interior, oak judge bench, jury box, counsel tables, gallery, soft cool window light, film still, photoreal",
  requiredAngles: CORE_SET_ANGLES as StudioAngle[],
  angles: [
    {
      angle: "establishing",
      label: "Establishing — full court",
      prompt:
        "Ultra-wide establishing shot of a full courtroom from the rear gallery: judge bench, flags, jury box, counsel tables, pews, cinematic legal drama lighting",
      cameraTip: "Start wide so the audience knows geography before any dialogue.",
    },
    {
      angle: "wide",
      label: "Bench wide",
      prompt:
        "Wide shot facing the judge bench and flags, empty counsel tables in foreground, formal courtroom, cool practical lights",
      cameraTip: "Bench wide locks authority and architecture for the scene.",
    },
    {
      angle: "medium",
      label: "Counsel medium",
      prompt:
        "Medium shot at counsel table eye-level, legal pads and microphones, shallow depth, courtroom background soft",
      cameraTip: "Counsel medium is your dialogue workhorse — keep eyelines consistent.",
    },
    {
      angle: "osh",
      label: "Witness OSH",
      prompt:
        "Over-shoulder from counsel toward the witness stand, judge soft in background, tense legal drama framing",
      cameraTip: "OSH sells confrontation — keep shoulder soft, subject sharp.",
    },
    {
      angle: "close",
      label: "Gavel / insert close",
      prompt:
        "Extreme close insert of wooden gavel on sound block, courtroom bokeh, dramatic legal thriller still",
      cameraTip: "Inserts (gavel, papers) cut tension without moving the camera tour.",
    },
  ] satisfies CourtroomAngleSpec[],
  defaultCast: [
    { name: "Judge", role: "judge" },
    { name: "Prosecutor", role: "counsel" },
    { name: "Defense", role: "counsel" },
    { name: "Witness", role: "witness" },
  ],
  guideTips: [
    "Tour the court before locking: establishing → bench wide → counsel medium → witness OSH → gavel close.",
    "Every character the camera will touch needs front / left / right / 3Q plates — fresh angles per scene if wardrobe changes.",
    "Do not Apply to Director until Room + Artist readiness is green (or soft-launch partial ≥60%).",
  ],
} as const;

export const STUDIO_SET_SEED_PACKS = [COURTROOM_DRAMA_PACK] as const;

export function roomPlatesFromAngleMap(
  plates: Record<string, string | undefined>,
): { wide?: string; medium?: string; overShoulder?: string; close?: string } {
  return {
    wide: plates.wide || plates.establishing,
    medium: plates.medium,
    overShoulder: plates.osh,
    close: plates.close || plates.insert,
  };
}

export function soulAnglesFromPlateMap(
  plates: Record<string, string | undefined>,
): { front?: string; left?: string; right?: string; threeQuarter?: string } {
  return {
    front: plates.front,
    left: plates.left,
    right: plates.right,
    threeQuarter: plates.threeQuarter,
  };
}
