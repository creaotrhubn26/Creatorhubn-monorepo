/**
 * ai-overage-service.ts — Fase B av «soft-cap + overage»-modellen.
 *
 * Bygger på Fase A (ai-margin-service.ts, READ-ONLY synlighet). Denne modulen
 * AKKUMULERER faktisk AI-leverandørkost per organisasjon per KALENDERMÅNED,
 * sammenligner mot inkludert AI-budsjett for planen, og beregner et
 * overage-BELØP (leverandørkost over budsjett × markup).
 *
 * VIKTIG: Fase B SKRIVER IKKE til Stripe og BLOKKERER ALDRI kall. Den fyller kun
 * regnskapstabellen `ai_overage_accrual` (mig 333) slik at super-admin ser hva
 * som VILLE blitt fakturert. Fase C leser billed_at/stripe_customer_id herfra og
 * rapporterer metered-events til Stripe bak eksplisitt bekreftelse.
 *
 * Plan- og Stripe-kunde-oppløsning (jf. billing-attribusjons-funn):
 *  - Kost aggregeres per organization_id (med member-fallback for én-org-brukere).
 *  - Plan løses fra organizations.owner_user_id → user_subscriptions.plan_id
 *    (nyeste rad), normalisert til kanonisk plattform-plan.
 *  - Stripe-kunde løses beste-innsats fra organizations.stripe_customer_id.
 *    Er den NULL kan raden ikke faktureres i Fase C → flagges (needsStripeLink).
 */

import type { Pool } from "pg";
import {
  includedAiBudgetNok,
  normalizePlanId,
  overageMarkup,
} from "./ai-plan-budgets.js";

/** Omtrentlig USD→NOK. Deles med ai-margin-service via samme env-nøkkel. */
const USD_TO_NOK = Number(process.env.AI_USD_TO_NOK) || 10.5;

export interface OrgOverageRow {
  organizationId: string;
  orgName: string | null;
  planId: string | null;
  includedCostNok: number;
  actualCostNok: number;
  overageCostNok: number;
  overageChargeNok: number;
  markup: number;
  stripeCustomerId: string | null;
  /** true = har overskridelse å fakturere, men mangler Stripe-kunde (Fase C-blokker). */
  needsStripeLink: boolean;
  calls: number;
}

export interface AiOverageResult {
  periodMonth: string; // YYYY-MM-01
  usdToNok: number;
  markup: number;
  orgsProcessed: number;
  orgsWithOverage: number;
  totalOverageChargeNok: number;
  /** Antall orgs m/ overskridelse men uten Stripe-kobling (kan ikke faktureres i Fase C). */
  orgsMissingStripeLink: number;
  rows: OrgOverageRow[];
  computedAt: string;
}

/** Første dag i måneden (UTC) som YYYY-MM-01 for en gitt dato. */
function monthStart(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/** [start, nextMonthStart) UTC-grenser for en YYYY-MM-01-streng. */
function monthBounds(periodMonth: string): { start: Date; end: Date } {
  const [y, m] = periodMonth.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

/**
 * Beregn og lagre (upsert) AI-overage-akkumulering for én kalendermåned.
 * Default = inneværende måned (UTC). Idempotent: kan kjøres flere ganger i
 * måneden; hver kjøring overskriver akkumulert-raden med gjeldende sum.
 * Rader som allerede er fakturert (billed_at IS NOT NULL) rører vi IKKE.
 */
export async function computeMonthlyAiOverage(
  pool: Pool,
  opts: { month?: string } = {},
): Promise<AiOverageResult> {
  const periodMonth = opts.month
    ? monthStart(new Date(`${opts.month}-01T00:00:00Z`))
    : monthStart(new Date());
  const { start, end } = monthBounds(periodMonth);
  const markup = overageMarkup();

  // Aggregér AI-kost per org for måneden (samme org-oppløsning som Fase A),
  // og løs plan + Stripe-kunde via org-eier.
  const usage = await pool.query<{
    organization_id: string;
    org_name: string | null;
    plan_id: string | null;
    stripe_customer_id: string | null;
    cost_usd: string;
    calls: string;
  }>(
    `WITH member_org AS (
       SELECT user_id, MIN(organization_id) AS org_id
         FROM organization_members
        GROUP BY user_id
       HAVING COUNT(*) = 1
     ),
     usage AS (
       SELECT COALESCE(a.organization_id, m.org_id) AS org_id,
              SUM(a.cost_usd)::numeric AS cost_usd,
              COUNT(*)                 AS calls
         FROM ai_usage_log a
         LEFT JOIN member_org m ON m.user_id = a.user_id
        WHERE a.created_at >= $1 AND a.created_at < $2
          AND COALESCE(a.organization_id, m.org_id) IS NOT NULL
        GROUP BY COALESCE(a.organization_id, m.org_id)
     ),
     latest_sub AS (
       SELECT DISTINCT ON (us.user_id) us.user_id, us.plan_id
         FROM user_subscriptions us
        ORDER BY us.user_id, us.started_at DESC
     )
     SELECT u.org_id            AS organization_id,
            o.name              AS org_name,
            ls.plan_id          AS plan_id,
            o.stripe_customer_id,
            u.cost_usd,
            u.calls
       FROM usage u
       JOIN organizations o    ON o.id = u.org_id
       LEFT JOIN latest_sub ls ON ls.user_id = o.owner_user_id
      ORDER BY u.cost_usd DESC NULLS LAST`,
    [start.toISOString(), end.toISOString()],
  );

  const rows: OrgOverageRow[] = [];
  let totalOverageChargeNok = 0;
  let orgsWithOverage = 0;
  let orgsMissingStripeLink = 0;

  for (const r of usage.rows) {
    const canonicalPlan = normalizePlanId(r.plan_id) ?? r.plan_id ?? null;
    const included = includedAiBudgetNok(r.plan_id);
    const actualNok = round4((Number(r.cost_usd) || 0) * USD_TO_NOK);
    const overageCostNok = round4(Math.max(0, actualNok - included));
    const overageChargeNok = round4(overageCostNok * markup);
    const stripeCustomerId = r.stripe_customer_id || null;
    const hasOverage = overageChargeNok > 0;
    const needsStripeLink = hasOverage && !stripeCustomerId;

    if (hasOverage) {
      orgsWithOverage += 1;
      totalOverageChargeNok += overageChargeNok;
      if (needsStripeLink) orgsMissingStripeLink += 1;
    }

    rows.push({
      organizationId: r.organization_id,
      orgName: r.org_name,
      planId: canonicalPlan,
      includedCostNok: round4(included),
      actualCostNok: actualNok,
      overageCostNok,
      overageChargeNok,
      markup,
      stripeCustomerId,
      needsStripeLink,
      calls: Number(r.calls) || 0,
    });

    // Upsert regnskapsraden. Rør ALDRI en allerede fakturert rad (Fase C-eid).
    await pool.query(
      `INSERT INTO ai_overage_accrual
         (organization_id, period_month, plan_id, included_cost_nok,
          actual_cost_nok, overage_cost_nok, overage_charge_nok, markup,
          stripe_customer_id, computed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (organization_id, period_month) DO UPDATE SET
         plan_id            = EXCLUDED.plan_id,
         included_cost_nok  = EXCLUDED.included_cost_nok,
         actual_cost_nok    = EXCLUDED.actual_cost_nok,
         overage_cost_nok   = EXCLUDED.overage_cost_nok,
         overage_charge_nok = EXCLUDED.overage_charge_nok,
         markup             = EXCLUDED.markup,
         stripe_customer_id = EXCLUDED.stripe_customer_id,
         computed_at        = now()
       WHERE ai_overage_accrual.billed_at IS NULL`,
      [
        r.organization_id,
        periodMonth,
        canonicalPlan,
        round4(included),
        actualNok,
        overageCostNok,
        overageChargeNok,
        markup,
        stripeCustomerId,
      ],
    );
  }

  return {
    periodMonth,
    usdToNok: USD_TO_NOK,
    markup,
    orgsProcessed: rows.length,
    orgsWithOverage,
    totalOverageChargeNok: round2(totalOverageChargeNok),
    orgsMissingStripeLink,
    rows,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Les tidligere akkumulerte overage-rader for en måned (READ-ONLY, ingen ny beregning).
 * Brukes av super-admin-innsyn og som Fase C-arbeidskø.
 */
export async function readAiOverageAccrual(
  pool: Pool,
  opts: { month?: string } = {},
): Promise<AiOverageResult> {
  const periodMonth = opts.month
    ? monthStart(new Date(`${opts.month}-01T00:00:00Z`))
    : monthStart(new Date());

  const res = await pool.query<{
    organization_id: string;
    org_name: string | null;
    plan_id: string | null;
    included_cost_nok: string;
    actual_cost_nok: string;
    overage_cost_nok: string;
    overage_charge_nok: string;
    markup: string;
    stripe_customer_id: string | null;
    billed_at: Date | null;
  }>(
    `SELECT acc.organization_id, o.name AS org_name, acc.plan_id,
            acc.included_cost_nok, acc.actual_cost_nok, acc.overage_cost_nok,
            acc.overage_charge_nok, acc.markup, acc.stripe_customer_id, acc.billed_at
       FROM ai_overage_accrual acc
       LEFT JOIN organizations o ON o.id = acc.organization_id
      WHERE acc.period_month = $1
      ORDER BY acc.overage_charge_nok DESC`,
    [periodMonth],
  );

  let totalOverageChargeNok = 0;
  let orgsWithOverage = 0;
  let orgsMissingStripeLink = 0;

  const rows: OrgOverageRow[] = res.rows.map((r) => {
    const overageChargeNok = Number(r.overage_charge_nok) || 0;
    const stripeCustomerId = r.stripe_customer_id || null;
    const needsStripeLink = overageChargeNok > 0 && !stripeCustomerId && !r.billed_at;
    if (overageChargeNok > 0) {
      orgsWithOverage += 1;
      totalOverageChargeNok += overageChargeNok;
      if (needsStripeLink) orgsMissingStripeLink += 1;
    }
    return {
      organizationId: r.organization_id,
      orgName: r.org_name,
      planId: r.plan_id,
      includedCostNok: Number(r.included_cost_nok) || 0,
      actualCostNok: Number(r.actual_cost_nok) || 0,
      overageCostNok: Number(r.overage_cost_nok) || 0,
      overageChargeNok,
      markup: Number(r.markup) || overageMarkup(),
      stripeCustomerId,
      needsStripeLink,
      calls: 0, // ikke lagret i akkumulering; tom ved ren lesing
    };
  });

  return {
    periodMonth,
    usdToNok: USD_TO_NOK,
    markup: overageMarkup(),
    orgsProcessed: rows.length,
    orgsWithOverage,
    totalOverageChargeNok: round2(totalOverageChargeNok),
    orgsMissingStripeLink,
    rows,
    computedAt: new Date().toISOString(),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
