export type LocaleCode =
  | "en"
  | "yo"
  | "ha"
  | "ig"
  | "fr"
  | "sw"
  | "ar"
  | "pt"
  | "am"
  | "hi"
  | "zh"
  | "id"
  | "th"
  | "vi"
  | "ms"
  | "ja"
  | "ko"
  | "bn"
  | "fil"
  | "ur";

export type LocaleRegion = "global" | "africa" | "asia";

export type LocaleMeta = {
  code: LocaleCode;
  name: string;
  nativeName: string;
  region: LocaleRegion;
  dir: "ltr" | "rtl";
  countryHints: string[];
};

/** Africa + Asia first markets for ReelStorm Academy */
export const LOCALES: LocaleMeta[] = [
  { code: "en", name: "English", nativeName: "English", region: "global", dir: "ltr", countryHints: ["NG", "GH", "KE", "IN", "SG", "global"] },
  // Africa — Nigeria focus + continental
  { code: "yo", name: "Yoruba", nativeName: "Yorùbá", region: "africa", dir: "ltr", countryHints: ["NG", "BJ", "TG"] },
  { code: "ha", name: "Hausa", nativeName: "Hausa", region: "africa", dir: "ltr", countryHints: ["NG", "NE", "GH", "TD"] },
  { code: "ig", name: "Igbo", nativeName: "Igbo", region: "africa", dir: "ltr", countryHints: ["NG"] },
  { code: "fr", name: "French", nativeName: "Français", region: "africa", dir: "ltr", countryHints: ["SN", "CI", "CM", "CD", "MA", "TN"] },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili", region: "africa", dir: "ltr", countryHints: ["KE", "TZ", "UG", "RW"] },
  { code: "ar", name: "Arabic", nativeName: "العربية", region: "africa", dir: "rtl", countryHints: ["EG", "MA", "DZ", "SD", "AE", "SA"] },
  { code: "pt", name: "Portuguese", nativeName: "Português", region: "africa", dir: "ltr", countryHints: ["AO", "MZ", "CV", "BR"] },
  { code: "am", name: "Amharic", nativeName: "አማርኛ", region: "africa", dir: "ltr", countryHints: ["ET"] },
  // Asia
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", region: "asia", dir: "ltr", countryHints: ["IN"] },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文", region: "asia", dir: "ltr", countryHints: ["CN", "SG", "MY"] },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", region: "asia", dir: "ltr", countryHints: ["ID"] },
  { code: "th", name: "Thai", nativeName: "ไทย", region: "asia", dir: "ltr", countryHints: ["TH"] },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", region: "asia", dir: "ltr", countryHints: ["VN"] },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", region: "asia", dir: "ltr", countryHints: ["MY", "BN", "SG"] },
  { code: "ja", name: "Japanese", nativeName: "日本語", region: "asia", dir: "ltr", countryHints: ["JP"] },
  { code: "ko", name: "Korean", nativeName: "한국어", region: "asia", dir: "ltr", countryHints: ["KR"] },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", region: "asia", dir: "ltr", countryHints: ["BD", "IN"] },
  { code: "fil", name: "Filipino", nativeName: "Filipino", region: "asia", dir: "ltr", countryHints: ["PH"] },
  { code: "ur", name: "Urdu", nativeName: "اردو", region: "asia", dir: "rtl", countryHints: ["PK", "IN"] },
];

export const DEFAULT_LOCALE: LocaleCode = "en";
export const LOCALE_STORAGE_KEY = "rs_locale";

export function getLocaleMeta(code: string): LocaleMeta {
  return LOCALES.find((l) => l.code === code) || LOCALES[0];
}

export function isLocaleCode(v: string): v is LocaleCode {
  return LOCALES.some((l) => l.code === v);
}
