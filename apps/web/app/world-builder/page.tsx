"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function WorldBuilderPage() {
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("Lead");
  const [room, setRoom] = useState("Perfect Room");
  const [msg, setMsg] = useState("");

  async function lockSoul() {
    if (!projectId) return setMsg("Project ID required");
    const { soul } = await api<{ soul: { id: string; faceHash: string } }>("/api/world-builder/soul", {
      method: "POST",
      body: JSON.stringify({
        projectId,
        name,
        faceHash: `soul_${Date.now()}`,
        angles: { front: "pending", left: "pending", right: "pending", threeQuarter: "pending" },
      }),
    });
    setMsg(`Soul ID locked: ${soul.faceHash}`);
  }

  async function lockRoom() {
    if (!projectId) return setMsg("Project ID required");
    const { room: r } = await api<{ room: { id: string } }>("/api/world-builder/room", {
      method: "POST",
      body: JSON.stringify({
        projectId,
        name: room,
        plates: { wide: "pending", medium: "pending", overShoulder: "pending", close: "pending" },
      }),
    });
    setMsg(`Room Memory locked: ${r.id}`);
  }

  return (
    <div className="max-w-[900px] space-y-6 forge-in">
      <div>
        <div className="mono text-[11px] text-violet mb-2">ARCHITECTUM // WORLD BUILDER</div>
        <h1 className="display text-4xl">Perfect Room + Soul ID</h1>
        <p className="mt-3 text-white/60">
          Legacy quick lock. Prefer{" "}
          <Link href="/studio-set" className="text-cyan underline-offset-2 hover:underline">
            Full Studio Set
          </Link>{" "}
          for multi-angle courtroom packs, artist import from URL, prompt imagery, and AI camera guide.
        </p>
      </div>

      <div className="rounded-rs-xl border border-cyan/25 bg-cyan/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="mono text-[10px] text-cyan">RECOMMENDED</div>
          <div className="font-bold mt-1">Full Studio Set — Room · Artist · Imagery</div>
          <p className="text-xs text-white/50 mt-1">
            Seed Courtroom Drama, import cast from image/video links, Apply to Director when readiness is green.
          </p>
        </div>
        <Link
          href={projectId ? `/studio-set` : "/studio-set"}
          className="h-10 px-4 rounded-rs bg-cyan text-black text-sm font-bold grid place-items-center shrink-0"
        >
          Open Studio Set
        </Link>
      </div>

      <div className="rounded-rs-xl border border-white/[0.08] bg-panel p-6 space-y-4">
        <label className="block">
          <span className="mono text-[10px] text-white/40">PROJECT ID</span>
          <input
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="mt-1 w-full h-11 rounded-rs bg-void border border-white/10 px-3"
          />
        </label>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-rs border border-violet/30 bg-violet/10 p-4">
            <div className="mono text-[10px] text-violet-soft">SOUL ID</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full h-10 rounded-rs bg-void border border-white/10 px-3"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {["FRONT", "LEFT", "RIGHT", "3/4"].map((a) => (
                <div key={a} className="aspect-[3/4] rounded-rs bg-void border border-white/10 grid place-items-center mono text-[9px] text-white/30">
                  {a}
                </div>
              ))}
            </div>
            <button onClick={lockSoul} className="mt-4 w-full h-10 rounded-rs bg-violet text-white font-bold text-sm">
              Lock Soul ID
            </button>
          </div>
          <div className="rounded-rs border border-cyan/30 bg-cyan/5 p-4">
            <div className="mono text-[10px] text-cyan">ROOM MEMORY</div>
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="mt-2 w-full h-10 rounded-rs bg-void border border-white/10 px-3"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {["WIDE", "MEDIUM", "OSH", "CLOSE"].map((a) => (
                <div key={a} className="aspect-video rounded-rs bg-void border border-white/10 grid place-items-center mono text-[9px] text-white/30">
                  {a}
                </div>
              ))}
            </div>
            <button onClick={lockRoom} className="mt-4 w-full h-10 rounded-rs bg-cyan text-black font-bold text-sm">
              Lock Room Plates
            </button>
          </div>
        </div>
        {msg && <div className="text-sm text-white/70">{msg}</div>}
      </div>
    </div>
  );
}
