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
    lead: "Flip-over operator guide for Academy Studio. Learn the factory screen by screen — including BOT Director Wizard and Sound Studio.",
    steps: [],
    mock: "cover",
  },
  {
    id: 1,
    section: "INDEX",
    title: "Table of Contents — Flip Index",
    lead: "Tap any chapter to flip instantly. Four sections · 21 pages · soft-launch verified.",
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
    lead: "Reelstorm Currency (RTC) meters factory compute. 100 RTC = one 5-minute ARCHIVE5 section.",
    steps: [
      "Buy RTC on Studio / Storm / Storm Pro / Network packs.",
      "Wallet debits 100 RTC when ARCHIVE5 vaults a block.",
      "White-label tenants share the same ledger via rs_live_ keys.",
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
      "Each entry costs 100 RTC and gets a permanent ID.",
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
    id: 18,
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
    id: 19,
    section: "C — Academy White-label",
    title: "Pricing — Free / Journey / Journey Pro",
    lead: "Free entry, Journey £39, Journey Pro £89 — mapped to RTC packs (soft launch may use Stripe test mode).",
    steps: [
      "Free: explore factory + limited RTC drip.",
      "Journey £39 → Studio pack (~300 RTC).",
      "Journey Pro £89 → Storm pack (~1500 RTC) for volume.",
    ],
    mock: "pricing",
    href: "/pricing",
  },
  {
    id: 20,
    section: "D — Launch",
    title: "Production Checklist + Final",
    lead: "Ship when scorecard is green. Soft launch accepts Ollama LLM, Stripe test, and mock video until live keys arrive.",
    steps: [
      "Open /scorecard → RE-SCAN — target grade A (API /api/readiness).",
      "Confirm ffmpeg/ffprobe, Redis db 17, worker concurrency ≥8, Sound Studio PASS.",
      "Operators trained on Wizard or Forge → Sound → Vault → Merge.",
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
    pages: "Pages 7–16",
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
    ],
  },
  {
    title: "Section C: Academy White-label",
    pages: "Pages 17–19",
    color: "#FF7A00",
    items: [
      { id: 17, label: "White-label Tenant" },
      { id: 18, label: "Developers API" },
      { id: 19, label: "Pricing Tiers" },
    ],
  },
  {
    title: "Section D: Launch",
    pages: "Page 20",
    color: "#E5E7EB",
    items: [{ id: 20, label: "Production Checklist" }],
  },
];
