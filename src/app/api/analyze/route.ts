import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { analyzePrompt, DEFAULT_ANALYZE_MODEL } from "@/lib/analyze-prompt";
import { userFromSession } from "@/lib/user-store";
import type { ComplexityAnalysis } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  prompt: string;
  /** Optional model override; defaults to a small/fast classifier. */
  model?: string;
}

/**
 * POST /api/analyze
 *
 * The "Quality Check" classifier. Called from the /generate page **before**
 * /api/generate streams. Returns a tiny JSON object with a 1–10 complexity
 * score, recommended pages, and target stack.
 *
 * Auth-gated (same as /api/generate) but does NOT count against the user's
 * generation quota — the heavy main call does that on success.
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").trim();
  if (prompt.length < 5) {
    return Response.json(
      { error: "Prompt too short (min 5 chars)" },
      { status: 400 },
    );
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      {
        error: "OPENROUTER_API_KEY is not configured on the server.",
      },
      { status: 503 },
    );
  }

  const session = await auth();
  const user = await userFromSession(session);
  if (!user) {
    return Response.json(
      { error: "Sign in to analyze prompts.", code: "unauthenticated" },
      { status: 401 },
    );
  }

  try {
    const analysis: ComplexityAnalysis = await analyzePrompt(
      prompt,
      body.model || DEFAULT_ANALYZE_MODEL,
    );
    return Response.json({ analysis });
  } catch (err) {
    return Response.json(
      { error: (err as Error).message || "Quality Check failed" },
      { status: 502 },
    );
  }
}
