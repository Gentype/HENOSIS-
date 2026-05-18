"use client";

import { PromptBox } from "./prompt-box";
import { AsciiHands } from "./ascii-hands";
import { CodeParticles } from "./code-particles";

export function Hero() {
  return (
    <section className="relative overflow-hidden min-h-[60vh]">
      {/* Backdrop, three layers, all behind the foreground (z < 2):
            1. Soft radial spot — kept, it grounds the headline.
            2. Green ASCII hands reaching up from the bottom corners.
            3. Mouse-interactive gray code particles floating up. */}
      <div className="absolute inset-0 bg-radial-spot pointer-events-none" />
      <AsciiHands />
      <CodeParticles />

      <div className="relative z-[2] mx-auto max-w-7xl px-5 lg:px-8 pt-16 sm:pt-24 lg:pt-32 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface/60 backdrop-blur text-xs text-muted fade-up">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
          </span>
          Henosis is live — generate your first site free
        </div>

        <h1 className="hero-headline mt-6 font-semibold tracking-tight text-balance leading-[1.05] fade-up-delay-1 text-5xl sm:text-7xl lg:text-[88px]">
          Build a stunning website
          <br />
          from one prompt.
        </h1>

        <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-muted text-pretty fade-up-delay-2">
          Henosis turns your idea into a complete, production-ready site — design,
          copy, sections and code — in under a minute. Iterate with chat. Ship today.
        </p>

        <div className="mt-10 fade-up-delay-3">
          <PromptBox large autoFocus={false} />
        </div>

        <div className="mt-6 text-xs text-subtle fade-up-delay-3">
          No credit card required • Powered by Claude, GPT-4o, Gemini
        </div>
      </div>
    </section>
  );
}
