import { cookies } from "next/headers";
import { getPrimaryWallet, getSession } from "@/lib/passkey-store";

export async function GET() {
  const c = await cookies();
  const sessionId = c.get("solanapets_session")?.value;
  const session = sessionId ? await getSession(sessionId) : null;
  if (!session) return Response.json({ error: "Passkey authentication required" }, { status: 401 });

  const primaryWallet = await getPrimaryWallet(session.userId);
  return Response.json({
    authenticated: true,
    userId: session.userId,
    primaryWallet,
    v2IdentitySeed: "player-v2",
  });
}
