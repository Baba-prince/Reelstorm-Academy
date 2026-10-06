"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

type GuideOption = {
  id: string;
  label: string;
  prompt: string;
  href?: string;
  kind: "learn" | "do" | "improve" | "goto";
};

type Msg = { role: "user" | "assistant"; content: string; source?: string };

const KIND_COLOR: Record<GuideOption["kind"], string> = {
  learn: "#00D9FF",
  do: "#FF7A00",
  improve: "#7C3AED",
  goto: "#C4B5FD",
};

export function GuideBot() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [tips, setTips] = useState<string[]>([]);
  const [options, setOptions] = useState<GuideOption[]>([]);
  const [title, setTitle] = useState("STORM Guide");
  const [blurb, setBlurb] = useState("Improve workflow · learn the system");
  const [messages, setMessages] = useState<Msg[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const greeted = useRef<string | null>(null);

  const loadContext = useCallback(async (path: string) => {
    try {
      const ctx = await api<{
        title: string;
        blurb: string;
        tips: string[];
        options: GuideOption[];
      }>(`/api/guide/context?pathname=${encodeURIComponent(path)}`);
      setTitle(ctx.title);
      setBlurb(ctx.blurb);
      setTips(ctx.tips);
      setOptions(ctx.options);
      return ctx;
    } catch {
      setTitle("STORM Guide");
      setBlurb("Coach available offline with system knowledge.");
      setTips(["Ask what to do next on this screen."]);
      setOptions([
        {
          id: "next",
          label: "What next?",
          prompt: "What should I do next?",
          kind: "improve",
        },
      ]);
      return null;
    }
  }, []);

  useEffect(() => {
    loadContext(pathname).then((ctx) => {
      if (!ctx) return;
      if (greeted.current === pathname) return;
      greeted.current = pathname;
      setMessages([
        {
          role: "assistant",
          content: `**${ctx.title}** — ${ctx.blurb}\n\n${ctx.tips.map((t) => `• ${t}`).join("\n")}\n\nPick an option to improve your workflow, or ask me anything.`,
          source: "context",
        },
      ]);
    });
  }, [pathname, loadContext]);

  useEffect(() => {
    if (open && scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
  }, [messages, open, busy]);

  async function ask(message: string, optionId?: string, opt?: GuideOption) {
    const text = message.trim();
    if (!text && !optionId) return;
    if (opt?.href && opt.kind === "goto") {
      setMessages((m) => [
        ...m,
        { role: "user", content: opt.label },
        {
          role: "assistant",
          content: `Opening **${opt.href}** — I’ll coach you there.`,
          source: "nav",
        },
      ]);
      setOpen(true);
      router.push(opt.href);
      return;
    }

    setOpen(true);
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: text || opt?.label || "…" }]);
    setInput("");
    try {
      const history = messages.slice(-6).map(({ role, content }) => ({ role, content }));
      const res = await api<{
        reply: string;
        options: GuideOption[];
        source: string;
      }>("/api/guide/chat", {
        method: "POST",
        body: JSON.stringify({
          message: text || undefined,
          optionId,
          pathname,
          history,
          locale,
        }),
      });
      setOptions(res.options?.length ? res.options : options);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.reply, source: res.source },
      ]);
      if (opt?.href && opt.kind !== "goto") {
        // soft hint already in reply; keep user on page unless they click again
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Guide offline for a moment: ${(e as Error).message}\n\nTry again, or open /training for the flip manual.`,
          source: "error",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function renderContent(content: string) {
    return content.split("\n").map((line, i) => {
      const bold = line.replace(/\*\*([^*]+)\*\*/g, "‹$1›");
      const parts = bold.split(/‹|›/);
      return (
        <p key={i} className={clsx("leading-relaxed", line.startsWith("•") || line.startsWith("→") ? "pl-0" : "")}>
          {parts.map((p, j) =>
            j % 2 === 1 ? (
              <strong key={j} className="text-white font-semibold">
                {p}
              </strong>
            ) : (
              <span key={j}>{p}</span>
            ),
          )}
        </p>
      );
    });
  }

  return (
    <>
      {/* Launcher — every layer */}
      <button
        type="button"
        aria-label={t("guide.title")}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "fixed z-[60] bottom-5 right-5 md:bottom-7 md:right-7",
          "h-14 pl-3 pr-4 rounded-full flex items-center gap-2.5",
          "bg-gradient-to-r from-violet to-cyan text-white font-bold shadow-[0_12px_40px_rgba(124,58,237,0.45)]",
          "hover:brightness-110 transition border border-white/20",
          open && "ring-2 ring-orange/80",
        )}
      >
        <span className="w-8 h-8 rounded-full bg-black/25 flex items-center justify-center mono text-[10px] tracking-wider">
          AI
        </span>
        <span className="text-[13px] hidden sm:inline">{t("guide.title")}</span>
        <span className="sm:hidden text-[13px]">Guide</span>
      </button>

      {open && (
        <div
          className="fixed z-[60] bottom-[5.5rem] right-4 md:right-7 w-[min(100vw-1.5rem,400px)] max-h-[min(72vh,620px)] flex flex-col rounded-rs-xl border border-white/10 bg-[#0A0A0A]/95 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.65)] overflow-hidden"
          role="dialog"
          aria-label="STORM Guide"
        >
          <div className="px-4 py-3 border-b border-white/[0.08] flex items-start justify-between gap-3 bg-gradient-to-r from-violet/20 via-transparent to-cyan/10">
            <div className="min-w-0">
              <div className="mono text-[9px] text-cyan tracking-[0.16em]">{t("guide.everyLayer")}</div>
              <div className="display text-[15px] mt-1 truncate">{title}</div>
              <div className="text-[11px] text-white/45 mt-0.5 line-clamp-2">{blurb}</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-white/40 hover:text-white text-[18px] leading-none px-1"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-[13px]">
            {messages.map((m, i) => (
              <div
                key={i}
                className={clsx(
                  "rounded-rs px-3 py-2.5 whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-violet/25 border border-violet/30 text-white ml-6"
                    : "bg-white/[0.04] border border-white/[0.06] text-white/75 mr-2",
                )}
              >
                {m.role === "assistant" ? renderContent(m.content) : m.content}
                {m.source && m.role === "assistant" && (
                  <div className="mono text-[8px] text-white/25 mt-2 tracking-wider">{m.source}</div>
                )}
              </div>
            ))}
            {busy && (
              <div className="text-[12px] text-cyan/80 mono animate-pulse">{t("guide.thinking")}</div>
            )}
          </div>

          <div className="px-3 pb-2 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-2">
            {options.slice(0, 4).map((o) => (
              <button
                key={o.id}
                type="button"
                disabled={busy}
                onClick={() => ask(o.prompt, o.id, o)}
                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full border transition hover:bg-white/[0.06] disabled:opacity-40"
                style={{ borderColor: `${KIND_COLOR[o.kind]}66`, color: KIND_COLOR[o.kind] }}
              >
                {o.label}
              </button>
            ))}
          </div>

          <form
            className="p-3 pt-1 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("guide.placeholder")}
              className="flex-1 h-11 rounded-rs bg-void border border-white/10 px-3 text-[13px]"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="h-11 px-4 rounded-rs bg-orange text-black font-bold text-[13px] disabled:opacity-40"
            >
              {t("guide.send")}
            </button>
          </form>

          <div className="px-3 pb-3 flex gap-3 text-[10px] text-white/35">
            <Link href="/training" className="hover:text-cyan" onClick={() => setOpen(false)}>
              {t("guide.training")}
            </Link>
            <Link href="/how-it-works" className="hover:text-cyan" onClick={() => setOpen(false)}>
              {t("guide.factoryMap")}
            </Link>
            <Link href="/sound-studio" className="hover:text-cyan" onClick={() => setOpen(false)}>
              {t("guide.soundStudio")}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
