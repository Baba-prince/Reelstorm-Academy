/**
 * STORM Guide — system knowledge + workflow improvement options
 * Used by API (LLM grounding) and web (instant page tips).
 * Keep in sync with shipped OS: YouTube Automation OS (7 agents), Viral Clone Factory,
 * Full Studio Set v1.6.4, landing Studio Set + YT Automation layers, Avatar Studio, Pixabay PRIMARY.
 */

export type GuideOption = {
  id: string;
  label: string;
  /** What the bot should explain / do when clicked */
  prompt: string;
  href?: string;
  kind: "learn" | "do" | "improve" | "goto";
};

export type GuideStartHere = {
  /** One-line outcome for this screen */
  goal: string;
  /** Ordered steps the user should take on THIS page */
  steps: string[];
  primaryLabel: string;
  primaryHref: string;
  nextLabel?: string;
  nextHref?: string;
};

export type GuideLayer = {
  path: string | RegExp;
  layer: string;
  title: string;
  blurb: string;
  tips: string[];
  options: GuideOption[];
  /** Explicit “where do I start on this screen” wizard — falls back via getStartHere() */
  startHere?: GuideStartHere;
};

/** Canonical factory path shown in Start Here coaches */
export const FACTORY_START_PATH = [
  { href: "/wizard", label: "01 Wizard" },
  { href: "/studio-set", label: "02 Studio Set" },
  { href: "/storyboard", label: "03 Storyboard" },
  { href: "/studio", label: "04 Studio" },
  { href: "/sound-studio", label: "05 Sound" },
  { href: "/archive-vault", label: "06 Vault" },
  { href: "/merge-studio", label: "07 Merge" },
] as const;

export const GUIDE_SYSTEM_PROMPT = `You are STORM Guide — the in-product AI coach for REELSTORM ACADEMY OS v1.6.4 / YouTube Automation OS.

Mission:
- Teach system knowledge (Factory = OS, RTC, ARCHIVE5, Soul ID, Full Studio Set, STORM pipeline, BOT Director Wizard, YouTube Automation 7 agents, Viral Clone Factory, Avatar Studio).
- You are the explanatory wizard on EVERY screen. Default assumption: the operator feels lost (“where can I start?”). Lead with Start Here steps from page context before anything else.
- When the user asks “where do I start?” give ONE recommended first click + the next 2 steps on the current screen, then the factory path.
- Improve the operator's workflow with concrete next actions.
- Stay concise: 2–5 short paragraphs or bullets max.
- Always offer 2–4 actionable options when helpful (as plain text like "→ Option: …").
- Never invent API keys or claim jobs finished unless the user said so.
- Prefer factory order: YouTube Automation (/yt-os) or BOT Director Wizard (or /tools/clone / Avatar Studio) → Templates Room / Template Forge → Full Studio Set (/studio-set: Room · Artist · Imagery) → Storyboard → Studio → Sound Studio → Archive Vault → Merge Studio.
- Full Studio Set (/studio-set) is READY FOR PRODUCTION TESTING on app.reelstorm.uk: Seed Courtroom → Generate room/artist plates → Imagery upsert (refreshes all rooms) → Apply to Director when readiness is green (or Force soft launch ≥60%). Soft-launch plates are SVG/URL stamps until real still gen — coach the lock flow, not photoreal claims.
- World Builder (/world-builder) is legacy quick Soul + Room lock — also READY FOR PRODUCTION TESTING; always prefer / deep-link into Full Studio Set for multi-angle cast + imagery.
- Storyboard / Studio / Sound / Archive / Merge are READY FOR PRODUCTION TESTING for soft-launch queues. Real GPU /generate needs green RunPod saver-health; Archive split needs uploadId; Merge needs vault blockIds; Sound clone/TTS needs ElevenLabs only when testing voice forge.
- Sound Studio is the voice OS (sync · extract · mux · library · TTS). Hosted TTS/clone providers are optional — never block operators on ElevenLabs.
- Template Room stock intros: Pixabay is PRIMARY (Pexels paused). Cached to R2/local — GET /api/templates?type=intro — $0 Seedance cost for intros.
- Viral Clone Factory (/tools/clone · /rs-clone): paste YouTube/TikTok/Instagram → Analyze 1 RTC → transformative remake 5 RTC. NEVER copy source video bytes — rewrite transcript + new Pixabay/Seedance assets + watermark.
- YouTube Automation OS (/yt-os): 7 agents — Strategy → Script → Thumbnail → SEO → Production → Publish → Analytics. Create Channel → Run Full Pipeline (20 RTC/video). Production uses Avatar Studio (4 outfits) + Sound Studio VO → R2 videos.reelstorm.uk/videos/youtube/…. Analytics feedback loop reorders the 14-day calendar. Legacy /rs-* skills still via API.
- Language Studio (/translate): YouTube/Instagram/upload EN video → Whisper → translate de/yo/ha/ig → TTS → Wav2Lip+LivePortrait body sync → R2 videos.reelstorm.uk/translated/. 10 RTC per language.
- Camera Angle Prompt Studio (/camera): image/video/YouTube/Instagram → detect angle → 30+ pro prompts (/BTS /Adcreative /Blueprint /Droneview /Explodeview + LowAngle, BirdsEye, Orbit…) for ComfyUI Flux. 2 RTC analyze, 1 RTC preview.
- Account menu (header avatar): Account settings · Change password · Billing · RTC Wallet · Log out. Captain Admin only for locked admin email.
- Free demo: 1 RTC from SystemBank (4600 RTC pool ≈ 920 × 5-min sets). Free users can analyze/demo; reproduce/vault needs paid RTC.
- Soft launch: Ollama may power the guide LLM; Stripe test + mock video OK until live DashScope/Seedance/sk_live keys are stamped. Scorecard tracks landing YouTube Automation + Studio Set layers + factory pipeline production-test matrix.
- RTC rule: 1 RTC = 1 minute of finished master (720p). One 5-min ARCHIVE5 set = 5 RTC. YouTube Automation video = 20 RTC. Tiers: Free Test $0 (1 RTC demo) · Storm / Storm Pro / Premium Pro via /billing + /wallet. Clone: 1 RTC analyze + 5 RTC reproduce.

Tone: sharp producer, not corporate. Brand colors mentally: violet / cyan / orange on void black.
Compliance: Clone Factory is transformative fair-use remake for inspiration — original assets only.`;

export const GUIDE_LAYERS: GuideLayer[] = [
  {
    path: "/",
    layer: "marketing",
    title: "Landing",
    blurb: "Brand-first entry — Language Studio + YouTube Automation + Studio Set.",
    tips: [
      "REELSTORM is not a course player — it is a factory that vaults ARCHIVE5 IP.",
      "New: Language Studio (/translate) — English reel → German · Yoruba · Hausa · Igbo with body sync (10 RTC/lang).",
      "Also: YouTube Automation 7 agents, Avatar twins, Full Studio Set.",
    ],
    options: [
      { id: "train", label: "Flip training guide", prompt: "Walk me through the training manual — especially Language Studio.", href: "/training", kind: "goto" },
      { id: "lang", label: "Language Studio", prompt: "How do I translate a YouTube or Instagram reel to German, Yoruba, Hausa, and Igbo?", href: "/translate", kind: "goto" },
      { id: "ytos", label: "YouTube Automation", prompt: "How do I use the 7-agent YouTube Automation OS from channel create to publish?", href: "/yt-os", kind: "goto" },
      { id: "avatar", label: "Avatar Studio", prompt: "How do I lock an avatar twin for Production?", href: "/model-center/avatar", kind: "goto" },
      { id: "pricing", label: "RTC pricing", prompt: "Explain RTC, free demo SystemBank, and paid tiers.", href: "/pricing", kind: "learn" },
    ],
  },
  {
    path: "/training",
    layer: "marketing",
    title: "Training Manual",
    blurb: "Flip-over artifact — screen-by-screen operator training including YouTube Automation.",
    tips: [
      "Use arrow keys or Flip to advance; Index jumps to any chapter.",
      "Flip to YouTube Automation OS (page 17) and Avatar Studio (page 18) for the no-filming path.",
      "Match each system image to the live OS screen before moving on.",
    ],
    options: [
      { id: "rules", label: "System rules first", prompt: "Summarize Section A system rules I must not break.", kind: "learn" },
      { id: "ytos", label: "YouTube Automation chapter", prompt: "Teach me Create Channel → Run Full Pipeline → Approve & Publish step by step.", href: "/yt-os", kind: "goto" },
      { id: "avatar", label: "Avatar chapter", prompt: "How do I attach a 4-outfit avatar twin before Production?", href: "/model-center/avatar", kind: "goto" },
      { id: "ops", label: "Operator path", prompt: "Give me the fastest no-filming path: YT Automation → Avatar → Publish.", kind: "improve" },
    ],
  },
  {
    path: "/how-it-works",
    layer: "marketing",
    title: "Factory Map",
    blurb: "YouTube Automation · Studio Set · STORM · zero timeline scrubbing.",
    tips: [
      "Primary growth loop: /yt-os 7 agents (Strategy→Analytics) at 20 RTC/video — no filming.",
      "Alternate: Wizard or Clone → Full Studio Set locks Room · Artist · Imagery before Storyboard / STORM.",
      "World Builder is a quick Soul/Room stub — prefer /studio-set for production testing.",
      "Sound Studio owns voice after Studio QC — before or alongside vault.",
    ],
    options: [
      { id: "stages", label: "Explain STORM stages", prompt: "Explain each STORM stage and common failure mode.", kind: "learn" },
      { id: "ytos", label: "YouTube Automation", prompt: "How does the 7-agent YouTube Automation OS Layer fit the factory map?", href: "/yt-os", kind: "goto" },
      { id: "set", label: "Studio Set lock", prompt: "Where does Full Studio Set fit and how do I test Room · Artist · Imagery?", href: "/studio-set", kind: "goto" },
      { id: "start", label: "Start production", prompt: "I am ready — what is my first click for no-filming YouTube?", href: "/yt-os", kind: "do" },
    ],
  },
  {
    path: "/pricing",
    layer: "marketing",
    title: "RTC Pricing",
    blurb: "Sell sets. Meter minutes. Free demo from SystemBank.",
    tips: [
      "1 RTC = 1 min master · 1 ARCHIVE5 set = 5 RTC.",
      "Free Test: 1 RTC demo granted from SystemBank (4600 RTC pool).",
      "Clone Factory: 1 RTC analyze + 5 RTC reproduce. Stock Pixabay intros are $0 Seedance.",
      "Upgrade via /billing · /wallet · Stripe checkout.",
    ],
    options: [
      { id: "pick", label: "Which tier?", prompt: "Help me pick a tier for 4 videos/month including Shorts.", kind: "improve" },
      { id: "demo", label: "Free demo?", prompt: "How does the 1 RTC free demo and SystemBank work?", href: "/billing", kind: "learn" },
      { id: "wallet", label: "Open wallet", prompt: "How do I check balance and top up?", href: "/wallet", kind: "goto" },
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
    blurb: "Health → generate → vault · clone · yt-os skills.",
    tips: [
      "Authorization: Bearer rs_live_… or Supabase access token.",
      "Clone: POST /api/clone/analyze · /api/clone/reproduce.",
      "YT-OS: GET /api/yt-os/skills · POST /api/yt-os/skill/:id.",
    ],
    options: [
      { id: "smoke", label: "Smoke path", prompt: "Give curl examples for health, clone analyze, yt-os skills.", kind: "learn" },
      { id: "clone-api", label: "Clone API", prompt: "Document transformative clone endpoints and RTC costs.", href: "/tools/clone", kind: "learn" },
    ],
  },
  {
    path: "/producers",
    layer: "marketing",
    title: "Producers",
    blurb: "For YouTubers, artists, advert outlets.",
    tips: [
      "Volume without slop — vault blocks, then merge masters.",
      "YouTubers: start at /yt-os then Clone Factory for viral DNA remakes.",
    ],
    options: [
      { id: "workflow", label: "Producer workflow", prompt: "Design a weekly producer workflow with YT-OS + factory.", kind: "improve" },
      { id: "ytos", label: "Open YT-OS", prompt: "Take me to the 11 skills dashboard.", href: "/yt-os", kind: "goto" },
      { id: "enter", label: "Enter factory", prompt: "Take me into production.", href: "/dashboard", kind: "goto" },
    ],
  },
  {
    path: "/dashboard",
    layer: "os",
    title: "Dashboard",
    blurb: "Command center — jobs, RTC, Wizard / YT-OS / Clone shortcuts.",
    tips: [
      "Check LIVE ENGINE + RTC before queuing Studio.",
      "Header avatar → Account · Billing · Wallet · Log out.",
      "Prefer BOT Director Wizard or YT-OS for a guided first project, then Full Studio Set before Storyboard.",
    ],
    startHere: {
      goal: "Start a first project without getting lost in the nav.",
      steps: [
        "Click BOT Director Wizard (best first path) — or YT-OS if you only want Shorts.",
        "Create / open a project and copy its Project ID.",
        "After Wizard: lock Full Studio Set, then Storyboard → Studio.",
      ],
      primaryLabel: "Start with Wizard",
      primaryHref: "/wizard",
      nextLabel: "Or open Avatar Studio",
      nextHref: "/model-center/avatar",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "I am new — where do I start on the dashboard?", kind: "improve" },
      { id: "wizard", label: "Open Wizard", prompt: "Walk me through BOT Director Wizard stages.", href: "/wizard", kind: "do" },
      { id: "set", label: "Studio Set", prompt: "How do I lock Room · Artist · Imagery on Full Studio Set?", href: "/studio-set", kind: "goto" },
      { id: "avatar", label: "Avatar Studio", prompt: "Should I use Avatar Studio or Wizard first?", href: "/model-center/avatar", kind: "goto" },
      { id: "rtc", label: "Check RTC", prompt: "How do I know if I have enough RTC for 2 ARCHIVE5 blocks?", href: "/wallet", kind: "goto" },
    ],
  },
  {
    path: "/wizard",
    layer: "os",
    title: "BOT Director Wizard",
    blurb: "Seven-stage blueprint · Idea or Clone Viral Link → factory handoff.",
    tips: [
      "Step 1 tabs: Generate from Idea OR Clone Viral Link (opens /tools/clone).",
      "Paste YouTube / TikTok / Instagram / social URLs for DNA into LIVE ENGINE.",
      "Free demo 1 RTC can burn for a 1-min watermarked preview.",
      "When READY, Feed Factory → then lock Full Studio Set (/studio-set) before Storyboard / STORM generate.",
    ],
    startHere: {
      goal: "Leave with a locked blueprint the factory can execute.",
      steps: [
        "Click Start directing → pick Idea or Clone Viral Link.",
        "Walk stages 01–07 (World stage has Use Avatar Studio if you need a talking-head twin).",
        "When READY, Feed Factory → open Studio Set with your Project ID.",
      ],
      primaryLabel: "Explain 7 stages",
      primaryHref: "/wizard",
      nextLabel: "Next: Studio Set",
      nextHref: "/studio-set",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start on BOT Director Wizard right now?", kind: "improve" },
      { id: "stages", label: "Explain 7 stages", prompt: "Explain each BOT Director Wizard stage and what I must enter.", kind: "learn" },
      { id: "clone-tab", label: "Clone Viral Link", prompt: "How do I use the Clone Viral Link tab vs idea generate?", href: "/tools/clone", kind: "goto" },
      { id: "generate", label: "Generate blueprint", prompt: "How do I generate a blueprint and know it succeeded?", kind: "do" },
      { id: "set", label: "Next: Studio Set", prompt: "After Feed Factory, how do I lock Room · Artist · Imagery before Storyboard?", href: "/studio-set", kind: "goto" },
    ],
  },
  {
    path: "/yt-os",
    layer: "os",
    title: "YouTube Automation OS",
    blurb: "7-agent autonomous loop — Strategy → Script → Thumb → SEO → Production → Publish → Analytics.",
    tips: [
      "Connect YouTube (or mock) → pick niche → Run 1→7 Orchestrator (20 RTC).",
      "Production uses Avatar Studio outfits + Sound Studio VO → R2 videos.reelstorm.uk/videos/youtube/…",
      "Analytics feeds insights back to Strategy (calendar auto-reorders).",
      "Legacy /rs-* skills still available via API; calendar at /yt-os/plan.",
    ],
    startHere: {
      goal: "Ship a no-filming YouTube video through all 7 agents.",
      steps: [
        "Connect YouTube (mock OK) and pick niche (AI / Real Estate / …).",
        "Hit Run 1→7 Orchestrator — or step agents: Strategy → Script → Thumb → SEO → Prod → Publish → Analytics.",
        "Attach Avatar Twin (Red Bomber etc) before Production for talking-head output on R2.",
      ],
      primaryLabel: "Open Automation OS",
      primaryHref: "/yt-os",
      nextLabel: "Avatar Twin",
      nextHref: "/model-center/avatar",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start on YouTube Automation OS right now?", kind: "improve" },
      { id: "pipeline", label: "Run Full Pipeline", prompt: "Walk me through Create Channel → Run Full Pipeline → each of the 7 agents → Approve & Publish.", kind: "do" },
      { id: "avatar", label: "Avatar Twin", prompt: "How do I lock an Avatar Studio outfit before Production?", href: "/model-center/avatar", kind: "goto" },
      { id: "agents", label: "Explain 7 agents", prompt: "Explain Strategy, Script, Thumbnail, SEO, Production, Publish, Analytics and what each outputs.", kind: "learn" },
      { id: "plan", label: "Content calendar", prompt: "How does Strategy build the 14-day calendar and how does Analytics reorder it?", href: "/yt-os/plan", kind: "goto" },
    ],
  },
  {
    path: "/yt-os/plan",
    layer: "os",
    title: "Content Calendar",
    blurb: "14–30 day Long/Short schedule — fed by Strategy + Analytics feedback loop.",
    tips: [
      "Strategy agent seeds winning topics into the calendar after channel create.",
      "Analytics after publish can reorder upcoming slots toward what worked.",
      "Produce from calendar via Run Full Pipeline on /yt-os (20 RTC/video).",
    ],
    startHere: {
      goal: "Read the calendar Strategy built, then produce the next slot.",
      steps: [
        "Open the calendar — confirm niche topics for the next 14 days.",
        "Pick tomorrow’s slot → return to /yt-os → Run Full Pipeline (or step agents).",
        "After Analytics runs, refresh — slots may reorder toward winners.",
      ],
      primaryLabel: "Open calendar",
      primaryHref: "/yt-os/plan",
      nextLabel: "Back to Automation",
      nextHref: "/yt-os",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start on the content calendar?", kind: "improve" },
      { id: "gen", label: "Read the plan", prompt: "How do I read Strategy’s calendar and pick the next video?", kind: "do" },
      { id: "cost", label: "RTC budget", prompt: "Estimate RTC if I run Full Pipeline for 7 videos this week (20 RTC each).", kind: "learn" },
      { id: "back", label: "Back to Automation", prompt: "Return to YouTube Automation dashboard.", href: "/yt-os", kind: "goto" },
    ],
  },
  {
    path: "/tools/clone",
    layer: "os",
    title: "Viral Clone Factory",
    blurb: "Paste viral link → analyze structure → transformative remake.",
    tips: [
      "Allowed: youtube.com · shorts · tiktok.com · instagram.com only.",
      "Analyze = 1 RTC (metadata + captions — never downloads source video bytes).",
      "Reproduce = 5 RTC — rewritten script + Pixabay B-roll + Seedance prompts + watermark.",
      "Styles: kids · gaming · a24 · original. Fair-use remake — not a copy.",
    ],
    startHere: {
      goal: "Turn one viral URL into a transformative remake (not a byte copy).",
      steps: [
        "Paste a YouTube / TikTok / Instagram URL only.",
        "Analyze (1 RTC) → pick style → Reproduce (5 RTC).",
        "Review watermarked output, then continue in Studio / Vault if needed.",
      ],
      primaryLabel: "Full clone flow",
      primaryHref: "/tools/clone",
      nextLabel: "Back to YT-OS",
      nextHref: "/yt-os",
    },
    options: [
      { id: "flow", label: "Full flow", prompt: "Walk me through analyze then reproduce with kids style.", kind: "do" },
      { id: "cost", label: "RTC costs", prompt: "Explain 1+5 RTC and free demo limits for clone.", kind: "learn" },
      { id: "legal", label: "Compliance", prompt: "What makes a remake transformative vs copyright risk?", kind: "learn" },
      { id: "ytos", label: "YT-OS viral", prompt: "How does /rs-viral differ from Clone Factory?", href: "/yt-os", kind: "goto" },
    ],
  },
  {
    path: "/camera",
    layer: "os",
    title: "Camera Angle Prompt Studio",
    blurb: "Any image/video/link → 30+ cinematography prompts upgraded from Dario's 5.",
    tips: [
      "Drop an image/video or paste Instagram/YouTube → Analyze (2 RTC) → copy Flux-ready prompts.",
      "Dario 5 included: /BTS /Adcreative /Blueprint /Droneview /Explodeview — plus LowAngle, BirdsEye, Orbit, Anamorphic…",
      "Generate Preview (1 RTC) stamps R2 camera/preview/… — send picks to World Builder / Shot List / Studio Set.",
    ],
    startHere: {
      goal: "Get a full angle prompt pack from one still or reel.",
      steps: [
        "Paste a reel URL or drop a cockpit/car/mansion still.",
        "Hit Analyze → 30+ Prompts — read detected angle + confidence.",
        "Filter Dario 5 or Angles → Copy /LowAngle → optional Preview → World Builder.",
      ],
      primaryLabel: "Open Camera Studio",
      primaryHref: "/camera",
      nextLabel: "World Builder",
      nextHref: "/world-builder",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start on Camera Angle Studio?", kind: "improve" },
      { id: "dario", label: "Dario 5", prompt: "Explain /BTS /Adcreative /Blueprint /Droneview /Explodeview and when to use each.", kind: "learn" },
      { id: "flow", label: "Full flow", prompt: "Walk me through upload → analyze → copy prompts → preview → World Builder.", kind: "do" },
      { id: "world", label: "World Builder", prompt: "How do I apply angle prompts to 4-angle locations?", href: "/world-builder", kind: "goto" },
    ],
  },
  {
    path: "/translate",
    layer: "os",
    title: "Language Studio",
    blurb: "EN video → German · Yoruba · Hausa · Igbo with lip + body sync on R2.",
    tips: [
      "Paste YouTube or Instagram Reel URL (or upload MP4) → Translate Now (10 RTC per language).",
      "Pipeline: Download → Whisper → Translate → TTS (Sound Studio / ElevenLabs) → Wav2Lip + LivePortrait → R2 translated/{id}_{lang}.mp4.",
      "Soft-launch: if the GPU pod is sleeping, audio-replace keeps body motion; wake via Pod Status for full lip-sync.",
      "Send finished packs to Studio Set, YouTube OS, or Training Academy.",
    ],
    startHere: {
      goal: "Ship a 4-language dubbed pack from one English reel.",
      steps: [
        "Paste an Instagram/YouTube URL (e.g. Dario study reel) or drop an MP4.",
        "Keep German · Yoruba · Hausa · Igbo checked → Translate Now (40 RTC).",
        "Watch pipeline to DONE → play the four R2 videos side-by-side.",
      ],
      primaryLabel: "Open Language Studio",
      primaryHref: "/translate",
      nextLabel: "Avatar Twin",
      nextHref: "/model-center/avatar",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start on Language Studio?", kind: "improve" },
      { id: "flow", label: "Full translate flow", prompt: "Walk me through download → transcribe → de/yo/ha/ig → TTS → lipsync.", kind: "do" },
      { id: "cost", label: "RTC cost", prompt: "How much RTC for 4 languages and when is the GPU needed?", kind: "learn" },
      { id: "avatar", label: "Avatar Twin", prompt: "How do I replace the face with my Avatar Studio twin?", href: "/model-center/avatar", kind: "goto" },
      { id: "ytos", label: "YouTube OS", prompt: "How do I publish translated videos from YouTube Automation?", href: "/yt-os", kind: "goto" },
    ],
  },
  {
    path: "/templates-room",
    layer: "os",
    title: "Templates Room",
    blurb: "Ideals + stock intros — Pixabay PRIMARY → cached, $0 Seedance.",
    tips: [
      "Stock intros: ~100 cached (20× nollywood/asia/drama/product/intros) from Pixabay (Pexels paused).",
      "Filter ?type=intro&category=… — served from DB/R2/local, not live API.",
      "Open a card → Use ideal for DNA; extract custom style in Template Forge when needed.",
    ],
    startHere: {
      goal: "Pick a stock ideal or intro so your project has DNA before Forge / Studio Set.",
      steps: [
        "Browse category chips (Nollywood · Asia · Drama · Product · Intros).",
        "Open a card → Use ideal (or note the intro for $0 Seedance).",
        "Need custom DNA? Continue to Template Forge with an MP4/URL.",
      ],
      primaryLabel: "Browse stock intros",
      primaryHref: "/templates-room",
      nextLabel: "Extract my own",
      nextHref: "/template-forge",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start in Templates Room?", kind: "improve" },
      { id: "intros", label: "Stock intros", prompt: "How do Pixabay stock intros work and why $0 Seedance?", kind: "learn" },
      { id: "nollywood", label: "Nollywood pick", prompt: "Which Nollywood template fits a Lagos family drama short?", kind: "improve" },
      { id: "asia", label: "Asia cinema pick", prompt: "Recommend an Asia template — K-drama, Bollywood, anime, or SEA food.", kind: "improve" },
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
      "Apply template to a project, then lock Full Studio Set before Storyboard.",
      "Or start from curated ideals / Pixabay intros in Templates Room.",
    ],
    startHere: {
      goal: "Extract style DNA, then lock a Studio Set before generating.",
      steps: [
        "Drop an MP4 or paste a YouTube URL — wait until READY.",
        "Apply the template to your project.",
        "Open Studio Set with that Project ID before Storyboard.",
      ],
      primaryLabel: "Browse stock ideals",
      primaryHref: "/templates-room",
      nextLabel: "Next: Studio Set",
      nextHref: "/studio-set",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start in Template Forge?", kind: "improve" },
      { id: "url", label: "URL extract tips", prompt: "Best practices for YouTube reference extract.", kind: "improve" },
      { id: "fail", label: "Analysis stuck?", prompt: "My analysis is stuck — troubleshooting checklist.", kind: "learn" },
      { id: "room", label: "Browse ideals", prompt: "Show me Templates Room categories.", href: "/templates-room", kind: "goto" },
      { id: "set", label: "Next: Studio Set", prompt: "After template is ready, how do I lock Room + Artist + Imagery?", href: "/studio-set", kind: "do" },
    ],
  },
  {
    path: "/studio-set",
    layer: "os",
    title: "Full Studio Set",
    blurb: "Room · Artist · Imagery — READY FOR PRODUCTION TESTING (soft-launch plates).",
    tips: [
      "Paste a Project ID → Seed Courtroom Drama for establishing → wide → medium → OSH → close.",
      "Room tab: set Prompt DNA → Generate plates. Artist tab: import URL or Generate plates (front/left/right/3Q).",
      "Imagery tab: customize background prompt → Save upserts pack and refreshes ALL room plates.",
      "Apply to Director when readiness is green; Force apply allows soft-launch partial ≥60%.",
      "Soft-launch: plates may be SVG/URL stamps — still valid for lock-flow testing until real still gen.",
    ],
    startHere: {
      goal: "Lock look + cast so Storyboard / Studio share one world.",
      steps: [
        "Paste Project ID → Seed Courtroom.",
        "Generate Room + Artist plates · save Imagery prompt.",
        "When readiness ≥60%, Apply to Director → Storyboard.",
      ],
      primaryLabel: "Production test path",
      primaryHref: "/studio-set",
      nextLabel: "Next: Storyboard",
      nextHref: "/storyboard",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start on Full Studio Set right now?", kind: "improve" },
      { id: "test", label: "Production test path", prompt: "Give me the exact production-test checklist for Studio Set on a live project ID.", kind: "do" },
      { id: "court", label: "Courtroom tour", prompt: "Walk me through courtroom camera angles like a DP — establishing to insert.", kind: "learn" },
      { id: "imagery", label: "Imagery refresh", prompt: "How does Imagery upsert refresh room plates and when should I use it?", kind: "learn" },
      { id: "apply", label: "Apply to Director", prompt: "Checklist before Apply to Director, then open Storyboard.", href: "/storyboard", kind: "goto" },
    ],
  },
  {
    path: /^\/studio-set\/(room|artist|imagery)/,
    layer: "os",
    title: "Studio Set module",
    blurb: "Camera coach for Room, Artist, or Imagery — production-test ready.",
    tips: [
      "Wide = geography. Medium = dialogue. OSH = confrontation. Close/insert = emphasis.",
      "Artist Generate stamps soft-launch plates (or URL#angle) so readiness is not stuck on pending.",
      "Imagery Save upserts the pack and regenerates every Room angle from the customized prompt.",
    ],
    startHere: {
      goal: "Finish this tab’s plates, then return to Apply to Director.",
      steps: [
        "Confirm Project ID is still attached from Full Studio Set.",
        "Generate or import plates for this module (Room / Artist / Imagery).",
        "Back to Studio Set overview → Apply when readiness ≥60%.",
      ],
      primaryLabel: "Generate plates",
      primaryHref: "/studio-set",
      nextLabel: "Back to Studio Set",
      nextHref: "/studio-set",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start on this Studio Set module?", kind: "improve" },
      { id: "framing", label: "Framing cheat sheet", prompt: "Explain wide, medium, OSH, close, insert, establishing, reaction for new directors.", kind: "learn" },
      { id: "gen", label: "Generate plates", prompt: "When do I hit Generate plates on Room vs Artist?", kind: "do" },
      { id: "set", label: "Back to Studio Set", prompt: "Return to Full Studio Set overview.", href: "/studio-set", kind: "goto" },
    ],
  },
  {
    path: "/world-builder",
    layer: "os",
    title: "World Builder",
    blurb: "Quick Soul + Room lock — READY FOR PRODUCTION TESTING; prefer Studio Set.",
    tips: [
      "Enter a real Project ID, then Lock Soul ID and/or Lock Room Plates.",
      "Open Studio Set (passes projectId) for multi-angle Room · Artist · Imagery production lock.",
      "World Builder is the stub path; Full Studio Set is the production-test path before Storyboard.",
    ],
    startHere: {
      goal: "Quick-lock Soul + Room, or jump to Full Studio Set for production angles.",
      steps: [
        "Paste a real Project ID.",
        "Lock Soul ID and/or Lock Room Plates (stub path).",
        "Prefer Open Studio Set for multi-angle Room · Artist · Imagery before Storyboard.",
      ],
      primaryLabel: "Open Studio Set",
      primaryHref: "/studio-set",
      nextLabel: "Next: Storyboard",
      nextHref: "/storyboard",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start on World Builder?", kind: "improve" },
      { id: "set", label: "Open Studio Set", prompt: "Take me to Full Studio Set to lock courtroom angles and cast with my project ID.", href: "/studio-set", kind: "goto" },
      { id: "soul", label: "Lock Soul", prompt: "How do I lock Soul ID correctly on World Builder without errors?", kind: "do" },
      { id: "room", label: "Lock Room", prompt: "How do Room Memory plates map to Studio Set angles?", kind: "learn" },
      { id: "board", label: "Next: Storyboard", prompt: "When is it safe to leave World Builder / Studio Set for Storyboard?", href: "/storyboard", kind: "goto" },
    ],
  },
  {
    path: "/storyboard",
    layer: "os",
    title: "Storyboard",
    blurb: "READY FOR PRODUCTION TESTING — needs project script + preferably Studio Set applied.",
    tips: [
      "Project must have a script (PATCH /api/projects/:id) or Generate Board returns an error.",
      "Confirm Full Studio Set applied (or World Builder stub) before breaking beats.",
      "Approve frames, then queue Studio with the same project ID.",
    ],
    startHere: {
      goal: "Break the script into approved frames before queuing GPU.",
      steps: [
        "Paste Project ID (script + Studio Set applied).",
        "Generate Board → approve / tweak frames.",
        "Open Studio with the same Project ID.",
      ],
      primaryLabel: "Generate board",
      primaryHref: "/storyboard",
      nextLabel: "Next: Studio",
      nextHref: "/studio",
    },
    options: [
      { id: "test", label: "Test path", prompt: "Exact production-test steps for Storyboard on a live project.", kind: "do" },
      { id: "set", label: "Studio Set first?", prompt: "Do I need Apply to Director before Storyboard?", href: "/studio-set", kind: "improve" },
      { id: "studio", label: "Queue Studio", prompt: "Board approved — how do I queue Studio?", href: "/studio", kind: "do" },
    ],
  },
  {
    path: "/studio",
    layer: "os",
    title: "Studio",
    blurb: "READY FOR PRODUCTION TESTING — Vibe Direct queues BullMQ generate jobs.",
    tips: [
      "Attach Project ID + vibe note → POST /api/generate returns jobId (soft-launch / mock video OK).",
      "0MB /generate saver path needs RunPod saver-health green (correct pod ID in RUNPOD_SAVER_URL).",
      "Retry only failed blocks; never re-render passed QC.",
    ],
    startHere: {
      goal: "Queue a generate job for approved storyboard beats.",
      steps: [
        "Paste Project ID + short vibe note.",
        "Queue Vibe Direct — watch jobId / LIVE ENGINE.",
        "On QC pass → Sound Studio or Archive Vault.",
      ],
      primaryLabel: "Queue a job",
      primaryHref: "/studio",
      nextLabel: "Next: Sound",
      nextHref: "/sound-studio",
    },
    options: [
      { id: "test", label: "Queue a job", prompt: "How do I production-test Studio Vibe Direct safely?", kind: "do" },
      { id: "saver", label: "Saver health", prompt: "What does /api/studio/saver-health mean and how do I fix 404?", href: "/generate", kind: "learn" },
      { id: "sound", label: "Add audio next?", prompt: "Should I sync voice before or after vault?", href: "/sound-studio", kind: "improve" },
      { id: "vault", label: "Vault blocks", prompt: "How do I promote QC-pass blocks to ARCHIVE5?", href: "/archive-vault", kind: "do" },
    ],
  },
  {
    path: "/sound-studio",
    layer: "os",
    title: "Sound Studio",
    blurb: "READY FOR PRODUCTION TESTING — library/demo live; ElevenLabs optional.",
    tips: [
      "Sound Studio owns all voice work; hosted clone/TTS keys are optional on soft launch.",
      "Demo bed + library endpoints work without ElevenLabs; clone/TTS need ELEVENLABS_API_KEY.",
      "Sync needs a Template Forge uploadId + audio file/URL/asset.",
    ],
    startHere: {
      goal: "Attach or forge voice without blocking on ElevenLabs.",
      steps: [
        "Open Sync or Library — demo bed works without a TTS key.",
        "Sync needs uploadId + audio file/URL when locking to picture.",
        "When blocks sound right → Archive Vault.",
      ],
      primaryLabel: "Sync workflow",
      primaryHref: "/sound-studio",
      nextLabel: "Next: Vault",
      nextHref: "/archive-vault",
    },
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
    blurb: "READY FOR PRODUCTION TESTING — list live; split needs Upload ID.",
    tips: [
      "Refresh lists vault blocks; Split queues archiveBlock with projectId + uploadId from Template Forge.",
      "Tag series/episode/brand so remix stays findable.",
      "Empty vault is normal until you split a long upload.",
    ],
    startHere: {
      goal: "Promote QC-pass media into ARCHIVE5 blocks you can merge.",
      steps: [
        "Refresh to see existing blocks (empty is OK at first).",
        "Split with projectId + uploadId when you have a long master.",
        "Copy block IDs → Merge Studio.",
      ],
      primaryLabel: "Test split",
      primaryHref: "/archive-vault",
      nextLabel: "Next: Merge",
      nextHref: "/merge-studio",
    },
    options: [
      { id: "test", label: "Test split", prompt: "How do I production-test ARCHIVE5 split with a real uploadId?", kind: "do" },
      { id: "debit", label: "RTC debit", prompt: "When exactly is RTC debited for ARCHIVE5? (5 RTC per 5-min set)", kind: "learn" },
      { id: "merge", label: "Ready to merge?", prompt: "Checklist before Merge Studio.", href: "/merge-studio", kind: "improve" },
    ],
  },
  {
    path: "/merge-studio",
    layer: "os",
    title: "Merge Studio",
    blurb: "READY FOR PRODUCTION TESTING — queue merge with vault block IDs.",
    tips: [
      "Need projectId + at least one Archive Vault blockId (comma/space separated).",
      "Never re-unlock Soul during merge — only vault IDs.",
      "FFmpeg concat runs on the worker — watch PM2/worker logs if job hangs.",
    ],
    startHere: {
      goal: "Concat vault blocks into a finished master — no Soul re-lock.",
      steps: [
        "Paste projectId + vault blockIds (from Archive Vault).",
        "Queue merge — worker runs FFmpeg concat.",
        "Download / review master; start next set from Wizard if needed.",
      ],
      primaryLabel: "Test merge",
      primaryHref: "/merge-studio",
      nextLabel: "Get block IDs",
      nextHref: "/archive-vault",
    },
    options: [
      { id: "test", label: "Test merge", prompt: "Exact production-test fields for POST /api/merge.", kind: "do" },
      { id: "order", label: "Block order", prompt: "How should I order blocks for a 30-min master?", kind: "improve" },
      { id: "vault", label: "Get block IDs", prompt: "Where do I copy ARCHIVE5 block IDs?", href: "/archive-vault", kind: "goto" },
    ],
  },
  {
    path: "/wallet",
    layer: "os",
    title: "RTC Wallet",
    blurb: "Balance · free demo · top-up · vouchers.",
    tips: [
      "Free users get 1 RTC demo from SystemBank once.",
      "Top up before Studio if remaining < 2 sets (10 RTC).",
      "Clone reproduce needs 5 RTC — analyze alone may use your free demo.",
    ],
    startHere: {
      goal: "Know your RTC balance before queuing Studio or Clone.",
      steps: [
        "Read balance + free-demo status.",
        "If under 10 RTC, top up or open Billing for packs.",
        "Return to Dashboard / Studio when you have enough for 2 sets.",
      ],
      primaryLabel: "RTC math",
      primaryHref: "/wallet",
      nextLabel: "Billing / packs",
      nextHref: "/billing",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start in the RTC Wallet?", kind: "improve" },
      { id: "math", label: "RTC math", prompt: "I have 25 RTC — how many 5-min sets can I vault?", kind: "learn" },
      { id: "billing", label: "Billing page", prompt: "Show SystemBank funnel and my wallet.", href: "/billing", kind: "goto" },
      { id: "buy", label: "Upgrade / packs", prompt: "Where do I purchase tiers or RTC packs?", href: "/pricing", kind: "goto" },
    ],
  },
  {
    path: "/billing",
    layer: "os",
    title: "Billing",
    blurb: "SystemBank funnel · wallet · plans.",
    tips: [
      "SystemBank = 4600 RTC free-demo pool (920 × 5-min sets).",
      "Your wallet shows free demo granted/used + balance.",
      "Account menu also links here — header avatar top-right.",
    ],
    startHere: {
      goal: "Understand SystemBank, free demo, and which plan to buy.",
      steps: [
        "Read SystemBank remaining + your free-demo grant.",
        "Open Wallet for balance / vouchers.",
        "Pick a tier on Pricing when ready to produce past demo.",
      ],
      primaryLabel: "SystemBank?",
      primaryHref: "/billing",
      nextLabel: "Open wallet",
      nextHref: "/wallet",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start on Billing?", kind: "improve" },
      { id: "bank", label: "SystemBank?", prompt: "Explain SystemBank remaining and free demo grants.", kind: "learn" },
      { id: "wallet", label: "Open wallet", prompt: "Take me to top-up and vouchers.", href: "/wallet", kind: "goto" },
      { id: "account", label: "Account settings", prompt: "Where do I change password and log out?", href: "/account", kind: "goto" },
    ],
  },
  {
    path: "/account",
    layer: "os",
    title: "Account settings",
    blurb: "Profile · password · billing links · log out.",
    tips: [
      "Edit display name; email is locked to your auth identity.",
      "Change password for email/password accounts (Google users use Google security).",
      "Log out from this page or the header avatar menu.",
    ],
    startHere: {
      goal: "Manage profile, password, and session safely.",
      steps: [
        "Update display name if needed (email is locked).",
        "Change password for email/password accounts.",
        "Use Billing / Wallet links, or Log out from here / header avatar.",
      ],
      primaryLabel: "Change password",
      primaryHref: "/account",
      nextLabel: "Go to billing",
      nextHref: "/billing",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start in Account settings?", kind: "improve" },
      { id: "pw", label: "Change password", prompt: "How do I change my password safely?", kind: "do" },
      { id: "bill", label: "Go to billing", prompt: "Open billing and explain my free demo status.", href: "/billing", kind: "goto" },
      { id: "out", label: "Log out help", prompt: "Where is log out and what happens to my session?", kind: "learn" },
    ],
  },
  {
    path: "/admin",
    layer: "os",
    title: "Captain Admin",
    blurb: "Locked admin console — gifts, users, SystemBank overview.",
    tips: [
      "Only the configured admin email can open this dashboard.",
      "Admin gifts/vouchers do not drain SystemBank free-demo pool.",
      "Use for support RTC grants — not for day-to-day production.",
    ],
    startHere: {
      goal: "Support operators with gifts/vouchers without draining SystemBank demos.",
      steps: [
        "Confirm you are the locked admin email.",
        "Gift RTC or issue a voucher for support cases.",
        "Check SystemBank remaining — gifts do not drain the free-demo pool.",
      ],
      primaryLabel: "Gift RTC",
      primaryHref: "/admin",
      nextLabel: "Back to OS",
      nextHref: "/dashboard",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start in Captain Admin?", kind: "improve" },
      { id: "gift", label: "Gift RTC", prompt: "How do I gift RTC or issue a voucher without touching SystemBank?", kind: "do" },
      { id: "bank", label: "Bank status", prompt: "How do I read SystemBank remaining on admin?", kind: "learn" },
      { id: "back", label: "Back to OS", prompt: "Return to dashboard for production.", href: "/dashboard", kind: "goto" },
    ],
  },
  {
    path: "/model-center",
    layer: "os",
    title: "Model Center",
    blurb: "DashScope / Ollama LLM · Seedance video · optional Kling/Veo/TTS · Avatar Studio.",
    tips: [
      "Soft launch minimum: Ollama local LLM (GUIDE_USE_OLLAMA=1) + mock video OK.",
      "Avatar Studio (/model-center/avatar): 1 photo → 4 outfits → niche script → videos.reelstorm.uk.",
      "Production: DASHSCOPE_API_KEY + Seedance + MOCK_VIDEO_GEN=0 + optional HEYGEN_API_KEY.",
    ],
    startHere: {
      goal: "Know which engines are live, then open Avatar Studio or check the scorecard.",
      steps: [
        "Scan LLM / video / TTS status for soft-launch vs production.",
        "Open Avatar Studio for talking-head twins → R2.",
        "Verify readiness on Scorecard before academy demos.",
      ],
      primaryLabel: "Open Avatar Studio",
      primaryHref: "/model-center/avatar",
      nextLabel: "Check scorecard",
      nextHref: "/scorecard",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start in Model Center?", kind: "improve" },
      { id: "avatar", label: "Open Avatar Studio", prompt: "Walk me through MissTechy Avatar Studio: photo → 4 outfits → News Authority template → R2.", href: "/model-center/avatar", kind: "goto" },
      { id: "min", label: "Minimum keys", prompt: "What is the minimum key set for soft launch vs full production?", kind: "learn" },
      { id: "pixabay", label: "Pixabay intros", prompt: "How does Pixabay PRIMARY wire into Template Room?", href: "/templates-room", kind: "goto" },
      { id: "score", label: "Check scorecard", prompt: "How do I verify Model Center readiness on the scorecard?", href: "/scorecard", kind: "goto" },
    ],
  },
  {
    path: /^\/model-center\/avatar/,
    layer: "os",
    title: "Avatar Model Studio",
    blurb: "HeyGen-style twin → R2. Active coach walks Create → Template → Script → Generate.",
    tips: [
      "Upload 1 front-face photo — we store 4 outfit variant slots on videos.reelstorm.uk/avatars/variants/…",
      "Pick News Update Authority + niche + local news — Ollama writes the 30s hook script.",
      "Generate spends template RTC and returns real_r2 URL — Send to Studio Set when done.",
      "Voice stays in Sound Studio OS; AVATAR_ENGINE=heygen|liveportrait (saver fallback).",
    ],
    startHere: {
      goal: "Ship a talking-head clip to videos.reelstorm.uk without re-filming outfits.",
      steps: [
        "Create Avatar → upload 1 photo (4 outfit slots).",
        "Templates → News Update Authority · set niche + local news · Generate Script.",
        "Generate → R2 → Send to Studio Set.",
      ],
      primaryLabel: "Create from photo",
      primaryHref: "/model-center/avatar",
      nextLabel: "Studio Set",
      nextHref: "/studio-set",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start in Avatar Studio?", kind: "improve" },
      { id: "create", label: "Create from photo", prompt: "How do I upload one photo and get four outfit variants?", kind: "do" },
      { id: "news", label: "News Authority script", prompt: "Help me write a Waymo / local news 30-second ON AIR script.", kind: "do" },
      { id: "set", label: "Studio Set next", prompt: "After R2 video, how do I use it in Studio Set?", href: "/studio-set", kind: "goto" },
      { id: "voice", label: "Sound Studio", prompt: "How does Avatar Studio connect to Sound Studio voice OS?", href: "/sound-studio", kind: "goto" },
    ],
  },
  {
    path: "/scorecard",
    layer: "os",
    title: "Scorecard",
    blurb: "Production readiness gates (v1.6.4) — landing Studio Set layer + pipeline matrix.",
    tips: [
      "v1.6.4: Landing hero markets Full Studio Set; factory rooms Storyboard→Merge stay READY FOR PRODUCTION TESTING.",
      "RunPod saver-health may still be PARTIAL — soft-launch queues work; real GPU /generate waits on pod HTTP 8000.",
      "Target grade A on /api/readiness before academy launch; video_gen + object_storage may still block ship-ready.",
      "Soft launch: Ollama LLM, Stripe test, mock video can PASS with SOFT_LAUNCH=1.",
    ],
    startHere: {
      goal: "Read what’s READY vs PARTIAL, then pick the next production-test room.",
      steps: [
        "Scan grade + blockers (video_gen, object_storage, saver-health).",
        "Production-test Studio Set first if look/cast isn’t locked.",
        "Walk Storyboard → Studio → Sound → Vault → Merge in order.",
      ],
      primaryLabel: "Test Studio Set",
      primaryHref: "/studio-set",
      nextLabel: "Test pipeline",
      nextHref: "/storyboard",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start on the Scorecard?", kind: "improve" },
      { id: "set", label: "Test Studio Set", prompt: "How do I production-test Room · Artist · Imagery from the scorecard status?", href: "/studio-set", kind: "goto" },
      { id: "land", label: "Landing hero", prompt: "What Studio Set messaging is on the marketing landing hero?", href: "/", kind: "goto" },
      { id: "pipe", label: "Test pipeline", prompt: "Order to production-test Storyboard → Studio → Sound → Archive → Merge.", kind: "do" },
      { id: "gaps", label: "Close gaps", prompt: "Typical readiness gaps and how to close them on soft launch.", kind: "improve" },
      { id: "api", label: "API readiness", prompt: "What does /api/readiness check now vs scorecard pipeline rows?", kind: "learn" },
    ],
  },
  {
    path: "/brand",
    layer: "os",
    title: "Brand",
    blurb: "Tokens for void / violet / cyan / orange.",
    tips: [
      "Keep brand hero-level on marketing surfaces — never nav-only.",
      "Void black + violet / cyan / orange accents; no purple-on-white defaults.",
      "Use Brand tokens when shipping landing or white-label skins.",
    ],
    startHere: {
      goal: "Grab the token map before shipping any marketing or white-label UI.",
      steps: [
        "Open Brand and note void / violet / cyan / orange roles.",
        "Apply hero-level brand on landing — not just nav text.",
        "Ask STORM Guide for a token summary if building a new surface.",
      ],
      primaryLabel: "Token map",
      primaryHref: "/brand",
      nextLabel: "Factory map",
      nextHref: "/how-it-works",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start on Brand?", kind: "improve" },
      { id: "tokens", label: "Token map", prompt: "Summarize ReelStorm brand tokens for UI work.", kind: "learn" },
    ],
  },
  {
    path: "/team",
    layer: "os",
    title: "Team",
    blurb: "Producer seats and STORM agent roles.",
    tips: [
      "Assign voice / world / render roles so jobs do not collide.",
      "One producer owns Director Wizard; another can own Sound / Vault.",
      "Keep RTC spend visible in Wallet when sharing seats.",
    ],
    startHere: {
      goal: "Assign seats so Wizard, World, Render, and Sound don’t collide.",
      steps: [
        "List who owns Wizard / Studio Set vs Studio generate vs Sound.",
        "Assign seats and avoid two people queuing the same project.",
        "Check Wallet before shared Studio runs.",
      ],
      primaryLabel: "Role design",
      primaryHref: "/team",
      nextLabel: "Dashboard",
      nextHref: "/dashboard",
    },
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start on Team?", kind: "improve" },
      { id: "roles", label: "Role design", prompt: "Suggest team roles for a 3-person Academy studio.", kind: "improve" },
    ],
  },
];

/** Every sidebar / OS system — used to verify guide coverage */
export const OS_SYSTEM_GUIDE_PATHS = [
  "/wizard",
  "/yt-os",
  "/tools/clone",
  "/dashboard",
  "/templates-room",
  "/template-forge",
  "/studio-set",
  "/world-builder",
  "/storyboard",
  "/studio",
  "/sound-studio",
  "/archive-vault",
  "/merge-studio",
  "/model-center",
  "/model-center/avatar",
  "/translate",
  "/camera",
  "/wallet",
  "/billing",
  "/account",
  "/brand",
  "/team",
  "/scorecard",
] as const;

/** Build a Start Here wizard for any screen (explicit or derived). */
export function getStartHere(layer: GuideLayer): GuideStartHere {
  if (layer.startHere) return layer.startHere;
  const doOpt = layer.options.find((o) => o.kind === "do" || o.kind === "goto");
  const nextOpt = layer.options.find((o) => o.href && o !== doOpt);
  return {
    goal: layer.blurb,
    steps: (layer.tips.length ? layer.tips : ["Ask STORM Guide: Where do I start on this screen?"]).slice(0, 4),
    primaryLabel: doOpt?.label || "Ask AI: where do I start?",
    primaryHref: doOpt?.href || (typeof layer.path === "string" ? layer.path : "/wizard"),
    nextLabel: nextOpt?.label,
    nextHref: nextOpt?.href,
  };
}

/** Seal every layer: materialize startHere + guarantee a Where do I start? chip */
function sealGuideLayers(layers: GuideLayer[]): GuideLayer[] {
  return layers.map((layer) => {
    const startHere = getStartHere(layer);
    const hasStart = layer.options.some(
      (o) => o.id === "start" || o.id === "where-start" || o.label.trim().toLowerCase() === "where do i start?",
    );
    const whereOpt: GuideOption = {
      id: "start",
      label: "Where do I start?",
      prompt: `Where do I start on ${layer.title}? Give the first click and next two steps.`,
      kind: "improve",
    };
    return {
      ...layer,
      startHere,
      options: hasStart ? layer.options : [whereOpt, ...layer.options],
    };
  });
}

// Materialize startHere + Where do I start on every layer (marketing + OS)
;(GUIDE_LAYERS as GuideLayer[]).splice(0, GUIDE_LAYERS.length, ...sealGuideLayers(GUIDE_LAYERS));

export function resolveGuideLayer(pathname: string): GuideLayer {
  const exact = GUIDE_LAYERS.find((l) => typeof l.path === "string" && l.path === pathname);
  if (exact) return exact;
  const byRegex = GUIDE_LAYERS.find((l) => l.path instanceof RegExp && l.path.test(pathname));
  if (byRegex) return byRegex;
  // Longer paths first (e.g. /yt-os/plan before /yt-os)
  const soft = [...GUIDE_LAYERS]
    .filter((l) => typeof l.path === "string" && l.path !== "/")
    .sort((a, b) => String(b.path).length - String(a.path).length)
    .find((l) => typeof l.path === "string" && pathname.startsWith(l.path));
  if (soft) return soft;
  const fallback: GuideLayer = {
    path: pathname,
    layer:
      pathname.startsWith("/") &&
      !["/", "/how-it-works", "/training", "/pricing", "/white-label", "/developers", "/producers"].some(
        (p) => pathname === p,
      ) &&
      !pathname.startsWith("/legal")
        ? "os"
        : "marketing",
    title: "REELSTORM",
    blurb: "STORM Guide is with you on every layer — factory, YT-OS, and Clone.",
    tips: [
      "Ask how to improve your current workflow.",
      "Or say “what should I do next?” for a concrete path.",
      "Try /yt-os or /tools/clone for YouTube growth loops.",
    ],
    options: [
      { id: "start", label: "Where do I start?", prompt: "Where do I start in ReelStorm OS right now?", kind: "improve" },
      { id: "next", label: "What next?", prompt: "What should I do next in ReelStorm?", kind: "improve" },
      { id: "ytos", label: "YT-OS", prompt: "Show YT-OS eleven skills briefly.", href: "/yt-os", kind: "goto" },
      { id: "map", label: "Factory map", prompt: "Show the factory path briefly.", href: "/how-it-works", kind: "goto" },
      { id: "train", label: "Training", prompt: "Point me to training.", href: "/training", kind: "goto" },
    ],
  };
  fallback.startHere = getStartHere(fallback);
  return fallback;
}

export function buildGuideContextBlock(pathname: string): string {
  const layer = resolveGuideLayer(pathname);
  const start = getStartHere(layer);
  return [
    `Current path: ${pathname}`,
    `Layer: ${layer.layer} · ${layer.title}`,
    `Blurb: ${layer.blurb}`,
    `Start here goal: ${start.goal}`,
    `Start here steps:\n- ${start.steps.join("\n- ")}`,
    `Primary CTA: ${start.primaryLabel}${start.primaryHref ? ` → ${start.primaryHref}` : ""}`,
    `Tips:\n- ${layer.tips.join("\n- ")}`,
    `Suggested options:\n${layer.options.map((o) => `- [${o.kind}] ${o.label}: ${o.prompt}${o.href ? ` → ${o.href}` : ""}`).join("\n")}`,
  ].join("\n");
}
