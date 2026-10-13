"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { getApiBase, readJson } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PodStatusIndicator } from "@/components/PodStatusIndicator";

type OutfitVariant = {
  id: string;
  name: string;
  outfitPrompt: string;
  thumbUrl: string;
  r2Url: string;
  videoUrl?: string;
};

type Avatar = {
  id: string;
  name: string;
  type: string;
  sourceUrl: string;
  status: string;
  outfitVariants: OutfitVariant[];
  lastVideoUrl?: string | null;
  lastScript?: string | null;
};

type Template = {
  id: string;
  name: string;
  slug: string;
  category: string;
  thumbnailUrl: string;
  hookTemplate: string;
  scriptPromptTemplate: string;
  duration: number;
  rtcCost: number;
};

const NICHES = ["Real Estate", "Health", "Finance", "AI", "Coaching"] as const;
const FP_KEY = "reelstorm_studio_web_fingerprint";
const TABS = [
  { id: "mine", label: "My Avatars" },
  { id: "stock", label: "Stock Avatars" },
  { id: "templates", label: "Templates" },
  { id: "create", label: "Create Avatar" },
] as const;

function webFingerprint() {
  if (typeof window === "undefined") return "web-fingerprint-fallback01";
  let fp = localStorage.getItem(FP_KEY);
  if (!fp) {
    fp = `web-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    localStorage.setItem(FP_KEY, fp);
  }
  return fp;
}

const GUIDE_STEPS = [
  { n: "01", title: "Create or pick avatar", tip: "Photo, video twin, or YouTube/social link → extract face stills → rebuild 4 outfit variants." },
  { n: "02", title: "Choose a template", tip: "MissTechy flow: Unknown→Expert, News Authority, Outfit Carousel, CTA Army, Pizza→CEO." },
  { n: "03", title: "Niche + local news", tip: "Ollama writes a 30s script with a viral hook — same ChatGPT prompt she used." },
  { n: "04", title: "Generate → R2", tip: "Output lands on videos.reelstorm.uk — open Studio Set to use it in the factory." },
];

type ExtractFrame = { index: number; time: number; r2Url: string; key: string };

export default function AvatarStudioPage() {
  const { token, user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("create");
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [stock, setStock] = useState<Avatar[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [variantId, setVariantId] = useState("red-bomber");
  const [templateSlug, setTemplateSlug] = useState("news-update-authority");
  const [niche, setNiche] = useState<(typeof NICHES)[number]>("AI");
  const [localNews, setLocalNews] = useState("Waymo robotaxi opened service");
  const [script, setScript] = useState("");
  const [name, setName] = useState("Tobi Twin");
  const [linkUrl, setLinkUrl] = useState("");
  const [extractFrames, setExtractFrames] = useState<ExtractFrame[]>([]);
  const [extractMeta, setExtractMeta] = useState<{
    title?: string;
    sourceLabel?: string;
    sourceVideoUrl?: string;
    suggestedName?: string;
  } | null>(null);
  const [pickedFrame, setPickedFrame] = useState<ExtractFrame | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(true);
  const [guideIdx, setGuideIdx] = useState(0);

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = {};
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const load = useCallback(async () => {
    try {
      const tRes = await fetch(`${getApiBase()}/api/avatar/templates`);
      const tJson = await readJson<{ templates?: Template[] }>(tRes);
      setTemplates(tJson.templates || []);
      if (tJson.templates?.[0]?.slug) setTemplateSlug(tJson.templates[0].slug);
    } catch {
      /* ignore */
    }
    if (!token) return;
    try {
      const res = await fetch(`${getApiBase()}/api/avatar/list`, { headers: authHeaders });
      const j = await readJson<{ avatars?: Avatar[]; stock?: Avatar[]; error?: string }>(res);
      setAvatars(j.avatars || []);
      setStock(j.stock || []);
      if (j.avatars?.[0] && !selectedAvatar) {
        setSelectedAvatar(j.avatars[0]);
        const v = j.avatars[0].outfitVariants?.[0]?.id;
        if (v) setVariantId(v);
      }
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, [authHeaders, token, selectedAvatar]);

  useEffect(() => {
    void load();
  }, [load]);

  async function selectAvatarById(avatarId: string) {
    const res = await fetch(`${getApiBase()}/api/avatar/list`, { headers: authHeaders });
    const list = await readJson<{ avatars?: Avatar[] }>(res);
    const found = (list.avatars || []).find((a: Avatar) => a.id === avatarId);
    if (found) {
      setSelectedAvatar(found);
      setVariantId(found.outfitVariants?.[0]?.id || "red-bomber");
    }
  }

  async function onUpload(file: File, kind: "image" | "video") {
    if (!token) return setMsg("Sign in required");
    setBusy(kind === "image" ? "Creating 4 outfit variants…" : "Uploading digital twin + extracting faces…");
    setMsg("");
    try {
      const fd = new FormData();
      fd.append(kind === "image" ? "image" : "video", file);
      fd.append("name", name || file.name);
      const path = kind === "image" ? "/api/avatar/create-from-image" : "/api/avatar/create-from-video";
      const res = await fetch(`${getApiBase()}${path}`, {
        method: "POST",
        headers: authHeaders,
        body: fd,
      });
      const j = await readJson<{
        frames?: ExtractFrame[];
        sourceUrl?: string;
        outfitVariants?: OutfitVariant[];
        avatarId?: string;
      }>(res);
      if (Array.isArray(j.frames) && j.frames.length) {
        setExtractFrames(j.frames);
        setExtractMeta({
          title: file.name,
          sourceLabel: "Uploaded video",
          sourceVideoUrl: j.sourceUrl,
          suggestedName: name || file.name,
        });
        setPickedFrame(j.frames[Math.floor(j.frames.length / 2)] || j.frames[0]);
      }
      setMsg(`Avatar ready · ${j.outfitVariants?.length || 0} outfit slots on R2`);
      setTab("mine");
      setGuideIdx(1);
      await load();
      if (j.avatarId) await selectAvatarById(j.avatarId);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onExtractFromLink() {
    if (!token) return setMsg("Sign in required");
    if (!linkUrl.trim()) return setMsg("Paste a YouTube, Instagram, TikTok, or social video URL.");
    setBusy("Downloading link + extracting character stills…");
    setMsg("");
    setExtractFrames([]);
    setPickedFrame(null);
    setExtractMeta(null);
    try {
      const res = await fetch(`${getApiBase()}/api/avatar/extract-from-url`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkUrl.trim(), name, count: 8 }),
      });
      const j = await readJson<{
        frames?: ExtractFrame[];
        title?: string;
        sourceLabel?: string;
        sourceVideoUrl?: string;
        suggestedName?: string;
      }>(res);
      const frames = (j.frames || []) as ExtractFrame[];
      setExtractFrames(frames);
      setExtractMeta({
        title: j.title,
        sourceLabel: j.sourceLabel,
        sourceVideoUrl: j.sourceVideoUrl,
        suggestedName: j.suggestedName || name,
      });
      if (j.suggestedName && (!name || name === "Tobi Twin")) setName(j.suggestedName);
      setPickedFrame(frames[Math.floor(frames.length / 2)] || frames[0] || null);
      setMsg(
        `${j.sourceLabel || "Video"} · ${frames.length} character stills — pick a face → Rebuild as avatar`,
      );
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onRebuildFromFrame() {
    if (!token) return setMsg("Sign in required");
    if (!pickedFrame) return setMsg("Pick a character still first");
    setBusy("Rebuilding avatar from selected still…");
    setMsg("");
    try {
      const res = await fetch(`${getApiBase()}/api/avatar/create-from-frame`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          frameUrl: pickedFrame.r2Url,
          frameKey: pickedFrame.key,
          name: name || extractMeta?.suggestedName || "Link Twin",
          sourceVideoUrl: extractMeta?.sourceVideoUrl,
        }),
      });
      const j = await readJson<{ outfitVariants?: OutfitVariant[]; avatarId?: string }>(res);
      setMsg(`Avatar rebuilt from still · ${j.outfitVariants?.length || 0} outfit slots`);
      setTab("mine");
      setGuideIdx(1);
      await load();
      if (j.avatarId) await selectAvatarById(j.avatarId);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onScript() {
    if (!token) return setMsg("Sign in required");
    setBusy("Writing 30s script with Ollama…");
    setMsg("");
    try {
      const res = await fetch(`${getApiBase()}/api/avatar/script`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ niche, templateSlug, localNews, customScript: script || undefined }),
      });
      const j = await readJson<{ script?: string }>(res);
      setScript(j.script || "");
      setGuideIdx(2);
      setMsg("Script ready — edit if needed, then Generate");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onGenerate() {
    if (!token) return setMsg("Sign in required");
    if (!selectedAvatar) return setMsg("Pick an avatar first");
    setBusy("Generating → R2 (photo+TTS if GPU host is full)…");
    setMsg("");
    setResultUrl(null);
    try {
      const res = await fetch(`${getApiBase()}/api/avatar/generate`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarId: selectedAvatar.id,
          variantId,
          niche,
          templateSlug,
          localNews,
          customScript: script || undefined,
          fingerprint: webFingerprint(),
        }),
      });
      const j = await readJson<{
        r2_url?: string;
        prompt?: string;
        real_r2?: boolean;
        engine?: string;
        rtcSpent?: number;
        note?: string;
      }>(res);
      setResultUrl(j.r2_url || null);
      setScript(j.prompt || script);
      setGuideIdx(3);
      setMsg(
        `real_r2=${j.real_r2} · ${j.engine} · spent ${j.rtcSpent} RTC${j.note ? ` · ${j.note}` : ""}`,
      );
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const activeTemplate = templates.find((t) => t.slug === templateSlug);
  const variants = selectedAvatar?.outfitVariants || [];

  if (loading) {
    return <div className="p-8 text-white/50 mono text-sm">Loading auth…</div>;
  }

  return (
    <div className="max-w-[1400px] space-y-5 forge-in">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="mono text-[11px] text-cyan mb-2">MODEL CENTER // AVATAR STUDIO</div>
          <h1 className="display text-4xl md:text-5xl">
            Fresh daily look <span className="text-cyan">without filming</span>
          </h1>
          <p className="mt-3 text-white/60 max-w-2xl text-[15px]">
            MissTechy workflow inside ReelStorm — 1 photo → 4 outfits → niche script →{" "}
            <span className="text-cyan">videos.reelstorm.uk</span>. Sound Studio owns voice; STORM Guide coaches each step.
          </p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-2">
          <PodStatusIndicator />
          <div className="flex flex-wrap gap-2">
            <Link href="/model-center" className="h-10 px-4 rounded-rs border border-white/15 text-sm grid place-items-center">
              API keys
            </Link>
            <Link href="/studio-set" className="h-10 px-4 rounded-rs bg-cyan text-black font-bold text-sm grid place-items-center">
              Open Studio Set
            </Link>
            <Link href="/wizard" className="h-10 px-4 rounded-rs border border-violet/40 text-violet-soft text-sm grid place-items-center">
              BOT Director
            </Link>
          </div>
        </div>
      </div>

      {!user && (
        <div className="rounded-rs-xl border border-orange/40 bg-orange/10 px-4 py-3 text-sm">
          Sign in to upload avatars and generate.{" "}
          <Link href="/login" className="text-cyan underline">
            Enter the storm →
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={clsx(
              "h-9 px-4 rounded-rs mono text-[10px] border",
              tab === t.id ? "border-cyan/50 bg-cyan/15 text-cyan" : "border-white/10 text-white/50",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid xl:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-5">
          {tab === "create" && (
            <div className="rounded-rs-xl border border-white/[0.08] bg-panel p-6 space-y-5">
              <div className="mono text-[10px] text-violet-soft">
                CREATE · PHOTO · VIDEO · YOUTUBE / SOCIAL LINK
              </div>
              <label className="block">
                <span className="mono text-[10px] text-white/40">AVATAR NAME</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full h-11 rounded-rs bg-void border border-white/10 px-3"
                />
              </label>
              <div className="grid md:grid-cols-2 gap-4">
                <label className="rounded-rs border border-dashed border-cyan/40 bg-cyan/5 p-8 text-center cursor-pointer hover:bg-cyan/10 transition">
                  <div className="display text-xl text-cyan">Upload photo</div>
                  <p className="text-xs text-white/45 mt-2">Front face → 4 outfit variants on R2</p>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onUpload(f, "image");
                    }}
                  />
                </label>
                <label className="rounded-rs border border-dashed border-violet/40 bg-violet/10 p-8 text-center cursor-pointer hover:bg-violet/15 transition">
                  <div className="display text-xl text-violet-soft">Upload video twin</div>
                  <p className="text-xs text-white/45 mt-2">Talking head → extract faces → twin source</p>
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onUpload(f, "video");
                    }}
                  />
                </label>
              </div>

              <div className="rounded-rs border border-[#00f0ff]/30 bg-[#00f0ff]/5 p-4 space-y-3">
                <div className="mono text-[10px] text-[#00f0ff] tracking-[0.14em]">
                  OR PASTE YOUTUBE / INSTAGRAM / TIKTOK / SOCIAL
                </div>
                <p className="text-[12px] text-white/50">
                  We download the reel, extract character stills, then rebuild your Avatar Studio twin from the face you pick.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=… or instagram.com/reel/…"
                    className="flex-1 h-11 rounded-rs bg-void border border-white/10 px-3 text-[13px]"
                  />
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void onExtractFromLink()}
                    className="h-11 px-5 rounded-rs bg-[#00f0ff] text-black font-bold text-[13px] disabled:opacity-50 shrink-0"
                  >
                    Extract characters
                  </button>
                </div>
              </div>

              {extractFrames.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="mono text-[10px] text-orange tracking-[0.12em]">
                      CHARACTER STILLS · {extractMeta?.sourceLabel || "VIDEO"}
                      {extractMeta?.title ? ` · ${extractMeta.title.slice(0, 40)}` : ""}
                    </div>
                    <button
                      type="button"
                      disabled={!pickedFrame || Boolean(busy)}
                      onClick={() => void onRebuildFromFrame()}
                      className="h-10 px-4 rounded-rs bg-orange text-black font-bold text-[12px] disabled:opacity-50"
                    >
                      Rebuild as avatar
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {extractFrames.map((f) => {
                      const active = pickedFrame?.key === f.key;
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => setPickedFrame(f)}
                          className={clsx(
                            "relative aspect-[3/4] rounded-rs overflow-hidden border bg-void",
                            active ? "border-orange ring-1 ring-orange" : "border-white/10 hover:border-white/30",
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={f.r2Url} alt={`Frame ${f.index}`} className="w-full h-full object-cover" />
                          <span className="absolute bottom-1 left-1 mono text-[9px] px-1.5 py-0.5 rounded bg-black/70 text-white/80">
                            {f.time}s
                          </span>
                          {active && (
                            <span className="absolute top-1 right-1 mono text-[8px] px-1.5 py-0.5 rounded bg-orange text-black font-bold">
                              PICK
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[12px] text-white/45">
                    Pick the clearest face, then <span className="text-orange">Rebuild as avatar</span> to lock 4 outfit slots.
                  </p>
                </div>
              )}
            </div>
          )}

          {(tab === "mine" || tab === "stock") && (
            <div className="space-y-4">
              <div className="mono text-[10px] text-cyan">
                {tab === "mine" ? "MY AVATARS · FRESH DAILY LOOK" : "STOCK AVATARS"}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {(tab === "mine" ? avatars : stock).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setSelectedAvatar(a);
                      setVariantId(a.outfitVariants?.[0]?.id || "red-bomber");
                      setTab("templates");
                      setGuideIdx(1);
                    }}
                    className={clsx(
                      "rounded-rs-xl border p-4 text-left space-y-3",
                      selectedAvatar?.id === a.id ? "border-cyan/50 bg-cyan/10" : "border-white/10 bg-panel",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold">{a.name}</div>
                      <span className="mono text-[9px] text-white/40">{a.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(a.outfitVariants || []).slice(0, 4).map((v) => (
                        <div key={v.id} className="aspect-[3/4] rounded-rs overflow-hidden bg-void border border-white/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={v.thumbUrl} alt={v.name} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
                {tab === "mine" && !avatars.length && (
                  <p className="text-sm text-white/45 col-span-full">No avatars yet — Create Avatar with one photo.</p>
                )}
                {tab === "stock" && !stock.length && (
                  <p className="text-sm text-white/45 col-span-full">
                    Stock pack empty — personal uploads appear under My Avatars. Seed more STOCK rows later.
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === "templates" && (
            <div className="grid lg:grid-cols-2 gap-4">
              {templates.map((t) => (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => {
                    setTemplateSlug(t.slug);
                    setGuideIdx(2);
                  }}
                  className={clsx(
                    "rounded-rs-xl border p-4 text-left space-y-2",
                    templateSlug === t.slug ? "border-orange/50 bg-orange/10" : "border-white/10 bg-panel",
                  )}
                >
                  <div className="mono text-[9px] text-orange">{t.category} · {t.rtcCost} RTC · {t.duration}s</div>
                  <div className="font-bold text-lg">{t.name}</div>
                  <p className="text-xs text-white/50">{t.hookTemplate}</p>
                  <div className="mono text-[9px] text-white/35">0:00 hook → 0:20 insight → 0:30 CTA</div>
                </button>
              ))}
            </div>
          )}

          {/* Live engine */}
          <div className="rounded-rs-xl border border-white/[0.08] bg-deep p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="mono text-[10px] text-cyan flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan live-dot" />
                LIVE ENGINE · AVATAR GENERATE
              </div>
              {activeTemplate && (
                <span className="mono text-[9px] text-white/40">{activeTemplate.slug}</span>
              )}
            </div>

            {selectedAvatar && (
              <div>
                <div className="mono text-[9px] text-white/40 mb-2">
                  VARIANT · {selectedAvatar.name}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVariantId(v.id)}
                      className={clsx(
                        "rounded-rs border overflow-hidden text-left",
                        variantId === v.id ? "border-cyan" : "border-white/10",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.thumbUrl} alt={v.name} className="aspect-[3/4] w-full object-cover bg-void" />
                      <div className="px-2 py-1.5 mono text-[9px]">{v.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              <label className="block">
                <span className="mono text-[10px] text-white/40">NICHE</span>
                <select
                  value={niche}
                  onChange={(e) => setNiche(e.target.value as (typeof NICHES)[number])}
                  className="mt-1 w-full h-11 rounded-rs bg-void border border-white/10 px-3"
                >
                  {NICHES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mono text-[10px] text-white/40">LOCAL NEWS / UPDATE</span>
                <input
                  value={localNews}
                  onChange={(e) => setLocalNews(e.target.value)}
                  className="mt-1 w-full h-11 rounded-rs bg-void border border-white/10 px-3"
                  placeholder="Waymo robotaxi…"
                />
              </label>
            </div>

            <label className="block">
              <span className="mono text-[10px] text-white/40">30-SEC SCRIPT</span>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={5}
                className="mt-1 w-full rounded-rs bg-void border border-white/10 px-3 py-2 text-sm"
                placeholder="Generate Script fills this from Ollama / template prompt…"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void onScript()}
                className="h-11 px-5 rounded-rs border border-cyan/40 text-cyan font-bold text-sm disabled:opacity-40"
              >
                Generate Script
              </button>
              <button
                type="button"
                disabled={Boolean(busy) || !selectedAvatar}
                onClick={() => void onGenerate()}
                className="h-11 px-5 rounded-rs bg-violet text-white font-bold text-sm disabled:opacity-40"
              >
                Generate → R2
              </button>
              {resultUrl && (
                <button
                  type="button"
                  onClick={() => router.push(`/studio-set?avatarVideo=${encodeURIComponent(resultUrl)}`)}
                  className="h-11 px-5 rounded-rs bg-cyan text-black font-bold text-sm"
                >
                  Send to Studio Set
                </button>
              )}
            </div>

            {busy && <div className="mono text-[11px] text-orange">{busy}</div>}
            {msg && <div className="text-sm text-white/70 break-all">{msg}</div>}

            {resultUrl && (
              <div className="space-y-2">
                <a href={resultUrl} target="_blank" rel="noreferrer" className="mono text-[11px] text-cyan break-all">
                  {resultUrl}
                </a>
                <video src={resultUrl} controls className="w-full max-w-md rounded-rs border border-white/10 bg-black" />
              </div>
            )}
          </div>
        </div>

        {/* Active AI assistance bot */}
        <aside className="rounded-rs-xl border border-violet/30 bg-panel/80 overflow-hidden h-fit xl:sticky xl:top-20">
          <button
            type="button"
            onClick={() => setGuideOpen((o) => !o)}
            className="w-full h-12 px-4 flex items-center justify-between bg-violet/20 border-b border-violet/30"
          >
            <span className="mono text-[10px] text-violet-soft flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-black/30 grid place-items-center text-[9px]">AI</span>
              AVATAR COACH
            </span>
            <span className="text-white/40 text-xs">{guideOpen ? "▾" : "▸"}</span>
          </button>
          {guideOpen && (
            <div className="p-4 space-y-4">
              <p className="text-sm text-white/70">
                I&apos;ll walk you through the MissTechy funnel — strategist mindset, not creator burnout.
              </p>
              <div className="space-y-2">
                {GUIDE_STEPS.map((s, i) => (
                  <button
                    key={s.n}
                    type="button"
                    onClick={() => {
                      setGuideIdx(i);
                      if (i === 0) setTab("create");
                      if (i === 1) setTab("templates");
                    }}
                    className={clsx(
                      "w-full text-left rounded-rs border px-3 py-2.5",
                      guideIdx === i ? "border-cyan/40 bg-cyan/10" : "border-white/10",
                    )}
                  >
                    <div className="mono text-[9px] text-orange">{s.n} · {s.title}</div>
                    <div className="text-xs text-white/55 mt-1">{s.tip}</div>
                  </button>
                ))}
              </div>
              <div className="rounded-rs border border-white/10 bg-void p-3 space-y-2">
                <div className="mono text-[9px] text-cyan">QUICK JUMPS</div>
                <div className="flex flex-col gap-1.5 text-sm">
                  <button type="button" className="text-left text-white/70 hover:text-cyan" onClick={() => setTab("create")}>
                    → Upload photo (4 outfits)
                  </button>
                  <button type="button" className="text-left text-white/70 hover:text-cyan" onClick={() => setTab("templates")}>
                    → Pick News Update Authority
                  </button>
                  <button type="button" className="text-left text-white/70 hover:text-cyan" onClick={() => void onScript()}>
                    → Write script (Ollama)
                  </button>
                  <Link href="/sound-studio" className="text-white/70 hover:text-cyan">
                    → Sound Studio voice OS
                  </Link>
                  <Link href="/studio-set" className="text-white/70 hover:text-cyan">
                    → Drop result into Studio Set
                  </Link>
                </div>
              </div>
              <p className="text-[11px] text-white/40">
                Global STORM Guide (bottom-right) also knows this page — ask anything about RTC, R2, or templates.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
