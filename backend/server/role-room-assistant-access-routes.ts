/**
 * role-room-assistant-access-routes.ts
 *
 * Assistent-scoping (mig 311). Produsenten inviterer assistenter til ett
 * prosjekt med BEGRENSET tilgang (least-privilege). Rolle-presets setter
 * fornuftige områdeflagg; sensitive områder (economy/client_info/internal_chat)
 * er ALDRI på i en preset og krever eksplisitt valg.
 *
 *   GET    /api/role-room/projects/:projectId/assistants
 *   POST   /api/role-room/projects/:projectId/assistants
 *   PATCH  /api/role-room/projects/:projectId/assistants/:id
 *   DELETE /api/role-room/projects/:projectId/assistants/:id   (revoker)
 *
 * Selv-helende ensure-backstop (jf. fire-and-forget-lærdommen).
 */
import { randomUUID } from 'crypto';
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { pool: Pool; activeSessions: Map<string, SessionData>; }

export const ASSISTANT_AREAS = [
  'deliverables', 'materials', 'plan', 'meetings', 'brief', 'economy', 'client_info', 'internal_chat',
] as const;
export const SENSITIVE_AREAS = new Set(['economy', 'client_info', 'internal_chat']);

// Presets gir least-privilege defaults. Sensitive områder ALLTID false her.
const PRESETS: Record<string, Record<string, boolean>> = {
  editor: { deliverables: true, materials: true, plan: true, meetings: true, brief: true },
  photographer: { deliverables: true, materials: true, plan: true, meetings: true, brief: false },
  coordinator: { deliverables: true, materials: true, plan: true, meetings: true, brief: true },
  custom: {},
};

function defaultAreasForPreset(preset: string): Record<string, boolean> {
  const base: Record<string, boolean> = {};
  for (const a of ASSISTANT_AREAS) base[a] = false; // least-privilege: alt av
  const p = PRESETS[preset] ?? PRESETS.editor;
  for (const [k, v] of Object.entries(p)) if (!SENSITIVE_AREAS.has(k)) base[k] = v;
  return base;
}

// Saniter innkommende areas: kun kjente nøkler, boolean.
function sanitizeAreas(input: unknown, base: Record<string, boolean>): Record<string, boolean> {
  const out = { ...base };
  if (input && typeof input === 'object') {
    for (const a of ASSISTANT_AREAS) {
      const v = (input as Record<string, unknown>)[a];
      if (typeof v === 'boolean') out[a] = v;
    }
  }
  return out;
}

function getSession(req: Request, activeSessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const s = activeSessions.get(auth.slice(7).trim());
    if (s?.userId) return s;
  }
  return null;
}

// Produsent-only: prosjekt-eier eller produsent-rolle i casting_user_roles.
async function viewerIsProducer(pool: Pool, projectId: string, userId: string): Promise<boolean> {
  const { rows } = await pool.query<{ ok: boolean }>(
    `SELECT (
       EXISTS(SELECT 1 FROM casting_projects WHERE id = $1 AND created_by = $2)
       OR EXISTS(SELECT 1 FROM casting_user_roles
                  WHERE project_id = $1 AND user_id = $2 AND deactivated_at IS NULL
                    AND role IN ('director','producer','production_manager','content_producer'))
     ) AS ok`,
    [projectId, userId],
  );
  return rows[0]?.ok === true;
}

function mapRow(row: Record<string, unknown>) {
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : null);
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    assistantUserId: (row.assistant_user_id as string | null) ?? null,
    assistantEmail: String(row.assistant_email ?? ''),
    assistantName: (row.assistant_name as string | null) ?? null,
    rolePreset: String(row.role_preset ?? 'editor'),
    areas: (row.areas && typeof row.areas === 'object' ? row.areas : {}) as Record<string, boolean>,
    status: String(row.status ?? 'invited'),
    inviteToken: (row.invite_token as string | null) ?? null,
    createdAt: iso(row.created_at),
    revokedAt: iso(row.revoked_at),
  };
}

export function registerRoleRoomAssistantAccessRoutes(app: Express, deps: Deps): void {
  const { pool, activeSessions } = deps;

  let ensureReady: Promise<void> | null = null;
  function ensureTable(): Promise<void> {
    if (!ensureReady) {
      ensureReady = pool.query(`
        CREATE TABLE IF NOT EXISTS role_room_assistant_access (
          id UUID PRIMARY KEY,
          project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
          assistant_user_id VARCHAR(255), assistant_email VARCHAR(255) NOT NULL, assistant_name VARCHAR(255),
          role_preset VARCHAR(40) NOT NULL DEFAULT 'editor',
          areas JSONB NOT NULL DEFAULT '{}'::jsonb,
          status VARCHAR(24) NOT NULL DEFAULT 'invited',
          invite_token VARCHAR(64), invited_by_user_id VARCHAR(255),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), revoked_at TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_assistant_access_project_email ON role_room_assistant_access (project_id, lower(assistant_email));
      `).then(() => undefined).catch((e) => { ensureReady = null; throw e; });
    }
    return ensureReady;
  }

  async function authorizeProducer(req: Request, res: Response): Promise<SessionData | null> {
    const session = getSession(req, activeSessions);
    if (!session) { res.status(401).json({ error: 'krever_innlogging' }); return null; }
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) { res.status(400).json({ error: 'projectId mangler' }); return null; }
    try { await ensureTable(); } catch { /* fortsetter */ }
    if (!(await viewerIsProducer(pool, projectId, session.userId))) {
      res.status(403).json({ error: 'kun_produsent' }); return null;
    }
    return session;
  }

  // Self: assistentens egen tilgang («din tilgang»-visning). Alle innloggede
  // prosjekt-medlemmer kan kalle; returnerer isAssistant=false for ikke-assistenter.
  app.get('/api/role-room/projects/:projectId/my-assistant-access', async (req, res) => {
    try {
      const session = getSession(req, activeSessions);
      if (!session) { res.status(401).json({ error: 'krever_innlogging' }); return; }
      const projectId = String(req.params.projectId || '').trim();
      try { await ensureTable(); } catch { /* fortsetter */ }
      const { rows } = await pool.query(
        `SELECT areas, role_preset, status FROM role_room_assistant_access
          WHERE project_id = $1 AND status IN ('invited','active')
            AND ( (assistant_user_id IS NOT NULL AND assistant_user_id = $2)
                  OR ($3 <> '' AND lower(assistant_email) = $3) )
          LIMIT 1`,
        [projectId, session.userId, (session.email ?? '').toLowerCase()],
      );
      if (!rows[0]) { res.json({ isAssistant: false, areas: {} }); return; }
      res.json({
        isAssistant: true,
        status: String(rows[0].status ?? 'invited'),
        rolePreset: String(rows[0].role_preset ?? 'editor'),
        areas: (rows[0].areas && typeof rows[0].areas === 'object' ? rows[0].areas : {}),
      });
    } catch (error) {
      console.error('[assistant-access] my-access failed', error);
      res.status(500).json({ error: 'Kunne ikke hente tilgang' });
    }
  });

  // Godta invitasjon: setter assistant_user_id = innlogget bruker + status=active
  // (eksplisitt accept; matcher invited-rad på e-post).
  app.post('/api/role-room/projects/:projectId/my-assistant-access/accept', async (req, res) => {
    try {
      const session = getSession(req, activeSessions);
      if (!session) { res.status(401).json({ error: 'krever_innlogging' }); return; }
      const projectId = String(req.params.projectId || '').trim();
      const email = (session.email ?? '').toLowerCase();
      try { await ensureTable(); } catch { /* fortsetter */ }
      const result = await pool.query(
        `UPDATE role_room_assistant_access
           SET assistant_user_id = $2, status = 'active', updated_at = NOW()
         WHERE project_id = $1 AND status = 'invited'
           AND ( (assistant_user_id IS NOT NULL AND assistant_user_id = $2)
                 OR ($3 <> '' AND lower(assistant_email) = $3) )
         RETURNING role_preset, areas, status`,
        [projectId, session.userId, email],
      );
      if (result.rowCount === 0) { res.json({ isAssistant: false, areas: {} }); return; }
      res.json({
        isAssistant: true, status: 'active',
        rolePreset: String(result.rows[0].role_preset ?? 'editor'),
        areas: (result.rows[0].areas && typeof result.rows[0].areas === 'object' ? result.rows[0].areas : {}),
      });
    } catch (error) {
      console.error('[assistant-access] accept failed', error);
      res.status(500).json({ error: 'Kunne ikke godta invitasjon' });
    }
  });

  app.get('/api/role-room/projects/:projectId/assistants', async (req, res) => {
    try {
      const session = await authorizeProducer(req, res);
      if (!session) return;
      const result = await pool.query(
        `SELECT * FROM role_room_assistant_access WHERE project_id = $1 AND status <> 'revoked' ORDER BY created_at DESC`,
        [String(req.params.projectId).trim()],
      );
      res.json({ success: true, items: result.rows.map((r) => mapRow(r as Record<string, unknown>)) });
    } catch (error) {
      console.error('[assistant-access] list failed', error);
      res.status(500).json({ error: 'Kunne ikke hente assistenter' });
    }
  });

  app.post('/api/role-room/projects/:projectId/assistants', async (req, res) => {
    try {
      const session = await authorizeProducer(req, res);
      if (!session) return;
      const projectId = String(req.params.projectId).trim();
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!email) { res.status(400).json({ error: 'email_påkrevd' }); return; }
      const preset = ['editor', 'photographer', 'coordinator', 'custom'].includes(String(body.rolePreset)) ? String(body.rolePreset) : 'editor';
      const areas = sanitizeAreas(body.areas, defaultAreasForPreset(preset));

      const result = await pool.query(
        `INSERT INTO role_room_assistant_access (
           id, project_id, assistant_email, assistant_name, role_preset, areas, status, invite_token, invited_by_user_id, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,'invited',$7,$8, NOW(), NOW())
         ON CONFLICT (project_id, lower(assistant_email)) DO UPDATE SET
           assistant_name = EXCLUDED.assistant_name, role_preset = EXCLUDED.role_preset,
           areas = EXCLUDED.areas, status = 'invited', revoked_at = NULL, updated_at = NOW()
         RETURNING *`,
        [randomUUID(), projectId, email, typeof body.name === 'string' ? body.name : null, preset,
          JSON.stringify(areas), randomUUID().replace(/-/g, ''), session.userId],
      );
      res.status(201).json({ success: true, assistant: mapRow(result.rows[0] as Record<string, unknown>) });
    } catch (error) {
      console.error('[assistant-access] invite failed', error);
      res.status(500).json({ error: 'Kunne ikke invitere assistent' });
    }
  });

  app.patch('/api/role-room/projects/:projectId/assistants/:id', async (req, res) => {
    try {
      const session = await authorizeProducer(req, res);
      if (!session) return;
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const existing = await pool.query(
        `SELECT * FROM role_room_assistant_access WHERE id = $1 AND project_id = $2`,
        [String(req.params.id).trim(), String(req.params.projectId).trim()],
      );
      if (existing.rowCount === 0) { res.status(404).json({ error: 'fant_ikke' }); return; }
      const current = existing.rows[0] as Record<string, unknown>;
      const preset = ['editor', 'photographer', 'coordinator', 'custom'].includes(String(body.rolePreset)) ? String(body.rolePreset) : String(current.role_preset);
      // Ved preset-bytte: start fra preset-default; ellers behold gjeldende areas. Så overstyr med eksplisitte felter.
      const baseAreas = body.rolePreset && body.rolePreset !== current.role_preset
        ? defaultAreasForPreset(preset)
        : (current.areas && typeof current.areas === 'object' ? current.areas as Record<string, boolean> : defaultAreasForPreset(preset));
      const areas = sanitizeAreas(body.areas, baseAreas);
      const status = ['invited', 'active', 'revoked'].includes(String(body.status)) ? String(body.status) : String(current.status);
      const result = await pool.query(
        `UPDATE role_room_assistant_access
           SET role_preset = $3, areas = $4::jsonb, status = $5,
               revoked_at = CASE WHEN $5 = 'revoked' THEN NOW() ELSE NULL END, updated_at = NOW()
         WHERE id = $1 AND project_id = $2 RETURNING *`,
        [String(req.params.id).trim(), String(req.params.projectId).trim(), preset, JSON.stringify(areas), status],
      );
      res.json({ success: true, assistant: mapRow(result.rows[0] as Record<string, unknown>) });
    } catch (error) {
      console.error('[assistant-access] update failed', error);
      res.status(500).json({ error: 'Kunne ikke oppdatere tilgang' });
    }
  });

  app.delete('/api/role-room/projects/:projectId/assistants/:id', async (req, res) => {
    try {
      const session = await authorizeProducer(req, res);
      if (!session) return;
      const result = await pool.query(
        `UPDATE role_room_assistant_access SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND project_id = $2 RETURNING id`,
        [String(req.params.id).trim(), String(req.params.projectId).trim()],
      );
      if (result.rowCount === 0) { res.status(404).json({ error: 'fant_ikke' }); return; }
      res.json({ success: true });
    } catch (error) {
      console.error('[assistant-access] revoke failed', error);
      res.status(500).json({ error: 'Kunne ikke trekke tilbake tilgang' });
    }
  });
}
