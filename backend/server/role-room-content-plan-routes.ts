/**
 * role-room-content-plan-routes.ts
 *
 * Content Planner (mig 0322). Lett prosjekt-scopet innholds-plan med dato.
 * Chat-Action «Legg i Content Planner» skriver hit; rendres som kalender/agenda;
 * kan pushes til feed-planneren. Auth-mønster speiler meetings/messages
 * (Bearer via activeSessions + prosjekt-tilgang). Selv-helende ensure-backstop.
 *
 *   GET    /api/role-room/projects/:projectId/content-plan
 *   POST   /api/role-room/projects/:projectId/content-plan
 *   PATCH  /api/role-room/projects/:projectId/content-plan/:id
 *   DELETE /api/role-room/projects/:projectId/content-plan/:id
 */
import { randomUUID } from 'crypto';
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { upsertProducerProjectNotification } from './role-room-producer-notifications.js';

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { pool: Pool; activeSessions: Map<string, SessionData>; }

function getSession(req: Request, activeSessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const s = activeSessions.get(auth.slice(7).trim());
    if (s?.userId) return s;
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

const PLATFORMS = new Set(['instagram', 'tiktok', 'linkedin', 'youtube', 'facebook', 'other']);
const STATUSES = new Set(['draft', 'scheduled', 'published']);

function mapRow(row: Record<string, unknown>) {
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : null);
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    title: String(row.title ?? ''),
    caption: (row.caption as string | null) ?? null,
    platform: (row.platform as string | null) ?? null,
    scheduledAt: iso(row.scheduled_at),
    status: String(row.status ?? 'draft'),
    source: String(row.source ?? 'manual'),
    feedPlanPushed: row.feed_plan_pushed === true,
    notes: (row.notes as string | null) ?? null,
    createdByRole: (row.created_by_role as string | null) ?? null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function registerRoleRoomContentPlanRoutes(app: Express, deps: Deps): void {
  const { pool, activeSessions } = deps;

  let ensureReady: Promise<void> | null = null;
  function ensureTable(): Promise<void> {
    if (!ensureReady) {
      ensureReady = pool.query(`
        CREATE TABLE IF NOT EXISTS role_room_content_plan (
          id UUID PRIMARY KEY,
          project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL, caption TEXT, platform VARCHAR(40),
          scheduled_at TIMESTAMPTZ,
          status VARCHAR(24) NOT NULL DEFAULT 'draft',
          source VARCHAR(24) NOT NULL DEFAULT 'manual',
          feed_plan_pushed BOOLEAN NOT NULL DEFAULT FALSE, notes TEXT,
          created_by_user_id VARCHAR(255), created_by_role VARCHAR(80),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_rr_content_plan_project_date
          ON role_room_content_plan (project_id, scheduled_at NULLS LAST, created_at DESC);
      `).then(() => undefined).catch((e) => { ensureReady = null; throw e; });
    }
    return ensureReady;
  }

  async function authorize(req: Request, res: Response): Promise<SessionData | null> {
    const session = getSession(req, activeSessions);
    if (!session) { res.status(401).json({ error: 'krever_innlogging' }); return null; }
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) { res.status(400).json({ error: 'projectId mangler' }); return null; }
    try { await ensureTable(); } catch { /* fortsetter */ }
    if (!(await viewerCanAccessProject(pool, projectId, session.userId))) {
      res.status(403).json({ error: 'ingen_tilgang' }); return null;
    }
    return session;
  }

  app.get('/api/role-room/projects/:projectId/content-plan', async (req, res) => {
    try {
      const session = await authorize(req, res);
      if (!session) return;
      const result = await pool.query(
        `SELECT * FROM role_room_content_plan WHERE project_id = $1
          ORDER BY scheduled_at NULLS LAST, created_at DESC LIMIT 500`,
        [String(req.params.projectId).trim()],
      );
      res.json({ success: true, items: result.rows.map((r) => mapRow(r as Record<string, unknown>)) });
    } catch (error) {
      console.error('[content-plan] list failed', error);
      res.status(500).json({ error: 'Kunne ikke hente content-plan' });
    }
  });

  app.post('/api/role-room/projects/:projectId/content-plan', async (req, res) => {
    try {
      const session = await authorize(req, res);
      if (!session) return;
      const projectId = String(req.params.projectId).trim();
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : '';
      if (!title) { res.status(400).json({ error: 'title_påkrevd' }); return; }
      const platform = typeof body.platform === 'string' && PLATFORMS.has(body.platform) ? body.platform : null;
      const status = typeof body.status === 'string' && STATUSES.has(body.status) ? body.status : (body.scheduledAt ? 'scheduled' : 'draft');
      const id = randomUUID();
      const result = await pool.query(
        `INSERT INTO role_room_content_plan (
           id, project_id, title, caption, platform, scheduled_at, status, source, notes,
           created_by_user_id, created_by_role, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW(), NOW()) RETURNING *`,
        [id, projectId, title,
          typeof body.caption === 'string' ? body.caption : null,
          platform,
          typeof body.scheduledAt === 'string' ? body.scheduledAt : null,
          status,
          typeof body.source === 'string' && body.source === 'chat' ? 'chat' : 'manual',
          typeof body.notes === 'string' ? body.notes : null,
          session.userId, session.role ?? null],
      );
      // Varsle produsent-team om ny planlagt post (synlig i inbox).
      try {
        await upsertProducerProjectNotification(pool, {
          projectId, audience: 'producer_team', eventType: 'content_plan_added',
          title: `Ny post i content planner: ${title}`,
          message: typeof body.scheduledAt === 'string' ? `Planlagt ${new Date(body.scheduledAt).toLocaleString('nb-NO')}.` : 'Lagt i content planner.',
          linkedEntityType: 'content_plan', linkedEntityId: id,
          createdByUserId: session.userId, createdByRole: session.role ?? null,
          metadata: { inboxType: 'workspace' },
        });
      } catch { /* best-effort */ }
      res.status(201).json({ success: true, item: mapRow(result.rows[0] as Record<string, unknown>) });
    } catch (error) {
      console.error('[content-plan] create failed', error);
      res.status(500).json({ error: 'Kunne ikke opprette post' });
    }
  });

  app.patch('/api/role-room/projects/:projectId/content-plan/:id', async (req, res) => {
    try {
      const session = await authorize(req, res);
      if (!session) return;
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const sets: string[] = []; const vals: unknown[] = [];
      const push = (col: string, val: unknown) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
      if (typeof body.title === 'string' && body.title.trim()) push('title', body.title.trim());
      if ('caption' in body) push('caption', typeof body.caption === 'string' ? body.caption : null);
      if (typeof body.platform === 'string' && PLATFORMS.has(body.platform)) push('platform', body.platform);
      if ('scheduledAt' in body) push('scheduled_at', typeof body.scheduledAt === 'string' ? body.scheduledAt : null);
      if (typeof body.status === 'string' && STATUSES.has(body.status)) push('status', body.status);
      if (typeof body.feedPlanPushed === 'boolean') push('feed_plan_pushed', body.feedPlanPushed);
      if ('notes' in body) push('notes', typeof body.notes === 'string' ? body.notes : null);
      if (sets.length === 0) { res.status(400).json({ error: 'ingen_endringer' }); return; }
      sets.push('updated_at = NOW()');
      vals.push(String(req.params.id).trim()); vals.push(String(req.params.projectId).trim());
      const result = await pool.query(
        `UPDATE role_room_content_plan SET ${sets.join(', ')}
          WHERE id = $${vals.length - 1} AND project_id = $${vals.length} RETURNING *`,
        vals,
      );
      if (result.rowCount === 0) { res.status(404).json({ error: 'fant_ikke' }); return; }
      res.json({ success: true, item: mapRow(result.rows[0] as Record<string, unknown>) });
    } catch (error) {
      console.error('[content-plan] update failed', error);
      res.status(500).json({ error: 'Kunne ikke oppdatere post' });
    }
  });

  app.delete('/api/role-room/projects/:projectId/content-plan/:id', async (req, res) => {
    try {
      const session = await authorize(req, res);
      if (!session) return;
      const result = await pool.query(
        `DELETE FROM role_room_content_plan WHERE id = $1 AND project_id = $2 RETURNING id`,
        [String(req.params.id).trim(), String(req.params.projectId).trim()],
      );
      if (result.rowCount === 0) { res.status(404).json({ error: 'fant_ikke' }); return; }
      res.json({ success: true });
    } catch (error) {
      console.error('[content-plan] delete failed', error);
      res.status(500).json({ error: 'Kunne ikke slette post' });
    }
  });
}
