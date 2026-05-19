import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getProject, toStatusDTO } from "@/lib/project-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/projects/{id}/status
 *
 * Returns the live state of a generation that the server is (or was)
 * running. Used by the workshop page (`/generate`) to:
 *
 *   1. Detect when the user reopens the page mid-generation. If we have
 *      a record with status="generating", the client switches to live
 *      polling instead of restarting the generation from scratch.
 *
 *   2. Stream live progress to a reconnecting client. The `partial`
 *      field contains the accumulated raw response from OpenRouter, so
 *      the LiveBuilder UI can keep showing "writing src/components/Hero.tsx…"
 *      without ever having held the SSE connection.
 *
 *   3. Fetch the final `result` once status flips to "done", letting
 *      the client display the finished site without ever having held
 *      the original stream open.
 *
 * Auth: must be signed in AND own the project (the project's userId
 * must match the session user id). Anything else returns 403/404 to
 * avoid leaking project existence across users.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id || typeof id !== "string") {
    return Response.json({ error: "Missing project id" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { error: "Sign in to read project status.", code: "unauthenticated" },
      { status: 401 },
    );
  }

  const project = await getProject(id);
  if (!project) {
    // 404 (not 403) when the project genuinely doesn't exist. The
    // ownership check below returns 404 too, by design — we never want
    // the existence of a project id to be a side-channel.
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.userId !== session.user.id) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  return Response.json({ project: toStatusDTO(project) });
}
