"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useT } from "@/lib/i18n/I18nProvider";

const LINKS = [
  { href: "/how-it-works", key: "nav.howItWorks" },
  { href: "/training", key: "nav.training" },
  { href: "/pricing", key: "nav.pricing" },
  { href: "/white-label", key: "nav.whiteLabel" },
  { href: "/developers", key: "nav.api" },
] as const;

export function MarketingNav({ variant = "overlay" }: { variant?: "overlay" | "solid" }) {
  const pathname = usePathname();
  const t = useT();

  return (
    <header
      className={clsx(
        "z-30 w-full",
        variant === "overlay" ? "absolute top-0 inset-x-0" : "sticky top-0 border-b border-white/[0.06] bg-[#080808]/90 backdrop-blur-md",
      )}
    >
      <div className="mx-auto max-w-[1280px] px-5 md:px-8 h-16 md:h-20 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <div className="w-9 h-9 rounded-[10px] bg-white text-black flex items-center justify-center font-black text-[14px] tracking-[-0.05em] group-hover:scale-105 transition-transform">
            RS
          </div>
          <div className="leading-none">
            <div className="display text-[12px] md:text-[13px]">REELSTORM</div>
            <div className="mono text-[8px] text-cyan mt-1 tracking-[0.18em]">ACADEMY OS</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-6">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "text-[13px] font-medium transition-colors",
                pathname === l.href ? "text-white" : "text-white/55 hover:text-white",
              )}
            >
              {t(l.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <LanguageSwitcher compact />
          <Link
            href="/login"
            className="hidden sm:inline-flex h-10 px-4 items-center rounded-rs border border-white/15 text-[13px] font-medium text-white/80 hover:bg-white/[0.04] transition-colors"
          >
            {t("common.signIn")}
          </Link>
          <Link
            href="/signup"
            className="h-10 px-3 sm:px-4 inline-flex items-center rounded-rs bg-orange text-black text-[12px] sm:text-[13px] font-bold hover:brightness-110 transition"
          >
            {t("common.openFactory")}
          </Link>
        </div>
      </div>
    </header>
  );
}
