import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listPlanPosts, persistPlanPosts } from './role-room-marketing-plan-posts';

interface QueryRow { sql: string; args: unknown[]; }
function makePool(impl: (sql: string, args: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>) {
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

const sampleGenerated = {
  posts: [
    {
      pillarIndex: 0 as number,
      sortOrder: 0,
      dayOffset: 0,
      hook: 'Her er hva ingen sier om drilling-tillatelser i Oslo',
      format: 'reel' as const,
      script: '0-2s: rask cut av oppmøte. 2-6s: papirarbeid. 6-15s: anecdote.',
      captionDraft: 'Tre uker venting er normalen. Her er hva som får det ned til 4 dager.',
      callToAction: 'Book en befaring — link i bio',
      primaryPlatform: 'instagram' as const,
      crossPostPlan: [{ platform: 'tiktok', delayDays: 1 }],
      goalKpi: { metric: 'saves', target: 20, per: 'post' as const },
    },
    {
      pillarIndex: 1 as number,
      sortOrder: 1,
      dayOffset: 2,
      hook: 'Kundecase: Storo bygg, drilling på 48 timer',
      format: 'carousel' as const,
      script: 'Slide 1: resultat. Slide 2-4: hvordan vi kom dit. Slide 5: CTA.',
      captionDraft: 'Storo bygg trengte en rask løsning. Her er hvordan.',
      callToAction: 'Kommenter BRANSJE for en lignende case',
      primaryPlatform: 'instagram' as const,
      crossPostPlan: [{ platform: 'linkedin', delayDays: 3, adaptationNote: 'Skriv som lengre post' }],
      goalKpi: { metric: 'reach', target: 1500, per: 'post' as const },
    },
  ],
  pillarIndexToId: new Map<number, string>([
    [0, 'pillar-feltrapport'],
    [1, 'pillar-kundehistorier'],
  ]),
};

describe('persistPlanPosts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('wipes proposed posts and inserts the new batch inside a transaction', async () => {
    const { pool, queries } = makePool(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql.startsWith('ROLLBACK')) return { rows: [] };
      if (sql.startsWith('DELETE FROM role_room_marketing_plan_posts')) return { rows: [], rowCount: 3 };
      if (sql.startsWith('INSERT INTO role_room_marketing_plan_posts')) return { rows: [] };
      // listPlanPosts re-read after commit
      if (sql.includes('FROM role_room_marketing_plan_posts')) {
        return {
          rows: sampleGenerated.posts.map((p, i) => ({
            id: `post-${i}`,
            plan_id: 'plan-1',
            pillar_id: sampleGenerated.pillarIndexToId.get(p.pillarIndex) ?? null,
            sort_order: p.sortOrder,
            day_offset: p.dayOffset,
            hook: p.hook,
            format: p.format,
            script: p.script,
            caption_draft: p.captionDraft,
            call_to_action: p.callToAction,
            primary_platform: p.primaryPlatform,
            cross_post_plan: p.crossPostPlan,
            goal_kpi: p.goalKpi,
            status: 'proposed',
            feed_plan_post_id: null,
            scheduled_for: null,
            published_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          })),
        };
      }
      return { rows: [] };
    });

    const result = await persistPlanPosts(pool, {
      planId: 'plan-1',
      posts: sampleGenerated.posts,
      pillarIndexToId: sampleGenerated.pillarIndexToId,
    });

    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);

    // Verify transaction + delete-then-insert ordering.
    const topics = queries.map((q) => q.sql.split('\n')[0]);
    expect(topics[0]).toBe('BEGIN');
    expect(topics.some((s) => s.startsWith('DELETE FROM role_room_marketing_plan_posts'))).toBe(true);
    expect(topics.filter((s) => s.startsWith('INSERT INTO role_room_marketing_plan_posts'))).toHaveLength(2);
    const commitIdx = topics.lastIndexOf('COMMIT');
    expect(commitIdx).toBeGreaterThan(0);
    // Second INSERT should carry the pillarIndex=1 FK.
    const insertCalls = queries.filter((q) => q.sql.startsWith('INSERT INTO role_room_marketing_plan_posts'));
    expect(insertCalls[0].args[1]).toBe('pillar-feltrapport');
    expect(insertCalls[1].args[1]).toBe('pillar-kundehistorier');
  });

  it('rolls back on insert failure, returns null', async () => {
    let inserts = 0;
    const { pool, queries } = makePool(async (sql) => {
      if (sql === 'BEGIN') return { rows: [] };
      if (sql.startsWith('DELETE FROM role_room_marketing_plan_posts')) return { rows: [] };
      if (sql.startsWith('INSERT INTO role_room_marketing_plan_posts')) {
        inserts += 1;
        if (inserts === 2) throw new Error('check constraint');
        return { rows: [] };
      }
      return { rows: [] };
    });
    const result = await persistPlanPosts(pool, {
      planId: 'plan-x',
      posts: sampleGenerated.posts,
      pillarIndexToId: sampleGenerated.pillarIndexToId,
    });
    expect(result).toBeNull();
    expect(queries.some((q) => q.sql === 'ROLLBACK')).toBe(true);
  });

  it('maps a null pillarIndex to a null FK rather than crashing', async () => {
    const { pool, queries } = makePool(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.startsWith('DELETE FROM role_room_marketing_plan_posts')) return { rows: [] };
      if (sql.startsWith('INSERT INTO role_room_marketing_plan_posts')) return { rows: [] };
      if (sql.includes('FROM role_room_marketing_plan_posts')) return { rows: [] };
      return { rows: [] };
    });
    await persistPlanPosts(pool, {
      planId: 'plan-orphan',
      posts: [{ ...sampleGenerated.posts[0], pillarIndex: 99 } as never],
      pillarIndexToId: new Map(),
    });
    const insert = queries.find((q) => q.sql.startsWith('INSERT INTO role_room_marketing_plan_posts'));
    expect(insert).toBeDefined();
    expect(insert!.args[1]).toBeNull();
  });
});

describe('listPlanPosts', () => {
  it('returns an empty array on error (never throws)', async () => {
    const { pool } = makePool(async () => { throw new Error('db offline'); });
    expect(await listPlanPosts(pool, 'plan-1')).toEqual([]);
  });

  it('maps rows with JSONB fields decoded to objects', async () => {
    const { pool } = makePool(async () => ({
      rows: [
        {
          id: 'p1', plan_id: 'plan-1', pillar_id: 'pillar-a',
          sort_order: 0, day_offset: 0,
          hook: 'Hook', format: 'reel',
          script: 'beat', caption_draft: 'draft', call_to_action: 'cta',
          primary_platform: 'instagram',
          cross_post_plan: [{ platform: 'tiktok', delayDays: 2 }],
          goal_kpi: { metric: 'saves', target: 10, per: 'post' },
          status: 'proposed',
          feed_plan_post_id: null, scheduled_for: null, published_at: null,
          created_at: new Date(), updated_at: new Date(),
        },
      ],
    }));
    const posts = await listPlanPosts(pool, 'plan-1');
    expect(posts).toHaveLength(1);
    expect(posts[0].crossPostPlan).toEqual([{ platform: 'tiktok', delayDays: 2 }]);
    expect(posts[0].goalKpi).toEqual({ metric: 'saves', target: 10, per: 'post' });
    expect(posts[0].format).toBe('reel');
    expect(posts[0].pillarId).toBe('pillar-a');
  });
});
