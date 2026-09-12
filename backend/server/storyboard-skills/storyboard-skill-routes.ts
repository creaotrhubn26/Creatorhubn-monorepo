import type express from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import {
  isStoryboardSkillId,
  storyboardSkillDefinition,
  type StoryboardSkillId,
} from '../../../frontend/shared/storyboard-skills.js';
import type {
  AISuggestionService,
  AISuggestionStatus,
} from '../ai-suggestion-service.js';
import { canAccessRoleRoomProject } from '../role-room-projects-routes.js';
import { viewerMeetsTabLevel } from '../role-room-tab-access.js';
import {
  storyboardSkillAgentName,
  storyboardSkillCatalog,
  storyboardSkillRunBodySchema,
} from './storyboard-skills.js';

interface UserSession {
  userId: string;
  email?: string;
  name?: string;
  role?: string;
}

export interface StoryboardSkillRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => UserSession | null;
  aiSuggestionService: AISuggestionService;
  canAccessProject?: typeof canAccessRoleRoomProject;
  meetsTabLevel?: typeof viewerMeetsTabLevel;
}

const reviewBodySchema = z.object({
  note: z.string().trim().max(1_000).nullable().optional(),
}).strict();

function statusFromError(error: unknown): number {
  if (!(error instanceof Error)) return 500;
  if (error.message.startsWith('Suggestion not found')) return 404;
  if (error.message.startsWith('Cannot accept suggestion in status')) return 409;
  if (error.message.startsWith('Cannot reject suggestion in status')) return 409;
  if (error.message.startsWith('Unknown agent')) return 400;
  return 500;
}

export function setupStoryboardSkillRoutes(deps: StoryboardSkillRoutesDeps): void {
  const {
    app,
    pool,
    requireUserSession,
    aiSuggestionService,
    canAccessProject = canAccessRoleRoomProject,
    meetsTabLevel = viewerMeetsTabLevel,
  } = deps;

  async function requireAccess(
    req: any,
    res: any,
    need: 'view' | 'manage',
  ): Promise<UserSession | null> {
    const session = requireUserSession(req, res);
    if (!session) return null;
    const projectId = String(req.params.projectId ?? '').trim();
    const userId = String(session.userId ?? '').trim();
    if (!projectId || !userId) {
      res.status(400).json({ error: 'invalid_request' });
      return null;
    }
    if (!(await canAccessProject(pool, userId, projectId))) {
      res.status(403).json({ error: 'forbidden' });
      return null;
    }
    if (!(await meetsTabLevel(pool, projectId, userId, 'storyboard', need))) {
      res.status(403).json({ error: 'forbidden_tab' });
      return null;
    }
    return session;
  }

  app.get(
    '/api/role-room/projects/:projectId/storyboard-skills/catalog',
    async (req, res) => {
      if (!(await requireAccess(req, res, 'view'))) return;
      res.json({
        success: true,
        data: storyboardSkillCatalog(),
        contractVersion: 'storyboard-skill-result-v1',
      });
    },
  );

  app.get(
    '/api/role-room/projects/:projectId/storyboard-skills/suggestions',
    async (req, res) => {
      if (!(await requireAccess(req, res, 'view'))) return;
      const projectId = String(req.params.projectId);
      const status = typeof req.query.status === 'string'
        ? req.query.status.split(',').map((entry: string) => entry.trim())
        : ['pending'];
      const validStatuses: AISuggestionStatus[] = [
        'pending', 'accepted', 'rejected', 'superseded', 'applied',
      ];
      const allowedStatuses = status.filter(
        (entry: string): entry is AISuggestionStatus =>
          validStatuses.includes(entry as AISuggestionStatus),
      );
      try {
        const suggestions = await aiSuggestionService.listPending(projectId, {
          suggestionType: 'storyboard.skill-result',
          status: allowedStatuses.length ? allowedStatuses : ['pending'],
          minConfidence: 0,
        });
        res.json({ success: true, data: suggestions });
      } catch (error) {
        console.error('[storyboard-skills] list failed:', error);
        res.status(500).json({ error: 'storyboard_skills_list_failed' });
      }
    },
  );

  app.post(
    '/api/role-room/projects/:projectId/storyboard-skills/:skillId/run',
    async (req, res) => {
      const session = await requireAccess(req, res, 'view');
      if (!session) return;
      const projectId = String(req.params.projectId);
      const skillIdValue = req.params.skillId;
      if (!isStoryboardSkillId(skillIdValue)) {
        res.status(404).json({ error: 'unknown_storyboard_skill' });
        return;
      }
      const skillId: StoryboardSkillId = skillIdValue;
      const parsed = storyboardSkillRunBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'invalid_request',
          details: parsed.error.format(),
        });
        return;
      }
      const context = parsed.data.context;
      if (context.project.id !== projectId) {
        res.status(400).json({ error: 'context_project_mismatch' });
        return;
      }
      const definition = storyboardSkillDefinition(skillId);
      if (
        definition.scope === 'frame' &&
        (!context.activeFrameId || !context.frames.some((frame) => frame.id === context.activeFrameId))
      ) {
        res.status(400).json({ error: 'active_frame_required' });
        return;
      }

      const agentName = storyboardSkillAgentName(skillId);
      try {
        // A newer result from the same versioned skill and scene supersedes an
        // unreviewed one. Reviewed suggestions remain immutable audit history.
        await pool.query(
          `UPDATE casting_ai_suggestions
             SET status = 'superseded'
           WHERE project_id = $1
             AND source_type = 'scene'
             AND source_id = $2
             AND agent_name = $3
             AND status = 'pending'`,
          [projectId, context.scene.id, agentName],
        );
        const suggestions = await aiSuggestionService.generate(agentName, {
          projectId,
          userId: session.userId,
          sourceType: 'scene',
          sourceId: context.scene.id,
          payload: context,
        });
        res.status(201).json({ success: true, data: suggestions });
      } catch (error) {
        console.error('[storyboard-skills] run failed:', error);
        res.status(statusFromError(error)).json({
          error: statusFromError(error) === 500
            ? 'storyboard_skill_run_failed'
            : (error as Error).message,
        });
      }
    },
  );

  for (const action of ['accept', 'reject'] as const) {
    app.post(
      `/api/role-room/projects/:projectId/storyboard-skills/suggestions/:suggestionId/${action}`,
      async (req, res) => {
        const session = await requireAccess(req, res, 'manage');
        if (!session) return;
        const parsed = reviewBodySchema.safeParse(req.body ?? {});
        if (!parsed.success) {
          res.status(400).json({ error: 'invalid_request' });
          return;
        }
        try {
          const suggestion = await aiSuggestionService.get(String(req.params.suggestionId));
          if (
            !suggestion ||
            suggestion.projectId !== String(req.params.projectId) ||
            suggestion.suggestionType !== 'storyboard.skill-result' ||
            !suggestion.agentName.startsWith('storyboard.')
          ) {
            res.status(404).json({ error: 'suggestion_not_found' });
            return;
          }
          const reviewed = action === 'accept'
            ? await aiSuggestionService.accept(suggestion.id, session.userId, parsed.data.note ?? undefined)
            : await aiSuggestionService.reject(suggestion.id, session.userId, parsed.data.note ?? undefined);
          res.json({ success: true, data: reviewed });
        } catch (error) {
          console.error(`[storyboard-skills] ${action} failed:`, error);
          res.status(statusFromError(error)).json({
            error: statusFromError(error) === 500
              ? `storyboard_skill_${action}_failed`
              : (error as Error).message,
          });
        }
      },
    );
  }
}
