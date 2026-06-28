/**
 * leadgrid-deals-service.ts
 *
 * Forretningslogikk for Deal Management (#154/#155):
 *   - applyStageChange: oppdater pipeline_stage + auto-probability + audit-rad
 *   - updateDealFields: oppdater deal_probability/expected_close/amount
 *   - computeWeightedForecast: aggregert pipeline-prognose for org
 *   - listDealsAtRisk: deals med forfalt expected_close + ikke 100%
 *   - listMonthlyForecast: brutt ned per uke/måned/kvartal
 *
 * Forecast = sum(deal_amount × deal_probability / 100) for ikke-arkiverte
 * leads med deal_amount + deal_probability + expected_close_date satt.
 */

import type { Pool, PoolClient } from "pg";
import {
  DEFAULT_PROBABILITY_BY_STAGE,
  isLeadgridStage,
  type LeadgridStage,
} from "./leadgrid-deal-defaults.js";

export interface DealFields {
  dealProbability: number | null;
  dealProbabilityOverridden: boolean;
  expectedCloseDate: string | null;
  dealAmount: number | null;
  dealCurrency: string | null;
  pipelineStage: string | null;
  dealStageChangedAt: string | null;
}

export interface DealStageChange {
  id: string;
  customerId: string;
  fromStage: string | null;
  toStage: string;
  changedBy: string;
  changedAt: string;
  probabilityBefore: number | null;
  probabilityAfter: number | null;
  amountBefore: number | null;
  amountAfter: number | null;
  durationInPreviousStageMinutes: number | null;
  notes: string | null;
}

interface RowDealFields {
  deal_probability: number | null;
  deal_probability_overridden: boolean | null;
  expected_close_date: string | null;
  deal_amount: string | null;
  deal_currency: string | null;
  pipeline_stage: string | null;
  deal_stage_changed_at: string | null;
}

function toDealFields(r: RowDealFields | undefined): DealFields | null {
  if (!r) return null;
  return {
    dealProbability: r.deal_probability,
    dealProbabilityOverridden: Boolean(r.deal_probability_overridden),
    expectedCloseDate: r.expected_close_date,
    dealAmount: r.deal_amount === null ? null : Number(r.deal_amount),
    dealCurrency: r.deal_currency,
    pipelineStage: r.pipeline_stage,
    dealStageChangedAt: r.deal_stage_changed_at,
  };
}

export async function getDealForLead(
  pool: Pool,
  leadId: string,
): Promise<DealFields | null> {
  const r = await pool.query<RowDealFields>(
    `SELECT deal_probability, deal_probability_overridden, expected_close_date,
            deal_amount, deal_currency, pipeline_stage, deal_stage_changed_at
       FROM crm_customers
      WHERE id = $1::uuid
      LIMIT 1`,
    [leadId],
  );
  return toDealFields(r.rows[0]);
}

/**
 * Update structured deal fields. Any field omitted is left untouched.
 *
 * Setting deal_probability eksplisitt setter også
 * deal_probability_overridden = TRUE slik at fremtidige stage-changes
 * IKKE overskriver brukerens verdi.
 */
export async function updateDealFields(
  pool: Pool,
  leadId: string,
  changedBy: string,
  patch: {
    dealProbability?: number | null;
    expectedCloseDate?: string | null;
    dealAmount?: number | null;
    dealCurrency?: string | null;
  },
): Promise<DealFields | null> {
  const before = await getDealForLead(pool, leadId);
  if (!before) return null;

  const sets: string[] = [];
  const vals: unknown[] = [];
  let p = 1;

  if (patch.dealProbability !== undefined) {
    if (
      patch.dealProbability !== null &&
      (patch.dealProbability < 0 || patch.dealProbability > 100)
    ) {
      throw new Error("deal_probability_out_of_range");
    }
    sets.push(`deal_probability = $${p++}`);
    vals.push(patch.dealProbability);
    sets.push(`deal_probability_overridden = $${p++}`);
    vals.push(patch.dealProbability !== null);
  }
  if (patch.expectedCloseDate !== undefined) {
    sets.push(`expected_close_date = $${p++}`);
    vals.push(patch.expectedCloseDate);
  }
  if (patch.dealAmount !== undefined) {
    if (patch.dealAmount !== null && patch.dealAmount < 0) {
      throw new Error("deal_amount_negative");
    }
    sets.push(`deal_amount = $${p++}`);
    vals.push(patch.dealAmount);
  }
  if (patch.dealCurrency !== undefined) {
    sets.push(`deal_currency = $${p++}`);
    vals.push(patch.dealCurrency);
  }
  if (sets.length === 0) return before;

  sets.push(`updated_at = NOW()`);
  vals.push(leadId);

  await pool.query(
    `UPDATE crm_customers
        SET ${sets.join(", ")}
      WHERE id = $${p}::uuid`,
    vals,
  );

  // void audit-rad for amount/probability-endring uten stage-change
  // (vi logger som "manual_deal_update")
  void pool
    .query(
      `INSERT INTO crm_deal_stage_history
         (customer_id, from_stage, to_stage, changed_by,
          probability_before, probability_after,
          amount_before, amount_after, notes, metadata)
       VALUES ($1::uuid, $2, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        leadId,
        before.pipelineStage,
        changedBy,
        before.dealProbability,
        patch.dealProbability === undefined
          ? before.dealProbability
          : patch.dealProbability,
        before.dealAmount,
        patch.dealAmount === undefined ? before.dealAmount : patch.dealAmount,
        "manual_deal_update",
        JSON.stringify({ kind: "manual_deal_update" }),
      ],
    )
    .catch((err: unknown) => {
      console.warn("[deals-service] manual_deal_update audit fail:", err);
    });

  return getDealForLead(pool, leadId);
}

/**
 * Apply pipeline_stage change. Brukes BÅDE av intelligence-routes
 * (drag-and-drop på Kanban) OG av workflow-actions.
 *
 * Side-effekter:
 *   - Auto-set deal_probability hvis ikke manuelt overskrevet
 *   - Insert i crm_deal_stage_history
 *   - Oppdater deal_stage_changed_at, last_pipeline_stage_change_at/_by
 *
 * Returnerer { oldStage, newStage, durationInPreviousStageMinutes } slik at
 * caller kan emitte webhooks.
 */
export async function applyStageChange(
  pool: Pool,
  leadId: string,
  changedBy: string,
  toStage: LeadgridStage,
  opts?: { client?: PoolClient; notes?: string; source?: string },
): Promise<{
  oldStage: string | null;
  newStage: string;
  durationInPreviousStageMinutes: number | null;
  oldProbability: number | null;
  newProbability: number | null;
}> {
  const q = opts?.client ?? pool;

  const beforeRes = await q.query<{
    pipeline_stage: string | null;
    deal_probability: number | null;
    deal_probability_overridden: boolean | null;
    deal_amount: string | null;
    deal_stage_changed_at: string | null;
  }>(
    `SELECT pipeline_stage, deal_probability, deal_probability_overridden,
            deal_amount, deal_stage_changed_at
       FROM crm_customers
      WHERE id = $1::uuid
      LIMIT 1`,
    [leadId],
  );
  const before = beforeRes.rows[0];
  if (!before) throw new Error("lead_not_found");

  const oldStage = before.pipeline_stage;
  const oldProbability = before.deal_probability;
  const overridden = Boolean(before.deal_probability_overridden);

  let newProbability = oldProbability;
  if (!overridden) {
    newProbability = DEFAULT_PROBABILITY_BY_STAGE[toStage];
  } else if (toStage === "won") {
    newProbability = 100; // won er alltid 100 selv ved override
  } else if (toStage === "lost") {
    newProbability = 0; // lost er alltid 0 selv ved override
  }

  // Beregn duration_in_previous_stage_minutes
  let durationMinutes: number | null = null;
  if (before.deal_stage_changed_at) {
    const ms =
      Date.now() - new Date(before.deal_stage_changed_at).getTime();
    if (Number.isFinite(ms) && ms >= 0) {
      durationMinutes = Math.round(ms / 60000);
    }
  }

  await q.query(
    `UPDATE crm_customers
        SET pipeline_stage = $1,
            deal_probability = $2,
            deal_stage_changed_at = NOW(),
            last_pipeline_stage_change_at = NOW(),
            last_pipeline_stage_change_by = $3,
            updated_at = NOW()
      WHERE id = $4::uuid`,
    [toStage, newProbability, changedBy, leadId],
  );

  await q.query(
    `INSERT INTO crm_deal_stage_history
       (customer_id, from_stage, to_stage, changed_by,
        probability_before, probability_after,
        amount_before, amount_after,
        duration_in_previous_stage_minutes, notes, metadata)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10::jsonb)`,
    [
      leadId,
      oldStage,
      toStage,
      changedBy,
      oldProbability,
      newProbability,
      before.deal_amount,
      durationMinutes,
      opts?.notes ?? null,
      JSON.stringify({
        kind: "stage_change",
        source: opts?.source ?? "service",
        overridden,
      }),
    ],
  );

  return {
    oldStage,
    newStage: toStage,
    durationInPreviousStageMinutes: durationMinutes,
    oldProbability,
    newProbability,
  };
}

export async function fetchStageHistory(
  pool: Pool,
  leadId: string,
  limit = 50,
): Promise<DealStageChange[]> {
  const r = await pool.query<{
    id: string;
    customer_id: string;
    from_stage: string | null;
    to_stage: string;
    changed_by: string;
    changed_at: string;
    probability_before: number | null;
    probability_after: number | null;
    amount_before: string | null;
    amount_after: string | null;
    duration_in_previous_stage_minutes: number | null;
    notes: string | null;
  }>(
    `SELECT id::text, customer_id::text, from_stage, to_stage,
            changed_by, changed_at,
            probability_before, probability_after,
            amount_before, amount_after,
            duration_in_previous_stage_minutes, notes
       FROM crm_deal_stage_history
      WHERE customer_id = $1::uuid
      ORDER BY changed_at DESC
      LIMIT $2`,
    [leadId, limit],
  );
  return r.rows.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    fromStage: row.from_stage,
    toStage: row.to_stage,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    probabilityBefore: row.probability_before,
    probabilityAfter: row.probability_after,
    amountBefore: row.amount_before === null ? null : Number(row.amount_before),
    amountAfter: row.amount_after === null ? null : Number(row.amount_after),
    durationInPreviousStageMinutes: row.duration_in_previous_stage_minutes,
    notes: row.notes,
  }));
}

export interface WeightedForecastSummary {
  organizationId: string;
  totalWeightedValue: number;
  totalPipelineValue: number;
  dealsCount: number;
  averageProbability: number;
  currency: string;
}

export interface PeriodBucket {
  period: string; // 'YYYY-MM' eller 'YYYY-Wxx'
  periodLabel: string;
  weightedValue: number;
  totalValue: number;
  dealsCount: number;
  averageProbability: number;
}

export interface WeightedForecast {
  summary: WeightedForecastSummary;
  byMonth: PeriodBucket[];
  byQuarter: PeriodBucket[];
}

/**
 * computeWeightedForecast — aggregert weighted-pipeline for én org.
 *
 * Resolver org → owner_user_ids → leads.
 *
 * Stadig ikke en organization_id-kolonne på crm_customers; vi går
 * via organization_members.user_id som "tenant"-key (samme mønster
 * som intelligence-routes).
 */
export async function computeWeightedForecast(
  pool: Pool,
  organizationId: string,
  opts?: { horizonDays?: number },
): Promise<WeightedForecast> {
  const horizonDays = opts?.horizonDays ?? 365;

  // Hent alle aktive deals for orgen
  interface DealRow {
    deal_amount: string;
    deal_probability: number;
    expected_close_date: string;
    deal_currency: string | null;
  }

  const r = await pool.query<DealRow>(
    `SELECT c.deal_amount::text AS deal_amount,
            c.deal_probability,
            c.expected_close_date::text AS expected_close_date,
            c.deal_currency
       FROM crm_customers c
      WHERE c.archived_at IS NULL
        AND c.deal_probability IS NOT NULL
        AND c.deal_amount IS NOT NULL
        AND c.expected_close_date IS NOT NULL
        AND c.pipeline_stage NOT IN ('won','lost')
        AND c.expected_close_date <= (CURRENT_DATE + $2::int)
        AND c.owner_user_id IN (
          SELECT user_id::text
            FROM organization_members
           WHERE organization_id = $1::uuid
        )`,
    [organizationId, horizonDays],
  );

  let totalWeighted = 0;
  let totalPipeline = 0;
  let probSum = 0;
  const monthMap = new Map<string, PeriodBucket>();
  const quarterMap = new Map<string, PeriodBucket>();
  let currency = "NOK";

  for (const row of r.rows) {
    const amount = Number(row.deal_amount);
    const prob = Number(row.deal_probability);
    const weighted = amount * (prob / 100);
    totalPipeline += amount;
    totalWeighted += weighted;
    probSum += prob;
    if (row.deal_currency) currency = row.deal_currency;

    const date = new Date(row.expected_close_date);
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1; // 1-12
    const q = Math.ceil(m / 3); // 1-4
    const monthKey = `${y}-${String(m).padStart(2, "0")}`;
    const monthLabel = monthKey;
    const quarterKey = `${y}-Q${q}`;

    const mBucket = monthMap.get(monthKey) ?? {
      period: monthKey,
      periodLabel: monthLabel,
      weightedValue: 0,
      totalValue: 0,
      dealsCount: 0,
      averageProbability: 0,
    };
    mBucket.weightedValue += weighted;
    mBucket.totalValue += amount;
    mBucket.dealsCount += 1;
    mBucket.averageProbability =
      (mBucket.averageProbability * (mBucket.dealsCount - 1) + prob) /
      mBucket.dealsCount;
    monthMap.set(monthKey, mBucket);

    const qBucket = quarterMap.get(quarterKey) ?? {
      period: quarterKey,
      periodLabel: quarterKey,
      weightedValue: 0,
      totalValue: 0,
      dealsCount: 0,
      averageProbability: 0,
    };
    qBucket.weightedValue += weighted;
    qBucket.totalValue += amount;
    qBucket.dealsCount += 1;
    qBucket.averageProbability =
      (qBucket.averageProbability * (qBucket.dealsCount - 1) + prob) /
      qBucket.dealsCount;
    quarterMap.set(quarterKey, qBucket);
  }

  const dealsCount = r.rows.length;
  return {
    summary: {
      organizationId,
      totalWeightedValue: round2(totalWeighted),
      totalPipelineValue: round2(totalPipeline),
      dealsCount,
      averageProbability:
        dealsCount === 0 ? 0 : round2(probSum / dealsCount),
      currency,
    },
    byMonth: Array.from(monthMap.values())
      .map((b) => ({
        ...b,
        weightedValue: round2(b.weightedValue),
        totalValue: round2(b.totalValue),
        averageProbability: round2(b.averageProbability),
      }))
      .sort((a, b) => a.period.localeCompare(b.period)),
    byQuarter: Array.from(quarterMap.values())
      .map((b) => ({
        ...b,
        weightedValue: round2(b.weightedValue),
        totalValue: round2(b.totalValue),
        averageProbability: round2(b.averageProbability),
      }))
      .sort((a, b) => a.period.localeCompare(b.period)),
  };
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export interface DealAtRisk {
  leadId: string;
  name: string | null;
  pipelineStage: string;
  dealAmount: number;
  dealProbability: number;
  weightedValue: number;
  expectedCloseDate: string;
  daysOverdue: number;
  ownerUserId: string;
}

export async function listDealsAtRisk(
  pool: Pool,
  organizationId: string,
  limit = 20,
): Promise<DealAtRisk[]> {
  const r = await pool.query<{
    lead_id: string;
    name: string | null;
    pipeline_stage: string;
    deal_amount: string;
    deal_probability: number;
    expected_close_date: string;
    days_overdue: number;
    owner_user_id: string;
  }>(
    `SELECT c.id::text AS lead_id,
            COALESCE(c.company, c.name) AS name,
            c.pipeline_stage,
            c.deal_amount::text AS deal_amount,
            c.deal_probability,
            c.expected_close_date::text AS expected_close_date,
            (CURRENT_DATE - c.expected_close_date)::int AS days_overdue,
            c.owner_user_id
       FROM crm_customers c
      WHERE c.archived_at IS NULL
        AND c.deal_probability IS NOT NULL
        AND c.deal_amount IS NOT NULL
        AND c.expected_close_date IS NOT NULL
        AND c.pipeline_stage NOT IN ('won','lost')
        AND c.expected_close_date < CURRENT_DATE
        AND c.owner_user_id IN (
          SELECT user_id::text
            FROM organization_members
           WHERE organization_id = $1::uuid
        )
      ORDER BY (CURRENT_DATE - c.expected_close_date) DESC,
               (c.deal_amount * (c.deal_probability / 100.0)) DESC
      LIMIT $2`,
    [organizationId, limit],
  );

  return r.rows.map((row) => {
    const amount = Number(row.deal_amount);
    const prob = Number(row.deal_probability);
    return {
      leadId: row.lead_id,
      name: row.name,
      pipelineStage: row.pipeline_stage,
      dealAmount: amount,
      dealProbability: prob,
      weightedValue: round2(amount * (prob / 100)),
      expectedCloseDate: row.expected_close_date,
      daysOverdue: row.days_overdue,
      ownerUserId: row.owner_user_id,
    };
  });
}
