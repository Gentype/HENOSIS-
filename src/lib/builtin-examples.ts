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
 *     SYSTEM_PROMPT,
 *   - **PROPERLY FORMATTED multi-line HTML / CSS / JS** — never minified
 *     onto a single line, because the model otherwise copies that pattern
 *     and emits `index.html · 1 lines`,
 *   - the **multi-file project tree** (package.json, tsconfig.json,
 *     src/*.ts) that high-complexity (≥5) builds must ship alongside the
 *     iframe-runnable runtime files,
 *   - language-matching for `userSummary` (the assistant replies in the
 *     same language as the user prompt).
 *
 * Each example carries a `complexity` band so the picker can show the
 * model an example whose size matches the user's target score:
 *   3–4  → reformatted HTML-only examples (Saudade / Mira),
 *   5–6  → Bloom Studio (js-modules, animated agency landing),
 *   7–10 → Stream (typescript multi-file product clone).
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
// js-modules example — Bloom Studio agency (5/10 animated landing).
//
// The runtime iframe still loads only index.html / styles.css / script.js.
// Alongside those we emit a real-looking project tree (package.json,
// src/main.js, src/reveal.js, README.md) so the user sees an IDE-style
// file explorer rather than 3 lonely files.
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
    <header class="nav">
      <a class="logo" href="#">Bloom</a>
      <nav class="nav-links">
        <a href="#work">Work</a>
        <a href="#services">Services</a>
        <a href="#process">Process</a>
        <a class="btn-primary" href="#contact">Start a project</a>
      </nav>
      <button class="nav-burger" aria-label="Open menu">≡</button>
    </header>

    <section class="hero">
      <p class="eyebrow reveal-up">Independent Studio · Berlin</p>
      <h1 class="hero-h1 reveal-up delay-1">
        We design brands<br />
        <span class="accent">people remember.</span>
      </h1>
      <p class="hero-sub reveal-up delay-2">
        Identity, web, and product design for startups who refuse to look like
        everyone else. Booking Q3 — 2 spots left.
      </p>
      <div class="hero-ctas reveal-up delay-3">
        <a class="btn-primary" href="#contact">Get in touch</a>
        <a class="btn-ghost" href="#work">See selected work</a>
      </div>
    </section>

    <section id="work" class="work">
      <h2 class="reveal-up">Selected work</h2>
      <div class="work-grid">
        <article class="work-card reveal-up">
          <h3>Field & Fern · D2C</h3>
          <p>Identity + Shopify storefront. 4× repeat-purchase rate in 90 days.</p>
        </article>
        <article class="work-card reveal-up delay-1">
          <h3>Atlas Health · SaaS</h3>
          <p>Brand + marketing site for a $4M seed. Featured on Designspiration.</p>
        </article>
        <article class="work-card reveal-up delay-2">
          <h3>Onda Coffee · Hospitality</h3>
          <p>Wordmark, packaging, and ordering site for a Lisbon micro-roaster.</p>
        </article>
      </div>
    </section>

    <section id="services" class="services">
      <h2 class="reveal-up">What we make</h2>
      <ul class="service-list">
        <li class="reveal-up">Brand identity systems</li>
        <li class="reveal-up delay-1">Marketing &amp; product websites</li>
        <li class="reveal-up delay-2">Design systems and component libraries</li>
        <li class="reveal-up delay-3">Packaging &amp; print</li>
      </ul>
    </section>

    <footer>
      <p>© 2025 Bloom Studio · Auguststrasse 64, Berlin · hello@bloom.studio</p>
    </footer>

    <script type="module" src="script.js"></script>
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
.btn-primary { background: var(--color-accent); color: #fff; padding: 14px 28px; border-radius: 10px; text-decoration: none; }
.btn-ghost { padding: 14px 28px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.18); color: var(--color-text); text-decoration: none; }

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

const BLOOM_SCRIPT = `import { mountReveals } from './src/reveal.js';
import { mountMobileMenu } from './src/menu.js';

mountReveals();
mountMobileMenu();
`;

const BLOOM_MAIN_JS = `import { mountReveals } from './reveal.js';
import { mountMobileMenu } from './menu.js';

mountReveals();
mountMobileMenu();
`;

const BLOOM_REVEAL_JS = `export function mountReveals() {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
    { threshold: 0.1 },
  );
  document.querySelectorAll('.reveal-up').forEach((el) => io.observe(el));
}
`;

const BLOOM_MENU_JS = `export function mountMobileMenu() {
  const btn = document.querySelector('.nav-burger');
  const links = document.querySelector('.nav-links');
  if (!btn || !links) return;
  btn.addEventListener('click', () => {
    links.classList.toggle('open');
  });
  links.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => links.classList.remove('open'));
  });
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
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^5.4.0"
  }
}
`;

const BLOOM_README = `# Bloom Studio

Marketing site for Bloom Studio, an independent brand & web design studio in Berlin.

## Stack

Vanilla HTML + CSS + ES modules. No framework. The runtime entry is \`index.html\`; \`script.js\` is the bundled equivalent of the modules in \`src/\`.

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
    "Sticky translucent navbar with mobile hamburger",
    "Hero with stagger reveal + dual CTA",
    "Selected work grid with hover lift",
    "Service list with accent bullet rule",
    "Wire reveals + mobile menu via ES modules",
  ],
  notes: [
    "Contact CTA points to #contact anchor — wire to a real form when ready.",
    "All work names are placeholder — swap with real case studies before shipping.",
  ],
  userSummary:
    "Built an animated agency landing for Bloom Studio with sticky nav, mobile menu, hover-lift case studies, and a clean Fraunces serif identity. Source split into ES modules.",
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
    { path: "script.js", content: BLOOM_SCRIPT, language: "javascript" },
    { path: "src/main.js", content: BLOOM_MAIN_JS, language: "javascript" },
    { path: "src/reveal.js", content: BLOOM_REVEAL_JS, language: "javascript" },
    { path: "src/menu.js", content: BLOOM_MENU_JS, language: "javascript" },
    { path: "package.json", content: BLOOM_PACKAGE_JSON, language: "json" },
    { path: "README.md", content: BLOOM_README, language: "markdown" },
  ],
  preview: {
    heroHeadline: "We design brands people remember.",
    heroSubline:
      "Identity, web, and product design for startups who refuse to look like everyone else.",
    colorPalette: ["#F5F0E8", "#FFFFFF", "#FF4D4D", "#1A1A1A"],
    sections: ["Hero", "Work", "Services", "Footer"],
  },
};

// ---------------------------------------------------------------------------
// typescript example — Stream video-platform clone (7/10 multi-page product).
//
// Demonstrates the full TS project shape: package.json + tsconfig.json +
// src/main.ts + src/types.ts + src/data/videos.ts + src/components/*.ts
// alongside the iframe-runnable index.html + styles.css + script.js.
//
// Critical: `index.html` references ONLY `styles.css` + `script.js` (never
// a `.ts` file). The compiled `script.js` mirrors the behavior of
// `src/main.ts` so the two are kept in sync.
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
    <header class="topbar">
      <a class="logo" href="index.html">Stream</a>
      <div class="search">
        <input type="search" placeholder="Search creators, topics, or channels" />
      </div>
      <nav class="topbar-nav">
        <a href="pages/trending.html">Trending</a>
        <a href="pages/library.html">Library</a>
        <a class="btn-pill" href="pages/upload.html">Upload</a>
      </nav>
    </header>

    <main id="app" class="app-shell">
      <aside class="sidebar">
        <a class="side-item active" href="index.html">Home</a>
        <a class="side-item" href="pages/trending.html">Trending</a>
        <a class="side-item" href="pages/library.html">Library</a>
        <a class="side-item" href="pages/upload.html">Upload</a>
        <hr />
        <p class="side-label">Subscriptions</p>
        <a class="side-item" href="#">Casey Foster</a>
        <a class="side-item" href="#">Aria Mendoza</a>
        <a class="side-item" href="#">The Daily Crank</a>
      </aside>

      <section class="grid" id="video-grid">
        <!-- Cards are injected by script.js / src/main.ts -->
      </section>
    </main>

    <footer>
      <p>© 2025 Stream · Demo — no real videos are streamed.</p>
    </footer>

    <script src="script.js"></script>
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
.topbar-nav a { color: var(--color-text-muted); text-decoration: none; font-size: 14px; }
.btn-pill { background: var(--color-accent); color: #fff; padding: 8px 16px; border-radius: 999px; }

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

footer { padding: 32px; color: var(--color-text-muted); font-size: 13px; border-top: 1px solid var(--color-border); }

@media (max-width: 720px) {
  .app-shell { grid-template-columns: 1fr; }
  .sidebar { display: none; }
  .topbar { grid-template-columns: 1fr auto; }
  .search { grid-column: 1 / -1; }
}
`;

const STREAM_SCRIPT = `// Compiled equivalent of src/main.ts — mirrors its behavior so the iframe
// can run without a build step. Keep in sync with the TypeScript source.

const VIDEOS = [
  {
    id: "v1",
    title: "Sailing the Atlantic in 14 days — full doc cut",
    channel: "Casey Foster",
    views: 1240000,
    age: "3 days ago",
    duration: "42:11",
    hue: 18,
  },
  {
    id: "v2",
    title: "I rebuilt my dad's '78 Bronco in 90 days",
    channel: "The Daily Crank",
    views: 612000,
    age: "1 week ago",
    duration: "28:47",
    hue: 200,
  },
  {
    id: "v3",
    title: "Why my pasta dough finally works (after 200 tries)",
    channel: "Aria Mendoza",
    views: 489300,
    age: "2 weeks ago",
    duration: "11:02",
    hue: 340,
  },
  {
    id: "v4",
    title: "Behind a one-person SaaS doing $40k/mo",
    channel: "Indie Cuts",
    views: 220800,
    age: "4 days ago",
    duration: "19:36",
    hue: 270,
  },
  {
    id: "v5",
    title: "First snow in the Dolomites — long take",
    channel: "Field Notes",
    views: 134100,
    age: "5 days ago",
    duration: "07:21",
    hue: 210,
  },
  {
    id: "v6",
    title: "The print shop that survived three recessions",
    channel: "Slow Stories",
    views: 88400,
    age: "2 days ago",
    duration: "23:18",
    hue: 36,
  },
];

function formatViews(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\\.0$/, "") + "M views";
  if (n >= 1000) return (n / 1000).toFixed(0) + "K views";
  return n + " views";
}

function renderVideoCard(v) {
  const card = document.createElement("article");
  card.className = "video-card";
  card.innerHTML = \`
    <div class="thumb" style="background: linear-gradient(135deg, hsl(\${v.hue},70%,28%), hsl(\${v.hue},60%,14%));">
      <span class="duration">\${v.duration}</span>
    </div>
    <h3>\${v.title}</h3>
    <p class="channel">\${v.channel}</p>
    <p class="meta">\${formatViews(v.views)} · \${v.age}</p>
  \`;
  return card;
}

const grid = document.getElementById("video-grid");
if (grid) {
  VIDEOS.forEach((v) => grid.appendChild(renderVideoCard(v)));
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
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "@types/node": "^22.0.0"
  }
}
`;

const STREAM_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
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

- TypeScript (strict)
- Vite for the dev server / build
- Vanilla DOM (no framework)

## Run

\`\`\`bash
npm install
npm run dev
\`\`\`

The runtime entry is \`index.html\` — it links to the bundled \`script.js\` and
\`styles.css\` so the iframe preview can run with no build step.

## Project shape

\`\`\`
index.html            # iframe-renderable entry
styles.css            # design tokens + grid layout
script.js             # compiled equivalent of src/main.ts
src/main.ts           # mounts the home grid
src/types.ts          # Video / Channel domain types
src/data/videos.ts    # mock JSON, cast as const
src/components/...    # component-style render fns
\`\`\`
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
}

export interface Channel {
  id: string;
  name: string;
  subscribers: number;
}
`;

const STREAM_DATA_TS = `import type { Video } from "../types";

export const VIDEOS: readonly Video[] = [
  {
    id: "v1",
    title: "Sailing the Atlantic in 14 days — full doc cut",
    channel: "Casey Foster",
    views: 1_240_000,
    age: "3 days ago",
    duration: "42:11",
    hue: 18,
  },
  {
    id: "v2",
    title: "I rebuilt my dad's '78 Bronco in 90 days",
    channel: "The Daily Crank",
    views: 612_000,
    age: "1 week ago",
    duration: "28:47",
    hue: 200,
  },
  {
    id: "v3",
    title: "Why my pasta dough finally works (after 200 tries)",
    channel: "Aria Mendoza",
    views: 489_300,
    age: "2 weeks ago",
    duration: "11:02",
    hue: 340,
  },
  {
    id: "v4",
    title: "Behind a one-person SaaS doing $40k/mo",
    channel: "Indie Cuts",
    views: 220_800,
    age: "4 days ago",
    duration: "19:36",
    hue: 270,
  },
  {
    id: "v5",
    title: "First snow in the Dolomites — long take",
    channel: "Field Notes",
    views: 134_100,
    age: "5 days ago",
    duration: "07:21",
    hue: 210,
  },
  {
    id: "v6",
    title: "The print shop that survived three recessions",
    channel: "Slow Stories",
    views: 88_400,
    age: "2 days ago",
    duration: "23:18",
    hue: 36,
  },
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

const STREAM_VIDEO_CARD_TS = `import type { Video } from "../types";
import { formatViews } from "../format";

export function renderVideoCard(video: Video): HTMLElement {
  const card = document.createElement("article");
  card.className = "video-card";
  card.innerHTML = \`
    <div class="thumb" style="background: linear-gradient(135deg, hsl(\${video.hue},70%,28%), hsl(\${video.hue},60%,14%));">
      <span class="duration">\${video.duration}</span>
    </div>
    <h3>\${video.title}</h3>
    <p class="channel">\${video.channel}</p>
    <p class="meta">\${formatViews(video.views)} · \${video.age}</p>
  \`;
  return card;
}
`;

const STREAM_MAIN_TS = `import { VIDEOS } from "./data/videos";
import { renderVideoCard } from "./components/VideoCard";

function mountHomeGrid(): void {
  const grid = document.getElementById("video-grid");
  if (!grid) return;
  for (const video of VIDEOS) {
    grid.appendChild(renderVideoCard(video));
  }
}

mountHomeGrid();
`;

const STREAM_RESULT = {
  plan: [
    "Dark UI shell with red accent (#FF0033) — YouTube-like signal color",
    "Sticky topbar with logo, search, Upload CTA",
    "Sidebar with Home / Trending / Library / Subscriptions",
    "Responsive video grid with 16:9 thumbs and hover lift",
    "Mock data shaped as a real Video[] type",
    "TypeScript source tree: main.ts + components + data + types",
    "Compiled equivalent script.js so the iframe runs without a build",
  ],
  notes: [
    "No real videos are streamed — thumbnails are colored gradients, titles are invented.",
    "Trending / Library / Upload pages are linked but only the Home grid is rendered here for brevity.",
    "Subscriptions list is static — wire to mock channels JSON for a real build.",
  ],
  userSummary:
    "Built a 7/10 video-platform clone (Stream) with dark UI, sidebar, sticky search bar, responsive video grid, and a real TypeScript source tree alongside the runtime files.",
  complexity: 7,
  meta: {
    title: "Stream",
    description:
      "Video platform clone with sidebar navigation, search, and a responsive video grid populated from typed mock data.",
    primaryColor: "#0F0F0F",
    accentColor: "#FF0033",
    fontPrimary: "Space Grotesk",
    fontSecondary: "DM Sans",
    pages: ["Home", "Trending", "Library", "Upload"],
  },
  files: [
    { path: "index.html", content: STREAM_INDEX, language: "html" },
    { path: "styles.css", content: STREAM_STYLES, language: "css" },
    { path: "script.js", content: STREAM_SCRIPT, language: "javascript" },
    { path: "package.json", content: STREAM_PACKAGE_JSON, language: "json" },
    { path: "tsconfig.json", content: STREAM_TSCONFIG, language: "json" },
    { path: "README.md", content: STREAM_README, language: "markdown" },
    { path: "src/main.ts", content: STREAM_MAIN_TS, language: "typescript" },
    { path: "src/types.ts", content: STREAM_TYPES_TS, language: "typescript" },
    { path: "src/format.ts", content: STREAM_FORMAT_TS, language: "typescript" },
    { path: "src/data/videos.ts", content: STREAM_DATA_TS, language: "typescript" },
    {
      path: "src/components/VideoCard.ts",
      content: STREAM_VIDEO_CARD_TS,
      language: "typescript",
    },
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
    title: "Animated agency landing (5/10, js-modules)",
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
    title: "Video platform clone (7/10, typescript)",
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
          "Build me a YouTube-style video platform clone called Stream. Dark UI, sticky topbar with search and Upload CTA, sidebar with Home/Trending/Library/Subscriptions, responsive video grid populated from mock data. Multi-page structure, full TypeScript source tree.",
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
// 7/10 prompt should be primed with the typescript multi-file example,
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
 * "8/10" to the typescript example without needing an exact-7/10 match.
 *
 *   1–4  → 0 (html)
 *   5–6  → 1 (js-modules)
 *   7–10 → 2 (typescript)
 */
function complexityBand(score: number): number {
  if (score <= 4) return 0;
  if (score <= 6) return 1;
  return 2;
}
