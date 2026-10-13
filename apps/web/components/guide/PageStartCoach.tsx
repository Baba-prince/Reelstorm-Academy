"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { getStartHere, OS_SYSTEM_GUIDE_PATHS, resolveGuideLayer } from "@reelstorm/domain";

const DISMISS_KEY = "rs_page_coach_dismissed";

const CHIP_LABELS: Record<string, string> = {
  "/wizard": "Wizard",
  "/yt-os": "YouTube Automation",
  "/tools/clone": "Clone",
  "/dashboard": "Dashboard",
  "/templates-room": "Templates",
  "/template-forge": "Forge",
  "/studio-set": "Studio Set",
  "/world-builder": "World",
  "/storyboard": "Storyboard",
  "/studio": "Studio",
  "/sound-studio": "Sound",
  "/archive-vault": "Vault",
  "/merge-studio": "Merge",
  "/model-center": "Models",
  "/model-center/avatar": "Avatar",
  "/translate": "Language Studio",
  "/camera": "Camera Angles",
  "/debate": "Debate Studio",
};

/** Open STORM Guide with a prefilled “where do I start?” ask */
export function openStormGuide(prompt = "Where do I start on this screen?") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("rs-open-guide", { detail: { prompt } }));
}

/**
 * Persistent Start Here rail on every factory page —
 * answers “where can I start?” without hunting the nav.
 */
export function PageStartCoach() {
  const pathname = usePathname() || "/";
  const [hidden, setHidden] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const layer = useMemo(() => resolveGuideLayer(pathname), [pathname]);
  const start = useMemo(() => getStartHere(layer), [layer]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw === pathname) setHidden(true);
      else setHidden(false);
      // Expand when landing a new page
      setExpanded(true);
    } catch {
      setHidden(false);
    }
  }, [pathname]);

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => {
          setHidden(false);
          try {
            localStorage.removeItem(DISMISS_KEY);
          } catch {
            /* ignore */
          }
        }}
        className="mb-4 w-full rounded-rs border border-cyan/25 bg-cyan/5 px-3 py-2 text-left mono text-[10px] text-cyan hover:bg-cyan/10"
      >
        Show Start Here coach · {layer.title}
      </button>
    );
  }

  return (
    <section className="mb-5 rounded-rs-xl border border-violet/35 bg-gradient-to-r from-violet/15 via-panel to-cyan/10 overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06]">
        <div className="min-w-0">
          <div className="mono text-[9px] text-cyan tracking-[0.14em]">START HERE · AI WIZARD</div>
          <div className="display text-[16px] mt-1">{layer.title}</div>
          <p className="text-[13px] text-white/65 mt-1 max-w-2xl">{start.goal}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openStormGuide(`Where do I start on ${layer.title}?`)}
            className="h-9 px-3 rounded-rs bg-gradient-to-r from-violet to-cyan text-white text-[12px] font-bold"
          >
            Ask AI
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="h-9 px-3 rounded-rs border border-white/15 text-[12px] text-white/70"
          >
            {expanded ? "Collapse" : "Steps"}
          </button>
          <button
            type="button"
            onClick={() => {
              setHidden(true);
              try {
                localStorage.setItem(DISMISS_KEY, pathname);
              } catch {
                /* ignore */
              }
            }}
            className="h-9 px-2 rounded-rs text-white/35 hover:text-white text-[16px] leading-none"
            aria-label="Dismiss coach"
          >
            ×
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 py-3 grid lg:grid-cols-[1fr_auto] gap-4">
          <ol className="space-y-2">
            {start.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-[13px] text-white/75">
                <span className="mono text-[10px] text-orange shrink-0 mt-0.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-2 min-w-[180px]">
            <Link
              href={start.primaryHref}
              className="h-10 px-4 rounded-rs bg-cyan text-black text-sm font-bold grid place-items-center"
            >
              {start.primaryLabel}
            </Link>
            {start.nextHref && start.nextLabel ? (
              <Link
                href={start.nextHref}
                className="h-10 px-4 rounded-rs border border-white/15 text-sm text-white/80 grid place-items-center hover:border-cyan/40"
              >
                {start.nextLabel}
              </Link>
            ) : null}
          </div>
        </div>
      )}

      <div className="px-3 py-2 border-t border-white/[0.06] flex gap-1.5 overflow-x-auto">
        {OS_SYSTEM_GUIDE_PATHS.filter((href) => CHIP_LABELS[href]).map((href) => {
          const active =
            pathname === href ||
            (href !== "/model-center" && pathname.startsWith(href + "/")) ||
            (href === "/model-center" && pathname === "/model-center");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "shrink-0 mono text-[9px] px-2.5 py-1.5 rounded-full border",
                active
                  ? href.includes("avatar")
                    ? "border-orange/50 bg-orange/15 text-orange"
                    : "border-cyan/50 bg-cyan/15 text-cyan"
                  : "border-white/10 text-white/40 hover:text-white/70",
              )}
            >
              {CHIP_LABELS[href]}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
