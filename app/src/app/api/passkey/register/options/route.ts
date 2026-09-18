import { generateRegistrationOptions } from "@simplewebauthn/server";
import { PASSKEY_RP_ID,PASSKEY_RP_NAME } from "@/lib/passkey-config";
import { ensurePlayerIdentity,getPasskeys,setPendingRegistration } from "@/lib/passkey-store";
import { cookies } from "next/headers";

export async function POST() {
  const c=await cookies();
  let userId=c.get("solanapets_registration_id")?.value;
  if(!userId) userId=await ensurePlayerIdentity();
  const options=await generateRegistrationOptions({
    rpName:PASSKEY_RP_NAME,rpID:PASSKEY_RP_ID,userName:userId,userDisplayName:"SolanaPets Player",
    attestationType:"none",
    excludeCredentials:(await getPasskeys(userId)).map(p=>({id:p.credentialId,transports:p.transports as any})),
    authenticatorSelection:{residentKey:"required",userVerification:"required"}
  });
  await setPendingRegistration(userId,options.challenge);
  c.set("solanapets_registration_id",userId,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:300});
  return Response.json(options);
}
