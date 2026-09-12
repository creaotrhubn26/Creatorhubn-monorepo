import { beforeEach, describe, expect, it, vi } from 'vitest';

const { creditMoveMock, emitMeterMock, getCreditsMock, settingsMock } = vi.hoisted(() => ({
  creditMoveMock: vi.fn(async () => true),
  emitMeterMock: vi.fn(async () => ({ skipped: 'free_mode' })),
  getCreditsMock: vi.fn(async () => ({ balanceUsd: 100, purchasedUsd: 100, spentUsd: 0 })),
  settingsMock: vi.fn(async () => ({
    enabled: true, billingMode: 'free_whitelist', dailyCapUsd: 20,
    whitelist: ['director@example.com'], includedQuota: 0,
    markupMultiplier: 3, creditPacks: [],
  })),
}));

vi.mock('./generative-media.js', () => ({
  getGenSettings: settingsMock,
  emitGenAiMeter: emitMeterMock,
}));

vi.mock('./ai-credits.js', () => ({
  getUserCredits: getCreditsMock,
  creditMove: creditMoveMock,
}));

import {
  completeStoryboardImageCost,
  reserveStoryboardImageCost,
  StoryboardAICostError,
} from './storyboard-ai-cost-control.js';

function costPool(spent: number) {
  const client = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes(' AS spent')) return { rows: [{ spent }] };
      return { rows: [], rowCount: 1 };
    }),
    release: vi.fn(),
  };
  const pool = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('FROM generative_ai_jobs')) return { rows: [{ spent: 0 }] };
      if (sql.includes("SET status='completed'")) {
        return { rows: [{ user_id: 'director', est_cost_usd: 0.06 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
    connect: vi.fn(async () => client),
  };
  return { pool: pool as any, client };
}

describe('Storyboard image cost control', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reserves budget before a provider call and meters completion once', async () => {
    const { pool, client } = costPool(0);
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
    expect(emitMeterMock).toHaveBeenCalledTimes(1);
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
});
