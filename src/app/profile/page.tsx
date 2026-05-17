"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useUser, useProjects } from "@/lib/store";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Crown, LogOut, Sparkles, Shield } from "lucide-react";
import Link from "next/link";
import { cn, relativeTime } from "@/lib/utils";
import type { Plan } from "@/lib/types";

export default function ProfilePage() {
  const router = useRouter();
  const user = useUser((s) => s.user);
  const signOut = useUser((s) => s.signOut);
  const projects = useProjects((s) => s.projects);
  const clearProjects = useProjects((s) => s.clear);
  // Use the NextAuth session as the canonical "is the browser signed in?"
  // signal — it's SSR-resolved via SessionProvider's `initialSession`, so
  // it's correct on the very first client render. The `useUser` zustand
  // store fills in *after* `/api/me` returns, which can be slow or, on a
  // misconfigured deploy (e.g. Vercel without `KV_REST_API_URL`), fail
  // entirely — and that's exactly the path that left a freshly-signed-in
  // user staring at a "Not signed in" page asking them to register again.
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const isSessionLoading = sessionStatus === "loading";
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Show "Not signed in" only after the session has resolved to
  // "unauthenticated". A still-loading session means we have no answer
  // yet — render a quiet skeleton instead of accusing the user.
  if (hydrated && !isSessionLoading && !isAuthenticated) {
    return (
      <>
        <Navbar />
        <main className="flex-1 mx-auto max-w-2xl px-5 lg:px-8 py-24 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Not signed in</h1>
          <p className="mt-2 text-muted">Sign in to see your profile.</p>
          <Link
            href="/auth"
            className="btn-generate mt-6 inline-flex items-center gap-2 rounded-full font-semibold px-6 py-3 text-sm"
          >
            Sign in
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  if (!hydrated || !isAuthenticated) {
    return (
      <>
        <Navbar />
        <main className="flex-1" />
        <Footer />
      </>
    );
  }

  // At this point we know the user *is* signed in. `user` (from /api/me)
  // may still be hydrating — fall back to the session's user fields so
  // we can render the page immediately. Tier/quota/joinedAt come from
  // our server, so they only render when `user` arrives.
  const sessionUser = session?.user;
  const displayName = user?.name ?? sessionUser?.name ?? "You";
  const displayEmail = user?.email ?? sessionUser?.email ?? "";
  const displayImage = user?.image ?? sessionUser?.image ?? null;

  const pct =
    !user || user.limit == null
      ? 0
      : Math.min(100, (user.generationsUsed / user.limit) * 100);

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-5 lg:px-8 pt-10 pb-16">
          <div className="flex items-center gap-4">
            {displayImage ? (
              <Image
                src={displayImage}
                alt={displayName}
                width={64}
                height={64}
                className="w-16 h-16 rounded-full border border-border object-cover"
                unoptimized
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-accent text-black grid place-items-center text-2xl font-semibold uppercase">
                {displayName?.[0] ?? "U"}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{displayName}</h1>
              <div className="text-muted">{displayEmail}</div>
              {user && (
                <div className="text-xs text-subtle mt-0.5">
                  Joined {relativeTime(user.joinedAt)}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                signOut();
                router.push("/");
              }}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-surface/60 hover:bg-surface text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface/60 p-6">
              {user ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PlanIcon plan={user.plan} />
                      <div>
                        <div className="text-xs uppercase tracking-wider text-subtle">
                          Current tier
                        </div>
                        <div className="text-lg font-medium">{user.tier}</div>
                      </div>
                    </div>
                    <Link
                      href="/pricing"
                      className="text-sm text-accent hover:underline underline-offset-4"
                    >
                      Manage →
                    </Link>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Generations used</span>
                      <span className="font-medium">
                        {user.generationsUsed} / {user.limit == null ? "∞" : user.limit}
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-elevated overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          pct > 80
                            ? "bg-red-400"
                            : pct > 50
                              ? "bg-gold"
                              : "bg-accent",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                // `/api/me` hasn't resolved yet (or failed on a deploy without
                // KV configured). Show a neutral skeleton instead of a scary
                // error so the user knows they ARE signed in — tier/quota
                // will fill in once the server responds.
                <div className="py-2">
                  <div className="text-xs uppercase tracking-wider text-subtle">
                    Current tier
                  </div>
                  <div className="mt-2 h-6 w-24 rounded bg-elevated animate-pulse" />
                  <div className="mt-6 text-sm text-muted">
                    Loading your tier & quota…
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-6">
              <div className="text-xs uppercase tracking-wider text-subtle">
                Projects
              </div>
              <div className="text-3xl font-semibold mt-1">{projects.length}</div>
              <p className="text-sm text-muted mt-1">
                {projects.filter((p) => p.status === "done").length} ready, {" "}
                {projects.filter((p) => p.status === "generating").length} in progress.
              </p>
              <div className="mt-4 flex gap-2 flex-wrap">
                <Link
                  href="/projects"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface hover:bg-elevated text-sm px-4 py-2 transition-colors"
                >
                  View all
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        "Delete all local projects? This only affects this device.",
                      )
                    ) {
                      clearProjects();
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface hover:bg-elevated text-sm px-4 py-2 transition-colors text-muted"
                >
                  Clear projects
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function PlanIcon({ plan }: { plan: Plan }) {
  if (plan === "ultra")
    return <Crown className="w-5 h-5 text-gold drop-shadow-[0_0_10px_rgba(240,200,97,0.7)]" />;
  if (plan === "pro")
    return <Sparkles className="w-5 h-5 text-silver drop-shadow-[0_0_10px_rgba(199,201,209,0.6)]" />;
  return <Shield className="w-5 h-5 text-bronze drop-shadow-[0_0_10px_rgba(192,133,82,0.6)]" />;
}
