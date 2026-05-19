"use client";

import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { ExamplesGrid } from "@/components/examples-grid";
import { Footer } from "@/components/footer";
import { Aurora } from "@/components/aurora";
import { Marquee } from "@/components/marquee";
import { AnimatedCounter } from "@/components/animated-counter";
import { MagneticHover } from "@/components/magnetic-hover";
import { useScrollReveal } from "@/lib/use-scroll-reveal";
import Link from "next/link";
import { Sparkles, MessageSquareCode, Zap, Gauge, Layers, Boxes } from "lucide-react";

export default function HomePage() {
  // Single IntersectionObserver wires every `.scroll-reveal` element.
  useScrollReveal();

  return (
    <div className="relative min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 relative z-[1]">
        <Hero />
        <ModelMarquee />
        <FeatureStrip />
        <StatsStrip />
        <ExamplesGrid />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

// Powered-by strip — infinite marquee of model providers. The first thing
// users see after the hero, drives home "multi-model" without copy.
const POWERED_BY: ReadonlyArray<string> = [
  "Powered by Claude",
  "GPT-4o",
  "Gemini 2.0",
  "Llama 3",
  "Mistral",
  "Qwen",
  "DeepSeek",
  "Grok",
  "Kimi",
  "Nova",
];

function ModelMarquee() {
  return (
    <section className="relative mt-16 sm:mt-20 scroll-reveal">
      <Marquee items={POWERED_BY} duration={42} className="py-2" />
    </section>
  );
}

function FeatureStrip() {
  const features = [
    {
      icon: Sparkles,
      title: "One-prompt sites",
      body: "Describe what you want. Henosis writes the HTML, CSS, copy and content.",
    },
    {
      icon: MessageSquareCode,
      title: "Edit with chat",
      body: "Iterate live. Ask for changes in plain English. The AI rewrites the files.",
    },
    {
      icon: Zap,
      title: "Ship instantly",
      body: "Preview live, browse the file tree, copy code, deploy anywhere.",
    },
  ];
  return (
    <section className="relative mx-auto max-w-6xl px-5 lg:px-8 mt-24">
      <div className="grid gap-4 sm:grid-cols-3">
        {features.map((f, i) => (
          <div
            key={f.title}
            className={`conic-border glass tilt-hover relative overflow-hidden rounded-2xl p-6 hover:border-accent/40 transition-colors scroll-reveal delay-${i + 1}`}
          >
            <f.icon className="relative z-[2] w-5 h-5 text-accent" />
            <div className="relative z-[2] mt-4 text-base font-medium text-foreground">
              {f.title}
            </div>
            <div className="relative z-[2] mt-1.5 text-sm text-muted">{f.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Three animated counters that ramp up when they scroll into view. The
// numbers are deliberately invented but believable — adjust to true
// metrics once we instrument them.
function StatsStrip() {
  const stats = [
    {
      icon: Boxes,
      label: "Sites generated",
      counter: <AnimatedCounter to={10000} suffix="+" duration={2000} className="font-mono tabular-nums" />,
      hint: "And counting, every day.",
    },
    {
      icon: Layers,
      label: "AI models supported",
      counter: <AnimatedCounter to={50} suffix="+" duration={1600} className="font-mono tabular-nums" />,
      hint: "Claude, GPT-4o, Gemini, Llama, Mistral and more.",
    },
    {
      icon: Gauge,
      label: "Median build time",
      counter: (
        <span className="font-mono tabular-nums">
          &lt;
          <AnimatedCounter to={60} duration={1400} />
          s
        </span>
      ),
      hint: "From prompt to live preview.",
    },
  ];
  return (
    <section className="relative mx-auto max-w-6xl px-5 lg:px-8 mt-24">
      <div className="text-center mb-10 scroll-reveal">
        <p className="text-[11px] uppercase tracking-[0.22em] text-subtle">By the numbers</p>
        <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
          Built for speed. <span className="text-accent">Loved by builders.</span>
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`stat-card conic-border glass relative rounded-2xl p-7 scroll-reveal delay-${i + 1}`}
          >
            <s.icon className="relative z-[2] w-5 h-5 text-accent mb-4" />
            <div className="relative z-[2] text-4xl sm:text-5xl font-semibold text-foreground tracking-tight leading-none">
              {s.counter}
            </div>
            <div className="relative z-[2] mt-3 text-sm text-foreground font-medium">
              {s.label}
            </div>
            <div className="relative z-[2] mt-1 text-xs text-muted leading-relaxed">
              {s.hint}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative mx-auto max-w-5xl px-5 lg:px-8 mt-28 mb-8 scroll-reveal">
      <div className="glass relative overflow-hidden rounded-3xl p-10 sm:p-16 text-center">
        <Aurora variant="vivid" />
        <div className="absolute inset-0 bg-radial-spot pointer-events-none" />
        <h3 className="relative z-[2] text-3xl sm:text-5xl font-semibold tracking-tight text-foreground">
          Stop wireframing. <span className="text-accent">Start shipping.</span>
        </h3>
        <p className="relative z-[2] mt-3 text-muted max-w-xl mx-auto">
          Join thousands who launched their first site this week.
        </p>
        <div className="relative z-[2] mt-8 flex items-center justify-center gap-3 flex-wrap">
          <MagneticHover strength={10}>
            <Link
              href="/auth?mode=signup"
              className="btn-generate inline-flex items-center gap-2 rounded-full font-semibold px-6 py-3 text-base"
            >
              Start free <Sparkles className="w-4 h-4" />
            </Link>
          </MagneticHover>
          <MagneticHover strength={6}>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full font-medium px-6 py-3 text-base border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-md transition-colors"
            >
              See pricing
            </Link>
          </MagneticHover>
        </div>
      </div>
    </section>
  );
}
