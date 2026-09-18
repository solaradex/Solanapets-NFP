-- SolanaPets durable identity schema.
-- The application also self-initializes these tables through src/lib/db.ts.
CREATE TABLE IF NOT EXISTS player_identity (
  user_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
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
