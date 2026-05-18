import { cn } from "@/lib/utils";

/**
 * Aurora — ambient full-bleed glow that sits behind a section.
 *
 * Four heavily-blurred radial blobs in the brand sage palette drift on
 * independent loops. The whole thing is `position: absolute; inset: 0;`
 * so the parent section must be `relative`, and content above the aurora
 * needs `relative z-10` (or any higher stacking layer).
 *
 * The site is intentionally green-white-black only — the older
 * violet / cyan / magenta blobs were removed so the homepage palette
 * stays disciplined. Every blob is a tint of `--aurora-sage` /
 * `--aurora-sage-bright` for depth.
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
      <div className="aurora__blob aurora__blob--sage-2" />
      <div className="aurora__blob aurora__blob--mint" />
      <div className="aurora__blob aurora__blob--white" />
    </div>
  );
}

/**
 * HourglassBeam — two long curved sage beams that pinch toward the centre,
 * inspired by the reference IMG_0744 (two purple light beams converging into
 * an hourglass / X shape). Recoloured in the brand sage so the hero feels
 * dramatic without breaking the green-white-black palette.
 *
 * Implementation: four elongated radial-gradient bars, two angled +18°
 * (top-left → bottom-right) and two -18° (top-right → bottom-left). They
 * cross near the vertical centre, producing the pinch in the middle. Subtle
 * drift animation keeps it alive without distracting.
 */
export function HourglassBeam({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("hourglass-beam", className)}>
      <div className="hourglass-beam__bar hourglass-beam__bar--tl" />
      <div className="hourglass-beam__bar hourglass-beam__bar--tr" />
      <div className="hourglass-beam__bar hourglass-beam__bar--bl" />
      <div className="hourglass-beam__bar hourglass-beam__bar--br" />
      <div className="hourglass-beam__pinch" />
    </div>
  );
}

/**
 * RefractionBeam — legacy rainbow chromatic-dispersion streak.
 *
 * Kept exported (some inner pages may still import it) but it's no longer
 * rendered on the homepage — the green-only palette replaced it with
 * {@link HourglassBeam}. The six bars now all collapse to sage gradients so
 * even if a page still mounts this component the colours stay on-brand.
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
