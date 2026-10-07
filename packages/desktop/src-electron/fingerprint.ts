import { createHash } from "crypto";
import { hostname, networkInterfaces } from "os";

/**
 * Hardware fingerprint for device binding.
 * Prefer systeminformation when available; fall back to stable host signals.
 */
export async function hardwareFingerprint(): Promise<string> {
  let cpu = "";
  let gpu = "";
  let board = "";
  try {
    // Optional dependency — may be missing in light builds
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const si = require("systeminformation") as {
      cpu: () => Promise<{ manufacturer?: string; brand?: string }>;
      graphics: () => Promise<{ controllers?: Array<{ model?: string; vendor?: string }> }>;
      baseboard: () => Promise<{ serial?: string; manufacturer?: string; model?: string }>;
    };
    const [c, g, b] = await Promise.all([si.cpu(), si.graphics(), si.baseboard()]);
    cpu = `${c.manufacturer || ""}|${c.brand || ""}`;
    gpu = (g.controllers || [])
      .map((x) => `${x.vendor || ""}|${x.model || ""}`)
      .join(";");
    board = `${b.manufacturer || ""}|${b.model || ""}|${b.serial || ""}`;
  } catch {
    cpu = process.arch;
    gpu = "unknown";
    board = hostname();
  }

  const macs = Object.values(networkInterfaces())
    .flatMap((list) => list ?? [])
    .filter((n) => !n.internal && Boolean(n.mac))
    .map((n) => n.mac)
    .sort()
    .join(",");

  return createHash("sha256")
    .update(`${cpu}::${gpu}::${macs}::${board}::reelstorm-studio-v1`)
    .digest("hex");
}
