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

// ── Pacing (Lag 3: aktiv budsjett-vakt) ──────────────────────────────────
// Taket (computeBudgetStatus) sier om vi HAR brukt opp budsjettet. Pacing sier
// om vi er PÅ VEI til å gjøre det: forbrukstempo vs. dager igjen, projisert
// månedsslutt, og hvilket dagsbudsjett som lander akkurat på taket. Ren matte
// — testet — slik at både UI og en evt. auto-pause leser samme tall.

export type BudgetPace = 'no_budget' | 'on_track' | 'at_risk' | 'over_pace' | 'exhausted';

export interface BudgetPacing {
  daysInPeriod: number;
  daysElapsed: number;   // inkl. i dag (1-basert i inneværende periode)
  daysRemaining: number; // ekskl. i dag
  dailyRunRateNok: number;          // faktisk forbruk / dager gått
  projectedPeriodSpendNok: number;  // run-rate × dager i perioden
  projectedOverspendNok: number;    // max(0, projisert − tak)
  /** Dagsbudsjett som lander akkurat på taket med dagene som gjenstår. */
  recommendedDailyBudgetNok: number;
  /** YYYY-MM-DD når run-rate når taket, ellers null (intet budsjett / for sakte). */
  projectedExhaustionDate: string | null;
  pace: BudgetPace;
}

function daysInMonthUtc(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/**
 * Pacing for en periode (YYYY-MM) gitt budsjett-status + dato. For inneværende
 * måned brukes dagens dato; for forbi måneder regnes hele måneden som gått; for
 * framtidige måneder er 0 dager gått (run-rate udefinert → on_track).
 */
export function computeBudgetPacing(input: {
  status: BudgetStatus;
  period: string; // YYYY-MM
  today?: Date;
}): BudgetPacing {
  const { status } = input;
  const today = input.today ?? new Date();
  const [yStr, mStr] = input.period.split('-');
  const year = Number(yStr);
  const month1 = Number(mStr); // 1-basert
  const daysInPeriod = daysInMonthUtc(year, month1);

  // Dager gått i perioden (klippet til [0, daysInPeriod]).
  const tY = today.getUTCFullYear();
  const tM = today.getUTCMonth() + 1;
  let daysElapsed: number;
  if (tY === year && tM === month1) daysElapsed = today.getUTCDate();
  else if (tY > year || (tY === year && tM > month1)) daysElapsed = daysInPeriod; // perioden er over
  else daysElapsed = 0; // perioden har ikke startet
  const daysRemaining = Math.max(0, daysInPeriod - daysElapsed);

  const cap = status.effectiveCapNok;
  const actual = status.actualSpendNok;
  const dailyRunRateNok = daysElapsed > 0 ? actual / daysElapsed : 0;
  const projectedPeriodSpendNok = dailyRunRateNok * daysInPeriod;
  const projectedOverspendNok = Math.max(0, projectedPeriodSpendNok - cap);
  const remaining = Math.max(0, cap - actual);
  const recommendedDailyBudgetNok = daysRemaining > 0 ? remaining / daysRemaining : 0;

  let projectedExhaustionDate: string | null = null;
  if (cap > 0 && dailyRunRateNok > 0) {
    const dayHit = Math.ceil(cap / dailyRunRateNok);
    if (dayHit <= daysInPeriod) {
      projectedExhaustionDate = `${input.period}-${String(dayHit).padStart(2, '0')}`;
    }
  }

  let pace: BudgetPace;
  if (!status.hasBudget || cap <= 0) pace = 'no_budget';
  else if (status.isOverBudget) pace = 'exhausted';
  else if (projectedPeriodSpendNok > cap) pace = 'over_pace';
  else if (status.isNearBudget) pace = 'at_risk';
  else pace = 'on_track';

  const round = (n: number) => Math.round(n);
  return {
    daysInPeriod,
    daysElapsed,
    daysRemaining,
    dailyRunRateNok: round(dailyRunRateNok),
    projectedPeriodSpendNok: round(projectedPeriodSpendNok),
    projectedOverspendNok: round(projectedOverspendNok),
    recommendedDailyBudgetNok: round(recommendedDailyBudgetNok),
    projectedExhaustionDate,
    pace,
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
