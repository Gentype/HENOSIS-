import { NextRequest } from "next/server";
import { generateSiteStream } from "@/lib/generate";
import { EDIT_PROMPT } from "@/lib/edit-prompt";
import { DEFAULT_MODEL } from "@/lib/examples";
import type { GenerateResultFile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Capped automatically by Vercel to the plan limit (60s on Hobby, 300s on
// Pro). Without this, the default 10s timeout kills mid-stream and the
// client surfaces "Load failed".
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
      { error: "OPENROUTER_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  const encoder = new TextEncoder();
  const model = body.model || DEFAULT_MODEL;

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: object) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      }
      // Periodic heartbeat (SSE comment line) keeps upstream proxies from
      // closing a quiet connection while OpenRouter TTFBs. Without this,
      // slow first chunks surface as "Generation failed: Load failed".
      function heartbeat() {
        controller.enqueue(encoder.encode(`: hb\n\n`));
      }
      let closed = false;
      const hb = setInterval(() => {
        if (!closed) {
          try {
            heartbeat();
          } catch {
            /* controller might be closed mid-flush */
          }
        }
      }, 10_000);

      try {
        send({ type: "start", model });
        heartbeat();
        const result = await generateSiteStream(
          prompt,
          model,
          body.priorFiles,
          {
            onChunk: (delta) => send({ type: "chunk", delta }),
          },
          { systemText: EDIT_PROMPT },
        );
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
