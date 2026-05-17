export interface GenerateResultMeta {
  title: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  fontPrimary: string;
  fontSecondary: string;
  pages: string[];
}

export interface GenerateResultFile {
  path: string;
  content: string;
  language: string;
}

export interface GenerateResultPreview {
  heroHeadline: string;
  heroSubline: string;
  colorPalette: string[];
  sections: string[];
}

export interface GenerateResult {
  meta: GenerateResultMeta;
  files: GenerateResultFile[];
  preview: GenerateResultPreview;
  /**
   * Optional step-by-step build plan the model followed. Surfaced in the
   * chat sidebar so the user can see what was built and why.
   * Older models that don't emit `plan` are fine — the renderer treats it
   * as optional.
   */
  plan?: string[];
  /**
   * Optional non-blocking notes from the model (assumptions made, follow-up
   * suggestions, caveats). Shown as a collapsible note in the chat.
   */
  notes?: string[];
  /**
   * Optional one-paragraph human summary in the user's own language —
   * what was built, what's notable. Shown as the model's chat reply.
   */
  userSummary?: string;
  /**
   * Complexity rating (1–10) that the build actually targeted. Mirrors the
   * pre-generation analysis so the UI can pin the score to the finished site.
   */
  complexity?: number;
}

/**
 * Result of the pre-generation "Проверка качества продукта" (Quality Check)
 * step. The model classifies the user's prompt into a 1–10 complexity tier
 * and recommends a tech stack + page set. Surfaced in the UI as an
 * animated loading screen before the heavy generation call.
 */
export interface ComplexityAnalysis {
  /** 1–10. See system-prompt.ts for the rubric. */
  score: number;
  /** One short sentence explaining why, in the user's language. */
  reasoning: string;
  /** Short tier label, e.g. "Landing", "Multi-page", "Full product". */
  tier: string;
  /** Pages the model recommends building. */
  recommendedPages: string[];
  /** "html" for ≤4, "typescript" / "js-modules" for ≥5. */
  stack: "html" | "js-modules" | "typescript";
  /** True if the user explicitly overrode the analyzed score (Silver+). */
  userOverride?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  status?: "pending" | "streaming" | "done" | "error";
  createdAt: number;
}

export interface Project {
  id: string;
  prompt: string;
  model: string;
  /**
   * `analyzing` — pre-generation Quality Check is running (?/10 classifier).
   * `generating` — main /api/generate call is streaming.
   */
  status: "analyzing" | "generating" | "done" | "error";
  title: string;
  createdAt: number;
  updatedAt: number;
  result: GenerateResult | null;
  history: ChatMessage[];
  /**
   * The complexity analysis surfaced as the "Проверка качества продукта"
   * screen. Set as soon as /api/analyze returns; reused when the user kicks
   * off the heavy generation.
   */
  analysis?: ComplexityAnalysis;
  /**
   * Optional manual complexity (2–10) chosen by a Silver/Gold user before
   * submitting. If set, the analyzer still runs for the rationale, but the
   * final build targets this score.
   */
  complexityOverride?: number;
}

export type Plan = "free" | "pro" | "ultra";

/** What the frontend sees — projected from the server-side UserRecord. */
export interface User {
  id: string;
  email: string;
  name: string;
  image: string | null;
  plan: Plan;
  /** Human-readable tier label shown in the UI. */
  tier: "Bronze" | "Silver" | "Gold";
  generationsUsed: number;
  /** Total cap for this plan, or null for unlimited. */
  limit: number | null;
  /** Remaining generations, or null for unlimited. */
  remaining: number | null;
  joinedAt: number;
}

export const PLAN_LIMITS: Record<Plan, number> = {
  free: 3,
  pro: 50,
  ultra: Number.POSITIVE_INFINITY,
};
