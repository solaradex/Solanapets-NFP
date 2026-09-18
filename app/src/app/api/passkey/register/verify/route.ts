import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { PASSKEY_ORIGIN,PASSKEY_RP_ID } from "@/lib/passkey-config";
import { savePasskey,consumePendingRegistration,createSession } from "@/lib/passkey-store";
import { cookies } from "next/headers";

export async function POST(request:Request){
  const c=await cookies();
  const userId=c.get("solanapets_registration_id")?.value;
  if(!userId)return Response.json({error:"Registration session is missing"},{status:400});
  const expectedChallenge=await consumePendingRegistration(userId);
  if(!expectedChallenge)return Response.json({error:"Registration challenge expired or missing"},{status:400});
  try{
    const response=await request.json();
    const verification=await verifyRegistrationResponse({response,expectedChallenge,expectedOrigin:PASSKEY_ORIGIN,expectedRPID:PASSKEY_RP_ID,requireUserVerification:true});
    if(!verification.verified||!verification.registrationInfo)return Response.json({error:"Passkey verification failed"},{status:400});
    const {credential}=verification.registrationInfo;
    await savePasskey(userId,{credentialId:credential.id,publicKey:credential.publicKey,counter:credential.counter,transports:response.response?.transports});
    c.delete("solanapets_registration_id");
    c.set("solanapets_session",await createSession(userId),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:604800});
    return Response.json({verified:true});
  }catch(error){console.error("Passkey registration verification failed",error);return Response.json({error:"Passkey verification failed"},{status:400})}
}
