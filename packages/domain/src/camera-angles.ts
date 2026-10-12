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
    label: "Behind The Scenes",
    category: "dario",
    keywords: "behind the scenes, candid crew, making-of, set lights, film set, documentary",
    lens: "35mm",
    movement: "handheld",
    useCase: "Making-of / social proof",
    promptTemplate:
      "{{subject}}, behind the scenes making-of, candid crew and set lights visible, documentary style, 35mm, natural grain, ultra detailed, 8k --ar 16:9",
  },
  {
    command: "/Adcreative",
    label: "Ad Creative",
    category: "dario",
    keywords: "studio lighting, commercial hero, product ad, softbox, clean background, brand",
    lens: "85mm",
    movement: "static",
    useCase: "Ads / brand hero",
    promptTemplate:
      "{{subject}}, commercial ad creative, studio softbox lighting, hero product composition, clean backdrop, 85mm, glossy, ultra detailed, 8k --ar 16:9",
  },
  {
    command: "/Blueprint",
    label: "Blueprint",
    category: "dario",
    keywords: "architectural blueprint, technical drawing, white lines, schematic, CAD",
    lens: "orthographic",
    movement: "static",
    useCase: "Architecture / tech",
    promptTemplate:
      "{{subject}} as architectural blueprint, technical line drawing, white on blue grid, CAD schematic, precise annotations, ultra detailed --ar 16:9",
  },
  {
    command: "/Droneview",
    label: "Drone View",
    category: "dario",
    keywords: "drone aerial, top-down orbit, bird perspective, wide landscape",
    lens: "24mm",
    movement: "drone-orbit",
    useCase: "Establishing / epic",
    promptTemplate:
      "{{subject}}, drone aerial view, elevated orbit, expansive environment, 24mm wide, cinematic dusk light, ultra detailed, 8k --ar 16:9",
  },
  {
    command: "/Explodeview",
    label: "Exploded View",
    category: "dario",
    keywords: "exploded view, internal parts, floating components, technical cutaway",
    lens: "50mm",
    movement: "static",
    useCase: "Product tech",
    promptTemplate:
      "{{subject}} exploded view, floating internal parts separated in space, technical product render, studio lighting, ultra detailed, 8k --ar 16:9",
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
    keywords: "low angle, looking up, powerful, heroic, worm's eye variant",
    lens: "24mm",
    movement: "static",
    useCase: "Heroic / power",
    promptTemplate:
      "{{subject}}, low angle shot, looking up, powerful heroic presence, 24mm, dramatic lighting, cinematic, ultra detailed, 8k --ar 16:9",
  },
  {
    command: "/HighAngle",
    label: "High Angle",
    category: "angle",
    keywords: "high angle, looking down, overview, vulnerable",
    lens: "35mm",
    movement: "static",
    useCase: "Overview / vulnerability",
    promptTemplate:
      "{{subject}}, high angle shot looking down, spatial overview, 35mm, soft shadows, cinematic, ultra detailed, 8k --ar 16:9",
  },
  {
    command: "/BirdsEye",
    label: "Bird's Eye",
    category: "angle",
    keywords: "bird's eye, straight top-down, 90 degrees",
    lens: "28mm",
    movement: "static",
    useCase: "Map / layout",
    promptTemplate:
      "{{subject}}, bird's eye view straight top-down 90 degrees, geometric composition, 28mm, even lighting, ultra detailed, 8k --ar 1:1",
  },
  {
    command: "/WormsEye",
    label: "Worm's Eye",
    category: "angle",
    keywords: "worm's eye, extreme low, sky background",
    lens: "18mm",
    movement: "static",
    useCase: "Monumental",
    promptTemplate:
      "{{subject}}, worm's eye extreme low angle, sky filling frame, towering subject, 18mm ultra wide, dramatic clouds, 8k --ar 9:16",
  },
  {
    command: "/DutchAngle",
    label: "Dutch Angle",
    category: "angle",
    keywords: "dutch angle, tilted horizon, tension, 15-30 degrees",
    lens: "35mm",
    movement: "static",
    useCase: "Tension / thriller",
    promptTemplate:
      "{{subject}}, dutch angle tilted 25 degrees, uneasy tension, 35mm, contrasty lighting, cinematic, ultra detailed, 8k --ar 16:9",
  },
  {
    command: "/OverShoulder",
    label: "Over The Shoulder",
    category: "angle",
    keywords: "over-the-shoulder, OTS, dialogue depth, foreground shoulder",
    lens: "50mm",
    movement: "static",
    useCase: "Dialogue",
    promptTemplate:
      "{{subject}}, over-the-shoulder shot, foreground shoulder blur, depth of field, 50mm, cinematic dialogue framing, 8k --ar 16:9",
  },
  {
    command: "/POV",
    label: "Point Of View",
    category: "angle",
    keywords: "POV, first-person, subjective camera",
    lens: "28mm",
    movement: "handheld",
    useCase: "Immersion",
    promptTemplate:
      "{{subject}}, first-person POV shot, subjective camera, immersive, 28mm, slight handheld feel, ultra detailed, 8k --ar 16:9",
  },
  {
    command: "/CloseUp",
    label: "Close-Up",
    category: "angle",
    keywords: "close-up, face details, intimate, 85mm",
    lens: "85mm",
    movement: "static",
    useCase: "Emotion",
    promptTemplate:
      "{{subject}}, close-up shot, intimate detail, shallow depth of field, 85mm portrait lens, soft bokeh, 8k --ar 16:9",
  },
  {
    command: "/ExtremeCloseUp",
    label: "Extreme Close-Up",
    category: "angle",
    keywords: "extreme close-up, eyes lips texture, macro face",
    lens: "100mm macro",
    movement: "static",
    useCase: "Texture / emotion",
    promptTemplate:
      "{{subject}}, extreme close-up, skin and texture detail, 100mm macro, cinematic lighting, ultra detailed, 8k --ar 16:9",
  },
  {
    command: "/MediumShot",
    label: "Medium Shot",
    category: "angle",
    keywords: "medium shot, waist up, conversational",
    lens: "50mm",
    movement: "static",
    useCase: "Character",
    promptTemplate:
      "{{subject}}, medium shot waist-up, 50mm, natural lighting, cinematic color grade, ultra detailed, 8k --ar 16:9",
  },
  {
    command: "/WideShot",
    label: "Wide Shot",
    category: "angle",
    keywords: "wide shot, full body, environment context",
    lens: "35mm",
    movement: "static",
    useCase: "Context",
    promptTemplate:
      "{{subject}}, wide shot full body in environment, 35mm, environmental storytelling, cinematic, 8k --ar 16:9",
  },
  {
    command: "/ExtremeWide",
    label: "Extreme Wide",
    category: "angle",
    keywords: "extreme wide, landscape establishing, tiny subject",
    lens: "24mm",
    movement: "static",
    useCase: "Establishing",
    promptTemplate:
      "{{subject}}, extreme wide establishing shot, vast landscape, tiny subject scale, 24mm, epic light, 8k --ar 21:9",
  },
  {
    command: "/Macro",
    label: "Macro Detail",
    category: "angle",
    keywords: "macro, extreme product texture, detail insert",
    lens: "100mm macro",
    movement: "static",
    useCase: "Product detail",
    promptTemplate:
      "{{subject}}, macro extreme detail, surface texture, 100mm macro lens, studio soft light, ultra detailed, 8k --ar 1:1",
  },
  {
    command: "/Isometric",
    label: "Isometric",
    category: "angle",
    keywords: "isometric, 3D game style, 30-degree axonometric",
    lens: "isometric",
    movement: "static",
    useCase: "Game / UI",
    promptTemplate:
      "{{subject}}, isometric 3D game style view, 30-degree axonometric, clean renders, vibrant, ultra detailed, 8k --ar 1:1",
  },
  {
    command: "/Cutaway",
    label: "Cutaway Insert",
    category: "angle",
    keywords: "cutaway, detail insert, secondary angle",
    lens: "50mm",
    movement: "static",
    useCase: "Edit insert",
    promptTemplate:
      "{{subject}}, cutaway detail insert shot, focused secondary object, 50mm, cinematic, ultra detailed, 8k --ar 16:9",
  },
  // Movements
  {
    command: "/DollyIn",
    label: "Dolly In",
    category: "movement",
    keywords: "dolly in, push in, emotional approach",
    lens: "35mm",
    movement: "dolly-in",
    useCase: "Emotion build",
    promptTemplate:
      "{{subject}}, cinematic dolly-in push toward subject, emotional intensity, 35mm, smooth motion feel, 8k --ar 16:9",
  },
  {
    command: "/DollyOut",
    label: "Dolly Out",
    category: "movement",
    keywords: "dolly out, pull back, reveal",
    lens: "35mm",
    movement: "dolly-out",
    useCase: "Reveal",
    promptTemplate:
      "{{subject}}, dolly-out reveal of environment, expanding frame, 35mm, cinematic, 8k --ar 16:9",
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
    label: "Crane Up",
    category: "movement",
    keywords: "crane up, rising majestic, boom",
    lens: "24mm",
    movement: "crane-up",
    useCase: "Epic finish",
    promptTemplate:
      "{{subject}}, crane-up rising majestic shot, boom lift, 24mm wide, golden hour, cinematic, 8k --ar 16:9",
  },
  {
    command: "/Orbit",
    label: "Orbit 360",
    category: "movement",
    keywords: "orbit 360, circle around subject",
    lens: "35mm",
    movement: "orbit",
    useCase: "Showcase",
    promptTemplate:
      "{{subject}}, 360 orbit around subject, circular camera path, 35mm, cinematic lighting, 8k --ar 16:9",
  },
  {
    command: "/DroneOrbit",
    label: "Drone Orbit",
    category: "movement",
    keywords: "drone orbit, circular aerial",
    lens: "24mm",
    movement: "drone-orbit",
    useCase: "Aerial showcase",
    promptTemplate:
      "{{subject}}, drone circular orbit aerial, sweeping motion, 24mm, cinematic dusk, 8k --ar 16:9",
  },
  {
    command: "/PushIn",
    label: "Push In Zoom",
    category: "movement",
    keywords: "push in, slow zoom, Hitchcock variant",
    lens: "50mm",
    movement: "push-in",
    useCase: "Tension",
    promptTemplate:
      "{{subject}}, slow push-in zoom, intensifying focus, 50mm, cinematic, ultra detailed, 8k --ar 16:9",
  },
  {
    command: "/PullOut",
    label: "Pull Out",
    category: "movement",
    keywords: "pull out, zoom out reveal",
    lens: "35mm",
    movement: "pull-out",
    useCase: "Context",
    promptTemplate:
      "{{subject}}, pull-out zoom revealing environment, 35mm, cinematic, 8k --ar 16:9",
  },
  // Lens & style
  {
    command: "/35mm",
    label: "35mm Documentary",
    category: "lens",
    keywords: "35mm lens, natural, documentary",
    lens: "35mm",
    movement: "static",
    useCase: "Docu / realism",
    promptTemplate:
      "{{subject}}, shot on 35mm lens, natural documentary look, subtle grain, available light, ultra detailed, 8k --ar 16:9",
  },
  {
    command: "/85mm",
    label: "85mm Portrait",
    category: "lens",
    keywords: "85mm portrait, creamy bokeh",
    lens: "85mm",
    movement: "static",
    useCase: "Portrait",
    promptTemplate:
      "{{subject}}, 85mm portrait lens, creamy bokeh, flattering compression, soft key light, ultra detailed, 8k --ar 4:5",
  },
  {
    command: "/Anamorphic",
    label: "Anamorphic Cinema",
    category: "lens",
    keywords: "anamorphic, cinematic bars, horizontal flare",
    lens: "anamorphic 40mm",
    movement: "static",
    useCase: "Film look",
    promptTemplate:
      "{{subject}}, anamorphic cinematic lens, horizontal lens flare, letterbox feel, teal-orange grade, 8k --ar 2.39:1",
  },
  {
    command: "/Fisheye",
    label: "Fisheye",
    category: "lens",
    keywords: "fisheye, distorted wide, dynamic",
    lens: "fisheye 8mm",
    movement: "static",
    useCase: "Dynamic / sport",
    promptTemplate:
      "{{subject}}, fisheye ultra-wide distortion, dynamic energy, 8mm fisheye, bold colors, ultra detailed, 8k --ar 1:1",
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
