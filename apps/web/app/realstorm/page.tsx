"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";

const TOOLS_FALLBACK = [
  "model_builder",
  "scene_builder",
  "avatar_builder",
  "product_builder",
  "design_builder",
  "realstorm_render",
  "youtube_automation",
  "publish_builder",
];

const OPTIONS = [
  { id: "A", label: "White library tee" },
  { id: "B", label: "Dark academia" },
  { id: "C", label: "Sand tote" },
] as const;

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  previewUrl?: string;
  previewKind?: "image" | "video";
  confirmLabel?: string;
};

type RefMeta = { name: string; kind: string; url: string };

type TalentCard = {
  id?: string;
  name?: string;
  source?: string;
  preview_url?: string | null;
};

type ConfirmMedia = { kind?: string; url?: string; label?: string };

async function readJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
  }
}

function renderReply(text: string) {
  return text.split("\n").map((line, i) => {
    const html = line
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code class='mono text-[11px] text-cyan'>$1</code>");
    return <p key={i} className="mb-1 last:mb-0" dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }} />;
  });
}

export default function RealStormAgentPage() {
  const [tools, setTools] = useState<string[]>(TOOLS_FALLBACK);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Hi — I'm Stormy. Describe the clip or product brief, or **upload a reference** image/video. I'll draft a plan and wait for your confirm before deploying.",
    },
  ]);
  const [plan, setPlan] = useState<Record<string, unknown> | null>(null);
  const [refs, setRefs] = useState<RefMeta[]>([]);
  const [awaiting, setAwaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready to chat.");
  const [err, setErr] = useState(false);
  const [preview, setPreview] = useState("/realstorm/first_clip.mp4");
  const [talent, setTalent] = useState<TalentCard[]>([]);
  const [templateIds, setTemplateIds] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function applyAgentPayload(j: Record<string, unknown>, text?: string) {
    const cm = j.confirm_media as ConfirmMedia | undefined;
    const mediaUrl = cm?.url || (j.plan as Record<string, unknown> | undefined)?.avatar_ref_url;
    setMessages((m) => {
      const next = [...m];
      if (text) next.push({ role: "user", content: text });
      next.push({
        role: "assistant",
        content: String(j.reply || ""),
        previewUrl: typeof mediaUrl === "string" ? mediaUrl : undefined,
        previewKind: cm?.kind === "video" ? "video" : mediaUrl ? "image" : undefined,
        confirmLabel: cm?.label,
      });
      return next;
    });
    if (typeof j.session_id === "string") setSessionId(j.session_id);
    setPlan((j.plan as Record<string, unknown>) || null);
    setAwaiting(Boolean(j.awaiting_confirmation));
    setRefs((j.references as RefMeta[]) || []);
    if (Array.isArray(j.talent)) setTalent(j.talent as TalentCard[]);
    const mats = j.studio_materials as { templates?: { id?: string }[] } | undefined;
    if (mats?.templates?.length) {
      setTemplateIds(mats.templates.map((t) => t.id || "").filter(Boolean).slice(0, 10));
    }
    const cat = j.catalog as { templates?: string[] } | undefined;
    if (cat?.templates?.length && !mats?.templates?.length) {
      setTemplateIds(cat.templates.slice(0, 10));
    }
    if (typeof mediaUrl === "string" && mediaUrl) setPreview(mediaUrl);
    const executed = j.executed as Record<string, Record<string, string>> | undefined;
    const url = executed?.public?.public_url || executed?.video?.video;
    if (url) setPreview(`/realstorm/${String(url).split("/").pop()}`);
  }

  const loadTools = useCallback(async () => {
    try {
      const j = await readJson(await fetch("/agent/tools/list"));
      setTools((j.tools as string[]) || TOOLS_FALLBACK);
      setErr(false);
    } catch (e) {
      setStatus(`API offline: ${e instanceof Error ? e.message : String(e)}`);
      setErr(true);
    }
  }, []);

  useEffect(() => {
    void loadTools();
  }, [loadTools]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(message: string, action: string = "auto") {
    const text = message.trim();
    if (!text && action === "auto") return;
    setBusy(true);
    setErr(false);
    if (text) setInput("");
    setStatus(action === "confirm" ? "Deploying…" : "Stormy thinking…");
    try {
      const res = await fetch("/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text || action, session_id: sessionId, action }),
      });
      const j = await readJson(res);
      if (!res.ok || j.ok === false) throw new Error(String(j.error || `HTTP ${res.status}`));
      applyAgentPayload(j, text || undefined);
      const executed = j.executed as Record<string, Record<string, string>> | undefined;
      setStatus(
        j.awaiting_confirmation
          ? "Plan ready — confirm the avatar/pack or deploy."
          : j.phase === "done"
            ? `Deployed · ${executed?.public?.public_url || "ok"}`
            : j.phase === "focus"
              ? `Focus: ${String(j.focus || "…")}`
              : String(j.phase || "chatting"),
      );
    } catch (e) {
      setErr(true);
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`Failed — ${msg}`);
      setMessages((m) => [
        ...m,
        ...(text ? [{ role: "user" as const, content: text }] : []),
        { role: "assistant", content: `Error: ${msg}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setErr(false);
    setStatus(`Uploading ${file.name}…`);
    const kind = file.type.startsWith("video/") ? "video" : "image";
    const localUrl = URL.createObjectURL(file);
    setMessages((m) => [
      ...m,
      { role: "user", content: `Uploaded ${kind}: ${file.name}`, previewUrl: localUrl, previewKind: kind },
    ]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (sessionId) fd.append("session_id", sessionId);
      const res = await fetch("/agent/upload", { method: "POST", body: fd });
      const j = await readJson(res);
      if (!res.ok || j.ok === false) throw new Error(String(j.error || `HTTP ${res.status}`));
      applyAgentPayload(j);
      const ref = j.reference as RefMeta | undefined;
      const cm = j.confirm_media as ConfirmMedia | undefined;
      if (cm?.url) setPreview(cm.url);
      else if (ref?.url) setPreview(ref.url);
      setStatus(
        j.awaiting_confirmation
          ? "Avatar locked — confirm face in preview, then Confirm & Deploy."
          : "Reference attached — say show avatars / list templates, or pick a scene.",
      );
    } catch (e) {
      setErr(true);
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`Upload failed — ${msg}`);
      setMessages((m) => [...m, { role: "assistant", content: `Upload error: ${msg}` }]);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-4 sm:space-y-6 forge-in">
      <div>
        <div className="mono text-[10px] sm:text-[11px] text-violet mb-2">REALSTORM AGENT // LANGGRAPH OS · PATH B</div>
        <h1 className="display text-3xl sm:text-4xl">Stormy</h1>
        <p className="mt-2 sm:mt-3 text-sm sm:text-base text-white/60 max-w-2xl">
          Stay here — Stormy pulls Avatar Studio, Templates Studio, Studio Pad, Voice Forge & lip-sync.
          Chat → plan → confirm face/pack → deploy. No other menu required.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {[
          { label: "Show avatars", msg: "show avatars" },
          { label: "List templates", msg: "list templates" },
          { label: "Studio materials", msg: "show materials" },
          { label: "Design avatar", msg: "Lets design avatar" },
        ].map((a) => (
          <button
            key={a.msg}
            type="button"
            disabled={busy}
            onClick={() => void send(a.msg)}
            className="mono text-[9px] sm:text-[10px] px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-rs border border-cyan/40 bg-cyan/10 text-cyan"
          >
            {a.label}
          </button>
        ))}
        {tools.slice(0, 8).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => void send(`Let's work on ${t.replace(/_/g, " ")}`)}
            className="mono text-[9px] sm:text-[10px] px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-rs border border-violet/35 bg-violet/15 text-violet-soft"
          >
            {t.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {talent.length > 0 && (
        <div className="rounded-rs-xl border border-white/[0.08] bg-panel p-3 space-y-2">
          <div className="mono text-[10px] text-cyan">AVATAR STUDIO · TAP TO CONFIRM</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {talent.slice(0, 12).map((t, i) => (
              <button
                key={`${t.id || t.name}-${i}`}
                type="button"
                disabled={busy}
                onClick={() => void send(`use avatar ${t.name || i + 1}`)}
                className="shrink-0 w-[88px] text-left"
              >
                <div className="w-[88px] h-[88px] rounded-rs bg-black border border-white/10 overflow-hidden">
                  {t.preview_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.preview_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-[10px] text-white/40 mono">
                      {t.source || "preset"}
                    </div>
                  )}
                </div>
                <div className="mt-1 text-[10px] text-white/70 truncate">{t.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {templateIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="mono text-[9px] text-white/40 self-center mr-1">PACKS</span>
          {templateIds.map((id) => (
            <button
              key={id}
              type="button"
              disabled={busy}
              onClick={() => void send(`use template ${id}`)}
              className="mono text-[9px] px-2 py-1 rounded-rs border border-orange/40 text-orange/90"
            >
              {id}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-3 sm:gap-4">
        <div className="rounded-rs-xl border border-white/[0.08] bg-panel flex flex-col min-h-[520px] sm:min-h-[560px] max-h-[78vh]">
          <div className="mono text-[10px] text-violet-soft px-3 sm:px-5 pt-3 sm:pt-4 pb-2 border-b border-white/[0.06] flex items-center justify-between gap-2">
            <span>CHAT · UPLOAD · PLAN · CONFIRM</span>
            {refs.length > 0 && (
              <span className="text-cyan normal-case tracking-normal">{refs.length} ref(s)</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 space-y-2.5 sm:space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={clsx(
                  "rounded-rs px-3 py-2 sm:px-3.5 sm:py-2.5 text-[13px] sm:text-sm leading-relaxed max-w-[95%] sm:max-w-[92%]",
                  m.role === "user"
                    ? "ml-auto bg-violet/25 border border-violet/35 text-white"
                    : "bg-void border border-white/10 text-white/80",
                )}
              >
                {m.role === "assistant" ? renderReply(m.content) : m.content}
                {m.confirmLabel && (
                  <div className="mono text-[9px] text-orange mt-2">{m.confirmLabel}</div>
                )}
                {m.previewUrl && m.previewKind === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.previewUrl} alt="" className="mt-2 max-h-40 rounded-rs border border-white/10" />
                )}
                {m.previewUrl && m.previewKind === "video" && (
                  <video src={m.previewUrl} controls className="mt-2 max-h-40 w-full rounded-rs border border-white/10" />
                )}
              </div>
            ))}
            {busy && <div className="text-xs text-cyan/80 mono">Stormy typing…</div>}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 sm:p-4 border-t border-white/[0.06] space-y-2.5 sm:space-y-3">
            {refs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {refs.map((r, i) => (
                  <a
                    key={i}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mono text-[9px] px-2 py-1 rounded border border-cyan/30 text-cyan truncate max-w-[140px]"
                  >
                    {r.kind}:{r.name}
                  </a>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void send(`option ${o.id}`)}
                  className="text-xs px-2.5 py-1.5 rounded-rs border border-white/10 bg-elevated/50 text-white/70"
                >
                  <span className="mono text-cyan mr-1">{o.id}</span>
                  {o.label}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => void send("Lets design avatar")}
                className="text-xs px-2.5 py-1.5 rounded-rs border border-violet/40 text-violet-soft"
              >
                Design avatar
              </button>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Chat naturally — or attach a reference below"
              className="w-full min-h-[64px] sm:min-h-[72px] rounded-rs bg-void border border-white/10 px-3 py-2.5 text-sm"
            />
            <div className="flex flex-wrap gap-2 items-center">
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="h-10 sm:h-11 px-3 sm:px-4 rounded-rs border border-cyan/40 text-cyan text-sm font-semibold"
              >
                Upload ref
              </button>
              <button
                type="button"
                disabled={busy || !input.trim()}
                onClick={() => void send(input)}
                className="h-10 sm:h-11 px-4 sm:px-5 rounded-rs bg-violet text-white font-bold disabled:opacity-50"
              >
                Send
              </button>
              <button
                type="button"
                disabled={busy || !awaiting}
                onClick={() => void send("confirm", "confirm")}
                className="h-10 sm:h-11 px-4 sm:px-5 rounded-rs bg-cyan text-black font-bold disabled:opacity-40"
              >
                Confirm & Deploy
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void send("cancel", "cancel")}
                className="h-10 sm:h-11 px-3 rounded-rs border border-white/15 text-white/60 text-sm"
              >
                Reset
              </button>
            </div>
            <div className={clsx("text-xs sm:text-sm", err ? "text-[#ff6b6b]" : "text-cyan/90")}>{status}</div>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div className="rounded-rs-xl border border-white/[0.08] bg-panel p-3 sm:p-5 space-y-3">
            <div className="mono text-[10px] text-orange">PREVIEW / REFERENCE</div>
            {/\.(png|jpe?g|webp|gif)(\?|$)/i.test(preview) ||
            (preview.includes("/agent/files/") && !/\.(mp4|mov|webm)/i.test(preview)) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="w-full aspect-square object-cover rounded-rs bg-black border border-white/10" />
            ) : (
              <video
                key={preview}
                src={preview}
                controls
                playsInline
                className="w-full aspect-square object-cover rounded-rs bg-black border border-white/10"
              />
            )}
            <a href={preview} target="_blank" rel="noreferrer" className="text-xs sm:text-sm text-cyan hover:underline break-all block">
              {preview}
            </a>
          </div>
          {plan && Array.isArray(plan.steps) && (plan.steps as string[]).length > 0 && (
            <div className="rounded-rs-xl border border-white/[0.08] bg-panel p-3 sm:p-5">
              <div className="mono text-[10px] text-cyan mb-2">DRAFT PLAN</div>
              <ul className="text-xs sm:text-sm text-white/70 space-y-1">
                {(plan.steps as string[]).map((s) => (
                  <li key={s}>· {s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
