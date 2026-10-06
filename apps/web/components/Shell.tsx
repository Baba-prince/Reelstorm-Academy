"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useT } from "@/lib/i18n/I18nProvider";

const NAV = [
  { href: "/wizard", key: "nav.wizard" },
  { href: "/dashboard", key: "nav.dashboard" },
  { href: "/templates-room", key: "nav.templatesRoom" },
  { href: "/template-forge", key: "nav.templateForge" },
  { href: "/world-builder", key: "nav.worldBuilder" },
  { href: "/storyboard", key: "nav.storyboard" },
  { href: "/studio", key: "nav.studio" },
  { href: "/sound-studio", key: "nav.soundStudio" },
  { href: "/archive-vault", key: "nav.archiveVault" },
  { href: "/merge-studio", key: "nav.mergeStudio" },
  { href: "/model-center", key: "nav.modelCenter" },
  { href: "/team", key: "nav.team" },
  { href: "/brand", key: "nav.brand" },
  { href: "/wallet", key: "nav.wallet" },
  { href: "/scorecard", key: "nav.scorecard" },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-[240px] shrink-0 flex-col border-r border-white/[0.06] bg-deep/80 backdrop-blur-xl">
        <div className="h-grid px-5 flex items-center gap-3 border-b border-white/[0.06]">
          <div className="w-9 h-9 rounded-[10px] bg-white text-black flex items-center justify-center font-black text-[15px] tracking-[-0.05em]">
            RS
          </div>
          <div>
            <div className="display text-[13px] leading-none">REELSTORM</div>
            <div className="mono text-[9px] text-cyan mt-1">ACADEMY OS</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "block px-3 py-2.5 rounded-rs text-[13px] font-medium transition-colors",
                  active
                    ? "bg-violet/20 text-white border border-violet/30"
                    : "text-white/60 hover:text-white hover:bg-white/[0.04]",
                )}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/[0.06] space-y-2">
          <div className="flex items-center gap-2 mono text-[9px] text-cyan">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan live-dot" />
            {t("common.liveEngine")}
          </div>
          <div className="mono text-[8px] text-white/35 leading-relaxed">{t("common.guideHint")}</div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 lg:h-16 px-4 lg:px-8 flex items-center justify-between border-b border-white/[0.06] bg-void/60 backdrop-blur-md sticky top-0 z-20 gap-3">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="w-8 h-8 rounded-[8px] bg-white text-black flex items-center justify-center font-black text-[12px]">
              RS
            </div>
            <span className="display text-[12px]">REELSTORM</span>
          </div>
          <div className="hidden lg:block mono text-[10px] text-white/40 tracking-[0.18em]">
            {t("shell.pipelineHint")}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <LanguageSwitcher compact />
            <Link
              href="/login"
              className="hidden sm:inline-flex h-9 px-3 items-center rounded-rs border border-white/10 text-[11px] text-white/60 hover:text-white"
            >
              Account
            </Link>
            <span className="mono text-[9px] px-2 py-1 rounded-full bg-orange text-black font-bold">
              STORM OS v1.1
            </span>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
