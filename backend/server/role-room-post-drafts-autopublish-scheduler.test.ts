import { afterEach, describe, expect, it, vi } from 'vitest';

import { runAutoPublishTick } from './role-room-post-drafts-autopublish-scheduler.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Marketing Draft autopublish scheduler', () => {
  it('disables retry when self-HTTP may have reached the external publisher', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket closed')));
    const clientQuery = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT id, platform, auto_publish_attempts')) {
        return {
          rows: [{ id: '42', platform: 'linkedin', auto_publish_attempts: 0 }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });
    const release = vi.fn();
    const poolQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const pool = {
      connect: vi.fn().mockResolvedValue({ query: clientQuery, release }),
      query: poolQuery,
    };

    const result = await runAutoPublishTick(pool as never);

    expect(result).toEqual({ published: 0, failed: 1, processed: 1 });
    expect(release).toHaveBeenCalledTimes(1);
    const uncertainUpdate = poolQuery.mock.calls.find(([sql]) =>
      String(sql).includes("SET status = 'uncertain'"));
    expect(uncertainUpdate).toBeTruthy();
    expect(String(uncertainUpdate?.[0])).toContain('auto_publish_enabled = FALSE');
    expect(uncertainUpdate?.[1]).toEqual([42]);
  });

  it('moves abandoned publishing claims to uncertain before selecting due work', async () => {
    const clientQuery = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT id, platform, auto_publish_attempts')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 1 };
    });
    const pool = {
      connect: vi.fn().mockResolvedValue({
        query: clientQuery,
        release: vi.fn(),
      }),
      query: vi.fn(),
    };

    const result = await runAutoPublishTick(pool as never);

    expect(result.processed).toBe(0);
    const staleClaimUpdate = clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes("WHERE status = 'publishing'"));
    expect(staleClaimUpdate).toBeTruthy();
    expect(String(staleClaimUpdate?.[0])).toContain("SET status = 'uncertain'");
    const dueSelect = clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes('SELECT id, platform, auto_publish_attempts'));
    expect(String(dueSelect?.[0])).not.toContain("status = 'publishing'");
  });
});
