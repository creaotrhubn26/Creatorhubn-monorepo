/**
 * role-room-meetings-routes.ts
 *
 * Møte-flyt i Creative Sync Workspace (Møter-fanen). Planlegg møte →
 * Google Meet-lenke (createGoogleMeetLink) + Calendar-event → kommende møter
 * (produsent + klient) → møtenotat. Egen modell (role_room_meetings, mig 300),
 * bevisst atskilt fra ucommittet parallell-arbeid. Auth-mønster speiler
 * role-room-deliverables-routes (Bearer via activeSessions + prosjekt-tilgang).
 *
 *   GET    /api/role-room/projects/:projectId/meetings
 *   POST   /api/role-room/projects/:projectId/meetings
 *   PATCH  /api/role-room/projects/:projectId/meetings/:id
 *   DELETE /api/role-room/projects/:projectId/meetings/:id
 */
import { randomUUID } from 'crypto';
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { createGoogleMeetLink } from './google-meet.js';
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

function isClientRole(role?: string): boolean {
  return String(role ?? '').trim().toLowerCase() === 'client_reviewer';
}

function mapRow(row: Record<string, unknown>) {
  const j = (v: unknown) => (Array.isArray(v) ? v : []);
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : null);
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    title: String(row.title ?? ''),
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    timeZone: String(row.time_zone ?? 'Europe/Oslo'),
    participants: j(row.participants),
    meetLink: (row.meet_link as string | null) ?? null,
    calendarEventId: (row.calendar_event_id as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    status: String(row.status ?? 'upcoming'),
    notes: (row.notes as string | null) ?? null,
    notesStatus: String(row.notes_status ?? 'pending'),
    agenda: j(row.agenda),
    actionItems: j(row.action_items),
    clientVisible: row.client_visible !== false,
    createdByRole: (row.created_by_role as string | null) ?? null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function registerRoleRoomMeetingsRoutes(app: Express, deps: Deps): void {
  const { pool, activeSessions } = deps;

  async function authorize(req: Request, res: Response): Promise<SessionData | null> {
    const session = getSession(req, activeSessions);
    if (!session) { res.status(401).json({ error: 'krever_innlogging' }); return null; }
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) { res.status(400).json({ error: 'projectId mangler' }); return null; }
    if (!(await viewerCanAccessProject(pool, projectId, session.userId))) {
      res.status(403).json({ error: 'ingen_tilgang' }); return null;
    }
    return session;
  }

  app.get('/api/role-room/projects/:projectId/meetings', async (req, res) => {
    try {
      const session = await authorize(req, res);
      if (!session) return;
      const projectId = String(req.params.projectId).trim();
      const result = await pool.query(
        `SELECT * FROM role_room_meetings
          WHERE project_id = $1 ${isClientRole(session.role) ? 'AND client_visible = TRUE' : ''}
          ORDER BY starts_at DESC NULLS LAST, created_at DESC`,
        [projectId],
      );
      res.json({ success: true, items: result.rows.map((r) => mapRow(r as Record<string, unknown>)) });
    } catch (error) {
      console.error('[meetings] list failed', error);
      res.status(500).json({ error: 'Kunne ikke hente møter' });
    }
  });

  app.post('/api/role-room/projects/:projectId/meetings', async (req, res) => {
    try {
      const session = await authorize(req, res);
      if (!session) return;
      const projectId = String(req.params.projectId).trim();
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Møte';
      const startsAt = typeof body.startsAt === 'string' ? body.startsAt : null;
      const endsAt = typeof body.endsAt === 'string' ? body.endsAt : null;
      const participants = Array.isArray(body.participants) ? body.participants : [];
      const timeZone = typeof body.timeZone === 'string' && body.timeZone.trim() ? body.timeZone.trim() : 'Europe/Oslo';

      // Generér Google Meet-lenke + Calendar-event om bedt om (og om Google er tilkoblet).
      let meetLink: string | null = typeof body.meetLink === 'string' ? body.meetLink : null;
      let calendarEventId: string | null = null;
      if (body.generateMeet === true) {
        try {
          const meet = await createGoogleMeetLink(
            pool,
            {
              title,
              startDateTime: startsAt,
              endDateTime: endsAt,
              participants,
              projectId,
              projectName: typeof body.projectName === 'string' ? body.projectName : null,
              timeZone,
            },
            session.userId,
            { preferredOauthApps: ['role_room', 'creatorhub'] },
          );
          if (meet?.success) { meetLink = meet.meetLink; calendarEventId = meet.calendarEventId; }
        } catch (meetError) {
          console.warn('[meetings] Google Meet-generering feilet (lagrer møte uten lenke)', meetError);
        }
      }

      const id = randomUUID();
      const result = await pool.query(
        `INSERT INTO role_room_meetings (
           id, project_id, title, starts_at, ends_at, time_zone, participants,
           meet_link, calendar_event_id, location, status, agenda, action_items,
           client_visible, created_by_user_id, created_by_role, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,'upcoming',$11::jsonb,$12::jsonb,$13,$14,$15, NOW(), NOW())
         RETURNING *`,
        [
          id, projectId, title, startsAt, endsAt, timeZone, JSON.stringify(participants),
          meetLink, calendarEventId, typeof body.location === 'string' ? body.location : null,
          JSON.stringify(Array.isArray(body.agenda) ? body.agenda : []),
          JSON.stringify(Array.isArray(body.actionItems) ? body.actionItems : []),
          body.clientVisible !== false, session.userId, session.role ?? null,
        ],
      );

      // Varsle motparten: produsent planlegger → klient varsles, og omvendt.
      try {
        const fromClient = isClientRole(session.role);
        await upsertProducerProjectNotification(pool, {
          projectId,
          audience: fromClient ? 'producer_team' : 'client',
          eventType: 'meeting_scheduled',
          title: `Nytt møte: ${title}`,
          message: startsAt ? `Planlagt ${new Date(startsAt).toLocaleString('nb-NO')}.` : 'Et møte er planlagt.',
          linkedEntityType: 'meeting', linkedEntityId: id,
          createdByUserId: session.userId, createdByRole: session.role ?? null,
          metadata: { inboxType: 'workspace', meetLink },
        });
      } catch (notifyError) {
        console.warn('[meetings] varsel feilet', notifyError);
      }

      res.status(201).json({ success: true, meeting: mapRow(result.rows[0] as Record<string, unknown>) });
    } catch (error) {
      console.error('[meetings] create failed', error);
      res.status(500).json({ error: 'Kunne ikke opprette møte' });
    }
  });

  app.patch('/api/role-room/projects/:projectId/meetings/:id', async (req, res) => {
    try {
      const session = await authorize(req, res);
      if (!session) return;
      const projectId = String(req.params.projectId).trim();
      const id = String(req.params.id).trim();
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;

      const sets: string[] = [];
      const vals: unknown[] = [];
      const push = (col: string, val: unknown, cast = '') => { vals.push(val); sets.push(`${col} = $${vals.length}${cast}`); };
      if (typeof body.title === 'string') push('title', body.title.trim());
      if ('startsAt' in body) push('starts_at', typeof body.startsAt === 'string' ? body.startsAt : null);
      if ('endsAt' in body) push('ends_at', typeof body.endsAt === 'string' ? body.endsAt : null);
      if (typeof body.status === 'string') push('status', body.status.trim());
      if ('notes' in body) push('notes', typeof body.notes === 'string' ? body.notes : null);
      if (typeof body.notesStatus === 'string') push('notes_status', body.notesStatus.trim());
      if ('meetLink' in body) push('meet_link', typeof body.meetLink === 'string' ? body.meetLink : null);
      if (Array.isArray(body.participants)) push('participants', JSON.stringify(body.participants), '::jsonb');
      if (Array.isArray(body.agenda)) push('agenda', JSON.stringify(body.agenda), '::jsonb');
      if (Array.isArray(body.actionItems)) push('action_items', JSON.stringify(body.actionItems), '::jsonb');
      if (typeof body.clientVisible === 'boolean') push('client_visible', body.clientVisible);
      if (sets.length === 0) { res.status(400).json({ error: 'ingen_endringer' }); return; }
      sets.push('updated_at = NOW()');
      vals.push(id); vals.push(projectId);
      const result = await pool.query(
        `UPDATE role_room_meetings SET ${sets.join(', ')}
          WHERE id = $${vals.length - 1} AND project_id = $${vals.length} RETURNING *`,
        vals,
      );
      if (result.rowCount === 0) { res.status(404).json({ error: 'fant_ikke_møte' }); return; }
      res.json({ success: true, meeting: mapRow(result.rows[0] as Record<string, unknown>) });
    } catch (error) {
      console.error('[meetings] update failed', error);
      res.status(500).json({ error: 'Kunne ikke oppdatere møte' });
    }
  });

  app.delete('/api/role-room/projects/:projectId/meetings/:id', async (req, res) => {
    try {
      const session = await authorize(req, res);
      if (!session) return;
      const result = await pool.query(
        `DELETE FROM role_room_meetings WHERE id = $1 AND project_id = $2 RETURNING id`,
        [String(req.params.id).trim(), String(req.params.projectId).trim()],
      );
      if (result.rowCount === 0) { res.status(404).json({ error: 'fant_ikke_møte' }); return; }
      res.json({ success: true });
    } catch (error) {
      console.error('[meetings] delete failed', error);
      res.status(500).json({ error: 'Kunne ikke slette møte' });
    }
  });
}
