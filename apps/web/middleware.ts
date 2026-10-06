import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MARKETING_HOSTS = new Set(["reelstorm.uk", "www.reelstorm.uk"]);
const APP_HOSTS = new Set(["app.reelstorm.uk"]);

const MARKETING_PATHS = new Set([
  "/",
  "/how-it-works",
  "/training",
  "/producers",
  "/pricing",
  "/white-label",
  "/developers",
  "/legal/terms",
  "/legal/privacy",
]);

const APP_ONLY_PREFIXES = [
  "/dashboard",
  "/wizard",
  "/login",
  "/signup",
  "/onboarding",
  "/auth",
  "/templates-room",
  "/template-forge",
  "/world-builder",
  "/storyboard",
  "/studio",
  "/sound-studio",
  "/archive-vault",
  "/merge-studio",
  "/model-center",
  "/team",
  "/brand",
  "/wallet",
  "/scorecard",
  "/projects",
];

function isAppPath(pathname: string) {
  return APP_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  const { pathname } = req.nextUrl;

  // Production host split
  if (MARKETING_HOSTS.has(host)) {
    if (isAppPath(pathname)) {
      const url = new URL(pathname + req.nextUrl.search, "https://app.reelstorm.uk");
      return NextResponse.redirect(url);
    }
  }

  if (APP_HOSTS.has(host)) {
    if (pathname === "/" || MARKETING_PATHS.has(pathname) || pathname.startsWith("/legal/")) {
      // App root → login/dashboard; keep pricing on marketing
      if (pathname === "/") {
        return NextResponse.redirect(new URL("/login", req.url));
      }
      if (pathname === "/pricing" || pathname.startsWith("/legal/") || pathname === "/how-it-works" || pathname === "/training" || pathname === "/white-label" || pathname === "/developers" || pathname === "/producers") {
        const url = new URL(pathname + req.nextUrl.search, "https://reelstorm.uk");
        return NextResponse.redirect(url);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
