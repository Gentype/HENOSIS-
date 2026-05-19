"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/store";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

interface NavbarProps {
  className?: string;
  /** Use the slim variant for in-app pages (no big CTA, just navigation) */
  variant?: "marketing" | "app";
}

const MARKETING_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/projects", label: "My Projects" },
];

export function Navbar({ className, variant = "marketing" }: NavbarProps) {
  const user = useUser((s) => s.user);
  // The NextAuth session is the ground truth for "is this browser signed
  // in?" — it's resolved server-side and handed to SessionProvider as
  // `initialSession`, so it's correct on the very first client render. The
  // `useUser` zustand store only fills in *after* `/api/me` resolves a few
  // hundred ms later, which is too slow: a freshly-signed-in user briefly
  // sees the "Sign in / Sign up" pair in the navbar even though they're
  // already authenticated, then it flips. Use the session for the binary
  // decision, fall back to the session's user fields for the avatar while
  // `useUser` catches up.
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const isSessionLoading = sessionStatus === "loading";
  const displayUser = user ?? sessionToDisplayUser(session);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menu on Escape + lock body scroll while open
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 transition-all duration-300",
          scrolled || menuOpen
            ? "nav-glass"
            : "bg-transparent border-b border-transparent",
          className,
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-5 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center" aria-label="Henosis home">
            <Logo size="md" />
          </Link>

          {variant === "marketing" && (
            <nav className="hidden md:flex items-center gap-7 text-sm text-muted">
              {MARKETING_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="nav-active-indicator hover:text-foreground transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          )}

          {/* Desktop right cluster */}
          <div className="hidden sm:flex items-center gap-2">
            {isAuthenticated && displayUser ? (
              <Link
                href="/profile"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface/60 hover:bg-surface text-sm transition-colors"
              >
                <Avatar user={displayUser} size={24} />
                <span className="hidden sm:inline text-foreground">{displayUser.name}</span>
                {user && (
                  <span
                    className={cn(
                      "hidden md:inline text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border",
                      tierBadgeClass(user.plan),
                    )}
                  >
                    {user.tier}
                  </span>
                )}
              </Link>
            ) : isSessionLoading ? (
              // While SessionProvider is still resolving, render a neutral
              // pill so the navbar doesn't flash "Sign in / Sign up" at a
              // user whose cookie is about to be confirmed valid.
              <div
                className="h-8 w-24 rounded-full border border-border bg-surface/40 animate-pulse"
                aria-hidden
              />
            ) : (
              <>
                <Link
                  href="/auth"
                  className="px-4 py-1.5 text-sm text-muted hover:text-foreground transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth?mode=signup"
                  className="px-4 py-1.5 text-sm font-medium rounded-full bg-accent text-black hover:brightness-110 transition-all shadow-[0_0_24px_-6px_rgba(184,227,201,0.7)]"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="sm:hidden p-2 -mr-1 rounded-md text-foreground hover:bg-white/5 transition-colors"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile slide-down menu */}
      <div
        className={cn(
          "sm:hidden fixed inset-x-0 top-16 z-40 transition-all duration-300 origin-top",
          menuOpen
            ? "opacity-100 pointer-events-auto translate-y-0"
            : "opacity-0 pointer-events-none -translate-y-2",
        )}
      >
        <div className="mx-3 mt-2 rounded-2xl border border-border bg-surface/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden">
          <nav className="p-2 flex flex-col">
            {variant === "marketing" &&
              MARKETING_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="px-4 py-3 rounded-xl text-sm text-foreground hover:bg-white/5 transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            <div className="my-1 h-px bg-border" />
            {isAuthenticated && displayUser ? (
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 rounded-xl text-sm text-foreground hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <Avatar user={displayUser} size={24} />
                <span>{displayUser.name ?? "Profile"}</span>
                {user && (
                  <span
                    className={cn(
                      "ml-auto text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border",
                      tierBadgeClass(user.plan),
                    )}
                  >
                    {user.tier}
                  </span>
                )}
              </Link>
            ) : isSessionLoading ? (
              <div
                className="mx-2 my-2 h-9 rounded-xl border border-border bg-surface/40 animate-pulse"
                aria-hidden
              />
            ) : (
              <>
                <Link
                  href="/auth"
                  onClick={() => setMenuOpen(false)}
                  className="px-4 py-3 rounded-xl text-sm text-foreground hover:bg-white/5 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth?mode=signup"
                  onClick={() => setMenuOpen(false)}
                  className="mt-1 mx-2 px-4 py-3 rounded-full text-sm font-medium bg-accent text-black text-center hover:brightness-110 transition-all shadow-[0_0_24px_-6px_rgba(184,227,201,0.7)]"
                >
                  Sign up free
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </>
  );
}

function Avatar({
  user,
  size,
}: {
  user: { image: string | null; name: string };
  size: number;
}) {
  if (user.image) {
    return (
      <Image
        src={user.image}
        alt={user.name}
        width={size}
        height={size}
        className="rounded-full border border-border object-cover"
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }
  return (
    <span
      className="rounded-full bg-accent text-black grid place-items-center text-[11px] font-semibold uppercase"
      style={{ width: size, height: size }}
    >
      {user.name?.[0] ?? "U"}
    </span>
  );
}

function tierBadgeClass(plan: "free" | "pro" | "ultra") {
  if (plan === "ultra") return "bg-gold/10 text-gold border-gold/40";
  if (plan === "pro") return "bg-silver/10 text-silver border-silver/40";
  return "bg-bronze/10 text-bronze border-bronze/40";
}

// Minimal user shape the navbar Avatar needs. Both the zustand `useUser`
// store and a raw NextAuth session can be projected into this — see
// `displayUser` above. Keeping this local on purpose so we don't leak a
// half-typed "user" concept to the rest of the app.
type NavbarDisplayUser = { image: string | null; name: string };

function sessionToDisplayUser(
  session: { user?: { name?: string | null; image?: string | null } | null } | null | undefined,
): NavbarDisplayUser | null {
  const u = session?.user;
  if (!u) return null;
  return {
    name: u.name ?? "You",
    image: u.image ?? null,
  };
}
