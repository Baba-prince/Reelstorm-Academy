"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { LocaleCode, LocaleRegion } from "@/lib/i18n/locales";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, locales, setLocale, t, meta } = useI18n();
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const order: LocaleRegion[] = ["africa", "asia", "global"];
    return order
      .map((region) => ({
        region,
        label:
          region === "africa"
            ? t("common.regionAfrica")
            : region === "asia"
              ? t("common.regionAsia")
              : t("common.regionGlobal"),
        items: locales.filter((l) => l.region === region),
      }))
      .filter((g) => g.items.length > 0);
  }, [locales, t]);

  function pick(code: LocaleCode) {
    setLocale(code);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "inline-flex items-center gap-2 rounded-rs border border-white/15 text-[12px] font-medium text-white/80 hover:bg-white/[0.04] transition",
          compact ? "h-9 px-2.5" : "h-10 px-3",
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={t("common.language")}
      >
        <span className="mono text-[9px] text-cyan tracking-wider">{locale.toUpperCase()}</span>
        {!compact && <span className="max-w-[88px] truncate">{meta.nativeName}</span>}
        <span className="text-white/35 text-[10px]">▾</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[70] cursor-default"
            aria-label="Close language menu"
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            className="absolute right-0 top-[calc(100%+6px)] z-[80] w-[min(92vw,320px)] max-h-[70vh] overflow-y-auto rounded-rs-xl border border-white/10 bg-[#0A0A0A]/98 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] p-2"
          >
            <div className="px-2 py-1.5 mono text-[9px] text-white/35 tracking-[0.14em]">
              {t("common.language")} · AFRICA / ASIA
            </div>
            {grouped.map((g) => (
              <div key={g.region} className="mt-1">
                <div
                  className="px-2 py-1 text-[10px] font-bold"
                  style={{
                    color: g.region === "africa" ? "#FF7A00" : g.region === "asia" ? "#00D9FF" : "#C4B5FD",
                  }}
                >
                  {g.label}
                </div>
                <ul className="space-y-0.5">
                  {g.items.map((l) => (
                    <li key={l.code}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={locale === l.code}
                        onClick={() => pick(l.code)}
                        className={clsx(
                          "w-full text-left px-2.5 py-2 rounded-rs text-[12px] flex items-center justify-between gap-2 transition",
                          locale === l.code
                            ? "bg-violet/25 border border-violet/40 text-white"
                            : "hover:bg-white/[0.05] text-white/75 border border-transparent",
                        )}
                      >
                        <span>
                          <span className="font-semibold">{l.nativeName}</span>
                          <span className="text-white/35 ml-1.5">{l.name}</span>
                        </span>
                        <span className="mono text-[9px] text-white/30">{l.code}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
