/**
 * ai-overage-billing.ts — Fase C av «soft-cap + overage»-modellen.
 *
 * DETTE ER DEN ENESTE DELEN SOM FLYTTER PENGER. Den leser ferdig-akkumulerte
 * overage-rader fra `ai_overage_accrual` (Fase B) og rapporterer dem som Stripe
 * metered-events, og markerer deretter raden `billed_at`. Speiler mønsteret i
 * `leadgrid-overage-billing.ts` (billing/meter_events + billed_at-guard).
 *
 * DOBBEL SIKKERHET:
 *  1. `AI_OVERAGE_BILLING_ENABLED` må være "true" for at ekte Stripe-kall skjer.
 *     Er den ikke satt → alt kjører som DRY-RUN (beregner hva som VILLE blitt
 *     fakturert, men kaller ikke Stripe og skriver ikke billed_at).
 *  2. `billed_at`-guard + stabil `identifier` gjør re-kjøring idempotent — en rad
 *     faktureres aldri to ganger.
 *
 * STRIPE-OPPSETT SOM KREVES FØR ENABLE (gjøres i Stripe-dashbord):
 *  - Opprett en Meter med event_name = STRIPE_AI_OVERAGE_METER_EVENT_NAME
 *    (default "ai_overage"), aggregering = sum av `value`.
 *  - Opprett en usage-based Price knyttet til meteren, i NOK, priset slik at
 *    1 enhet = 1 krone (AI_OVERAGE_METER_UNIT=nok, default) ELLER 1 enhet = 1 øre
 *    (=oere). `value` vi sender følger den valgte enheten.
 *  - Legg meter-prisen som et subscription item på hver kundes abonnement — uten
 *    et abonnement-item som peker på meter-prisen samler Stripe events men
 *    fakturerer dem aldri.
 */

import type { Pool } from "pg";

const STRIPE_KEY =
  process.env.CREATORHUB_STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY ?? "";

const METER_EVENT_NAME =
  process.env.STRIPE_AI_OVERAGE_METER_EVENT_NAME ?? "ai_overage";

/** "nok" (default) = 1 meter-enhet per krone. "oere" = 1 enhet per øre (heltall). */
function meterUnit(): "nok" | "oere" {
  return (process.env.AI_OVERAGE_METER_UNIT ?? "nok").toLowerCase() === "oere"
    ? "oere"
    : "nok";
}

/** Ekte Stripe-fakturering skjer KUN når denne er eksplisitt "true". */
export function aiOverageBillingEnabled(): boolean {
  return String(process.env.AI_OVERAGE_BILLING_ENABLED ?? "").trim().toLowerCase() === "true";
}

export interface AiBillRow {
  organizationId: string;
  orgName: string | null;
  periodMonth: string;
  overageChargeNok: number;
  meterValue: number;
  stripeCustomerId: string;
  reported: boolean;
  error?: string;
}

export interface AiBillResult {
  enabled: boolean;
  dryRun: boolean;
  meterEventName: string;
  meterUnit: "nok" | "oere";
  stripeConfigured: boolean;
  periodMonth: string | null;
  candidates: number;
  reported: number;
  errors: number;
  totalChargeNok: number;
  rows: AiBillRow[];
  ranAt: string;
}

async function reportMeterEvent(
  identifier: string,
  stripeCustomerId: string,
  value: number,
  timestampUnix: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!STRIPE_KEY) return { ok: false, error: "Stripe ikke konfigurert" };
  try {
    const body = new URLSearchParams();
    body.set("event_name", METER_EVENT_NAME);
    body.set("identifier", identifier);
    body.set("timestamp", String(timestampUnix));
    body.set("payload[stripe_customer_id]", stripeCustomerId);
    body.set("payload[value]", String(value));

    const r = await fetch("https://api.stripe.com/v1/billing/meter_events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (r.ok) return { ok: true };
    const errText = await r.text();
    return { ok: false, error: `HTTP ${r.status}: ${errText.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Meter-verdi fra NOK-beløp gitt valgt enhet (heltall øre eller 2-desimal NOK). */
function toMeterValue(chargeNok: number): number {
  return meterUnit() === "oere"
    ? Math.round(chargeNok * 100)
    : Math.round(chargeNok * 100) / 100;
}

/**
 * Fakturer ufakturerte AI-overage-rader for en måned (default inneværende).
 * Leser fra ai_overage_accrual: billed_at IS NULL, overage_charge_nok > 0,
 * stripe_customer_id satt. dryRun (eller disabled env) → rapporterer ikke og
 * skriver ikke billed_at. Idempotent via billed_at + stabil identifier.
 */
export async function billAiOverage(
  pool: Pool,
  opts: { month?: string; dryRun?: boolean } = {},
): Promise<AiBillResult> {
  const enabled = aiOverageBillingEnabled();
  // Ekte fakturering krever BÅDE enabled OG at kalleren ikke ber om dry-run.
  const dryRun = opts.dryRun === true || !enabled;
  const unit = meterUnit();

  const params: unknown[] = [];
  let where = "billed_at IS NULL AND overage_charge_nok > 0 AND stripe_customer_id IS NOT NULL AND stripe_customer_id <> ''";
  if (opts.month) {
    params.push(`${opts.month}-01`);
    where += ` AND period_month = $${params.length}`;
  }

  const rowsR = await pool.query<{
    id: string;
    organization_id: string;
    org_name: string | null;
    period_month: string;
    overage_charge_nok: string;
    stripe_customer_id: string;
  }>(
    `SELECT acc.id::text, acc.organization_id::text, o.name AS org_name,
            to_char(acc.period_month, 'YYYY-MM-DD') AS period_month,
            acc.overage_charge_nok, acc.stripe_customer_id
       FROM ai_overage_accrual acc
       LEFT JOIN organizations o ON o.id = acc.organization_id
      WHERE ${where}
      ORDER BY acc.overage_charge_nok DESC
      LIMIT 500`,
    params,
  );

  const nowUnix = Math.floor(Date.now() / 1000);
  const rows: AiBillRow[] = [];
  let reported = 0;
  let errors = 0;
  let totalChargeNok = 0;

  for (const r of rowsR.rows) {
    const chargeNok = Number(r.overage_charge_nok) || 0;
    const meterValue = toMeterValue(chargeNok);
    totalChargeNok += chargeNok;
    const identifier = `ai_overage_${r.organization_id}_${r.period_month}`;

    const base: AiBillRow = {
      organizationId: r.organization_id,
      orgName: r.org_name,
      periodMonth: r.period_month,
      overageChargeNok: Math.round(chargeNok * 100) / 100,
      meterValue,
      stripeCustomerId: r.stripe_customer_id,
      reported: false,
    };

    if (dryRun) {
      rows.push(base);
      continue;
    }

    const res = await reportMeterEvent(identifier, r.stripe_customer_id, meterValue, nowUnix);
    if (res.ok) {
      await pool.query(`UPDATE ai_overage_accrual SET billed_at = now() WHERE id = $1`, [r.id]);
      reported += 1;
      rows.push({ ...base, reported: true });
    } else {
      errors += 1;
      rows.push({ ...base, error: res.error });
      console.error(`[ai-overage-billing] meter-report failed for org ${r.organization_id} ${r.period_month}: ${res.error}`);
    }
  }

  return {
    enabled,
    dryRun,
    meterEventName: METER_EVENT_NAME,
    meterUnit: unit,
    stripeConfigured: !!STRIPE_KEY,
    periodMonth: opts.month ? `${opts.month}-01` : null,
    candidates: rowsR.rows.length,
    reported,
    errors,
    totalChargeNok: Math.round(totalChargeNok * 100) / 100,
    rows,
    ranAt: new Date().toISOString(),
  };
}
