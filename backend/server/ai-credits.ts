/**
 * ai-credits.ts — forhåndsbetalt AI-kreditt-lommebok (delt logikk).
 *
 * balance_usd = RETAIL-verdi brukeren kan bruke. Hver generering trekker
 * kost×påslag; vi betaler kun kost → margin (påslag-delen) = garantert profitt.
 * Idempotent på unik `ref` (stripe:<session> / job:<id>): ledger-rad INSERT
 * FØRST (ON CONFLICT gater dobbel), så saldo-UPDATE. Brukes av både
 * project-workspace-routes (kjøp/forbruk) og Stripe-webhooken (robust topp-opp).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";

export async function ensureCreditSchema(pool: any): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS user_ai_credits (
    user_id varchar PRIMARY KEY, balance_usd numeric NOT NULL DEFAULT 0,
    lifetime_purchased_usd numeric NOT NULL DEFAULT 0, lifetime_spent_usd numeric NOT NULL DEFAULT 0,
    updated_at timestamptz DEFAULT now())`).catch(() => {});
  await pool.query(`CREATE TABLE IF NOT EXISTS ai_credit_ledger (
    id uuid PRIMARY KEY, user_id varchar, type varchar, amount_usd numeric, balance_after_usd numeric,
    ref varchar, note text, created_at timestamptz DEFAULT now())`).catch(() => {});
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_ref ON ai_credit_ledger (ref)`).catch(() => {});
}

export async function getUserCredits(pool: any, uid: string): Promise<{ balanceUsd: number; purchasedUsd: number; spentUsd: number }> {
  await ensureCreditSchema(pool);
  const r = await pool.query(`SELECT balance_usd, lifetime_purchased_usd, lifetime_spent_usd FROM user_ai_credits WHERE user_id = $1`, [uid]).catch(() => ({ rows: [] }));
  const w = r.rows[0] || {};
  return { balanceUsd: Number(w.balance_usd || 0), purchasedUsd: Number(w.lifetime_purchased_usd || 0), spentUsd: Number(w.lifetime_spent_usd || 0) };
}

// Idempotent kreditt-bevegelse: ledger FØRST (unik ref gater dobbel) → så saldo.
export async function creditMove(pool: any, uid: string, type: string, amountUsd: number, ref: string | null, note: string): Promise<boolean> {
  await ensureCreditSchema(pool);
  const led = await pool.query(
    `INSERT INTO ai_credit_ledger (id, user_id, type, amount_usd, ref, note) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (ref) DO NOTHING RETURNING id`,
    [crypto.randomUUID(), uid, type, amountUsd, ref, note],
  ).catch(() => ({ rows: [] }));
  if (!led.rows.length) return false; // duplikat ref → allerede behandlet
  const purchaseCol = amountUsd > 0 ? `, lifetime_purchased_usd = user_ai_credits.lifetime_purchased_usd + ${amountUsd}` : "";
  const spendCol = amountUsd < 0 ? `, lifetime_spent_usd = user_ai_credits.lifetime_spent_usd + ${-amountUsd}` : "";
  const upd = await pool.query(
    `INSERT INTO user_ai_credits (user_id, balance_usd, lifetime_purchased_usd, lifetime_spent_usd, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id) DO UPDATE SET balance_usd = user_ai_credits.balance_usd + $2, updated_at = NOW() ${purchaseCol} ${spendCol}
     RETURNING balance_usd`,
    [uid, amountUsd, amountUsd > 0 ? amountUsd : 0, amountUsd < 0 ? -amountUsd : 0],
  ).catch(() => ({ rows: [] }));
  await pool.query(`UPDATE ai_credit_ledger SET balance_after_usd = $1 WHERE id = $2`, [Number(upd.rows[0]?.balance_usd || 0), led.rows[0].id]).catch(() => {});
  return true;
}

// Krediter en betalt ai_credits Checkout-session (brukt av webhook + confirm).
// Idempotent på ref=stripe:<sessionId>.
export async function creditFromStripeSession(pool: any, session: any): Promise<boolean> {
  if (session?.metadata?.kind !== "ai_credits") return false;
  if (session?.payment_status && session.payment_status !== "paid") return false;
  const uid = session?.metadata?.user_id || session?.client_reference_id;
  const creditUsd = Number(session?.metadata?.credit_usd || 0);
  if (!uid || !(creditUsd > 0)) return false;
  return creditMove(pool, uid, "purchase", creditUsd, `stripe:${session.id}`, `Kjøp pakke ${session?.metadata?.pack_id || ""}`.trim());
}
