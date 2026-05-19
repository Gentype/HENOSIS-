"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  /** Target value to count up to. */
  to: number;
  /** Optional starting value. Default 0. */
  from?: number;
  /** Animation duration in ms. Default 1800. */
  duration?: number;
  /** Decimal places. Default 0. */
  decimals?: number;
  /** Prefix string (e.g. "$"). */
  prefix?: string;
  /** Suffix string (e.g. "+", "ms"). */
  suffix?: string;
  /** Optional className for styling the wrapper. */
  className?: string;
  /** Custom format function — overrides `decimals/prefix/suffix` if provided. */
  format?: (value: number) => string;
}

/**
 * AnimatedCounter — counts from `from` to `to` once it scrolls into
 * view, using cubic-out easing so the number decelerates near the
 * target instead of stopping abruptly.
 *
 * Uses IntersectionObserver so off-screen counters don't burn CPU,
 * and only animates once per mount. Honours prefers-reduced-motion
 * by jumping straight to the final value.
 *
 * Used in the homepage stats strip for "10,000+ sites generated",
 * "50+ AI models", "<60s build time".
 */
export function AnimatedCounter({
  to,
  from = 0,
  duration = 1800,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  format,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState<number>(from);
  const startedRef = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      if (reduce) {
        setValue(to);
        return;
      }
      const t0 = performance.now();
      const range = to - from;
      function tick(now: number) {
        const elapsed = now - t0;
        const t = Math.min(1, elapsed / duration);
        // cubic ease-out
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(from + range * eased);
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            start();
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.3 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [to, from, duration]);

  const display = format
    ? format(value)
    : `${prefix}${formatNumber(value, decimals)}${suffix}`;

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}

function formatNumber(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  // Add thousands separators (en-US locale style).
  const [int, frac] = fixed.split(".");
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${withSep}.${frac}` : withSep;
}
