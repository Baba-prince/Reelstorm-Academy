"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";

type Entry = {
  id: string;
  date: string;
  type: string;
  status: string;
  rtcEstimate: number;
  title?: string | null;
};

function PlanInner() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const d = await api<{ entries: Entry[] }>("/api/yt-os/calendar");
      setEntries(d.entries);
    } catch {
      setEntries([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function generate() {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api<{ totalRtc: number; days: number }>("/api/yt-os/skill/rs-plan", {
        method: "POST",
        body: JSON.stringify({ days: 30, ownerEmail: user?.email }),
      });
      setMsg(`30-day plan · ~${d.totalRtc} RTC (Shorts lean on Pixabay $0 intros)`);
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto forge-in space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="mono text-[11px] text-cyan mb-2">/rs-plan</div>
          <h1 className="display text-4xl">Content Calendar</h1>
          <p className="text-sm text-white/50 mt-2">Long Mon/Wed/Fri · Short other days · from 4600 bank</p>
        </div>
        <Link href="/yt-os" className="mono text-[11px] text-white/40 hover:text-cyan">
          ← YT-OS
        </Link>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void generate()}
        className="h-11 px-5 rounded-rs bg-violet text-white font-bold text-sm disabled:opacity-40"
      >
        {busy ? "Planning…" : "Generate 30-day plan"}
      </button>

      {msg && <div className="text-sm text-white/60">{msg}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {entries.slice(0, 30).map((e) => (
          <div
            key={e.id}
            className="rounded-rs border border-white/10 bg-deep p-2 min-h-[72px]"
          >
            <div className="mono text-[8px] text-white/35">{String(e.date).slice(0, 10)}</div>
            <div className="text-[12px] font-semibold mt-1">{e.type}</div>
            <div className="mono text-[8px] text-orange mt-1">{e.rtcEstimate} RTC</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlanPage() {
  return (
    <AuthProvider>
      <PlanInner />
    </AuthProvider>
  );
}
