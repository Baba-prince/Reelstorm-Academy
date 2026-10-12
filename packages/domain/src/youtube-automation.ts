/**
 * YouTube Automation OS — 7-agent pipeline constants (Ray + MissTechy fusion)
 */

export const YT_OS_NICHES = [
  "Real Estate",
  "Health",
  "Finance",
  "AI",
  "Coaching",
] as const;

export type YtOsNiche = (typeof YT_OS_NICHES)[number];

export const YT_OS_RTC_PER_VIDEO = 20;

export const YT_OS_AGENTS = [
  { id: "STRATEGY", label: "Content Strategy", blurb: "Trends → winning topics → 14-day calendar" },
  { id: "SCRIPT", label: "Script Writing", blurb: "HOOK · INTRO · BEATS · CTA" },
  { id: "THUMBNAIL", label: "Thumbnail Designer", blurb: "3 variants · A/B CTR" },
  { id: "SEO", label: "SEO Optimizer", blurb: "Keywords · titles · tags 15–20" },
  { id: "PRODUCTION", label: "Production", blurb: "Avatar · VO · B-roll · R2 assemble" },
  { id: "PUBLISHING", label: "Publishing", blurb: "YouTube upload · schedule · visibility" },
  { id: "ANALYTICS", label: "Analytics", blurb: "CTR · AVD · feedback loop" },
] as const;

/** Seed winning topics from Ray's video + MissTechy authority pattern */
export const YT_SEED_WINNING_TOPICS: Record<
  string,
  Array<{
    title: string;
    audienceGap: string;
    competitorSaturation: string;
    winningScore: number;
    hook: string;
    estimatedViews: number;
  }>
> = {
  AI: [
    {
      title: "I Used AI To Plan My Whole Week — Here's What Happened",
      audienceGap: "High",
      competitorSaturation: "Medium",
      winningScore: 92,
      hook: "Sorry, who is driving this thing?",
      estimatedViews: 48_000,
    },
    {
      title: "AI Tools Nobody Talks About",
      audienceGap: "High",
      competitorSaturation: "Low",
      winningScore: 88,
      hook: "Stop scrolling — these 5 tools replaced my entire team.",
      estimatedViews: 62_000,
    },
    {
      title: "I Fired Myself and Let AI Run My Channel",
      audienceGap: "High",
      competitorSaturation: "Medium",
      winningScore: 85,
      hook: "I FIRED MYSELF. AI ran my life for 7 days.",
      estimatedViews: 71_000,
    },
    {
      title: "7D AI Planning Challenge",
      audienceGap: "Medium",
      competitorSaturation: "Low",
      winningScore: 80,
      hook: "Day 1 alarm. No more decisions.",
      estimatedViews: 35_000,
    },
  ],
  "Real Estate": [
    {
      title: "How Local Listings Become Authority Without Filming",
      audienceGap: "High",
      competitorSaturation: "Low",
      winningScore: 90,
      hook: "Wait — this Waymo just listed a house?",
      estimatedViews: 28_000,
    },
    {
      title: "Unknown to Expert: Real Estate News in 30 Seconds",
      audienceGap: "High",
      competitorSaturation: "Medium",
      winningScore: 86,
      hook: "HOW TO GO FROM UNKNOWN TO EXPERT WITHOUT FILMING",
      estimatedViews: 41_000,
    },
    {
      title: "The Mortgage Rate Update Agents Missed Today",
      audienceGap: "Medium",
      competitorSaturation: "High",
      winningScore: 78,
      hook: "Your clients already saw this. Did you?",
      estimatedViews: 22_000,
    },
  ],
  Health: [
    {
      title: "I Used AI To Track My Health for 7 Days",
      audienceGap: "High",
      competitorSaturation: "Medium",
      winningScore: 87,
      hook: "No more decisions about recovery.",
      estimatedViews: 39_000,
    },
    {
      title: "Local Clinic Updates Turned Into Authority Shorts",
      audienceGap: "High",
      competitorSaturation: "Low",
      winningScore: 84,
      hook: "ON AIR — this health update changes everything.",
      estimatedViews: 33_000,
    },
  ],
  Finance: [
    {
      title: "AI Tools Nobody Talks About for Personal Finance",
      audienceGap: "High",
      competitorSaturation: "Medium",
      winningScore: 89,
      hook: "I stopped guessing my cashflow.",
      estimatedViews: 55_000,
    },
    {
      title: "I Fired Myself From Budgeting",
      audienceGap: "Medium",
      competitorSaturation: "Low",
      winningScore: 82,
      hook: "NO MORE DECISIONS — AI ran my money for a week.",
      estimatedViews: 44_000,
    },
  ],
  Coaching: [
    {
      title: "Become the Go-To Coach Without Filming",
      audienceGap: "High",
      competitorSaturation: "Low",
      winningScore: 91,
      hook: "Stop thinking as only a creator. Start as a strategist.",
      estimatedViews: 37_000,
    },
    {
      title: "Comment EXPERT — Clone Your Authority in 4 Outfits",
      audienceGap: "High",
      competitorSaturation: "Medium",
      winningScore: 85,
      hook: "Same face. Fresh look every day.",
      estimatedViews: 29_000,
    },
  ],
};

export const YT_THUMB_VARIANT_PRESETS = [
  { id: "shock", label: "Variant A — shock look", text: "I FIRED MYSELF", style: "shock" },
  { id: "curiosity", label: "Variant B — curiosity", text: "AI RAN MY LIFE", style: "curiosity" },
  { id: "payoff", label: "Variant C — payoff", text: "NO MORE DECISIONS", style: "payoff" },
] as const;

/** Known live R2 proof video — reused when saver sleeps so Production still ships real mp4 */
export const YT_PROOF_VIDEO_URL =
  "https://videos.reelstorm.uk/videos/835b782996b24d4c81655f507e1acf62.mp4";
