/**
 * Built-in few-shot examples for the OpenRouter chat completion.
 *
 * These are NOT the same as the UI showcase tiles in `examples.ts` — those
 * are user-facing prompt buttons. These are tiny canonical user→assistant
 * conversations injected before the user's real prompt to anchor the model
 * on:
 *   - the exact JSON output shape (meta + files + preview + optional
 *     plan/notes/userSummary/complexity),
 *   - the "vanilla HTML + CSS variables + IntersectionObserver" idiom from
 *     SYSTEM_PROMPT for low-complexity sites (score ≤ 4),
 *   - **PROPERLY FORMATTED multi-line code** — never minified onto a single
 *     line, because the model otherwise copies that pattern and emits
 *     `index.html · 1 lines`,
 *   - the **React + TypeScript multi-file project tree** (package.json,
 *     tsconfig.json, src/main.tsx, src/App.tsx, src/components/*.tsx,
 *     src/types.ts, src/data/*.ts) that high-complexity (≥ 5) builds must
 *     ship, runnable in-iframe via the Henosis Babel + esm.sh runtime,
 *   - language-matching for `userSummary` (the assistant replies in the
 *     same language as the user prompt).
 *
 * Each example carries a `complexity` band so the picker can show the
 * model an example whose size matches the user's target score:
 *   3–4  → reformatted HTML-only examples (Saudade / Mira),
 *   5–6  → Bloom Studio (React + TS animated agency landing),
 *   7–10 → Stream (React + TS multi-page product clone).
 *
 * Each `assistant.content` is a JSON string that parses with `JSON.parse`.
 */

export interface BuiltInExample {
  id: string;
  title: string;
  /**
   * Short tag describing the kind of site. Used by
   * `pickRelevantExamples()` to match the user's prompt heuristically:
   * e.g. "coffee" matches "кофе", "espresso", "cafe".
   */
  appType: string;
  /** Keywords that signal this example fits — checked case-insensitively. */
  keywords: string[];
  /**
   * Complexity band the example demonstrates (1–10). The few-shot picker
   * biases toward the band that matches the user's target score so the
   * model sees output shaped like what it should emit.
   */
  complexity: number;
  /** Order matters: user turn first, then a single assistant turn. */
  conversation: {
    role: "user" | "assistant";
    /** Assistant content is a JSON string conforming to GenerateResult. */
    content: string;
  }[];
}

// ---------------------------------------------------------------------------
// HTML-only example #1 — Saudade coffee shop (3/10 simple landing, RU prompt).
//
// IMPORTANT: every HTML/CSS/JS body uses real multi-line formatting so the
// model copies that pattern. We intentionally do NOT minify here.
// ---------------------------------------------------------------------------

const SAUDADE_INDEX = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Saudade · Specialty Coffee</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="nav">
      <a class="logo" href="index.html">Saudade</a>
      <nav>
        <a href="pages/menu.html">Menu</a>
        <a href="pages/about.html">About</a>
        <a href="pages/contact.html">Contact</a>
      </nav>
    </header>

    <section class="hero">
      <p class="eyebrow reveal-up">Specialty Coffee · Est. 2019</p>
      <h1 class="hero-h1 reveal-up delay-1">
        Coffee that<br />
        <span class="accent">wakes your soul.</span>
      </h1>
      <p class="hero-sub reveal-up delay-2">
        Single-origin beans, roasted fresh weekly in Lisbon.
      </p>
      <a class="btn-primary reveal-up delay-3" href="pages/menu.html">View Our Menu</a>
    </section>

    <footer>
      <p>© 2025 Saudade · Rua das Flores 12, Lisboa</p>
    </footer>

    <script src="script.js"></script>
  </body>
</html>
`;

const SAUDADE_STYLES = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');

:root {
  --color-bg: #1A0F0A;
  --color-text: #F5EDE3;
  --color-accent: #D4956A;
  --font-display: 'Playfair Display', serif;
  --font-body: 'DM Sans', sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}

.nav {
  position: sticky;
  top: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 32px;
  backdrop-filter: blur(8px);
}

.nav a { color: var(--color-text); text-decoration: none; margin-left: 24px; }
.logo { font-family: var(--font-display); font-size: 22px; }

.hero {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 32px;
  background: radial-gradient(circle at 30% 20%, #3a2418 0%, var(--color-bg) 60%);
}

.eyebrow { letter-spacing: .18em; text-transform: uppercase; font-size: 12px; opacity: .7; }
.hero-h1 {
  font-family: var(--font-display);
  font-size: clamp(44px, 7vw, 92px);
  line-height: 1.05;
  margin: 16px 0;
}
.accent { color: var(--color-accent); }
.hero-sub { max-width: 520px; opacity: .8; margin-bottom: 32px; }

.btn-primary {
  display: inline-block;
  width: fit-content;
  background: var(--color-accent);
  color: #1A0F0A;
  padding: 14px 28px;
  border-radius: 14px;
  text-decoration: none;
  font-weight: 500;
}

.reveal-up { opacity: 0; transform: translateY(24px); transition: opacity .6s ease, transform .6s ease; }
.reveal-up.in { opacity: 1; transform: none; }
.delay-1 { transition-delay: .1s; }
.delay-2 { transition-delay: .2s; }
.delay-3 { transition-delay: .3s; }

footer { padding: 32px; font-size: 14px; opacity: .6; border-top: 1px solid rgba(255,255,255,.08); }
`;

const SAUDADE_SCRIPT = `const io = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
  { threshold: 0.1 },
);

document.querySelectorAll('.reveal-up').forEach((el) => io.observe(el));
`;

const SAUDADE_RESULT = {
  plan: [
    "Pick warm espresso palette (#1A0F0A + #D4956A)",
    "Build sticky nav with mobile-friendly links",
    "Hero with eyebrow, H1, subline, CTA — stagger reveal",
    "Wire IntersectionObserver for fade-up reveals",
    "Footer with address + copyright",
  ],
  notes: [
    "Menu/About/Contact pages would follow the same pattern (omitted for brevity in this snippet).",
    "Reservations form would need a backend route — flag to user.",
  ],
  userSummary:
    "Готов сайт кофейни Saudade с тёплой эспрессо-палитрой, sticky-навбаром и анимациями fade-up.",
  complexity: 3,
  meta: {
    title: "Saudade",
    description:
      "Specialty coffee shop in Lisbon, single-origin beans roasted weekly.",
    primaryColor: "#1A0F0A",
    accentColor: "#D4956A",
    fontPrimary: "Playfair Display",
    fontSecondary: "DM Sans",
    pages: ["Home", "Menu", "About", "Contact"],
  },
  files: [
    { path: "index.html", content: SAUDADE_INDEX, language: "html" },
    { path: "styles.css", content: SAUDADE_STYLES, language: "css" },
    { path: "script.js", content: SAUDADE_SCRIPT, language: "javascript" },
  ],
  preview: {
    heroHeadline: "Coffee that wakes your soul.",
    heroSubline: "Single-origin beans, roasted fresh weekly in Lisbon.",
    colorPalette: ["#1A0F0A", "#3A2418", "#D4956A", "#F5EDE3"],
    sections: ["Hero", "Footer"],
  },
};

// ---------------------------------------------------------------------------
// HTML-only example #2 — Mira B2B SaaS landing (4/10, EN prompt).
// ---------------------------------------------------------------------------

const MIRA_INDEX = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Mira · AI Support That Actually Helps</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="nav">
      <a class="logo" href="#">Mira</a>
      <nav>
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>
        <a class="btn-primary" href="#cta">Try free</a>
      </nav>
    </header>

    <section class="hero">
      <p class="eyebrow reveal-up">AI Customer Support</p>
      <h1 class="hero-h1 reveal-up delay-1">
        Resolve 73% of tickets<br />
        <span class="accent">before a human reads them.</span>
      </h1>
      <p class="hero-sub reveal-up delay-2">
        Mira plugs into Zendesk, Intercom and your help center. No prompts to
        write. No fine-tuning. Live in 4 hours.
      </p>
      <div class="hero-ctas reveal-up delay-3">
        <a class="btn-primary" href="#cta">Start free trial</a>
        <a class="btn-ghost" href="#features">See how it works</a>
      </div>
    </section>

    <section id="features" class="features">
      <h2>Built for support teams who ship.</h2>
      <div class="grid">
        <article class="card reveal-up">
          <h3>One-click ingestion</h3>
          <p>Connect your help center URL. Mira indexes every article in under 10 minutes.</p>
        </article>
        <article class="card reveal-up delay-1">
          <h3>Confidence-gated handoff</h3>
          <p>If Mira isn't sure, it hands off — never hallucinates a refund policy.</p>
        </article>
        <article class="card reveal-up delay-2">
          <h3>Resolution analytics</h3>
          <p>See which articles deflect the most tickets, in real time.</p>
        </article>
      </div>
    </section>

    <footer>
      <p>© 2025 Mira · Built in San Francisco</p>
    </footer>

    <script src="script.js"></script>
  </body>
</html>
`;

const MIRA_STYLES = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@500;700&family=DM+Sans:wght@300;400;500&display=swap');

:root {
  --color-bg: #0A0F1E;
  --color-surface: #10172A;
  --color-text: #E2E8F0;
  --color-accent: #6366F1;
  --font-display: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
}

.nav {
  position: sticky;
  top: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 32px;
  backdrop-filter: blur(12px);
}

.nav a { color: var(--color-text); text-decoration: none; margin-left: 24px; }
.logo { font-family: var(--font-display); font-size: 22px; }

.hero {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 32px;
  background: radial-gradient(circle at 70% 30%, #1a2444 0%, var(--color-bg) 65%);
}

.eyebrow { letter-spacing: .18em; text-transform: uppercase; font-size: 12px; opacity: .7; }
.hero-h1 {
  font-family: var(--font-display);
  font-size: clamp(44px, 7vw, 92px);
  line-height: 1.05;
  margin: 16px 0;
}
.accent { color: var(--color-accent); }
.hero-sub { max-width: 560px; opacity: .8; margin-bottom: 32px; }

.hero-ctas { display: flex; gap: 12px; flex-wrap: wrap; }
.btn-primary {
  background: var(--color-accent);
  color: #fff;
  padding: 14px 28px;
  border-radius: 10px;
  text-decoration: none;
  font-weight: 500;
}
.btn-ghost {
  padding: 14px 28px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.18);
  color: var(--color-text);
  text-decoration: none;
}

.features { padding: 120px 32px; }
.features h2 { font-family: var(--font-display); font-size: 48px; margin-bottom: 48px; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}

.card {
  background: var(--color-surface);
  padding: 32px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.06);
  transition: transform .2s, box-shadow .2s;
}
.card:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(0,0,0,.24); }
.card h3 { font-family: var(--font-display); font-size: 22px; margin-bottom: 8px; }

.reveal-up { opacity: 0; transform: translateY(24px); transition: opacity .6s ease, transform .6s ease; }
.reveal-up.in { opacity: 1; transform: none; }
.delay-1 { transition-delay: .1s; }
.delay-2 { transition-delay: .2s; }
.delay-3 { transition-delay: .3s; }

footer { padding: 32px; border-top: 1px solid rgba(255,255,255,.06); font-size: 14px; opacity: .6; }
`;

const MIRA_SCRIPT = `const io = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
  { threshold: 0.1 },
);

document.querySelectorAll('.reveal-up').forEach((el) => io.observe(el));
`;

const MIRA_RESULT = {
  plan: [
    "Choose midnight + indigo palette for B2B trust",
    "Sticky transparent nav with one CTA pill",
    'Outcome-first hero ("73% of tickets")',
    "3-card feature grid with hover lift",
    "Wire reveal-up animations",
  ],
  notes: [
    "Pricing and FAQ sections would follow on a real build — omitted here for brevity.",
    "Trial signup CTA points to #cta anchor — wire to a real form when ready.",
  ],
  userSummary:
    "Built a single-page B2B SaaS landing for Mira with midnight/indigo palette and outcome-driven copy.",
  complexity: 4,
  meta: {
    title: "Mira",
    description:
      "AI customer support that resolves 73% of tickets automatically.",
    primaryColor: "#0A0F1E",
    accentColor: "#6366F1",
    fontPrimary: "Syne",
    fontSecondary: "DM Sans",
    pages: ["Home"],
  },
  files: [
    { path: "index.html", content: MIRA_INDEX, language: "html" },
    { path: "styles.css", content: MIRA_STYLES, language: "css" },
    { path: "script.js", content: MIRA_SCRIPT, language: "javascript" },
  ],
  preview: {
    heroHeadline: "Resolve 73% of tickets before a human reads them.",
    heroSubline:
      "Mira plugs into Zendesk, Intercom and your help center. Live in 4 hours.",
    colorPalette: ["#0A0F1E", "#10172A", "#6366F1", "#E2E8F0"],
    sections: ["Hero", "Features", "Footer"],
  },
};

// ---------------------------------------------------------------------------
// React + TS example #1 — Bloom Studio agency (5/10 animated landing).
//
// This is the canonical shape for "score 5–6" output: index.html is a
// minimal shell with <div id="root"></div>, NO <script src> for libraries.
// The Henosis preview runtime (lib/preview-assembler.ts) injects
// Babel-standalone + an esm.sh importmap and mounts src/main.tsx — the
// model must NOT add <script src="https://..."> for React.
// ---------------------------------------------------------------------------

const BLOOM_INDEX = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Bloom Studio · Brand & Web Design</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

const BLOOM_STYLES = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@500;700&family=DM+Sans:wght@300;400;500&display=swap');

:root {
  --color-bg: #F5F0E8;
  --color-surface: #FFFFFF;
  --color-text: #1A1A1A;
  --color-text-muted: rgba(26,26,26,0.66);
  --color-accent: #FF4D4D;
  --font-display: 'Fraunces', serif;
  --font-body: 'DM Sans', sans-serif;
  --radius-md: 14px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}

.nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 32px;
  background: rgba(245,240,232,0.85);
  backdrop-filter: blur(8px);
}
.nav a { color: var(--color-text); text-decoration: none; margin-left: 24px; }
.logo { font-family: var(--font-display); font-size: 22px; margin-left: 0; }
.nav-burger { display: none; background: none; border: 0; font-size: 28px; cursor: pointer; color: var(--color-text); }
.nav-links.open { display: flex; }

@media (max-width: 720px) {
  .nav-burger { display: block; }
  .nav-links {
    display: none;
    position: absolute;
    top: 64px;
    left: 0;
    right: 0;
    flex-direction: column;
    gap: 12px;
    padding: 24px 32px;
    background: var(--color-surface);
    border-top: 1px solid rgba(0,0,0,0.06);
  }
  .nav-links a { margin-left: 0; }
}

.hero {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 32px;
}
.eyebrow { letter-spacing: .18em; text-transform: uppercase; font-size: 12px; opacity: .65; }
.hero-h1 {
  font-family: var(--font-display);
  font-size: clamp(44px, 7vw, 96px);
  line-height: 1.02;
  margin: 16px 0;
}
.accent { color: var(--color-accent); }
.hero-sub { max-width: 560px; color: var(--color-text-muted); margin-bottom: 32px; }
.hero-ctas { display: flex; gap: 12px; flex-wrap: wrap; }
.btn-primary { background: var(--color-accent); color: #fff; padding: 14px 28px; border-radius: 10px; text-decoration: none; border: 0; font: inherit; cursor: pointer; }
.btn-ghost { padding: 14px 28px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.18); color: var(--color-text); text-decoration: none; background: transparent; font: inherit; cursor: pointer; }

section { padding: 100px 32px; }
section h2 { font-family: var(--font-display); font-size: 44px; margin-bottom: 32px; }

.work-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}
.work-card {
  background: var(--color-surface);
  padding: 32px;
  border-radius: var(--radius-md);
  border: 1px solid rgba(0,0,0,0.06);
  transition: transform .2s, box-shadow .2s;
}
.work-card:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(0,0,0,0.12); }
.work-card h3 { font-family: var(--font-display); font-size: 22px; margin-bottom: 8px; }

.service-list { list-style: none; display: grid; gap: 16px; font-size: 22px; }
.service-list li { padding-left: 28px; position: relative; }
.service-list li::before { content: ""; position: absolute; left: 0; top: 14px; width: 16px; height: 2px; background: var(--color-accent); }

.reveal-up { opacity: 0; transform: translateY(24px); transition: opacity .6s ease, transform .6s ease; }
.reveal-up.in { opacity: 1; transform: none; }
.delay-1 { transition-delay: .1s; }
.delay-2 { transition-delay: .2s; }
.delay-3 { transition-delay: .3s; }

footer { padding: 32px; font-size: 14px; color: var(--color-text-muted); border-top: 1px solid rgba(0,0,0,0.06); }
`;

const BLOOM_MAIN_TSX = `import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
}
`;

const BLOOM_APP_TSX = `import React from "react";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Work } from "./components/Work";
import { Services } from "./components/Services";
import { Footer } from "./components/Footer";
import { useScrollReveal } from "./lib/useScrollReveal";

export function App(): JSX.Element {
  useScrollReveal();
  return (
    <>
      <Nav />
      <Hero />
      <Work />
      <Services />
      <Footer />
    </>
  );
}
`;

const BLOOM_NAV_TSX = `import React, { useState } from "react";

const SECTIONS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "#work",     label: "Work"     },
  { href: "#services", label: "Services" },
  { href: "#about",    label: "About"    },
];

export function Nav(): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <header className="nav">
      <a className="logo" href="#top">Bloom</a>
      <nav className={open ? "nav-links open" : "nav-links"}>
        {SECTIONS.map((s) => (
          <a key={s.href} href={s.href} onClick={() => setOpen(false)}>
            {s.label}
          </a>
        ))}
        <a className="btn-primary" href="#contact" onClick={() => setOpen(false)}>
          Start a project
        </a>
      </nav>
      <button
        type="button"
        className="nav-burger"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "×" : "≡"}
      </button>
    </header>
  );
}
`;

const BLOOM_HERO_TSX = `import React from "react";

export function Hero(): JSX.Element {
  return (
    <section id="top" className="hero">
      <p className="eyebrow reveal-up">Independent Studio · Berlin</p>
      <h1 className="hero-h1 reveal-up delay-1">
        We design brands<br />
        <span className="accent">people remember.</span>
      </h1>
      <p className="hero-sub reveal-up delay-2">
        Identity, web, and product design for startups who refuse to look like
        everyone else. Booking Q3 — 2 spots left.
      </p>
      <div className="hero-ctas reveal-up delay-3">
        <a className="btn-primary" href="#contact">Get in touch</a>
        <a className="btn-ghost" href="#work">See selected work</a>
      </div>
    </section>
  );
}
`;

const BLOOM_WORK_TSX = `import React from "react";

interface CaseStudy {
  title: string;
  blurb: string;
}

const WORK: readonly CaseStudy[] = [
  {
    title: "Field & Fern · D2C",
    blurb: "Identity + Shopify storefront. 4× repeat-purchase rate in 90 days.",
  },
  {
    title: "Atlas Health · SaaS",
    blurb: "Brand + marketing site for a $4M seed. Featured on Designspiration.",
  },
  {
    title: "Onda Coffee · Hospitality",
    blurb: "Wordmark, packaging, and ordering site for a Lisbon micro-roaster.",
  },
] as const;

export function Work(): JSX.Element {
  return (
    <section id="work">
      <h2 className="reveal-up">Selected work</h2>
      <div className="work-grid">
        {WORK.map((item, i) => (
          <article
            key={item.title}
            className={i === 0 ? "work-card reveal-up" : \`work-card reveal-up delay-\${i}\`}
          >
            <h3>{item.title}</h3>
            <p>{item.blurb}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
`;

const BLOOM_SERVICES_TSX = `import React from "react";

const SERVICES: readonly string[] = [
  "Brand identity systems",
  "Marketing & product websites",
  "Design systems and component libraries",
  "Packaging & print",
] as const;

export function Services(): JSX.Element {
  return (
    <section id="services">
      <h2 className="reveal-up">What we make</h2>
      <ul className="service-list">
        {SERVICES.map((s, i) => (
          <li key={s} className={i === 0 ? "reveal-up" : \`reveal-up delay-\${i}\`}>
            {s}
          </li>
        ))}
      </ul>
    </section>
  );
}
`;

const BLOOM_FOOTER_TSX = `import React from "react";

export function Footer(): JSX.Element {
  return (
    <footer id="contact">
      <p>© 2025 Bloom Studio · Auguststrasse 64, Berlin · hello@bloom.studio</p>
    </footer>
  );
}
`;

const BLOOM_USE_SCROLL_REVEAL_TS = `import { useEffect } from "react";

/**
 * Adds the "in" class to every \`.reveal-up\` element when it scrolls into
 * view. Runs once on mount; the IntersectionObserver disconnects itself
 * after each element has been revealed.
 */
export function useScrollReveal(): void {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1 },
    );
    document.querySelectorAll(".reveal-up").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
`;

const BLOOM_PACKAGE_JSON = `{
  "name": "bloom-studio",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Bloom Studio — independent brand & web design agency, Berlin.",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0"
  }
}
`;

const BLOOM_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
`;

const BLOOM_README = `# Bloom Studio

Marketing site for Bloom Studio, an independent brand & web design studio in Berlin.

## Stack

React 19 + TypeScript. The Henosis preview runtime mounts \`src/main.tsx\`
directly from \`index.html\` via Babel + an esm.sh importmap — no build step
is required to view it. For local development run Vite.

## Run

\`\`\`bash
npm install
npm run dev
\`\`\`
`;

const BLOOM_RESULT = {
  plan: [
    "Warm-white + red accent palette (#F5F0E8 / #FF4D4D)",
    "Fraunces display + DM Sans body",
    "Sticky translucent navbar with mobile hamburger (useState)",
    "Hero with stagger reveal + dual CTA",
    "Selected work grid mapped from a typed CaseStudy[] array",
    "Service list mapped from a typed string[]",
    "Wire reveals via a custom useScrollReveal hook",
  ],
  notes: [
    "Contact CTA points to #contact anchor — wire to a real form when ready.",
    "All work names are placeholder — swap with real case studies before shipping.",
  ],
  userSummary:
    "Built an animated agency landing for Bloom Studio in React + TypeScript with sticky nav, mobile menu, hover-lift case studies, and a clean Fraunces serif identity.",
  complexity: 5,
  meta: {
    title: "Bloom Studio",
    description:
      "Independent brand & web design studio for startups that refuse to look like everyone else.",
    primaryColor: "#F5F0E8",
    accentColor: "#FF4D4D",
    fontPrimary: "Fraunces",
    fontSecondary: "DM Sans",
    pages: ["Home", "Contact"],
  },
  files: [
    { path: "index.html", content: BLOOM_INDEX, language: "html" },
    { path: "styles.css", content: BLOOM_STYLES, language: "css" },
    { path: "src/main.tsx", content: BLOOM_MAIN_TSX, language: "tsx" },
    { path: "src/App.tsx", content: BLOOM_APP_TSX, language: "tsx" },
    { path: "src/components/Nav.tsx", content: BLOOM_NAV_TSX, language: "tsx" },
    { path: "src/components/Hero.tsx", content: BLOOM_HERO_TSX, language: "tsx" },
    { path: "src/components/Work.tsx", content: BLOOM_WORK_TSX, language: "tsx" },
    {
      path: "src/components/Services.tsx",
      content: BLOOM_SERVICES_TSX,
      language: "tsx",
    },
    {
      path: "src/components/Footer.tsx",
      content: BLOOM_FOOTER_TSX,
      language: "tsx",
    },
    {
      path: "src/lib/useScrollReveal.ts",
      content: BLOOM_USE_SCROLL_REVEAL_TS,
      language: "typescript",
    },
    { path: "package.json", content: BLOOM_PACKAGE_JSON, language: "json" },
    { path: "tsconfig.json", content: BLOOM_TSCONFIG, language: "json" },
    { path: "README.md", content: BLOOM_README, language: "markdown" },
  ],
  preview: {
    heroHeadline: "We design brands people remember.",
    heroSubline:
      "Identity, web, and product design for startups who refuse to look like everyone else.",
    colorPalette: ["#F5F0E8", "#FFFFFF", "#FF4D4D", "#1A1A1A"],
    sections: ["Nav", "Hero", "Work", "Services", "Footer"],
  },
};

// ---------------------------------------------------------------------------
// React + TS example #2 — Stream video-platform clone (7/10 multi-page product).
//
// Full React + TS project tree: src/main.tsx + src/App.tsx + multiple
// components + src/types.ts + src/data/videos.ts + src/lib/format.ts +
// package.json + tsconfig.json + README.md. Runs in the Henosis preview
// iframe without a build step because the runtime injects Babel + an
// esm.sh importmap and mounts src/main.tsx for you.
// ---------------------------------------------------------------------------

const STREAM_INDEX = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Stream · Watch what people are actually making</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

const STREAM_STYLES = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=DM+Sans:wght@300;400;500&display=swap');

:root {
  --color-bg: #0F0F0F;
  --color-surface: #181818;
  --color-elevated: #242424;
  --color-border: rgba(255,255,255,0.08);
  --color-text: #FAFAFA;
  --color-text-muted: rgba(250,250,250,0.6);
  --color-accent: #FF0033;
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --radius-sm: 8px;
  --radius-md: 14px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: 160px 1fr auto;
  align-items: center;
  gap: 24px;
  padding: 14px 24px;
  background: rgba(15,15,15,0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
}
.logo { font-family: var(--font-display); font-weight: 700; font-size: 22px; color: var(--color-text); text-decoration: none; }
.search input {
  width: 100%;
  max-width: 560px;
  padding: 10px 16px;
  border-radius: 999px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-family: var(--font-body);
}
.topbar-nav { display: flex; gap: 12px; align-items: center; }
.topbar-nav a, .topbar-nav button { color: var(--color-text-muted); text-decoration: none; font-size: 14px; background: transparent; border: 0; font: inherit; cursor: pointer; }
.topbar-link { padding: 6px 10px; border-radius: 8px; transition: background .15s ease, color .15s ease; }
.topbar-link:hover { background: var(--color-surface); color: var(--color-text); }
.topbar-link.active { color: var(--color-text); }
.btn-pill { background: var(--color-accent); color: #fff; padding: 8px 16px; border-radius: 999px; }

.topbar-burger {
  display: none;
  padding: 8px;
  border-radius: 8px;
  color: var(--color-text);
  background: transparent;
  border: 0;
  cursor: pointer;
  transition: background .15s ease;
}
.topbar-burger:hover { background: var(--color-surface); }

.topbar-mobile {
  position: sticky;
  top: 64px;
  z-index: 9;
  display: none;
  flex-direction: column;
  gap: 4px;
  padding: 8px 16px 12px;
  background: rgba(15,15,15,0.96);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
}
.topbar-mobile.open { display: flex; }
.topbar-mobile-item {
  text-align: left;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  background: transparent;
  border: 0;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: background .15s ease, color .15s ease;
}
.topbar-mobile-item:hover { background: var(--color-surface); color: var(--color-text); }
.topbar-mobile-item.active { background: var(--color-surface); color: var(--color-text); }

.app-shell {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 24px;
  padding: 24px;
}

.sidebar { display: flex; flex-direction: column; gap: 4px; }
.side-item {
  display: block;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 14px;
  background: transparent;
  border: 0;
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: background .15s ease, color .15s ease;
}
.side-item:hover { background: var(--color-surface); color: var(--color-text); }
.side-item.active { background: var(--color-surface); color: var(--color-text); }
.sidebar hr { border: 0; border-top: 1px solid var(--color-border); margin: 12px 0; }
.side-label { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-text-muted); padding: 0 14px 6px; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}
.video-card {
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform .2s ease;
}
.video-card:hover { transform: translateY(-2px); }
.thumb {
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-md);
  background: var(--color-elevated);
  position: relative;
  overflow: hidden;
}
.thumb .duration {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0,0,0,0.78);
  color: #fff;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
}
.video-card h3 {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.3;
}
.video-card .channel { color: var(--color-text-muted); font-size: 13px; }
.video-card .meta { color: var(--color-text-muted); font-size: 12px; }

.empty-state { color: var(--color-text-muted); padding: 32px; }

footer { padding: 32px; color: var(--color-text-muted); font-size: 13px; border-top: 1px solid var(--color-border); }

@media (max-width: 720px) {
  .app-shell { grid-template-columns: 1fr; }
  .sidebar { display: none; }
  .topbar { grid-template-columns: 1fr auto; }
  .search { grid-column: 1 / -1; }
  .topbar-link, .btn-pill { display: none; }
  .topbar-burger { display: inline-flex; align-items: center; justify-content: center; }
}
`;

const STREAM_TYPES_TS = `export interface Video {
  id: string;
  title: string;
  channel: string;
  views: number;
  age: string;
  duration: string;
  /** HSL hue used to colorise the placeholder thumbnail gradient. */
  hue: number;
  /** Which sidebar section the video belongs to. */
  category: "home" | "trending" | "library";
}

export interface Channel {
  id: string;
  name: string;
  subscribers: number;
}

export type ViewKey = "home" | "trending" | "library" | "subscriptions";
`;

const STREAM_VIDEOS_DATA_TS = `import type { Video } from "../types";

export const VIDEOS: readonly Video[] = [
  {
    id: "v1",
    title: "Sailing the Atlantic in 14 days — full doc cut",
    channel: "Casey Foster",
    views: 1_240_000,
    age: "3 days ago",
    duration: "42:11",
    hue: 18,
    category: "home",
  },
  {
    id: "v2",
    title: "I rebuilt my dad's '78 Bronco in 90 days",
    channel: "The Daily Crank",
    views: 612_000,
    age: "1 week ago",
    duration: "28:47",
    hue: 200,
    category: "trending",
  },
  {
    id: "v3",
    title: "Why my pasta dough finally works (after 200 tries)",
    channel: "Aria Mendoza",
    views: 489_300,
    age: "2 weeks ago",
    duration: "11:02",
    hue: 340,
    category: "home",
  },
  {
    id: "v4",
    title: "Behind a one-person SaaS doing $40k/mo",
    channel: "Indie Cuts",
    views: 220_800,
    age: "4 days ago",
    duration: "19:36",
    hue: 270,
    category: "trending",
  },
  {
    id: "v5",
    title: "First snow in the Dolomites — long take",
    channel: "Field Notes",
    views: 134_100,
    age: "5 days ago",
    duration: "07:21",
    hue: 210,
    category: "library",
  },
  {
    id: "v6",
    title: "The print shop that survived three recessions",
    channel: "Slow Stories",
    views: 88_400,
    age: "2 days ago",
    duration: "23:18",
    hue: 36,
    category: "home",
  },
] as const;
`;

const STREAM_CHANNELS_DATA_TS = `import type { Channel } from "../types";

export const SUBSCRIPTIONS: readonly Channel[] = [
  { id: "c1", name: "Casey Foster", subscribers: 1_800_000 },
  { id: "c2", name: "Aria Mendoza", subscribers: 412_000 },
  { id: "c3", name: "The Daily Crank", subscribers: 780_000 },
] as const;
`;

const STREAM_FORMAT_TS = `export function formatViews(n: number): string {
  if (n >= 1_000_000) {
    return (n / 1_000_000).toFixed(1).replace(/\\.0$/, "") + "M views";
  }
  if (n >= 1_000) {
    return (n / 1_000).toFixed(0) + "K views";
  }
  return n + " views";
}
`;

const STREAM_MAIN_TSX = `import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
}
`;

const STREAM_APP_TSX = `import React, { useMemo, useState } from "react";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { VideoGrid } from "./components/VideoGrid";
import { VIDEOS } from "./data/videos";
import type { ViewKey } from "./types";

export function App(): JSX.Element {
  const [view, setView] = useState<ViewKey>("home");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const byView =
      view === "home"
        ? VIDEOS
        : view === "subscriptions"
          ? VIDEOS.filter((v) => v.channel !== "Slow Stories")
          : VIDEOS.filter((v) => v.category === view);
    if (!query.trim()) return byView;
    const q = query.toLowerCase();
    return byView.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.channel.toLowerCase().includes(q),
    );
  }, [view, query]);

  return (
    <>
      <TopBar
        view={view}
        onSetView={setView}
        query={query}
        onQueryChange={setQuery}
      />
      <main className="app-shell">
        <Sidebar active={view} onSelect={setView} />
        <VideoGrid videos={filtered} />
      </main>
      <footer>
        <p>© 2025 Stream · Demo — no real videos are streamed.</p>
      </footer>
    </>
  );
}
`;

const STREAM_TOPBAR_TSX = `import React, { useState } from "react";
import type { ViewKey } from "../types";

interface TopBarProps {
  view: ViewKey;
  onSetView: (next: ViewKey) => void;
  query: string;
  onQueryChange: (next: string) => void;
}

const NAV_ITEMS: ReadonlyArray<{ key: ViewKey; label: string }> = [
  { key: "trending", label: "Trending" },
  { key: "library", label: "Library" },
  { key: "subscriptions", label: "Subscriptions" },
];

export function TopBar({
  view,
  onSetView,
  query,
  onQueryChange,
}: TopBarProps): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const handleNav = (next: ViewKey) => {
    onSetView(next);
    setMenuOpen(false);
  };
  return (
    <>
      <header className="topbar">
        {/* Logo — a button, never <a href="#"> */}
        <button
          type="button"
          className="logo"
          onClick={() => handleNav("home")}
          aria-label="Stream home"
        >
          Stream
        </button>
        <div className="search">
          <input
            type="search"
            placeholder="Search creators, topics, or channels"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>
        <nav className="topbar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === view ? "topbar-link active" : "topbar-link"}
              onClick={() => handleNav(item.key)}
            >
              {item.label}
            </button>
          ))}
          <button type="button" className="btn-pill">Upload</button>
          <button
            type="button"
            className="topbar-burger"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen
                ? <path d="M18 6L6 18M6 6l12 12" />
                : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </nav>
      </header>
      <div
        className={menuOpen ? "topbar-mobile open" : "topbar-mobile"}
        role="menu"
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          className={view === "home" ? "topbar-mobile-item active" : "topbar-mobile-item"}
          onClick={() => handleNav("home")}
        >
          Home
        </button>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={item.key === view ? "topbar-mobile-item active" : "topbar-mobile-item"}
            onClick={() => handleNav(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
`;

const STREAM_SIDEBAR_TSX = `import React from "react";
import { SUBSCRIPTIONS } from "../data/channels";
import type { ViewKey } from "../types";

interface SidebarProps {
  active: ViewKey;
  onSelect: (next: ViewKey) => void;
}

const ITEMS: readonly { key: ViewKey; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "trending", label: "Trending" },
  { key: "library", label: "Library" },
  { key: "subscriptions", label: "Subscriptions" },
] as const;

export function Sidebar({ active, onSelect }: SidebarProps): JSX.Element {
  return (
    <aside className="sidebar">
      {ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          className={item.key === active ? "side-item active" : "side-item"}
          onClick={() => onSelect(item.key)}
        >
          {item.label}
        </button>
      ))}
      <hr />
      <p className="side-label">Subscriptions</p>
      {SUBSCRIPTIONS.map((channel) => (
        <button
          key={channel.id}
          type="button"
          className="side-item"
          onClick={() => onSelect("subscriptions")}
        >
          {channel.name}
        </button>
      ))}
    </aside>
  );
}
`;

const STREAM_VIDEO_CARD_TSX = `import React from "react";
import type { Video } from "../types";
import { formatViews } from "../lib/format";

interface VideoCardProps {
  video: Video;
}

export function VideoCard({ video }: VideoCardProps): JSX.Element {
  const gradient = \`linear-gradient(135deg, hsl(\${video.hue},70%,28%), hsl(\${video.hue},60%,14%))\`;
  return (
    <article className="video-card">
      <div className="thumb" style={{ background: gradient }}>
        <span className="duration">{video.duration}</span>
      </div>
      <h3>{video.title}</h3>
      <p className="channel">{video.channel}</p>
      <p className="meta">{formatViews(video.views)} · {video.age}</p>
    </article>
  );
}
`;

const STREAM_VIDEO_GRID_TSX = `import React from "react";
import { VideoCard } from "./VideoCard";
import type { Video } from "../types";

interface VideoGridProps {
  videos: readonly Video[];
}

export function VideoGrid({ videos }: VideoGridProps): JSX.Element {
  if (videos.length === 0) {
    return <p className="empty-state">No videos match that search yet.</p>;
  }
  return (
    <section className="grid">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </section>
  );
}
`;

const STREAM_PACKAGE_JSON = `{
  "name": "stream",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Stream — a video-platform clone (demo). Multi-page UI with mock data.",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0"
  }
}
`;

const STREAM_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
`;

const STREAM_README = `# Stream

A multi-page video-platform clone built as a Henosis demo. UI only — no real
video streaming, no real channels. Mock data lives in \`src/data/videos.ts\`.

## Stack

- React 19 + TypeScript (strict)
- Vite for local dev / build
- Henosis preview runtime (Babel + esm.sh importmap) for the live iframe

## Run

\`\`\`bash
npm install
npm run dev
\`\`\`

## Project shape

\`\`\`
index.html                    # shell with <div id="root"></div>
styles.css                    # design tokens + grid layout
src/main.tsx                  # createRoot(...).render(<App />)
src/App.tsx                   # top-level layout + view state
src/components/TopBar.tsx     # logo, search input, upload CTA
src/components/Sidebar.tsx    # navigation + subscriptions
src/components/VideoCard.tsx  # single video tile
src/components/VideoGrid.tsx  # responsive grid of cards
src/types.ts                  # Video / Channel / ViewKey types
src/data/videos.ts            # typed mock catalogue
src/data/channels.ts          # typed subscriptions list
src/lib/format.ts             # formatViews helper
\`\`\`
`;

const STREAM_RESULT = {
  plan: [
    "Dark UI shell with red accent (#FF0033) — YouTube-like signal color",
    "Sticky topbar with logo button, search input, view-switching nav buttons",
    "Mobile burger menu opens a dropdown with Home / Trending / Library / Subscriptions",
    "Sidebar with Home / Trending / Library / Subscriptions buttons (no <a> for nav)",
    "Responsive video grid with 16:9 thumbs and hover lift",
    "Typed mock catalogue (Video[]) filtered by view + search",
    "Subscriptions panel sourced from a typed Channel[] array",
    "React + TypeScript source tree: App + 4 components + types + data + lib",
  ],
  notes: [
    "No real videos are streamed — thumbnails are colored gradients, titles are invented.",
    "Trending / Library / Subscriptions views filter the same mock catalogue — extend with a backend fetch when ready.",
    "Upload CTA does not open a form — wire to a real route when ready.",
  ],
  userSummary:
    "Built a 7/10 video-platform clone (Stream) in React + TypeScript: dark UI, sidebar navigation, sticky search, responsive video grid, and a typed mock catalogue with filtering.",
  complexity: 7,
  meta: {
    title: "Stream",
    description:
      "Video platform clone with sidebar navigation, search, and a responsive video grid populated from typed mock data.",
    primaryColor: "#0F0F0F",
    accentColor: "#FF0033",
    fontPrimary: "Space Grotesk",
    fontSecondary: "DM Sans",
    pages: ["Home", "Trending", "Library", "Subscriptions"],
  },
  files: [
    { path: "index.html", content: STREAM_INDEX, language: "html" },
    { path: "styles.css", content: STREAM_STYLES, language: "css" },
    { path: "src/main.tsx", content: STREAM_MAIN_TSX, language: "tsx" },
    { path: "src/App.tsx", content: STREAM_APP_TSX, language: "tsx" },
    { path: "src/types.ts", content: STREAM_TYPES_TS, language: "typescript" },
    {
      path: "src/components/TopBar.tsx",
      content: STREAM_TOPBAR_TSX,
      language: "tsx",
    },
    {
      path: "src/components/Sidebar.tsx",
      content: STREAM_SIDEBAR_TSX,
      language: "tsx",
    },
    {
      path: "src/components/VideoCard.tsx",
      content: STREAM_VIDEO_CARD_TSX,
      language: "tsx",
    },
    {
      path: "src/components/VideoGrid.tsx",
      content: STREAM_VIDEO_GRID_TSX,
      language: "tsx",
    },
    {
      path: "src/data/videos.ts",
      content: STREAM_VIDEOS_DATA_TS,
      language: "typescript",
    },
    {
      path: "src/data/channels.ts",
      content: STREAM_CHANNELS_DATA_TS,
      language: "typescript",
    },
    {
      path: "src/lib/format.ts",
      content: STREAM_FORMAT_TS,
      language: "typescript",
    },
    { path: "package.json", content: STREAM_PACKAGE_JSON, language: "json" },
    { path: "tsconfig.json", content: STREAM_TSCONFIG, language: "json" },
    { path: "README.md", content: STREAM_README, language: "markdown" },
  ],
  preview: {
    heroHeadline: "Watch what people are actually making.",
    heroSubline:
      "A multi-page video platform clone with sidebar navigation, search, and a typed mock catalogue.",
    colorPalette: ["#0F0F0F", "#181818", "#242424", "#FF0033", "#FAFAFA"],
    sections: ["Topbar", "Sidebar", "Video grid", "Footer"],
  },
};

// ---------------------------------------------------------------------------
// The actual export — note that `assistant.content` is `JSON.stringify(...)`
// so the messages we send are pure strings, exactly what the model needs to
// see as its training-like context.
// ---------------------------------------------------------------------------

export const BUILT_IN_EXAMPLES: BuiltInExample[] = [
  {
    id: "coffee-shop",
    title: "Coffee shop site (RU prompt)",
    appType: "coffee",
    complexity: 3,
    keywords: [
      "coffee",
      "espresso",
      "cafe",
      "кофе",
      "кофейн",
      "barista",
      "roast",
    ],
    conversation: [
      {
        role: "user",
        content:
          "Сделай минималистичный сайт для specialty-кофейни Saudade в Лиссабоне. Тёплая палитра эспрессо и кремового, шрифт Playfair Display. Главная с hero, footer с адресом.",
      },
      {
        role: "assistant",
        content: JSON.stringify(SAUDADE_RESULT),
      },
    ],
  },
  {
    id: "saas-landing",
    title: "B2B SaaS landing (EN prompt)",
    appType: "saas",
    complexity: 4,
    keywords: [
      "saas",
      "startup",
      "b2b",
      "dashboard",
      "support",
      "ai",
      "стартап",
      "saas-стартап",
    ],
    conversation: [
      {
        role: "user",
        content:
          "Build a dark, premium B2B SaaS landing for an AI customer-support startup called Mira. Outcome-driven hero, 3 feature cards, midnight + indigo palette.",
      },
      {
        role: "assistant",
        content: JSON.stringify(MIRA_RESULT),
      },
    ],
  },
  {
    id: "agency-landing",
    title: "Animated agency landing (5/10, React + TS)",
    appType: "agency",
    complexity: 5,
    keywords: [
      "agency",
      "studio",
      "design",
      "brand",
      "агентство",
      "студия",
      "дизайн",
      "анимаци",
    ],
    conversation: [
      {
        role: "user",
        content:
          "Build a premium one-page agency site for Bloom Studio, an indie brand & web design studio in Berlin. Warm white background, red accent, sticky nav with mobile hamburger, animated scroll reveals, work grid with case studies.",
      },
      {
        role: "assistant",
        content: JSON.stringify(BLOOM_RESULT),
      },
    ],
  },
  {
    id: "video-platform-clone",
    title: "Video platform clone (7/10, React + TS)",
    appType: "product-clone",
    complexity: 7,
    keywords: [
      "youtube",
      "video",
      "stream",
      "twitch",
      "vimeo",
      "tiktok",
      "clone",
      "клон",
      "видео",
      "ютуб",
    ],
    conversation: [
      {
        role: "user",
        content:
          "Build me a YouTube-style video platform clone called Stream. Dark UI, sticky topbar with search and Upload CTA, sidebar with Home/Trending/Library/Subscriptions, responsive video grid populated from mock data. Multi-page structure, full React + TypeScript source tree.",
      },
      {
        role: "assistant",
        content: JSON.stringify(STREAM_RESULT),
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Heuristic picker — match the user's prompt to relevant example(s) by
// keyword AND (optionally) by complexity band. Falls back to a stable
// rotation so the model never sees zero examples.
//
// `complexityScore` (1–10), when provided, biases the picker so the model
// sees an example whose output size matches the user's target — e.g. a
// 7/10 prompt should be primed with the React + TS Stream example,
// NOT a 3/10 coffee shop landing.
// ---------------------------------------------------------------------------

export function pickRelevantExamples(
  userPrompt: string,
  max = 2,
  complexityScore?: number,
): BuiltInExample[] {
  const lower = userPrompt.toLowerCase();
  const keywordMatches = BUILT_IN_EXAMPLES.filter((ex) =>
    ex.keywords.some((k) => lower.includes(k.toLowerCase())),
  );

  // 1. Score-based selection: pick the example whose complexity is closest
  //    to the target. Tie-break by lower complexity (cheaper context).
  let scoreMatch: BuiltInExample | undefined;
  if (typeof complexityScore === "number" && Number.isFinite(complexityScore)) {
    const targetBand = complexityBand(complexityScore);
    const sorted = [...BUILT_IN_EXAMPLES].sort((a, b) => {
      const da = Math.abs(complexityBand(a.complexity) - targetBand);
      const db = Math.abs(complexityBand(b.complexity) - targetBand);
      if (da !== db) return da - db;
      return a.complexity - b.complexity;
    });
    scoreMatch = sorted[0];
  }

  const picked: BuiltInExample[] = [];

  // Always lead with the closest-by-score example when we have a score —
  // that's what anchors the model's output size.
  if (scoreMatch) picked.push(scoreMatch);

  // Then add keyword matches that aren't already in the list.
  for (const ex of keywordMatches) {
    if (picked.length >= max) break;
    if (!picked.find((p) => p.id === ex.id)) picked.push(ex);
  }

  if (picked.length > 0) return picked.slice(0, max);

  // Stable fallback: rotate based on prompt length so different prompts
  // see different examples (but the same prompt always sees the same
  // example, which makes caching effective).
  const start = userPrompt.length % BUILT_IN_EXAMPLES.length;
  return [
    BUILT_IN_EXAMPLES[start],
    BUILT_IN_EXAMPLES[(start + 1) % BUILT_IN_EXAMPLES.length],
  ].slice(0, max);
}

/**
 * Bucket a complexity score into one of three bands so the picker can map
 * "8/10" to the React + TS Stream example without needing an exact-7/10
 * match.
 *
 *   1–4  → 0 (html)
 *   5–6  → 1 (react-ts landing)
 *   7–10 → 2 (react-ts product clone)
 */
function complexityBand(score: number): number {
  if (score <= 4) return 0;
  if (score <= 6) return 1;
  return 2;
}
