import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  deliverImageBillingMock, enqueueImageBillingMock, getCreditsMock,
  meterEligibilityMock, settingsMock,
} = vi.hoisted(() => ({
  deliverImageBillingMock: vi.fn(async () => 'completed'),
  enqueueImageBillingMock: vi.fn(async () => true),
  getCreditsMock: vi.fn(async () => ({ balanceUsd: 100, purchasedUsd: 100, spentUsd: 0 })),
  meterEligibilityMock: vi.fn(async () => ({
    eligible: true, customerId: 'cus_role_room', subscriptionId: 'sub_role_room',
  })),
  settingsMock: vi.fn(async () => ({
    enabled: true, billingMode: 'free_whitelist', dailyCapUsd: 20,
    whitelist: ['director@example.com'], includedQuota: 0,
    markupMultiplier: 3, creditPacks: [],
  })),
}));

vi.mock('./generative-media.js', () => ({
  getGenSettings: settingsMock,
  verifyGenAiMeterEligibility: meterEligibilityMock,
}));

vi.mock('./ai-credits.js', () => ({
  getUserCredits: getCreditsMock,
}));

vi.mock('./storyboard-ai-image-billing-worker.js', () => ({
  deliverStoryboardImageBillingSettlementNow: deliverImageBillingMock,
  enqueueStoryboardImageBillingSettlement: enqueueImageBillingMock,
}));

import {
  completeStoryboardImageCost,
  failStoryboardImageCost,
  reserveStoryboardImageCost,
  StoryboardAICostError,
} from './storyboard-ai-cost-control.js';

function costPool(
  spent: number,
  options: {
    completedUsage?: Record<string, unknown> | null;
    failedUsage?: Record<string, unknown> | null;
  } = {},
) {
  const client = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes(' AS spent')) return { rows: [{ spent }] };
      if (sql.includes("SET status='completed'")) {
        return { rows: options.completedUsage ? [options.completedUsage] : [], rowCount: options.completedUsage ? 1 : 0 };
      }
      if (sql.includes("SET status='failed'")) {
        return { rows: options.failedUsage ? [options.failedUsage] : [], rowCount: options.failedUsage ? 1 : 0 };
      }
      return { rows: [], rowCount: 1 };
    }),
    release: vi.fn(),
  };
  const pool = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('FROM generative_ai_jobs')) return { rows: [{ spent: 0 }] };
      return { rows: [], rowCount: 0 };
    }),
    connect: vi.fn(async () => client),
  };
  return { pool: pool as any, client };
}

describe('Storyboard image cost control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsMock.mockResolvedValue({
      enabled: true, billingMode: 'free_whitelist', dailyCapUsd: 20,
      whitelist: ['director@example.com'], includedQuota: 0,
      markupMultiplier: 3, creditPacks: [],
    });
    meterEligibilityMock.mockResolvedValue({
      eligible: true, customerId: 'cus_role_room', subscriptionId: 'sub_role_room',
    });
    deliverImageBillingMock.mockResolvedValue('completed');
    enqueueImageBillingMock.mockResolvedValue(true);
  });

  it('reserves free usage and completes without a financial side effect', async () => {
    const { pool, client } = costPool(0, {
      completedUsage: {
        id: 'reservation-free', user_id: 'director', model: 'gpt-image-1-mini',
        billed_usd: 0, billing_mode: 'free_whitelist', billing_intent_version: 1,
      },
    });
    const reservation = await reserveStoryboardImageCost(pool, {
      projectId: 'troll-project-2026',
      storyboardId: '00000000-0000-0000-0000-000000000001',
      userId: 'director', model: 'gpt-image-1-mini', quality: 'standard',
    });

    expect(reservation.estimatedCostUsd).toBe(0.06);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'));
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO storyboard_ai_image_usage'), expect.any(Array),
    );
    await completeStoryboardImageCost(pool, reservation.id);
    expect(enqueueImageBillingMock).not.toHaveBeenCalled();
    expect(deliverImageBillingMock).not.toHaveBeenCalled();
  });

  it('commits metered completion and its stable outbox intent atomically', async () => {
    const { pool, client } = costPool(0, {
      completedUsage: {
        id: 'reservation-metered', user_id: 'director', model: 'gpt-image-2',
        billed_usd: 0.72, billing_mode: 'metered', billing_intent_version: 1,
      },
    });

    await completeStoryboardImageCost(pool, 'reservation-metered');

    expect(enqueueImageBillingMock).toHaveBeenCalledWith(client, {
      usageId: 'reservation-metered', kind: 'meter', userId: 'director',
      model: 'gpt-image-2', amountUsd: 0.72, billingMode: 'metered',
    });
    expect(client.query.mock.calls.map(([sql]) => String(sql))).toEqual(
      expect.arrayContaining(['BEGIN', 'COMMIT']),
    );
    expect(deliverImageBillingMock).not.toHaveBeenCalled();
  });

  it('rolls completion back if the meter intent cannot be persisted', async () => {
    enqueueImageBillingMock.mockRejectedValueOnce(new Error('outbox unavailable'));
    const { pool, client } = costPool(0, {
      completedUsage: {
        id: 'reservation-metered', user_id: 'director', model: 'gpt-image-2',
        billed_usd: 0.72, billing_mode: 'metered', billing_intent_version: 1,
      },
    });

    await expect(completeStoryboardImageCost(
      pool, 'reservation-metered',
    )).rejects.toThrow('outbox unavailable');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(deliverImageBillingMock).not.toHaveBeenCalled();
  });

  it('fails closed when the global daily cap would be exceeded', async () => {
    settingsMock.mockResolvedValueOnce({
      enabled: true, billingMode: 'free_whitelist', dailyCapUsd: 0.05,
      whitelist: [], includedQuota: 0, markupMultiplier: 3, creditPacks: [],
    });
    const { pool, client } = costPool(0);

    await expect(reserveStoryboardImageCost(pool, {
      projectId: 'troll-project-2026',
      storyboardId: '00000000-0000-0000-0000-000000000001',
      userId: 'director', model: 'gpt-image-1-mini', quality: 'standard',
    })).rejects.toMatchObject<Partial<StoryboardAICostError>>({
      status: 429, code: 'daily_cap',
    });
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO storyboard_ai_image_usage'), expect.any(Array),
    );
  });

  it('rejects an unbillable metered account before reservation/provider flow', async () => {
    settingsMock.mockResolvedValueOnce({
      enabled: true, billingMode: 'metered', dailyCapUsd: 20,
      whitelist: [], includedQuota: 0, markupMultiplier: 3, creditPacks: [],
    });
    meterEligibilityMock.mockResolvedValueOnce({
      eligible: false, reason: 'no_customer',
    });
    const { pool, client } = costPool(0);

    await expect(reserveStoryboardImageCost(pool, {
      projectId: 'troll-project-2026',
      storyboardId: '00000000-0000-0000-0000-000000000001',
      userId: 'director', model: 'gpt-image-1-mini', quality: 'standard',
      operationId: 'operation-metered',
    })).rejects.toMatchObject<Partial<StoryboardAICostError>>({
      status: 402, code: 'metered_billing_required',
    });

    expect(meterEligibilityMock).toHaveBeenCalledOnce();
    expect(pool.connect).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
    expect(enqueueImageBillingMock).not.toHaveBeenCalled();
    expect(deliverImageBillingMock).not.toHaveBeenCalled();
  });

  it.each(['credits', 'metered'] as const)(
    'requires an operation id for %s billing before any reservation',
    async (billingMode) => {
      settingsMock.mockResolvedValueOnce({
        enabled: true, billingMode, dailyCapUsd: 20,
        whitelist: [], includedQuota: 0, markupMultiplier: 3, creditPacks: [],
      });
      const { pool, client } = costPool(0);

      await expect(reserveStoryboardImageCost(pool, {
        projectId: 'troll-project-2026',
        storyboardId: '00000000-0000-0000-0000-000000000001',
        userId: 'director', model: 'gpt-image-2', quality: 'hd',
      })).rejects.toMatchObject({
        status: 400, code: 'billing_operation_id_required',
      });
      expect(client.query).not.toHaveBeenCalled();
      expect(enqueueImageBillingMock).not.toHaveBeenCalled();
    },
  );

  it('persists and delivers a credit debit before returning the reservation', async () => {
    settingsMock.mockResolvedValueOnce({
      enabled: true, billingMode: 'credits', dailyCapUsd: 20,
      whitelist: [], includedQuota: 0, markupMultiplier: 3, creditPacks: [],
    });
    const { pool, client } = costPool(0);

    const reservation = await reserveStoryboardImageCost(pool, {
      projectId: 'troll-project-2026',
      storyboardId: '00000000-0000-0000-0000-000000000001',
      userId: 'director', model: 'gpt-image-2', quality: 'hd',
      operationId: 'operation-credit',
    });

    expect(enqueueImageBillingMock).toHaveBeenCalledWith(client, expect.objectContaining({
      usageId: reservation.id, kind: 'credit_debit', amountUsd: 0.66,
      billingMode: 'credits',
    }));
    expect(deliverImageBillingMock).toHaveBeenCalledWith(pool, {
      usageId: reservation.id, kind: 'credit_debit',
    });
  });

  it('reuses the unique reservation for an operation recovery', async () => {
    const { pool, client } = costPool(0);
    pool.query.mockImplementation(async (sql: string) => {
      if (sql.includes('WHERE operation_id=$1')) {
        return {
          rows: [{
            id: 'reservation-existing',
            project_id: 'troll-project-2026',
            storyboard_id: '00000000-0000-0000-0000-000000000001',
            user_id: 'director', model: 'gpt-image-2', quality: 'hd',
            operation_id: 'operation-existing', est_cost_usd: 0.24,
            billed_usd: 0, billing_mode: 'free_whitelist',
            billing_intent_version: 1, status: 'reserved',
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(reserveStoryboardImageCost(pool, {
      projectId: 'troll-project-2026',
      storyboardId: '00000000-0000-0000-0000-000000000001',
      userId: 'director',
      model: 'gpt-image-2',
      quality: 'hd',
      operationId: 'operation-existing',
    })).resolves.toEqual({
      id: 'reservation-existing',
      estimatedCostUsd: 0.24,
    });
    expect(client.query).not.toHaveBeenCalled();
  });

  it('fails closed when an operation retry does not match its stored billing identity', async () => {
    const { pool, client } = costPool(0);
    pool.query.mockImplementation(async (sql: string) => {
      if (sql.includes('WHERE operation_id=$1')) {
        return {
          rows: [{
            id: 'reservation-owner-a', project_id: 'troll-project-2026',
            storyboard_id: '00000000-0000-0000-0000-000000000001',
            user_id: 'owner-a', model: 'gpt-image-2', quality: 'hd',
            operation_id: 'operation-owner-a', est_cost_usd: 0.24,
            billed_usd: 0.72, billing_mode: 'metered',
            billing_intent_version: 1, status: 'reserved',
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(reserveStoryboardImageCost(pool, {
      projectId: 'troll-project-2026',
      storyboardId: '00000000-0000-0000-0000-000000000001',
      userId: 'owner-b', model: 'gpt-image-2', quality: 'hd',
      operationId: 'operation-owner-a',
    })).rejects.toMatchObject({
      status: 409, code: 'billing_operation_identity_mismatch',
    });
    expect(meterEligibilityMock).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
  });

  it('does not resume a historical paid reservation without a durable intent sentinel', async () => {
    const { pool, client } = costPool(0);
    pool.query.mockImplementation(async (sql: string) => {
      if (sql.includes('WHERE operation_id=$1')) {
        return {
          rows: [{
            id: 'reservation-legacy-paid', project_id: 'troll-project-2026',
            storyboard_id: '00000000-0000-0000-0000-000000000001',
            user_id: 'director', model: 'gpt-image-2', quality: 'hd',
            operation_id: 'operation-legacy-paid', est_cost_usd: 0.22,
            billed_usd: 0.66, billing_mode: 'credits',
            billing_intent_version: null, status: 'reserved',
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(reserveStoryboardImageCost(pool, {
      projectId: 'troll-project-2026',
      storyboardId: '00000000-0000-0000-0000-000000000001',
      userId: 'director', model: 'gpt-image-2', quality: 'hd',
      operationId: 'operation-legacy-paid',
    })).rejects.toMatchObject({ status: 409, code: 'billing_intent_unknown' });
    expect(client.query).not.toHaveBeenCalled();
    expect(meterEligibilityMock).not.toHaveBeenCalled();
    expect(enqueueImageBillingMock).not.toHaveBeenCalled();
    expect(deliverImageBillingMock).not.toHaveBeenCalled();
  });

  it('does not fail or refund a reserved usage whose provider operation completed', async () => {
    const { pool, client } = costPool(0, { failedUsage: null });

    await failStoryboardImageCost(pool, 'reservation-completed-provider', 'completion write failed');

    const guardedFailure = client.query.mock.calls
      .map(([sql]) => String(sql))
      .find((sql) => sql.includes("SET status='failed'"));
    expect(guardedFailure).toContain('NOT EXISTS');
    expect(guardedFailure).toContain("operation.status='completed'");
    expect(enqueueImageBillingMock).not.toHaveBeenCalled();
    expect(deliverImageBillingMock).not.toHaveBeenCalled();
    expect(client.query.mock.calls.map(([sql]) => String(sql)))
      .toEqual(expect.arrayContaining(['BEGIN', 'COMMIT']));
  });
});
