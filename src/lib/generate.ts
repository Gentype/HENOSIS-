/**
 * lib/generate.ts
 *
 * OpenRouter + Prompt Caching — keeps the SYSTEM_PROMPT cached so subsequent
 * generations are ~90% cheaper on input tokens.
 *
 * Two entry points:
 *   - generateSite(prompt, model)         → non-streaming, returns full result
 *   - generateSiteStream(prompt, on*, …)  → streams JSON content into the UI
 */
import { SYSTEM_PROMPT } from "./system-prompt";
import type {
  GenerateResult,
  GenerateResultFile,
  GenerateResultMeta,
  GenerateResultPreview,
} from "./types";

/**
 * Allow callers to swap the cached system prompt (e.g. EDIT_PROMPT, REMIX_PROMPT)
 * while keeping the rest of the OpenRouter plumbing identical.
 */
export interface SystemOverride {
  systemText?: string;
}

const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";

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
}

function buildBody({ prompt, model, priorFiles, stream, systemText }: BuildRequestArgs): string {
  // Cached system block. Anthropic / OpenRouter prompt caching applies.
  const systemMsg: OpenRouterMessage = {
    role: "system",
    content: [
      {
        type: "text",
        text: systemText ?? SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
  };

  const messages: OpenRouterMessage[] = [systemMsg];

  if (priorFiles && priorFiles.length > 0) {
    // Provide context of the previous version so the model can apply edits.
    const fileContext = priorFiles
      .map(
        (f) =>
          `// FILE: ${f.path}\n${f.content}`,
      )
      .join("\n\n");

    messages.push({
      role: "assistant",
      content: `Here is the previous version of the site you generated. The user is asking for a follow-up edit; preserve everything except what they asked to change.\n\n${fileContext}`,
    });
  }

  messages.push({
    role: "user",
    content: prompt,
  });

  return JSON.stringify({
    model,
    // Multi-page vanilla-HTML sites can easily push 40–60k completion tokens
    // once you include real copy + CSS + JS. 16k was leaving the JSON truncated
    // mid-string, which the strict parser then rejected.
    max_tokens: 32000,
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

function parseResult(raw: string): GenerateResult {
  const cleaned = stripCodeFences(raw).trim();

  // Fast path: well-formed JSON.
  try {
    return normalizeResult(JSON.parse(cleaned));
  } catch {
    // fall through to the repair path
  }

  // Repair path: the model very often runs out of completion tokens mid-string
  // when generating a multi-page site. Close any unterminated string, pop
  // unclosed `{`/`[`, and re-parse. Any file whose `content` we had to truncate
  // still ends up usable in the preview — better than a fatal error.
  const repaired = repairJson(cleaned);
  try {
    return normalizeResult(JSON.parse(repaired));
  } catch (e) {
    throw new Error(
      `Model returned invalid JSON even after repair: ${(e as Error).message}\n\n${cleaned.slice(0, 400)}…`,
    );
  }
}

function stripCodeFences(s: string): string {
  const fenced = s.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  if (fenced) return fenced[1];
  return s;
}

/**
 * Close unterminated strings and pop unclosed `{` / `[` so a truncated stream
 * still parses to JSON. Used when the model hits max_tokens mid-output.
 */
function repairJson(input: string): string {
  let out = input;
  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if ((c === "}" || c === "]") && stack.length && stack[stack.length - 1] === c) {
      stack.pop();
    }
  }

  // dangling backslash inside an unterminated string would break the parse
  if (inString && escape) out = out.slice(0, -1);
  if (inString) out += '"';

  // strip trailing comma / whitespace before adding closers
  out = out.replace(/[,\s]+$/, "");
  while (stack.length) out += stack.pop()!;
  return out;
}

type Unknown = Record<string, unknown>;
function asObj(v: unknown): Unknown {
  return v && typeof v === "object" ? (v as Unknown) : {};
}
function asStr(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}
function asStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function normalizeResult(raw: unknown): GenerateResult {
  const r = asObj(raw);
  const filesIn = Array.isArray(r.files) ? r.files : [];
  const files: GenerateResultFile[] = filesIn
    .map((f) => asObj(f))
    .filter((f) => typeof f.path === "string" && typeof f.content === "string")
    .map((f) => ({
      path: f.path as string,
      content: f.content as string,
      language: typeof f.language === "string" ? f.language : inferLang(f.path as string),
    }));

  if (files.length === 0) {
    throw new Error("No usable files in model output");
  }

  const m = asObj(r.meta);
  const meta: GenerateResultMeta = {
    title: asStr(m.title, "Untitled site"),
    description: asStr(m.description, ""),
    primaryColor: asStr(m.primaryColor, "#111111"),
    accentColor: asStr(m.accentColor, "#b8e3c9"),
    fontPrimary: asStr(m.fontPrimary, "Inter"),
    fontSecondary: asStr(m.fontSecondary, "Inter"),
    pages: asStrArr(m.pages),
  };

  const p = asObj(r.preview);
  const preview: GenerateResultPreview = {
    heroHeadline: asStr(p.heroHeadline, meta.title),
    heroSubline: asStr(p.heroSubline, meta.description),
    colorPalette: asStrArr(p.colorPalette).length
      ? asStrArr(p.colorPalette)
      : [meta.primaryColor, meta.accentColor],
    sections: asStrArr(p.sections),
  };

  return { meta, files, preview };
}

function inferLang(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "css") return "css";
  if (ext === "js" || ext === "mjs") return "javascript";
  if (ext === "json") return "json";
  if (ext === "ts" || ext === "tsx") return "typescript";
  return "plaintext";
}
