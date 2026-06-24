/**
 * nextrole-drip.ts
 *
 * Cron-trigget drip-pipeline for NextRole-trial-brukere.
 *
 * Sekvens (basert på trial_started_at og trial_ends_at):
 *
 *   Dag 0  — sendNextRoleWelcomeEmail + sendNextRoleTrialStartedEmail
 *           (sendes synkront fra start-trial-endepunktet, ikke fra
 *           denne cron-en).
 *   Dag 3  — drip_day3_tips (produkt-tips)
 *   Dag 7  — drip_day7_social (sosialt bevis)
 *   Dag 11 — trial_expiring_3d (eksisterende, ligger i nextrole-routes)
 *   Dag 13 — drip_day13_lastcall (siste sjanse)
 *   Dag 21 — post_trial_winback (7 dager etter utløp, hvis ikke konvertert)
 *
 * Idempotens: hver bruker+email_kind kan bare sendes én gang
 * (nextrole_email_drip_log UNIQUE-constraint).
 *
 * Auth: x-cron-secret-header må matche NEXTROLE_CRON_SECRET.
 *
 * Endpoint: POST /api/internal/next-role/drip-tick
 *
 * Cron-frekvens: kjør én gang per dag.
 */

import type express from "express";
import type { Pool } from "pg";
import {
  sendNextRoleDripDay3TipsEmail,
  sendNextRoleDripDay7SocialProofEmail,
  sendNextRoleDripDay13LastCallEmail,
  sendNextRolePostTrialWinbackEmail,
} from "./nextrole-email-service";

export interface NextRoleDripDeps {
  app: express.Application;
  pool: Pool;
}

interface TrialRow {
  user_id: string;
  email: string | null;
  first_name: string | null;
  name: string | null;
  trial_started_at: Date | null;
  trial_ends_at: Date;
  tier: string;
  resumes_built: number;
  has_used_ai_analysis: boolean;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function dayWindow(
  daysFromNow: number,
  windowHours = 24,
): { start: Date; end: Date } {
  const start = new Date(Date.now() + daysFromNow * ONE_DAY_MS);
  const end = new Date(start.getTime() + windowHours * 60 * 60 * 1000);
  return { start, end };
}

async function alreadySent(
  pool: Pool,
  userId: string,
  kind: string,
): Promise<boolean> {
  const r = await pool.query<{ id: string }>(
    `SELECT id FROM nextrole_email_drip_log
      WHERE user_id = $1 AND email_kind = $2
      LIMIT 1`,
    [userId, kind],
  );
  return (r.rowCount ?? 0) > 0;
}

async function logSent(
  pool: Pool,
  userId: string,
  kind: string,
  messageId?: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO nextrole_email_drip_log (user_id, email_kind, message_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, email_kind) DO NOTHING`,
    [userId, kind, messageId ?? null],
  );
}

/**
 * Henter trial-brukere hvor trial_started_at er rundt N dager siden.
 * Brukes for drip dag 3 og 7 (under aktiv trial).
 */
async function fetchUsersAtDripStage(
  pool: Pool,
  daysSinceStart: number,
  emailKind: string,
): Promise<TrialRow[]> {
  // Vi vil ha brukere hvor trial_started_at er mellom
  // (now - daysSinceStart - 1 dager) og (now - daysSinceStart dager).
  // Det gir et 24-timers-vindu — som matcher cron-en som kjører daglig.
  const r = await pool.query<TrialRow>(
    `SELECT
        mi.user_id,
        u.email,
        u.first_name,
        NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
        (mi.settings ->> 'trialStartedAt')::timestamptz AS trial_started_at,
        mi.trial_ends_at,
        mi.tier,
        COALESCE((SELECT COUNT(*) FROM resumes r WHERE r.user_id = mi.user_id)::int, 0)
          AS resumes_built,
        EXISTS (
          SELECT 1 FROM ai_usage_log a
          WHERE a.user_id = mi.user_id
            AND a.feature LIKE 'resume_%'
        ) AS has_used_ai_analysis
      FROM marketplace_installations mi
      LEFT JOIN users u ON u.id = mi.user_id
      WHERE mi.app_id = 'next-role'
        AND mi.tier = 'trial'
        AND mi.is_active = TRUE
        AND mi.trial_ends_at > NOW()
        AND (mi.settings ->> 'trialStartedAt') IS NOT NULL
        AND (mi.settings ->> 'trialStartedAt')::timestamptz
            BETWEEN NOW() - INTERVAL '${daysSinceStart + 1} days'
                AND NOW() - INTERVAL '${daysSinceStart} days'
        AND NOT EXISTS (
          SELECT 1 FROM nextrole_email_drip_log d
          WHERE d.user_id = mi.user_id AND d.email_kind = $1
        )`,
    [emailKind],
  );
  return r.rows;
}

/**
 * Henter trial-brukere hvor trial_ends_at er N dager fram i tid.
 * Brukes for drip dag 13 (1 dag før utløp).
 */
async function fetchUsersByTrialEndsAt(
  pool: Pool,
  daysUntilEnd: number,
  emailKind: string,
): Promise<TrialRow[]> {
  const r = await pool.query<TrialRow>(
    `SELECT
        mi.user_id,
        u.email,
        u.first_name,
        NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
        (mi.settings ->> 'trialStartedAt')::timestamptz AS trial_started_at,
        mi.trial_ends_at,
        mi.tier,
        COALESCE((SELECT COUNT(*) FROM resumes r WHERE r.user_id = mi.user_id)::int, 0)
          AS resumes_built,
        EXISTS (
          SELECT 1 FROM ai_usage_log a
          WHERE a.user_id = mi.user_id
            AND a.feature LIKE 'resume_%'
        ) AS has_used_ai_analysis
      FROM marketplace_installations mi
      LEFT JOIN users u ON u.id = mi.user_id
      WHERE mi.app_id = 'next-role'
        AND mi.tier = 'trial'
        AND mi.is_active = TRUE
        AND mi.trial_ends_at
            BETWEEN NOW() + INTERVAL '${daysUntilEnd} days'
                AND NOW() + INTERVAL '${daysUntilEnd + 1} days'
        AND NOT EXISTS (
          SELECT 1 FROM nextrole_email_drip_log d
          WHERE d.user_id = mi.user_id AND d.email_kind = $1
        )`,
    [emailKind],
  );
  return r.rows;
}

/**
 * Henter brukere hvor trial utløp for ~7 dager siden og som IKKE
 * konverterte til betalende (tier = 'cancelled' eller settings sier
 * 'expired'). Brukes for post_trial_winback.
 */
async function fetchPostTrialWinbackCandidates(
  pool: Pool,
): Promise<TrialRow[]> {
  const r = await pool.query<TrialRow>(
    `SELECT
        mi.user_id,
        u.email,
        u.first_name,
        NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
        (mi.settings ->> 'trialStartedAt')::timestamptz AS trial_started_at,
        mi.trial_ends_at,
        mi.tier,
        0::int AS resumes_built,
        FALSE AS has_used_ai_analysis
      FROM marketplace_installations mi
      LEFT JOIN users u ON u.id = mi.user_id
      WHERE mi.app_id = 'next-role'
        AND mi.tier IN ('cancelled', 'guest', 'trial')
        AND mi.trial_ends_at
            BETWEEN NOW() - INTERVAL '8 days'
                AND NOW() - INTERVAL '7 days'
        AND mi.stripe_subscription_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM nextrole_email_drip_log d
          WHERE d.user_id = mi.user_id AND d.email_kind = 'post_trial_winback'
        )`,
  );
  return r.rows;
}

function firstNameFrom(row: TrialRow): string {
  return (
    (row.first_name ?? "").trim() ||
    ((row.name ?? "").split(" ")[0] ?? "").trim()
  );
}

interface StageResult {
  kind: string;
  candidates: number;
  sent: number;
  failed: number;
}

async function runDripStage(
  pool: Pool,
  kind: string,
  candidates: TrialRow[],
  send: (
    to: string,
    row: TrialRow,
  ) => Promise<{ sent: boolean; messageId?: string; error?: string }>,
): Promise<StageResult> {
  let sent = 0;
  let failed = 0;
  for (const row of candidates) {
    if (!row.email) {
      failed += 1;
      continue;
    }
    // Race-safe dobbeltsjekk for å unngå at to cron-kjøringer overlapper.
    if (await alreadySent(pool, row.user_id, kind)) continue;
    const result = await send(row.email, row);
    if (result.sent) {
      await logSent(pool, row.user_id, kind, result.messageId);
      sent += 1;
    } else {
      failed += 1;
      console.warn(`[nextrole-drip] ${kind} failed for ${row.user_id}:`, result.error);
    }
  }
  return { kind, candidates: candidates.length, sent, failed };
}

// ════════════════════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════════════════════

export function setupNextRoleDripRoutes(deps: NextRoleDripDeps): void {
  const { app, pool } = deps;

  app.post("/api/internal/next-role/drip-tick", async (req, res) => {
    const provided = req.headers["x-cron-secret"];
    if (provided !== process.env.NEXTROLE_CRON_SECRET) {
      res.status(401).json({ error: "invalid_cron_secret" });
      return;
    }

    const stages: StageResult[] = [];

    try {
      // Dag 3 — produkt-tips
      const day3 = await fetchUsersAtDripStage(pool, 3, "drip_day3_tips");
      stages.push(
        await runDripStage(pool, "drip_day3_tips", day3, async (to, row) => {
          return await sendNextRoleDripDay3TipsEmail(to, {
            firstName: firstNameFrom(row),
            trialEndsAt: row.trial_ends_at,
            daysActive: 3,
            resumesBuilt: row.resumes_built,
            hasUsedAiAnalysis: row.has_used_ai_analysis,
          });
        }),
      );

      // Dag 7 — sosialt bevis
      const day7 = await fetchUsersAtDripStage(pool, 7, "drip_day7_social");
      stages.push(
        await runDripStage(pool, "drip_day7_social", day7, async (to, row) => {
          return await sendNextRoleDripDay7SocialProofEmail(to, {
            firstName: firstNameFrom(row),
            trialEndsAt: row.trial_ends_at,
            daysActive: 7,
            resumesBuilt: row.resumes_built,
            hasUsedAiAnalysis: row.has_used_ai_analysis,
          });
        }),
      );

      // Dag 13 — siste sjanse (1 dag før trial utløper)
      const day13 = await fetchUsersByTrialEndsAt(pool, 1, "drip_day13_lastcall");
      stages.push(
        await runDripStage(pool, "drip_day13_lastcall", day13, async (to, row) => {
          return await sendNextRoleDripDay13LastCallEmail(to, {
            firstName: firstNameFrom(row),
            trialEndsAt: row.trial_ends_at,
            daysActive: 13,
            resumesBuilt: row.resumes_built,
            hasUsedAiAnalysis: row.has_used_ai_analysis,
          });
        }),
      );

      // Post-trial winback (7 dager etter utløp)
      const winback = await fetchPostTrialWinbackCandidates(pool);
      stages.push(
        await runDripStage(pool, "post_trial_winback", winback, async (to, row) => {
          return await sendNextRolePostTrialWinbackEmail(to, {
            firstName: firstNameFrom(row),
            trialEndsAt: row.trial_ends_at,
            daysActive: 21,
            resumesBuilt: row.resumes_built,
            hasUsedAiAnalysis: row.has_used_ai_analysis,
          });
        }),
      );

      console.info("[nextrole-drip] tick complete", { stages });
      res.json({ ok: true, stages });
    } catch (err) {
      console.error("[nextrole-drip] tick failed", err);
      res
        .status(500)
        .json({ error: "internal_error", message: String(err), stages });
    }
  });
}

// Helper export for ad-hoc kjøring fra andre cron-jobber om nødvendig.
export { dayWindow };
