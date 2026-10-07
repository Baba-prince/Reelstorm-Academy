/**
 * Thin desktop generate — NO local SkyReels weights.
 * Calls VPS control plane → RunPod saver (4.2GB stays on volume).
 */
export type SaverGenerateResult = {
  r2_url: string;
  minutes: number;
  remaining: number;
  engine?: string;
  note?: string;
};

export async function generateViaSaver(opts: {
  apiBase: string;
  activatedToken: string;
  fingerprint: string;
  prompt: string;
  durationSec: number;
}): Promise<SaverGenerateResult> {
  const res = await fetch(`${opts.apiBase.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.activatedToken}`,
    },
    body: JSON.stringify({
      prompt: opts.prompt,
      duration: opts.durationSec,
      fingerprint: opts.fingerprint,
      engine: "studio",
    }),
  });
  const data = (await res.json()) as SaverGenerateResult & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  if (!data.r2_url) throw new Error("Saver returned no r2_url");
  return data;
}
