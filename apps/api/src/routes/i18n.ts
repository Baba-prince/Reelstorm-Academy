import type { FastifyInstance } from "fastify";

/** Locale catalog for Africa / Asia markets */
export const I18N_LOCALES = [
  { code: "en", name: "English", nativeName: "English", region: "global", dir: "ltr" },
  { code: "yo", name: "Yoruba", nativeName: "Yorùbá", region: "africa", dir: "ltr" },
  { code: "ha", name: "Hausa", nativeName: "Hausa", region: "africa", dir: "ltr" },
  { code: "ig", name: "Igbo", nativeName: "Igbo", region: "africa", dir: "ltr" },
  { code: "fr", name: "French", nativeName: "Français", region: "africa", dir: "ltr" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili", region: "africa", dir: "ltr" },
  { code: "ar", name: "Arabic", nativeName: "العربية", region: "africa", dir: "rtl" },
  { code: "pt", name: "Portuguese", nativeName: "Português", region: "africa", dir: "ltr" },
  { code: "am", name: "Amharic", nativeName: "አማርኛ", region: "africa", dir: "ltr" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", region: "asia", dir: "ltr" },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文", region: "asia", dir: "ltr" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", region: "asia", dir: "ltr" },
  { code: "th", name: "Thai", nativeName: "ไทย", region: "asia", dir: "ltr" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", region: "asia", dir: "ltr" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", region: "asia", dir: "ltr" },
  { code: "ja", name: "Japanese", nativeName: "日本語", region: "asia", dir: "ltr" },
  { code: "ko", name: "Korean", nativeName: "한국어", region: "asia", dir: "ltr" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", region: "asia", dir: "ltr" },
  { code: "fil", name: "Filipino", nativeName: "Filipino", region: "asia", dir: "ltr" },
  { code: "ur", name: "Urdu", nativeName: "اردو", region: "asia", dir: "rtl" },
] as const;

export async function i18nRoutes(app: FastifyInstance) {
  app.get("/api/i18n/locales", async () => ({
    target: "africa_asia",
    default: "en",
    locales: I18N_LOCALES,
    note: "UI strings ship in web i18n packs; Guide replies honor locale when LLM keys are set.",
  }));
}
