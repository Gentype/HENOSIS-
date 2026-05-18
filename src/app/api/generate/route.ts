import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { generateSiteStream } from "@/lib/generate";
import { DEFAULT_MODEL } from "@/lib/examples";
import {
  type Assessment,
  canUseManualComplexity,
  scoreToTier,
  COMPLEXITY_TIERS,
} from "@/lib/complexity";
import type { GenerateResultFile } from "@/lib/types";
import {
  PLAN_LIMITS,
  incrementUsage,
  quotaRemaining,
  userFromSession,
} from "@/lib/user-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Capped automatically by Vercel to the plan limit (60s on Hobby, 300s on
// Pro / new-platform). Setting it explicitly stops slow OpenRouter TTFB
// from killing the connection at the default 10s and surfacing as
// "Generation failed: Load failed" on the client.
export const maxDuration = 300;

interface Body {
  prompt: string;
  model?: string;
  priorFiles?: GenerateResultFile[];
  /** Complexity assessment from /api/assess (or a Silver+ manual override). */
  assessment?: Assessment;
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
  const assessment = sanitizeAssessment(body.assessment, user.plan);

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: object) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      }
      // SSE comment line — invisible to the client parser, but keeps any
      // upstream proxy (Vercel's edge, Cloudflare, an enterprise reverse
      // proxy) from closing a "silent" connection while OpenRouter TTFBs.
      // Without this, slow first-chunks surface as "Load failed" / aborted
      // fetches on the browser side.
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
        send({ type: "start", model, assessment });
        // First heartbeat right away so the proxy sees bytes before the
        // first slow OpenRouter chunk arrives.
        heartbeat();

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
          { assessment },
        );

        // Only count successful generations against the user's quota.
        await incrementUsage(user.id);

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

/**
 * Validate & normalise a client-provided assessment.
 *
 * - If nothing was sent → returns undefined (the architect falls back to its
 *   own heuristics).
 * - If the user is on the free (Bronze) plan, manual overrides are silently
 *   demoted to "auto" — manual complexity is a Silver+ feature. We still
 *   honour the score so we don't waste their click; we just don't trust
 *   it as user intent.
 * - The tier is recomputed from the score server-side so an attacker
 *   can't pair score=1 with tier="max" to game the prompt.
 */
function sanitizeAssessment(
  raw: Assessment | undefined,
  plan: "free" | "pro" | "ultra",
): Assessment | undefined {
  if (!raw) return undefined;
  const score =
    typeof raw.score === "number" && Number.isFinite(raw.score)
      ? Math.min(10, Math.max(1, Math.round(raw.score)))
      : null;
  if (score === null) return undefined;
  const tier = scoreToTier(score);
  const fallbackPages = COMPLEXITY_TIERS[tier].defaultPages;
  const pages =
    Array.isArray(raw.pages) &&
    raw.pages.every((p) => typeof p === "string" && p.length > 0) &&
    raw.pages.length > 0
      ? raw.pages.slice(0, 10)
      : fallbackPages;
  const requestedSource: "auto" | "manual" =
    raw.source === "manual" ? "manual" : "auto";
  const source: "auto" | "manual" =
    requestedSource === "manual" && !canUseManualComplexity(plan)
      ? "auto"
      : requestedSource;
  const rationale =
    typeof raw.rationale === "string" && raw.rationale.trim()
      ? raw.rationale.trim().slice(0, 200)
      : COMPLEXITY_TIERS[tier].label;
  return { score, tier, pages, rationale, source };
}
