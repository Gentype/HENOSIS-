import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { icon: 22, text: "text-base" },
  md: { icon: 28, text: "text-lg" },
  lg: { icon: 40, text: "text-2xl" },
} as const;

/**
 * Henosis logo — a soft, glowing geometric mark next to a refined wordmark.
 * The mark is a stylized "infinity / unity" knot inscribed in a circle,
 * echoing the Greek meaning of henosis ("union, oneness").
 */
export function Logo({ className, showWordmark = true, size = "md" }: LogoProps) {
  const s = SIZES[size];
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        className="drop-shadow-[0_0_12px_rgba(184,227,201,0.45)]"
      >
        <defs>
          <linearGradient id="henosis-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#b8e3c9" />
            <stop offset="100%" stopColor="#6dd99e" />
          </linearGradient>
        </defs>
        <circle cx="20" cy="20" r="18.5" stroke="url(#henosis-grad)" strokeWidth="1.25" opacity="0.6" />
        <path
          d="M11 24 C 11 16, 17 12, 20 20 C 23 28, 29 24, 29 16"
          stroke="url(#henosis-grad)"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="20" cy="20" r="2.2" fill="#b8e3c9" />
      </svg>
      {showWordmark && (
        <span
          className={cn(
            "font-semibold tracking-tight text-foreground",
            s.text,
          )}
        >
          henosis
        </span>
      )}
    </span>
  );
}
