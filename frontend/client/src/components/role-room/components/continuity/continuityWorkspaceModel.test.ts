import { describe, expect, it } from 'vitest';
import type { CastingProject, ProductionDay } from '../../models/casting';
import {
  buildContinuityDailyReport,
  buildContinuityOperations,
  buildLinedScriptReport,
  continuitySummary,
  mergeContinuityServerMetadata,
  nextTakeNumber,
  restoreContinuitySnapshot,
} from './continuityWorkspaceModel';

const day: ProductionDay = { id: 'day-1', date: '2026-09-14', scenes: ['scene-1'], crew: [], props: [] };
const project: CastingProject = {
  id: 'troll', name: 'Troll', roles: [], candidates: [], schedules: [], props: [], crew: [], locations: [],
  sceneBreakdowns: [{ id: 'scene-1', projectId: 'troll', manuscriptId: 'script-1', sceneNumber: 1, sceneHeading: 'EXT. TROLLSKOG - DAG' }],
  productionDays: [day],
};

describe('continuityWorkspaceModel', () => {
  it('seeds only scenes assigned to the production day', () => {
    const operations = buildContinuityOperations(day);
    expect(operations.sceneRecords).toEqual([expect.objectContaining({ sceneId: 'scene-1', status: 'not_started' })]);
    expect(operations.takes).toEqual([]);
  });

  it('summarizes takes, circled takes and open continuity risks', () => {
    const operations = buildContinuityOperations({
      ...day,
      productionContinuity: {
        sceneRecords: [{ sceneId: 'scene-1', status: 'complete' }],
        takes: [
          { id: 'take-1', sceneId: 'scene-1', takeNumber: 1, status: 'good', circled: true },
          { id: 'take-2', sceneId: 'scene-1', takeNumber: 2, status: 'hold', circled: false },
        ],
        entries: [{ id: 'entry-1', sceneId: 'scene-1', category: 'props', description: 'Koppen flyttet seg.', severity: 'warning', references: [] }],
        deviations: [{ id: 'dev-1', sceneId: 'scene-1', type: 'continuity_risk', accepted: false }],
        comments: [], revisions: [], activity: [],
      },
    });

    expect(nextTakeNumber(operations, 'scene-1')).toBe(3);
    expect(continuitySummary(operations)).toEqual({ completedScenes: 1, totalScenes: 1, takes: 2, circledTakes: 1, openRisks: 2, deviations: 1 });
  });

  it('restores content without rolling back comments or audit metadata', () => {
    const current = buildContinuityOperations({
      ...day,
      productionContinuity: {
        sceneRecords: [{ sceneId: 'scene-1', status: 'complete' }], takes: [], entries: [], deviations: [],
        comments: [{ id: 'comment-1', message: 'Behold meg', createdAt: '2026-09-12T10:00:00Z' }],
        revisions: [], activity: [],
      },
    });
    const restored = restoreContinuitySnapshot(current, {
      sceneRecords: [{ sceneId: 'scene-1', status: 'in_progress' }], takes: [], entries: [], deviations: [],
    });
    expect(restored.sceneRecords[0].status).toBe('in_progress');
    expect(restored.comments[0].message).toBe('Behold meg');
  });

  it('merges new server comments into a local conflict draft', () => {
    const local = buildContinuityOperations(day);
    local.comments = [{ id: 'local', message: 'Lokal', createdAt: '2026-09-12T09:00:00Z' }];
    const remote = buildContinuityOperations(day);
    remote.comments = [{ id: 'remote', message: 'Regi', createdAt: '2026-09-12T10:00:00Z' }];
    expect(mergeContinuityServerMetadata(local, remote).comments.map((item) => item.id)).toEqual(['local', 'remote']);
  });

  it('exports both a machine-readable daily report and a lined-script handoff', () => {
    const operations = buildContinuityOperations(day);
    operations.takes.push({ id: 'take-1', sceneId: 'scene-1', takeNumber: 1, status: 'good', circled: true, continuityNotes: 'Ren take' });
    operations.deviations.push({ id: 'dev-1', sceneId: 'scene-1', type: 'improvised_dialogue', character: 'NORA', performedText: 'Kom nå!', accepted: true });
    expect(buildContinuityDailyReport(project, day, operations)).toContain('EXT. TROLLSKOG - DAG');
    expect(buildContinuityDailyReport(project, day, operations)).toContain('Ren take');
    expect(buildLinedScriptReport(project, day, operations)).toContain('NORA: Kom nå!');
  });
});
