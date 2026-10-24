"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Progress = {
  stage: string;
  pct: number;
  castLocked: boolean;
  worldLocked: boolean;
  voiceLocked: boolean;
  boardApproved: boolean;
  shotReady: boolean;
  cutReady: boolean;
};

type Bible = {
  title: string;
  spine: string;
  logline: string;
  characters: Array<{
    id: string;
    name: string;
    role: string;
    faceUrl?: string;
    voiceId?: string;
    locked: boolean;
    wardrobeDay0?: string;
  }>;
  worlds: Array<{ id: string; name: string; description: string; plateUrl?: string; locked: boolean }>;
  episodes: Array<{
    index: number;
    title: string;
    synopsis: string;
    cliffhanger: string;
    status: string;
    masterUrl?: string;
    stills: Array<{
      id: string;
      prompt: string;
      dialogue?: string;
      stillUrl?: string;
      approved: boolean;
      framing: string;
      durationSec: number;
    }>;
    clips: Array<{ stillId: string; status: string; videoUrl?: string; engine?: string; error?: string }>;
  }>;
};

const STEPS = [
  { id: "cast", label: "Cast", href: "cast" },
  { id: "world", label: "World", href: "world" },
  { id: "voice", label: "Voice", href: "voice" },
  { id: "board", label: "Board", href: "board" },
  { id: "shoot", label: "Shoot", href: "shoot" },
  { id: "cut", label: "Cut", href: "cut" },
] as const;

export default function CinemaPage() {
  useAuth();
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [bible, setBible] = useState<Bible | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [masterUrl, setMasterUrl] = useState<string | null>(null);
  const [continuity, setContinuity] = useState<{ pass: boolean; issues: string[] } | null>(null);
  const [rtcInfo, setRtcInfo] = useState<{ shoot: number; cut: number } | null>(null);

  const refresh = useCallback(async (id: string) => {
    const data = await api<{
      bible: Bible;
      progress: Progress;
      continuity?: { pass: boolean; issues: string[] };
      rtc?: { shoot: number; cut: number };
    }>(`/api/cinema/seasons/${id}`);
    setBible(data.bible);
    setProgress(data.progress);
    setContinuity(data.continuity || null);
    setRtcInfo(data.rtc || null);
    setMasterUrl(data.bible.episodes?.[0]?.masterUrl || null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const list = await api<{ seasons: Array<{ id: string }> }>("/api/cinema/seasons");
        if (list.seasons?.[0]) {
          setSeasonId(list.seasons[0].id);
          await refresh(list.seasons[0].id);
        }
      } catch {
        /* empty */
      }
    })();
  }, [refresh]);

  async function createPilot() {
    setBusy(true);
    setMsg(null);
    try {
      const data = await api<{ season: { id: string }; bible: Bible; progress: Progress }>(
        "/api/cinema/seasons",
        {
          method: "POST",
          body: JSON.stringify({
            spineId: "revenge",
            title: "Night of Proof",
          }),
        },
      );
      setSeasonId(data.season.id);
      setBible(data.bible);
      setProgress(data.progress);
      setMsg("Season created — lock Cast → World → Voice, approve Board, then Shoot.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function lock(kind: "cast" | "world" | "voice") {
    if (!seasonId) return;
    setBusy(true);
    setMsg(null);
    try {
      const data = await api<{
        bible: Bible;
        progress: Progress;
        continuity?: { pass: boolean; issues: string[] };
      }>(`/api/cinema/seasons/${seasonId}/${kind}/lock`, { method: "POST", body: "{}" });
      setBible(data.bible);
      setProgress(data.progress);
      setContinuity(data.continuity || null);
      setMsg(`${kind} locked`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function approveAll() {
    if (!seasonId) return;
    setBusy(true);
    try {
      const data = await api<{
        bible: Bible;
        progress: Progress;
        rtcRequiredToShoot?: number;
      }>(`/api/cinema/seasons/${seasonId}/board/approve`, {
        method: "POST",
        body: JSON.stringify({ all: true }),
      });
      setBible(data.bible);
      setProgress(data.progress);
      setMsg(
        `All stills approved — shoot unlocked${data.rtcRequiredToShoot ? ` · ${data.rtcRequiredToShoot} RTC` : ""}`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function shoot() {
    if (!seasonId) return;
    setBusy(true);
    setMsg("Shooting episode (HeyGen dialogue + Ken Burns inserts)…");
    try {
      const data = await api<{
        bible: Bible;
        progress: Progress;
        continuity?: { pass: boolean; issues: string[] };
        shotSummary?: { ready: number; total: number; qcPass?: number; rtcCharged?: number };
      }>(`/api/cinema/seasons/${seasonId}/shoot`, {
        method: "POST",
        body: JSON.stringify({ quick: false, engine: "kenburns" }),
      });
      setBible(data.bible);
      setProgress(data.progress);
      setContinuity(data.continuity || null);
      setMsg(
        `Shoot done · ${data.shotSummary?.ready}/${data.shotSummary?.total} ready · QC ${data.shotSummary?.qcPass ?? "—"} · RTC ${data.shotSummary?.rtcCharged ?? 0}`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function cut() {
    if (!seasonId) return;
    setBusy(true);
    setMsg("Assembling master…");
    try {
      const data = await api<{ bible: Bible; progress: Progress; masterUrl: string; cliffhanger: string }>(
        `/api/cinema/seasons/${seasonId}/cut`,
        { method: "POST", body: "{}" },
      );
      setBible(data.bible);
      setProgress(data.progress);
      setMasterUrl(data.masterUrl);
      setMsg(`Master shipped · cliffhanger: ${data.cliffhanger}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runFullPilot() {
    setBusy(true);
    setMsg("Running full pilot pipeline…");
    try {
      const data = await api<{
        seasonId: string;
        cut: { masterUrl?: string; cliffhanger?: string };
      }>("/api/cinema/pilot", {
        method: "POST",
        body: JSON.stringify({ spineId: "revenge", title: "Night of Proof", quick: false }),
      });
      setSeasonId(data.seasonId);
      await refresh(data.seasonId);
      setMasterUrl(data.cut?.masterUrl || null);
      setMsg(`Pilot complete · ${data.cut?.cliffhanger || "shipped"}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const ep = bible?.episodes?.[0];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <header className="space-y-2">
        <div className="mono text-[10px] text-cyan tracking-[0.16em]">CINEMA MODE · SAGA HYBRID</div>
        <h1 className="display text-3xl md:text-4xl">REELSTORM CINEMA</h1>
        <p className="text-white/60 text-sm max-w-2xl">
          Four studios only: Cast · World · Voice · Cut. Showrunner absorbs BOT Director. Approve
          storyboard before any shoot spend.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {!seasonId ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={createPilot}
              className="px-4 py-2.5 rounded-rs bg-violet/90 hover:bg-violet text-sm font-semibold"
            >
              New revenge drama
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={runFullPilot}
              className="px-4 py-2.5 rounded-rs bg-cyan/20 border border-cyan/40 text-cyan text-sm font-semibold"
            >
              Ship first pilot (auto)
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={runFullPilot}
            className="px-4 py-2.5 rounded-rs bg-orange/20 border border-orange/40 text-orange text-sm font-semibold"
          >
            Re-run full pilot
          </button>
        )}
        <Link href="/dashboard" className="px-4 py-2.5 rounded-rs border border-white/10 text-sm text-white/60">
          Factory Mode
        </Link>
      </div>

      {progress ? (
        <div className="rounded-rs border border-white/10 bg-panel/80 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="mono text-[10px] text-white/50">PROGRESS · {progress.stage}</span>
            <span className="text-cyan font-semibold">{progress.pct}%</span>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] text-white/55 mb-3">
            {rtcInfo ? (
              <span>
                RTC shoot {rtcInfo.shoot} · cut {rtcInfo.cut}
              </span>
            ) : null}
            {continuity ? (
              <span className={continuity.pass ? "text-cyan" : "text-orange"}>
                Continuity {continuity.pass ? "PASS" : `OPEN (${continuity.issues.length})`}
              </span>
            ) : null}
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet to-cyan" style={{ width: `${progress.pct}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
            {STEPS.map((s) => {
              const ok =
                (s.id === "cast" && progress.castLocked) ||
                (s.id === "world" && progress.worldLocked) ||
                (s.id === "voice" && progress.voiceLocked) ||
                (s.id === "board" && progress.boardApproved) ||
                (s.id === "shoot" && progress.shotReady) ||
                (s.id === "cut" && progress.cutReady);
              return (
                <div
                  key={s.id}
                  className={clsx(
                    "rounded-lg border px-2 py-2 text-center text-xs",
                    ok ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-white/10 text-white/40",
                  )}
                >
                  {s.label}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {bible ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <section className="rounded-rs border border-white/10 p-4 space-y-3">
            <h2 className="display text-lg">{bible.title}</h2>
            <p className="text-sm text-white/65">{bible.logline}</p>
            <p className="mono text-[10px] text-orange">SPINE · {bible.spine}</p>

            <div className="flex flex-wrap gap-2 pt-2">
              {[
                { label: "1 · Lock Cast", fn: () => lock("cast"), accent: false },
                { label: "2 · Lock World", fn: () => lock("world"), accent: false },
                { label: "3 · Lock Voice", fn: () => lock("voice"), accent: false },
                { label: "4 · Approve Board", fn: approveAll, accent: false },
                { label: "5 · Shoot", fn: shoot, accent: true },
                { label: "6 · Cut master", fn: cut, accent: true },
              ].map((b) => (
                <button
                  key={b.label}
                  type="button"
                  disabled={busy}
                  onClick={b.fn}
                  className={clsx(
                    "px-3 py-1.5 rounded-[10px] border text-xs disabled:opacity-50",
                    b.accent
                      ? "border-cyan/35 text-cyan bg-cyan/10"
                      : "border-white/12 bg-white/[0.04]",
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              {bible.characters.map((c) => (
                <div key={c.id} className="rounded-lg border border-white/10 overflow-hidden">
                  {c.faceUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.faceUrl} alt={c.name} className="w-full h-36 object-cover" />
                  ) : (
                    <div className="h-36 bg-white/5" />
                  )}
                  <div className="p-2 text-xs">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-white/45">{c.role}</div>
                    <div className={c.locked ? "text-cyan" : "text-orange"}>{c.locked ? "LOCKED" : "OPEN"}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-rs border border-white/10 p-4 space-y-3">
            <h3 className="display text-base">Ep1 · {ep?.title}</h3>
            <p className="text-sm text-white/60">{ep?.synopsis}</p>
            <p className="text-xs text-orange/90">Cliffhanger: {ep?.cliffhanger}</p>

            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {ep?.stills.map((s) => {
                const clip = ep.clips.find((c) => c.stillId === s.id);
                return (
                  <div key={s.id} className="flex gap-3 rounded-lg border border-white/10 p-2">
                    {s.stillUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.stillUrl} alt="" className="w-16 h-28 object-cover rounded" />
                    ) : (
                      <div className="w-16 h-28 bg-white/5 rounded" />
                    )}
                    <div className="flex-1 text-xs space-y-1">
                      <div className="font-medium">{s.dialogue || s.prompt.slice(0, 80)}</div>
                      <div className="text-white/40">
                        {s.framing} · {s.durationSec}s · {s.approved ? "approved" : "pending"}
                      </div>
                      {clip ? (
                        <div className="text-cyan/80">
                          {clip.status}
                          {clip.engine ? ` · ${clip.engine}` : ""}
                          {clip.error ? ` · ${clip.error}` : ""}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {masterUrl ? (
              <div className="pt-2 space-y-2">
                <div className="mono text-[10px] text-cyan">MASTER</div>
                <video src={masterUrl} controls className="w-full max-h-96 rounded-lg bg-black" />
                <a href={masterUrl} target="_blank" rel="noreferrer" className="text-sm text-cyan underline">
                  Open master URL
                </a>
              </div>
            ) : null}
          </section>
        </div>
      ) : (
        <div className="rounded-rs border border-dashed border-white/15 p-10 text-center text-white/50">
          Create a revenge drama season or ship the auto pilot to produce Episode 1.
        </div>
      )}

      {msg ? <p className="text-sm text-white/70 border-t border-white/10 pt-4">{msg}</p> : null}
    </div>
  );
}
