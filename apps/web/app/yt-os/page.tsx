"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { api } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";
import { openStormGuide } from "@/components/guide/PageStartCoach";

const NICHES = ["Real Estate", "Health", "Finance", "AI", "Coaching"] as const;

type Channel = {
  id: string;
  title: string;
  niche: string | null;
  isConnected: boolean;
  youtubeChannelId: string | null;
};

type WinningTopic = {
  id: string;
  title: string;
  audienceGap: string;
  competitorSaturation: string;
  winningScore: number;
  hook?: string;
  estimatedViews?: number;
  ranking?: number;
};

type Thumb = {
  id: string;
  label: string;
  text?: string;
  r2Url: string;
  ctrPredicted?: number;
  abTest?: boolean;
};

type VideoState = {
  id: string;
  title: string;
  status: string;
  scriptJson?: {
    hook?: string;
    intro?: string;
    beats?: Array<{ day: number; title: string; time?: string }>;
    cta?: string;
    fullScript?: string;
  } | null;
  thumbnailVariants?: Thumb[] | null;
  selectedThumbnailId?: string | null;
  seoJson?: {
    targetKeywords?: Array<{ keyword: string; vol: string; comp: string; intent: string }>;
    titles?: string[];
    description?: string;
    tags?: string[];
    onPageChecklist?: Array<{ item: string; ok: boolean }>;
  } | null;
  productionJson?: {
    narrationUrl?: string;
    imageAssets?: Array<{ name: string; r2Url: string }>;
    timeline?: Array<{ time: string; asset: string; note?: string }>;
    finalVideoUrl?: string;
    avatarVariantName?: string;
  } | null;
  publishingJson?: {
    youtubeVideoId?: string;
    uploadStatus?: string;
    scheduledAt?: string;
    visibility?: string;
  } | null;
  analyticsJson?: {
    views?: number;
    ctr?: number;
    avgViewDuration?: number;
    likes?: number;
    subsGained?: number;
    vsChannelAvg?: Record<string, string>;
    signal?: Record<string, string>;
    insightsFedBack?: string[];
  } | null;
  r2FinalUrl?: string | null;
};

const AGENTS = [
  { id: "STRATEGY", label: "01 Strategy", color: "text-cyan" },
  { id: "SCRIPT", label: "02 Script", color: "text-violet-soft" },
  { id: "THUMBNAIL", label: "03 Thumb", color: "text-orange" },
  { id: "SEO", label: "04 SEO", color: "text-cyan" },
  { id: "PRODUCTION", label: "05 Prod", color: "text-violet-soft" },
  { id: "PUBLISHING", label: "06 Publish", color: "text-orange" },
  { id: "ANALYTICS", label: "07 Analytics", color: "text-cyan" },
] as const;

function statusToProgress(status?: string) {
  const order = [
    "STRATEGY",
    "SCRIPTING",
    "THUMBNAIL",
    "SEO",
    "PRODUCTION",
    "PUBLISHING",
    "PUBLISHED",
    "ANALYTICS",
  ];
  const i = order.indexOf(status || "STRATEGY");
  return Math.round(((Math.max(i, 0) + 1) / order.length) * 100);
}

function YtOsInner() {
  const { user } = useAuth();
  const [niche, setNiche] = useState<(typeof NICHES)[number]>("AI");
  const [channel, setChannel] = useState<Channel | null>(null);
  const [winningTopics, setWinningTopics] = useState<WinningTopic[]>([]);
  const [sampleCalendar, setSampleCalendar] = useState<
    Array<{ day: number; date: string; type: string; title: string }>
  >([]);
  const [video, setVideo] = useState<VideoState | null>(null);
  const [feedback, setFeedback] = useState<{
    contentCalendarUpdate?: string;
    thumbnailAgentNotify?: string;
    weeklyTrendSummary?: string;
  } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState("");
  const [variantId, setVariantId] = useState("red-bomber");
  const [balanceHint, setBalanceHint] = useState<number | null>(null);

  const log = useCallback((line: string) => {
    setLogs((prev) => [`${new Date().toLocaleTimeString()} · ${line}`, ...prev].slice(0, 40));
  }, []);

  useEffect(() => {
    api<{ channels: Channel[]; videos: VideoState[] }>("/api/youtube/list")
      .then((d) => {
        if (d.channels[0]) setChannel(d.channels[0]);
        if (d.videos[0]) setVideo(d.videos[0]);
      })
      .catch(() => undefined);
  }, []);

  async function connectChannel() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api<{ channel: Channel }>("/api/youtube/channel/connect", {
        method: "POST",
        body: JSON.stringify({ niche, title: `${niche} Automation`, ownerEmail: user?.email, mock: true }),
      });
      setChannel(res.channel);
      log(`Channel connected · ${res.channel.title}`);
      setMsg("Channel connected (mock OK — add YOUTUBE_CLIENT_ID for live OAuth)");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runStrategy() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api<{
        videoId: string;
        channelId: string;
        winningTopics: WinningTopic[];
        sampleCalendar: Array<{ day: number; date: string; type: string; title: string }>;
      }>("/api/youtube/strategy/analyze", {
        method: "POST",
        body: JSON.stringify({
          channelId: channel?.id,
          niche,
          ownerEmail: user?.email,
        }),
      });
      if (!channel) {
        const list = await api<{ channels: Channel[] }>("/api/youtube/list");
        setChannel(list.channels.find((c) => c.id === res.channelId) || list.channels[0] || null);
      }
      setWinningTopics(res.winningTopics || []);
      setSampleCalendar(res.sampleCalendar || []);
      const v = await api<{ video: VideoState }>(`/api/youtube/video/${res.videoId}`);
      setVideo(v.video);
      log(`Strategy · ${res.winningTopics?.length || 0} winning topics`);
      setMsg("Winning Topics Identified");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function pickTopic(title: string) {
    if (!video?.id) {
      setMsg("Run Strategy first");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ scriptJson: VideoState["scriptJson"]; videoId: string }>(
        "/api/youtube/script/generate",
        {
          method: "POST",
          body: JSON.stringify({
            videoId: video.id,
            hookStyle: "unknown-to-expert",
            localNews: `${niche} local update`,
            ownerEmail: user?.email,
          }),
        },
      );
      const v = await api<{ video: VideoState }>(`/api/youtube/video/${res.videoId}`);
      setVideo({ ...v.video, title });
      log(`Script · ${title}`);
      setMsg("Script generated");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runThumbs() {
    if (!video?.id) return;
    setBusy(true);
    try {
      await api("/api/youtube/thumbnail/generate", {
        method: "POST",
        body: JSON.stringify({ videoId: video.id, variants: 3, ownerEmail: user?.email }),
      });
      const v = await api<{ video: VideoState }>(`/api/youtube/video/${video.id}`);
      setVideo(v.video);
      log("Thumbnails · 3 variants on R2");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runSeo() {
    if (!video?.id) return;
    setBusy(true);
    try {
      await api("/api/youtube/seo/optimize", {
        method: "POST",
        body: JSON.stringify({ videoId: video.id, ownerEmail: user?.email }),
      });
      const v = await api<{ video: VideoState }>(`/api/youtube/video/${video.id}`);
      setVideo(v.video);
      log("SEO · keywords + tags");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runProduction() {
    if (!video?.id) return;
    setBusy(true);
    try {
      const res = await api<{ r2FinalUrl: string }>("/api/youtube/production/assemble", {
        method: "POST",
        body: JSON.stringify({
          videoId: video.id,
          avatarId: avatarId || undefined,
          variantId,
          ownerEmail: user?.email,
        }),
      });
      const v = await api<{ video: VideoState }>(`/api/youtube/video/${video.id}`);
      setVideo(v.video);
      log(`Production · ${res.r2FinalUrl}`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runPublish() {
    if (!video?.id) return;
    setBusy(true);
    try {
      await api("/api/youtube/publish/upload", {
        method: "POST",
        body: JSON.stringify({
          videoId: video.id,
          visibility: "private",
          ownerEmail: user?.email,
        }),
      });
      const v = await api<{ video: VideoState }>(`/api/youtube/video/${video.id}`);
      setVideo(v.video);
      log("Publishing · scheduled");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runAnalytics() {
    if (!video?.id) return;
    setBusy(true);
    try {
      const res = await api<{
        analyticsJson: VideoState["analyticsJson"];
        feedback: typeof feedback;
      }>("/api/youtube/analytics/sync", {
        method: "POST",
        body: JSON.stringify({ videoId: video.id, ownerEmail: user?.email }),
      });
      const v = await api<{ video: VideoState }>(`/api/youtube/video/${video.id}`);
      setVideo(v.video);
      setFeedback(res.feedback);
      log("Analytics · feedback loop updated calendar");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runOrchestrator() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api<{
        videoId: string;
        channelId: string;
        r2FinalUrl?: string;
        pipeline?: {
          strategy?: { winningTopics?: WinningTopic[]; sampleCalendar?: typeof sampleCalendar };
          analytics?: { feedback?: typeof feedback };
        };
      }>("/api/youtube/orchestrator/run", {
        method: "POST",
        body: JSON.stringify({
          channelId: channel?.id,
          niche,
          auto: true,
          avatarId: avatarId || undefined,
          variantId,
          ownerEmail: user?.email,
        }),
      });
      const list = await api<{ channels: Channel[] }>("/api/youtube/list");
      setChannel(list.channels.find((c) => c.id === res.channelId) || list.channels[0] || null);
      setWinningTopics(res.pipeline?.strategy?.winningTopics || []);
      setSampleCalendar(res.pipeline?.strategy?.sampleCalendar || []);
      setFeedback(res.pipeline?.analytics?.feedback || null);
      const v = await api<{ video: VideoState }>(`/api/youtube/video/${res.videoId}`);
      setVideo(v.video);
      log(`Orchestrator complete · ${res.r2FinalUrl || "done"}`);
      setMsg("7-agent pipeline complete — 20 RTC");
      setBalanceHint((b) => (b == null ? 268 : Math.max(0, b - 20)));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const progress = statusToProgress(video?.status);
  const thumbs = (video?.thumbnailVariants || []) as Thumb[];
  const seo = video?.seoJson;
  const script = video?.scriptJson;
  const prod = video?.productionJson;
  const pub = video?.publishingJson;
  const analytics = video?.analyticsJson;

  return (
    <div className="max-w-[1400px] mx-auto forge-in space-y-5 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="mono text-[11px] text-cyan mb-2 tracking-[0.14em]">
            YOUTUBE AUTOMATION OS // 7 AGENTS
          </div>
          <h1 className="display text-3xl md:text-5xl">
            Without filming.{" "}
            <span className="bg-storm bg-clip-text text-transparent">Autonomous loop.</span>
          </h1>
          <p className="mt-2 text-white/55 text-sm max-w-2xl">
            Ray&apos;s 7 agents + MissTechy Avatar Studio · Strategy → Script → Thumb → SEO →
            Production → Publish → Analytics → feedback.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value as (typeof NICHES)[number])}
            className="h-10 rounded-rs bg-void border border-white/15 px-3 text-sm"
          >
            {NICHES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={connectChannel}
            className="h-10 px-3 rounded-rs border border-cyan/40 text-cyan text-sm font-bold"
          >
            {channel ? "Reconnect" : "Connect YouTube"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={runOrchestrator}
            className="h-10 px-4 rounded-rs bg-orange text-black text-sm font-bold disabled:opacity-40"
          >
            {busy ? "Running…" : "Run 1→7 Orchestrator"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {AGENTS.map((a) => (
          <div
            key={a.id}
            className={clsx(
              "mono text-[10px] px-2.5 py-1.5 rounded-full border",
              video?.status?.includes(a.id.slice(0, 4)) || video?.status === a.id
                ? "border-cyan/50 bg-cyan/10 text-cyan"
                : "border-white/10 text-white/40",
            )}
          >
            {a.label}
          </div>
        ))}
        <div className="mono text-[10px] text-white/40 ml-auto">
          {channel ? `${channel.title} · ${channel.niche || niche}` : "No channel"} · 20 RTC/video
          {balanceHint != null ? ` · ~${balanceHint} RTC left` : ""}
        </div>
      </div>

      {msg && (
        <div className="rounded-rs border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70">
          {msg}
        </div>
      )}

      <div className="grid xl:grid-cols-[1fr_280px] gap-5">
        <div className="space-y-4">
          {/* Strategy */}
          <section className="rounded-rs-xl border border-cyan/25 bg-panel/80 p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <div className="mono text-[10px] text-cyan">CONTENT STRATEGY AGENT</div>
                <div className="display text-lg">Winning Topics Identified</div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={runStrategy}
                className="h-9 px-3 rounded-rs bg-cyan text-black text-xs font-bold"
              >
                Analyze trends
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <ul className="space-y-2">
                {(winningTopics.length
                  ? winningTopics
                  : [
                      {
                        id: "x",
                        title: "Run Analyze to load topics",
                        audienceGap: "—",
                        competitorSaturation: "—",
                        winningScore: 0,
                      },
                    ]
                ).map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => pickTopic(t.title)}
                      className="w-full text-left rounded-rs border border-white/10 px-3 py-2 hover:border-cyan/40"
                    >
                      <div className="text-sm font-semibold">{t.title}</div>
                      <div className="mono text-[9px] text-white/40 mt-1">
                        Gap {t.audienceGap} · Sat {t.competitorSaturation} · Score {t.winningScore}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <div>
                <div className="mono text-[9px] text-white/40 mb-2">2-WEEK SAMPLE CALENDAR</div>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {sampleCalendar.slice(0, 14).map((d) => (
                    <div
                      key={d.day}
                      className="flex justify-between gap-2 text-[11px] border-b border-white/[0.04] py-1"
                    >
                      <span className="text-white/50">
                        D{d.day} · {d.date}
                      </span>
                      <span className="truncate text-white/80">
                        {d.type} · {d.title}
                      </span>
                    </div>
                  ))}
                  {!sampleCalendar.length && (
                    <div className="text-white/35 text-sm">Calendar appears after Strategy.</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Script */}
          <section className="rounded-rs-xl border border-violet/30 bg-panel/80 p-4">
            <div className="mono text-[10px] text-violet-soft">SCRIPT WRITING AGENT</div>
            <div className="display text-lg mb-3">HOOK · INTRO · BEATS · CTA</div>
            {script ? (
              <div className="space-y-2 text-sm text-white/75">
                <div>
                  <span className="text-orange font-bold">HOOK (0:00-0:15)</span>
                  <p className="mt-1">{script.hook}</p>
                </div>
                <div>
                  <span className="text-cyan font-bold">INTRO (0:15-1:00)</span>
                  <p className="mt-1">{script.intro}</p>
                </div>
                <ol className="grid sm:grid-cols-2 gap-2">
                  {(script.beats || []).map((b) => (
                    <li key={b.day} className="rounded-rs border border-white/10 px-2 py-1.5 text-[12px]">
                      Day {b.day}: {b.title}
                    </li>
                  ))}
                </ol>
                <div className="text-orange font-semibold">CTA: {script.cta}</div>
              </div>
            ) : (
              <p className="text-white/40 text-sm">Pick a winning topic to generate script.</p>
            )}
          </section>

          {/* Thumbnail */}
          <section className="rounded-rs-xl border border-orange/30 bg-panel/80 p-4">
            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="mono text-[10px] text-orange">THUMBNAIL DESIGNER AGENT</div>
                <div className="display text-lg">A/B variants · CTR prediction</div>
              </div>
              <button
                type="button"
                disabled={busy || !video?.id}
                onClick={runThumbs}
                className="h-9 px-3 rounded-rs bg-orange text-black text-xs font-bold"
              >
                Generate 3
              </button>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {thumbs.map((t) => (
                <a
                  key={t.id}
                  href={t.r2Url}
                  target="_blank"
                  rel="noreferrer"
                  className={clsx(
                    "rounded-rs border overflow-hidden",
                    video?.selectedThumbnailId === t.id ? "border-cyan" : "border-white/10",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.r2Url} alt={t.label} className="w-full aspect-video object-cover bg-void" />
                  <div className="p-2 text-[11px]">
                    <div className="font-semibold">{t.label}</div>
                    <div className="mono text-white/40">CTR ~{t.ctrPredicted?.toFixed(1)}%</div>
                  </div>
                </a>
              ))}
              {!thumbs.length && (
                <div className="text-white/40 text-sm col-span-3">I FIRED MYSELF · AI RAN MY LIFE · NO MORE DECISIONS</div>
              )}
            </div>
          </section>

          {/* SEO */}
          <section className="rounded-rs-xl border border-white/10 bg-panel/80 p-4">
            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="mono text-[10px] text-cyan">SEO OPTIMIZER AGENT</div>
                <div className="display text-lg">Keywords · titles · tags</div>
              </div>
              <button
                type="button"
                disabled={busy || !video?.id}
                onClick={runSeo}
                className="h-9 px-3 rounded-rs border border-cyan/40 text-cyan text-xs font-bold"
              >
                Optimize
              </button>
            </div>
            {seo ? (
              <div className="space-y-3 text-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead className="text-white/40 mono text-[9px]">
                      <tr>
                        <th className="py-1">Keyword</th>
                        <th>Vol</th>
                        <th>Comp</th>
                        <th>Intent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(seo.targetKeywords || []).map((k) => (
                        <tr key={k.keyword} className="border-t border-white/[0.06]">
                          <td className="py-1.5">{k.keyword}</td>
                          <td>{k.vol}</td>
                          <td>{k.comp}</td>
                          <td>{k.intent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(seo.tags || []).slice(0, 20).map((tag) => (
                    <span key={tag} className="mono text-[9px] px-2 py-1 rounded-full bg-white/[0.05] border border-white/10">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-white/40 text-sm">Run SEO after thumbnails.</p>
            )}
          </section>

          {/* Production */}
          <section className="rounded-rs-xl border border-violet/25 bg-panel/80 p-4">
            <div className="flex flex-wrap justify-between gap-2 mb-3">
              <div>
                <div className="mono text-[10px] text-violet-soft">PRODUCTION AGENT</div>
                <div className="display text-lg">Avatar · VO · B-roll · R2</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={avatarId}
                  onChange={(e) => setAvatarId(e.target.value)}
                  placeholder="avatarId (optional)"
                  className="h-9 w-40 rounded-rs bg-void border border-white/15 px-2 text-xs"
                />
                <select
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                  className="h-9 rounded-rs bg-void border border-white/15 px-2 text-xs"
                >
                  <option value="red-bomber">Red Bomber</option>
                  <option value="navy-suit">Navy Suit</option>
                  <option value="pink-gym">Pink Gym</option>
                  <option value="trench-hat">Trench + Hat</option>
                </select>
                <Link
                  href="/model-center/avatar"
                  className="h-9 px-3 rounded-rs border border-orange/40 text-orange text-xs font-bold grid place-items-center"
                >
                  Use My Avatar Twin
                </Link>
                <button
                  type="button"
                  disabled={busy || !video?.id}
                  onClick={runProduction}
                  className="h-9 px-3 rounded-rs bg-violet text-white text-xs font-bold"
                >
                  Assemble
                </button>
              </div>
            </div>
            {prod ? (
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-2 text-[12px] text-white/70">
                  <div>Narration: {prod.narrationUrl}</div>
                  <div>Variant: {prod.avatarVariantName || variantId}</div>
                  <ul className="space-y-1">
                    {(prod.timeline || []).map((t) => (
                      <li key={t.time}>
                        {t.time} · {t.asset} {t.note ? `— ${t.note}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  {(video?.r2FinalUrl || prod.finalVideoUrl) && (
                    <video
                      controls
                      className="w-full rounded-rs border border-white/10 bg-black aspect-video"
                      src={video?.r2FinalUrl || prod.finalVideoUrl}
                    />
                  )}
                  <div className="grid grid-cols-4 gap-1 mt-2">
                    {(prod.imageAssets || []).map((a) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={a.name} src={a.r2Url} alt={a.name} className="rounded border border-white/10 aspect-video object-cover" />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-white/40 text-sm">Assemble final video to videos.reelstorm.uk/videos/youtube/…</p>
            )}
          </section>

          {/* Publishing + Analytics */}
          <div className="grid md:grid-cols-2 gap-4">
            <section className="rounded-rs-xl border border-white/10 bg-panel/80 p-4">
              <div className="flex justify-between mb-2">
                <div>
                  <div className="mono text-[10px] text-orange">PUBLISHING AGENT</div>
                  <div className="display text-lg">Upload · schedule</div>
                </div>
                <button
                  type="button"
                  disabled={busy || !video?.id}
                  onClick={runPublish}
                  className="h-9 px-3 rounded-rs border border-orange/40 text-orange text-xs font-bold"
                >
                  Upload
                </button>
              </div>
              {pub ? (
                <div className="text-sm text-white/70 space-y-1">
                  <div>Video ID: {pub.youtubeVideoId}</div>
                  <div>Status: {pub.uploadStatus}</div>
                  <div>Schedule: {pub.scheduledAt}</div>
                  <div>Visibility: {pub.visibility}</div>
                </div>
              ) : (
                <p className="text-white/40 text-sm">YouTube CREATE → Upload / schedule.</p>
              )}
            </section>

            <section className="rounded-rs-xl border border-cyan/20 bg-panel/80 p-4">
              <div className="flex justify-between mb-2">
                <div>
                  <div className="mono text-[10px] text-cyan">ANALYTICS AGENT</div>
                  <div className="display text-lg">Feedback loop</div>
                </div>
                <button
                  type="button"
                  disabled={busy || !video?.id}
                  onClick={runAnalytics}
                  className="h-9 px-3 rounded-rs bg-cyan text-black text-xs font-bold"
                >
                  Sync
                </button>
              </div>
              {analytics ? (
                <div className="text-[12px] space-y-2">
                  <table className="w-full">
                    <tbody>
                      {[
                        ["Views", analytics.views, analytics.vsChannelAvg?.views, analytics.signal?.views],
                        ["CTR", `${analytics.ctr}%`, analytics.vsChannelAvg?.ctr, analytics.signal?.ctr],
                        ["Avg duration", `${analytics.avgViewDuration}s`, analytics.vsChannelAvg?.avgViewDuration, analytics.signal?.avgViewDuration],
                        ["Likes", analytics.likes, analytics.vsChannelAvg?.likes, analytics.signal?.likes],
                        ["Subs", analytics.subsGained, analytics.vsChannelAvg?.subs, analytics.signal?.subs],
                      ].map(([m, v, vs, sig]) => (
                        <tr key={String(m)} className="border-t border-white/[0.06]">
                          <td className="py-1 text-white/50">{m}</td>
                          <td>{v}</td>
                          <td className="text-cyan">{vs}</td>
                          <td className="text-white/60">{sig}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="rounded-rs bg-void/60 border border-white/10 p-2">
                    <div className="mono text-[8px] text-orange mb-1">INSIGHTS FED BACK</div>
                    <ul className="space-y-1 text-white/70">
                      {(analytics.insightsFedBack || []).map((i) => (
                        <li key={i}>→ {i}</li>
                      ))}
                    </ul>
                    {feedback?.weeklyTrendSummary && (
                      <p className="mt-2 text-white/50">{feedback.weeklyTrendSummary}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-white/40 text-sm">Sync after publish for Ray-style metrics.</p>
              )}
            </section>
          </div>
        </div>

        {/* LIVE ENGINE sidebar */}
        <aside className="rounded-rs-xl border border-white/10 bg-deep/80 p-4 h-fit sticky top-20 space-y-4">
          <div className="mono text-[10px] text-cyan tracking-[0.14em]">LIVE ENGINE</div>
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span>Progress</span>
              <span className="text-cyan">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-violet to-cyan" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="text-[12px] text-white/60">
            Status: <span className="text-white">{video?.status || "IDLE"}</span>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {logs.map((l) => (
              <div key={l} className="mono text-[9px] text-white/35 border-b border-white/[0.04] py-1">
                {l}
              </div>
            ))}
            {!logs.length && <div className="text-white/30 text-xs">Agent logs appear here.</div>}
          </div>
          <button
            type="button"
            onClick={() => openStormGuide("Where do I start on YouTube Automation OS?")}
            className="w-full h-9 rounded-rs bg-violet/30 border border-violet/40 text-[11px] font-bold text-violet-soft"
          >
            Ask STORM Guide
          </button>
          <Link href="/yt-os/plan" className="block text-center text-[11px] text-cyan hover:underline">
            Content calendar (/rs-plan)
          </Link>
          <Link href="/wizard" className="block text-center text-[11px] text-white/40 hover:text-cyan">
            BOT Director Wizard
          </Link>
        </aside>
      </div>
    </div>
  );
}

export default function YtOsPage() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="p-8 text-white/40">Loading YT-OS…</div>}>
        <YtOsInner />
      </Suspense>
    </AuthProvider>
  );
}
