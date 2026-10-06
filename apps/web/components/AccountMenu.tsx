"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/lib/auth";
import { isAdminEmail } from "@reelstorm/domain";

export function AccountMenu() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (loading) {
    return (
      <div className="h-9 w-20 rounded-rs border border-white/10 animate-pulse bg-white/5" />
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex h-9 px-3 items-center rounded-rs border border-white/10 text-[11px] text-white/60 hover:text-white"
      >
        Sign in
      </Link>
    );
  }

  const label = (user.name || user.email.split("@")[0] || "Account").slice(0, 18);
  const initial = (user.name || user.email || "?").charAt(0).toUpperCase();
  const admin = isAdminEmail(user.email);

  async function logout() {
    setOpen(false);
    await signOut();
    router.push("/login");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-rs border border-white/10 pl-1.5 pr-2.5 text-[11px] text-white/80 hover:border-cyan/40 hover:text-white"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="w-6 h-6 rounded-[8px] bg-violet/30 text-violet flex items-center justify-center text-[11px] font-bold">
          {initial}
        </span>
        <span className="hidden sm:inline max-w-[100px] truncate">{label}</span>
        <span className="text-white/35 text-[9px]">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] w-56 rounded-rs-xl border border-white/[0.1] bg-deep shadow-xl z-50 py-1.5 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-white/[0.06]">
            <div className="text-[12px] font-semibold truncate">{user.name || "Producer"}</div>
            <div className="mono text-[9px] text-white/40 truncate">{user.email}</div>
            <div className="mono text-[8px] text-cyan mt-1 uppercase">{user.tier} tier</div>
          </div>

          <MenuLink href="/account" onClick={() => setOpen(false)}>
            Account settings
          </MenuLink>
          <MenuLink href="/account#password" onClick={() => setOpen(false)}>
            Change password
          </MenuLink>
          <MenuLink href="/billing" onClick={() => setOpen(false)}>
            Billing
          </MenuLink>
          <MenuLink href="/wallet" onClick={() => setOpen(false)}>
            RTC Wallet
          </MenuLink>
          {admin ? (
            <MenuLink href="/admin" onClick={() => setOpen(false)} tone="orange">
              Captain Admin
            </MenuLink>
          ) : null}

          <div className="border-t border-white/[0.06] mt-1 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => void logout()}
              className="w-full text-left px-3 py-2 text-[12px] text-orange/90 hover:bg-orange/10"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  children,
  onClick,
  tone,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "orange";
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className={clsx(
        "block px-3 py-2 text-[12px] hover:bg-white/[0.04]",
        tone === "orange" ? "text-orange/90" : "text-white/75 hover:text-white",
      )}
    >
      {children}
    </Link>
  );
}
