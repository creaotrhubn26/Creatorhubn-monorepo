import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type Stripe from "stripe";
import { sendTransactionalEmail } from "./transactional-email-service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUPPORTED_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);
const FULL_ACCESS_STATUSES = new Set(["active", "trialing"]);
const IMMEDIATE_READ_ONLY_STATUSES = new Set([
  "unpaid",
  "canceled",
  "incomplete_expired",
]);
export const LEADGRID_AI_STRUCTURE_PRICE = process.env.LEADGRID_PRICE_AI_STRUCTURE
  ?? "price_1TuGibApjenweKvPiMk8meKH";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export class LeadgridBillingError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = "LeadgridBillingError";
  }
}

type LockedBillingRow = {
  organization_id: string;
  name: string;
  contact_email: string | null;
  org_customer_id: string | null;
  org_subscription_id: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  subscription_status: string;
  plan_key: string | null;
  billing_revision: number;
  storage_addon_quantity: number;
  storage_addon_item_id: string | null;
  pending_checkout_session_id: string | null;
  pending_checkout_url: string | null;
  pending_checkout_expires_at: string | null;
};

async function withBillingLock<T>(
  pool: Pool,
  organizationId: string,
  operation: (client: PoolClient, row: LockedBillingRow) => Promise<T>,
): Promise<T> {
  if (!UUID_PATTERN.test(organizationId)) {
    throw new LeadgridBillingError(400, "ugyldig_orgId");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO leadgrid_org_billing (organization_id)
       SELECT id FROM organizations WHERE id = $1::uuid
       ON CONFLICT (organization_id) DO NOTHING`,
      [organizationId],
    );
    const result = await client.query<LockedBillingRow>(
      `SELECT billing.organization_id::text, organization.name,
              organization.contact_email,
              organization.stripe_customer_id AS org_customer_id,
              organization.stripe_subscription_id AS org_subscription_id,
              billing.provider_customer_id,
              billing.provider_subscription_id,
              billing.subscription_status,
              billing.plan_key,
              billing.billing_revision,
              billing.storage_addon_quantity,
              billing.storage_addon_item_id,
              billing.pending_checkout_session_id,
              billing.pending_checkout_url,
              billing.pending_checkout_expires_at::text
         FROM leadgrid_org_billing billing
         JOIN organizations organization ON organization.id = billing.organization_id
        WHERE billing.organization_id = $1::uuid
        FOR UPDATE OF billing, organization`,
      [organizationId],
    );
    const row = result.rows[0];
    if (!row) throw new LeadgridBillingError(404, "org_ikke_funnet");
    const value = await operation(client, row);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function customerIdFor(row: LockedBillingRow): string | null {
  return row.provider_customer_id ?? row.org_customer_id;
}

async function ensureOrganizationCustomer(
  client: PoolClient,
  stripe: Stripe,
  row: LockedBillingRow,
  billingEmail?: string,
): Promise<string> {
  const existing = customerIdFor(row);
  if (existing) return existing;
  const email = billingEmail?.trim() || row.contact_email?.trim() || "";
  if (!email) throw new LeadgridBillingError(400, "mangler_billing_email");
  const customer = await stripe.customers.create(
    {
      name: row.name,
      email,
      metadata: {
        organization_id: row.organization_id,
        product_family: "leadgrid",
      },
    },
    { idempotencyKey: `leadgrid-customer-${row.organization_id}` },
  );
  await client.query(
    `WITH billing_update AS (
       UPDATE leadgrid_org_billing
        SET provider_customer_id = $2, updated_at = NOW()
      WHERE organization_id = $1::uuid
       RETURNING organization_id
     )
     UPDATE organizations
        SET stripe_customer_id = $2, updated_at = NOW()
      WHERE id IN (SELECT organization_id FROM billing_update)`,
    [row.organization_id, customer.id],
  );
  return customer.id;
}

function hasExistingSubscription(row: LockedBillingRow): boolean {
  return Boolean(row.provider_subscription_id ?? row.org_subscription_id) &&
    !["inactive", "canceled", "incomplete_expired"].includes(row.subscription_status);
}

export async function createLeadgridCheckoutSession(input: {
  pool: Pool;
  stripe: Stripe;
  organizationId: string;
  planKey: string;
  billing: "monthly" | "yearly";
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  fallbackEmail?: string;
}): Promise<{ url: string; sessionId: string; reused: boolean }> {
  return withBillingLock(input.pool, input.organizationId, async (client, row) => {
    if (hasExistingSubscription(row)) {
      throw new LeadgridBillingError(409, "org_har_abonnement", {
        stripe_subscription_id: row.provider_subscription_id ?? row.org_subscription_id,
      });
    }
    const existingExpiry = row.pending_checkout_expires_at
      ? new Date(row.pending_checkout_expires_at).getTime()
      : 0;
    if (
      row.pending_checkout_session_id &&
      row.pending_checkout_url &&
      existingExpiry > Date.now() + 60_000 &&
      row.plan_key === input.planKey
    ) {
      return {
        url: row.pending_checkout_url,
        sessionId: row.pending_checkout_session_id,
        reused: true,
      };
    }

    const customerId = await ensureOrganizationCustomer(
      client,
      input.stripe,
      row,
      input.fallbackEmail,
    );
    const checkout = await input.stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: input.priceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        allow_promotion_codes: true,
        metadata: {
          organization_id: row.organization_id,
          plan_key: input.planKey,
          product_family: "leadgrid",
          billing: input.billing,
        },
        subscription_data: {
          metadata: {
            organization_id: row.organization_id,
            plan_key: input.planKey,
            product_family: "leadgrid",
            billing: input.billing,
          },
        },
      },
      {
        idempotencyKey:
          `leadgrid-checkout-${row.organization_id}-${row.billing_revision}` +
          `-${input.planKey}-${input.billing}`,
      },
    );
    if (!checkout.url) {
      throw new LeadgridBillingError(502, "stripe_checkout_url_mangler");
    }
    const expiresAt = checkout.expires_at
      ? new Date(checkout.expires_at * 1000)
      : new Date(Date.now() + 23 * 60 * 60 * 1000);
    await client.query(
      `UPDATE leadgrid_org_billing
          SET plan_key = $2,
              billing_interval = $3,
              pending_checkout_session_id = $4,
              pending_checkout_url = $5,
              pending_checkout_expires_at = $6,
              updated_at = NOW()
        WHERE organization_id = $1::uuid`,
      [
        row.organization_id,
        input.planKey,
        input.billing === "yearly" ? "year" : "month",
        checkout.id,
        checkout.url,
        expiresAt,
      ],
    );
    return { url: checkout.url, sessionId: checkout.id, reused: false };
  });
}

export async function provisionLeadgridInvoiceSubscription(input: {
  pool: Pool;
  stripe: Stripe;
  organizationId: string;
  planKey: string;
  interval: "month" | "year";
  planPriceId: string;
  aiPriceId?: string;
  includeAI: boolean;
  daysUntilDue: number;
  billingEmail?: string;
}): Promise<{ customerId: string; subscriptionId: string }> {
  return withBillingLock(input.pool, input.organizationId, async (client, row) => {
    if (hasExistingSubscription(row)) {
      throw new LeadgridBillingError(409, "org_har_abonnement", {
        stripe_subscription_id: row.provider_subscription_id ?? row.org_subscription_id,
      });
    }
    if (row.pending_checkout_session_id && row.pending_checkout_expires_at &&
        new Date(row.pending_checkout_expires_at).getTime() > Date.now()) {
      throw new LeadgridBillingError(409, "org_har_aktiv_checkout");
    }
    const customerId = await ensureOrganizationCustomer(
      client,
      input.stripe,
      row,
      input.billingEmail,
    );
    const items: Stripe.SubscriptionCreateParams.Item[] = [
      { price: input.planPriceId, quantity: 1 },
    ];
    if (input.includeAI && input.aiPriceId) items.push({ price: input.aiPriceId, quantity: 1 });
    const subscription = await input.stripe.subscriptions.create(
      {
        customer: customerId,
        items,
        collection_method: "send_invoice",
        days_until_due: input.daysUntilDue,
        metadata: {
          organization_id: row.organization_id,
          product_family: "leadgrid",
          plan_key: input.planKey,
          billing: input.interval,
        },
      },
      {
        idempotencyKey:
          `leadgrid-subscription-${row.organization_id}-${row.billing_revision}`,
      },
    );
    await client.query(
      `WITH billing_update AS (
       UPDATE leadgrid_org_billing
          SET provider_customer_id = $2,
              provider_subscription_id = $3,
              subscription_status = $4,
              plan_key = $5,
              billing_interval = $6,
              pending_checkout_session_id = NULL,
              pending_checkout_url = NULL,
              pending_checkout_expires_at = NULL,
              updated_at = NOW()
        WHERE organization_id = $1::uuid
        RETURNING organization_id
       )
       UPDATE organizations
          SET stripe_customer_id = $2,
              stripe_subscription_id = $3,
              plan = $5,
              updated_at = NOW()
        WHERE id IN (SELECT organization_id FROM billing_update)`,
      [
        row.organization_id,
        customerId,
        subscription.id,
        subscription.status,
        input.planKey,
        input.interval,
      ],
    );
    return { customerId, subscriptionId: subscription.id };
  });
}

export async function setLeadgridStorageAddonQuantity(input: {
  pool: Pool;
  stripe: Stripe;
  organizationId: string;
  quantity: number;
  priceId: string;
}): Promise<{ quantity: number; subscriptionItemId: string | null }> {
  if (!Number.isInteger(input.quantity) || input.quantity < 0 || input.quantity > 1000) {
    throw new LeadgridBillingError(400, "ugyldig_lagringstillegg");
  }
  return withBillingLock(input.pool, input.organizationId, async (client, row) => {
    const subscriptionId = row.provider_subscription_id ?? row.org_subscription_id;
    if (!subscriptionId || !FULL_ACCESS_STATUSES.has(row.subscription_status)) {
      throw new LeadgridBillingError(409, "aktivt_abonnement_pakrevd");
    }
    const revision = row.billing_revision;
    let itemId = row.storage_addon_item_id;
    if (!itemId) {
      const subscription = await input.stripe.subscriptions.retrieve(subscriptionId);
      itemId = subscription.items.data.find((item) => item.price.id === input.priceId)?.id ?? null;
    }

    if (input.quantity === 0 && itemId) {
      await input.stripe.subscriptionItems.del(
        itemId,
        { proration_behavior: "create_prorations" },
        { idempotencyKey: `leadgrid-storage-${row.organization_id}-${revision}-remove` },
      );
      itemId = null;
    } else if (input.quantity > 0 && itemId) {
      await input.stripe.subscriptionItems.update(
        itemId,
        { quantity: input.quantity, proration_behavior: "create_prorations" },
        {
          idempotencyKey:
            `leadgrid-storage-${row.organization_id}-${revision}-quantity-${input.quantity}`,
        },
      );
    } else if (input.quantity > 0) {
      const item = await input.stripe.subscriptionItems.create(
        {
          subscription: subscriptionId,
          price: input.priceId,
          quantity: input.quantity,
          proration_behavior: "create_prorations",
        },
        {
          idempotencyKey:
            `leadgrid-storage-${row.organization_id}-${revision}-create-${input.quantity}`,
        },
      );
      itemId = item.id;
    }

    await client.query(
      `UPDATE leadgrid_org_billing
          SET storage_addon_quantity = $2,
              storage_addon_item_id = $3,
              billing_revision = billing_revision + 1,
              updated_at = NOW()
        WHERE organization_id = $1::uuid`,
      [row.organization_id, input.quantity, itemId],
    );
    return { quantity: input.quantity, subscriptionItemId: itemId };
  });
}

export async function enqueueLeadgridStripeEvent(
  pool: Pool,
  event: Stripe.Event,
): Promise<boolean> {
  if (!SUPPORTED_EVENT_TYPES.has(event.type)) return false;
  const object = event.data.object as { id?: string };
  const inserted = await pool.query(
    `INSERT INTO leadgrid_stripe_events (
       stripe_event_id, event_type, stripe_object_id, stripe_created_at, payload
     ) VALUES ($1, $2, $3, to_timestamp($4), $5::jsonb)
     ON CONFLICT (stripe_event_id) DO NOTHING`,
    [event.id, event.type, object?.id ?? null, event.created, JSON.stringify(event)],
  );
  return (inserted.rowCount ?? 0) === 1;
}

type JournalRow = { stripe_event_id: string; payload: Stripe.Event };

async function claimStripeEvent(pool: Pool): Promise<JournalRow | null> {
  const result = await pool.query<JournalRow>(
    `UPDATE leadgrid_stripe_events event
        SET status = 'processing', attempts = attempts + 1,
            locked_at = NOW(), updated_at = NOW()
      WHERE event.stripe_event_id = (
        SELECT candidate.stripe_event_id
          FROM leadgrid_stripe_events candidate
         WHERE (
           candidate.status = 'pending'
           OR (candidate.status = 'processing' AND candidate.locked_at < NOW() - INTERVAL '5 minutes')
         )
           AND candidate.next_attempt_at <= NOW()
         ORDER BY candidate.stripe_created_at, candidate.stripe_event_id
         FOR UPDATE SKIP LOCKED
         LIMIT 1
      )
      RETURNING event.stripe_event_id, event.payload`,
  );
  return result.rows[0] ?? null;
}

function stringId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function subscriptionIdFromObject(event: Stripe.Event): string | null {
  const object = event.data.object as any;
  if (event.type.startsWith("customer.subscription.")) return object.id ?? null;
  if (event.type.startsWith("checkout.session.")) return stringId(object.subscription);
  if (event.type.startsWith("invoice.")) {
    return stringId(object.parent?.subscription_details?.subscription)
      ?? stringId(object.subscription);
  }
  return null;
}

function customerIdFromObject(event: Stripe.Event): string | null {
  return stringId((event.data.object as any)?.customer);
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const ends = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => Number.isFinite(value));
  return ends.length > 0 ? new Date(Math.max(...ends) * 1000) : null;
}

async function resolveLeadgridSubscription(input: {
  pool: Pool;
  stripe: Stripe;
  event: Stripe.Event;
}): Promise<{
  billingOrganizationId: string;
  subscription: Stripe.Subscription;
  customerId: string;
} | null> {
  let subscriptionId = subscriptionIdFromObject(input.event);
  const eventCustomerId = customerIdFromObject(input.event);
  if (!subscriptionId && eventCustomerId) {
    const customerBilling = await input.pool.query<{ provider_subscription_id: string | null }>(
      `SELECT provider_subscription_id
         FROM leadgrid_org_billing
        WHERE provider_customer_id = $1
        LIMIT 1`,
      [eventCustomerId],
    );
    subscriptionId = customerBilling.rows[0]?.provider_subscription_id ?? null;
  }
  if (!subscriptionId) return null;

  const subscription = await input.stripe.subscriptions.retrieve(subscriptionId);
  const metadata = subscription.metadata ?? {};
  const rawMetadataOrgId = metadata.organization_id?.trim();
  const metadataOrgId = rawMetadataOrgId && UUID_PATTERN.test(rawMetadataOrgId)
    ? rawMetadataOrgId
    : null;
  const customerId = stringId(subscription.customer);
  if (!customerId) return null;
  if (eventCustomerId && eventCustomerId !== customerId) {
    throw new LeadgridBillingError(409, "stripe_event_customer_mismatch");
  }

  const local = await input.pool.query<{
    organization_id: string;
    provider_customer_id: string | null;
    provider_subscription_id: string | null;
  }>(
    `SELECT organization_id::text, provider_customer_id, provider_subscription_id
       FROM leadgrid_org_billing
      WHERE provider_subscription_id = $1
         OR provider_customer_id = $2
         OR ($3::uuid IS NOT NULL AND organization_id = $3::uuid)`,
    [subscription.id, customerId, metadataOrgId],
  );
  const isLeadgrid = metadata.product_family === "leadgrid" || local.rows.length > 0;
  if (!isLeadgrid) return null;
  const organizationIds = new Set(local.rows.map((row) => row.organization_id));
  if (metadata.product_family === "leadgrid" && metadataOrgId) {
    organizationIds.add(metadataOrgId);
  }
  if (organizationIds.size !== 1) {
    throw new LeadgridBillingError(409, "stripe_tenant_mapping_mismatch");
  }
  const organizationId = [...organizationIds][0];
  const conflicts = local.rows.some((row) =>
    row.organization_id !== organizationId
    || (row.provider_customer_id !== null && row.provider_customer_id !== customerId)
    || (row.provider_subscription_id !== null && row.provider_subscription_id !== subscription.id));
  if (conflicts) {
    throw new LeadgridBillingError(409, "stripe_tenant_mapping_mismatch");
  }
  return { billingOrganizationId: organizationId, subscription, customerId };
}

async function projectSubscriptionState(input: {
  client: PoolClient;
  event: Stripe.Event;
  organizationId: string;
  subscription: Stripe.Subscription;
  customerId: string;
  storageAddonPriceId?: string;
  aiStructurePriceId?: string;
}): Promise<void> {
  const status = input.subscription.status;
  const planKey = input.subscription.metadata?.plan_key ?? null;
  const billing = input.subscription.metadata?.billing;
  const billingInterval = billing === "year" || billing === "yearly"
    ? "year"
    : billing === "month" || billing === "monthly"
      ? "month"
      : null;
  const periodEnd = subscriptionPeriodEnd(input.subscription);
  const storageItem = input.storageAddonPriceId
    ? input.subscription.items.data.find((item) => item.price.id === input.storageAddonPriceId)
    : undefined;
  const hasAiStructureAddon = Boolean(
    input.aiStructurePriceId && input.subscription.items.data.some(
      (item) => item.price.id === input.aiStructurePriceId,
    ),
  );

  const updated = await input.client.query<{
    past_due_since: string | null;
    grace_days: number;
  }>(
    `INSERT INTO leadgrid_org_billing (
       organization_id, provider_customer_id, provider_subscription_id,
       subscription_status, plan_key, billing_interval, current_period_end,
       past_due_since, read_only_at, storage_addon_quantity,
       storage_addon_item_id
     ) VALUES (
       $1::uuid, $2, $3, $4, $5, $6, $7,
       CASE WHEN $4 = 'past_due' THEN NOW() ELSE NULL END,
       CASE WHEN $4 = ANY($8::text[]) THEN NOW() ELSE NULL END,
       $9, $10
     )
     ON CONFLICT (organization_id) DO UPDATE SET
       provider_customer_id = EXCLUDED.provider_customer_id,
       provider_subscription_id = EXCLUDED.provider_subscription_id,
       subscription_status = EXCLUDED.subscription_status,
       plan_key = COALESCE(EXCLUDED.plan_key, leadgrid_org_billing.plan_key),
       billing_interval = COALESCE(EXCLUDED.billing_interval, leadgrid_org_billing.billing_interval),
       current_period_end = EXCLUDED.current_period_end,
       past_due_since = CASE
         WHEN EXCLUDED.subscription_status = 'past_due'
           THEN COALESCE(leadgrid_org_billing.past_due_since, NOW())
         ELSE NULL
       END,
       read_only_at = CASE
         WHEN EXCLUDED.subscription_status = ANY($8::text[])
           THEN COALESCE(leadgrid_org_billing.read_only_at, NOW())
         WHEN EXCLUDED.subscription_status = ANY($11::text[])
           THEN NULL
         ELSE leadgrid_org_billing.read_only_at
       END,
       storage_addon_quantity = EXCLUDED.storage_addon_quantity,
       storage_addon_item_id = EXCLUDED.storage_addon_item_id,
       pending_checkout_session_id = NULL,
       pending_checkout_url = NULL,
       pending_checkout_expires_at = NULL,
       billing_revision = CASE
         WHEN leadgrid_org_billing.provider_subscription_id IS DISTINCT FROM EXCLUDED.provider_subscription_id
           THEN leadgrid_org_billing.billing_revision + 1
         ELSE leadgrid_org_billing.billing_revision
       END,
       updated_at = NOW()
     RETURNING past_due_since::text, grace_days`,
    [
      input.organizationId,
      input.customerId,
      input.subscription.id,
      status,
      planKey,
      billingInterval,
      periodEnd,
      [...IMMEDIATE_READ_ONLY_STATUSES],
      storageItem?.quantity ?? 0,
      storageItem?.id ?? null,
      [...FULL_ACCESS_STATUSES],
    ],
  );
  await input.client.query(
    `UPDATE organizations
        SET stripe_customer_id = $2,
            stripe_subscription_id = $3,
            plan = COALESCE($4, plan),
            plan_renews_at = $5,
            status = CASE
              WHEN $6 = ANY($7::text[])
                   AND status = 'read_only'
                   AND pause_reason LIKE 'billing_%'
                THEN 'active'
              WHEN $6 = ANY($8::text[])
                   AND status NOT IN ('suspended', 'closed')
                THEN 'read_only'
              ELSE status
            END,
            paused_at = CASE
              WHEN $6 = ANY($7::text[])
                   AND pause_reason LIKE 'billing_%' THEN NULL
              ELSE paused_at
            END,
            pause_reason = CASE
              WHEN $6 = ANY($7::text[])
                   AND pause_reason LIKE 'billing_%' THEN NULL
              WHEN $6 = ANY($8::text[]) THEN 'billing_' || $6
              ELSE pause_reason
            END,
            updated_at = NOW()
      WHERE id = $1::uuid`,
    [
      input.organizationId,
      input.customerId,
      input.subscription.id,
      planKey,
      periodEnd,
      status,
      [...FULL_ACCESS_STATUSES],
      [...IMMEDIATE_READ_ONLY_STATUSES],
    ],
  );

  if (input.event.type === "invoice.paid") {
    const invoice = input.event.data.object as Stripe.Invoice;
    const loose = invoice as any;
    const periodStart = loose.period_start ?? loose.lines?.data?.[0]?.period?.start ?? null;
    const invoicePeriodEnd = loose.period_end ?? loose.lines?.data?.[0]?.period?.end ?? null;
    await input.client.query(
      `INSERT INTO org_invoices (
         organization_id, stripe_invoice_id, stripe_subscription_id,
         stripe_customer_id, amount_due_oere, amount_paid_oere, vat_oere,
         currency, status, period_start, period_end, invoice_number,
         hosted_invoice_url, invoice_pdf_url, plan_key, description, raw_event
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9,
         CASE WHEN $10::bigint IS NULL THEN NULL ELSE to_timestamp($10) END,
         CASE WHEN $11::bigint IS NULL THEN NULL ELSE to_timestamp($11) END,
         $12, $13, $14, $15, $16, $17::jsonb
       )
       ON CONFLICT (stripe_invoice_id) DO UPDATE SET
         status = EXCLUDED.status,
         amount_paid_oere = EXCLUDED.amount_paid_oere,
         hosted_invoice_url = EXCLUDED.hosted_invoice_url,
         invoice_pdf_url = EXCLUDED.invoice_pdf_url,
         updated_at = NOW()`,
      [
        input.organizationId,
        invoice.id,
        input.subscription.id,
        input.customerId,
        invoice.amount_due,
        invoice.amount_paid,
        loose.tax ?? 0,
        invoice.currency ?? "nok",
        invoice.status ?? "paid",
        periodStart,
        invoicePeriodEnd,
        invoice.number,
        invoice.hosted_invoice_url,
        invoice.invoice_pdf,
        planKey,
        invoice.description ?? null,
        JSON.stringify(invoice),
      ],
    );
    await input.client.query(
      `INSERT INTO leadgrid_billing_outbox (
         organization_id, kind, dedupe_key, payload
       ) VALUES ($1::uuid, 'invoice_paid', $2, $3::jsonb)
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [
        input.organizationId,
        `invoice-paid:${invoice.id}`,
        JSON.stringify({ invoiceId: invoice.id }),
      ],
    );
    await input.client.query(
      `DELETE FROM plan_grace WHERE organization_id = $1::uuid`,
      [input.organizationId],
    );
    if (hasAiStructureAddon) {
      await input.client.query(
        `INSERT INTO leadgrid_org_entitlements
           (organization_id, feature_key, state, updated_by)
         VALUES ($1::uuid, 'leadbookAIStrukturering', 'included', NULL)
         ON CONFLICT (organization_id, feature_key) DO UPDATE
           SET state = 'included', updated_at = NOW()
         WHERE leadgrid_org_entitlements.state <> 'locked'`,
        [input.organizationId],
      );
    }
    await input.client.query(
      `UPDATE onboarding_drips
          SET converted_at = NOW()
        WHERE converted_at IS NULL AND organization_id = $1::uuid`,
      [input.organizationId],
    );
  } else if (
    input.event.type === "invoice.payment_failed"
    && !FULL_ACCESS_STATUSES.has(status)
  ) {
    const invoice = input.event.data.object as Stripe.Invoice;
    await input.client.query(
      `INSERT INTO leadgrid_billing_outbox (
         organization_id, kind, dedupe_key, payload
       ) VALUES ($1::uuid, 'payment_failed', $2, $3::jsonb)
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [
        input.organizationId,
        `payment-failed:${invoice.id}`,
        JSON.stringify({ invoiceId: invoice.id }),
      ],
    );
  }

  const pastDueSince = updated.rows[0]?.past_due_since;
  const graceDays = Number(updated.rows[0]?.grace_days ?? 7);
  if (
    status === "past_due" &&
    pastDueSince &&
    Date.now() >= new Date(pastDueSince).getTime() + graceDays * 86_400_000
  ) {
    await setOrganizationBillingReadOnly(input.client, input.organizationId, "past_due");
  }
}

async function setOrganizationBillingReadOnly(
  queryable: Queryable,
  organizationId: string,
  reason: string,
): Promise<void> {
  await queryable.query(
    `WITH billing_update AS (
     UPDATE leadgrid_org_billing
        SET read_only_at = COALESCE(read_only_at, NOW()), updated_at = NOW()
      WHERE organization_id = $1::uuid
      RETURNING organization_id
     )
     UPDATE organizations
        SET status = CASE
              WHEN status IN ('suspended', 'closed') THEN status
              ELSE 'read_only'
            END,
            paused_at = COALESCE(paused_at, NOW()),
            pause_reason = 'billing_' || $2,
            updated_at = NOW()
      WHERE id IN (SELECT organization_id FROM billing_update)`,
    [organizationId, reason],
  );
}

export async function enforceLeadgridPastDueReadOnly(pool: Pool): Promise<number> {
  const due = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text
       FROM leadgrid_org_billing
      WHERE subscription_status = 'past_due'
        AND read_only_at IS NULL
        AND past_due_since IS NOT NULL
        AND past_due_since + make_interval(days => grace_days) <= NOW()
      FOR UPDATE SKIP LOCKED
      LIMIT 100`,
  );
  for (const row of due.rows) {
    await setOrganizationBillingReadOnly(pool, row.organization_id, "past_due");
  }
  return due.rows.length;
}

export async function processNextLeadgridStripeEvent(input: {
  pool: Pool;
  stripe: Stripe;
  storageAddonPriceId?: string;
  aiStructurePriceId?: string;
}): Promise<"processed" | "ignored" | "empty" | "failed"> {
  const claimed = await claimStripeEvent(input.pool);
  if (!claimed) return "empty";
  try {
    const event = claimed.payload;
    const resolved = await resolveLeadgridSubscription({
      pool: input.pool,
      stripe: input.stripe,
      event,
    });
    if (!resolved) {
      await input.pool.query(
        `UPDATE leadgrid_stripe_events
            SET status = 'ignored', processed_at = NOW(), locked_at = NULL,
                updated_at = NOW()
          WHERE stripe_event_id = $1 AND status = 'processing'`,
        [claimed.stripe_event_id],
      );
      return "ignored";
    }

    const client = await input.pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        `SELECT 1 FROM leadgrid_stripe_events
          WHERE stripe_event_id = $1 AND status = 'processing'
          FOR UPDATE`,
        [claimed.stripe_event_id],
      );
      if (!locked.rows.length) {
        await client.query("ROLLBACK");
        return "ignored";
      }
      await projectSubscriptionState({
        client,
        event,
        organizationId: resolved.billingOrganizationId,
        subscription: resolved.subscription,
        customerId: resolved.customerId,
        storageAddonPriceId: input.storageAddonPriceId,
        aiStructurePriceId: input.aiStructurePriceId,
      });
      await client.query(
        `UPDATE leadgrid_stripe_events
            SET status = 'processed', processed_at = NOW(), locked_at = NULL,
                last_error = NULL, updated_at = NOW()
          WHERE stripe_event_id = $1`,
        [claimed.stripe_event_id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    return "processed";
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).slice(0, 1000);
    await input.pool.query(
      `UPDATE leadgrid_stripe_events
          SET status = CASE WHEN attempts >= 10 THEN 'failed' ELSE 'pending' END,
              next_attempt_at = NOW() + LEAST(INTERVAL '1 hour',
                make_interval(secs => (2 ^ LEAST(attempts, 10))::int)),
              locked_at = NULL, last_error = $2, updated_at = NOW()
        WHERE stripe_event_id = $1`,
      [claimed.stripe_event_id, message],
    );
    return "failed";
  }
}

type OutboxRow = {
  id: string;
  organization_id: string;
  kind: "invoice_paid" | "payment_failed";
  payload: { invoiceId?: string };
  name: string;
  contact_email: string | null;
  invoice_number: string | null;
  amount_paid_oere: number | null;
  hosted_invoice_url: string | null;
};

export async function processNextLeadgridBillingOutbox(pool: Pool): Promise<boolean> {
  const claimed = await pool.query<OutboxRow>(
    `UPDATE leadgrid_billing_outbox outbox
        SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
      WHERE outbox.id = (
        SELECT candidate.id FROM leadgrid_billing_outbox candidate
         WHERE candidate.status IN ('pending', 'processing')
           AND candidate.next_attempt_at <= NOW()
           AND (candidate.status = 'pending' OR candidate.updated_at < NOW() - INTERVAL '10 minutes')
         ORDER BY candidate.created_at
         FOR UPDATE SKIP LOCKED LIMIT 1
      )
      RETURNING outbox.id::text, outbox.organization_id::text,
                outbox.kind, outbox.payload,
                (SELECT name FROM organizations WHERE id = outbox.organization_id) AS name,
                (SELECT contact_email FROM organizations WHERE id = outbox.organization_id) AS contact_email,
                (SELECT invoice_number FROM org_invoices
                  WHERE stripe_invoice_id = outbox.payload->>'invoiceId') AS invoice_number,
                (SELECT amount_paid_oere FROM org_invoices
                  WHERE stripe_invoice_id = outbox.payload->>'invoiceId') AS amount_paid_oere,
                (SELECT hosted_invoice_url FROM org_invoices
                  WHERE stripe_invoice_id = outbox.payload->>'invoiceId') AS hosted_invoice_url`,
  );
  const row = claimed.rows[0];
  if (!row) return false;
  if (!row.contact_email) {
    await pool.query(
      `UPDATE leadgrid_billing_outbox
          SET status = 'failed', last_error = 'organization_contact_email_missing',
              updated_at = NOW()
        WHERE id = $1::uuid`,
      [row.id],
    );
    return true;
  }
  try {
    const paid = row.kind === "invoice_paid";
    const amount = ((Number(row.amount_paid_oere ?? 0)) / 100)
      .toFixed(2).replace(".", ",");
    const subject = paid
      ? `Tusen takk — ${row.name} er på gridden`
      : `Betalingen for ${row.name} må oppdateres`;
    const text = paid
      ? `Vi har mottatt ${amount} NOK for ${row.name}. Faktura ${row.invoice_number ?? row.payload.invoiceId ?? ""}.\n${row.hosted_invoice_url ?? ""}`
      : `Betalingen for ${row.name} feilet. Organisasjonsadministratoren kan oppdatere betaling i Leadgrid. Ingen filer slettes.`;
    const escapedText = escapeHtml(text).replace(/\n/g, "<br>");
    await sendTransactionalEmail({
      to: row.contact_email,
      subject,
      html: `<div style="font-family:system-ui,sans-serif"><h1>Leadgrid</h1><p>${escapedText}</p></div>`,
      text,
      kind: paid ? "leadgrid_invoice_paid" : "leadgrid_payment_failed",
      pool,
    });
    await pool.query(
      `UPDATE leadgrid_billing_outbox
          SET status = 'sent', sent_at = NOW(), last_error = NULL, updated_at = NOW()
        WHERE id = $1::uuid`,
      [row.id],
    );
  } catch (error) {
    await pool.query(
      `UPDATE leadgrid_billing_outbox
          SET status = CASE WHEN attempts >= 10 THEN 'failed' ELSE 'pending' END,
              next_attempt_at = NOW() + INTERVAL '5 minutes',
              last_error = $2, updated_at = NOW()
        WHERE id = $1::uuid`,
      [row.id, String(error instanceof Error ? error.message : error).slice(0, 1000)],
    );
  }
  return true;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function startLeadgridBillingWorker(input: {
  pool: Pool;
  stripe: Stripe | null;
  intervalMs?: number;
  storageAddonPriceId?: string;
  aiStructurePriceId?: string;
}): () => void {
  if (!input.stripe) return () => undefined;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await enforceLeadgridPastDueReadOnly(input.pool);
      for (let i = 0; i < 25; i += 1) {
        const result = await processNextLeadgridStripeEvent({
          pool: input.pool,
          stripe: input.stripe!,
          storageAddonPriceId: input.storageAddonPriceId,
          aiStructurePriceId: input.aiStructurePriceId,
        });
        if (result === "empty") break;
      }
      for (let i = 0; i < 25; i += 1) {
        if (!(await processNextLeadgridBillingOutbox(input.pool))) break;
      }
    } catch (error) {
      console.error("[leadgrid-billing-worker]", error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), input.intervalMs ?? 15_000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}

export function newLeadgridUsageIdempotencyKey(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}
