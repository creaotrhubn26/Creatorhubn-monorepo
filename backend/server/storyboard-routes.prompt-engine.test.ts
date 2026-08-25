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
  upsertStoryboard: vi.fn(),
  updateStoryboard: vi.fn(),
  deleteStoryboard: vi.fn(),
}));

import * as storyboardService from './storyboard-service.js';
import { createStoryboardRouter } from './storyboard-routes.js';

function routeHandlers(router: any, method: string, path: string): any[] {
  const layer = router.stack.find((candidate: any) =>
    candidate.route
    && candidate.route.path === path
    && candidate.route.methods[method.toLowerCase()]);
  return layer?.route?.stack.map((candidate: any) => candidate.handle) ?? [];
}

function makeResponse() {
  const response: any = { statusCode: 200, body: undefined };
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
    } as any);
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
    expect(response.body.data.version).toBe('trr-prompt-engine-v1');
    expect(response.body.data.inspector.styleProfileId).toBe('story-pencil');
    expect(response.body.data.modules.map((module: any) => module.id)).toEqual([
      'base-cinematography', 'project-style', 'character', 'wardrobe',
      'location', 'prop', 'shot', 'camera', 'lighting', 'continuity',
      'user-intent', 'model-rules',
    ]);
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
