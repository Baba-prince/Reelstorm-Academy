"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { FACTORY_START_PATH, getStartHere, resolveGuideLayer } from "@reelstorm/domain";

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

const WELCOME_KEY = "rs_guide_welcomed_v2";

export function GuideBot() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<GuideOption[]>([]);
  const [title, setTitle] = useState("STORM Guide");
  const [blurb, setBlurb] = useState("Improve workflow · learn the system");
  const [messages, setMessages] = useState<Msg[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const greeted = useRef<string | null>(null);
  const pendingAsk = useRef<string | null>(null);

  const layer = resolveGuideLayer(pathname);
  const startHere = getStartHere(layer);

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
      setOptions(ctx.options);
      return ctx;
    } catch {
      const local = resolveGuideLayer(path);
      const start = getStartHere(local);
      setTitle(local.title);
      setBlurb(local.blurb);
      setOptions([
        {
          id: "start",
          label: "Where do I start?",
          prompt: `Where do I start on ${local.title}?`,
          kind: "improve",
        },
        ...local.options.slice(0, 3),
      ]);
      return {
        title: local.title,
        blurb: local.blurb,
        tips: start.steps,
        options: local.options,
      };
    }
  }, []);

  const ask = useCallback(
    async (message: string, optionId?: string, opt?: GuideOption) => {
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
        setMessages((m) => [...m, { role: "assistant", content: res.reply, source: res.source }]);
      } catch (e) {
        // Offline: answer from Start Here knowledge
        const start = getStartHere(resolveGuideLayer(pathname));
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: [
              `**${resolveGuideLayer(pathname).title}** — ${start.goal}`,
              "",
              ...start.steps.map((s, i) => `${i + 1}. ${s}`),
              "",
              `Primary: ${start.primaryLabel}${start.primaryHref ? ` → ${start.primaryHref}` : ""}`,
              "",
              `Guide API briefly offline: ${(e as Error).message}`,
            ].join("\n"),
            source: "start-here",
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [locale, messages, options, pathname, router],
  );

  useEffect(() => {
    loadContext(pathname).then((ctx) => {
      if (!ctx) return;
      if (greeted.current === pathname) return;
      greeted.current = pathname;
      const start = getStartHere(resolveGuideLayer(pathname));
      setMessages([
        {
          role: "assistant",
          content: [
            `**${ctx.title}** — ${ctx.blurb}`,
            "",
            "**Start here on this screen:**",
            ...start.steps.map((s, i) => `${i + 1}. ${s}`),
            "",
            "Tap **Where do I start?** anytime, or pick an option below.",
          ].join("\n"),
          source: "context",
        },
      ]);
    });
  }, [pathname, loadContext]);

  // First visit: auto-open guide so users aren't lost
  useEffect(() => {
    try {
      if (localStorage.getItem(WELCOME_KEY)) return;
      localStorage.setItem(WELCOME_KEY, "1");
      setOpen(true);
      pendingAsk.current = "Where do I start in ReelStorm OS? Give me the first click and next two steps.";
    } catch {
      /* ignore */
    }
  }, []);

  // External open from Start Here rail / sidebar
  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<{ prompt?: string }>).detail;
      setOpen(true);
      const prompt = detail?.prompt || "Where do I start on this screen?";
      pendingAsk.current = prompt;
    }
    window.addEventListener("rs-open-guide", onOpen as EventListener);
    return () => window.removeEventListener("rs-open-guide", onOpen as EventListener);
  }, []);

  useEffect(() => {
    if (!open || !pendingAsk.current || busy) return;
    const p = pendingAsk.current;
    pendingAsk.current = null;
    void ask(p);
  }, [open, busy, ask]);

  useEffect(() => {
    if (open && scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
  }, [messages, open, busy]);

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

  const startOptions: GuideOption[] = [
    {
      id: "where-start",
      label: "Where do I start?",
      prompt: `Where do I start on ${title}? Give the first click and next two steps.`,
      kind: "improve",
    },
    ...options.filter((o) => o.id !== "where-start" && o.id !== "start").slice(0, 3),
  ];

  return (
    <>
      <div className="fixed z-[60] bottom-5 right-5 md:bottom-7 md:right-7 flex flex-col items-end gap-2">
        {!open && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              pendingAsk.current = `Where do I start on ${title}?`;
            }}
            className="h-9 px-3 rounded-full border border-orange/50 bg-orange text-black text-[11px] font-bold shadow-lg animate-pulse"
          >
            Where do I start?
          </button>
        )}
        <button
          type="button"
          aria-label={t("guide.title")}
          onClick={() => setOpen((v) => !v)}
          className={clsx(
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
      </div>

      {open && (
        <div
          className="fixed z-[60] bottom-[5.5rem] right-4 md:right-7 w-[min(100vw-1.5rem,420px)] max-h-[min(78vh,680px)] flex flex-col rounded-rs-xl border border-white/10 bg-[#0A0A0A]/95 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.65)] overflow-hidden"
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

          <div className="px-3 py-2 border-b border-white/[0.06] flex gap-1 overflow-x-auto">
            {FACTORY_START_PATH.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  "shrink-0 mono text-[8px] px-2 py-1 rounded-full border",
                  pathname === p.href || pathname.startsWith(p.href + "/")
                    ? "border-cyan/50 text-cyan bg-cyan/10"
                    : "border-white/10 text-white/35",
                )}
              >
                {p.label}
              </Link>
            ))}
          </div>

          <div className="px-3 py-2 border-b border-white/[0.06] bg-void/50">
            <div className="mono text-[8px] text-orange mb-1">THIS SCREEN</div>
            <ol className="space-y-1">
              {startHere.steps.slice(0, 3).map((s, i) => (
                <li key={i} className="text-[11px] text-white/60 flex gap-2">
                  <span className="text-orange mono text-[9px]">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
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
            {startOptions.map((o) => (
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
            <Link href="/wizard" className="hover:text-cyan" onClick={() => setOpen(false)}>
              Wizard
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
