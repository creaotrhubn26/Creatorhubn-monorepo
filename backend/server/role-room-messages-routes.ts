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
    visibility: String(row.visibility ?? 'shared'),
    replyToId: (row.reply_to_id as string | null) ?? null,
    linkedEntityType: (row.linked_entity_type as string | null) ?? null,
    linkedEntityId: (row.linked_entity_id as string | null) ?? null,
    metadata: (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function registerRoleRoomMessagesRoutes(app: Express, deps: Deps): void {
  const { pool, activeSessions } = deps;

  // Selv-helende backstop: garanterer tabell + visibility-kolonnen selv om en
  // migrasjon (fire-and-forget) ikke har truffet. Kjøres én gang per prosess.
  let ensureReady: Promise<void> | null = null;
  function ensureMessagesTable(): Promise<void> {
    if (!ensureReady) {
      ensureReady = pool.query(`
        CREATE TABLE IF NOT EXISTS role_room_messages (
          id UUID PRIMARY KEY,
          project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
          author_user_id VARCHAR(255), author_role VARCHAR(80), author_name VARCHAR(255),
          body TEXT NOT NULL,
          kind VARCHAR(32) NOT NULL DEFAULT 'message',
          status VARCHAR(24) NOT NULL DEFAULT 'open',
          reply_to_id UUID, linked_entity_type VARCHAR(100), linked_entity_id VARCHAR(255),
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE role_room_messages ADD COLUMN IF NOT EXISTS visibility VARCHAR(16) NOT NULL DEFAULT 'shared';
        CREATE INDEX IF NOT EXISTS idx_rr_messages_project_created ON role_room_messages (project_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_rr_messages_project_visibility ON role_room_messages (project_id, visibility, created_at DESC);
      `).then(() => undefined).catch((e) => { ensureReady = null; throw e; });
    }
    return ensureReady;
  }

  async function authorize(req: Request, res: Response): Promise<SessionData | null> {
    const session = getSession(req, activeSessions);
    if (!session) { res.status(401).json({ error: 'krever_innlogging' }); return null; }
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) { res.status(400).json({ error: 'projectId mangler' }); return null; }
    try { await ensureMessagesTable(); } catch { /* fortsetter — feiler i query om noe er galt */ }
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
      // «Rom & roller»: klient ser KUN delte meldinger; produsent-team ser alt.
      const clientOnlyShared = isClientRole(session.role);
      const result = await pool.query(
        `SELECT * FROM role_room_messages
          WHERE project_id = $1
            ${clientOnlyShared ? "AND visibility = 'shared'" : ''}
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
      // Synlighet: klient kan aldri sende internt. Internt = kun produsent-team.
      const fromClient = isClientRole(session.role);
      const visibility = (!fromClient && body.visibility === 'internal') ? 'internal' : 'shared';

      const id = randomUUID();
      const result = await pool.query(
        `INSERT INTO role_room_messages (
           id, project_id, author_user_id, author_role, author_name, body, kind, status, visibility,
           reply_to_id, linked_entity_type, linked_entity_id, metadata, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb, NOW(), NOW())
         RETURNING *`,
        [
          id, projectId, session.userId, session.role ?? null,
          typeof body.authorName === 'string' ? body.authorName : null,
          text, kind, kind === 'request' ? 'open' : 'open', visibility,
          typeof body.replyToId === 'string' ? body.replyToId : null,
          typeof body.linkedEntityType === 'string' ? body.linkedEntityType : null,
          typeof body.linkedEntityId === 'string' ? body.linkedEntityId : null,
          JSON.stringify(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
        ],
      );

      // Varsle motparten — MEN aldri klienten om interne meldinger.
      try {
        if (visibility === 'internal') {
          await upsertProducerProjectNotification(pool, {
            projectId, audience: 'producer_team',
            eventType: 'message_internal',
            title: 'Ny intern melding', message: text.slice(0, 160),
            linkedEntityType: 'message', linkedEntityId: id,
            createdByUserId: session.userId, createdByRole: session.role ?? null,
            metadata: { inboxType: 'workspace' },
          });
        } else {
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
        }
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

  // AI-utkast / oppsummering: leser de siste meldingene og kaller Claude for å
  // (a) foreslå et profesjonelt svar, eller (b) oppsummere «hva venter på meg».
  // Returnerer kun tekst — frontend fyller komposeren (ingenting sendes auto).
  app.post('/api/role-room/projects/:projectId/messages/ai', async (req, res) => {
    try {
      const session = await authorize(req, res);
      if (!session) return;
      const projectId = String(req.params.projectId).trim();
      const mode = String((req.body ?? {}).mode) === 'summary' ? 'summary' : 'draft';
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) { res.status(503).json({ error: 'AI er ikke tilgjengelig (mangler nøkkel).' }); return; }

      const rows = await pool.query(
        `SELECT author_role, kind, body, created_at FROM role_room_messages
          WHERE project_id = $1 ORDER BY created_at DESC LIMIT 40`,
        [projectId],
      );
      const transcript = rows.rows.reverse().map((r: Record<string, unknown>) => {
        const who = String(r.author_role ?? '') === 'client_reviewer' ? 'Klient' : 'Produsent';
        const tag = String(r.kind ?? '') === 'request' ? ' [forespørsel]' : '';
        return `${who}${tag}: ${String(r.body ?? '')}`;
      }).join('\n');

      const system = mode === 'summary'
        ? 'Du er assistent for en innholdsprodusent i The Role Room. Oppsummer samtalen kort på norsk: hva er status, og hva venter på produsenten nå (punktliste med konkrete neste steg). Maks 8 linjer.'
        : 'Du er assistent for en innholdsprodusent i The Role Room. Foreslå ÉT profesjonelt, vennlig norsk svar til klienten basert på samtalen. Kun selve svarteksten, ingen forklaring.';

      let text = '';
      try {
        const mod: any = await import('@anthropic-ai/sdk');
        const AnthropicCtor = mod.default ?? mod.Anthropic;
        const client: any = new AnthropicCtor({ apiKey, maxRetries: 1, timeout: 30_000 });
        const response = await client.messages.create({
          model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || 'claude-sonnet-4-6',
          max_tokens: 700,
          system,
          messages: [{ role: 'user', content: `Samtale så langt:\n${transcript || '(tom)'}\n\n${mode === 'summary' ? 'Oppsummer.' : 'Foreslå svar.'}` }],
        });
        text = (response.content ?? []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('\n').trim();
      } catch (aiErr) {
        console.error('[messages] AI-kall feilet', aiErr);
        res.status(502).json({ error: 'AI-kallet feilet. Prøv igjen.' });
        return;
      }
      res.json({ success: true, text });
    } catch (error) {
      console.error('[messages] ai failed', error);
      res.status(500).json({ error: 'Kunne ikke generere AI-tekst' });
    }
  });
}
