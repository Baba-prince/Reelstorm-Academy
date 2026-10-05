"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export default function MergeStudioPage() {
  const [projectId, setProjectId] = useState("");
  const [blockIds, setBlockIds] = useState("");
  const [title, setTitle] = useState("30-Min Master");
  const [msg, setMsg] = useState("");

  async function merge() {
    const ids = blockIds
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!projectId || ids.length < 1) return setMsg("Need projectId and at least one blockId");
    const res = await api<{ jobId: string }>("/api/merge", {
      method: "POST",
      body: JSON.stringify({ projectId, blockIds: ids, title }),
    });
    setMsg(`Merge job ${res.jobId} queued — FFmpeg concat demuxer`);
  }

  return (
    <div className="max-w-[720px] space-y-6 forge-in">
      <div>
        <div className="mono text-[11px] text-cyan mb-2">MERGE STUDIO // 1-CLICK SERIES</div>
        <h1 className="display text-4xl">Blocks → Legend</h1>
        <p className="mt-3 text-white/60">
          Select 3–6 ARCHIVE5 blocks. FFmpeg concatenates into a 15–30 min master with cold-open + cliffhanger slots.
        </p>
      </div>
      <div className="rounded-rs-xl border border-white/[0.08] bg-panel p-6 space-y-4">
        <input
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="Project ID"
          className="w-full h-11 rounded-rs bg-void border border-white/10 px-3"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Master title"
          className="w-full h-11 rounded-rs bg-void border border-white/10 px-3"
        />
        <textarea
          value={blockIds}
          onChange={(e) => setBlockIds(e.target.value)}
          placeholder="Block IDs (comma or space separated)"
          className="w-full min-h-[120px] rounded-rs bg-void border border-white/10 p-3 text-sm"
        />
        <button onClick={merge} className="w-full h-12 rounded-rs bg-orange text-black font-bold">
          Merge Master MP4
        </button>
        {msg && <div className="text-sm text-white/60">{msg}</div>}
      </div>
    </div>
  );
}
