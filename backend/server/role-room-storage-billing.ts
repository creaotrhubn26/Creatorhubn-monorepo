import type { Express, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import Stripe from "stripe";
import { z } from "zod";

const PRODUCT_FAMILY = "role_room_storage";
const GIB = 1024 ** 3;
const DEFAULT_PUBLIC_ORIGIN = "https://theroleroom.com";
const DEFAULT_PAYMENT_GRACE_DAYS = 7;
const AFFILIATE_COMMISSION_HOLD_DAYS = 30;
const ADD_ON_PRICING_NOK_EX_VAT = {
  extra100Gib: 129,
  extra1Tib: 799,
} as const;

const checkoutSchema = z
  .object({
    organizationId: z.string().uuid(),
    addOns: z
      .object({
        extra100Gib: z.number().int().min(0).max(100).default(0),
        extra1Tib: z.number().int().min(0).max(20).default(0),
      })
      .strict(),
  })
  .strict()
  .refine((input) => input.addOns.extra100Gib + input.addOns.extra1Tib > 0, {
    message: "minst_ett_lagringstillegg_pakrevd",
    path: ["addOns"],
  });

const organizationSchema = z
  .object({ organizationId: z.string().uuid() })
  .strict();
const referralSchema = z
  .object({
    organizationId: z.string().uuid(),
    referralCode: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  stripe: Stripe | null;
}

function idFromExpandable(
  value: { id: string } | string | null | undefined,
): string | null {
  if (typeof value === "string") return value;
  return value?.id || null;
}

function invoicePaymentReferences(invoice: Stripe.Invoice): {
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
} {
  const payment =
    invoice.payments?.data.find((candidate) => candidate.status === "paid") ??
    invoice.payments?.data[0];
  if (!payment) return { stripePaymentIntentId: null, stripeChargeId: null };
  const paymentIntent = payment.payment.payment_intent;
  return {
    stripePaymentIntentId: idFromExpandable(paymentIntent),
    stripeChargeId:
      idFromExpandable(payment.payment.charge) ??
      (typeof paymentIntent === "object"
        ? idFromExpandable(paymentIntent.latest_charge)
        : null),
  };
}

function commissionMaturesAt(paidAt: Date): Date {
  return new Date(
    paidAt.getTime() + AFFILIATE_COMMISSION_HOLD_DAYS * 86_400_000,
  );
}

export interface OrganizationAccess {
  id: string;
  name: string;
  contactEmail: string | null;
  billingEmail: string | null;
  stripeCustomerId: string | null;
  plan: string;
  membershipRole: string | null;
  canAdminister: boolean;
}

export interface StorageAccountRow {
  id: string;
  organization_id: string;
  plan_key: string | null;
  base_quota_bytes: string;
  used_bytes: string;
  reserved_bytes: string;
  file_count: number;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  stripe_current_period_end: Date | null;
  stripe_cancel_at_period_end: boolean;
  billing_grace_until: Date | null;
  status: string;
}

export async function syncRoleRoomCommercialStorageEntitlement(
  pool: Pool,
  input: {
    organizationNumber: string;
    persona: "content_producer" | "production_team";
    active: boolean;
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
  },
): Promise<string[]> {
  const organizationNumber = input.organizationNumber.replace(/\D/g, "");
  if (!/^\d{9}$/.test(organizationNumber)) return [];
  const planKey = input.active
    ? input.persona === "production_team"
      ? "agency"
      : "solo_pro"
    : "solo_free";
  const result = await pool.query<{ id: string }>(
    `WITH matching_orgs AS MATERIALIZED (
       SELECT id
         FROM organizations
        WHERE REGEXP_REPLACE(COALESCE(org_number, ''), '\\D', '', 'g') = $1
        ORDER BY created_at ASC
        LIMIT 2
     ), selected_org AS (
       SELECT id
         FROM matching_orgs
        WHERE (SELECT COUNT(*) FROM matching_orgs) = 1
     ), selected_plan AS (
       SELECT plan_key, included_storage_bytes
         FROM plan_limits
        WHERE plan_key = $2
     ), updated_org AS (
       UPDATE organizations organization
          SET role_room_plan_key = selected_plan.plan_key,
              stripe_subscription_id = COALESCE($3, organization.stripe_subscription_id),
              stripe_customer_id = COALESCE($4, organization.stripe_customer_id),
              updated_at = NOW()
         FROM selected_org, selected_plan
        WHERE organization.id = selected_org.id
       RETURNING organization.id
     ), updated_storage AS (
       UPDATE role_room_storage_accounts account
          SET plan_key = selected_plan.plan_key,
              base_quota_bytes = selected_plan.included_storage_bytes,
              status = CASE
                WHEN account.status IN ('suspended', 'closed') THEN account.status
                WHEN account.used_bytes + account.reserved_bytes
                     <= selected_plan.included_storage_bytes + COALESCE((
                       SELECT SUM(grant_row.bonus_bytes)
                         FROM role_room_storage_grants grant_row
                        WHERE grant_row.storage_account_id = account.id
                          AND grant_row.status = 'active'
                          AND grant_row.starts_at <= NOW()
                          AND (grant_row.ends_at IS NULL OR grant_row.ends_at > NOW())
                     ), 0)
                THEN 'active'
                ELSE 'read_only'
              END,
              updated_at = NOW()
         FROM updated_org, selected_plan
        WHERE account.organization_id = updated_org.id
       RETURNING account.organization_id
     )
     SELECT id FROM updated_org`,
    [
      organizationNumber,
      planKey,
      input.stripeSubscriptionId || null,
      input.stripeCustomerId || null,
    ],
  );
  return result.rows.map((row) => row.id);
}

export async function accrueRoleRoomCommercialAffiliateCommission(
  pool: Pool,
  input: {
    organizationNumber: string;
    stripeInvoiceId: string;
    currency: string;
    amountPaidMinor: number;
    subtotalExcludingTaxMinor?: number | null;
    paidAt?: Date;
    stripePaymentIntentId?: string | null;
    stripeChargeId?: string | null;
  },
): Promise<boolean> {
  const organizationNumber = input.organizationNumber.replace(/\D/g, "");
  if (!/^\d{9}$/.test(organizationNumber) || !input.stripeInvoiceId)
    return false;
  const organizations = await pool.query<{ id: string }>(
    `SELECT id
       FROM organizations
      WHERE REGEXP_REPLACE(COALESCE(org_number, ''), '\\D', '', 'g') = $1
      ORDER BY created_at ASC
      LIMIT 2`,
    [organizationNumber],
  );
  if (organizations.rows.length !== 1) return false;
  const organizationId = organizations.rows[0].id;
  const referralResult = await pool.query<{
    id: string;
    commission_basis_points: number;
    commission_months: number;
    referred_org_bonus_bytes: string;
    referred_org_bonus_months: number;
    commission_ends_at: Date | null;
  }>(
    `SELECT r.id, p.commission_basis_points, p.commission_months,
            p.referred_org_bonus_bytes, p.referred_org_bonus_months,
            r.commission_ends_at
       FROM role_room_affiliate_referrals r
       JOIN role_room_affiliate_partners p ON p.id = r.affiliate_partner_id
      WHERE r.referred_organization_id = $1::uuid
        AND p.status = 'active'
        AND r.status IN ('attributed', 'qualified', 'paying')
      LIMIT 1`,
    [organizationId],
  );
  const referral = referralResult.rows[0];
  if (!referral) return false;

  const paidAt = input.paidAt ?? new Date();
  const commissionEndsAt =
    referral.commission_ends_at ??
    new Date(
      paidAt.getTime() + referral.commission_months * 30.4375 * 86_400_000,
    );
  const bonusEndsAt = new Date(
    paidAt.getTime() +
      referral.referred_org_bonus_months * 30.4375 * 86_400_000,
  );
  await pool.query(
    `UPDATE role_room_affiliate_referrals
        SET status = 'paying', qualified_at = COALESCE(qualified_at, $2),
            commission_ends_at = COALESCE(commission_ends_at, $3), updated_at = NOW()
      WHERE id = $1::uuid`,
    [referral.id, paidAt, commissionEndsAt],
  );

  const storageAccount = await pool.query<{ id: string }>(
    `INSERT INTO role_room_storage_accounts (
       organization_id, billing_organization_id, plan_key, base_quota_bytes
     )
     SELECT organization.id, organization.id, plan.plan_key, plan.included_storage_bytes
       FROM organizations organization
       JOIN plan_limits plan
         ON plan.plan_key = COALESCE(organization.role_room_plan_key, 'solo_free')
      WHERE organization.id = $1::uuid
     ON CONFLICT (organization_id) WHERE organization_id IS NOT NULL
     DO UPDATE SET billing_organization_id = EXCLUDED.billing_organization_id,
                   plan_key = EXCLUDED.plan_key,
                   base_quota_bytes = EXCLUDED.base_quota_bytes,
                   updated_at = NOW()
     RETURNING id`,
    [organizationId],
  );
  const storageAccountId = storageAccount.rows[0]?.id;
  if (!storageAccountId) throw new Error("affiliate_storage_account_missing");
  if (Number(referral.referred_org_bonus_bytes) > 0) {
    await pool.query(
      `INSERT INTO role_room_storage_grants (
         storage_account_id, source_type, source_ref, bonus_bytes,
         starts_at, ends_at, status, metadata
       ) VALUES ($1::uuid, 'affiliate', $2, $3::bigint, $4, $5, 'active', $6::jsonb)
       ON CONFLICT (storage_account_id, source_type, source_ref) DO NOTHING`,
      [
        storageAccountId,
        `affiliate-referral:${referral.id}`,
        referral.referred_org_bonus_bytes,
        paidAt,
        bonusEndsAt,
        JSON.stringify({ referralId: referral.id }),
      ],
    );
  }
  if (commissionEndsAt.getTime() <= paidAt.getTime()) return false;

  const amountPaid = Math.max(0, Math.trunc(input.amountPaidMinor));
  const subtotal =
    input.subtotalExcludingTaxMinor == null
      ? amountPaid
      : Math.max(0, Math.trunc(input.subtotalExcludingTaxMinor));
  const eligibleRevenue = Math.min(amountPaid, subtotal);
  const commissionAmount = Math.round(
    (eligibleRevenue * referral.commission_basis_points) / 10_000,
  );
  await pool.query(
    `INSERT INTO role_room_affiliate_commissions (
       affiliate_referral_id, stripe_invoice_id, currency,
       eligible_revenue_minor, commission_basis_points,
       commission_amount_minor, source_payment_amount_minor, status, stripe_payment_intent_id,
       stripe_charge_id, matures_at, metadata
     ) VALUES ($1::uuid, $2, $3, $4::bigint, $5, $6::bigint, $7::bigint, 'accrued',
               $8, $9, $10, $11::jsonb)
     ON CONFLICT (affiliate_referral_id, stripe_invoice_id) DO NOTHING`,
    [
      referral.id,
      input.stripeInvoiceId,
      input.currency.toLowerCase(),
      eligibleRevenue,
      referral.commission_basis_points,
      commissionAmount,
      amountPaid,
      input.stripePaymentIntentId || null,
      input.stripeChargeId || null,
      commissionMaturesAt(paidAt),
      JSON.stringify({
        organizationId,
        productFamily: "role_room_commercial",
        commissionScope: "core_subscription",
      }),
    ],
  );
  return true;
}

function getSession(
  req: Request,
  sessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return sessions.get(auth.slice(7).trim()) ?? null;
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
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
    if (parsed.protocol !== "https:" && !localDevelopment)
      return DEFAULT_PUBLIC_ORIGIN;
    return parsed.origin;
  } catch {
    return DEFAULT_PUBLIC_ORIGIN;
  }
}

function paymentGraceDays(): number {
  const parsed = Number(process.env.ROLE_ROOM_STORAGE_PAYMENT_GRACE_DAYS);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 30
    ? parsed
    : DEFAULT_PAYMENT_GRACE_DAYS;
}

function billingPortalConfigurationId(): string | null {
  return (
    process.env.ROLE_ROOM_STORAGE_BILLING_PORTAL_CONFIGURATION_ID?.trim() ||
    null
  );
}

function oneTibCheckoutEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test(
    process.env.ROLE_ROOM_STORAGE_1_TIB_CHECKOUT_ENABLED?.trim() || "",
  );
}

interface PriceCatalog {
  addOns: {
    extra100Gib: { priceId: string | null; bytesPerUnit: number };
    extra1Tib: { priceId: string | null; bytesPerUnit: number };
  };
}

export function readRoleRoomStoragePriceCatalog(): PriceCatalog {
  const env = (key: string) => process.env[key]?.trim() || null;
  return {
    addOns: {
      extra100Gib: {
        priceId: env("ROLE_ROOM_STORAGE_PRICE_EXTRA_100_GIB_MONTHLY"),
        bytesPerUnit: 100 * GIB,
      },
      extra1Tib: {
        priceId: env("ROLE_ROOM_STORAGE_PRICE_EXTRA_1_TIB_MONTHLY"),
        bytesPerUnit: 1024 * GIB,
      },
    },
  };
}

export async function readRoleRoomOrganizationAccess(
  pool: Pool,
  organizationId: string,
  userId: string,
): Promise<OrganizationAccess | null> {
  const result = await pool.query<{
    id: string;
    name: string;
    contact_email: string | null;
    billing_email: string | null;
    stripe_customer_id: string | null;
    plan: string;
    owner_user_id: string | null;
    membership_role: string | null;
    platform_role: string | null;
  }>(
    `SELECT o.id, o.name, o.contact_email, o.billing_email,
            o.stripe_customer_id,
            COALESCE(o.role_room_plan_key, 'solo_free') AS plan,
            o.owner_user_id,
            om.role AS membership_role, u.role AS platform_role
       FROM organizations o
       JOIN users u ON u.id = $2
       LEFT JOIN organization_members om
         ON om.organization_id = o.id AND om.user_id = $2
      WHERE o.id = $1::uuid`,
    [organizationId, userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const superAdmin = row.platform_role === "super_admin";
  const owner = row.owner_user_id === userId;
  if (!superAdmin && !owner && !row.membership_role) return null;
  return {
    id: row.id,
    name: row.name,
    contactEmail: row.contact_email,
    billingEmail: row.billing_email,
    stripeCustomerId: row.stripe_customer_id,
    plan: row.plan,
    membershipRole: row.membership_role,
    canAdminister: superAdmin || owner || row.membership_role === "admin",
  };
}

export async function ensureRoleRoomOrganizationStorageAccount(
  pool: Pool,
  organization: OrganizationAccess,
): Promise<StorageAccountRow> {
  const result = await pool.query<StorageAccountRow>(
    `WITH selected_plan AS (
       SELECT plan_key, included_storage_bytes
         FROM plan_limits
        WHERE plan_key = CASE
          WHEN $2 IN ('solo_free', 'solo_pro', 'agency', 'enterprise') THEN $2
          ELSE 'solo_free'
        END
        LIMIT 1
     )
     INSERT INTO role_room_storage_accounts (
       organization_id, billing_organization_id, plan_key, base_quota_bytes
     )
     SELECT $1::uuid, $1::uuid, selected_plan.plan_key,
            selected_plan.included_storage_bytes
       FROM selected_plan
     ON CONFLICT (organization_id) WHERE organization_id IS NOT NULL
     DO UPDATE SET billing_organization_id = EXCLUDED.billing_organization_id,
                   plan_key = EXCLUDED.plan_key,
                   base_quota_bytes = EXCLUDED.base_quota_bytes,
                   status = CASE
                     WHEN role_room_storage_accounts.status = 'read_only'
                      AND role_room_storage_accounts.used_bytes
                          + role_room_storage_accounts.reserved_bytes
                          <= EXCLUDED.base_quota_bytes
                     THEN 'active'
                     ELSE role_room_storage_accounts.status
                   END,
                   updated_at = NOW()
     RETURNING id, organization_id, plan_key, base_quota_bytes,
               used_bytes, reserved_bytes, file_count, stripe_subscription_id,
               stripe_subscription_status, stripe_current_period_end,
               stripe_cancel_at_period_end, billing_grace_until, status`,
    [organization.id, organization.plan],
  );
  if (!result.rows[0]) {
    throw new Error("storage_plan_missing");
  }
  return result.rows[0];
}

async function expirePaymentGrace(
  pool: Pool,
  storageAccountId: string,
): Promise<void> {
  await pool.query(
    `UPDATE role_room_storage_grants grant_row
        SET status = 'revoked', updated_at = NOW()
       FROM role_room_storage_accounts account
      WHERE grant_row.storage_account_id = account.id
        AND account.id = $1::uuid
        AND grant_row.source_type = 'plan'
        AND grant_row.source_ref IN (
          'stripe-addon-extra-100-gib',
          'stripe-addon-extra-1-tib'
        )
        AND grant_row.status = 'active'
        AND account.stripe_subscription_status IN ('past_due', 'unpaid', 'paused')
        AND account.billing_grace_until IS NOT NULL
        AND account.billing_grace_until <= NOW()`,
    [storageAccountId],
  );
  await pool.query(
    `UPDATE role_room_storage_accounts
        SET status = CASE
              WHEN used_bytes + reserved_bytes <= base_quota_bytes THEN 'active'
              ELSE 'read_only'
            END,
            updated_at = NOW()
      WHERE id = $1::uuid
        AND stripe_subscription_status IN ('past_due', 'unpaid', 'paused')
        AND billing_grace_until IS NOT NULL
        AND billing_grace_until <= NOW()
        AND status IN ('active', 'read_only')`,
    [storageAccountId],
  );
}

export async function readRoleRoomStorageContext(
  pool: Pool,
  storageAccountId: string,
) {
  await expirePaymentGrace(pool, storageAccountId);
  const result = await pool.query<{
    id: string;
    organization_id: string;
    plan_key: string | null;
    base_quota_bytes: string;
    active_bonus_bytes: string;
    effective_quota_bytes: string;
    used_bytes: string;
    reserved_bytes: string;
    file_count: number;
    status: string;
    stripe_subscription_id: string | null;
    stripe_subscription_status: string | null;
    stripe_current_period_end: Date | null;
    stripe_cancel_at_period_end: boolean;
    billing_grace_until: Date | null;
  }>(
    `SELECT a.id, a.organization_id, a.plan_key,
            q.base_quota_bytes, q.active_bonus_bytes, q.effective_quota_bytes,
            q.used_bytes, q.reserved_bytes, q.file_count, q.status,
            a.stripe_subscription_id, a.stripe_subscription_status,
            a.stripe_current_period_end, a.stripe_cancel_at_period_end,
            a.billing_grace_until
       FROM role_room_storage_accounts a
       JOIN role_room_storage_effective_quota q ON q.storage_account_id = a.id
      WHERE a.id = $1::uuid`,
    [storageAccountId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("storage_account_missing");
  const usedBytes = Number(row.used_bytes);
  const quotaBytes = Number(row.effective_quota_bytes);
  return {
    storageAccountId: row.id,
    organizationId: row.organization_id,
    ownerType: "organization" as const,
    planKey: row.plan_key,
    baseQuotaBytes: Number(row.base_quota_bytes),
    bonusQuotaBytes: Number(row.active_bonus_bytes),
    quotaBytes,
    usedBytes,
    reservedBytes: Number(row.reserved_bytes),
    availableBytes: Math.max(
      0,
      quotaBytes - usedBytes - Number(row.reserved_bytes),
    ),
    fileCount: row.file_count,
    percentageUsed:
      quotaBytes > 0
        ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100))
        : 0,
    status: row.status,
    billing: {
      subscriptionId: row.stripe_subscription_id,
      subscriptionStatus: row.stripe_subscription_status,
      currentPeriodEnd: row.stripe_current_period_end?.toISOString() ?? null,
      cancelAtPeriodEnd: row.stripe_cancel_at_period_end,
      graceUntil: row.billing_grace_until?.toISOString() ?? null,
    },
  };
}

async function ensureStripeCustomer(
  pool: Pool,
  stripe: Stripe,
  organization: OrganizationAccess,
  session: SessionData,
): Promise<string> {
  if (organization.stripeCustomerId) return organization.stripeCustomerId;
  const customer = await stripe.customers.create(
    {
      name: organization.name,
      email:
        organization.billingEmail ||
        organization.contactEmail ||
        session.email ||
        undefined,
      metadata: {
        organization_id: organization.id,
        created_for: PRODUCT_FAMILY,
      },
    },
    { idempotencyKey: `rr-storage-customer:${organization.id}` },
  );
  const update = await pool.query<{ stripe_customer_id: string }>(
    `UPDATE organizations
        SET stripe_customer_id = COALESCE(stripe_customer_id, $1),
            updated_at = NOW()
      WHERE id = $2::uuid
      RETURNING stripe_customer_id`,
    [customer.id, organization.id],
  );
  return update.rows[0]?.stripe_customer_id || customer.id;
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const ends = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => Number.isFinite(value));
  const unix = ends.length > 0 ? Math.max(...ends) : subscription.cancel_at;
  return unix ? new Date(unix * 1000) : null;
}

async function syncSubscription(
  pool: Pool,
  subscription: Stripe.Subscription,
): Promise<string> {
  const organizationId = subscription.metadata.organization_id;
  if (!organizationId || !z.string().uuid().safeParse(organizationId).success) {
    throw new Error("storage_subscription_missing_organization_id");
  }
  const accountLookup = await pool.query<{
    id: string;
    billing_grace_until: Date | null;
    used_bytes: string;
    reserved_bytes: string;
    base_quota_bytes: string;
  }>(
    `SELECT id, billing_grace_until, used_bytes, reserved_bytes, base_quota_bytes
       FROM role_room_storage_accounts
      WHERE organization_id = $1::uuid`,
    [organizationId],
  );
  if (!accountLookup.rows[0])
    throw new Error("storage_account_not_provisioned");
  const account = accountLookup.rows[0];
  const catalog = readRoleRoomStoragePriceCatalog();
  const configuredAddOnPriceIds = new Set(
    [
      catalog.addOns.extra100Gib.priceId,
      catalog.addOns.extra1Tib.priceId,
    ].filter((priceId): priceId is string => Boolean(priceId)),
  );
  const hasKnownAddOn = subscription.items.data.some((item) =>
    configuredAddOnPriceIds.has(item.price.id),
  );
  if (!hasKnownAddOn)
    throw new Error("storage_subscription_unknown_addon_price");

  const delinquent =
    subscription.status === "past_due" ||
    subscription.status === "unpaid" ||
    subscription.status === "paused";
  const existingGrace = account.billing_grace_until;
  const graceUntil = delinquent
    ? (existingGrace ?? new Date(Date.now() + paymentGraceDays() * 86_400_000))
    : null;
  const addOnEntitlementsActive =
    subscription.status === "active" ||
    subscription.status === "trialing" ||
    (delinquent && Boolean(graceUntil && graceUntil.getTime() > Date.now()));
  const withinBaseQuota =
    Number(account.used_bytes) + Number(account.reserved_bytes) <=
    Number(account.base_quota_bytes);
  const accountStatus =
    addOnEntitlementsActive || withinBaseQuota
      ? ("active" as const)
      : ("read_only" as const);

  await pool.query(
    `UPDATE role_room_storage_accounts
        SET stripe_subscription_id = $2,
            stripe_subscription_status = $3,
            stripe_base_price_id = NULL,
            stripe_storage_subscription_item_id = NULL,
            stripe_current_period_end = $4,
            stripe_cancel_at_period_end = $5,
            billing_grace_until = $6,
            status = $7,
            stripe_checkout_session_id = NULL,
            stripe_checkout_expires_at = NULL,
            checkout_lock_token = NULL,
            checkout_lock_until = NULL,
            updated_at = NOW()
      WHERE id = $1::uuid`,
    [
      account.id,
      subscription.id,
      subscription.status,
      subscriptionPeriodEnd(subscription),
      subscription.cancel_at_period_end,
      graceUntil,
      accountStatus,
    ],
  );

  const quantityFor = (priceId: string | null) => {
    if (!priceId) return 0;
    const item = subscription.items.data.find(
      (candidate) => candidate.price.id === priceId,
    );
    return item ? Math.max(0, item.quantity ?? 1) : 0;
  };
  const addOns = [
    {
      ref: "stripe-addon-extra-100-gib",
      bytes: catalog.addOns.extra100Gib.bytesPerUnit,
      quantity: quantityFor(catalog.addOns.extra100Gib.priceId),
    },
    {
      ref: "stripe-addon-extra-1-tib",
      bytes: catalog.addOns.extra1Tib.bytesPerUnit,
      quantity: quantityFor(catalog.addOns.extra1Tib.priceId),
    },
  ];
  for (const addOn of addOns) {
    const quantity = addOnEntitlementsActive ? addOn.quantity : 0;
    if (quantity > 0) {
      await pool.query(
        `INSERT INTO role_room_storage_grants (
           storage_account_id, source_type, source_ref, bonus_bytes, status, metadata
         ) VALUES ($1::uuid, 'plan', $2, $3::bigint, 'active', $4::jsonb)
         ON CONFLICT (storage_account_id, source_type, source_ref)
         DO UPDATE SET bonus_bytes = EXCLUDED.bonus_bytes,
                       status = 'active', metadata = EXCLUDED.metadata,
                       starts_at = LEAST(role_room_storage_grants.starts_at, NOW()),
                       ends_at = NULL, updated_at = NOW()`,
        [
          account.id,
          addOn.ref,
          addOn.bytes * quantity,
          JSON.stringify({ subscriptionId: subscription.id, quantity }),
        ],
      );
    } else {
      await pool.query(
        `UPDATE role_room_storage_grants
            SET status = 'revoked', updated_at = NOW()
          WHERE storage_account_id = $1::uuid
            AND source_type = 'plan' AND source_ref = $2
            AND status <> 'revoked'`,
        [account.id, addOn.ref],
      );
    }
  }
  return account.id;
}

async function accrueAffiliateCommission(
  pool: Pool,
  organizationId: string,
  invoice: Stripe.Invoice,
  storageAccountId: string,
): Promise<void> {
  const referralResult = await pool.query<{
    id: string;
    storage_commission_basis_points: number;
    commission_months: number;
    referred_org_bonus_bytes: string;
    referred_org_bonus_months: number;
    commission_ends_at: Date | null;
  }>(
    `SELECT r.id, p.storage_commission_basis_points, p.commission_months,
            p.referred_org_bonus_bytes, p.referred_org_bonus_months,
            r.commission_ends_at
       FROM role_room_affiliate_referrals r
       JOIN role_room_affiliate_partners p ON p.id = r.affiliate_partner_id
      WHERE r.referred_organization_id = $1::uuid
        AND p.status = 'active'
        AND r.status IN ('attributed', 'qualified', 'paying')
      LIMIT 1`,
    [organizationId],
  );
  const referral = referralResult.rows[0];
  if (!referral) return;

  const firstPaidAt = new Date();
  const commissionEndsAt =
    referral.commission_ends_at ??
    new Date(
      firstPaidAt.getTime() + referral.commission_months * 30.4375 * 86_400_000,
    );
  const bonusEndsAt = new Date(
    firstPaidAt.getTime() +
      referral.referred_org_bonus_months * 30.4375 * 86_400_000,
  );
  await pool.query(
    `UPDATE role_room_affiliate_referrals
        SET status = 'paying', qualified_at = COALESCE(qualified_at, NOW()),
            commission_ends_at = COALESCE(commission_ends_at, $2), updated_at = NOW()
      WHERE id = $1::uuid`,
    [referral.id, commissionEndsAt],
  );
  if (Number(referral.referred_org_bonus_bytes) > 0) {
    await pool.query(
      `INSERT INTO role_room_storage_grants (
         storage_account_id, source_type, source_ref, bonus_bytes,
         starts_at, ends_at, status, metadata
       ) VALUES ($1::uuid, 'affiliate', $2, $3::bigint, NOW(), $4, 'active', $5::jsonb)
       ON CONFLICT (storage_account_id, source_type, source_ref) DO NOTHING`,
      [
        storageAccountId,
        `affiliate-referral:${referral.id}`,
        referral.referred_org_bonus_bytes,
        bonusEndsAt,
        JSON.stringify({ referralId: referral.id }),
      ],
    );
  }
  if (commissionEndsAt.getTime() <= Date.now()) return;
  const subtotal = invoice.subtotal_excluding_tax ?? invoice.amount_paid;
  const eligibleRevenue = Math.max(0, Math.min(invoice.amount_paid, subtotal));
  const commissionAmount = Math.round(
    (eligibleRevenue * referral.storage_commission_basis_points) / 10_000,
  );
  const paymentReferences = invoicePaymentReferences(invoice);
  await pool.query(
    `INSERT INTO role_room_affiliate_commissions (
       affiliate_referral_id, stripe_invoice_id, currency,
       eligible_revenue_minor, commission_basis_points,
       commission_amount_minor, source_payment_amount_minor, status, stripe_payment_intent_id,
       stripe_charge_id, matures_at, metadata
     ) VALUES ($1::uuid, $2, $3, $4::bigint, $5, $6::bigint, $7::bigint, 'accrued',
               $8, $9, $10, $11::jsonb)
     ON CONFLICT (affiliate_referral_id, stripe_invoice_id) DO NOTHING`,
    [
      referral.id,
      invoice.id,
      invoice.currency.toLowerCase(),
      eligibleRevenue,
      referral.storage_commission_basis_points,
      commissionAmount,
      invoice.amount_paid,
      paymentReferences.stripePaymentIntentId,
      paymentReferences.stripeChargeId,
      commissionMaturesAt(firstPaidAt),
      JSON.stringify({
        storageAccountId,
        productFamily: PRODUCT_FAMILY,
        commissionScope: "storage_addons",
      }),
    ],
  );
}

async function eventMatchesStorage(
  pool: Pool,
  event: Stripe.Event,
): Promise<boolean> {
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    return event.data.object.metadata?.product_family === PRODUCT_FAMILY;
  }
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    return event.data.object.metadata.product_family === PRODUCT_FAMILY;
  }
  if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_failed"
  ) {
    const invoice = event.data.object;
    if (
      invoice.parent?.subscription_details?.metadata?.product_family ===
      PRODUCT_FAMILY
    )
      return true;
    const subscriptionId = subscriptionIdFromInvoice(invoice);
    if (!subscriptionId) return false;
    const result = await pool.query(
      `SELECT 1 FROM role_room_storage_accounts WHERE stripe_subscription_id = $1 LIMIT 1`,
      [subscriptionId],
    );
    return result.rows.length > 0;
  }
  return false;
}

async function claimWebhookEvent(
  pool: Pool,
  event: Stripe.Event,
): Promise<boolean> {
  const eventObject = event.data.object as unknown as { id?: unknown };
  const objectId = typeof eventObject.id === "string" ? eventObject.id : null;
  const result = await pool.query(
    `INSERT INTO role_room_stripe_webhook_events (
       stripe_event_id, event_type, status, object_id
     ) VALUES ($1, $2, 'processing', $3)
     ON CONFLICT (stripe_event_id) DO UPDATE
       SET status = 'processing', error_message = NULL, received_at = NOW()
       WHERE role_room_stripe_webhook_events.status = 'failed'
     RETURNING stripe_event_id`,
    [event.id, event.type, objectId],
  );
  return result.rows.length > 0;
}

export async function handleRoleRoomStorageStripeEvent(
  pool: Pool,
  stripe: Stripe,
  event: Stripe.Event,
): Promise<{ matched: boolean; duplicate?: boolean }> {
  if (!(await eventMatchesStorage(pool, event))) return { matched: false };
  if (!(await claimWebhookEvent(pool, event)))
    return { matched: true, duplicate: true };
  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (!subscriptionId)
        throw new Error("storage_checkout_missing_subscription");
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscription(pool, subscription);
      if (session.metadata?.organization_id) {
        await pool.query(
          `UPDATE role_room_affiliate_referrals
              SET stripe_checkout_session_id = $1, status = 'qualified',
                  qualified_at = COALESCE(qualified_at, NOW()), updated_at = NOW()
            WHERE referred_organization_id = $2::uuid
              AND status = 'attributed'`,
          [session.id, session.metadata.organization_id],
        );
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await syncSubscription(pool, event.data.object);
    } else if (event.type === "invoice.paid") {
      const eventInvoice = event.data.object;
      const invoice = eventInvoice.payments?.data.length
        ? eventInvoice
        : await stripe.invoices.retrieve(eventInvoice.id, {
            expand: ["payments.data.payment.payment_intent"],
          });
      const subscriptionId = subscriptionIdFromInvoice(invoice);
      if (!subscriptionId)
        throw new Error("storage_invoice_missing_subscription");
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const storageAccountId = await syncSubscription(pool, subscription);
      const organizationId = subscription.metadata.organization_id;
      if (organizationId) {
        await accrueAffiliateCommission(
          pool,
          organizationId,
          invoice,
          storageAccountId,
        );
      }
    } else if (event.type === "invoice.payment_failed") {
      const subscriptionId = subscriptionIdFromInvoice(event.data.object);
      if (!subscriptionId)
        throw new Error("storage_invoice_missing_subscription");
      await pool.query(
        `UPDATE role_room_storage_accounts
            SET stripe_subscription_status = 'past_due',
                billing_grace_until = COALESCE(
                  billing_grace_until,
                  NOW() + ($2::text || ' days')::interval
                ),
                status = CASE
                  WHEN COALESCE(
                    billing_grace_until,
                    NOW() + ($2::text || ' days')::interval
                  ) > NOW() THEN 'active'
                  ELSE 'read_only'
                END,
                updated_at = NOW()
          WHERE stripe_subscription_id = $1`,
        [subscriptionId, paymentGraceDays()],
      );
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

export function registerRoleRoomStorageBillingRoutes({
  app,
  pool,
  activeSessions,
  stripe,
}: Deps): void {
  app.get(
    "/api/role-room/storage/billing/context",
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session) return res.status(401).json({ error: "krever_innlogging" });
      const parsed = z.string().uuid().safeParse(req.query.organizationId);
      if (!parsed.success)
        return res.status(400).json({ error: "ugyldig_organization_id" });
      try {
        const organization = await readRoleRoomOrganizationAccess(
          pool,
          parsed.data,
          session.userId,
        );
        if (!organization)
          return res.status(403).json({ error: "ingen_organisasjonstilgang" });
        const account = await ensureRoleRoomOrganizationStorageAccount(
          pool,
          organization,
        );
        const context = await readRoleRoomStorageContext(pool, account.id);
        const catalog = readRoleRoomStoragePriceCatalog();
        return res.json({
          organization: {
            id: organization.id,
            name: organization.name,
            membershipRole: organization.membershipRole,
            canAdminister: organization.canAdminister,
          },
          storage: context,
          checkoutAvailability: {
            extra100Gib: Boolean(catalog.addOns.extra100Gib.priceId),
            extra1Tib:
              Boolean(catalog.addOns.extra1Tib.priceId) &&
              oneTibCheckoutEnabled(),
            billingPortal: Boolean(billingPortalConfigurationId()),
          },
          pricing: {
            currency: "NOK",
            taxBehavior: "exclusive",
            interval: "month",
            addOns: {
              extra100Gib: {
                amount: ADD_ON_PRICING_NOK_EX_VAT.extra100Gib,
                bytes: catalog.addOns.extra100Gib.bytesPerUnit,
              },
              extra1Tib: {
                amount: ADD_ON_PRICING_NOK_EX_VAT.extra1Tib,
                bytes: catalog.addOns.extra1Tib.bytesPerUnit,
              },
            },
          },
        });
      } catch (error) {
        console.error("[role-room-storage-billing] context failed", error);
        return res
          .status(503)
          .json({ error: "storage_billing_schema_unavailable" });
      }
    },
  );

  app.post(
    "/api/role-room/storage/billing/checkout",
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session) return res.status(401).json({ error: "krever_innlogging" });
      const parsed = checkoutSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: "ugyldig_foresporsel" });
      const input = parsed.data;
      try {
        const organization = await readRoleRoomOrganizationAccess(
          pool,
          input.organizationId,
          session.userId,
        );
        if (!organization)
          return res.status(403).json({ error: "ingen_organisasjonstilgang" });
        if (!organization.canAdminister)
          return res.status(403).json({ error: "kun_organisasjonsadmin" });
        if (!stripe)
          return res.status(503).json({ error: "stripe_ikke_konfigurert" });
        const catalog = readRoleRoomStoragePriceCatalog();
        if (
          input.addOns.extra100Gib > 0 &&
          !catalog.addOns.extra100Gib.priceId
        ) {
          return res
            .status(503)
            .json({ error: "pris_for_100_gib_ikke_konfigurert" });
        }
        if (input.addOns.extra1Tib > 0 && !catalog.addOns.extra1Tib.priceId) {
          return res
            .status(503)
            .json({ error: "pris_for_1_tib_ikke_konfigurert" });
        }
        if (input.addOns.extra1Tib > 0 && !oneTibCheckoutEnabled()) {
          return res.status(409).json({ error: "1_tib_tillegg_ikke_aktivert" });
        }
        const account = await ensureRoleRoomOrganizationStorageAccount(
          pool,
          organization,
        );
        if (
          account.stripe_subscription_id &&
          !["canceled", "incomplete_expired"].includes(
            account.stripe_subscription_status || "",
          )
        ) {
          return res.status(409).json({
            error: "lagringsabonnement_finnes",
            action: "open_billing_portal",
          });
        }
        const checkoutLockToken = randomUUID();
        const checkoutExpiresAt = new Date(Date.now() + 31 * 60_000);
        const lock = await pool.query(
          `UPDATE role_room_storage_accounts
            SET checkout_lock_token = $2::uuid,
                checkout_lock_until = $3,
                updated_at = NOW()
          WHERE id = $1::uuid
            AND (checkout_lock_until IS NULL OR checkout_lock_until <= NOW())
          RETURNING id`,
          [account.id, checkoutLockToken, checkoutExpiresAt],
        );
        if (lock.rows.length === 0) {
          return res
            .status(409)
            .json({
              error: "checkout_pagar",
              action: "vent_eller_apne_portal",
            });
        }
        const customerId = await ensureStripeCustomer(
          pool,
          stripe,
          organization,
          session,
        );
        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
        if (input.addOns.extra100Gib > 0) {
          lineItems.push({
            price: catalog.addOns.extra100Gib.priceId!,
            quantity: input.addOns.extra100Gib,
          });
        }
        if (input.addOns.extra1Tib > 0) {
          lineItems.push({
            price: catalog.addOns.extra1Tib.priceId!,
            quantity: input.addOns.extra1Tib,
          });
        }
        const metadata = {
          organization_id: organization.id,
          storage_account_id: account.id,
          product_family: PRODUCT_FAMILY,
          billing_scope: "storage_addons",
          extra_100_gib_quantity: String(input.addOns.extra100Gib),
          extra_1_tib_quantity: String(input.addOns.extra1Tib),
        };
        const origin = publicOrigin();
        const idempotencyBucket = Math.floor(Date.now() / 900_000);
        let checkout: Stripe.Checkout.Session;
        try {
          checkout = await stripe.checkout.sessions.create(
            {
              mode: "subscription",
              customer: customerId,
              client_reference_id: organization.id,
              line_items: lineItems,
              billing_address_collection: "required",
              allow_promotion_codes: true,
              automatic_tax: { enabled: true },
              customer_update: { address: "auto", name: "auto" },
              expires_at: Math.floor(checkoutExpiresAt.getTime() / 1000),
              success_url: `${origin}/role-room?storage_billing=success&session_id={CHECKOUT_SESSION_ID}`,
              cancel_url: `${origin}/role-room?storage_billing=cancelled`,
              metadata,
              subscription_data: { metadata },
            },
            {
              idempotencyKey: [
                "rr-storage-checkout",
                organization.id,
                input.addOns.extra100Gib,
                input.addOns.extra1Tib,
                idempotencyBucket,
              ].join(":"),
            },
          );
        } catch (error) {
          await pool
            .query(
              `UPDATE role_room_storage_accounts
              SET checkout_lock_token = NULL, checkout_lock_until = NULL,
                  updated_at = NOW()
            WHERE id = $1::uuid AND checkout_lock_token = $2::uuid`,
              [account.id, checkoutLockToken],
            )
            .catch(() => undefined);
          throw error;
        }
        if (!checkout.url) {
          await pool
            .query(
              `UPDATE role_room_storage_accounts
              SET checkout_lock_token = NULL, checkout_lock_until = NULL,
                  updated_at = NOW()
            WHERE id = $1::uuid AND checkout_lock_token = $2::uuid`,
              [account.id, checkoutLockToken],
            )
            .catch(() => undefined);
          throw new Error("stripe_checkout_url_missing");
        }
        await pool.query(
          `UPDATE role_room_storage_accounts
            SET stripe_checkout_session_id = $2,
                stripe_checkout_expires_at = $3,
                updated_at = NOW()
          WHERE id = $1::uuid AND checkout_lock_token = $4::uuid`,
          [account.id, checkout.id, checkoutExpiresAt, checkoutLockToken],
        );
        await pool.query(
          `UPDATE role_room_affiliate_referrals
            SET stripe_checkout_session_id = $1, updated_at = NOW()
          WHERE referred_organization_id = $2::uuid
            AND status = 'attributed'`,
          [checkout.id, organization.id],
        );
        return res.status(201).json({ url: checkout.url });
      } catch (error) {
        console.error("[role-room-storage-billing] checkout failed", error);
        return res.status(502).json({ error: "checkout_failed" });
      }
    },
  );

  app.post(
    "/api/role-room/storage/billing/portal",
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session) return res.status(401).json({ error: "krever_innlogging" });
      const parsed = organizationSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: "ugyldig_organization_id" });
      try {
        const organization = await readRoleRoomOrganizationAccess(
          pool,
          parsed.data.organizationId,
          session.userId,
        );
        if (!organization)
          return res.status(403).json({ error: "ingen_organisasjonstilgang" });
        if (!organization.canAdminister)
          return res.status(403).json({ error: "kun_organisasjonsadmin" });
        if (!stripe)
          return res.status(503).json({ error: "stripe_ikke_konfigurert" });
        if (!organization.stripeCustomerId)
          return res.status(404).json({ error: "stripe_kunde_mangler" });
        const configuration = billingPortalConfigurationId();
        if (!configuration) {
          return res
            .status(503)
            .json({ error: "billing_portal_ikke_konfigurert" });
        }
        const account = await ensureRoleRoomOrganizationStorageAccount(
          pool,
          organization,
        );
        if (!account.stripe_subscription_id) {
          return res.status(404).json({ error: "lagringsabonnement_mangler" });
        }
        const returnUrl = `${publicOrigin()}/role-room?storage_billing=portal_return`;
        const portal = await stripe.billingPortal.sessions.create({
          customer: organization.stripeCustomerId,
          configuration,
          return_url: returnUrl,
          flow_data: {
            type: "subscription_cancel",
            subscription_cancel: {
              subscription: account.stripe_subscription_id,
            },
            after_completion: {
              type: "redirect",
              redirect: { return_url: returnUrl },
            },
          },
        });
        return res.json({ url: portal.url });
      } catch (error) {
        console.error("[role-room-storage-billing] portal failed", error);
        return res.status(502).json({ error: "portal_failed" });
      }
    },
  );

  app.post(
    "/api/role-room/storage/affiliate/attribute",
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session) return res.status(401).json({ error: "krever_innlogging" });
      const parsed = referralSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: "ugyldig_foresporsel" });
      try {
        const organization = await readRoleRoomOrganizationAccess(
          pool,
          parsed.data.organizationId,
          session.userId,
        );
        if (!organization)
          return res.status(403).json({ error: "ingen_organisasjonstilgang" });
        if (!organization.canAdminister)
          return res.status(403).json({ error: "kun_organisasjonsadmin" });
        const paidAccount = await pool.query(
          `SELECT 1
           FROM role_room_storage_accounts
          WHERE organization_id = $1::uuid
            AND stripe_subscription_id IS NOT NULL
            AND stripe_subscription_status NOT IN ('canceled', 'incomplete_expired')
          LIMIT 1`,
          [organization.id],
        );
        if (paidAccount.rows.length > 0) {
          return res
            .status(409)
            .json({ error: "henvisning_ma_registreres_for_betaling" });
        }
        const partnerResult = await pool.query<{
          id: string;
          organization_id: string;
        }>(
          `SELECT id, organization_id
           FROM role_room_affiliate_partners
          WHERE UPPER(referral_code) = UPPER($1) AND status = 'active'
          LIMIT 1`,
          [parsed.data.referralCode],
        );
        const partner = partnerResult.rows[0];
        if (!partner)
          return res.status(404).json({ error: "henvisningskode_ikke_funnet" });
        if (partner.organization_id === organization.id) {
          return res
            .status(409)
            .json({ error: "egen_organisasjon_kan_ikke_henvises" });
        }
        const existing = await pool.query<{ affiliate_partner_id: string }>(
          `SELECT affiliate_partner_id
           FROM role_room_affiliate_referrals
          WHERE referred_organization_id = $1::uuid`,
          [organization.id],
        );
        if (
          existing.rows[0] &&
          existing.rows[0].affiliate_partner_id !== partner.id
        ) {
          return res
            .status(409)
            .json({ error: "organisasjonen_er_allerede_henvist" });
        }
        await pool.query(
          `INSERT INTO role_room_affiliate_referrals (
           affiliate_partner_id, referred_organization_id, status, metadata
         ) VALUES ($1::uuid, $2::uuid, 'attributed', $3::jsonb)
         ON CONFLICT (referred_organization_id) DO NOTHING`,
          [
            partner.id,
            organization.id,
            JSON.stringify({ attributedByUserId: session.userId }),
          ],
        );
        return res.status(201).json({ ok: true, status: "attributed" });
      } catch (error) {
        console.error(
          "[role-room-storage-billing] affiliate attribution failed",
          error,
        );
        return res.status(503).json({ error: "affiliate_schema_unavailable" });
      }
    },
  );
}
