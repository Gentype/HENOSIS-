/**
 * Analyze Engine — Henosis "Quality Check" classifier.
 *
 * The hardcoded "Quality Inspector" instructions used to live here. They
 * have been removed at the user's request. Without a system prompt the
 * model has no idea what JSON shape to return, so {@link analyzePrompt}
 * now falls back to the local keyword heuristic instead of making an
 * OpenRouter call. The same fallback used to run only when the API was
 * unreachable; it is now the only path.
 *
 * Re-introduce instructions here if you want the AI classifier back.
 */
export const ANALYZE_PROMPT = "";

// ---------------------------------------------------------------------------
// analyzePrompt() — runtime helper used by /api/analyze before the heavy
// /api/generate call. Returns a typed ComplexityAnalysis derived from a
// local keyword heuristic.
// ---------------------------------------------------------------------------

import type { ComplexityAnalysis } from "./types";

/**
 * Default model for the Quality Check classifier. Kept as an export for
 * backwards-compatibility with /api/analyze, even though the helper no
 * longer hits OpenRouter while ANALYZE_PROMPT is empty.
 */
export const DEFAULT_ANALYZE_MODEL =
  process.env.OPENROUTER_ANALYZE_MODEL ?? "openai/gpt-4o-mini";

/**
 * Classify a user prompt's complexity. With ANALYZE_PROMPT empty this is
 * a synchronous heuristic, but the function stays async so callers don't
 * need to change.
 */
export async function analyzePrompt(
  prompt: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _model: string = DEFAULT_ANALYZE_MODEL,
): Promise<ComplexityAnalysis> {
  return fallbackAnalysis(prompt);
}

function fallbackAnalysis(prompt: string): ComplexityAnalysis {
  // Conservative keyword heuristic — biased toward UNDERSCORING, since
  // most prompts are simple landings.
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

  // Automation / workflow / integration platforms — 8/10.
  if (
    /(automation|automate|workflow|zapier|n8n|integromat|make\.com|integration\s*platform|no.?code|low.?code|ifttt|webhook|автоматизац|интеграц|воркфлоу)/.test(
      p,
    )
  ) {
    return {
      score: 8,
      stack: "react-ts",
      tier: "Full product",
      reasoning:
        "Automation tool — defaulted to 8/10 for workflow visualization + live runs + integration wall.",
      recommendedPages: [
        "Home",
        "Workflows",
        "Integrations",
        "Templates",
        "Pricing",
      ],
    };
  }

  // Explicit named product clones — 7/10.
  if (
    /(youtube|youtub|ютуб|spotify|twitter\b|twitter\/x|netflix|tiktok|twitch|vimeo|instagram|reddit|notion|linear|figma|slack|airbnb|amazon|trello|asana|airtable|stripe|vercel|supabase|webflow)/.test(
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
