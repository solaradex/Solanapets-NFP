import { Pool } from "pg";

const globalForDb = globalThis as unknown as { solanaPetsPool?: Pool };
export const pool =
  globalForDb.solanaPetsPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") globalForDb.solanaPetsPool = pool;

let schemaPromise: Promise<void> | null = null;
export function ensureIdentitySchema() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for durable identity storage");
  schemaPromise ??= pool.query(`
    CREATE TABLE IF NOT EXISTS player_identity (
      user_id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      primary_wallet TEXT
    );
    ALTER TABLE player_identity ADD COLUMN IF NOT EXISTS primary_wallet TEXT;
    CREATE TABLE IF NOT EXISTS passkey_credential (
      credential_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES player_identity(user_id) ON DELETE CASCADE,
      public_key BYTEA NOT NULL,
      counter BIGINT NOT NULL,
      transports TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS auth_challenge (
      challenge_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      challenge TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_session (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES player_identity(user_id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS wallet_association (
      user_id TEXT NOT NULL REFERENCES player_identity(user_id) ON DELETE CASCADE,
      wallet TEXT PRIMARY KEY,
      associated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      active BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE INDEX IF NOT EXISTS wallet_association_user_idx ON wallet_association(user_id);
    CREATE INDEX IF NOT EXISTS passkey_user_idx ON passkey_credential(user_id);
    CREATE INDEX IF NOT EXISTS challenge_expiry_idx ON auth_challenge(expires_at);
    CREATE INDEX IF NOT EXISTS session_expiry_idx ON auth_session(expires_at);
  `).then(() => undefined);
  return schemaPromise;
}