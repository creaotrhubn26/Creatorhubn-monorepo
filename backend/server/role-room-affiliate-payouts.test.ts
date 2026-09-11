import express, { type Express } from "express";
import type { Pool, PoolClient } from "pg";
import request from "supertest";
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  handleRoleRoomAffiliateStripeEvent,
  readStripeInvoicePaymentReferences,
  registerRoleRoomAffiliatePayoutRoutes,
  runRoleRoomAffiliatePayoutBatch,
} from "./role-room-affiliate-payouts.js";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const PARTNER_ID = "22222222-2222-4222-8222-222222222222";
const COMMISSION_ID = "33333333-3333-4333-8333-333333333333";
const PAYOUT_ID = "44444444-4444-4444-8444-444444444444";

function organizationAccessRow(role = "admin") {
  return {
    id: ORG_ID,
    name: "Nordic Casting AS",
    contact_email: "kontakt@example.test",
    billing_email: "faktura@example.test",
    stripe_customer_id: null,
    plan: "agency",
    owner_user_id: null,
    membership_role: role,
    platform_role: "member",
  };
}

function partnerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PARTNER_ID,
    organization_id: ORG_ID,
    organization_name: "Nordic Casting AS",
    contact_email: "kontakt@example.test",
    billing_email: "faktura@example.test",
    stripe_connect_account_id: null,
    stripe_connect_country: "NO",
    stripe_connect_onboarding_status: "not_started",
    stripe_connect_details_submitted: false,
    stripe_connect_payouts_enabled: false,
    stripe_connect_transfers_status: null,
    stripe_connect_requirements: {},
    payout_currency: "nok",
    minimum_payout_minor: "100000",
    referral_code: "NORDIC15",
    status: "active",
    ...overrides,
  };
}

function connectAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "acct_affiliate",
    object: "account",
    country: "NO",
    details_submitted: false,
    payouts_enabled: false,
    capabilities: { transfers: "pending" },
    requirements: {
      currently_due: ["company.tax_id"],
      eventually_due: [],
      past_due: [],
      pending_verification: [],
      disabled_reason: null,
    },
    metadata: {
      role_room_affiliate_partner_id: PARTNER_ID,
      role_room_organization_id: ORG_ID,
    },
    ...overrides,
  } as unknown as Stripe.Account;
}

function buildStripe() {
  return {
    accounts: {
      list: vi.fn(async () => ({ data: [], has_more: false })),
      create: vi.fn(async () => connectAccount()),
      retrieve: vi.fn(async () => connectAccount()),
    },
    accountLinks: {
      create: vi.fn(async () => ({
        id: "link_affiliate",
        object: "account_link",
        url: "https://connect.stripe.test/onboard",
        expires_at: 1_800_000_000,
      })),
    },
    transfers: {
      list: vi.fn(async () => ({ data: [] })),
      create: vi.fn(),
      retrieve: vi.fn(),
    },
  } as unknown as Stripe;
}

function buildRouteApp(
  pool: Pool,
  stripe: Stripe,
  membershipRole = "admin",
): Express {
  const app = express();
  app.use(express.json());
  registerRoleRoomAffiliatePayoutRoutes({
    app,
    pool,
    stripe,
    activeSessions: new Map([
      ["token", { userId: "user-1", email: "owner@example.test" }],
    ]),
    requireAdminSession: (_req, res) => {
      res.status(403).json({ error: "admin_required" });
      return null;
    },
  });
  void membershipRole;
  return app;
}

function buildSuperAdminRouteApp(pool: Pool, stripe: Stripe): Express {
  const app = express();
  app.use(express.json());
  registerRoleRoomAffiliatePayoutRoutes({
    app,
    pool,
    stripe,
    activeSessions: new Map(),
    requireAdminSession: () => ({
      userId: "super-admin-1",
      email: "admin@example.test",
      role: "super_admin",
    }),
  });
  return app;
}

function transactionalPool(query: ReturnType<typeof vi.fn>): Pool {
  const client = { query, release: vi.fn() } as unknown as PoolClient;
  return { query, connect: vi.fn(async () => client) } as unknown as Pool;
}

describe("Role Room affiliate Connect onboarding", () => {
  beforeEach(() => {
    process.env.ROLE_ROOM_PUBLIC_URL = "https://theroleroom.com";
  });

  afterEach(() => {
    delete process.env.ROLE_ROOM_PUBLIC_URL;
  });

  it("creates one organization-owned Express account with only transfers requested", async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      statements.push({ sql, params });
      if (
        sql.includes("FROM organizations o") &&
        sql.includes("membership_role")
      ) {
        return { rows: [organizationAccessRow()], rowCount: 1 };
      }
      if (sql.includes("FROM role_room_affiliate_partners partner")) {
        return { rows: [partnerRow()], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    const stripe = buildStripe();
    const response = await request(
      buildRouteApp({ query } as unknown as Pool, stripe),
    )
      .post("/api/role-room/storage/affiliate/connect/onboarding")
      .set("Authorization", "Bearer token")
      .send({ organizationId: ORG_ID });

    expect(response.status).toBe(200);
    expect(response.body.onboardingUrl).toBe(
      "https://connect.stripe.test/onboard",
    );
    expect(stripe.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "express",
        country: "NO",
        default_currency: "nok",
        business_type: "company",
        capabilities: { transfers: { requested: true } },
        metadata: expect.objectContaining({
          role_room_affiliate_partner_id: PARTNER_ID,
          role_room_organization_id: ORG_ID,
        }),
      }),
      { idempotencyKey: `rr-affiliate-account:${PARTNER_ID}` },
    );
    const createParams = vi.mocked(stripe.accounts.create).mock
      .calls[0][0] as Stripe.AccountCreateParams;
    expect(createParams.capabilities).not.toHaveProperty("card_payments");
    expect(stripe.accountLinks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        account: "acct_affiliate",
        type: "account_onboarding",
        collection_options: {
          fields: "eventually_due",
          future_requirements: "include",
        },
        return_url: expect.stringContaining(
          "https://theroleroom.com/role-room?affiliate_connect=return",
        ),
      }),
    );
    expect(
      statements.some(({ sql }) => sql.includes("stripe_connect_requirements")),
    ).toBe(true);
  });

  it("does not expose onboarding to a non-admin organization member", async () => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (
        sql.includes("FROM organizations o") &&
        sql.includes("membership_role")
      ) {
        return { rows: [organizationAccessRow("member")], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const stripe = buildStripe();
    const response = await request(
      buildRouteApp({ query } as unknown as Pool, stripe, "member"),
    )
      .post("/api/role-room/storage/affiliate/connect/onboarding")
      .set("Authorization", "Bearer token")
      .send({ organizationId: ORG_ID });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("kun_organisasjonsadmin");
    expect(stripe.accounts.create).not.toHaveBeenCalled();
  });
});

describe("Role Room affiliate superadmin overview", () => {
  afterEach(() => {
    delete process.env.ROLE_ROOM_AFFILIATE_PAYOUTS_ENABLED;
    delete process.env.ROLE_ROOM_STRIPE_CONNECT_WEBHOOK_SECRET;
    delete process.env.ROLE_ROOM_STORAGE_1_TIB_CHECKOUT_ENABLED;
  });

  it("returns organization, member, agreement and ledger readiness without exposing secrets", async () => {
    process.env.ROLE_ROOM_AFFILIATE_PAYOUTS_ENABLED = "false";
    process.env.ROLE_ROOM_STRIPE_CONNECT_WEBHOOK_SECRET = "whsec_private";
    process.env.ROLE_ROOM_STORAGE_1_TIB_CHECKOUT_ENABLED = "false";
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("WITH commission_rows AS")) {
        return {
          rows: [
            {
              id: PARTNER_ID,
              organization_id: ORG_ID,
              organization_name: "Nordic Casting AS",
              organization_number: "999888777",
              contact_email: "kontakt@example.test",
              billing_email: "faktura@example.test",
              organization_owner_user_id: "user-1",
              organization_admin_count: 1,
              referral_code: "NORDIC15",
              commission_basis_points: 1500,
              storage_commission_basis_points: 500,
              commission_months: 12,
              referred_org_bonus_bytes: "10737418240",
              referred_org_bonus_months: 3,
              status: "active",
              stripe_connect_account_id: "acct_affiliate",
              stripe_connect_country: "NO",
              stripe_connect_onboarding_status: "complete",
              stripe_connect_details_submitted: true,
              stripe_connect_payouts_enabled: true,
              stripe_connect_transfers_status: "active",
              stripe_connect_requirements: {},
              stripe_connect_synced_at: "2026-09-11T08:00:00.000Z",
              payout_currency: "nok",
              minimum_payout_minor: "100000",
              last_connect_payout_id: "po_bank",
              last_connect_payout_status: "paid",
              last_connect_payout_at: "2026-09-10T08:00:00.000Z",
              referral_count: 3,
              paying_referral_count: 2,
              accrued_minor: "160000",
              adjustment_minor: "-10000",
              reserved_or_transferred_minor: "20000",
              available_minor: "130000",
              next_maturity_at: null,
              transferred_minor: "20000",
              failed_payout_count: 0,
              pending_payout_count: 0,
              last_payout_id: PAYOUT_ID,
              last_payout_status: "transferred",
              last_payout_amount_minor: "20000",
              last_payout_created_at: "2026-09-01T08:00:00.000Z",
              created_at: "2026-08-01T08:00:00.000Z",
              updated_at: "2026-09-11T08:00:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }
      if (
        sql.includes("FROM organizations organization") &&
        sql.includes("member_count")
      ) {
        return {
          rows: [
            {
              id: ORG_ID,
              name: "Nordic Casting AS",
              organization_number: "999888777",
              contact_email: "kontakt@example.test",
              billing_email: "faktura@example.test",
              owner_user_id: "user-1",
              member_count: 1,
              admin_count: 1,
              affiliate_partner_id: PARTNER_ID,
            },
          ],
          rowCount: 1,
        };
      }
      if (
        sql.includes("FROM organization_members member") &&
        sql.includes("user_row.last_login_at")
      ) {
        return {
          rows: [
            {
              organization_id: ORG_ID,
              user_id: "user-1",
              email: "owner@example.test",
              first_name: "Nora",
              last_name: "Nordmann",
              platform_role: "user",
              member_role: "admin",
              is_active: true,
              joined_at: "2026-08-01T08:00:00.000Z",
              last_login_at: "2026-09-11T07:00:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }
      if (
        sql.includes("FROM role_room_affiliate_payouts payout") &&
        sql.includes("initiated_by")
      ) {
        return { rows: [], rowCount: 0 };
      }
      if (
        sql.includes("FROM role_room_affiliate_connected_payout_events event")
      ) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM partner_intent_agreements agreement")) {
        return {
          rows: [
            {
              organization_id: ORG_ID,
              id: "55555555-5555-4555-8555-555555555555",
              title: "Partneravtale",
              status: "signed",
              partner_type: "reseller",
              template_version: "reseller_v2",
              signer_email: "owner@example.test",
              signer_name: "Nora Nordmann",
              sent_at: "2026-08-02T08:00:00.000Z",
              viewed_at: "2026-08-02T09:00:00.000Z",
              signed_at: "2026-08-02T09:30:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const response = await request(
      buildSuperAdminRouteApp({ query } as unknown as Pool, buildStripe()),
    ).get("/api/admin/role-room/affiliates/overview");

    expect(response.status).toBe(200);
    expect(response.body.config).toMatchObject({
      payoutsEnabled: false,
      stripeConfigured: true,
      connectWebhookConfigured: true,
      oneTiBCheckoutEnabled: false,
      maturityHoldDays: 30,
    });
    expect(JSON.stringify(response.body)).not.toContain("whsec_private");
    expect(response.body.summary).toMatchObject({
      totalPartners: 1,
      connectReadyPartners: 1,
      availableMinor: 130000,
    });
    expect(response.body.partners[0]).toMatchObject({
      organization: {
        name: "Nordic Casting AS",
        members: [
          expect.objectContaining({
            email: "owner@example.test",
            memberRole: "admin",
          }),
        ],
      },
      agreement: { status: "signed", scope: "organization_partner_intent" },
      payoutReadiness: {
        connectReady: true,
        minimumReached: true,
        partnerActive: true,
      },
    });
  });

  it("rejects ordinary admins before reading financial or member data", async () => {
    const query = vi.fn();
    const app = express();
    app.use(express.json());
    registerRoleRoomAffiliatePayoutRoutes({
      app,
      pool: { query } as unknown as Pool,
      stripe: buildStripe(),
      activeSessions: new Map(),
      requireAdminSession: () => ({ userId: "admin-1", role: "admin" }),
    });

    const response = await request(app).get(
      "/api/admin/role-room/affiliates/overview",
    );

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("super_admin_tilgang_kreves");
    expect(query).not.toHaveBeenCalled();
  });

  it("changes partner status in the same transaction as the audit record", async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      statements.push({ sql, params });
      if (sql.includes("UPDATE role_room_affiliate_partners")) {
        return {
          rows: [
            {
              id: PARTNER_ID,
              organization_id: ORG_ID,
              status: "paused",
              updated_at: "2026-09-11T10:00:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });

    const response = await request(
      buildSuperAdminRouteApp(transactionalPool(query), buildStripe()),
    )
      .patch(`/api/admin/role-room/affiliates/partners/${PARTNER_ID}/status`)
      .send({ status: "paused" });

    expect(response.status).toBe(200);
    expect(response.body.partner).toMatchObject({
      id: PARTNER_ID,
      organizationId: ORG_ID,
      status: "paused",
    });
    expect(statements[0]?.sql).toBe("BEGIN");
    expect(statements.at(-1)?.sql).toBe("COMMIT");
    expect(statements.some(({ sql }) => sql === "ROLLBACK")).toBe(false);
    expect(
      statements.some(
        ({ sql, params }) =>
          sql.includes("INSERT INTO superadmin_audit_log") &&
          params[1] === "role_room_affiliate_status" &&
          params[2] === ORG_ID,
      ),
    ).toBe(true);
  });

  it("rejects partner creation when organization identity and administration are incomplete", async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      statements.push({ sql, params });
      if (sql.includes("FROM organizations organization")) {
        return {
          rows: [
            {
              id: ORG_ID,
              organization_number: null,
              contact_email: null,
              billing_email: null,
              has_administrator: false,
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });

    const response = await request(
      buildSuperAdminRouteApp(transactionalPool(query), buildStripe()),
    )
      .post("/api/admin/role-room/affiliates/partners")
      .send({
        organizationId: ORG_ID,
        referralCode: "NORDIC15",
        commissionBasisPoints: 1500,
        storageCommissionBasisPoints: 500,
        commissionMonths: 12,
        minimumPayoutMinor: 100_000,
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: "affiliate_organization_not_ready",
      issues: [
        "organization_number_missing",
        "contact_email_missing",
        "organization_admin_missing",
      ],
    });
    expect(
      statements.some(({ sql }) =>
        sql.includes("INSERT INTO role_room_affiliate_partners"),
      ),
    ).toBe(false);
    expect(statements.at(-1)?.sql).toBe("ROLLBACK");
  });
});

describe("Role Room affiliate invoice references", () => {
  it("extracts both PaymentIntent and latest Charge from the paid invoice payment", () => {
    const invoice = {
      id: "in_paid",
      payments: {
        data: [
          {
            status: "paid",
            payment: {
              type: "payment_intent",
              payment_intent: { id: "pi_paid", latest_charge: "ch_paid" },
            },
          },
        ],
      },
    } as unknown as Stripe.Invoice;

    expect(readStripeInvoicePaymentReferences(invoice)).toEqual({
      stripePaymentIntentId: "pi_paid",
      stripeChargeId: "ch_paid",
    });
  });
});

describe("Role Room affiliate refund and chargeback ledger", () => {
  it("writes the cumulative proportional refund once and marks the event processed", async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    let paymentLookupCount = 0;
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      statements.push({ sql, params });
      if (
        sql.includes("FROM role_room_affiliate_commissions") &&
        sql.includes("stripe_charge_id")
      ) {
        paymentLookupCount += 1;
        return {
          rows: [
            {
              id: COMMISSION_ID,
              currency: "nok",
              commission_amount_minor: "15000",
              source_payment_amount_minor: "100000",
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes("INSERT INTO role_room_stripe_webhook_events")) {
        return { rows: [{ stripe_event_id: "evt_refund" }], rowCount: 1 };
      }
      if (sql.includes("AS reversed_minor")) {
        return { rows: [{ reversed_minor: "0" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    const event = {
      id: "evt_refund",
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_paid",
          object: "charge",
          amount: 100_000,
          amount_refunded: 25_000,
          payment_intent: "pi_paid",
        },
      },
    } as unknown as Stripe.Event;

    await expect(
      handleRoleRoomAffiliateStripeEvent(transactionalPool(query), event),
    ).resolves.toEqual({ matched: true });

    const adjustment = statements.find(({ sql }) =>
      sql.includes("INSERT INTO role_room_affiliate_commission_adjustments"),
    );
    expect(paymentLookupCount).toBe(2);
    expect(adjustment?.params[4]).toBe(-3750);
    expect(adjustment?.params[1]).toBe("ch_paid:refund-total:25000");
    expect(
      statements.some(
        ({ sql, params }) =>
          sql.includes("status = 'processed'") && params[0] === "evt_refund",
      ),
    ).toBe(true);
    expect(
      statements.some(({ sql }) =>
        sql.includes("received_at < NOW() - INTERVAL '10 minutes'"),
      ),
    ).toBe(true);
  });

  it("reverses a chargeback and restores the same commission only when Stripe reports it won", async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    let eventClaimCount = 0;
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      statements.push({ sql, params });
      if (
        sql.includes("FROM role_room_affiliate_commissions") &&
        sql.includes("stripe_charge_id")
      ) {
        return {
          rows: [
            {
              id: COMMISSION_ID,
              currency: "nok",
              commission_amount_minor: "15000",
              source_payment_amount_minor: "100000",
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes("INSERT INTO role_room_stripe_webhook_events")) {
        eventClaimCount += 1;
        return {
          rows: [{ stripe_event_id: `evt_${eventClaimCount}` }],
          rowCount: 1,
        };
      }
      if (sql.includes("AS net_minor"))
        return { rows: [{ net_minor: "15000" }], rowCount: 1 };
      if (
        sql.includes("kind = 'chargeback'") &&
        sql.includes("AS amount_minor")
      ) {
        return { rows: [{ amount_minor: "3750" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    const dispute = {
      id: "dp_affiliate",
      object: "dispute",
      charge: "ch_paid",
      payment_intent: "pi_paid",
      amount: 25_000,
      reason: "fraudulent",
      status: "needs_response",
    };
    const created = {
      id: "evt_dispute_created",
      type: "charge.dispute.created",
      data: { object: dispute },
    } as unknown as Stripe.Event;
    const won = {
      id: "evt_dispute_won",
      type: "charge.dispute.closed",
      data: { object: { ...dispute, status: "won" } },
    } as unknown as Stripe.Event;

    const pool = transactionalPool(query);
    await handleRoleRoomAffiliateStripeEvent(pool, created);
    await handleRoleRoomAffiliateStripeEvent(pool, won);

    const adjustmentCalls = statements.filter(({ sql }) =>
      sql.includes("INSERT INTO role_room_affiliate_commission_adjustments"),
    );
    expect(adjustmentCalls).toHaveLength(2);
    expect(adjustmentCalls[0].params[4]).toBe(-3750);
    expect(adjustmentCalls[1].params[4]).toBe(3750);
  });
});

describe("Role Room affiliate payout batches", () => {
  function buildBatchPool(options?: {
    existingPayout?: boolean;
    belowMinimum?: boolean;
    ledgerChangedBeforeTransfer?: boolean;
  }) {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    let generatedPayoutId = PAYOUT_ID;
    const queryImpl = vi.fn(
      async (sqlValue: unknown, params: unknown[] = []) => {
        const sql = String(sqlValue);
        statements.push({ sql, params });
        if (
          sql.includes("SELECT id FROM role_room_affiliate_partners") &&
          sql.includes("ORDER BY")
        ) {
          return { rows: [{ id: PARTNER_ID }], rowCount: 1 };
        }
        if (
          sql.includes("stripe_connect_onboarding_status") &&
          sql.includes("FOR UPDATE")
        ) {
          return {
            rows: [
              {
                id: PARTNER_ID,
                stripe_connect_account_id: "acct_affiliate",
                stripe_connect_onboarding_status: "complete",
                stripe_connect_payouts_enabled: true,
                stripe_connect_transfers_status: "active",
                payout_currency: "nok",
                minimum_payout_minor: "100000",
                status: "active",
              },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes("SELECT * FROM role_room_affiliate_payouts")) {
          return options?.existingPayout
            ? {
                rows: [
                  {
                    id: PAYOUT_ID,
                    affiliate_partner_id: PARTNER_ID,
                    stripe_connect_account_id: "acct_affiliate",
                    currency: "nok",
                    amount_minor: "130000",
                    minimum_payout_minor: "100000",
                    batch_period: "2026-10-01",
                    status: "pending",
                    idempotency_key: `rr-affiliate-payout:${PAYOUT_ID}`,
                    stripe_transfer_id: null,
                    attempt_count: 0,
                  },
                ],
                rowCount: 1,
              }
            : { rows: [], rowCount: 0 };
        }
        if (
          sql.includes("available_minor") &&
          sql.includes("FOR UPDATE OF commission")
        ) {
          return options?.belowMinimum
            ? {
                rows: [{ id: COMMISSION_ID, available_minor: "99999" }],
                rowCount: 1,
              }
            : {
                rows: [
                  { id: COMMISSION_ID, available_minor: "150000" },
                  {
                    id: "55555555-5555-4555-8555-555555555555",
                    available_minor: "-20000",
                  },
                ],
                rowCount: 2,
              };
        }
        if (sql.includes("INSERT INTO role_room_affiliate_payouts")) {
          generatedPayoutId = String(params[0]);
          return {
            rows: [
              {
                id: generatedPayoutId,
                affiliate_partner_id: PARTNER_ID,
                stripe_connect_account_id: "acct_affiliate",
                currency: "nok",
                amount_minor: "130000",
                minimum_payout_minor: "100000",
                batch_period: "2026-10-01",
                status: "pending",
                idempotency_key: String(params[7]),
                stripe_transfer_id: null,
                attempt_count: 0,
              },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes("available_before_payout_minor")) {
          return {
            rows: [
              {
                commission_id: COMMISSION_ID,
                amount_minor: "130000",
                available_before_payout_minor:
                  options?.ledgerChangedBeforeTransfer ? "0" : "150000",
              },
            ],
            rowCount: 1,
          };
        }
        if (
          sql.includes("UPDATE role_room_affiliate_payouts") &&
          sql.includes("RETURNING id")
        ) {
          return { rows: [{ id: generatedPayoutId }], rowCount: 1 };
        }
        if (
          sql.includes(
            "SELECT commission_id FROM role_room_affiliate_payout_items",
          )
        ) {
          return { rows: [{ commission_id: COMMISSION_ID }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      },
    );
    const client = {
      query: queryImpl,
      release: vi.fn(),
    } as unknown as PoolClient;
    const pool = {
      query: queryImpl,
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    return { pool, statements };
  }

  it("nets negative carry-forward, reserves line items and transfers only the payable balance", async () => {
    const { pool, statements } = buildBatchPool();
    const stripe = buildStripe();
    vi.mocked(stripe.transfers.create).mockImplementationOnce(
      async (params) =>
        ({
          id: "tr_affiliate",
          object: "transfer",
          amount: params.amount!,
          amount_reversed: 0,
          created: 1_799_000_000,
          currency: params.currency,
          destination: params.destination,
          reversed: false,
          metadata: params.metadata || {},
        }) as unknown as Stripe.Response<Stripe.Transfer>,
    );

    const result = await runRoleRoomAffiliatePayoutBatch(pool, stripe, {
      asOf: new Date("2026-10-01T08:00:00.000Z"),
      initiatedBy: "test",
    });

    expect(result.results[0]).toMatchObject({
      amountMinor: 130000,
      status: "transferred",
    });
    expect(stripe.transfers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 130000,
        currency: "nok",
        destination: "acct_affiliate",
        transfer_group: expect.stringContaining("role-room-affiliate:"),
      }),
      expect.objectContaining({
        idempotencyKey: expect.stringContaining("rr-affiliate-payout:"),
      }),
    );
    const item = statements.find(({ sql }) =>
      sql.includes("INSERT INTO role_room_affiliate_payout_items"),
    );
    expect(item?.params[2]).toBe(130000);
  });

  it("does not create a batch below the 1,000 NOK minimum", async () => {
    const { pool } = buildBatchPool({ belowMinimum: true });
    const stripe = buildStripe();
    const result = await runRoleRoomAffiliatePayoutBatch(pool, stripe, {
      asOf: new Date("2026-10-01T08:00:00.000Z"),
      initiatedBy: "test",
    });

    expect(result.results[0]).toMatchObject({
      status: "skipped",
      reason: "below_minimum",
    });
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });

  it("cancels reserved line items if a refund changes the ledger before Stripe transfer", async () => {
    const { pool, statements } = buildBatchPool({
      ledgerChangedBeforeTransfer: true,
    });
    const stripe = buildStripe();
    const result = await runRoleRoomAffiliatePayoutBatch(pool, stripe, {
      asOf: new Date("2026-10-01T08:00:00.000Z"),
      initiatedBy: "test-refund-race",
    });

    expect(result.results[0]).toMatchObject({
      status: "failed",
      error: "ledger_changed_before_transfer",
    });
    expect(stripe.transfers.create).not.toHaveBeenCalled();
    expect(
      statements.some(
        ({ sql }) =>
          sql.includes("SET status = 'released'") &&
          sql.includes("role_room_affiliate_payout_items"),
      ),
    ).toBe(true);
  });

  it("reconciles an existing transfer_group before retrying and never creates a duplicate transfer", async () => {
    const { pool } = buildBatchPool({ existingPayout: true });
    const stripe = buildStripe();
    vi.mocked(stripe.transfers.list).mockResolvedValueOnce({
      data: [
        {
          id: "tr_existing",
          object: "transfer",
          amount: 130000,
          amount_reversed: 0,
          created: 1_799_000_000,
          currency: "nok",
          destination: "acct_affiliate",
          reversed: false,
          metadata: { role_room_affiliate_payout_id: PAYOUT_ID },
        } as unknown as Stripe.Transfer,
      ],
    } as any);

    const result = await runRoleRoomAffiliatePayoutBatch(pool, stripe, {
      asOf: new Date("2026-10-01T08:00:00.000Z"),
      initiatedBy: "test-retry",
    });

    expect(result.results[0]).toMatchObject({
      payoutId: PAYOUT_ID,
      transferId: "tr_existing",
      status: "transferred",
    });
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });

  it("keeps the cron endpoint fail-closed until both secret and payout flag are valid", async () => {
    process.env.ROLE_ROOM_AFFILIATE_PAYOUT_CRON_SECRET =
      "a-secure-monthly-cron-secret";
    process.env.ROLE_ROOM_AFFILIATE_PAYOUTS_ENABLED = "false";
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const stripe = buildStripe();
    const app = buildRouteApp({ query } as unknown as Pool, stripe);

    const unauthorized = await request(app)
      .post("/api/internal/role-room/affiliate-payouts/run")
      .set("x-cron-secret", "wrong-secret");
    const disabled = await request(app)
      .post("/api/internal/role-room/affiliate-payouts/run")
      .set("x-cron-secret", "a-secure-monthly-cron-secret");

    expect(unauthorized.status).toBe(401);
    expect(disabled.status).toBe(409);
    expect(disabled.body.error).toBe("affiliate_payouts_deaktivert");
    expect(query).not.toHaveBeenCalled();
    delete process.env.ROLE_ROOM_AFFILIATE_PAYOUT_CRON_SECRET;
    delete process.env.ROLE_ROOM_AFFILIATE_PAYOUTS_ENABLED;
  });
});

describe("Role Room connected payout webhooks", () => {
  it("keeps bank payout status separate from the internal transfer batch", async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      statements.push({ sql, params });
      if (sql.includes("SELECT 1 FROM role_room_affiliate_partners")) {
        return { rows: [{ exists: 1 }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO role_room_stripe_webhook_events")) {
        return {
          rows: [{ stripe_event_id: "evt_payout_failed" }],
          rowCount: 1,
        };
      }
      if (sql.includes("SELECT id FROM role_room_affiliate_partners")) {
        return { rows: [{ id: PARTNER_ID }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    const event = {
      id: "evt_payout_failed",
      type: "payout.failed",
      account: "acct_affiliate",
      data: {
        object: {
          id: "po_failed",
          object: "payout",
          amount: 130000,
          currency: "nok",
          status: "failed",
          arrival_date: 1_800_000_000,
          failure_code: "account_closed",
          failure_message: "Bank account is closed",
          automatic: true,
          method: "standard",
          type: "bank_account",
        },
      },
    } as unknown as Stripe.Event;

    await expect(
      handleRoleRoomAffiliateStripeEvent({ query } as unknown as Pool, event),
    ).resolves.toEqual({ matched: true });

    expect(
      statements.some(({ sql }) =>
        sql.includes("INSERT INTO role_room_affiliate_connected_payout_events"),
      ),
    ).toBe(true);
    expect(
      statements.some(({ sql }) =>
        sql.includes("UPDATE role_room_affiliate_payouts"),
      ),
    ).toBe(false);
  });
});
