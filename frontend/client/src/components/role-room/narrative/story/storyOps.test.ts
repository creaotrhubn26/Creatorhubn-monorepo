import { describe, expect, it } from 'vitest';
import { groupScenesByEpisode, nextEpisodeCode, nextQuestionCode, timelineRows } from './storyOps';
import type { NarrativeEpisode, NarrativeOpenQuestion, NarrativeSceneSummary } from '../narrativeTypes';

const ep = (id: string, code: string): NarrativeEpisode => ({ id, projectId: 'p', code, title: code, summary: '', playersLearn: '', sourceNote: '', status: 'draft', sortOrder: 0, createdAt: '', updatedAt: '' });
const sc = (id: string, episodeId: string | null, era: NarrativeSceneSummary['era'] = '1797'): NarrativeSceneSummary => ({
  id, projectId: 'p', code: id.toUpperCase(), title: id, subtitle: '', location: '', challenge: '', gameplayMechanic: '', environment: '', status: 'idea', assigneeUserId: null, dueAt: null, heroAssetId: null, sortOrder: 0, createdBy: null, createdAt: '', updatedAt: '',
  beforeState: '', action: '', control: '', afterState: '', audio: '', changeNote: '', bridge: '', timeNote: '', knowledge: {}, era, episodeId, startAt: null, sourceRefs: [], workingId: null,
  latestReview: null, taskCounts: { total: 0, done: 0 },
});
const q = (code: string, kind: NarrativeOpenQuestion['kind'], status: NarrativeOpenQuestion['status'], question = '', decision = ''): NarrativeOpenQuestion => ({ id: code, projectId: 'p', code, kind, question, context: '', status, decision, decidedBy: null, decidedAt: null, sourceRefs: [], sortOrder: 0, createdAt: '', updatedAt: '' });

describe('storyOps', () => {
  it('grupperer scener per episode, løse sist', () => {
    const g = groupScenesByEpisode([ep('e1', 'E01'), ep('e2', 'E02')], [sc('p01', 'e1'), sc('g01', 'e2'), sc('h01', null), sc('x', 'ukjent')]);
    expect(g.map((x) => [x.episode?.code ?? null, x.scenes.length])).toEqual([['E01', 1], ['E02', 1], [null, 2]]);
  });
  it('tidslinje teller scener per epoke og kobler låste beslutninger', () => {
    const rows = timelineRows([sc('a', null, '1797'), sc('b', null, '1817'), sc('c', null, '1817')], [q('D04', 'question', 'done', 'Tidspunkt for voksenhistorien?', '1817, nåtid'), q('Q01', 'question', 'open', 'Hvorfor disse fire?')]);
    expect(rows.map((r) => [r.era, r.scenes, r.decisions.length])).toEqual([['1797', 1, 0], ['1817', 2, 1]]);
  });
  it('neste koder', () => {
    expect(nextQuestionCode([q('Q07', 'question', 'open'), q('C19', 'check', 'open')], 'question')).toBe('Q08');
    expect(nextQuestionCode([q('C19', 'check', 'open')], 'check')).toBe('C20');
    expect(nextEpisodeCode([ep('e', 'E12')])).toBe('E13');
    expect(nextEpisodeCode([])).toBe('E01');
  });
});
