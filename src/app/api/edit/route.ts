import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { streamGeneration, artifactTextToResult } from "@/lib/generate";
import { DEFAULT_MODEL } from "@/lib/examples";
import type { GenerateResultFile } from "@/lib/types";
import { quotaRemaining, userFromSession } from "@/lib/user-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface Body {
  prompt: string;
  model?: string;
  priorFiles: GenerateResultFile[];
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").trim();
  if (prompt.length < 2) {
    return Response.json({ error: "Prompt too short" }, { status: 400 });
  }
  if (!Array.isArray(body.priorFiles) || body.priorFiles.length === 0) {
    return Response.json(
      { error: "priorFiles[] is required for /api/edit" },
      { status: 400 },
    );
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      { error: "OPENROUTER_API_KEY не настроен на сервере." },
      { status: 503 },
    );
  }

  const session = await auth();
  const user = await userFromSession(session);
  if (!user) {
    return Response.json(
      { error: "Войдите в аккаунт.", code: "unauthenticated" },
      { status: 401 },
    );
  }

  if (quotaRemaining(user) <= 0) {
    return Response.json(
      { error: "Квота исчерпана. Обновите план на /pricing.", code: "quota_exceeded" },
      { status: 402 },
    );
  }

  const encoder = new TextEncoder();
  const model = body.model || DEFAULT_MODEL;

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      let closed = false;
      const hb = setInterval(() => {
        if (!closed) {
          try { controller.enqueue(encoder.encode(`: hb\n\n`)); } catch { /* ignore */ }
        }
      }, 10_000);

      try {
        send({ type: "start", model });

        let fullText = "";

        await streamGeneration({
          prompt,
          model,
          mode: "edit",
          priorFiles: body.priorFiles,
          callbacks: {
            onChunk: (delta, accumulated) => {
              fullText = accumulated;
              send({ type: "chunk", delta });
            },
          },
        });

        const result = artifactTextToResult(fullText, "Edited Site");
        send({ type: "done", result });
      } catch (err) {
        send({ type: "error", message: (err as Error).message });
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
