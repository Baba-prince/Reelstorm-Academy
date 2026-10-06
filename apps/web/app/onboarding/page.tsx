"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AuthProvider, useAuth } from "@/lib/auth";
import { getApiBase } from "@/lib/api";

type Step = 0 | 1 | 2 | 3 | 4;

const DRAFT_KEY = "rs_onboarding_draft";

const ROLES = [
  { id: "youtuber", label: "YouTuber", blurb: "Series + shorts at ARCHIVE5 pace", accent: "#7C3AED" },
  { id: "artist", label: "Music artist", blurb: "Visuals that match your sound", accent: "#00D9FF" },
  { id: "ads", label: "Ad outlet", blurb: "Product intros that convert", accent: "#FF7A00" },
  { id: "academy", label: "Academy / school", blurb: "White-label training factory", accent: "#C4B5FD" },
];

const REGIONS = [
  { id: "nigeria", label: "Nigeria · Nollywood", flag: "NG" },
  { id: "africa", label: "Wider Africa", flag: "AF" },
  { id: "asia", label: "Asia cinema", flag: "AS" },
  { id: "global", label: "Global mix", flag: "GL" },
];

const TEMPLATES = [
  { id: "nlw-lagos-family-reveal", label: "Lagos Family Reveal", cat: "Nollywood" },
  { id: "nlw-owambe-entrance", label: "Owambe Entrance", cat: "Nollywood" },
  { id: "asia-kdrama-rain-bus", label: "K-Drama Rain Bus", cat: "Asia" },
  { id: "asia-bollywood-item-hook", label: "Bollywood Color Hook", cat: "Asia" },
  { id: "social-music-video", label: "Music Video", cat: "Music" },
  { id: "social-instagram-advert", label: "Instagram Advert", cat: "Ads" },
  { id: "social-tiktok-video", label: "TikTok Video", cat: "Shorts" },
  { id: "social-youtube-clipper", label: "YouTube Clipper Reel", cat: "YouTube" },
];

type Draft = {
  role: string;
  region: string;
  templateId: string;
  tierInterest: "free" | "storm" | "storm_pro";
};

function Wizard() {
  const { user, token, loading, refreshProfile, session } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [role, setRole] = useState("youtuber");
  const [region, setRegion] = useState("nigeria");
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [tierInterest, setTierInterest] = useState<"free" | "storm" | "storm_pro">("storm");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const progress = useMemo(() => ((step + 1) / 5) * 100, [step]);
  const accessToken = session?.access_token || token;

  function saveDraft(): Draft {
    const draft: Draft = { role, region, templateId, tierInterest };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
    return draft;
  }

  async function persistOnboarding(authToken: string, draft: Draft) {
    const res = await fetch(`${getApiBase()}/api/auth/onboarding`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(draft),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Save failed (${res.status})`);
    }
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    await refreshProfile();
    router.replace("/dashboard");
  }

  // Restore draft + auto-finish after login/signup return
  useEffect(() => {
    if (loading) return;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        if (d.role) setRole(d.role);
        if (d.region) setRegion(d.region);
        if (d.templateId) setTemplateId(d.templateId);
        if (d.tierInterest) setTierInterest(d.tierInterest);
        setStep(4);
      }
    } catch {
      /* ignore */
    }
  }, [loading]);

  useEffect(() => {
    if (loading || !accessToken || busy) return;
    let draft: Draft | null = null;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) draft = JSON.parse(raw) as Draft;
    } catch {
      /* ignore */
    }
    if (!draft) return;
    if (user?.onboardingCompleted) {
      sessionStorage.removeItem(DRAFT_KEY);
      router.replace("/dashboard");
      return;
    }
    setBusy(true);
    setMsg("Finishing your storm passport…");
    persistOnboarding(accessToken, draft).catch((e) => {
      setMsg((e as Error).message);
      setBusy(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, accessToken, user?.onboardingCompleted]);

  async function finish() {
    setMsg("");
    const draft = saveDraft();

    if (!accessToken) {
      setMsg("Sign in to seal your passport — choices are saved.");
      router.push(`/signup?next=${encodeURIComponent("/onboarding")}`);
      return;
    }

    setBusy(true);
    setMsg("Saving your storm profile…");
    try {
      await persistOnboarding(accessToken, draft);
    } catch (e) {
      const err = (e as Error).message || "Failed to save";
      // Network / DNS leftovers
      if (/failed to fetch|networkerror|load failed/i.test(err)) {
        setMsg("Connection issue — retry, or sign in again if you are still a guest.");
      } else {
        setMsg(err);
      }
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center mono text-cyan text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          background:
            step === 0
              ? "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,58,237,0.45), transparent 55%)"
              : step === 1
                ? "radial-gradient(ellipse 70% 50% at 20% 30%, rgba(0,217,255,0.25), transparent 50%)"
                : step === 2
                  ? "radial-gradient(ellipse 70% 50% at 80% 20%, rgba(255,122,0,0.28), transparent 50%)"
                  : step === 3
                    ? "radial-gradient(ellipse 60% 50% at 50% 80%, rgba(124,58,237,0.3), transparent 55%)"
                    : "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(255,122,0,0.22), transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-[720px] px-5 py-10 md:py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="mono text-[10px] text-cyan tracking-[0.18em]">ONBOARDING · STORM PASSPORT</div>
            <div className="display text-2xl mt-1">REELSTORM</div>
          </div>
          <div className="text-right text-[12px] text-white/45">
            {user?.email || "Guest"}
            <div className="mono text-[10px] text-white/30 mt-1">STEP {step + 1} / 5</div>
          </div>
        </div>

        <div className="h-1.5 rounded-full bg-white/10 mb-10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet via-cyan to-orange transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {step === 0 && (
          <section className="space-y-6">
            <h1 className="display text-[clamp(2.5rem,8vw,4.5rem)] leading-[0.9]">
              Your factory
              <br />
              <span className="text-orange">starts here.</span>
            </h1>
            <p className="text-white/60 text-lg max-w-[480px] leading-relaxed">
              Sixty seconds. We lock your role, region, and first ideal — then the OS opens.
            </p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="h-12 px-8 rounded-rs bg-orange text-black font-bold text-[15px]"
            >
              Begin onboarding →
            </button>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-6">
            <h2 className="display text-4xl leading-none">Who are you making for?</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={clsx(
                    "text-left p-5 rounded-rs-xl border transition",
                    role === r.id ? "border-white/40 bg-white/[0.06]" : "border-white/10 hover:border-white/20",
                  )}
                  style={{ boxShadow: role === r.id ? `inset 0 0 0 1px ${r.accent}` : undefined }}
                >
                  <div className="display text-xl" style={{ color: r.accent }}>
                    {r.label}
                  </div>
                  <p className="text-[13px] text-white/50 mt-1">{r.blurb}</p>
                </button>
              ))}
            </div>
            <NavRow onBack={() => setStep(0)} onNext={() => setStep(2)} />
          </section>
        )}

        {step === 2 && (
          <section className="space-y-6">
            <h2 className="display text-4xl leading-none">Where does your story live?</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {REGIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRegion(r.id)}
                  className={clsx(
                    "text-left p-5 rounded-rs-xl border transition flex items-center gap-4",
                    region === r.id ? "border-orange/60 bg-orange/10" : "border-white/10",
                  )}
                >
                  <span className="mono text-[11px] text-cyan w-8">{r.flag}</span>
                  <span className="display text-lg">{r.label}</span>
                </button>
              ))}
            </div>
            <NavRow onBack={() => setStep(1)} onNext={() => setStep(3)} />
          </section>
        )}

        {step === 3 && (
          <section className="space-y-6">
            <h2 className="display text-4xl leading-none">Pick your first ideal.</h2>
            <p className="text-white/50 text-sm">
              Nollywood, Asia, music video, Instagram ad, TikTok, YouTube clipper — apply as DNA later.
            </p>
            <div className="space-y-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  className={clsx(
                    "w-full text-left px-5 py-4 rounded-rs border flex justify-between items-center",
                    templateId === t.id ? "border-cyan/50 bg-cyan/10" : "border-white/10",
                  )}
                >
                  <span className="font-semibold">{t.label}</span>
                  <span className="mono text-[10px] text-white/40">{t.cat}</span>
                </button>
              ))}
            </div>
            <NavRow onBack={() => setStep(2)} onNext={() => setStep(4)} />
          </section>
        )}

        {step === 4 && (
          <section className="space-y-6">
            <h2 className="display text-4xl leading-none">
              Power up
              <br />
              <span className="text-violet">when ready.</span>
            </h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {(
                [
                  { id: "free" as const, name: "Studio", price: "Free", note: "3 × ARCHIVE5" },
                  { id: "storm" as const, name: "Storm", price: "£39", note: "15 blocks · Journey" },
                  { id: "storm_pro" as const, name: "Storm Pro", price: "£89", note: "40 blocks · Pro" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTierInterest(t.id)}
                  className={clsx(
                    "p-5 rounded-rs-xl border text-left",
                    tierInterest === t.id ? "border-violet bg-violet/15" : "border-white/10",
                  )}
                >
                  <div className="display text-xl">{t.name}</div>
                  <div className="text-orange font-bold mt-1">{t.price}</div>
                  <div className="text-[12px] text-white/45 mt-2">{t.note}</div>
                </button>
              ))}
            </div>
            <p className="text-[12px] text-white/40">
              Stay on Studio free for now — upgrade anytime.{" "}
              {!accessToken && (
                <span className="text-cyan">You’ll sign in next to seal this passport.</span>
              )}
            </p>
            {msg && <div className="text-[13px] text-orange whitespace-pre-wrap">{msg}</div>}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={busy}
                className="h-12 px-5 rounded-rs border border-white/15 text-sm disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void finish()}
                className="h-12 px-8 rounded-rs bg-orange text-black font-bold text-[14px] disabled:opacity-50"
              >
                {busy
                  ? "Saving…"
                  : accessToken
                    ? "Enter the factory →"
                    : "Sign up & enter factory →"}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function NavRow({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onBack} className="h-12 px-5 rounded-rs border border-white/15 text-sm">
        Back
      </button>
      <button
        type="button"
        onClick={onNext}
        className="h-12 px-8 rounded-rs bg-white text-black font-bold text-[14px]"
      >
        Continue →
      </button>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <AuthProvider>
      <Wizard />
    </AuthProvider>
  );
}
