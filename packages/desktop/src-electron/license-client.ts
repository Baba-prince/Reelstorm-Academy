import { createHash } from "crypto";
import Store from "electron-store";
import { hardwareFingerprint } from "./fingerprint";

type StoreShape = {
  apiBase: string;
  email: string;
  keyPrefix: string;
  activatedToken: string;
  fingerprint: string;
  usedLocal: number;
  remaining: number;
  monthlyLimit: number;
  lastHeartbeatAt: number;
  offlineQueue: Array<{ minutes: number; videoHash?: string; promptHash?: string; at: number }>;
};

const store = new Store<StoreShape>({
  name: "reelstorm-studio-license",
  encryptionKey: "reelstorm-studio-local-blob-v1",
  defaults: {
    apiBase: "https://app.reelstorm.uk",
    email: "",
    keyPrefix: "",
    activatedToken: "",
    fingerprint: "",
    usedLocal: 0,
    remaining: 0,
    monthlyLimit: 0,
    lastHeartbeatAt: 0,
    offlineQueue: [],
  },
});

const OFFLINE_GRACE_MS = 72 * 3600 * 1000;

export function getApiBase() {
  return (process.env.STUDIO_API_URL || store.get("apiBase") || "https://app.reelstorm.uk").replace(
    /\/$/,
    "",
  );
}

export async function ensureFingerprint() {
  let fp = store.get("fingerprint");
  if (!fp) {
    fp = await hardwareFingerprint();
    store.set("fingerprint", fp);
  }
  return fp;
}

export function isOfflineBlocked() {
  const last = store.get("lastHeartbeatAt") || 0;
  if (!last) return false;
  return Date.now() - last > OFFLINE_GRACE_MS;
}

export async function activate(email: string, licenseKey: string, deviceName?: string) {
  const fingerprint = await ensureFingerprint();
  const res = await fetch(`${getApiBase()}/api/license/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      license_key: licenseKey,
      fingerprint,
      device_name: deviceName || "ReelStorm Studio",
    }),
  });
  const data = (await res.json()) as {
    error?: string;
    activated_token?: string;
    license?: {
      remaining: number;
      monthlyLimit: number;
      keyPrefix: string;
      usedThisMonth: number;
    };
  };
  if (!res.ok) throw new Error(data.error || res.statusText);
  store.set("email", email);
  store.set("activatedToken", data.activated_token || "");
  store.set("keyPrefix", data.license?.keyPrefix || "");
  store.set("remaining", data.license?.remaining ?? 0);
  store.set("monthlyLimit", data.license?.monthlyLimit ?? 0);
  store.set("usedLocal", data.license?.usedThisMonth ?? 0);
  store.set("lastHeartbeatAt", Date.now());
  // Never persist full license_key
  return data;
}

export async function heartbeat() {
  const token = store.get("activatedToken");
  if (!token) throw new Error("Not activated");
  if (isOfflineBlocked()) throw new Error("Offline grace expired — connect to verify license");
  const fingerprint = await ensureFingerprint();
  const res = await fetch(`${getApiBase()}/api/license/heartbeat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fingerprint, used: store.get("usedLocal") }),
  });
  const data = (await res.json()) as {
    error?: string;
    new_activated_token?: string;
    license?: { remaining: number; monthlyLimit: number; usedThisMonth: number; status: string };
  };
  if (!res.ok) throw new Error(data.error || res.statusText);
  if (data.new_activated_token) store.set("activatedToken", data.new_activated_token);
  if (data.license) {
    store.set("remaining", data.license.remaining);
    store.set("monthlyLimit", data.license.monthlyLimit);
    store.set("usedLocal", data.license.usedThisMonth);
  }
  store.set("lastHeartbeatAt", Date.now());
  await flushOfflineQueue();
  return data;
}

export async function reportUsage(minutes: number, videoHash?: string, promptHash?: string) {
  const token = store.get("activatedToken");
  if (!token) throw new Error("Not activated");
  if (store.get("remaining") < minutes) throw new Error("Monthly limit reached");
  if (isOfflineBlocked()) throw new Error("Offline grace expired");

  const fingerprint = await ensureFingerprint();
  const payload = { minutes, videoHash, promptHash, fingerprint };
  try {
    const res = await fetch(`${getApiBase()}/api/license/usage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as {
      error?: string;
      remaining?: number;
      usedThisMonth?: number;
    };
    if (!res.ok) throw new Error(data.error || res.statusText);
    store.set("remaining", data.remaining ?? store.get("remaining") - minutes);
    store.set("usedLocal", data.usedThisMonth ?? store.get("usedLocal") + minutes);
    store.set("lastHeartbeatAt", Date.now());
    return data;
  } catch (e) {
    const q = store.get("offlineQueue") || [];
    q.push({ ...payload, at: Date.now() });
    store.set("offlineQueue", q);
    store.set("remaining", Math.max(0, store.get("remaining") - minutes));
    store.set("usedLocal", store.get("usedLocal") + minutes);
    throw e;
  }
}

async function flushOfflineQueue() {
  const token = store.get("activatedToken");
  if (!token) return;
  const q = [...(store.get("offlineQueue") || [])];
  if (!q.length) return;
  const left: typeof q = [];
  for (const item of q) {
    try {
      const res = await fetch(`${getApiBase()}/api/license/usage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...item, offlineQueued: true, fingerprint: store.get("fingerprint") }),
      });
      if (!res.ok) left.push(item);
    } catch {
      left.push(item);
    }
  }
  store.set("offlineQueue", left);
}

export function licenseSnapshot() {
  return {
    email: store.get("email"),
    keyPrefix: store.get("keyPrefix"),
    remaining: store.get("remaining"),
    monthlyLimit: store.get("monthlyLimit"),
    usedLocal: store.get("usedLocal"),
    activated: Boolean(store.get("activatedToken")),
    lastHeartbeatAt: store.get("lastHeartbeatAt"),
    offlineBlocked: isOfflineBlocked(),
  };
}

export function hashText(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Thin client generate — proxies to VPS → RunPod saver.
 * 4.2GB SkyReels weights never download to the desktop (~120MB installer only).
 * Minute metering is done server-side inside /api/generate (source of truth).
 */
export async function generateLocal(prompt: string, durationSec: number) {
  if (!store.get("activatedToken")) throw new Error("Activate license first");
  if (isOfflineBlocked()) throw new Error("Connect to internet to verify license");
  const minutes = Math.max(durationSec / 60, 1 / 60);
  if (store.get("remaining") < minutes) throw new Error("Monthly limit reached — upgrade in dashboard");

  try {
    await heartbeat();
  } catch (e) {
    if (isOfflineBlocked()) throw e;
  }

  const fingerprint = await ensureFingerprint();
  const res = await fetch(`${getApiBase()}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${store.get("activatedToken")}`,
    },
    body: JSON.stringify({
      prompt,
      duration: durationSec,
      fingerprint,
      engine: "studio",
    }),
  });
  const out = (await res.json()) as {
    error?: string;
    r2_url?: string;
    minutes?: number;
    remaining?: number;
    engine?: string;
    note?: string;
  };
  if (!res.ok) throw new Error(out.error || res.statusText);
  if (!out.r2_url) throw new Error("Saver returned no r2_url");

  store.set("remaining", out.remaining ?? store.get("remaining") - minutes);
  store.set("usedLocal", store.get("usedLocal") + (out.minutes ?? minutes));
  store.set("lastHeartbeatAt", Date.now());

  return {
    path: out.r2_url,
    r2_url: out.r2_url,
    minutes: out.minutes ?? minutes,
    remaining: out.remaining ?? store.get("remaining"),
    engine: out.engine || "SkyReels-V2-DF-1.3B-540P-saver",
    note: out.note || "Rendered on GPU saver — 0 MB engine on this PC",
  };
}
