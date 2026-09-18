import { cookies } from "next/headers";
import { PublicKey } from "@solana/web3.js";
import { getPrimaryWallet, getSession } from "@/lib/passkey-store";

const PROGRAM_ID = new PublicKey("5BQfuedprGSxUQcqiP1enfA8J721dF274dYTvt4qwwsQ");

export async function GET() {
  const c = await cookies();
  const sessionId = c.get("solanapets_session")?.value;
  const session = sessionId ? await getSession(sessionId) : null;
  if (!session) return Response.json({ error: "Passkey authentication required" }, { status: 401 });
  const primaryWallet = await getPrimaryWallet(session.userId);
  const v2IdentityPda = primaryWallet
    ? PublicKey.findProgramAddressSync([Buffer.from("player-v2"), new PublicKey(primaryWallet).toBuffer()], PROGRAM_ID)[0].toBase58()
    : null;
  return Response.json({ authenticated: true, userId: session.userId, primaryWallet, v2IdentityPda });
}
