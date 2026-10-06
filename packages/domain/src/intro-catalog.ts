/**
 * Stock intro catalog — queries for Pexels / Pixabay Template Room fill.
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

export const INTRO_STOCK_QUERIES: Record<IntroStockCategory, string[]> = {
  nollywood: [
    "nollywood gold particles intro",
    "lagos drone cinematic opener",
    "african light leak logo",
  ],
  asia: ["tokyo neon intro", "k-drama soft logo reveal", "bollywood color particles"],
  drama: ["a24 cinematic intro", "smoke logo reveal", "lens flare opener"],
  product: ["minimal white logo reveal", "glitch product intro", "rotation 3d logo"],
  intros: ["logo reveal particles", "lower third animated", "countdown cinematic"],
};

/** Target ~20 cached intros per category (3 queries × ~7 clips) */
export const INTROS_PER_CATEGORY_TARGET = 20;
export const INTROS_PER_QUERY = 7;
