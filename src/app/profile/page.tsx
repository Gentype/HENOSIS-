"use client";

import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useUser, useProjects } from "@/lib/store";
import { PLAN_LIMITS } from "@/lib/types";
import { useEffect, useState } from "react";
import { Crown, LogOut, Sparkles, Shield } from "lucide-react";
import Link from "next/link";
import { cn, relativeTime } from "@/lib/utils";

export default function ProfilePage() {
  const router = useRouter();
  const user = useUser((s) => s.user);
  const signOut = useUser((s) => s.signOut);
  const projects = useProjects((s) => s.projects);
  const clearProjects = useProjects((s) => s.clear);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  if (hydrated && !user) {
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

  if (!hydrated || !user) {
    return (
      <>
        <Navbar />
        <main className="flex-1" />
        <Footer />
      </>
    );
  }

  const limit = PLAN_LIMITS[user.plan];
  const pct = Math.min(100, (user.generationsUsed / limit) * 100);

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-5 lg:px-8 pt-10 pb-16">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent text-black grid place-items-center text-2xl font-semibold uppercase">
              {user.name?.[0] ?? "U"}
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{user.name}</h1>
              <div className="text-muted">{user.email}</div>
              <div className="text-xs text-subtle mt-0.5">
                Joined {relativeTime(user.joinedAt)}
              </div>
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlanIcon plan={user.plan} />
                  <div>
                    <div className="text-xs uppercase tracking-wider text-subtle">
                      Current plan
                    </div>
                    <div className="text-lg font-medium capitalize">{user.plan}</div>
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
                    {user.generationsUsed} / {user.plan === "ultra" ? "∞" : limit}
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

function PlanIcon({ plan }: { plan: "free" | "pro" | "ultra" }) {
  if (plan === "ultra")
    return <Crown className="w-5 h-5 text-gold drop-shadow-[0_0_10px_rgba(240,200,97,0.7)]" />;
  if (plan === "pro")
    return <Sparkles className="w-5 h-5 text-silver drop-shadow-[0_0_10px_rgba(199,201,209,0.6)]" />;
  return <Shield className="w-5 h-5 text-bronze drop-shadow-[0_0_10px_rgba(192,133,82,0.6)]" />;
}
