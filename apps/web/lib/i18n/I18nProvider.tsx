"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  LOCALES,
  getLocaleMeta,
  isLocaleCode,
  type LocaleCode,
  type LocaleMeta,
} from "./locales";
import { translate } from "./messages";

type I18nContextValue = {
  locale: LocaleCode;
  meta: LocaleMeta;
  locales: LocaleMeta[];
  setLocale: (code: LocaleCode) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function detectInitial(): LocaleCode {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved && isLocaleCode(saved)) return saved;
  } catch {
    /* ignore */
  }
  const nav = (navigator.language || "en").toLowerCase();
  const short = nav.slice(0, 2);
  // Map browser tags → our codes
  const map: Record<string, LocaleCode> = {
    en: "en",
    yo: "yo",
    ha: "ha",
    ig: "ig",
    fr: "fr",
    sw: "sw",
    ar: "ar",
    pt: "pt",
    am: "am",
    hi: "hi",
    zh: "zh",
    id: "id",
    th: "th",
    vi: "vi",
    ms: "ms",
    ja: "ja",
    ko: "ko",
    bn: "bn",
    fil: "fil",
    tl: "fil",
    ur: "ur",
  };
  return map[short] || map[nav] || DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocaleState(detectInitial());
    setReady(true);
  }, []);

  const setLocale = useCallback((code: LocaleCode) => {
    setLocaleState(code);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, code);
      document.cookie = `${LOCALE_STORAGE_KEY}=${code};path=/;max-age=31536000`;
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const meta = getLocaleMeta(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = meta.dir;
  }, [locale, ready]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      meta: getLocaleMeta(locale),
      locales: LOCALES,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}
