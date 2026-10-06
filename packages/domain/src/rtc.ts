/**
 * REELSTORM Currency (RTC) + subscription tiers
 *
 * Unit rule (Captain model):
 *   1 RTC = 1 minute of final rendered master @ 720p
 *   1 SET  = one finished 5-min ARCHIVE5 asset = 5 RTC
 *
 * Factory cost basis ~$2.20 / RTC (720p) → sell ~$7.99 / RTC with ~65–70% margin.
 * Clip length is the cost lever (5s Cost Saver vs 10s Cinematic).
 */

export const RTC_PER_MINUTE = 1;
/** One finished 5-minute ARCHIVE5 set */
export const RTC_PER_ARCHIVE5 = 5;
export const ARCHIVE5_SECONDS = 300;
export const ARCHIVE5_MINUTES = 5;

/** Soft cost basis for previews (720p). Not billed — Seedance/API real costs vary. */
export const COST_USD_PER_RTC_720 = 2.2;
export const COST_USD_PER_CLIP_720 = 0.3;
export const SELL_USD_PER_RTC = 7.99;

export type PaidTier = "storm" | "storm_pro" | "premium_pro";
export type Tier = "free" | PaidTier | "network";

/** Product display names (Captain launch stack) */
export const TIER_DISPLAY_NAME: Record<Tier, string> = {
  free: "Free Test",
  storm: "Basic",
  storm_pro: "Premium",
  premium_pro: "Premium Pro",
  network: "Network",
};

/** Short alias for cards / docs */
export const TIER_ALIAS: Record<Tier, string> = {
  free: "Hook",
  storm: "Ad shops",
  storm_pro: "YouTubers",
  premium_pro: "Artists · Ads",
  network: "Academies",
};

export const TIER_DISPLAY_PRICE: Record<Tier, string> = {
  free: "$0",
  storm: "$49/mo",
  storm_pro: "$99/mo",
  premium_pro: "$199/mo",
  network: "Custom",
};

export const TIER_PRICE_USD: Record<Tier, number> = {
  free: 0,
  storm: 49,
  storm_pro: 99,
  premium_pro: 199,
  network: 0,
};

/** @deprecated use TIER_PRICE_USD — kept for old GBP callers */
export const TIER_PRICE_GBP: Record<Tier, number> = {
  free: 0,
  storm: 49,
  storm_pro: 99,
  premium_pro: 199,
  network: 0,
};

/** Monthly RTC allowance — sell SETS, meter in minutes */
export const TIER_MONTHLY_RTC: Record<Tier, number> = {
  free: 1, // 1 min free demo · 480p · watermark · no download
  storm: 15, // 3 sets × 5 min · 720p only
  storm_pro: 25, // 5 sets · 1080p unlocked (hero)
  premium_pro: 50, // 10 sets · 1080p native + DNA upload
  network: 200, // default WL pool; overridable per tenant
};

/** System free-demo bank — 4600 RTC funnel into Premium */
export const FREE_DEMO_RTC = 1;
export const SYSTEM_BANK_ID = "reelstorm-system-bank";
export const SYSTEM_BANK_TOTAL_RTC = 4600;
export const SYSTEM_BANK_TOTAL_SETS = 920;
export const SYSTEM_BANK_RTC_PER_SET = 5;
/** Sunk cost basis for System Bank reporting ($/RTC) */
export const SYSTEM_BANK_COST_PER_RTC = 1.93;

/** Finished 5-min sets included (Free = partial test minute, not a full set) */
export const TIER_MONTHLY_SETS: Record<Tier, number> = {
  free: 0,
  storm: 3,
  storm_pro: 5,
  premium_pro: 10,
  network: 40,
};

export const TIER_MAX_RESOLUTION: Record<Tier, "480p" | "720p" | "1080p"> = {
  free: "480p",
  storm: "720p", // lock — force upgrade for 1080p
  storm_pro: "1080p",
  premium_pro: "1080p",
  network: "1080p",
};

export const TIER_FEATURES: Record<Tier, string[]> = {
  free: [
    "1 RTC (1 min) · 480p preview",
    "Big watermark · no download · expires 24h",
    "1 template only (Nollywood or Asia)",
    "Archive Vault preview only",
  ],
  storm: [
    "3 sets × 5-min = 15 RTC / mo",
    "720p only (1080p = upgrade)",
    "3 templates · Archive5 30 days",
    "Watermark off · download unlocked",
  ],
  storm_pro: [
    "5 sets × 5-min = 25 RTC / mo — YouTuber hero",
    "1080p unlocked · 10 templates",
    "Custom voice clone · no watermark",
    "Archive5 unlimited · Merge Studio · 1 seat",
  ],
  premium_pro: [
    "10 sets × 5-min = 50 RTC / mo",
    "1080p native · unlimited templates",
    "Video Upload → Template DNA",
    "3 seats · R2 priority · RTC rollover",
  ],
  network: [
    "Everything in Premium Pro",
    "Multi-tenant Academy white-label",
    "Custom domain + RS-under-your-brand",
    "Revenue share / RTC resale · SLA farm",
  ],
};

/** VisaVideos naming retired — kept as soft alias for migrations */
export const TIER_VISA_ALIAS: Record<Exclude<Tier, "network" | "premium_pro">, string> = {
  free: "Free",
  storm: "Basic",
  storm_pro: "Premium",
};

export function rtcForDurationSec(durationSec: number): number {
  const minutes = Math.max(1, Math.ceil(durationSec / 60));
  return minutes * RTC_PER_MINUTE;
}

export function blocksFromRtc(rtc: number): number {
  return Math.floor(rtc / RTC_PER_ARCHIVE5);
}

export function setsFromRtc(rtc: number): number {
  return blocksFromRtc(rtc);
}

export function minutesFromRtc(rtc: number): number {
  return Math.floor(rtc / RTC_PER_MINUTE);
}

/** Estimate RTC + clip cost from shot list (BOT Wizard cost control) */
export function estimateBlueprintCost(opts: {
  clipCount: number;
  clipSeconds?: number; // 5 = Cost Saver, 10 = Cinematic
}): {
  clips: number;
  clipSeconds: number;
  apiCostUsd: number;
  rtc: number;
  sets: number;
  mode: "cost_saver" | "cinematic";
} {
  const clipSeconds = opts.clipSeconds === 10 ? 10 : 5;
  const clips = Math.max(0, opts.clipCount);
  const apiCostUsd = Number((clips * COST_USD_PER_CLIP_720).toFixed(2));
  // Rough: factory maps clip runtime → final minutes; floor at 1 RTC
  const totalSec = clips * clipSeconds;
  const rtc = Math.max(1, Math.ceil(totalSec / 60));
  return {
    clips,
    clipSeconds,
    apiCostUsd,
    rtc,
    sets: blocksFromRtc(rtc),
    mode: clipSeconds === 5 ? "cost_saver" : "cinematic",
  };
}

export type RtcPack = {
  id: string;
  rtc: number;
  priceUsd: number;
  label: string;
  /** @deprecated */
  priceGbp?: number;
};

/** Overage packs — where viral months print margin */
export const RTC_PACKS: RtcPack[] = [
  { id: "pack_10", rtc: 10, priceUsd: 69, priceGbp: 69, label: "10 RTC · 2 sets" },
  { id: "pack_25", rtc: 25, priceUsd: 149, priceGbp: 149, label: "25 RTC · 5 sets" },
  { id: "pack_50", rtc: 50, priceUsd: 269, priceGbp: 269, label: "50 RTC · 10 sets" },
];

/**
 * Stripe Price IDs — create Basic $49 / Premium $99 / Premium Pro $199 in Dashboard,
 * then set STRIPE_PRICE_* env. Legacy Journey IDs kept as fallbacks until swapped.
 */
export const STRIPE_PRICE_TO_TIER: Record<string, PaidTier> = {
  price_1TyGglKFjjrlm6Pq5miSVDh6: "storm", // legacy Journey → Basic until replaced
  price_1TyGgyKFjjrlm6PqObBXjtrj: "storm_pro", // legacy Journey Pro → Premium
};

export const DEFAULT_STRIPE_PRICE: Record<PaidTier, string> = {
  storm: "price_1TyGglKFjjrlm6Pq5miSVDh6",
  storm_pro: "price_1TyGgyKFjjrlm6PqObBXjtrj",
  premium_pro: "price_premium_pro_placeholder",
};

export function tierForStripePrice(priceId: string): PaidTier | null {
  return STRIPE_PRICE_TO_TIER[priceId] ?? null;
}

export function stripePriceForTier(tier: PaidTier): string {
  if (tier === "storm") return process.env.STRIPE_PRICE_STORM || DEFAULT_STRIPE_PRICE.storm;
  if (tier === "storm_pro")
    return process.env.STRIPE_PRICE_STORM_PRO || DEFAULT_STRIPE_PRICE.storm_pro;
  return process.env.STRIPE_PRICE_PREMIUM_PRO || DEFAULT_STRIPE_PRICE.premium_pro;
}

export function isPaidTier(tier: string): tier is PaidTier {
  return tier === "storm" || tier === "storm_pro" || tier === "premium_pro";
}
