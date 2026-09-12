import { describe, expect, it, vi } from 'vitest';
import type { AISuggestionService } from '../ai-suggestion-service.js';
import { setupStoryboardSkillRoutes } from './storyboard-skill-routes.js';

type Handler = (req: any, res: any) => Promise<void> | void;

function harness(options: { access?: boolean; tab?: boolean } = {}) {
  const routes = new Map<string, Handler>();
  const app = {
    get(path: string, handler: Handler) { routes.set(`GET ${path}`, handler); },
    post(path: string, handler: Handler) { routes.set(`POST ${path}`, handler); },
  };
  const suggestion = {
    id: 'suggestion-1',
    projectId: 'project-1',
    suggestionType: 'storyboard.skill-result',
    payload: {},
    sourceType: 'scene' as const,
    sourceId: 'scene-1',
    agentName: 'storyboard.plan-scene-coverage',
    modelVersion: 'local-rules-1.0.0',
    confidence: 0.9,
    status: 'pending' as const,
    createdAt: '2026-09-12T00:00:00Z',
    updatedAt: '2026-09-12T00:00:00Z',
  };
  const aiSuggestionService = {
    registerAgent: vi.fn(),
    registerApplier: vi.fn(),
    generate: vi.fn().mockResolvedValue([suggestion]),
    listPending: vi.fn().mockResolvedValue([suggestion]),
    get: vi.fn().mockResolvedValue(suggestion),
    accept: vi.fn().mockResolvedValue({ ...suggestion, status: 'accepted' }),
    reject: vi.fn().mockResolvedValue({ ...suggestion, status: 'rejected' }),
    apply: vi.fn(),
  } satisfies AISuggestionService;
  const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
  setupStoryboardSkillRoutes({
    app: app as any,
    pool: pool as any,
    requireUserSession: () => ({ userId: 'user-1' }),
    aiSuggestionService,
    canAccessProject: vi.fn().mockResolvedValue(options.access ?? true),
    meetsTabLevel: vi.fn().mockResolvedValue(options.tab ?? true),
  });
  const response = () => {
    const res: any = {
      statusCode: 200,
      body: undefined,
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.body = body; return this; },
    };
    return res;
  };
  return { routes, response, pool, aiSuggestionService, suggestion };
}

const validContext = {
  project: { id: 'project-1', title: 'Film' },
  scene: { id: 'scene-1', heading: 'INT. ROM — DAG', dialogue: [] },
  frames: [{ id: 'frame-1', shotNumber: '1A', description: 'En person går inn.' }],
  activeFrameId: 'frame-1',
};

describe('Storyboard skill routes', () => {
  it('fails closed when the caller lacks project access', async () => {
    const api = harness({ access: false });
    const res = api.response();
    await api.routes.get('GET /api/role-room/projects/:projectId/storyboard-skills/catalog')?.(
      { params: { projectId: 'project-1' } },
      res,
    );
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden' });
  });

  it('rejects context from a different project before persistence', async () => {
    const api = harness();
    const res = api.response();
    await api.routes.get('POST /api/role-room/projects/:projectId/storyboard-skills/:skillId/run')?.(
      {
        params: { projectId: 'project-1', skillId: 'plan_scene_coverage' },
        body: { context: { ...validContext, project: { id: 'project-2' } } },
      },
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'context_project_mismatch' });
    expect(api.aiSuggestionService.generate).not.toHaveBeenCalled();
  });

  it('supersedes only the same pending scene skill before generating', async () => {
    const api = harness();
    const res = api.response();
    await api.routes.get('POST /api/role-room/projects/:projectId/storyboard-skills/:skillId/run')?.(
      {
        params: { projectId: 'project-1', skillId: 'plan_scene_coverage' },
        body: { context: validContext },
      },
      res,
    );
    expect(res.statusCode).toBe(201);
    expect(api.pool.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'pending'"),
      ['project-1', 'scene-1', 'storyboard.plan-scene-coverage'],
    );
    expect(api.aiSuggestionService.generate).toHaveBeenCalledWith(
      'storyboard.plan-scene-coverage',
      expect.objectContaining({ projectId: 'project-1', sourceId: 'scene-1' }),
    );
  });

  it('requires an active frame for frame-scoped skills', async () => {
    const api = harness();
    const res = api.response();
    await api.routes.get('POST /api/role-room/projects/:projectId/storyboard-skills/:skillId/run')?.(
      {
        params: { projectId: 'project-1', skillId: 'design_shot_variants' },
        body: { context: { ...validContext, activeFrameId: undefined } },
      },
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'active_frame_required' });
  });

  it('does not review a suggestion belonging to another project', async () => {
    const api = harness();
    api.aiSuggestionService.get = vi.fn().mockResolvedValue({
      ...api.suggestion,
      projectId: 'project-2',
    });
    const res = api.response();
    await api.routes.get(
      'POST /api/role-room/projects/:projectId/storyboard-skills/suggestions/:suggestionId/accept',
    )?.(
      { params: { projectId: 'project-1', suggestionId: 'suggestion-1' }, body: {} },
      res,
    );
    expect(res.statusCode).toBe(404);
    expect(api.aiSuggestionService.accept).not.toHaveBeenCalled();
  });
});
