import { cn } from "@/lib/utils";

/**
 * Aurora — ambient full-bleed glow that sits behind a section.
 *
 * Four heavily-blurred radial blobs (sage / violet / cyan / magenta) drift
 * on independent loops. The whole thing is `position: absolute; inset: 0;`
 * so the parent section must be `relative`, and content above the aurora
 * needs `relative z-10` (or any higher stacking layer).
 *
 * Variants:
 *   - `subtle` — default; whispered hint of colour. Use site-wide.
 *   - `vivid`  — pumped up for the home hero.
 *   - `tier-{bronze,silver,gold}` — single tinted blob behind a card.
 */
export function Aurora({
  variant = "subtle",
  className,
}: {
  variant?: "subtle" | "vivid" | "tier-bronze" | "tier-silver" | "tier-gold";
  className?: string;
}) {
  if (
    variant === "tier-bronze" ||
    variant === "tier-silver" ||
    variant === "tier-gold"
  ) {
    return (
      <div
        aria-hidden
        className={cn(`aurora--${variant}`, className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn("aurora", variant === "vivid" && "aurora--vivid", className)}
    >
      <div className="aurora__blob aurora__blob--sage" />
      <div className="aurora__blob aurora__blob--violet" />
      <div className="aurora__blob aurora__blob--cyan" />
      <div className="aurora__blob aurora__blob--magenta" />
    </div>
  );
}

/**
 * RefractionBeam — chromatic-dispersion rainbow streak.
 * Six thin angled rainbow bars that drift across the section. Use sparingly
 * (one per page) — the effect is meant to feel rare and precious.
 */
export function RefractionBeam({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("refraction-beam", className)}>
      <div className="refraction-beam__bar" />
      <div className="refraction-beam__bar" />
      <div className="refraction-beam__bar" />
      <div className="refraction-beam__bar" />
      <div className="refraction-beam__bar" />
      <div className="refraction-beam__bar" />
    </div>
  );
}
