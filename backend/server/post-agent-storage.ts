/**
 * Persistent storage for The Role Room Post Agent.
 *
 * Three tables, all created on first use (CREATE TABLE IF NOT EXISTS):
 *   - post_agent_pairing_codes  — short-lived device-code pairing flow
 *   - post_agent_usage          — Claude token usage per user (for metering)
 *   - post_agent_devices        — paired Post Agent installs (for revoke UI)
 *
 * Why DB instead of in-memory:
 * Render restarts containers regularly. In-memory codes would mean any
 * user mid-pairing has their code silently invalidated. Same for usage —
 * we want a permanent audit trail for billing.
 *
 * All functions are non-throwing — if the DB is unreachable, they return
 * sensible defaults so the rest of the app keeps working (degraded mode).
 */

import type { Pool } from 'pg';

const PAIRING_TABLE = 'post_agent_pairing_codes';
const USAGE_TABLE = 'post_agent_usage';
const DEVICE_TABLE = 'post_agent_devices';
const TEAM_SEATS_TABLE = 'post_agent_team_seats';
const TEAM_SUBSCRIPTIONS_TABLE = 'post_agent_team_subscriptions';

let tablesReadyPromise: Promise<boolean> | null = null;

export async function ensurePostAgentTables(pool: Pool): Promise<boolean> {
  if (tablesReadyPromise) return tablesReadyPromise;
  tablesReadyPromise = (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${PAIRING_TABLE} (
          code            TEXT PRIMARY KEY,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at      TIMESTAMPTZ NOT NULL,
          bearer_token    TEXT,
          paired_user_id  TEXT,
          paired_at       TIMESTAMPTZ
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS ${PAIRING_TABLE}_expires_idx
        ON ${PAIRING_TABLE} (expires_at)
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${USAGE_TABLE} (
          id            BIGSERIAL PRIMARY KEY,
          user_id       TEXT NOT NULL,
          model         TEXT NOT NULL,
          input_tokens  INTEGER NOT NULL DEFAULT 0,
          output_tokens INTEGER NOT NULL DEFAULT 0,
          at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS ${USAGE_TABLE}_user_at_idx
        ON ${USAGE_TABLE} (user_id, at DESC)
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${DEVICE_TABLE} (
          token       TEXT PRIMARY KEY,
          user_id     TEXT NOT NULL,
          label       TEXT,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          revoked_at  TIMESTAMPTZ
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS ${DEVICE_TABLE}_user_idx
        ON ${DEVICE_TABLE} (user_id)
      `);
      // ---- Team-seat tables (marketplace per-production licensing) ----
      // Each (project_id, user_id) pair represents one paid seat held by the
      // lead (projects.user_id) for that crew member. Stripe subscription_item
      // quantity = COUNT(seats WHERE revoked_at IS NULL) per project.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${TEAM_SUBSCRIPTIONS_TABLE} (
          project_id                  TEXT PRIMARY KEY,
          owner_user_id               TEXT NOT NULL,
          stripe_subscription_id      TEXT NOT NULL,
          stripe_subscription_item_id TEXT NOT NULL,
          seat_count                  INTEGER NOT NULL DEFAULT 0,
          created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          status                      TEXT NOT NULL DEFAULT 'active'
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS ${TEAM_SUBSCRIPTIONS_TABLE}_owner_idx
        ON ${TEAM_SUBSCRIPTIONS_TABLE} (owner_user_id)
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${TEAM_SEATS_TABLE} (
          id          BIGSERIAL PRIMARY KEY,
          project_id  TEXT NOT NULL,
          user_id     TEXT NOT NULL,
          granted_by  TEXT NOT NULL,
          granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          revoked_at  TIMESTAMPTZ,
          UNIQUE (project_id, user_id)
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS ${TEAM_SEATS_TABLE}_user_active_idx
        ON ${TEAM_SEATS_TABLE} (user_id) WHERE revoked_at IS NULL
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS ${TEAM_SEATS_TABLE}_project_idx
        ON ${TEAM_SEATS_TABLE} (project_id)
      `);
      // À la carte per-modul-entitlements (speiler migrasjon 259 — opprettes
      // også her så modul-rutene + webhooken aldri treffer en manglende tabell
      // hvis auto-migrate skulle feile stille).
      await pool.query(`
        CREATE TABLE IF NOT EXISTS post_agent_module_entitlements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          module TEXT NOT NULL CHECK (module IN ('demo_studio','marketing','capture','resolve','bundle')),
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
          source TEXT NOT NULL DEFAULT 'stripe' CHECK (source IN ('stripe','bundle','admin_grant')),
          stripe_subscription_id TEXT,
          stripe_price_id TEXT,
          notes TEXT,
          granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          revoked_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS post_agent_module_entitlements_active_idx
        ON post_agent_module_entitlements (user_id, module) WHERE revoked_at IS NULL
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS post_agent_module_entitlements_sub_idx
        ON post_agent_module_entitlements (stripe_subscription_id)
      `);
      return true;
    } catch (error) {
      console.warn('[post-agent] storage init failed:', error);
      tablesReadyPromise = null;
      return false;
    }
  })();
  return tablesReadyPromise;
}

// ---- Pairing codes ----

export interface PairingRow {
  code: string;
  createdAt: Date;
  expiresAt: Date;
  bearerToken: string | null;
  pairedUserId: string | null;
  pairedAt: Date | null;
}

export async function insertPairingCode(
  pool: Pool,
  code: string,
  ttlMs: number,
): Promise<boolean> {
  if (!(await ensurePostAgentTables(pool))) return false;
  const expiresAt = new Date(Date.now() + ttlMs);
  try {
    await pool.query(
      `INSERT INTO ${PAIRING_TABLE} (code, expires_at) VALUES ($1, $2)`,
      [code, expiresAt],
    );
    return true;
  } catch (err) {
    console.warn('[post-agent] insertPairingCode failed:', err);
    return false;
  }
}

export async function getPairingCode(
  pool: Pool,
  code: string,
): Promise<PairingRow | null> {
  if (!(await ensurePostAgentTables(pool))) return null;
  try {
    const { rows } = await pool.query(
      `SELECT code, created_at, expires_at, bearer_token, paired_user_id, paired_at
       FROM ${PAIRING_TABLE} WHERE code = $1`,
      [code],
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      code: r.code,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      bearerToken: r.bearer_token,
      pairedUserId: r.paired_user_id,
      pairedAt: r.paired_at,
    };
  } catch (err) {
    console.warn('[post-agent] getPairingCode failed:', err);
    return null;
  }
}

export async function markPairingPaired(
  pool: Pool,
  code: string,
  bearerToken: string,
  userId: string,
): Promise<boolean> {
  if (!(await ensurePostAgentTables(pool))) return false;
  try {
    const { rowCount } = await pool.query(
      `UPDATE ${PAIRING_TABLE}
       SET bearer_token = $2, paired_user_id = $3, paired_at = NOW()
       WHERE code = $1 AND bearer_token IS NULL AND expires_at > NOW()`,
      [code, bearerToken, userId],
    );
    return (rowCount ?? 0) > 0;
  } catch (err) {
    console.warn('[post-agent] markPairingPaired failed:', err);
    return false;
  }
}

export async function deletePairingCode(pool: Pool, code: string): Promise<void> {
  if (!(await ensurePostAgentTables(pool))) return;
  try {
    await pool.query(`DELETE FROM ${PAIRING_TABLE} WHERE code = $1`, [code]);
  } catch (err) {
    console.warn('[post-agent] deletePairingCode failed:', err);
  }
}

export async function prunePairingCodes(pool: Pool): Promise<void> {
  if (!(await ensurePostAgentTables(pool))) return;
  try {
    await pool.query(`DELETE FROM ${PAIRING_TABLE} WHERE expires_at < NOW()`);
  } catch (err) {
    console.warn('[post-agent] prunePairingCodes failed:', err);
  }
}

// ---- Usage tracking ----

export interface UsageInsert {
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export async function insertUsage(pool: Pool, rec: UsageInsert): Promise<void> {
  if (!(await ensurePostAgentTables(pool))) return;
  try {
    await pool.query(
      `INSERT INTO ${USAGE_TABLE} (user_id, model, input_tokens, output_tokens)
       VALUES ($1, $2, $3, $4)`,
      [rec.userId, rec.model, rec.inputTokens, rec.outputTokens],
    );
  } catch (err) {
    console.warn('[post-agent] insertUsage failed:', err);
  }
}

export interface UsageSummary {
  monthInputTokens: number;
  monthOutputTokens: number;
  monthCallCount: number;
  lastCallAt: Date | null;
}

export async function summarizeUsageForUser(
  pool: Pool,
  userId: string,
): Promise<UsageSummary> {
  const fallback: UsageSummary = {
    monthInputTokens: 0,
    monthOutputTokens: 0,
    monthCallCount: 0,
    lastCallAt: null,
  };
  if (!(await ensurePostAgentTables(pool))) return fallback;
  try {
    const { rows } = await pool.query(
      `SELECT
         COALESCE(SUM(input_tokens), 0)::BIGINT AS in_tokens,
         COALESCE(SUM(output_tokens), 0)::BIGINT AS out_tokens,
         COUNT(*)::BIGINT AS call_count,
         MAX(at) AS last_call_at
       FROM ${USAGE_TABLE}
       WHERE user_id = $1 AND at >= date_trunc('month', NOW())`,
      [userId],
    );
    const r = rows[0];
    return {
      monthInputTokens: Number(r.in_tokens),
      monthOutputTokens: Number(r.out_tokens),
      monthCallCount: Number(r.call_count),
      lastCallAt: r.last_call_at,
    };
  } catch (err) {
    console.warn('[post-agent] summarizeUsageForUser failed:', err);
    return fallback;
  }
}

// ---- Device list / revoke ----

export interface DeviceRow {
  token: string;
  userId: string;
  label: string | null;
  createdAt: Date;
  lastSeen: Date;
  revokedAt: Date | null;
}

export async function registerDevice(
  pool: Pool,
  token: string,
  userId: string,
  label: string | null,
): Promise<void> {
  if (!(await ensurePostAgentTables(pool))) return;
  try {
    await pool.query(
      `INSERT INTO ${DEVICE_TABLE} (token, user_id, label) VALUES ($1, $2, $3)
       ON CONFLICT (token) DO NOTHING`,
      [token, userId, label],
    );
  } catch (err) {
    console.warn('[post-agent] registerDevice failed:', err);
  }
}

export async function touchDeviceLastSeen(pool: Pool, token: string): Promise<void> {
  if (!(await ensurePostAgentTables(pool))) return;
  try {
    await pool.query(
      `UPDATE ${DEVICE_TABLE} SET last_seen = NOW() WHERE token = $1`,
      [token],
    );
  } catch {
    // touch is best-effort
  }
}

export async function listDevicesForUser(
  pool: Pool,
  userId: string,
): Promise<DeviceRow[]> {
  if (!(await ensurePostAgentTables(pool))) return [];
  try {
    const { rows } = await pool.query(
      `SELECT token, user_id, label, created_at, last_seen, revoked_at
       FROM ${DEVICE_TABLE}
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return rows.map((r) => ({
      token: r.token,
      userId: r.user_id,
      label: r.label,
      createdAt: r.created_at,
      lastSeen: r.last_seen,
      revokedAt: r.revoked_at,
    }));
  } catch (err) {
    console.warn('[post-agent] listDevicesForUser failed:', err);
    return [];
  }
}

export async function revokeDevice(
  pool: Pool,
  token: string,
  userId: string,
): Promise<boolean> {
  if (!(await ensurePostAgentTables(pool))) return false;
  try {
    const { rowCount } = await pool.query(
      `UPDATE ${DEVICE_TABLE}
       SET revoked_at = NOW()
       WHERE token = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [token, userId],
    );
    return (rowCount ?? 0) > 0;
  } catch (err) {
    console.warn('[post-agent] revokeDevice failed:', err);
    return false;
  }
}

export async function isDeviceRevoked(pool: Pool, token: string): Promise<boolean> {
  if (!(await ensurePostAgentTables(pool))) return false;
  try {
    const { rows } = await pool.query(
      `SELECT revoked_at FROM ${DEVICE_TABLE} WHERE token = $1 LIMIT 1`,
      [token],
    );
    if (rows.length === 0) return false;
    return rows[0].revoked_at !== null;
  } catch {
    return false;
  }
}

// ---- Team-seat management ----

export interface TeamSubscriptionRow {
  projectId: string;
  ownerUserId: string;
  stripeSubscriptionId: string;
  stripeSubscriptionItemId: string;
  seatCount: number;
  status: string;
}

export interface TeamSeatRow {
  id: number;
  projectId: string;
  userId: string;
  grantedBy: string;
  grantedAt: Date;
  revokedAt: Date | null;
}

export async function getTeamSubscription(pool: Pool, projectId: string): Promise<TeamSubscriptionRow | null> {
  if (!(await ensurePostAgentTables(pool))) return null;
  try {
    const { rows } = await pool.query(
      `SELECT project_id, owner_user_id, stripe_subscription_id, stripe_subscription_item_id, seat_count, status
       FROM ${TEAM_SUBSCRIPTIONS_TABLE} WHERE project_id = $1`,
      [projectId],
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      projectId: r.project_id,
      ownerUserId: r.owner_user_id,
      stripeSubscriptionId: r.stripe_subscription_id,
      stripeSubscriptionItemId: r.stripe_subscription_item_id,
      seatCount: r.seat_count,
      status: r.status,
    };
  } catch (err) {
    console.warn('[post-agent] getTeamSubscription failed:', err);
    return null;
  }
}

export async function upsertTeamSubscription(
  pool: Pool,
  row: TeamSubscriptionRow,
): Promise<boolean> {
  if (!(await ensurePostAgentTables(pool))) return false;
  try {
    await pool.query(
      `INSERT INTO ${TEAM_SUBSCRIPTIONS_TABLE}
         (project_id, owner_user_id, stripe_subscription_id, stripe_subscription_item_id, seat_count, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (project_id) DO UPDATE SET
         stripe_subscription_item_id = EXCLUDED.stripe_subscription_item_id,
         seat_count = EXCLUDED.seat_count,
         status = EXCLUDED.status,
         updated_at = NOW()`,
      [row.projectId, row.ownerUserId, row.stripeSubscriptionId, row.stripeSubscriptionItemId, row.seatCount, row.status],
    );
    return true;
  } catch (err) {
    console.warn('[post-agent] upsertTeamSubscription failed:', err);
    return false;
  }
}

export async function listProjectSeats(pool: Pool, projectId: string): Promise<TeamSeatRow[]> {
  if (!(await ensurePostAgentTables(pool))) return [];
  try {
    const { rows } = await pool.query(
      `SELECT id, project_id, user_id, granted_by, granted_at, revoked_at
       FROM ${TEAM_SEATS_TABLE}
       WHERE project_id = $1
       ORDER BY granted_at DESC`,
      [projectId],
    );
    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      userId: r.user_id,
      grantedBy: r.granted_by,
      grantedAt: r.granted_at,
      revokedAt: r.revoked_at,
    }));
  } catch (err) {
    console.warn('[post-agent] listProjectSeats failed:', err);
    return [];
  }
}

/** Grant a seat. Returns true if a new active seat was created (or revoked
 * seat reactivated), false if user already had an active seat. */
export async function grantTeamSeat(
  pool: Pool,
  projectId: string,
  userId: string,
  grantedBy: string,
): Promise<boolean> {
  if (!(await ensurePostAgentTables(pool))) return false;
  try {
    const { rowCount } = await pool.query(
      `INSERT INTO ${TEAM_SEATS_TABLE} (project_id, user_id, granted_by, granted_at, revoked_at)
       VALUES ($1, $2, $3, NOW(), NULL)
       ON CONFLICT (project_id, user_id) DO UPDATE SET
         revoked_at = NULL,
         granted_at = NOW(),
         granted_by = EXCLUDED.granted_by
       WHERE ${TEAM_SEATS_TABLE}.revoked_at IS NOT NULL`,
      [projectId, userId, grantedBy],
    );
    return (rowCount ?? 0) > 0;
  } catch (err) {
    console.warn('[post-agent] grantTeamSeat failed:', err);
    return false;
  }
}

/** Revoke a seat. Returns true if an active seat was revoked. */
export async function revokeTeamSeat(
  pool: Pool,
  projectId: string,
  userId: string,
): Promise<boolean> {
  if (!(await ensurePostAgentTables(pool))) return false;
  try {
    const { rowCount } = await pool.query(
      `UPDATE ${TEAM_SEATS_TABLE}
       SET revoked_at = NOW()
       WHERE project_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [projectId, userId],
    );
    return (rowCount ?? 0) > 0;
  } catch (err) {
    console.warn('[post-agent] revokeTeamSeat failed:', err);
    return false;
  }
}

export async function countActiveSeats(pool: Pool, projectId: string): Promise<number> {
  if (!(await ensurePostAgentTables(pool))) return 0;
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::INT AS n FROM ${TEAM_SEATS_TABLE}
       WHERE project_id = $1 AND revoked_at IS NULL`,
      [projectId],
    );
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

/** Check if a user has at least one active seat across any production. */
export async function userHasActiveTeamSeat(pool: Pool, userId: string): Promise<boolean> {
  if (!(await ensurePostAgentTables(pool))) return false;
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM ${TEAM_SEATS_TABLE}
       WHERE user_id = $1 AND revoked_at IS NULL LIMIT 1`,
      [userId],
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

/** Productions where this user is currently seated. Used in user-profile dropdown. */
export async function listUserActiveSeats(pool: Pool, userId: string): Promise<Array<{ projectId: string; grantedAt: Date }>> {
  if (!(await ensurePostAgentTables(pool))) return [];
  try {
    const { rows } = await pool.query(
      `SELECT project_id, granted_at FROM ${TEAM_SEATS_TABLE}
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY granted_at DESC`,
      [userId],
    );
    return rows.map((r) => ({ projectId: r.project_id, grantedAt: r.granted_at }));
  } catch {
    return [];
  }
}
