export type StoredPasskey = { credentialId:string; publicKey:Uint8Array; counter:number; transports?:string[] };
type Pending={challenge:string;expiresAt:number}; type AuthSession={userId:string;expiresAt:number};
const passkeys=new Map<string,StoredPasskey[]>(), pendingRegistration=new Map<string,Pending>(), pendingAuthentication=new Map<string,Pending>(), sessions=new Map<string,AuthSession>();
const TTL=5*60_000, SESSION_TTL=7*24*60*60_000;
function consumePending(store:Map<string,Pending>,key:string){const v=store.get(key);store.delete(key);if(!v||v.expiresAt<Date.now())return null;return v.challenge}
export function setPendingRegistration(userId:string,challenge:string){pendingRegistration.set(userId,{challenge,expiresAt:Date.now()+TTL})}
export function consumePendingRegistration(userId:string){return consumePending(pendingRegistration,userId)}
export function setPendingAuthentication(id:string,challenge:string){pendingAuthentication.set(id,{challenge,expiresAt:Date.now()+TTL})}
export function consumePendingAuthentication(id:string){return consumePending(pendingAuthentication,id)}
export function getPasskeys(userId:string){return passkeys.get(userId)??[]}
export function getPasskeyByCredentialId(id:string){for(const [userId,credentials] of passkeys){const credential=credentials.find(p=>p.credentialId===id);if(credential)return{userId,credential}}return null}
export function savePasskey(userId:string,passkey:StoredPasskey){passkeys.set(userId,[...getPasskeys(userId),passkey])}
export function updatePasskeyCounter(userId:string,id:string,counter:number){passkeys.set(userId,getPasskeys(userId).map(p=>p.credentialId===id?{...p,counter}:p))}
export function createSession(userId:string){const id=crypto.randomUUID();sessions.set(id,{userId,expiresAt:Date.now()+SESSION_TTL});return id}
export function getSession(id:string){const s=sessions.get(id);if(!s)return null;if(s.expiresAt<Date.now()){sessions.delete(id);return null}return s}
export function revokeSession(id:string){sessions.delete(id)}
