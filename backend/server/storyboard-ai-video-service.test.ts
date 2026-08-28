import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  archiveMock,
  emitMeterMock,
  falOutputUrlMock,
  falPollMock,
  falSubmitMock,
  higgsfieldEstimateMock,
  higgsfieldSubmitMock,
  presignMock,
} = vi.hoisted(() => ({
  archiveMock: vi.fn(),
  emitMeterMock: vi.fn(),
  falOutputUrlMock: vi.fn(() => ({ url: null, isVideo: true })),
  falPollMock: vi.fn(),
  falSubmitMock: vi.fn(),
  higgsfieldEstimateMock: vi.fn(),
  higgsfieldSubmitMock: vi.fn(),
  presignMock: vi.fn(),
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
  getGenSettings: vi.fn(async () => ({
    enabled: true, billingMode: 'free_whitelist', dailyCapUsd: 20,
    whitelist: ['director@example.com'], includedQuota: 0,
    markupMultiplier: 3, creditPacks: [],
  })),
  aiAllowed: vi.fn(() => true),
  falConfigured: vi.fn(() => true),
  higgsfieldConfigured: vi.fn(() => true),
  falSubmit: falSubmitMock,
  falPoll: falPollMock, falOutputUrl: falOutputUrlMock,
  higgsfieldEstimate: higgsfieldEstimateMock,
  higgsfieldSubmit: higgsfieldSubmitMock,
  higgsfieldPoll: vi.fn(), emitGenAiMeter: emitMeterMock,
}));

vi.mock('./b2-archive-helper.js', () => ({
  archiveToRoleRoomB2: archiveMock, presignRoleRoomB2Download: presignMock,
}));

vi.mock('./ai-credits.js', () => ({
  getUserCredits: vi.fn(async () => ({ balanceUsd: 100, purchasedUsd: 100, spentUsd: 0 })),
  creditMove: vi.fn(),
}));

import {
  getStoryboardVideoConfig,
  pollStoryboardVideo,
  preflightStoryboardVideo,
  StoryboardVideoError,
  submitStoryboardVideo,
} from './storyboard-ai-video-service.js';

function poolWithConsent(consented: boolean) {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('SELECT consented')) {
        return { rows: consented ? [{ consented: true, consented_by: 'director@example.com' }] : [] };
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

describe('Storyboard video provider gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    archiveMock.mockResolvedValue(true);
    presignMock.mockResolvedValue('https://assets.example.com/source.png');
    higgsfieldEstimateMock.mockResolvedValue({ usd: 0.27, credits: 9 });
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

  it('fails closed before provider submission when consent is missing', async () => {
    await expect(submitStoryboardVideo(poolWithConsent(false), {
      projectId: storyboard.projectId, storyboard: storyboard as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'seedance-2-i2v', duration: 5, compiledPrompt: 'motion prompt',
      compilationFingerprint: 'fingerprint',
    })).rejects.toMatchObject<Partial<StoryboardVideoError>>({
      status: 409, code: 'consent_required',
    });
    expect(falSubmitMock).not.toHaveBeenCalled();
  });

  it('requires a real storyboard panel before spending provider cost', async () => {
    await expect(submitStoryboardVideo(poolWithConsent(true), {
      projectId: storyboard.projectId, storyboard: storyboard as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'seedance-2-i2v', duration: 5, compiledPrompt: 'motion prompt',
      compilationFingerprint: 'fingerprint',
    })).rejects.toMatchObject<Partial<StoryboardVideoError>>({
      status: 409, code: 'storyboard_image_required',
    });
    expect(falSubmitMock).not.toHaveBeenCalled();
  });

  it('uses Higgsfield authoritative estimate without submitting a paid job', async () => {
    const withImage = {
      ...storyboard,
      imageData: 'data:image/png;base64,' + Buffer.from('pencil-color-atmosphere').toString('base64'),
    };
    const result = await preflightStoryboardVideo(poolWithConsent(true), {
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

  it('fails closed when the confirmed source fingerprint no longer matches', async () => {
    const withImage = {
      ...storyboard,
      imageData: 'data:image/png;base64,' + Buffer.from('changed-source').toString('base64'),
    };
    await expect(submitStoryboardVideo(poolWithConsent(true), {
      projectId: storyboard.projectId, storyboard: withImage as any,
      userId: 'user-1', userEmail: 'director@example.com', userRole: 'owner',
      modelId: 'higgsfield-dop-i2v', duration: 5,
      compiledPrompt: 'preserve graphite lines', compilationFingerprint: 'prompt-fingerprint',
      confirmedPreflight: {
        compilationFingerprint: 'prompt-fingerprint', sourceFingerprint: 'stale-source',
        maxEstimatedCostUsd: 0.27,
      },
    })).rejects.toMatchObject<Partial<StoryboardVideoError>>({
      status: 409, code: 'preflight_changed',
    });
    expect(higgsfieldSubmitMock).not.toHaveBeenCalled();
  });

  it('does not meter twice when another poller already claimed completion', async () => {
    falPollMock.mockResolvedValue({ status: 'COMPLETED', result: {} });
    falOutputUrlMock.mockReturnValue({ url: 'https://fal.media/output.mp4', isVideo: true });
    archiveMock.mockResolvedValue(true);
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
        if (sql.includes('SELECT status, model, output_b2_key')) {
          return { rows: [{
            status: 'completed', model: 'seedance-2-i2v', output_b2_key: null,
            output_url_temp: 'https://fal.media/already-settled.mp4',
          }] };
        }
        return { rows: [], rowCount: 0 };
      }),
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
});
