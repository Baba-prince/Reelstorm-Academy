/**
 * REELSTORM Currency (RTC) + subscription tiers
 * Adopted from VisaVideos / passport-paper StripePriceTierService:
 *   free · journey (£39/mo) · journey_pro (£89/mo)
 * Mapped to Storm factory units: 1 ARCHIVE5 block (5 min) = RTC_PER_ARCHIVE5
 */

export const RTC_PER_ARCHIVE5 = 100; // 1 × 5-min block
export const ARCHIVE5_SECONDS = 300;

export type PaidTier = "storm" | "storm_pro";
export type Tier = "free" | PaidTier | "network";

/** VisaVideos naming parallel for docs / admin */
export const TIER_VISA_ALIAS: Record<Exclude<Tier, "network">, string> = {
  free: "Free",
  storm: "Journey",
  storm_pro: "Journey Pro",
};

export const TIER_DISPLAY_NAME: Record<Tier, string> = {
  free: "Studio",
  storm: "Storm",
  storm_pro: "Storm Pro",
  network: "Network",
};

export const TIER_DISPLAY_PRICE: Record<Tier, string> = {
  free: "Free",
  storm: "£39/mo",
  storm_pro: "£89/mo",
  network: "Custom",
};

export const TIER_PRICE_GBP: Record<Tier, number> = {
  free: 0,
  storm: 39,
  storm_pro: 89,
  network: 0, // custom quote
};

/** Monthly RTC allowance (invested into 5-min ARCHIVE5 sections) */
export const TIER_MONTHLY_RTC: Record<Tier, number> = {
  free: 300, // 3 blocks
  storm: 1500, // 15 blocks @ £39
  storm_pro: 4000, // 40 blocks @ £89
  network: 20000, // default pool; overridable per tenant
};

export const TIER_FEATURES: Record<Tier, string[]> = {
  free: [
    "Template Forge upload + YouTube URL extract",
    `${TIER_MONTHLY_RTC.free} RTC / mo (${TIER_MONTHLY_RTC.free / RTC_PER_ARCHIVE5} × ARCHIVE5)`,
    "Local Ollama orchestration",
    "Mock video gen path",
    "Scorecard + brand kit",
  ],
  storm: [
    "Everything in Studio",
    `${TIER_MONTHLY_RTC.storm} RTC / mo (${TIER_MONTHLY_RTC.storm / RTC_PER_ARCHIVE5} × 5-min blocks)`,
    "DashScope + Seedance / Kling / Veo routing",
    "Sound Studio (sync · extract · clone · TTS)",
    "Priority BullMQ jobs",
    "Team seats (3)",
  ],
  storm_pro: [
    "Everything in Storm",
    `${TIER_MONTHLY_RTC.storm_pro} RTC / mo (${TIER_MONTHLY_RTC.storm_pro / RTC_PER_ARCHIVE5} × 5-min blocks)`,
    "White-label API starter (1 tenant)",
    "Custom brand tokens on embed",
    "Team seats (10)",
    "Merge Studio masters",
  ],
  network: [
    "Everything in Storm Pro",
    "Multi-tenant Academy white-label",
    "Custom domain + RS-under-your-brand",
    "Revenue share / RTC resale",
    "SLA render farm",
    "Dedicated support",
  ],
};

export function rtcForDurationSec(durationSec: number): number {
  const blocks = Math.max(1, Math.ceil(durationSec / ARCHIVE5_SECONDS));
  return blocks * RTC_PER_ARCHIVE5;
}

export function blocksFromRtc(rtc: number): number {
  return Math.floor(rtc / RTC_PER_ARCHIVE5);
}

export type RtcPack = {
  id: string;
  rtc: number;
  priceGbp: number;
  label: string;
};

/** One-time RTC top-ups (VisaVideos Power Tap style packs) */
export const RTC_PACKS: RtcPack[] = [
  { id: "pack_5", rtc: 500, priceGbp: 15, label: "5 blocks" },
  { id: "pack_15", rtc: 1500, priceGbp: 39, label: "15 blocks (Storm month)" },
  { id: "pack_40", rtc: 4000, priceGbp: 89, label: "40 blocks (Pro month)" },
  { id: "pack_100", rtc: 10000, priceGbp: 199, label: "100 blocks" },
];

/**
 * Stripe Price IDs — same VisaVideos Journey / Journey Pro catalogue
 * (passport-paper StripePriceTierService).
 * Map Visa journey → storm, journey_pro → storm_pro.
 */
export const STRIPE_PRICE_TO_TIER: Record<string, PaidTier> = {
  price_1TyGglKFjjrlm6Pq5miSVDh6: "storm", // Journey £39
  price_1TyGgyKFjjrlm6PqObBXjtrj: "storm_pro", // Journey Pro £89
};

export const DEFAULT_STRIPE_PRICE: Record<PaidTier, string> = {
  storm: "price_1TyGglKFjjrlm6Pq5miSVDh6",
  storm_pro: "price_1TyGgyKFjjrlm6PqObBXjtrj",
};

export function tierForStripePrice(priceId: string): PaidTier | null {
  return STRIPE_PRICE_TO_TIER[priceId] ?? null;
}

export function stripePriceForTier(tier: PaidTier): string {
  if (tier === "storm") return process.env.STRIPE_PRICE_STORM || DEFAULT_STRIPE_PRICE.storm;
  return process.env.STRIPE_PRICE_STORM_PRO || DEFAULT_STRIPE_PRICE.storm_pro;
}
