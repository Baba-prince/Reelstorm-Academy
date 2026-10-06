/** Single-owner Captain lock — override with ADMIN_EMAIL env if needed */
export const DEFAULT_ADMIN_EMAIL = "olabamiji.kolabalogun@gmail.com";

export function adminEmail(): string {
  return (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === adminEmail();
}
