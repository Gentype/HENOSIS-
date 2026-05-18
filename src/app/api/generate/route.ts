import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { generateSiteStream, type ComplexityContext } from "@/lib/generate";
import { DEFAULT_MODEL } from "@/lib/examples";
import type { ComplexityAnalysis, GenerateResultFile } from "@/lib/types";
import {
  PLAN_LIMITS,
  incrementUsage,
  quotaRemaining,
  userFromSession,
} from "@/lib/user-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  prompt: string;
  model?: string;
  priorFiles?: GenerateResultFile[];
  /**
   * Optional output of the Quality Check classifier. When present, it's
   * injected into the user message as a `<complexity>` block so the Site
   * Architect sizes its build accordingly.
   */
  analysis?: ComplexityAnalysis;
  /**
   * Manual override (2–10) from a Silver/Gold user. Coerces the analysis
   * score / stack to match. Ignored for free users (the route doesn't
   * gate it here — the prompt-box does — but we still clamp and clean.).
   */
  complexityOverride?: number;
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

  const session = await auth();
  const user = await userFromSession(session);
  if (!user) {
    return Response.json(
      { error: "Sign in to generate sites.", code: "unauthenticated" },
      { status: 401 },
    );
  }

  if (quotaRemaining(user) <= 0) {
    const limit = PLAN_LIMITS[user.plan];
    return Response.json(
      {
        error: `You've used all ${limit} generations on your current plan. Upgrade at /pricing.`,
        code: "quota_exceeded",
      },
      { status: 402 },
    );
  }

  const encoder = new TextEncoder();
  const model = body.model || DEFAULT_MODEL;

  // Resolve the complexity context: start from the analyzer's result, then
  // let a Silver/Gold-tier manual override coerce score + stack. Free users
  // can still send `analysis` but they don't get the override slider in the
  // UI, so `complexityOverride` is normally absent for them.
  const complexity = resolveComplexity(body);

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: object) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      }

      try {
        send({
          type: "start",
          model,
          complexity: complexity
            ? {
                score: complexity.score,
                stack: complexity.stack,
                tier: complexity.tier,
                userOverride: complexity.userOverride ?? false,
              }
            : undefined,
        });

        const result = await generateSiteStream(
          prompt,
          model,
          body.priorFiles,
          {
            onChunk: (delta) => {
              send({ type: "chunk", delta });
            },
          },
          undefined,
          complexity,
        );

        // Only count successful generations against the user's quota.
        await incrementUsage(user.id);

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

/**
 * Merge analyzer output + optional user override into a single
 * {@link ComplexityContext} for the Site Architect. Returns `undefined`
 * when neither was provided (callers fall back to the legacy "no
 * complexity" path).
 */
function resolveComplexity(body: Body): ComplexityContext | undefined {
  const analysis = body.analysis;
  const override = body.complexityOverride;

  if (!analysis && (override == null || !Number.isFinite(override))) {
    return undefined;
  }

  let score = analysis?.score ?? 5;
  let stack = analysis?.stack ?? "html";
  let tier = analysis?.tier;
  let userOverride = false;
  if (override != null && Number.isFinite(override)) {
    score = Math.max(2, Math.min(10, Math.round(override)));
    // Canonical contract: only "html" (≤4) or "react-ts" (≥5). The legacy
    // values "js-modules" / "typescript" used to leak in here from the
    // pre-PR-11 codebase and confused the Site Architect — it would get
    // told "stack=typescript" but the runtime expects React+TS files.
    stack = score <= 4 ? "html" : "react-ts";
    // Drop stale tier label when the user override changes the score band.
    if (
      analysis &&
      analysis.score !== score &&
      !analysis.userOverride
    ) {
      tier = undefined;
    }
    userOverride = true;
  }

  return {
    score,
    stack,
    tier,
    recommendedPages: analysis?.recommendedPages,
    reasoning: analysis?.reasoning,
    userOverride,
  };
}
