import { isAdminEmail } from "@reelstorm/domain";
import { resolveUserFromAuthHeader } from "../routes/auth.js";

export async function requireAdmin(authHeader?: string) {
  const user = await resolveUserFromAuthHeader(authHeader);
  if (!user) return { ok: false as const, status: 401 as const, error: "Unauthorized" };
  if (!isAdminEmail(user.email)) {
    return { ok: false as const, status: 403 as const, error: "Admin access denied" };
  }
  return { ok: true as const, user };
}
