/**
 * STORM Guide — system knowledge + workflow improvement options
 * Used by API (LLM grounding) and web (instant page tips).
 * Keep in sync with shipped OS: YT-OS v2, Viral Clone Factory, Pixabay PRIMARY, Account.
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

export const GUIDE_SYSTEM_PROMPT = `You are STORM Guide — the in-product AI coach for REELSTORM ACADEMY OS v1.2 / YT-OS v2.

Mission:
- Teach system knowledge (Factory = OS, RTC, ARCHIVE5, Soul ID, STORM pipeline, BOT Director Wizard, YT-OS 11 skills, Viral Clone Factory).
- Improve the operator's workflow with concrete next actions.
- Stay concise: 2–5 short paragraphs or bullets max.
- Always offer 2–4 actionable options when helpful (as plain text like "→ Option: …").
- Never invent API keys or claim jobs finished unless the user said so.
- Prefer factory order: BOT Director Wizard (or /yt-os / /tools/clone) → Templates Room / Template Forge → Full Studio Set (/studio-set: Room · Artist · Imagery) → Storyboard → Studio → Sound Studio → Archive Vault → Merge Studio. World Builder deep-links into Studio Set.
- Sound Studio is the voice OS (sync · extract · mux · library · TTS). Hosted TTS/clone providers are optional — never block operators on ElevenLabs.
- Template Room stock intros: Pixabay is PRIMARY (Pexels paused). Cached to R2/local — GET /api/templates?type=intro — $0 Seedance cost for intros.
- Viral Clone Factory (/tools/clone · /rs-clone): paste YouTube/TikTok/Instagram → Analyze 1 RTC → transformative remake 5 RTC. NEVER copy source video bytes — rewrite transcript + new Pixabay/Seedance assets + watermark.
- YT-OS v2 (/yt-os): 11 slash skills /rs-viral · /rs-script (21 hooks) · /rs-package · /rs-video · /rs-voice · /rs-thumb · /rs-comments · /rs-plan · /rs-publish · /rs-analytics · /rs-clone — all inside REELSTORM (not external Claude).
- Account menu (header avatar): Account settings · Change password · Billing · RTC Wallet · Log out. Captain Admin only for locked admin email.
- Free demo: 1 RTC from SystemBank (4600 RTC pool ≈ 920 × 5-min sets). Free users can analyze/demo; reproduce/vault needs paid RTC.
- Soft launch: Ollama may power the guide LLM; Stripe test + mock video OK until live DashScope/Seedance/sk_live keys are stamped.
- RTC rule: 1 RTC = 1 minute of finished master (720p). One 5-min ARCHIVE5 set = 5 RTC. Tiers: Free Test $0 (1 RTC demo) · Storm / Storm Pro / Premium Pro via /billing + /wallet. Clone: 1 RTC analyze + 5 RTC reproduce.

Tone: sharp producer, not corporate. Brand colors mentally: violet / cyan / orange on void black.
Compliance: Clone Factory is transformative fair-use remake for inspiration — original assets only.`;

export const GUIDE_LAYERS: GuideLayer[] = [
  {
    path: "/",
    layer: "marketing",
    title: "Landing",
    blurb: "Brand-first entry to the production OS factory + YT-OS.",
    tips: [
      "REELSTORM is not a course player — it is a factory that vaults ARCHIVE5 IP.",
      "New: YT-OS (/yt-os) runs 11 YouTube skills inside the OS; Clone Factory remakes viral links transformatively.",
      "Start with BOT Director Wizard, YT-OS, or Template Forge.",
    ],
    options: [
      { id: "train", label: "Flip training guide", prompt: "Walk me through the training manual path.", href: "/training", kind: "goto" },
      { id: "ytos", label: "Open YT-OS", prompt: "What are the 11 /rs-* skills and which should I try first?", href: "/yt-os", kind: "goto" },
      { id: "clone", label: "Viral Clone Factory", prompt: "How does link-to-video clone work and what does it cost?", href: "/tools/clone", kind: "goto" },
      { id: "forge", label: "Open Template Forge", prompt: "What should I do first in Template Forge?", href: "/template-forge", kind: "do" },
      { id: "pricing", label: "RTC pricing", prompt: "Explain RTC, free demo SystemBank, and paid tiers.", href: "/pricing", kind: "learn" },
    ],
  },
  {
    path: "/training",
    layer: "marketing",
    title: "Training Manual",
    blurb: "Flip-over artifact — screen-by-screen operator training.",
    tips: [
      "Use arrow keys or Flip to advance; Index jumps to any chapter.",
      "Match each system image to the live OS screen before moving on.",
      "Also learn live: YT-OS, Viral Clone, Account menu, Pixabay intros in Templates Room.",
    ],
    options: [
      { id: "rules", label: "System rules first", prompt: "Summarize Section A system rules I must not break.", kind: "learn" },
      { id: "wizard", label: "BOT Director path", prompt: "How does BOT Director Wizard fit before Template Forge?", href: "/wizard", kind: "goto" },
      { id: "ytos", label: "YT-OS chapter", prompt: "Explain YT-OS v2 eleven skills for a new YouTuber.", href: "/yt-os", kind: "goto" },
      { id: "ops", label: "Operator path", prompt: "Give me the fastest operator path Wizard→Merge including Clone optional.", kind: "improve" },
    ],
  },
  {
    path: "/how-it-works",
    layer: "marketing",
    title: "Factory Map",
    blurb: "STORM stages · YT-OS · Clone · zero timeline scrubbing.",
    tips: [
      "Lock intent before pixels — Story Contract, Wizard, or paste a viral link into Clone Factory.",
      "Soul ID + room plates before STORM render.",
      "Sound Studio owns voice after Studio QC — before or alongside vault.",
    ],
    options: [
      { id: "stages", label: "Explain STORM stages", prompt: "Explain each STORM stage and common failure mode.", kind: "learn" },
      { id: "ytos", label: "Where YT-OS fits", prompt: "How do YT-OS skills feed the factory?", href: "/yt-os", kind: "learn" },
      { id: "wizard", label: "Start with Wizard", prompt: "Should I use BOT Director Wizard, YT-OS, or Template Forge first?", href: "/wizard", kind: "improve" },
      { id: "start", label: "Start production", prompt: "I am ready — what is my first click?", href: "/template-forge", kind: "do" },
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
      "Prefer BOT Director Wizard or YT-OS for a guided first project.",
    ],
    options: [
      { id: "next", label: "What next?", prompt: "Based on a fresh project, what should I do next?", kind: "improve" },
      { id: "wizard", label: "Open Wizard", prompt: "Walk me through BOT Director Wizard stages.", href: "/wizard", kind: "do" },
      { id: "ytos", label: "YT-OS skills", prompt: "Which YT-OS skill should I run first?", href: "/yt-os", kind: "goto" },
      { id: "rtc", label: "Check RTC", prompt: "How do I know if I have enough RTC for 2 ARCHIVE5 blocks?", href: "/wallet", kind: "goto" },
    ],
  },
  {
    path: "/wizard",
    layer: "os",
    title: "BOT Director Wizard",
    blurb: "Seven-stage blueprint · Idea or Clone Viral Link tab.",
    tips: [
      "Step 1 tabs: Generate from Idea OR Clone Viral Link (opens /tools/clone).",
      "Paste YouTube / TikTok / Instagram / social URLs for DNA into LIVE ENGINE.",
      "Free demo 1 RTC can burn for a 1-min watermarked preview.",
      "When READY, Feed Factory → from-blueprint into STORM.",
    ],
    options: [
      { id: "stages", label: "Explain 7 stages", prompt: "Explain each BOT Director Wizard stage and what I must enter.", kind: "learn" },
      { id: "clone-tab", label: "Clone Viral Link", prompt: "How do I use the Clone Viral Link tab vs idea generate?", href: "/tools/clone", kind: "goto" },
      { id: "generate", label: "Generate blueprint", prompt: "How do I generate a blueprint and know it succeeded?", kind: "do" },
      { id: "handoff", label: "Into factory", prompt: "How do I hand a blueprint off to Studio / Archive?", kind: "improve" },
    ],
  },
  {
    path: "/yt-os",
    layer: "os",
    title: "YT-OS v2",
    blurb: "Eleven /rs-* skills — Claude-killer YouTube OS inside REELSTORM.",
    tips: [
      "Skills: viral · script (21 hooks) · package · video edit · voice · thumb · comments · plan · publish · analytics · clone.",
      "Connected badge = REELSTORM OS; YouTube OAuth publish is pending connect.",
      "Costs draw from your RTC wallet / SystemBank — Pixabay intros keep Shorts near $0.",
      "Slash filter at bottom: type rs-viral, rs-clone…",
    ],
    options: [
      { id: "viral", label: "Run /rs-viral", prompt: "How does Virality Engine find and rebuild niche winners?", kind: "do" },
      { id: "script", label: "21 hooks", prompt: "Explain hook formulas and write a Shorts script for my niche.", kind: "learn" },
      { id: "plan", label: "30-day calendar", prompt: "How do I generate a Long/Short calendar?", href: "/yt-os/plan", kind: "goto" },
      { id: "clone", label: "Open Clone", prompt: "Take me to link-to-video remake.", href: "/tools/clone", kind: "goto" },
    ],
  },
  {
    path: "/yt-os/plan",
    layer: "os",
    title: "Content Calendar",
    blurb: "/rs-plan — 30-day Long/Short schedule from bank RTC.",
    tips: [
      "Long Mon/Wed/Fri (~5 RTC) · Short other days (~1 RTC).",
      "Lean on Pixabay intros to keep Short cost near zero.",
      "Generate plan then produce via /rs-script → Studio / Clone.",
    ],
    options: [
      { id: "gen", label: "Generate plan", prompt: "How do I generate and read the 30-day calendar?", kind: "do" },
      { id: "cost", label: "RTC budget", prompt: "Estimate RTC for 30 Shorts + 12 Longs from SystemBank.", kind: "learn" },
      { id: "back", label: "Back to skills", prompt: "Return to YT-OS dashboard.", href: "/yt-os", kind: "goto" },
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
    options: [
      { id: "flow", label: "Full flow", prompt: "Walk me through analyze then reproduce with kids style.", kind: "do" },
      { id: "cost", label: "RTC costs", prompt: "Explain 1+5 RTC and free demo limits for clone.", kind: "learn" },
      { id: "legal", label: "Compliance", prompt: "What makes a remake transformative vs copyright risk?", kind: "learn" },
      { id: "ytos", label: "YT-OS viral", prompt: "How does /rs-viral differ from Clone Factory?", href: "/yt-os", kind: "goto" },
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
    options: [
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
    options: [
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
    blurb: "Room · Artist · Imagery — lock every camera angle before Director generate.",
    tips: [
      "Seed Courtroom Drama for a complete multi-angle legal set (establishing → gavel close).",
      "Import artists from image or video URLs — front / left / right / 3Q must pass.",
      "Customize background prompts in Imagery Studio; Apply to Director only when readiness is green.",
      "AI Guide tours framing for operators who do not know camera angles.",
    ],
    options: [
      { id: "tour", label: "Courtroom tour", prompt: "Walk me through courtroom camera angles like a DP — establishing to insert.", kind: "learn" },
      { id: "angles", label: "What's missing?", prompt: "Given my Studio Set readiness, which angles still block Apply to Director?", kind: "improve" },
      { id: "artist", label: "Import artist", prompt: "How do I import a cast artist from an image or video URL with all angles?", kind: "do" },
      { id: "apply", label: "Apply to Director", prompt: "Checklist before Apply to Director and open Storyboard.", href: "/storyboard", kind: "goto" },
    ],
  },
  {
    path: /^\/studio-set\/(room|artist|imagery)/,
    layer: "os",
    title: "Studio Set module",
    blurb: "Camera coach for Room, Artist, or Imagery tabs.",
    tips: [
      "Wide = geography. Medium = dialogue. OSH = confrontation. Close/insert = emphasis.",
      "Fresh artist plates when wardrobe or scene lighting changes.",
      "Prompt-customize imagery, then regenerate room plates so backgrounds match the drama.",
    ],
    options: [
      { id: "framing", label: "Framing cheat sheet", prompt: "Explain wide, medium, OSH, close, insert, establishing, reaction for new directors.", kind: "learn" },
      { id: "set", label: "Back to Studio Set", prompt: "Return to Full Studio Set overview.", href: "/studio-set", kind: "goto" },
    ],
  },
  {
    path: "/world-builder",
    layer: "os",
    title: "World Builder",
    blurb: "Legacy Soul/Room lock — prefer Full Studio Set.",
    tips: [
      "Use /studio-set for multi-angle Room + Artist + Imagery with AI Guide.",
      "World Builder still locks basic Soul ID + 4 plates if you need a quick stub.",
    ],
    options: [
      { id: "set", label: "Open Studio Set", prompt: "Take me to Full Studio Set to lock courtroom angles and cast.", href: "/studio-set", kind: "goto" },
      { id: "soul", label: "Quick Soul stub", prompt: "How do I lock Soul ID correctly on World Builder?", kind: "do" },
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
    blurb: "Voice OS — sync · extract · mux · library · /rs-voice.",
    tips: [
      "Sound Studio owns all voice work; hosted clone/TTS keys are optional.",
      "YT-OS /rs-voice redirects here for clone + TTS.",
      "Sync needs a Template Forge uploadId + audio file/URL/asset.",
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
    blurb: "Balance · free demo · top-up · vouchers.",
    tips: [
      "Free users get 1 RTC demo from SystemBank once.",
      "Top up before Studio if remaining < 2 sets (10 RTC).",
      "Clone reproduce needs 5 RTC — analyze alone may use your free demo.",
    ],
    options: [
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
    options: [
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
    options: [
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
    options: [
      { id: "gift", label: "Gift RTC", prompt: "How do I gift RTC or issue a voucher without touching SystemBank?", kind: "do" },
      { id: "bank", label: "Bank status", prompt: "How do I read SystemBank remaining on admin?", kind: "learn" },
      { id: "back", label: "Back to OS", prompt: "Return to dashboard for production.", href: "/dashboard", kind: "goto" },
    ],
  },
  {
    path: "/model-center",
    layer: "os",
    title: "Model Center",
    blurb: "DashScope / Ollama LLM · Seedance video · optional Kling/Veo/TTS.",
    tips: [
      "Soft launch minimum: Ollama local LLM (GUIDE_USE_OLLAMA=1) + mock video OK.",
      "Production: DASHSCOPE_API_KEY + Seedance + MOCK_VIDEO_GEN=0 + sk_live Stripe.",
      "Pixabay API key powers Template Room intros (PRIMARY) — never commit keys to git.",
    ],
    options: [
      { id: "min", label: "Minimum keys", prompt: "What is the minimum key set for soft launch vs full production?", kind: "learn" },
      { id: "pixabay", label: "Pixabay intros", prompt: "How does Pixabay PRIMARY wire into Template Room?", href: "/templates-room", kind: "goto" },
      { id: "score", label: "Check scorecard", prompt: "How do I verify Model Center readiness on the scorecard?", href: "/scorecard", kind: "goto" },
    ],
  },
  {
    path: "/scorecard",
    layer: "os",
    title: "Scorecard",
    blurb: "Production readiness gates (v1.2 / soft-launch).",
    tips: [
      "Target grade A on /api/readiness before academy launch.",
      "Soft launch: Ollama LLM, Stripe test, mock video can PASS with SOFT_LAUNCH=1.",
      "Confirm Pixabay intros filled + YT-OS/clone routes healthy after deploy.",
    ],
    options: [
      { id: "gaps", label: "Close gaps", prompt: "Typical readiness gaps and how to close them on soft launch.", kind: "improve" },
      { id: "api", label: "API readiness", prompt: "What does /api/readiness check now?", kind: "learn" },
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
  const byRegex = GUIDE_LAYERS.find((l) => l.path instanceof RegExp && l.path.test(pathname));
  if (byRegex) return byRegex;
  // Longer paths first (e.g. /yt-os/plan before /yt-os)
  const soft = [...GUIDE_LAYERS]
    .filter((l) => typeof l.path === "string" && l.path !== "/")
    .sort((a, b) => String(b.path).length - String(a.path).length)
    .find((l) => typeof l.path === "string" && pathname.startsWith(l.path));
  if (soft) return soft;
  return {
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
      { id: "next", label: "What next?", prompt: "What should I do next in ReelStorm?", kind: "improve" },
      { id: "ytos", label: "YT-OS", prompt: "Show YT-OS eleven skills briefly.", href: "/yt-os", kind: "goto" },
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
