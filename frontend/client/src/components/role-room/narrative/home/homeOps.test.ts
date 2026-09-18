import { describe, expect, it } from 'vitest';
import { bucketByDue, homeKpis, isEmptyProject, nextUpFromMilestones, pct, sortNextUp } from './homeOps';
import type { NarrativeMilestone, NarrativeProjectOverview } from '../narrativeTypes';

const NOW = new Date('2026-09-17T12:00:00Z').getTime();
const ms = (over: Partial<NarrativeMilestone>): NarrativeMilestone => ({
  id: 'nms_1', projectId: 'p', title: 'M', lane: 'story', startAt: null, dueAt: null, status: 'planned', ownerUserId: null, description: '', acceptance: '', evidence: '', sortOrder: 0, sceneIds: [], createdAt: '', updatedAt: '', ...over,
});
const overview = (over: Partial<NarrativeProjectOverview> = {}): NarrativeProjectOverview => ({
  scenes: { total: 10, byStatus: { idea: 4, in_progress: 2, in_review: 1, changes_requested: 0, approved: 2, implemented: 1 }, byEra: {}, withoutDates: 10 },
  gates: { total: 60, passed: 6, failed: 1, byKey: { script_coverage: { passed: 3, total: 10 }, greybox: { passed: 3, total: 10 }, characters_animation: { passed: 0, total: 10 }, playthrough: { passed: 0, total: 10 }, picture: { passed: 0, total: 10 }, audio: { passed: 0, total: 10 } } },
  tasks: { open: 5, overdue: 2, done: 3 }, reviews: { open: 1 }, lines: { total: 84, approved: 0 }, questions: { open: 5, checksOpen: 30 },
  platform: { requirements: 5, verified: 2, primaryName: 'iPad Pro M1' }, milestones: [], episodes: [], activity: [], unreadInbox: 0, ...over,
});

describe('homeOps', () => {
  it('pct avrunder og klemmer', () => {
    expect(pct(1, 3)).toBe(33); expect(pct(0, 0)).toBe(0); expect(pct(5, 2)).toBe(100);
  });
  it('bucketByDue: forfalt / i dag / snart / senere', () => {
    expect(bucketByDue('2026-09-10T00:00:00Z', NOW)).toBe('urgent');
    expect(bucketByDue('2026-09-17T18:00:00Z', NOW)).toBe('today');
    expect(bucketByDue('2026-09-25T00:00:00Z', NOW)).toBe('soon');
    expect(bucketByDue('2026-12-01T00:00:00Z', NOW)).toBeNull();
    expect(bucketByDue(null, NOW)).toBeNull();
  });
  it('nextUpFromMilestones hopper over ferdige, tar blokkerte uten frist som forfalt, sorterer bucket → dato', () => {
    const items = sortNextUp(nextUpFromMilestones([
      ms({ id: 'a', title: 'Ferdig', status: 'done', dueAt: '2026-09-10T00:00:00Z' }),
      ms({ id: 'b', title: 'Snart', dueAt: '2026-09-28T00:00:00Z' }),
      ms({ id: 'c', title: 'Blokkert', status: 'blocked' }),
      ms({ id: 'd', title: 'Forfalt', dueAt: '2026-09-01T00:00:00Z' }),
    ], NOW));
    expect(items.map((i) => i.title)).toEqual(['Forfalt', 'Blokkert', 'Snart']);
  });
  it('homeKpis: gate-KPI uten startede scener viser «–» i stedet for 0 %', () => {
    const k = homeKpis(overview({ gates: { total: 0, passed: 0, failed: 0, byKey: { script_coverage: { passed: 0, total: 0 }, greybox: { passed: 0, total: 0 }, characters_animation: { passed: 0, total: 0 }, playthrough: { passed: 0, total: 0 }, picture: { passed: 0, total: 0 }, audio: { passed: 0, total: 0 } } } }));
    expect(k.find((x) => x.key === 'gates')).toMatchObject({ value: '–', sub: 'ingen scener startet ennå', tone: 'neutral', pct: 0 });
  });
  it('homeKpis regner prosent og toner', () => {
    const k = homeKpis(overview());
    expect(k.find((x) => x.key === 'scenes')).toMatchObject({ value: '10', pct: 30, tab: 'scenes' });
    expect(k.find((x) => x.key === 'gates')).toMatchObject({ value: '10 %', tone: 'warning', sub: '6 av 60 bestått · 6 scener startet · 1 feilet' });
    expect(k.find((x) => x.key === 'tasks')).toMatchObject({ value: '5', tone: 'error' });
    expect(k.find((x) => x.key === 'platform')).toMatchObject({ value: '2/5', pct: 40 });
  });
  it('isEmptyProject', () => {
    expect(isEmptyProject(overview())).toBe(false);
    expect(isEmptyProject(overview({ scenes: { total: 0, byStatus: { idea: 0, in_progress: 0, in_review: 0, changes_requested: 0, approved: 0, implemented: 0 }, byEra: {}, withoutDates: 0 }, lines: { total: 0, approved: 0 }, episodes: [], milestones: [] }))).toBe(true);
  });
});
