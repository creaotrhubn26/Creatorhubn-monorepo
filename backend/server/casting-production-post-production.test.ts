import { describe, expect, it } from 'vitest';

import {
  applyPostProductionCommand,
  collectPostTurnoverImpact,
  emptyPostProductionOperations,
  normalizePostProductionOperations,
  type PostCommandContext,
  type PostTurnoverSourceSnapshot,
} from './casting-production-post-production.js';

const source = (overrides: Partial<PostTurnoverSourceSnapshot> = {}): PostTurnoverSourceSnapshot => ({
  productionDayId: 'day-1',
  soundVersion: 4,
  capturedAt: '2026-09-21T10:00:00.000Z',
  availableMediaIds: ['media-1'],
  media: [{
    mediaId: 'media-1',
    storageObjectId: 'object-1',
    displayName: 'TROLL_012_003.wav',
    checksumSha256: 'a'.repeat(64),
    sizeBytes: 1024,
    reconciliationStatus: 'matched',
    continuityTakeId: 'take-3',
    createdAt: '2026-09-21T09:00:00.000Z',
  }],
  ...overrides,
});

const context: PostCommandContext = {
  actorUserId: 'post-supervisor-1',
  now: '2026-09-21T10:15:00.000Z',
  createId: (prefix) => `${prefix}-1`,
};

function createdOperations() {
  return applyPostProductionCommand(emptyPostProductionOperations(), {
    type: 'create_turnover',
    label: 'Dag 1 · Production Sound',
    recipient: 'Sound Designer',
    source: source(),
  }, context);
}

describe('post-production turnover state machine', () => {
  it('creates an immutable source snapshot without storage duplication', () => {
    const operations = createdOperations();

    expect(operations.turnovers[0]).toEqual(expect.objectContaining({
      status: 'draft',
      createdBy: 'post-supervisor-1',
      source: expect.objectContaining({
        productionDayId: 'day-1',
        media: [expect.objectContaining({ mediaId: 'media-1', storageObjectId: 'object-1' })],
      }),
    }));
  });

  it('enforces the ready → received → accepted flow', () => {
    const noImpact = { stale: false, blocking: false, items: [] } as const;
    let operations = createdOperations();
    operations = applyPostProductionCommand(operations, {
      type: 'transition_turnover', turnoverId: 'post-turnover-1', status: 'ready', impact: noImpact,
    }, context);
    operations = applyPostProductionCommand(operations, {
      type: 'transition_turnover', turnoverId: 'post-turnover-1', status: 'received', impact: noImpact,
    }, context);
    operations = applyPostProductionCommand(operations, {
      type: 'transition_turnover', turnoverId: 'post-turnover-1', status: 'accepted', impact: noImpact,
    }, context);

    expect(operations.turnovers[0].status).toBe('accepted');
    expect(operations.turnovers[0].events).toHaveLength(4);
  });

  it('turns a receiver QC note into a blocking workflow state', () => {
    const noImpact = { stale: false, blocking: false, items: [] } as const;
    let operations = createdOperations();
    for (const status of ['ready', 'received'] as const) {
      operations = applyPostProductionCommand(operations, {
        type: 'transition_turnover', turnoverId: 'post-turnover-1', status, impact: noImpact,
      }, context);
    }
    operations = applyPostProductionCommand(operations, {
      type: 'add_qc_issue',
      turnoverId: 'post-turnover-1',
      severity: 'blocker',
      message: 'Manglende poly-WAV for scene 12.',
    }, context);

    expect(operations.turnovers[0].status).toBe('qc_issues');
    expect(() => applyPostProductionCommand(operations, {
      type: 'transition_turnover', turnoverId: 'post-turnover-1', status: 'ready', impact: noImpact,
    }, context)).toThrow('Alle QC-avvik');
  });

  it('detects missing, changed and newly available source media', () => {
    const current = source({
      soundVersion: 5,
      availableMediaIds: ['media-1', 'media-2'],
      media: [{
        ...source().media[0],
        reconciliationStatus: 'unmatched',
        continuityTakeId: undefined,
      }, {
        ...source().media[0],
        mediaId: 'media-2',
        storageObjectId: 'object-2',
        displayName: 'TROLL_WILD_001.wav',
      }],
    });

    const impact = collectPostTurnoverImpact(source(), current);

    expect(impact.stale).toBe(true);
    expect(impact.items.map((item) => item.code)).toEqual([
      'sound_report_changed',
      'media_reconciliation_changed',
      'new_media_available',
    ]);
  });

  it('refuses acceptance when the source has drifted', () => {
    const noImpact = { stale: false, blocking: false, items: [] } as const;
    let operations = createdOperations();
    for (const status of ['ready', 'received'] as const) {
      operations = applyPostProductionCommand(operations, {
        type: 'transition_turnover', turnoverId: 'post-turnover-1', status, impact: noImpact,
      }, context);
    }
    const changed = collectPostTurnoverImpact(source(), source({ soundVersion: 5 }));

    expect(() => applyPostProductionCommand(operations, {
      type: 'transition_turnover', turnoverId: 'post-turnover-1', status: 'accepted', impact: changed,
    }, context)).toThrow('Kildegrunnlaget er endret');
  });

  it('rejects invalid persisted checksums and empty media files', () => {
    const operations = createdOperations();
    const invalidChecksum = structuredClone(operations);
    invalidChecksum.turnovers[0].source.media[0].checksumSha256 = 'not-a-sha256';
    expect(() => normalizePostProductionOperations(invalidChecksum)).toThrow('gyldig SHA-256');

    const emptyMedia = structuredClone(operations);
    emptyMedia.turnovers[0].source.media[0].sizeBytes = 0;
    expect(() => normalizePostProductionOperations(emptyMedia)).toThrow('større enn null');
  });
});
