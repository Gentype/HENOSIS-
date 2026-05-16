import { auth } from "@/lib/auth";
import { toDTO, userFromSession } from "@/lib/user-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ user: null });
  }
  const user = await userFromSession(session);
  if (!user) return Response.json({ user: null });
  return Response.json({ user: toDTO(user) });
}
