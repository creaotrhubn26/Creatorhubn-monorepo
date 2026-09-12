// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

// Minimal localStorage-mock på globalThis før modulen leses.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
});

const { hasSeenEducationTour } = await import('./EducationTour');

afterEach(() => store.clear());

describe('hasSeenEducationTour', () => {
  it('er false for en fersk nettleser', () => {
    expect(hasSeenEducationTour()).toBe(false);
  });

  it('er true når seen-flagget er satt', () => {
    globalThis.localStorage.setItem('role_room_education_tour_seen_v1', '1');
    expect(hasSeenEducationTour()).toBe(true);
  });
});
