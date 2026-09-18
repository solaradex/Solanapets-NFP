import { ensureIdentitySchema,pool } from "./db";

type Pending={userId:string;wallet:string;nonce:string;expiresAt:number};
const memory=new Map<string,Pending>();

export async function setWalletChallenge(id:string,v:Omit<Pending,"expiresAt">){
  if(!process.env.DATABASE_URL){memory.set(id,{...v,expiresAt:Date.now()+300000});return}
  await ensureIdentitySchema();
  await pool.query("INSERT INTO auth_challenge(challenge_id,user_id,kind,challenge,expires_at) VALUES($1,$2,'wallet',$3,NOW()+INTERVAL '5 minutes')",[id,v.userId,JSON.stringify({wallet:v.wallet,nonce:v.nonce})]);
}
export async function consumeWalletChallenge(id:string){
  if(!process.env.DATABASE_URL){const v=memory.get(id);memory.delete(id);return v&&v.expiresAt>=Date.now()?v:null}
  await ensureIdentitySchema();
  const r=await pool.query("DELETE FROM auth_challenge WHERE challenge_id=$1 AND kind='wallet' AND expires_at>NOW() RETURNING user_id,challenge,EXTRACT(EPOCH FROM expires_at)*1000 AS expires_ms",[id]);
  const x=r.rows[0];if(!x)return null;
  const data=JSON.parse(x.challenge);
  return {userId:x.user_id,wallet:data.wallet,nonce:data.nonce,expiresAt:Number(x.expires_ms)};
}
