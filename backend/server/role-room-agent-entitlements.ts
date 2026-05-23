/**
 * Entitlement layer for The Role Room Agent.
 *
 * The decision tree (first match wins):
 *   1. Admin / owner / super_admin role  → allowed (source: 'admin')
 *   2. Active row in role_room_agent_entitlements with status in
 *      (trial, active) and trial not expired
 *   3. Active pro / enterprise subscription in `subscriptions` table
 *      → auto-provision an 'active' entitlement (source: 'plan_*') if
 *        missing, so downstream audit has a consistent row
 *   4. Otherwise → not allowed; caller returns 402 with upsell paths
 */

import type { Pool } from 'pg';

export type EntitlementSource =
  | 'admin'
  | 'plan_pro'
  | 'plan_enterprise'
  | 'addon_monthly'
  | 'trial';

export interface EntitlementResult {
  allowed: boolean;
  source: EntitlementSource | 'none';
  status: 'trial' | 'active' | 'expired' | 'revoked' | 'none';
  trialEndsAt?: string | null;
  daysRemaining?: number | null;
  /** UI routing hints. Populated on `allowed=false` so frontend can show
   *  a paywall with the right CTAs for the user's current subscription. */
  upsell?: {
    canStartTrial: boolean;
    canBuyAddOn: boolean;
    canUpgradeToPro: boolean;
    currentPlanType: string | null;
  };
  /** Human-readable explanation for audit/logging. */
  reason: string;
}

export interface EntitlementConfig {
  trialDays: number;
  trialCallsPerDay: number;
  trialCallsTotal: number;
  trialsEnabled: boolean;
  basicTierIncluded: boolean;
  addonMonthlyPriceNok: number;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getEntitlementConfig(): EntitlementConfig {
  return {
    trialDays: envInt('ROLE_ROOM_AGENT_TRIAL_DAYS', 14),
    trialCallsPerDay: envInt('ROLE_ROOM_AGENT_TRIAL_CALLS_PER_DAY', 20),
    trialCallsTotal: envInt('ROLE_ROOM_AGENT_TRIAL_CALLS_TOTAL', 150),
    // Off-switch — when unset or 'true' trials can be started; 'false'
    // blocks new trials even though existing ones keep running.
    trialsEnabled: process.env.ROLE_ROOM_AGENT_TRIALS_ENABLED !== 'false',
    basicTierIncluded: process.env.ROLE_ROOM_AGENT_BASIC_INCLUDED === 'true',
    addonMonthlyPriceNok: envInt('ROLE_ROOM_AGENT_ADDON_PRICE_NOK', 99),
  };
}

async function countTrialCalls(
  pool: Pool,
  userId: string,
  sinceHours: number,
): Promise<number> {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS n
         FROM role_room_ai_audit_log
        WHERE user_id = $1
          AND status = 'ok'
          AND action != 'daily_scan'
          AND NOT (field_categories ? 'cache_hit')
          AND created_at > now() - make_interval(hours => $2)`,
      [userId, sinceHours],
    );
    return Number(result.rows[0]?.n ?? 0);
  } catch {
    // If the audit query fails we fall open — rate limits elsewhere will
    // still cap abuse, and failing closed here would lock out users on
    // transient DB hiccups.
    return 0;
  }
}

export function isPrivilegedRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return r === 'admin' || r === 'owner' || r === 'super_admin' || r === 'superadmin';
}

async function readSubscriptionPlanType(pool: Pool, userId: string): Promise<string | null> {
  try {
    const result = await pool.query(
      `SELECT plan_type
         FROM subscriptions
        WHERE user_id = $1
          AND (status = 'active' OR status = 'trialing')
        ORDER BY created_at DESC
        LIMIT 1`,
      [userId],
    );
    return (result.rows[0]?.plan_type as string) ?? null;
  } catch {
    return null;
  }
}

async function readActiveEntitlement(pool: Pool, userId: string): Promise<any | null> {
  try {
    const result = await pool.query(
      `SELECT *
         FROM role_room_agent_entitlements
        WHERE user_id = $1
          AND revoked_at IS NULL
        ORDER BY granted_at DESC
        LIMIT 1`,
      [userId],
    );
    return result.rows[0] ?? null;
  } catch {
    return null;
  }
}

async function upsertPlanEntitlement(
  pool: Pool,
  userId: string,
  source: 'plan_pro' | 'plan_enterprise',
): Promise<void> {
  try {
    // Revoke any stale trial row so the "one active per user" invariant holds.
    await pool.query(
      `UPDATE role_room_agent_entitlements
          SET revoked_at = now(),
              updated_at = now(),
              notes = COALESCE(notes, '') || E'\nSuperseded by ' || $2 || ' plan'
        WHERE user_id = $1
          AND revoked_at IS NULL
          AND source != $2`,
      [userId, source],
    );
    await pool.query(
      `INSERT INTO role_room_agent_entitlements (user_id, status, source)
       VALUES ($1, 'active', $2)
       ON CONFLICT DO NOTHING`,
      [userId, source],
    );
  } catch {
    /* best-effort; re-checked on next call */
  }
}

export async function checkAgentEntitlement(
  pool: Pool,
  userId: string,
  roleHint?: string | null,
): Promise<EntitlementResult> {
  if (isPrivilegedRole(roleHint)) {
    return {
      allowed: true,
      source: 'admin',
      status: 'active',
      reason: 'admin bypass',
    };
  }

  const planType = await readSubscriptionPlanType(pool, userId);
  const existing = await readActiveEntitlement(pool, userId);
  const cfg = getEntitlementConfig();

  // Active paid entitlement (addon_monthly / plan_pro / plan_enterprise / admin_grant)
  if (existing && existing.status === 'active') {
    return {
      allowed: true,
      source: existing.source as EntitlementSource,
      status: 'active',
      reason: `active via ${existing.source}`,
    };
  }

  // Trial — check expiry AND usage caps. Trials aren't unlimited — they
  // exist for evaluation, not bulk production. We cap calls/day and
  // total calls per trial to bound exposure.
  if (existing && existing.status === 'trial') {
    const trialEndsAt: Date | null = existing.trial_ends_at ?? null;
    if (trialEndsAt && trialEndsAt.getTime() > Date.now()) {
      const daysRemaining = Math.ceil(
        (trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      );
      // Daily cap (rolling 24h).
      const [callsLast24h, callsTotal] = await Promise.all([
        countTrialCalls(pool, userId, 24),
        countTrialCalls(pool, userId, cfg.trialDays * 24),
      ]);
      if (callsLast24h >= cfg.trialCallsPerDay) {
        return {
          allowed: false,
          source: 'trial',
          status: 'trial',
          trialEndsAt: trialEndsAt.toISOString(),
          daysRemaining,
          upsell: {
            canStartTrial: false,
            canBuyAddOn: true,
            canUpgradeToPro: planType !== 'pro' && planType !== 'enterprise',
            currentPlanType: planType,
          },
          reason: `trial_daily_cap_reached (${callsLast24h}/${cfg.trialCallsPerDay})`,
        };
      }
      if (callsTotal >= cfg.trialCallsTotal) {
        return {
          allowed: false,
          source: 'trial',
          status: 'trial',
          trialEndsAt: trialEndsAt.toISOString(),
          daysRemaining,
          upsell: {
            canStartTrial: false,
            canBuyAddOn: true,
            canUpgradeToPro: planType !== 'pro' && planType !== 'enterprise',
            currentPlanType: planType,
          },
          reason: `trial_total_cap_reached (${callsTotal}/${cfg.trialCallsTotal})`,
        };
      }
      return {
        allowed: true,
        source: 'trial',
        status: 'trial',
        trialEndsAt: trialEndsAt.toISOString(),
        daysRemaining,
        reason: 'trial active',
      };
    }
    // Expired by time: mark and fall through to upsell.
    await pool
      .query(
        `UPDATE role_room_agent_entitlements
            SET status = 'expired', updated_at = now()
          WHERE id = $1 AND status = 'trial'`,
        [existing.id],
      )
      .catch(() => {});
  }

  // Auto-grant based on subscription plan.
  // 'post_agent' is the standalone Post Agent subscription — sold separately
  // from Role Room pro/enterprise, but unlocks the same Claude proxy.
  if (planType === 'pro' || planType === 'enterprise' || planType === 'post_agent') {
    const source =
      planType === 'pro'
        ? 'plan_pro'
        : planType === 'enterprise'
        ? 'plan_enterprise'
        : 'plan_pro'; // post_agent maps to plan_pro semantically for AI quota
    await upsertPlanEntitlement(pool, userId, source);
    return {
      allowed: true,
      source,
      status: 'active',
      reason: `auto-granted via active ${planType} subscription`,
    };
  }

  if (cfg.basicTierIncluded && planType === 'basic') {
    await upsertPlanEntitlement(pool, userId, 'plan_pro');
    return {
      allowed: true,
      source: 'plan_pro',
      status: 'active',
      reason: 'basic tier included (feature flag)',
    };
  }

  // No entitlement — return upsell paths.
  return {
    allowed: false,
    source: 'none',
    status: existing?.status ?? 'none',
    trialEndsAt: existing?.trial_ends_at?.toISOString() ?? null,
    upsell: {
      canStartTrial: !existing || existing.status === 'revoked',
      canBuyAddOn: true,
      canUpgradeToPro: planType !== 'pro' && planType !== 'enterprise',
      currentPlanType: planType,
    },
    reason:
      existing?.status === 'expired'
        ? 'trial expired'
        : existing?.status === 'revoked'
          ? 'revoked by admin'
          : 'no active entitlement',
  };
}

/** Start a time-limited trial for a user. Refuses if the user already
 *  has an active entitlement OR a previous trial (we don't allow repeats). */
export async function startAgentTrial(
  pool: Pool,
  userId: string,
): Promise<{ ok: true; trialEndsAt: string } | { ok: false; error: string }> {
  const cfg = getEntitlementConfig();
  if (!cfg.trialsEnabled) {
    return { ok: false, error: 'trials_disabled' };
  }
  const existing = await readActiveEntitlement(pool, userId);
  if (existing) {
    return { ok: false, error: 'already_has_entitlement' };
  }
  const anyPrevTrial = await pool
    .query(
      `SELECT id FROM role_room_agent_entitlements
        WHERE user_id = $1 AND source = 'trial'
        LIMIT 1`,
      [userId],
    )
    .catch(() => ({ rows: [] as any[] }));
  if (anyPrevTrial.rows.length > 0) {
    return { ok: false, error: 'trial_already_used' };
  }
  const trialEndsAt = new Date(Date.now() + cfg.trialDays * 24 * 60 * 60 * 1000);
  try {
    await pool.query(
      `INSERT INTO role_room_agent_entitlements (user_id, status, source, trial_ends_at)
       VALUES ($1, 'trial', 'trial', $2)`,
      [userId, trialEndsAt],
    );
    return { ok: true, trialEndsAt: trialEndsAt.toISOString() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'insert_failed' };
  }
}

/** Mark an add-on-subscription entitlement active. Called from Stripe
 *  webhook handler after checkout.session.completed. */
export async function grantAddonEntitlement(
  pool: Pool,
  userId: string,
  stripeSubscriptionId: string,
  stripeProductId: string,
): Promise<void> {
  await pool.query(
    `UPDATE role_room_agent_entitlements
        SET revoked_at = now(), updated_at = now()
      WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
  await pool.query(
    `INSERT INTO role_room_agent_entitlements (
       user_id, status, source, stripe_subscription_id, stripe_product_id
     )
     VALUES ($1, 'active', 'addon_monthly', $2, $3)`,
    [userId, stripeSubscriptionId, stripeProductId],
  );
}

/** Admin-grant (support tool). Writes an entitlement with source='admin_grant'.
 *  Accepts optional trial_ends_at so support can grant time-boxed access. */
export async function adminGrantEntitlement(
  pool: Pool,
  userId: string,
  input: { notes?: string; trialEndsAt?: Date },
): Promise<void> {
  await pool.query(
    `UPDATE role_room_agent_entitlements
        SET revoked_at = now(), updated_at = now()
      WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
  const status = input.trialEndsAt ? 'trial' : 'active';
  await pool.query(
    `INSERT INTO role_room_agent_entitlements (
       user_id, status, source, trial_ends_at, notes
     )
     VALUES ($1, $2, 'admin_grant', $3, $4)`,
    [userId, status, input.trialEndsAt ?? null, input.notes ?? null],
  );
}

export async function revokeEntitlement(
  pool: Pool,
  userId: string,
  reason: string,
): Promise<void> {
  await pool.query(
    `UPDATE role_room_agent_entitlements
        SET revoked_at = now(),
            status = 'revoked',
            notes = COALESCE(notes, '') || E'\nRevoked: ' || $2,
            updated_at = now()
      WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId, reason],
  );
}

export async function listEntitlements(
  pool: Pool,
  options?: { limit?: number },
): Promise<Array<Record<string, unknown>>> {
  const limit = Math.min(options?.limit ?? 200, 1000);
  const result = await pool.query(
    `SELECT id, user_id, status, source, trial_ends_at,
            stripe_subscription_id, granted_at, revoked_at, notes
       FROM role_room_agent_entitlements
      ORDER BY granted_at DESC
      LIMIT $1`,
    [limit],
  );
  return result.rows;
}
