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
  status: "generating" | "done" | "error";
  title: string;
  createdAt: number;
  updatedAt: number;
  result: GenerateResult | null;
  history: ChatMessage[];
  /**
   * Complexity assessment used for the initial build. Set BEFORE generation
   * starts so the chat can show a "thinking" bubble with score + plan, and
   * so the architect respects it. Optional for backwards compatibility with
   * projects in localStorage from before complexity scoring landed.
   */
  assessment?: import("./complexity").Assessment;
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
