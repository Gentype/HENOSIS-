import { NextRequest } from "next/server";
import { generateSiteStream } from "@/lib/generate";
import { DEFAULT_MODEL } from "@/lib/examples";
import type { GenerateResultFile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  prompt: string;
  model?: string;
  priorFiles?: GenerateResultFile[];
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
      {
        error:
          "OPENROUTER_API_KEY is not configured on the server. Add it to .env.local.",
      },
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

      try {
        send({ type: "start", model });

        const result = await generateSiteStream(
          prompt,
          model,
          body.priorFiles,
          {
            onChunk: (delta) => {
              send({ type: "chunk", delta });
            },
          },
        );

        send({ type: "done", result });
      } catch (err) {
        send({ type: "error", message: (err as Error).message });
      } finally {
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
