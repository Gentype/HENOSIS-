/**
 * lib/generate.ts
 *
 * OpenRouter + Prompt Caching — keeps the SYSTEM_PROMPT cached so subsequent
 * generations are ~90% cheaper on input tokens.
 *
 * Pipeline (centralised in `buildMessagesForGeneration`):
 *
 *     user prompt
 *       → [ system (cached)
 *           + 1–2 BUILT_IN_EXAMPLES (when applicable)
 *           + optional priorFiles context (follow-up edits)
 *           + user prompt ]
 *       → OpenRouter chat completion (json_object response_format)
 *       → parseResult (graceful fallback for partial / fenced output)
 *       → GenerateResult
 *
 * Two entry points:
 *   - generateSite(prompt, model, priorFiles?, override?)         — non-streaming
 *   - generateSiteStream(prompt, model, priorFiles, cbs, override?) — streaming
 */
import { SYSTEM_PROMPT } from "./system-prompt";
import {
  BUILT_IN_EXAMPLES,
  pickRelevantExamples,
  type BuiltInExample,
} from "./builtin-examples";
import type {
  ComplexityAnalysis,
  GenerateResult,
  GenerateResultFile,
} from "./types";

/**
 * Allow callers to swap the cached system prompt (e.g. EDIT_PROMPT, REMIX_PROMPT)
 * while keeping the rest of the OpenRouter plumbing identical. When an override
 * is set, few-shot examples are *not* injected — the override is its own
 * specialised system message and examples would be off-topic.
 */
export interface SystemOverride {
  systemText?: string;
}

/**
 * Pre-generation complexity context produced by the Quality Check analyzer.
 * Threaded through to the Site Architect via a `<complexity>` block prepended
 * to the user message — the system prompt is told to read it and size its
 * output accordingly.
 */
export interface ComplexityContext {
  /** 1–10. Required when this context is passed. */
  score: number;
  /** "html" for ≤4, "react-ts" for ≥5. */
  stack: ComplexityAnalysis["stack"];
  /** Short label, e.g. "Multi-page clone". */
  tier?: string;
  /** Pages the analyzer recommended building (always starts with "Home"). */
  recommendedPages?: string[];
  /** Analyzer's one-sentence rationale. */
  reasoning?: string;
  /** Whether a Silver/Gold user manually overrode the analyzed score. */
  userOverride?: boolean;
}

function buildComplexityHeader(ctx: ComplexityContext): string {
  const pages = (ctx.recommendedPages ?? []).filter(Boolean).join(", ");
  const tier = ctx.tier?.trim() || tierFromScore(ctx.score);
  // Normalise the stack: deprecated values ("js-modules", "typescript")
  // collapse into "react-ts" so the Site Architect only ever sees the new
  // two-value contract.
  const normalisedStack =
    ctx.stack === "html"
      ? "html"
      : ctx.score <= 4
        ? "html"
        : "react-ts";
  const lines: string[] = [];
  lines.push(
    `<complexity score="${ctx.score}/10" stack="${normalisedStack}" tier="${tier}"${
      ctx.userOverride ? ' override="user-selected"' : ""
    }>`,
  );
  if (pages) lines.push(`Recommended pages: ${pages}`);
  if (ctx.reasoning) lines.push(`Analyzer rationale: ${ctx.reasoning}`);
  lines.push(
    `Build a site that matches a ${ctx.score}/10 on the Henosis rubric — no smaller, no larger.`,
  );
  if (normalisedStack === "react-ts") {
    lines.push(
      `Stack is "react-ts": emit a REAL React + TypeScript project tree. REQUIRED files: index.html (shell with <div id="root"></div>, NO <script src> for libs), styles.css, src/main.tsx, src/App.tsx, at least one src/components/<Name>.tsx, package.json (react ^19, react-dom ^19, vite, typescript), tsconfig.json (jsx "react-jsx", strict). For score ≥ 7 also include src/types.ts, src/data/<name>.ts, src/lib/<helper>.ts, README.md.`,
    );
    lines.push(
      `Imports: bare specifiers ("react", "react-dom/client", "react/jsx-runtime") resolve via importmap → esm.sh; relative imports omit the file extension ("./components/Hero", "../types"). Do NOT emit script.js. The Henosis runtime injects Babel + importmap and mounts src/main.tsx for you.`,
    );
  } else {
    lines.push(
      `Stack is "html": keep it lean — index.html (+ pages/*.html if needed) + styles.css + script.js. NO src/*.tsx, NO package.json, NO React.`,
    );
  }
  lines.push(`</complexity>`);
  return lines.join("\n");
}

function tierFromScore(score: number): string {
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

const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Soft cap on combined few-shot example character length. Bumped to 30k so
 * the typescript multi-file example (Stream, ~20k chars) fits — without it
 * the picker would silently drop the TS example and the model would see
 * only the small HTML examples, then copy that shape.
 */
const FEW_SHOT_CHAR_BUDGET = 30000;

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<{
        type: "text";
        text: string;
        cache_control?: { type: "ephemeral" };
      }>;
}

interface BuildRequestArgs {
  prompt: string;
  model: string;
  priorFiles?: GenerateResultFile[];
  stream?: boolean;
  systemText?: string;
  complexity?: ComplexityContext;
}

// ---------------------------------------------------------------------------
// buildMessagesForGeneration — the one place where messages get assembled.
//
// Any new caller (a new API route, a server action, etc.) should go through
// this function rather than constructing OpenRouter messages by hand.
// ---------------------------------------------------------------------------

export interface BuildMessagesArgs {
  /** System prompt text to pin in the cached `system` block. */
  systemPrompt: string;
  /** Optional pool of few-shot examples to choose from. */
  examples?: BuiltInExample[];
  /**
   * Optional explicit picker; defaults to the keyword/complexity picker.
   * The `complexityScore` is forwarded so the picker can bias toward an
   * example whose output size matches the target — without it, a 7/10
   * prompt would see only HTML examples and emit single-page HTML.
   */
  pickExamples?: (
    prompt: string,
    max: number,
    complexityScore?: number,
  ) => BuiltInExample[];
  /** Max examples to inject (capped by FEW_SHOT_CHAR_BUDGET as well). */
  maxExamples?: number;
  /**
   * Optional conversation history (not currently used by /api/generate, but
   * left here so the pipeline is future-ready for chat-style follow-ups).
   */
  history?: { role: "user" | "assistant"; content: string }[];
  /** Files from the previous generation when the user is iterating. */
  priorFiles?: GenerateResultFile[];
  /** The user's current prompt. */
  currentUserPrompt: string;
  /**
   * Optional pre-generation complexity context. When present, a
   * `<complexity>` block is prepended to the user message so the Site
   * Architect knows the target size / stack.
   */
  complexity?: ComplexityContext;
}

export function buildMessagesForGeneration(
  args: BuildMessagesArgs,
): OpenRouterMessage[] {
  const {
    systemPrompt,
    examples = BUILT_IN_EXAMPLES,
    pickExamples = pickRelevantExamples,
    maxExamples = 2,
    history = [],
    priorFiles,
    currentUserPrompt,
    complexity,
  } = args;

  const messages: OpenRouterMessage[] = [];

  // 1. System block — cached so subsequent calls only pay for new tokens.
  messages.push({
    role: "system",
    content: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
  });

  // 2. Few-shot examples — skipped when the user is iterating on existing
  //    files (priorFiles takes priority as the "context" for the model) or
  //    when the example pool is empty. The picker is told about the
  //    target complexity so a 7/10 prompt gets the TS multi-file example
  //    rather than a 3/10 coffee-shop landing.
  let pickedIds: string[] = [];
  if (!priorFiles?.length && examples.length > 0 && maxExamples > 0) {
    const picked = pickExamples(
      currentUserPrompt,
      maxExamples,
      complexity?.score,
    );
    const budgeted = applyCharBudget(picked, FEW_SHOT_CHAR_BUDGET);
    pickedIds = budgeted.map((e) => e.id);
    for (const ex of budgeted) {
      for (const turn of ex.conversation) {
        messages.push({ role: turn.role, content: turn.content });
      }
    }
  }

  // 3. Prior files (follow-up edit context).
  if (priorFiles && priorFiles.length > 0) {
    const fileContext = priorFiles
      .map((f) => `// FILE: ${f.path}\n${f.content}`)
      .join("\n\n");
    messages.push({
      role: "assistant",
      content: `Here is the previous version of the site you generated. The user is asking for a follow-up edit; preserve everything except what they asked to change.\n\n${fileContext}`,
    });
  }

  // 4. Optional history (kept for future use).
  for (const h of history) {
    messages.push({ role: h.role, content: h.content });
  }

  // 5. Current user prompt. Prepend a `<complexity>` block when the
  //    pre-generation analyzer has produced one — the system prompt is
  //    explicitly told to read it and size the output accordingly.
  const userBlocks: string[] = [];
  if (complexity) userBlocks.push(buildComplexityHeader(complexity));
  userBlocks.push(currentUserPrompt);
  messages.push({ role: "user", content: userBlocks.join("\n\n") });

  if (process.env.NODE_ENV !== "production") {
    const totalLen = messages.reduce((sum, m) => {
      if (typeof m.content === "string") return sum + m.content.length;
      return sum + m.content.reduce((s, p) => s + p.text.length, 0);
    }, 0);
    console.debug(
      `[generate] messages=${messages.length} examples=[${pickedIds.join(",")}] totalChars=${totalLen}`,
    );
  }

  return messages;
}

/** Drop examples one-by-one (from the end) until under the char budget. */
function applyCharBudget(
  examples: BuiltInExample[],
  budget: number,
): BuiltInExample[] {
  const kept = [...examples];
  const sizeOf = (e: BuiltInExample) =>
    e.conversation.reduce((s, t) => s + t.content.length, 0);
  let total = kept.reduce((s, e) => s + sizeOf(e), 0);
  while (kept.length > 1 && total > budget) {
    const dropped = kept.pop();
    if (!dropped) break;
    total -= sizeOf(dropped);
  }
  return kept;
}

// ---------------------------------------------------------------------------

function buildBody({
  prompt,
  model,
  priorFiles,
  stream,
  systemText,
  complexity,
}: BuildRequestArgs): string {
  // When the caller supplies a specialised system text (edit / remix), we
  // honour it and skip few-shot examples — those examples target the generic
  // architect mode.
  const isOverride = Boolean(systemText);
  const messages = buildMessagesForGeneration({
    systemPrompt: systemText ?? SYSTEM_PROMPT,
    examples: isOverride ? [] : BUILT_IN_EXAMPLES,
    maxExamples: isOverride ? 0 : 2,
    priorFiles,
    currentUserPrompt: prompt,
    complexity,
  });

  return JSON.stringify({
    model,
    max_tokens: 16000,
    messages,
    stream: stream ?? false,
    response_format: { type: "json_object" },
  });
}

function authHeaders(): HeadersInit {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to your .env.local — see README.",
    );
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    "HTTP-Referer": "https://henosis.app",
    "X-Title": "Henosis",
  };
}

export async function generateSite(
  prompt: string,
  model: string,
  priorFiles?: GenerateResultFile[],
  override?: SystemOverride,
  complexity?: ComplexityContext,
): Promise<GenerateResult> {
  const res = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: authHeaders(),
    body: buildBody({
      prompt,
      model,
      priorFiles,
      stream: false,
      systemText: override?.systemText,
      complexity,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from model");

  return parseResult(content);
}

export interface StreamCallbacks {
  onChunk?: (delta: string, accumulated: string) => void;
  onMeta?: (meta: { model: string }) => void;
}

export async function generateSiteStream(
  prompt: string,
  model: string,
  priorFiles: GenerateResultFile[] | undefined,
  callbacks: StreamCallbacks,
  override?: SystemOverride,
  complexity?: ComplexityContext,
): Promise<GenerateResult> {
  callbacks.onMeta?.({ model });

  const res = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: authHeaders(),
    body: buildBody({
      prompt,
      model,
      priorFiles,
      stream: true,
      systemText: override?.systemText,
      complexity,
    }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // SSE lines are separated by double-newlines
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload);
        const delta: string = obj.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          callbacks.onChunk?.(delta, full);
        }
      } catch {
        /* skip malformed */
      }
    }
  }

  if (!full.trim()) throw new Error("Empty stream");
  return parseResult(full);
}

/**
 * Parse the model's raw text into a GenerateResult.
 *
 * Models occasionally:
 *   1. wrap output in ```json fences,
 *   2. leak commentary before/after the JSON,
 *   3. truncate (max_tokens) — but for the common case of "valid JSON +
 *      trailing junk" we want a best-effort recovery rather than a hard
 *      failure.
 *
 * Strategy: strip fences → brace-balance scan to extract the first complete
 * JSON object → JSON.parse it → validate required keys.
 */
function parseResult(raw: string): GenerateResult {
  const cleaned = stripCodeFences(raw).trim();
  const candidate = extractFirstJsonObject(cleaned) ?? cleaned;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (e) {
    throw new Error(
      `Model returned invalid JSON: ${(e as Error).message}\n\n${candidate.slice(0, 400)}…`,
    );
  }

  if (!isGenerateResult(parsed)) {
    throw new Error(
      `Model JSON is missing required keys (meta/files/preview). Got: ${candidate.slice(0, 300)}…`,
    );
  }
  return parsed;
}

function isGenerateResult(v: unknown): v is GenerateResult {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.meta === "object" &&
    obj.meta !== null &&
    Array.isArray(obj.files) &&
    typeof obj.preview === "object" &&
    obj.preview !== null
  );
}

function stripCodeFences(s: string): string {
  const fenced = s.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  if (fenced) return fenced[1];
  return s;
}

/**
 * Walk the string and return the substring corresponding to the first
 * top-level JSON object (handles nested braces, ignores braces inside
 * strings). Returns null if no balanced object is found.
 */
function extractFirstJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inStr = false;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}
