import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { PASSKEY_ORIGIN, PASSKEY_RP_ID } from "@/lib/passkey-config";
import { savePasskey, consumePending } from "@/lib/passkey-store";

export async function POST(request: Request) {
  const { userId, response } = await request.json();
  const expectedChallenge = consumePending(userId);

  if (!expectedChallenge) {
    return Response.json({ error: "Registration challenge expired or missing" }, { status: 400 });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: PASSKEY_ORIGIN,
      expectedRPID: PASSKEY_RP_ID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return Response.json({ error: "Passkey verification failed" }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;
    savePasskey(userId, {
      credentialId: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
    });

    return Response.json({ verified: true, credentialId: credential.id });
  } catch (error) {
    console.error("Passkey registration verification failed", error);
    return Response.json({ error: "Passkey verification failed" }, { status: 400 });
  }
}
