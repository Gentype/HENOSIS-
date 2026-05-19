"use client";

import { useDraft } from "@/lib/store";
import { EXAMPLES } from "@/lib/examples";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExamplesGridProps {
  className?: string;
}

export function ExamplesGrid({ className }: ExamplesGridProps) {
  const setPrompt = useDraft((s) => s.setPrompt);

  return (
    <section className={cn("mx-auto max-w-6xl px-5 lg:px-8 mt-24", className)}>
      <div className="flex items-end justify-between mb-8 flex-wrap gap-3 scroll-reveal">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-subtle">
            Inspiration
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Try one of these examples
          </h2>
          <p className="mt-2 text-muted">
            Click a card to drop its prompt into the box above.
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXAMPLES.map((ex, i) => (
          <button
            key={ex.id}
            type="button"
            onClick={() => {
              setPrompt(ex.prompt);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={cn(
              "group conic-border relative overflow-hidden text-left rounded-2xl border border-border bg-surface/60",
              "hover:border-accent/40 hover:bg-surface transition-all",
              "p-5 min-h-[180px] flex flex-col scroll-reveal",
              i % 4 === 1 && "delay-1",
              i % 4 === 2 && "delay-2",
              i % 4 === 3 && "delay-3",
            )}
          >
            <div
              className={cn(
                "absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity",
                "bg-gradient-to-br pointer-events-none",
                ex.accent,
              )}
              aria-hidden
            />
            <div className="relative flex items-center justify-between mb-2 z-[1]">
              <span className="text-[10px] uppercase tracking-wider text-subtle">
                {ex.category}
              </span>
              <ArrowUpRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="relative z-[1] text-lg font-medium text-foreground">
              {ex.title}
            </div>
            <div className="relative z-[1] text-sm text-muted mt-1 line-clamp-2">
              {ex.description}
            </div>
            <div className="relative z-[1] mt-auto pt-4 text-xs text-subtle line-clamp-2 italic">
              “{ex.prompt.slice(0, 100)}…”
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
