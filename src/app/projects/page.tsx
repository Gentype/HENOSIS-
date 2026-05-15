"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useProjects, useUser } from "@/lib/store";
import { ArrowRight, FileCode2, Plus, Trash2, Sparkles } from "lucide-react";
import { relativeTime } from "@/lib/utils";

export default function ProjectsPage() {
  const projects = useProjects((s) => s.projects);
  const remove = useProjects((s) => s.remove);
  const user = useUser((s) => s.user);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-5 lg:px-8 pt-10 pb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                My projects
              </h1>
              <p className="mt-1.5 text-muted">
                {user
                  ? `Signed in as ${user.email}.`
                  : "Sign in to sync projects across devices."}
              </p>
            </div>
            <Link
              href="/"
              className="btn-generate inline-flex items-center gap-2 rounded-full font-semibold px-5 py-2.5 text-sm"
            >
              <Plus className="w-4 h-4" /> New project
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 lg:px-8 pb-16">
          {!hydrated ? (
            <SkeletonGrid />
          ) : projects.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="group relative rounded-2xl border border-border bg-surface/60 p-5 hover:border-accent/40 transition-colors"
                >
                  <button
                    type="button"
                    aria-label="Delete project"
                    onClick={() => {
                      if (confirm("Delete this project? This can't be undone.")) {
                        remove(p.id);
                      }
                    }}
                    className="absolute top-3 right-3 p-1.5 rounded-md text-subtle hover:text-foreground hover:bg-white/5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <Link href={`/generate?id=${encodeURIComponent(p.id)}`} className="block">
                    <div className="flex items-center gap-2 text-xs text-subtle">
                      <FileCode2 className="w-3.5 h-3.5" />
                      <span className="uppercase tracking-wider">
                        {p.result?.meta?.title ?? p.title}
                      </span>
                    </div>
                    <div className="mt-2 text-lg font-medium text-foreground line-clamp-2">
                      {p.title}
                    </div>
                    <div className="mt-1.5 text-sm text-muted line-clamp-2">
                      {p.result?.meta?.description ?? p.prompt}
                    </div>

                    <div className="mt-5 flex items-center justify-between text-xs">
                      <StatusBadge status={p.status} />
                      <span className="text-subtle">{relativeTime(p.updatedAt)}</span>
                    </div>

                    <div className="mt-5 flex items-center text-accent text-sm group-hover:translate-x-1 transition-transform">
                      Open <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function StatusBadge({ status }: { status: "generating" | "done" | "error" }) {
  if (status === "generating")
    return (
      <span className="inline-flex items-center gap-1.5 text-accent">
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        Generating
      </span>
    );
  if (status === "error")
    return <span className="text-red-400">Failed</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-foreground/80">
      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
      Ready
    </span>
  );
}

function EmptyState() {
  return (
    <div className="relative overflow-hidden mt-6 rounded-3xl border border-border bg-surface/60 p-12 text-center">
      <div className="absolute inset-0 bg-radial-spot pointer-events-none" />
      <div className="relative">
        <Sparkles className="w-7 h-7 mx-auto text-accent" />
        <h3 className="mt-4 text-2xl font-semibold tracking-tight">No projects yet</h3>
        <p className="mt-2 text-muted">
          Describe your dream site and Henosis will build it.
        </p>
        <Link
          href="/"
          className="btn-generate inline-flex items-center gap-2 rounded-full font-semibold px-6 py-3 text-sm mt-6"
        >
          Create your first site <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-border bg-surface/60 p-5 h-44 animate-pulse"
        />
      ))}
    </div>
  );
}
