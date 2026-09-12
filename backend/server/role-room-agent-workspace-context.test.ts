import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildWorkspaceContextBlock } from './role-room-agent-workspace-context.js';
import * as data from './role-room-agent-workspace-data.js';

const pool = {} as never;

function stub(over: {
  inbox?: Partial<data.InboxSnapshot>;
  leads?: Partial<data.LeadFunnelSnapshot>;
  analytics?: Partial<data.AnalyticsSnapshot>;
  feed?: Partial<data.FeedStatusSnapshot>;
}) {
  vi.spyOn(data, 'getInboxSnapshot').mockResolvedValue({
    totalEvents: 0, unread: 0, byPlatform: {}, sentimentBreakdown: {}, topNegative: [], generatedAt: 'x',
    ...over.inbox,
  } as data.InboxSnapshot);
  vi.spyOn(data, 'getLeadFunnelSnapshot').mockResolvedValue({
    totalLeads: 0, bySegment: {}, byStage: {}, coldLeads: [], roi: { spendKr: 0, revenueKr: 0, costPerCustomerKr: 0 }, generatedAt: 'x',
    ...over.leads,
  } as data.LeadFunnelSnapshot);
  vi.spyOn(data, 'getAnalyticsSnapshot').mockResolvedValue({
    events: { last7d: { total: 0, unread: 0 }, last30d: { total: 0 } },
    sentiment: { positive: 0, neutral: 0, negative: 0 }, followers: [], publishCadence: { published30d: 0, scheduled30d: 0 }, generatedAt: 'x',
    ...over.analytics,
  } as data.AnalyticsSnapshot);
  vi.spyOn(data, 'getFeedStatusSnapshot').mockResolvedValue({
    byApprovalState: {}, awaitingClientOverdue: 0, needsChanges: 0, generatedAt: 'x',
    ...over.feed,
  } as data.FeedStatusSnapshot);
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.ROLE_ROOM_AGENT_WORKSPACE_CONTEXT;
});

describe('buildWorkspaceContextBlock', () => {
  it('returns null when every surface is empty (no token waste)', async () => {
    stub({});
    expect(await buildWorkspaceContextBlock(pool, { userId: 'u', projectId: 'p' })).toBeNull();
  });

  it('returns null when the kill-switch is off', async () => {
    process.env.ROLE_ROOM_AGENT_WORKSPACE_CONTEXT = 'off';
    stub({ inbox: { totalEvents: 5 } });
    expect(await buildWorkspaceContextBlock(pool, { userId: 'u', projectId: 'p' })).toBeNull();
  });

  it('returns null on missing identity', async () => {
    stub({ inbox: { totalEvents: 5 } });
    expect(await buildWorkspaceContextBlock(pool, { userId: '', projectId: 'p' })).toBeNull();
  });

  it('renders aggregate sections that have data', async () => {
    stub({
      inbox: { totalEvents: 12, unread: 4, byPlatform: { instagram: 9, facebook_page: 3 }, sentimentBreakdown: { positive: 7, negative: 2 } },
      leads: { totalLeads: 30, bySegment: { varm: 5 }, byStage: { kunde: 3 }, coldLeads: [{ id: 'l1' } as never, { id: 'l2' } as never], roi: { spendKr: 1000, revenueKr: 9000, costPerCustomerKr: 333 } },
      feed: { byApprovalState: { draft: 4, approved: 2 }, awaitingClientOverdue: 1, needsChanges: 1 },
    });
    const block = await buildWorkspaceContextBlock(pool, { userId: 'u', projectId: 'p' });
    expect(block).toContain('Arbeidsflate-status');
    expect(block).toContain('Inbox: 12 hendelser (4 uleste)');
    expect(block).toContain('Leads: 30 totalt');
    expect(block).toContain('2 varme leads uten oppfølging'); // coldLeads.length, not the ids
    expect(block).toContain('Feed:');
    expect(block).toContain('1 poster forbi kunde-frist');
  });

  it('never leaks third-party PII (no ids/names/emails from cold-lead items)', async () => {
    stub({
      leads: {
        totalLeads: 3,
        bySegment: { varm: 1 },
        coldLeads: [{ id: 'lead-secret-123', name: 'Ola Nordmann', email: 'ola@x.no' } as never],
        roi: { spendKr: 0, revenueKr: 0, costPerCustomerKr: 0 },
      },
    });
    const block = (await buildWorkspaceContextBlock(pool, { userId: 'u', projectId: 'p' })) ?? '';
    expect(block).not.toContain('lead-secret-123');
    expect(block).not.toContain('Ola Nordmann');
    expect(block).not.toContain('ola@x.no');
    expect(block).toContain('1 varme leads uten oppfølging');
  });

  it('never throws — a snapshot rejection yields null', async () => {
    vi.spyOn(data, 'getInboxSnapshot').mockRejectedValue(new Error('db down'));
    vi.spyOn(data, 'getLeadFunnelSnapshot').mockResolvedValue({} as never);
    vi.spyOn(data, 'getAnalyticsSnapshot').mockResolvedValue({} as never);
    vi.spyOn(data, 'getFeedStatusSnapshot').mockResolvedValue({} as never);
    await expect(buildWorkspaceContextBlock(pool, { userId: 'u', projectId: 'p' })).resolves.toBeNull();
  });
});
