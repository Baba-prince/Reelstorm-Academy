"use client";

import { usePathname } from "next/navigation";
import { Shell } from "@/components/Shell";
import { GuideBot } from "@/components/guide/GuideBot";
import { I18nProvider } from "@/lib/i18n/I18nProvider";

const MARKETING_EXACT = new Set([
  "/",
  "/how-it-works",
  "/training",
  "/producers",
  "/pricing",
  "/white-label",
  "/developers",
  "/legal/terms",
  "/legal/privacy",
  "/login",
  "/signup",
  "/onboarding",
  "/auth/callback",
]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const isMarketing =
    MARKETING_EXACT.has(pathname) ||
    pathname.startsWith("/legal/") ||
    pathname.startsWith("/auth/");

  return (
    <I18nProvider>
      {isMarketing ? children : <Shell>{children}</Shell>}
      <GuideBot />
    </I18nProvider>
  );
}
