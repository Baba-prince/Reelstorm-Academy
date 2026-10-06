"use client";

import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";

const AUDIENCES = [
  {
    title: "YouTubers",
    line: "YT-OS + Clone Factory: ship 14–21 videos a week without a 20-person edit team.",
    points: [
      "Eleven /rs-* skills — hooks, titles, calendar, publish",
      "Paste a viral link → transformative remake (1+5 RTC)",
      "Pixabay intros at $0 Seedance · ARCHIVE5 seasons",
    ],
    accent: "#7C3AED",
  },
  {
    title: "Music artists",
    line: "Visual worlds that match the record — on demand.",
    points: [
      "Seedance path for music-sync cuts",
      "Room Memory for performance spaces",
      "Merge blocks into longform visuals",
    ],
    accent: "#00D9FF",
  },
  {
    title: "Advert outlets",
    line: "Campaign volume with locked brand worlds.",
    points: [
      "Template presets + Pixabay stock DNA",
      "QC gates before delivery",
      "Master cuts for 15 / 30 / 60",
    ],
    accent: "#FF7A00",
  },
];

export default function ProducersPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <MarketingNav variant="solid" />

      <section className="px-5 md:px-8 pt-16 md:pt-24 pb-12">
        <div className="mx-auto max-w-[960px]">
          <div className="mono text-[11px] text-orange mb-3">FOR PRODUCERS · YT-OS · CLONE</div>
          <h1 className="display text-[clamp(2.5rem,8vw,5rem)] leading-[0.9]">
            Built for people
            <br />
            <span className="text-white/40">who ship every week.</span>
          </h1>
          <p className="mt-5 text-white/55 text-[16px] max-w-[520px]">
            REELSTORM doesn’t compete with studios. Free 1-RTC demo from SystemBank — then YT-OS and Clone
            Factory let creators become studios across Africa and Asia.
          </p>
        </div>
      </section>

      <section className="px-5 md:px-8 py-12 md:py-20 border-t border-white/[0.06]">
        <div className="mx-auto max-w-[1100px] grid md:grid-cols-3 gap-10 md:gap-8">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="border-t-2 pt-6" style={{ borderColor: a.accent }}>
              <h2 className="display text-[28px]" style={{ color: a.accent }}>
                {a.title}
              </h2>
              <p className="mt-3 text-white/70 text-[15px] leading-relaxed">{a.line}</p>
              <ul className="mt-6 space-y-2">
                {a.points.map((p) => (
                  <li key={p} className="text-[13px] text-white/45 flex gap-2">
                    <span style={{ color: a.accent }}>▸</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 md:px-8 py-20 border-t border-white/[0.06] text-center">
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex h-14 px-8 items-center rounded-rs bg-orange text-black font-bold"
          >
            Start free demo
          </Link>
          <Link
            href="/yt-os"
            className="inline-flex h-14 px-8 items-center rounded-rs border border-white/20 font-medium"
          >
            Open YT-OS
          </Link>
          <Link
            href="/tools/clone"
            className="inline-flex h-14 px-8 items-center rounded-rs border border-white/20 font-medium"
          >
            Clone Factory
          </Link>
        </div>
      </section>
    </div>
  );
}
