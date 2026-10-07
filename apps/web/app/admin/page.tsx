"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuthProvider, useAuth } from "@/lib/auth";
import { getApiBase } from "@/lib/api";
import { DEFAULT_ADMIN_EMAIL, isAdminEmail } from "@reelstorm/domain";

type Overview = {
  lockedTo: string;
  stats: {
    registeredUsers: number;
    wallets: number;
    systemBalanceRtc: number;
    systemArchive5Remaining: number;
    rtcPerArchive5: number;
    lifetimeInRtc: number;
    lifetimeOutRtc: number;
    projects: number;
    introsCached: number;
    vouchersOpen: number;
    vouchersRedeemed: number;
    studioLicenses?: number;
    studioActive?: number;
    studioDevices?: number;
    studioMinutesUsed?: number;
    cloneJobs?: number;
    ytScripts?: number;
  };
  systemBank?: {
    total: number;
    remaining: number;
    used: number;
    costBasis: number;
    funnelHint?: string;
  };
  tiers: Record<string, number>;
  recentLedger: Array<{
    id: string;
    type: string;
    amountRtc: number;
    note: string | null;
    email: string | null;
    createdAt: string;
  }>;
};

type StudioLicenseRow = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  status: string;
  keyPrefix: string;
  monthlyLimit: number;
  usedThisMonth: number;
  remaining: number;
  devicesAllowed: number;
  devices: Array<{ id: string; deviceName: string | null; lastSeenAt: string }>;
  expiresAt: string | null;
  createdAt: string;
};

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  balanceRtc: number;
  archive5Remaining: number;
  projects: number;
  createdAt: string;
};

type Voucher = {
  id: string;
  code: string;
  amountRtc: number;
  note: string | null;
  redeemedBy: string | null;
  redeemedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-rs border border-white/10 bg-white/[0.03] p-4">
      <div className="mono text-[9px] text-cyan tracking-[0.16em] uppercase">{label}</div>
      <div className="display text-2xl mt-2 text-white">{value}</div>
      {sub ? <div className="mono text-[10px] text-white/40 mt-1">{sub}</div> : null}
    </div>
  );
}

function AdminInner() {
  const { token, user, loading } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [studioLicenses, setStudioLicenses] = useState<StudioLicenseRow[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [studioPlaintext, setStudioPlaintext] = useState<string | null>(null);

  const [giftEmail, setGiftEmail] = useState("");
  const [giftAmount, setGiftAmount] = useState("50");
  const [giftNote, setGiftNote] = useState("");
  const [voucherAmount, setVoucherAmount] = useState("25");
  const [voucherNote, setVoucherNote] = useState("");
  const [voucherDays, setVoucherDays] = useState("30");
  const [studioEmail, setStudioEmail] = useState("");
  const [studioPlan, setStudioPlan] = useState("pro");

  const headers = useCallback((): HeadersInit => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setErr("");
    const [oRes, uRes, vRes, sRes] = await Promise.all([
      fetch(`${getApiBase()}/api/admin/overview`, { headers: headers() }),
      fetch(`${getApiBase()}/api/admin/users?limit=80${q ? `&q=${encodeURIComponent(q)}` : ""}`, {
        headers: headers(),
      }),
      fetch(`${getApiBase()}/api/admin/vouchers`, { headers: headers() }),
      fetch(`${getApiBase()}/api/admin/studio-licenses`, { headers: headers() }),
    ]);
    if (oRes.status === 401 || oRes.status === 403) {
      setErr("Admin access denied — this console is locked to the Captain email.");
      setOverview(null);
      return;
    }
    if (!oRes.ok) {
      const j = await oRes.json().catch(() => ({}));
      setErr((j as { error?: string }).error || "Failed to load overview");
      return;
    }
    setOverview(await oRes.json());
    if (uRes.ok) {
      const uj = await uRes.json();
      setUsers(uj.users || []);
    }
    if (vRes.ok) {
      const vj = await vRes.json();
      setVouchers(vj.vouchers || []);
    }
    if (sRes.ok) {
      const sj = await sRes.json();
      setStudioLicenses(sj.licenses || []);
    }
  }, [token, headers, q]);

  useEffect(() => {
    if (!loading && token && isAdminEmail(user?.email)) {
      void loadAll();
    }
  }, [loading, token, user?.email, loadAll]);

  async function giftCredits(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch(`${getApiBase()}/api/admin/gift-credits`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          email: giftEmail.trim(),
          amountRtc: Number(giftAmount),
          note: giftNote || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gift failed");
      setMsg(`Gifted ${j.grantedRtc} RTC → ${j.user.email} (balance ${j.balanceRtc})`);
      setGiftNote("");
      await loadAll();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function mintVoucher(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch(`${getApiBase()}/api/admin/vouchers`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          amountRtc: Number(voucherAmount),
          note: voucherNote || undefined,
          expiresInDays: Number(voucherDays) || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Voucher mint failed");
      setMsg(`Voucher minted: ${j.voucher.code} (+${j.voucher.amountRtc} RTC)`);
      setVoucherNote("");
      await loadAll();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setTier(userId: string, tier: string) {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`${getApiBase()}/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ tier }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Tier update failed");
      setMsg(`Tier → ${j.user.email}: ${j.user.tier}`);
      await loadAll();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function issueStudio(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setErr("");
    setStudioPlaintext(null);
    try {
      const res = await fetch(`${getApiBase()}/api/admin/studio-licenses/issue`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ email: studioEmail.trim(), plan: studioPlan }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Issue failed");
      setStudioPlaintext(j.plaintextKey || null);
      setMsg(`Studio ${j.license.plan} issued → ${j.email} (${j.license.keyPrefix})`);
      setStudioEmail("");
      await loadAll();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revokeStudio(id: string) {
    if (!confirm("Revoke this Studio license and all devices?")) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`${getApiBase()}/api/admin/studio-licenses/${id}/revoke`, {
        method: "POST",
        headers: headers(),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Revoke failed");
      setMsg(`License revoked: ${id.slice(0, 8)}…`);
      await loadAll();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function regenStudio(id: string) {
    if (!confirm("Regenerate key? Old keys and device tokens stop working.")) return;
    setBusy(true);
    setErr("");
    setStudioPlaintext(null);
    try {
      const res = await fetch(`${getApiBase()}/api/admin/studio-licenses/${id}/regenerate`, {
        method: "POST",
        headers: headers(),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Regenerate failed");
      setStudioPlaintext(j.plaintextKey || null);
      setMsg("New Studio key minted — copy now");
      await loadAll();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="mono text-cyan text-sm">Loading session…</div>;
  }

  if (!token || !user) {
    return (
      <div className="max-w-lg space-y-4">
        <h1 className="display text-3xl">Captain Admin</h1>
        <p className="text-white/60 text-sm">Sign in with the locked Captain email to open system management.</p>
        <Link
          href={`/login?next=${encodeURIComponent("/admin")}`}
          className="inline-flex h-11 px-5 items-center rounded-rs bg-violet text-white text-sm font-semibold"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!isAdminEmail(user.email)) {
    return (
      <div className="max-w-lg space-y-3">
        <h1 className="display text-3xl">Access denied</h1>
        <p className="text-white/60 text-sm">
          Admin is locked to <span className="mono text-cyan">{DEFAULT_ADMIN_EMAIL}</span>. You are signed in as{" "}
          <span className="mono text-orange">{user.email}</span>.
        </p>
        <Link href="/dashboard" className="text-sm text-cyan underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const s = overview?.stats;

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mono text-[10px] text-cyan tracking-[0.2em]">CAPTAIN // STORM OS · YT-OS · STUDIO</div>
          <h1 className="display text-3xl md:text-4xl mt-1">Admin dashboard</h1>
          <p className="text-white/50 text-sm mt-2">
            Locked to <span className="mono text-cyan">{overview?.lockedTo || DEFAULT_ADMIN_EMAIL}</span>
            {" · "}gifts · vouchers · Studio licenses · SystemBank
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          className="h-10 px-4 rounded-rs border border-white/15 text-xs mono text-white/70 hover:text-white"
        >
          Refresh
        </button>
      </div>

      {(msg || err) && (
        <div
          className={`rounded-rs border px-4 py-3 text-sm ${
            err ? "border-orange/40 text-orange bg-orange/10" : "border-cyan/30 text-cyan bg-cyan/10"
          }`}
        >
          {err || msg}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Registered users" value={s?.registeredUsers ?? "—"} />
        <Stat
          label="Wallet RTC pool"
          value={s?.systemBalanceRtc ?? "—"}
          sub={s ? `${s.systemArchive5Remaining} ARCHIVE5 · ${s.rtcPerArchive5} RTC/set` : undefined}
        />
        <Stat
          label="SystemBank demos"
          value={overview?.systemBank ? `${overview.systemBank.remaining}` : "—"}
          sub={
            overview?.systemBank
              ? `${overview.systemBank.used} used / ${overview.systemBank.total} · $${overview.systemBank.costBasis}/RTC basis`
              : undefined
          }
        />
        <Stat
          label="Pixabay intros"
          value={s?.introsCached ?? "—"}
          sub={s ? `Clone jobs ${s.cloneJobs ?? 0} · YT scripts ${s.ytScripts ?? 0}` : undefined}
        />
        <Stat
          label="Studio licenses"
          value={s?.studioLicenses ?? "—"}
          sub={
            s
              ? `${s.studioActive ?? 0} active · ${s.studioDevices ?? 0} devices · ${Math.round(s.studioMinutesUsed ?? 0)} min used`
              : undefined
          }
        />
        <Stat label="Projects" value={s?.projects ?? "—"} />
        <Stat
          label="Vouchers"
          value={s?.vouchersOpen ?? "—"}
          sub={s ? `${s.vouchersRedeemed} redeemed` : undefined}
        />
        <Stat
          label="Lifetime in / out"
          value={`${s?.lifetimeInRtc ?? 0}`}
          sub={`out ${s?.lifetimeOutRtc ?? 0}`}
        />
      </div>

      {overview?.systemBank?.funnelHint && (
        <p className="mono text-[10px] text-white/35">{overview.systemBank.funnelHint}</p>
      )}

      {overview?.tiers && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(overview.tiers).map(([tier, n]) => (
            <span key={tier} className="mono text-[10px] px-2.5 py-1 rounded-full border border-white/10 text-white/55">
              {tier}: {n}
            </span>
          ))}
        </div>
      )}

      {studioPlaintext && (
        <div className="rounded-rs border border-orange/40 bg-orange/10 p-4">
          <div className="mono text-[10px] text-orange mb-2">STUDIO KEY — COPY ONCE</div>
          <code className="text-[11px] break-all select-all">{studioPlaintext}</code>
          <button
            type="button"
            className="mt-2 block text-xs text-white/50 hover:text-white"
            onClick={() => {
              void navigator.clipboard.writeText(studioPlaintext);
              setMsg("Studio key copied");
            }}
          >
            Copy to clipboard
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <form onSubmit={giftCredits} className="rounded-rs border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <h2 className="display text-xl">Gift RTC credits</h2>
          <p className="text-white/45 text-xs">Direct wallet credit to a registered (or new) user email.</p>
          <input
            className="w-full h-10 px-3 rounded-rs bg-void border border-white/10 text-sm"
            placeholder="user@email.com"
            value={giftEmail}
            onChange={(e) => setGiftEmail(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <input
              className="w-28 h-10 px-3 rounded-rs bg-void border border-white/10 text-sm mono"
              type="number"
              min={1}
              value={giftAmount}
              onChange={(e) => setGiftAmount(e.target.value)}
              required
            />
            <input
              className="flex-1 h-10 px-3 rounded-rs bg-void border border-white/10 text-sm"
              placeholder="Note (optional)"
              value={giftNote}
              onChange={(e) => setGiftNote(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="h-10 px-4 rounded-rs bg-violet text-white text-sm font-semibold disabled:opacity-50"
          >
            Allocate gift
          </button>
        </form>

        <form onSubmit={mintVoucher} className="rounded-rs border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <h2 className="display text-xl">Mint gift voucher</h2>
          <p className="text-white/45 text-xs">One-time code users redeem from Wallet.</p>
          <div className="flex gap-2">
            <input
              className="w-28 h-10 px-3 rounded-rs bg-void border border-white/10 text-sm mono"
              type="number"
              min={1}
              value={voucherAmount}
              onChange={(e) => setVoucherAmount(e.target.value)}
              required
            />
            <input
              className="w-24 h-10 px-3 rounded-rs bg-void border border-white/10 text-sm mono"
              type="number"
              min={1}
              value={voucherDays}
              onChange={(e) => setVoucherDays(e.target.value)}
              title="Expires in days"
            />
            <input
              className="flex-1 h-10 px-3 rounded-rs bg-void border border-white/10 text-sm"
              placeholder="Note"
              value={voucherNote}
              onChange={(e) => setVoucherNote(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="h-10 px-4 rounded-rs bg-orange text-black text-sm font-semibold disabled:opacity-50"
          >
            Mint voucher
          </button>
        </form>

        <form onSubmit={issueStudio} className="rounded-rs border border-cyan/20 bg-cyan/5 p-5 space-y-3">
          <h2 className="display text-xl">Issue Studio license</h2>
          <p className="text-white/45 text-xs">
            Desktop Option 2 — user GPU · central minutes. Key shown once.
          </p>
          <input
            className="w-full h-10 px-3 rounded-rs bg-void border border-white/10 text-sm"
            placeholder="user@email.com"
            value={studioEmail}
            onChange={(e) => setStudioEmail(e.target.value)}
            required
          />
          <select
            className="w-full h-10 px-3 rounded-rs bg-void border border-white/10 text-sm"
            value={studioPlan}
            onChange={(e) => setStudioPlan(e.target.value)}
          >
            {["free", "starter", "pro", "agency", "unlimited"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy}
            className="h-10 px-4 rounded-rs bg-cyan text-black text-sm font-semibold disabled:opacity-50"
          >
            Issue license
          </button>
        </form>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="display text-xl">Studio licenses</h2>
          <Link href="/download" className="mono text-[10px] text-cyan hover:underline">
            /download →
          </Link>
        </div>
        <div className="overflow-x-auto rounded-rs border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="mono text-[9px] text-white/40 border-b border-white/10">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Minutes</th>
                <th className="px-3 py-2">Devices</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {studioLicenses.map((l) => (
                <tr key={l.id} className="border-b border-white/[0.06]">
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.name || "—"}</div>
                    <div className="mono text-[10px] text-white/45">{l.email}</div>
                    <div className="mono text-[9px] text-white/30">{l.keyPrefix}</div>
                  </td>
                  <td className="px-3 py-2 mono text-[11px] capitalize">{l.plan}</td>
                  <td className="px-3 py-2 mono text-[11px] text-cyan">{l.status}</td>
                  <td className="px-3 py-2 mono text-[11px]">
                    {Math.round(l.remaining * 10) / 10}/{l.monthlyLimit}
                  </td>
                  <td className="px-3 py-2 mono text-[11px]">
                    {l.devices.length}/{l.devicesAllowed}
                  </td>
                  <td className="px-3 py-2 space-x-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void regenStudio(l.id)}
                      className="text-[11px] text-cyan hover:underline"
                    >
                      Regen
                    </button>
                    <button
                      type="button"
                      disabled={busy || l.status === "revoked"}
                      onClick={() => void revokeStudio(l.id)}
                      className="text-[11px] text-orange hover:underline"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
              {!studioLicenses.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-white/40 text-center">
                    No Studio licenses yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <h2 className="display text-xl">Users</h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void loadAll();
            }}
          >
            <input
              className="h-9 w-56 px-3 rounded-rs bg-void border border-white/10 text-sm"
              placeholder="Search email / name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="h-9 px-3 rounded-rs border border-white/15 text-xs">
              Search
            </button>
          </form>
        </div>
        <div className="overflow-x-auto rounded-rs border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="mono text-[9px] text-white/40 border-b border-white/10">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2">RTC</th>
                <th className="px-3 py-2">Sets</th>
                <th className="px-3 py-2">Projects</th>
                <th className="px-3 py-2">Set tier</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.06]">
                  <td className="px-3 py-2">
                    <div className="font-medium">{u.name || "—"}</div>
                    <div className="mono text-[10px] text-white/45">{u.email}</div>
                  </td>
                  <td className="px-3 py-2 mono text-[11px]">{u.tier}</td>
                  <td className="px-3 py-2 mono">{u.balanceRtc}</td>
                  <td className="px-3 py-2 mono">{u.archive5Remaining}</td>
                  <td className="px-3 py-2 mono">{u.projects}</td>
                  <td className="px-3 py-2">
                    <select
                      className="h-8 bg-void border border-white/10 rounded text-[11px]"
                      value={u.tier}
                      disabled={busy}
                      onChange={(e) => void setTier(u.id, e.target.value)}
                    >
                      {["free", "storm", "storm_pro", "premium_pro", "network"].map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-white/40 text-center">
                    No users yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="display text-xl">Vouchers</h2>
        <div className="overflow-x-auto rounded-rs border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="mono text-[9px] text-white/40 border-b border-white/10">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">RTC</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <tr key={v.id} className="border-b border-white/[0.06]">
                  <td className="px-3 py-2 mono text-cyan">{v.code}</td>
                  <td className="px-3 py-2 mono">{v.amountRtc}</td>
                  <td className="px-3 py-2 text-xs text-white/55">
                    {v.redeemedAt ? `Redeemed by ${v.redeemedBy}` : "Open"}
                  </td>
                  <td className="px-3 py-2 text-xs text-white/45">{v.note || "—"}</td>
                </tr>
              ))}
              {!vouchers.length && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-white/40 text-center">
                    No vouchers yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {overview?.recentLedger?.length ? (
        <section className="space-y-3">
          <h2 className="display text-xl">Recent ledger</h2>
          <ul className="space-y-2">
            {overview.recentLedger.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap gap-x-4 gap-y-1 text-xs border border-white/[0.06] rounded-rs px-3 py-2"
              >
                <span className="mono text-cyan">{l.type}</span>
                <span className="mono">{l.amountRtc > 0 ? `+${l.amountRtc}` : l.amountRtc}</span>
                <span className="text-white/45">{l.email || "—"}</span>
                <span className="text-white/35">{l.note || ""}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export default function AdminPage() {
  return (
    <AuthProvider>
      <AdminInner />
    </AuthProvider>
  );
}
