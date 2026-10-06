"use client";

import type { ReactNode } from "react";

type MockKind = string;

/** Inline system UI mockups — explanatory “screenshots” for each flip page */
export function SystemMock({ kind }: { kind: MockKind }) {
  const chrome = (
    <div className="flex items-center gap-1.5 mb-3">
      <span className="w-2 h-2 rounded-full bg-[#FF5F57]" />
      <span className="w-2 h-2 rounded-full bg-[#FEBC2E]" />
      <span className="w-2 h-2 rounded-full bg-[#28C840]" />
      <span className="ml-2 mono text-[8px] text-white/35 tracking-[0.14em]">REELSTORM OS</span>
    </div>
  );

  const shell = (sidebar: string[], main: ReactNode, accent = "#7C3AED") => (
    <div className="rounded-[12px] border border-white/10 bg-[#0A0A0A] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
      <div className="px-3 pt-3">{chrome}</div>
      <div className="grid grid-cols-[88px_1fr] min-h-[200px] border-t border-white/[0.06]">
        <aside className="border-r border-white/[0.06] bg-[#080808] p-2 space-y-1">
          <div className="w-7 h-7 rounded-md bg-white text-black flex items-center justify-center text-[10px] font-black mb-2">
            RS
          </div>
          {sidebar.map((s, i) => (
            <div
              key={s}
              className="text-[8px] px-1.5 py-1 rounded truncate"
              style={{
                background: i === 0 ? `${accent}33` : "transparent",
                color: i === 0 ? "#fff" : "rgba(255,255,255,0.45)",
                border: i === 0 ? `1px solid ${accent}55` : "1px solid transparent",
              }}
            >
              {s}
            </div>
          ))}
        </aside>
        <div className="p-3 bg-[#0C0C0C]">{main}</div>
      </div>
    </div>
  );

  if (kind === "cover") {
    return (
      <div className="relative h-full min-h-[280px] rounded-[14px] overflow-hidden bg-gradient-to-br from-[#12081f] via-[#080808] to-[#001820] border border-white/10 flex flex-col justify-between p-6 md:p-8">
        <div className="absolute inset-0 opacity-40" aria-hidden>
          <svg viewBox="0 0 400 300" className="w-full h-full">
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.5" />
                <stop offset="50%" stopColor="#00D9FF" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#FF7A00" stopOpacity="0.35" />
              </linearGradient>
            </defs>
            <path d="M0 220 Q100 80 200 160 T400 100" fill="none" stroke="url(#g1)" strokeWidth="3" className="hero-draw" />
            <circle cx="200" cy="150" r="48" fill="none" stroke="#7C3AED" strokeWidth="1.5" opacity="0.5" />
            <circle cx="200" cy="150" r="72" fill="none" stroke="#00D9FF" strokeWidth="1" opacity="0.3" />
          </svg>
        </div>
        <div className="relative z-10">
          <div className="mono text-[10px] text-cyan tracking-[0.2em]">ACADEMY OS · v1.5</div>
          <div className="display text-[42px] md:text-[56px] leading-[0.9] mt-3">
            TRAINING
            <br />
            MANUAL
          </div>
        </div>
        <div className="relative z-10 flex items-end justify-between gap-4">
          <p className="text-[12px] text-white/55 max-w-[220px] leading-relaxed">
            Flip each page. Match the screen. Run the factory — Wizard · Forge · Sound.
          </p>
          <div className="mono text-[9px] text-orange tracking-[0.16em]">21 PAGES</div>
        </div>
      </div>
    );
  }

  if (kind === "philosophy") {
    return shell(
      ["Dashboard", "Forge", "World"],
      <div className="space-y-3">
        <div className="mono text-[8px] text-violet-soft">STORY CONTRACT</div>
        <div className="h-8 rounded-md bg-white/[0.06] border border-white/10 flex items-center px-2 text-[10px] text-white/70">
          Intent locked · Genre: empire saga
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["SCRIPT", "DNA", "SOUL"].map((t, i) => (
            <div
              key={t}
              className="aspect-square rounded-md border flex items-center justify-center text-[9px] font-bold"
              style={{
                borderColor: ["#7C3AED", "#00D9FF", "#FF7A00"][i],
                color: ["#7C3AED", "#00D9FF", "#FF7A00"][i],
                background: `${["#7C3AED", "#00D9FF", "#FF7A00"][i]}18`,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>,
    );
  }

  if (kind === "rtc") {
    return shell(
      ["Wallet", "Pricing"],
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 rounded-md border border-cyan/30 bg-cyan/10 p-2">
            <div className="mono text-[7px] text-cyan">BALANCE</div>
            <div className="display text-[22px] text-cyan leading-none mt-1">1,500</div>
            <div className="text-[8px] text-white/40 mt-1">RTC</div>
          </div>
          <div className="flex-1 rounded-md border border-orange/30 bg-orange/10 p-2">
            <div className="mono text-[7px] text-orange">ARCHIVE5</div>
            <div className="display text-[22px] text-orange leading-none mt-1">15</div>
            <div className="text-[8px] text-white/40 mt-1">blocks left</div>
          </div>
        </div>
        <div className="rounded-md border border-white/10 p-2 text-[9px] text-white/55">
          Debit rule: <span className="text-white font-semibold">100 RTC</span> → one 5-min vault section
        </div>
      </div>,
      "#00D9FF",
    );
  }

  if (kind === "storm") {
    const stages = ["Wizard/Forge", "World", "Board", "Studio", "Sound", "Vault", "Merge"];
    return shell(
      ["Pipeline"],
      <div className="space-y-3">
        <div className="mono text-[8px] text-cyan">STORM // SEVEN STAGES</div>
        <div className="flex flex-wrap gap-1.5">
          {stages.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div
                className="px-2 py-1 rounded text-[8px] font-bold border"
                style={{
                  borderColor: i < 4 ? "#7C3AED" : "#FF7A00",
                  background: i < 4 ? "#7C3AED22" : "#FF7A0022",
                }}
              >
                {s}
              </div>
              {i < stages.length - 1 && <span className="text-white/25 text-[8px]">→</span>}
            </div>
          ))}
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-[68%] progress-bar rounded-full" />
        </div>
      </div>,
    );
  }

  if (kind === "soul") {
    return shell(
      ["World Builder"],
      <div className="grid grid-cols-[1fr_1.2fr] gap-3 items-center">
        <div className="aspect-square rounded-full border-2 border-cyan/50 bg-gradient-to-br from-violet/40 to-cyan/20 flex items-center justify-center relative">
          <div className="w-[70%] h-[70%] rounded-full border border-white/20 bg-[#151515]" />
          <span className="absolute bottom-1 mono text-[6px] text-cyan">SOUL ID</span>
        </div>
        <div className="space-y-2">
          <div className="mono text-[7px] text-white/40">HASH</div>
          <div className="font-mono text-[9px] text-cyan break-all leading-snug">rs_soul_7c3a…ff01</div>
          <div className="text-[8px] text-emerald-400/90">● LOCKED — immutable</div>
        </div>
      </div>,
      "#00D9FF",
    );
  }

  if (kind === "archive5") {
    return shell(
      ["Archive Vault"],
      <div className="space-y-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] p-2">
            <div className="w-10 h-7 rounded bg-gradient-to-r from-violet to-orange opacity-80" />
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-semibold truncate">ARCHIVE5 · EP0{n}</div>
              <div className="mono text-[7px] text-white/35">5:00 · vaulted · −100 RTC</div>
            </div>
          </div>
        ))}
      </div>,
      "#FF7A00",
    );
  }

  if (kind === "dashboard") {
    return shell(
      ["Dashboard", "Wizard", "Forge", "Wallet"],
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan live-dot" />
          <span className="mono text-[8px] text-cyan">LIVE ENGINE</span>
        </div>
        <div className="text-[10px] text-white/70 font-medium">Welcome back, Operator</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["Open jobs", "3"],
            ["RTC", "1,200"],
            ["Vaulted", "8"],
            ["QC fail", "0"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md border border-white/10 p-2">
              <div className="text-[8px] text-white/40">{k}</div>
              <div className="display text-[18px] leading-none mt-1">{v}</div>
            </div>
          ))}
        </div>
      </div>,
    );
  }

  if (kind === "wizard") {
    const stages = ["Brief", "Cast", "World", "Beats", "Voice", "Render", "Ship"];
    return shell(
      ["BOT Director"],
      <div className="space-y-3">
        <div className="mono text-[8px] text-violet-soft">WIZARD · 7 STAGES</div>
        <div className="flex flex-wrap gap-1">
          {stages.map((s, i) => (
            <div
              key={s}
              className="px-1.5 py-1 rounded text-[7px] font-bold border"
              style={{
                borderColor: i <= 2 ? "#7C3AED" : i <= 4 ? "#00D9FF" : "#FF7A00",
                background: i <= 2 ? "#7C3AED22" : i <= 4 ? "#00D9FF22" : "#FF7A0022",
              }}
            >
              {i + 1}.{s}
            </div>
          ))}
        </div>
        <div className="rounded-md border border-cyan/30 bg-cyan/10 p-2">
          <div className="mono text-[7px] text-cyan">LIVE ENGINE</div>
          <div className="text-[9px] text-white/70 mt-1">Blueprint generating · WS /ws/blueprint/:id</div>
        </div>
      </div>,
      "#7C3AED",
    );
  }

  if (kind === "sound") {
    return shell(
      ["Sound Studio"],
      <div className="space-y-2">
        <div className="mono text-[8px] text-orange">VOICE OS</div>
        <div className="grid grid-cols-2 gap-1.5">
          {["Sync", "Extract", "Mux", "Library"].map((t, i) => (
            <div
              key={t}
              className="rounded-md border border-white/10 p-2 text-[9px] font-bold"
              style={{
                borderColor: ["#7C3AED", "#00D9FF", "#FF7A00", "#E5E7EB"][i],
                color: ["#A78BFA", "#00D9FF", "#FF7A00", "#E5E7EB"][i],
                background: `${["#7C3AED", "#00D9FF", "#FF7A00", "#E5E7EB"][i]}14`,
              }}
            >
              {t}
            </div>
          ))}
        </div>
        <div className="text-[8px] text-white/45">Clone / TTS provider optional — Sound Studio owns the surface</div>
      </div>,
      "#FF7A00",
    );
  }

  if (kind === "forge") {
    return shell(
      ["Template Forge"],
      <div className="space-y-3">
        <div className="rounded-md border border-dashed border-violet/50 bg-violet/10 p-3 text-center">
          <div className="text-[10px] font-bold">Drop MP4 or paste URL</div>
          <div className="mono text-[7px] text-white/40 mt-1">youtube.com/watch?v=…</div>
        </div>
        <div className="flex gap-1">
          {["CUT", "LUT", "CAM", "ROOM", "VOICE"].map((t) => (
            <div key={t} className="flex-1 h-8 rounded bg-cyan/20 border border-cyan/30 flex items-center justify-center text-[7px] font-bold text-cyan">
              {t}
            </div>
          ))}
        </div>
      </div>,
    );
  }

  if (kind === "world") {
    return shell(
      ["World Builder"],
      <div className="space-y-2">
        <div className="mono text-[8px] text-cyan">4-ANGLE PLATES</div>
        <div className="grid grid-cols-2 gap-1.5">
          {["N", "E", "S", "W"].map((d, i) => (
            <div
              key={d}
              className="aspect-video rounded border border-white/10 flex items-center justify-center text-[10px] font-bold"
              style={{ background: `linear-gradient(135deg, #7C3AED${20 + i * 15}, #00D9FF22)` }}
            >
              {d}
            </div>
          ))}
        </div>
      </div>,
      "#00D9FF",
    );
  }

  if (kind === "storyboard") {
    return shell(
      ["Storyboard"],
      <div className="flex gap-2 overflow-hidden">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="w-16 shrink-0 rounded border border-white/10 bg-white/[0.04] p-1.5">
            <div className="aspect-[9/16] rounded bg-gradient-to-b from-violet/40 to-black mb-1" />
            <div className="text-[7px] font-semibold">Beat {n}</div>
            <div className="mono text-[6px] text-white/35">0:{n * 12}</div>
          </div>
        ))}
      </div>,
    );
  }

  if (kind === "studio") {
    return shell(
      ["Studio"],
      <div className="space-y-2">
        {[
          ["Block A", "QC PASS", "#00D9FF"],
          ["Block B", "RENDER", "#FF7A00"],
          ["Block C", "QUEUED", "#7C3AED"],
        ].map(([name, st, c]) => (
          <div key={name} className="flex items-center justify-between rounded-md border border-white/10 px-2 py-1.5">
            <span className="text-[9px] font-semibold">{name}</span>
            <span className="mono text-[7px]" style={{ color: c as string }}>
              {st}
            </span>
          </div>
        ))}
      </div>,
      "#FF7A00",
    );
  }

  if (kind === "vault") {
    return shell(
      ["Archive Vault"],
      <div className="space-y-2">
        <div className="rounded-md border border-orange/40 bg-orange/10 p-2">
          <div className="text-[9px] font-bold">EP01 · ARCHIVE5</div>
          <div className="mono text-[7px] text-white/45 mt-1">ID vault_8f2a · immutable</div>
        </div>
        <div className="text-[8px] text-white/50">Search: Soul · DNA · Series · Brand</div>
      </div>,
      "#FF7A00",
    );
  }

  if (kind === "merge") {
    return shell(
      ["Merge Studio"],
      <div className="space-y-3">
        <div className="flex items-center gap-1">
          {["A5-1", "A5-2", "A5-3"].map((id, i) => (
            <div key={id} className="flex items-center gap-1">
              <div className="px-2 py-2 rounded border border-white/15 bg-violet/20 text-[8px] font-bold">{id}</div>
              {i < 2 && <span className="text-orange text-[10px]">+</span>}
            </div>
          ))}
          <span className="text-white/30 text-[10px]">=</span>
          <div className="px-2 py-2 rounded bg-orange text-black text-[8px] font-black">MASTER</div>
        </div>
      </div>,
      "#FF7A00",
    );
  }

  if (kind === "wallet") {
    return shell(
      ["RTC Wallet"],
      <div className="space-y-2">
        <div className="display text-[28px] text-cyan leading-none">2,400</div>
        <div className="text-[9px] text-white/45">RTC · Storm pack active</div>
        <div className="h-px bg-white/10" />
        <div className="space-y-1">
          {["−100 ARCHIVE5 EP02", "+1500 Storm pack", "−100 ARCHIVE5 EP01"].map((row) => (
            <div key={row} className="text-[8px] text-white/55 font-mono">
              {row}
            </div>
          ))}
        </div>
      </div>,
      "#00D9FF",
    );
  }

  if (kind === "whitelabel") {
    return shell(
      ["White-label"],
      <div className="space-y-2">
        <div className="text-[9px] font-bold">Tenant: demo-academy</div>
        <div className="rounded-md bg-void border border-white/10 p-2 font-mono text-[8px] text-cyan break-all">
          rs_live_••••••••9f2a
        </div>
        <div className="text-[8px] text-white/45">Webhook · Brand CSS · RTC ledger shared</div>
      </div>,
      "#FF7A00",
    );
  }

  if (kind === "developers") {
    return shell(
      ["API"],
      <pre className="text-[8px] leading-relaxed text-cyan/90 font-mono whitespace-pre-wrap">{`POST /v1/wl/generate
Authorization: Bearer rs_live_…
{ "script": "…" }`}</pre>,
      "#7C3AED",
    );
  }

  if (kind === "pricing") {
    return shell(
      ["Pricing"],
      <div className="grid grid-cols-3 gap-1.5">
        {[
          ["Free", "0", "#7C3AED"],
          ["Journey", "£39", "#00D9FF"],
          ["Pro", "£89", "#FF7A00"],
        ].map(([n, p, c]) => (
          <div key={n} className="rounded-md border p-2 text-center" style={{ borderColor: `${c}66` }}>
            <div className="text-[8px] font-bold">{n}</div>
            <div className="display text-[14px] mt-1" style={{ color: c as string }}>
              {p}
            </div>
          </div>
        ))}
      </div>,
      "#FF7A00",
    );
  }

  if (kind === "checklist") {
    return shell(
      ["Scorecard"],
      <div className="space-y-1.5">
        {[
          ["API readiness", "A · 96%"],
          ["Redis / ffmpeg / yt-dlp", "PASS"],
          ["WL health smoke", "PASS"],
          ["RTC debit path", "PASS"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between text-[8px] border-b border-white/[0.06] py-1">
            <span className="text-white/50">{k}</span>
            <span className="text-cyan font-semibold">{v}</span>
          </div>
        ))}
      </div>,
    );
  }

  // index uses custom layout in FlipPageContent
  return (
    <div className="rounded-[12px] border border-white/10 bg-[#0A0A0A] p-4 min-h-[200px] flex items-center justify-center">
      <div className="mono text-[10px] text-white/40">SYSTEM IMAGE</div>
    </div>
  );
}
