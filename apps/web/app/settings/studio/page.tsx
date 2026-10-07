"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import { getApiBase } from "@/lib/api";

type Device = {
  id: string;
  deviceName: string | null;
  fingerprint: string;
  activatedAt: string;
  lastSeenAt: string;
};

type License = {
  id: string;
  plan: string;
  monthlyLimit: number;
  usedThisMonth: number;
  remaining: number;
  devicesAllowed: number;
  status: string;
  keyPrefix: string;
  maskedKey: string;
  expiresAt: string | null;
  devices: Device[];
};

function StudioSettingsInner() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/settings/studio");
  }, [loading, user, router]);

  useEffect(() => {
    const issued = sessionStorage.getItem("studio_plaintext_key");
    if (issued) {
      setPlaintext(issued);
      sessionStorage.removeItem("studio_plaintext_key");
    }
    if (params.get("issued") === "1") {
      setMsg("Free license issued — copy the key now. It will not be shown again.");
    }
  }, [params]);

  async function load() {
    if (!token) return;
    const res = await fetch(`${getApiBase()}/api/license/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await res.json();
    if (res.ok) setLicenses(j.licenses || []);
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function deactivate(id: string) {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${getApiBase()}/api/license/devices/${id}/deactivate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setMsg("Device deactivated.");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function regenerate(licenseId: string) {
    if (!token) return;
    if (!confirm("Regenerate key? Old key and device tokens will stop working.")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${getApiBase()}/api/license/regenerate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ licenseId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setPlaintext(j.plaintextKey || null);
      setMsg("New key issued — copy now. Shown once.");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white px-5 md:px-8 py-12">
      <div className="mx-auto max-w-[800px]">
        <Link href="/account" className="text-sm text-white/40 hover:text-cyan">
          ← Account
        </Link>
        <h1 className="display text-4xl mt-4 mb-2">Studio license</h1>
        <p className="text-white/50 text-sm mb-8">
          Hardware-locked seats · central minute meter · full key never stored after activation.
        </p>

        {msg && <div className="mb-4 text-cyan text-sm">{msg}</div>}
        {err && <div className="mb-4 text-orange text-sm">{err}</div>}

        {plaintext && (
          <div className="mb-6 rounded-rs border border-orange/40 bg-orange/10 p-4">
            <div className="text-[11px] mono text-orange mb-2">COPY NOW — SHOWN ONCE</div>
            <code className="text-[12px] break-all select-all">{plaintext}</code>
            <button
              type="button"
              className="mt-3 block text-xs text-white/50 hover:text-white"
              onClick={() => {
                void navigator.clipboard.writeText(plaintext);
                setMsg("Copied.");
              }}
            >
              Copy to clipboard
            </button>
          </div>
        )}

        {!licenses.length && (
          <p className="text-white/45 text-sm">
            No Studio license yet.{" "}
            <Link href="/download" className="text-cyan hover:underline">
              Get Studio
            </Link>
          </p>
        )}

        <div className="space-y-6">
          {licenses.map((l) => (
            <div key={l.id} className="border border-white/10 rounded-rs-xl p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <div className="display text-2xl capitalize">{l.plan}</div>
                  <div className="mono text-[11px] text-white/40 mt-1">{l.maskedKey}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-cyan font-semibold">{l.status}</div>
                  <div className="text-white/45">
                    {Math.round(l.remaining * 10) / 10} / {l.monthlyLimit} min left
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="text-[12px] text-white/40 mb-2">
                  Devices ({l.devices.length}/{l.devicesAllowed})
                </div>
                <ul className="space-y-2">
                  {l.devices.map((d) => (
                    <li
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm border-t border-white/[0.06] pt-2"
                    >
                      <div>
                        <div>{d.deviceName || "Device"}</div>
                        <div className="mono text-[10px] text-white/30">
                          {d.fingerprint} · last {new Date(d.lastSeenAt).toLocaleString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void deactivate(d.id)}
                        className="text-xs text-orange hover:underline"
                      >
                        Deactivate
                      </button>
                    </li>
                  ))}
                  {!l.devices.length && (
                    <li className="text-sm text-white/35">No devices activated yet.</li>
                  )}
                </ul>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void regenerate(l.id)}
                className="mt-5 h-10 px-4 rounded-rs border border-white/15 text-sm"
              >
                Regenerate key
              </button>
            </div>
          ))}
        </div>

        <p className="mt-10 text-[12px] text-white/30">
          <Link href="/download" className="hover:text-white/50">
            Download Studio
          </Link>
          {" · "}
          Offline grace 72h · heartbeat every hour · cancel Stripe → app blocks
        </p>
      </div>
    </div>
  );
}

export default function StudioSettingsPage() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="min-h-screen bg-[#080808] text-white/40 p-10 mono text-sm">Loading…</div>}>
        <StudioSettingsInner />
      </Suspense>
    </AuthProvider>
  );
}
