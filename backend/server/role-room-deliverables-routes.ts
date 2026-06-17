/**
 * role-room-deliverables-routes.ts
 *
 * REST-endepunkter for strukturerte leveranser (data-gap #2). Produsent-internt
 * (Bearer-token via activeSessions) + prosjekt-tilgangssjekk. Mønster speiler
 * role-room-editor-comments-routes.
 *
 *   GET    /api/role-room/projects/:projectId/deliverables
 *   POST   /api/role-room/projects/:projectId/deliverables
 *   PATCH  /api/role-room/projects/:projectId/deliverables/:id
 *   DELETE /api/role-room/projects/:projectId/deliverables/:id
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  listDeliverables,
  createDeliverable,
  updateDeliverable,
  deleteDeliverable,
} from './role-room-deliverables.js';

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { pool: Pool; activeSessions: Map<string, SessionData>; }

function getUserId(req: Request, activeSessions: Map<string, SessionData>): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const session = activeSessions.get(auth.slice(7).trim());
    if (session?.userId) return session.userId;
  }
  return null;
}

async function viewerCanAccessProject(pool: Pool, projectId: string, viewerId: string): Promise<boolean> {
  const { rows } = await pool.query<{ owns: boolean; member: boolean }>(
    `SELECT
       EXISTS(SELECT 1 FROM casting_projects WHERE id = $1 AND created_by = $2) AS owns,
       EXISTS(SELECT 1 FROM casting_user_roles
               WHERE project_id = $1 AND user_id = $2 AND deactivated_at IS NULL) AS member`,
    [projectId, viewerId],
  );
  return rows[0]?.owns === true || rows[0]?.member === true;
}

export function registerRoleRoomDeliverablesRoutes(app: Express, deps: Deps): void {
  const { pool, activeSessions } = deps;

  /** Felles auth + tilgang. Returnerer viewerId, eller sender feilrespons. */
  async function authorize(req: Request, res: Response): Promise<string | null> {
    const viewerId = getUserId(req, activeSessions);
    if (!viewerId) {
      res.status(401).json({ error: 'krever_innlogging' });
      return null;
    }
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) {
      res.status(400).json({ error: 'projectId mangler' });
      return null;
    }
    if (!(await viewerCanAccessProject(pool, projectId, viewerId))) {
      res.status(403).json({ error: 'ingen_tilgang' });
      return null;
    }
    return viewerId;
  }

  app.get('/api/role-room/projects/:projectId/deliverables', async (req, res) => {
    try {
      const viewerId = await authorize(req, res);
      if (!viewerId) return;
      const items = await listDeliverables(pool, String(req.params.projectId).trim());
      res.json({ success: true, items });
    } catch (error) {
      console.error('[deliverables] list failed', error);
      res.status(500).json({ error: 'Kunne ikke hente leveranser' });
    }
  });

  app.post('/api/role-room/projects/:projectId/deliverables', async (req, res) => {
    try {
      const viewerId = await authorize(req, res);
      if (!viewerId) return;
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const created = await createDeliverable(pool, {
        projectId: String(req.params.projectId).trim(),
        title: typeof body.title === 'string' ? body.title : '',
        format: typeof body.format === 'string' ? body.format : null,
        phase: typeof body.phase === 'string' ? body.phase : null,
        status: typeof body.status === 'string' ? body.status : null,
        dueAt: typeof body.dueAt === 'string' ? body.dueAt : null,
        assigneeUserId: typeof body.assigneeUserId === 'string' ? body.assigneeUserId : null,
        assigneeLabel: typeof body.assigneeLabel === 'string' ? body.assigneeLabel : null,
        waitingOn: typeof body.waitingOn === 'string' ? body.waitingOn : null,
        notes: typeof body.notes === 'string' ? body.notes : null,
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : null,
        createdByUserId: viewerId,
      });
      if (!created) {
        res.status(400).json({ error: 'title er påkrevd' });
        return;
      }
      res.json({ success: true, deliverable: created });
    } catch (error) {
      console.error('[deliverables] create failed', error);
      res.status(500).json({ error: 'Kunne ikke opprette leveranse' });
    }
  });

  app.patch('/api/role-room/projects/:projectId/deliverables/:id', async (req, res) => {
    try {
      const viewerId = await authorize(req, res);
      if (!viewerId) return;
      const id = String(req.params.id || '').trim();
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const updated = await updateDeliverable(pool, id, String(req.params.projectId).trim(), {
        title: typeof body.title === 'string' ? body.title : undefined,
        format: body.format === null || typeof body.format === 'string' ? (body.format as string | null) : undefined,
        phase: body.phase === null || typeof body.phase === 'string' ? (body.phase as string | null) : undefined,
        status: typeof body.status === 'string' ? body.status : undefined,
        dueAt: body.dueAt === null || typeof body.dueAt === 'string' ? (body.dueAt as string | null) : undefined,
        assigneeUserId: body.assigneeUserId === null || typeof body.assigneeUserId === 'string' ? (body.assigneeUserId as string | null) : undefined,
        assigneeLabel: body.assigneeLabel === null || typeof body.assigneeLabel === 'string' ? (body.assigneeLabel as string | null) : undefined,
        waitingOn: body.waitingOn === null || typeof body.waitingOn === 'string' ? (body.waitingOn as string | null) : undefined,
        notes: body.notes === null || typeof body.notes === 'string' ? (body.notes as string | null) : undefined,
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
        bumpVersion: body.bumpVersion === true,
      });
      if (!updated) {
        res.status(404).json({ error: 'Fant ikke leveransen' });
        return;
      }
      res.json({ success: true, deliverable: updated });
    } catch (error) {
      console.error('[deliverables] update failed', error);
      res.status(500).json({ error: 'Kunne ikke oppdatere leveranse' });
    }
  });

  app.delete('/api/role-room/projects/:projectId/deliverables/:id', async (req, res) => {
    try {
      const viewerId = await authorize(req, res);
      if (!viewerId) return;
      const ok = await deleteDeliverable(pool, String(req.params.id).trim(), String(req.params.projectId).trim());
      if (!ok) {
        res.status(404).json({ error: 'Fant ikke leveransen' });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      console.error('[deliverables] delete failed', error);
      res.status(500).json({ error: 'Kunne ikke slette leveranse' });
    }
  });
}
