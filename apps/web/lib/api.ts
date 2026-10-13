/** Resolve API base at runtime so production works even before api.reelstorm.uk DNS. */
export function getApiBase(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    // Same-origin nginx proxies /api → ReelStorm API (:4017)
    if (
      host === "app.reelstorm.uk" ||
      host === "reelstorm.uk" ||
      host === "www.reelstorm.uk" ||
      host.endsWith(".reelstorm.uk")
    ) {
      return "";
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
}

/** @deprecated Prefer getApiBase() — kept for imports that expect a string at module load */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function getWsBase(): string {
  const api = typeof window !== "undefined" ? getApiBase() : API_URL;
  if (!api) {
    if (typeof window !== "undefined") {
      return window.location.protocol === "https:" ? `wss://${window.location.host}` : `ws://${window.location.host}`;
    }
    return process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000";
  }
  return api.startsWith("https") ? api.replace("https", "wss") : api.replace("http", "ws");
}

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (API_URL.startsWith("https") ? API_URL.replace("https", "wss") : API_URL.replace("http", "ws"));

/** Parse fetch body as JSON; turn nginx HTML 502/504 into a clear Error. */
export async function readJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    if (!res.ok) throw new Error(res.statusText || `HTTP ${res.status}`);
    return undefined as T;
  }
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) {
    if (res.status === 504 || /Gateway Time-out/i.test(trimmed)) {
      throw new Error(
        "Request timed out (gateway). GPU wake may be slow — retry Generate; photo+TTS fallback should finish under 2 minutes.",
      );
    }
    throw new Error(`Server returned HTML instead of JSON (HTTP ${res.status}). Retry in a moment.`);
  }
  let data: T & { error?: string; message?: string };
  try {
    data = JSON.parse(trimmed) as T & { error?: string; message?: string };
  } catch {
    throw new Error(trimmed.slice(0, 240) || res.statusText || `HTTP ${res.status}`);
  }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || trimmed.slice(0, 240) || res.statusText);
  }
  return data;
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();
  const token =
    typeof window !== "undefined" ? localStorage.getItem("rs_access_token") : null;
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  return readJson<T>(res);
}
