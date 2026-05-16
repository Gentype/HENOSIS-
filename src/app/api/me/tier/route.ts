import { auth } from "@/lib/auth";
import {
  ALL_PLANS,
  type Plan,
  setPlan,
  toDTO,
  userFromSession,
} from "@/lib/user-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  plan?: string;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const plan = body.plan as Plan;
  if (!ALL_PLANS.includes(plan)) {
    return Response.json({ error: "Invalid plan" }, { status: 400 });
  }

  // Make sure the record exists before mutating.
  await userFromSession(session);
  const updated = await setPlan(session.user.id, plan);
  if (!updated) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json({ user: toDTO(updated) });
}
