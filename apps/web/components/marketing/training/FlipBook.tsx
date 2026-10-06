"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { INDEX_SECTIONS, TRAINING_PAGES, type TrainingPage } from "./pages";
import { SystemMock } from "./SystemMock";

function FlipPageBody({
  page,
  onJump,
}: {
  page: TrainingPage;
  onJump?: (id: number) => void;
}) {
  if (page.mock === "index") {
    return (
      <div className="h-full overflow-y-auto p-5 md:p-7">
        <div className="mono text-[10px] text-cyan mb-2">FLIP INDEX</div>
        <h2 className="display text-[22px] md:text-[28px] leading-none mb-2">{page.title}</h2>
        <p className="text-[12px] text-white/50 mb-6 max-w-[420px]">{page.lead}</p>
        <div className="grid md:grid-cols-2 gap-5">
          {INDEX_SECTIONS.map((sec) => (
            <div key={sec.title}>
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <h3 className="text-[13px] font-bold" style={{ color: sec.color }}>
                  {sec.title}
                </h3>
                <span className="mono text-[8px] text-white/35">{sec.pages}</span>
              </div>
              <ul className="space-y-1">
                {sec.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onJump?.(item.id)}
                      className="w-full text-left text-[12px] px-2.5 py-2 rounded-md border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/15 transition-colors flex justify-between gap-2"
                    >
                      <span className="text-white/80">{item.label}</span>
                      <span className="mono text-[9px] text-white/30">{String(item.id).padStart(2, "0")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (page.mock === "cover") {
    return (
      <div className="h-full p-4 md:p-5 flex flex-col">
        <SystemMock kind="cover" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-5 md:p-7 flex flex-col gap-5">
      <div>
        <div className="mono text-[9px] text-cyan mb-2 tracking-[0.16em]">{page.section}</div>
        <h2 className="display text-[22px] md:text-[30px] leading-[0.95]">{page.title}</h2>
        <p className="mt-3 text-[13px] text-white/55 leading-relaxed max-w-[460px]">{page.lead}</p>
      </div>

      <div className="grid md:grid-cols-[1.05fr_0.95fr] gap-5 items-start flex-1">
        <div>
          <div className="mono text-[8px] text-orange mb-2">WHAT TO DO</div>
          <ol className="space-y-2.5">
            {page.steps.map((step, i) => (
              <li key={step} className="flex gap-3 text-[13px] text-white/75 leading-snug">
                <span className="shrink-0 w-6 h-6 rounded-md bg-violet/25 border border-violet/40 flex items-center justify-center mono text-[9px] text-violet-soft">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {page.href && (
            <Link
              href={page.href}
              className="mt-5 inline-flex h-10 px-4 items-center rounded-rs border border-white/15 text-[12px] font-medium text-white/80 hover:bg-white/[0.05] transition-colors"
            >
              Open this screen →
            </Link>
          )}
        </div>
        <div>
          <div className="mono text-[8px] text-white/35 mb-2">SYSTEM IMAGE</div>
          <SystemMock kind={page.mock} />
        </div>
      </div>
    </div>
  );
}

export function FlipBook() {
  const [index, setIndex] = useState(0);
  const [flip, setFlip] = useState<"idle" | "next" | "prev">("idle");
  const [busy, setBusy] = useState(false);

  const page = TRAINING_PAGES[index];
  const total = TRAINING_PAGES.length;

  const go = useCallback(
    (target: number, dir: "next" | "prev") => {
      if (busy || target < 0 || target >= total || target === index) return;
      setBusy(true);
      setFlip(dir);
      window.setTimeout(() => {
        setIndex(target);
        setFlip("idle");
        setBusy(false);
      }, 620);
    },
    [busy, index, total],
  );

  const next = () => go(index + 1, "next");
  const prev = () => go(index - 1, "prev");

  const jump = (id: number) => {
    if (id === index) return;
    go(id, id > index ? "next" : "prev");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        go(index + 1, "next");
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(index - 1, "prev");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  return (
    <div className="w-full max-w-[980px] mx-auto">
      {/* Book chrome */}
      <div className="book-shadow rounded-[14px] bg-[#101010] p-[8px] md:p-[14px] border border-white/[0.08]">
        <div
          className="relative rounded-[8px] overflow-hidden bg-[#0A0A0A] border border-white/[0.06]"
          style={{ perspective: "1800px" }}
        >
          {/* Spine */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px] md:w-[4px] z-20 bg-gradient-to-b from-violet via-cyan to-orange opacity-80" />

          <div className="relative min-h-[520px] md:min-h-[580px]">
            {/* Static under-page (destination peek during flip) */}
            <div className="absolute inset-0 pl-1">
              <FlipPageBody
                page={
                  flip === "next"
                    ? TRAINING_PAGES[Math.min(index + 1, total - 1)]
                    : flip === "prev"
                      ? TRAINING_PAGES[Math.max(index - 1, 0)]
                      : page
                }
                onJump={jump}
              />
            </div>

            {/* Flipping leaf */}
            <div
              className={clsx(
                "absolute inset-0 pl-1 origin-left book-leaf z-10",
                flip === "next" && "animate-flip-next",
                flip === "prev" && "animate-flip-prev",
              )}
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Front face */}
              <div
                className="absolute inset-0 bg-[#0A0A0A] border-r border-white/[0.04]"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(0deg)" }}
              >
                <FlipPageBody page={page} onJump={jump} />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/25 pointer-events-none" />
              </div>
              {/* Back face */}
              <div
                className="absolute inset-0 bg-[#0C0C0C] paper-texture"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <FlipPageBody
                  page={
                    flip === "next"
                      ? TRAINING_PAGES[Math.min(index + 1, total - 1)]
                      : TRAINING_PAGES[Math.max(index - 1, 0)]
                  }
                  onJump={jump}
                />
                <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/20 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Page footer chrome */}
          <div className="flex items-center justify-between px-4 md:px-6 py-3 border-t border-white/[0.06] bg-[#080808]/80">
            <button
              type="button"
              onClick={prev}
              disabled={index === 0 || busy}
              className="h-9 px-3 rounded-rs text-[12px] font-medium border border-white/10 disabled:opacity-30 hover:bg-white/[0.04] transition"
            >
              ← Prev
            </button>
            <div className="text-center">
              <div className="mono text-[9px] text-white/40">
                PAGE {String(index).padStart(2, "0")} / {String(total - 1).padStart(2, "0")}
              </div>
              <div className="text-[11px] text-white/55 mt-0.5 truncate max-w-[200px] md:max-w-[320px]">
                {page.title}
              </div>
            </div>
            <button
              type="button"
              onClick={next}
              disabled={index >= total - 1 || busy}
              className="h-9 px-3 rounded-rs text-[12px] font-bold bg-orange text-black disabled:opacity-30 hover:brightness-110 transition"
            >
              Flip →
            </button>
          </div>
        </div>
      </div>

      {/* Quick scrub */}
      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {TRAINING_PAGES.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-label={`Go to page ${p.id}`}
            onClick={() => jump(p.id)}
            className={clsx(
              "w-2 h-2 rounded-full transition-all",
              p.id === index ? "bg-orange w-5" : "bg-white/20 hover:bg-white/40",
            )}
          />
        ))}
      </div>
    </div>
  );
}
