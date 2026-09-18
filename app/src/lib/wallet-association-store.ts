type Pending={userId:string;wallet:string;nonce:string;expiresAt:number};
const pending=new Map<string,Pending>();const TTL=5*60_000;
export function setWalletChallenge(id:string,v:Omit<Pending,"expiresAt">){pending.set(id,{...v,expiresAt:Date.now()+TTL})}
export function consumeWalletChallenge(id:string){const v=pending.get(id);pending.delete(id);if(!v||v.expiresAt<Date.now())return null;return v}
