// Forhåndsvisningen skal si sannheten om hva som brekker — og skille mellom
// det som må ryddes, det som bør sjekkes, og det som bare følger med.
import { describe, expect, it, vi } from 'vitest';

import {
  collectProductionDayChangeImpact,
  hasBlockingImpact,
} from './production-day-change-impact.js';

const INPUT = {
  projectId: 'project-1',
  dayId: 'day-6',
  fromDate: '2026-09-20',
  toDate: '2026-09-24',
};

/** Teller per tabell; alt som ikke nevnes er tomt. */
const poolWith = (counts: Record<string, number>) => ({
  query: vi.fn(async (text: string) => {
    const table = Object.keys(counts).find((name) => text.includes(name));
    return { rows: [{ count: table ? counts[table] : 0 }] };
  }),
});

describe('collectProductionDayChangeImpact', () => {
  it('reports nothing when the day has no ties', async () => {
    const impacts = await collectProductionDayChangeImpact(poolWith({}), INPUT);

    expect(impacts).toEqual([]);
    expect(hasBlockingImpact(impacts)).toBe(false);
  });

  it('blocks on a published call sheet', async () => {
    const impacts = await collectProductionDayChangeImpact(
      poolWith({ role_room_call_sheet_deliveries: 1 }), INPUT,
    );

    expect(impacts).toHaveLength(1);
    expect(impacts[0]).toMatchObject({ area: 'call_sheet', severity: 'blocking' });
    expect(impacts[0].summary).toContain('2026-09-20');
    expect(impacts[0].action).toBeTruthy();
    expect(hasBlockingImpact(impacts)).toBe(true);
  });

  it('warns without blocking on equipment, location and collisions', async () => {
    const impacts = await collectProductionDayChangeImpact(
      poolWith({
        equipment_bookings: 2,
        role_room_location_operations: 1,
        casting_schedules: 3,
      }),
      INPUT,
    );

    expect(impacts.map((i) => i.area).sort()).toEqual(['equipment', 'location', 'schedule']);
    expect(impacts.every((i) => i.severity === 'warning')).toBe(true);
    expect(hasBlockingImpact(impacts)).toBe(false);
  });

  it('names the target date for a collision and the old date for a booking', async () => {
    const impacts = await collectProductionDayChangeImpact(
      poolWith({ casting_schedules: 1, equipment_bookings: 1 }), INPUT,
    );
    const byArea = Object.fromEntries(impacts.map((i) => [i.area, i]));

    expect(byArea.schedule.summary).toContain('2026-09-24');
    expect(byArea.equipment.summary).toContain('2026-09-20');
  });

  it('reports continuity as information with no action to take', async () => {
    const impacts = await collectProductionDayChangeImpact(
      poolWith({ casting_production_continuity_media: 4 }), INPUT,
    );

    expect(impacts[0]).toMatchObject({ area: 'continuity', severity: 'info', count: 4 });
    expect(impacts[0].action).toBeUndefined();
    expect(hasBlockingImpact(impacts)).toBe(false);
  });

  it('gets singular and plural right so the sentence reads like Norwegian', async () => {
    const one = await collectProductionDayChangeImpact(
      poolWith({ equipment_bookings: 1 }), INPUT,
    );
    const many = await collectProductionDayChangeImpact(
      poolWith({ equipment_bookings: 2 }), INPUT,
    );

    expect(one[0].summary).toContain('1 utstyrsbooking dekker');
    expect(many[0].summary).toContain('2 utstyrsbookinger dekker');
  });

  it('lets a failing query surface instead of returning a short list', async () => {
    const pool = {
      query: vi.fn(async (text: string) => {
        if (text.includes('equipment_bookings')) throw new Error('timeout');
        return { rows: [{ count: 0 }] };
      }),
    };

    await expect(collectProductionDayChangeImpact(pool, INPUT)).rejects.toThrow('timeout');
  });

  it('excludes budget items, whose link column is never populated', async () => {
    const pool = poolWith({ role_room_budget_items: 9 });

    const impacts = await collectProductionDayChangeImpact(pool, INPUT);

    expect(impacts.map((i) => i.area)).not.toContain('budget');
    const queried = pool.query.mock.calls.map(([sql]) => String(sql)).join(' ');
    expect(queried).not.toContain('role_room_budget_items');
  });
});
