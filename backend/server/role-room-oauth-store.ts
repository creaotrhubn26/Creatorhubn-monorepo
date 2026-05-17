/**
 * DB-backed persistence for Role Room Google OAuth state og transfers.
 *
 * Tidligere lå begge i in-memory Maps som var per-prosess. På Render
 * med horizontal scaling kunne pod A skape state og pod B motta
 * callback fra Google → state-not-found → "Ugyldig forespørsel".
 *
 * Denne fila gir DB-backed get/set/delete som callsites bruker som
 * fallback når Map'en (per-pod-cache) mister treff. Map'en beholdes
 * for sync-API; DB sikrer at multi-pod fungerer.
 *
 * Auto-cleanup: rader med expires_at < NOW() slettes ved hver get.
 */

import type { Pool } from "pg";

let schemaReady = false;

async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_room_oauth_pending_state (
      state_id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_oauth_state_expires
      ON role_room_oauth_pending_state(expires_at);

    CREATE TABLE IF NOT EXISTS role_room_oauth_pending_transfer (
      transfer_id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_oauth_transfer_expires
      ON role_room_oauth_pending_transfer(expires_at);
  `);
  schemaReady = true;
}

export async function persistOauthState(
  pool: Pool,
  stateId: string,
  payload: unknown,
  expiresAt: Date,
): Promise<void> {
  try {
    await ensureSchema(pool);
    await pool.query(
      `INSERT INTO role_room_oauth_pending_state (state_id, payload, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (state_id) DO UPDATE
         SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at`,
      [stateId, JSON.stringify(payload), expiresAt],
    );
  } catch (err) {
    console.error("[oauth-store] persistOauthState failed:", err);
  }
}

export async function loadOauthState<T>(
  pool: Pool,
  stateId: string,
): Promise<T | null> {
  try {
    await ensureSchema(pool);
    // Cleanup: slett utløpte rader hver gang vi leser. Lett-vekts og
    // gjør at vi ikke trenger separat cron.
    await pool.query(`DELETE FROM role_room_oauth_pending_state WHERE expires_at < NOW()`);
    const r = await pool.query(
      `SELECT payload FROM role_room_oauth_pending_state
        WHERE state_id = $1 AND expires_at > NOW() LIMIT 1`,
      [stateId],
    );
    if (r.rows.length === 0) return null;
    return r.rows[0].payload as T;
  } catch (err) {
    console.error("[oauth-store] loadOauthState failed:", err);
    return null;
  }
}

export async function deleteOauthState(pool: Pool, stateId: string): Promise<void> {
  try {
    await ensureSchema(pool);
    await pool.query(`DELETE FROM role_room_oauth_pending_state WHERE state_id = $1`, [stateId]);
  } catch (err) {
    console.error("[oauth-store] deleteOauthState failed:", err);
  }
}

export async function persistOauthTransfer(
  pool: Pool,
  transferId: string,
  payload: unknown,
  expiresAt: Date,
): Promise<void> {
  try {
    await ensureSchema(pool);
    await pool.query(
      `INSERT INTO role_room_oauth_pending_transfer (transfer_id, payload, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (transfer_id) DO UPDATE
         SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at`,
      [transferId, JSON.stringify(payload), expiresAt],
    );
  } catch (err) {
    console.error("[oauth-store] persistOauthTransfer failed:", err);
  }
}

export async function loadOauthTransfer<T>(
  pool: Pool,
  transferId: string,
): Promise<T | null> {
  try {
    await ensureSchema(pool);
    await pool.query(`DELETE FROM role_room_oauth_pending_transfer WHERE expires_at < NOW()`);
    const r = await pool.query(
      `SELECT payload FROM role_room_oauth_pending_transfer
        WHERE transfer_id = $1 AND expires_at > NOW() LIMIT 1`,
      [transferId],
    );
    if (r.rows.length === 0) return null;
    return r.rows[0].payload as T;
  } catch (err) {
    console.error("[oauth-store] loadOauthTransfer failed:", err);
    return null;
  }
}

export async function deleteOauthTransfer(pool: Pool, transferId: string): Promise<void> {
  try {
    await ensureSchema(pool);
    await pool.query(`DELETE FROM role_room_oauth_pending_transfer WHERE transfer_id = $1`, [transferId]);
  } catch (err) {
    console.error("[oauth-store] deleteOauthTransfer failed:", err);
  }
}
