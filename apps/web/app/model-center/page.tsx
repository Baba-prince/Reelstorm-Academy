"use client";

import { useState } from "react";
import Link from "next/link";

export default function ModelCenterPage() {
  const [dashscope, setDashscope] = useState("");
  const [eleven, setEleven] = useState("");
  const [saved, setSaved] = useState(false);

  function save() {
    // Keys stored client-side for demo; production uses /api encrypted ApiKey table
    if (typeof window !== "undefined") {
      if (dashscope) localStorage.setItem("rs_dashscope", dashscope);
      if (eleven) localStorage.setItem("rs_eleven", eleven);
    }
    setSaved(true);
  }

  return (
    <div className="max-w-[640px] space-y-6 forge-in">
      <div>
        <div className="mono text-[11px] text-violet mb-2">MODEL CENTER // 2 API KEYS</div>
        <h1 className="display text-4xl">Wire the engines</h1>
        <p className="mt-3 text-white/60">
          Minimum to go live: DashScope (orchestrator + Seedance path) and ElevenLabs (Voice Forge fallback).
          Local Ollama <span className="text-cyan">llama3.1:8b</span> works without DashScope.
        </p>
      </div>
      <Link
        href="/model-center/avatar"
        className="block rounded-rs-xl border border-cyan/40 bg-cyan/10 px-5 py-4 hover:bg-cyan/15 transition"
      >
        <div className="mono text-[10px] text-cyan">NEW · HEYGEN-STYLE WORKFLOW</div>
        <div className="font-bold text-lg mt-1">Avatar Model Studio</div>
        <p className="text-sm text-white/60 mt-1">
          1 photo → 4 outfit variants → niche script → videos.reelstorm.uk. Active AI coach on the page.
        </p>
      </Link>
      <div className="rounded-rs-xl border border-orange/30 bg-orange/10 px-4 py-3 text-sm text-white/75">
        <span className="mono text-[10px] text-orange mr-2">SOFT-LAUNCH TESTABLE</span>
        UI saves keys locally for demos. Production engines stamped in VPS{" "}
        <span className="mono text-[10px] text-white/50">.env</span> (DashScope / Seedance / R2 / HEYGEN_API_KEY).
      </div>
      <div className="rounded-rs-xl border border-white/[0.08] bg-panel p-6 space-y-4">
        <label className="block">
          <span className="mono text-[10px] text-violet-soft">01 — DASHSCOPE_API_KEY</span>
          <input
            type="password"
            value={dashscope}
            onChange={(e) => setDashscope(e.target.value)}
            className="mt-1 w-full h-11 rounded-rs bg-void border border-white/10 px-3"
            placeholder="sk-…"
          />
        </label>
        <label className="block">
          <span className="mono text-[10px] text-cyan">02 — ELEVENLABS_API_KEY</span>
          <input
            type="password"
            value={eleven}
            onChange={(e) => setEleven(e.target.value)}
            className="mt-1 w-full h-11 rounded-rs bg-void border border-white/10 px-3"
            placeholder="xi-…"
          />
        </label>
        <div className="rounded-rs border border-white/10 bg-void p-4 mono text-[10px] text-white/50 leading-relaxed">
          OPTIONAL: KLING_API_KEY • VEO_API_KEY / GOOGLE_API_KEY • SEEDANCE_API_KEY
          <br />
          OLLAMA_BASE_URL=http://127.0.0.1:11434 • OLLAMA_MODEL=llama3.1:8b
        </div>
        <button onClick={save} className="w-full h-12 rounded-rs bg-violet text-white font-bold">
          Save Keys Locally
        </button>
        {saved && <div className="text-sm text-cyan">Saved. Also set them in root .env for API/worker.</div>}
      </div>
    </div>
  );
}
