import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAnalyticsSnapshot,
  getFeedStatusSnapshot,
  getInboxSnapshot,
  getLeadFunnelSnapshot,
} from './role-room-agent-workspace-data';

interface QueryRow { sql: string; args: unknown[]; }

/**
 * Minimal mock pool. `impl(sql, args)` decides what each query returns; every
 * call is recorded so tests can assert scoping (which params were bound). Also
 * exposes connect() returning a client with query/release for parity with the
 * marketing-plan-posts test harness (not used by these read-only functions,
 * but kept so the shape matches `Pool`).
 */
function makePool(
  impl: (sql: string, args: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>,
) {
  const queries: QueryRow[] = [];
  const query = vi.fn(async (sql: string, args: unknown[] = []) => {
    queries.push({ sql, args });
    return impl(sql, args);
  });
  const release = vi.fn();
  const client = { query, release };
  const connect = vi.fn(async () => client);
  return { pool: { query, connect } as never, queries };
}

const USER = 'user-42';

describe('getInboxSnapshot', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes every query to the caller userId and shapes populated data', async () => {
    const { pool, queries } = makePool(async (sql) => {
      if (sql.includes('GROUP BY platform, sentiment_label, is_read')) {
        return {
          rows: [
            { platform: 'instagram', sentiment_label: 'negative', is_read: false, n: 3 },
            { platform: 'instagram', sentiment_label: 'positive', is_read: true, n: 5 },
            { platform: 'linkedin', sentiment_label: null, is_read: false, n: 2 },
          ],
        };
      }
      // topNegative fetch
      return {
        rows: [
          {
            id: 'evt-1',
            platform: 'instagram',
            author_username: 'kari',
            author_display_name: 'Kari N',
            body: 'Dårlig opplevelse',
            sentiment_label: 'negative',
            is_read: false,
            received_at: new Date('2026-06-20T10:00:00Z'),
          },
        ],
      };
    });

    const snap = await getInboxSnapshot(pool, USER, { sinceDays: 14 });

    expect(snap.totalEvents).toBe(10);
    expect(snap.unread).toBe(5); // 3 + 2
    expect(snap.byPlatform).toEqual({ instagram: 8, linkedin: 2 });
    expect(snap.sentimentBreakdown).toEqual({ negative: 3, positive: 5 });
    expect(snap.topNegative).toHaveLength(1);
    expect(snap.topNegative[0]).toMatchObject({ id: 'evt-1', author: 'Kari N', sentimentLabel: 'negative' });
    expect(snap.topNegative[0].receivedAt).toBe('2026-06-20T10:00:00.000Z');
    expect(typeof snap.generatedAt).toBe('string');

    // Every query binds the userId as $1, and the sinceDays as $2.
    expect(queries.length).toBeGreaterThanOrEqual(2);
    for (const q of queries) {
      expect(q.args[0]).toBe(USER);
      expect(q.args[1]).toBe(14);
      // Scope subquery references the owned-account tables.
      expect(q.sql).toContain('role_room_instagram_connections');
      expect(q.sql).toContain('user_id = $1');
    }
  });

  it('returns the safe empty shape when there are no rows', async () => {
    const { pool } = makePool(async () => ({ rows: [] }));
    const snap = await getInboxSnapshot(pool, USER);
    expect(snap.totalEvents).toBe(0);
    expect(snap.unread).toBe(0);
    expect(snap.byPlatform).toEqual({});
    expect(snap.sentimentBreakdown).toEqual({});
    expect(snap.topNegative).toEqual([]);
  });

  it('never throws when a query rejects', async () => {
    const { pool } = makePool(async () => { throw new Error('db offline'); });
    const snap = await getInboxSnapshot(pool, USER);
    expect(snap.totalEvents).toBe(0);
    expect(snap.topNegative).toEqual([]);
  });
});

describe('getLeadFunnelSnapshot', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aggregates segments/stages/spend scoped to userId and computes ROI', async () => {
    const { pool, queries } = makePool(async (sql) => {
      if (sql.includes('FROM role_room_lead_segments') && sql.includes('GROUP BY segment')) {
        return { rows: [{ segment: 'varm', n: 4 }, { segment: 'kald', n: 2 }] };
      }
      if (sql.includes('FROM role_room_lead_outcomes') && sql.includes('GROUP BY stage')) {
        return {
          rows: [
            { stage: 'kunde', n: 2, sum_value: 50000 },
            { stage: 'svart', n: 3, sum_value: 0 },
          ],
        };
      }
      if (sql.includes('FROM role_room_lead_spend')) {
        return { rows: [{ spend_kr: 10000 }] };
      }
      if (sql.includes('count(DISTINCT lead_external_id)')) {
        return { rows: [{ n: 9 }] };
      }
      // cold leads
      return { rows: [{ lead_external_id: 'lead-7', reason: 'spurte om pris' }] };
    });

    const snap = await getLeadFunnelSnapshot(pool, USER);

    expect(snap.totalLeads).toBe(9);
    expect(snap.bySegment).toEqual({ varm: 4, kald: 2 });
    expect(snap.byStage).toEqual({ kunde: 2, svart: 3 });
    expect(snap.roi.spendKr).toBe(10000);
    expect(snap.roi.revenueKr).toBe(50000);
    expect(snap.roi.costPerCustomerKr).toBe(5000); // 10000 / 2 customers
    expect(snap.coldLeads).toEqual([{ leadId: 'lead-7', reason: 'spurte om pris' }]);

    // All five queries scope on userId as the first bound param.
    for (const q of queries) {
      expect(q.args[0]).toBe(USER);
    }
  });

  it('binds connectionId + formId into the scoped queries', async () => {
    const { pool, queries } = makePool(async () => ({ rows: [] }));
    await getLeadFunnelSnapshot(pool, USER, { connectionId: 'conn-1', formId: 'form-9' });

    const outcomes = queries.find((q) => q.sql.includes('FROM role_room_lead_outcomes') && q.sql.includes('GROUP BY stage'));
    expect(outcomes).toBeDefined();
    expect(outcomes!.args).toEqual([USER, 'conn-1', 'form-9']);
    expect(outcomes!.sql).toContain('connection_id =');
    expect(outcomes!.sql).toContain('form_id =');

    // Segments has no form_id column → only user + connection bound.
    const segments = queries.find((q) => q.sql.includes('FROM role_room_lead_segments') && q.sql.includes('GROUP BY segment'));
    expect(segments!.args).toEqual([USER, 'conn-1']);
  });

  it('returns the safe empty shape with no rows', async () => {
    const { pool } = makePool(async () => ({ rows: [] }));
    const snap = await getLeadFunnelSnapshot(pool, USER);
    expect(snap.totalLeads).toBe(0);
    expect(snap.bySegment).toEqual({});
    expect(snap.byStage).toEqual({});
    expect(snap.coldLeads).toEqual([]);
    expect(snap.roi).toEqual({ spendKr: 0, revenueKr: 0, costPerCustomerKr: 0 });
  });

  it('never throws when a query rejects', async () => {
    const { pool } = makePool(async () => { throw new Error('boom'); });
    const snap = await getLeadFunnelSnapshot(pool, USER);
    expect(snap.totalLeads).toBe(0);
    expect(snap.roi.costPerCustomerKr).toBe(0);
  });
});

describe('getAnalyticsSnapshot', () => {
  beforeEach(() => vi.clearAllMocks());

  it('condenses the analytics aggregation, scoped to userId', async () => {
    const { pool, queries } = makePool(async (sql) => {
      if (sql.includes("interval '7 days'")) return { rows: [{ total: '40', unread: '12' }] };
      if (sql.includes("interval '30 days'") && sql.includes('FROM social_events') && !sql.includes('sentiment_label')) {
        return { rows: [{ total: '130' }] };
      }
      if (sql.includes('sentiment_label') && sql.includes('GROUP BY sentiment_label')) {
        return {
          rows: [
            { sentiment_label: 'positive', n: '20' },
            { sentiment_label: 'negative', n: '5' },
            { sentiment_label: 'neutral', n: '8' },
          ],
        };
      }
      if (sql.includes('DISTINCT ON (platform, account_id)')) {
        return {
          rows: [
            { platform: 'instagram', account_id: 'ig-1', metric_value: '3200', recorded_at: new Date('2026-06-25T00:00:00Z') },
          ],
        };
      }
      // cadence
      return { rows: [{ published: '7', scheduled: '3' }] };
    });

    const snap = await getAnalyticsSnapshot(pool, USER);

    expect(snap.events.last7d).toEqual({ total: 40, unread: 12 });
    expect(snap.events.last30d).toEqual({ total: 130 });
    expect(snap.sentiment).toEqual({ positive: 20, neutral: 8, negative: 5 });
    expect(snap.followers).toEqual([
      { platform: 'instagram', accountId: 'ig-1', count: 3200, recordedAt: '2026-06-25T00:00:00.000Z' },
    ]);
    expect(snap.publishCadence).toEqual({ published30d: 7, scheduled30d: 3 });

    for (const q of queries) {
      expect(q.args[0]).toBe(USER);
      expect(q.sql).toContain('user_id = $1');
    }
  });

  it('returns the safe empty shape with no rows', async () => {
    const { pool } = makePool(async () => ({ rows: [] }));
    const snap = await getAnalyticsSnapshot(pool, USER);
    expect(snap.events.last7d).toEqual({ total: 0, unread: 0 });
    expect(snap.events.last30d.total).toBe(0);
    expect(snap.sentiment).toEqual({ positive: 0, neutral: 0, negative: 0 });
    expect(snap.followers).toEqual([]);
    expect(snap.publishCadence).toEqual({ published30d: 0, scheduled30d: 0 });
  });

  it('never throws when a query rejects', async () => {
    const { pool } = makePool(async () => { throw new Error('db gone'); });
    const snap = await getAnalyticsSnapshot(pool, USER);
    expect(snap.events.last30d.total).toBe(0);
    expect(snap.followers).toEqual([]);
  });
});

describe('getFeedStatusSnapshot', () => {
  beforeEach(() => vi.clearAllMocks());

  const PROJECT = 'project-77';

  it('aggregates approval state across platforms and flags overdue/needs-changes', async () => {
    const pastDeadline = new Date(Date.now() - 86_400_000).toISOString();
    const futureDeadline = new Date(Date.now() + 86_400_000).toISOString();
    let call = 0;
    const { pool, queries } = makePool(async (sql) => {
      if (!sql.includes('FROM role_room_feed_plans')) return { rows: [] };
      call += 1;
      // Only the first platform (instagram) has a plan; others empty.
      if (call === 1) {
        return {
          rows: [
            {
              id: 'plan-1',
              project_id: PROJECT,
              platform: 'instagram',
              posts: [
                { id: 'p1', approvalState: 'approved' },
                { id: 'p2', approvalState: 'needs_changes' },
                { id: 'p3', approvalState: 'awaiting_client', reviewDeadline: pastDeadline },
                { id: 'p4', approvalState: 'awaiting_client', reviewDeadline: futureDeadline },
                { id: 'p5' }, // no approvalState → 'draft'
              ],
              brand_snapshot: null,
              updated_by: null,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        };
      }
      return { rows: [] };
    });

    const snap = await getFeedStatusSnapshot(pool, PROJECT);

    expect(snap.byApprovalState).toEqual({
      approved: 1,
      needs_changes: 1,
      awaiting_client: 2,
      draft: 1,
    });
    expect(snap.needsChanges).toBe(1);
    expect(snap.awaitingClientOverdue).toBe(1); // only the past-deadline one

    // loadFeedPlan binds the projectId as $1 for every platform probed.
    for (const q of queries) {
      expect(q.args[0]).toBe(PROJECT);
    }
  });

  it('returns the safe empty shape when no plans exist', async () => {
    const { pool } = makePool(async () => ({ rows: [] }));
    const snap = await getFeedStatusSnapshot(pool, PROJECT);
    expect(snap.byApprovalState).toEqual({});
    expect(snap.awaitingClientOverdue).toBe(0);
    expect(snap.needsChanges).toBe(0);
  });

  it('returns the empty shape for a blank projectId without querying', async () => {
    const { pool, queries } = makePool(async () => ({ rows: [] }));
    const snap = await getFeedStatusSnapshot(pool, '');
    expect(snap.byApprovalState).toEqual({});
    expect(queries.length).toBe(0);
  });

  it('never throws when loadFeedPlan rejects', async () => {
    const { pool } = makePool(async () => { throw new Error('feed plan db error'); });
    const snap = await getFeedStatusSnapshot(pool, PROJECT);
    // loadFeedPlan swallows its own errors → empty plans → empty snapshot.
    expect(snap.byApprovalState).toEqual({});
    expect(snap.needsChanges).toBe(0);
  });
});
