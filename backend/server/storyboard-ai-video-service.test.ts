import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

const {
  archiveMock,
  creditMoveMock,
  emitMeterMock,
  falOutputUrlMock,
  falPollMock,
  falSubmitMock,
  getSettingsMock,
  higgsfieldEstimateMock,
  higgsfieldPollMock,
  higgsfieldSubmitMock,
  lockCompatMock,
  validateMirrorMock,
  presignMock,
  meterEligibilityMock,
} = vi.hoisted(() => ({
  archiveMock: vi.fn(),
  creditMoveMock: vi.fn(),
  emitMeterMock: vi.fn(),
  falOutputUrlMock: vi.fn(() => ({ url: null, isVideo: true })),
  falPollMock: vi.fn(),
  falSubmitMock: vi.fn(),
  getSettingsMock: vi.fn(),
  higgsfieldEstimateMock: vi.fn(),
  higgsfieldPollMock: vi.fn(),
  higgsfieldSubmitMock: vi.fn(),
  lockCompatMock: vi.fn(),
  validateMirrorMock: vi.fn(),
  presignMock: vi.fn(),
  meterEligibilityMock: vi.fn(),
}));

vi.mock('./generative-media.js', () => ({
  GEN_MODELS: {
    'seedance-2-i2v': {
      key: 'seedance-2-i2v', label: 'Seedance 2', provider: 'bytedance',
      falPath: 'seedance', estCostUsd: 0.5, costPerSecondUsd: 0.1,
    },
    'higgsfield-dop-i2v': {
      key: 'higgsfield-dop-i2v', label: 'Higgsfield DoP', provider: 'higgsfield',
      falPath: '', estCostUsd: 0.5, costPerSecondUsd: 0.1,
    },
  },
  getGenSettings: getSettingsMock,
  verifyGenAiMeterEligibility: meterEligibilityMock,
  aiAllowed: vi.fn(() => true),
  falConfigured: vi.fn(() => true),
  higgsfieldConfigured: vi.fn(() => true),
  falSubmit: falSubmitMock,
  falPoll: falPollMock, falOutputUrl: falOutputUrlMock,
  higgsfieldEstimate: higgsfieldEstimateMock,
  higgsfieldSubmit: higgsfieldSubmitMock,
  higgsfieldPoll: higgsfieldPollMock, emitGenAiMeter: emitMeterMock,
}));

vi.mock('./b2-archive-helper.js', () => ({
  archiveToRoleRoomB2: archiveMock, presignRoleRoomB2Download: presignMock,
}));

vi.mock('./ai-credits.js', () => ({
  getUserCredits: vi.fn(async () => ({ balanceUsd: 100, purchasedUsd: 100, spentUsd: 0 })),
  creditMove: creditMoveMock,
}));

vi.mock('./storyboard-ai-image-stage-service.js', () => ({
  lockAndValidateStoryboardCompatSource: lockCompatMock,
  StoryboardAIImageStageError: class extends Error {
    constructor(readonly status: number) { super('stage_error'); }
  },
  storyboardSourceRevision: (metadata: any) => Number(metadata?.sourceRevision ?? 0),
  validateStoryboardCompatMirror: validateMirrorMock,
}));

import {
  acceptStoryboardVideoHiggsfieldWebhook,
  getStoryboardVideoConfig,
  pollStoryboardVideo,
  preflightStoryboardVideo,
  StoryboardVideoError,
  storyboardVideoSubmittingIsWithinGrace,
  storyboardVideoBindingFingerprintV1,
  storyboardVideoMotionBindingV1,
  validateStoryboardVideoSourceSnapshot,
  submitStoryboardVideo,
} from './storyboard-ai-video-service.js';

import {
  cameraMotionRenderFingerprintV1,
} from './storyboard-camera-motion.js';
describe('Higgsfield submit recovery grace', () => {
  const now = Date.parse('2026-08-29T20:00:00.000Z');

  it('keeps a provider POST claimant active inside the two-minute window', () => {
    expect(storyboardVideoSubmittingIsWithinGrace(
      '2026-08-29T19:58:01.000Z', now,
    )).toBe(true);
  });

  it('allows orphan recovery at the boundary and rejects invalid clocks', () => {
    expect(storyboardVideoSubmittingIsWithinGrace(
      '2026-08-29T19:58:00.000Z', now,
    )).toBe(false);
    expect(storyboardVideoSubmittingIsWithinGrace(null, now)).toBe(false);
    expect(storyboardVideoSubmittingIsWithinGrace(
      '2026-08-29T20:00:01.000Z', now,
    )).toBe(false);
  });
});
const baseVersionId = '11111111-1111-4111-8111-111111111111';
const videoFraming = {
  version: 1, centerX: 0.5, centerY: 0.5, zoom: 1,
  rollDegrees: 0, aspectRatio: 16 / 9, mode: 'automatic', revision: 1,
};
const paintoverState = {
  version: 1,
  colorRevision: 0,
  atmosphereRevision: 0,
  atmosphereStale: false,
  videoStale: true,
  colorFingerprint: 'a'.repeat(64),
  atmosphereFingerprint: 'b'.repeat(64),
  colorHasContent: false,
  atmosphereHasContent: false,
};
const approvedBaseImage = `data:image/png;base64,${Buffer.from(
  'approved-color-animation-source',
).toString('base64')}`;
const atmosphereEditedState = {
  ...paintoverState,
  atmosphereRevision: 1,
  atmosphereFingerprint: 'e'.repeat(64),
  atmosphereHasContent: false,
  videoStale: true,
};
const videoSourceRequest = {
  sourceStage: 'color' as const,
  baseVersionId,
  shotFraming: videoFraming,
};

function approvedBaseRow(sourceRevision = 0, imageData = approvedBaseImage) {
  return {
    id: baseVersionId,
    stage: 'color',
    image_data: imageData,
    metadata: {
      sourceRevision,
      compatSourceUpdatedAt: 'source-token-1',
      framingFingerprint: 'framing-fingerprint',
    },
  };
}
function videoBinding(
  sourceRevision = 4,
  frameUpdatedAt = 'frame-token-1',
  sourceStage: 'color' | 'atmosphere' = 'color',
) {
  return {
    sourceStage,
    baseVersionId,
    frameUpdatedAt,
    sourceUpdatedAt: 'source-token-1',
    sourceRevision,
    framingFingerprint: 'framing-fingerprint',
    colorRevision: paintoverState.colorRevision,
    atmosphereRevision: sourceStage === 'color' ? 0 : paintoverState.atmosphereRevision,
    colorFingerprint: paintoverState.colorFingerprint,
    atmosphereFingerprint: sourceStage === 'color'
      ? '0'.repeat(64) : paintoverState.atmosphereFingerprint,
    colorHasContent: false,
    atmosphereHasContent: false,
    compositeFingerprint: null,
  };
}

function staticVideoMotionBinding() {
  return {
    cameraMotionRevision: 0,
    cameraMotionFingerprint: null,
    cameraMotionStatus: 'valid' as const,
    cameraMotionBaseFramingFingerprint: null,
    shotDuration: { value: 2, timescale: 1 },
    durationRevision: 0,
  };
}

function canonicalMotionFrame(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const shotDuration = { value: 4, timescale: 1 };
  const cameraMotionTrack = {
    version: 1,
    enabled: true,
    mode: 'keyframed',
    presetId: 'push-in',
    keyframes: [{
      id: 'kf-1',
      time: { value: 2, timescale: 1 },
      pose: {
        centerX: 0.5, centerY: 0.48, zoom: 1.25, rollDegrees: 0,
      },
      easingFromPrevious: { kind: 'easeInOut' },
    }],
  };
  return {
    shotDuration,
    durationRevision: 3,
    cameraMotionTrack,
    cameraMotionRevision: 7,
    cameraMotionUpdatedAt: '2026-08-30T12:00:00.000Z',
    cameraMotionFingerprint: cameraMotionRenderFingerprintV1(
      cameraMotionTrack as any,
      shotDuration,
    ),
    cameraMotionBaseFramingFingerprint: 'framing-fingerprint',
    cameraMotionStatus: 'valid',
    ...overrides,
  };
}

function canonicalTwoSecondMotionFrame(): Record<string, unknown> {
  const frame = canonicalMotionFrame();
  const shotDuration = { value: 2, timescale: 1 };
  const cameraMotionTrack = {
    ...(frame.cameraMotionTrack as Record<string, unknown>),
    keyframes: [{
      id: 'kf-1', time: { value: 1, timescale: 1 },
      pose: { centerX: 0.5, centerY: 0.48, zoom: 1.25, rollDegrees: 0 },
      easingFromPrevious: { kind: 'easeInOut' },
    }],
  };
  return {
    ...frame, shotDuration, durationRevision: 1, cameraMotionTrack,
    cameraMotionFingerprint: cameraMotionRenderFingerprintV1(
      cameraMotionTrack as any, shotDuration,
    ),
  };
}

function boundVideoInput(sourceRevision = 4) {
  const generationBinding = {
    version: 1 as const,
    source: videoBinding(sourceRevision),
    motion: staticVideoMotionBinding(),
  };
  return {
    sourceBinding: generationBinding.source,
    generationBinding,
    bindingFingerprint:
      storyboardVideoBindingFingerprintV1(generationBinding),
  };
}

function activeVideoMotionBinding(sourceRevision = 4) {
  const bound = boundVideoInput(sourceRevision);
  return {
    bindingFingerprint: bound.bindingFingerprint,
    ...bound.generationBinding.motion,
  };
}

function frameVideoMotionSidecars(sourceRevision = 4) {
  const bound = boundVideoInput(sourceRevision);
  const motion = bound.generationBinding.motion;
  return {
    aiVideoSourceBindingFingerprint: bound.bindingFingerprint,
    aiVideoSourceMotionRevision: motion.cameraMotionRevision,
    aiVideoSourceMotionFingerprint: motion.cameraMotionFingerprint,
    aiVideoSourceMotionStatus: motion.cameraMotionStatus,
    aiVideoSourceMotionBaseFramingFingerprint:
      motion.cameraMotionBaseFramingFingerprint,
    aiVideoSourceShotDuration: motion.shotDuration,
    aiVideoSourceDurationRevision: motion.durationRevision,
  };
}

function mirroredStoryboard(value: any) {
  const sourceRevision = Number(value?.metadata?.sourceRevision ?? 0);
  return {
    ...value,
    metadata: {
      ...(value?.metadata ?? {}),
      sourceRevision,
      compatSourceUpdatedAt: 'source-token-1',
      currentFramingFingerprint: 'framing-fingerprint',
      aiPaintoverState: paintoverState,
    },
  };
}

function poolWithConsent(consented: boolean, baseImage = approvedBaseImage) {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('SELECT consented')) {
        return { rows: consented ? [{ consented: true, consented_by: 'director@example.com' }] : [] };
      }
      if (sql.includes('FROM storyboard_ai_image_versions')) {
        return { rows: [approvedBaseRow(0, baseImage)] };
      }
      if (sql.includes('AS spent')) return { rows: [{ spent: 0 }] };
      return { rows: [] };
    }),
  } as any;
}

const storyboard = {
  id: '00000000-0000-0000-0000-000000000001', projectId: 'troll-project-2026',
  sceneId: 'scene-1', frameId: 'frame-1', imageData: null,
  title: 'Shot 1', strokes: [], width: 1920, height: 1080,
  workflowLevel: 'drawn', metadata: {}, createdBy: 'user-1',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

describe('Storyboard video motion and timing binding', () => {
  it('keeps static legacy input renderable with a deterministic binding', () => {
    const binding = storyboardVideoMotionBindingV1(
      {},
      'framing-fingerprint',
    );
    expect(binding).toEqual(staticVideoMotionBinding());
    expect(storyboardVideoBindingFingerprintV1({
      version: 1,
      source: videoBinding(4),
      motion: binding,
    })).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('keeps status-only frame timestamps out of paid generation identity', () => {
    const first = {
      version: 1 as const,
      source: videoBinding(4, 'frame-token-1'),
      motion: staticVideoMotionBinding(),
    };
    const statusAdvanced = {
      ...first,
      source: videoBinding(4, 'frame-token-2'),
    };
    const sourceChanged = {
      ...statusAdvanced,
      source: { ...statusAdvanced.source, sourceUpdatedAt: 'source-token-2' },
    };

    expect(storyboardVideoBindingFingerprintV1(statusAdvanced))
      .toBe(storyboardVideoBindingFingerprintV1(first));
    expect(storyboardVideoBindingFingerprintV1(sourceChanged))
      .not.toBe(storyboardVideoBindingFingerprintV1(first));
  });

  it('binds valid moving v1 input to exact motion, duration and framing', () => {
    const frame = canonicalMotionFrame();
    const untouched = structuredClone(frame);

    expect(storyboardVideoMotionBindingV1(
      frame,
      'framing-fingerprint',
    )).toEqual({
      cameraMotionRevision: 7,
      cameraMotionFingerprint: frame.cameraMotionFingerprint,
      cameraMotionStatus: 'valid',
      cameraMotionBaseFramingFingerprint: 'framing-fingerprint',
      shotDuration: { value: 4, timescale: 1 },
      durationRevision: 3,
    });
    expect(frame).toEqual(untouched);
  });

  it.each([
    ['needs-rebase', canonicalMotionFrame({
      cameraMotionStatus: 'needsRebase',
    })],
    ['future-version', canonicalMotionFrame({
      cameraMotionTrack: { version: 2, opaqueFutureData: { curve: 'spline' } },
      cameraMotionFingerprint: `sha256:${'f'.repeat(64)}`,
    })],
    ['malformed-v1', canonicalMotionFrame({
      cameraMotionTrack: { version: 1, enabled: true, mode: 'keyframed' },
    })],
    ['partial-envelope', {
      shotDuration: { value: 4, timescale: 1 },
      durationRevision: 1,
      cameraMotionTrack: null,
    }],
  ])('rejects %s without rewriting opaque input', (_title, frame) => {
    const untouched = structuredClone(frame);
    expect(() => storyboardVideoMotionBindingV1(
      frame,
      'framing-fingerprint',
    )).toThrowError(expect.objectContaining({
      status: 409,
      code: 'camera_motion_not_renderable',
    }));
    expect(frame).toEqual(untouched);
  });
});

describe('Storyboard video provider gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettingsMock.mockResolvedValue({
      enabled: true, billingMode: 'free_whitelist', dailyCapUsd: 20,
      whitelist: ['director@example.com'], includedQuota: 0,
      markupMultiplier: 3, creditPacks: [],
    });
    meterEligibilityMock.mockResolvedValue({
      eligible: true, customerId: 'cus_role_room', subscriptionId: 'sub_role_room',
    });
    archiveMock.mockResolvedValue(true);
    creditMoveMock.mockResolvedValue(true);
    validateMirrorMock.mockImplementation(async (_pool: unknown, input: any) => {
      const normalized = mirroredStoryboard(input.storyboard);
      return {
        storyboard: normalized,
        sourceRevision: normalized.metadata.sourceRevision,
        framingFingerprint: 'framing-fingerprint',
        compatSource: {
          manuscriptId: 'manuscript-1', sceneId: storyboard.sceneId,
          frameId: storyboard.frameId, frameUpdatedAt: 'frame-token-1',
          sourceUpdatedAt: 'source-token-1', framingFingerprint: 'framing-fingerprint',
          paintoverState,
        },
      };
    });
    presignMock.mockResolvedValue('https://assets.example.com/source.png');
    higgsfieldEstimateMock.mockResolvedValue({ usd: 0.27, credits: 9 });
    lockCompatMock.mockResolvedValue({
      manuscriptId: 'manuscript-1',
      sceneId: storyboard.sceneId,
      frameId: storyboard.frameId,
      frameUpdatedAt: 'frame-token-1',
      sourceUpdatedAt: 'source-token-1',
      paintoverState,
      framingFingerprint: 'framing-fingerprint',
    });
  });

  it('returns project consent and provider readiness without secrets', async () => {
    const config = await getStoryboardVideoConfig(poolWithConsent(true), {
      projectId: storyboard.projectId, userEmail: 'director@example.com', userRole: 'owner',
    });
    expect(config.consent.consented).toBe(true);
    expect(config.models.map((model) => model.id)).toEqual([
      'seedance-2-i2v', 'higgsfield-dop-i2v',
    ]);
    expect(JSON.stringify(config)).not.toMatch(/API_KEY|secret/i);
  });

  it('accepts canonical duration before legacy revision mirror backfill', async () => {
    const frameDocument = { shotDuration: { value: 48, timescale: 24 } };
    const normalized = mirroredStoryboard({
      ...storyboard,
      imageData: approvedBaseImage,
      metadata: { sourceRevision: 0, ...frameDocument },
    });
    validateMirrorMock.mockResolvedValueOnce({
      storyboard: normalized, sourceRevision: 0,
      framingFingerprint: 'framing-fingerprint',
      compatSource: {
        manuscriptId: 'manuscript-1', sceneId: storyboard.sceneId,
        frameId: storyboard.frameId, frameUpdatedAt: 'frame-token-1',
        sourceUpdatedAt: 'source-token-1', framingFingerprint: 'framing-fingerprint',
        paintoverState, frameDocument,
      },
    });
    const checked = await preflightStoryboardVideo(poolWithConsent(true), {
      ...videoSourceRequest,
      projectId: storyboard.projectId, storyboard: normalized as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'seedance-2-i2v', duration: 5, compiledPrompt: 'static shot',
    });
    expect(checked.generationBinding.motion).toEqual({
      ...staticVideoMotionBinding(), durationRevision: 1,
    });
  });

  it.each([
    ['partial envelope', { cameraMotionTrack: null }],
    ['future track', canonicalMotionFrame({
      cameraMotionTrack: { version: 2, opaqueFutureData: { bezier: [1, 2] } },
      cameraMotionFingerprint: `sha256:${'e'.repeat(64)}`,
    })],
    ['needs-rebase track', canonicalMotionFrame({
      cameraMotionStatus: 'needsRebase',
    })],
  ])('rejects %s before estimate or provider I/O', async (_title, frameDocument) => {
    const untouched = structuredClone(frameDocument);
    const normalized = mirroredStoryboard({
      ...storyboard,
      imageData: approvedBaseImage,
      metadata: { sourceRevision: 0, ...frameDocument },
    });
    validateMirrorMock.mockResolvedValueOnce({
      storyboard: normalized, sourceRevision: 0,
      framingFingerprint: 'framing-fingerprint',
      compatSource: {
        manuscriptId: 'manuscript-1', sceneId: storyboard.sceneId,
        frameId: storyboard.frameId, frameUpdatedAt: 'frame-token-1',
        sourceUpdatedAt: 'source-token-1', framingFingerprint: 'framing-fingerprint',
        paintoverState, frameDocument,
      },
    });

    await expect(preflightStoryboardVideo(poolWithConsent(true), {
      ...videoSourceRequest,
      projectId: storyboard.projectId, storyboard: normalized as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'higgsfield-dop-i2v', duration: 5, compiledPrompt: 'move camera',
    })).rejects.toMatchObject({
      status: 409, code: 'camera_motion_not_renderable',
    });
    expect(frameDocument).toEqual(untouched);
    expect(archiveMock).not.toHaveBeenCalled();
    expect(higgsfieldEstimateMock).not.toHaveBeenCalled();
    expect(higgsfieldSubmitMock).not.toHaveBeenCalled();
  });

  it.each([
    ['motion', canonicalTwoSecondMotionFrame()],
    ['duration', { shotDuration: { value: 3, timescale: 1 }, durationRevision: 1 }],
  ])('rejects a %s change between preflight and final submit CAS', async (
    _title,
    changedFrameDocument,
  ) => {
    const withImage = { ...storyboard, imageData: approvedBaseImage };
    const checked = await preflightStoryboardVideo(poolWithConsent(true), {
      ...videoSourceRequest,
      projectId: storyboard.projectId, storyboard: withImage as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'seedance-2-i2v', duration: 5, compiledPrompt: 'move camera',
    });
    const authoritative = mirroredStoryboard({
      ...withImage,
      metadata: { sourceRevision: 0, ...changedFrameDocument },
    });
    const clientQueries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        clientQueries.push(sql);
        if (sql.includes('FROM casting_storyboards')) {
          return {
            rows: [{
              project_id: storyboard.projectId,
              image_data: approvedBaseImage,
              metadata: authoritative.metadata,
              scene_id: storyboard.sceneId,
              frame_id: storyboard.frameId,
              updated_at: withImage.updatedAt,
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM storyboard_ai_image_versions')) {
          return { rows: [approvedBaseRow(0)], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = poolWithConsent(true) as any;
    pool.connect = vi.fn(async () => client);
    lockCompatMock.mockResolvedValueOnce({
      manuscriptId: 'manuscript-1', sceneId: storyboard.sceneId,
      frameId: storyboard.frameId, frameUpdatedAt: 'frame-token-1',
      sourceUpdatedAt: 'source-token-1', paintoverState,
      framingFingerprint: 'framing-fingerprint',
      frameDocument: changedFrameDocument,
    });

    await expect(submitStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId, storyboard: withImage as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'seedance-2-i2v', duration: 5, compiledPrompt: 'move camera',
      compilationFingerprint: 'compile-motion',
      confirmedPreflight: {
        compilationFingerprint: 'compile-motion',
        sourceFingerprint: checked.sourceFingerprint,
        bindingFingerprint: checked.bindingFingerprint,
        duration: checked.duration,
        maxEstimatedCostUsd: checked.estimatedCostUsd,
      },
      expectedCompatSourceUpdatedAt: 'source-token-1',
      expectedFramingFingerprint: 'framing-fingerprint',
    })).rejects.toMatchObject({ status: 409, code: 'preflight_changed' });

    expect(falSubmitMock).not.toHaveBeenCalled();
    expect(higgsfieldSubmitMock).not.toHaveBeenCalled();
    expect(clientQueries.some((sql) =>
      sql.includes('INSERT INTO storyboard_ai_video_jobs'))).toBe(false);
    expect(clientQueries.at(-1)).toBe('ROLLBACK');
  });

  it('ignores Atmosphere-only divergence for Color but not Atmosphere', async () => {
    const live = {
      ...paintoverState,
      atmosphereRevision: 8,
      atmosphereFingerprint: 'c'.repeat(64),
      atmosphereHasContent: true,
      atmosphereStale: false,
    };
    const mirrored = {
      ...live,
      atmosphereRevision: 9,
      atmosphereFingerprint: 'd'.repeat(64),
      atmosphereHasContent: false,
      atmosphereStale: true,
      videoStale: false,
    };
    const source = await validateStoryboardVideoSourceSnapshot({
      request: {
        sourceStage: 'color',
        baseVersionId,
        shotFraming: videoFraming,
      },
      base: {
        id: baseVersionId,
        stage: 'color',
        imageData: approvedBaseImage,
        metadata: {
          sourceRevision: 4,
          compatSourceUpdatedAt: 'source-token-1',
          framingFingerprint: 'framing-fingerprint',
        },
      },
      sourceRevision: 4,
      framingFingerprint: 'framing-fingerprint',
      frameUpdatedAt: 'frame-after-atmosphere-edit',
      sourceUpdatedAt: 'source-token-1',
      livePaintoverState: live,
      mirroredPaintoverState: mirrored,
    });

    expect(source.binding).toMatchObject({
      sourceStage: 'color',
      colorRevision: paintoverState.colorRevision,
      colorFingerprint: paintoverState.colorFingerprint,
      atmosphereRevision: 0,
      atmosphereFingerprint: '0'.repeat(64),
      atmosphereHasContent: false,
    });

    await expect(validateStoryboardVideoSourceSnapshot({
      request: {
        sourceStage: 'atmosphere',
        baseVersionId,
        shotFraming: videoFraming,
      },
      base: {
        id: baseVersionId,
        stage: 'atmosphere',
        imageData: approvedBaseImage,
        metadata: {
          sourceRevision: 4,
          compatSourceUpdatedAt: 'source-token-1',
          framingFingerprint: 'framing-fingerprint',
        },
      },
      sourceRevision: 4,
      framingFingerprint: 'framing-fingerprint',
      frameUpdatedAt: 'frame-after-atmosphere-edit',
      sourceUpdatedAt: 'source-token-1',
      livePaintoverState: live,
      mirroredPaintoverState: mirrored,
    })).rejects.toMatchObject({
      status: 409,
      code: 'paintover_state_unsynced',
    });
  });
  it('blocks an Atmosphere base after a later Color edit', async () => {
    const staleState = {
      ...paintoverState,
      colorRevision: 2,
      atmosphereRevision: 1,
      colorFingerprint: 'c'.repeat(64),
      atmosphereFingerprint: 'd'.repeat(64),
      atmosphereStale: true,
    };
    await expect(validateStoryboardVideoSourceSnapshot({
      request: {
        sourceStage: 'atmosphere',
        baseVersionId,
        shotFraming: videoFraming,
      },
      base: {
        id: baseVersionId,
        stage: 'atmosphere',
        imageData: approvedBaseImage,
        metadata: {
          sourceRevision: 4,
          compatSourceUpdatedAt: 'source-token-1',
          framingFingerprint: 'framing-fingerprint',
        },
      },
      sourceRevision: 4,
      framingFingerprint: 'framing-fingerprint',
      frameUpdatedAt: 'frame-token-1',
      sourceUpdatedAt: 'source-token-1',
      livePaintoverState: staleState,
      mirroredPaintoverState: staleState,
    })).rejects.toMatchObject({
      status: 409,
      code: 'atmosphere_source_stale',
    });
  });

  it('archives the exact frozen Color composite as the provider source', async () => {
    const png = await sharp({
      create: {
        width: 320, height: 180, channels: 4,
        background: { r: 90, g: 60, b: 30, alpha: 1 },
      },
    }).png().toBuffer();
    const state = {
      ...paintoverState,
      colorRevision: 2,
      colorFingerprint: 'c'.repeat(64),
      colorHasContent: true,
    };
    const normalized = mirroredStoryboard({
      ...storyboard,
      imageData: approvedBaseImage,
      metadata: { sourceRevision: 4 },
    });
    normalized.metadata.aiPaintoverState = state;
    validateMirrorMock.mockResolvedValueOnce({
      storyboard: normalized,
      sourceRevision: 4,
      framingFingerprint: 'framing-fingerprint',
      compatSource: {
        manuscriptId: 'manuscript-1',
        sceneId: storyboard.sceneId,
        frameId: storyboard.frameId,
        frameUpdatedAt: 'frame-token-1',
        sourceUpdatedAt: 'source-token-1',
        framingFingerprint: 'framing-fingerprint',
        paintoverState: state,
      },
    });
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT consented')) return { rows: [{ consented: true }] };
        if (sql.includes('FROM storyboard_ai_image_versions')) {
          return { rows: [approvedBaseRow(4)] };
        }
        if (sql.includes('AS spent')) return { rows: [{ spent: 0 }] };
        return { rows: [] };
      }),
    } as any;
    const composite = {
      imageData: `data:image/png;base64,${png.toString('base64')}`,
      width: 320,
      height: 180,
      includedThroughStage: 'color' as const,
      baseVersionId,
      frameUpdatedAt: 'frame-token-1',
      sourceUpdatedAt: 'source-token-1',
      sourceRevision: 4,
      framingFingerprint: 'framing-fingerprint',
      colorRevision: state.colorRevision,
      atmosphereRevision: state.atmosphereRevision,
      colorFingerprint: state.colorFingerprint,
      atmosphereFingerprint: state.atmosphereFingerprint,
    };
    const result = await preflightStoryboardVideo(pool, {
      ...videoSourceRequest,
      paintoverComposite: composite,
      projectId: storyboard.projectId,
      storyboard: normalized as any,
      userId: 'user-1',
      userEmail: 'director@example.com',
      userRole: 'owner',
      modelId: 'seedance-2-i2v',
      duration: 5,
      compiledPrompt: 'animate the frozen paintover',
    });

    expect(archiveMock).toHaveBeenCalledWith(
      expect.stringContaining('/animation-sources/'),
      png,
      'image/png',
    );
    expect(result.sourceBinding).toMatchObject({
      sourceStage: 'color',
      baseVersionId,
      colorRevision: 2,
    });
    expect(result.sourceBinding.compositeFingerprint).toMatch(/^[a-f0-9]{32}$/);
    const editedState = {
      ...state,
      colorRevision: 3,
      colorFingerprint: 'd'.repeat(64),
      atmosphereStale: true,
    };
    const editedStoryboard = {
      ...normalized,
      metadata: {
        ...normalized.metadata,
        aiPaintoverState: editedState,
      },
    };
    validateMirrorMock.mockResolvedValueOnce({
      storyboard: editedStoryboard,
      sourceRevision: 4,
      framingFingerprint: 'framing-fingerprint',
      compatSource: {
        manuscriptId: 'manuscript-1',
        sceneId: storyboard.sceneId,
        frameId: storyboard.frameId,
        frameUpdatedAt: 'frame-token-2',
        sourceUpdatedAt: 'source-token-1',
        framingFingerprint: 'framing-fingerprint',
        paintoverState: editedState,
      },
    });
    archiveMock.mockClear();
    falSubmitMock.mockClear();
    await expect(submitStoryboardVideo(pool, {
      ...videoSourceRequest,
      paintoverComposite: composite,
      projectId: storyboard.projectId,
      storyboard: normalized as any,
      userId: 'user-1',
      userEmail: 'director@example.com',
      userRole: 'owner',
      modelId: 'seedance-2-i2v',
      duration: 5,
      compiledPrompt: 'animate the frozen paintover',
      compilationFingerprint: 'compile-fingerprint',
      confirmedPreflight: {
        compilationFingerprint: 'compile-fingerprint',
        sourceFingerprint: result.sourceFingerprint,
        bindingFingerprint: result.bindingFingerprint,
        duration: result.duration,
        maxEstimatedCostUsd: result.estimatedCostUsd,
      },
      expectedCompatSourceUpdatedAt: 'source-token-1',
      expectedFramingFingerprint: 'framing-fingerprint',
    })).rejects.toMatchObject({
      status: 409,
      code: 'paintover_composite_stale',
    });
    expect(archiveMock).not.toHaveBeenCalled();
    expect(falSubmitMock).not.toHaveBeenCalled();
  });

  it('fails closed before provider submission when consent is missing', async () => {
    await expect(submitStoryboardVideo(poolWithConsent(false), {
      ...videoSourceRequest,
      projectId: storyboard.projectId, storyboard: storyboard as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'seedance-2-i2v', duration: 5, compiledPrompt: 'motion prompt',
      compilationFingerprint: 'fingerprint',
      confirmedPreflight: {
        compilationFingerprint: 'fingerprint',
        sourceFingerprint: 'not-reached',
        bindingFingerprint: `sha256:${'0'.repeat(64)}`,
        duration: 5,
        maxEstimatedCostUsd: 1,
      },
    })).rejects.toMatchObject<Partial<StoryboardVideoError>>({
      status: 409, code: 'consent_required',
    });
    expect(falSubmitMock).not.toHaveBeenCalled();
  });

  it('requires confirmation before any source or provider I/O', async () => {
    const pool = poolWithConsent(true, '');
    await expect(submitStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId, storyboard: storyboard as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'higgsfield-dop-i2v', duration: 5, compiledPrompt: 'motion prompt',
      compilationFingerprint: 'fingerprint',
    })).rejects.toMatchObject<Partial<StoryboardVideoError>>({
      status: 400, code: 'preflight_confirmation_required',
    });
    expect(pool.query).not.toHaveBeenCalled();
    expect(archiveMock).not.toHaveBeenCalled();
    expect(presignMock).not.toHaveBeenCalled();
    expect(higgsfieldEstimateMock).not.toHaveBeenCalled();
    expect(falSubmitMock).not.toHaveBeenCalled();
    expect(higgsfieldSubmitMock).not.toHaveBeenCalled();
  });

  it('uses Higgsfield authoritative estimate without submitting a paid job', async () => {
    const withImage = {
      ...storyboard,
      imageData: 'data:image/png;base64,' + Buffer.from('pencil-color-atmosphere').toString('base64'),
    };
    const result = await preflightStoryboardVideo(poolWithConsent(true), {
      ...videoSourceRequest,
      projectId: storyboard.projectId, storyboard: withImage as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'higgsfield-dop-i2v', duration: 5, compiledPrompt: 'preserve graphite lines',
    });

    expect(result).toMatchObject({
      model: 'higgsfield-dop-i2v', provider: 'higgsfield',
      estimatedCostUsd: 0.27, providerCredits: 9,
    });
    expect(result.sourceFingerprint).toMatch(/^[a-f0-9]{16}$/);
    expect(higgsfieldEstimateMock).toHaveBeenCalledOnce();
    expect(higgsfieldSubmitMock).not.toHaveBeenCalled();
  });

  it('rejects an exhausted daily cap before source upload or provider estimate', async () => {
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT consented')) return { rows: [{ consented: true }] };
        if (sql.includes('FROM generative_ai_jobs')) return { rows: [{ spent: 20 }] };
        if (sql.includes('FROM storyboard_ai_video_jobs')) return { rows: [{ spent: 0 }] };
        return { rows: [], rowCount: 0 };
      }),
    } as any;

    await expect(preflightStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId,
      storyboard: { ...storyboard, imageData: approvedBaseImage } as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'higgsfield-dop-i2v', duration: 5,
      compiledPrompt: 'motion prompt',
    })).rejects.toMatchObject({ status: 429, code: 'daily_cap' });

    expect(archiveMock).not.toHaveBeenCalled();
    expect(higgsfieldEstimateMock).not.toHaveBeenCalled();
  });

  it('rejects an unbillable metered account before source/B2/provider I/O', async () => {
    getSettingsMock.mockResolvedValueOnce({
      enabled: true, billingMode: 'metered', dailyCapUsd: 20,
      whitelist: [], includedQuota: 0, markupMultiplier: 3, creditPacks: [],
    });
    meterEligibilityMock.mockResolvedValueOnce({
      eligible: false, reason: 'no_customer',
    });

    await expect(preflightStoryboardVideo(poolWithConsent(true), {
      ...videoSourceRequest,
      projectId: storyboard.projectId,
      storyboard: { ...storyboard, imageData: approvedBaseImage } as any,
      userId: 'user-without-customer',
      userEmail: 'director@example.com',
      userRole: 'owner',
      modelId: 'higgsfield-dop-i2v',
      duration: 5,
      compiledPrompt: 'motion prompt',
    })).rejects.toMatchObject({
      status: 402, code: 'metered_billing_required',
    });

    expect(meterEligibilityMock).toHaveBeenCalledOnce();
    expect(archiveMock).not.toHaveBeenCalled();
    expect(presignMock).not.toHaveBeenCalled();
    expect(higgsfieldEstimateMock).not.toHaveBeenCalled();
  });

  it('fails closed when the confirmed source fingerprint no longer matches', async () => {
    const withImage = {
      ...storyboard,
      imageData: 'data:image/png;base64,' + Buffer.from('changed-source').toString('base64'),
    };
    await expect(submitStoryboardVideo(poolWithConsent(true), {
      ...videoSourceRequest,
      projectId: storyboard.projectId, storyboard: withImage as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'higgsfield-dop-i2v', duration: 5,
      compiledPrompt: 'preserve graphite lines', compilationFingerprint: 'prompt-fingerprint',
      confirmedPreflight: {
        compilationFingerprint: 'prompt-fingerprint', sourceFingerprint: 'stale-source',
        bindingFingerprint: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        duration: 5,
        maxEstimatedCostUsd: 0.27,
      },
    })).rejects.toMatchObject<Partial<StoryboardVideoError>>({
      status: 409, code: 'preflight_changed',
    });
    expect(higgsfieldSubmitMock).not.toHaveBeenCalled();
  });

  it('rejects a decreased provider duration after preflight confirmation', async () => {
    const withImage = { ...storyboard, imageData: approvedBaseImage };
    const pool = poolWithConsent(true);
    const checked = await preflightStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId, storyboard: withImage as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'higgsfield-dop-i2v', duration: 5, compiledPrompt: 'motion prompt',
    });
    archiveMock.mockClear();
    presignMock.mockClear();
    higgsfieldEstimateMock.mockClear();

    await expect(submitStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId, storyboard: withImage as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'higgsfield-dop-i2v', duration: 4, compiledPrompt: 'motion prompt',
      compilationFingerprint: 'duration-contract',
      confirmedPreflight: {
        compilationFingerprint: 'duration-contract',
        sourceFingerprint: checked.sourceFingerprint,
        bindingFingerprint: checked.bindingFingerprint,
        duration: checked.duration,
        maxEstimatedCostUsd: checked.estimatedCostUsd,
      },
      expectedCompatSourceUpdatedAt: 'source-token-1',
      expectedFramingFingerprint: 'framing-fingerprint',
    })).rejects.toMatchObject({ status: 409, code: 'preflight_changed' });

    expect(falSubmitMock).not.toHaveBeenCalled();
    expect(archiveMock).not.toHaveBeenCalled();
    expect(presignMock).not.toHaveBeenCalled();
    expect(higgsfieldEstimateMock).not.toHaveBeenCalled();
    expect(higgsfieldSubmitMock).not.toHaveBeenCalled();
  });

  it('deduplicates Color after normalized and compat Atmosphere advance', async () => {
    const sourceBytes = Buffer.from('stable-approved-animation-source');
    const withImage = {
      ...storyboard,
      imageData: `data:image/png;base64,${sourceBytes.toString('base64')}`,
      metadata: { compatSourceUpdatedAt: 'source-token-1' },
    };
    const lockedUpdatedAt = new Date(
      Date.parse(withImage.updatedAt) + 1_000,
    ).toISOString();
    const poolQueries = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT consented')) return { rows: [{ consented: true }] };
      if (sql.includes('FROM storyboard_ai_image_versions')) {
        return { rows: [approvedBaseRow()] };
      }
      if (sql.includes('AS spent')) return { rows: [{ spent: 0 }] };
      return { rows: [], rowCount: 0 };
    });
    const client = {
      query: vi.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes('SELECT project_id, image_data')) {
          return {
            rows: [{
              project_id: storyboard.projectId,
              image_data: withImage.imageData,
              metadata: {
                ...mirroredStoryboard(withImage).metadata,
                aiPaintoverState: atmosphereEditedState,
              },
              scene_id: storyboard.sceneId,
              frame_id: storyboard.frameId,
              updated_at: lockedUpdatedAt,
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM storyboard_ai_image_versions')) {
          return { rows: [approvedBaseRow()], rowCount: 1 };
        }
        if (sql.includes('FROM storyboard_ai_video_jobs')) {
          return {
            rows: [{
              id: 'job-existing',
              status: 'queued',
              est_cost_usd: 0.5,
              model: 'seedance-2-i2v',
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: poolQueries,
      connect: vi.fn(async () => client),
    } as any;
    const normalized = mirroredStoryboard(withImage);
    validateMirrorMock.mockResolvedValue({
      storyboard: normalized,
      sourceRevision: 0,
      framingFingerprint: 'framing-fingerprint',
      compatSource: {
        manuscriptId: 'manuscript-1',
        sceneId: storyboard.sceneId,
        frameId: storyboard.frameId,
        frameUpdatedAt: 'frame-token-1',
        sourceUpdatedAt: 'source-token-1',
        framingFingerprint: 'framing-fingerprint',
        paintoverState,
        frameDocument: {},
      },
    });
    lockCompatMock.mockResolvedValueOnce({
      manuscriptId: 'manuscript-1',
      sceneId: storyboard.sceneId,
      frameId: storyboard.frameId,
      frameUpdatedAt: 'frame-token-2',
      sourceUpdatedAt: 'source-token-1',
      framingFingerprint: 'framing-fingerprint',
      paintoverState: atmosphereEditedState,
      frameDocument: {},
    });
    const checked = await preflightStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId,
      storyboard: withImage as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'seedance-2-i2v', duration: 5, compiledPrompt: 'motion prompt',
    });
    expect(checked.generationBinding.source.frameUpdatedAt)
      .toBe('frame-token-1');
    expect(checked.bindingFingerprint)
      .toBe(boundVideoInput(0).bindingFingerprint);

    const result = await submitStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId,
      storyboard: withImage as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'seedance-2-i2v', duration: 5, compiledPrompt: 'motion prompt',
      compilationFingerprint: 'compile-fingerprint',
      confirmedPreflight: {
        compilationFingerprint: 'compile-fingerprint',
        sourceFingerprint: checked.sourceFingerprint,
        bindingFingerprint: checked.bindingFingerprint,
        duration: checked.duration,
        maxEstimatedCostUsd: checked.estimatedCostUsd,
      },
      expectedCompatSourceUpdatedAt: 'source-token-1',
      expectedFramingFingerprint: 'framing-fingerprint',
    });

    expect(result).toMatchObject({
      jobId: 'job-existing', status: 'queued', deduplicated: true,
    });
    expect(lockCompatMock).toHaveBeenCalledOnce();
    const duplicateCall = client.query.mock.calls.find(([sql]) =>
      sql.includes('FROM storyboard_ai_video_jobs'));
    expect(duplicateCall?.[0]).toContain("input->>'bindingFingerprint'=$9");
    expect(duplicateCall?.[0]).not.toContain("input->'generationBinding'");
    expect(duplicateCall?.[1]?.[8]).toBe(checked.bindingFingerprint);
    expect(duplicateCall?.[1]).toHaveLength(9);
    expect(falSubmitMock).not.toHaveBeenCalled();
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('blocks a changed source while another animation remains active', async () => {
    const sourceUpdatedAt = 'source-token-2';
    const withImage = {
      ...storyboard,
      imageData: approvedBaseImage,
      metadata: {
        sourceRevision: 0,
        compatSourceUpdatedAt: sourceUpdatedAt,
      },
    };
    const normalized = mirroredStoryboard(withImage);
    normalized.metadata.compatSourceUpdatedAt = sourceUpdatedAt;
    const base = approvedBaseRow();
    base.metadata.compatSourceUpdatedAt = sourceUpdatedAt;
    validateMirrorMock.mockResolvedValue({
      storyboard: normalized,
      sourceRevision: 0,
      framingFingerprint: 'framing-fingerprint',
      compatSource: {
        manuscriptId: 'manuscript-1',
        sceneId: storyboard.sceneId,
        frameId: storyboard.frameId,
        frameUpdatedAt: 'frame-token-2',
        sourceUpdatedAt,
        framingFingerprint: 'framing-fingerprint',
        paintoverState,
        frameDocument: {},
      },
    });
    lockCompatMock.mockResolvedValueOnce({
      manuscriptId: 'manuscript-1',
      sceneId: storyboard.sceneId,
      frameId: storyboard.frameId,
      frameUpdatedAt: 'frame-token-2',
      sourceUpdatedAt,
      framingFingerprint: 'framing-fingerprint',
      paintoverState,
      frameDocument: {},
    });
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT project_id, image_data')) {
          return {
            rows: [{
              project_id: storyboard.projectId,
              image_data: withImage.imageData,
              metadata: normalized.metadata,
              scene_id: storyboard.sceneId,
              frame_id: storyboard.frameId,
              updated_at: withImage.updatedAt,
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM storyboard_ai_image_versions')) {
          return { rows: [base], rowCount: 1 };
        }
        if (sql.includes('FROM storyboard_ai_video_jobs')
            && sql.includes("input->>'bindingFingerprint'")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes('FROM storyboard_ai_video_jobs')) {
          return {
            rows: [{ id: 'job-old-source', status: 'queued' }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT consented')) {
          return { rows: [{ consented: true }] };
        }
        if (sql.includes('AS spent')) return { rows: [{ spent: 0 }] };
        if (sql.includes('FROM storyboard_ai_image_versions')) {
          return { rows: [base] };
        }
        return { rows: [], rowCount: 0 };
      }),
      connect: vi.fn(async () => client),
    } as any;
    const checked = await preflightStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId,
      storyboard: withImage as any,
      userId: 'user-1',
      userEmail: 'director@example.com',
      userRole: 'owner',
      modelId: 'seedance-2-i2v',
      duration: 5,
      compiledPrompt: 'motion prompt',
    });

    await expect(submitStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId,
      storyboard: withImage as any,
      userId: 'user-1',
      userEmail: 'director@example.com',
      userRole: 'owner',
      modelId: 'seedance-2-i2v',
      duration: 5,
      compiledPrompt: 'motion prompt',
      compilationFingerprint: 'changed-source',
      confirmedPreflight: {
        compilationFingerprint: 'changed-source',
        sourceFingerprint: checked.sourceFingerprint,
        bindingFingerprint: checked.bindingFingerprint,
        duration: checked.duration,
        maxEstimatedCostUsd: checked.estimatedCostUsd,
      },
      expectedCompatSourceUpdatedAt: sourceUpdatedAt,
      expectedFramingFingerprint: 'framing-fingerprint',
    })).rejects.toMatchObject({
      status: 409,
      code: 'animation_in_progress',
    });

    expect(client.query.mock.calls.some(([sql]) =>
      sql.includes('INSERT INTO storyboard_ai_video_jobs'))).toBe(false);
    expect(client.query.mock.calls.some(([sql]) =>
      sql.includes('pg_advisory_xact_lock'))).toBe(false);
    expect(falSubmitMock).not.toHaveBeenCalled();
    expect(higgsfieldSubmitMock).not.toHaveBeenCalled();
    expect(creditMoveMock).not.toHaveBeenCalled();
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it.each([
    {
      title: 'parks a legacy submitting Higgsfield retry',
      existingStatus: 'submitting',
      expectedStatus: 'submission_unknown',
      expectsPark: true,
    },
    {
      title: 'deduplicates an accepted contract-unknown Higgsfield job',
      existingStatus: 'accepted_contract_unknown',
      expectedStatus: 'accepted_contract_unknown',
      expectsPark: false,
    },
  ])('$title without a second POST', async ({
    existingStatus,
    expectedStatus,
    expectsPark,
  }) => {
    const withImage = {
      ...storyboard,
      imageData: approvedBaseImage,
      metadata: { compatSourceUpdatedAt: 'source-token-1' },
    };
    const poolQueries = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT consented')) return { rows: [{ consented: true }] };
      if (sql.includes('FROM storyboard_ai_image_versions')) {
        return { rows: [approvedBaseRow()] };
      }
      if (sql.includes('AS spent')) return { rows: [{ spent: 0 }] };
      return { rows: [], rowCount: 0 };
    });
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT project_id, image_data')) {
          return {
            rows: [{
              project_id: storyboard.projectId,
              image_data: withImage.imageData,
              metadata: mirroredStoryboard(withImage).metadata,
              scene_id: storyboard.sceneId,
              frame_id: storyboard.frameId,
              updated_at: withImage.updatedAt,
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM storyboard_ai_image_versions')) {
          return { rows: [approvedBaseRow()], rowCount: 1 };
        }
        if (sql.includes('FROM storyboard_ai_video_jobs')) {
          return {
            rows: [{
              id: 'job-unknown',
              status: existingStatus,
              est_cost_usd: 0.27,
              model: 'higgsfield-dop-i2v',
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: poolQueries,
      connect: vi.fn(async () => client),
    } as any;
    const checked = await preflightStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId,
      storyboard: withImage as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'higgsfield-dop-i2v', duration: 5,
      compiledPrompt: 'motion prompt',
    });

    const result = await submitStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId,
      storyboard: withImage as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'higgsfield-dop-i2v', duration: 5,
      compiledPrompt: 'motion prompt',
      compilationFingerprint: 'compile-fingerprint',
      confirmedPreflight: {
        compilationFingerprint: 'compile-fingerprint',
        sourceFingerprint: checked.sourceFingerprint,
        bindingFingerprint: checked.bindingFingerprint,
        duration: checked.duration,
        maxEstimatedCostUsd: checked.estimatedCostUsd,
      },
      expectedCompatSourceUpdatedAt: 'source-token-1',
      expectedFramingFingerprint: 'framing-fingerprint',
    });

    expect(result).toMatchObject({
      jobId: 'job-unknown',
      status: expectedStatus,
      deduplicated: true,
    });
    expect(higgsfieldSubmitMock).not.toHaveBeenCalled();
    expect(client.query.mock.calls.some(([sql]) =>
      sql.includes("SET status='submission_unknown'"))).toBe(expectsPark);
    const duplicateQuery = client.query.mock.calls.find(([sql]) =>
      sql.includes('FROM storyboard_ai_video_jobs'))?.[0];
    expect(duplicateQuery).toContain("'accepted_contract_unknown'");
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });

  it('does not charge or submit when another user retries a prepared job', async () => {
    const withImage = {
      ...storyboard,
      imageData: approvedBaseImage,
      metadata: { compatSourceUpdatedAt: 'source-token-1' },
    };
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT project_id, image_data')) {
          return {
            rows: [{
              project_id: storyboard.projectId,
              image_data: withImage.imageData,
              metadata: mirroredStoryboard(withImage).metadata,
              scene_id: storyboard.sceneId,
              frame_id: storyboard.frameId,
              updated_at: withImage.updatedAt,
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM storyboard_ai_image_versions')) {
          return { rows: [approvedBaseRow()], rowCount: 1 };
        }
        if (sql.includes('FROM storyboard_ai_video_jobs')) {
          return {
            rows: [{
              id: 'job-owned-by-another-user',
              status: 'prepared',
              user_id: 'original-user',
              est_cost_usd: 0.27,
              model: 'higgsfield-dop-i2v',
              input: {
                billingMode: 'credits',
                billedUsd: 0.81,
              },
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT consented')) return { rows: [{ consented: true }] };
        if (sql.includes('FROM storyboard_ai_image_versions')) {
          return { rows: [approvedBaseRow()] };
        }
        if (sql.includes('AS spent')) return { rows: [{ spent: 0 }] };
        return { rows: [], rowCount: 1 };
      }),
      connect: vi.fn(async () => client),
    } as any;
    const checked = await preflightStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId,
      storyboard: withImage as any,
      userId: 'other-user',
      userEmail: 'director@example.com',
      userRole: 'owner',
      modelId: 'higgsfield-dop-i2v',
      duration: 5,
      compiledPrompt: 'motion prompt',
    });

    const result = await submitStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId,
      storyboard: withImage as any,
      userId: 'other-user',
      userEmail: 'director@example.com',
      userRole: 'owner',
      modelId: 'higgsfield-dop-i2v',
      duration: 5,
      compiledPrompt: 'motion prompt',
      compilationFingerprint: 'compile-fingerprint',
      confirmedPreflight: {
        compilationFingerprint: 'compile-fingerprint',
        sourceFingerprint: checked.sourceFingerprint,
        bindingFingerprint: checked.bindingFingerprint,
        duration: checked.duration,
        maxEstimatedCostUsd: checked.estimatedCostUsd,
      },
      expectedCompatSourceUpdatedAt: 'source-token-1',
      expectedFramingFingerprint: 'framing-fingerprint',
    });

    expect(result).toMatchObject({
      jobId: 'job-owned-by-another-user',
      status: 'prepared',
      deduplicated: true,
    });
    expect(creditMoveMock).not.toHaveBeenCalled();
    expect(higgsfieldSubmitMock).not.toHaveBeenCalled();
    expect(pool.query.mock.calls.some(([sql]) =>
      sql.includes("status='prepared'") && sql.includes("SET status='submitting'")))
      .toBe(false);
  });

  it('resumes prepared Higgsfield Color after an Atmosphere-only advance', async () => {
    const withImage = {
      ...storyboard,
      imageData: approvedBaseImage,
      metadata: { compatSourceUpdatedAt: 'source-token-1' },
    };
    const lockedUpdatedAt = new Date(
      Date.parse(withImage.updatedAt) + 1_000,
    ).toISOString();
    const client = {
      query: vi.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes('SELECT project_id, image_data')) {
          return {
            rows: [{
              project_id: storyboard.projectId,
              image_data: withImage.imageData,
              metadata: {
                ...mirroredStoryboard(withImage).metadata,
                aiPaintoverState: atmosphereEditedState,
              },
              scene_id: storyboard.sceneId,
              frame_id: storyboard.frameId,
              updated_at: lockedUpdatedAt,
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM storyboard_ai_image_versions')) {
          return { rows: [approvedBaseRow()], rowCount: 1 };
        }
        if (sql.includes('FROM storyboard_ai_video_jobs')) {
          return {
            rows: [{
              id: 'job-prepared',
              status: 'prepared',
              user_id: 'user-1',
              est_cost_usd: 0.27,
              model: 'higgsfield-dop-i2v',
              input: {
                billingMode: 'credits',
                billedUsd: 0.81,
              },
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT consented')) return { rows: [{ consented: true }] };
        if (sql.includes('FROM storyboard_ai_image_versions')) {
          return { rows: [approvedBaseRow()] };
        }
        if (sql.includes('AS spent')) return { rows: [{ spent: 0 }] };
        if (sql.includes("SET status='submitting'")
            && sql.includes("status='prepared'")) {
          return { rows: [{ id: 'job-prepared' }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO storyboard_ai_video_billing_settlements')) {
          return { rows: [{ id: 'settlement-debit' }], rowCount: 1 };
        }
        if (sql.includes('FROM storyboard_ai_video_billing_settlements')
            || (sql.includes('UPDATE storyboard_ai_video_billing_settlements')
              && sql.includes("SET status='delivering'"))) {
          return { rows: [{
            id: 'settlement-debit', job_id: 'job-prepared',
            kind: 'credit_debit', user_id: 'user-1',
            model: 'higgsfield-dop-i2v', amount_usd: 0.81,
            billing_mode: 'credits', external_ref: 'job:job-prepared',
            attempts: 0, delivery_deadline_at: null,
          }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      connect: vi.fn(async () => client),
    } as any;
    const normalized = mirroredStoryboard(withImage);
    validateMirrorMock.mockResolvedValue({
      storyboard: normalized,
      sourceRevision: 0,
      framingFingerprint: 'framing-fingerprint',
      compatSource: {
        manuscriptId: 'manuscript-1',
        sceneId: storyboard.sceneId,
        frameId: storyboard.frameId,
        frameUpdatedAt: 'frame-token-1',
        sourceUpdatedAt: 'source-token-1',
        framingFingerprint: 'framing-fingerprint',
        paintoverState,
        frameDocument: {},
      },
    });
    lockCompatMock.mockResolvedValueOnce({
      manuscriptId: 'manuscript-1',
      sceneId: storyboard.sceneId,
      frameId: storyboard.frameId,
      frameUpdatedAt: 'frame-token-2',
      sourceUpdatedAt: 'source-token-1',
      framingFingerprint: 'framing-fingerprint',
      paintoverState: atmosphereEditedState,
      frameDocument: {},
    });
    const checked = await preflightStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId,
      storyboard: withImage as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'higgsfield-dop-i2v', duration: 5,
      compiledPrompt: 'motion prompt',
    });
    expect(checked.generationBinding.source.frameUpdatedAt)
      .toBe('frame-token-1');
    expect(checked.bindingFingerprint)
      .toBe(boundVideoInput(0).bindingFingerprint);
    higgsfieldSubmitMock.mockResolvedValue({
      id: 'request-1',
      statusUrl: 'https://api.higgsfield.ai/requests/request-1/status',
    });

    const result = await submitStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId,
      storyboard: withImage as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'higgsfield-dop-i2v', duration: 5,
      compiledPrompt: 'motion prompt',
      compilationFingerprint: 'compile-fingerprint',
      confirmedPreflight: {
        compilationFingerprint: 'compile-fingerprint',
        sourceFingerprint: checked.sourceFingerprint,
        bindingFingerprint: checked.bindingFingerprint,
        duration: checked.duration,
        maxEstimatedCostUsd: checked.estimatedCostUsd,
      },
      expectedCompatSourceUpdatedAt: 'source-token-1',
      expectedFramingFingerprint: 'framing-fingerprint',
    });

    expect(result).toMatchObject({
      jobId: 'job-prepared',
      status: 'queued',
      recovered: true,
      deduplicated: true,
    });
    const exactRetry = client.query.mock.calls.find(([sql]) =>
      sql.includes("input->>'bindingFingerprint'"));
    expect(exactRetry?.[1]?.[8]).toBe(checked.bindingFingerprint);
    expect(client.query.mock.calls.filter(([sql]) =>
      sql.includes('FROM storyboard_ai_video_jobs')
        && !sql.includes("input->>'bindingFingerprint'")))
      .toHaveLength(0);
    expect(higgsfieldSubmitMock).toHaveBeenCalledOnce();
    expect(creditMoveMock).toHaveBeenCalledWith(
      pool,
      'user-1',
      'spend',
      -0.81,
      'job:job-prepared',
      'higgsfield-dop-i2v',
    );
    expect(pool.query.mock.calls.filter(([sql]) =>
      sql.includes("SET status='submitting'")
        && sql.includes("status='prepared'"))).toHaveLength(1);
  });

  it('persists a Color outbox across an Atmosphere-only frame advance', async () => {
    const events: string[] = [];
    let submittingFrame: Record<string, unknown> | undefined;
    const sourceBytes = Buffer.from('durable-video-source');
    const withImage = {
      ...storyboard,
      imageData: `data:image/png;base64,${sourceBytes.toString('base64')}`,
      metadata: {
        sourceRevision: 6,
        compatSourceUpdatedAt: 'source-token-1',
        currentFramingFingerprint: 'framing-fingerprint',
      },
    };
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('SELECT project_id, image_data')) {
          return {
            rows: [{
              project_id: storyboard.projectId,
              image_data: withImage.imageData,
              metadata: mirroredStoryboard(withImage).metadata,
              scene_id: storyboard.sceneId,
              frame_id: storyboard.frameId,
              updated_at: withImage.updatedAt,
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM storyboard_ai_image_versions')) {
          return { rows: [approvedBaseRow(6)], rowCount: 1 };
        }
        if (sql.includes('FROM storyboard_ai_video_jobs')) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes(' AS spent')) return { rows: [{ spent: 0 }], rowCount: 1 };
        if (sql.includes('SELECT store_value FROM legacy_compat_store')) {
          return {
            rows: [{
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  updatedAt: 'frame-token-2',
                  sourceUpdatedAt: 'source-token-1',
                  aiPaintoverState: atmosphereEditedState,
                }],
              }],
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('INSERT INTO storyboard_ai_video_jobs')) {
          events.push('durable-outbox');
          const persistedInput = JSON.parse(String(params[7]));
          expect(persistedInput).toMatchObject({
            compatSourceUpdatedAt: 'source-token-1',
            sourceRevision: 6,
            framingFingerprint: 'framing-fingerprint',
          });
        }
        if (sql.includes('UPDATE legacy_compat_store SET store_value=$2::jsonb')) {
          submittingFrame = JSON.parse(String(params[1]))[0].storyboardFrames[0];
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT consented')) return { rows: [{ consented: true }] };
        if (sql.includes('AS spent')) return { rows: [{ spent: 0 }] };
        if (sql.includes('FROM storyboard_ai_image_versions')) {
          return { rows: [approvedBaseRow(6)] };
        }
        return { rows: [], rowCount: 1 };
      }),
      connect: vi.fn(async () => client),
    } as any;
    const checked = await preflightStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId,
      storyboard: withImage as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'seedance-2-i2v', duration: 5, compiledPrompt: 'motion prompt',
    });
    falSubmitMock.mockImplementation(async () => {
      events.push('provider');
      return {
        requestId: 'provider-request-1',
        responseUrl: 'https://queue.fal.run/provider-request-1',
      };
    });

    const result = await submitStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId,
      storyboard: withImage as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'seedance-2-i2v', duration: 5, compiledPrompt: 'motion prompt',
      compilationFingerprint: 'compile-fingerprint',
      confirmedPreflight: {
        compilationFingerprint: 'compile-fingerprint',
        sourceFingerprint: checked.sourceFingerprint,
        bindingFingerprint: checked.bindingFingerprint,
        duration: checked.duration,
        maxEstimatedCostUsd: checked.estimatedCostUsd,
      },
      expectedCompatSourceUpdatedAt: 'source-token-1',
      expectedFramingFingerprint: 'framing-fingerprint',
    });

    expect(events).toEqual(['durable-outbox', 'provider']);
    expect(result).toMatchObject({ status: 'queued' });
    expect(falSubmitMock.mock.calls[0]?.[2]).toBe(result.jobId);
    expect(submittingFrame).toMatchObject({
      aiStoryboardId: storyboard.id,
      aiVideoJobId: result.jobId,
      aiVideoStatus: 'submitting',
      aiVideoSourceRevision: 6,
      aiVideoSourceUpdatedAt: 'source-token-1',
      aiVideoSourceFramingFingerprint: 'framing-fingerprint',
      aiVideoSourceFrameUpdatedAt: 'frame-token-1',
    });
  });

  it('rejects an Atmosphere outbox after an Atmosphere frame advance', async () => {
    let inserted = false;
    const withImage = {
      ...storyboard,
      imageData: approvedBaseImage,
      metadata: {
        sourceRevision: 6,
        compatSourceUpdatedAt: 'source-token-1',
        currentFramingFingerprint: 'framing-fingerprint',
      },
    };
    const atmosphereBase = {
      ...approvedBaseRow(6),
      stage: 'atmosphere',
    };
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT project_id, image_data')) {
          return {
            rows: [{
              project_id: storyboard.projectId,
              image_data: withImage.imageData,
              metadata: mirroredStoryboard(withImage).metadata,
              scene_id: storyboard.sceneId,
              frame_id: storyboard.frameId,
              updated_at: withImage.updatedAt,
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM storyboard_ai_image_versions')) {
          return { rows: [atmosphereBase], rowCount: 1 };
        }
        if (sql.includes('FROM storyboard_ai_video_jobs')) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes(' AS spent')) {
          return { rows: [{ spent: 0 }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO storyboard_ai_video_jobs')) {
          inserted = true;
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes('SELECT store_value FROM legacy_compat_store')) {
          return {
            rows: [{
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  updatedAt: 'frame-token-2',
                  sourceUpdatedAt: 'source-token-1',
                  aiPaintoverState: atmosphereEditedState,
                }],
              }],
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT consented')) {
          return { rows: [{ consented: true }] };
        }
        if (sql.includes('AS spent')) return { rows: [{ spent: 0 }] };
        if (sql.includes('FROM storyboard_ai_image_versions')) {
          return { rows: [atmosphereBase] };
        }
        return { rows: [], rowCount: 1 };
      }),
      connect: vi.fn(async () => client),
    } as any;
    const atmosphereRequest = {
      ...videoSourceRequest,
      sourceStage: 'atmosphere' as const,
    };
    const checked = await preflightStoryboardVideo(pool, {
      ...atmosphereRequest,
      projectId: storyboard.projectId,
      storyboard: withImage as any,
      userId: 'user-1',
      userEmail: 'director@example.com',
      userRole: 'owner',
      modelId: 'seedance-2-i2v',
      duration: 5,
      compiledPrompt: 'atmosphere motion prompt',
    });

    await expect(submitStoryboardVideo(pool, {
      ...atmosphereRequest,
      projectId: storyboard.projectId,
      storyboard: withImage as any,
      userId: 'user-1',
      userEmail: 'director@example.com',
      userRole: 'owner',
      modelId: 'seedance-2-i2v',
      duration: 5,
      compiledPrompt: 'atmosphere motion prompt',
      compilationFingerprint: 'atmosphere-compile-fingerprint',
      confirmedPreflight: {
        compilationFingerprint: 'atmosphere-compile-fingerprint',
        sourceFingerprint: checked.sourceFingerprint,
        bindingFingerprint: checked.bindingFingerprint,
        duration: checked.duration,
        maxEstimatedCostUsd: checked.estimatedCostUsd,
      },
      expectedCompatSourceUpdatedAt: 'source-token-1',
      expectedFramingFingerprint: 'framing-fingerprint',
    })).rejects.toMatchObject({
      status: 409,
      code: 'preflight_changed',
    });

    expect(inserted).toBe(true);
    expect(client.query.mock.calls.some(([sql]) =>
      sql.includes('UPDATE legacy_compat_store SET store_value=$2::jsonb')))
      .toBe(false);
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
    expect(falSubmitMock).not.toHaveBeenCalled();
    expect(higgsfieldSubmitMock).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('persists prepared before Higgsfield IO and parks unknown after a timeout', async () => {
    const events: string[] = [];
    let pendingFrame: Record<string, unknown> | undefined;
    let insertSQL = '';
    const withImage = {
      ...storyboard,
      imageData: approvedBaseImage,
      metadata: {
        sourceRevision: 7,
        compatSourceUpdatedAt: 'source-token-1',
        currentFramingFingerprint: 'framing-fingerprint',
      },
    };
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('SELECT project_id, image_data')) {
          return {
            rows: [{
              project_id: storyboard.projectId,
              image_data: withImage.imageData,
              metadata: mirroredStoryboard(withImage).metadata,
              scene_id: storyboard.sceneId,
              frame_id: storyboard.frameId,
              updated_at: withImage.updatedAt,
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM storyboard_ai_image_versions')) {
          return { rows: [approvedBaseRow(7)], rowCount: 1 };
        }
        if (sql.includes('FROM storyboard_ai_video_jobs')) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes(' AS spent')) {
          return { rows: [{ spent: 0 }], rowCount: 1 };
        }
        if (sql.includes('SELECT store_value FROM legacy_compat_store')) {
          return {
            rows: [{
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  updatedAt: 'frame-token-1',
                  sourceUpdatedAt: 'source-token-1',
                  aiPaintoverState: paintoverState,
                }],
              }],
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('INSERT INTO storyboard_ai_video_jobs')) {
          insertSQL = sql;
          events.push('durable-outbox');
          expect(params[6]).toBe('higgsfield');
        }
        if (sql.includes('UPDATE legacy_compat_store SET store_value=$2::jsonb')) {
          pendingFrame = JSON.parse(String(params[1]))[0].storyboardFrames[0];
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT consented')) return { rows: [{ consented: true }] };
        if (sql.includes('AS spent')) return { rows: [{ spent: 0 }] };
        if (sql.includes('FROM storyboard_ai_image_versions')) {
          return { rows: [approvedBaseRow(7)] };
        }
        if (sql.includes("SET status='submitting'")
            && sql.includes("status='prepared'")) {
          events.push('submit-claim');
          return { rows: [{ id: 'claimed' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      connect: vi.fn(async () => client),
    } as any;
    const checked = await preflightStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId,
      storyboard: withImage as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'higgsfield-dop-i2v', duration: 5,
      compiledPrompt: 'motion prompt',
    });
    higgsfieldSubmitMock.mockImplementation(async () => {
      events.push('provider');
      return {
        error: 'higgsfield_submit_threw:socket reset',
        submissionUnknown: true,
      };
    });

    const result = await submitStoryboardVideo(pool, {
      ...videoSourceRequest,
      projectId: storyboard.projectId,
      storyboard: withImage as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'higgsfield-dop-i2v', duration: 5,
      compiledPrompt: 'motion prompt',
      compilationFingerprint: 'compile-fingerprint',
      confirmedPreflight: {
        compilationFingerprint: 'compile-fingerprint',
        sourceFingerprint: checked.sourceFingerprint,
        bindingFingerprint: checked.bindingFingerprint,
        duration: checked.duration,
        maxEstimatedCostUsd: checked.estimatedCostUsd,
      },
      expectedCompatSourceUpdatedAt: 'source-token-1',
      expectedFramingFingerprint: 'framing-fingerprint',
    });

    expect(events).toEqual(['durable-outbox', 'submit-claim', 'provider']);
    expect(insertSQL).toContain(
      "CASE WHEN $7='higgsfield' THEN 'prepared'",
    );
    expect(result).toMatchObject({ status: 'submission_unknown' });
    expect(higgsfieldSubmitMock).toHaveBeenCalledOnce();
    expect(higgsfieldSubmitMock.mock.calls[0]?.[0]).not.toHaveProperty(
      'idempotencyKey',
    );
    expect(higgsfieldSubmitMock.mock.calls[0]?.[0].webhookUrl).toMatch(
      /^https:\/\/theroleroom\.com\/api\/role-room\/storyboard-video-webhooks\/higgsfield\/[0-9a-f]{64}$/,
    );
    const claimCall = pool.query.mock.calls.find(([sql]) =>
      sql.includes("SET status='submitting'")
        && sql.includes('callback_token_hash=$2'));
    expect(claimCall?.[1]?.[1]).toMatch(/^[0-9a-f]{64}$/);
    expect(pendingFrame).toMatchObject({
      aiStoryboardId: storyboard.id,
      aiVideoJobId: result.jobId,
      aiVideoStatus: 'submitting',
      aiVideoSourceRevision: 7,
      aiVideoSourceUpdatedAt: 'source-token-1',
      aiVideoSourceFramingFingerprint: 'framing-fingerprint',
    });
  });

  it.each(['prepared', 'submitting', 'submission_unknown'])(
    'keeps local Higgsfield state %s without polling an absent provider handle',
    async (localStatus) => {
      const pool = {
        query: vi.fn(async (sql: string) => {
          if (sql.includes('SELECT * FROM storyboard_ai_video_jobs')) {
            return { rows: [{
              id: 'job-unknown',
              project_id: storyboard.projectId,
              storyboard_id: storyboard.id,
              model: 'higgsfield-dop-i2v',
              provider: 'higgsfield',
              status: localStatus,
              error: 'higgsfield_submit_threw:socket reset',
              fal_request_id: null,
              response_url: null,
              input: { storyboardId: storyboard.id },
            }] };
          }
          return { rows: [] };
        }),
      } as any;

      await expect(pollStoryboardVideo(pool, {
        projectId: storyboard.projectId,
        storyboardId: storyboard.id,
        jobId: 'job-unknown',
      })).resolves.toEqual({
        status: localStatus,
        error: 'higgsfield_submit_threw:socket reset',
        model: 'higgsfield-dop-i2v',
      });
      expect(higgsfieldPollMock).not.toHaveBeenCalled();
    },
  );

  it('does not meter twice when another poller already claimed completion', async () => {
    falPollMock.mockResolvedValue({ status: 'COMPLETED', result: {} });
    falOutputUrlMock.mockReturnValue({ url: 'https://fal.media/output.mp4', isVideo: true });
    archiveMock.mockResolvedValue(true);
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT * FROM storyboard_ai_video_jobs')) {
          return { rows: [{
            id: 'job-1', status: 'completed', input: { adoptionStatus: 'source-stale' },
          }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('CREATE TABLE')) return { rows: [], rowCount: 0 };
        if (sql.includes('SELECT * FROM storyboard_ai_video_jobs')) {
          return { rows: [{
            id: 'job-1', project_id: storyboard.projectId, storyboard_id: storyboard.id,
            user_id: 'user-1', model: 'seedance-2-i2v', provider: 'bytedance',
            status: 'running', response_url: 'https://queue.fal.run/status',
            fal_request_id: 'request-1', input: { storyboardId: storyboard.id }, est_cost_usd: 0.5,
          }] };
        }
        if (sql.includes("SET status='completed'")) return { rows: [], rowCount: 0 };
        if (sql.includes('SELECT status,model,output_b2_key')) {
          return { rows: [{
            status: 'completed', model: 'seedance-2-i2v', output_b2_key: null,
            output_url_temp: 'https://fal.media/already-settled.mp4',
            input: { adoptionStatus: 'source-stale' },
          }] };
        }
        return { rows: [], rowCount: 0 };
      }),
      connect: vi.fn(async () => client),
    } as any;

    const result = await pollStoryboardVideo(pool, {
      projectId: storyboard.projectId, storyboardId: storyboard.id, jobId: 'job-1',
      fetchImpl: vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
        status: 200, headers: { 'content-type': 'video/mp4' },
      })) as any,
    });

    expect(result).toMatchObject({
      status: 'completed', outputUrl: 'https://fal.media/already-settled.mp4',
    });
    expect(emitMeterMock).not.toHaveBeenCalled();
  });

  it('adopts an exact Color binding after an Atmosphere-only edit', async () => {
    falPollMock.mockResolvedValue({ status: 'COMPLETED', result: {} });
    falOutputUrlMock.mockReturnValue({ url: 'https://fal.media/temporary-output.mp4', isVideo: true });
    const providerUrl = 'https://fal.media/temporary-output.mp4';
    const job = {
      id: 'job-current-source', project_id: storyboard.projectId,
      storyboard_id: storyboard.id, user_id: 'user-1', model: 'seedance-2-i2v',
      provider: 'bytedance', status: 'running',
      response_url: 'https://queue.fal.run/status', fal_request_id: 'request-current',
      est_cost_usd: 0.5,
      input: {
        storyboardId: storyboard.id,
        compatSourceUpdatedAt: 'source-token-1',
        sourceRevision: 4,
        framingFingerprint: 'framing-fingerprint',
        ...boundVideoInput(4),
      },
    };
    const atmosphereEditedState = {
      ...paintoverState,
      atmosphereRevision: 9,
      atmosphereFingerprint: 'd'.repeat(64),
      atmosphereHasContent: true,
      videoStale: true,
    };
    let adoptedFrame: Record<string, unknown> | undefined;
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('SELECT * FROM storyboard_ai_video_jobs')) {
          return { rows: [job], rowCount: 1 };
        }
        if (sql.includes('FROM casting_storyboards')) {
          return {
            rows: [{
              id: storyboard.id,
              project_id: storyboard.projectId,
              scene_id: storyboard.sceneId,
              frame_id: storyboard.frameId,
              metadata: {
                sourceRevision: 4,
                compatSourceUpdatedAt: 'source-token-1',
                currentFramingFingerprint: 'framing-fingerprint',
                aiPaintoverState: atmosphereEditedState,
                aiVideo: { jobId: job.id, ...activeVideoMotionBinding(4) },
              },
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM storyboard_ai_image_versions')) {
          return { rows: [approvedBaseRow(4)], rowCount: 1 };
        }
        if (sql.includes('SELECT store_value FROM legacy_compat_store')) {
          return {
            rows: [{
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  sourceUpdatedAt: 'source-token-1',
                  updatedAt: '2026-08-29T12:00:00.000Z',
                  aiPaintoverState: atmosphereEditedState,
                  aiVideoJobId: job.id,
                  aiVideoSourceFrameUpdatedAt: 'frame-token-1',
                  aiVideoSourceBaseVersionId: baseVersionId,
                  aiVideoSourceStage: 'color',
                  aiVideoSourceRevision: 4,
                  aiVideoSourceUpdatedAt: 'source-token-1',
                  aiVideoSourceFramingFingerprint: 'framing-fingerprint',
                  aiVideoSourceColorRevision: 0,
                  aiVideoSourceAtmosphereRevision: 0,
                  aiVideoSourceColorFingerprint: paintoverState.colorFingerprint,
                  aiVideoSourceAtmosphereFingerprint: '0'.repeat(64),
                  aiVideoSourceColorHasContent: false,
                  aiVideoSourceAtmosphereHasContent: false,
                  aiVideoSourceCompositeFingerprint: null,
                  ...frameVideoMotionSidecars(4),
                }],
              }],
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('UPDATE legacy_compat_store SET store_value=$2::jsonb')) {
          adoptedFrame = JSON.parse(String(params[1]))[0].storyboardFrames[0];
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('CREATE TABLE')) return { rows: [], rowCount: 0 };
        if (sql.includes('SELECT * FROM storyboard_ai_video_jobs')) {
          return { rows: [job], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      connect: vi.fn(async () => client),
    } as any;

    const result = await pollStoryboardVideo(pool, {
      projectId: storyboard.projectId,
      storyboardId: storyboard.id,
      jobId: job.id,
      fetchImpl: vi.fn(async () => new Response(new Uint8Array([7, 8, 9]), {
        status: 200,
        headers: { 'content-type': 'video/mp4' },
      })) as any,
    });

    expect(result).toMatchObject({
      status: 'completed', sourceCurrent: true, outputUrl: providerUrl,
    });
    expect(adoptedFrame).toMatchObject({
      aiVideoJobId: job.id,
      aiVideoStatus: 'completed',
      aiVideoURL: providerUrl,
      aiVideoSourceRevision: 4,
      aiVideoSourceUpdatedAt: 'source-token-1',
      aiVideoSourceFramingFingerprint: 'framing-fingerprint',
      ...frameVideoMotionSidecars(4),
    });
    expect(adoptedFrame?.aiVideoArchiveKey).toBeNull();
    expect(archiveMock).not.toHaveBeenCalled();
    expect((adoptedFrame?.aiPaintoverState as any)?.videoStale)
      .toBe(false);
  });

  it('archives without adopting an Atmosphere binding after Atmosphere edit', async () => {
    falPollMock.mockResolvedValue({ status: 'COMPLETED', result: {} });
    falOutputUrlMock.mockReturnValue({
      url: 'https://fal.media/atmosphere-output.mp4',
      isVideo: true,
    });
    const generationBinding = {
      version: 1 as const,
      source: videoBinding(4, 'frame-token-1', 'atmosphere'),
      motion: staticVideoMotionBinding(),
    };
    const atmosphereBound = {
      sourceBinding: generationBinding.source,
      generationBinding,
      bindingFingerprint: storyboardVideoBindingFingerprintV1(
        generationBinding,
      ),
    };
    const job = {
      id: 'job-atmosphere-stale',
      project_id: storyboard.projectId,
      storyboard_id: storyboard.id,
      user_id: 'user-1',
      model: 'seedance-2-i2v',
      provider: 'bytedance',
      status: 'running',
      response_url: 'https://queue.fal.run/status',
      fal_request_id: 'request-atmosphere-stale',
      est_cost_usd: 0.5,
      input: {
        storyboardId: storyboard.id,
        compatSourceUpdatedAt: 'source-token-1',
        sourceRevision: 4,
        framingFingerprint: 'framing-fingerprint',
        ...atmosphereBound,
      },
    };
    const clientQueries: string[] = [];
    let archivedFrame: Record<string, unknown> | undefined;
    let adoptionPatch: Record<string, unknown> | undefined;
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        clientQueries.push(sql);
        if (sql.includes('SELECT * FROM storyboard_ai_video_jobs')) {
          return { rows: [job], rowCount: 1 };
        }
        if (sql.includes('FROM casting_storyboards')) {
          return {
            rows: [{
              id: storyboard.id,
              project_id: storyboard.projectId,
              scene_id: storyboard.sceneId,
              frame_id: storyboard.frameId,
              metadata: {
                sourceRevision: 4,
                compatSourceUpdatedAt: 'source-token-1',
                currentFramingFingerprint: 'framing-fingerprint',
                aiPaintoverState: atmosphereEditedState,
                aiVideo: {
                  jobId: job.id,
                  bindingFingerprint: atmosphereBound.bindingFingerprint,
                  ...generationBinding.motion,
                },
              },
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('SELECT manuscript_id FROM casting_scenes')) {
          return { rows: [{ manuscript_id: 'manuscript-1' }], rowCount: 1 };
        }
        if (sql.includes('SELECT store_value FROM legacy_compat_store')) {
          return {
            rows: [{
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  aiVideoJobId: job.id,
                  aiVideoStatus: 'running',
                  aiVideoURL: null,
                  sourceUpdatedAt: 'source-token-1',
                  aiPaintoverState: atmosphereEditedState,
                  updatedAt: '2026-08-29T12:00:00.000Z',
                }],
              }],
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('UPDATE legacy_compat_store SET store_value=$2::jsonb')) {
          archivedFrame = JSON.parse(String(params[1]))[0].storyboardFrames[0];
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes("SET status='completed'")) {
          adoptionPatch = JSON.parse(String(params[3]));
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('CREATE TABLE')) return { rows: [], rowCount: 0 };
        if (sql.includes('SELECT * FROM storyboard_ai_video_jobs')) {
          return { rows: [job], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      connect: vi.fn(async () => client),
    } as any;

    const result = await pollStoryboardVideo(pool, {
      projectId: storyboard.projectId,
      storyboardId: storyboard.id,
      jobId: job.id,
    });

    expect(result).toMatchObject({
      status: 'completed',
      sourceCurrent: false,
      outputUrl: 'https://fal.media/atmosphere-output.mp4',
    });
    expect(adoptionPatch).toEqual({ adoptionStatus: 'source-stale' });
    expect(clientQueries.some((sql) =>
      sql.includes('archive_status=CASE WHEN $1::text IS NULL'))).toBe(true);
    expect(clientQueries.some((sql) =>
      sql.includes('UPDATE casting_storyboards'))).toBe(false);
    expect(archivedFrame).toMatchObject({
      aiVideoJobId: job.id,
      aiVideoStatus: 'completed-pending-archive',
      aiVideoURL: null,
      aiVideoArchiveKey: null,
      sourceUpdatedAt: 'source-token-1',
    });
    expect((archivedFrame?.aiPaintoverState as any)?.videoStale).toBe(true);
    expect(archiveMock).not.toHaveBeenCalled();
    expect(lockCompatMock).not.toHaveBeenCalled();
  });

  it('never adopts a legacy completion that lacks the full binding', async () => {
    falPollMock.mockResolvedValue({ status: 'COMPLETED', result: {} });
    falOutputUrlMock.mockReturnValue({
      url: 'https://fal.media/legacy-output.mp4', isVideo: true,
    });
    const legacyJob = {
      id: 'job-legacy-binding', project_id: storyboard.projectId,
      storyboard_id: storyboard.id, user_id: 'user-1',
      model: 'seedance-2-i2v', provider: 'bytedance', status: 'running',
      response_url: 'https://queue.fal.run/status', fal_request_id: 'legacy-1',
      est_cost_usd: 0.5,
      input: {
        storyboardId: storyboard.id,
        compatSourceUpdatedAt: 'source-token-1',
        sourceRevision: 4,
        framingFingerprint: 'framing-fingerprint',
        sourceBinding: videoBinding(4),
      },
    };
    const clientQueries: string[] = [];
    let archivedFrame: Record<string, unknown> | undefined;
    let adoptionPatch: Record<string, unknown> | undefined;
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        clientQueries.push(sql);
        if (sql.includes('SELECT * FROM storyboard_ai_video_jobs')) {
          return { rows: [legacyJob], rowCount: 1 };
        }
        if (sql.includes('SELECT scene_id,frame_id')) {
          return {
            rows: [{ scene_id: storyboard.sceneId, frame_id: storyboard.frameId }],
            rowCount: 1,
          };
        }
        if (sql.includes('SELECT manuscript_id FROM casting_scenes')) {
          return { rows: [{ manuscript_id: 'manuscript-1' }], rowCount: 1 };
        }
        if (sql.includes('SELECT store_value FROM legacy_compat_store')) {
          return {
            rows: [{ store_value: [{
              id: storyboard.sceneId,
              storyboardFrames: [{
                id: storyboard.frameId,
                aiVideoJobId: legacyJob.id,
                aiVideoStatus: 'running',
                aiVideoURL: null,
                aiPaintoverState: paintoverState,
                updatedAt: '2026-08-29T12:00:00.000Z',
              }],
            }] }],
            rowCount: 1,
          };
        }
        if (sql.includes('UPDATE legacy_compat_store SET store_value=$2::jsonb')) {
          archivedFrame = JSON.parse(String(params[1]))[0].storyboardFrames[0];
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes("SET status='completed'")) {
          adoptionPatch = JSON.parse(String(params[3]));
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('CREATE TABLE')) return { rows: [], rowCount: 0 };
        if (sql.includes('SELECT * FROM storyboard_ai_video_jobs')) {
          return { rows: [legacyJob], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      connect: vi.fn(async () => client),
    } as any;

    const result = await pollStoryboardVideo(pool, {
      projectId: storyboard.projectId,
      storyboardId: storyboard.id,
      jobId: legacyJob.id,
    });

    expect(result).toMatchObject({ status: 'completed', sourceCurrent: false });
    expect(adoptionPatch).toEqual({ adoptionStatus: 'source-stale' });
    expect(lockCompatMock).not.toHaveBeenCalled();
    expect(clientQueries.some((sql) =>
      sql.includes('UPDATE casting_storyboards'))).toBe(false);
    expect(archivedFrame).toMatchObject({
      aiVideoJobId: legacyJob.id,
      aiVideoStatus: 'completed-pending-archive',
      aiVideoURL: null,
      aiVideoArchiveKey: null,
    });
    expect((archivedFrame?.aiPaintoverState as any)?.videoStale).toBe(true);
  });

  it('queues archival but does not adopt video when Color changed while running', async () => {
    const changedPaintoverState = {
      ...paintoverState,
      colorRevision: 1,
      colorFingerprint: 'c'.repeat(64),
      atmosphereStale: true,
      videoStale: true,
    };
    falPollMock.mockResolvedValue({ status: 'COMPLETED', result: {} });
    falOutputUrlMock.mockReturnValue({ url: 'https://fal.media/output.mp4', isVideo: true });
    const job = {
      id: 'job-stale-source', project_id: storyboard.projectId,
      storyboard_id: storyboard.id, user_id: 'user-1', model: 'seedance-2-i2v',
      provider: 'bytedance', status: 'running',
      response_url: 'https://queue.fal.run/status', fal_request_id: 'request-2',
      est_cost_usd: 0.5,
      input: {
        storyboardId: storyboard.id,
        compatSourceUpdatedAt: 'source-token-1',
        sourceRevision: 4,
        framingFingerprint: 'framing-fingerprint',
        ...boundVideoInput(4),
      },
    };
    const clientQueries: string[] = [];
    let archivedFrame: Record<string, unknown> | undefined;
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        clientQueries.push(sql);
        if (sql.includes('SELECT * FROM storyboard_ai_video_jobs')) {
          return { rows: [job], rowCount: 1 };
        }
        if (sql.includes('FROM casting_storyboards')) {
          return {
            rows: [{
              id: storyboard.id,
              project_id: storyboard.projectId,
              scene_id: storyboard.sceneId,
              frame_id: storyboard.frameId,
              metadata: {
                sourceRevision: 4,
                compatSourceUpdatedAt: 'source-token-1',
                currentFramingFingerprint: 'framing-fingerprint',
                aiPaintoverState: changedPaintoverState,
                aiVideo: { jobId: job.id, ...activeVideoMotionBinding(4) },
              },
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('SELECT manuscript_id FROM casting_scenes')) {
          return { rows: [{ manuscript_id: 'manuscript-1' }], rowCount: 1 };
        }
        if (sql.includes('SELECT store_value FROM legacy_compat_store')) {
          return {
            rows: [{
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  aiVideoJobId: job.id,
                  aiVideoStatus: 'running',
                  aiVideoURL: null,
                  sourceUpdatedAt: 'source-token-1',
                  aiPaintoverState: changedPaintoverState,
                  shotFraming: { centerX: 0.4, centerY: 0.6, zoom: 1.25 },
                  updatedAt: '2026-08-29T12:00:00.000Z',
                }],
              }],
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('UPDATE legacy_compat_store SET store_value=$2::jsonb')) {
          archivedFrame = JSON.parse(String(params[1]))[0].storyboardFrames[0];
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('CREATE TABLE')) return { rows: [], rowCount: 0 };
        if (sql.includes('SELECT * FROM storyboard_ai_video_jobs')) {
          return { rows: [job], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      connect: vi.fn(async () => client),
    } as any;

    const result = await pollStoryboardVideo(pool, {
      projectId: storyboard.projectId,
      storyboardId: storyboard.id,
      jobId: job.id,
      fetchImpl: vi.fn(async () => new Response(new Uint8Array([4, 5, 6]), {
        status: 200,
        headers: { 'content-type': 'video/mp4' },
      })) as any,
    });

    expect(result).toMatchObject({ status: 'completed', sourceCurrent: false });
    expect(archiveMock).not.toHaveBeenCalled();
    expect(lockCompatMock).not.toHaveBeenCalled();
    expect(clientQueries.some((sql) => sql.includes('UPDATE casting_storyboards')))
      .toBe(false);
    expect(archivedFrame).toMatchObject({
      aiVideoJobId: job.id,
      aiVideoStatus: 'completed-pending-archive',
      aiVideoURL: null,
      sourceUpdatedAt: 'source-token-1',
      shotFraming: { centerX: 0.4, centerY: 0.6, zoom: 1.25 },
    });
    expect((archivedFrame?.aiPaintoverState as any)?.videoStale)
      .toBe(true);
    expect(archivedFrame?.aiVideoArchiveKey).toBeNull();
    expect(clientQueries.some((sql) => sql.includes("status='completed'")))
      .toBe(true);
  });

  it('stores an untrusted webhook durably and only schedules a verified GET', async () => {
    const sql: string[] = [];
    const token = 'a'.repeat(64);
    const client = {
      query: vi.fn(async (query: string) => {
        sql.push(query);
        if (query.includes('SELECT id,provider_request_id')) {
          return {
            rows: [{
              id: 'job-webhook',
              provider_request_id: '018f47a2-8b32-7d19-a271-4f6319d03c2a',
              provider_status_url:
                'https://api.higgsfield.ai/requests/'
                + '018f47a2-8b32-7d19-a271-4f6319d03c2a/status',
              provider_status: 'queued',
              status: 'queued',
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn(async () => client) } as any;

    await expect(acceptStoryboardVideoHiggsfieldWebhook(pool, {
      token,
      body: {
        request_id: '018f47a2-8b32-7d19-a271-4f6319d03c2a',
        status: 'completed',
        error: null,
        payload: { video: { url: 'https://cdn.example.com/untrusted.mp4' } },
      },
    })).resolves.toEqual({ accepted: true, wakeScheduled: true });

    const insertIndex = sql.findIndex((query) =>
      query.includes('INSERT INTO storyboard_ai_video_provider_events'));
    const wakeIndex = sql.findIndex((query) =>
      query.includes('SET next_poll_at=NOW()'));
    expect(insertIndex).toBeGreaterThan(-1);
    expect(wakeIndex).toBeGreaterThan(insertIndex);
    expect(sql.some((query) => query.includes("SET status='completed'"))).toBe(false);
    expect(higgsfieldPollMock).not.toHaveBeenCalled();
    expect(sql.at(-1)).toBe('COMMIT');
  });

  it('rejects a webhook whose request id differs from the token-bound job', async () => {
    const sql: string[] = [];
    const client = {
      query: vi.fn(async (query: string) => {
        sql.push(query);
        if (query.includes('SELECT id,provider_request_id')) {
          return {
            rows: [{
              id: 'job-webhook',
              provider_request_id: '018f47a2-8b32-7d19-a271-4f6319d03c2a',
              provider_status_url: 'https://api.higgsfield.ai/status',
              provider_status: 'queued',
              status: 'queued',
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };

    await expect(acceptStoryboardVideoHiggsfieldWebhook(
      { connect: vi.fn(async () => client) } as any,
      {
        token: 'b'.repeat(64),
        body: {
          request_id: '018f47a2-8b32-7d19-a271-4f6319d03c2b',
          status: 'completed',
          payload: null,
        },
      },
    )).rejects.toMatchObject({
      status: 409,
      code: 'webhook_request_mismatch',
    });
    expect(sql.some((query) =>
      query.includes('INSERT INTO storyboard_ai_video_provider_events')))
      .toBe(false);
    expect(sql.at(-1)).toBe('ROLLBACK');
  });

  it('persists and applies a terminal Higgsfield status atomically', async () => {
    const requestId = '018f47a2-8b32-7d19-a271-4f6319d03c2a';
    const queries: string[] = [];
    const job = {
      id: 'job-nsfw',
      project_id: storyboard.projectId,
      storyboard_id: storyboard.id,
      user_id: 'user-1',
      model: 'higgsfield-dop-i2v',
      provider: 'higgsfield',
      provider_request_id: requestId,
      provider_status_url:
        `https://api.higgsfield.ai/requests/${requestId}/status`,
      status: 'running',
      input: {
        storyboardId: storyboard.id,
        billingMode: 'free_whitelist',
        billedUsd: 0,
      },
    };
    const query = vi.fn(async (queryText: string) => {
        queries.push(queryText);
        if (queryText.includes('SELECT * FROM storyboard_ai_video_jobs')) {
          return { rows: [job], rowCount: 1 };
        }
        if (queryText.includes('SET status=$1,error=$2,next_poll_at=NULL')) {
          return { rows: [job], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      });
    const terminalClient = { query, release: vi.fn() };
    const pool = {
      query,
      connect: vi.fn(async () => terminalClient),
    } as any;
    higgsfieldPollMock.mockResolvedValue({
      status: 'ERROR',
      providerStatus: 'nsfw',
      requestId,
      correlationId: 'corr-nsfw',
      error: 'nsfw',
    });

    await expect(pollStoryboardVideo(pool, {
      projectId: storyboard.projectId,
      storyboardId: storyboard.id,
      jobId: job.id,
    })).resolves.toMatchObject({ status: 'nsfw', error: 'nsfw' });

    const eventIndex = queries.findIndex((query) =>
      query.includes('INSERT INTO storyboard_ai_video_provider_events'));
    const terminalIndex = queries.findIndex((query) =>
      query.includes('SET status=$1,error=$2,next_poll_at=NULL'));
    expect(eventIndex).toBeGreaterThan(-1);
    expect(terminalIndex).toBeGreaterThan(eventIndex);
    expect(queries[terminalIndex]).toContain('provider_status=$4');
    expect(queries[terminalIndex]).toContain('provider_terminal_at=NOW()');
    expect(queries[terminalIndex]).not.toContain('catch');
    expect(queries.indexOf('BEGIN')).toBeLessThan(terminalIndex);
    expect(queries.indexOf('COMMIT')).toBeGreaterThan(terminalIndex);
    expect(terminalClient.release).toHaveBeenCalledOnce();
  });

  it('does not regress or refund when another poll already won terminal CAS', async () => {
    const requestId = '018f47a2-8b32-7d19-a271-4f6319d03c2a';
    const queries: string[] = [];
    const job = {
      id: 'job-terminal-race', project_id: storyboard.projectId,
      storyboard_id: storyboard.id, user_id: 'user-1',
      model: 'higgsfield-dop-i2v', provider: 'higgsfield',
      provider_request_id: requestId,
      provider_status_url:
        `https://api.higgsfield.ai/requests/${requestId}/status`,
      provider_status: 'queued', status: 'running',
      input: { storyboardId: storyboard.id, billingMode: 'credits', billedUsd: 0.81 },
    };
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('SET status=$1,error=$2,next_poll_at=NULL')) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn(async () => client),
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('SELECT * FROM storyboard_ai_video_jobs')) {
          return { rows: [job], rowCount: 1 };
        }
        if (sql.includes('SELECT status,error,model')) {
          return { rows: [{ status: 'completed', error: null, model: job.model }] };
        }
        return { rows: [], rowCount: 1 };
      }),
    } as any;
    higgsfieldPollMock.mockResolvedValue({
      status: 'ERROR', providerStatus: 'failed', requestId,
      correlationId: 'corr-race', error: 'provider_failed',
    });

    await expect(pollStoryboardVideo(pool, {
      projectId: storyboard.projectId,
      storyboardId: storyboard.id,
      jobId: job.id,
    })).resolves.toMatchObject({ status: 'completed' });

    expect(queries.some((sql) =>
      sql.includes('INSERT INTO storyboard_ai_video_billing_settlements')))
      .toBe(false);
    expect(creditMoveMock).not.toHaveBeenCalled();
    expect(queries.some((sql) => sql.includes("provider_status IN ('queued','in_progress')")))
      .toBe(true);
  });

  it('guards delayed active poll responses with terminal-state CAS predicates', async () => {
    const requestId = '018f47a2-8b32-7d19-a271-4f6319d03c2a';
    const queries: string[] = [];
    const job = {
      id: 'job-delayed-active', project_id: storyboard.projectId,
      storyboard_id: storyboard.id, model: 'higgsfield-dop-i2v',
      provider: 'higgsfield', provider_request_id: requestId,
      provider_status_url:
        `https://api.higgsfield.ai/requests/${requestId}/status`,
      provider_status: 'queued', status: 'running',
      input: { storyboardId: storyboard.id },
    };
    const pool = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('SELECT * FROM storyboard_ai_video_jobs')) {
          return { rows: [job], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as any;
    higgsfieldPollMock.mockResolvedValue({
      status: 'IN_PROGRESS', providerStatus: 'in_progress', requestId,
      correlationId: 'corr-active',
    });

    await expect(pollStoryboardVideo(pool, {
      projectId: storyboard.projectId,
      storyboardId: storyboard.id,
      jobId: job.id,
    })).resolves.toMatchObject({ status: 'running' });

    const activeUpdates = queries.filter((sql) =>
      sql.includes("status IN ('queued','running','processing')")
        && sql.includes("provider_status IN ('queued','in_progress')"));
    expect(activeUpdates.length).toBeGreaterThanOrEqual(2);
  });
});
