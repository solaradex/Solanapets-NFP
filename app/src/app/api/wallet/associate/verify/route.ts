import { cookies } from "next/headers";
import { getPrimaryWallet, getSession } from "@/lib/passkey-store";
import { consumeWalletChallenge } from "@/lib/wallet-association-store";
import { associateVerifiedWallet, bindPrimaryWallet } from "@/lib/primary-wallet";
import { walletChallengeMessage, verifyEd25519 } from "@/lib/wallet-challenge";

const ORIGIN = process.env.PASSKEY_ORIGIN || "http://localhost:3000";

export async function POST(request: Request) {
  const c = await cookies();
  const sid = c.get("solanapets_session")?.value;
  const s = sid ? await getSession(sid) : null;
  if (!s) return Response.json({ error: "Passkey authentication required" }, { status: 401 });

  const b = await request.json();
  const id = b?.challengeId;
  const sig = b?.signature;
  if (typeof id !== "string" || typeof sig !== "string") {
    return Response.json({ error: "Challenge id and signature are required" }, { status: 400 });
  }

  const ch = await consumeWalletChallenge(id);
  if (!ch || ch.userId !== s.userId) {
    return Response.json({ error: "Wallet challenge expired or invalid" }, { status: 400 });
  }

  try {
    if (!verifyEd25519(ch.wallet, sig, walletChallengeMessage(ORIGIN, ch.wallet, ch.nonce, ch.expiresAt))) {
      return Response.json({ error: "Wallet signature verification failed" }, { status: 401 });
    }
  } catch {
    return Response.json({ error: "Wallet signature verification failed" }, { status: 401 });
  }

  const primaryWallet = await getPrimaryWallet(s.userId);
  if (!primaryWallet) {
    const bound = await bindPrimaryWallet(s.userId, ch.wallet);
    if (!bound) return Response.json({ error: "Unable to bind this wallet as the primary wallet" }, { status: 409 });
    return Response.json({ verified: true, associated: true, wallet: ch.wallet, primaryWallet: ch.wallet, role: "primary", requiresPrimarySignature: false });
  }

  if (primaryWallet === ch.wallet) {
    await associateVerifiedWallet(s.userId, ch.wallet);
    return Response.json({ verified: true, associated: true, wallet: ch.wallet, primaryWallet, role: "primary", requiresPrimarySignature: false });
  }

  const associated = await associateVerifiedWallet(s.userId, ch.wallet);
  if (!associated) return Response.json({ error: "Wallet association could not be recorded" }, { status: 409 });

  return Response.json({
    verified: true,
    associated: true,
    wallet: ch.wallet,
    primaryWallet,
    role: "secondary",
    requiresPrimarySignature: true,
    onChain: false,
  });
}
