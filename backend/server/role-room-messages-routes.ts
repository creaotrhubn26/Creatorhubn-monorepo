/**
 * role-room-messages-routes.ts
 *
 * Klient-samtale (Meldinger-fanen i Creative Sync Workspace). Ekte meldingstråd
 * produsent↔klient (role_room_messages, mig 301). Aktivitets-feed flettes med
 * role_room_project_notifications på frontend. Auth-mønster speiler
 * role-room-meetings-routes (Bearer via activeSessions + prosjekt-tilgang).
 *
 *   GET    /api/role-room/projects/:projectId/messages
 *   POST   /api/role-room/projects/:projectId/messages
 *   PATCH  /api/role-room/projects/:projectId/messages/:id   (lukk forespørsel / rediger)
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

function isClientRole(role?: string): boolean {
  return String(role ?? '').trim().toLowerCase() === 'client_reviewer';
}

function mapRow(row: Record<string, unknown>) {
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : null);
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    authorUserId: (row.author_user_id as string | null) ?? null,
    authorRole: (row.author_role as string | null) ?? null,
    authorName: (row.author_name as string | null) ?? null,
    body: String(row.body ?? ''),
    kind: String(row.kind ?? 'message'),
    status: String(row.status ?? 'open'),
    replyToId: (row.reply_to_id as string | null) ?? null,
    linkedEntityType: (row.linked_entity_type as string | null) ?? null,
    linkedEntityId: (row.linked_entity_id as string | null) ?? null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function registerRoleRoomMessagesRoutes(app: Express, deps: Deps): void {
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

  app.get('/api/role-room/projects/:projectId/messages', async (req, res) => {
    try {
      const session = await authorize(req, res);
      if (!session) return;
      const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
      const result = await pool.query(
        `SELECT * FROM role_room_messages
          WHERE project_id = $1
          ORDER BY created_at ASC
          LIMIT $2`,
        [String(req.params.projectId).trim(), limit],
      );
      res.json({ success: true, items: result.rows.map((r) => mapRow(r as Record<string, unknown>)) });
    } catch (error) {
      console.error('[messages] list failed', error);
      res.status(500).json({ error: 'Kunne ikke hente meldinger' });
    }
  });

  app.post('/api/role-room/projects/:projectId/messages', async (req, res) => {
    try {
      const session = await authorize(req, res);
      if (!session) return;
      const projectId = String(req.params.projectId).trim();
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const text = typeof body.body === 'string' ? body.body.trim() : '';
      if (!text) { res.status(400).json({ error: 'tom_melding' }); return; }
      const kind = ['message', 'request', 'answer'].includes(String(body.kind)) ? String(body.kind) : 'message';

      const id = randomUUID();
      const result = await pool.query(
        `INSERT INTO role_room_messages (
           id, project_id, author_user_id, author_role, author_name, body, kind, status,
           reply_to_id, linked_entity_type, linked_entity_id, metadata, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb, NOW(), NOW())
         RETURNING *`,
        [
          id, projectId, session.userId, session.role ?? null,
          typeof body.authorName === 'string' ? body.authorName : null,
          text, kind, kind === 'request' ? 'open' : 'open',
          typeof body.replyToId === 'string' ? body.replyToId : null,
          typeof body.linkedEntityType === 'string' ? body.linkedEntityType : null,
          typeof body.linkedEntityId === 'string' ? body.linkedEntityId : null,
          JSON.stringify(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
        ],
      );

      // Varsle motparten (produsent↔klient).
      try {
        const fromClient = isClientRole(session.role);
        await upsertProducerProjectNotification(pool, {
          projectId,
          audience: fromClient ? 'producer_team' : 'client',
          eventType: kind === 'request' ? 'message_request' : 'message_sent',
          title: kind === 'request' ? 'Ny forespørsel i samtalen' : 'Ny melding',
          message: text.slice(0, 160),
          linkedEntityType: 'message', linkedEntityId: id,
          createdByUserId: session.userId, createdByRole: session.role ?? null,
          metadata: { inboxType: kind === 'request' ? 'request' : 'workspace' },
        });
      } catch (notifyError) {
        console.warn('[messages] varsel feilet', notifyError);
      }

      res.status(201).json({ success: true, message: mapRow(result.rows[0] as Record<string, unknown>) });
    } catch (error) {
      console.error('[messages] create failed', error);
      res.status(500).json({ error: 'Kunne ikke sende melding' });
    }
  });

  app.patch('/api/role-room/projects/:projectId/messages/:id', async (req, res) => {
    try {
      const session = await authorize(req, res);
      if (!session) return;
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const sets: string[] = [];
      const vals: unknown[] = [];
      const push = (col: string, val: unknown) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
      if (typeof body.status === 'string' && ['open', 'closed'].includes(body.status)) push('status', body.status);
      if (typeof body.body === 'string' && body.body.trim()) push('body', body.body.trim());
      if (sets.length === 0) { res.status(400).json({ error: 'ingen_endringer' }); return; }
      sets.push('updated_at = NOW()');
      vals.push(String(req.params.id).trim()); vals.push(String(req.params.projectId).trim());
      const result = await pool.query(
        `UPDATE role_room_messages SET ${sets.join(', ')}
          WHERE id = $${vals.length - 1} AND project_id = $${vals.length} RETURNING *`,
        vals,
      );
      if (result.rowCount === 0) { res.status(404).json({ error: 'fant_ikke_melding' }); return; }
      res.json({ success: true, message: mapRow(result.rows[0] as Record<string, unknown>) });
    } catch (error) {
      console.error('[messages] update failed', error);
      res.status(500).json({ error: 'Kunne ikke oppdatere melding' });
    }
  });
}
