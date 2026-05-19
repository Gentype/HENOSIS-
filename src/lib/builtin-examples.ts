/**
 * Built-in few-shot examples for the OpenRouter chat completion.
 *
 * The hardcoded canonical user→assistant conversations (Saudade coffee
 * shop, Mira SaaS landing, Bloom Studio agency, Stream video clone)
 * used to live here. They have been removed at the user's request.
 *
 * The exports below remain so call-sites (lib/generate.ts) keep
 * importing without modification, but {@link BUILT_IN_EXAMPLES} is now
 * always empty and {@link pickRelevantExamples} always returns `[]`.
 */

export interface BuiltInExample {
  id: string;
  title: string;
  /**
   * Short tag describing the kind of site. Reserved for the picker
   * heuristic — currently unused.
   */
  appType: string;
  /** Keywords that signal this example fits — checked case-insensitively. */
  keywords: string[];
  /** Complexity band the example demonstrates (1–10). */
  complexity: number;
  /** Order matters: user turn first, then a single assistant turn. */
  conversation: {
    role: "user" | "assistant";
    /** Assistant content is a JSON string conforming to GenerateResult. */
    content: string;
  }[];
}

/**
 * Empty by design. The hardcoded examples were removed at the user's
 * request. Re-populate this array if you want few-shot priming back.
 */
export const BUILT_IN_EXAMPLES: BuiltInExample[] = [];

/**
 * No-op picker. Always returns `[]` so {@link buildMessagesForGeneration}
 * skips the few-shot injection step. The signature is preserved for
 * backwards-compatibility with the legacy caller.
 */
export function pickRelevantExamples(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _userPrompt: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _max = 2,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _complexityScore?: number,
): BuiltInExample[] {
  return [];
}
