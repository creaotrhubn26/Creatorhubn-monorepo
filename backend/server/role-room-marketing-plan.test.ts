import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activateMarketingPlan,
  checkMarketingPlanReadiness,
  fetchActiveMarketingPlan,
  persistGeneratedMarketingPlan,
} from './role-room-marketing-plan';

// ── Readiness gate ──────────────────────────────────────────────────────

describe('checkMarketingPlanReadiness', () => {
  function fullBootstrap() {
    return {
      companyProfile: {
        companyName: 'Northwind Drilling',
        industry: 'Industrial services',
        targetAudience: ['Construction foremen', 'Municipality procurement'],
        toneAndBrandSignals: ['Direct', 'Technically precise', 'Safety-first'],
        offerings: ['Drilling', 'Site surveys'],
      },
      storyLogicDraft: {
        contentStoryLogic: {
          businessObjective: 'Tre bestillinger per måned fra Oslo og Akershus',
          audienceProblem: 'Forsinkelser i drilling-bestilling koster byggeledere timer',
          keyPromise: 'Bekreftet oppmøte innen 48 timer',
        },
      },
    };
  }

  it('passes the gate when all required fields are present', () => {
    const result = checkMarketingPlanReadiness(fullBootstrap(), true);
    expect(result.ready).toBe(true);
    expect(result.missingFields).toEqual([]);
    expect(result.hasInstagramConnection).toBe(true);
  });

  it('flags missing companyName', () => {
    const b = fullBootstrap();
    b.companyProfile.companyName = '';
    const result = checkMarketingPlanReadiness(b, false);
    expect(result.ready).toBe(false);
    expect(result.missingFields).toContain('companyProfile.companyName');
  });

  it('flags missing targetAudience', () => {
    const b = fullBootstrap();
    b.companyProfile.targetAudience = [];
    const result = checkMarketingPlanReadiness(b, true);
    expect(result.ready).toBe(false);
    expect(result.missingFields).toContain('companyProfile.targetAudience');
  });

  it('flags fewer than 3 tone signals', () => {
    const b = fullBootstrap();
    b.companyProfile.toneAndBrandSignals = ['Direct', 'Precise'];
    const result = checkMarketingPlanReadiness(b, true);
    expect(result.ready).toBe(false);
    expect(result.missingFields.some((f) => f.includes('toneAndBrandSignals'))).toBe(true);
  });

  it('flags each missing content-story-logic field independently', () => {
    const b = fullBootstrap();
    b.storyLogicDraft.contentStoryLogic.businessObjective = '';
    b.storyLogicDraft.contentStoryLogic.keyPromise = '';
    const result = checkMarketingPlanReadiness(b, true);
    expect(result.missingFields).toContain('storyLogicDraft.contentStoryLogic.businessObjective');
    expect(result.missingFields).toContain('storyLogicDraft.contentStoryLogic.keyPromise');
    expect(result.missingFields).not.toContain('storyLogicDraft.contentStoryLogic.audienceProblem');
  });

  it('surfaces hasInstagramConnection without affecting ready-flag', () => {
    const withIg = checkMarketingPlanReadiness(fullBootstrap(), true);
    const withoutIg = checkMarketingPlanReadiness(fullBootstrap(), false);
    expect(withIg.ready).toBe(true);
    expect(withoutIg.ready).toBe(true);
    expect(withIg.hasInstagramConnection).toBe(true);
    expect(withoutIg.hasInstagramConnection).toBe(false);
  });

  it('treats whitespace-only strings as missing', () => {
    const b = fullBootstrap();
    b.companyProfile.companyName = '   ';
    const result = checkMarketingPlanReadiness(b, true);
    expect(result.missingFields).toContain('companyProfile.companyName');
  });
});

// ── Persistence ─────────────────────────────────────────────────────────

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
  strategy: {
    channelStrategy: { primary: 'instagram', cadencePerWeek: 5, secondary: ['tiktok'], reasoning: 'Vertical video reach' },
    toneOfVoice: { voice: 'Direct Norwegian industrial', dos: ['Bruk fornavn'], donts: ['Ingen emoji-sykdom'] },
    positioning: { valueProp: '48h bekreftelse', differentiator: 'Raskere enn nasjonale konsern' },
    kpiTargets: [{ metric: 'reach', target: 15000, per: 'month' as const, rationale: 'Reasonable baseline for SMB' }],
  },
  pillars: [
    { name: 'Feltrapport', description: 'Behind-the-scenes fra riggen', rationale: 'Viser teknisk kompetanse' },
    { name: 'Kundehistorier', description: 'Case-studier fra leveranser', rationale: 'Social proof' },
    { name: 'Branch-spørsmål', description: 'Kort-video-svar på vanlige spørsmål', rationale: 'Bygger autoritet + SEO' },
  ],
  generatedWithModel: 'claude-sonnet-4-5',
};

describe('persistGeneratedMarketingPlan', () => {
  beforeEach(() => vi.clearAllMocks());

  it('archives prior drafts, inserts plan + pillars in a transaction, returns the mapped row', async () => {
    let planIdIssued = 0;
    const { pool, queries } = makePool(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql.startsWith('ROLLBACK')) return { rows: [] };
      if (sql.startsWith('UPDATE role_room_marketing_plans')) return { rows: [], rowCount: 1 };
      if (sql.startsWith('INSERT INTO role_room_marketing_plans')) {
        planIdIssued += 1;
        return { rows: [{ id: `plan-${planIdIssued}`, created_at: new Date(), updated_at: new Date() }] };
      }
      if (sql.startsWith('INSERT INTO role_room_marketing_plan_pillars')) {
        return { rows: [{ id: `pillar-${queries.length}` }] };
      }
      return { rows: [] };
    });
    const result = await persistGeneratedMarketingPlan(pool, {
      projectId: 'proj-1',
      ownerUserId: 'user-1',
      generated: sampleGenerated,
    });
    expect(result).not.toBeNull();
    expect(result!.pillars).toHaveLength(3);
    expect(result!.status).toBe('draft');
    expect(result!.strategy.channelStrategy.primary).toBe('instagram');

    // Ensure archive-then-insert ordering, inside a BEGIN/COMMIT.
    const sqlSequence = queries.map((q) => q.sql.split('\n')[0]);
    expect(sqlSequence[0]).toBe('BEGIN');
    expect(sqlSequence.some((s) => s.startsWith('UPDATE role_room_marketing_plans'))).toBe(true);
    expect(sqlSequence.some((s) => s.startsWith('INSERT INTO role_room_marketing_plans'))).toBe(true);
    expect(sqlSequence.filter((s) => s.startsWith('INSERT INTO role_room_marketing_plan_pillars'))).toHaveLength(3);
    expect(sqlSequence[sqlSequence.length - 1]).toBe('COMMIT');
  });

  it('rolls back and returns null when a pillar insert fails', async () => {
    let seen = 0;
    const { pool, queries } = makePool(async (sql) => {
      if (sql === 'BEGIN') return { rows: [] };
      if (sql.startsWith('UPDATE role_room_marketing_plans')) return { rows: [], rowCount: 0 };
      if (sql.startsWith('INSERT INTO role_room_marketing_plans')) {
        return { rows: [{ id: 'plan-x', created_at: new Date(), updated_at: new Date() }] };
      }
      if (sql.startsWith('INSERT INTO role_room_marketing_plan_pillars')) {
        seen += 1;
        if (seen === 2) throw new Error('pillar constraint');
        return { rows: [{ id: `pillar-${seen}` }] };
      }
      return { rows: [] };
    });
    const result = await persistGeneratedMarketingPlan(pool, {
      projectId: 'proj-x',
      ownerUserId: 'user-x',
      generated: sampleGenerated,
    });
    expect(result).toBeNull();
    expect(queries.some((q) => q.sql === 'ROLLBACK')).toBe(true);
  });
});

// ── Fetch ───────────────────────────────────────────────────────────────

describe('fetchActiveMarketingPlan', () => {
  it('returns null when no draft/active plan exists', async () => {
    const { pool } = makePool(async () => ({ rows: [] }));
    expect(await fetchActiveMarketingPlan(pool, 'proj')).toBeNull();
  });

  it('maps plan + pillars when present', async () => {
    const { pool } = makePool(async (sql) => {
      if (sql.includes('FROM role_room_marketing_plans')) {
        return {
          rows: [
            {
              id: 'plan-1',
              project_id: 'proj-1',
              owner_user_id: 'user-1',
              status: 'active',
              strategy: sampleGenerated.strategy,
              generated_at: new Date('2026-04-18T10:00:00Z'),
              generated_with_model: 'claude-sonnet-4-5',
              start_date: new Date('2026-04-18'),
              horizon_days: 30,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        };
      }
      if (sql.includes('FROM role_room_marketing_plan_pillars')) {
        return {
          rows: [
            { id: 'p-a', name: 'Feltrapport', description: 'BTS', rationale: 'depth', target_kpi: null, sort_order: 0 },
            { id: 'p-b', name: 'Kundehistorier', description: 'proof', rationale: 'trust', target_kpi: { metric: 'saves', target: 20, per: 'post' }, sort_order: 1 },
          ],
        };
      }
      return { rows: [] };
    });
    const plan = await fetchActiveMarketingPlan(pool, 'proj-1');
    expect(plan).not.toBeNull();
    expect(plan!.status).toBe('active');
    expect(plan!.pillars.map((p) => p.name)).toEqual(['Feltrapport', 'Kundehistorier']);
    expect(plan!.pillars[1].targetKpi?.metric).toBe('saves');
  });
});

// ── Activation ──────────────────────────────────────────────────────────

describe('activateMarketingPlan', () => {
  it('returns true when a draft was flipped to active', async () => {
    const { pool, queries } = makePool(async () => ({ rows: [], rowCount: 1 }));
    expect(await activateMarketingPlan(pool, 'plan-1', 'proj-1')).toBe(true);
    expect(queries[0].sql).toContain("SET status = 'active'");
    expect(queries[0].sql).toContain('start_date = CURRENT_DATE');
    expect(queries[0].args).toEqual(['plan-1', 'proj-1']);
  });

  it('returns false when no draft matched (already active, archived, or wrong project)', async () => {
    const { pool } = makePool(async () => ({ rows: [], rowCount: 0 }));
    expect(await activateMarketingPlan(pool, 'plan-x', 'proj-x')).toBe(false);
  });
});
