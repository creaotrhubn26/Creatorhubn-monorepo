import { describe, expect, it } from 'vitest';
import {
  balancedChunks, adjustToWorkingDay, nextWorkingDayMs, planProductionDays,
} from '../productionScheduler';

const DAY = 86_400_000;
// Mandag 2026-06-01 00:00 UTC
const MON = Date.UTC(2026, 5, 1);

describe('balancedChunks (jevn fordeling)', () => {
  it('deler 9 / maks 8 til [5, 4] — ikke [8, 1]', () => {
    const r = balancedChunks([1, 2, 3, 4, 5, 6, 7, 8, 9], 8);
    expect(r.map((c) => c.length)).toEqual([5, 4]);
  });

  it('én bit når alt får plass', () => {
    expect(balancedChunks([1, 2, 3], 8).map((c) => c.length)).toEqual([3]);
  });

  it('tom liste → én tom dag (rigg/scouting)', () => {
    expect(balancedChunks([], 8)).toEqual([[]]);
  });

  it('17 / maks 8 → tre mest mulig like dager [6, 6, 5]', () => {
    const r = balancedChunks(Array.from({ length: 17 }, (_, i) => i), 8);
    expect(r.map((c) => c.length)).toEqual([6, 6, 5]);
  });
});

describe('helg-hopping', () => {
  it('lørdag flyttes til mandag når skipWeekends=true', () => {
    const SAT = Date.UTC(2026, 5, 6); // lørdag
    const adjusted = adjustToWorkingDay(SAT, true);
    expect(new Date(adjusted).getUTCDay()).toBe(1); // mandag
  });

  it('beholder helg når skipWeekends=false', () => {
    const SAT = Date.UTC(2026, 5, 6);
    expect(adjustToWorkingDay(SAT, false)).toBe(SAT);
  });

  it('nextWorkingDay hopper fredag → mandag', () => {
    const FRI = Date.UTC(2026, 5, 5); // fredag
    const next = nextWorkingDayMs(FRI, true);
    expect(new Date(next).getUTCDay()).toBe(1); // mandag, ikke lørdag
  });
});

describe('planProductionDays', () => {
  it('én dag per location, sekvensielle datoer', () => {
    const plan = planProductionDays(
      [
        { id: 'a', name: 'Studio A', assignedScenes: ['s1', 's2'] },
        { id: 'b', name: 'Park', assignedScenes: ['s3'] },
      ],
      { startDateMs: MON, maxScenesPerDay: 8, skipWeekends: false },
    );
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ locationId: 'a', dateIso: '2026-06-01', partCount: 1 });
    expect(plan[1]).toMatchObject({ locationId: 'b', dateIso: '2026-06-02' });
  });

  it('deler stor location over flere dager med del-etikett', () => {
    const plan = planProductionDays(
      [{ id: 'a', name: 'Studio A', assignedScenes: Array.from({ length: 9 }, (_, i) => `s${i}`) }],
      { startDateMs: MON, maxScenesPerDay: 8, skipWeekends: false },
    );
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ partIndex: 1, partCount: 2, label: 'Studio A (del 1/2)' });
    expect(plan[0].scenes).toHaveLength(5);
    expect(plan[1].scenes).toHaveLength(4);
  });

  it('hopper over helg når skipWeekends=true', () => {
    // Start fredag → tre dager skal lande fre, man, tir (ikke lør/søn)
    const FRI = Date.UTC(2026, 5, 5);
    const plan = planProductionDays(
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ],
      { startDateMs: FRI, maxScenesPerDay: 8, skipWeekends: true },
    );
    expect(plan.map((d) => d.dateIso)).toEqual(['2026-06-05', '2026-06-08', '2026-06-09']);
  });

  it('location uten scener får fortsatt en dag', () => {
    const plan = planProductionDays(
      [{ id: 'a', name: 'Tom location' }],
      { startDateMs: MON, maxScenesPerDay: 8, skipWeekends: false },
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].scenes).toEqual([]);
  });
});
