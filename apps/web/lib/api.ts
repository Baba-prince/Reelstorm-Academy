export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (API_URL.startsWith("https") ? API_URL.replace("https", "wss") : API_URL.replace("http", "ws"));

export async function api<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
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
