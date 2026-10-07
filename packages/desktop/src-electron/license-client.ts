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
 * Local SkyReels generate stub — wires to ComfyUI/SkyReels binary when installed.
 * Always reports usage to central API before returning success.
 */
export async function generateLocal(prompt: string, durationSec: number) {
  if (!store.get("activatedToken")) throw new Error("Activate license first");
  if (isOfflineBlocked()) throw new Error("Connect to internet to verify license");
  const minutes = Math.max(durationSec / 60, 1 / 60);
  if (store.get("remaining") < minutes) throw new Error("Monthly limit reached — upgrade in dashboard");

  // Pre-check with central (source of truth)
  try {
    await heartbeat();
  } catch (e) {
    if (isOfflineBlocked()) throw e;
    // allow within grace if heartbeat fails transiently
  }

  // TODO: spawn ComfyUI / SkyReels DF 1.3B when weights present
  // For now produce a placeholder path so license metering can be tested end-to-end
  const outPath = `local-stub-${Date.now()}.mp4`;
  await new Promise((r) => setTimeout(r, 800));

  await reportUsage(minutes, hashText(outPath), hashText(prompt));
  return {
    path: outPath,
    minutes,
    engine: "skyreels-v2-1.3b-stub",
    note: "Weights not installed — stub render. Download SkyReels pack on first real generate.",
  };
}
