import { NextRequest } from "next/server";
import { generateSiteStream } from "@/lib/generate";
import { REMIX_PROMPT } from "@/lib/remix-prompt";
import { DEFAULT_MODEL } from "@/lib/examples";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  url: string;
  model?: string;
  extra?: string;
}

const MAX_HTML_BYTES = 200_000;
const FETCH_TIMEOUT_MS = 12_000;

async function scrape(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Henosis Remix Bot) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`Fetch ${url} → ${res.status}`);
    const buf = await res.arrayBuffer();
    const slice = buf.slice(0, MAX_HTML_BYTES);
    return new TextDecoder("utf-8", { fatal: false }).decode(slice);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Trim a raw HTML page into something small enough to fit a prompt:
 * keep <head>, headings, links, color hints, body text — drop <script>/<style>
 * blobs and runs of whitespace.
 */
function distill(html: string): string {
  const noScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "[svg]");
  const text = noScript
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 18_000 ? text.slice(0, 18_000) + "…[truncated]" : text;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = (body.url ?? "").trim();
  if (!/^https?:\/\//i.test(url)) {
    return Response.json(
      { error: "url must start with http:// or https://" },
      { status: 400 },
    );
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      { error: "OPENROUTER_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  let distilled: string;
  try {
    const raw = await scrape(url);
    distilled = distill(raw);
  } catch (e) {
    return Response.json(
      { error: `Failed to scrape ${url}: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  const userPrompt = `Source URL: ${url}\n\nExtra direction from user: ${body.extra?.trim() || "(none — just build a better modern version of this site)"}\n\nScraped page content (HTML stripped of <script>/<style>):\n\n${distilled}`;

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
          userPrompt,
          model,
          undefined,
          {
            onChunk: (delta) => send({ type: "chunk", delta }),
          },
          { systemText: REMIX_PROMPT },
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
