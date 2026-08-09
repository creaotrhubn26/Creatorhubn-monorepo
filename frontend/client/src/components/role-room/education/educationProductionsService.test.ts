import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { educationProductionsService } from './educationProductionsService';

const sampleProduction = {
  id: 'prod-1',
  cohortId: 'cohort-1',
  projectId: 'proj-1',
  title: 'Test',
  projectStatus: null,
  assignmentCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('educationProductionsService.createProduction', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gjør ETT kall til /education/productions og lar serveren opprette prosjektet', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ production: sampleProduction }),
    });

    const result = await educationProductionsService.createProduction({ title: 'Test', cohortId: 'cohort-1' });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/role-room/education/productions');
    expect(JSON.parse(init.body)).toEqual({ title: 'Test', cohortId: 'cohort-1' });
    expect(result).toEqual(sampleProduction);
  });
});
