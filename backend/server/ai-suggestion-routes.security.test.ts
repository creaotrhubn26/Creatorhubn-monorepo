import { describe, expect, it, vi } from 'vitest';
import type { AISuggestionService } from './ai-suggestion-service.js';
import { setupAISuggestionRoutes } from './ai-suggestion-routes.js';

type Handler = (req: any, res: any) => Promise<void> | void;

function createHarness(options: { authenticated?: boolean; access?: boolean } = {}) {
  const routes = new Map<string, Handler>();
  const app = {
    get(path: string, handler: Handler) { routes.set(`GET ${path}`, handler); },
    post(path: string, handler: Handler) { routes.set(`POST ${path}`, handler); },
  };
  const suggestion = {
    id: 'suggestion-1',
    projectId: 'project-1',
    sourceType: 'scene' as const,
    sourceId: 'scene-1',
    agentName: 'storyboard.plan-scene-coverage',
    modelVersion: 'local-rules-1.0.0',
    suggestionType: 'storyboard.skill-result',
    payload: {},
    confidence: 0.8,
    status: 'pending' as const,
    createdAt: '2026-09-12T00:00:00Z',
    updatedAt: '2026-09-12T00:00:00Z',
  };
  const service = {
    registerAgent: vi.fn(),
    registerApplier: vi.fn(),
    generate: vi.fn().mockResolvedValue([suggestion]),
    listPending: vi.fn().mockResolvedValue([suggestion]),
    get: vi.fn().mockResolvedValue(suggestion),
    accept: vi.fn().mockResolvedValue({ ...suggestion, status: 'accepted' }),
    reject: vi.fn().mockResolvedValue({ ...suggestion, status: 'rejected' }),
    apply: vi.fn(),
  } satisfies AISuggestionService;
  const response = () => ({
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  });
  const requireUserSession = vi.fn((_req: any, res: any) => {
    if (options.authenticated === false) {
      res.status(401).json({ error: 'unauthenticated' });
      return null;
    }
    return { userId: 'session-user' };
  });
  const canAccessProject = vi.fn().mockResolvedValue(options.access ?? true);
  setupAISuggestionRoutes({
    app: app as any,
    pool: { query: vi.fn() } as any,
    requireUserSession,
    aiSuggestionService: service,
    canAccessProject,
  });
  return { routes, response, service, requireUserSession, canAccessProject };
}

describe('generic AI suggestion route security', () => {
  it('authenticates before looking up a suggestion for review', async () => {
    const api = createHarness({ authenticated: false });
    const res = api.response();

    await api.routes.get('POST /api/role-room/ai-suggestions/:id/accept')?.(
      { params: { id: 'suggestion-1' }, body: {} },
      res,
    );

    expect(res.statusCode).toBe(401);
    expect(api.service.get).not.toHaveBeenCalled();
    expect(api.service.accept).not.toHaveBeenCalled();
  });

  it('does not list project suggestions without membership', async () => {
    const api = createHarness({ access: false });
    const res = api.response();

    await api.routes.get('GET /api/role-room/projects/:projectId/ai-suggestions')?.(
      { params: { projectId: 'project-1' }, query: {} },
      res,
    );

    expect(res.statusCode).toBe(403);
    expect(api.service.listPending).not.toHaveBeenCalled();
  });

  it('does not allow an authenticated user to review another project', async () => {
    const api = createHarness({ access: false });
    const res = api.response();

    await api.routes.get('POST /api/role-room/ai-suggestions/:id/reject')?.(
      { params: { id: 'suggestion-1' }, body: {} },
      res,
    );

    expect(res.statusCode).toBe(403);
    expect(api.service.reject).not.toHaveBeenCalled();
  });

  it('uses the verified session identity when generating', async () => {
    const api = createHarness();
    const res = api.response();

    await api.routes.get(
      'POST /api/role-room/projects/:projectId/ai-suggestions/generate',
    )?.(
      {
        params: { projectId: 'project-1' },
        headers: { 'x-user-id': 'spoofed-user' },
        body: {
          agentName: 'storyboard.plan-scene-coverage',
          sourceType: 'scene',
          sourceId: 'scene-1',
          payload: {},
        },
      },
      res,
    );

    expect(res.statusCode).toBe(201);
    expect(api.service.generate).toHaveBeenCalledWith(
      'storyboard.plan-scene-coverage',
      expect.objectContaining({ userId: 'session-user' }),
    );
  });
});
