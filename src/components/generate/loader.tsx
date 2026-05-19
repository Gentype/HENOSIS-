"use client";

import { cn } from "@/lib/utils";

/**
 * Henosis loaders — a small component family that replaces the generic
 * `<Loader2>` spinner across the generate page with bespoke shapes that
 * match the brand (sage on black, soft glow, no grey rotating arcs).
 *
 * Variants:
 *   - `dots`    — three dots that bounce in stagger. Use in chat thinking
 *                 bubbles and inline status copy.
 *   - `orbital` — a small core with two counter-rotating rings around it.
 *                 Vercel-style. Use when the loader needs presence (status
 *                 pills in the menu bar, the empty preview hero, etc.).
 *   - `ring`    — an SVG progress ring. Pass `progress` (0-1) for a
 *                 determinate fill, omit for indeterminate sweep. Used by
 *                 the Quality Check overlay.
 */
export interface OrbitalLoaderProps {
  /** Diameter in px. Default 24. */
  size?: number;
  className?: string;
  /** Optional aria-label override (default: "Loading"). */
  label?: string;
}

export function OrbitalLoader({ size = 24, className, label = "Loading" }: OrbitalLoaderProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("orbit-loader", className)}
      style={{ width: size, height: size }}
    >
      <span className="orbit-loader__core" />
      <span className="orbit-loader__ring orbit-loader__ring--1" />
      <span className="orbit-loader__ring orbit-loader__ring--2" />
      <span className="orbit-loader__ring orbit-loader__ring--3" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export interface DotsLoaderProps {
  className?: string;
  label?: string;
}

/**
 * Three sage dots bouncing in stagger. The "AI is composing" indicator —
 * far less aggressive than a spinning loader and lets the user know the
 * model is working without commanding visual attention.
 */
export function DotsLoader({ className, label = "Composing" }: DotsLoaderProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("dots-bouncing", className)}
    >
      <span />
      <span />
      <span />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export interface ProgressRingProps {
  /** Diameter in px. */
  size: number;
  /** Stroke width. Default 4. */
  strokeWidth?: number;
  /** Progress in [0..1]. Omit for indeterminate sweep. */
  progress?: number;
  className?: string;
  /** Centred children — typically a number / score. */
  children?: React.ReactNode;
}

/**
 * SVG progress ring. The track sits on the outside; a sage stroke fills
 * over it as `progress` rises. Pass `progress` for determinate (e.g. the
 * resolved Quality Check score), omit for an indeterminate sweep used
 * while we're still waiting on the analyzer.
 *
 * The ring uses CSS variables so the sweep keyframes can reference the
 * correct circumference — `--ring-circ` is set inline based on size.
 */
export function ProgressRing({
  size,
  strokeWidth = 4,
  progress,
  className,
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  const isIndeterminate = progress == null || !Number.isFinite(progress);
  const clamped = isIndeterminate ? 0 : Math.max(0, Math.min(1, progress));
  const offset = circ * (1 - clamped);

  return (
    <span
      className={cn("relative inline-grid place-items-center", className)}
      style={
        {
          width: size,
          height: size,
          ["--ring-circ" as string]: String(circ),
        } as React.CSSProperties
      }
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="qc-ring-bg"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={isIndeterminate ? circ * 0.75 : offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={cn(
            "qc-ring-fg",
            isIndeterminate && "qc-ring-fg--indeterminate",
          )}
        />
      </svg>
      {children != null && (
        <span className="absolute inset-0 grid place-items-center">
          {children}
        </span>
      )}
    </span>
  );
}
