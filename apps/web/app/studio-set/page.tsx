"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { api } from "@/lib/api";

type PlateMap = Record<string, string | undefined>;

type SceneSet = {
  id: string;
  name: string;
  locationKind: string;
  requiredAngles: string[];
  platesJson: PlateMap;
  promptDna?: string | null;
  locked: boolean;
};

type ArtistProfile = {
  id: string;
  name: string;
  role: string;
  requiredAngles: string[];
  platesJson: PlateMap;
  importSource: string;
  importUrl?: string | null;
  locked: boolean;
  soulId?: string | null;
};

type ImageryPack = {
  id: string;
  name: string;
  stylePreset: string;
  prompt: string;
  customizedPrompt?: string | null;
  sceneSetId?: string | null;
  locked: boolean;
};

type Readiness = {
  pct: number;
  ready: boolean;
  softLaunchPartial: boolean;
  blocking: string[];
  rooms: Array<{ id: string; name: string; pct: number; ready: boolean }>;
  artists: Array<{ id: string; name: string; pct: number; ready: boolean }>;
  imagery: Array<{ id: string; name: string; pct: number; ready: boolean }>;
};

type StudioSetPayload = {
  set: {
    id: string;
    projectId: string;
    title: string;
    status: string;
    completenessPct: number;
    rooms: SceneSet[];
    artists: ArtistProfile[];
    imagery: ImageryPack[];
  };
  readiness: Readiness | null;
};

type PackAngle = { angle: string; label: string; prompt: string; cameraTip: string };

const TABS = [
  { id: "room", label: "Room" },
  { id: "artist", label: "Artist" },
  { id: "imagery", label: "Imagery" },
] as const;

function plateOk(v?: string) {
  return Boolean(v && v !== "pending" && v.trim());
}

export default function StudioSetPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("room");
  const [projectId, setProjectId] = useState("");
  const [payload, setPayload] = useState<StudioSetPayload | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [artistName, setArtistName] = useState("");
  const [artistRole, setArtistRole] = useState("lead");
  const [artistUrl, setArtistUrl] = useState("");
  const [artistSource, setArtistSource] = useState<"image_url" | "video_url">("image_url");
  const [imageryPrompt, setImageryPrompt] = useState("");
  const [roomPrompt, setRoomPrompt] = useState("");
  const [packAngles, setPackAngles] = useState<PackAngle[]>([]);
  const [guideTips, setGuideTips] = useState<string[]>([]);

  const set = payload?.set;
  const readiness = payload?.readiness;

  const loadPacks = useCallback(async () => {
    try {
      const res = await api<{
        packs: Array<{ angles: PackAngle[]; guideTips: string[]; basePrompt?: string }>;
      }>("/api/studio-set/packs");
      const pack = res.packs?.[0];
      if (pack) {
        setPackAngles(pack.angles || []);
        setGuideTips(pack.guideTips || []);
      }
    } catch {
      /* offline ok */
    }
  }, []);

  useEffect(() => {
    void loadPacks();
  }, [loadPacks]);

  async function createOrLoad(seed?: boolean) {
    if (!projectId.trim()) return setMsg("Project ID required");
    setBusy(true);
    setMsg("");
    try {
      const res = await api<StudioSetPayload>("/api/studio-set", {
        method: "POST",
        body: JSON.stringify({
          projectId: projectId.trim(),
          seedPackId: seed ? "courtroom_drama" : undefined,
        }),
      });
      setPayload(res);
      const dna = res.set.rooms[0]?.promptDna;
      if (dna) setRoomPrompt(dna);
      if (res.set.imagery[0]?.prompt) setImageryPrompt(res.set.imagery[0].customizedPrompt || res.set.imagery[0].prompt);
      setMsg(seed ? "Courtroom Drama pack seeded" : `Studio Set ${res.set.status}`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    if (!set?.id) return;
    setBusy(true);
    try {
      const res = await api<StudioSetPayload>(`/api/studio-set?id=${set.id}`);
      setPayload(res);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function generateRoomPlates(roomId: string) {
    if (!roomPrompt.trim()) return setMsg("Room prompt required");
    setBusy(true);
    try {
      const res = await api<StudioSetPayload & { room: SceneSet }>(
        `/api/studio-set/rooms/${roomId}/generate`,
        { method: "POST", body: JSON.stringify({ prompt: roomPrompt }) },
      );
      setPayload({ set: res.set, readiness: res.readiness });
      setMsg("Room plates generated from prompt");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function importArtist() {
    if (!set?.id || !artistName.trim()) return setMsg("Studio Set + artist name required");
    setBusy(true);
    try {
      const res = await api<StudioSetPayload>(`/api/studio-set/artists/import`, {
        method: "POST",
        body: JSON.stringify({
          studioSetId: set.id,
          name: artistName.trim(),
          role: artistRole,
          source: artistUrl ? artistSource : "manual",
          url: artistUrl || undefined,
          plates: artistUrl
            ? undefined
            : { front: "pending", left: "pending", right: "pending", threeQuarter: "pending" },
        }),
      });
      setPayload({ set: res.set, readiness: res.readiness });
      setArtistName("");
      setArtistUrl("");
      setMsg("Artist imported into Studio Set");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveImagery() {
    if (!set?.id || !imageryPrompt.trim()) return setMsg("Imagery prompt required");
    setBusy(true);
    try {
      const res = await api<StudioSetPayload>(`/api/studio-set/imagery`, {
        method: "POST",
        body: JSON.stringify({
          studioSetId: set.id,
          name: "Custom Imagery",
          stylePreset: "Drama · Prompt Custom",
          prompt: imageryPrompt,
          customizedPrompt: imageryPrompt,
          sceneSetId: set.rooms[0]?.id,
        }),
      });
      setPayload({ set: res.set, readiness: res.readiness });
      setMsg("Imagery pack saved — scene plates refreshed");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function applyToDirector(force = false) {
    if (!set?.id) return;
    setBusy(true);
    try {
      const res = await api<{
        message: string;
        readiness: Readiness;
        next: { storyboard: string; studio: string };
      }>(`/api/studio-set/${set.id}/apply-to-director`, {
        method: "POST",
        body: JSON.stringify({ force }),
      });
      setMsg(res.message);
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const pct = readiness?.pct ?? set?.completenessPct ?? 0;
  const canApply = Boolean(readiness?.ready || readiness?.softLaunchPartial);

  const angleTour = useMemo(() => packAngles, [packAngles]);

  return (
    <div className="max-w-[1100px] space-y-8 forge-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="mono text-[11px] text-cyan mb-2">FULL STUDIO SET // ROOM · ARTIST · IMAGERY</div>
          <h1 className="display text-4xl md:text-5xl">
            Lock the{" "}
            <span className="bg-storm bg-clip-text text-transparent">set</span>
          </h1>
          <p className="mt-3 text-white/60 max-w-xl text-[15px]">
            Design every camera angle for locations and cast before Director generate.
            Courtroom pack + prompt-custom backgrounds + import artists from image/video URLs.
          </p>
        </div>
        <div className="rounded-rs-xl border border-white/[0.08] bg-panel px-6 py-5 min-w-[180px] text-center">
          <div className="mono text-[10px] text-white/40">READINESS</div>
          <div className={clsx("display text-5xl mt-1", pct >= 90 ? "text-cyan" : pct >= 60 ? "text-orange" : "text-white/50")}>
            {pct}%
          </div>
          <div className="mono text-[9px] text-white/35 mt-1">
            {readiness?.ready ? "READY" : readiness?.softLaunchPartial ? "SOFT PARTIAL" : "BUILDING"}
          </div>
          <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full progress-bar" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="rounded-rs-xl border border-white/[0.08] bg-panel p-5 space-y-4">
        <div className="grid md:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
          <label className="block">
            <span className="mono text-[10px] text-white/40">PROJECT ID</span>
            <input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="proj_…"
              className="mt-1 w-full h-11 rounded-rs bg-void border border-white/10 px-3"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void createOrLoad(false)}
            className="h-11 px-4 rounded-rs border border-white/15 text-sm font-bold disabled:opacity-40"
          >
            Load / Create
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void createOrLoad(true)}
            className="h-11 px-4 rounded-rs bg-violet text-white text-sm font-bold disabled:opacity-40"
          >
            Seed Courtroom
          </button>
          <button
            type="button"
            disabled={busy || !set}
            onClick={() => void refresh()}
            className="h-11 px-4 rounded-rs border border-cyan/30 text-cyan text-sm font-bold disabled:opacity-40"
          >
            Refresh
          </button>
        </div>
        {set && (
          <div className="mono text-[10px] text-white/40">
            SET {set.id} · {set.title} · status {set.status}
          </div>
        )}
      </div>

      {(guideTips.length > 0 || angleTour.length > 0) && (
        <section className="rounded-rs-xl border border-cyan/20 bg-cyan/5 p-5">
          <div className="mono text-[11px] text-cyan">AI GUIDE · CAMERA TOUR</div>
          <p className="text-sm text-white/70 mt-2 max-w-3xl">
            Most operators do not know framing. Tour angles before lock — establishing → wide → medium → OSH → close/insert.
          </p>
          <ul className="mt-3 grid md:grid-cols-2 gap-2">
            {(guideTips.length ? guideTips : ["Lock Room + Artist before Apply to Director."]).map((t) => (
              <li key={t} className="text-xs text-white/55 border border-white/10 rounded-rs px-3 py-2 bg-void/40">
                {t}
              </li>
            ))}
          </ul>
          {angleTour.length > 0 && (
            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {angleTour.map((a) => (
                <div key={a.angle} className="rounded-rs border border-white/10 bg-void/50 p-3">
                  <div className="mono text-[9px] text-violet-soft">{a.angle}</div>
                  <div className="font-semibold text-sm mt-1">{a.label}</div>
                  <div className="text-[11px] text-white/45 mt-1">{a.cameraTip}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={clsx(
              "mono text-[10px] px-4 py-2 rounded-full border",
              tab === t.id
                ? "bg-cyan text-black border-cyan"
                : "border-white/15 text-white/50 hover:border-cyan/40",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "room" && (
        <section className="rounded-rs-xl border border-white/[0.08] bg-deep overflow-hidden">
          <div className="h-12 px-5 flex items-center border-b border-white/[0.06] bg-panel mono text-[11px]">
            STUDIO ROOM · SCENE BACKGROUNDS
          </div>
          <div className="p-5 space-y-4">
            <label className="block">
              <span className="mono text-[10px] text-white/40">PROMPT DNA (customize set)</span>
              <textarea
                value={roomPrompt}
                onChange={(e) => setRoomPrompt(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-rs bg-void border border-white/10 px-3 py-2 text-sm"
                placeholder="Cinematic courtroom interior…"
              />
            </label>
            {(set?.rooms || []).length === 0 && (
              <p className="text-sm text-white/45">Seed Courtroom or create a Studio Set first.</p>
            )}
            {(set?.rooms || []).map((room) => (
              <div key={room.id} className="rounded-rs border border-white/10 bg-panel/60 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold">{room.name}</div>
                    <div className="mono text-[9px] text-white/35">{room.locationKind} · {room.locked ? "locked" : "open"}</div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void generateRoomPlates(room.id)}
                    className="h-9 px-3 rounded-rs bg-cyan text-black text-xs font-bold disabled:opacity-40"
                  >
                    Generate plates
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {(room.requiredAngles || []).map((angle) => {
                    const ok = plateOk(room.platesJson?.[angle]);
                    return (
                      <div
                        key={angle}
                        className={clsx(
                          "aspect-video rounded-rs border grid place-items-center mono text-[9px]",
                          ok ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-white/10 bg-void text-white/30",
                        )}
                      >
                        {angle}
                        <span className="block text-[8px] mt-1 opacity-70">{ok ? "PASS" : "MISSING"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "artist" && (
        <section className="rounded-rs-xl border border-white/[0.08] bg-deep overflow-hidden">
          <div className="h-12 px-5 flex items-center border-b border-white/[0.06] bg-panel mono text-[11px]">
            ARTIST STUDIO · CAST MULTI-ANGLE
          </div>
          <div className="p-5 space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <input
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="Artist / character name"
                className="h-11 rounded-rs bg-void border border-white/10 px-3"
              />
              <input
                value={artistRole}
                onChange={(e) => setArtistRole(e.target.value)}
                placeholder="Role (judge, counsel…)"
                className="h-11 rounded-rs bg-void border border-white/10 px-3"
              />
              <input
                value={artistUrl}
                onChange={(e) => setArtistUrl(e.target.value)}
                placeholder="Image or video URL (optional)"
                className="h-11 rounded-rs bg-void border border-white/10 px-3 md:col-span-1"
              />
              <select
                value={artistSource}
                onChange={(e) => setArtistSource(e.target.value as "image_url" | "video_url")}
                className="h-11 rounded-rs bg-void border border-white/10 px-3"
              >
                <option value="image_url">Import from image URL</option>
                <option value="video_url">Import from video URL</option>
              </select>
            </div>
            <button
              type="button"
              disabled={busy || !set}
              onClick={() => void importArtist()}
              className="h-10 px-4 rounded-rs bg-violet text-white text-sm font-bold disabled:opacity-40"
            >
              Import artist
            </button>
            <div className="grid md:grid-cols-2 gap-3">
              {(set?.artists || []).map((a) => (
                <div key={a.id} className="rounded-rs border border-violet/25 bg-violet/5 p-4">
                  <div className="font-bold">{a.name}</div>
                  <div className="mono text-[9px] text-violet-soft mt-1">
                    {a.role} · {a.importSource}
                    {a.soulId ? ` · soul ${a.soulId.slice(0, 8)}` : ""}
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {(a.requiredAngles || ["front", "left", "right", "threeQuarter"]).map((angle) => {
                      const ok = plateOk(a.platesJson?.[angle]);
                      return (
                        <div
                          key={angle}
                          className={clsx(
                            "aspect-[3/4] rounded-rs border grid place-items-center mono text-[8px]",
                            ok ? "border-cyan/40 text-cyan bg-cyan/10" : "border-white/10 text-white/30",
                          )}
                        >
                          {angle}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "imagery" && (
        <section className="rounded-rs-xl border border-white/[0.08] bg-deep overflow-hidden">
          <div className="h-12 px-5 flex items-center border-b border-white/[0.06] bg-panel mono text-[11px]">
            IMAGERY STUDIO · STYLE + PROMPT BACKGROUNDS
          </div>
          <div className="p-5 space-y-4">
            <label className="block">
              <span className="mono text-[10px] text-white/40">CUSTOMIZE BACKGROUND PROMPT</span>
              <textarea
                value={imageryPrompt}
                onChange={(e) => setImageryPrompt(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-rs bg-void border border-white/10 px-3 py-2 text-sm"
                placeholder="Night courtroom, rain on windows, tungsten practicals…"
              />
            </label>
            <button
              type="button"
              disabled={busy || !set}
              onClick={() => void saveImagery()}
              className="h-10 px-4 rounded-rs bg-orange text-black text-sm font-bold disabled:opacity-40"
            >
              Save imagery + refresh plates
            </button>
            <div className="space-y-2">
              {(set?.imagery || []).map((pack) => (
                <div key={pack.id} className="rounded-rs border border-orange/25 bg-orange/5 px-4 py-3">
                  <div className="font-semibold text-sm">{pack.name}</div>
                  <div className="mono text-[9px] text-orange-soft mt-1">{pack.stylePreset}</div>
                  <p className="text-xs text-white/50 mt-2 line-clamp-3">
                    {pack.customizedPrompt || pack.prompt}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {readiness && readiness.blocking.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {readiness.blocking.map((b) => (
            <span key={b} className="mono text-[9px] px-2 py-1 rounded-full border border-orange/30 text-orange">
              {b}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <button
          type="button"
          disabled={busy || !set || (!canApply && !readiness)}
          onClick={() => void applyToDirector(false)}
          className="h-11 px-5 rounded-rs bg-storm text-white font-bold text-sm disabled:opacity-40"
        >
          Apply to Director
        </button>
        <button
          type="button"
          disabled={busy || !set}
          onClick={() => void applyToDirector(true)}
          className="h-11 px-4 rounded-rs border border-white/15 text-sm font-bold disabled:opacity-40"
        >
          Force apply (soft launch)
        </button>
        <Link href="/storyboard" className="mono text-[10px] text-cyan">
          → Storyboard
        </Link>
        <Link href="/studio" className="mono text-[10px] text-cyan">
          → Studio
        </Link>
        <Link href="/wizard" className="mono text-[10px] text-white/40">
          BOT Director Wizard
        </Link>
      </div>

      {msg && <div className="text-sm text-white/70 border border-white/10 rounded-rs px-4 py-3 bg-panel">{msg}</div>}
    </div>
  );
}
