/**
 * Unit-tester for derivePosterSource — pure mapper Role + CastingProject
 * → CastingCallPosterSource. Sjekker:
 *   - Basic happy path med fullt prosjekt
 *   - Humanisering av project_type / genre
 *   - Fallback gjennom project.metadata.shootLocation / location
 *   - Fallback til role.requirements
 *   - Null-project (rolle uten prosjekt)
 *   - Snake-case-felter (age_range, role_type) — backend-format
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { derivePosterSource } from './derivePosterSource';
import type { Role, CastingProject } from '../models/casting';

function makeRole(overrides: Partial<Role> = {}): Role {
  return {
    id: 'role-1',
    name: 'Lead Actor (Male)',
    description: 'Vi søker en sterk hovedrolle.',
    ...overrides,
  } as Role;
}

function makeProject(overrides: Partial<CastingProject> = {}): CastingProject {
  return {
    id: 'proj-1',
    name: 'Nordlys',
    genre: 'drama',
    projectType: 'feature_film',
    roles: [],
    candidates: [],
    crew: [],
    schedules: [],
    ...overrides,
  } as CastingProject;
}

describe('derivePosterSource', () => {
  let originalWindow: typeof globalThis.window | undefined;

  beforeEach(() => {
    originalWindow = globalThis.window;
    // jsdom provider window.location — stub origin for stabilitet
    Object.defineProperty(globalThis.window, 'location', {
      configurable: true,
      value: { origin: 'https://creatorhubn.com' } as Location,
    });
  });

  afterEach(() => {
    if (originalWindow) globalThis.window = originalWindow;
    vi.restoreAllMocks();
  });

  it('mapper rolle-navn + sitat fra description', () => {
    const result = derivePosterSource(makeRole(), makeProject());
    expect(result.roleName).toBe('Lead Actor (Male)');
    expect(result.quote).toBe('Vi søker en sterk hovedrolle.');
  });

  it('humaniserer feature_film → "Feature film" og drama → "Drama"', () => {
    const result = derivePosterSource(makeRole(), makeProject());
    expect(result.format).toBe('Feature film');
    expect(result.genre).toBe('Drama');
  });

  it('humaniserer tv_series → "TV-serie" og crime → "Krim"', () => {
    const result = derivePosterSource(
      makeRole(),
      makeProject({ projectType: 'tv_series', genre: 'crime' }),
    );
    expect(result.format).toBe('TV-serie');
    expect(result.genre).toBe('Krim');
  });

  it('faller tilbake til rå-verdi når project_type/genre ikke matcher dictionary', () => {
    const result = derivePosterSource(
      makeRole(),
      makeProject({ projectType: 'experimental_xr', genre: 'mockumentary' }),
    );
    expect(result.format).toBe('experimental_xr');
    expect(result.genre).toBe('mockumentary');
  });

  it('leser ageRange (camelCase) fra role', () => {
    const result = derivePosterSource(makeRole({ ageRange: '25-35' }), makeProject());
    expect(result.ageRange).toBe('25-35');
  });

  it('leser age_range (snake_case) fra role — backend-shape', () => {
    const result = derivePosterSource(
      makeRole({ ageRange: undefined, age_range: '40-55' } as unknown as Role),
      makeProject(),
    );
    expect(result.ageRange).toBe('40-55');
  });

  it('leser productionName fra project.name', () => {
    const result = derivePosterSource(makeRole(), makeProject({ name: 'Midnight Tide' }));
    expect(result.productionName).toBe('Midnight Tide');
  });

  it('leser shoot-location fra project.metadata.shootLocation', () => {
    const result = derivePosterSource(
      makeRole(),
      makeProject({ metadata: { shootLocation: 'Tromsø, Norway' } } as unknown as CastingProject),
    );
    expect(result.location).toBe('Tromsø, Norway');
  });

  it('faller tilbake til project.metadata.location hvis shootLocation mangler', () => {
    const result = derivePosterSource(
      makeRole(),
      makeProject({ metadata: { location: 'Bergen' } } as unknown as CastingProject),
    );
    expect(result.location).toBe('Bergen');
  });

  it('faller tilbake til role.requirements.location hvis project.metadata mangler', () => {
    const result = derivePosterSource(
      makeRole({ requirements: { location: 'Oslo' } } as unknown as Role),
      makeProject(),
    );
    expect(result.location).toBe('Oslo');
  });

  it('leser auditionDeadline fra project.metadata først', () => {
    const result = derivePosterSource(
      makeRole({ requirements: { auditionDeadline: '20 september' } } as unknown as Role),
      makeProject({ metadata: { auditionDeadline: '24 oktober' } } as unknown as CastingProject),
    );
    expect(result.auditionDeadline).toBe('24 oktober');
  });

  it('faller tilbake til role.requirements.deadline når auditionDeadline mangler', () => {
    const result = derivePosterSource(
      makeRole({ requirements: { deadline: '15 desember' } } as unknown as Role),
      makeProject(),
    );
    expect(result.auditionDeadline).toBe('15 desember');
  });

  it('returnerer roleName + applyUrl selv når prosjekt er null', () => {
    const result = derivePosterSource(makeRole({ id: 'role-xyz' }), null);
    expect(result.roleName).toBe('Lead Actor (Male)');
    expect(result.productionName).toBeUndefined();
    expect(result.format).toBeUndefined();
    expect(result.applyUrl).toBe('https://creatorhubn.com/r/role-xyz');
  });

  it('gir alltid Verified casting som status (frem til schema-utvidelse)', () => {
    const result = derivePosterSource(makeRole(), makeProject());
    expect(result.status).toBe('Verified casting');
  });

  it('trimmer tomme/whitespace-felter til undefined', () => {
    const result = derivePosterSource(
      makeRole({ description: '   ' }),
      makeProject({ name: '   ' }),
    );
    expect(result.quote).toBeUndefined();
    expect(result.productionName).toBeUndefined();
  });
});
