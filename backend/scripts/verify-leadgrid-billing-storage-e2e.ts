#!/usr/bin/env tsx

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type Stripe from "stripe";
import {
  createLeadgridCheckoutSession,
  enforceLeadgridPastDueReadOnly,
  enqueueLeadgridStripeEvent,
  LeadgridBillingError,
  processNextLeadgridStripeEvent,
  provisionLeadgridInvoiceSubscription,
  setLeadgridStorageAddonQuantity,
} from "../server/leadgrid-billing-service.js";
import {
  getLeadgridOrganizationStorageStatus,
  processNextLeadgridUsageExport,
  recordLeadgridActualEgress,
} from "../server/leadgrid-org-storage-service.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseName = `leadgrid_billing_e2e_${Date.now()}`;
const pgUser = process.env.PGUSER || os.userInfo().username;
const databaseUrl = `postgresql://${encodeURIComponent(pgUser)}@127.0.0.1:5432/${databaseName}`;
const organizationId = "11111111-1111-4111-8111-111111111111";
const invoiceOrganizationId = "22222222-2222-4222-8222-222222222222";
const checksum = "a".repeat(64);

function event(
  id: string,
  type: Stripe.Event.Type,
  created: number,
  object: Record<string, unknown>,
): Stripe.Event {
  return {
    id,
    object: "event",
    api_version: "2025-10-29.clover",
    created,
    data: { object },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
  } as unknown as Stripe.Event;
}

async function main(): Promise<void> {
  execFileSync("createdb", [databaseName], {
    env: { ...process.env, PGUSER: pgUser },
    stdio: "ignore",
  });
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 8 });
  let currentSubscription: Record<string, any>;
  let customerCreates = 0;
  let checkoutCreates = 0;
  let subscriptionCreates = 0;
  let storageItemCreates = 0;
  const stripe = {
    customers: {
      create: async () => ({ id: `cus_${++customerCreates}` }),
    },
    checkout: {
      sessions: {
        create: async () => ({
          id: `cs_${++checkoutCreates}`,
          url: "https://checkout.stripe.test/session",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
      },
    },
    subscriptions: {
      create: async (params: any) => {
        subscriptionCreates += 1;
        currentSubscription = {
          id: "sub_invoice",
          status: "active",
          customer: params.customer,
          metadata: params.metadata,
          items: {
            data: params.items.map((item: any, index: number) => ({
              id: `si_${index}`,
              price: { id: item.price },
              quantity: item.quantity,
              current_period_end: 1_900_000_000,
            })),
          },
        };
        return currentSubscription;
      },
      retrieve: async () => currentSubscription,
    },
    subscriptionItems: {
      create: async (params: any) => ({
        id: `si_storage_${++storageItemCreates}`,
        quantity: params.quantity,
      }),
      update: async (id: string, params: any) => ({ id, quantity: params.quantity }),
      del: async (id: string) => ({ id, deleted: true }),
    },
  } as unknown as Stripe;

  try {
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE TABLE users (id VARCHAR(255) PRIMARY KEY, email TEXT, role TEXT);
      CREATE TABLE organizations (
        id UUID PRIMARY KEY, name TEXT NOT NULL, contact_email TEXT,
        stripe_customer_id TEXT, stripe_subscription_id TEXT,
        plan TEXT NOT NULL DEFAULT 'solo_free', plan_renews_at TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'active', paused_at TIMESTAMPTZ,
        pause_reason TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE plan_limits (
        plan_key TEXT PRIMARY KEY, included_storage_bytes BIGINT NOT NULL DEFAULT 0
      );
      CREATE TABLE organization_members (
        organization_id UUID NOT NULL REFERENCES organizations(id),
        user_id VARCHAR(255) NOT NULL REFERENCES users(id), role TEXT NOT NULL,
        PRIMARY KEY (organization_id, user_id)
      );
      CREATE TABLE leadgrid_projects (
        id TEXT NOT NULL, organization_id UUID NOT NULL REFERENCES organizations(id),
        PRIMARY KEY (id), UNIQUE (organization_id, id)
      );
      CREATE TABLE leadgrid_project_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL,
        project_id TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL,
        token TEXT NOT NULL, invited_by VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE leadgrid_project_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL,
        project_id TEXT NOT NULL, user_id VARCHAR(255) NOT NULL, role TEXT NOT NULL
      );
      CREATE TABLE leadgrid_storage_objects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id), project_id TEXT,
        uploaded_by VARCHAR(255) REFERENCES users(id), storage_provider TEXT NOT NULL,
        bucket_name TEXT, object_key TEXT NOT NULL UNIQUE, purpose TEXT NOT NULL,
        display_name TEXT NOT NULL, size_bytes BIGINT NOT NULL,
        content_type TEXT, checksum_sha256 CHAR(64), metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ
      );
      CREATE TABLE leadgrid_org_storage_usage (
        organization_id UUID PRIMARY KEY REFERENCES organizations(id),
        used_bytes BIGINT NOT NULL DEFAULT 0, file_count BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE OR REPLACE FUNCTION leadgrid_apply_storage_usage_delta()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
      CREATE TRIGGER trg_leadgrid_storage_usage
        AFTER INSERT OR UPDATE OF size_bytes, deleted_at OR DELETE
        ON leadgrid_storage_objects FOR EACH ROW
        EXECUTE FUNCTION leadgrid_apply_storage_usage_delta();
      CREATE TABLE org_invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL,
        stripe_invoice_id TEXT NOT NULL UNIQUE, stripe_subscription_id TEXT,
        stripe_customer_id TEXT, amount_due_oere BIGINT, amount_paid_oere BIGINT,
        vat_oere BIGINT, currency TEXT, status TEXT, period_start TIMESTAMPTZ,
        period_end TIMESTAMPTZ, invoice_number TEXT, hosted_invoice_url TEXT,
        invoice_pdf_url TEXT, plan_key TEXT, description TEXT, raw_event JSONB,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE plan_grace (
        organization_id UUID PRIMARY KEY REFERENCES organizations(id)
      );
      CREATE TABLE onboarding_drips (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID,
        converted_at TIMESTAMPTZ
      );
      CREATE TABLE leadgrid_org_entitlements (
        organization_id UUID NOT NULL, feature_key TEXT NOT NULL, state TEXT NOT NULL,
        updated_by VARCHAR(255), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (organization_id, feature_key)
      );
    `);
    const migration = await readFile(
      path.join(root, "migrations", "0571_leadgrid_org_billing_storage.sql"),
      "utf8",
    );
    const billingSource = await readFile(
      path.join(root, "server", "leadgrid-billing-service.ts"),
      "utf8",
    );
    assert.doesNotMatch(billingSource, /deleteObject|DeleteObjectCommand|@aws-sdk\/client-s3/);
    await pool.query(migration);
    await pool.query(
      `INSERT INTO users (id, email, role) VALUES
         ('admin', 'admin@dentum.no', 'user'),
         ('member', 'member@dentum.no', 'user'),
         ('blocked', 'blocked@dentum.no', 'user')`,
    );
    await pool.query(
      `INSERT INTO organizations (id, name, contact_email, plan) VALUES
         ($1, 'Dentum', 'admin@dentum.no', 'solo_free'),
         ($2, 'Dentum Invoice', 'invoice@dentum.no', 'solo_free')`,
      [organizationId, invoiceOrganizationId],
    );
    await pool.query(
      `INSERT INTO plan_limits (plan_key, included_storage_bytes)
         VALUES ('solo_free', 2147483648)
         ON CONFLICT (plan_key) DO UPDATE SET included_storage_bytes = EXCLUDED.included_storage_bytes`,
    );
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role) VALUES
         ($1, 'admin', 'admin'), ($1, 'member', 'member'), ($1, 'blocked', 'member'),
         ($2, 'admin', 'admin')`,
      [organizationId, invoiceOrganizationId],
    );
    await pool.query(
      `UPDATE organization_members
          SET leadgrid_storage_policy = 'disabled'
        WHERE organization_id = $1 AND user_id = 'blocked'`,
      [organizationId],
    );

    const checkouts = await Promise.all([
      createLeadgridCheckoutSession({
        pool, stripe, organizationId, planKey: "solo_pro", billing: "monthly",
        priceId: "price_plan", successUrl: "https://leadgrid.test/success",
        cancelUrl: "https://leadgrid.test/cancel",
      }),
      createLeadgridCheckoutSession({
        pool, stripe, organizationId, planKey: "solo_pro", billing: "monthly",
        priceId: "price_plan", successUrl: "https://leadgrid.test/success",
        cancelUrl: "https://leadgrid.test/cancel",
      }),
    ]);
    assert.equal(customerCreates, 1);
    assert.equal(checkoutCreates, 1);
    assert.equal(checkouts.filter((checkout) => checkout.reused).length, 1);

    const provisions = await Promise.allSettled([
      provisionLeadgridInvoiceSubscription({
        pool, stripe, organizationId: invoiceOrganizationId, planKey: "solo_pro",
        interval: "month", planPriceId: "price_plan", includeAI: false,
        daysUntilDue: 14,
      }),
      provisionLeadgridInvoiceSubscription({
        pool, stripe, organizationId: invoiceOrganizationId, planKey: "solo_pro",
        interval: "month", planPriceId: "price_plan", includeAI: false,
        daysUntilDue: 14,
      }),
    ]);
    assert.equal(subscriptionCreates, 1);
    assert.equal(provisions.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = provisions.find((result) => result.status === "rejected") as PromiseRejectedResult;
    assert(rejected.reason instanceof LeadgridBillingError);
    assert.equal(rejected.reason.code, "org_har_abonnement");

    currentSubscription = {
      id: "sub_invoice",
      status: "active",
      customer: "cus_2",
      metadata: {
        organization_id: invoiceOrganizationId,
        product_family: "leadgrid",
        plan_key: "solo_pro",
        billing: "month",
      },
      items: {
        data: [{
          id: "si_plan", price: { id: "price_plan" }, quantity: 1,
          current_period_end: 1_900_000_000,
        }],
      },
    };
    const failedInvoice = event("evt_failed", "invoice.payment_failed", 100, {
      id: "in_failed", customer: "cus_2", subscription: "sub_invoice",
    });
    const paidInvoice = event("evt_paid", "invoice.paid", 200, {
      id: "in_paid", customer: "cus_2", subscription: "sub_invoice",
      amount_due: 19900, amount_paid: 19900, currency: "nok", status: "paid",
      number: "LG-1", hosted_invoice_url: "https://stripe.test/invoice",
      invoice_pdf: "https://stripe.test/invoice.pdf", lines: { data: [] },
    });
    for (let index = 0; index < 10; index += 1) {
      await enqueueLeadgridStripeEvent(pool, paidInvoice);
    }
    assert.equal(await processNextLeadgridStripeEvent({ pool, stripe }), "processed");
    // Deliver the older payment-failed event after the newer paid event.
    // Projection still reads the current Subscription and must remain active.
    await enqueueLeadgridStripeEvent(pool, failedInvoice);
    assert.equal(await processNextLeadgridStripeEvent({ pool, stripe }), "processed");
    assert.equal((await pool.query(`SELECT COUNT(*)::int AS count FROM leadgrid_stripe_events`)).rows[0].count, 2);
    assert.equal((await pool.query(`SELECT COUNT(*)::int AS count FROM org_invoices`)).rows[0].count, 1);
    assert.equal(
      (await pool.query(`SELECT COUNT(*)::int AS count FROM leadgrid_billing_outbox`)).rows[0].count,
      1,
      "a stale failed event must not enqueue a misleading warning after recovery",
    );
    assert.equal((await pool.query(
      `SELECT subscription_status FROM leadgrid_org_billing WHERE organization_id = $1`,
      [invoiceOrganizationId],
    )).rows[0].subscription_status, "active");
    await enqueueLeadgridStripeEvent(pool, event(
      "evt_tenant_mismatch",
      "invoice.payment_failed",
      250,
      { id: "in_tenant_mismatch", customer: "cus_other_org", subscription: "sub_invoice" },
    ));
    assert.equal(
      await processNextLeadgridStripeEvent({ pool, stripe }),
      "failed",
      "a Stripe object whose customer and subscription disagree must never project tenant state",
    );
    assert.match(
      (await pool.query(
        `SELECT last_error FROM leadgrid_stripe_events WHERE stripe_event_id = 'evt_tenant_mismatch'`,
      )).rows[0].last_error,
      /stripe_event_customer_mismatch/,
    );

    await pool.query(
      `UPDATE leadgrid_org_billing
          SET subscription_status = 'past_due', past_due_since = NOW() - INTERVAL '8 days',
              read_only_at = NULL
        WHERE organization_id = $1`,
      [invoiceOrganizationId],
    );
    await pool.query(
      `UPDATE organizations SET status = 'active', pause_reason = NULL WHERE id = $1`,
      [invoiceOrganizationId],
    );
    assert.equal(await enforceLeadgridPastDueReadOnly(pool), 1);
    assert.equal((await pool.query(
      `SELECT status FROM organizations WHERE id = $1`, [invoiceOrganizationId],
    )).rows[0].status, "read_only");
    await enqueueLeadgridStripeEvent(pool, event(
      "evt_recovered", "customer.subscription.updated", 300, currentSubscription,
    ));
    assert.equal(await processNextLeadgridStripeEvent({ pool, stripe }), "processed");
    assert.equal((await pool.query(
      `SELECT status FROM organizations WHERE id = $1`, [invoiceOrganizationId],
    )).rows[0].status, "active");

    const insertStorage = async (id: string, userId: string, bytes: number) => pool.query(
      `INSERT INTO leadgrid_storage_objects (
         id, organization_id, uploaded_by, storage_provider, bucket_name,
         object_key, purpose, display_name, size_bytes, checksum_sha256
       ) VALUES (
         $1::uuid, $2::uuid, $3, 'aws_s3',
         'leadgrid-prod-745600963362-eu-north-1', $4,
         'lead_attachment', 'test.bin', $5, $6
       )`,
      [id, organizationId, userId, `organizations/${organizationId}/${id}`, bytes, checksum],
    );
    await insertStorage("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", "admin", 1024 ** 3);
    await insertStorage("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", "member", 1024 ** 3);
    await assert.rejects(
      insertStorage("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3", "member", 1),
      /leadgrid_storage_quota_exceeded/,
    );
    await assert.rejects(
      insertStorage("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4", "blocked", 1),
      /leadgrid_storage_access_disabled/,
    );
    let storage = await getLeadgridOrganizationStorageStatus(pool, organizationId);
    assert.equal(storage?.usedBytes, 2 * 1024 ** 3);
    assert.equal(storage?.availableBytes, 0);

    await pool.query(
      `UPDATE leadgrid_org_billing
          SET provider_subscription_id = 'sub_storage', subscription_status = 'active'
        WHERE organization_id = $1`,
      [organizationId],
    );
    currentSubscription = {
      id: "sub_storage", status: "active", customer: "cus_1", metadata: {},
      items: { data: [] },
    };
    await setLeadgridStorageAddonQuantity({
      pool, stripe, organizationId, quantity: 1, priceId: "price_storage_100_gib",
    });
    storage = await getLeadgridOrganizationStorageStatus(pool, organizationId);
    assert.equal(storage?.addonQuantity, 1);
    assert.equal(storage?.capacityBytes, 102 * 1024 ** 3);
    assert.equal(storageItemCreates, 1);

    assert.equal(await recordLeadgridActualEgress({
      pool, organizationId, bytes: 4096, sourceProvider: "aws_s3",
      idempotencyKey: "s3-report:2026-09-10:1", billable: true,
      billingProvider: "test-billing",
    }), true);
    assert.equal(await recordLeadgridActualEgress({
      pool, organizationId, bytes: 4096, sourceProvider: "aws_s3",
      idempotencyKey: "s3-report:2026-09-10:1", billable: true,
      billingProvider: "test-billing",
    }), false);
    let exported = 0;
    assert.equal(await processNextLeadgridUsageExport(pool, {
      provider: "test-billing",
      exportEgress: async (usage) => {
        exported += 1;
        assert.equal(usage.bytes, 4096);
        assert.match(usage.idempotencyKey, /^leadgrid-egress:/);
        return { providerEventId: "usage_1" };
      },
    }), "exported");
    assert.equal(exported, 1);
    assert.equal(await processNextLeadgridUsageExport(pool, {
      provider: "test-billing",
      exportEgress: async () => ({ providerEventId: "unexpected" }),
    }), "empty");

    const result = {
      concurrentCheckout: "one customer + one Checkout session",
      concurrentProvisioning: "one subscription",
      webhookJournal: "duplicate, stale and cross-tenant events handled safely",
      recovery: "past_due -> read_only -> active",
      organizationStorage: "shared quota + disabled-member enforcement",
      storageAddon: "+100 GiB fixed quantity",
      egress: "provider-neutral exactly-once export outbox",
    };
    console.log(JSON.stringify({ ok: true, result }, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
    execFileSync("dropdb", ["--if-exists", databaseName], {
      env: { ...process.env, PGUSER: pgUser },
      stdio: "ignore",
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
