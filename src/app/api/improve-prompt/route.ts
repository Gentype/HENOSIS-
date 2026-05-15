import { NextRequest } from "next/server";
import { IMPROVE_PROMPT } from "@/lib/improve-prompt";
import { DEFAULT_MODEL } from "@/lib/examples";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  prompt: string;
  model?: string;
}

const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";

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

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return Response.json(
      { error: "OPENROUTER_API_KEY is not configured." },
      { status: 503 },
    );
  }

  const model = body.model || DEFAULT_MODEL;

  try {
    const res = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://henosis.app",
        "X-Title": "Henosis Improve Prompt",
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: [
              {
                type: "text",
                text: IMPROVE_PROMPT,
                cache_control: { type: "ephemeral" },
              },
            ],
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json(
        { error: `Model error ${res.status}: ${err.slice(0, 300)}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    const raw: string | undefined = data?.choices?.[0]?.message?.content;
    if (!raw) {
      return Response.json({ error: "Empty model response" }, { status: 502 });
    }

    // Strip wrapping quotes / fences if the model added them.
    const improved = raw
      .trim()
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/```$/, "")
      .replace(/^["“”']\s*/, "")
      .replace(/\s*["“”']$/, "")
      .trim();

    return Response.json({ improved });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message ?? "unknown error" },
      { status: 500 },
    );
  }
}
