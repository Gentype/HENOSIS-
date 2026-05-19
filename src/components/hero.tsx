"use client";

import { PromptBox } from "./prompt-box";
import { MeshBackground } from "./mesh-background";

export function Hero() {
  return (
    <section className="relative overflow-hidden min-h-[85vh] flex items-center">
      {/* Premium layered background — replaces the old aurora + hourglass
          with a modern mesh gradient + perspective grid + floating orbs +
          film grain + vignette. See mesh-background.tsx for full breakdown. */}
      <MeshBackground />

      {/* Content — sits above all background layers */}
      <div className="relative z-[10] mx-auto max-w-7xl px-5 lg:px-8 pt-16 sm:pt-24 lg:pt-32 pb-20 text-center">
        {/* Live badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl text-xs text-muted fade-up shadow-[0_0_20px_-4px_rgba(184,227,201,0.15)]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
          </span>
          Henosis is live — generate your first site free
        </div>

        {/* Headline */}
        <h1 className="hero-headline mt-7 font-semibold tracking-tight text-balance leading-[1.05] fade-up-delay-1 text-5xl sm:text-7xl lg:text-[88px]">
          Build a stunning website
          <br />
          <span className="text-accent">from one prompt.</span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-muted text-pretty fade-up-delay-2 leading-relaxed">
          Henosis turns your idea into a complete, production-ready site — design,
          copy, sections and code — in under a minute. Iterate with chat. Ship today.
        </p>

        {/* Prompt box */}
        <div className="mt-10 fade-up-delay-3">
          <PromptBox large autoFocus={false} />
        </div>

        {/* Trust line */}
        <div className="mt-6 text-xs text-subtle fade-up-delay-3 flex items-center justify-center gap-3">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-white/10" />
          No credit card required • Powered by Claude, GPT-4o, Gemini
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-white/10" />
        </div>
      </div>
    </section>
  );
}
