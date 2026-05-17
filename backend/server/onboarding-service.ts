/**
 * Onboarding-progresjon per markedsfører.
 *
 * Lett-vekts tracker for hvilke steg i velkomst-wizarden bruker har
 * fullført. Brukes for å skjule wizarden etter første gangs bruk og
 * for at progresjons-baren i header skal vise riktig prosent.
 *
 * Tabell opprettes lazy ved første kall.
 */

import type { Pool } from "pg";

let schemaReady = false;

async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_onboarding_progress (
      user_id TEXT PRIMARY KEY,
      completed_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
      dismissed_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  schemaReady = true;
}

export type OnboardingStepId =
  | "welcome"
  | "enable_2fa"
  | "create_project"
  | "run_research"
  | "generate_marketing_plan"
  | "connect_data_sources"
  | "invite_client";

export const ALL_STEPS: OnboardingStepId[] = [
  "welcome",
  "enable_2fa",
  "create_project",
  "run_research",
  "generate_marketing_plan",
  "connect_data_sources",
  "invite_client",
];

export interface OnboardingStatus {
  completedSteps: OnboardingStepId[];
  dismissedAt: string | null;
  completedAt: string | null;
  totalSteps: number;
  /** Hvis true, skal wizarden ikke vises (enten alt fullført eller dismissed). */
  hidden: boolean;
}

export async function getOnboardingStatus(
  pool: Pool,
  userId: string,
): Promise<OnboardingStatus> {
  await ensureSchema(pool);
  const r = await pool.query(
    `SELECT completed_steps, dismissed_at, completed_at
       FROM user_onboarding_progress WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  if (r.rows.length === 0) {
    return {
      completedSteps: [],
      dismissedAt: null,
      completedAt: null,
      totalSteps: ALL_STEPS.length,
      hidden: false,
    };
  }
  const row = r.rows[0];
  const completedSteps = (row.completed_steps ?? []) as OnboardingStepId[];
  return {
    completedSteps,
    dismissedAt: row.dismissed_at ? new Date(row.dismissed_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    totalSteps: ALL_STEPS.length,
    hidden: Boolean(row.dismissed_at || row.completed_at),
  };
}

export async function markStepCompleted(
  pool: Pool,
  userId: string,
  stepId: OnboardingStepId,
): Promise<OnboardingStatus> {
  await ensureSchema(pool);
  if (!ALL_STEPS.includes(stepId)) {
    return getOnboardingStatus(pool, userId);
  }

  // Upsert + idempotent merge av completed_steps
  await pool.query(
    `INSERT INTO user_onboarding_progress (user_id, completed_steps)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (user_id) DO UPDATE
       SET completed_steps = (
         SELECT jsonb_agg(DISTINCT step)
           FROM jsonb_array_elements_text(
             user_onboarding_progress.completed_steps || EXCLUDED.completed_steps
           ) AS step
       ),
       updated_at = NOW()`,
    [userId, JSON.stringify([stepId])],
  );

  // Sjekk om alle steg er fullført — sett completed_at i så fall
  const status = await getOnboardingStatus(pool, userId);
  if (status.completedSteps.length >= ALL_STEPS.length && !status.completedAt) {
    await pool.query(
      `UPDATE user_onboarding_progress SET completed_at = NOW() WHERE user_id = $1`,
      [userId],
    );
    return { ...status, completedAt: new Date().toISOString(), hidden: true };
  }
  return status;
}

export async function dismissOnboarding(
  pool: Pool,
  userId: string,
): Promise<OnboardingStatus> {
  await ensureSchema(pool);
  await pool.query(
    `INSERT INTO user_onboarding_progress (user_id, dismissed_at)
     VALUES ($1, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET dismissed_at = NOW(), updated_at = NOW()`,
    [userId],
  );
  return getOnboardingStatus(pool, userId);
}

export async function resetOnboarding(
  pool: Pool,
  userId: string,
): Promise<void> {
  await ensureSchema(pool);
  await pool.query(`DELETE FROM user_onboarding_progress WHERE user_id = $1`, [userId]);
}
