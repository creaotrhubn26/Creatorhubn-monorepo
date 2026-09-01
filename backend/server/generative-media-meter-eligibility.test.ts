import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyGenAiMeterEligibility, type GenSettings } from './generative-media.js';

const meteredSettings: GenSettings = {
  enabled: true,
  billingMode: 'metered',
  dailyCapUsd: 20,
  whitelist: [],
  includedQuota: 0,
  markupMultiplier: 3,
  creditPacks: [],
};

describe('verifyGenAiMeterEligibility', () => {
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  const originalMeter = process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME;

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_meter_gate';
    process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME = 'gen_ai_usage';
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalSecret;
    if (originalMeter === undefined) delete process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME;
    else process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME = originalMeter;
    vi.restoreAllMocks();
  });

  it('fails before Stripe I/O when the user has no linked customer', async () => {
    const stripeClient = {
      customers: { retrieve: vi.fn() },
      subscriptions: { retrieve: vi.fn() },
    };
    const pool = { query: vi.fn(async () => ({ rows: [] })) } as any;

    await expect(verifyGenAiMeterEligibility(pool, {
      userId: 'user-no-customer', settings: meteredSettings, stripeClient,
    })).resolves.toEqual({ eligible: false, reason: 'no_customer' });
    expect(stripeClient.customers.retrieve).not.toHaveBeenCalled();
    expect(stripeClient.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it('accepts only a live active subscription bound to the linked customer', async () => {
    const pool = {
      query: vi.fn(async (sql: string) => sql.includes('stripe_customers')
        ? { rows: [{ stripe_customer_id: 'cus_role_room' }] }
        : { rows: [{ stripe_subscription_id: 'sub_role_room', status: 'active' }] }),
    } as any;
    const stripeClient = {
      customers: { retrieve: vi.fn(async () => ({ id: 'cus_role_room', deleted: false })) },
      subscriptions: { retrieve: vi.fn(async () => ({
        id: 'sub_role_room', status: 'active', customer: 'cus_role_room',
      })) },
    };

    await expect(verifyGenAiMeterEligibility(pool, {
      userId: 'director', settings: meteredSettings, stripeClient,
    })).resolves.toEqual({
      eligible: true,
      customerId: 'cus_role_room',
      subscriptionId: 'sub_role_room',
    });
  });

  it('fails closed when Stripe binds the subscription to another customer', async () => {
    const pool = {
      query: vi.fn(async (sql: string) => sql.includes('stripe_customers')
        ? { rows: [{ stripe_customer_id: 'cus_expected' }] }
        : { rows: [{ stripe_subscription_id: 'sub_role_room', status: 'trialing' }] }),
    } as any;
    const stripeClient = {
      customers: { retrieve: vi.fn(async () => ({ id: 'cus_expected', deleted: false })) },
      subscriptions: { retrieve: vi.fn(async () => ({
        id: 'sub_role_room', status: 'trialing', customer: 'cus_other',
      })) },
    };

    await expect(verifyGenAiMeterEligibility(pool, {
      userId: 'director', settings: meteredSettings, stripeClient,
    })).resolves.toEqual({
      eligible: false,
      reason: 'subscription_customer_mismatch',
    });
  });
});
