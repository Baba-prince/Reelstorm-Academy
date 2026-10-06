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

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
