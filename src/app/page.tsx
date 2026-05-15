import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { ExamplesGrid } from "@/components/examples-grid";
import { Footer } from "@/components/footer";
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
            className="rounded-2xl border border-border bg-surface/60 p-6 hover:border-accent/40 transition-colors"
          >
            <f.icon className="w-5 h-5 text-accent" />
            <div className="mt-4 text-base font-medium text-foreground">{f.title}</div>
            <div className="mt-1.5 text-sm text-muted">{f.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative mx-auto max-w-5xl px-5 lg:px-8 mt-28 mb-8">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface/60 p-10 sm:p-16 text-center">
        <div className="absolute inset-0 bg-radial-spot pointer-events-none" />
        <h3 className="relative text-3xl sm:text-5xl font-semibold tracking-tight text-foreground">
          Stop wireframing. <span className="text-accent">Start shipping.</span>
        </h3>
        <p className="relative mt-3 text-muted max-w-xl mx-auto">
          Join thousands who launched their first site this week.
        </p>
        <div className="relative mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/auth?mode=signup"
            className="btn-generate inline-flex items-center gap-2 rounded-full font-semibold px-6 py-3 text-base"
          >
            Start free <Sparkles className="w-4 h-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-full font-medium px-6 py-3 text-base border border-border bg-surface hover:bg-elevated transition-colors"
          >
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
