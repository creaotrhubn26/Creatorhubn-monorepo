import { Pool } from "pg";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  handleRoleRoomAffiliateStripeEvent,
  runRoleRoomAffiliatePayoutBatch,
} from "./role-room-affiliate-payouts.js";

const databaseUrl = process.env.ROLE_ROOM_AFFILIATE_TEST_DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

const ORGANIZATION_ID = "10000000-0000-4000-8000-000000000001";
const REFERRED_ORGANIZATION_ID = "10000000-0000-4000-8000-000000000002";
const PARTNER_ID = "20000000-0000-4000-8000-000000000001";
const REFERRAL_ID = "30000000-0000-4000-8000-000000000001";
const COMMISSION_ID = "40000000-0000-4000-8000-000000000001";

describeWithDatabase(
  "Role Room affiliate payout PostgreSQL integration",
  () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const stripe = {
      transfers: {
        list: vi.fn(async () => ({ data: [] })),
        create: vi.fn(async (params: Stripe.TransferCreateParams) => ({
          id: "tr_postgres_integration",
          object: "transfer",
          amount: params.amount!,
          amount_reversed: 0,
          created: 1_799_000_000,
          currency: params.currency,
          destination: params.destination,
          reversed: false,
          metadata: params.metadata || {},
        })),
        retrieve: vi.fn(),
      },
    } as unknown as Stripe;

    beforeAll(async () => {
      await pool.query(
        `INSERT INTO organizations (id, name) VALUES
         ($1::uuid, 'Affiliate Org'), ($2::uuid, 'Customer Org')`,
        [ORGANIZATION_ID, REFERRED_ORGANIZATION_ID],
      );
      await pool.query(
        `INSERT INTO role_room_affiliate_partners (
         id, organization_id, referral_code, status,
         stripe_connect_account_id, stripe_connect_onboarding_status,
         stripe_connect_details_submitted, stripe_connect_payouts_enabled,
         stripe_connect_transfers_status, payout_currency, minimum_payout_minor
       ) VALUES ($1::uuid, $2::uuid, 'PGTEST', 'active', 'acct_pg_test',
                 'complete', TRUE, TRUE, 'active', 'nok', 100000)`,
        [PARTNER_ID, ORGANIZATION_ID],
      );
      await pool.query(
        `INSERT INTO role_room_affiliate_referrals (
         id, affiliate_partner_id, referred_organization_id
       ) VALUES ($1::uuid, $2::uuid, $3::uuid)`,
        [REFERRAL_ID, PARTNER_ID, REFERRED_ORGANIZATION_ID],
      );
      await pool.query(
        `INSERT INTO role_room_affiliate_commissions (
         id, affiliate_referral_id, stripe_invoice_id, currency,
         eligible_revenue_minor, commission_basis_points,
         commission_amount_minor, source_payment_amount_minor, status,
         stripe_payment_intent_id, stripe_charge_id, matures_at
       ) VALUES ($1::uuid, $2::uuid, 'in_pg_test', 'nok', 800000, 1500,
                 120000, 800000, 'accrued', 'pi_pg_test', 'ch_pg_test',
                 '2026-08-01T00:00:00Z')`,
        [COMMISSION_ID, REFERRAL_ID],
      );
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates one real DB batch and persists the Stripe transfer idempotently", async () => {
      const result = await runRoleRoomAffiliatePayoutBatch(pool, stripe, {
        asOf: new Date("2026-10-01T08:00:00Z"),
        initiatedBy: "postgres-integration",
      });

      expect(result.results[0]).toMatchObject({
        amountMinor: 120000,
        status: "transferred",
        transferId: "tr_postgres_integration",
      });
      const persisted = await pool.query<{
        payout_status: string;
        stripe_transfer_id: string;
        item_status: string;
        commission_status: string;
      }>(
        `SELECT payout.status AS payout_status, payout.stripe_transfer_id,
              item.status AS item_status, commission.status AS commission_status
         FROM role_room_affiliate_payouts payout
         JOIN role_room_affiliate_payout_items item ON item.payout_id = payout.id
         JOIN role_room_affiliate_commissions commission ON commission.id = item.commission_id
        WHERE payout.affiliate_partner_id = $1::uuid`,
        [PARTNER_ID],
      );
      expect(persisted.rows[0]).toMatchObject({
        payout_status: "transferred",
        stripe_transfer_id: "tr_postgres_integration",
        item_status: "transferred",
        commission_status: "paid",
      });
    });

    it("records a full post-payout refund as negative carry-forward without mutating history", async () => {
      const event = {
        id: "evt_pg_refund",
        type: "charge.refunded",
        data: {
          object: {
            id: "ch_pg_test",
            object: "charge",
            amount: 800000,
            amount_refunded: 800000,
            payment_intent: "pi_pg_test",
          },
        },
      } as unknown as Stripe.Event;

      await expect(
        handleRoleRoomAffiliateStripeEvent(pool, event),
      ).resolves.toEqual({ matched: true });
      const ledger = await pool.query<{
        adjustment_minor: string;
        commission_status: string;
        available_minor: string;
      }>(
        `SELECT SUM(adjustment.amount_minor)::bigint AS adjustment_minor,
              commission.status AS commission_status,
              (commission.commission_amount_minor
                + SUM(adjustment.amount_minor)
                - SUM(item.amount_minor - item.reversed_amount_minor))::bigint AS available_minor
         FROM role_room_affiliate_commissions commission
         JOIN role_room_affiliate_commission_adjustments adjustment
           ON adjustment.commission_id = commission.id
         JOIN role_room_affiliate_payout_items item ON item.commission_id = commission.id
        WHERE commission.id = $1::uuid
        GROUP BY commission.id`,
        [COMMISSION_ID],
      );
      expect(ledger.rows[0]).toMatchObject({
        adjustment_minor: "-120000",
        commission_status: "reversed",
        available_minor: "-120000",
      });
    });
  },
);
