import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { streamGeneration, artifactTextToResult } from "@/lib/generate";
import { DEFAULT_MODEL } from "@/lib/examples";
import type { GenerateResultFile } from "@/lib/types";
import {
  PLAN_LIMITS,
  incrementUsage,
  quotaRemaining,
  userFromSession,
} from "@/lib/user-store";
import {
  completeProject,
  createProject,
  failProject,
  patchProject,
} from "@/lib/project-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface Body {
  prompt: string;
  model?: string;
  priorFiles?: GenerateResultFile[];
  projectId?: string;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").trim();
  if (prompt.length < 5) {
    return Response.json({ error: "Prompt too short (min 5 chars)" }, { status: 400 });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      { error: "OPENROUTER_API_KEY не настроен на сервере. Добавьте в .env.local." },
      { status: 503 },
    );
  }

  const session = await auth();
  const user = await userFromSession(session);
  if (!user) {
    return Response.json(
      { error: "Войдите в аккаунт для генерации сайтов.", code: "unauthenticated" },
      { status: 401 },
    );
  }

  if (quotaRemaining(user) <= 0) {
    const limit = PLAN_LIMITS[user.plan];
    return Response.json(
      {
        error: `Вы использовали все ${limit} генераций на вашем плане. Обновите план на /pricing.`,
        code: "quota_exceeded",
      },
      { status: 402 },
    );
  }

  const encoder = new TextEncoder();
  const model = body.model || DEFAULT_MODEL;
  const projectId = body.projectId;

  // Создаём запись в project-store для восстановления после обрыва соединения
  if (projectId) {
    try {
      await createProject({
        id: projectId,
        userId: user.id,
        prompt,
        model,
        initialStatus: "generating",
      });
    } catch (err) {
      console.warn("[generate] failed to create project record:", err);
    }
  }

  // Throttled flush partial text to project store
  let partialBuffer = "";
  let lastFlushAt = Date.now();
  const FLUSH_INTERVAL_MS = 1500;

  async function flushPartial(force = false): Promise<void> {
    if (!projectId) return;
    const now = Date.now();
    if (!force && now - lastFlushAt < FLUSH_INTERVAL_MS) return;
    lastFlushAt = now;
    try {
      await patchProject(projectId, { partial: partialBuffer });
    } catch {
      /* best-effort */
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      // Heartbeat каждые 10с чтобы прокси не закрыл тихое соединение
      let closed = false;
      const hb = setInterval(() => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(`: hb\n\n`));
          } catch { /* ignore */ }
        }
      }, 10_000);

      try {
        send({ type: "start", model, projectId });

        let fullText = "";

        const result = await streamGeneration({
          prompt,
          model,
          mode: "generate",
          priorFiles: body.priorFiles,
          callbacks: {
            onChunk: (delta, accumulated) => {
              fullText = accumulated;
              partialBuffer = accumulated;
              // Стримим сырой текст (с тегами) — клиент парсит их сам
              send({ type: "chunk", delta });
              void flushPartial();
            },
          },
        });

        // Парсим артефакт в GenerateResult
        const generateResult = artifactTextToResult(fullText, prompt.slice(0, 60));

        // Считаем использование только при успехе
        await incrementUsage(user.id);

        // Сохраняем в project-store до отправки SSE done
        if (projectId) {
          try {
            await completeProject(projectId, generateResult);
          } catch (err) {
            console.warn("[generate] failed to mark project done:", err);
          }
        }

        send({ type: "done", result: generateResult });
      } catch (err) {
        const message = (err as Error).message;
        if (projectId) {
          try {
            await failProject(projectId, message);
          } catch { /* ignore */ }
        }
        send({ type: "error", message });
      } finally {
        closed = true;
        clearInterval(hb);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
