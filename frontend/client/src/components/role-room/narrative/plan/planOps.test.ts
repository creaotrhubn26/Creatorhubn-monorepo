import { describe, expect, it } from 'vitest';
import { dateToPercent, isoWeek, laneRows, monthBands, planWindow, sortMilestones, weekBands } from './planOps';
import type { NarrativeMilestone, NarrativeSceneSummary } from '../narrativeTypes';

const NOW = new Date('2026-09-17T12:00:00Z').getTime();
const ms = (over: Partial<NarrativeMilestone>): NarrativeMilestone => ({ id: 'm', projectId: 'p', title: 'M', lane: 'story', startAt: null, dueAt: null, status: 'planned', ownerUserId: null, description: '', acceptance: '', evidence: '', sortOrder: 0, sceneIds: [], createdAt: '', updatedAt: '', ...over });
const sc = (over: Partial<NarrativeSceneSummary>): NarrativeSceneSummary => ({ id: 's', projectId: 'p', code: 'P01', title: 'S', subtitle: '', location: '', challenge: '', gameplayMechanic: '', environment: '', status: 'idea', assigneeUserId: null, dueAt: null, heroAssetId: null, sortOrder: 0, createdBy: null, createdAt: '', updatedAt: '', beforeState: '', action: '', control: '', afterState: '', audio: '', changeNote: '', bridge: '', timeNote: '', knowledge: {}, era: '1797', episodeId: null, startAt: null, sourceRefs: [], workingId: null, latestReview: null, taskCounts: { total: 0, done: 0 }, ...over });

describe('planOps', () => {
  it('planWindow starter 7 d før tidligste dato og dekker zoom-dager', () => {
    const w = planWindow([{ startAt: '2026-10-01T00:00:00Z', dueAt: null }], 'month', NOW);
    // planWindow klipper til døgnstart i lokal tid, så fasiten må regnes
    // ut på samme måte. Den hardkodede UTC-datoen var grønn bare i UTC og
    // rød i Europa/Oslo — altså overalt der den faktisk skrives.
    const forventetStart = new Date(NOW - 7 * 86_400_000);
    forventetStart.setHours(0, 0, 0, 0);
    expect(w.start).toBe(forventetStart.getTime());
    expect((w.end - w.start) / 86_400_000).toBe(124);
  });
  it('dateToPercent klemmer til 0–100', () => {
    const w = { start: 0, end: 100 * 86_400_000 };
    expect(dateToPercent(50 * 86_400_000, w)).toBe(50);
    expect(dateToPercent(-5, w)).toBe(0);
    expect(dateToPercent(1e15, w)).toBe(100);
  });
  it('bånd dekker vinduet i rekkefølge', () => {
    const w = planWindow([], 'quarter', NOW);
    const months = monthBands(w);
    expect(months.length).toBeGreaterThanOrEqual(12);
    expect(months[0].leftPct).toBe(0);
    const weeks = weekBands(planWindow([], 'week', NOW));
    expect(weeks.length).toBeGreaterThanOrEqual(8);
    expect(isoWeek(new Date('2026-01-01T00:00:00'))).toBe(1);
  });
  it('laneRows fordeler på baner, scener under story, uten dato i egen liste, forfalt markeres', () => {
    const w = planWindow([], 'month', NOW);
    const { rows, undated } = laneRows([
      ms({ id: 'a', title: 'Gråboks', lane: 'greybox', startAt: '2026-09-10T00:00:00Z', dueAt: '2026-09-20T00:00:00Z' }),
      ms({ id: 'b', title: 'Forfalt', lane: 'engineering', dueAt: '2026-09-01T00:00:00Z' }),
      ms({ id: 'c', title: 'Uten dato', lane: 'playtest' }),
    ], [sc({ id: 's1', dueAt: '2026-09-25T00:00:00Z' }), sc({ id: 's2', code: 'P02' })], w, NOW);
    expect(rows.map((r) => r.lane)).toEqual(['story', 'greybox', 'engineering']);
    expect(rows.find((r) => r.lane === 'engineering')!.bars[0].overdue).toBe(true);
    expect(rows.find((r) => r.lane === 'greybox')!.bars[0].widthPct).toBeGreaterThan(rows.find((r) => r.lane === 'engineering')!.bars[0].widthPct);
    expect(undated.map((b) => b.title)).toEqual(['Uten dato', 'P02 · S']);
  });
  it('sortMilestones', () => {
    const items = [ms({ id: '1', title: 'B', status: 'done', dueAt: '2026-10-01T00:00:00Z', lane: 'other' }), ms({ id: '2', title: 'A', status: 'blocked', lane: 'story' })];
    expect(sortMilestones(items, 'status').map((m) => m.id)).toEqual(['2', '1']);
    expect(sortMilestones(items, 'due').map((m) => m.id)).toEqual(['1', '2']);
    expect(sortMilestones(items, 'title').map((m) => m.id)).toEqual(['2', '1']);
    expect(sortMilestones(items, 'lane').map((m) => m.id)).toEqual(['2', '1']);
  });
});
