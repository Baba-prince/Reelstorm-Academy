/**
 * Stock intro catalog — queries for Pixabay (primary) Template Room fill.
 * Target: ~20 cached intros per category → ~100 total.
 */

export const INTRO_STOCK_CATEGORIES = [
  "nollywood",
  "asia",
  "drama",
  "product",
  "intros",
] as const;

export type IntroStockCategory = (typeof INTRO_STOCK_CATEGORIES)[number];

/** Map Template Room category ids → stock intro buckets */
export const TEMPLATE_ROOM_TO_INTRO_STOCK: Record<string, IntroStockCategory> = {
  nollywood: "nollywood",
  asia: "asia",
  drama: "drama",
  action_thriller: "drama",
  product_ad: "product",
  intro: "intros",
  social: "intros",
};

/** 5 queries × 4 clips ≈ 20 per category */
export const INTRO_STOCK_QUERIES: Record<IntroStockCategory, string[]> = {
  nollywood: [
    "nollywood gold particles intro",
    "lagos drone cinematic opener",
    "african light leak logo reveal",
    "gold dust particles logo",
    "nigerian film burn intro",
  ],
  asia: [
    "tokyo neon intro logo",
    "k-drama soft light logo reveal",
    "bollywood color particles intro",
    "japanese sakura petals logo",
    "asian city skyline opener",
  ],
  drama: [
    "a24 cinematic intro smoke",
    "lens flare logo reveal",
    "film burn cinematic opener",
    "dark moody particles intro",
    "epic light rays logo",
  ],
  product: [
    "minimal white logo reveal",
    "glitch product intro",
    "3d rotation logo reveal",
    "clean corporate opener",
    "luxury gold logo reveal",
  ],
  intros: [
    "logo reveal particles",
    "lower third animated",
    "countdown cinematic opener",
    "abstract light streaks intro",
    "energy particles logo",
  ],
};

export const INTROS_PER_CATEGORY_TARGET = 20;
/** Clips saved per query (5 queries × 4 = 20) */
export const INTROS_PER_QUERY = 4;
