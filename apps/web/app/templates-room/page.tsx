"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n/I18nProvider";

type Category = {
  id: string;
  label: string;
  blurb: string;
  color: string;
};

type IdealShot = {
  atSec: number;
  durationSec: number;
  framing: string;
  camera: string;
  note: string;
};

type Ideal = {
  id: string;
  category: string;
  region?: string;
  name: string;
  tagline: string;
  durationSec: number;
  aspectRatio: string;
  mood: string[];
  lut: string;
  stylePreset: string;
  idealUse: string;
  sampleScript: string;
  shots: IdealShot[];
  musicCue: string;
  accent: string;
  genreTags: string[];
};

export default function TemplatesRoomPage() {
  const t = useT();
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Ideal[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Ideal | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [projectTitle, setProjectTitle] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("category", filter);
    if (q.trim()) params.set("q", q.trim());
    const data = await api<{ categories: Category[]; templates: Ideal[] }>(
      `/api/templates/room?${params.toString()}`,
    );
    setCategories(data.categories);
    setTemplates(data.templates);
  }, [filter, q]);

  useEffect(() => {
    load().catch((e) => setMsg((e as Error).message));
  }, [load]);

  const catColor = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.color]));
    return (id: string) => m.get(id) || "#7C3AED";
  }, [categories]);

  async function useIdeal(ideal: Ideal, generate = true) {
    setBusy(true);
    setMsg("Materializing ideal into a project…");
    try {
      const res = await api<{
        project: { id: string; title: string };
        jobId?: string;
        ideal: { name: string };
      }>(`/api/templates/room/${ideal.id}/use`, {
        method: "POST",
        body: JSON.stringify({
          title: projectTitle.trim() || undefined,
          generate,
        }),
      });
      setMsg(
        `Project “${res.project.title}” ready${res.jobId ? ` · generate job ${res.jobId}` : ""}. Continue in World Builder or Storyboard.`,
      );
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 forge-in max-w-[1200px]">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="mono text-[11px] text-cyan mb-2">{t("templatesRoom.eyebrow")}</div>
          <h1 className="display text-4xl md:text-5xl leading-none">
            {t("templatesRoom.title")}
            <br />
            <span className="text-white/40">{t("templatesRoom.titleMuted")}</span>
          </h1>
          <p className="mt-3 text-white/55 max-w-[520px] text-[15px] leading-relaxed">
            {t("templatesRoom.body")}
          </p>
        </div>
        <Link
          href="/template-forge"
          className="h-11 px-5 inline-flex items-center rounded-rs border border-white/15 text-sm hover:bg-white/[0.04]"
        >
          {t("templatesRoom.extractOwn")}
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={clsx(
            "h-10 px-4 rounded-rs text-[12px] font-semibold border transition",
            filter === "all" ? "bg-white text-black border-white" : "border-white/10 text-white/55",
          )}
        >
          {t("templatesRoom.all")} ({templates.length})
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilter(c.id)}
            className="h-10 px-4 rounded-rs text-[12px] font-semibold border transition"
            style={{
              borderColor: filter === c.id ? c.color : "rgba(255,255,255,0.1)",
              background: filter === c.id ? `${c.color}22` : "transparent",
              color: filter === c.id ? "#fff" : "rgba(255,255,255,0.55)",
            }}
          >
            {c.label}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search mood, genre, use…"
          className="ml-auto h-10 w-full sm:w-56 rounded-rs bg-void border border-white/10 px-3 text-sm"
        />
      </div>

      {filter !== "all" && (
        <p className="text-[13px] text-white/45 -mt-4">
          {categories.find((c) => c.id === filter)?.blurb}
        </p>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setSelected(t);
              setProjectTitle(`${t.name} · Ideal`);
            }}
            className={clsx(
              "text-left rounded-rs-xl border bg-panel overflow-hidden transition hover:border-white/20",
              selected?.id === t.id ? "border-orange/50 ring-1 ring-orange/30" : "border-white/[0.08]",
            )}
          >
            <div
              className="h-28 relative p-4 flex flex-col justify-between"
              style={{
                background: `linear-gradient(135deg, ${t.accent}55 0%, #0A0A0A 55%, ${catColor(t.category)}33 100%)`,
              }}
            >
              <div className="mono text-[9px] text-white/70 tracking-[0.14em]">
                {t.category.replace("_", " · ").toUpperCase()}
                {t.region && t.region !== "global" ? ` · ${t.region.toUpperCase()}` : ""}
              </div>
              <div className="flex justify-between items-end gap-2">
                <div className="display text-[20px] leading-none">{t.name}</div>
                <div className="mono text-[9px] text-white/50 shrink-0">
                  {t.durationSec}s · {t.aspectRatio}
                </div>
              </div>
              {/* Fake storyboard strip */}
              <div className="absolute bottom-0 left-0 right-0 h-1.5 flex">
                {t.shots.map((s, i) => (
                  <div
                    key={i}
                    className="h-full flex-1 opacity-80"
                    style={{ background: i % 2 ? t.accent : "#00D9FF" }}
                  />
                ))}
              </div>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-[13px] text-white/70 leading-snug">{t.tagline}</p>
              <div className="flex flex-wrap gap-1.5">
                {t.mood.slice(0, 3).map((m) => (
                  <span
                    key={m}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-white/45"
                  >
                    {m}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-white/40 line-clamp-2">{t.idealUse}</p>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="rounded-rs-xl border border-white/[0.08] bg-panel p-5 md:p-6 grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="space-y-4">
            <div>
              <div className="mono text-[10px] mb-1" style={{ color: selected.accent }}>
                {selected.stylePreset}
              </div>
              <h2 className="display text-3xl leading-none">{selected.name}</h2>
              <p className="mt-2 text-white/55 text-[14px]">{selected.tagline}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="rounded-rs border border-white/10 p-3">
                <div className="mono text-[8px] text-white/35">LUT</div>
                <div className="mt-1 font-medium">{selected.lut}</div>
              </div>
              <div className="rounded-rs border border-white/10 p-3">
                <div className="mono text-[8px] text-white/35">MUSIC</div>
                <div className="mt-1 font-medium">{selected.musicCue}</div>
              </div>
            </div>
            <div>
              <div className="mono text-[9px] text-cyan mb-2">{t("templatesRoom.shotList")}</div>
              <ol className="space-y-2">
                {selected.shots.map((s, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-[12px] text-white/70 border-b border-white/[0.05] pb-2"
                  >
                    <span className="mono text-white/35 w-10 shrink-0">
                      {String(Math.floor(s.atSec)).padStart(2, "0")}s
                    </span>
                    <span>
                      <span className="text-white font-semibold">
                        {s.framing} · {s.camera}
                      </span>
                      <span className="text-white/45"> — {s.note}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="mono text-[9px] text-orange mb-2">{t("templatesRoom.sampleScript")}</div>
              <pre className="rounded-rs bg-void border border-white/10 p-4 text-[12px] text-white/70 whitespace-pre-wrap leading-relaxed max-h-[220px] overflow-y-auto">
                {selected.sampleScript}
              </pre>
            </div>
            <input
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="Project title"
              className="w-full h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => useIdeal(selected, true)}
                className="h-12 px-5 rounded-rs bg-orange text-black font-bold text-sm disabled:opacity-40"
              >
                {t("templatesRoom.useGenerate")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => useIdeal(selected, false)}
                className="h-12 px-5 rounded-rs border border-white/15 text-sm font-medium disabled:opacity-40"
              >
                {t("templatesRoom.attachDna")}
              </button>
              <Link
                href="/world-builder"
                className="h-12 px-5 inline-flex items-center rounded-rs border border-cyan/30 text-cyan text-sm"
              >
                World Builder
              </Link>
            </div>
            <p className="text-[12px] text-white/40">
              Applies style DNA + sample script to a new project. Customize script in Storyboard next.
            </p>
          </div>
        </div>
      )}

      {msg && (
        <div className="rounded-rs border border-white/10 bg-void px-4 py-3 text-sm text-white/70 break-all">
          {msg}
        </div>
      )}
    </div>
  );
}
