/**
 * role-room-auditions-routes.ts
 *
 * 5 endpoints for Audition-entiteten (migrasjon 140):
 *   - GET    /api/role-room/projects/:projectId/auditions       — liste alle
 *   - POST   /api/role-room/auditions                           — opprett
 *   - PATCH  /api/role-room/auditions/:id                       — oppdater
 *   - DELETE /api/role-room/auditions/:id                       — slett
 *   - POST   /api/role-room/auditions/:id/schedules/:scheduleId — knytt schedule
 *
 * Eksporterer `setupRoleRoomAuditionsRoutes(deps)`-factory som wires inn
 * i `backend/server/index.ts`:
 *
 *   import { setupRoleRoomAuditionsRoutes } from './role-room-auditions-routes';
 *   setupRoleRoomAuditionsRoutes({ app, pool, requireAdminSession });
 *
 * Auth-pattern: requireAdminSession returnerer 401 hvis ikke logget inn.
 * Tabell-tilgang: SELECT/INSERT/UPDATE/DELETE direkte mot auditions-tabell.
 *
 * Robusthet:
 *   - Validér project_id på alle endpoints — hindrer cross-project-leaks
 *   - Cascade-protected: schedules.audition_id settes til NULL ved DELETE
 *     (per migrasjon-141: ON DELETE SET NULL), så audition-sletting
 *     bryter ikke schedule-rader
 *   - Audit-felter (created_by/updated_by) populeres fra session
 */

import type express from 'express';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomAuditionsRoutesDeps {
  app: express.Express;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
}

interface AuditionRow {
  id: string;
  project_id: string;
  title: string;
  role_id: string | null;
  role_name: string | null;
  location_id: string | null;
  location_name: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  team_members: unknown;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

function serializeAudition(row: AuditionRow & {
  candidate_count?: number;
  completed_count?: number;
}): Record<string, unknown> {
  return {
    id: row.id,
    project_id: row.project_id,
    title: row.title,
    role_id: row.role_id ?? undefined,
    role_name: row.role_name ?? undefined,
    location_id: row.location_id ?? undefined,
    location_name: row.location_name ?? undefined,
    date: row.date,
    start_time: row.start_time ?? undefined,
    end_time: row.end_time ?? undefined,
    status: row.status ?? 'scheduled',
    team_members: Array.isArray(row.team_members) ? row.team_members : [],
    notes: row.notes ?? undefined,
    candidate_count: row.candidate_count ?? 0,
    completed_count: row.completed_count ?? 0,
    created_at: row.created_at?.toISOString?.() ?? row.created_at,
    updated_at: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

export function setupRoleRoomAuditionsRoutes(
  deps: RoleRoomAuditionsRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  // ── GET — liste alle auditions for prosjekt ──────────────────────
  app.get('/api/role-room/projects/:projectId/auditions', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;

    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) {
      return res.status(400).json({ success: false, error: 'projectId er påkrevd' });
    }

    try {
      // LEFT JOIN på schedules for aggregert candidate_count/completed_count
      const result = await pool.query<AuditionRow & {
        candidate_count: number;
        completed_count: number;
      }>(
        `SELECT a.*,
                COALESCE(COUNT(s.id), 0)::int AS candidate_count,
                COALESCE(SUM(CASE WHEN s.status IN ('confirmed', 'completed') THEN 1 ELSE 0 END), 0)::int AS completed_count
           FROM auditions a
           LEFT JOIN schedules s ON s.audition_id = a.id
          WHERE a.project_id = $1
          GROUP BY a.id
          ORDER BY a.date DESC, a.start_time DESC NULLS LAST`,
        [projectId],
      );
      return res.json({ success: true, auditions: result.rows.map(serializeAudition) });
    } catch (error) {
      console.error('[auditions] getAll failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Kunne ikke laste auditions',
        auditions: [],
      });
    }
  });

  // ── POST — opprett audition ──────────────────────────────────────
  app.post('/api/role-room/auditions', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const projectId = String(body.project_id ?? body.projectId ?? '').trim();
    const title = String(body.title ?? '').trim();
    const date = String(body.date ?? '').trim();

    if (!projectId || !title || !date) {
      return res.status(400).json({
        success: false,
        error: 'project_id, title og date er påkrevd',
      });
    }

    const id = `aud_${randomUUID()}`;
    const params = [
      id,
      projectId,
      title,
      body.role_id ?? null,
      body.role_name ?? null,
      body.location_id ?? null,
      body.location_name ?? null,
      date,
      body.start_time ?? null,
      body.end_time ?? null,
      body.status ?? 'scheduled',
      JSON.stringify(Array.isArray(body.team_members) ? body.team_members : []),
      body.notes ?? null,
      session.email,
    ];

    try {
      const result = await pool.query<AuditionRow>(
        `INSERT INTO auditions (
           id, project_id, title, role_id, role_name, location_id, location_name,
           date, start_time, end_time, status, team_members, notes,
           created_by, updated_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $14)
         RETURNING *`,
        params,
      );
      return res.json({ success: true, audition: serializeAudition(result.rows[0]) });
    } catch (error) {
      console.error('[auditions] create failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke opprette audition' });
    }
  });

  // ── PATCH — oppdater audition ────────────────────────────────────
  app.patch('/api/role-room/auditions/:id', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;

    const auditionId = String(req.params.id || '').trim();
    if (!auditionId) {
      return res.status(400).json({ success: false, error: 'audition-id er påkrevd' });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    // Whitelist editable felter — hindrer cross-project-update via project_id-bytte
    const allowed = [
      'title', 'role_id', 'role_name', 'location_id', 'location_name',
      'date', 'start_time', 'end_time', 'status', 'team_members', 'notes',
    ] as const;

    const sets: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (const field of allowed) {
      if (field in body) {
        const value = field === 'team_members'
          ? JSON.stringify(Array.isArray(body[field]) ? body[field] : [])
          : body[field];
        sets.push(`${field} = $${paramIdx}${field === 'team_members' ? '::jsonb' : ''}`);
        params.push(value);
        paramIdx += 1;
      }
    }

    if (sets.length === 0) {
      return res.status(400).json({ success: false, error: 'Ingen felt å oppdatere' });
    }

    sets.push(`updated_by = $${paramIdx}`);
    params.push(session.email);
    paramIdx += 1;
    params.push(auditionId);

    try {
      const result = await pool.query<AuditionRow>(
        `UPDATE auditions SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
        params,
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Audition ikke funnet' });
      }
      return res.json({ success: true, audition: serializeAudition(result.rows[0]) });
    } catch (error) {
      console.error('[auditions] update failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke oppdatere audition' });
    }
  });

  // ── DELETE — slett audition (schedules beholdes med audition_id=NULL) ──
  app.delete('/api/role-room/auditions/:id', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;

    const auditionId = String(req.params.id || '').trim();
    if (!auditionId) {
      return res.status(400).json({ success: false, error: 'audition-id er påkrevd' });
    }

    try {
      const result = await pool.query(
        'DELETE FROM auditions WHERE id = $1 RETURNING id',
        [auditionId],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: 'Audition ikke funnet' });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error('[auditions] delete failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke slette audition' });
    }
  });

  // ── POST — knytt en schedule til en audition ────────────────────
  app.post('/api/role-room/auditions/:id/schedules/:scheduleId', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;

    const auditionId = String(req.params.id || '').trim();
    const scheduleId = String(req.params.scheduleId || '').trim();
    if (!auditionId || !scheduleId) {
      return res.status(400).json({
        success: false,
        error: 'audition-id og schedule-id er påkrevd',
      });
    }

    try {
      // Validér at både audition og schedule eksisterer + tilhører samme prosjekt
      const validation = await pool.query<{ a_project: string; s_project: string }>(
        `SELECT a.project_id AS a_project, s.project_id AS s_project
           FROM auditions a, schedules s
          WHERE a.id = $1 AND s.id = $2`,
        [auditionId, scheduleId],
      );
      if (validation.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Audition eller schedule ikke funnet',
        });
      }
      if (validation.rows[0].a_project !== validation.rows[0].s_project) {
        return res.status(403).json({
          success: false,
          error: 'Audition og schedule må tilhøre samme prosjekt',
        });
      }

      await pool.query(
        'UPDATE schedules SET audition_id = $1 WHERE id = $2',
        [auditionId, scheduleId],
      );
      return res.json({ success: true });
    } catch (error) {
      console.error('[auditions] attachSchedule failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Kunne ikke knytte schedule til audition',
      });
    }
  });
}
