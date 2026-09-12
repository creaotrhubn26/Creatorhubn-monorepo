// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  computeCrewConflictsFromAvailability,
  type CrewAvailabilityOverlay,
} from './crewAvailabilitySync';

function overlay(cells: Array<{ date: string; availability: 'available' | 'unavailable' | 'hold' }>): CrewAvailabilityOverlay {
  return { cells: cells.map((c) => ({ date: c.date, availability: c.availability, status: c.availability })) };
}

const ctxWith = (over: CrewAvailabilityOverlay) => ({
  crew: [{ id: 'crew-1', email: 'A@Example.com' }],
  emailToUser: new Map([['a@example.com', 'user-1']]), // lowercased
  availabilityByUser: new Map([['user-1', over]]),
});

describe('computeCrewConflictsFromAvailability', () => {
  it('unavailable-dag i intervall → konflikt', () => {
    const ctx = ctxWith(overlay([{ date: '2026-08-10', availability: 'unavailable' }]));
    const res = computeCrewConflictsFromAvailability(['crew-1'], '2026-08-09', '2026-08-11', ctx);
    expect(res.get('crew-1')).toHaveLength(1);
    expect(res.get('crew-1')![0]).toMatchObject({ type: 'unavailable', start_date: '2026-08-10' });
    expect(res.get('crew-1')![0].notes).toContain('utilgjengelig');
  });

  it("'hold' (tentativ) → konflikt med tentativ-note", () => {
    const ctx = ctxWith(overlay([{ date: '2026-08-10', availability: 'hold' }]));
    const res = computeCrewConflictsFromAvailability(['crew-1'], '2026-08-10', '2026-08-10', ctx);
    expect(res.get('crew-1')![0].notes).toContain('tentativ');
  });

  it('available-dag → ingen konflikt', () => {
    const ctx = ctxWith(overlay([{ date: '2026-08-10', availability: 'available' }]));
    const res = computeCrewConflictsFromAvailability(['crew-1'], '2026-08-09', '2026-08-11', ctx);
    expect(res.has('crew-1')).toBe(false);
  });

  it('unavailable-dag UTENFOR intervall → ingen konflikt', () => {
    const ctx = ctxWith(overlay([{ date: '2026-09-01', availability: 'unavailable' }]));
    const res = computeCrewConflictsFromAvailability(['crew-1'], '2026-08-01', '2026-08-31', ctx);
    expect(res.has('crew-1')).toBe(false);
  });

  it('e-post matches case-insensitivt (crew A@Example.com → user-1)', () => {
    const ctx = ctxWith(overlay([{ date: '2026-08-10', availability: 'unavailable' }]));
    const res = computeCrewConflictsFromAvailability(['crew-1'], '2026-08-10', '2026-08-10', ctx);
    expect(res.has('crew-1')).toBe(true);
  });

  it('crew uten e-post / uten match / uten overlay → hoppes over (ingen krasj)', () => {
    const res = computeCrewConflictsFromAvailability(['x', 'y'], '2026-08-10', '2026-08-10', {
      crew: [{ id: 'x', email: '' }, { id: 'y', email: 'ukjent@x.no' }],
      emailToUser: new Map([['ukjent@x.no', 'user-9']]),
      availabilityByUser: new Map(), // ingen overlay for user-9
    });
    expect(res.size).toBe(0);
  });

  it('reversert start/end normaliseres', () => {
    const ctx = ctxWith(overlay([{ date: '2026-08-10', availability: 'unavailable' }]));
    const res = computeCrewConflictsFromAvailability(['crew-1'], '2026-08-11', '2026-08-09', ctx);
    expect(res.has('crew-1')).toBe(true);
  });

  it('tomt datointervall → tom map', () => {
    const ctx = ctxWith(overlay([{ date: '2026-08-10', availability: 'unavailable' }]));
    expect(computeCrewConflictsFromAvailability(['crew-1'], '', '', ctx).size).toBe(0);
  });
});
