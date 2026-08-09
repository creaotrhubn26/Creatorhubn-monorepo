import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { artifactToTab, educationProductionsService, openProductionInRoleRoom } from './educationProductionsService';

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

  it('mapper artifact_kind → SPA-tab-slug og setter ?view= (asStudent + view)', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    openProductionInRoleRoom('proj-1', 'story-arc', { asStudent: true, view: 'story-logic' });

    expect(assignSpy).toHaveBeenCalledTimes(1);
    const calledUrl = assignSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('tab=story-arc-studio');
    expect(calledUrl).toContain('view=story-logic');
    expect(calledUrl).toContain('edu=1');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('faglærer-default (ingen opts) setter ikke ?view=', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    openProductionInRoleRoom('proj-1', 'story-arc');

    expect(openSpy).toHaveBeenCalledTimes(1);
    const calledUrl = openSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('tab=story-arc-studio');
    expect(calledUrl).not.toContain('view=');
    expect(assignSpy).not.toHaveBeenCalled();
  });
});

describe('artifactToTab', () => {
  it('mapper kjente studioAccessModel-nøkler til CastingPlannerPanel sine slugs', () => {
    expect(artifactToTab('story-arc')).toBe('story-arc-studio');
    expect(artifactToTab('roles')).toBe('roller');
    expect(artifactToTab('candidates')).toBe('kandidater');
    expect(artifactToTab('selection')).toBe('utvelgelse');
    expect(artifactToTab('locations')).toBe('lokasjoner');
    expect(artifactToTab('callsheet')).toBe('produksjonsplan');
    expect(artifactToTab('crew')).toBe('team');
    expect(artifactToTab('equipment')).toBe('rekvisitter');
    expect(artifactToTab('workspace')).toBe('producer-media');
    expect(artifactToTab('economy')).toBe('producer-okonomi');
    expect(artifactToTab('timeline')).toBe('producer-tidslinje');
    expect(artifactToTab('approval')).toBe('producer-reviews');
    expect(artifactToTab('delivery')).toBe('producer-eksport');
  });

  it('er identity for nøkler som allerede matcher slugen (og ukjente nøkler)', () => {
    expect(artifactToTab('oversikt')).toBe('oversikt');
    expect(artifactToTab('storyboard')).toBe('storyboard');
    expect(artifactToTab('auditions')).toBe('auditions');
    expect(artifactToTab('live-set')).toBe('live-set');
    expect(artifactToTab('shotlist')).toBe('shotlist');
    expect(artifactToTab('nope-not-real')).toBe('nope-not-real');
  });
});
