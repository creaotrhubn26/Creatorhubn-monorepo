import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stage = vi.hoisted(() => ({
  claim: vi.fn(),
  fail: vi.fn(),
  generate: vi.fn(),
  markProcessing: vi.fn(),
  preflight: vi.fn(),
  requireStoryboard: vi.fn(),
}));
const cost = vi.hoisted(() => ({
  complete: vi.fn(),
  fail: vi.fn(),
  reserve: vi.fn(),
}));

vi.mock('./role-room-projects-routes.js', () => ({
  canAccessRoleRoomProject: vi.fn().mockResolvedValue(true),
}));
vi.mock('./role-room-tab-access.js', () => ({
  viewerMeetsTabLevel: vi.fn().mockResolvedValue(true),
}));
vi.mock('./storyboard-service.js', () => ({
  listStoryboards: vi.fn(), getStoryboard: vi.fn(),
  getStoryboardByFrameId: vi.fn(), upsertStoryboard: vi.fn(),
  updateStoryboard: vi.fn(), deleteStoryboard: vi.fn(),
}));
vi.mock('./storyboard-ai-image-stage-service.js', () => {
  class StageError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      readonly safeDetail: string,
    ) { super(code); }
  }
  return {
    approveStoryboardAIImageVersion: vi.fn(),
    claimStoryboardAIImageOperation: stage.claim,
    failStoryboardAIImageOperation: stage.fail,
    generateStoryboardAIImageStage: stage.generate,
    listStoryboardAIImageVersions: vi.fn(),
    requireStoryboardForStage: stage.requireStoryboard,
    StoryboardAIImageStageError: StageError,
    lockAndValidateStoryboardCompatSource: vi.fn(),
    markStoryboardAIImageOperationProcessing: stage.markProcessing,
    preflightStoryboardAIImageStage: stage.preflight,
    storyboardSourceRevision: vi.fn(),
    validateStoryboardCompatMirror: vi.fn(),
  };
});
vi.mock('./storyboard-ai-cost-control.js', () => {
  class CostError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      readonly safeDetail: string,
    ) { super(code); }
  }
  return {
    completeStoryboardImageCost: cost.complete,
    failStoryboardImageCost: cost.fail,
    reserveStoryboardImageCost: cost.reserve,
    StoryboardAICostError: CostError,
  };
});
vi.mock('./storyboard-ai-video-service.js', () => {
  class VideoError extends Error {}
  return {
    getStoryboardVideoConfig: vi.fn().mockResolvedValue({
      allowed: true,
      consent: { consented: true },
    }),
    pollStoryboardVideo: vi.fn(),
    preflightStoryboardVideo: vi.fn(),
    setStoryboardVideoConsent: vi.fn(),
    StoryboardVideoError: VideoError,
    submitStoryboardVideo: vi.fn(),
  };
});

import { StoryboardImageProviderOutcomeUnknownError } from './storyboard-ai-image-service.js';
import { createStoryboardRouter } from './storyboard-routes.js';

const priorOpenAIKey = process.env.OPENAI_API_KEY;

function routeHandlers(router: any, method: string, path: string): any[] {
  const layer = router.stack.find((candidate: any) => candidate.route
    && candidate.route.path === path
    && candidate.route.methods[method.toLowerCase()]);
  return layer?.route?.stack.map((candidate: any) => candidate.handle) ?? [];
}

function responseDouble() {
  const response: any = { statusCode: 200, body: undefined };
  response.status = (statusCode: number) => {
    response.statusCode = statusCode;
    return response;
  };
  response.json = (body: unknown) => {
    response.body = body;
    return response;
  };
  response.setHeader = vi.fn();
  return response;
}

async function runHandlers(handlers: any[], request: any, response: any) {
  for (const handler of handlers) {
    let proceed = false;
    await handler(request, response, () => { proceed = true; });
    if (!proceed) return;
  }
}

describe('Storyboard image ambiguous provider boundary', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    vi.clearAllMocks();
    stage.requireStoryboard.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      projectId: 'project-1', sceneId: 'scene-1', frameId: 'frame-1',
      strokes: [], width: 1920, height: 1080, metadata: {},
    });
    stage.preflight.mockResolvedValue({ operationFingerprint: 'fingerprint-1' });
    stage.claim.mockResolvedValue({ state: 'claimed', operationId: 'operation-1' });
    cost.reserve.mockResolvedValue({ id: 'reservation-1', estimatedCostUsd: 0.22 });
    stage.generate.mockRejectedValue(new StoryboardImageProviderOutcomeUnknownError(
      'openai_submission_unknown',
    ));
  });

  afterEach(() => {
    if (priorOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = priorOpenAIKey;
  });

  it('keeps processing and reserved state on an ambiguous paid POST result', async () => {
    const sessions = new Map([['session-1', {
      userId: 'user-1', email: 'director@example.com', name: 'Director',
      role: 'owner', loginAt: new Date().toISOString(),
    }]]);
    const router = createStoryboardRouter({} as any, { activeSessions: sessions });
    const response = responseDouble();

    await runHandlers(routeHandlers(
      router, 'POST',
      '/projects/:projectId/storyboards/:id/image-stages/:stage/generate',
    ), {
      headers: { authorization: 'Bearer session-1' },
      params: {
        projectId: 'project-1',
        id: '11111111-1111-4111-8111-111111111111',
        stage: 'color',
      },
      body: {
        prompt: 'Color the approved pencil frame.',
        quality: 'hd',
        idempotencyKey: 'stable-image-action-1',
      },
    }, response);

    expect(response.statusCode).toBe(502);
    expect(response.body.error).toBe('openai_submission_unknown');
    expect(stage.markProcessing).toHaveBeenCalledWith(
      expect.anything(), 'operation-1', 'reservation-1',
    );
    expect(cost.fail).not.toHaveBeenCalled();
    expect(stage.fail).not.toHaveBeenCalled();
    expect(cost.complete).not.toHaveBeenCalled();
  });
});
