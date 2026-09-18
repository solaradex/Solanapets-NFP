import { ensureIdentitySchema, pool } from "./db";

const memoryPrimary = new Map<string, string>();
const memoryOwners = new Map<string, string>();

export async function bindPrimaryWallet(userId: string, wallet: string): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    const owner = memoryOwners.get(wallet);
    const current = memoryPrimary.get(userId);
    if ((owner && owner !== userId) || (current && current !== wallet)) return false;
    memoryOwners.set(wallet, userId);
    memoryPrimary.set(userId, wallet);
    return true;
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
    await client.query("INSERT INTO wallet_association(user_id,wallet) VALUES($1,$2) ON CONFLICT(wallet) DO UPDATE SET active=TRUE WHERE wallet_association.user_id=EXCLUDED.user_id", [userId, wallet]);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}