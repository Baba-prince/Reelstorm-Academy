"use client";

const STEPS = [
  { n: "01", name: "IDEA / LINK", sub: "Wizard · YT-OS · Clone viral URL", color: "#C4B5FD" },
  { n: "02", name: "WORLD", sub: "Soul ID + 4-angle Perfect Room", color: "#7C3AED" },
  { n: "03", name: "STORYBOARD", sub: "Lock first frames before pixels move", color: "#00D9FF" },
  { n: "04", name: "STORM", sub: "Seedance render · Pixabay intros $0", color: "#00D9FF" },
  { n: "05", name: "ARCHIVE5", sub: "Immutable 5-min IP · 5 RTC", color: "#FF7A00" },
  { n: "06", name: "MERGE", sub: "FFmpeg concat to bankable master", color: "#FF7A00" },
];

export function PipelineInfographic() {
  return (
    <div className="relative w-full">
      {/* Desktop rail */}
      <div className="hidden lg:block relative pt-4 pb-2">
        <svg className="absolute left-0 right-0 top-[52px] w-full h-4" viewBox="0 0 1200 16" preserveAspectRatio="none">
          <defs>
            <linearGradient id="pipeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="50%" stopColor="#00D9FF" />
              <stop offset="100%" stopColor="#FF7A00" />
            </linearGradient>
          </defs>
          <line
            x1="40"
            y1="8"
            x2="1160"
            y2="8"
            stroke="url(#pipeGrad)"
            strokeWidth="2"
            strokeDasharray="8 6"
            className="pipe-dash"
          />
        </svg>

        <div className="grid grid-cols-6 gap-3 relative">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className="pipe-node text-center px-2"
              style={{ animationDelay: `${0.08 * i}s` }}
            >
              <div
                className="mx-auto w-11 h-11 rounded-full border-2 bg-[#0A0A0A] flex items-center justify-center mono text-[10px] font-bold"
                style={{ borderColor: s.color, color: s.color }}
              >
                {s.n}
              </div>
              <div className="mt-4 display text-[13px] tracking-[-0.02em]" style={{ color: s.color }}>
                {s.name}
              </div>
              <p className="mt-2 text-[12px] text-white/50 leading-snug">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile stack */}
      <div className="lg:hidden space-y-0 relative pl-6 border-l border-white/10 ml-3">
        {STEPS.map((s) => (
          <div key={s.n} className="relative pb-8 last:pb-0">
            <div
              className="absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 bg-[#0A0A0A]"
              style={{ borderColor: s.color }}
            />
            <div className="mono text-[10px]" style={{ color: s.color }}>
              {s.n}
            </div>
            <div className="display text-[16px] mt-1">{s.name}</div>
            <p className="text-[13px] text-white/50 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Flow metrics strip — diagrammatic, not card clutter */}
      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.06] rounded-rs-xl overflow-hidden border border-white/[0.06]">
        {[
          { k: "BLOCK", v: "5 MIN" },
          { k: "MASTER", v: "30 MIN" },
          { k: "ANGLES", v: "4 LOCKED" },
          { k: "ENGINES", v: "3 VIDEO" },
        ].map((m) => (
          <div key={m.k} className="bg-[#0A0A0A] px-5 py-5 text-center">
            <div className="mono text-[9px] text-white/35">{m.k}</div>
            <div className="display text-[22px] mt-2 text-white">{m.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
