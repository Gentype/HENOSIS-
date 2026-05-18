/**
 * Analyze Engine — Henosis "Quality Check" classifier.
 *
 * Runs BEFORE the heavy site-generation call. The user clicks Generate,
 * sees a "Проверка качества продукта" loading screen, and this small AI
 * call returns a 1–10 complexity score plus a recommended page set and
 * tech stack. The main /api/generate call then receives the score so the
 * Site Architect knows how hard to push.
 *
 * Output is a tiny JSON object — kept small on purpose so it streams back
 * in well under a second:
 *
 *   {
 *     "score": 7,
 *     "tier": "Multi-page product clone",
 *     "reasoning": "YouTube-style клон требует меню-бар, анимации и 4+ страниц.",
 *     "recommendedPages": ["Home","Watch","Channel","Search","Library"],
 *     "stack": "react-ts"
 *   }
 *
 * `reasoning` MUST match the language of the user's prompt.
 */
export const ANALYZE_PROMPT = `You are Henosis Quality Inspector. Your job is to read a user's website-build prompt and classify how hard / how big / how serious it is on a 1–10 scale BEFORE the main Site Architect starts coding.

You do NOT build the site. You ONLY return a small JSON classification.

Output a single valid JSON object — no markdown fences, no commentary — matching exactly:

{
  "score": <integer 1–10>,
  "tier": "<short label, 2–5 words, in English>",
  "reasoning": "<one sentence explaining WHY this score, in the user's language>",
  "recommendedPages": ["Home", "..."],
  "stack": "html" | "react-ts"
}

Stack values:
  - "html"     — vanilla HTML + CSS + JS (no build step). Use when score ≤ 4.
  - "react-ts" — React + TypeScript multi-file project. Use when score ≥ 5.

There are no other valid stack values.

────────────────────────────────────────────────────────────────────────────
COMPLEXITY RUBRIC (Henosis spec)
────────────────────────────────────────────────────────────────────────────

1/10 — Sticker / placeholder. "404 page", "hello world", "сделай надпись".
  Stack: html. Pages: 1.

2/10 — Tiny single-block page. "coming soon page", "personal name card".
  Stack: html. Pages: 1.

3/10 — Simple one-section landing. "small landing for my book", "wedding invite".
  Stack: html. Pages: 1.

4/10 — Full content landing OR a newspaper / blog feed page. Hero + a couple
  of sections, no interaction. "create me a site like a newspaper where some
  information is shown", "cafe landing with menu list".
  Stack: html. Pages: 1.

5/10 — Polished single-page site with real animations: scroll reveals,
  hover micro-interactions, multiple sections, mobile menu. Still one page.
  "premium landing for a startup", "agency homepage with case studies".
  Stack: react-ts. Pages: 1–2.

6/10 — Two-view React app: landing + a meaningful secondary view (Pricing,
  Menu, Features). Real animations. Sticky nav.
  Stack: react-ts. Pages: 2.

7/10 — Multi-view React+TS product clone: real navbar, multiple views (3+),
  tasteful animations, interactive widgets that feel like a product (search
  bar, filters, modal). "make me a YouTube" lands here — full multi-view
  clone but no actual video streaming.
  Stack: react-ts. Pages: 3–5.

8/10 — Polished React+TS product the AI should sweat over: 4+ views, real
  data shape (typed mock JSON), client-side routing via useState,
  shared components, working forms, animations everywhere.
  Stack: react-ts. Pages: 4–6.

9/10 — Production-grade SaaS-clone or e-commerce flow: dashboard layouts,
  multiple linked flows, persistent state (localStorage), complex animations.
  Stack: react-ts. Pages: 5–8.

10/10 — Reserved for users who specify a genuinely complex scheme (detailed
  feature lists, "build me X with A, B, C, D, dashboards, auth flow,
  multi-step onboarding, etc.").
  Stack: react-ts. Pages: 6+.

────────────────────────────────────────────────────────────────────────────
DECISION RULES — be CONSERVATIVE. When in doubt, score LOWER.
────────────────────────────────────────────────────────────────────────────

The default scoring bias is that most prompts are simple landings. Don't
inflate the score just because the prompt uses adjectives like "premium",
"luxury", "modern", "professional", "beautiful", or "stunning" — those say
nothing about size or page count.

1. ONE- or TWO-WORD prompts ("cafe", "shop", "restaurant", "portfolio",
   "ресторан") → score 4 (Content landing, html). NEVER score higher than
   4 for a one/two-word prompt, even if it names a luxury business.

2. If the prompt names a REAL, named, multi-page product to clone — and
   the user actually says "clone" / "like X" / "create me X" referring to
   one of these:
     YouTube, Twitter/X, Spotify, Notion, Linear, Figma, Netflix, TikTok,
     Twitch, Vimeo, Instagram, Reddit, Discord, Slack, Airbnb, Amazon,
     Uber, Trello, Asana
   → minimum 7. NOT 8+ unless the user explicitly asks for dashboards or
   admin panels.

3. The prompt EXPLICITLY enumerates many pages ("with home, pricing,
   features, FAQ, blog, contact", "dashboard with charts and tables",
   "full SaaS with auth, billing, and admin"), or explicitly says
   "много страниц" / "lots of pages" / "multi-page" / "with dashboard"
   → 8 or 9.

4. Words that CAP the score at 4: "tiny", "small", "simple", "minimal",
   "single page", "one page", "landing only", "лендинг", "маленький",
   "простой".

5. Single-business landing prompts (cafe, restaurant, gym, bakery,
   portfolio, agency, hotel, barbershop, dentist, photographer, lawyer)
   WITH a short description → 4. Only score higher if the user asks for:
     - real animations / scroll reveals / mobile menu → 5,
     - a meaningful second page like Pricing or Menu → 6,
     - 3+ explicit pages or a product-clone feel → 7.

6. tier label examples: "Static badge", "Coming-soon", "Simple landing",
   "Content landing", "Animated landing", "Two-page site",
   "Multi-page clone", "Full product", "Production SaaS", "Custom system".

7. recommendedPages always starts with "Home". Length must roughly match
   the score (see rubric).

8. stack:
   - score ≤ 4 → "html"
   - score ≥ 5 → "react-ts"
   NEVER emit "js-modules" or "typescript" — those are deprecated.

9. SCORING SANITY CHECK before you output:
   - Is the prompt ≤ 8 words AND does not name a real product clone?
     → Score must be ≤ 4.
   - Is the user asking for "a website for my [single business]" with no
     page list and no animations? → Score is 4.
   - Did you score ≥ 7? You must be able to point to a concrete trigger:
     a named product clone OR an explicit list of 3+ pages OR an explicit
     mention of dashboards / SaaS flows. If you can't, drop to 5 or 6.

────────────────────────────────────────────────────────────────────────────
LANGUAGE
────────────────────────────────────────────────────────────────────────────

\`reasoning\` MUST be one short sentence in the SAME language as the user's
prompt. Russian prompt → Russian reasoning. English prompt → English
reasoning. Other languages → match.

\`tier\` is always in English (it's a category label used in the UI badge).

────────────────────────────────────────────────────────────────────────────
ABSOLUTE RULES
────────────────────────────────────────────────────────────────────────────

1. Output ONLY the JSON object. Nothing before. Nothing after. No fences.
2. \`score\` is an integer between 1 and 10. Never floats. Never strings.
3. \`recommendedPages\` is an array of 1–8 strings, capitalized.
4. JSON validity: escape every \\" inside string values, escape newlines
   as \\n, no unescaped control chars. The whole response MUST parse with
   JSON.parse.

Now wait for the user's prompt and CLASSIFY.`;

// ---------------------------------------------------------------------------
// analyzePrompt() — runtime helper that hits OpenRouter with ANALYZE_PROMPT
// and returns a typed ComplexityAnalysis. Used by /api/analyze before the
// heavy /api/generate call.
// ---------------------------------------------------------------------------

import type { ComplexityAnalysis } from "./types";

const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Default model for the Quality Check classifier. The classifier output is
 * tiny (~80 tokens), so we pick a small fast model — overridable by the
 * caller in case the user wants the same model they're using for the main
 * generation.
 */
export const DEFAULT_ANALYZE_MODEL =
  process.env.OPENROUTER_ANALYZE_MODEL ?? "openai/gpt-4o-mini";

function authHeaders(): HeadersInit {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY is not set on the server. Add it to .env.local.",
    );
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    "HTTP-Referer": "https://henosis.app",
    "X-Title": "Henosis (Quality Check)",
  };
}

/**
 * Run the Quality Check classifier on a raw user prompt. Returns a
 * normalised {@link ComplexityAnalysis}. Falls back to a sensible default
 * (4/10 content landing) if the model returns malformed JSON — better to
 * keep the user moving than to surface a 500.
 */
export async function analyzePrompt(
  prompt: string,
  model: string = DEFAULT_ANALYZE_MODEL,
): Promise<ComplexityAnalysis> {
  const res = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model,
      max_tokens: 400,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text: ANALYZE_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Quality Check failed: ${res.status} — ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content) {
    return fallbackAnalysis(prompt);
  }
  return normalise(content, prompt);
}

function normalise(raw: string, prompt: string): ComplexityAnalysis {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    return fallbackAnalysis(prompt);
  }
  if (!parsed || typeof parsed !== "object") {
    return fallbackAnalysis(prompt);
  }
  const obj = parsed as Record<string, unknown>;

  const rawScore = Number(obj.score);
  const score = Number.isFinite(rawScore)
    ? Math.max(1, Math.min(10, Math.round(rawScore)))
    : 4;

  const stack = coerceStack(obj.stack, score);
  const tier = typeof obj.tier === "string" && obj.tier.trim()
    ? obj.tier.trim()
    : defaultTier(score);
  const reasoning =
    typeof obj.reasoning === "string" && obj.reasoning.trim()
      ? obj.reasoning.trim()
      : defaultReasoning(score);

  let pages: string[] = [];
  if (Array.isArray(obj.recommendedPages)) {
    pages = obj.recommendedPages
      .filter((p): p is string => typeof p === "string")
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 8);
  }
  if (pages.length === 0) pages = defaultPages(score);
  if (!pages.some((p) => p.toLowerCase() === "home")) pages.unshift("Home");

  return {
    score,
    stack,
    tier,
    reasoning,
    recommendedPages: pages,
  };
}

function coerceStack(
  v: unknown,
  score: number,
): ComplexityAnalysis["stack"] {
  // Map deprecated values ("js-modules" / "typescript") onto the new
  // canonical "react-ts" so older saved projects keep loading.
  if (v === "html") return "html";
  if (v === "react-ts" || v === "js-modules" || v === "typescript") {
    return "react-ts";
  }
  if (score <= 4) return "html";
  return "react-ts";
}

function stripFences(s: string): string {
  const fenced = s.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  if (fenced) return fenced[1];
  return s.trim();
}

function defaultTier(score: number): string {
  if (score <= 1) return "Static badge";
  if (score === 2) return "Coming-soon";
  if (score === 3) return "Simple landing";
  if (score === 4) return "Content landing";
  if (score === 5) return "Animated landing";
  if (score === 6) return "Two-page site";
  if (score === 7) return "Multi-page clone";
  if (score === 8) return "Full product";
  if (score === 9) return "Production SaaS";
  return "Custom system";
}

function defaultPages(score: number): string[] {
  if (score <= 4) return ["Home"];
  if (score <= 6) return ["Home", "Features"];
  if (score === 7) return ["Home", "Browse", "Detail", "Search"];
  if (score === 8) return ["Home", "Browse", "Detail", "Account", "Search"];
  if (score === 9)
    return ["Home", "Dashboard", "Settings", "Billing", "Account", "Help"];
  return ["Home", "Dashboard", "Settings", "Billing", "Account", "Help", "API"];
}

function defaultReasoning(score: number): string {
  return `Estimated ${score}/10 from prompt keywords.`;
}

function fallbackAnalysis(prompt: string): ComplexityAnalysis {
  // Conservative keyword heuristic for the fallback path so the UI still
  // shows a believable score when the model API is unreachable. The bias
  // is to UNDERSCORE rather than overscore — most prompts are simple
  // landings.
  const p = prompt.toLowerCase();

  // Explicit "small / simple" markers — cap at 3.
  if (
    /(tiny|small|simple|minimal|single page|one page|coming soon|404|landing only|маленьк|простой|лендинг)/.test(
      p,
    )
  ) {
    return {
      score: 3,
      stack: "html",
      tier: "Simple landing",
      reasoning: "Prompt asked for a small / single-page build.",
      recommendedPages: ["Home"],
    };
  }

  // Explicit named product clones — 7/10.
  if (
    /(youtube|youtub|ютуб|spotify|twitter\b|twitter\/x|netflix|tiktok|twitch|vimeo|instagram|reddit|notion|linear|figma|slack|airbnb|amazon|trello|asana)/.test(
      p,
    )
  ) {
    return {
      score: 7,
      stack: "react-ts",
      tier: "Multi-page clone",
      reasoning: "Names a real multi-page product — defaulted to 7/10.",
      recommendedPages: ["Home", "Browse", "Detail", "Search", "Library"],
    };
  }

  // Explicit "dashboard / many pages / SaaS flow" markers — 8/10.
  if (
    /(dashboard|admin panel|saas with|многo страниц|with pricing.*features|auth flow|onboarding flow|billing flow)/.test(
      p,
    )
  ) {
    return {
      score: 8,
      stack: "react-ts",
      tier: "Full product",
      reasoning: "Prompt asks for dashboards / multi-flow product — 8/10.",
      recommendedPages: [
        "Home",
        "Dashboard",
        "Settings",
        "Billing",
        "Account",
      ],
    };
  }

  // Default: most short prompts are simple landings.
  return {
    score: 4,
    stack: "html",
    tier: "Content landing",
    reasoning: "Defaulted to a 4/10 content landing.",
    recommendedPages: ["Home"],
  };
}
