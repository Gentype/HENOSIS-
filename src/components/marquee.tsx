"use client";

import { cn } from "@/lib/utils";

interface MarqueeProps {
  /** Items to scroll. Rendered at least twice (back-to-back) to fake the loop. */
  items: ReadonlyArray<string | { label: string; icon?: React.ReactNode }>;
  /** Seconds per full loop. Lower = faster. Default 38. */
  duration?: number;
  /** Reverse direction. Default false (left-to-right). */
  reverse?: boolean;
  className?: string;
}

/**
 * Infinite marquee strip — duplicates `items` once and runs a CSS
 * keyframe to translate the container by 50% (i.e. one full copy)
 * forever. The result is a seamless loop without JavaScript.
 *
 * Used on the homepage to surface "Powered by Claude · GPT-4o ·
 * Gemini · Llama · Mistral · …" so the user sees concrete signal that
 * Henosis is multi-model from the very first second.
 */
export function Marquee({
  items,
  duration = 38,
  reverse,
  className,
}: MarqueeProps) {
  // duplicate the list once so the translate(-50%) loops seamlessly.
  const doubled = [...items, ...items];

  return (
    <div
      className={cn(
        "marquee group relative overflow-hidden",
        className,
      )}
      style={
        {
          ["--marquee-duration" as string]: `${duration}s`,
          ["--marquee-direction" as string]: reverse ? "reverse" : "normal",
        } as React.CSSProperties
      }
    >
      {/* Edge gradient mask — fades the marquee into the page edges so
          you don't see items pop in/out. */}
      <div className="marquee__mask" aria-hidden />

      <div className="marquee__track">
        {doubled.map((item, i) => {
          const label = typeof item === "string" ? item : item.label;
          const icon = typeof item === "string" ? null : item.icon;
          return (
            <span key={`${label}-${i}`} className="marquee__item">
              {icon}
              <span>{label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
