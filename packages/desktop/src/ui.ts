type StudioApi = {
  snapshot: () => Promise<{
    email: string;
    keyPrefix: string;
    remaining: number;
    monthlyLimit: number;
    activated: boolean;
    offlineBlocked: boolean;
  }>;
  activate: (email: string, key: string) => Promise<unknown>;
  generate: (
    prompt: string,
    durationSec: number,
  ) => Promise<{ path: string; r2_url?: string; minutes: number; remaining?: number; note?: string }>;
  openDashboard: () => Promise<void>;
};

declare global {
  interface Window {
    reelstormStudio?: StudioApi;
  }
}

const api = window.reelstormStudio;

async function refresh() {
  if (!api) return;
  const s = await api.snapshot();
  (document.getElementById("activated") as HTMLElement).textContent = s.activated
    ? s.offlineBlocked
      ? "OFFLINE BLOCKED"
      : "ACTIVE"
    : "NOT ACTIVATED";
  (document.getElementById("keyPrefix") as HTMLElement).textContent = s.keyPrefix || "—";
  (document.getElementById("remaining") as HTMLElement).textContent = String(
    Math.round(s.remaining * 100) / 100,
  );
  (document.getElementById("limit") as HTMLElement).textContent = String(s.monthlyLimit);
}

document.getElementById("btnActivate")?.addEventListener("click", async () => {
  const msg = document.getElementById("actMsg")!;
  msg.className = "";
  msg.textContent = "";
  try {
    if (!api) throw new Error("IPC bridge missing — run inside Electron");
    const email = (document.getElementById("email") as HTMLInputElement).value.trim();
    const key = (document.getElementById("key") as HTMLInputElement).value.trim();
    await api.activate(email, key);
    (document.getElementById("key") as HTMLInputElement).value = "";
    msg.className = "ok";
    msg.textContent = "Activated. Full key cleared from UI — only masked prefix retained.";
    await refresh();
  } catch (e) {
    msg.className = "err";
    msg.textContent = (e as Error).message;
  }
});

document.getElementById("btnGen")?.addEventListener("click", async () => {
  const msg = document.getElementById("genMsg")!;
  msg.className = "";
  msg.textContent = "Generating…";
  try {
    if (!api) throw new Error("IPC bridge missing");
    const prompt = (document.getElementById("prompt") as HTMLTextAreaElement).value.trim();
    const dur = Number((document.getElementById("dur") as HTMLInputElement).value || 10);
    const out = await api.generate(prompt, dur);
    msg.className = "ok";
    msg.textContent = `Done · ${out.minutes.toFixed(2)} min · ${out.r2_url || out.path}${out.note ? " · " + out.note : ""}`;
    if (out.r2_url) {
      const v = document.getElementById("preview") as HTMLVideoElement | null;
      if (v) {
        v.src = out.r2_url;
        v.classList.remove("hidden");
      }
    }
    await refresh();
  } catch (e) {
    msg.className = "err";
    msg.textContent = (e as Error).message;
  }
});

document.getElementById("btnDash")?.addEventListener("click", () => void api?.openDashboard());

void refresh();
