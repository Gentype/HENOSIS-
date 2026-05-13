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
import type { GenerateResult, GenerateResultFile } from "./types";

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
}

function buildBody({ prompt, model, priorFiles, stream }: BuildRequestArgs): string {
  // Cached system block. Anthropic / OpenRouter prompt caching applies.
  const systemMsg: OpenRouterMessage = {
    role: "system",
    content: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
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
): Promise<GenerateResult> {
  const res = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: authHeaders(),
    body: buildBody({ prompt, model, priorFiles, stream: false }),
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
): Promise<GenerateResult> {
  callbacks.onMeta?.({ model });

  const res = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: authHeaders(),
    body: buildBody({ prompt, model, priorFiles, stream: true }),
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
  // Some models occasionally wrap JSON in code fences despite response_format.
  const cleaned = stripCodeFences(raw).trim();
  try {
    const parsed = JSON.parse(cleaned) as GenerateResult;
    if (!parsed.meta || !parsed.files || !parsed.preview) {
      throw new Error("Missing required keys");
    }
    return parsed;
  } catch (e) {
    throw new Error(
      `Model returned invalid JSON: ${(e as Error).message}\n\n${cleaned.slice(0, 400)}…`,
    );
  }
}

function stripCodeFences(s: string): string {
  const fenced = s.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  if (fenced) return fenced[1];
  return s;
}
