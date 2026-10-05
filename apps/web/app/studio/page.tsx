"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export default function StudioPage() {
  const [projectId, setProjectId] = useState("");
  const [vibe, setVibe] = useState("");
  const [log, setLog] = useState<{ role: "you" | "storm"; text: string }[]>([
    { role: "storm", text: "Vibe Direct online. Say things like “make it darker” or “faster cuts like MrBeast.”" },
  ]);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!vibe.trim()) return;
    setLog((l) => [...l, { role: "you", text: vibe }]);
    const note = vibe;
    setVibe("");
    setBusy(true);
    try {
      if (projectId) {
        const res = await api<{ jobId: string }>("/api/generate", {
          method: "POST",
          body: JSON.stringify({ projectId, vibe: note }),
        });
        setLog((l) => [...l, { role: "storm", text: `Queued generate job ${res.jobId}. Applying vibe: “${note}”` }]);
      } else {
        setLog((l) => [...l, { role: "storm", text: `Noted: “${note}”. Attach a project ID to fire STORM Engine.` }]);
      }
    } catch (e) {
      setLog((l) => [...l, { role: "storm", text: (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[800px] mx-auto space-y-6 forge-in">
      <div>
        <div className="mono text-[11px] text-cyan mb-2">STUDIO // VIBE DIRECT</div>
        <h1 className="display text-4xl">Direct the storm</h1>
      </div>
      <input
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        placeholder="Project ID (optional for chat, required to generate)"
        className="w-full h-11 rounded-rs bg-panel border border-white/10 px-3"
      />
      <div className="rounded-rs-xl border border-white/[0.08] bg-deep min-h-[420px] flex flex-col overflow-hidden">
        <div className="flex-1 p-4 space-y-3 overflow-auto">
          {log.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-rs px-4 py-3 text-sm ${m.role === "you" ? "ml-auto bg-violet text-white" : "bg-panel border border-white/10 text-white/80"}`}
            >
              {m.text}
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-white/[0.06] flex gap-2">
          <input
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void send()}
            placeholder='e.g. "make it darker"'
            className="flex-1 h-11 rounded-rs bg-void border border-white/10 px-3"
          />
          <button
            onClick={send}
            disabled={busy}
            className="h-11 px-5 rounded-rs bg-orange text-black font-bold text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
