/**
 * lib/generate.ts — система генерации сайтов через OpenRouter.
 *
 * Заменяет старую JSON-based генерацию на bolt-стиль:
 *   - Модель возвращает текст с тегами <boltArtifact>/<boltAction type="file">
 *   - StreamingMessageParser на клиенте разбирает теги в файлы в реальном времени
 *   - API route стримит текст чанками через SSE
 *
 * Сохранена вся инфраструктура HENOSIS: auth, quota, project-store, SSE.
 */

import { SYSTEM_PROMPT, EDIT_PROMPT, REMIX_PROMPT } from "./system-prompt";
import type { GenerateResultFile } from "./types";

const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";

// ──────────────────────────────────────────────────────────────────────────────
// Типы
// ──────────────────────────────────────────────────────────────────────────────

export type GenerationMode = "generate" | "edit" | "remix";

export interface GenerateStreamCallbacks {
  onChunk?: (delta: string, accumulated: string) => void;
  onDone?: (fullText: string) => void;
  onError?: (err: Error) => void;
}

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

// ──────────────────────────────────────────────────────────────────────────────
// Сборка сообщений
// ──────────────────────────────────────────────────────────────────────────────

export function buildMessages(opts: {
  mode: GenerationMode;
  prompt: string;
  priorFiles?: GenerateResultFile[];
  history?: { role: "user" | "assistant"; content: string }[];
}): OpenRouterMessage[] {
  const { mode, prompt, priorFiles, history = [] } = opts;

  const systemText =
    mode === "edit"
      ? EDIT_PROMPT
      : mode === "remix"
        ? REMIX_PROMPT
        : SYSTEM_PROMPT;

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: systemText,
          cache_control: { type: "ephemeral" },
        },
      ],
    },
  ];

  // Prior files context для edit/remix
  if (priorFiles && priorFiles.length > 0) {
    const fileContext = priorFiles
      .map((f) => `// FILE: ${f.path}\n${f.content}`)
      .join("\n\n---\n\n");

    messages.push({
      role: "assistant",
      content:
        mode === "remix"
          ? `Here is the original site I created. Now the user wants a remix:\n\n${fileContext}`
          : `Here are the current project files:\n\n${fileContext}`,
    });
  }

  // История чата
  for (const h of history) {
    messages.push({ role: h.role, content: h.content });
  }

  // Текущий промпт пользователя
  messages.push({ role: "user", content: prompt });

  return messages;
}

// ──────────────────────────────────────────────────────────────────────────────
// Заголовки авторизации
// ──────────────────────────────────────────────────────────────────────────────

export function buildAuthHeaders(): HeadersInit {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY не настроен на сервере. Добавьте в .env.local."
    );
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    "HTTP-Referer": "https://henosis.app",
    "X-Title": "Henosis",
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Стриминг — серверная функция (вызывается из API route)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Стримит генерацию через OpenRouter и вызывает коллбэки.
 * Возвращает полный текст (все чанки сшитые).
 * Используется внутри API route — работает только на сервере.
 */
export async function streamGeneration(opts: {
  prompt: string;
  model: string;
  mode?: GenerationMode;
  priorFiles?: GenerateResultFile[];
  history?: { role: "user" | "assistant"; content: string }[];
  callbacks: GenerateStreamCallbacks;
}): Promise<string> {
  const {
    prompt,
    model,
    mode = "generate",
    priorFiles,
    history,
    callbacks,
  } = opts;

  const messages = buildMessages({ mode, prompt, priorFiles, history });

  const res = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      model,
      max_tokens: 64000,
      messages,
      stream: true,
      // Bolt-формат — чистый текст, не JSON
    }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => String(res.status));
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
        /* пропускаем неполные JSON */
      }
    }
  }

  if (!full.trim()) throw new Error("Модель вернула пустой ответ");

  callbacks.onDone?.(full);
  return full;
}

// ──────────────────────────────────────────────────────────────────────────────
// Конвертация текста с артефактами → GenerateResult
// ──────────────────────────────────────────────────────────────────────────────

import { extractFilesFromText } from "./runtime/message-parser";
import type { GenerateResult } from "./types";

/**
 * Конвертирует сырой текст с <boltArtifact> тегами в GenerateResult.
 * Вызывается на сервере после получения полного ответа.
 */
export function artifactTextToResult(
  rawText: string,
  fallbackTitle = "Generated Site"
): GenerateResult {
  const filesMap = extractFilesFromText(rawText);

  if (filesMap.size === 0) {
    throw new Error(
      "Модель не вернула ни одного файла. Попробуйте ещё раз или смените модель."
    );
  }

  // Извлекаем заголовок из тега артефакта
  const titleMatch = rawText.match(/<boltArtifact[^>]+title="([^"]+)"/i);
  const title = titleMatch?.[1] || fallbackTitle;

  const files: GenerateResultFile[] = Array.from(filesMap.entries()).map(
    ([path, content]) => ({
      path,
      content,
      language: inferLanguage(path),
    })
  );

  // Определяем страницы из структуры файлов
  const pages = files
    .filter((f) => f.path.endsWith(".html"))
    .map((f) => {
      const name = f.path
        .replace(/^pages\//, "")
        .replace(/\.html$/, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return name || "Home";
    });

  if (pages.length === 0) pages.push("Home");

  return {
    meta: {
      title,
      description: title,
      primaryColor: "#0A0A0A",
      accentColor: "#6366f1",
      fontPrimary: "Inter",
      fontSecondary: "Inter",
      pages,
    },
    files,
    preview: {
      heroHeadline: title,
      heroSubline: "",
      colorPalette: ["#0A0A0A", "#6366f1", "#F5F5F5"],
      sections: pages,
    },
  };
}

function inferLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    md: "markdown",
    svg: "xml",
  };
  return map[ext] ?? "plaintext";
}
