/**
 * role-room-ads-budget.ts
 *
 * Per-project, per-period ads budget cap (MedInnova-avtalen §3 / §2.3):
 *   • The CLIENT sets a max ad spend for a period (§3.1, §3.2 — eks. påslag).
 *   • The agency may not exceed it without the client's written consent (§2.3) —
 *     captured as approved_overage_nok.
 *
 * Pure status math (computeBudgetStatus) is unit-tested; IO reuses the pool.
 * Spend is compared against actual spend_nok (not the påslag), per §3.2.
 */

import type { Pool } from "pg";

/** Warn the client once spend crosses this share of the cap. */
const NEAR_BUDGET_THRESHOLD = 0.9;

export interface AdsBudgetRow {
  projectId: string;
  period: string; // YYYY-MM
  maxSpendNok: number;
  approvedOverageNok: number;
  overageRequestedNok: number | null;
  overageNote: string | null;
  setBy: string | null;
  updatedBy: string | null;
}

export interface BudgetStatus {
  hasBudget: boolean;
  maxSpendNok: number;
  approvedOverageNok: number;
  /** max + godkjent overskridelse — det faktiske taket. */
  effectiveCapNok: number;
  actualSpendNok: number;
  remainingNok: number;
  utilizationPct: number; // 0–100+ relative to effective cap
  isOverBudget: boolean;
  isNearBudget: boolean;
  overageRequestedNok: number | null;
}

export function computeBudgetStatus(input: {
  hasBudget: boolean;
  maxSpendNok: number;
  approvedOverageNok: number;
  actualSpendNok: number;
  overageRequestedNok?: number | null;
}): BudgetStatus {
  const maxSpendNok = Math.max(0, input.maxSpendNok || 0);
  const approvedOverageNok = Math.max(0, input.approvedOverageNok || 0);
  const effectiveCapNok = maxSpendNok + approvedOverageNok;
  const actualSpendNok = Math.max(0, input.actualSpendNok || 0);
  const remainingNok = effectiveCapNok - actualSpendNok;
  const utilizationPct = effectiveCapNok > 0 ? (actualSpendNok / effectiveCapNok) * 100 : 0;
  return {
    hasBudget: input.hasBudget,
    maxSpendNok,
    approvedOverageNok,
    effectiveCapNok,
    actualSpendNok,
    remainingNok,
    utilizationPct: Math.round(utilizationPct * 10) / 10,
    // Only meaningful when a budget is actually set.
    isOverBudget: input.hasBudget && effectiveCapNok > 0 && actualSpendNok >= effectiveCapNok,
    isNearBudget:
      input.hasBudget && effectiveCapNok > 0 && actualSpendNok >= effectiveCapNok * NEAR_BUDGET_THRESHOLD,
    overageRequestedNok: input.overageRequestedNok ?? null,
  };
}

export class BudgetExceededError extends Error {
  readonly status: BudgetStatus;
  constructor(status: BudgetStatus) {
    super(
      `Periodebudsjettet er nådd (${status.actualSpendNok} / ${status.effectiveCapNok} NOK). ` +
        `Kan ikke kjøre flere annonser denne perioden uten kundens skriftlige godkjenning av en høyere ramme (MedInnova-avtalen §2.3).`,
    );
    this.name = "BudgetExceededError";
    this.status = status;
  }
}

function mapRow(row: Record<string, unknown>): AdsBudgetRow {
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    projectId: row.project_id as string,
    period: row.period as string,
    maxSpendNok: Number(row.max_spend_nok ?? 0),
    approvedOverageNok: Number(row.approved_overage_nok ?? 0),
    overageRequestedNok: num(row.overage_requested_nok),
    overageNote: (row.overage_note as string | null) ?? null,
    setBy: (row.set_by as string | null) ?? null,
    updatedBy: (row.updated_by as string | null) ?? null,
  };
}

export async function getBudget(
  pool: Pool,
  projectId: string,
  period: string,
): Promise<AdsBudgetRow | null> {
  const result = await pool.query(
    `SELECT * FROM role_room_ads_budgets WHERE project_id = $1 AND period = $2 LIMIT 1`,
    [projectId, period],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

/** Set/replace the period budget (client action). Resets any pending overage request. */
export async function setBudget(
  pool: Pool,
  projectId: string,
  period: string,
  maxSpendNok: number,
  setBy: string,
): Promise<AdsBudgetRow> {
  const result = await pool.query(
    `INSERT INTO role_room_ads_budgets (project_id, period, max_spend_nok, set_by, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $4, now())
     ON CONFLICT (project_id, period) DO UPDATE SET
       max_spend_nok = EXCLUDED.max_spend_nok,
       updated_by = EXCLUDED.updated_by,
       updated_at = now()
     RETURNING *`,
    [projectId, period, Math.max(0, maxSpendNok), setBy],
  );
  return mapRow(result.rows[0]);
}

/** Producer requests permission to exceed the budget (§2.3) — awaits client approval. */
export async function requestOverage(
  pool: Pool,
  projectId: string,
  period: string,
  requestedNok: number,
  note: string | null,
  requestedBy: string,
): Promise<AdsBudgetRow | null> {
  const result = await pool.query(
    `UPDATE role_room_ads_budgets
        SET overage_requested_nok = $3, overage_note = $4, updated_by = $5, updated_at = now()
      WHERE project_id = $1 AND period = $2
      RETURNING *`,
    [projectId, period, Math.max(0, requestedNok), note, requestedBy],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

/** Client approves a higher cap (written consent, §2.3). Clears the pending request. */
export async function approveOverage(
  pool: Pool,
  projectId: string,
  period: string,
  approvedOverageNok: number,
  approvedBy: string,
): Promise<AdsBudgetRow | null> {
  const result = await pool.query(
    `UPDATE role_room_ads_budgets
        SET approved_overage_nok = $3, overage_requested_nok = NULL, updated_by = $4, updated_at = now()
      WHERE project_id = $1 AND period = $2
      RETURNING *`,
    [projectId, period, Math.max(0, approvedOverageNok), approvedBy],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

/**
 * Throws BudgetExceededError if the project has already reached its effective
 * cap for the period. No budget set → no cap enforced (returns the status).
 * Used to block campaign activation/resume (§2.3).
 */
export async function assertWithinBudget(
  pool: Pool,
  projectId: string,
  period: string,
  actualSpendNok: number,
): Promise<BudgetStatus> {
  const budget = await getBudget(pool, projectId, period);
  const status = computeBudgetStatus({
    hasBudget: !!budget,
    maxSpendNok: budget?.maxSpendNok ?? 0,
    approvedOverageNok: budget?.approvedOverageNok ?? 0,
    actualSpendNok,
    overageRequestedNok: budget?.overageRequestedNok ?? null,
  });
  if (status.isOverBudget) throw new BudgetExceededError(status);
  return status;
}
