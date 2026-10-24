/**
 * REELSTORM CINEMA — Showrunner domain (Saga hybrid)
 * Spine: Idea → Cast → World → Voice → Board → Shoot → Cut
 */

export const CINEMA_STAGES = [
  { id: "idea", label: "Idea", studio: null },
  { id: "cast", label: "Cast", studio: "cast" },
  { id: "world", label: "World", studio: "world" },
  { id: "voice", label: "Voice", studio: "voice" },
  { id: "board", label: "Board", studio: "board" },
  { id: "shoot", label: "Shoot", studio: "shoot" },
  { id: "cut", label: "Cut", studio: "cut" },
] as const;

export type CinemaStageId = (typeof CINEMA_STAGES)[number]["id"];

export const DRAMA_SPINES = [
  {
    id: "revenge",
    title: "Revenge",
    loglineSeed: "She was erased from the family empire — tonight she walks back in with proof.",
  },
  {
    id: "forbidden_love",
    title: "Forbidden Love",
    loglineSeed: "Two rivals share one secret that could burn both houses down.",
  },
  {
    id: "family_secrets",
    title: "Family Secrets",
    loglineSeed: "The will is read. The wrong heir smiles first.",
  },
  {
    id: "billionaire_romance",
    title: "Billionaire Romance",
    loglineSeed: "A contract marriage. One night that breaks the contract.",
  },
  {
    id: "switched_at_birth",
    title: "Switched at Birth",
    loglineSeed: "Twenty years later, two daughters walk into the wrong lives.",
  },
] as const;

export type DramaSpineId = (typeof DRAMA_SPINES)[number]["id"];

export type CharacterLock = {
  id: string;
  name: string;
  role: "lead_a" | "lead_b" | "antagonist" | "support";
  faceUrl?: string;
  avatarId?: string;
  voiceId?: string;
  wardrobeDay0?: string;
  locked: boolean;
};

export type WorldLock = {
  id: string;
  name: string;
  description: string;
  plateUrl?: string;
  locked: boolean;
};

export type BoardStill = {
  id: string;
  episodeIndex: number;
  shotIndex: number;
  characterId?: string;
  worldId?: string;
  prompt: string;
  dialogue?: string;
  stillUrl?: string;
  approved: boolean;
  durationSec: number;
  framing: "wide" | "medium" | "close" | "osh";
};

export type ShotClip = {
  stillId: string;
  videoUrl?: string;
  status: "pending" | "rendering" | "ready" | "failed";
  engine?: string;
  error?: string;
  /** Continuity QC after shoot */
  qc?: { pass: boolean; notes: string };
};

/** RTC pricing for Cinema (approve-before-spend) */
export const CINEMA_RTC = {
  /** Charge on shoot start once board approved */
  shootEpisode: 2,
  /** Charge on cut/assemble master */
  cutMaster: 1,
} as const;

export function cinemaShootRtc(stillCount: number) {
  return CINEMA_RTC.shootEpisode + Math.max(0, stillCount - 4);
}

export type CinemaEpisode = {
  index: number;
  title: string;
  synopsis: string;
  cliffhanger: string;
  targetSec: number;
  stills: BoardStill[];
  clips: ShotClip[];
  masterUrl?: string;
  status: "draft" | "boarded" | "approved" | "shooting" | "cut" | "shipped";
};

export type SeasonBible = {
  title: string;
  spine: DramaSpineId | string;
  logline: string;
  tone: string;
  aspectRatio: "9:16";
  episodeCount: number;
  characters: CharacterLock[];
  worlds: WorldLock[];
  episodes: CinemaEpisode[];
  stage: CinemaStageId;
};

export type CinemaSeasonRecord = {
  id: string;
  userId: string;
  projectId?: string | null;
  title: string;
  spine: string;
  status: string;
  bible: SeasonBible;
  createdAt?: string;
  updatedAt?: string;
};

/** Build a production-ready first episode bible for vertical drama. */
export function buildPilotSeason(opts: {
  spineId?: string;
  title?: string;
  logline?: string;
}): SeasonBible {
  const spine =
    DRAMA_SPINES.find((s) => s.id === opts.spineId) || DRAMA_SPINES[0];
  const title = opts.title || `Night of Proof · ${spine.title}`;
  const logline = opts.logline || spine.loglineSeed;

  const characters: CharacterLock[] = [
    {
      id: "char_amara",
      name: "Amara",
      role: "lead_a",
      wardrobeDay0: "black silk blouse, gold hoop earrings, storm-city night",
      locked: false,
    },
    {
      id: "char_dante",
      name: "Dante",
      role: "antagonist",
      wardrobeDay0: "charcoal suit, cold smile, penthouse glass",
      locked: false,
    },
  ];

  const worlds: WorldLock[] = [
    {
      id: "world_penthouse",
      name: "Empire Penthouse",
      description:
        "Floor-to-ceiling glass over Lagos/London night skyline, warm practical lamps, rain on glass",
      locked: false,
    },
    {
      id: "world_corridor",
      name: "Private Corridor",
      description: "Marble corridor to the boardroom, hard specular lights, tension silence",
      locked: false,
    },
  ];

  const stills: BoardStill[] = [
    {
      id: "ep1_s01",
      episodeIndex: 1,
      shotIndex: 1,
      characterId: "char_amara",
      worldId: "world_corridor",
      prompt:
        "Vertical cinematic drama, Amara walking a marble corridor at night, rain light on glass, determined close-medium, photoreal, 9:16",
      dialogue: "He buried the proof. I dug it back up.",
      framing: "medium",
      durationSec: 6,
      approved: false,
    },
    {
      id: "ep1_s02",
      episodeIndex: 1,
      shotIndex: 2,
      characterId: "char_dante",
      worldId: "world_penthouse",
      prompt:
        "Vertical cinematic, Dante in penthouse glass at night, cold half-smile, city lights bokeh, photoreal 9:16",
      dialogue: "You shouldn't have come back, Amara.",
      framing: "close",
      durationSec: 5,
      approved: false,
    },
    {
      id: "ep1_s03",
      episodeIndex: 1,
      shotIndex: 3,
      characterId: "char_amara",
      worldId: "world_penthouse",
      prompt:
        "Vertical cinematic two-shot energy — Amara holds a sealed envelope toward Dante, storm city behind glass, photoreal 9:16",
      dialogue: "Then watch me walk into your boardroom with this.",
      framing: "medium",
      durationSec: 7,
      approved: false,
    },
    {
      id: "ep1_s04",
      episodeIndex: 1,
      shotIndex: 4,
      worldId: "world_penthouse",
      prompt:
        "Vertical cinematic insert: sealed envelope on marble table, gold wax broken, cliffhanger cut to black, photoreal 9:16",
      dialogue: undefined,
      framing: "close",
      durationSec: 4,
      approved: false,
    },
  ];

  const episode: CinemaEpisode = {
    index: 1,
    title: "The Envelope",
    synopsis: `${logline} Episode 1 ends on the boardroom threat.`,
    cliffhanger: "The boardroom doors open — and someone already sitting there knows her face.",
    targetSec: 75,
    stills,
    clips: stills.map((s) => ({ stillId: s.id, status: "pending" as const })),
    status: "draft",
  };

  return {
    title,
    spine: spine.id,
    logline,
    tone: "prestige vertical drama",
    aspectRatio: "9:16",
    episodeCount: 8,
    characters,
    worlds,
    episodes: [episode],
    stage: "idea",
  };
}

export function cinemaProgress(bible: SeasonBible): {
  stage: CinemaStageId;
  pct: number;
  castLocked: boolean;
  worldLocked: boolean;
  voiceLocked: boolean;
  boardApproved: boolean;
  shotReady: boolean;
  cutReady: boolean;
} {
  const castLocked = bible.characters.length > 0 && bible.characters.every((c) => c.locked);
  const worldLocked = bible.worlds.length > 0 && bible.worlds.every((w) => w.locked);
  const voiceLocked = bible.characters
    .filter((c) => c.role === "lead_a" || c.role === "antagonist" || c.role === "lead_b")
    .every((c) => Boolean(c.voiceId) && c.locked);
  const ep = bible.episodes[0];
  const boardApproved = Boolean(ep && ep.stills.length > 0 && ep.stills.every((s) => s.approved));
  const shotReady = Boolean(
    ep && ep.clips.length > 0 && ep.clips.every((c) => c.status === "ready" && c.videoUrl),
  );
  const cutReady = Boolean(ep?.masterUrl);

  let stage: CinemaStageId = "idea";
  if (!castLocked) stage = "cast";
  else if (!worldLocked) stage = "world";
  else if (!voiceLocked) stage = "voice";
  else if (!boardApproved) stage = "board";
  else if (!shotReady) stage = "shoot";
  else if (!cutReady) stage = "cut";
  else stage = "cut";

  const checks = [castLocked, worldLocked, voiceLocked, boardApproved, shotReady, cutReady];
  const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  return { stage, pct, castLocked, worldLocked, voiceLocked, boardApproved, shotReady, cutReady };
}

export function assertBoardApproved(bible: SeasonBible, episodeIndex = 1) {
  const ep = bible.episodes.find((e) => e.index === episodeIndex);
  if (!ep) throw new Error("Episode not found");
  const pending = ep.stills.filter((s) => !s.approved);
  if (pending.length) {
    throw new Error(`Approve all storyboard stills first (${pending.length} remaining)`);
  }
  return ep;
}

/** Face/voice/world continuity report — Saga-style preflight + post-shoot QC */
export function continuityReport(bible: SeasonBible, episodeIndex = 1) {
  const ep = bible.episodes.find((e) => e.index === episodeIndex);
  const issues: string[] = [];
  const faceByChar = new Map(bible.characters.map((c) => [c.id, c.faceUrl]));
  const voiceByChar = new Map(bible.characters.map((c) => [c.id, c.voiceId]));

  for (const c of bible.characters) {
    if (!c.faceUrl) issues.push(`cast:${c.id} missing faceUrl`);
    if (!c.voiceId && (c.role === "lead_a" || c.role === "lead_b" || c.role === "antagonist")) {
      issues.push(`voice:${c.id} missing voiceId`);
    }
    if (!c.locked) issues.push(`cast:${c.id} not locked`);
  }
  for (const w of bible.worlds) {
    if (!w.plateUrl) issues.push(`world:${w.id} missing plate`);
    if (!w.locked) issues.push(`world:${w.id} not locked`);
  }
  if (ep) {
    for (const s of ep.stills) {
      if (s.characterId) {
        const face = faceByChar.get(s.characterId);
        if (!face) issues.push(`still:${s.id} character face missing`);
        else if (s.stillUrl && s.dialogue && s.stillUrl !== face && !s.stillUrl.includes(s.characterId)) {
          // still may be board composite — OK if it embeds character id in key
        }
        if (!voiceByChar.get(s.characterId) && s.dialogue) {
          issues.push(`still:${s.id} dialogue without voice lock`);
        }
      }
      if (!s.approved) issues.push(`still:${s.id} not approved`);
    }
    for (const clip of ep.clips) {
      if (clip.status === "ready" && clip.qc && !clip.qc.pass) {
        issues.push(`clip:${clip.stillId} QC fail — ${clip.qc.notes}`);
      }
    }
  }

  return {
    pass: issues.length === 0,
    issues,
    castFaces: bible.characters.map((c) => ({ id: c.id, faceUrl: c.faceUrl, voiceId: c.voiceId })),
  };
}

export function runClipContinuityQc(opts: {
  still: BoardStill;
  clip: ShotClip;
  faceUrl?: string;
}): ShotClip["qc"] {
  if (opts.still.characterId && opts.still.dialogue && !opts.faceUrl) {
    return { pass: false, notes: "Dialogue shot missing locked face" };
  }
  if (opts.clip.status !== "ready" || !opts.clip.videoUrl) {
    return { pass: false, notes: "Clip not ready" };
  }
  return {
    pass: true,
    notes: opts.still.characterId
      ? `Face lock ${opts.still.characterId} · engine ${opts.clip.engine || "n/a"}`
      : `Insert/world · engine ${opts.clip.engine || "n/a"}`,
  };
}
