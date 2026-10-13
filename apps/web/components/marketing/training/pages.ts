export type TrainingPage = {
  id: number;
  section: string;
  title: string;
  /** Short explanatory beat shown under the title */
  lead: string;
  /** Numbered what-to-do steps */
  steps: string[];
  /** Which system mock to render */
  mock:
    | "cover"
    | "index"
    | "philosophy"
    | "rtc"
    | "storm"
    | "soul"
    | "archive5"
    | "dashboard"
    | "wizard"
    | "forge"
    | "world"
    | "storyboard"
    | "studio"
    | "vault"
    | "merge"
    | "wallet"
    | "sound"
    | "ytos"
    | "avatar"
    | "camera"
    | "debate"
    | "whitelabel"
    | "developers"
    | "pricing"
    | "checklist";
  href?: string;
};

export const TRAINING_PAGES: TrainingPage[] = [
  {
    id: 0,
    section: "COVER",
    title: "REELSTORM — Training Manual",
    lead: "Flip-over operator guide v1.7 — new Debate Studio OS layer, Camera Angles, Language Studio, YouTube Automation OS, Avatar, BOT Director.",
    steps: [],
    mock: "cover",
  },
  {
    id: 1,
    section: "INDEX",
    title: "Table of Contents — Flip Index",
    lead: "Tap any chapter to flip instantly. Four sections · 25 pages · Debate Studio + Camera Angles + YouTube Automation included.",
    steps: [],
    mock: "index",
  },
  {
    id: 2,
    section: "A — System Rules",
    title: "Philosophy — Factory = OS",
    lead: "ReelStorm is not a course player. It is a production operating system that turns intent into ARCHIVE5 IP.",
    steps: [
      "Treat every project as a job ticket with a Story Contract.",
      "Never scrub a timeline — lock world, then generate.",
      "Ship searchable blocks, not one-off renders.",
    ],
    mock: "philosophy",
  },
  {
    id: 3,
    section: "A — System Rules",
    title: "RTC Currency Rules",
    lead: "1 RTC = 1 minute of finished master (720p). One 5-min ARCHIVE5 set costs 5 RTC. Sell sets — meter minutes.",
    steps: [
      "Free Test = 1 RTC hook. Basic $49 = 3 sets. Premium $99 = 5 sets (hero). Premium Pro $199 = 10 sets.",
      "Wallet debits 5 RTC when ARCHIVE5 vaults a finished set — LIVE ENGINE shows −5 RTC.",
      "Basic is locked to 720p; 1080p requires Premium+. Overage packs when you go viral.",
    ],
    mock: "rtc",
    href: "/pricing",
  },
  {
    id: 4,
    section: "A — System Rules",
    title: "STORM Pipeline Rules",
    lead: "Seven stages, zero Premiere scrubbing. Each stage is a gated job with QC — Sound Studio owns voice.",
    steps: [
      "Forge (or Wizard) → World → Storyboard → Studio → Sound → Vault → Merge.",
      "Blocks render in parallel; failed QC never reaches vault.",
      "Merge only after ARCHIVE5 entries are immutable.",
    ],
    mock: "storm",
    href: "/how-it-works",
  },
  {
    id: 5,
    section: "A — System Rules",
    title: "Soul ID — Face Lock",
    lead: "If the first face drifts, the master is trash. Soul ID locks identity before generation.",
    steps: [
      "Capture or upload a reference face in World Builder.",
      "Confirm Soul ID hash before any STORM job.",
      "Reuse the same Soul across ARCHIVE5 blocks in a series.",
    ],
    mock: "soul",
    href: "/world-builder",
  },
  {
    id: 6,
    section: "A — System Rules",
    title: "ARCHIVE5 Vault Rules",
    lead: "Every vaulted block is a 5-minute immutable asset — searchable, remixable, merge-ready.",
    steps: [
      "Only QC-passed STORM output enters the vault.",
      "Each entry costs 5 RTC (1 RTC/min) and gets a permanent ID.",
      "Merge Studio consumes vault IDs, never raw temp files.",
    ],
    mock: "archive5",
    href: "/archive-vault",
  },
  {
    id: 7,
    section: "B — Operator Training",
    title: "Dashboard — Start Here",
    lead: "Your command center: welcome by name, live jobs, RTC balance, and shortcuts into each factory stage.",
    steps: [
      "Open Dashboard after sign-in — check LIVE ENGINE status.",
      "Scan open projects and residual RTC before starting work.",
      "Jump to BOT Director Wizard or Template Forge to begin.",
    ],
    mock: "dashboard",
    href: "/dashboard",
  },
  {
    id: 8,
    section: "B — Operator Training",
    title: "BOT Director Wizard — Blueprint",
    lead: "Seven-stage director flow: brief → cast → world → beats → voice → render → ship. Generates a blueprint the factory can run.",
    steps: [
      "Open /wizard and walk stages 1–7 (or skip ahead once you know the path).",
      "Generate a blueprint — Live Engine streams progress over WebSocket.",
      "Send the blueprint into the factory (from-blueprint) when READY.",
    ],
    mock: "wizard",
    href: "/wizard",
  },
  {
    id: 9,
    section: "B — Operator Training",
    title: "Template Forge — Steal the Style",
    lead: "Upload an MP4 or paste a YouTube URL. We extract style DNA so generation has a grammar.",
    steps: [
      "Drop a reference file or paste a public video URL.",
      "Review extracted cut rate, LUT, camera, room, and voice tags.",
      "Apply Generate / attach DNA to your Story Contract, then World Builder.",
    ],
    mock: "forge",
    href: "/template-forge",
  },
  {
    id: 10,
    section: "B — Operator Training",
    title: "World Builder — Lock the Room",
    lead: "Architectum plates: four angles + Soul ID. Wrong first frame = wrong everything.",
    steps: [
      "Generate or upload 4-angle room plates for the scene.",
      "Lock Soul ID and confirm lighting continuity.",
      "Save the world pack before opening Storyboard.",
    ],
    mock: "world",
    href: "/world-builder",
  },
  {
    id: 11,
    section: "B — Operator Training",
    title: "Storyboard — Beat Map",
    lead: "Break the script into beat cards the STORM engine can render as parallel jobs.",
    steps: [
      "Split the script into timed beats under 5 minutes total per ARCHIVE5.",
      "Assign camera intent and dialogue per beat.",
      "Approve the board — this becomes the Studio job queue.",
    ],
    mock: "storyboard",
    href: "/storyboard",
  },
  {
    id: 12,
    section: "B — Operator Training",
    title: "Studio — STORM Render",
    lead: "Parallel block generation with QC gates. Watch jobs, don’t scrub timelines.",
    steps: [
      "Queue the approved storyboard into Studio.",
      "Monitor block status: queued → rendering → QC → ready.",
      "Retry only failed blocks; leave passed blocks alone.",
    ],
    mock: "studio",
    href: "/studio",
  },
  {
    id: 13,
    section: "B — Operator Training",
    title: "Archive Vault — Immutable IP",
    lead: "Vaulted ARCHIVE5 entries are your bankable library — searchable by DNA and Soul.",
    steps: [
      "Confirm RTC debit when promoting a block to vault.",
      "Tag series, episode, and brand so remix stays findable.",
      "Copy vault IDs for Merge Studio or white-label delivery.",
    ],
    mock: "vault",
    href: "/archive-vault",
  },
  {
    id: 14,
    section: "B — Operator Training",
    title: "Merge Studio — Bankable Masters",
    lead: "Assemble vaulted blocks into a continuous master without regenerating faces or rooms.",
    steps: [
      "Load ARCHIVE5 IDs in play order.",
      "Set transitions and audio bed — never re-unlock Soul.",
      "Export the master and archive the merge recipe.",
    ],
    mock: "merge",
    href: "/merge-studio",
  },
  {
    id: 15,
    section: "B — Operator Training",
    title: "RTC Wallet — Spend & Top Up",
    lead: "Balance, ARCHIVE5 remaining, and tier sit on one screen before you burn compute.",
    steps: [
      "Check balanceRtc and archive5Remaining before Studio runs.",
      "Top up via Pricing packs when remaining drops below 2 blocks.",
      "Audit ledger rows if a white-label debit looks wrong.",
    ],
    mock: "wallet",
    href: "/wallet",
  },
  {
    id: 16,
    section: "B — Operator Training",
    title: "Sound Studio — Voice OS",
    lead: "Sound Studio owns sync, stem extract, mux, and the voice library. Hosted clone/TTS providers are optional.",
    steps: [
      "Sync an external bed onto a Template Forge upload (file, URL, or library asset).",
      "Extract full + voice/music stems from any video uploadId.",
      "Mux stems back onto picture; use library voices for clone/TTS only if a provider key is set.",
    ],
    mock: "sound",
    href: "/sound-studio",
  },
  {
    id: 17,
    section: "B — Operator Training",
    title: "YouTube Automation OS — 7 Agents",
    lead: "Without filming: Strategy → Script → Thumbnail → SEO → Production → Publish → Analytics. One Run Full Pipeline ships a video to R2 and reorders your calendar.",
    steps: [
      "Open /yt-os → Create Channel (niche + audience) → confirm 14-day calendar topics appear.",
      "Click Run Full Pipeline (or run agents one-by-one). Watch Pod Status; GPU wakes automatically when Production needs video.",
      "Open the video card → review script, thumbnail A/B, SEO pack → Approve & Publish when ready. Cost: 20 RTC per finished video.",
    ],
    mock: "ytos",
    href: "/yt-os",
  },
  {
    id: 18,
    section: "B — Operator Training",
    title: "Avatar Studio — Talking Head Twin",
    lead: "MissTechy-style avatar with 4 outfits. Production agent uses your twin for talking-head clips — no camera day.",
    steps: [
      "Open /model-center/avatar → pick or generate a face · lock Soul ID · choose Casual / Formal / Street / Studio outfit.",
      "Save the avatar to your channel so YouTube Automation Production can attach it.",
      "Return to /yt-os → Run Production (or Full Pipeline) — VO from Sound Studio muxes onto the avatar clip on videos.reelstorm.uk.",
    ],
    mock: "avatar",
    href: "/model-center/avatar",
  },
  {
    id: 19,
    section: "B — Operator Training",
    title: "Camera Angle Prompt Studio — Dario 5 → 30+",
    lead: "Type this to get this: any image, video, or YouTube/Instagram reel → detect angle → 30+ Flux-ready cinematography prompts including /BTS /Adcreative /Blueprint /Droneview /Explodeview.",
    steps: [
      "Open /camera → drop a still/video or paste a YouTube/Instagram URL → Analyze (2 RTC).",
      "Copy prompts for /BTS, LowAngle, BirdsEye, Orbit… — or Generate Preview (1 RTC) via ComfyUI Flux to R2 camera/preview/.",
      "Send picks to World Builder (4-angle plates), Shot List, or Studio Set — then continue the factory path.",
    ],
    mock: "camera",
    href: "/camera",
  },
  {
    id: 20,
    section: "B — Operator Training",
    title: "Debate Studio — Audio Overview + Dual Hosts",
    lead: "Upload material → two AI hosts explore, explain, or debate opposing viewpoints. NotebookLM Audio Overview is audio-only; ReelStorm adds optional Avatar Studio video with /OverShoulder angles.",
    steps: [
      "Open /debate → drop PDF/DOCX/MP3/MP4 or paste YouTube/Instagram / type a topic → pick AUDIO_ONLY or VIDEO_TWO_AVATARS.",
      "Set Host A (Optimist/Expert) + Host B (Skeptic/Critic) → Debate Opposing → Generate Debate (15 RTC audio · 25 RTC video).",
      "Play audio + video from R2 debate/{id}_* → hand off to Language Studio (de/yo/ha/ig) or YouTube OS publish.",
    ],
    mock: "debate",
    href: "/debate",
  },
  {
    id: 21,
    section: "C — Academy White-label",
    title: "White-label — Your Brand, Our Factory",
    lead: "Academies run ReelStorm under their brand with tenant keys and shared RTC ledgers.",
    steps: [
      "Provision a tenant with brand name + webhook URL.",
      "Issue rs_live_ API keys — never expose them in client apps.",
      "Point your Academy Studio UI at /v1/wl/* endpoints.",
    ],
    mock: "whitelabel",
    href: "/white-label",
  },
  {
    id: 22,
    section: "C — Academy White-label",
    title: "Developers — API Smoke Path",
    lead: "Health → generate → vault. Same RTC rules as the console.",
    steps: [
      "GET /v1/wl/health with Authorization: Bearer rs_live_…",
      "POST /v1/wl/generate with script + optional referenceUrl.",
      "Confirm ARCHIVE5 debit on successful vault.",
    ],
    mock: "developers",
    href: "/developers",
  },
  {
    id: 23,
    section: "C — Academy White-label",
    title: "Pricing — Free / Basic / Premium / Pro",
    lead: "Sell sets, meter minutes. Free Test $0 · Basic $49 (720p) · Premium $99 hero · Premium Pro $199.",
    steps: [
      "Free: 1 RTC, 480p, watermark, no download — FOMO engine.",
      "Basic $49 → 3 sets (15 RTC) · 720p only.",
      "Premium $99 → 5 sets (25 RTC) · 1080p · YouTuber hero. Pro $199 → 10 sets + DNA upload.",
    ],
    mock: "pricing",
    href: "/pricing",
  },
  {
    id: 24,
    section: "D — Launch",
    title: "Production Checklist + Final",
    lead: "Ship when scorecard is green. Soft launch accepts Ollama LLM, Stripe test, and mock video until live keys arrive.",
    steps: [
      "Open /scorecard → RE-SCAN — target grade A (API /api/readiness).",
      "Confirm ffmpeg/ffprobe, Redis db 17, /debate meta, /camera meta, YouTube Automation /yt-os, Avatar Studio, Sound Studio PASS.",
      "Operators trained on Debate Studio or Camera Angles → World Builder / Studio Set, or YouTube Automation → Sound → Vault → Merge.",
    ],
    mock: "checklist",
    href: "/scorecard",
  },
];

export const INDEX_SECTIONS = [
  {
    title: "Section A: System Rules",
    pages: "Pages 2–6",
    color: "#7C3AED",
    items: [
      { id: 2, label: "Philosophy — Factory = OS" },
      { id: 3, label: "RTC Currency Rules" },
      { id: 4, label: "STORM Pipeline Rules" },
      { id: 5, label: "Soul ID — Face Lock" },
      { id: 6, label: "ARCHIVE5 Vault Rules" },
    ],
  },
  {
    title: "Section B: Operator Training",
    pages: "Pages 7–20",
    color: "#00D9FF",
    items: [
      { id: 7, label: "Dashboard Navigation" },
      { id: 8, label: "BOT Director Wizard" },
      { id: 9, label: "Template Forge" },
      { id: 10, label: "World Builder" },
      { id: 11, label: "Storyboard" },
      { id: 12, label: "Studio STORM" },
      { id: 13, label: "Archive Vault" },
      { id: 14, label: "Merge Studio" },
      { id: 15, label: "RTC Wallet" },
      { id: 16, label: "Sound Studio" },
      { id: 17, label: "YouTube Automation OS" },
      { id: 18, label: "Avatar Studio" },
      { id: 19, label: "Camera Angle Prompt Studio" },
      { id: 20, label: "Debate Studio — Dual Host AI Podcast" },
    ],
  },
  {
    title: "Section C: Academy White-label",
    pages: "Pages 21–23",
    color: "#FF7A00",
    items: [
      { id: 21, label: "White-label Tenant" },
      { id: 22, label: "Developers API" },
      { id: 23, label: "Pricing Tiers" },
    ],
  },
  {
    title: "Section D: Launch",
    pages: "Page 24",
    color: "#E5E7EB",
    items: [{ id: 24, label: "Production Checklist" }],
  },
];
