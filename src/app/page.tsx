import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { ExamplesGrid } from "@/components/examples-grid";
import { Footer } from "@/components/footer";
import { Aurora } from "@/components/aurora";
import Link from "next/link";
import { Sparkles, MessageSquareCode, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <FeatureStrip />
        <ExamplesGrid />
        <FinalCta />
      </main>
      <Footer />
    </>
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
        {features.map((f) => (
          <div
            key={f.title}
            className="glass tilt-hover relative overflow-hidden rounded-2xl p-6 hover:border-accent/40 transition-colors"
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

function FinalCta() {
  return (
    <section className="relative mx-auto max-w-5xl px-5 lg:px-8 mt-28 mb-8">
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
          <Link
            href="/auth?mode=signup"
            className="btn-generate tilt-hover inline-flex items-center gap-2 rounded-full font-semibold px-6 py-3 text-base"
          >
            Start free <Sparkles className="w-4 h-4" />
          </Link>
          <Link
            href="/pricing"
            className="tilt-hover inline-flex items-center gap-2 rounded-full font-medium px-6 py-3 text-base border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-md transition-colors"
          >
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
