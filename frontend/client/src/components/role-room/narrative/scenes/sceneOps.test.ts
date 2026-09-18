import { describe, expect, it } from 'vitest';
import {
  canRequestReview, dateInputToIso, filterScenes, isDuplicateCode, isOverdue, isValidSceneCode, isoToDateInput,
  nextSceneCode, sceneLabel, snapshotIsStale, taskProgress,
} from './sceneOps';
import type { NarrativeSceneReview, NarrativeSceneSummary } from '../narrativeTypes';

const scene = (over: Partial<NarrativeSceneSummary> = {}): NarrativeSceneSummary => ({
  id: 'nsc_1', projectId: 'p', code: 'S1', title: 'Skogpassasjen', subtitle: '', location: 'Skogen', challenge: '', gameplayMechanic: '',
  environment: '', status: 'idea', assigneeUserId: null, dueAt: null, heroAssetId: null, sortOrder: 0, createdBy: null,
  createdAt: '2026-09-16T08:00:00Z', updatedAt: '2026-09-16T08:00:00Z', latestReview: null, taskCounts: { total: 0, done: 0 }, ...over,
});
const review = (over: Partial<NarrativeSceneReview> = {}): NarrativeSceneReview => ({
  id: 'nsr_1', sceneId: 'nsc_1', projectId: 'p', round: 1, status: 'in_review', requestedBy: 'u1', requestedAt: '2026-09-16T09:00:00Z',
  requestNote: null, decidedByUserId: null, decidedByLabel: null, decidedAt: null, decisionNote: null, snapshotHash: 'a'.repeat(64), ...over,
});

describe('sceneOps — kode', () => {
  it('nextSceneCode hopper over ikke-S-koder og tåler tom liste', () => {
    expect(nextSceneCode([])).toBe('S1');
    expect(nextSceneCode(['S1', 'S2', 'B9', 's7'])).toBe('S8');
  });
  it('isValidSceneCode/isDuplicateCode normaliserer til store bokstaver', () => {
    expect(isValidSceneCode('s12')).toBe(true);
    expect(isValidSceneCode('scene 12')).toBe(false);
    expect(isValidSceneCode('S12345')).toBe(false);
    expect(isDuplicateCode('s1', ['S1'])).toBe(true);
    expect(isDuplicateCode('S1', ['S1'], 'S1')).toBe(false);
    expect(isDuplicateCode('', ['S1'])).toBe(false);
  });
});

describe('sceneOps — review-vern', () => {
  it('canRequestReview: åpen uendret runde → nei med forklaring; stale eller ingen runde → ja', () => {
    expect(canRequestReview({ reviews: [], currentSnapshotHash: 'x' }).ok).toBe(true);
    const blocked = canRequestReview({ reviews: [review()], currentSnapshotHash: 'a'.repeat(64) });
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toMatch(/Runde 1 er allerede åpen/);
    expect(canRequestReview({ reviews: [review()], currentSnapshotHash: 'b'.repeat(64) }).ok).toBe(true);
    expect(canRequestReview({ reviews: [review({ status: 'approved' })], currentSnapshotHash: 'b'.repeat(64) }).ok).toBe(true);
  });
  it('snapshotIsStale kun når en åpen runde har annen hash', () => {
    expect(snapshotIsStale({ reviews: [review()], currentSnapshotHash: 'a'.repeat(64) })).toBe(false);
    expect(snapshotIsStale({ reviews: [review()], currentSnapshotHash: 'c'.repeat(64) })).toBe(true);
    expect(snapshotIsStale({ reviews: [review({ status: 'approved' })], currentSnapshotHash: 'c'.repeat(64) })).toBe(false);
  });
});

describe('sceneOps — liste og datoer', () => {
  it('filterScenes søker i kode/tittel/lokasjon og filtrerer på status', () => {
    const scenes = [scene(), scene({ id: 'nsc_2', code: 'S2', title: 'Torget', location: 'Byen', status: 'approved' })];
    expect(filterScenes(scenes, { query: 'skog' }).map((s) => s.id)).toEqual(['nsc_1']);
    expect(filterScenes(scenes, { query: 's2' }).map((s) => s.id)).toEqual(['nsc_2']);
    expect(filterScenes(scenes, { status: 'approved' }).map((s) => s.id)).toEqual(['nsc_2']);
    expect(filterScenes(scenes, { status: 'all' })).toHaveLength(2);
  });
  it('taskProgress, isOverdue, sceneLabel', () => {
    expect(taskProgress([{ status: 'done' }, { status: 'todo' }, { status: 'doing' }])).toEqual({ total: 3, done: 1, pct: 33 });
    expect(taskProgress([])).toEqual({ total: 0, done: 0, pct: 0 });
    const now = Date.parse('2026-09-16T12:00:00Z');
    expect(isOverdue('2026-09-15T00:00:00Z', 'todo', now)).toBe(true);
    expect(isOverdue('2026-09-15T00:00:00Z', 'done', now)).toBe(false);
    expect(isOverdue('2026-09-15T00:00:00Z', 'approved', now)).toBe(false);
    expect(isOverdue(null, 'todo', now)).toBe(false);
    expect(sceneLabel({ code: 'S12', title: 'Skogpassasjen' })).toBe('S12 – Skogpassasjen');
    expect(sceneLabel({ code: 'S12', title: '' })).toBe('S12');
  });
  it('dato-rundtur input ⇄ ISO', () => {
    const iso = dateInputToIso('2026-10-01');
    expect(iso).toBeTruthy();
    expect(isoToDateInput(iso)).toBe('2026-10-01');
    expect(dateInputToIso('')).toBeNull();
    expect(isoToDateInput(null)).toBe('');
  });
});
