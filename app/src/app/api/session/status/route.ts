import { cookies } from "next/headers";
import { getSession } from "@/lib/passkey-store";

export async function GET() {
  const c = await cookies();
  const sessionId = c.get("solanapets_session")?.value;
  if (!sessionId) return Response.json({ authenticated: false }, { status: 401 });

  const session = await getSession(sessionId);
  if (!session) {
    c.delete("solanapets_session");
    return Response.json({ authenticated: false }, { status: 401 });
  }

  return Response.json({
    authenticated: true,
    userId: session.userId,
    expiresAt: session.expiresAt,
  });
}
