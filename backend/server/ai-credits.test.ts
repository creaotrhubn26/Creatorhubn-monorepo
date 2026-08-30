import { describe, expect, it, vi } from 'vitest';
import { creditMove } from './ai-credits.js';

describe('creditMove refund accounting', () => {
  it('restores balance without increasing lifetime purchases', async () => {
    const statements: Array<{ sql: string; params?: unknown[] }> = [];
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        statements.push({ sql, params });
        if (sql.includes('INSERT INTO ai_credit_ledger')) {
          return { rows: [{ id: 'ledger-refund' }] };
        }
        if (sql.includes('INSERT INTO user_ai_credits')) {
          return { rows: [{ balance_usd: 8.5 }] };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async () => ({ rows: [] })),
      connect: vi.fn(async () => client),
    } as any;

    await expect(creditMove(
      pool, 'director', 'refund', 1.5,
      'storyboard-image-refund:job-1', 'provider failure',
    )).resolves.toBe(true);

    const wallet = statements.find(({ sql }) => sql.includes('INSERT INTO user_ai_credits'));
    expect(wallet?.sql).toContain('lifetime_spent_usd = GREATEST(0');
    expect(wallet?.sql).not.toContain(
      'lifetime_purchased_usd = user_ai_credits.lifetime_purchased_usd +',
    );
    expect(wallet?.params).toEqual(['director', 1.5]);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('keeps purchase top-ups in the lifetime purchase counter', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO ai_credit_ledger')) {
          return { rows: [{ id: 'ledger-purchase' }] };
        }
        if (sql.includes('INSERT INTO user_ai_credits')) {
          return { rows: [{ balance_usd: 10 }] };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async () => ({ rows: [] })),
      connect: vi.fn(async () => client),
    } as any;

    await expect(creditMove(
      pool, 'director', 'purchase', 10, 'stripe:session-1', 'credit pack',
    )).resolves.toBe(true);

    const purchaseSql = client.query.mock.calls
      .map(([sql]) => String(sql))
      .find((sql) => sql.includes('INSERT INTO user_ai_credits'));
    expect(purchaseSql).toContain(
      'lifetime_purchased_usd = user_ai_credits.lifetime_purchased_usd + $2',
    );
  });
});
