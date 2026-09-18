import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { PASSKEY_RP_ID } from "@/lib/passkey-config";
import { setPendingAuthentication } from "@/lib/passkey-store";
import { cookies } from "next/headers";

export async function POST(){
  const c=await cookies();
  const id=crypto.randomUUID();
  c.set("solanapets_auth_challenge",id,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:300});
  const options=await generateAuthenticationOptions({rpID:PASSKEY_RP_ID,userVerification:"required",allowCredentials:[]});
  await setPendingAuthentication(id,options.challenge);
  return Response.json(options);
}
