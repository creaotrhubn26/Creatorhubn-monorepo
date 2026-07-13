/**
 * leadgrid-sales-signal-sync.ts — kundens egne salgsdata inn i signallaget
 * (Daniels datastruktur-punkt 1: CRM/salgsdata som kilde; fase 4-fasit)
 *
 * Aggregerer won/lost-overganger fra crm_deal_stage_history per org og
 * ISO-uke til normalized_signals:
 *
 *   deals_won / deals_lost   (unit 'count')
 *   deals_won_amount         (unit 'nok', kun uker med beløp)
 *
 * Redelighet:
 *  - sourceType 'first_party' (bevisst enum-utvidelse): dette er EGNE
 *    systemdata — verken eksternt API eller import, og aldri estimert
 *    (isEstimated=false, confidence 1).
 *  - Deterministiske id-er per (org, uke, metrikk) → re-synk er no-op.
 *  - Kun avsluttede overganger telles (to_stage IN won/lost) — åpne
 *    pipeline-stadier er prognose, ikke fasit, og hører ikke hjemme her.
 *
 * Dette er datagrunnlaget fase 4 (kalibrering av score-modellen mot
 * faktisk utfall) skal lese fra.
 */

import type { Pool } from "pg";
import type { NormalizedSignal } from "./normalized-signal-schema.js";
import { insertNormalizedSignals } from "./normalized-signal-store.js";

export interface SalesWeekRow {
  organizationId: string;
  ownerUserId: string;
  /** Mandag i ISO-uken, YYYY-MM-DD. */
  weekStart: string;
  outcome: "won" | "lost";
  deals: number;
  amountNok: number | null;
}

export interface SalesSyncContext {
  collectedAt: string;
}

/** Ren normalisering (enhetstestet) — én uke-rad → 1–2 signaler. */
export function toSalesOutcomeSignals(
  rows: SalesWeekRow[],
  ctx: SalesSyncContext,
): NormalizedSignal[] {
  const signals: NormalizedSignal[] = [];
  for (const row of rows) {
    const periodStart = `${row.weekStart}T00:00:00.000Z`;
    const end = new Date(`${row.weekStart}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 7);
    const periodEnd = end.toISOString();
    const base = {
      organizationId: row.organizationId,
      workspaceId: row.ownerUserId,
      provider: "leadgrid-crm",
      sourceType: "first_party" as const,
      subjectType: "own_property" as const,
      subjectId: "leadgrid-pipeline",
      topic: "salg-pipeline",
      periodStart,
      periodEnd,
      confidence: 1,
      sourceQuality: 1,
      freshnessScore: 1,
      isEstimated: false,
      isNormalized: true,
      collectedAt: ctx.collectedAt,
      metadata: { source: "crm_deal_stage_history", aggregation: "iso_week" },
    };
    signals.push({
      ...base,
      id: `leadgrid-crm|${row.organizationId}|${row.weekStart}|deals_${row.outcome}`,
      metricType: `deals_${row.outcome}`,
      metricValue: row.deals,
      unit: "count",
    });
    if (row.outcome === "won" && row.amountNok !== null && row.amountNok > 0) {
      signals.push({
        ...base,
        id: `leadgrid-crm|${row.organizationId}|${row.weekStart}|deals_won_amount`,
        metricType: "deals_won_amount",
        metricValue: row.amountNok,
        unit: "nok",
      });
    }
  }
  return signals;
}

export interface SalesSyncResult {
  organizations: number;
  weeksAggregated: number;
  signalsInserted: number;
  errors: string[];
}

/**
 * Synk siste N uker med won/lost per org. Idempotent (deterministiske
 * id-er + dedup-indeks) — kjøres trygt daglig.
 */
export async function syncLeadgridSalesSignals(
  pool: Pool,
  opts: { weeks?: number } = {},
): Promise<SalesSyncResult> {
  const weeks = Math.min(Math.max(opts.weeks ?? 8, 1), 52);
  const errors: string[] = [];

  const r = await pool.query<{
    organization_id: string;
    owner_user_id: string;
    week_start: string;
    to_stage: "won" | "lost";
    deals: number;
    amount_nok: number | null;
  }>(
    `SELECT c.organization_id::text,
            o.owner_user_id,
            to_char(date_trunc('week', h.changed_at), 'YYYY-MM-DD') AS week_start,
            h.to_stage,
            COUNT(DISTINCT h.customer_id)::int AS deals,
            SUM(COALESCE(h.amount_after, c.deal_amount)) AS amount_nok
       FROM crm_deal_stage_history h
       JOIN crm_customers c ON c.id = h.customer_id
       JOIN organizations o ON o.id = c.organization_id
      WHERE h.to_stage IN ('won','lost')
        AND c.organization_id IS NOT NULL
        AND h.changed_at > now() - ($1 || ' weeks')::interval
      GROUP BY c.organization_id, o.owner_user_id, week_start, h.to_stage`,
    [String(weeks)],
  );

  const rows: SalesWeekRow[] = r.rows.map((row) => ({
    organizationId: row.organization_id,
    ownerUserId: row.owner_user_id,
    weekStart: row.week_start,
    outcome: row.to_stage,
    deals: Number(row.deals),
    amountNok: row.amount_nok === null ? null : Number(row.amount_nok),
  }));

  const signals = toSalesOutcomeSignals(rows, { collectedAt: new Date().toISOString() });
  let inserted = 0;
  if (signals.length > 0) {
    try {
      const result = await insertNormalizedSignals(pool, signals);
      inserted = result.inserted;
    } catch (err) {
      errors.push(String(err).slice(0, 150));
    }
  }
  return {
    organizations: new Set(rows.map((x) => x.organizationId)).size,
    weeksAggregated: rows.length,
    signalsInserted: inserted,
    errors,
  };
}
