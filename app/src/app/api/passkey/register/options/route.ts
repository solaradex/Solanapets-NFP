import { generateRegistrationOptions } from "@simplewebauthn/server";
import { PASSKEY_RP_ID, PASSKEY_RP_NAME } from "@/lib/passkey-config";
import { getPasskeys, setPending } from "@/lib/passkey-store";

export async function POST(request: Request) {
  const { userId } = await request.json();
  if (!userId || typeof userId !== "string") {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  const options = await generateRegistrationOptions({
    rpName: PASSKEY_RP_NAME,
    rpID: PASSKEY_RP_ID,
    userName: userId,
    userDisplayName: "SolanaPets Player",
    attestationType: "none",
    excludeCredentials: getPasskeys(userId).map((p) => ({
      id: p.credentialId,
      transports: p.transports as any,
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  });

  setPending(userId, options.challenge);
  return Response.json(options);
}
