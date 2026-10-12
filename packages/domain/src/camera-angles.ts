/**
 * Camera Angle Prompt Studio — Dario 5 upgraded to 30+ cinematography taxonomy
 */

export const CAMERA_RTC_ANALYSIS = 2;
export const CAMERA_RTC_PREVIEW = 1;

export type CameraCommandCategory = "dario" | "angle" | "movement" | "lens";

export type CameraCommandDef = {
  command: string;
  label: string;
  category: CameraCommandCategory;
  keywords: string;
  lens: string;
  movement: string;
  useCase: string;
  /** Template — {{subject}} replaced at generate time */
  promptTemplate: string;
};

export const CAMERA_COMMANDS: CameraCommandDef[] = [
  // Dario custom 5
  {
    command: "/BTS",
    label: "Behind The Scenes Raw",
    category: "dario",
    keywords: "behind the scenes, candid crew, set, making-of, documentary, 35mm",
    lens: "35mm",
    movement: "handheld",
    useCase: "BTS Documentary",
    promptTemplate:
      "behind the scenes photo of {{subject}}, candid crew in background, film set, making-of documentary style, 35mm lens, natural set lighting, grain, ultra detailed, 8k --ar 16:9",
  },
  {
    command: "/Adcreative",
    label: "Ad Creative Hero",
    category: "dario",
    keywords: "studio lighting, commercial, product hero, clean background, 85mm bokeh, ad creative",
    lens: "85mm",
    movement: "static",
    useCase: "Commercial",
    promptTemplate:
      "studio commercial shot of {{subject}}, product hero centered, clean seamless background, 85mm lens bokeh, softbox lighting, ad creative, ultra detailed, 8k --ar 16:9",
  },
  {
    command: "/Blueprint",
    label: "Technical Blueprint",
    category: "dario",
    keywords: "architectural drawing, technical lines, white background, blueprint, detailed",
    lens: "orthographic",
    movement: "static",
    useCase: "Tech Doc",
    promptTemplate:
      "architectural blueprint of {{subject}}, technical line drawing, white background, blueprint style, detailed measurements, isometric, ultra detailed, 8k --ar 16:9",
  },
  {
    command: "/Droneview",
    label: "Droneview Aerial",
    category: "dario",
    keywords: "aerial view, top-down, drone orbit, bird's eye, 24mm, expansive",
    lens: "24mm",
    movement: "drone-orbit",
    useCase: "Establishing",
    promptTemplate:
      "aerial drone view of {{subject}}, top-down orbit, bird's eye perspective, 24mm wide lens, expansive environment, dramatic shadows, cinematic, ultra detailed",
  },
  {
    command: "/Explodeview",
    label: "Exploded Deconstruction",
    category: "dario",
    keywords: "exploded view, internal parts visible, product deconstruction, technical",
    lens: "50mm",
    movement: "static",
    useCase: "Product Tech",
    promptTemplate:
      "exploded view of {{subject}}, internal parts floating visible, product deconstruction, technical illustration, separated components, white studio, ultra detailed, 8k --ar 16:9",
  },
  // Angles
  {
    command: "/EyeLevel",
    label: "Eye Level",
    category: "angle",
    keywords: "eye-level, neutral perspective, natural viewpoint",
    lens: "35mm",
    movement: "static",
    useCase: "Dialogue / natural",
    promptTemplate:
      "{{subject}}, eye-level medium shot, neutral natural perspective, 35mm documentary lens, soft light, ultra detailed, 8k --ar 16:9",
  },
  {
    command: "/LowAngle",
    label: "Low Angle Heroic",
    category: "angle",
    keywords: "low angle, worm's eye view, looking up, powerful, heroic",
    lens: "24mm",
    movement: "static",
    useCase: "Heroic",
    promptTemplate:
      "low angle shot of {{subject}}, looking up, powerful heroic perspective, 24mm lens, dramatic lighting, sky background, cinematic, ultra detailed, 8k --ar 16:9",
  },
  {
    command: "/HighAngle",
    label: "High Angle Vulnerable",
    category: "angle",
    keywords: "high angle, looking down, vulnerable, overview, 35mm",
    lens: "35mm",
    movement: "static",
    useCase: "Narrative",
    promptTemplate:
      "high angle shot of {{subject}}, camera looking down, vulnerable overview, 35mm lens, soft natural lighting, cinematic, ultra detailed",
  },
  {
    command: "/BirdsEye",
    label: "Bird's Eye Top-Down",
    category: "angle",
    keywords: "bird's eye, top-down, overhead, flatlay, 24mm, graphic",
    lens: "28mm",
    movement: "static",
    useCase: "Establishing",
    promptTemplate:
      "bird's eye top-down overhead shot of {{subject}}, flatlay composition, 24mm lens, graphic shadows, ultra detailed, cinematic, 8k --ar 16:9",
  },
  {
    command: "/WormsEye",
    label: "Worm's Eye Extreme Low",
    category: "angle",
    keywords: "worm's eye, extreme low, ground level, towering, 18mm",
    lens: "18mm",
    movement: "static",
    useCase: "Power",
    promptTemplate:
      "worm's eye extreme low angle shot, ground level camera, {{subject}} towering above, 18mm ultra wide, dramatic perspective, cinematic",
  },
  {
    command: "/DutchAngle",
    label: "Dutch Tilt Tension",
    category: "angle",
    keywords: "dutch angle, tilted horizon, tension, uneasy, 35mm",
    lens: "35mm",
    movement: "static",
    useCase: "Thriller",
    promptTemplate:
      "dutch angle tilted shot of {{subject}}, canted horizon 15 degrees, tension uneasy feeling, 35mm lens, moody lighting, cinematic",
  },
  {
    command: "/OverShoulder",
    label: "Over Shoulder",
    category: "angle",
    keywords: "over shoulder, OTS, third person, dialogue, 50mm",
    lens: "50mm",
    movement: "static",
    useCase: "Dialogue",
    promptTemplate:
      "over the shoulder shot of {{subject}}, foreground shoulder out of focus, 50mm lens, shallow depth of field, dialogue framing, cinematic",
  },
  {
    command: "/POV",
    label: "POV First Person",
    category: "angle",
    keywords: "POV, first person, subjective, immersive, hands visible, 35mm",
    lens: "28mm",
    movement: "handheld",
    useCase: "Immersive",
    promptTemplate:
      "POV first person shot, {{subject}}ive camera, immersive hands visible in frame, 35mm lens, natural perspective, cinematic, ultra detailed",
  },
  {
    command: "/CloseUp",
    label: "Close Up Intimate",
    category: "angle",
    keywords: "close up, intimate, facial detail, shallow depth, 85mm",
    lens: "85mm",
    movement: "static",
    useCase: "Emotion",
    promptTemplate:
      "close up shot of {{subject}}, intimate facial detail, shallow depth of field, 85mm lens, softbox key light, bokeh background, ultra detailed",
  },
  {
    command: "/ExtremeCloseUp",
    label: "Extreme Close Up",
    category: "angle",
    keywords: "extreme close up, ECU, texture, pores, macro detail, 100mm",
    lens: "100mm macro",
    movement: "static",
    useCase: "Detail",
    promptTemplate:
      "extreme close up shot of {{subject}}, texture detail, pores visible, 100mm macro lens, dramatic lighting, ultra detailed 8k --ar 16:9",
  },
  {
    command: "/MediumShot",
    label: "Medium Shot Classic",
    category: "angle",
    keywords: "medium shot, waist up, balanced, classic framing, 50mm",
    lens: "50mm",
    movement: "static",
    useCase: "Standard",
    promptTemplate:
      "medium shot of {{subject}}, waist up framing, balanced composition, 50mm lens, natural lighting, rule of thirds, cinematic, ultra detailed",
  },
  {
    command: "/WideShot",
    label: "Wide Shot Environmental",
    category: "angle",
    keywords: "wide shot, environmental, full body, context, 35mm",
    lens: "35mm",
    movement: "static",
    useCase: "Context",
    promptTemplate:
      "wide shot of {{subject}}, full body with environment, contextual background, 35mm lens, location lighting, cinematic, ultra detailed",
  },
  {
    command: "/ExtremeWide",
    label: "Extreme Wide Epic",
    category: "angle",
    keywords: "extreme wide, epic scale, landscape, tiny subject, 18mm",
    lens: "24mm",
    movement: "static",
    useCase: "Epic",
    promptTemplate:
      "extreme wide epic shot, vast landscape, {{subject}} tiny in frame, 18mm ultra wide lens, epic scale, atmospheric, cinematic 8k --ar 16:9",
  },
  {
    command: "/Macro",
    label: "Macro Detail",
    category: "angle",
    keywords: "macro, super detail, miniature world, 100mm macro, focus stack",
    lens: "100mm macro",
    movement: "static",
    useCase: "Product",
    promptTemplate:
      "macro shot of {{subject}}, super detail miniature world, 100mm macro lens, focus stacked, studio lighting, ultra detailed, 8k --ar 16:9",
  },
  {
    command: "/Isometric",
    label: "Isometric 3D",
    category: "angle",
    keywords: "isometric, 3D render, 30 degree, clean, orthographic",
    lens: "isometric",
    movement: "static",
    useCase: "3D Concept",
    promptTemplate:
      "isometric view of {{subject}}, 30 degree orthographic projection, clean 3D render style, soft shadows, studio lighting, ultra detailed",
  },
  {
    command: "/Cutaway",
    label: "Cutaway Insert",
    category: "angle",
    keywords: "cutaway, insert shot, detail object, B-roll, 50mm",
    lens: "50mm",
    movement: "static",
    useCase: "B-Roll",
    promptTemplate:
      "cutaway insert shot, detail of object related to {{subject}}, B-roll style, 50mm lens, shallow depth, cinematic",
  },
  // Movements
  {
    command: "/DollyIn",
    label: "Dolly In Push",
    category: "movement",
    keywords: "dolly in, push in, tension building, slow movement, 35mm",
    lens: "35mm",
    movement: "dolly-in",
    useCase: "Tension",
    promptTemplate:
      "dolly in movement shot of {{subject}}, camera pushing in slowly, tension building, 35mm lens, parallax, cinematic, ultra detailed",
  },
  {
    command: "/DollyOut",
    label: "Dolly Out Reveal",
    category: "movement",
    keywords: "dolly out, pull back, reveal, context expanding, 35mm",
    lens: "35mm",
    movement: "dolly-out",
    useCase: "Reveal",
    promptTemplate:
      "dolly out reveal shot of {{subject}}, camera pulling back expanding context, 35mm lens, reveal environment, cinematic",
  },
  {
    command: "/PanLeft",
    label: "Pan",
    category: "movement",
    keywords: "pan left right, horizontal sweep",
    lens: "35mm",
    movement: "pan",
    useCase: "Space reveal",
    promptTemplate:
      "{{subject}}, cinematic pan across scene, horizontal sweep, 35mm, motion blur accents, 8k --ar 16:9",
  },
  {
    command: "/TiltUp",
    label: "Tilt Up",
    category: "movement",
    keywords: "tilt up, vertical reveal",
    lens: "35mm",
    movement: "tilt-up",
    useCase: "Scale reveal",
    promptTemplate:
      "{{subject}}, tilt-up vertical reveal, rising reveal of subject, 35mm, cinematic, 8k --ar 9:16",
  },
  {
    command: "/CraneUp",
    label: "Crane Up Ascend",
    category: "movement",
    keywords: "crane up, ascending, god view, rising, 24mm",
    lens: "24mm",
    movement: "crane-up",
    useCase: "Epic Reveal",
    promptTemplate:
      "crane up ascending shot of {{subject}}, camera rising to god view, 24mm wide lens, dramatic lift, cinematic epic",
  },
  {
    command: "/Orbit",
    label: "Orbit 360",
    category: "movement",
    keywords: "orbit, 360 rotation, circular, dynamic, 35mm",
    lens: "35mm",
    movement: "orbit",
    useCase: "Hero Turntable",
    promptTemplate:
      "orbit 360 shot around {{subject}}, circular camera movement, dynamic rotation, 35mm lens, parallax background, cinematic, ultra detailed",
  },
  {
    command: "/DroneOrbit",
    label: "Drone Orbit Top",
    category: "movement",
    keywords: "drone orbit, aerial circle, sweeping, expansive, 24mm",
    lens: "24mm",
    movement: "drone-orbit",
    useCase: "Location",
    promptTemplate:
      "drone orbit aerial circle around {{subject}}, sweeping top view, expansive movement, 24mm lens, cinematic drone",
  },
  {
    command: "/PushIn",
    label: "Push In Focus",
    category: "movement",
    keywords: "push in, slow zoom, focus pull, intimate, 85mm",
    lens: "50mm",
    movement: "push-in",
    useCase: "Drama",
    promptTemplate:
      "slow push in shot on {{subject}}, focus pull to eyes, intimate intensity, 85mm lens, shallow depth, cinematic",
  },
  {
    command: "/PullOut",
    label: "Pull Out Isolation",
    category: "movement",
    keywords: "pull out, isolation, leaving, wider context, 35mm",
    lens: "35mm",
    movement: "pull-out",
    useCase: "Isolation",
    promptTemplate:
      "pull out isolation shot, camera retreating from {{subject}}, wider context revealing loneliness, 35mm lens, cinematic",
  },
  // Lens & style
  {
    command: "/35mm",
    label: "35mm Natural",
    category: "lens",
    keywords: "35mm lens, natural perspective, documentary, human eye",
    lens: "35mm",
    movement: "static",
    useCase: "Natural",
    promptTemplate:
      "35mm lens natural perspective shot of {{subject}}, documentary human eye view, natural distortion, cinematic, ultra detailed",
  },
  {
    command: "/85mm",
    label: "85mm Portrait Bokeh",
    category: "lens",
    keywords: "85mm lens, portrait, creamy bokeh, compression, flattering",
    lens: "85mm",
    movement: "static",
    useCase: "Portrait",
    promptTemplate:
      "85mm portrait lens shot of {{subject}}, creamy bokeh background, lens compression, flattering, studio lighting, ultra detailed",
  },
  {
    command: "/Anamorphic",
    label: "Anamorphic Cinematic",
    category: "lens",
    keywords: "anamorphic, 2.39:1, lens flare, oval bokeh, cinematic bars",
    lens: "anamorphic 40mm",
    movement: "static",
    useCase: "Cinema",
    promptTemplate:
      "anamorphic lens shot of {{subject}}, 2.39:1 widescreen, horizontal lens flare, oval bokeh, cinematic bars, ultra detailed 8k --ar 16:9",
  },
  {
    command: "/Fisheye",
    label: "Fisheye Distorted",
    category: "lens",
    keywords: "fisheye, ultra wide distortion, 8mm, skate, immersive warp",
    lens: "fisheye 8mm",
    movement: "static",
    useCase: "Action",
    promptTemplate:
      "fisheye lens distorted shot of {{subject}}, 8mm ultra wide warp, immersive skate perspective, curved horizon, cinematic",
  },
];

export const CAMERA_PIPELINE_STEPS = [
  { id: "UPLOADING", label: "Upload", n: "01" },
  { id: "EXTRACTING", label: "Extract", n: "02" },
  { id: "ANALYZING", label: "Analyze", n: "03" },
  { id: "GENERATING_PROMPTS", label: "Prompts", n: "04" },
  { id: "DONE", label: "Done", n: "05" },
] as const;

export function classifyCameraSource(
  url: string,
  mimeOrExt?: string,
): "IMAGE" | "VIDEO" | "YOUTUBE_URL" | "INSTAGRAM_URL" {
  const u = (url || "").toLowerCase();
  if (u.includes("instagram.com") || u.includes("instagr.am")) return "INSTAGRAM_URL";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YOUTUBE_URL";
  const m = (mimeOrExt || "").toLowerCase();
  if (/\.(jpe?g|png|webp|gif)$/i.test(m) || m.startsWith("image/")) return "IMAGE";
  if (/\.(mp4|mov|webm|m4v)$/i.test(m) || m.startsWith("video/")) return "VIDEO";
  if (u && !u.includes("http")) {
    if (/\.(jpe?g|png|webp)$/i.test(u)) return "IMAGE";
    if (/\.(mp4|mov|webm)$/i.test(u)) return "VIDEO";
  }
  return "VIDEO";
}

export type CameraPromptRow = {
  command: string;
  label: string;
  category: CameraCommandCategory;
  keywords: string;
  prompt: string;
  lens: string;
  movement: string;
  useCase: string;
  previewR2Url?: string;
};

export function buildPromptPack(
  subject: string,
  commands: CameraCommandDef[] = CAMERA_COMMANDS,
): CameraPromptRow[] {
  const sub = subject.trim() || "the subject";
  return commands.map((c) => ({
    command: c.command,
    label: c.label,
    category: c.category,
    keywords: c.keywords,
    prompt: c.promptTemplate.replace(/\{\{subject\}\}/g, sub),
    lens: c.lens,
    movement: c.movement,
    useCase: c.useCase,
  }));
}

/** Soft-launch seed analysis when vision unavailable */
export const CAMERA_SEED_ANALYSIS = {
  currentAngle: "Eye-level medium shot",
  detectedLens: "35mm",
  composition: "Rule of thirds",
  lighting: "Soft natural / softbox",
  subject: "the main subject in frame",
  confidence: 0.82,
  engine: "soft-launch-seed",
};
