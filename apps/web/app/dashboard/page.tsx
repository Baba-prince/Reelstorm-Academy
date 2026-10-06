"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  { step: "01", name: "SCRIPT / UPLOAD", href: "/template-forge", color: "text-violet-soft" },
  { step: "02", name: "WORLD BUILDER", href: "/world-builder", color: "text-violet" },
  { step: "03", name: "STORYBOARD", href: "/storyboard", color: "text-cyan" },
  { step: "04", name: "STORM ENGINE", href: "/studio", color: "text-cyan" },
  { step: "05", name: "ARCHIVE VAULT", href: "/archive-vault", color: "text-orange" },
  { step: "06", name: "MERGE STUDIO", href: "/merge-studio", color: "text-orange" },
];

function firstNameFrom(user: { name?: string | null; email?: string } | null): string {
  if (!user) return "Producer";
  const raw = (user.name || "").trim() || (user.email || "").split("@")[0] || "Producer";
  const part = raw.split(/[\s._-]+/).filter(Boolean)[0] || raw;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function DashboardInner() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [justOnboarded, setJustOnboarded] = useState(false);

  const displayName = useMemo(() => firstNameFrom(user), [user]);

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
    api<{ projects: Project[] }>("/api/projects")
      .then((d) => setProjects(d.projects))
      .catch(() => setProjects([]));
  }, []);

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

  return (
    <div className="space-y-8 forge-in max-w-[1200px]">
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
          <p className="mt-3 text-white/60 max-w-xl text-[15px] leading-relaxed">
            {justOnboarded
              ? "Onboarding locked. Your factory floor is live — pick a lane and ship your first ARCHIVE5."
              : "Not a course. A factory. Upload reference video → extract template → rebuild in that style → ARCHIVE5 → merge to legend."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/wizard"
            className="h-11 px-5 rounded-rs bg-violet text-white font-bold text-[13px] flex items-center"
          >
            BOT Director
          </Link>
          <Link
            href="/template-forge"
            className="h-11 px-5 rounded-rs bg-orange text-black font-bold text-[13px] flex items-center"
          >
            Upload Video
          </Link>
          <button
            onClick={createProject}
            disabled={creating}
            className="h-11 px-5 rounded-rs border border-white/10 bg-white/[0.04] text-[13px] font-medium"
          >
            {creating ? "Creating…" : "New Project"}
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3">
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

      <section className="rounded-rs-xl border border-white/[0.08] bg-deep overflow-hidden">
        <div className="h-12 px-5 flex items-center justify-between border-b border-white/[0.06] bg-panel">
          <span className="mono text-[11px] tracking-[0.14em]">PROJECTS</span>
          <span className="mono text-[9px] px-2 py-1 rounded-full bg-cyan text-black font-bold">
            {projects.length} ACTIVE
          </span>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {projects.length === 0 && (
            <div className="p-8 text-white/40 text-sm">
              No projects yet. Start in Template Forge — drag a YouTube-style MP4 to extract style DNA.
            </div>
          )}
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
            >
              <div>
                <div className="font-semibold">{p.title}</div>
                <div className="mono text-[10px] text-white/40 mt-1">
                  {p.template?.stylePreset || "No template"} • {p.blocks?.length || 0} blocks
                </div>
              </div>
              <span className="mono text-[9px] px-2 py-1 rounded-full border border-white/10 text-white/60">
                {p.status}
              </span>
            </Link>
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
