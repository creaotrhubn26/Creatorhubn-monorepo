import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { educationProductionsService, openProductionInRoleRoom } from './educationProductionsService';

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

describe('openProductionInRoleRoom', () => {
  const originalLocation = window.location;
  let assignSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    assignSpy = vi.fn();
    // jsdom's window.location.assign isn't spy-able directly (non-configurable
    // property) — swap the whole `location` object for a mock href + assign.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, assign: assignSpy },
    });
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    vi.restoreAllMocks();
  });

  it('åpner ny fane (window.open) som default (faglærer/produsent-bruk)', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    openProductionInRoleRoom('proj-1');

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0][0]).toContain('project=proj-1');
    expect(openSpy.mock.calls[0][0]).not.toContain('edu=1');
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('navigerer i samme fane (location.assign) + setter edu=1 når asStudent er satt', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    openProductionInRoleRoom('proj-1', undefined, { asStudent: true });

    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy.mock.calls[0][0]).toContain('project=proj-1');
    expect(assignSpy.mock.calls[0][0]).toContain('edu=1');
    expect(openSpy).not.toHaveBeenCalled();
  });
});
