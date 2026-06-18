/**
 * editing-payments-service.ts
 *
 * Betaling for redigerings-oppdrag.
 *   Innbetaling (fotograf): Stripe Checkout (kort) eller faktura.
 *   Utbetaling (vendor):    Stripe Connect Transfer (støttede land) eller
 *                           PayPal Payouts (REST, resten). Norsk vendor = Stripe.
 *   Escrow: utbetaling frigis FØRST etter fotograf-godkjenning (kalles fra approve).
 *
 * Alle provider-kall er credential-gated (manglende env -> klar status, ingen crash),
 * etter samme «fire-and-forget»-prinsipp som b2-archive-helper.
 */

import type { Pool } from "pg";
import Stripe from "stripe";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key.trim());
}

export interface EditingJobRow {
  id: string;
  photographer_id: string;
  vendor_id: string | null;
  vendor_name: string | null;
  amount_cents: number;
  platform_fee_cents: number;
  currency: string;
  payment_method: string | null;
  payment_status: string | null;
}

// ─────────────────────────────────────────────────────────────────────
// Innbetaling (fotograf -> plattform). Separate charges & transfers:
// vi belaster plattformen nå (hold), og overfører til vendor ved godkjenning.
// ─────────────────────────────────────────────────────────────────────
export async function createCheckoutForJob(
  job: EditingJobRow,
  successUrl: string,
  cancelUrl: string,
): Promise<{ ok: boolean; url?: string; sessionId?: string; error?: string }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "stripe_not_configured" };
  if (!job.amount_cents || job.amount_cents <= 0) return { ok: false, error: "ugyldig_belop" };
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: (job.currency || "NOK").toLowerCase(),
            unit_amount: job.amount_cents,
            product_data: {
              name: `Redigering: ${job.vendor_name || "ekstern vendor"}`,
            },
          },
        },
      ],
      metadata: { editingJobId: job.id, kind: "editing_job" },
    });
    return { ok: true, url: session.url ?? undefined, sessionId: session.id };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message ?? err) };
  }
}

/** Bekreft at en checkout-session er betalt (kalles fra success-redirect/webhook). */
export async function isCheckoutPaid(sessionId: string): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe) return false;
  try {
    const s = await stripe.checkout.sessions.retrieve(sessionId);
    return s.payment_status === "paid";
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// PayPal Payouts (REST, ingen SDK)
// ─────────────────────────────────────────────────────────────────────
function paypalBase(): string {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getPaypalAccessToken(): Promise<string | null> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) return null;
  try {
    const resp = await fetch(`${paypalBase()}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

async function paypalPayout(
  email: string,
  amount: number,
  currency: string,
  note: string,
): Promise<{ ok: boolean; batchId?: string; error?: string }> {
  const token = await getPaypalAccessToken();
  if (!token) return { ok: false, error: "paypal_not_configured" };
  try {
    const resp = await fetch(`${paypalBase()}/v1/payments/payouts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_batch_header: { email_subject: "Creatorhub – utbetaling for redigeringsoppdrag" },
        items: [
          {
            recipient_type: "EMAIL",
            amount: { value: (amount / 100).toFixed(2), currency },
            receiver: email,
            note,
          },
        ],
      }),
    });
    const data = (await resp.json()) as { batch_header?: { payout_batch_id?: string }; message?: string };
    if (!resp.ok) return { ok: false, error: data.message || "paypal_payout_feilet" };
    return { ok: true, batchId: data.batch_header?.payout_batch_id };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message ?? err) };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Utbetaling til vendor (kalles ved fotograf-godkjenning). Escrow frigis her.
// ─────────────────────────────────────────────────────────────────────
export interface PayoutResult {
  status: "paid" | "released" | "failed" | "pending";
  method?: string;
  reference?: string;
  error?: string;
}

export async function releasePayoutForJob(pool: Pool, jobId: string): Promise<PayoutResult> {
  const jr = await pool.query<EditingJobRow & { vendor_id: string | null }>(
    `SELECT id, photographer_id, vendor_id, vendor_name, amount_cents, platform_fee_cents, currency, payment_method, payment_status
       FROM editing_jobs WHERE id = $1`,
    [jobId],
  );
  const job = jr.rows[0];
  if (!job || !job.vendor_id) return { status: "failed", error: "ingen_vendor" };

  const vendorAmount = Math.max(0, (job.amount_cents || 0) - (job.platform_fee_cents || 0));
  const currency = (job.currency || "NOK").toUpperCase();

  const vr = await pool.query<{ payout_method: string | null; stripe_connect_account_id: string | null; paypal_payout_email: string | null }>(
    `SELECT payout_method, stripe_connect_account_id, paypal_payout_email
       FROM vendor_onboarding_profiles WHERE user_id = $1`,
    [job.vendor_id],
  );
  const v = vr.rows[0];
  const method = v?.payout_method || "stripe_connect";

  // Ingenting å utbetale (gratis/prototype) -> marker frigitt
  if (vendorAmount <= 0) {
    await markPaid(pool, jobId, "released", method, null);
    return { status: "released", method };
  }

  if (method === "stripe_connect" && v?.stripe_connect_account_id) {
    const stripe = getStripe();
    if (!stripe) return await fail(pool, jobId, "stripe_not_configured");
    try {
      const transfer = await stripe.transfers.create({
        amount: vendorAmount,
        currency: currency.toLowerCase(),
        destination: v.stripe_connect_account_id,
        metadata: { editingJobId: jobId },
      });
      await markPaid(pool, jobId, "paid", method, transfer.id);
      return { status: "paid", method, reference: transfer.id };
    } catch (err) {
      return await fail(pool, jobId, String((err as Error)?.message ?? err));
    }
  }

  if (method === "paypal" && v?.paypal_payout_email) {
    const r = await paypalPayout(v.paypal_payout_email, vendorAmount, currency, `Editing job ${jobId}`);
    if (!r.ok) return await fail(pool, jobId, r.error);
    await pool.query(`UPDATE editing_jobs SET paypal_payout_batch_id = $2 WHERE id = $1`, [jobId, r.batchId || null]);
    await markPaid(pool, jobId, "paid", method, r.batchId || null);
    return { status: "paid", method, reference: r.batchId };
  }

  // Bank/faktura eller manglende payout-konto -> marker frigitt for manuell utbetaling
  await markPaid(pool, jobId, "released", method, null);
  return { status: "released", method };
}

async function markPaid(pool: Pool, jobId: string, status: string, method: string, reference: string | null): Promise<void> {
  await pool.query(
    `UPDATE editing_jobs
        SET payout_status = $2, payout_method = $3, payout_reference = $4,
            paid_at = CASE WHEN $2 = 'paid' THEN NOW() ELSE paid_at END,
            payment_status = 'released', updated_at = NOW()
      WHERE id = $1`,
    [jobId, status, method, reference],
  );
}

async function fail(pool: Pool, jobId: string, error?: string): Promise<PayoutResult> {
  await pool.query(`UPDATE editing_jobs SET payout_status = 'failed', updated_at = NOW() WHERE id = $1`, [jobId]);
  return { status: "failed", error };
}
