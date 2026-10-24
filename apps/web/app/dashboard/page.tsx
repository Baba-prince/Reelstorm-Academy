"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";

type Project = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  blocks?: unknown[];
  template?: { stylePreset: string } | null;
};

const PIPELINE = [
  { step: "01", name: "AGENT", href: "/realstorm", color: "text-cyan" },
  { step: "02", name: "AVATAR", href: "/model-center/avatar", color: "text-cyan" },
  { step: "03", name: "STUDIO PAD", href: "/studio-pad", color: "text-violet-soft" },
];

type AiRender = {
  avatarId: string;
  name: string;
  videoUrl: string;
  engine: string;
  aiSuccess: boolean;
  updatedAt: string;
  scriptPreview?: string;
};

const CLEARABLE = new Set(["DRAFT", "FAILED", "WORLD_BUILDING", "STORYBOARD", "GENERATING"]);

function firstNameFrom(user: { name?: string | null; email?: string } | null): string {
  if (!user) return "Producer";
  const raw = (user.name || "").trim() || (user.email || "").split("@")[0] || "Producer";
  const part = raw.split(/[\s._-]+/).filter(Boolean)[0] || raw;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function statusTone(status: string) {
  if (status === "FAILED") return "border-orange/40 text-orange";
  if (status === "DRAFT") return "border-white/15 text-white/50";
  if (status === "GENERATING" || status === "WORLD_BUILDING") return "border-cyan/40 text-cyan";
  if (status === "ARCHIVED" || status === "MERGED") return "border-violet/40 text-violet-soft";
  return "border-white/10 text-white/60";
}

function DashboardInner() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [justOnboarded, setJustOnboarded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [aiRenders, setAiRenders] = useState<AiRender[]>([]);

  const displayName = useMemo(() => firstNameFrom(user), [user]);
  const clearableCount = useMemo(
    () => projects.filter((p) => CLEARABLE.has(p.status)).length,
    [projects],
  );
  const draftCount = useMemo(() => projects.filter((p) => p.status === "DRAFT").length, [projects]);
  const failedCount = useMemo(() => projects.filter((p) => p.status === "FAILED").length, [projects]);

  const reload = useCallback(() => {
    return api<{ projects: Project[] }>("/api/projects")
      .then((d) => setProjects(d.projects))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("rs_just_onboarded") === "1") {
        sessionStorage.removeItem("rs_just_onboarded");
        setJustOnboarded(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void reload();
    api<{ items: AiRender[] }>("/api/avatar/recent-ai")
      .then((d) => setAiRenders(d.items || []))
      .catch(() => setAiRenders([]));
  }, [reload]);

  async function createProject() {
    setCreating(true);
    try {
      const { project } = await api<{ project: Project }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ title: `Project ${projects.length + 1}`, logline: "New STORM factory run" }),
      });
      setProjects((p) => [project, ...p]);
    } finally {
      setCreating(false);
    }
  }

  async function deleteProject(id: string, title: string) {
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    setBusyId(id);
    setFlash(null);
    try {
      await api(`/api/projects/${id}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setFlash("Project deleted.");
    } catch (e) {
      setFlash(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  async function clearStatuses(statuses: string[], label: string) {
    const n = projects.filter((p) => statuses.includes(p.status)).length;
    if (!n) {
      setFlash(`No ${label.toLowerCase()} to clear.`);
      setMenuOpen(false);
      return;
    }
    if (!window.confirm(`Clear ${n} ${label.toLowerCase()} project${n === 1 ? "" : "s"}? This cannot be undone.`)) {
      return;
    }
    setClearing(true);
    setMenuOpen(false);
    setFlash(null);
    try {
      const res = await api<{ deleted: number; attempted: number; errors: string[] }>("/api/projects/clear", {
        method: "POST",
        body: JSON.stringify({ statuses }),
      });
      await reload();
      setFlash(
        res.errors?.length
          ? `Cleared ${res.deleted}/${res.attempted}. ${res.errors.length} failed.`
          : `Cleared ${res.deleted} ${label.toLowerCase()}.`,
      );
    } catch (e) {
      setFlash(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-8 forge-in w-full max-w-none">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="mono text-[11px] text-cyan mb-2">STORM OS // FACTORY FLOOR</div>
          <h1 className="display text-4xl md:text-5xl">
            {justOnboarded ? (
              <>
                Welcome,{" "}
                <span className="bg-storm bg-clip-text text-transparent">{displayName}</span>
              </>
            ) : (
              <>
                Welcome back,{" "}
                <span className="bg-storm bg-clip-text text-transparent">{displayName}</span>
              </>
            )}
          </h1>
          <p className="mt-3 text-white/60 max-w-2xl text-[15px] leading-relaxed">
            {justOnboarded
              ? "Academy MVP: lock a face in Agent, write a script, ship one AI talking video."
              : "One path: Agent → face + script → HeyGen AI video → Studio Pad to trim. Factories live under Advanced."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/realstorm"
            className="h-11 px-5 rounded-rs bg-cyan text-black font-bold text-[13px] flex items-center"
          >
            Open Agent
          </Link>
          <Link
            href="/model-center/avatar"
            className="h-11 px-5 rounded-rs bg-violet text-white font-bold text-[13px] flex items-center"
          >
            Avatar
          </Link>
          <button
            type="button"
            onClick={createProject}
            disabled={creating}
            className="h-11 px-5 rounded-rs border border-white/10 bg-white/[0.04] text-[13px] font-medium"
          >
            {creating ? "Creating…" : "New Project"}
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {PIPELINE.map((p) => (
          <Link
            key={p.step}
            href={p.href}
            className="rounded-rs border border-white/[0.08] bg-panel/80 p-4 hover:bg-elevated transition-colors"
          >
            <div className={`mono text-[10px] ${p.color}`}>{p.step}</div>
            <div className="mt-2 text-[12px] font-semibold leading-tight">{p.name}</div>
          </Link>
        ))}
      </div>

      <section className="rounded-rs-xl border border-cyan/25 bg-deep overflow-hidden">
        <div className="h-12 px-5 flex items-center justify-between border-b border-white/[0.06] bg-panel">
          <span className="mono text-[11px] tracking-[0.14em]">LAST AI RENDERS</span>
          <span className="mono text-[9px] text-white/40">heygen · liveportrait · seedance only</span>
        </div>
        <div className="p-4 space-y-2">
          {aiRenders.length === 0 ? (
            <p className="text-[13px] text-white/45">
              No AI talking clips yet. Open Agent, lock a face, confirm a script — composites do not count.
            </p>
          ) : (
            aiRenders.map((r) => (
              <div
                key={`${r.avatarId}-${r.updatedAt}`}
                className="flex items-center justify-between gap-3 rounded-rs border border-white/[0.06] bg-panel/60 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">{r.name}</div>
                  <div className="mono text-[10px] text-white/40 truncate">{r.scriptPreview || r.videoUrl}</div>
                </div>
                <span className="shrink-0 mono text-[9px] px-2 py-1 rounded-full bg-cyan/20 text-cyan border border-cyan/30 font-bold uppercase">
                  {r.engine}
                </span>
                <a
                  href={r.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-[11px] text-violet-soft hover:underline"
                >
                  Open
                </a>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-rs-xl border border-white/[0.08] bg-deep overflow-hidden">
        <div className="h-12 px-5 flex items-center justify-between border-b border-white/[0.06] bg-panel gap-3">
          <span className="mono text-[11px] tracking-[0.14em]">PROJECTS</span>
          <div className="flex items-center gap-2">
            <span className="mono text-[9px] px-2 py-1 rounded-full bg-cyan text-black font-bold">
              {projects.length} ACTIVE
            </span>
            <div className="relative">
              <button
                type="button"
                aria-label="Project list actions"
                aria-expanded={menuOpen}
                disabled={clearing || projects.length === 0}
                onClick={() => setMenuOpen((o) => !o)}
                className="h-8 w-8 rounded-rs border border-white/15 text-white/70 hover:bg-white/[0.06] mono text-[14px] leading-none disabled:opacity-40"
                title="Clear / delete options"
              >
                ···
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="Close menu"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-9 z-20 w-56 rounded-rs border border-white/10 bg-[#121212] shadow-xl py-1 text-[12px]">
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-white/[0.06] text-white/80 disabled:opacity-40"
                      disabled={!draftCount || clearing}
                      onClick={() => void clearStatuses(["DRAFT"], "Draft")}
                    >
                      Clear drafts ({draftCount})
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-white/[0.06] text-orange/90 disabled:opacity-40"
                      disabled={!failedCount || clearing}
                      onClick={() => void clearStatuses(["FAILED"], "Failed")}
                    >
                      Clear failed ({failedCount})
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-white/[0.06] text-white/80 disabled:opacity-40 border-t border-white/[0.06]"
                      disabled={!clearableCount || clearing}
                      onClick={() =>
                        void clearStatuses(
                          ["DRAFT", "FAILED", "WORLD_BUILDING", "STORYBOARD", "GENERATING"],
                          "Stuck / unfinished",
                        )
                      }
                    >
                      Clear unfinished ({clearableCount})
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {flash && (
          <div className="px-5 py-2.5 text-[12px] border-b border-white/[0.06] bg-white/[0.03] text-cyan/90 flex justify-between gap-3">
            <span>{flash}</span>
            <button type="button" className="text-white/40 hover:text-white" onClick={() => setFlash(null)}>
              Dismiss
            </button>
          </div>
        )}
        <div className="divide-y divide-white/[0.06]">
          {projects.length === 0 && (
            <div className="p-8 text-white/40 text-sm">
              No projects yet. Start in Template Forge — drag a YouTube-style MP4 to extract style DNA.
            </div>
          )}
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-white/[0.03] transition-colors"
            >
              <Link href={`/projects/${p.id}`} className="min-w-0 flex-1">
                <div className="font-semibold truncate">{p.title}</div>
                <div className="mono text-[10px] text-white/40 mt-1">
                  {p.template?.stylePreset || "No template"} • {p.blocks?.length || 0} blocks
                </div>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`mono text-[9px] px-2 py-1 rounded-full border ${statusTone(p.status)}`}>
                  {p.status}
                </span>
                <button
                  type="button"
                  title="Delete project"
                  disabled={busyId === p.id || clearing}
                  onClick={() => void deleteProject(p.id, p.title)}
                  className="h-8 px-2.5 rounded-rs border border-white/10 text-[11px] text-white/50 hover:text-orange hover:border-orange/40 disabled:opacity-40"
                >
                  {busyId === p.id ? "…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthProvider>
      <DashboardInner />
    </AuthProvider>
  );
}
