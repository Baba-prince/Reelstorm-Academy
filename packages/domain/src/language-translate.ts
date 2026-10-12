/**
 * Language Studio / Translate OS — EN video → de / yo / ha / ig with body sync
 */

export const TRANSLATE_PRIMARY_LANGS = ["de", "yo", "ha", "ig"] as const;
export type TranslateLangCode = (typeof TRANSLATE_PRIMARY_LANGS)[number] | "en" | "fr" | "es";

export const TRANSLATE_LANG_META: Record<
  string,
  { code: string; label: string; native: string; nllb: string; primary: boolean }
> = {
  de: { code: "de", label: "German", native: "Deutsch", nllb: "deu_Latn", primary: true },
  yo: { code: "yo", label: "Yoruba", native: "Yorùbá", nllb: "yor_Latn", primary: true },
  ha: { code: "ha", label: "Hausa", native: "Hausa", nllb: "hau_Latn", primary: true },
  ig: { code: "ig", label: "Igbo", native: "Igbo", nllb: "ibo_Latn", primary: true },
  en: { code: "en", label: "English", native: "English", nllb: "eng_Latn", primary: false },
  fr: { code: "fr", label: "French", native: "Français", nllb: "fra_Latn", primary: false },
  es: { code: "es", label: "Spanish", native: "Español", nllb: "spa_Latn", primary: false },
};

export const TRANSLATE_PIPELINE_STEPS = [
  { id: "DOWNLOADING", label: "Download", n: "01" },
  { id: "TRANSCRIBING", label: "Transcribe", n: "02" },
  { id: "TRANSLATING", label: "Translate", n: "03" },
  { id: "TTS", label: "TTS Voice", n: "04" },
  { id: "LIPSYNC", label: "Lip + Body Sync", n: "05" },
  { id: "MUXING", label: "Mux + Subs", n: "06" },
  { id: "DONE", label: "Done", n: "07" },
] as const;

/** RTC per target language */
export const TRANSLATE_RTC_PER_LANG = 10;

export function translateRtcCost(langs: string[]): number {
  return Math.max(0, langs.length) * TRANSLATE_RTC_PER_LANG;
}

export function classifyTranslateSource(
  url: string,
): "YOUTUBE_URL" | "INSTAGRAM_URL" | "UPLOAD" {
  const u = (url || "").toLowerCase();
  if (u.includes("instagram.com") || u.includes("instagr.am")) return "INSTAGRAM_URL";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YOUTUBE_URL";
  if (!u.trim()) return "UPLOAD";
  return "YOUTUBE_URL";
}

/** Soft-launch seed transcript for Dario-style study reels when Whisper unavailable */
export const TRANSLATE_SEED_TRANSCRIPT = {
  text: "These four simple ChatGPT study commands turn any lecture into a cheat sheet, blueprint, flashcards, and mind map. Copy them, paste your notes, and ship your revision pack in minutes.",
  language: "en",
  segments: [
    { start: 0, end: 3.2, text: "These four simple ChatGPT study commands" },
    { start: 3.2, end: 7.5, text: "turn any lecture into a cheat sheet, blueprint, flashcards, and mind map." },
    { start: 7.5, end: 12.0, text: "Copy them, paste your notes, and ship your revision pack in minutes." },
  ],
};

export const TRANSLATE_SEED_TRANSLATIONS: Record<
  string,
  { text: string; segments: Array<{ start: number; end: number; text: string }> }
> = {
  de: {
    text: "Diese vier einfachen ChatGPT-Lernbefehle verwandeln jede Vorlesung in einen Spickzettel, einen Bauplan, Karteikarten und eine Mindmap. Kopiere sie, füge deine Notizen ein und erstelle dein Lernpaket in Minuten.",
    segments: [
      { start: 0, end: 3.2, text: "Diese vier einfachen ChatGPT-Lernbefehle" },
      { start: 3.2, end: 7.5, text: "verwandeln jede Vorlesung in einen Spickzettel, einen Bauplan, Karteikarten und eine Mindmap." },
      { start: 7.5, end: 12.0, text: "Kopiere sie, füge deine Notizen ein und erstelle dein Lernpaket in Minuten." },
    ],
  },
  yo: {
    text: "Àwọn àṣẹ ìkẹ́kọ̀ọ́ ChatGPT mẹ́rin tí ó rọrùn yìí sọ ẹ̀kọ́ yòówù di àkójọpọ̀ ìrànlọ́wọ́, àtẹ̀jáde, káàdì ìrántí àti máàpù ọpọlọ. Dà wọn kọ, fi àkọsílẹ̀ rẹ kún un, kí o sì fi ìpín ìtúnwò rẹ jáde ní ìṣẹ́jú díẹ̀.",
    segments: [
      { start: 0, end: 3.2, text: "Àwọn àṣẹ ìkẹ́kọ̀ọ́ ChatGPT mẹ́rin tí ó rọrùn yìí" },
      { start: 3.2, end: 7.5, text: "sọ ẹ̀kọ́ yòówù di àkójọpọ̀ ìrànlọ́wọ́, àtẹ̀jáde, káàdì ìrántí àti máàpù ọpọlọ." },
      { start: 7.5, end: 12.0, text: "Dà wọn kọ, fi àkọsílẹ̀ rẹ kún un, kí o sì fi ìpín ìtúnwò rẹ jáde ní ìṣẹ́jú díẹ̀." },
    ],
  },
  ha: {
    text: "Waɗannan umarni huɗu masu sauƙi na koyon ChatGPT suna mayar da kowace darasi zuwa takardar gaggawa, tsari, katunan koyo da taswirar hankali. Kwafi su, manna bayanin ka, ka kuma fitar da fakitin bitarka cikin mintuna.",
    segments: [
      { start: 0, end: 3.2, text: "Waɗannan umarni huɗu masu sauƙi na koyon ChatGPT" },
      { start: 3.2, end: 7.5, text: "suna mayar da kowace darasi zuwa takardar gaggawa, tsari, katunan koyo da taswirar hankali." },
      { start: 7.5, end: 12.0, text: "Kwafi su, manna bayanin ka, ka kuma fitar da fakitin bitarka cikin mintuna." },
    ],
  },
  ig: {
    text: "Iwu ọmụmụ ChatGPT anọ ndị a dị mfe na-agbanwe nkuzi ọ bụla ka ọ bụrụ mpempe akwụkwọ enyemaka, atụmatụ, kaadị mmụta na map uche. Detuo ha, tinye ndetu gị, wee wepụta ngwungwu mmegharị gị n'ime nkeji ole na ole.",
    segments: [
      { start: 0, end: 3.2, text: "Iwu ọmụmụ ChatGPT anọ ndị a dị mfe" },
      { start: 3.2, end: 7.5, text: "na-agbanwe nkuzi ọ bụla ka ọ bụrụ mpempe akwụkwọ enyemaka, atụmatụ, kaadị mmụta na map uche." },
      { start: 7.5, end: 12.0, text: "Detuo ha, tinye ndetu gị, wee wepụta ngwungwu mmegharị gị n'ime nkeji ole na ole." },
    ],
  },
};
