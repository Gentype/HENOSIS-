"use client";

import { PromptBox } from "./prompt-box";
import { Aurora, HourglassBeam } from "./aurora";
import { AsciiHands } from "./ascii-hands";
import { CodeParticles } from "./code-particles";

export function Hero() {
  return (
    <section className="relative overflow-hidden min-h-[70vh]">
      {/* Backdrop, back-to-front (palette stays green-white-black):
            1. Soft radial spot — grounds the headline.
            2. Aurora sage blobs + green HourglassBeam centrepiece.
            3. Pure-CSS green ASCII hands reaching in from the corners.
            4. Mouse-interactive gray code particles drifting upward.
          The old grid + flow-stripes + dust were retired — they competed
          too hard with the hourglass and the new hands. */}
      <div className="absolute inset-0 bg-radial-spot pointer-events-none" />
      <Aurora variant="vivid" className="z-[1]" />
      <HourglassBeam className="z-[2]" />
      <AsciiHands />
      <CodeParticles />

      <div className="relative z-[3] mx-auto max-w-7xl px-5 lg:px-8 pt-16 sm:pt-24 lg:pt-32 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md text-xs text-muted fade-up">
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
