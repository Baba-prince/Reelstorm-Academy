"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { api } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";

type Skill = {
  id: string;
  slash: string;
  title: string;
  blurb: string;
  rtcCost: number;
  badge: string;
  href: string;
};

function YtOsInner() {
  const { user } = useAuth();
  const params = useSearchParams();
  const focus = params.get("skill");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [slash, setSlash] = useState("");
  const [niche, setNiche] = useState("youtube automation");
  const [topic, setTopic] = useState("AI ran my channel for 7 days");
  const [hookFormula, setHookFormula] = useState(7);
  const [out, setOut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api<{ skills: Skill[] }>("/api/yt-os/skills")
      .then((d) => setSkills(d.skills))
      .catch(() => setSkills([]));
  }, []);

  const filtered = useMemo(() => {
    if (!slash.trim()) return skills;
    const q = slash.trim().toLowerCase();
    return skills.filter(
      (s) => s.slash.includes(q) || s.title.toLowerCase().includes(q) || s.id.includes(q),
    );
  }, [skills, slash]);

  async function runSkill(id: string) {
    setBusy(true);
    setMsg(null);
    setOut(null);
    try {
      const body: Record<string, unknown> = { ownerEmail: user?.email };
      if (id === "rs-viral") body.niche = niche;
      if (id === "rs-script") {
        body.topic = topic;
        body.hookFormula = hookFormula;
      }
      if (id === "rs-package" || id === "rs-thumb") body.topic = topic;
      if (id === "rs-comments") body.comment = "Bhai setup kaise kiya?";
      if (id === "rs-clone") {
        window.location.href = "/tools/clone";
        return;
      }
      if (id === "rs-voice") {
        window.location.href = "/sound-studio?tab=tts";
        return;
      }
      if (id === "rs-plan") {
        window.location.href = "/yt-os/plan";
        return;
      }
      const data = await api<unknown>(`/api/yt-os/skill/${id}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setOut(JSON.stringify(data, null, 2));
      setMsg(`/${id} complete`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto forge-in space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="mono text-[11px] text-cyan mb-2">YT-OS v2 · CLAUDE KILLER</div>
          <h1 className="display text-4xl md:text-5xl">
            Eleven skills.{" "}
            <span className="bg-storm bg-clip-text text-transparent">Inside the OS.</span>
          </h1>
          <p className="mt-2 text-white/55 text-sm max-w-2xl">
            No external Claude · no n8n · Pixabay PRIMARY + Seedance + Sound Studio + 4600 RTC bank.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-9 px-3 rounded-rs border border-cyan/40 bg-cyan/10 mono text-[10px] text-cyan flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan live-dot" />
            REELSTORM Connected
          </div>
          <div className="h-9 px-3 rounded-rs border border-white/15 mono text-[10px] text-white/50 flex items-center">
            YouTube OAuth · pending
          </div>
        </div>
      </div>

      <div className="rounded-rs-xl border border-white/[0.08] bg-panel/60 p-4 flex flex-col sm:flex-row gap-3">
        <input
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          className="flex-1 h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
          placeholder="Niche for /rs-viral"
        />
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="flex-1 h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
          placeholder="Topic for /rs-script · /rs-package"
        />
        <input
          type="number"
          min={1}
          max={21}
          value={hookFormula}
          onChange={(e) => setHookFormula(Number(e.target.value))}
          className="w-24 h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
          title="Hook formula 1–21"
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={busy}
            onClick={() => void runSkill(s.id)}
            className={clsx(
              "text-left rounded-rs-xl border p-4 transition-colors",
              focus === s.id
                ? "border-orange/50 bg-orange/10"
                : "border-white/[0.08] bg-deep hover:border-violet/40",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="mono text-[10px] text-cyan">{s.slash}</span>
              <span className="mono text-[8px] px-1.5 py-0.5 rounded border border-violet/40 text-violet">
                {s.badge}
              </span>
            </div>
            <div className="font-semibold mt-2 text-[15px]">{s.title}</div>
            <p className="text-[12px] text-white/50 mt-1 leading-snug">{s.blurb}</p>
            <div className="mono text-[9px] text-orange mt-3">
              {s.rtcCost > 0 ? `${s.rtcCost} RTC` : "0 RTC"}
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-rs-xl border border-white/[0.08] bg-deep p-3 flex gap-2 items-center">
        <span className="mono text-[11px] text-cyan">/</span>
        <input
          value={slash}
          onChange={(e) => setSlash(e.target.value)}
          placeholder="Type to filter skills — rs-viral, rs-clone…"
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
        <Link href="/tools/clone" className="mono text-[10px] text-orange hover:underline">
          Open Clone Factory →
        </Link>
      </div>

      {msg && <div className="text-sm text-white/60">{msg}</div>}
      {out && (
        <pre className="rounded-rs-xl border border-white/10 bg-void p-4 text-[11px] text-white/60 overflow-auto max-h-96">
          {out}
        </pre>
      )}
    </div>
  );
}

export default function YtOsPage() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="p-8 mono text-sm text-white/40">Loading YT-OS…</div>}>
        <YtOsInner />
      </Suspense>
    </AuthProvider>
  );
}
