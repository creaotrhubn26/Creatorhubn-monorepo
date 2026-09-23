import { describe, expect, it } from 'vitest';

import type { PostProductionRecord, PostTurnoverManifest } from '../../models/casting';
import {
  buildPostProductionBrief,
  isPostProductionSurface,
  nextTurnoverAction,
} from './postProductionWorkspaceModel';

const turnover = (overrides: Partial<PostTurnoverManifest> = {}): PostTurnoverManifest => ({
  id: 'turnover-1',
  label: 'Dag 1',
  status: 'received',
  source: { sourceType: 'production_sound', productionDayId: 'day-1', soundVersion: 1, capturedAt: '2026-09-21T10:00:00Z', availableMediaIds: [], media: [] },
  issues: [],
  events: [],
  impact: { stale: false, blocking: false, items: [] },
  createdBy: 'sound-1',
  createdAt: '2026-09-21T10:00:00Z',
  updatedBy: 'post-1',
  updatedAt: '2026-09-21T11:00:00Z',
  ...overrides,
});

describe('postProductionWorkspaceModel', () => {
  it('recognizes only canonical surfaces', () => {
    expect(isPostProductionSurface('turnovers')).toBe(true);
    expect(isPostProductionSurface('delivery')).toBe(false);
  });

  it('summarizes stale manifests and receiver QC', () => {
    const record: PostProductionRecord = {
      projectId: 'troll',
      version: 2,
      operations: {
        turnovers: [turnover({
          status: 'qc_issues',
          impact: { stale: true, blocking: false, items: [{ code: 'sound_report_changed', severity: 'warning', message: 'Endret' }] },
          issues: [{
            id: 'issue-1', severity: 'blocker', message: 'Manglende fil', status: 'open',
            createdBy: 'post-1', createdAt: '2026-09-21T11:00:00Z',
          }],
        })],
      },
    };
    expect(buildPostProductionBrief(record)).toEqual(expect.objectContaining({
      activeCount: 1,
      staleCount: 1,
      openIssueCount: 1,
      blockingIssueCount: 1,
    }));
  });

  it('requires resolved QC before redelivery', () => {
    const withIssue = turnover({
      status: 'qc_issues',
      issues: [{ id: 'issue-1', severity: 'warning', message: 'Støy', status: 'open', createdBy: 'post-1', createdAt: '2026-09-21T11:00:00Z' }],
    });
    expect(nextTurnoverAction(withIssue)).toBeNull();
    expect(nextTurnoverAction({
      ...withIssue,
      issues: [{ ...withIssue.issues[0], status: 'resolved', resolvedBy: 'post-1', resolvedAt: '2026-09-21T12:00:00Z' }],
    })).toEqual(expect.objectContaining({ status: 'ready', authority: 'prepare' }));
  });
});
