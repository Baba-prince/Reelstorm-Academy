"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/template-forge", label: "Template Forge" },
  { href: "/world-builder", label: "World Builder" },
  { href: "/storyboard", label: "Storyboard" },
  { href: "/studio", label: "Studio" },
  { href: "/archive-vault", label: "Archive Vault" },
  { href: "/merge-studio", label: "Merge Studio" },
  { href: "/model-center", label: "Model Center" },
  { href: "/team", label: "Team" },
  { href: "/brand", label: "Brand" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
        <nav className="flex-1 p-3 space-y-1">
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
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 mono text-[9px] text-cyan">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan live-dot" />
            LIVE ENGINE
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 lg:h-16 px-4 lg:px-8 flex items-center justify-between border-b border-white/[0.06] bg-void/60 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="w-8 h-8 rounded-[8px] bg-white text-black flex items-center justify-center font-black text-[12px]">
              RS
            </div>
            <span className="display text-[12px]">REELSTORM</span>
          </div>
          <div className="hidden lg:block mono text-[10px] text-white/40 tracking-[0.18em]">
            SCRIPT • WORLD • STUDIO • ARCHIVE • MERGE
          </div>
          <div className="flex items-center gap-2">
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
