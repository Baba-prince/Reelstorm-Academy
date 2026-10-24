"use client";

/**
 * Studio Pad — CapCut-like editor shell (beats, captions, export 9:16).
 * UI lives on the RealStorm agent static mount.
 */
export default function StudioPadPage() {
  return (
    <div className="-m-4 lg:-m-8 flex flex-col min-h-[calc(100vh-3.5rem)] lg:min-h-[calc(100vh-4rem)]">
      <div className="px-4 lg:px-6 py-3 border-b border-white/[0.06] flex items-center justify-between gap-3 shrink-0">
        <div>
          <div className="mono text-[9px] text-cyan tracking-[0.14em]">STUDIO PAD</div>
          <p className="text-[12px] text-white/50 mt-0.5">
            CapCut-like · beats · captions · Voice Forge · Export 9:16
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/templates-studio"
            className="mono text-[10px] text-white/50 hover:text-cyan"
          >
            Templates Studio
          </a>
          <a
            href="/agent/studio-pad/ui/"
            target="_blank"
            rel="noreferrer"
            className="mono text-[10px] text-cyan hover:underline"
          >
            Open fullscreen →
          </a>
        </div>
      </div>
      <iframe
        title="Studio Pad"
        src="/agent/studio-pad/ui/"
        className="flex-1 w-full border-0 bg-[#0a0a0e] min-h-[70vh]"
        allow="clipboard-write"
      />
    </div>
  );
}
