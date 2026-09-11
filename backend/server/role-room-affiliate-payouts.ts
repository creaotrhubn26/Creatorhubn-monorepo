import { randomUUID, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import Stripe from "stripe";
import { z } from "zod";
import { readRoleRoomOrganizationAccess } from "./role-room-storage-billing.js";

const DEFAULT_PUBLIC_ORIGIN = "https://theroleroom.com";
const DEFAULT_MINIMUM_PAYOUT_MINOR = 100_000;

type SessionData = { userId: string; role?: string; email?: string };
type Queryable = Pool | PoolClient;
type AdminSession = { userId: string; email?: string };

interface AffiliatePayoutDeps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  stripe: Stripe | null;
  requireAdminSession: (req: Request, res: Response) => AdminSession | null;
}

interface ConnectPartnerRow {
  id: string;
  organization_id: string;
  organization_name: string;
  contact_email: string | null;
  billing_email: string | null;
  stripe_connect_account_id: string | null;
  stripe_connect_country: string;
  stripe_connect_onboarding_status: string;
  stripe_connect_details_submitted: boolean;
  stripe_connect_payouts_enabled: boolean;
  stripe_connect_transfers_status: string | null;
  stripe_connect_requirements: Record<string, unknown>;
  payout_currency: string;
  minimum_payout_minor: string;
  referral_code: string;
  status: string;
}

interface PayoutRow {
  id: string;
  affiliate_partner_id: string;
  stripe_connect_account_id: string;
  currency: string;
  amount_minor: string;
  minimum_payout_minor: string;
  batch_period: Date | string;
  status: string;
  idempotency_key: string;
  stripe_transfer_id: string | null;
  attempt_count: number;
}

const organizationSchema = z
  .object({ organizationId: z.string().uuid() })
  .strict();
const createPartnerSchema = z
  .object({
    organizationId: z.string().uuid(),
    referralCode: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[A-Za-z0-9_-]+$/),
    commissionBasisPoints: z.number().int().min(0).max(10_000).default(1500),
    storageCommissionBasisPoints: z
      .number()
      .int()
      .min(0)
      .max(10_000)
      .default(500),
    commissionMonths: z.number().int().min(0).max(120).default(12),
    minimumPayoutMinor: z
      .number()
      .int()
      .min(0)
      .max(100_000_000)
      .default(DEFAULT_MINIMUM_PAYOUT_MINOR),
  })
  .strict();

function getSession(
  req: Request,
  sessions: Map<string, SessionData>,
): SessionData | null {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    return sessions.get(authorization.slice(7).trim()) ?? null;
  }
  const cookieToken = (req as Request & { cookies?: Record<string, string> })
    .cookies?.sessionToken;
  return cookieToken ? (sessions.get(cookieToken) ?? null) : null;
}

function publicOrigin(): string {
  const candidate =
    process.env.ROLE_ROOM_PUBLIC_URL?.trim() || DEFAULT_PUBLIC_ORIGIN;
  try {
    const parsed = new URL(candidate);
    const localDevelopment =
      process.env.NODE_ENV !== "production" &&
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname);
    return parsed.protocol === "https:" || localDevelopment
      ? parsed.origin
      : DEFAULT_PUBLIC_ORIGIN;
  } catch {
    return DEFAULT_PUBLIC_ORIGIN;
  }
}

function payoutsEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test(
    process.env.ROLE_ROOM_AFFILIATE_PAYOUTS_ENABLED?.trim() || "",
  );
}

function secureEqual(
  presented: unknown,
  expected: string | undefined,
): boolean {
  if (typeof presented !== "string" || !expected) return false;
  const actual = Buffer.from(presented.trim());
  const wanted = Buffer.from(expected.trim());
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

function idFromExpandable(
  value: { id: string } | string | null | undefined,
): string | null {
  if (typeof value === "string") return value;
  return value?.id || null;
}

function safeMinorAmount(value: string | number, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed))
    throw new Error(`${label}_outside_safe_integer_range`);
  return parsed;
}

export function readStripeInvoicePaymentReferences(invoice: Stripe.Invoice): {
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
} {
  const payment =
    invoice.payments?.data.find((candidate) => candidate.status === "paid") ??
    invoice.payments?.data[0];
  if (!payment) return { stripePaymentIntentId: null, stripeChargeId: null };
  const paymentIntent = payment.payment.payment_intent;
  const directCharge = payment.payment.charge;
  const stripePaymentIntentId = idFromExpandable(paymentIntent);
  const stripeChargeId =
    idFromExpandable(directCharge) ??
    (typeof paymentIntent === "object"
      ? idFromExpandable(paymentIntent.latest_charge)
      : null);
  return { stripePaymentIntentId, stripeChargeId };
}

function chargeReferences(charge: Stripe.Charge): {
  chargeId: string;
  paymentIntentId: string | null;
} {
  return {
    chargeId: charge.id,
    paymentIntentId: idFromExpandable(charge.payment_intent),
  };
}

function disputeReferences(dispute: Stripe.Dispute): {
  chargeId: string;
  paymentIntentId: string | null;
} {
  return {
    chargeId: idFromExpandable(dispute.charge) || "",
    paymentIntentId: idFromExpandable(dispute.payment_intent),
  };
}

async function readConnectPartnerByOrganization(
  queryable: Queryable,
  organizationId: string,
): Promise<ConnectPartnerRow | null> {
  const result = await queryable.query<ConnectPartnerRow>(
    `SELECT partner.id, partner.organization_id, organization.name AS organization_name,
            organization.contact_email, organization.billing_email,
            partner.stripe_connect_account_id, partner.stripe_connect_country,
            partner.stripe_connect_onboarding_status,
            partner.stripe_connect_details_submitted,
            partner.stripe_connect_payouts_enabled,
            partner.stripe_connect_transfers_status,
            partner.stripe_connect_requirements,
            partner.payout_currency, partner.minimum_payout_minor,
            partner.referral_code, partner.status
       FROM role_room_affiliate_partners partner
       JOIN organizations organization ON organization.id = partner.organization_id
      WHERE partner.organization_id = $1::uuid
      LIMIT 1`,
    [organizationId],
  );
  return result.rows[0] ?? null;
}

function connectStatusFromAccount(
  account: Stripe.Account,
): "pending" | "restricted" | "complete" {
  const transferStatus = account.capabilities?.transfers;
  if (
    account.details_submitted &&
    account.payouts_enabled &&
    transferStatus === "active"
  ) {
    return "complete";
  }
  if (
    account.requirements?.disabled_reason ||
    (account.requirements?.past_due?.length ?? 0) > 0
  ) {
    return "restricted";
  }
  return "pending";
}

async function syncConnectAccount(
  queryable: Queryable,
  account: Stripe.Account,
): Promise<void> {
  const requirements = {
    currentlyDue: account.requirements?.currently_due ?? [],
    eventuallyDue: account.requirements?.eventually_due ?? [],
    pastDue: account.requirements?.past_due ?? [],
    pendingVerification: account.requirements?.pending_verification ?? [],
    disabledReason: account.requirements?.disabled_reason ?? null,
  };
  await queryable.query(
    `UPDATE role_room_affiliate_partners
        SET stripe_connect_account_id = COALESCE(stripe_connect_account_id, $1),
            stripe_connect_country = UPPER(COALESCE($2, stripe_connect_country)),
            stripe_connect_onboarding_status = $3,
            stripe_connect_details_submitted = $4,
            stripe_connect_payouts_enabled = $5,
            stripe_connect_transfers_status = $6,
            stripe_connect_requirements = $7::jsonb,
            stripe_connect_synced_at = NOW(), updated_at = NOW()
      WHERE stripe_connect_account_id = $1
         OR (stripe_connect_account_id IS NULL
             AND id::text = NULLIF($8, ''))`,
    [
      account.id,
      account.country || null,
      connectStatusFromAccount(account),
      account.details_submitted,
      account.payouts_enabled,
      account.capabilities?.transfers || null,
      JSON.stringify(requirements),
      account.metadata?.role_room_affiliate_partner_id || "",
    ],
  );
}

async function findConnectAccountByPartnerMetadata(
  stripe: Stripe,
  partnerId: string,
): Promise<Stripe.Account | null> {
  let startingAfter: string | undefined;
  do {
    const page = await stripe.accounts.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    const match = page.data.find(
      (account) =>
        account.metadata?.role_room_affiliate_partner_id === partnerId,
    );
    if (match) return match;
    if (!page.has_more || page.data.length === 0) return null;
    startingAfter = page.data[page.data.length - 1].id;
  } while (startingAfter);
  return null;
}

async function readAffiliateBalance(queryable: Queryable, partnerId: string) {
  const result = await queryable.query<{
    accrued_minor: string;
    adjustment_minor: string;
    reserved_or_transferred_minor: string;
    available_minor: string;
    next_maturity_at: Date | null;
  }>(
    `WITH commissions AS (
       SELECT commission.id, commission.commission_amount_minor,
              commission.matures_at
         FROM role_room_affiliate_commissions commission
         JOIN role_room_affiliate_referrals referral
           ON referral.id = commission.affiliate_referral_id
        WHERE referral.affiliate_partner_id = $1::uuid
          AND commission.currency = 'nok'
     ), adjustments AS (
       SELECT adjustment.commission_id, SUM(adjustment.amount_minor)::bigint AS amount_minor
         FROM role_room_affiliate_commission_adjustments adjustment
         JOIN commissions commission ON commission.id = adjustment.commission_id
        GROUP BY adjustment.commission_id
     ), paid AS (
       SELECT item.commission_id,
              SUM(item.amount_minor - item.reversed_amount_minor)::bigint AS amount_minor
         FROM role_room_affiliate_payout_items item
         JOIN commissions commission ON commission.id = item.commission_id
        WHERE item.status IN ('reserved', 'transferred', 'reversed')
        GROUP BY item.commission_id
     )
     SELECT COALESCE(SUM(commission.commission_amount_minor), 0)::bigint AS accrued_minor,
            COALESCE(SUM(COALESCE(adjustments.amount_minor, 0)), 0)::bigint AS adjustment_minor,
            COALESCE(SUM(COALESCE(paid.amount_minor, 0)), 0)::bigint AS reserved_or_transferred_minor,
            COALESCE(SUM(
              CASE WHEN commission.matures_at <= NOW()
                THEN commission.commission_amount_minor
                     + COALESCE(adjustments.amount_minor, 0)
                     - COALESCE(paid.amount_minor, 0)
                ELSE 0 END
            ), 0)::bigint AS available_minor,
            MIN(commission.matures_at) FILTER (WHERE commission.matures_at > NOW()) AS next_maturity_at
       FROM commissions commission
       LEFT JOIN adjustments ON adjustments.commission_id = commission.id
       LEFT JOIN paid ON paid.commission_id = commission.id`,
    [partnerId],
  );
  const row = result.rows[0];
  return {
    currency: "nok",
    accruedMinor: safeMinorAmount(row?.accrued_minor || 0, "affiliate_accrued"),
    adjustmentMinor: safeMinorAmount(
      row?.adjustment_minor || 0,
      "affiliate_adjustment",
    ),
    reservedOrTransferredMinor: safeMinorAmount(
      row?.reserved_or_transferred_minor || 0,
      "affiliate_allocated",
    ),
    availableMinor: safeMinorAmount(
      row?.available_minor || 0,
      "affiliate_available",
    ),
    nextMaturityAt:
      row?.next_maturity_at?.toISOString?.() ?? row?.next_maturity_at ?? null,
  };
}

async function reconcileCommissionStatus(
  queryable: Queryable,
  commissionId: string,
): Promise<void> {
  await queryable.query(
    `WITH totals AS (
       SELECT commission.id,
              commission.commission_amount_minor
                + COALESCE((SELECT SUM(amount_minor)
                              FROM role_room_affiliate_commission_adjustments
                             WHERE commission_id = commission.id), 0) AS net_minor,
              COALESCE((SELECT SUM(amount_minor - reversed_amount_minor)
                          FROM role_room_affiliate_payout_items
                         WHERE commission_id = commission.id
                           AND status IN ('reserved', 'transferred', 'reversed')), 0) AS allocated_minor,
              commission.matures_at
         FROM role_room_affiliate_commissions commission
        WHERE commission.id = $1::uuid
     )
     UPDATE role_room_affiliate_commissions commission
        SET status = CASE
              WHEN totals.net_minor <= 0 THEN 'reversed'
              WHEN totals.allocated_minor >= totals.net_minor THEN 'paid'
              WHEN totals.matures_at <= NOW() THEN 'approved'
              ELSE 'accrued'
            END,
            approved_at = CASE
              WHEN totals.net_minor > 0 AND totals.matures_at <= NOW()
                THEN COALESCE(commission.approved_at, NOW())
              ELSE commission.approved_at
            END,
            paid_at = CASE
              WHEN totals.net_minor > 0 AND totals.allocated_minor >= totals.net_minor
                THEN COALESCE(commission.paid_at, NOW())
              ELSE commission.paid_at
            END,
            reversed_at = CASE WHEN totals.net_minor <= 0 THEN COALESCE(commission.reversed_at, NOW()) ELSE NULL END,
            reversal_reason = CASE WHEN totals.net_minor <= 0 THEN COALESCE(commission.reversal_reason, 'refund_or_chargeback') ELSE NULL END,
            updated_at = NOW()
       FROM totals
      WHERE commission.id = totals.id`,
    [commissionId],
  );
}

async function commissionsForPayment(
  queryable: Queryable,
  chargeId: string,
  paymentIntentId: string | null,
  lock = false,
) {
  const result = await queryable.query<{
    id: string;
    currency: string;
    commission_amount_minor: string;
    source_payment_amount_minor: string;
  }>(
    `SELECT id, currency, commission_amount_minor, source_payment_amount_minor
       FROM role_room_affiliate_commissions
      WHERE stripe_charge_id = $1
         OR ($2::text IS NOT NULL AND stripe_payment_intent_id = $2)
      ${lock ? "FOR UPDATE" : ""}`,
    [chargeId, paymentIntentId],
  );
  return result.rows;
}

async function applyRefundAdjustments(
  queryable: Queryable,
  charge: Stripe.Charge,
  eventId: string,
): Promise<void> {
  if (charge.amount <= 0 || charge.amount_refunded <= 0) return;
  const refs = chargeReferences(charge);
  const commissions = await commissionsForPayment(
    queryable,
    refs.chargeId,
    refs.paymentIntentId,
    true,
  );
  for (const commission of commissions) {
    const original = safeMinorAmount(
      commission.commission_amount_minor,
      "affiliate_commission",
    );
    const targetReversal = Math.min(
      original,
      Math.round(
        (original * Math.min(charge.amount_refunded, charge.amount)) /
          charge.amount,
      ),
    );
    const existing = await queryable.query<{ reversed_minor: string }>(
      `SELECT COALESCE(-SUM(amount_minor), 0)::bigint AS reversed_minor
         FROM role_room_affiliate_commission_adjustments
        WHERE commission_id = $1::uuid AND kind = 'refund'`,
      [commission.id],
    );
    const delta =
      targetReversal -
      safeMinorAmount(
        existing.rows[0]?.reversed_minor || 0,
        "affiliate_refund_reversal",
      );
    if (delta > 0) {
      await queryable.query(
        `INSERT INTO role_room_affiliate_commission_adjustments (
           commission_id, kind, source_object_id, stripe_event_id,
           currency, amount_minor, reason, metadata
         ) VALUES ($1::uuid, 'refund', $2, $3, $4, $5::bigint, $6, $7::jsonb)
         ON CONFLICT (commission_id, kind, source_object_id) DO NOTHING`,
        [
          commission.id,
          `${charge.id}:refund-total:${charge.amount_refunded}`,
          eventId,
          commission.currency,
          -delta,
          "stripe_charge_refunded",
          JSON.stringify({
            stripeChargeId: charge.id,
            stripePaymentIntentId: refs.paymentIntentId,
            chargeAmountMinor: charge.amount,
            cumulativeRefundedMinor: charge.amount_refunded,
          }),
        ],
      );
      await reconcileCommissionStatus(queryable, commission.id);
    }
  }
}

async function applyChargebackAdjustment(
  queryable: Queryable,
  dispute: Stripe.Dispute,
  eventId: string,
): Promise<void> {
  const refs = disputeReferences(dispute);
  const commissions = await commissionsForPayment(
    queryable,
    refs.chargeId,
    refs.paymentIntentId,
    true,
  );
  for (const commission of commissions) {
    const net = await queryable.query<{ net_minor: string }>(
      `SELECT commission_amount_minor
              + COALESCE((SELECT SUM(amount_minor)
                            FROM role_room_affiliate_commission_adjustments
                           WHERE commission_id = role_room_affiliate_commissions.id), 0) AS net_minor
         FROM role_room_affiliate_commissions
        WHERE id = $1::uuid`,
      [commission.id],
    );
    const currentNet = Math.max(
      0,
      safeMinorAmount(net.rows[0]?.net_minor || 0, "affiliate_net"),
    );
    const sourcePaymentAmount = Math.max(
      1,
      safeMinorAmount(
        commission.source_payment_amount_minor || 0,
        "affiliate_source_payment",
      ),
    );
    const proportionalTarget = Math.min(
      safeMinorAmount(
        commission.commission_amount_minor,
        "affiliate_commission",
      ),
      Math.round(
        (safeMinorAmount(
          commission.commission_amount_minor,
          "affiliate_commission",
        ) *
          Math.min(dispute.amount, sourcePaymentAmount)) /
          sourcePaymentAmount,
      ),
    );
    const amount = Math.min(currentNet, proportionalTarget);
    if (amount <= 0) continue;
    await queryable.query(
      `INSERT INTO role_room_affiliate_commission_adjustments (
         commission_id, kind, source_object_id, stripe_event_id,
         currency, amount_minor, reason, metadata
       ) VALUES ($1::uuid, 'chargeback', $2, $3, $4, $5::bigint, $6, $7::jsonb)
       ON CONFLICT (commission_id, kind, source_object_id) DO NOTHING`,
      [
        commission.id,
        dispute.id,
        eventId,
        commission.currency,
        -amount,
        dispute.reason || "stripe_chargeback",
        JSON.stringify({
          stripeChargeId: refs.chargeId,
          stripePaymentIntentId: refs.paymentIntentId,
        }),
      ],
    );
    await reconcileCommissionStatus(queryable, commission.id);
  }
}

async function applyChargebackRecovery(
  queryable: Queryable,
  dispute: Stripe.Dispute,
  eventId: string,
): Promise<void> {
  const refs = disputeReferences(dispute);
  const commissions = await commissionsForPayment(
    queryable,
    refs.chargeId,
    refs.paymentIntentId,
    true,
  );
  for (const commission of commissions) {
    const reversal = await queryable.query<{ amount_minor: string }>(
      `SELECT COALESCE(-SUM(amount_minor), 0)::bigint AS amount_minor
         FROM role_room_affiliate_commission_adjustments
        WHERE commission_id = $1::uuid AND kind = 'chargeback' AND source_object_id = $2`,
      [commission.id, dispute.id],
    );
    const amount = safeMinorAmount(
      reversal.rows[0]?.amount_minor || 0,
      "affiliate_chargeback_recovery",
    );
    if (amount <= 0) continue;
    await queryable.query(
      `INSERT INTO role_room_affiliate_commission_adjustments (
         commission_id, kind, source_object_id, stripe_event_id,
         currency, amount_minor, reason, metadata
       ) VALUES ($1::uuid, 'chargeback_recovered', $2, $3, $4, $5::bigint, $6, $7::jsonb)
       ON CONFLICT (commission_id, kind, source_object_id) DO NOTHING`,
      [
        commission.id,
        dispute.id,
        eventId,
        commission.currency,
        amount,
        "stripe_chargeback_recovered",
        JSON.stringify({
          stripeChargeId: refs.chargeId,
          stripePaymentIntentId: refs.paymentIntentId,
        }),
      ],
    );
    await reconcileCommissionStatus(queryable, commission.id);
  }
}

async function applyTransferState(
  queryable: Queryable,
  transfer: Stripe.Transfer,
): Promise<void> {
  const payoutId = transfer.metadata?.role_room_affiliate_payout_id || null;
  const result = await queryable.query<{ id: string }>(
    `UPDATE role_room_affiliate_payouts
        SET stripe_transfer_id = COALESCE(stripe_transfer_id, $1),
            stripe_transfer_reversed_minor = $2::bigint,
            status = CASE WHEN $2::bigint >= amount_minor THEN 'reversed' ELSE 'transferred' END,
            transferred_at = COALESCE(transferred_at, TO_TIMESTAMP($3)),
            reversed_at = CASE WHEN $2::bigint >= amount_minor THEN NOW() ELSE NULL END,
            last_error = NULL, updated_at = NOW()
      WHERE stripe_transfer_id = $1
         OR ($4::text IS NOT NULL AND id::text = $4)
      RETURNING id`,
    [transfer.id, transfer.amount_reversed, transfer.created, payoutId],
  );
  for (const payout of result.rows) {
    await queryable.query(
      `WITH allocation AS (
         SELECT item.id,
                COALESCE(SUM(item.amount_minor) OVER (
                  ORDER BY item.created_at, item.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                ), 0) AS amount_before
           FROM role_room_affiliate_payout_items item
          WHERE item.payout_id = $1::uuid
       )
       UPDATE role_room_affiliate_payout_items item
          SET reversed_amount_minor = LEAST(
                item.amount_minor,
                GREATEST(0, $2::bigint - allocation.amount_before)
              ),
              status = CASE
                WHEN $2::bigint <= 0 THEN 'transferred'
                WHEN GREATEST(0, $2::bigint - allocation.amount_before) >= item.amount_minor THEN 'reversed'
                ELSE 'transferred'
              END,
              updated_at = NOW()
         FROM allocation
        WHERE item.id = allocation.id`,
      [payout.id, transfer.amount_reversed],
    );
    const itemResult = await queryable.query<{ commission_id: string }>(
      `SELECT commission_id FROM role_room_affiliate_payout_items WHERE payout_id = $1::uuid`,
      [payout.id],
    );
    for (const item of itemResult.rows)
      await reconcileCommissionStatus(queryable, item.commission_id);
  }
}

async function applyConnectedPayoutState(
  queryable: Queryable,
  payout: Stripe.Payout,
  connectedAccountId: string,
): Promise<void> {
  const partnerResult = await queryable.query<{ id: string }>(
    `SELECT id FROM role_room_affiliate_partners
      WHERE stripe_connect_account_id = $1 LIMIT 1`,
    [connectedAccountId],
  );
  const partner = partnerResult.rows[0];
  if (!partner) return;
  await queryable.query(
    `INSERT INTO role_room_affiliate_connected_payout_events (
       stripe_payout_id, affiliate_partner_id, stripe_connect_account_id,
       currency, amount_minor, status, arrival_at, failure_code,
       failure_message, metadata
     ) VALUES ($1, $2::uuid, $3, $4, $5::bigint, $6, TO_TIMESTAMP($7), $8, $9, $10::jsonb)
     ON CONFLICT (stripe_payout_id) DO UPDATE
       SET status = EXCLUDED.status, arrival_at = EXCLUDED.arrival_at,
           failure_code = EXCLUDED.failure_code,
           failure_message = EXCLUDED.failure_message,
           metadata = EXCLUDED.metadata, updated_at = NOW()`,
    [
      payout.id,
      partner.id,
      connectedAccountId,
      payout.currency,
      payout.amount,
      payout.status,
      payout.arrival_date,
      payout.failure_code,
      payout.failure_message,
      JSON.stringify({
        automatic: payout.automatic,
        method: payout.method,
        type: payout.type,
      }),
    ],
  );
  await queryable.query(
    `UPDATE role_room_affiliate_partners
        SET last_connect_payout_id = $2, last_connect_payout_status = $3,
            last_connect_payout_at = NOW(), updated_at = NOW()
      WHERE id = $1::uuid`,
    [partner.id, payout.id, payout.status],
  );
}

async function eventMatchesAffiliate(
  pool: Pool,
  event: Stripe.Event,
): Promise<boolean> {
  if (event.type === "account.updated") {
    const account = event.data.object;
    const result = await pool.query(
      `SELECT 1 FROM role_room_affiliate_partners
        WHERE stripe_connect_account_id = $1
           OR id::text = NULLIF($2, '') LIMIT 1`,
      [account.id, account.metadata?.role_room_affiliate_partner_id || ""],
    );
    return result.rows.length > 0;
  }
  if (
    ["transfer.created", "transfer.updated", "transfer.reversed"].includes(
      event.type,
    )
  ) {
    const transfer = event.data.object as Stripe.Transfer;
    const result = await pool.query(
      `SELECT 1 FROM role_room_affiliate_payouts
        WHERE stripe_transfer_id = $1
           OR id::text = NULLIF($2, '') LIMIT 1`,
      [transfer.id, transfer.metadata?.role_room_affiliate_payout_id || ""],
    );
    return result.rows.length > 0;
  }
  if (
    [
      "payout.created",
      "payout.updated",
      "payout.paid",
      "payout.failed",
      "payout.canceled",
    ].includes(event.type)
  ) {
    const connectedAccountId =
      typeof event.account === "string" ? event.account : null;
    if (!connectedAccountId) return false;
    const result = await pool.query(
      `SELECT 1 FROM role_room_affiliate_partners WHERE stripe_connect_account_id = $1 LIMIT 1`,
      [connectedAccountId],
    );
    return result.rows.length > 0;
  }
  if (event.type === "charge.refunded") {
    const refs = chargeReferences(event.data.object);
    return (
      (await commissionsForPayment(pool, refs.chargeId, refs.paymentIntentId))
        .length > 0
    );
  }
  if (
    event.type === "charge.dispute.created" ||
    event.type === "charge.dispute.closed" ||
    event.type === "charge.dispute.funds_reinstated"
  ) {
    const refs = disputeReferences(event.data.object);
    return (
      (await commissionsForPayment(pool, refs.chargeId, refs.paymentIntentId))
        .length > 0
    );
  }
  return false;
}

async function claimAffiliateEvent(
  pool: Pool,
  event: Stripe.Event,
): Promise<boolean> {
  const object = event.data.object as { id?: unknown };
  const objectId = typeof object.id === "string" ? object.id : null;
  const result = await pool.query(
    `INSERT INTO role_room_stripe_webhook_events (
       stripe_event_id, event_type, status, object_id
     ) VALUES ($1, $2, 'processing', $3)
     ON CONFLICT (stripe_event_id) DO UPDATE
       SET status = 'processing', error_message = NULL, received_at = NOW()
       WHERE role_room_stripe_webhook_events.status = 'failed'
          OR (role_room_stripe_webhook_events.status = 'processing'
              AND role_room_stripe_webhook_events.received_at < NOW() - INTERVAL '10 minutes')
     RETURNING stripe_event_id`,
    [event.id, event.type, objectId],
  );
  return result.rows.length > 0;
}

export async function handleRoleRoomAffiliateStripeEvent(
  pool: Pool,
  event: Stripe.Event,
): Promise<{ matched: boolean; duplicate?: boolean }> {
  if (!(await eventMatchesAffiliate(pool, event))) return { matched: false };
  if (!(await claimAffiliateEvent(pool, event)))
    return { matched: true, duplicate: true };
  try {
    if (event.type === "account.updated") {
      await syncConnectAccount(pool, event.data.object);
    } else if (
      event.type === "transfer.created" ||
      event.type === "transfer.updated" ||
      event.type === "transfer.reversed"
    ) {
      await applyTransferState(pool, event.data.object);
    } else if (
      event.type === "payout.created" ||
      event.type === "payout.updated" ||
      event.type === "payout.paid" ||
      event.type === "payout.failed" ||
      event.type === "payout.canceled"
    ) {
      const connectedAccountId =
        typeof event.account === "string" ? event.account : null;
      if (connectedAccountId)
        await applyConnectedPayoutState(
          pool,
          event.data.object,
          connectedAccountId,
        );
    } else if (event.type === "charge.refunded") {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await applyRefundAdjustments(client, event.data.object, event.id);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    } else if (event.type === "charge.dispute.created") {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await applyChargebackAdjustment(client, event.data.object, event.id);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    } else if (
      (event.type === "charge.dispute.closed" &&
        event.data.object.status === "won") ||
      event.type === "charge.dispute.funds_reinstated"
    ) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await applyChargebackRecovery(client, event.data.object, event.id);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }
    await pool.query(
      `UPDATE role_room_stripe_webhook_events
          SET status = 'processed', processed_at = NOW(), error_message = NULL
        WHERE stripe_event_id = $1`,
      [event.id],
    );
    return { matched: true };
  } catch (error) {
    await pool
      .query(
        `UPDATE role_room_stripe_webhook_events
          SET status = 'failed', error_message = $2, processed_at = NOW()
        WHERE stripe_event_id = $1`,
        [
          event.id,
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "unknown_error",
        ],
      )
      .catch(() => undefined);
    throw error;
  }
}

function monthStartUtc(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

async function createMonthlyPayoutBatch(
  pool: Pool,
  partnerId: string,
  asOf: Date,
  initiatedBy: string,
): Promise<{ payout: PayoutRow | null; reason?: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const partnerResult = await client.query<{
      id: string;
      stripe_connect_account_id: string | null;
      stripe_connect_onboarding_status: string;
      stripe_connect_payouts_enabled: boolean;
      stripe_connect_transfers_status: string | null;
      payout_currency: string;
      minimum_payout_minor: string;
      status: string;
    }>(
      `SELECT id, stripe_connect_account_id, stripe_connect_onboarding_status,
              stripe_connect_payouts_enabled, stripe_connect_transfers_status,
              payout_currency, minimum_payout_minor, status
         FROM role_room_affiliate_partners
        WHERE id = $1::uuid
        FOR UPDATE`,
      [partnerId],
    );
    const partner = partnerResult.rows[0];
    if (!partner) {
      await client.query("ROLLBACK");
      return { payout: null, reason: "partner_not_found" };
    }
    const batchPeriod = monthStartUtc(asOf);
    const existing = await client.query<PayoutRow>(
      `SELECT * FROM role_room_affiliate_payouts
        WHERE affiliate_partner_id = $1::uuid AND currency = $2 AND batch_period = $3::date
        LIMIT 1`,
      [partner.id, partner.payout_currency, batchPeriod],
    );
    if (existing.rows[0]) {
      await client.query("COMMIT");
      return { payout: existing.rows[0] };
    }
    const ready =
      partner.status === "active" &&
      partner.stripe_connect_account_id &&
      partner.stripe_connect_onboarding_status === "complete" &&
      partner.stripe_connect_payouts_enabled &&
      partner.stripe_connect_transfers_status === "active";
    if (!ready) {
      await client.query("ROLLBACK");
      return { payout: null, reason: "connect_not_ready" };
    }
    const commissionResult = await client.query<{
      id: string;
      available_minor: string;
    }>(
      `WITH adjustments AS (
         SELECT commission_id, SUM(amount_minor)::bigint AS amount_minor
           FROM role_room_affiliate_commission_adjustments
          GROUP BY commission_id
       ), allocated AS (
         SELECT commission_id,
                SUM(amount_minor - reversed_amount_minor)::bigint AS amount_minor
           FROM role_room_affiliate_payout_items
          WHERE status IN ('reserved', 'transferred', 'reversed')
          GROUP BY commission_id
       )
       SELECT commission.id,
              (commission.commission_amount_minor
                + COALESCE(adjustments.amount_minor, 0)
                - COALESCE(allocated.amount_minor, 0))::bigint AS available_minor
         FROM role_room_affiliate_commissions commission
         JOIN role_room_affiliate_referrals referral
           ON referral.id = commission.affiliate_referral_id
         LEFT JOIN adjustments ON adjustments.commission_id = commission.id
         LEFT JOIN allocated ON allocated.commission_id = commission.id
        WHERE referral.affiliate_partner_id = $1::uuid
          AND commission.currency = $2
          AND commission.matures_at <= $3
        ORDER BY commission.matures_at, commission.created_at, commission.id
        FOR UPDATE OF commission`,
      [partner.id, partner.payout_currency, asOf],
    );
    const availableMinorBigInt = commissionResult.rows.reduce(
      (sum, commission) => sum + BigInt(commission.available_minor),
      BigInt(0),
    );
    if (
      availableMinorBigInt > BigInt(Number.MAX_SAFE_INTEGER) ||
      availableMinorBigInt < BigInt(Number.MIN_SAFE_INTEGER)
    ) {
      throw new Error("affiliate_payout_amount_outside_safe_integer_range");
    }
    const availableMinor = Number(availableMinorBigInt);
    const minimumPayoutMinor = safeMinorAmount(
      partner.minimum_payout_minor,
      "affiliate_minimum_payout",
    );
    if (availableMinor <= 0 || availableMinor < minimumPayoutMinor) {
      await client.query("ROLLBACK");
      return { payout: null, reason: "below_minimum" };
    }
    const payoutId = randomUUID();
    const idempotencyKey = `rr-affiliate-payout:${payoutId}`;
    const payoutResult = await client.query<PayoutRow>(
      `INSERT INTO role_room_affiliate_payouts (
         id, affiliate_partner_id, stripe_connect_account_id, currency,
         amount_minor, minimum_payout_minor, batch_period, status,
         idempotency_key, initiated_by
       ) VALUES ($1::uuid, $2::uuid, $3, $4, $5::bigint, $6::bigint,
                 $7::date, 'pending', $8, $9)
       RETURNING *`,
      [
        payoutId,
        partner.id,
        partner.stripe_connect_account_id,
        partner.payout_currency,
        availableMinor,
        minimumPayoutMinor,
        batchPeriod,
        idempotencyKey,
        initiatedBy,
      ],
    );
    let remaining = availableMinor;
    for (const commission of commissionResult.rows) {
      const positiveAvailability = Math.max(
        0,
        safeMinorAmount(
          commission.available_minor,
          "affiliate_commission_available",
        ),
      );
      const allocation = Math.min(positiveAvailability, remaining);
      if (allocation <= 0) continue;
      await client.query(
        `INSERT INTO role_room_affiliate_payout_items (
           payout_id, commission_id, amount_minor, status
         ) VALUES ($1::uuid, $2::uuid, $3::bigint, 'reserved')`,
        [payoutId, commission.id, allocation],
      );
      await client.query(
        `UPDATE role_room_affiliate_commissions
            SET status = CASE WHEN status = 'accrued' THEN 'approved' ELSE status END,
                approved_at = COALESCE(approved_at, NOW()), updated_at = NOW()
          WHERE id = $1::uuid`,
        [commission.id],
      );
      remaining -= allocation;
      if (remaining === 0) break;
    }
    if (remaining !== 0)
      throw new Error("affiliate_payout_allocation_mismatch");
    await client.query("COMMIT");
    return { payout: payoutResult.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function validateReservedPayout(
  pool: Pool,
  payout: PayoutRow,
): Promise<boolean> {
  const result = await pool.query<{
    commission_id: string;
    amount_minor: string;
    available_before_payout_minor: string;
  }>(
    `WITH adjustments AS (
       SELECT commission_id, SUM(amount_minor)::bigint AS amount_minor
         FROM role_room_affiliate_commission_adjustments
        GROUP BY commission_id
     ), other_allocations AS (
       SELECT item.commission_id,
              SUM(item.amount_minor - item.reversed_amount_minor)::bigint AS amount_minor
         FROM role_room_affiliate_payout_items item
        WHERE item.payout_id <> $1::uuid
          AND item.status IN ('reserved', 'transferred', 'reversed')
        GROUP BY item.commission_id
     )
     SELECT item.commission_id, item.amount_minor,
            (commission.commission_amount_minor
              + COALESCE(adjustments.amount_minor, 0)
              - COALESCE(other_allocations.amount_minor, 0))::bigint AS available_before_payout_minor
       FROM role_room_affiliate_payout_items item
       JOIN role_room_affiliate_commissions commission ON commission.id = item.commission_id
       LEFT JOIN adjustments ON adjustments.commission_id = commission.id
       LEFT JOIN other_allocations ON other_allocations.commission_id = commission.id
      WHERE item.payout_id = $1::uuid AND item.status = 'reserved'`,
    [payout.id],
  );
  const valid =
    result.rows.length > 0 &&
    result.rows.every(
      (item) =>
        safeMinorAmount(
          item.available_before_payout_minor,
          "affiliate_preflight_available",
        ) >= safeMinorAmount(item.amount_minor, "affiliate_preflight_item"),
    );
  if (valid) return true;
  await pool.query(
    `UPDATE role_room_affiliate_payouts
        SET status = 'failed', last_error = 'ledger_changed_before_transfer', updated_at = NOW()
      WHERE id = $1::uuid AND stripe_transfer_id IS NULL`,
    [payout.id],
  );
  const released = await pool.query<{ commission_id: string }>(
    `UPDATE role_room_affiliate_payout_items
        SET status = 'released', updated_at = NOW()
      WHERE payout_id = $1::uuid AND status = 'reserved'
      RETURNING commission_id`,
    [payout.id],
  );
  for (const item of released.rows)
    await reconcileCommissionStatus(pool, item.commission_id);
  return false;
}

async function sendPayoutTransfer(
  pool: Pool,
  stripe: Stripe,
  payout: PayoutRow,
): Promise<{ status: string; transferId?: string; error?: string }> {
  if (
    payout.status === "transferred" ||
    payout.status === "reversed" ||
    payout.status === "failed"
  ) {
    return {
      status: payout.status,
      transferId: payout.stripe_transfer_id || undefined,
    };
  }
  await pool.query(
    `UPDATE role_room_affiliate_payouts
        SET status = 'processing', processing_at = NOW(),
            attempt_count = attempt_count + 1, last_error = NULL, updated_at = NOW()
      WHERE id = $1::uuid`,
    [payout.id],
  );
  try {
    let transfer: Stripe.Transfer | undefined;
    if (payout.stripe_transfer_id) {
      transfer = await stripe.transfers.retrieve(payout.stripe_transfer_id);
    } else {
      const transferGroup = `role-room-affiliate:${payout.id}`;
      const existing = await stripe.transfers.list({
        transfer_group: transferGroup,
        limit: 10,
      });
      transfer = existing.data.find(
        (candidate) =>
          candidate.metadata?.role_room_affiliate_payout_id === payout.id,
      );
      if (!transfer) {
        if (!(await validateReservedPayout(pool, payout))) {
          return { status: "failed", error: "ledger_changed_before_transfer" };
        }
        transfer = await stripe.transfers.create(
          {
            amount: safeMinorAmount(payout.amount_minor, "affiliate_payout"),
            currency: payout.currency,
            destination: payout.stripe_connect_account_id,
            transfer_group: transferGroup,
            description: `The Role Room affiliate ${String(payout.batch_period).slice(0, 10)}`,
            metadata: {
              role_room_affiliate_payout_id: payout.id,
              role_room_affiliate_partner_id: payout.affiliate_partner_id,
            },
          },
          { idempotencyKey: payout.idempotency_key },
        );
      }
    }
    await applyTransferState(pool, transfer);
    return {
      status: transfer.reversed ? "reversed" : "transferred",
      transferId: transfer.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool
      .query(
        `UPDATE role_room_affiliate_payouts
          SET status = 'pending', last_error = $2, updated_at = NOW()
        WHERE id = $1::uuid`,
        [payout.id, message.slice(0, 1000)],
      )
      .catch(() => undefined);
    return { status: "pending", error: message };
  }
}

export async function runRoleRoomAffiliatePayoutBatch(
  pool: Pool,
  stripe: Stripe,
  input: { partnerId?: string; asOf?: Date; initiatedBy: string },
) {
  const asOf = input.asOf ?? new Date();
  const partners = await pool.query<{ id: string }>(
    `SELECT id FROM role_room_affiliate_partners
      WHERE status = 'active'
        AND ($1::uuid IS NULL OR id = $1::uuid)
      ORDER BY created_at, id`,
    [input.partnerId || null],
  );
  const results: Array<Record<string, unknown>> = [];
  for (const partner of partners.rows) {
    const batch = await createMonthlyPayoutBatch(
      pool,
      partner.id,
      asOf,
      input.initiatedBy,
    );
    if (!batch.payout) {
      results.push({
        partnerId: partner.id,
        status: "skipped",
        reason: batch.reason,
      });
      continue;
    }
    const transfer = await sendPayoutTransfer(pool, stripe, batch.payout);
    results.push({
      partnerId: partner.id,
      payoutId: batch.payout.id,
      amountMinor: safeMinorAmount(
        batch.payout.amount_minor,
        "affiliate_payout",
      ),
      currency: batch.payout.currency,
      ...transfer,
    });
  }
  return {
    batchPeriod: monthStartUtc(asOf),
    processedPartners: partners.rows.length,
    results,
  };
}

export function registerRoleRoomAffiliatePayoutRoutes({
  app,
  pool,
  activeSessions,
  stripe,
  requireAdminSession,
}: AffiliatePayoutDeps): void {
  app.get(
    "/api/role-room/storage/affiliate/connect/status",
    async (req, res) => {
      const session = getSession(req, activeSessions);
      if (!session) return res.status(401).json({ error: "krever_innlogging" });
      const parsed = z.string().uuid().safeParse(req.query.organizationId);
      if (!parsed.success)
        return res.status(400).json({ error: "ugyldig_organization_id" });
      try {
        const access = await readRoleRoomOrganizationAccess(
          pool,
          parsed.data,
          session.userId,
        );
        if (!access)
          return res.status(403).json({ error: "ingen_organisasjonstilgang" });
        if (!access.canAdminister)
          return res.status(403).json({ error: "kun_organisasjonsadmin" });
        let partner = await readConnectPartnerByOrganization(pool, parsed.data);
        if (!partner)
          return res
            .status(404)
            .json({ error: "affiliate_partner_ikke_funnet" });
        if (stripe && partner.stripe_connect_account_id) {
          const account = await stripe.accounts.retrieve(
            partner.stripe_connect_account_id,
          );
          await syncConnectAccount(pool, account);
          partner = await readConnectPartnerByOrganization(pool, parsed.data);
        }
        const balance = await readAffiliateBalance(pool, partner!.id);
        return res.json({
          partner: {
            id: partner!.id,
            organizationId: partner!.organization_id,
            referralCode: partner!.referral_code,
            status: partner!.status,
            minimumPayoutMinor: Number(partner!.minimum_payout_minor),
            payoutCurrency: partner!.payout_currency,
          },
          connect: {
            accountId: partner!.stripe_connect_account_id,
            onboardingStatus: partner!.stripe_connect_onboarding_status,
            detailsSubmitted: partner!.stripe_connect_details_submitted,
            payoutsEnabled: partner!.stripe_connect_payouts_enabled,
            transfersStatus: partner!.stripe_connect_transfers_status,
            requirements: partner!.stripe_connect_requirements,
          },
          balance,
        });
      } catch (error) {
        console.error("[role-room-affiliate] connect status failed", error);
        return res
          .status(503)
          .json({ error: "affiliate_payout_schema_unavailable" });
      }
    },
  );

  app.post(
    "/api/role-room/storage/affiliate/connect/onboarding",
    async (req, res) => {
      const session = getSession(req, activeSessions);
      if (!session) return res.status(401).json({ error: "krever_innlogging" });
      const parsed = organizationSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: "ugyldig_organization_id" });
      if (!stripe)
        return res.status(503).json({ error: "stripe_ikke_konfigurert" });
      try {
        const access = await readRoleRoomOrganizationAccess(
          pool,
          parsed.data.organizationId,
          session.userId,
        );
        if (!access)
          return res.status(403).json({ error: "ingen_organisasjonstilgang" });
        if (!access.canAdminister)
          return res.status(403).json({ error: "kun_organisasjonsadmin" });
        const partner = await readConnectPartnerByOrganization(
          pool,
          parsed.data.organizationId,
        );
        if (!partner || partner.status !== "active") {
          return res
            .status(404)
            .json({ error: "aktiv_affiliate_partner_ikke_funnet" });
        }
        let accountId = partner.stripe_connect_account_id;
        if (!accountId) {
          const account =
            (await findConnectAccountByPartnerMetadata(stripe, partner.id)) ??
            (await stripe.accounts.create(
              {
                type: "express",
                country: partner.stripe_connect_country || "NO",
                default_currency: partner.payout_currency,
                email:
                  partner.billing_email ||
                  partner.contact_email ||
                  session.email ||
                  undefined,
                business_type: "company",
                business_profile: {
                  name: partner.organization_name,
                  product_description:
                    "Affiliate marketing services for The Role Room",
                },
                capabilities: { transfers: { requested: true } },
                metadata: {
                  role_room_affiliate_partner_id: partner.id,
                  role_room_organization_id: partner.organization_id,
                },
              },
              { idempotencyKey: `rr-affiliate-account:${partner.id}` },
            ));
          accountId = account.id;
          await syncConnectAccount(pool, account);
        }
        const origin = publicOrigin();
        const accountLink = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: `${origin}/role-room?affiliate_connect=refresh&organizationId=${encodeURIComponent(partner.organization_id)}`,
          return_url: `${origin}/role-room?affiliate_connect=return&organizationId=${encodeURIComponent(partner.organization_id)}`,
          type: "account_onboarding",
          collection_options: {
            fields: "eventually_due",
            future_requirements: "include",
          },
        });
        return res.json({
          onboardingUrl: accountLink.url,
          expiresAt: new Date(accountLink.expires_at * 1000).toISOString(),
          accountId,
        });
      } catch (error) {
        console.error("[role-room-affiliate] onboarding failed", error);
        return res
          .status(502)
          .json({ error: "stripe_connect_onboarding_failed" });
      }
    },
  );

  app.post("/api/admin/role-room/affiliates/partners", async (req, res) => {
    const admin = requireAdminSession(req, res);
    if (!admin) return;
    const parsed = createPartnerSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "ugyldig_foresporsel" });
    try {
      const input = parsed.data;
      const result = await pool.query(
        `INSERT INTO role_room_affiliate_partners (
           organization_id, referral_code, commission_basis_points,
           storage_commission_basis_points, commission_months,
           minimum_payout_minor, status
         ) VALUES ($1::uuid, $2, $3, $4, $5, $6::bigint, 'active')
         RETURNING id, organization_id, referral_code, commission_basis_points,
                   storage_commission_basis_points, commission_months,
                   minimum_payout_minor, status`,
        [
          input.organizationId,
          input.referralCode,
          input.commissionBasisPoints,
          input.storageCommissionBasisPoints,
          input.commissionMonths,
          input.minimumPayoutMinor,
        ],
      );
      return res.status(201).json({ partner: result.rows[0] });
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code || "")
          : "";
      if (code === "23505")
        return res
          .status(409)
          .json({ error: "affiliate_partner_eller_kode_finnes" });
      if (code === "23503")
        return res.status(404).json({ error: "organisasjon_ikke_funnet" });
      console.error("[role-room-affiliate] partner create failed", error);
      return res
        .status(503)
        .json({ error: "affiliate_payout_schema_unavailable" });
    }
  });

  const runBatch = async (initiatedBy: string, partnerId?: string) => {
    if (!payoutsEnabled()) return { disabled: true as const };
    if (!stripe) return { stripeMissing: true as const };
    return runRoleRoomAffiliatePayoutBatch(pool, stripe, {
      partnerId,
      initiatedBy,
    });
  };

  app.post("/api/admin/role-room/affiliates/payouts/run", async (req, res) => {
    const admin = requireAdminSession(req, res);
    if (!admin) return;
    const partnerId =
      req.body?.partnerId == null
        ? undefined
        : z.string().uuid().safeParse(req.body.partnerId);
    if (partnerId && !partnerId.success)
      return res.status(400).json({ error: "ugyldig_partner_id" });
    try {
      const result = await runBatch(`admin:${admin.userId}`, partnerId?.data);
      if ("disabled" in result)
        return res.status(409).json({ error: "affiliate_payouts_deaktivert" });
      if ("stripeMissing" in result)
        return res.status(503).json({ error: "stripe_ikke_konfigurert" });
      return res.json(result);
    } catch (error) {
      console.error("[role-room-affiliate] payout batch failed", error);
      return res.status(500).json({ error: "affiliate_payout_batch_failed" });
    }
  });

  app.post(
    "/api/internal/role-room/affiliate-payouts/run",
    async (req, res) => {
      const secret = process.env.ROLE_ROOM_AFFILIATE_PAYOUT_CRON_SECRET;
      if (!secret)
        return res
          .status(503)
          .json({ error: "affiliate_payout_cron_secret_mangler" });
      if (!secureEqual(req.headers["x-cron-secret"], secret)) {
        return res.status(401).json({ error: "unauthorized" });
      }
      try {
        const result = await runBatch("cron:monthly");
        if ("disabled" in result)
          return res
            .status(409)
            .json({ error: "affiliate_payouts_deaktivert" });
        if ("stripeMissing" in result)
          return res.status(503).json({ error: "stripe_ikke_konfigurert" });
        return res.json(result);
      } catch (error) {
        console.error("[role-room-affiliate] cron payout batch failed", error);
        return res.status(500).json({ error: "affiliate_payout_batch_failed" });
      }
    },
  );
}
