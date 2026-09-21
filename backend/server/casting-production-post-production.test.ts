import { describe, expect, it } from 'vitest';

import {
  applyPostProductionCommand,
  collectPostStoryboardImpact,
  collectPostTurnoverImpact,
  emptyPostProductionOperations,
  normalizePostProductionOperations,
  type PostCommandContext,
  type PostPictureSourceSnapshot,
  type PostProductionSoundSourceSnapshot,
  type PostStoryboardReferenceSnapshot,
} from './casting-production-post-production.js';

const source = (overrides: Partial<PostProductionSoundSourceSnapshot> = {}): PostProductionSoundSourceSnapshot => ({
  sourceType: 'production_sound',
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

const pictureSource = (overrides: Partial<PostPictureSourceSnapshot> = {}): PostPictureSourceSnapshot => ({
  sourceType: 'picture',
  workspaceProjectId: '6cae5551-4d32-4b22-8c26-79fa61f8c7b1',
  versionId: 'b70ea5f0-06a4-4a1b-b357-83d7872bdf9f',
  versionNumber: 2,
  versionLabel: 'Director cut',
  versionStatus: 'under_review',
  storageObjectId: 'f48ba060-ebf0-4509-b77a-e889716495ab',
  displayName: 'troll-v2.mp4',
  checksumSha256: 'b'.repeat(64),
  sizeBytes: 4096,
  contentType: 'video/mp4',
  durationSeconds: 92,
  latestVersionNumberAtCapture: 2,
  versionCreatedAt: '2026-09-21T09:30:00.000Z',
  capturedAt: '2026-09-21T10:00:00.000Z',
  ...overrides,
});

const context: PostCommandContext = {
  actorUserId: 'post-supervisor-1',
  now: '2026-09-21T10:15:00.000Z',
  createId: (prefix) => `${prefix}-1`,
};

const storyboardReference = (
  overrides: Partial<PostStoryboardReferenceSnapshot> = {},
): PostStoryboardReferenceSnapshot => ({
  reviewRoundId: '0f4813b2-ed6c-47c4-a982-7d8e9093c0a1',
  manuscriptId: 'troll-manus',
  manuscriptTitle: 'Troll',
  version: 3,
  label: 'Regigodkjent',
  snapshotHash: 'c'.repeat(64),
  scriptFingerprint: 'd'.repeat(64),
  status: 'approved',
  frameCount: 12,
  totalDurationSeconds: 44,
  latestApprovedVersionAtCapture: 3,
  capturedAt: '2026-09-21T10:00:00.000Z',
  frames: [{
    frameId: 'frame-1', sceneId: 'scene-1', sceneHeading: 'EXT. FJELL – NATT',
    sceneNumber: '1', shotNumber: '1A', description: 'Trollet reiser seg.', durationSeconds: 4,
  }],
  ...overrides,
});

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

  it('captures an approved storyboard revision and selected panels with the turnover', () => {
    const operations = applyPostProductionCommand(emptyPostProductionOperations(), {
      type: 'create_turnover',
      label: 'Picture V2',
      source: pictureSource(),
      storyboardReference: storyboardReference(),
    }, context);

    expect(operations.turnovers[0].storyboardReference).toEqual(expect.objectContaining({
      reviewRoundId: '0f4813b2-ed6c-47c4-a982-7d8e9093c0a1',
      version: 3,
      frames: [expect.objectContaining({ frameId: 'frame-1', shotNumber: '1A' })],
    }));
    expect(normalizePostProductionOperations(operations).turnovers[0].storyboardReference?.status).toBe('approved');
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

  it('tracks picture storage drift and a newer editorial version', () => {
    const impact = collectPostTurnoverImpact(pictureSource(), pictureSource({
      checksumSha256: 'c'.repeat(64),
      latestVersionNumberAtCapture: 3,
    }));

    expect(impact).toEqual(expect.objectContaining({ stale: true, blocking: true }));
    expect(impact.items.map((item) => item.code)).toEqual([
      'picture_asset_changed',
      'new_picture_version_available',
    ]);
  });

  it('blocks mutated storyboard snapshots and warns about a newer approved revision', () => {
    const impact = collectPostStoryboardImpact(storyboardReference(), {
      reviewRoundId: '0f4813b2-ed6c-47c4-a982-7d8e9093c0a1',
      version: 3,
      status: 'approved',
      snapshotHash: 'e'.repeat(64),
      latestApprovedVersion: 4,
      availableFrameIds: ['frame-1'],
    });

    expect(impact).toEqual(expect.objectContaining({ stale: true, blocking: true }));
    expect(impact.items.map((item) => item.code)).toEqual([
      'storyboard_snapshot_changed',
      'new_storyboard_revision_available',
    ]);
  });

  it('normalizes historic sound manifests without a discriminator', () => {
    const historic = structuredClone(createdOperations()) as unknown as {
      turnovers: Array<{ source: Record<string, unknown> }>;
    };
    delete historic.turnovers[0].source.sourceType;

    expect(normalizePostProductionOperations(historic).turnovers[0].source.sourceType).toBe('production_sound');
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
