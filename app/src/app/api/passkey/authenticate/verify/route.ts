import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { PASSKEY_ORIGIN,PASSKEY_RP_ID } from "@/lib/passkey-config";
import { consumePendingAuthentication,createSession,getPasskeyByCredentialId,updatePasskeyCounter } from "@/lib/passkey-store";
import { cookies } from "next/headers";

export async function POST(request:Request){
  const c=await cookies(),challengeId=c.get("solanapets_auth_challenge")?.value;
  if(!challengeId)return Response.json({error:"Authentication challenge is missing"},{status:400});
  const expectedChallenge=await consumePendingAuthentication(challengeId);c.delete("solanapets_auth_challenge");
  if(!expectedChallenge)return Response.json({error:"Authentication challenge expired or missing"},{status:400});
  const response=await request.json(),id=response?.id;
  if(!id||typeof id!=="string")return Response.json({error:"Credential id is required"},{status:400});
  const stored=await getPasskeyByCredentialId(id);if(!stored)return Response.json({error:"Passkey not recognized"},{status:401});
  try{
    const verification=await verifyAuthenticationResponse({response,expectedChallenge,expectedOrigin:PASSKEY_ORIGIN,expectedRPID:PASSKEY_RP_ID,requireUserVerification:true,credential:{id:stored.credential.credentialId,publicKey:stored.credential.publicKey,counter:stored.credential.counter,transports:stored.credential.transports as unknown as never}});
    if(!verification.verified)return Response.json({error:"Passkey authentication failed"},{status:401});
    await updatePasskeyCounter(stored.userId,stored.credential.credentialId,verification.authenticationInfo.newCounter);
    c.set("solanapets_session",await createSession(stored.userId),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:604800});
    return Response.json({verified:true});
  }catch(error){console.error("Passkey authentication verification failed",error);return Response.json({error:"Passkey authentication failed"},{status:401})}
}
