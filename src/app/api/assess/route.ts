import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { ASSESS_PROMPT } from "@/lib/assess-prompt";
import { DEFAULT_MODEL } from "@/lib/examples";
import {
  type Assessment,
  type ComplexityTier,
  COMPLEXITY_TIERS,
  scoreToTier,
} from "@/lib/complexity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel will cap this at the plan's max (60s on Hobby, 300s on Pro). The
// assessment call is small and usually returns in 2–5s, but the timeout
// gives slow models headroom.
export const maxDuration = 60;

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

  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { error: "Sign in required.", code: "unauthenticated" },
      { status: 401 },
    );
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
        "X-Title": "Henosis Assess",
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              {
                type: "text",
                text: ASSESS_PROMPT,
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

    const assessment = parseAssessment(raw);
    return Response.json({ assessment } satisfies { assessment: Assessment });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message ?? "unknown error" },
      { status: 500 },
    );
  }
}

/**
 * Parse the model's JSON. Tolerant of fenced output and stray prose. If
 * anything is off, we fall back to a safe default ("one-page" / score 5)
 * rather than 500ing — the assessment is a UX hint, not a hard gate, and
 * a 500 here would block the actual site generation.
 */
function parseAssessment(raw: string): Assessment {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    return fallback();
  }
  if (!obj || typeof obj !== "object") return fallback();
  const r = obj as Record<string, unknown>;
  const rawScore = typeof r.score === "number" ? r.score : Number(r.score);
  if (!Number.isFinite(rawScore)) return fallback();
  const score = Math.min(10, Math.max(1, Math.round(rawScore)));
  // Trust the score, derive the tier ourselves so they can never disagree.
  const tier: ComplexityTier = scoreToTier(score);
  const pages = Array.isArray(r.pages)
    ? r.pages.filter((p): p is string => typeof p === "string" && p.length > 0)
    : [];
  const rationale =
    typeof r.rationale === "string" && r.rationale.trim()
      ? r.rationale.trim().slice(0, 200)
      : COMPLEXITY_TIERS[tier].label;
  return {
    score,
    tier,
    pages: pages.length ? pages : COMPLEXITY_TIERS[tier].defaultPages,
    rationale,
    source: "auto",
  };
}

function fallback(): Assessment {
  return {
    score: 5,
    tier: "one-page",
    pages: ["Home"],
    rationale: "Defaulted to a polished single page (assessment parse failed).",
    source: "auto",
  };
}
