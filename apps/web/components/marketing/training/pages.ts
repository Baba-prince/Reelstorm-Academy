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
    | "forge"
    | "world"
    | "storyboard"
    | "studio"
    | "vault"
    | "merge"
    | "wallet"
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
    lead: "Flip-over operator guide for Academy Studio. Learn the factory screen by screen.",
    steps: [],
    mock: "cover",
  },
  {
    id: 1,
    section: "INDEX",
    title: "Table of Contents — Flip Index",
    lead: "Tap any chapter to flip instantly. Four sections · 19 pages · production verified.",
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
    lead: "Six stages, zero Premiere scrubbing. Each stage is a gated job with QC.",
    steps: [
      "Forge → World → Storyboard → Studio → Vault → Merge.",
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
    lead: "Your command center: live jobs, RTC balance, and shortcuts into each factory stage.",
    steps: [
      "Open Dashboard after sign-in — check LIVE ENGINE status.",
      "Scan open projects and residual RTC before starting work.",
      "Jump to Template Forge to begin a new Story Contract.",
    ],
    mock: "dashboard",
    href: "/dashboard",
  },
  {
    id: 8,
    section: "B — Operator Training",
    title: "Template Forge — Steal the Style",
    lead: "Upload an MP4 or paste a YouTube URL. We extract style DNA so generation has a grammar.",
    steps: [
      "Drop a reference file or paste a public video URL.",
      "Review extracted cut rate, LUT, camera, room, and voice tags.",
      "Attach DNA to your Story Contract and continue to World Builder.",
    ],
    mock: "forge",
    href: "/template-forge",
  },
  {
    id: 9,
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
    id: 10,
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
    id: 11,
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
    id: 12,
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
    id: 13,
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
    id: 14,
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
    id: 15,
    section: "B — Operator Training",
    title: "Sound Studio — Sync · Extract · Clone",
    lead: "Pull external beds, extract stems from video, clone talent voices, then Voice Forge TTS.",
    steps: [
      "Upload or paste a URL to sync external audio onto a Template Forge upload.",
      "Extract full + voice/music stems from any video uploadId.",
      "Clone with ElevenLabs IVC, then TTS any script into the library.",
    ],
    mock: "forge",
    href: "/sound-studio",
  },
  {
    id: 16,
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
    id: 17,
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
    id: 18,
    section: "C — Academy White-label",
    title: "Pricing — Free / Journey / Journey Pro",
    lead: "Adopted from VisaVideos tier shape: Free entry, Journey £39, Journey Pro £89 — mapped to RTC packs.",
    steps: [
      "Free: explore factory + limited RTC drip.",
      "Journey £39 → Studio pack (~300 RTC).",
      "Journey Pro £89 → Storm pack (~1500 RTC) for volume.",
    ],
    mock: "pricing",
    href: "/pricing",
  },
  {
    id: 19,
    section: "D — Launch",
    title: "Production Checklist + Final",
    lead: "Ship when readiness is green and operators can flip this guide without guessing.",
    steps: [
      "API /api/readiness ≥ A · Redis · ffmpeg · yt-dlp live.",
      "Wallet + white-label smoke: health, generate, debit.",
      "Operators trained on Forge → Sound → Vault → Merge path.",
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
    pages: "Pages 7–15",
    color: "#00D9FF",
    items: [
      { id: 7, label: "Dashboard Navigation" },
      { id: 8, label: "Template Forge" },
      { id: 9, label: "World Builder" },
      { id: 10, label: "Storyboard" },
      { id: 11, label: "Studio STORM" },
      { id: 12, label: "Archive Vault" },
      { id: 13, label: "Merge Studio" },
      { id: 14, label: "RTC Wallet" },
      { id: 15, label: "Sound Studio" },
    ],
  },
  {
    title: "Section C: Academy White-label",
    pages: "Pages 16–18",
    color: "#FF7A00",
    items: [
      { id: 16, label: "White-label Tenant" },
      { id: 17, label: "Developers API" },
      { id: 18, label: "Pricing Tiers" },
    ],
  },
  {
    title: "Section D: Launch",
    pages: "Page 19",
    color: "#E5E7EB",
    items: [{ id: 19, label: "Production Checklist" }],
  },
];
