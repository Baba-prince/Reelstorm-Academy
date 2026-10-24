"use client";

/**
 * Templates Studio — system-menu shell for the RealStorm pack catalog
 * (podcast / product / presentation). UI lives on the agent static mount.
 */
export default function TemplatesStudioPage() {
  return (
    <div className="-m-4 lg:-m-8 flex flex-col min-h-[calc(100vh-3.5rem)] lg:min-h-[calc(100vh-4rem)]">
      <div className="px-4 lg:px-6 py-3 border-b border-white/[0.06] flex items-center justify-between gap-3 shrink-0">
        <div>
          <div className="mono text-[9px] text-cyan tracking-[0.14em]">TEMPLATES STUDIO</div>
          <p className="text-[12px] text-white/50 mt-0.5">
            Pick a pack → edit script → Create project → Export 9:16
          </p>
        </div>
        <a
          href="/agent/templates-studio/ui/"
          target="_blank"
          rel="noreferrer"
          className="mono text-[10px] text-cyan hover:underline shrink-0"
        >
          Open fullscreen →
        </a>
      </div>
      <iframe
        title="Templates Studio"
        src="/agent/templates-studio/ui/"
        className="flex-1 w-full border-0 bg-[#0a0a0e] min-h-[70vh]"
        allow="clipboard-write"
      />
    </div>
  );
}
