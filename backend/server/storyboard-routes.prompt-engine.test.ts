import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./role-room-projects-routes.js', () => ({
  canAccessRoleRoomProject: vi.fn().mockResolvedValue(true),
}));

vi.mock('./role-room-tab-access.js', () => ({
  viewerMeetsTabLevel: vi.fn().mockResolvedValue(true),
}));

vi.mock('./storyboard-service.js', () => ({
  listStoryboards: vi.fn(),
  getStoryboard: vi.fn(),
  getStoryboardByFrameId: vi.fn(),
  upsertStoryboard: vi.fn(),
  updateStoryboard: vi.fn(),
  deleteStoryboard: vi.fn(),
}));

vi.mock('./storyboard-production-context.js', () => ({
  hydrateStoryboardProductionContext: vi.fn(async (_pool, input) => input.context),
}));

import * as storyboardService from './storyboard-service.js';
import { createStoryboardRouter } from './storyboard-routes.js';
import { shotFramingFingerprint } from '../../frontend/shared/storyboard-shot-framing.js';

function routeHandlers(router: any, method: string, path: string): any[] {
  const layer = router.stack.find((candidate: any) =>
    candidate.route
    && candidate.route.path === path
    && candidate.route.methods[method.toLowerCase()]);
  return layer?.route?.stack.map((candidate: any) => candidate.handle) ?? [];
}

function makeResponse() {
  const response: any = { statusCode: 200, body: undefined, headers: {} };
  response.setHeader = (name: string, value: string) => {
    response.headers[name.toLowerCase()] = value;
    return response;
  };
  response.status = (statusCode: number) => {
    response.statusCode = statusCode;
    return response;
  };
  response.json = (body: unknown) => {
    response.body = body;
    return response;
  };
  return response;
}

async function runHandlers(handlers: any[], request: any, response: any) {
  for (const handler of handlers) {
    let proceed = false;
    await handler(request, response, () => { proceed = true; });
    if (!proceed) return;
  }
}

const context = {
  version: 'storyboard-shot-v1' as const,
  manuscriptTitle: 'TROLL',
  project: { styleProfileId: 'story-pencil', creativeDirection: '' },
  production: {
    characters: [{ id: 'nora', name: 'Nora', description: 'Rain-soaked', referenceImageIds: [], locked: true }],
    wardrobe: [],
    locations: [],
    props: [],
  },
  scene: {
    id: 'scene-3',
    number: 3,
    heading: 'Mountain railway',
    intExt: 'EXT',
    location: 'Train roof',
    timeOfDay: 'Night',
    action: 'Nora braces as the troll rises beside the train.',
    characters: ['Nora'],
  },
  shot: {
    id: 'frame-3b',
    number: '3B',
    description: 'Nora looks up while the troll fills the background.',
    notes: '',
    shotType: 'MCU',
    angle: 'Low',
    lensMm: 50,
    movement: 'Push',
    lighting: 'Cold moonlight and warm train windows.',
    durationSec: 4,
    transition: '',
    focusDepth: '',
    timeOfDay: 'Night',
    weather: 'Rain',
    beat: '',
    tags: [],
  },
  continuity: { previous: null, next: null },
  directorNote: '',
  visualStyle: '',
};

describe('Prompt Inspector route', () => {
  beforeEach(() => {
    vi.mocked(storyboardService.getStoryboard).mockResolvedValue({
      id: 'storyboard-1',
      projectId: 'project-1',
      sceneId: 'scene-3',
      frameId: 'frame-3b',
      width: 1920,
      height: 1080,
      strokes: [{
        id: 'focus-1', width: 80,
        brush: { type: 'focusBrush', productionMark: 'focus' },
        points: [{ x: 900, y: 400, pressure: 0.5 }, { x: 1100, y: 600, pressure: 0.7 }],
      }],
    } as any);
  });

  it('rate-limits repeated animation preflights per authenticated project user', async () => {
    const sessions = new Map([
      ['session-rate', {
        userId: 'user-rate', email: 'director@example.com', name: 'Director',
        role: 'owner', loginAt: new Date().toISOString(),
      }],
    ]);
    const router = createStoryboardRouter({} as any, {
      activeSessions: sessions,
      videoPreflightRateMaxRequests: 1,
      videoPreflightRateWindowMs: 60_000,
      now: () => 1_000,
    });
    const handlers = routeHandlers(
      router,
      'POST',
      '/projects/:projectId/storyboards/:id/animation-preflight',
    );
    const request = {
      headers: { authorization: 'Bearer session-rate' },
      params: { projectId: 'project-1', id: 'storyboard-1' },
      body: {},
    };

    const first = makeResponse();
    await runHandlers(handlers, request, first);
    expect(first.statusCode).toBe(400);

    const second = makeResponse();
    await runHandlers(handlers, request, second);
    expect(second.statusCode).toBe(429);
    expect(second.body).toEqual({ error: 'animation_preflight_rate_limited' });
    expect(second.headers['retry-after']).toBe('60');
  });

  it('compiles production context without calling a provider', async () => {
    const sessions = new Map([
      ['session-1', {
        userId: 'user-1', email: 'director@example.com', name: 'Director',
        role: 'owner', loginAt: new Date().toISOString(),
      }],
    ]);
    const router = createStoryboardRouter({} as any, { activeSessions: sessions });
    const handlers = routeHandlers(
      router,
      'POST',
      '/projects/:projectId/storyboards/:id/compile-ai-prompt',
    );
    const response = makeResponse();
    await runHandlers(handlers, {
      headers: { authorization: 'Bearer session-1' },
      params: { projectId: 'project-1', id: 'storyboard-1' },
      body: {
        kind: 'storyboard-image',
        model: 'gpt-image-2',
        userAction: 'Generate low-angle MCU',
        context,
      },
    }, response);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.version).toBe('trr-prompt-engine-v2');
    expect(response.body.data.inspector.styleProfileId).toBe('story-pencil');
    expect(response.body.data.modules.map((module: any) => module.id)).toEqual([
      'base-cinematography', 'project-style', 'scenario', 'character', 'wardrobe',
      'location', 'prop', 'shot', 'camera', 'lighting', 'continuity',
      'user-intent', 'model-rules',
    ]);
    expect(response.body.data.modules.find((module: any) => module.id === 'shot')
      .constraints.some((constraint: any) =>
        constraint.text.includes('Explicit artist mark — focus'))).toBe(true);
  });

  it('gir den autentiserte iPad-klienten en stabil scenario-katalog', async () => {
    const sessions = new Map([
      ['session-1', {
        userId: 'user-1', email: 'director@example.com', name: 'Director',
        role: 'owner', loginAt: new Date().toISOString(),
      }],
    ]);
    const router = createStoryboardRouter({} as any, { activeSessions: sessions });
    const handlers = routeHandlers(router, 'GET', '/storyboard-scenario-packs');
    const response = makeResponse();
    await runHandlers(handlers, {
      headers: { authorization: 'Bearer session-1' }, params: {}, body: {},
    }, response);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveLength(14);
    expect(response.body.data.map((pack: any) => pack.id)).toEqual(expect.arrayContaining([
      'medical.healthcare', 'restaurant.food-service', 'police.security',
      'fire.rescue', 'education.school', 'hospitality.hotel', 'office.production',
      'retail.shop', 'airport.travel', 'construction.site', 'industrial.workshop',
      'residential.domestic', 'sports.fitness', 'event.entertainment',
    ]));
    expect(response.body.data[0].subdomains
      .find((entry: any) => entry.id === 'emergency-department').zones)
      .toContainEqual({ id: 'emergency-bay', label: 'Emergency Bay' });
    expect(response.body.data[0].subdomains
      .find((entry: any) => entry.id === 'emergency-department').roles)
      .toContainEqual({ id: 'paramedic', label: 'Paramedic' });
    expect(response.body.data[0].families[0].variants).toHaveLength(4);
    expect(JSON.stringify(response.body.data)).not.toContain('prompt');
  });

  it('publiserer rimelig standardruting uten å eksponere provider keys', async () => {
    const sessions = new Map([['session-1', {
      userId: 'user-1', email: 'director@example.com', name: 'Director',
      role: 'owner', loginAt: new Date().toISOString(),
    }]]);
    const router = createStoryboardRouter({} as any, { activeSessions: sessions });
    const response = makeResponse();
    await runHandlers(routeHandlers(router, 'GET', '/storyboard-ai-models'), {
      headers: { authorization: 'Bearer session-1' }, params: {}, body: {},
    }, response);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.find((entry: any) => entry.id === 'seedance-2-i2v').recommended)
      .toBe(true);
    expect(response.body.data.find((entry: any) => entry.id === 'higgsfield-dop-i2v').recommended)
      .toBe(false);
    expect(JSON.stringify(response.body)).not.toMatch(/API_KEY|secret/i);
  });

  it('returns the authoritative source revision at the image-stage envelope', async () => {
    vi.mocked(storyboardService.getStoryboard).mockResolvedValue({
      id: 'storyboard-1',
      projectId: 'project-1',
      sceneId: 'scene-3',
      frameId: 'frame-3b',
      width: 1920,
      height: 1080,
      strokes: [],
      metadata: {
        sourceRevision: 7,
        compatFrameUpdatedAt: '2026-08-29T09:30:00.000Z',
      },
    } as any);
    const pool = {
      query: vi.fn(async (sql: string) => (
        sql.includes('FROM casting_storyboards storyboard')
          ? {
              rows: [{
                id: null,
                storyboard_metadata: {
                  sourceRevision: 7,
                  compatFrameUpdatedAt: '2026-08-29T09:30:00.000Z',
                },
              }],
              rowCount: 1,
            }
          : { rows: [], rowCount: 0 }
      )),
    };
    const sessions = new Map([['session-1', {
      userId: 'user-1', email: 'director@example.com', name: 'Director',
      role: 'owner', loginAt: new Date().toISOString(),
    }]]);
    const router = createStoryboardRouter(pool as any, { activeSessions: sessions });
    const response = makeResponse();
    await runHandlers(routeHandlers(
      router, 'GET', '/projects/:projectId/storyboards/:id/image-stages',
    ), {
      headers: { authorization: 'Bearer session-1' },
      params: { projectId: 'project-1', id: 'storyboard-1' },
      body: {},
    }, response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      currentSourceRevision: 7,
      compatFrameUpdatedAt: '2026-08-29T09:30:00.000Z',
      sourceUpdatedAt: '2026-08-29T09:30:00.000Z',
      data: [],
    });
  });

  it('deprecates the unsafe direct image-adoption route before provider IO', async () => {
    const sessions = new Map([['session-1', {
      userId: 'user-1', email: 'director@example.com', name: 'Director',
      role: 'owner', loginAt: new Date().toISOString(),
    }]]);
    const router = createStoryboardRouter({} as any, { activeSessions: sessions });
    const response = makeResponse();
    await runHandlers(routeHandlers(
      router, 'POST', '/projects/:projectId/storyboards/:id/generate-ai-image',
    ), {
      headers: { authorization: 'Bearer session-1' },
      params: { projectId: 'project-1', id: 'storyboard-1' },
      body: {},
    }, response);

    expect(response.statusCode).toBe(409);
    expect(response.body.error).toBe('staged_image_pipeline_required');
  });

  it('rejects a missing Atmosphere parent before reserving image cost', async () => {
    const shotFraming = {
      version: 1,
      centerX: 0.5,
      centerY: 0.5,
      zoom: 1,
      rollDegrees: 0,
      aspectRatio: 2.39,
      mode: 'manual',
      revision: 2,
    };
    const fingerprint = shotFramingFingerprint(shotFraming)!;
    const sourceToken = '2026-08-29T12:00:00.000Z';
    vi.mocked(storyboardService.getStoryboard).mockResolvedValue({
      id: 'storyboard-1',
      projectId: 'project-1',
      sceneId: 'scene-3',
      frameId: 'frame-3b',
      imageData: `data:image/png;base64,${Buffer.alloc(32, 7).toString('base64')}`,
      width: 2048,
      height: 857,
      strokes: [],
      workflowLevel: 'image-reference',
      metadata: {
        sourceRevision: 3,
        compatSourceUpdatedAt: sourceToken,
        currentFramingFingerprint: fingerprint,
      },
    } as any);
    const queries: string[] = [];
    const pool = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('FROM casting_scenes scene')) {
          return {
            rows: [{
              manuscript_id: 'manuscript-1',
              store_value: [{
                id: 'scene-3',
                storyboardFrames: [{
                  id: 'frame-3b',
                  updatedAt: sourceToken,
                  sourceUpdatedAt: sourceToken,
                  shotFraming,
                }],
              }],
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM storyboard_ai_image_versions')) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    const sessions = new Map([['session-1', {
      userId: 'user-1', email: 'director@example.com', name: 'Director',
      role: 'owner', loginAt: new Date().toISOString(),
    }]]);
    const priorKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-openai-key';
    try {
      const router = createStoryboardRouter(pool as any, { activeSessions: sessions });
      const response = makeResponse();
      await runHandlers(routeHandlers(
        router, 'POST',
        '/projects/:projectId/storyboards/:id/image-stages/:stage/generate',
      ), {
        headers: { authorization: 'Bearer session-1' },
        params: { projectId: 'project-1', id: 'storyboard-1', stage: 'atmosphere' },
        body: {
          context: {
            ...context,
            shot: { ...context.shot, shotFraming },
          },
          quality: 'hd',
          expectedSourceRevision: 3,
          expectedCompatFrameUpdatedAt: sourceToken,
          idempotencyKey: 'atmosphere-action-1',
        },
      }, response);

      expect(response.statusCode).toBe(409);
      expect(response.body.error).toBe('approved_color_required');
      expect(queries.some((sql) =>
        sql.includes('INSERT INTO storyboard_ai_image_usage'))).toBe(false);
      expect(queries.some((sql) =>
        sql.includes('INSERT INTO storyboard_ai_image_operations'))).toBe(false);
    } finally {
      if (priorKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = priorKey;
    }
  });

  it('rejects a stale Pencil ensure snapshot before it can overwrite a collaborator', async () => {
    const shotFraming = {
      version: 1,
      centerX: 0.5,
      centerY: 0.5,
      zoom: 1,
      rollDegrees: 0,
      aspectRatio: 16 / 9,
      mode: 'automatic',
      revision: 0,
    };
    const fingerprint = shotFramingFingerprint(shotFraming)!;
    vi.mocked(storyboardService.getStoryboardByFrameId).mockResolvedValue({
      id: 'storyboard-1',
      projectId: 'project-1',
      sceneId: 'scene-3',
      frameId: 'frame-3b',
      width: 1920,
      height: 1080,
      strokes: [],
      metadata: { sourceRevision: 4, currentFramingFingerprint: fingerprint },
    } as any);
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT manuscript_id FROM casting_scenes')) {
          return { rows: [{ manuscript_id: 'manuscript-1' }], rowCount: 1 };
        }
        if (sql.includes('FROM casting_scenes scene')) {
          return {
            rows: [{
              manuscript_id: 'manuscript-1',
              store_value: [{
                id: 'scene-3',
                storyboardFrames: [{
                  id: 'frame-3b',
                  updatedAt: '2026-08-29T10:00:02.000Z',
                  sourceUpdatedAt: '2026-08-29T10:00:02.000Z',
                  shotFraming,
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
    const pool = { connect: vi.fn(async () => client) };
    const sessions = new Map([['session-1', {
      userId: 'user-1', email: 'director@example.com', name: 'Director',
      role: 'owner', loginAt: new Date().toISOString(),
    }]]);
    const router = createStoryboardRouter(pool as any, { activeSessions: sessions });
    const response = makeResponse();
    await runHandlers(routeHandlers(
      router, 'POST', '/projects/:projectId/storyboards',
    ), {
      headers: { authorization: 'Bearer session-1' },
      params: { projectId: 'project-1' },
      body: {
        sceneId: 'scene-3',
        frameId: 'frame-3b',
        strokes: [],
        imageData: 'data:image/png;base64,AAAA',
        width: 1920,
        height: 1080,
        workflowLevel: 'ai-pipeline-pencil-source',
        expectedSourceRevision: 4,
        expectedCompatFrameUpdatedAt: '2026-08-29T10:00:01.000Z',
        expectedFramingFingerprint: fingerprint,
      },
    }, response);

    expect(response.statusCode).toBe(409);
    expect(response.body.error).toBe('compat_source_stale');
    expect(storyboardService.upsertStoryboard).not.toHaveBeenCalled();
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('avviser animasjon når konteksten peker på et annet shot', async () => {
    const sessions = new Map([['session-1', {
      userId: 'user-1', email: 'director@example.com', name: 'Director',
      role: 'owner', loginAt: new Date().toISOString(),
    }]]);
    const router = createStoryboardRouter({} as any, { activeSessions: sessions });
    const response = makeResponse();
    await runHandlers(routeHandlers(
      router, 'POST', '/projects/:projectId/storyboards/:id/animate',
    ), {
      headers: { authorization: 'Bearer session-1' },
      params: { projectId: 'project-1', id: 'storyboard-1' },
      body: {
        context: { ...context, shot: { ...context.shot, id: 'frame-other' } },
        sourceStage: 'color',
        baseVersionId: '00000000-0000-4000-8000-000000000001',
        model: 'seedance-2-i2v', duration: 5,
        confirmedPreflight: {
          compilationFingerprint: 'compile-12345678',
          sourceFingerprint: 'source-12345678',
          bindingFingerprint: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
          duration: 5,
          maxEstimatedCostUsd: 1,
        },
      },
    }, response);
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('context_mismatch');
  });

  it('rejects shot context from another frame', async () => {
    const sessions = new Map([
      ['session-1', {
        userId: 'user-1', email: 'director@example.com', name: 'Director',
        role: 'owner', loginAt: new Date().toISOString(),
      }],
    ]);
    const router = createStoryboardRouter({} as any, { activeSessions: sessions });
    const handlers = routeHandlers(
      router,
      'POST',
      '/projects/:projectId/storyboards/:id/compile-ai-prompt',
    );
    const response = makeResponse();
    await runHandlers(handlers, {
      headers: { authorization: 'Bearer session-1' },
      params: { projectId: 'project-1', id: 'storyboard-1' },
      body: {
        kind: 'storyboard-image',
        model: 'gpt-image-2',
        context: { ...context, shot: { ...context.shot, id: 'frame-other' } },
      },
    }, response);

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('context_mismatch');
  });
});

describe('Storyboard webhook route ownership', () => {
  it('does not register the provider callback behind the global body parser', () => {
    const router = createStoryboardRouter({} as any);

    expect(routeHandlers(
      router,
      'POST',
      '/storyboard-video-webhooks/higgsfield/:token',
    )).toEqual([]);
  });
});
