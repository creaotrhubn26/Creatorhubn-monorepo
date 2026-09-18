// Forhåndsvisningen skal si sannheten om hva som brekker — og skille mellom
// det som må ryddes, det som bør sjekkes, og det som bare følger med.
import { describe, expect, it, vi } from 'vitest';

import {
  collectProductionDayChangeImpact,
  collectProductionDayLocationImpact,
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

describe('collectProductionDayLocationImpact', () => {
  const INPUT = {
    projectId: 'project-1',
    dayId: 'day-6',
    fromLocationId: 'loc-old',
    toLocationId: 'loc-new',
  };

  /** Teller per tabell, men skiller gammel og ny lokasjon på parameteren. */
  const locationPool = (counts: {
    callSheets?: number; oldOps?: number; newOps?: number; scout?: number;
  }) => ({
    query: vi.fn(async (text: string, params?: unknown[]) => {
      if (text.includes('role_room_call_sheet_deliveries')) {
        return { rows: [{ count: counts.callSheets ?? 0 }] };
      }
      if (text.includes('casting_location_scout_media')) {
        return { rows: [{ count: counts.scout ?? 0 }] };
      }
      if (text.includes('role_room_location_operations')) {
        const isOld = Array.isArray(params) && params[1] === 'loc-old';
        return { rows: [{ count: isOld ? (counts.oldOps ?? 0) : (counts.newOps ?? 0) }] };
      }
      return { rows: [{ count: 0 }] };
    }),
  });

  it('warns when the new location has no clearance work at all', async () => {
    const impacts = await collectProductionDayLocationImpact(locationPool({}), INPUT);

    expect(impacts).toHaveLength(1);
    expect(impacts[0]).toMatchObject({ area: 'location_readiness', severity: 'warning' });
    expect(impacts[0].action).toContain('tillatelser');
  });

  it('stays quiet about readiness when the new location is already worked up', async () => {
    const impacts = await collectProductionDayLocationImpact(locationPool({ newOps: 1 }), INPUT);

    expect(impacts.map((i) => i.area)).not.toContain('location_readiness');
  });

  it('flags the work already done on the old location', async () => {
    const impacts = await collectProductionDayLocationImpact(
      locationPool({ oldOps: 1, newOps: 1 }), INPUT,
    );

    expect(impacts).toHaveLength(1);
    expect(impacts[0]).toMatchObject({ area: 'location', severity: 'warning' });
  });

  it('blocks on a published call sheet, which names the old location', async () => {
    const impacts = await collectProductionDayLocationImpact(
      locationPool({ callSheets: 1, newOps: 1 }), INPUT,
    );

    expect(hasBlockingImpact(impacts)).toBe(true);
    expect(impacts[0].area).toBe('call_sheet');
  });

  it('mentions scout media as information only', async () => {
    const impacts = await collectProductionDayLocationImpact(
      locationPool({ scout: 3, newOps: 1 }), INPUT,
    );

    expect(impacts[0]).toMatchObject({ area: 'scout_media', severity: 'info', count: 3 });
    expect(impacts[0].action).toBeUndefined();
    expect(hasBlockingImpact(impacts)).toBe(false);
  });

  it('asks nothing about an old location when the day had none', async () => {
    const pool = locationPool({ newOps: 1 });

    await collectProductionDayLocationImpact(pool, { ...INPUT, fromLocationId: null });

    const queried = pool.query.mock.calls.map(([sql]) => String(sql)).join(' ');
    expect(queried).not.toContain('casting_location_scout_media');
  });

  it('does not guess at the contents of the operations blob', async () => {
    const pool = locationPool({ oldOps: 1, newOps: 1 });

    await collectProductionDayLocationImpact(pool, INPUT);

    // Målt mot produksjon var tabellen tom; en advarsel bygget på felter
    // ingen har fylt ut ville vært en gjetning.
    const queried = pool.query.mock.calls.map(([sql]) => String(sql)).join(' ');
    expect(queried).not.toContain('clearanceGates');
    expect(queried).not.toContain('decisionStatus');
  });
});
