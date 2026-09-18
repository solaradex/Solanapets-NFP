import { cookies } from "next/headers";
import { revokeSession } from "@/lib/passkey-store";

export async function POST() {
  const c = await cookies();
  const sessionId = c.get("solanapets_session")?.value;

  if (sessionId) await revokeSession(sessionId);
  c.delete("solanapets_session");

  return Response.json({ authenticated: false });
}
