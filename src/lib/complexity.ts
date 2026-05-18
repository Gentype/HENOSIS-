/**
 * Complexity scoring — shared types and tier mapping used by:
 *   - /api/assess        (model returns a score, we derive the tier)
 *   - /api/generate      (accepts an assessment and steers the architect)
 *   - the prompt box     (Silver+ manual override)
 *   - the chat panel     (renders the "thinking" step before generation)
 *
 * Tier mapping is fixed by spec:
 *
 *   score 1–3   → "landing"     single index.html, hero + 1–2 sections
 *   score 4–6   → "one-page"    single index.html, full hero + 5–7 sections
 *   score 7     → "two-page"    index.html + one secondary page
 *   score 8–9   → "multi-page"  index.html + 3–4 pages/*.html (full site)
 *   score 10    → "max"         multi-page + maximum polish/interactivity
 */

export type ComplexityTier =
  | "landing"
  | "one-page"
  | "two-page"
  | "multi-page"
  | "max";

export interface ComplexityTierInfo {
  /** Range of scores that map to this tier (inclusive). */
  scoreRange: [number, number];
  /** Short human label, English. */
  label: string;
  /** Slightly longer description shown in the chat thinking bubble. */
  description: string;
  /** Default pages to suggest when the model didn't give us a list. */
  defaultPages: string[];
  /** Maximum tokens the architect should spend on the BUILT site. */
  maxTokens: number;
  /** Skip few-shot examples for tiny builds — keeps cold-start latency low. */
  skipFewShot: boolean;
}

export const COMPLEXITY_TIERS: Record<ComplexityTier, ComplexityTierInfo> = {
  landing: {
    scoreRange: [1, 3],
    label: "Focused landing",
    description:
      "Single index.html. Hero + 1–2 sections + footer. Built fast.",
    defaultPages: ["Home"],
    maxTokens: 5000,
    skipFewShot: true,
  },
  "one-page": {
    scoreRange: [4, 6],
    label: "Polished one-pager",
    description:
      "Single index.html. Hero + 5–7 sections + footer. No separate pages.",
    defaultPages: ["Home"],
    maxTokens: 9000,
    skipFewShot: false,
  },
  "two-page": {
    scoreRange: [7, 7],
    label: "Two-page site",
    description:
      "index.html + one secondary page (e.g. Menu, About). Shared CSS/JS.",
    defaultPages: ["Home", "About"],
    maxTokens: 12000,
    skipFewShot: false,
  },
  "multi-page": {
    scoreRange: [8, 9],
    label: "Multi-page site",
    description:
      "Full multi-page site: index.html + 3–4 pages/*.html, full nav.",
    defaultPages: ["Home", "About", "Services", "Contact"],
    maxTokens: 16000,
    skipFewShot: false,
  },
  max: {
    scoreRange: [10, 10],
    label: "Maximum build",
    description:
      "Multi-page site with maximum polish: 5+ pages, advanced animations.",
    defaultPages: ["Home", "Features", "Pricing", "About", "Contact"],
    maxTokens: 16000,
    skipFewShot: false,
  },
};

export function scoreToTier(score: number): ComplexityTier {
  const s = Math.min(10, Math.max(1, Math.round(score)));
  if (s <= 3) return "landing";
  if (s <= 6) return "one-page";
  if (s === 7) return "two-page";
  if (s <= 9) return "multi-page";
  return "max";
}

export interface Assessment {
  score: number;
  tier: ComplexityTier;
  /** Recommended page names, in nav order. Always non-empty. */
  pages: string[];
  /** One-sentence rationale in the user's language. */
  rationale: string;
  /**
   * Where this assessment came from:
   *   "auto"   — AI scored the prompt
   *   "manual" — user (Silver+) picked the score themselves
   */
  source: "auto" | "manual";
}

/**
 * Build the directive line that gets prepended to the user prompt so the
 * architect knows how big a site to build. Lives in the user message, NOT
 * the system block, so the cached SYSTEM_PROMPT stays warm.
 */
export function complexityDirective(a: Assessment): string {
  const info = COMPLEXITY_TIERS[a.tier];
  const pageList = a.pages.join(", ");
  return [
    `[COMPLEXITY DIRECTIVE — strictly follow]`,
    `score=${a.score}/10  tier=${a.tier}  pages=[${pageList}]`,
    `Build per the rubric: ${info.description}`,
    a.tier === "landing" || a.tier === "one-page"
      ? `Output a SINGLE index.html (plus styles.css + script.js). Do NOT create pages/*.html.`
      : `Output index.html PLUS one pages/<name>.html per non-Home item in the page list (plus shared styles.css + script.js).`,
    a.tier === "landing"
      ? `Keep it under ~700 lines of HTML total — focused, no bloat.`
      : a.tier === "one-page"
        ? `Aim for ~900–1400 lines of HTML — every section purposeful.`
        : a.tier === "max"
          ? `Maximum polish — animations, interactive components, real depth.`
          : `Real multi-page site — every page links to every other page.`,
  ].join("\n");
}

/**
 * Manual complexity is a premium feature. Users on the free (Bronze) plan
 * only get the auto-assessment; Silver / Gold (pro / ultra) can override.
 */
export function canUseManualComplexity(plan: "free" | "pro" | "ultra"): boolean {
  return plan === "pro" || plan === "ultra";
}
