import express, { type Express } from "express";
import type { Pool } from "pg";
import request from "supertest";
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  accrueRoleRoomCommercialAffiliateCommission,
  handleRoleRoomStorageStripeEvent,
  registerRoleRoomStorageBillingRoutes,
  syncRoleRoomCommercialStorageEntitlement,
} from "./role-room-storage-billing.js";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";

function accountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ACCOUNT_ID,
    organization_id: ORG_ID,
    plan_key: "solo_free",
    base_quota_bytes: "5368709120",
    used_bytes: "1024",
    reserved_bytes: "0",
    file_count: 1,
    stripe_subscription_id: null,
    stripe_subscription_status: null,
    stripe_current_period_end: null,
    stripe_cancel_at_period_end: false,
    billing_grace_until: null,
    status: "active",
    ...overrides,
  };
}

function buildPool(
  options: {
    membershipRole?: string | null;
    ownerUserId?: string | null;
    platformRole?: string;
    customerId?: string | null;
    duplicateWebhook?: boolean;
    affiliatePartnerOrgId?: string;
    storageSubscriptionId?: string | null;
  } = {},
) {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
    const sql = String(sqlValue);
    statements.push({ sql, params });
    if (
      sql.includes("FROM organizations o") &&
      sql.includes("membership_role")
    ) {
      return {
        rows: [
          {
            id: ORG_ID,
            name: "Filmhuset AS",
            contact_email: "billing@example.test",
            billing_email: null,
            stripe_customer_id:
              options.customerId === undefined ? "cus_org" : options.customerId,
            plan: "solo_free",
            owner_user_id: options.ownerUserId ?? null,
            membership_role:
              options.membershipRole === undefined
                ? "admin"
                : options.membershipRole,
            platform_role: options.platformRole ?? "member",
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes("INSERT INTO role_room_storage_accounts")) {
      return {
        rows: [
          accountRow({
            stripe_subscription_id: options.storageSubscriptionId ?? null,
            stripe_subscription_status: options.storageSubscriptionId
              ? "active"
              : null,
          }),
        ],
        rowCount: 1,
      };
    }
    if (sql.includes("JOIN role_room_storage_effective_quota")) {
      return {
        rows: [
          {
            ...accountRow(),
            active_bonus_bytes: "10737418240",
            effective_quota_bytes: "16106127360",
          },
        ],
        rowCount: 1,
      };
    }
    if (
      sql.includes("UPDATE organizations") &&
      sql.includes("RETURNING stripe_customer_id")
    ) {
      return { rows: [{ stripe_customer_id: "cus_new" }], rowCount: 1 };
    }
    if (sql.includes("SET role_room_plan_key = selected_plan.plan_key")) {
      return { rows: [{ id: ORG_ID }], rowCount: 1 };
    }
    if (
      sql.includes("SET checkout_lock_token") &&
      sql.includes("RETURNING id")
    ) {
      return { rows: [{ id: ACCOUNT_ID }], rowCount: 1 };
    }
    if (sql.includes("FROM role_room_affiliate_partners")) {
      return {
        rows: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            organization_id: options.affiliatePartnerOrgId ?? "org-partner",
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes("SELECT affiliate_partner_id"))
      return { rows: [], rowCount: 0 };
    if (sql.includes("INSERT INTO role_room_stripe_webhook_events")) {
      return options.duplicateWebhook
        ? { rows: [], rowCount: 0 }
        : { rows: [{ stripe_event_id: params[0] }], rowCount: 1 };
    }
    if (
      sql.includes("FROM role_room_storage_accounts") &&
      sql.includes("billing_grace_until")
    ) {
      return {
        rows: [
          {
            id: ACCOUNT_ID,
            billing_grace_until: null,
            used_bytes: "0",
            reserved_bytes: "0",
            base_quota_bytes: "5368709120",
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 1 };
  });
  return { pool: { query } as unknown as Pool, statements, query };
}

function buildStripe() {
  return {
    customers: {
      create: vi.fn(async () => ({ id: "cus_new" })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async () => ({
          id: "cs_test",
          url: "https://checkout.stripe.test/session",
        })),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(async () => ({
          id: "bps_test",
          url: "https://billing.stripe.test/session",
        })),
      },
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
  } as unknown as Stripe;
}

function buildApp(pool: Pool, stripe: Stripe | null): Express {
  const app = express();
  app.use(express.json());
  registerRoleRoomStorageBillingRoutes({
    app,
    pool,
    stripe,
    activeSessions: new Map([
      ["token", { userId: "user-1", email: "owner@example.test" }],
    ]),
  });
  return app;
}

describe("Role Room organization storage billing routes", () => {
  beforeEach(() => {
    process.env.ROLE_ROOM_STORAGE_PRICE_EXTRA_100_GIB_MONTHLY =
      "price_storage_100";
    process.env.ROLE_ROOM_STORAGE_PRICE_EXTRA_1_TIB_MONTHLY =
      "price_storage_1t";
    process.env.ROLE_ROOM_STORAGE_1_TIB_CHECKOUT_ENABLED = "true";
    process.env.ROLE_ROOM_STORAGE_BILLING_PORTAL_CONFIGURATION_ID =
      "bpc_storage";
    process.env.ROLE_ROOM_PUBLIC_URL = "https://theroleroom.com";
  });

  afterEach(() => {
    delete process.env.ROLE_ROOM_STORAGE_PRICE_EXTRA_100_GIB_MONTHLY;
    delete process.env.ROLE_ROOM_STORAGE_PRICE_EXTRA_1_TIB_MONTHLY;
    delete process.env.ROLE_ROOM_STORAGE_1_TIB_CHECKOUT_ENABLED;
    delete process.env.ROLE_ROOM_STORAGE_BILLING_PORTAL_CONFIGURATION_ID;
    delete process.env.ROLE_ROOM_PUBLIC_URL;
  });

  it("requires an authenticated organization administrator for checkout", async () => {
    const { pool } = buildPool({ membershipRole: "member" });
    const stripe = buildStripe();
    const response = await request(buildApp(pool, stripe))
      .post("/api/role-room/storage/billing/checkout")
      .set("Authorization", "Bearer token")
      .send({
        organizationId: ORG_ID,
        addOns: { extra100Gib: 1, extra1Tib: 0 },
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("kun_organisasjonsadmin");
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("uses only server-side Price IDs and server-controlled return URLs", async () => {
    const { pool } = buildPool();
    const stripe = buildStripe();
    const response = await request(buildApp(pool, stripe))
      .post("/api/role-room/storage/billing/checkout")
      .set("Authorization", "Bearer token")
      .send({
        organizationId: ORG_ID,
        addOns: { extra100Gib: 2, extra1Tib: 0 },
      });

    expect(response.status).toBe(201);
    expect(response.body.url).toBe("https://checkout.stripe.test/session");
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_org",
        line_items: [{ price: "price_storage_100", quantity: 2 }],
        success_url:
          "https://theroleroom.com/role-room?storage_billing=success&session_id={CHECKOUT_SESSION_ID}",
        cancel_url:
          "https://theroleroom.com/role-room?storage_billing=cancelled",
        metadata: expect.objectContaining({
          organization_id: ORG_ID,
          product_family: "role_room_storage",
          billing_scope: "storage_addons",
        }),
      }),
      expect.objectContaining({
        idempotencyKey: expect.stringContaining(
          `rr-storage-checkout:${ORG_ID}`,
        ),
      }),
    );
  });

  it("releases the checkout lock when Stripe returns no hosted URL", async () => {
    const { pool, statements } = buildPool();
    const stripe = buildStripe();
    vi.mocked(stripe.checkout.sessions.create).mockResolvedValueOnce({
      id: "cs_without_url",
      url: null,
    } as any);

    const response = await request(buildApp(pool, stripe))
      .post("/api/role-room/storage/billing/checkout")
      .set("Authorization", "Bearer token")
      .send({
        organizationId: ORG_ID,
        addOns: { extra100Gib: 1, extra1Tib: 0 },
      });

    expect(response.status).toBe(502);
    expect(
      statements.some(
        ({ sql }) =>
          sql.includes("checkout_lock_token = NULL") &&
          sql.includes("checkout_lock_until = NULL"),
      ),
    ).toBe(true);
  });

  it("rejects browser-supplied Stripe fields instead of forwarding them", async () => {
    const { pool } = buildPool();
    const stripe = buildStripe();
    const response = await request(buildApp(pool, stripe))
      .post("/api/role-room/storage/billing/checkout")
      .set("Authorization", "Bearer token")
      .send({
        organizationId: ORG_ID,
        addOns: { extra100Gib: 1, extra1Tib: 0 },
        priceId: "price_attacker",
        returnUrl: "https://attacker.example",
      });

    expect(response.status).toBe(400);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("does not create a second base-plan subscription without a storage add-on", async () => {
    const { pool } = buildPool();
    const stripe = buildStripe();
    const response = await request(buildApp(pool, stripe))
      .post("/api/role-room/storage/billing/checkout")
      .set("Authorization", "Bearer token")
      .send({
        organizationId: ORG_ID,
        addOns: { extra100Gib: 0, extra1Tib: 0 },
      });

    expect(response.status).toBe(400);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("keeps the 1 TiB add-on unavailable until the egress safeguard is enabled", async () => {
    delete process.env.ROLE_ROOM_STORAGE_1_TIB_CHECKOUT_ENABLED;
    const { pool } = buildPool();
    const stripe = buildStripe();

    const context = await request(buildApp(pool, stripe))
      .get(`/api/role-room/storage/billing/context?organizationId=${ORG_ID}`)
      .set("Authorization", "Bearer token");
    const checkout = await request(buildApp(pool, stripe))
      .post("/api/role-room/storage/billing/checkout")
      .set("Authorization", "Bearer token")
      .send({
        organizationId: ORG_ID,
        addOns: { extra100Gib: 0, extra1Tib: 1 },
      });

    expect(context.status).toBe(200);
    expect(context.body.checkoutAvailability.extra1Tib).toBe(false);
    expect(checkout.status).toBe(409);
    expect(checkout.body.error).toBe("1_tib_tillegg_ikke_aktivert");
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("allows members to read pooled quota without granting billing administration", async () => {
    const { pool } = buildPool({ membershipRole: "member" });
    const response = await request(buildApp(pool, buildStripe()))
      .get(`/api/role-room/storage/billing/context?organizationId=${ORG_ID}`)
      .set("Authorization", "Bearer token");

    expect(response.status).toBe(200);
    expect(response.body.organization.canAdminister).toBe(false);
    expect(response.body.storage).toMatchObject({
      ownerType: "organization",
      quotaBytes: 16_106_127_360,
      usedBytes: 1024,
    });
    expect(response.body.pricing).toMatchObject({
      currency: "NOK",
      taxBehavior: "exclusive",
      addOns: {
        extra100Gib: { amount: 129 },
        extra1Tib: { amount: 799 },
      },
    });
  });

  it("creates a portal session with a fixed same-site return URL", async () => {
    const { pool } = buildPool({ storageSubscriptionId: "sub_storage" });
    const stripe = buildStripe();
    const response = await request(buildApp(pool, stripe))
      .post("/api/role-room/storage/billing/portal")
      .set("Authorization", "Bearer token")
      .send({ organizationId: ORG_ID });

    expect(response.status).toBe(200);
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_org",
      configuration: "bpc_storage",
      return_url:
        "https://theroleroom.com/role-room?storage_billing=portal_return",
      flow_data: {
        type: "subscription_cancel",
        subscription_cancel: { subscription: "sub_storage" },
        after_completion: {
          type: "redirect",
          redirect: {
            return_url:
              "https://theroleroom.com/role-room?storage_billing=portal_return",
          },
        },
      },
    });
  });

  it("attributes an active partner code to the organization before payment", async () => {
    const { pool, statements } = buildPool();
    const response = await request(buildApp(pool, buildStripe()))
      .post("/api/role-room/storage/affiliate/attribute")
      .set("Authorization", "Bearer token")
      .send({ organizationId: ORG_ID, referralCode: "FILM-15" });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("attributed");
    expect(
      statements.some(({ sql }) =>
        sql.includes("INSERT INTO role_room_affiliate_referrals"),
      ),
    ).toBe(true);
  });

  it("blocks self-referral for an affiliate organization", async () => {
    const { pool } = buildPool({ affiliatePartnerOrgId: ORG_ID });
    const response = await request(buildApp(pool, buildStripe()))
      .post("/api/role-room/storage/affiliate/attribute")
      .set("Authorization", "Bearer token")
      .send({ organizationId: ORG_ID, referralCode: "SELF-15" });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("egen_organisasjon_kan_ikke_henvises");
  });
});

describe("Role Room commercial storage entitlement", () => {
  it("maps the content-producer subscription to the included 25 GiB plan", async () => {
    const { pool, statements } = buildPool();

    await expect(
      syncRoleRoomCommercialStorageEntitlement(pool, {
        organizationNumber: "937 518 684",
        persona: "content_producer",
        active: true,
        stripeSubscriptionId: "sub_main",
        stripeCustomerId: "cus_main",
      }),
    ).resolves.toEqual([ORG_ID]);

    const sync = statements.find(({ sql }) =>
      sql.includes("SET role_room_plan_key = selected_plan.plan_key"),
    );
    expect(sync?.params).toEqual([
      "937518684",
      "solo_pro",
      "sub_main",
      "cus_main",
    ]);
  });

  it("maps an ended commercial subscription back to the free base quota", async () => {
    const { pool, statements } = buildPool();

    await syncRoleRoomCommercialStorageEntitlement(pool, {
      organizationNumber: "937518684",
      persona: "production_team",
      active: false,
    });

    const sync = statements.find(({ sql }) =>
      sql.includes("SET role_room_plan_key = selected_plan.plan_key"),
    );
    expect(sync?.params[1]).toBe("solo_free");
  });
});

describe("Role Room commercial affiliate commission", () => {
  it("accrues 15 percent on ex-tax core revenue and grants the organization bonus once", async () => {
    const paidAt = new Date("2026-09-10T12:00:00.000Z");
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: ORG_ID }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            commission_basis_points: 1500,
            commission_months: 12,
            referred_org_bonus_bytes: "10737418240",
            referred_org_bonus_months: 3,
            commission_ends_at: null,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: ACCOUNT_ID }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const pool = { query } as unknown as Pool;

    await expect(
      accrueRoleRoomCommercialAffiliateCommission(pool, {
        organizationNumber: "937 518 684",
        stripeInvoiceId: "in_core_paid",
        currency: "NOK",
        amountPaidMinor: 61_875,
        subtotalExcludingTaxMinor: 49_500,
        paidAt,
        stripePaymentIntentId: "pi_core_paid",
        stripeChargeId: "ch_core_paid",
      }),
    ).resolves.toBe(true);

    const calls = vi.mocked(query).mock.calls.map(([sql, params]) => ({
      sql: String(sql),
      params: params as unknown[],
    }));
    const bonus = calls.find(({ sql }) =>
      sql.includes("INSERT INTO role_room_storage_grants"),
    );
    const commission = calls.find(({ sql }) =>
      sql.includes("INSERT INTO role_room_affiliate_commissions"),
    );
    expect(bonus?.sql).toContain(
      "ON CONFLICT (storage_account_id, source_type, source_ref) DO NOTHING",
    );
    expect(commission?.params.slice(1, 6)).toEqual([
      "in_core_paid",
      "nok",
      49_500,
      1500,
      7_425,
    ]);
    expect(commission?.params[6]).toBe(61_875);
    expect(commission?.params[7]).toBe("pi_core_paid");
    expect(commission?.params[8]).toBe("ch_core_paid");
    expect(commission?.params[9]).toEqual(new Date("2026-10-10T12:00:00.000Z"));
    expect(commission?.params[10]).toContain(
      '"commissionScope":"core_subscription"',
    );
  });

  it("refuses to attribute a commercial invoice when the organization number is ambiguous", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{ id: ORG_ID }, { id: "44444444-4444-4444-8444-444444444444" }],
      rowCount: 2,
    });

    await expect(
      accrueRoleRoomCommercialAffiliateCommission(
        { query } as unknown as Pool,
        {
          organizationNumber: "937518684",
          stripeInvoiceId: "in_ambiguous",
          currency: "nok",
          amountPaidMinor: 49_500,
        },
      ),
    ).resolves.toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe("Role Room storage Stripe webhook", () => {
  beforeEach(() => {
    process.env.ROLE_ROOM_STORAGE_PRICE_EXTRA_100_GIB_MONTHLY =
      "price_storage_100";
  });

  afterEach(() => {
    delete process.env.ROLE_ROOM_STORAGE_PRICE_EXTRA_100_GIB_MONTHLY;
  });

  it("does not process the same signed event twice", async () => {
    const { pool } = buildPool({ duplicateWebhook: true });
    const stripe = buildStripe();
    const event = {
      id: "evt_duplicate",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_storage",
          metadata: {
            product_family: "role_room_storage",
            organization_id: ORG_ID,
          },
        },
      },
    } as unknown as Stripe.Event;

    await expect(
      handleRoleRoomStorageStripeEvent(pool, stripe, event),
    ).resolves.toEqual({
      matched: true,
      duplicate: true,
    });
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it("syncs plan state and marks a new subscription event processed", async () => {
    const { pool, statements } = buildPool();
    const stripe = buildStripe();
    const event = {
      id: "evt_subscription",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_storage",
          object: "subscription",
          status: "active",
          cancel_at: null,
          cancel_at_period_end: false,
          metadata: {
            product_family: "role_room_storage",
            organization_id: ORG_ID,
            extra_100_gib_quantity: "0",
            extra_1_tib_quantity: "0",
          },
          items: {
            data: [
              {
                id: "si_addon",
                price: { id: "price_storage_100" },
                quantity: 2,
                current_period_end: 1_800_000_000,
              },
            ],
          },
        },
      },
    } as unknown as Stripe.Event;

    await expect(
      handleRoleRoomStorageStripeEvent(pool, stripe, event),
    ).resolves.toEqual({ matched: true });
    expect(
      statements.some(({ sql }) =>
        sql.includes("UPDATE role_room_storage_accounts"),
      ),
    ).toBe(true);
    expect(
      statements.some(
        ({ sql, params }) =>
          sql.includes("status = 'processed'") &&
          params[0] === "evt_subscription",
      ),
    ).toBe(true);
  });

  it("derives add-on entitlement from the configured Stripe Price instead of editable metadata", async () => {
    const { pool, statements } = buildPool();
    const stripe = buildStripe();
    const event = {
      id: "evt_metadata_escalation",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_storage",
          object: "subscription",
          status: "active",
          cancel_at: null,
          cancel_at_period_end: false,
          metadata: {
            product_family: "role_room_storage",
            organization_id: ORG_ID,
            extra_100_gib_quantity: "99",
          },
          items: {
            data: [
              {
                id: "si_addon",
                price: { id: "price_storage_100" },
                quantity: 2,
                current_period_end: 1_800_000_000,
              },
            ],
          },
        },
      },
    } as unknown as Stripe.Event;

    await expect(
      handleRoleRoomStorageStripeEvent(pool, stripe, event),
    ).resolves.toEqual({ matched: true });
    const grantUpsert = statements.find(
      ({ sql, params }) =>
        sql.includes("INSERT INTO role_room_storage_grants") &&
        params[1] === "stripe-addon-extra-100-gib",
    );
    expect(grantUpsert?.params[2]).toBe(200 * 1024 ** 3);
    expect(grantUpsert?.params[3]).toContain('"quantity":2');
  });
});
