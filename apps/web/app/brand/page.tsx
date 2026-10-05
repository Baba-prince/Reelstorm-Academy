import tokens from "../../reelstorm-tokens.json";

const COLORS = [
  tokens.colors.deepBlack,
  tokens.colors.stormViolet,
  tokens.colors.electricCyan,
  tokens.colors.signalOrange,
  tokens.colors.silverChrome,
  tokens.colors.pureWhite,
];

export default function BrandPage() {
  return (
    <div className="max-w-[1000px] space-y-10 forge-in">
      <div>
        <div className="mono text-[11px] text-violet-soft mb-2">BRAND KIT 01 // 2026</div>
        <h1 className="display text-5xl md:text-6xl">
          REELSTORM{" "}
          <span className="bg-storm bg-clip-text text-transparent">ACADEMY</span>
        </h1>
        <p className="mt-4 text-white/60 max-w-xl">
          {tokens.meta.tagline}. Dark first. Never light. Violet is the storm. Cyan is live. Orange is action.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-[14px] bg-white text-black flex items-center justify-center font-black text-[22px] tracking-[-0.05em]">
          {tokens.logo.monogram}
        </div>
        <div>
          <div className="display text-2xl">{tokens.logo.lockup}</div>
          <div className="mono text-[10px] text-cyan mt-1">SCRIPT • WORLD • STUDIO</div>
        </div>
      </div>

      <section>
        <div className="mono text-[11px] mb-4">COLOR SYSTEM</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {COLORS.map((c) => (
            <div key={c.hex} className="rounded-rs border border-white/[0.08] overflow-hidden bg-deep">
              <div className="h-24" style={{ background: c.hex }} />
              <div className="p-3">
                <div className="font-semibold text-sm">{(c as { hex: string }).hex}</div>
                <div className="mono text-[9px] text-white/40 mt-1">{(c as { usage: string }).usage}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-rs-xl border border-white/[0.08] bg-panel p-6">
        <div className="mono text-[11px] mb-4">TYPOGRAPHY</div>
        <div className="display text-3xl">MONTSERRAT EXTRABOLD</div>
        <p className="mt-3 font-body text-[15px] leading-[1.6] text-white/70">
          Inter 15px / 1.6 — body copy for factory UI, scripts, and vibe notes.
        </p>
        <div className="mt-4 mono text-[11px] text-cyan">MONO • TRACKING 0.12em • SYSTEM STATUS</div>
      </section>

      <section className="h-[84px] rounded-rs-xl bg-signature relative overflow-hidden flex items-end p-4">
        <span className="mono text-[10px] text-white/70">#0A0A0A → #7C3AED → #00D9FF • SIGNATURE GRADIENT</span>
      </section>

      <section className="grid md:grid-cols-3 gap-3">
        {tokens.pipeline.map((step, i) => (
          <div key={step} className="rounded-rs border border-white/[0.08] bg-deep p-4">
            <div className="mono text-[10px] text-orange">0{i + 1}</div>
            <div className="mt-1 font-semibold text-sm">{step}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
