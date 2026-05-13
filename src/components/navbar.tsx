"use client";

import Link from "next/link";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/store";
import { useEffect, useState } from "react";

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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-300",
        scrolled
          ? "backdrop-blur-md bg-black/70 border-b border-border"
          : "bg-transparent border-b border-transparent",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center" aria-label="Henosis home">
          <Logo size="md" />
        </Link>

        {variant === "marketing" && (
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted">
            {MARKETING_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="hover:text-foreground transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">
          {user ? (
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface/60 hover:bg-surface text-sm transition-colors"
            >
              <span className="w-6 h-6 rounded-full bg-accent text-black grid place-items-center text-[11px] font-semibold uppercase">
                {user.name?.[0] ?? "U"}
              </span>
              <span className="hidden sm:inline text-foreground">{user.name}</span>
            </Link>
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
      </div>
    </header>
  );
}
