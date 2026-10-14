"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api";

type PodPayload = {
  status: "RUNNING" | "SLEEPING" | "WAKING" | "FAILED" | "UNKNOWN";
  ok: boolean;
  r2_ok: boolean;
  mode: string | null;
  isServerless: boolean;
  autoStart: boolean;
  heygenFallback: boolean;
  error?: string;
  hint?: string;
};

const DOT: Record<string, string> = {
  RUNNING: "bg-emerald-400",
  WAKING: "bg-amber-400 animate-pulse",
  SLEEPING: "bg-rose-500",
  FAILED: "bg-white/30",
  UNKNOWN: "bg-white/30",
};

const LABEL: Record<string, string> = {
  RUNNING: "RUNNING",
  WAKING: "STARTING…",
  SLEEPING: "SLEEPING",
  FAILED: "FAILED",
  UNKNOWN: "CHECKING…",
};

export function PodStatusIndicator({ compact }: { compact?: boolean }) {
  const [pod, setPod] = useState<PodPayload | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const d = await api<PodPayload>("/api/pod/status");
      setPod(d);
    } catch {
      setPod({
        status: "UNKNOWN",
        ok: false,
        r2_ok: false,
        mode: null,
        isServerless: false,
        autoStart: true,
        heygenFallback: false,
      });
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  async function wake() {
    setBusy(true);
    try {
      await api("/api/pod/wake", { method: "POST", body: "{}" });
      // Poll while waking
      for (let i = 0; i < 18; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const d = await api<PodPayload>("/api/pod/status");
        setPod(d);
        if (d.status === "RUNNING") break;
      }
    } catch {
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const status = pod?.status || "UNKNOWN";

  return (
    <div
      className={clsx(
        "flex flex-wrap items-center gap-2 rounded-rs border border-white/10 bg-void/70",
        compact ? "px-2 py-1" : "px-3 py-2",
      )}
    >
      <span className={clsx("w-2 h-2 rounded-full shrink-0", DOT[status] || DOT.UNKNOWN)} />
      <span className="mono text-[9px] text-white/70 tracking-wider">
        GPU {LABEL[status] || status}
        {pod?.isServerless ? " · SERVERLESS" : ""}
        {pod?.status === "RUNNING" && pod.r2_ok ? " · R2 OK" : ""}
      </span>
      {(status === "SLEEPING" || status === "WAKING" || status === "FAILED" || status === "UNKNOWN") && (
        <button
          type="button"
          disabled={busy || status === "WAKING"}
          onClick={wake}
          className="mono text-[9px] px-2 py-0.5 rounded-full border border-cyan/40 text-cyan hover:bg-cyan/10 disabled:opacity-40"
        >
          {busy || status === "WAKING" ? "Starting…" : "Wake Pod"}
        </button>
      )}
      {!compact && status === "WAKING" && (
        <span className="mono text-[8px] text-amber-300/90 max-w-[260px] leading-snug">
          GPU machine up — waiting for saver /health
        </span>
      )}
      {!compact && pod?.heygenFallback && status !== "RUNNING" && (
        <span className="mono text-[8px] text-white/35">HeyGen fallback ready</span>
      )}
      {!compact && status !== "RUNNING" && /not enough free GPUs/i.test(pod?.error || "") && (
        <span className="mono text-[8px] text-orange/90 max-w-[280px] leading-snug">
          Host full — retry wake later · Avatar can still ship photo+TTS
        </span>
      )}
    </div>
  );
}
