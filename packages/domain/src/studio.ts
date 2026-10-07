/**
 * ReelStorm Studio (desktop Option 2) — plans + central minute control.
 * User GPU generates; server meters monthly minutes + device slots.
 */

export type StudioPlanId = "free" | "starter" | "pro" | "agency" | "unlimited";

export type StudioPlanDef = {
  id: StudioPlanId;
  name: string;
  priceUsd: number;
  monthlyLimit: number;
  devicesAllowed: number;
  /** Stripe price env key (optional until products created) */
  stripePriceEnv: string;
  blurb: string;
};

export const STUDIO_PLANS: Record<StudioPlanId, StudioPlanDef> = {
  free: {
    id: "free",
    name: "Studio Free",
    priceUsd: 0,
    monthlyLimit: 5,
    devicesAllowed: 1,
    stripePriceEnv: "",
    blurb: "5 mins on your GPU — hook into the factory",
  },
  starter: {
    id: "starter",
    name: "Studio Starter",
    priceUsd: 49,
    monthlyLimit: 30,
    devicesAllowed: 1,
    stripePriceEnv: "STRIPE_PRICE_STUDIO_STARTER",
    blurb: "30 mins/mo · 1 device · your RTX does the work",
  },
  pro: {
    id: "pro",
    name: "TubeStarter Pro",
    priceUsd: 149,
    monthlyLimit: 500,
    devicesAllowed: 2,
    stripePriceEnv: "STRIPE_PRICE_STUDIO_PRO",
    blurb: "500 mins/mo · 2 devices · YT-OS + Clone ready",
  },
  agency: {
    id: "agency",
    name: "Studio Agency",
    priceUsd: 599,
    monthlyLimit: 2000,
    devicesAllowed: 5,
    stripePriceEnv: "STRIPE_PRICE_STUDIO_AGENCY",
    blurb: "2000 mins/mo · 5 seats · fair-use unlimited feel",
  },
  unlimited: {
    id: "unlimited",
    name: "Studio Unlimited",
    priceUsd: 999,
    monthlyLimit: 10000,
    devicesAllowed: 10,
    stripePriceEnv: "STRIPE_PRICE_STUDIO_UNLIMITED",
    blurb: "10k mins fair-use · 10 devices · $0 GPU COGS to ReelStorm",
  },
};

export const STUDIO_LICENSE_PREFIX = "RSTUDIO";
export const STUDIO_ACTIVATED_TOKEN_TTL_SEC = 7 * 24 * 3600; // 7 days
export const STUDIO_OFFLINE_GRACE_HOURS = 72;
export const STUDIO_OVERAGE_USD_PER_MIN = 0.1;

export function studioPlanFromStripePrice(priceId: string): StudioPlanId | null {
  if (!priceId) return null;
  for (const plan of Object.values(STUDIO_PLANS)) {
    if (!plan.stripePriceEnv) continue;
    const envPrice = process.env[plan.stripePriceEnv];
    if (envPrice && envPrice === priceId) return plan.id;
  }
  // metadata fallback tags
  return null;
}

export function stripePriceForStudioPlan(plan: StudioPlanId): string {
  const def = STUDIO_PLANS[plan];
  if (!def.stripePriceEnv) return "";
  return process.env[def.stripePriceEnv] || `price_studio_${plan}_placeholder`;
}

export function maskStudioKey(fullOrPrefix: string): string {
  const raw = fullOrPrefix.replace(/^RSTUDIO[-.]?/i, "");
  const last4 = raw.slice(-4) || "XXXX";
  return `${STUDIO_LICENSE_PREFIX}-••••${last4}`;
}
