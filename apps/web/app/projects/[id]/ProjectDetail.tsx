"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export function ProjectDetail({ id }: { id: string }) {
  const [project, setProject] = useState<{
    id: string;
    title: string;
    status: string;
    script?: string | null;
    logline?: string | null;
    template?: { id: string; stylePreset: string; name: string } | null;
    blocks?: Array<{ id: string; title: string; status: string; index: number }>;
    uploads?: Array<{ id: string; filename: string; status: string }>;
    soulIds?: Array<{ name: string; faceHash: string }>;
    rooms?: Array<{ name: string }>;
  } | null>(null);

  useEffect(() => {
    api<{ project: typeof project }>(`/api/projects/${id}`)
      .then((d) => setProject(d.project))
      .catch(() => setProject(null));
  }, [id]);

  if (!project) {
    return <div className="text-white/40">Loading project…</div>;
  }

  return (
    <div className="max-w-[1000px] space-y-6 forge-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mono text-[11px] text-cyan mb-2">PROJECT // {project.status}</div>
          <h1 className="display text-4xl">{project.title}</h1>
          {project.logline && <p className="mt-2 text-white/60">{project.logline}</p>}
        </div>
        <Link
          href="/template-forge"
          className="h-10 px-4 rounded-rs bg-orange text-black font-bold text-sm flex items-center"
        >
          Forge Template
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-rs border border-white/[0.08] bg-panel p-4">
          <div className="mono text-[10px] text-violet-soft">TEMPLATE</div>
          <div className="mt-2 font-semibold">{project.template?.stylePreset || "None"}</div>
          <div className="text-xs text-white/40 mt-1">{project.template?.name}</div>
        </div>
        <div className="rounded-rs border border-white/[0.08] bg-panel p-4">
          <div className="mono text-[10px] text-cyan">SOUL IDS</div>
          <div className="mt-2 font-semibold">{project.soulIds?.length || 0} locked</div>
        </div>
        <div className="rounded-rs border border-white/[0.08] bg-panel p-4">
          <div className="mono text-[10px] text-orange">BLOCKS</div>
          <div className="mt-2 font-semibold">{project.blocks?.length || 0} ARCHIVE5</div>
        </div>
      </div>

      {project.script && (
        <section className="rounded-rs-xl border border-white/[0.08] bg-deep p-5">
          <div className="mono text-[10px] mb-2">SCRIPT</div>
          <pre className="text-sm text-white/70 whitespace-pre-wrap font-body">{project.script}</pre>
        </section>
      )}

      <section className="rounded-rs-xl border border-white/[0.08] bg-deep overflow-hidden">
        <div className="h-11 px-4 flex items-center border-b border-white/[0.06] bg-panel mono text-[10px]">
          UPLOADS
        </div>
        {(project.uploads || []).map((u) => (
          <div key={u.id} className="px-4 py-3 flex justify-between text-sm border-b border-white/[0.04]">
            <span>{u.filename}</span>
            <span className="mono text-[9px] text-cyan">{u.status}</span>
          </div>
        ))}
        {!project.uploads?.length && <div className="p-4 text-white/40 text-sm">No uploads</div>}
      </section>

      <section className="rounded-rs-xl border border-white/[0.08] bg-deep overflow-hidden">
        <div className="h-11 px-4 flex items-center border-b border-white/[0.06] bg-panel mono text-[10px]">
          ARCHIVE5 BLOCKS
        </div>
        {(project.blocks || []).map((b) => (
          <div key={b.id} className="px-4 py-3 flex justify-between text-sm border-b border-white/[0.04]">
            <span>
              #{b.index} {b.title}
            </span>
            <span className="mono text-[9px]">{b.status}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
