import type { Pool, PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { creditMoveMock, emitMeterMock, getSettingsMock } = vi.hoisted(() => ({
  creditMoveMock: vi.fn(),
  emitMeterMock: vi.fn(),
  getSettingsMock: vi.fn(),
}));

vi.mock('./ai-credits.js', () => ({ creditMove: creditMoveMock }));
vi.mock('./generative-media.js', () => ({
  emitGenAiMeter: emitMeterMock,
  getGenSettings: getSettingsMock,
}));

import {
  deliverStoryboardImageBillingSettlementNow,
  enqueueStoryboardImageBillingSettlement,
  tickStoryboardImageBillingSettlements,
} from './storyboard-ai-image-billing-worker.js';

interface QueryCall {
  sql: string;
  values: unknown[];
}

interface MeterRow {
  id: string;
  usage_id: string;
  kind: 'meter';
  user_id: string;
  model: string;
  amount_usd: string;
  billing_mode: 'metered';
  external_ref: string;
  delivery_deadline_at: Date;
  lease_owner: string | null;
}

class ImageBillingPool {
  readonly calls: QueryCall[] = [];
  readonly transactionCalls: QueryCall[] = [];
  settlementState: 'due' | 'retry_wait' | 'completed' = 'due';
  failCompletionUpdates = 0;
  readonly row: MeterRow = {
    id: 'settlement-meter-1',
    usage_id: 'usage-meter-1',
    kind: 'meter',
    user_id: 'user-1',
    model: 'storyboard-pencil-v1',
    amount_usd: '0.42',
    billing_mode: 'metered',
    external_ref: 'storyboard-image-meter:usage-meter-1',
    delivery_deadline_at: new Date(Date.now() + 60 * 60 * 1_000),
    lease_owner: null,
  };

  async connect(): Promise<PoolClient> {
    const query = async (sql: string, values: unknown[] = []): Promise<any> => {
      this.transactionCalls.push({ sql, values });
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('JOIN storyboard_ai_image_operations AS operation')
          || sql.includes('LEFT JOIN storyboard_ai_image_operations AS operation')) {
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`Unexpected transaction SQL: ${sql}`);
    };
    return {
      query,
      release: vi.fn(),
    } as unknown as PoolClient;
  }

  async query(sql: string, values: unknown[] = []): Promise<any> {
    this.calls.push({ sql, values });
    if (sql.includes("last_error=COALESCE(last_error,'meter_delivery_window_expired')")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('WITH due AS (')) {
      if (this.settlementState === 'completed') {
        return { rows: [], rowCount: 0 };
      }
      return {
        rows: [{ ...this.row, lease_owner: String(values[0]) }],
        rowCount: 1,
      };
    }
    if (sql.includes("SET status='completed',completed_at=NOW()")) {
      if (this.failCompletionUpdates > 0) {
        this.failCompletionUpdates -= 1;
        throw new Error('database unavailable after Stripe accepted the event');
      }
      this.settlementState = 'completed';
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("SET status=CASE WHEN kind='meter'")) {
      this.settlementState = 'retry_wait';
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected pool SQL: ${sql}`);
  }
}

const asPool = (pool: ImageBillingPool) => pool as unknown as Pool;

beforeEach(() => {
  vi.clearAllMocks();
  getSettingsMock.mockResolvedValue({
    enabled: true,
    billingMode: 'metered',
    dailyCapUsd: 20,
    whitelist: [],
    includedQuota: 0,
    markupMultiplier: 3,
    creditPacks: [],
  });
});

describe('storyboard image billing durability', () => {
  it('persists a deterministic settlement reference across enqueue retries', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ id: 'settlement-1' }],
      rowCount: 1,
    });
    const input = {
      usageId: 'usage-1',
      kind: 'meter' as const,
      userId: 'user-1',
      model: 'storyboard-pencil-v1',
      amountUsd: 0.42,
      billingMode: 'metered',
    };

    await enqueueStoryboardImageBillingSettlement({ query } as never, input);
    await enqueueStoryboardImageBillingSettlement({ query } as never, input);

    expect(query).toHaveBeenCalledTimes(2);
    for (const [sql, values] of query.mock.calls) {
      expect(sql).toContain('ON CONFLICT (usage_id,kind)');
      expect(sql).toContain('amount_usd=EXCLUDED.amount_usd');
      expect(values[7]).toBe('storyboard-image-meter:usage-1');
    }
  });

  it('fails closed when an enqueue retry conflicts with stored financial identity', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });

    await expect(enqueueStoryboardImageBillingSettlement({ query } as never, {
      usageId: 'usage-1', kind: 'meter', userId: 'user-1',
      model: 'storyboard-pencil-v1', amountUsd: 0.43,
      billingMode: 'metered',
    })).rejects.toThrow('storyboard_image_billing_settlement_conflict');

    expect(String(query.mock.calls[0][0])).toContain(
      'storyboard_ai_image_billing_settlements.amount_usd=EXCLUDED.amount_usd',
    );
  });

  it('does not meter a completed settlement again on a later worker sweep', async () => {
    const db = new ImageBillingPool();
    emitMeterMock.mockResolvedValue({ emitted: true, billedUsd: 0.42 });

    await expect(tickStoryboardImageBillingSettlements(asPool(db), {
      workerId: 'image-worker',
    })).resolves.toMatchObject({ claimed: 1, completed: 1 });
    await expect(tickStoryboardImageBillingSettlements(asPool(db), {
      workerId: 'image-worker',
    })).resolves.toMatchObject({ claimed: 0, completed: 0 });

    expect(emitMeterMock).toHaveBeenCalledOnce();
    expect(emitMeterMock).toHaveBeenCalledWith(
      asPool(db),
      expect.objectContaining({
        billedUsdOverride: 0.42,
        meterEventIdentifier: 'storyboard-image-usage-meter-1',
        idempotencyKey: 'storyboard-image-meter:usage-meter-1',
        stripeTimeoutMs: 20_000,
        stripeMaxNetworkRetries: 0,
      }),
    );
  });

  it('reuses the same Stripe identifiers after a crash between emission and completion', async () => {
    const db = new ImageBillingPool();
    db.failCompletionUpdates = 1;
    emitMeterMock.mockResolvedValue({ emitted: true, billedUsd: 0.42 });

    await expect(tickStoryboardImageBillingSettlements(asPool(db), {
      workerId: 'image-worker-a',
      batchSize: 4,
      leaseSeconds: 90,
    })).resolves.toMatchObject({ claimed: 1, retrying: 1, completed: 0 });
    await expect(tickStoryboardImageBillingSettlements(asPool(db), {
      workerId: 'image-worker-b',
      batchSize: 4,
      leaseSeconds: 90,
    })).resolves.toMatchObject({ claimed: 1, retrying: 0, completed: 1 });

    expect(emitMeterMock).toHaveBeenCalledTimes(2);
    const first = emitMeterMock.mock.calls[0][1];
    const second = emitMeterMock.mock.calls[1][1];
    expect(first.meterEventIdentifier).toBe('storyboard-image-usage-meter-1');
    expect(second.meterEventIdentifier).toBe(first.meterEventIdentifier);
    expect(first.idempotencyKey).toBe('storyboard-image-meter:usage-meter-1');
    expect(second.idempotencyKey).toBe(first.idempotencyKey);

    const claims = db.calls.filter((call) => call.sql.includes('WITH due AS ('));
    expect(claims).toHaveLength(2);
    expect(claims[0].values).toEqual(['image-worker-a', 4, 130]);
    expect(claims[1].values).toEqual(['image-worker-b', 4, 130]);
  });

  it('does not report completion when the lease-owner CAS was lost', async () => {
    class LeaseLostPool extends ImageBillingPool {
      override async query(sql: string, values: unknown[] = []): Promise<any> {
        if (sql.includes("SET status='completed',completed_at=NOW()")) {
          this.calls.push({ sql, values });
          return { rows: [], rowCount: 0 };
        }
        return super.query(sql, values);
      }
    }
    const db = new LeaseLostPool();
    emitMeterMock.mockResolvedValue({ emitted: true, billedUsd: 0.42 });

    await expect(tickStoryboardImageBillingSettlements(asPool(db), {
      workerId: 'image-worker-lease-lost',
    })).resolves.toMatchObject({ claimed: 1, completed: 0, retrying: 1 });
  });

  it('isolates an unexpected failure on one claimed row and continues the batch', async () => {
    class IsolatedRowPool extends ImageBillingPool {
      override async query(sql: string, values: unknown[] = []): Promise<any> {
        if (sql.includes('WITH due AS (')) {
          this.calls.push({ sql, values });
          return {
            rows: [
              { ...this.row, id: 'broken-row', lease_owner: String(values[0]) },
              {
                ...this.row,
                id: 'healthy-row',
                usage_id: 'usage-meter-2',
                external_ref: 'storyboard-image-meter:usage-meter-2',
                lease_owner: String(values[0]),
              },
            ],
            rowCount: 2,
          };
        }
        if (sql.includes("SET status=CASE WHEN kind='meter'")
            && values[0] === 'broken-row') {
          this.calls.push({ sql, values });
          throw new Error('retry persistence unavailable');
        }
        return super.query(sql, values);
      }
    }
    const db = new IsolatedRowPool();
    emitMeterMock
      .mockRejectedValueOnce(new Error('first provider call failed'))
      .mockResolvedValueOnce({ emitted: true, billedUsd: 0.42 });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(tickStoryboardImageBillingSettlements(asPool(db), {
      workerId: 'image-worker-isolation',
      batchSize: 2,
    })).resolves.toMatchObject({ claimed: 2, completed: 1, retrying: 1 });
    expect(emitMeterMock).toHaveBeenCalledTimes(2);
  });

  it('never abandons a processing operation after the provider boundary', async () => {
    const db = new ImageBillingPool();
    db.settlementState = 'completed';

    await tickStoryboardImageBillingSettlements(asPool(db), {
      workerId: 'image-worker',
    });

    const abandonment = db.transactionCalls.find((call) => (
      call.sql.includes("operation.status IN ('claimed','failed')")
    ));
    expect(abandonment?.sql).toContain("operation.status IN ('claimed','failed')");
    expect(abandonment?.sql).not.toContain("operation.status IN ('claimed','processing')");
    expect(abandonment?.sql).not.toContain("operation.status IN ('claimed','failed','processing')");
    expect(abandonment?.sql).toContain('FOR UPDATE OF usage,operation SKIP LOCKED');
  });

  it('requires at least the full 90-second lease window before a direct meter claim', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith('UPDATE storyboard_ai_image_billing_settlements')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.startsWith('SELECT status')) {
        return { rows: [{ status: 'pending' }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    await expect(deliverStoryboardImageBillingSettlementNow(
      { query } as unknown as Pool,
      { usageId: 'usage-near-deadline', kind: 'meter' },
    )).resolves.toBe('retrying');

    const claim = String(query.mock.calls[0][0]);
    expect(claim).toContain("lease_expires_at=NOW()+INTERVAL '90 seconds'");
    expect(claim).toMatch(
      /delivery_deadline_at\s*>=?\s*NOW\(\)\s*\+\s*INTERVAL '90 seconds'/,
    );
  });
});
