import { describe, expect, it, vi } from 'vitest';
import {
  createClientPortalInvite,
  fetchClientDashboard,
  listClientPortalSessionsForProject,
  resolveClientPortalSession,
  revokeClientPortalSession,
} from './role-room-client-portal';

// Mock the marketing-plan modules the dashboard aggregator calls so
// we can stub their return values without hitting a real DB.
vi.mock('./role-room-marketing-plan.js', () => ({
  fetchActiveMarketingPlan: vi.fn(),
}));
vi.mock('./role-room-marketing-plan-posts.js', () => ({
  listPlanPosts: vi.fn(),
}));
import * as planMod from './role-room-marketing-plan.js';
import * as postsMod from './role-room-marketing-plan-posts.js';
const fetchActiveMarketingPlan = planMod.fetchActiveMarketingPlan as unknown as ReturnType<typeof vi.fn>;
const listPlanPosts = postsMod.listPlanPosts as unknown as ReturnType<typeof vi.fn>;

interface QueryRow { sql: string; args: unknown[]; }
function makePool(impl: (sql: string, args: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>) {
  const queries: QueryRow[] = [];
  const query = vi.fn(async (sql: string, args: unknown[] = []) => {
    queries.push({ sql, args });
    return impl(sql, args);
  });
  return { pool: { query } as never, queries };
}

const nowIso = new Date();
const in30d = new Date(Date.now() + 30 * 24 * 3600 * 1000);
const in1d = new Date(Date.now() + 24 * 3600 * 1000);
const past = new Date(Date.now() - 3600 * 1000);

function baseSessionRow(override: Record<string, unknown> = {}) {
  return {
    id: 'sess-1',
    session_token: 'A'.repeat(43),
    client_email: 'kunde@example.no',
    client_name: 'Kunde AS',
    project_id: 'proj-1',
    invited_by_user_id: 'user-1',
    status: 'active',
    expires_at: in30d,
    created_at: nowIso,
    last_seen_at: null,
    revoked_at: null,
    ...override,
  };
}

// ── createClientPortalInvite ─────────────────────────────────────────────

describe('createClientPortalInvite', () => {
  it('inserts with default 30-day expiry + lowercased email', async () => {
    const { pool, queries } = makePool(async () => ({ rows: [baseSessionRow()] }));
    const result = await createClientPortalInvite(pool, {
      projectId: 'proj-1',
      invitedByUserId: 'user-1',
      clientEmail: 'KUNDE@Example.No',
    });
    expect(result).not.toBeNull();
    const args = queries[0].args;
    expect(args[0]).toMatch(/^[A-Za-z0-9_-]{43}$/); // base64url-43
    expect(args[1]).toBe('kunde@example.no');
    expect(args[2]).toBeNull();                      // no name given
    expect(args[3]).toBe('proj-1');
    expect(args[4]).toBe('user-1');
    // Expires ~30 days in the future.
    const expiresAt = args[5] as Date;
    const deltaMs = expiresAt.getTime() - Date.now();
    expect(deltaMs).toBeGreaterThan(29 * 24 * 3600 * 1000);
    expect(deltaMs).toBeLessThan(31 * 24 * 3600 * 1000);
  });

  it('clamps expiresInDays to [1, 90]', async () => {
    const { pool, queries } = makePool(async () => ({ rows: [baseSessionRow()] }));
    await createClientPortalInvite(pool, {
      projectId: 'p', invitedByUserId: 'u', clientEmail: 'a@b.c', expiresInDays: 999,
    });
    const e1 = queries[0].args[5] as Date;
    expect(e1.getTime() - Date.now()).toBeLessThan(91 * 24 * 3600 * 1000);

    await createClientPortalInvite(pool, {
      projectId: 'p', invitedByUserId: 'u', clientEmail: 'a@b.c', expiresInDays: 0,
    });
    const e2 = queries[1].args[5] as Date;
    expect(e2.getTime() - Date.now()).toBeGreaterThan(0);
  });

  it('returns null on insert failure', async () => {
    const { pool } = makePool(async () => { throw new Error('db offline'); });
    const result = await createClientPortalInvite(pool, {
      projectId: 'p', invitedByUserId: 'u', clientEmail: 'a@b.c',
    });
    expect(result).toBeNull();
  });
});

// ── resolveClientPortalSession ──────────────────────────────────────────

describe('resolveClientPortalSession', () => {
  it('returns null for empty or too-short tokens without hitting the DB', async () => {
    const { pool, queries } = makePool(async () => ({ rows: [] }));
    expect(await resolveClientPortalSession(pool, '')).toBeNull();
    expect(await resolveClientPortalSession(pool, 'short')).toBeNull();
    expect(queries).toHaveLength(0);
  });

  it('returns null for unknown token', async () => {
    const { pool } = makePool(async () => ({ rows: [] }));
    expect(await resolveClientPortalSession(pool, 'Z'.repeat(43))).toBeNull();
  });

  it('returns null for revoked sessions — indistinguishable from unknown', async () => {
    const { pool } = makePool(async () => ({ rows: [baseSessionRow({ status: 'revoked' })] }));
    expect(await resolveClientPortalSession(pool, 'Z'.repeat(43))).toBeNull();
  });

  it('returns null + marks expired when expires_at has lapsed', async () => {
    const { pool, queries } = makePool(async (sql) => {
      if (sql.startsWith('SELECT')) return { rows: [baseSessionRow({ expires_at: past })] };
      return { rows: [], rowCount: 1 };
    });
    const result = await resolveClientPortalSession(pool, 'Z'.repeat(43));
    expect(result).toBeNull();
    const update = queries.find((q) => q.sql.includes("SET status = 'expired'"));
    expect(update).toBeDefined();
  });

  it('returns the session + touches last_seen_at on valid active token', async () => {
    const { pool, queries } = makePool(async (sql) => {
      if (sql.startsWith('SELECT')) return { rows: [baseSessionRow()] };
      return { rows: [], rowCount: 1 };
    });
    const result = await resolveClientPortalSession(pool, 'Z'.repeat(43));
    expect(result).not.toBeNull();
    expect(result!.projectId).toBe('proj-1');
    const touch = queries.find((q) => q.sql.includes('SET last_seen_at = now()'));
    expect(touch).toBeDefined();
  });
});

// ── listClientPortalSessionsForProject + revoke ─────────────────────────

describe('listClientPortalSessionsForProject', () => {
  it('filters by projectId + invitedByUserId', async () => {
    const { pool, queries } = makePool(async () => ({
      rows: [baseSessionRow(), baseSessionRow({ id: 'sess-2', client_email: 'andre@x.no' })],
    }));
    const list = await listClientPortalSessionsForProject(pool, 'proj-1', 'user-1');
    expect(list).toHaveLength(2);
    expect(queries[0].args).toEqual(['proj-1', 'user-1']);
  });
});

describe('revokeClientPortalSession', () => {
  it('returns true when an active session was revoked', async () => {
    const { pool } = makePool(async () => ({ rows: [], rowCount: 1 }));
    expect(await revokeClientPortalSession(pool, 'sess-1', 'user-1')).toBe(true);
  });

  it('returns false when ownership mismatch prevents update', async () => {
    const { pool } = makePool(async () => ({ rows: [], rowCount: 0 }));
    expect(await revokeClientPortalSession(pool, 'sess-1', 'other-user')).toBe(false);
  });
});

// ── fetchClientDashboard ────────────────────────────────────────────────

describe('fetchClientDashboard', () => {
  function session(override: Partial<Parameters<typeof fetchClientDashboard>[1]> = {}) {
    return {
      id: 'sess-1',
      sessionToken: 'Z'.repeat(43),
      clientEmail: 'kunde@example.no',
      clientName: 'Kunde AS',
      projectId: 'proj-1',
      invitedByUserId: 'user-1',
      status: 'active' as const,
      expiresAt: in30d,
      createdAt: nowIso,
      lastSeenAt: null,
      ...override,
    } as Parameters<typeof fetchClientDashboard>[1];
  }

  it('returns null when the project has no active plan yet', async () => {
    fetchActiveMarketingPlan.mockResolvedValue(null);
    listPlanPosts.mockResolvedValue([]);
    const { pool } = makePool(async () => ({ rows: [] }));
    expect(await fetchClientDashboard(pool, session())).toBeNull();
  });

  it('aggregates progress + upcoming from real plan + posts', async () => {
    const plan = {
      id: 'plan-1',
      projectId: 'proj-1',
      ownerUserId: 'user-1',
      status: 'active' as const,
      strategy: { channelStrategy: {}, toneOfVoice: {}, positioning: {}, kpiTargets: [] } as never,
      pillars: [],
      generatedAt: null,
      generatedWithModel: null,
      startDate: new Date(Date.now() - 5 * 24 * 3600 * 1000), // 5 days into plan
      horizonDays: 30,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const posts = [
      { id: 'a', planId: 'plan-1', pillarId: null, sortOrder: 0, dayOffset: 0, hook: 'p0', format: 'reel', status: 'published', scheduledFor: null, crossPostPlan: [] },
      { id: 'b', planId: 'plan-1', pillarId: null, sortOrder: 1, dayOffset: 1, hook: 'p1', format: 'image', status: 'published', scheduledFor: null, crossPostPlan: [] },
      { id: 'c', planId: 'plan-1', pillarId: null, sortOrder: 2, dayOffset: 2, hook: 'p2', format: 'image', status: 'scheduled', scheduledFor: in1d, crossPostPlan: [] },
      { id: 'd', planId: 'plan-1', pillarId: null, sortOrder: 3, dayOffset: 3, hook: 'p3', format: 'reel', status: 'proposed', scheduledFor: null, crossPostPlan: [] },
      { id: 'e', planId: 'plan-1', pillarId: null, sortOrder: 4, dayOffset: 4, hook: 'p4', format: 'reel', status: 'skipped', scheduledFor: null, crossPostPlan: [] },
    ] as never;
    fetchActiveMarketingPlan.mockResolvedValue(plan);
    listPlanPosts.mockResolvedValue(posts);
    const { pool } = makePool(async () => ({ rows: [{ name: 'Northwind Drilling' }] }));
    const result = await fetchClientDashboard(pool, session());
    expect(result).not.toBeNull();
    expect(result!.project.title).toBe('Northwind Drilling');
    expect(result!.progress.publishedCount).toBe(2);
    expect(result!.progress.scheduledCount).toBe(1);
    expect(result!.progress.proposedCount).toBe(1);
    expect(result!.progress.skippedCount).toBe(1);
    expect(result!.progress.dayIntoPlan).toBe(5);
    expect(result!.progress.daysRemaining).toBe(25);
    // Upcoming: scheduled post (sooner scheduledFor) + proposed, NOT published.
    expect(result!.upcoming.map((p) => p.id)).toEqual(['c', 'd']);
  });

  it('reports null dayIntoPlan when plan has no start_date (draft)', async () => {
    const plan = {
      id: 'plan-draft', projectId: 'proj-1', ownerUserId: 'user-1', status: 'draft',
      strategy: {} as never, pillars: [], generatedAt: null, generatedWithModel: null,
      startDate: null, horizonDays: 30, createdAt: nowIso, updatedAt: nowIso,
    };
    fetchActiveMarketingPlan.mockResolvedValue(plan);
    listPlanPosts.mockResolvedValue([]);
    const { pool } = makePool(async () => ({ rows: [] }));
    const result = await fetchClientDashboard(pool, session());
    expect(result!.progress.dayIntoPlan).toBeNull();
    expect(result!.progress.daysRemaining).toBeNull();
  });
});
