import crypto from "node:crypto";
import { ensureIdentitySchema, pool } from "./db";

export type StoredPasskey = {
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: string[];
};

type Pending = { challenge: string; expiresAt: number };
type AuthSession = { userId: string; expiresAt: number };

const memoryPasskeys = new Map<string, StoredPasskey[]>();
const memoryPending = new Map<string, Pending>();
const memorySessions = new Map<string, AuthSession>();
const memoryPrimaryWallets = new Map<string, string>();

function durable() { return Boolean(process.env.DATABASE_URL); }

export async function ensurePlayerIdentity(userId?: string) {
  const id = userId || crypto.randomUUID();
  if (!durable()) return id;
  await ensureIdentitySchema();
  await pool.query("INSERT INTO player_identity(user_id) VALUES($1) ON CONFLICT DO NOTHING", [id]);
  return id;
}

export async function getPrimaryWallet(userId: string): Promise<string | null> {
  if (!durable()) return memoryPrimaryWallets.get(userId) ?? null;
  await ensureIdentitySchema();
  const r = await pool.query("SELECT primary_wallet FROM player_identity WHERE user_id=$1", [userId]);
  return r.rows[0]?.primary_wallet ?? null;
}

export async function setPrimaryWallet(userId: string, wallet: string): Promise<boolean> {
  if (!durable()) {
    const existing = memoryPrimaryWallets.get(userId);
    if (existing && existing !== wallet) return false;
    memoryPrimaryWallets.set(userId, wallet);
    return true;
  }
  await ensureIdentitySchema();
  const r = await pool.query(
    "UPDATE player_identity SET primary_wallet=COALESCE(primary_wallet,$2) WHERE user_id=$1 AND (primary_wallet IS NULL OR primary_wallet=$2) RETURNING primary_wallet",
    [userId, wallet],
  );
  return r.rowCount === 1;
}

export async function setPendingRegistration(userId: string, challenge: string) {
  if (!durable()) { memoryPending.set(userId, { challenge, expiresAt: Date.now() + 300000 }); return; }
  await ensureIdentitySchema();
  await pool.query(
    "INSERT INTO auth_challenge(challenge_id,user_id,kind,challenge,expires_at) VALUES($1,$2,'registration',$3,NOW()+INTERVAL '5 minutes') ON CONFLICT(challenge_id) DO UPDATE SET challenge=EXCLUDED.challenge,expires_at=EXCLUDED.expires_at",
    [userId, userId, challenge]
  );
}
export async function consumePendingRegistration(userId: string) {
  if (!durable()) { const v=memoryPending.get(userId); memoryPending.delete(userId); return v && v.expiresAt >= Date.now() ? v.challenge : null; }
  await ensureIdentitySchema();
  const r=await pool.query("DELETE FROM auth_challenge WHERE challenge_id=$1 AND kind='registration' AND expires_at>NOW() RETURNING challenge",[userId]);
  return r.rows[0]?.challenge ?? null;
}
export async function setPendingAuthentication(id:string,challenge:string) {
  if (!durable()) { memoryPending.set(id,{challenge,expiresAt:Date.now()+300000}); return; }
  await ensureIdentitySchema();
  await pool.query("INSERT INTO auth_challenge(challenge_id,user_id,kind,challenge,expires_at) VALUES($1,'__discoverable__','authentication',$2,NOW()+INTERVAL '5 minutes') ON CONFLICT(challenge_id) DO UPDATE SET challenge=EXCLUDED.challenge,expires_at=EXCLUDED.expires_at",[id,challenge]);
}
export async function consumePendingAuthentication(id:string) {
  if (!durable()) { const v=memoryPending.get(id); memoryPending.delete(id); return v && v.expiresAt >= Date.now() ? v.challenge : null; }
  await ensureIdentitySchema();
  const r=await pool.query("DELETE FROM auth_challenge WHERE challenge_id=$1 AND kind='authentication' AND expires_at>NOW() RETURNING challenge",[id]);
  return r.rows[0]?.challenge ?? null;
}
export async function getPasskeys(userId:string):Promise<StoredPasskey[]> {
  if (!durable()) return memoryPasskeys.get(userId) ?? [];
  await ensureIdentitySchema();
  const r=await pool.query("SELECT credential_id,public_key,counter,transports FROM passkey_credential WHERE user_id=$1",[userId]);
  return r.rows.map(x=>({credentialId:x.credential_id,publicKey:new Uint8Array(x.public_key),counter:Number(x.counter),transports:x.transports}));
}
export async function getPasskeyByCredentialId(id:string) {
  if (!durable()) { for(const [userId,credentials] of memoryPasskeys){const credential=credentials.find(p=>p.credentialId===id);if(credential)return{userId,credential}} return null; }
  await ensureIdentitySchema();
  const r=await pool.query("SELECT user_id,credential_id,public_key,counter,transports FROM passkey_credential WHERE credential_id=$1",[id]);
  const x=r.rows[0]; return x ? {userId:x.user_id,credential:{credentialId:x.credential_id,publicKey:new Uint8Array(x.public_key),counter:Number(x.counter),transports:x.transports}} : null;
}
export async function savePasskey(userId:string,p:StoredPasskey) {
  if (!durable()) { memoryPasskeys.set(userId,[...(memoryPasskeys.get(userId)??[]),p]); return; }
  await ensureIdentitySchema();
  await pool.query("INSERT INTO passkey_credential(credential_id,user_id,public_key,counter,transports) VALUES($1,$2,$3,$4,$5) ON CONFLICT(credential_id) DO UPDATE SET public_key=EXCLUDED.public_key,counter=EXCLUDED.counter,transports=EXCLUDED.transports",[p.credentialId,userId,Buffer.from(p.publicKey),p.counter,p.transports??[]]);
}
export async function updatePasskeyCounter(userId:string,id:string,counter:number) {
  if (!durable()) { memoryPasskeys.set(userId,(memoryPasskeys.get(userId)??[]).map(p=>p.credentialId===id?{...p,counter}:p)); return; }
  await ensureIdentitySchema();
  await pool.query("UPDATE passkey_credential SET counter=$1 WHERE credential_id=$2 AND user_id=$3",[counter,id,userId]);
}
export async function createSession(userId:string) {
  const id=crypto.randomUUID();
  if (!durable()) { memorySessions.set(id,{userId,expiresAt:Date.now()+604800000}); return id; }
  await ensureIdentitySchema();
  await pool.query("INSERT INTO auth_session(session_id,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '7 days')",[id,userId]);
  return id;
}
export async function getSession(id:string):Promise<AuthSession|null> {
  if (!durable()) { const s=memorySessions.get(id);if(!s)return null;if(s.expiresAt<Date.now()){memorySessions.delete(id);return null}return s; }
  await ensureIdentitySchema();
  const r=await pool.query("SELECT user_id,EXTRACT(EPOCH FROM expires_at)*1000 AS expires_ms FROM auth_session WHERE session_id=$1 AND expires_at>NOW()",[id]);
  const x=r.rows[0]; return x?{userId:x.user_id,expiresAt:Number(x.expires_ms)}:null;
}
export async function revokeSession(id:string) {
  if (!durable()) { memorySessions.delete(id); return; }
  await ensureIdentitySchema();
  await pool.query("DELETE FROM auth_session WHERE session_id=$1",[id]);
}