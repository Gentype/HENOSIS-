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
 *     "stack": "typescript"
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
  "stack": "html" | "js-modules" | "typescript"
}

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
  Stack: js-modules. Pages: 1–2.

6/10 — Two-page site: landing + a meaningful secondary page (Pricing,
  Menu, Features). Real animations. Sticky nav.
  Stack: js-modules. Pages: 2.

7/10 — Multi-page product clone: requires a real menu bar, multiple
  pages (3+), tasteful animations, interactive widgets that feel like a
  product (search bar, filters, modal). "make me a YouTube" lands here —
  full multi-page clone but no actual video streaming.
  Stack: typescript. Pages: 3–5.

8/10 — Polished automatic site the AI should sweat over: 4+ pages, real
  data shape (mock JSON), client-side routing OR multi-page with shared
  components, working forms, animations everywhere.
  Stack: typescript. Pages: 4–6.

9/10 — Production-grade SaaS-clone or e-commerce flow: dashboard layouts,
  multiple linked flows, persistent state, complex animations.
  Stack: typescript. Pages: 5–8.

10/10 — Reserved for users who specify a genuinely complex scheme (detailed
  feature lists, "build me X with A, B, C, D, dashboards, auth flow,
  multi-step onboarding, etc.").
  Stack: typescript. Pages: 6+.

────────────────────────────────────────────────────────────────────────────
DECISION RULES
────────────────────────────────────────────────────────────────────────────

1. If the prompt is one or two words ("cafe", "shop"), default to 4 unless
   it implies a small landing (then 3) — never go higher than 5 from a
   one-word prompt.
2. If the prompt names a real multi-page product to clone (YouTube,
   Twitter/X, Spotify, Notion, Linear, Figma) → at minimum 7.
3. If the prompt explicitly says "lots of pages", "dashboard", "with
   pricing + features + FAQ + blog" → at least 8.
4. If the user explicitly says "tiny", "small", "simple", "single page",
   "one page" → cap at 4.
5. If the user names a SaaS / agency / restaurant / portfolio with no
   extra detail → 6 (standard multi-page).
6. tier label examples: "Static badge", "Coming-soon", "Single landing",
   "Animated landing", "Two-page site", "Multi-page clone", "Full product",
   "Production SaaS", "Custom system".
7. recommendedPages always starts with "Home". Length must roughly match
   the score (see rubric).
8. stack:
   - score ≤ 4 → "html"
   - score 5–6 → "js-modules"
   - score ≥ 7 → "typescript"

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
  if (v === "html" || v === "js-modules" || v === "typescript") return v;
  if (score <= 4) return "html";
  if (score <= 6) return "js-modules";
  return "typescript";
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
  // Very simple keyword heuristic for the fallback path so the UI still
  // shows a believable score when the model API is unreachable.
  const p = prompt.toLowerCase();
  if (
    /(youtube|spotify|twitter|notion|linear|figma|netflix|dashboard|crm)/.test(p)
  ) {
    return {
      score: 7,
      stack: "typescript",
      tier: "Multi-page clone",
      reasoning: "Names a multi-page product — defaulted to 7/10.",
      recommendedPages: ["Home", "Browse", "Detail", "Search", "Library"],
    };
  }
  if (/(tiny|small|simple|single page|one page|coming soon|404)/.test(p)) {
    return {
      score: 3,
      stack: "html",
      tier: "Simple landing",
      reasoning: "Prompt asked for a small / single-page build.",
      recommendedPages: ["Home"],
    };
  }
  return {
    score: 4,
    stack: "html",
    tier: "Content landing",
    reasoning: "Defaulted to a 4/10 content landing.",
    recommendedPages: ["Home"],
  };
}
