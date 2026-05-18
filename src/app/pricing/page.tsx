"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Aurora } from "@/components/aurora";
import { Check, Sparkles, Crown, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/store";
import { useRouter } from "next/navigation";

interface Tier {
  id: "free" | "pro" | "ultra";
  name: string;
  price: string;
  period: string;
  blurb: string;
  features: string[];
  badge?: string;
  highlight?: boolean;
  glowClass: string;
  priceClass: string;
  auroraVariant: "tier-bronze" | "tier-silver" | "tier-gold";
  border: string;
  metal: string;
  icon: React.ElementType;
  iconColor: string;
}

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Bronze",
    price: "$0",
    period: "forever",
    blurb: "Try Henosis. Generate a few sites — see how good it is.",
    features: [
      "3 generations total",
      "Standard models (Claude Sonnet, GPT-4o, Gemini)",
      "Live preview & file tree",
      "Chat-powered edits",
    ],
    glowClass: "tier-bronze",
    priceClass: "tier-price-bronze",
    auroraVariant: "tier-bronze",
    border: "border-[rgba(192,133,82,0.45)]",
    metal: "text-bronze",
    icon: Shield,
    iconColor: "text-bronze",
  },
  {
    id: "pro",
    name: "Silver",
    price: "$19",
    period: "per month",
    blurb: "For builders shipping real projects.",
    features: [
      "50 generations / month",
      "All standard models",
      "Faster generation queue",
      "Project history & versions",
      "Export full HTML/CSS/JS",
    ],
    glowClass: "tier-silver",
    priceClass: "tier-price-silver",
    auroraVariant: "tier-silver",
    border: "border-[rgba(199,201,209,0.55)]",
    metal: "text-silver",
    icon: Sparkles,
    iconColor: "text-silver",
    highlight: true,
    badge: "Most popular",
  },
  {
    id: "ultra",
    name: "Gold",
    price: "$49",
    period: "per month",
    blurb: "Unlimited firepower for agencies and serial founders.",
    features: [
      "Unlimited generations",
      "All models + Claude Opus 4.1 & GPT-4.1",
      "Priority queue (2× speed)",
      "Custom system prompts",
      "Team workspace",
      "Premium support",
    ],
    glowClass: "tier-gold",
    priceClass: "tier-price-gold",
    auroraVariant: "tier-gold",
    border: "border-[rgba(240,200,97,0.65)]",
    metal: "text-gold",
    icon: Crown,
    iconColor: "text-gold",
  },
];

export default function PricingPage() {
  const router = useRouter();
  const user = useUser((s) => s.user);
  const setPlan = useUser((s) => s.setPlan);
  // Use the NextAuth session as the ground truth for "is the user signed
  // in?" — `useUser` only hydrates after /api/me resolves, so gating the
  // upgrade button on it would bounce a freshly-signed-in user back to
  // /auth?mode=signup, which is the "site keeps asking me to register"
  // bug. Session is SSR-resolved so it's correct on the first render.
  const { status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const isSessionLoading = sessionStatus === "loading";
  const [pending, setPending] = useState<Tier["id"] | null>(null);

  async function choose(tier: Tier["id"]) {
    // Don't bounce the user anywhere while the session is still resolving;
    // wait one tick instead of accidentally treating them as anonymous.
    if (isSessionLoading) return;
    if (!isAuthenticated) {
      router.push("/auth?mode=signup");
      return;
    }
    if (pending) return;
    setPending(tier);
    try {
      // Simulated checkout — in production this would hit Stripe, then a
      // webhook would call setPlan server-side.
      await setPlan(tier);
      router.push("/profile");
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 relative">
        {/* Page-wide subtle aurora */}
        <Aurora variant="subtle" />

        <section className="relative z-[2] mx-auto max-w-7xl px-5 lg:px-8 pt-16 pb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md text-xs text-muted fade-up">
            Pricing
          </div>
          <h1 className="hero-headline mt-5 text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05] fade-up-delay-1">
            Pick your tier.
          </h1>
          <p className="mt-4 text-muted max-w-xl mx-auto fade-up-delay-2">
            Hover over the cards — each tier comes alive in its own metal: bronze,
            silver, gold.
          </p>
        </section>

        <section className="relative z-[2] mx-auto max-w-7xl px-5 lg:px-8 pb-20">
          <div className="grid gap-6 md:grid-cols-3">
            {TIERS.map((t) => (
              <TierCard
                key={t.id}
                tier={t}
                onChoose={() => choose(t.id)}
                currentPlan={user?.plan ?? null}
                pending={pending === t.id}
              />
            ))}
          </div>

          <div className="mt-20 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              Need more? <span className="text-accent">Enterprise plans</span> are available.
            </h2>
            <p className="mt-2 text-muted">Custom integrations, SSO, and white-label.</p>
            <Link
              href="#"
              className="mt-5 inline-flex items-center gap-2 rounded-full font-medium px-5 py-2.5 text-sm border border-border bg-surface hover:bg-elevated transition-colors"
            >
              Contact sales
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function TierCard({
  tier,
  onChoose,
  currentPlan,
  pending,
}: {
  tier: Tier;
  onChoose: () => void;
  currentPlan: "free" | "pro" | "ultra" | null;
  pending: boolean;
}) {
  const Icon = tier.icon;
  const isCurrent = currentPlan === tier.id;

  return (
    <div
      className={cn(
        "tier-sweep glass relative overflow-hidden rounded-3xl border p-8 flex flex-col",
        "tilt-hover",
        tier.border,
        tier.glowClass,
        tier.highlight && "scale-[1.015]",
      )}
    >
      {/* Tier-tinted blob glow behind the card */}
      <Aurora variant={tier.auroraVariant} />

      <div className="relative z-[2] flex items-center justify-between">
        <div className={cn("inline-flex items-center gap-2", tier.iconColor)}>
          <Icon className="w-5 h-5" />
          <span className="text-sm font-medium uppercase tracking-wider">
            {tier.name}
          </span>
        </div>
        {tier.badge && (
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full border border-current uppercase tracking-wider", tier.iconColor)}>
            {tier.badge}
          </span>
        )}
      </div>

      <div className="relative z-[2] mt-6">
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "text-5xl font-semibold tracking-tight",
              tier.priceClass,
            )}
          >
            {tier.price}
          </span>
          <span className="text-sm text-muted">/ {tier.period}</span>
        </div>
        <p className="mt-3 text-sm text-muted">{tier.blurb}</p>
      </div>

      <ul className="relative z-[2] mt-7 space-y-3 text-sm">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <Check className={cn("w-4 h-4 mt-0.5 shrink-0", tier.iconColor)} />
            <span className="text-foreground/90">{f}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onChoose}
        disabled={isCurrent || pending}
        className={cn(
          "relative z-[2] mt-8 inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors",
          "tilt-hover",
          tier.id === "ultra"
            ? "bg-gold/15 text-gold border border-gold/60 hover:bg-gold/25"
            : tier.id === "pro"
              ? "bg-silver/15 text-silver border border-silver/60 hover:bg-silver/25"
              : "bg-bronze/15 text-bronze border border-bronze/60 hover:bg-bronze/25",
          (isCurrent || pending) && "opacity-60 cursor-default",
        )}
      >
        {pending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Switching…
          </>
        ) : isCurrent ? (
          "Current plan"
        ) : tier.id === "free" ? (
          "Start free"
        ) : (
          `Upgrade to ${tier.name}`
        )}
      </button>
    </div>
  );
}
