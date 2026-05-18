"use client";

import { useEffect, useState } from "react";
import { Gauge, Loader2, Sparkles, Layers, FileCode2 } from "lucide-react";
import type { ComplexityAnalysis } from "@/lib/types";
import { cn } from "@/lib/utils";

interface QualityCheckOverlayProps {
  visible: boolean;
  analysis?: ComplexityAnalysis;
  /** Silver+ manual override (2–10). Coerces the displayed score. */
  override?: number;
  /** Original user prompt, shown in the header for context. */
  prompt: string;
}

/**
 * "Проверка качества продукта" — the Quality Check loading screen.
 *
 * Renders a full-bleed overlay while the analyzer is running. As soon as
 * the {@link ComplexityAnalysis} resolves we flash the score, tier, stack,
 * recommended pages and reasoning so the user knows the AI has a plan
 * before the heavy generation starts.
 */
export function QualityCheckOverlay({
  visible,
  analysis,
  override,
  prompt,
}: QualityCheckOverlayProps) {
  // Faux animated score ramp while we're waiting for the model. Keeps the
  // ?/10 area from feeling dead.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!visible || analysis) return;
    const id = window.setInterval(() => setTick((t) => (t + 1) % 10), 120);
    return () => window.clearInterval(id);
  }, [visible, analysis]);

  if (!visible) return null;

  const resolvedScore =
    override != null && Number.isFinite(override)
      ? Math.max(2, Math.min(10, Math.round(override)))
      : analysis?.score;

  const resolvedStack: ComplexityAnalysis["stack"] | undefined = (() => {
    if (override != null && Number.isFinite(override)) {
      const s = Math.max(2, Math.min(10, Math.round(override)));
      return s <= 4 ? "html" : s <= 6 ? "js-modules" : "typescript";
    }
    return analysis?.stack;
  })();

  const phase: "analyzing" | "resolved" = analysis ? "resolved" : "analyzing";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quality Check"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-xl px-4"
    >
      <div
        className={cn(
          "qc-card relative w-full max-w-xl rounded-3xl border border-border bg-surface/95 backdrop-blur-md p-6 sm:p-8",
          "shadow-2xl shadow-black/60",
        )}
      >
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-subtle">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span>Quality Check · Проверка качества продукта</span>
        </div>

        <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          {phase === "analyzing"
            ? "Analyzing your idea…"
            : "Plan locked in."}
        </h2>

        <p className="mt-2 text-sm text-muted line-clamp-2">
          “{prompt.length > 140 ? `${prompt.slice(0, 140)}…` : prompt}”
        </p>

        {/* Score gauge */}
        <div className="mt-6 flex items-center gap-5">
          <div
            className={cn(
              "relative grid place-items-center w-24 h-24 rounded-full border border-accent/30 bg-elevated/60",
              phase === "analyzing" && "qc-pulse",
            )}
          >
            <div className="text-center leading-none">
              <span
                className={cn(
                  "block font-mono font-semibold text-foreground",
                  "text-3xl tabular-nums",
                )}
              >
                {resolvedScore != null
                  ? resolvedScore
                  : Math.max(2, Math.min(9, 3 + tick))}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-subtle">
                /10
              </span>
            </div>
            {phase === "analyzing" && (
              <div className="absolute -bottom-1 -right-1">
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <Gauge className="w-4 h-4 text-accent" />
              <span>
                {phase === "analyzing"
                  ? "Scoring complexity…"
                  : analysis?.tier ?? "Tier resolved"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted leading-relaxed">
              {phase === "analyzing"
                ? "Reading the brief, checking pages, choosing a stack."
                : analysis?.reasoning ?? "Building accordingly."}
            </p>
            {override != null && (
              <span className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-accent border border-accent/30 bg-accent/10 px-2 py-0.5 rounded-full">
                Manual override
              </span>
            )}
          </div>
        </div>

        {/* Stack + recommended pages */}
        {phase === "resolved" && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Detail
              icon={Layers}
              label="Stack"
              value={stackLabel(resolvedStack)}
            />
            <Detail
              icon={FileCode2}
              label="Pages"
              value={(analysis?.recommendedPages ?? ["Home"])
                .slice(0, 5)
                .join(" · ")}
            />
          </div>
        )}

        {/* Progress bar */}
        <div className="mt-6 h-1 w-full rounded-full bg-elevated overflow-hidden">
          <div
            className={cn(
              "h-full bg-accent transition-[width] duration-500 ease-out",
              phase === "analyzing" ? "w-1/3 qc-progress" : "w-full",
            )}
          />
        </div>

        <p className="mt-2 text-[11px] text-subtle">
          {phase === "analyzing"
            ? "Step 1 / 2 · Quality Check"
            : "Step 2 / 2 · Site Architect is building…"}
        </p>
      </div>

      {/* Local CSS keyframes — kept inline so we don't touch globals.css. */}
      <style jsx>{`
        .qc-card {
          animation: qc-pop 0.45s cubic-bezier(0.21, 1, 0.34, 1.1) both;
        }
        @keyframes qc-pop {
          0% {
            transform: translateY(12px) scale(0.96);
            opacity: 0;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        .qc-pulse {
          box-shadow: 0 0 0 0 rgba(184, 227, 201, 0.35);
          animation: qc-pulse 1.4s infinite;
        }
        @keyframes qc-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(184, 227, 201, 0.35);
          }
          70% {
            box-shadow: 0 0 0 14px rgba(184, 227, 201, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(184, 227, 201, 0);
          }
        }
        .qc-progress {
          animation: qc-shimmer 1.4s ease-in-out infinite;
        }
        @keyframes qc-shimmer {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(140%);
          }
          100% {
            transform: translateX(280%);
          }
        }
      `}</style>
    </div>
  );
}

function stackLabel(stack?: ComplexityAnalysis["stack"]): string {
  if (stack === "typescript") return "TypeScript project";
  if (stack === "react-ts") return "React + TypeScript";
  if (stack === "js-modules") return "JavaScript modules";
  if (stack === "html") return "Static HTML";
  return "—";
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-elevated/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-subtle">
        <Icon className="w-3 h-3" />
        <span>{label}</span>
      </div>
      <div className="mt-1 text-sm text-foreground truncate">{value}</div>
    </div>
  );
}
