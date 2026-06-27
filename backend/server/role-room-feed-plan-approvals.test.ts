import { describe, expect, it, vi } from 'vitest';
import {
  markFeedPlanPostFailed,
  normalizeFeedPostsPayload,
  type RoleRoomFeedApprovalState,
} from './role-room-feed-plan.js';

// ── normalizePost preservers approvalState through save roundtrip ──────

describe('normalizeFeedPostsPayload — approval-state preservation', () => {
  it('defaults approvalState to "draft" when missing (legacy posts)', () => {
    const result = normalizeFeedPostsPayload([
      {
        id: 'p1',
        concept: 'announcement',
        title: 'Test',
        caption: '',
        hashtags: [],
        callToAction: '',
        imageStyle: '',
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].approvalState).toBe('draft');
  });

  it('preserves valid approval states', () => {
    const states: RoleRoomFeedApprovalState[] = [
      'draft',
      'approved',
      'scheduled',
      'published',
      'rejected',
      'needs_changes',
    ];
    for (const state of states) {
      const [post] = normalizeFeedPostsPayload([
        { id: 'p', concept: '', title: '', caption: '', hashtags: [], callToAction: '', imageStyle: '', approvalState: state },
      ]);
      expect(post.approvalState).toBe(state);
    }
  });

  it('preserves gridAspect + cover thumbnail through save roundtrip', () => {
    const cover = `data:image/png;base64,${'A'.repeat(64)}`;
    const [post] = normalizeFeedPostsPayload([
      {
        id: 'p',
        concept: '',
        title: '',
        caption: '',
        hashtags: [],
        callToAction: '',
        imageStyle: '',
        gridAspect: '16:9',
        coverImageUrl: cover,
        coverImageName: 'cover.png',
      },
    ]);
    expect(post.gridAspect).toBe('16:9');
    expect(post.coverImageUrl).toBe(cover);
    expect(post.coverImageName).toBe('cover.png');
  });

  it('drops invalid gridAspect to null', () => {
    const [post] = normalizeFeedPostsPayload([
      {
        id: 'p',
        concept: '',
        title: '',
        caption: '',
        hashtags: [],
        callToAction: '',
        imageStyle: '',
        gridAspect: '3:2',
      },
    ]);
    expect(post.gridAspect).toBeNull();
  });

  it('sanitizes invalid approvalState back to draft', () => {
    const [post] = normalizeFeedPostsPayload([
      {
        id: 'p',
        concept: '',
        title: '',
        caption: '',
        hashtags: [],
        callToAction: '',
        imageStyle: '',
        approvalState: 'pwned',
      },
    ]);
    expect(post.approvalState).toBe('draft');
  });

  it('preserves approval audit fields (changedAt, changedBy, note)', () => {
    const [post] = normalizeFeedPostsPayload([
      {
        id: 'p',
        concept: '',
        title: '',
        caption: '',
        hashtags: [],
        callToAction: '',
        imageStyle: '',
        approvalState: 'rejected',
        approvalChangedAt: '2026-05-01T12:00:00.000Z',
        approvalChangedBy: 'reviewer@example.com',
        approvalNote: 'Caption is misleading',
      },
    ]);
    expect(post.approvalChangedAt).toBe('2026-05-01T12:00:00.000Z');
    expect(post.approvalChangedBy).toBe('reviewer@example.com');
    expect(post.approvalNote).toBe('Caption is misleading');
  });

  it('truncates oversized approvalNote to prevent DOS', () => {
    const longNote = 'x'.repeat(5000);
    const [post] = normalizeFeedPostsPayload([
      {
        id: 'p',
        concept: '',
        title: '',
        caption: '',
        hashtags: [],
        callToAction: '',
        imageStyle: '',
        approvalState: 'rejected',
        approvalNote: longNote,
      },
    ]);
    expect((post.approvalNote ?? '').length).toBeLessThanOrEqual(1000);
  });
});

// ── markFeedPlanPostFailed ─────────────────────────────────────────────

function makePool(impl: (sql: string, args: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>) {
  // mutateFeedPlanLocked acquires a client and wraps the read-modify-write in
  // BEGIN/SELECT … FOR UPDATE/INSERT/COMMIT, so the mock pool must support
  // connect() in addition to query(). BEGIN/COMMIT/ROLLBACK resolve to empty;
  // everything else routes through the same impl.
  const clientQuery = vi.fn(async (sql: string, args: unknown[] = []) => {
    const verb = sql.trim().toUpperCase();
    if (verb === 'BEGIN' || verb === 'COMMIT' || verb === 'ROLLBACK') return { rows: [] };
    return impl(sql, args);
  });
  return {
    query: vi.fn(async (sql: string, args: unknown[] = []) => impl(sql, args)),
    connect: vi.fn(async () => ({ query: clientQuery, release: vi.fn() })),
  };
}

describe('markFeedPlanPostFailed', () => {
  it('returns touched=false when projectId or postId is empty', async () => {
    const pool = makePool(async () => ({ rows: [] }));
    expect(await markFeedPlanPostFailed(pool as never, '', 'p1', 'err')).toEqual({
      touched: false,
    });
    expect(await markFeedPlanPostFailed(pool as never, 'proj-1', '', 'err')).toEqual({
      touched: false,
    });
  });

  it('returns touched=false when no plan matches the post', async () => {
    // Returnerer tom plan for alle plattformer
    const pool = makePool(async () => ({ rows: [] }));
    const r = await markFeedPlanPostFailed(pool as never, 'proj-1', 'unknown-post', 'err');
    expect(r.touched).toBe(false);
  });

  it('updates approvalState=needs_changes + approvalNote when post is found', async () => {
    let savedPosts: unknown[] | null = null;
    const pool = makePool(async (sql, args) => {
      if (sql.includes('SELECT')) {
        // loadFeedPlan-spørring — returner én plan med matchende post
        return {
          rows: [
            {
              id: 'fp-1',
              project_id: 'proj-1',
              platform: 'instagram',
              posts: [
                {
                  id: 'p-1',
                  concept: 'announcement',
                  title: 'Test',
                  caption: 'cap',
                  hashtags: [],
                  callToAction: '',
                  imageStyle: '',
                  approvalState: 'approved',
                },
              ],
              brand_snapshot: null,
              updated_by: null,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO role_room_feed_plans')) {
        // saveFeedPlan-call — capture posts for verification
        savedPosts = JSON.parse(String(args[2]));
        return {
          rows: [
            {
              id: 'fp-1',
              project_id: 'proj-1',
              platform: 'instagram',
              posts: savedPosts,
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

    const r = await markFeedPlanPostFailed(
      pool as never,
      'proj-1',
      'p-1',
      'Meta API returned 400: Invalid template language',
    );

    expect(r.touched).toBe(true);
    expect(savedPosts).not.toBeNull();
    const updated = (savedPosts as Array<Record<string, unknown>>).find((p) => p.id === 'p-1');
    expect(updated).toBeDefined();
    expect(updated!.approvalState).toBe('needs_changes');
    expect(String(updated!.approvalNote)).toContain('Publisering feilet');
    expect(String(updated!.approvalNote)).toContain('Invalid template language');
    expect(updated!.approvalChangedBy).toBe('system:publish-worker');
    expect(updated!.approvalChangedAt).toBeTruthy();
  });

  it('truncates very long error messages to keep approvalNote bounded', async () => {
    const longError = 'x'.repeat(2000);
    let savedPosts: unknown[] | null = null;
    const pool = makePool(async (sql, args) => {
      if (sql.includes('SELECT')) {
        return {
          rows: [
            {
              id: 'fp-1',
              project_id: 'proj-1',
              platform: 'instagram',
              posts: [{ id: 'p-1', concept: '', title: '', caption: '', hashtags: [], callToAction: '', imageStyle: '' }],
              brand_snapshot: null,
              updated_by: null,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO role_room_feed_plans')) {
        savedPosts = JSON.parse(String(args[2]));
        return {
          rows: [
            {
              id: 'fp-1',
              project_id: 'proj-1',
              platform: 'instagram',
              posts: savedPosts,
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

    await markFeedPlanPostFailed(pool as never, 'proj-1', 'p-1', longError);

    const updated = (savedPosts as Array<Record<string, unknown>>).find((p) => p.id === 'p-1');
    // Note: approvalNote er kapsla på ~800 chars + prefix, totalt under 1000
    expect(String(updated!.approvalNote).length).toBeLessThanOrEqual(1000);
  });

  it('survives DB error gracefully and returns touched=false', async () => {
    const pool = makePool(async () => {
      throw new Error('connection lost');
    });
    const r = await markFeedPlanPostFailed(pool as never, 'proj-1', 'p-1', 'err');
    expect(r.touched).toBe(false);
  });
});
