/**
 * STORM Guide — system knowledge + workflow improvement options
 * Used by API (LLM grounding) and web (instant page tips).
 */

export type GuideOption = {
  id: string;
  label: string;
  /** What the bot should explain / do when clicked */
  prompt: string;
  href?: string;
  kind: "learn" | "do" | "improve" | "goto";
};

export type GuideLayer = {
  path: string | RegExp;
  layer: string;
  title: string;
  blurb: string;
  tips: string[];
  options: GuideOption[];
};

export const GUIDE_SYSTEM_PROMPT = `You are STORM Guide — the in-product AI coach for REELSTORM ACADEMY OS.

Mission:
- Teach system knowledge (Factory = OS, RTC, ARCHIVE5, Soul ID, STORM pipeline, BOT Director Wizard).
- Improve the operator's workflow with concrete next actions.
- Stay concise: 2–5 short paragraphs or bullets max.
- Always offer 2–4 actionable options when helpful (as plain text like "→ Option: …").
- Never invent API keys or claim jobs finished unless the user said so.
- Prefer factory order: BOT Director Wizard or Template Forge → World Builder → Storyboard → Studio → Sound Studio → Archive Vault → Merge Studio.
- Sound Studio is the voice OS (sync · extract · mux · library). Hosted TTS/clone providers are optional — never block operators on ElevenLabs.
- Soft launch: Ollama may power the guide LLM; Stripe test + mock video are OK until live DashScope/Seedance/sk_live keys are stamped.
- RTC rule: 1 RTC = 1 minute of finished master (720p). One 5-min ARCHIVE5 set = 5 RTC. Tiers: Free Test $0 · Basic $49 (3 sets, 720p) · Premium $99 (5 sets, 1080p hero) · Premium Pro $199 (10 sets).

Tone: sharp producer, not corporate. Brand colors mentally: violet / cyan / orange on void black.`;

export const GUIDE_LAYERS: GuideLayer[] = [
  {
    path: "/",
    layer: "marketing",
    title: "Landing",
    blurb: "Brand-first entry to the production OS factory.",
    tips: [
      "REELSTORM is not a course player — it is a factory that vaults ARCHIVE5 IP.",
      "Start in Template Forge or flip the Training Manual first.",
    ],
    options: [
      { id: "train", label: "Flip training guide", prompt: "Walk me through the training manual path.", href: "/training", kind: "goto" },
      { id: "factory", label: "See factory map", prompt: "Explain the six STORM stages simply.", href: "/how-it-works", kind: "learn" },
      { id: "forge", label: "Open Template Forge", prompt: "What should I do first in Template Forge?", href: "/template-forge", kind: "do" },
      { id: "pricing", label: "RTC pricing", prompt: "Explain RTC and Journey tiers for my use case.", href: "/pricing", kind: "learn" },
    ],
  },
  {
    path: "/training",
    layer: "marketing",
    title: "Training Manual",
    blurb: "Flip-over artifact — screen-by-screen operator training (21 pages).",
    tips: [
      "Use arrow keys or Flip to advance; Index jumps to any chapter.",
      "Match each system image to the live OS screen before moving on.",
      "New chapters: BOT Director Wizard + Sound Studio as voice OS.",
    ],
    options: [
      { id: "rules", label: "System rules first", prompt: "Summarize Section A system rules I must not break.", kind: "learn" },
      { id: "wizard", label: "BOT Director path", prompt: "How does BOT Director Wizard fit before Template Forge?", href: "/wizard", kind: "goto" },
      { id: "ops", label: "Operator path", prompt: "Give me the fastest operator path Wizard→Merge.", kind: "improve" },
      { id: "sound", label: "Sound Studio chapter", prompt: "How do I use Sound Studio after reading the guide?", href: "/sound-studio", kind: "goto" },
    ],
  },
  {
    path: "/how-it-works",
    layer: "marketing",
    title: "Factory Map",
    blurb: "Seven stages · zero timeline scrubbing.",
    tips: [
      "Lock intent before pixels — Story Contract + optional reference URL (or run BOT Director Wizard).",
      "Soul ID + room plates before STORM render.",
      "Sound Studio owns voice after Studio QC — before or alongside vault.",
    ],
    options: [
      { id: "stages", label: "Explain 7 stages", prompt: "Explain each STORM stage and common failure mode.", kind: "learn" },
      { id: "wizard", label: "Start with Wizard", prompt: "Should I use BOT Director Wizard or Template Forge first?", href: "/wizard", kind: "improve" },
      { id: "start", label: "Start production", prompt: "I am ready — what is my first click?", href: "/template-forge", kind: "do" },
    ],
  },
  {
    path: "/pricing",
    layer: "marketing",
    title: "RTC Pricing",
    blurb: "Sell sets. Meter minutes.",
    tips: [
      "1 RTC = 1 min master · 1 set = 5 RTC.",
      "Basic $49 locks 720p; Premium $99 unlocks 1080p (YouTuber hero).",
      "Overage packs: 10 / 25 / 50 RTC when a month goes viral.",
    ],
    options: [
      { id: "pick", label: "Which tier?", prompt: "Help me pick Basic vs Premium for 4 videos/month.", kind: "improve" },
      { id: "wallet", label: "Open wallet", prompt: "How do I check balance and see −5 RTC on squeeze?", href: "/wallet", kind: "goto" },
      { id: "wl", label: "White-label packs", prompt: "How do academies buy RTC for their brand?", href: "/white-label", kind: "learn" },
    ],
  },
  {
    path: "/white-label",
    layer: "marketing",
    title: "White-label",
    blurb: "Academies run ReelStorm under their brand.",
    tips: [
      "Provision tenant → rs_live_ key → call /v1/wl/*.",
      "Never expose live keys in client apps.",
    ],
    options: [
      { id: "provision", label: "Provision steps", prompt: "Step-by-step white-label tenant setup.", kind: "do" },
      { id: "api", label: "Developer docs", prompt: "Show the minimum API smoke path.", href: "/developers", kind: "goto" },
    ],
  },
  {
    path: "/developers",
    layer: "marketing",
    title: "API",
    blurb: "Health → generate → vault with RTC debit.",
    tips: ["Authorization: Bearer rs_live_…", "Same ledger rules as the console."],
    options: [
      { id: "smoke", label: "Smoke path", prompt: "Give curl examples for health, generate, from-url.", kind: "learn" },
      { id: "sound-api", label: "Sound API?", prompt: "Which Sound Studio endpoints can academies call?", kind: "learn" },
    ],
  },
  {
    path: "/producers",
    layer: "marketing",
    title: "Producers",
    blurb: "For YouTubers, artists, advert outlets.",
    tips: ["Volume without slop — vault blocks, then merge masters."],
    options: [
      { id: "workflow", label: "Producer workflow", prompt: "Design a weekly producer workflow on ReelStorm.", kind: "improve" },
      { id: "enter", label: "Enter factory", prompt: "Take me into production.", href: "/dashboard", kind: "goto" },
    ],
  },
  {
    path: "/dashboard",
    layer: "os",
    title: "Dashboard",
    blurb: "Command center — welcome by name, jobs, RTC, shortcuts.",
    tips: [
      "Check LIVE ENGINE + RTC before queuing Studio.",
      "Open jobs should clear before Merge.",
      "Prefer BOT Director Wizard for a guided first project.",
    ],
    options: [
      { id: "next", label: "What next?", prompt: "Based on a fresh project, what should I do next?", kind: "improve" },
      { id: "wizard", label: "Open Wizard", prompt: "Walk me through BOT Director Wizard stages 1–7.", href: "/wizard", kind: "do" },
      { id: "forge", label: "Start Forge", prompt: "Open Template Forge and tell me the first 3 clicks.", href: "/template-forge", kind: "do" },
      { id: "rtc", label: "Check RTC", prompt: "How do I know if I have enough RTC for 2 ARCHIVE5 blocks?", href: "/wallet", kind: "goto" },
    ],
  },
  {
    path: "/wizard",
    layer: "os",
    title: "BOT Director Wizard",
    blurb: "Seven-stage blueprint → Live Engine → factory handoff.",
    tips: [
      "Stages: Brief → Cast → World → Beats → Voice → Render → Ship.",
      "POST /api/blueprint/generate then watch /ws/blueprint/:id.",
      "When READY, send from-blueprint into the STORM factory.",
    ],
    options: [
      { id: "stages", label: "Explain 7 stages", prompt: "Explain each BOT Director Wizard stage and what I must enter.", kind: "learn" },
      { id: "generate", label: "Generate blueprint", prompt: "How do I generate a blueprint and know it succeeded?", kind: "do" },
      { id: "handoff", label: "Into factory", prompt: "How do I hand a blueprint off to Template Forge / Studio?", kind: "improve" },
      { id: "forge", label: "Skip to Forge", prompt: "When should I skip the Wizard and go straight to Template Forge?", href: "/template-forge", kind: "goto" },
    ],
  },
  {
    path: "/templates-room",
    layer: "os",
    title: "Templates Room",
    blurb: "Nollywood · Nigeria, Asia cinema, drama, thriller, ads, intros — ideals as DNA.",
    tips: [
      "Start with Nollywood or Asia packs for regional shorts; filter by category.",
      "Open a card → Use ideal to spawn a project + sample script; customize in Storyboard.",
      "Extract your own style DNA in Template Forge when ideals aren't enough.",
    ],
    options: [
      { id: "nollywood", label: "Nollywood pick", prompt: "Which Nollywood Nigeria template fits a Lagos family drama short?", kind: "improve" },
      { id: "asia", label: "Asia cinema pick", prompt: "Recommend an Asia template — K-drama, Bollywood, anime, or SEA food.", kind: "improve" },
      { id: "drama", label: "Drama ideals", prompt: "Which drama template should I start with for an emotional short?", kind: "improve" },
      { id: "forge", label: "Extract my own", prompt: "When should I leave Templates Room for Template Forge?", href: "/template-forge", kind: "goto" },
    ],
  },
  {
    path: "/template-forge",
    layer: "os",
    title: "Template Forge",
    blurb: "Steal style DNA from MP4 or YouTube URL.",
    tips: [
      "Paste URL or drop MP4 — wait for analysis stages to hit READY.",
      "Apply template to a project before World Builder.",
      "Or start from curated ideals in Templates Room.",
    ],
    options: [
      { id: "url", label: "URL extract tips", prompt: "Best practices for YouTube reference extract.", kind: "improve" },
      { id: "fail", label: "Analysis stuck?", prompt: "My analysis is stuck — troubleshooting checklist.", kind: "learn" },
      { id: "room", label: "Browse ideals", prompt: "Show me Templates Room categories.", href: "/templates-room", kind: "goto" },
      { id: "world", label: "Next: World Builder", prompt: "After template is ready, exact World Builder steps.", href: "/world-builder", kind: "do" },
    ],
  },
  {
    path: "/world-builder",
    layer: "os",
    title: "World Builder",
    blurb: "Soul ID + 4-angle room plates.",
    tips: [
      "Wrong first frame = wrong master — lock Soul before STORM.",
      "Reuse Soul across ARCHIVE5 blocks in a series.",
    ],
    options: [
      { id: "soul", label: "Lock Soul ID", prompt: "How do I lock Soul ID correctly?", kind: "do" },
      { id: "plates", label: "Room plates", prompt: "What are the 4 angles and why lighting lock?", kind: "learn" },
      { id: "board", label: "Next: Storyboard", prompt: "Move me to storyboard with a clean checklist.", href: "/storyboard", kind: "goto" },
    ],
  },
  {
    path: "/storyboard",
    layer: "os",
    title: "Storyboard",
    blurb: "Beat map under 5 minutes per ARCHIVE5.",
    tips: ["Break script into timed beats the STORM engine can parallelize."],
    options: [
      { id: "beats", label: "Beat sizing", prompt: "How long should each beat be for ARCHIVE5?", kind: "improve" },
      { id: "studio", label: "Queue Studio", prompt: "Board approved — how do I queue Studio?", href: "/studio", kind: "do" },
    ],
  },
  {
    path: "/studio",
    layer: "os",
    title: "Studio",
    blurb: "STORM parallel render + QC.",
    tips: ["Retry only failed blocks; never re-render passed QC."],
    options: [
      { id: "qc", label: "QC gates", prompt: "Explain QC pass/fail and what to do on fail.", kind: "learn" },
      { id: "sound", label: "Add audio next?", prompt: "Should I sync voice before or after vault?", href: "/sound-studio", kind: "improve" },
      { id: "vault", label: "Vault blocks", prompt: "How do I promote QC-pass blocks to ARCHIVE5?", href: "/archive-vault", kind: "do" },
    ],
  },
  {
    path: "/sound-studio",
    layer: "os",
    title: "Sound Studio",
    blurb: "Voice OS — sync · extract · mux · library.",
    tips: [
      "Sound Studio owns all voice work; hosted clone/TTS keys are optional.",
      "Sync needs a Template Forge uploadId + audio file/URL/asset.",
      "Extract stems from any video uploadId, then mux back onto picture.",
    ],
    options: [
      { id: "sync", label: "Sync workflow", prompt: "Step-by-step external audio sync onto video.", kind: "do" },
      { id: "extract", label: "Extract stems", prompt: "How do I extract voice/music stems from an upload?", kind: "learn" },
      { id: "library", label: "Voice library", prompt: "How does the voice library work without ElevenLabs?", kind: "improve" },
      { id: "keys", label: "Optional provider", prompt: "When do I need a hosted TTS/clone key in Model Center?", href: "/model-center", kind: "goto" },
    ],
  },
  {
    path: "/archive-vault",
    layer: "os",
    title: "Archive Vault",
    blurb: "Immutable 5-min IP — 5 RTC each (1 RTC/min).",
    tips: ["Tag series/episode/brand so remix stays findable."],
    options: [
      { id: "debit", label: "RTC debit", prompt: "When exactly is RTC debited for ARCHIVE5? (5 RTC per 5-min set)", kind: "learn" },
      { id: "merge", label: "Ready to merge?", prompt: "Checklist before Merge Studio.", href: "/merge-studio", kind: "improve" },
    ],
  },
  {
    path: "/merge-studio",
    layer: "os",
    title: "Merge Studio",
    blurb: "Concatenate ARCHIVE5 → bankable master.",
    tips: ["Never re-unlock Soul during merge — only vault IDs."],
    options: [
      { id: "order", label: "Block order", prompt: "How should I order blocks for a 30-min master?", kind: "improve" },
      { id: "merge", label: "Run merge", prompt: "Exact fields needed for POST /api/merge.", kind: "do" },
    ],
  },
  {
    path: "/wallet",
    layer: "os",
    title: "RTC Wallet",
    blurb: "Balance · sets left · −5 RTC per squeeze.",
    tips: ["Top up before Studio if remaining < 2 sets (10 RTC).", "Basic is 720p-only — upgrade Premium for 1080p."],
    options: [
      { id: "math", label: "RTC math", prompt: "I have 25 RTC — how many 5-min sets can I vault?", kind: "learn" },
      { id: "buy", label: "Buy packs", prompt: "Where do I purchase RTC overage packs?", href: "/pricing", kind: "goto" },
    ],
  },
  {
    path: "/model-center",
    layer: "os",
    title: "Model Center",
    blurb: "DashScope / Ollama LLM · Seedance video · optional Kling/Veo/TTS.",
    tips: [
      "Soft launch minimum: Ollama local LLM (GUIDE_USE_OLLAMA=1) + mock video OK.",
      "Production upgrade: DASHSCOPE_API_KEY + Seedance + MOCK_VIDEO_GEN=0 + sk_live Stripe.",
      "Sound Studio does not require ElevenLabs — provider keys are optional.",
    ],
    options: [
      { id: "min", label: "Minimum keys", prompt: "What is the minimum key set for soft launch vs full production?", kind: "learn" },
      { id: "ollama", label: "Ollama only", prompt: "Can I run orchestration with only Ollama?", kind: "improve" },
      { id: "score", label: "Check scorecard", prompt: "How do I verify Model Center readiness on the scorecard?", href: "/scorecard", kind: "goto" },
    ],
  },
  {
    path: "/scorecard",
    layer: "os",
    title: "Scorecard",
    blurb: "Production readiness gates (v1.5 soft-launch).",
    tips: [
      "Target grade A on /api/readiness before academy launch.",
      "Soft launch: Ollama LLM, Stripe test, mock video can PASS with SOFT_LAUNCH=1.",
      "Swap to DashScope + Seedance + sk_live_ before real charges and real renders.",
    ],
    options: [
      { id: "gaps", label: "Close gaps", prompt: "Typical readiness gaps and how to close them on soft launch.", kind: "improve" },
      { id: "api", label: "API readiness", prompt: "What does /api/readiness check in v1.5?", kind: "learn" },
      { id: "train", label: "Training checklist", prompt: "Point me to the Training Manual launch checklist page.", href: "/training", kind: "goto" },
    ],
  },
  {
    path: "/brand",
    layer: "os",
    title: "Brand",
    blurb: "Tokens for void / violet / cyan / orange.",
    tips: ["Keep brand hero-level on marketing surfaces."],
    options: [
      { id: "tokens", label: "Token map", prompt: "Summarize ReelStorm brand tokens for UI work.", kind: "learn" },
    ],
  },
  {
    path: "/team",
    layer: "os",
    title: "Team",
    blurb: "Producer seats and STORM agent roles.",
    tips: ["Assign voice/world/render roles so jobs do not collide."],
    options: [
      { id: "roles", label: "Role design", prompt: "Suggest team roles for a 3-person Academy studio.", kind: "improve" },
    ],
  },
];

export function resolveGuideLayer(pathname: string): GuideLayer {
  const exact = GUIDE_LAYERS.find((l) => typeof l.path === "string" && l.path === pathname);
  if (exact) return exact;
  const soft = GUIDE_LAYERS.find(
    (l) => typeof l.path === "string" && l.path !== "/" && pathname.startsWith(l.path),
  );
  if (soft) return soft;
  return {
    path: pathname,
    layer: pathname.startsWith("/") && !["/", "/how-it-works", "/training", "/pricing", "/white-label", "/developers", "/producers"].some((p) => pathname === p || pathname.startsWith("/legal"))
      ? "os"
      : "marketing",
    title: "REELSTORM",
    blurb: "STORM Guide is with you on every layer.",
    tips: [
      "Ask how to improve your current workflow.",
      "Or say “what should I do next?” for a concrete path.",
    ],
    options: [
      { id: "next", label: "What next?", prompt: "What should I do next in ReelStorm?", kind: "improve" },
      { id: "map", label: "Factory map", prompt: "Show the factory path briefly.", href: "/how-it-works", kind: "goto" },
      { id: "train", label: "Training", prompt: "Point me to training.", href: "/training", kind: "goto" },
    ],
  };
}

export function buildGuideContextBlock(pathname: string): string {
  const layer = resolveGuideLayer(pathname);
  return [
    `Current path: ${pathname}`,
    `Layer: ${layer.layer} · ${layer.title}`,
    `Blurb: ${layer.blurb}`,
    `Tips:\n- ${layer.tips.join("\n- ")}`,
    `Suggested options:\n${layer.options.map((o) => `- [${o.kind}] ${o.label}: ${o.prompt}${o.href ? ` → ${o.href}` : ""}`).join("\n")}`,
  ].join("\n");
}
