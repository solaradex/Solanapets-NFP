import { ensureIdentitySchema, pool } from "./db";
import { getPrimaryWallet, setPrimaryWallet } from "./passkey-store";
import { recordWalletAssociation } from "./wallet-association-store";

export async function bindPrimaryWallet(userId: string, wallet: string): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    const current = await getPrimaryWallet(userId);
    if (current && current !== wallet) return false;
    if (!(await recordWalletAssociation(userId, wallet))) return false;
    return setPrimaryWallet(userId, wallet);
  }
  await ensureIdentitySchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const owner = await client.query("SELECT user_id FROM wallet_association WHERE wallet=$1 FOR UPDATE", [wallet]);
    const identity = await client.query("SELECT primary_wallet FROM player_identity WHERE user_id=$1 FOR UPDATE", [userId]);
    if (!identity.rows[0] || (owner.rows[0] && owner.rows[0].user_id !== userId) || (identity.rows[0].primary_wallet && identity.rows[0].primary_wallet !== wallet)) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query("UPDATE player_identity SET primary_wallet=$2 WHERE user_id=$1", [userId, wallet]);
    await client.query("INSERT INTO wallet_association(user_id,wallet) VALUES($1,$2) ON CONFLICT(wallet) DO UPDATE SET active=TRUE WHERE wallet_association.user_id=EXCLUDED.user_id");
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function associateVerifiedWallet(userId: string, wallet: string): Promise<boolean> {
  if (process.env.DATABASE_URL) {
    await ensureIdentitySchema();
    const identity = await pool.query("SELECT primary_wallet FROM player_identity WHERE user_id=$1", [userId]);
    if (!identity.rows[0]) return false;
  }
  return recordWalletAssociation(userId, wallet);
}
