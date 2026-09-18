import type { RegistrationResponseJSON } from "@simplewebauthn/server";

export type StoredPasskey = {
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: string[];
};

type Pending = { challenge: string; expiresAt: number };
const passkeys = new Map<string, StoredPasskey[]>();
const pending = new Map<string, Pending>();

export function setPending(userId: string, challenge: string) {
  pending.set(userId, { challenge, expiresAt: Date.now() + 5 * 60_000 });
}

export function consumePending(userId: string) {
  const value = pending.get(userId);
  pending.delete(userId);
  if (!value || value.expiresAt < Date.now()) return null;
  return value.challenge;
}

export function getPasskeys(userId: string) {
  return passkeys.get(userId) ?? [];
}

export function savePasskey(userId: string, passkey: StoredPasskey) {
  const existing = getPasskeys(userId);
  passkeys.set(userId, [...existing, passkey]);
}
