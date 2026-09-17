import { describe, expect, it } from 'vitest';
import { distanceMeters, formatDistance, matchesQuery, nearest, sortByDistance } from '../src/lib/geo';
import { ATTRACTIONS } from '../src/data/attractions';

const OSLO_S = { lat: 59.9111, lng: 10.7503 };

describe('distanceMeters', () => {
  it('is zero for identical points', () => {
    expect(distanceMeters(OSLO_S, OSLO_S)).toBe(0);
  });
  it('Oslo S → Operahuset is roughly 450 m', () => {
    const opera = ATTRACTIONS.find((a) => a.id === 'oslo-operahuset')!;
    const d = distanceMeters(OSLO_S, opera.position);
    expect(d).toBeGreaterThan(350);
    expect(d).toBeLessThan(550);
  });
  it('Oslo → Bergen is roughly 305 km', () => {
    const bryggen = ATTRACTIONS.find((a) => a.id === 'bergen-bryggen')!;
    const d = distanceMeters(OSLO_S, bryggen.position);
    expect(d / 1000).toBeGreaterThan(295);
    expect(d / 1000).toBeLessThan(315);
  });
});

describe('nearest / sortByDistance', () => {
  it('nearest to Oslo S is the Opera House', () => {
    expect(nearest(ATTRACTIONS, OSLO_S)?.attraction.id).toBe('oslo-operahuset');
  });
  it('sorts ascending', () => {
    const s = sortByDistance(ATTRACTIONS, OSLO_S).map((x) => x.distanceM);
    expect([...s].sort((a, b) => a - b)).toEqual(s);
  });
  it('from Bergen, Bryggen is nearest and Nidaros before Oslo', () => {
    const s = sortByDistance(ATTRACTIONS, { lat: 60.39, lng: 5.32 }).map((x) => x.attraction.id);
    expect(s[0]).toBe('bergen-bryggen');
  });
});

describe('formatDistance', () => {
  it('rounds metres to 10 and switches to km at 1000', () => {
    expect(formatDistance(437, 'en-GB')).toMatch(/440\s?m/);
    expect(formatDistance(999, 'en-GB')).toMatch(/1,?000\s?m/);
    expect(formatDistance(1234, 'en-GB')).toMatch(/1\.2\s?km/);
  });
  it('uses locale number formatting', () => {
    expect(formatDistance(1234, 'nb-NO')).toMatch(/1,2\s?km/);
  });
  it('never returns below 10 m', () => {
    expect(formatDistance(2, 'en-GB')).toMatch(/10\s?m/);
  });
});

describe('matchesQuery', () => {
  const opera = ATTRACTIONS.find((a) => a.id === 'oslo-operahuset')!;
  it('matches any language name and place, case-insensitively', () => {
    expect(matchesQuery(opera, 'OPERA')).toBe(true);
    expect(matchesQuery(opera, 'Opéra')).toBe(true);
    expect(matchesQuery(opera, 'bjørvika')).toBe(true);
    expect(matchesQuery(opera, 'bergen')).toBe(false);
  });
  it('empty query matches everything', () => {
    expect(matchesQuery(opera, '   ')).toBe(true);
  });
});
