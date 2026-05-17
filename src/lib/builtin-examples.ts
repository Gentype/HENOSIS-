/**
 * Built-in few-shot examples for the OpenRouter chat completion.
 *
 * These are NOT the same as the UI showcase tiles in `examples.ts` — those
 * are user-facing prompt buttons. These are tiny canonical user→assistant
 * conversations injected before the user's real prompt to anchor the model
 * on:
 *   - the exact JSON output shape (meta + files + preview + optional
 *     plan/notes/userSummary),
 *   - the "vanilla HTML + CSS variables + IntersectionObserver" idiom from
 *     SYSTEM_PROMPT,
 *   - language-matching for `userSummary` (the assistant replies in the
 *     same language as the user prompt).
 *
 * Even a weak model that's never seen Henosis before will reliably produce
 * valid output after seeing 1–2 of these.
 *
 * Each `assistant.content` is a JSON string that parses with `JSON.parse`.
 * The HTML inside is intentionally minimal — the system prompt sets the
 * complexity bar; these examples set the *shape*.
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
  /** Order matters: user turn first, then a single assistant turn. */
  conversation: {
    role: "user" | "assistant";
    /** Assistant content is a JSON string conforming to GenerateResult. */
    content: string;
  }[];
}

// ---------------------------------------------------------------------------
// Tiny representative HTML / CSS bodies — kept short on purpose so 1–2
// examples fit easily into the model's context. Real outputs are much
// longer; the system prompt is the source of truth for size.
// ---------------------------------------------------------------------------

const SAUDADE_INDEX = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Saudade · Specialty Coffee</title><link rel="stylesheet" href="styles.css"></head><body><header class="nav"><a class="logo" href="index.html">Saudade</a><nav><a href="pages/menu.html">Menu</a><a href="pages/about.html">About</a><a href="pages/contact.html">Contact</a></nav></header><section class="hero"><p class="eyebrow reveal-up">Specialty Coffee · Est. 2019</p><h1 class="hero-h1 reveal-up delay-1">Coffee that<br><span class="accent">wakes your soul.</span></h1><p class="hero-sub reveal-up delay-2">Single-origin beans, roasted fresh weekly in Lisbon.</p><a class="btn-primary reveal-up delay-3" href="pages/menu.html">View Our Menu</a></section><footer><p>© 2025 Saudade · Rua das Flores 12, Lisboa</p></footer><script src="script.js"></script></body></html>`;

const SAUDADE_STYLES = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');:root{--color-bg:#1A0F0A;--color-text:#F5EDE3;--color-accent:#D4956A;--font-display:'Playfair Display',serif;--font-body:'DM Sans',sans-serif}*{box-sizing:border-box;margin:0;padding:0}body{background:var(--color-bg);color:var(--color-text);font-family:var(--font-body)}.nav{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;padding:20px 32px;backdrop-filter:blur(8px)}.nav a{color:var(--color-text);text-decoration:none;margin-left:24px}.logo{font-family:var(--font-display);font-size:22px}.hero{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:0 32px;background:radial-gradient(circle at 30% 20%,#3a2418 0%,var(--color-bg) 60%)}.eyebrow{letter-spacing:.18em;text-transform:uppercase;font-size:12px;opacity:.7}.hero-h1{font-family:var(--font-display);font-size:clamp(44px,7vw,92px);line-height:1.05;margin:16px 0}.accent{color:var(--color-accent)}.hero-sub{max-width:520px;opacity:.8;margin-bottom:32px}.btn-primary{display:inline-block;width:fit-content;background:var(--color-accent);color:#1A0F0A;padding:14px 28px;border-radius:14px;text-decoration:none;font-weight:500}.reveal-up{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s ease}.reveal-up.in{opacity:1;transform:none}.delay-1{transition-delay:.1s}.delay-2{transition-delay:.2s}.delay-3{transition-delay:.3s}footer{padding:32px;font-size:14px;opacity:.6;border-top:1px solid rgba(255,255,255,.08)}`;

const SAUDADE_SCRIPT = `const io=new IntersectionObserver(es=>es.forEach(e=>e.isIntersecting&&e.target.classList.add('in')),{threshold:.1});document.querySelectorAll('.reveal-up').forEach(el=>io.observe(el));`;

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

const MIRA_INDEX = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mira · AI Support That Actually Helps</title><link rel="stylesheet" href="styles.css"></head><body><header class="nav"><a class="logo" href="#">Mira</a><nav><a href="#features">Features</a><a href="#pricing">Pricing</a><a class="btn-primary" href="#cta">Try free</a></nav></header><section class="hero"><p class="eyebrow reveal-up">AI Customer Support</p><h1 class="hero-h1 reveal-up delay-1">Resolve 73% of tickets<br><span class="accent">before a human reads them.</span></h1><p class="hero-sub reveal-up delay-2">Mira plugs into Zendesk, Intercom and your help center. No prompts to write. No fine-tuning. Live in 4 hours.</p><div class="hero-ctas reveal-up delay-3"><a class="btn-primary" href="#cta">Start free trial</a><a class="btn-ghost" href="#features">See how it works</a></div></section><section id="features" class="features"><h2>Built for support teams who ship.</h2><div class="grid"><article class="card"><h3>One-click ingestion</h3><p>Connect your help center URL. Mira indexes every article in under 10 minutes.</p></article><article class="card"><h3>Confidence-gated handoff</h3><p>If Mira isn't sure, it hands off — never hallucinates a refund policy.</p></article><article class="card"><h3>Resolution analytics</h3><p>See which articles deflect the most tickets, in real time.</p></article></div></section><footer><p>© 2025 Mira · Built in San Francisco</p></footer><script src="script.js"></script></body></html>`;

const MIRA_STYLES = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@500;700&family=DM+Sans:wght@300;400;500&display=swap');:root{--color-bg:#0A0F1E;--color-surface:#10172A;--color-text:#E2E8F0;--color-accent:#6366F1;--font-display:'Syne',sans-serif;--font-body:'DM Sans',sans-serif}*{box-sizing:border-box;margin:0;padding:0}body{background:var(--color-bg);color:var(--color-text);font-family:var(--font-body)}.nav{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;padding:20px 32px;backdrop-filter:blur(12px)}.nav a{color:var(--color-text);text-decoration:none;margin-left:24px}.logo{font-family:var(--font-display);font-size:22px}.hero{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:0 32px;background:radial-gradient(circle at 70% 30%,#1a2444 0%,var(--color-bg) 65%)}.eyebrow{letter-spacing:.18em;text-transform:uppercase;font-size:12px;opacity:.7}.hero-h1{font-family:var(--font-display);font-size:clamp(44px,7vw,92px);line-height:1.05;margin:16px 0}.accent{color:var(--color-accent)}.hero-sub{max-width:560px;opacity:.8;margin-bottom:32px}.hero-ctas{display:flex;gap:12px;flex-wrap:wrap}.btn-primary{background:var(--color-accent);color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:500}.btn-ghost{padding:14px 28px;border-radius:10px;border:1px solid rgba(255,255,255,.18);color:var(--color-text);text-decoration:none}.features{padding:120px 32px}.features h2{font-family:var(--font-display);font-size:48px;margin-bottom:48px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}.card{background:var(--color-surface);padding:32px;border-radius:14px;border:1px solid rgba(255,255,255,.06);transition:transform .2s,box-shadow .2s}.card:hover{transform:translateY(-4px);box-shadow:0 16px 48px rgba(0,0,0,.24)}.card h3{font-family:var(--font-display);font-size:22px;margin-bottom:8px}.reveal-up{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s ease}.reveal-up.in{opacity:1;transform:none}.delay-1{transition-delay:.1s}.delay-2{transition-delay:.2s}.delay-3{transition-delay:.3s}footer{padding:32px;border-top:1px solid rgba(255,255,255,.06);font-size:14px;opacity:.6}`;

const MIRA_SCRIPT = `const io=new IntersectionObserver(es=>es.forEach(e=>e.isIntersecting&&e.target.classList.add('in')),{threshold:.1});document.querySelectorAll('.reveal-up').forEach(el=>io.observe(el));`;

const MIRA_RESULT = {
  plan: [
    "Choose midnight + indigo palette for B2B trust",
    "Sticky transparent nav with one CTA pill",
    "Outcome-first hero (\"73% of tickets\")",
    "3-card feature grid with hover lift",
    "Wire reveal-up animations",
  ],
  notes: [
    "Pricing and FAQ sections would follow on a real build — omitted here for brevity.",
    "Trial signup CTA points to #cta anchor — wire to a real form when ready.",
  ],
  userSummary:
    "Built a single-page B2B SaaS landing for Mira with midnight/indigo palette and outcome-driven copy.",
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

const LENA_INDEX = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lena Park — Product Designer</title><link rel="stylesheet" href="styles.css"></head><body><header class="nav"><a class="logo" href="#">Lena Park</a><nav><a href="#work">Work</a><a href="#about">About</a><a href="mailto:hello@lenapark.com">Email</a></nav></header><section class="hero"><p class="eyebrow reveal-up">Product Designer · NYC</p><h1 class="hero-h1 reveal-up delay-1">Designing tools<br>people <span class="accent">actually keep open</span>.</h1><p class="hero-sub reveal-up delay-2">10 years shipping interfaces at Linear, Notion and three independent SaaS companies.</p></section><section id="work"><h2>Selected work</h2><div class="works"><article class="work"><h3>Linear · Cycles redesign</h3><p>Simplified the cycle planning view to a single board. +24% weekly planning sessions.</p></article><article class="work"><h3>Notion · Mobile editor</h3><p>Led the redesign of block selection on mobile. Cut frustration-clicks by 38%.</p></article><article class="work"><h3>Pylon · End-to-end</h3><p>Brand + product design for a YC support startup. 0→1.</p></article></div></section><footer><p>Lena Park · hello@lenapark.com · @lenapark.design</p></footer><script src="script.js"></script></body></html>`;

const LENA_STYLES = `@import url('https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@500;800&family=DM+Sans:wght@300;400;500&display=swap');:root{--color-bg:#0A0A0A;--color-text:#FFFFFF;--color-accent:#FF3D00;--font-display:'Cabinet Grotesk',sans-serif;--font-body:'DM Sans',sans-serif}*{box-sizing:border-box;margin:0;padding:0}body{background:var(--color-bg);color:var(--color-text);font-family:var(--font-body)}.nav{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;padding:20px 32px}.nav a{color:var(--color-text);text-decoration:none;margin-left:24px}.logo{font-family:var(--font-display);font-weight:800;font-size:20px}.hero{min-height:90vh;display:flex;flex-direction:column;justify-content:center;padding:0 32px}.eyebrow{letter-spacing:.18em;text-transform:uppercase;font-size:12px;opacity:.6}.hero-h1{font-family:var(--font-display);font-weight:800;font-size:clamp(44px,7vw,96px);line-height:1.02;margin:16px 0}.accent{color:var(--color-accent)}.hero-sub{max-width:520px;opacity:.7}#work{padding:80px 32px}#work h2{font-family:var(--font-display);font-weight:500;font-size:32px;opacity:.6;margin-bottom:32px}.works{display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}.work{padding:24px;border:1px solid rgba(255,255,255,.08);border-radius:14px;transition:border-color .2s,transform .2s}.work:hover{border-color:var(--color-accent);transform:translateY(-4px)}.work h3{font-family:var(--font-display);font-size:20px;margin-bottom:6px}.work p{opacity:.75;font-size:14px}.reveal-up{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s ease}.reveal-up.in{opacity:1;transform:none}.delay-1{transition-delay:.1s}.delay-2{transition-delay:.2s}footer{padding:32px;font-size:14px;opacity:.5;border-top:1px solid rgba(255,255,255,.08)}`;

const LENA_SCRIPT = `const io=new IntersectionObserver(es=>es.forEach(e=>e.isIntersecting&&e.target.classList.add('in')),{threshold:.1});document.querySelectorAll('.reveal-up').forEach(el=>io.observe(el));`;

const LENA_RESULT = {
  plan: [
    "Pick black + electric orange palette",
    "Cabinet Grotesk display + DM Sans body",
    "Confident first-person hero",
    "3 case studies with specific outcomes",
    "Hover-border accent on cards",
  ],
  notes: [
    "Case studies use placeholder companies — swap with real client work.",
    "No project detail pages yet — wire later if needed.",
  ],
  userSummary:
    "Built a bold one-page portfolio for product designer Lena Park with black + electric-orange palette and specific case study outcomes.",
  meta: {
    title: "Lena Park",
    description: "Product designer portfolio with selected case studies.",
    primaryColor: "#0A0A0A",
    accentColor: "#FF3D00",
    fontPrimary: "Cabinet Grotesk",
    fontSecondary: "DM Sans",
    pages: ["Home"],
  },
  files: [
    { path: "index.html", content: LENA_INDEX, language: "html" },
    { path: "styles.css", content: LENA_STYLES, language: "css" },
    { path: "script.js", content: LENA_SCRIPT, language: "javascript" },
  ],
  preview: {
    heroHeadline: "Designing tools people actually keep open.",
    heroSubline:
      "10 years shipping interfaces at Linear, Notion and three independent SaaS companies.",
    colorPalette: ["#0A0A0A", "#FF3D00", "#FFFFFF"],
    sections: ["Hero", "Selected Work", "Footer"],
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
    id: "designer-portfolio",
    title: "Designer portfolio (EN prompt)",
    appType: "portfolio",
    keywords: [
      "portfolio",
      "designer",
      "freelance",
      "case studies",
      "портфолио",
      "дизайнер",
    ],
    conversation: [
      {
        role: "user",
        content:
          "Build a minimalist personal portfolio for product designer Lena Park. Black + electric-orange accent, Cabinet Grotesk display. Hero, selected works, footer.",
      },
      {
        role: "assistant",
        content: JSON.stringify(LENA_RESULT),
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Heuristic picker — match the user's prompt to relevant example(s) by
// keyword. Falls back to a stable rotation so the model never sees zero
// examples.
// ---------------------------------------------------------------------------

export function pickRelevantExamples(
  userPrompt: string,
  max = 2,
): BuiltInExample[] {
  const lower = userPrompt.toLowerCase();
  const matched: BuiltInExample[] = [];
  for (const ex of BUILT_IN_EXAMPLES) {
    if (ex.keywords.some((k) => lower.includes(k.toLowerCase()))) {
      matched.push(ex);
      if (matched.length >= max) break;
    }
  }
  if (matched.length > 0) return matched;
  // Stable fallback: rotate based on prompt length so different prompts
  // see different examples (but the same prompt always sees the same
  // example, which makes caching effective).
  const start = userPrompt.length % BUILT_IN_EXAMPLES.length;
  return [
    BUILT_IN_EXAMPLES[start],
    BUILT_IN_EXAMPLES[(start + 1) % BUILT_IN_EXAMPLES.length],
  ].slice(0, max);
}
