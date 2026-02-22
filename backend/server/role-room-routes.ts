/**
 * Role Room API Routes — Creatorhub Backend Integration
 *
 * Provides casting/role management endpoints with:
 *  • x-api-key enforcement for external clients
 *  • CORS allowlist via CORS_ALLOW_ORIGINS env var
 *  • Full CRUD for casting projects, roles, candidates, crew, schedules
 *  • Project sync between Creatorhub ↔ Role Room
 *  • API key management
 *  • Marketplace installation tracking
 */

import { Router, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, desc, sql, or, gte, lte, isNull, isNotNull } from 'drizzle-orm';
import * as roleRoomSchema from '../migrations/role-room-schema.js';

// ── Types ────────────────────────────────────────────────────

interface RoleRoomApiKeyRow {
  id: string;
  key_hash: string;
  name: string;
  user_id: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface CastingProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  created_by: string | null;
  genre: string | null;
  project_type: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: string | null;
  currency: string | null;
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  creatorhub_project_id: string | null;
  created_at: string;
  updated_at: string;
}

type SyncDirection = 'creatorhub_to_roleroom' | 'roleroom_to_creatorhub';

interface ProjectSyncPayload {
  creatorhubProjectId: string;
  castingProjectId?: string;
  projectName: string;
  projectType?: string;
  clientName?: string;
  description?: string;
  eventDate?: string;
  budget?: number;
  userId: string;
}

// ── Utility Helpers ──────────────────────────────────────────

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function generateApiKey(): string {
  return `rr_${crypto.randomBytes(32).toString('hex')}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function makeId(): string {
  return crypto.randomUUID();
}

// ── CORS Configuration ──────────────────────────────────────

function buildCorsOptions(): cors.CorsOptions {
  const raw = process.env.CORS_ALLOW_ORIGINS ?? '';
  const allowList = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (allowList.length === 0) {
    // Default: allow same-origin only (no wildcard) 
    return {
      origin: false,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
      credentials: true,
      maxAge: 600,
    };
  }

  return {
    origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      // Allow requests with no origin (server-to-server, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowList.includes(origin) || allowList.includes('*')) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${origin} blocked by CORS_ALLOW_ORIGINS policy`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: true,
    maxAge: 600,
  };
}

// ── Auth Session Type ────────────────────────────────────────

type SessionData = { userId: string; email: string; name: string; role: string; loginAt: string };

// ── API Key Middleware ───────────────────────────────────────

/**
 * Dual-auth middleware: accepts either
 *   • x-api-key header  (external integrations)
 *   • Authorization: Bearer <session-token>  (in-app users)
 */
function apiKeyAuth(pool: Pool, activeSessions?: Map<string, SessionData>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // ── 1. Try Bearer token (in-app session) ──────────────
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    if (bearer && activeSessions) {
      const session = activeSessions.get(bearer);
      if (session) {
        (req as Request & { apiKeyUser: { userId: string; scopes: string[] } }).apiKeyUser = {
          userId: session.userId,
          scopes: ['read', 'write', 'admin'],
        };
        next();
        return;
      }
    }

    // ── 2. Try x-api-key header (external clients) ────────
    const key = req.headers['x-api-key'];
    if (typeof key !== 'string' || !key) {
      res.status(401).json({ error: 'Mangler x-api-key header eller gyldig session' });
      return;
    }

    const keyHash = hashApiKey(key);
    try {
      const result = await pool.query<RoleRoomApiKeyRow>(
        `SELECT * FROM role_room_api_keys 
         WHERE key_hash = $1 AND is_active = TRUE 
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [keyHash]
      );

      if (result.rowCount === 0) {
        res.status(403).json({ error: 'Ugyldig eller utløpt API-nøkkel' });
        return;
      }

      const apiKeyRecord = result.rows[0];

      // Update last_used_at
      await pool.query(
        `UPDATE role_room_api_keys SET last_used_at = NOW() WHERE id = $1`,
        [apiKeyRecord.id]
      );

      // Attach user context to request
      (req as Request & { apiKeyUser: { userId: string; scopes: string[] } }).apiKeyUser = {
        userId: apiKeyRecord.user_id,
        scopes: Array.isArray(apiKeyRecord.scopes) ? apiKeyRecord.scopes : ['read'],
      };

      next();
    } catch (err) {
      console.error('API key auth error:', err);
      res.status(500).json({ error: 'Intern autentiseringsfeil' });
    }
  };
}

// ── Request helpers ──────────────────────────────────────────

function getUserId(req: Request): string {
  const apiKeyReq = req as Request & { apiKeyUser?: { userId: string } };
  return apiKeyReq.apiKeyUser?.userId ?? 'anonymous';
}

function requireScope(req: Request, scope: string): boolean {
  const apiKeyReq = req as Request & { apiKeyUser?: { scopes: string[] } };
  const scopes = apiKeyReq.apiKeyUser?.scopes ?? [];
  return scopes.includes(scope) || scopes.includes('admin');
}

// ── Router Factory ───────────────────────────────────────────

export function createRoleRoomRouter(pool: Pool, activeSessions?: Map<string, SessionData>): Router {
  const router = Router();

  // Apply CORS to all Role Room routes
  router.use(cors(buildCorsOptions()));

  // ── Health / Connection Test ─────────────────────────────

  router.get('/health', async (_req: Request, res: Response) => {
    try {
      const result = await pool.query('SELECT NOW() AS server_time');
      const tableCheck = await pool.query(
        `SELECT COUNT(*) AS count FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name LIKE 'casting_%'`
      );
      res.json({
        status: 'ok',
        service: 'role-room',
        serverTime: result.rows[0].server_time,
        castingTablesCount: parseInt(tableCheck.rows[0].count, 10),
        corsOrigins: (process.env.CORS_ALLOW_ORIGINS ?? '').split(',').filter(Boolean),
        apiKeyEnforced: true,
      });
    } catch (err) {
      res.status(500).json({ status: 'error', message: String(err) });
    }
  });

  // ── Connection Test (requires API key) ───────────────────

  router.get('/test-connection', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const result = await pool.query('SELECT NOW() AS server_time');
      res.json({
        status: 'connected',
        userId,
        serverTime: result.rows[0].server_time,
        message: 'API-nøkkel verifisert. Tilkobling vellykket.',
      });
    } catch (err) {
      res.status(500).json({ status: 'error', message: String(err) });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // API Key Management (no auth required for create — bootstrap)
  // ═══════════════════════════════════════════════════════════

  router.post('/api-keys', async (req: Request, res: Response) => {
    const { name, userId, scopes, expiresInDays } = req.body as {
      name: string;
      userId: string;
      scopes?: string[];
      expiresInDays?: number;
    };

    if (!name || !userId) {
      res.status(400).json({ error: 'name og userId er påkrevd' });
      return;
    }

    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : null;

    try {
      await pool.query(
        `INSERT INTO role_room_api_keys (key_hash, name, user_id, scopes, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [keyHash, name, userId, JSON.stringify(scopes ?? ['read', 'write']), expiresAt]
      );

      // Return the raw key ONLY on creation — it cannot be retrieved later
      res.status(201).json({
        apiKey: rawKey,
        name,
        userId,
        scopes: scopes ?? ['read', 'write'],
        expiresAt,
        message: 'Oppbevar denne nøkkelen trygt — den kan ikke gjenopprettes.',
      });
    } catch (err) {
      console.error('Create API key error:', err);
      res.status(500).json({ error: 'Kunne ikke opprette API-nøkkel' });
    }
  });

  router.delete('/api-keys/:keyId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      await pool.query(
        `UPDATE role_room_api_keys SET is_active = FALSE WHERE id = $1`,
        [req.params.keyId]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Casting Projects CRUD
  // ═══════════════════════════════════════════════════════════

  router.get('/projects', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const result = await pool.query<CastingProjectRow>(
        `SELECT cp.* FROM casting_projects cp
         LEFT JOIN casting_user_roles cur ON cp.id = cur.project_id AND cur.user_id = $1
         WHERE cp.created_by = $1 OR cur.user_id IS NOT NULL
         ORDER BY cp.updated_at DESC`,
        [userId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error('Fetch projects error:', err);
      res.status(500).json({ error: 'Kunne ikke hente prosjekter' });
    }
  });

  router.get('/projects/:id', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const result = await pool.query<CastingProjectRow>(
        'SELECT * FROM casting_projects WHERE id = $1', [req.params.id]
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      // Fetch all sub-entities
      const [roles, candidates, crew, schedules, locations, props, shotLists, userRoles] = await Promise.all([
        pool.query('SELECT * FROM casting_roles WHERE project_id = $1', [req.params.id]),
        pool.query('SELECT * FROM casting_candidates WHERE project_id = $1', [req.params.id]),
        pool.query('SELECT * FROM casting_crew WHERE project_id = $1', [req.params.id]),
        pool.query('SELECT * FROM casting_schedules WHERE project_id = $1', [req.params.id]),
        pool.query('SELECT * FROM casting_locations WHERE project_id = $1', [req.params.id]),
        pool.query('SELECT * FROM casting_props WHERE project_id = $1', [req.params.id]),
        pool.query('SELECT * FROM casting_shot_lists WHERE project_id = $1', [req.params.id]),
        pool.query('SELECT * FROM casting_user_roles WHERE project_id = $1', [req.params.id]),
      ]);

      res.json({
        ...result.rows[0],
        roles: roles.rows,
        candidates: candidates.rows,
        crew: crew.rows,
        schedules: schedules.rows,
        locations: locations.rows,
        props: props.rows,
        shotLists: shotLists.rows,
        userRoles: userRoles.rows,
      });
    } catch (err) {
      console.error('Fetch project error:', err);
      res.status(500).json({ error: 'Kunne ikke hente prosjekt' });
    }
  });

  router.post('/projects', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const userId = getUserId(req);
    const { name, description, genre, projectType, startDate, endDate, budget, currency, creatorhubProjectId } = req.body as {
      name: string;
      description?: string;
      genre?: string;
      projectType?: string;
      startDate?: string;
      endDate?: string;
      budget?: number;
      currency?: string;
      creatorhubProjectId?: string;
    };

    if (!name) {
      res.status(400).json({ error: 'Prosjektnavn er påkrevd' });
      return;
    }

    const id = makeId();
    try {
      await pool.query(
        `INSERT INTO casting_projects (id, name, description, status, created_by, genre, project_type, start_date, end_date, budget, currency, creatorhub_project_id)
         VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8, $9, $10, $11)`,
        [id, name, description ?? null, userId, genre ?? null, projectType ?? null, startDate ?? null, endDate ?? null, budget ?? null, currency ?? 'NOK', creatorhubProjectId ?? null]
      );

      // Auto-assign creator as director
      await pool.query(
        `INSERT INTO casting_user_roles (id, project_id, user_id, role, permissions)
         VALUES ($1, $2, $3, 'director', $4)
         ON CONFLICT (project_id, user_id) DO NOTHING`,
        [makeId(), id, userId, JSON.stringify({
          canViewAll: true, canEditCasting: true, canEditProduction: true,
          canManageCrew: true, canManageLocations: true, canEditShots: true,
          canApprove: true, canEditScript: true, canLockScript: true, canRunTableRead: true,
        })]
      );

      res.status(201).json({ id, name, status: 'active', created_by: userId });
    } catch (err) {
      console.error('Create project error:', err);
      res.status(500).json({ error: 'Kunne ikke opprette prosjekt' });
    }
  });

  router.put('/projects/:id', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const { name, description, status, genre, projectType, budget } = req.body as Record<string, unknown>;
    try {
      const sets: string[] = [];
      const vals: unknown[] = [];
      let idx = 1;

      if (name !== undefined) { sets.push(`name = $${idx++}`); vals.push(name); }
      if (description !== undefined) { sets.push(`description = $${idx++}`); vals.push(description); }
      if (status !== undefined) { sets.push(`status = $${idx++}`); vals.push(status); }
      if (genre !== undefined) { sets.push(`genre = $${idx++}`); vals.push(genre); }
      if (projectType !== undefined) { sets.push(`project_type = $${idx++}`); vals.push(projectType); }
      if (budget !== undefined) { sets.push(`budget = $${idx++}`); vals.push(budget); }

      if (sets.length === 0) {
        res.status(400).json({ error: 'Ingen felter å oppdatere' });
        return;
      }

      sets.push(`updated_at = NOW()`);
      vals.push(req.params.id);

      await pool.query(
        `UPDATE casting_projects SET ${sets.join(', ')} WHERE id = $${idx}`,
        vals
      );
      res.json({ success: true });
    } catch (err) {
      console.error('Update project error:', err);
      res.status(500).json({ error: 'Kunne ikke oppdatere prosjekt' });
    }
  });

  router.delete('/projects/:id', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'admin')) {
      res.status(403).json({ error: 'Admin-tilgang kreves for sletting' });
      return;
    }
    try {
      await pool.query('DELETE FROM casting_projects WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke slette prosjekt' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // User Roles (RBAC)
  // ═══════════════════════════════════════════════════════════

  router.get('/projects/:projectId/roles', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        'SELECT * FROM casting_user_roles WHERE project_id = $1 ORDER BY created_at',
        [req.params.projectId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke hente roller' });
    }
  });

  router.post('/projects/:projectId/roles', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const { userId, email, role, permissions } = req.body as {
      userId: string;
      email?: string;
      role: string;
      permissions?: Record<string, boolean>;
    };

    if (!userId || !role) {
      res.status(400).json({ error: 'userId og role er påkrevd' });
      return;
    }

    const addedBy = getUserId(req);
    try {
      await pool.query(
        `INSERT INTO casting_user_roles (id, project_id, user_id, email, role, permissions, added_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (project_id, user_id) DO UPDATE SET role = $5, permissions = $6, email = $4, updated_at = NOW()`,
        [makeId(), req.params.projectId, userId, email ?? null, role, JSON.stringify(permissions ?? {}), addedBy]
      );
      res.status(201).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke tildele rolle' });
    }
  });

  router.delete('/projects/:projectId/roles/:userId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      await pool.query(
        'DELETE FROM casting_user_roles WHERE project_id = $1 AND user_id = $2',
        [req.params.projectId, req.params.userId]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke fjerne rolle' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Casting Roles (character roles)
  // ═══════════════════════════════════════════════════════════

  router.get('/projects/:projectId/casting-roles', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        'SELECT * FROM casting_roles WHERE project_id = $1 ORDER BY created_at',
        [req.params.projectId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke hente casting-roller' });
    }
  });

  router.post('/projects/:projectId/casting-roles', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const { name, description, ageRange, gender, roleType, requirements } = req.body as Record<string, unknown>;
    const id = makeId();
    try {
      await pool.query(
        `INSERT INTO casting_roles (id, project_id, name, description, age_range, gender, role_type, requirements)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, req.params.projectId, name, description ?? null, ageRange ?? null, gender ?? null, roleType ?? null, JSON.stringify(requirements ?? {})]
      );
      res.status(201).json({ id, name });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke opprette casting-rolle' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Candidates
  // ═══════════════════════════════════════════════════════════

  router.get('/projects/:projectId/candidates', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        'SELECT * FROM casting_candidates WHERE project_id = $1 ORDER BY name',
        [req.params.projectId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke hente kandidater' });
    }
  });

  router.post('/projects/:projectId/candidates', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const { name, email, phone, agency, notes } = req.body as Record<string, unknown>;
    const id = makeId();
    try {
      await pool.query(
        `INSERT INTO casting_candidates (id, project_id, name, email, phone, agency, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, req.params.projectId, name, email ?? null, phone ?? null, agency ?? null, notes ?? null]
      );
      res.status(201).json({ id, name });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke legge til kandidat' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Crew Members
  // ═══════════════════════════════════════════════════════════

  router.get('/projects/:projectId/crew', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        'SELECT * FROM casting_crew WHERE project_id = $1 ORDER BY name',
        [req.params.projectId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke hente crew' });
    }
  });

  router.post('/projects/:projectId/crew', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const { name, role, email, phone, department, rate } = req.body as Record<string, unknown>;
    const id = makeId();
    try {
      await pool.query(
        `INSERT INTO casting_crew (id, project_id, name, role, email, phone, department, rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, req.params.projectId, name, role, email ?? null, phone ?? null, department ?? null, rate ?? null]
      );
      res.status(201).json({ id, name });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke legge til crew-medlem' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Schedules – full CRUD + list with filter/sort/counts
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /projects/:projectId/schedules
   *
   * Query params (all optional):
   *   status      – scheduled | completed | cancelled | pool
   *   roleId      – filter by role
   *   candidateId – filter by candidate
   *   dateFrom    – YYYY-MM-DD
   *   dateTo      – YYYY-MM-DD
   *   search      – full-text against candidate name, role name, location, notes
   *   sort        – date | candidate | role | status   (default: date)
   *   dir         – asc | desc                         (default: asc)
   *   limit       – integer (default: 200)
   *   offset      – integer (default: 0)
   *   userId      – if provided, marks favorite=true on rows starred by this user
   *
   * Returns:
   *   { items[], totalCount, counts{ total, scheduled, completed, cancelled, pool, today, favorites } }
   */
  router.get('/projects/:projectId/schedules', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const {
      status, roleId, candidateId, dateFrom, dateTo, search,
      sort = 'date', dir = 'asc', limit = '200', offset = '0',
      userId,
    } = req.query as Record<string, string | undefined>;

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    try {
      // ── Build dynamic WHERE conditions ──────────────────────
      const conditions: string[] = ['cs.project_id = $1'];
      const params: unknown[] = [projectId];
      let p = 2;

      if (status === 'pool') {
        conditions.push('cs.date IS NULL');
      } else if (status) {
        conditions.push(`cs.status = $${p++}`);
        params.push(status);
      }

      if (roleId) { conditions.push(`cs.role_id = $${p++}`); params.push(roleId); }
      if (candidateId) { conditions.push(`cs.candidate_id = $${p++}`); params.push(candidateId); }
      if (dateFrom) { conditions.push(`cs.date >= $${p++}`); params.push(dateFrom); }
      if (dateTo)   { conditions.push(`cs.date <= $${p++}`); params.push(dateTo); }

      if (search) {
        const like = `%${search.toLowerCase()}%`;
        conditions.push(
          `(LOWER(COALESCE(cc.name,'')) LIKE $${p} OR LOWER(COALESCE(cr.name,'')) LIKE $${p} ` +
          `OR LOWER(COALESCE(cs.location,'')) LIKE $${p} OR LOWER(COALESCE(cs.notes,'')) LIKE $${p})`
        );
        params.push(like);
        p++;
      }

      const where = conditions.join(' AND ');

      // ── Sort column mapping ─────────────────────────────────
      const sortMap: Record<string, string> = {
        date:      "cs.date, cs.start_time",
        candidate: "cc.name",
        role:      "cr.name",
        status:    "cs.status",
      };
      const orderBy = sortMap[sort] ?? 'cs.date, cs.start_time';
      const direction = dir === 'desc' ? 'DESC' : 'ASC';

      // ── Pagination params ───────────────────────────────────
      const lim = Math.min(parseInt(limit) || 200, 500);
      const off = parseInt(offset) || 0;

      // ── Main list query (denormalized names + favorite flag) ─
      const favJoin = userId
        ? `LEFT JOIN casting_schedule_favorites csf
             ON csf.schedule_id = cs.id AND csf.user_id = $${p++}`
        : '';
      if (userId) params.push(userId);

      const favSelect = userId ? ', (csf.id IS NOT NULL) AS favorite' : ', false AS favorite';

      const listSql = `
        SELECT
          cs.id, cs.project_id, cs.candidate_id, cs.role_id, cs.scene_id,
          cs.location_id, cs.date, cs.start_time AS time, cs.end_time,
          cs.type, cs.status, cs.notes, cs.location, cs.created_at, cs.updated_at,
          COALESCE(cc.name, 'Ukjent kandidat') AS candidate_name,
          COALESCE(cr.name, 'Ukjent rolle')    AS role_name
          ${favSelect}
        FROM casting_schedules cs
        LEFT JOIN casting_candidates cc ON cc.id = cs.candidate_id
        LEFT JOIN casting_roles      cr ON cr.id = cs.role_id
        ${favJoin}
        WHERE ${where}
        ORDER BY ${orderBy} ${direction} NULLS LAST
        LIMIT $${p++} OFFSET $${p++}
      `;
      params.push(lim, off);

      // ── Total count (same filters, no paging) ───────────────
      const countSql = `
        SELECT COUNT(*) AS total
        FROM casting_schedules cs
        LEFT JOIN casting_candidates cc ON cc.id = cs.candidate_id
        LEFT JOIN casting_roles      cr ON cr.id = cs.role_id
        WHERE ${where}
      `;
      // params for count = everything except the last two (limit/offset)
      const countParams = params.slice(0, userId ? -3 : -2);
      // re-add userId param for the fav join in count if present – actually
      // for the count query we don't have the fav join, so strip userId too
      const countParamsClean = countParams.filter((_, i) => {
        // The userId param was inserted at position p-3 (before lim/off)
        // easier: just rebuild without paging and without favJoin
        return true;
      });

      // Rebuild count params without fav join param and without limit/offset
      const coreParams: unknown[] = [projectId];
      let cp = 2;
      if (status === 'pool') { /* no extra param */ }
      else if (status) { coreParams.push(status); cp++; }
      if (roleId)      { coreParams.push(roleId); cp++; }
      if (candidateId) { coreParams.push(candidateId); cp++; }
      if (dateFrom)    { coreParams.push(dateFrom); cp++; }
      if (dateTo)      { coreParams.push(dateTo); cp++; }
      if (search)      { coreParams.push(`%${search.toLowerCase()}%`); cp++; }
      void countSql; void countParamsClean; void cp;

      // ── Aggregate counts (separate sub-queries are fast via indexes) ─
      const aggSql = `
        SELECT
          COUNT(*)                                                      AS total,
          COUNT(*) FILTER (WHERE status = 'scheduled')                 AS scheduled,
          COUNT(*) FILTER (WHERE status = 'completed')                 AS completed,
          COUNT(*) FILTER (WHERE status = 'cancelled')                 AS cancelled,
          COUNT(*) FILTER (WHERE date IS NULL)                         AS pool,
          COUNT(*) FILTER (WHERE date = $2 AND status = 'scheduled')   AS today
        FROM casting_schedules
        WHERE project_id = $1
      `;

      // favorites count (only if userId given)
      const favCountSql = userId
        ? `SELECT COUNT(*) AS favorites FROM casting_schedule_favorites WHERE user_id = $1 AND project_id = $2`
        : null;

      const [listResult, aggResult, favCountResult] = await Promise.all([
        pool.query(listSql, params),
        pool.query(aggSql, [projectId, today]),
        favCountSql ? pool.query(favCountSql, [userId, projectId]) : Promise.resolve(null),
      ]);

      const agg = aggResult.rows[0];

      res.json({
        items: listResult.rows,
        totalCount: parseInt(String(agg.total), 10),
        counts: {
          total:     parseInt(String(agg.total),     10),
          scheduled: parseInt(String(agg.scheduled), 10),
          completed: parseInt(String(agg.completed), 10),
          cancelled: parseInt(String(agg.cancelled), 10),
          pool:      parseInt(String(agg.pool),      10),
          today:     parseInt(String(agg.today),     10),
          favorites: favCountResult ? parseInt(String(favCountResult.rows[0].favorites), 10) : 0,
        },
      });
    } catch (err) {
      console.error('GET schedules error:', err);
      res.status(500).json({ error: 'Kunne ikke hente tidsplan' });
    }
  });

  /**
   * POST /projects/:projectId/schedules – create a new slot
   */
  router.post('/projects/:projectId/schedules', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const {
      candidateId, roleId, sceneId, locationId, date, startTime, endTime,
      type, notes, location, status = 'scheduled',
    } = req.body as Record<string, unknown>;
    const id = (req.body as Record<string, string>).id || makeId();
    try {
      const result = await pool.query<{ id: string }>(
        `INSERT INTO casting_schedules
           (id, project_id, candidate_id, role_id, scene_id, location_id,
            date, start_time, end_time, type, notes, location, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id`,
        [id, req.params.projectId,
         candidateId ?? null, roleId ?? null, sceneId ?? null, locationId ?? null,
         date ?? null, startTime ?? null, endTime ?? null,
         type ?? null, notes ?? null, location ?? null, status]
      );
      res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
      console.error('POST schedule error:', err);
      res.status(500).json({ error: 'Kunne ikke opprette tidsplan' });
    }
  });

  /**
   * PUT /projects/:projectId/schedules/:scheduleId – full update
   */
  router.put('/projects/:projectId/schedules/:scheduleId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const {
      candidateId, roleId, sceneId, locationId, date, startTime, endTime,
      type, notes, location, status,
    } = req.body as Record<string, unknown>;
    try {
      const result = await pool.query(
        `UPDATE casting_schedules SET
           candidate_id = $1, role_id = $2, scene_id = $3, location_id = $4,
           date = $5, start_time = $6, end_time = $7, type = $8,
           notes = $9, location = $10, status = $11,
           updated_at = NOW()
         WHERE id = $12 AND project_id = $13`,
        [candidateId ?? null, roleId ?? null, sceneId ?? null, locationId ?? null,
         date ?? null, startTime ?? null, endTime ?? null, type ?? null,
         notes ?? null, location ?? null, status ?? 'scheduled',
         req.params.scheduleId, req.params.projectId]
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Ikke funnet' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('PUT schedule error:', err);
      res.status(500).json({ error: 'Kunne ikke oppdatere tidsplan' });
    }
  });

  /**
   * PATCH /projects/:projectId/schedules/:scheduleId – partial update (status only, etc.)
   */
  router.patch('/projects/:projectId/schedules/:scheduleId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const allowed = ['status', 'notes', 'date', 'start_time', 'end_time', 'location', 'candidate_id', 'role_id'];
    const setClause = Object.keys(body)
      .filter(k => allowed.includes(k))
      .map((k, i) => `${k} = $${i + 3}`)
      .join(', ');
    const values = Object.entries(body)
      .filter(([k]) => allowed.includes(k))
      .map(([, v]) => v);
    if (!setClause) { res.status(400).json({ error: 'Ingen gyldige felt' }); return; }
    try {
      await pool.query(
        `UPDATE casting_schedules SET ${setClause}, updated_at = NOW() WHERE id = $1 AND project_id = $2`,
        [req.params.scheduleId, req.params.projectId, ...values]
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke oppdatere' });
    }
  });

  /**
   * DELETE /projects/:projectId/schedules/:scheduleId – delete one
   */
  router.delete('/projects/:projectId/schedules/:scheduleId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    try {
      const result = await pool.query(
        'DELETE FROM casting_schedules WHERE id = $1 AND project_id = $2',
        [req.params.scheduleId, req.params.projectId]
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Ikke funnet' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke slette' });
    }
  });

  /**
   * DELETE /projects/:projectId/schedules – bulk delete
   * Body: { ids: string[] }
   */
  router.delete('/projects/:projectId/schedules', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const { ids } = req.body as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids[] påkrevd' });
      return;
    }
    try {
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ');
      const result = await pool.query(
        `DELETE FROM casting_schedules WHERE project_id = $1 AND id IN (${placeholders})`,
        [req.params.projectId, ...ids]
      );
      res.json({ deleted: result.rowCount ?? 0 });
    } catch (err) {
      res.status(500).json({ error: 'Bulk-sletting feilet' });
    }
  });

  /**
   * POST /projects/:projectId/schedules/:scheduleId/favorite
   * Body: { userId: string, favorite: boolean }
   */
  router.post('/projects/:projectId/schedules/:scheduleId/favorite', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const { userId, favorite } = req.body as { userId?: string; favorite?: boolean };
    if (!userId) { res.status(400).json({ error: 'userId påkrevd' }); return; }
    try {
      if (favorite) {
        await pool.query(
          `INSERT INTO casting_schedule_favorites (user_id, project_id, schedule_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, schedule_id) DO NOTHING`,
          [userId, req.params.projectId, req.params.scheduleId]
        );
      } else {
        await pool.query(
          'DELETE FROM casting_schedule_favorites WHERE user_id = $1 AND schedule_id = $2',
          [userId, req.params.scheduleId]
        );
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Favoritt-oppdatering feilet' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Project Sync (Creatorhub ↔ Role Room)
  // ═══════════════════════════════════════════════════════════

  router.post('/sync/project', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }

    const payload = req.body as ProjectSyncPayload;
    const { creatorhubProjectId, projectName, projectType, description, eventDate, budget, userId } = payload;

    if (!creatorhubProjectId || !projectName) {
      res.status(400).json({ error: 'creatorhubProjectId og projectName er påkrevd' });
      return;
    }

    try {
      // Check if a casting project already linked to this Creatorhub project
      const existing = await pool.query<CastingProjectRow>(
        'SELECT * FROM casting_projects WHERE creatorhub_project_id = $1',
        [creatorhubProjectId]
      );

      let castingProjectId: string;

      if (existing.rowCount && existing.rowCount > 0) {
        // Update existing
        castingProjectId = existing.rows[0].id;
        await pool.query(
          `UPDATE casting_projects SET name = $1, description = $2, project_type = $3, updated_at = NOW()
           WHERE id = $4`,
          [projectName, description ?? null, projectType ?? null, castingProjectId]
        );
      } else {
        // Create new casting project linked to Creatorhub
        castingProjectId = makeId();
        await pool.query(
          `INSERT INTO casting_projects (id, name, description, status, created_by, project_type, start_date, budget, creatorhub_project_id)
           VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8)`,
          [castingProjectId, projectName, description ?? null, userId, projectType ?? null, eventDate ?? null, budget ?? null, creatorhubProjectId]
        );

        // Auto-assign creator as director
        await pool.query(
          `INSERT INTO casting_user_roles (id, project_id, user_id, role, permissions)
           VALUES ($1, $2, $3, 'director', $4)
           ON CONFLICT (project_id, user_id) DO NOTHING`,
          [makeId(), castingProjectId, userId, JSON.stringify({
            canViewAll: true, canEditCasting: true, canEditProduction: true,
            canManageCrew: true, canManageLocations: true, canEditShots: true,
            canApprove: true, canEditScript: true, canLockScript: true, canRunTableRead: true,
          })]
        );
      }

      // Log the sync
      await pool.query(
        `INSERT INTO casting_project_sync (creatorhub_project_id, casting_project_id, sync_direction, sync_status, sync_data, synced_at)
         VALUES ($1, $2, $3, 'completed', $4, NOW())`,
        [creatorhubProjectId, castingProjectId, 'creatorhub_to_roleroom' as SyncDirection, JSON.stringify({ projectName, projectType, userId })]
      );

      res.json({
        success: true,
        castingProjectId,
        creatorhubProjectId,
        isNew: !(existing.rowCount && existing.rowCount > 0),
        message: 'Prosjektsynkronisering fullført',
      });
    } catch (err) {
      console.error('Project sync error:', err);
      res.status(500).json({ error: 'Synkronisering feilet' });
    }
  });

  router.get('/sync/status/:creatorhubProjectId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT * FROM casting_project_sync 
         WHERE creatorhub_project_id = $1 
         ORDER BY created_at DESC LIMIT 10`,
        [req.params.creatorhubProjectId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke hente synkstatus' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Onboarding Role Registration
  // ═══════════════════════════════════════════════════════════

  router.post('/onboarding/register-role', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { userId, email, profession, role } = req.body as {
      userId: string;
      email?: string;
      profession: string;
      role?: string;
    };

    if (!userId || !profession) {
      res.status(400).json({ error: 'userId og profession er påkrevd' });
      return;
    }

    // Map Creatorhub profession to Role Room user role
    const roleMapping: Record<string, string> = {
      photographer: 'camera_team',
      videographer: 'camera_team',
      music_producer: 'producer',
      vendor: 'agency',
      enterprise: 'production_manager',
      admin: 'director',
    };

    const mappedRole = role ?? roleMapping[profession] ?? 'reader';

    try {
      // Store the user's role mapping for future project assignments
      await pool.query(
        `INSERT INTO casting_user_roles (id, project_id, user_id, email, role, permissions, added_by)
         VALUES ($1, '__global__', $2, $3, $4, $5, 'onboarding')
         ON CONFLICT (project_id, user_id) DO UPDATE SET role = $4, email = $3, updated_at = NOW()`,
        [makeId(), userId, email ?? null, mappedRole, JSON.stringify({ canViewAll: true })]
      );

      res.json({
        success: true,
        userId,
        roleRoomRole: mappedRole,
        profession,
        message: `Rolle '${mappedRole}' registrert i Role Room`,
      });
    } catch (err) {
      console.error('Onboarding role registration error:', err);
      res.status(500).json({ error: 'Kunne ikke registrere rolle' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Marketplace Installation
  // ═══════════════════════════════════════════════════════════

  router.post('/marketplace/install', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { appId } = req.body as { appId: string };

    if (!appId) {
      res.status(400).json({ error: 'appId er påkrevd' });
      return;
    }

    try {
      await pool.query(
        `INSERT INTO marketplace_installations (user_id, app_id, is_active, settings)
         VALUES ($1, $2, TRUE, '{}')
         ON CONFLICT (user_id, app_id) DO UPDATE SET is_active = TRUE, installed_at = NOW()`,
        [userId, appId]
      );
      res.json({ success: true, appId, installed: true });
    } catch (err) {
      res.status(500).json({ error: 'Installasjon feilet' });
    }
  });

  router.get('/marketplace/installed', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const result = await pool.query(
        'SELECT * FROM marketplace_installations WHERE user_id = $1 AND is_active = TRUE',
        [userId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke hente installasjoner' });
    }
  });

  router.delete('/marketplace/uninstall/:appId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      await pool.query(
        'UPDATE marketplace_installations SET is_active = FALSE WHERE user_id = $1 AND app_id = $2',
        [userId, req.params.appId]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Avinstallering feilet' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Public Stats — no auth, used on landing page stats bar
  // ═══════════════════════════════════════════════════════════

  router.get('/public/stats', async (_req: Request, res: Response) => {
    try {
      const [kreativeRes, prodRes, rolesRes] = await Promise.all([
        pool.query(`SELECT COUNT(DISTINCT user_id) AS n FROM casting_user_roles`),
        pool.query(`SELECT COUNT(*) AS n FROM casting_projects`),
        pool.query(`SELECT COUNT(*) AS n FROM casting_roles`),
      ]);
      res.json({
        kreative:     parseInt(kreativeRes.rows[0]?.n  ?? '0', 10),
        produksjoner: parseInt(prodRes.rows[0]?.n      ?? '0', 10),
        rollerBesatt: parseInt(rolesRes.rows[0]?.n     ?? '0', 10),
      });
    } catch (err) {
      console.error('Role Room public stats error:', err);
      // Return sensible zeros on DB error — UI shows DEFAULT_STATS as fallback
      res.json({ kreative: 0, produksjoner: 0, rollerBesatt: 0 });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Admin Stats — full breakdown for AdminStats dashboard
  // ═══════════════════════════════════════════════════════════

  router.get('/admin/stats', async (_req: Request, res: Response) => {
    try {
      const [
        kreativeRes,
        prodRes,
        rolesRes,
        candidatesRes,
        marketplaceRes,
        activeKeysRes,
        recentProjectsRes,
        professionRes,
      ] = await Promise.all([
        pool.query(`SELECT COUNT(DISTINCT user_id) AS n FROM casting_user_roles`),
        pool.query(`SELECT COUNT(*) AS n FROM casting_projects`),
        pool.query(`SELECT COUNT(*) AS n FROM casting_roles`),
        pool.query(`SELECT COUNT(*) AS n FROM casting_candidates`),
        pool.query(
          `SELECT COUNT(*) AS n FROM marketplace_installations
           WHERE is_active = TRUE AND (app_id ILIKE '%role%' OR app_id ILIKE '%casting%' OR app_id = 'role-room')`
        ),
        pool.query(`SELECT COUNT(*) AS n FROM role_room_api_keys WHERE is_active = TRUE`),
        pool.query(
          `SELECT id, name, status, created_at FROM casting_projects
           ORDER BY created_at DESC LIMIT 5`
        ),
        pool.query(
          `SELECT cur.role, COUNT(*) AS n
           FROM casting_user_roles cur
           GROUP BY cur.role
           ORDER BY n DESC`
        ),
      ]);

      res.json({
        kreative:            parseInt(kreativeRes.rows[0]?.n       ?? '0', 10),
        produksjoner:        parseInt(prodRes.rows[0]?.n           ?? '0', 10),
        rollerBesatt:        parseInt(rolesRes.rows[0]?.n          ?? '0', 10),
        kandidater:          parseInt(candidatesRes.rows[0]?.n     ?? '0', 10),
        marketplaceInstalls: parseInt(marketplaceRes.rows[0]?.n    ?? '0', 10),
        activeApiKeys:       parseInt(activeKeysRes.rows[0]?.n     ?? '0', 10),
        recentProjects:      recentProjectsRes.rows,
        professionBreakdown: professionRes.rows,
      });
    } catch (err) {
      console.error('Role Room admin stats error:', err);
      res.status(500).json({ error: 'Kunne ikke hente statistikk' });
    }
  });

  // ── Live Set endpoints ───────────────────────────────────────────────────
  //  TODO [Studio]: replace in-memory maps with Postgres tables.
  //  Tables needed:
  //    live_set_status  (projectId, shootingDayId, state JSONB)
  //    takes            (id, projectId, shooting_day_id, scene_id, shot_id, …)
  //    continuity_notes (id, project_id, shooting_day_id, scene_id, …)
  //    audit_log        (id, project_id, action, payload JSONB, user_id, created_at)

  type TakeStatus = 'good' | 'ok' | 'bad' | 'circle' | 'print';

  interface TakeRow {
    id: string; projectId: string; shootingDayId: string;
    sceneId: string; shotId: string; takeNumber: number;
    status: TakeStatus; duration: number;
    cameraId: string; camera?: string; lens?: string;
    fps?: number; iso?: number; ndFilter?: string;
    notes?: string; loggedBy?: string; loggedAt: string;
  }

  interface NoteRow {
    id: string; projectId: string; shootingDayId: string;
    sceneId: string; shotId?: string; takeId?: string;
    type: string; note: string; timestamp: string; createdBy: string;
  }

  // In-memory stores (swap out for DB in Studio tier)
  const liveStatusStore  = new Map<string, Record<string, unknown>>();
  const takesStore       = new Map<string, TakeRow[]>();
  const notesStore       = new Map<string, NoteRow[]>();
  const auditLog         = new Map<string, Array<{ action: string; payload: unknown; userId: string; ts: string }>>();

  const storeKey = (pid: string, did: string) => `${pid}:${did}`;

  function appendAudit(pid: string, did: string, action: string, payload: unknown, userId: string) {
    const k = storeKey(pid, did);
    const log = auditLog.get(k) ?? [];
    log.push({ action, payload, userId, ts: new Date().toISOString() });
    auditLog.set(k, log.slice(-500)); // keep last 500
  }

  // GET /api/liveset/:projectId/status?shootingDayId=
  router.get('/liveset/:projectId/status', apiKeyAuth(pool, activeSessions), (req: Request, res: Response) => {
    const { projectId } = req.params;
    const did = req.query.shootingDayId as string;
    if (!did) return res.status(400).json({ error: 'shootingDayId required' });
    const status = liveStatusStore.get(storeKey(projectId, did)) ?? {
      currentScene: null, currentShot: null, currentTake: 1,
      isRolling: false, lastAction: '', lastActionTime: new Date().toISOString(),
    };
    res.json(status);
  });

  // POST /api/liveset/:projectId/roll
  router.post('/liveset/:projectId/roll', apiKeyAuth(pool, activeSessions), (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { shootingDayId, sceneId, shotId, userId } = req.body as Record<string, string>;
    if (!shootingDayId || !sceneId || !shotId) return res.status(400).json({ error: 'shootingDayId, sceneId, shotId required' });
    const k = storeKey(projectId, shootingDayId);
    const prev = liveStatusStore.get(k) ?? {};
    const next = { ...prev, currentScene: sceneId, currentShot: shotId, isRolling: true,
      lastAction: 'ROLLING', lastActionTime: new Date().toISOString() };
    liveStatusStore.set(k, next);
    appendAudit(projectId, shootingDayId, 'roll', { sceneId, shotId }, userId ?? 'unknown');
    res.json(next);
  });

  // POST /api/liveset/:projectId/cut
  router.post('/liveset/:projectId/cut', apiKeyAuth(pool, activeSessions), (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { shootingDayId, status, notes, cameraId, camera, lens, fps, iso, ndFilter,
            nextTake, loggedBy } = req.body as Record<string, string | number>;
    if (!shootingDayId || !status) return res.status(400).json({ error: 'shootingDayId, status required' });
    const k = storeKey(projectId, String(shootingDayId));
    const prev = (liveStatusStore.get(k) ?? { currentScene: null, currentShot: null, currentTake: 1 }) as Record<string, unknown>;
    const take: TakeRow = {
      id: `take-${Date.now()}`,
      projectId, shootingDayId: String(shootingDayId),
      sceneId:    String(prev.currentScene ?? ''),
      shotId:     String(prev.currentShot  ?? ''),
      takeNumber: Number(prev.currentTake  ?? 1),
      status:     status as TakeStatus,
      duration:   0, // TODO: compute from roll→cut timestamps
      cameraId:   String(cameraId ?? 'A'),
      camera:     camera  ? String(camera)  : undefined,
      lens:       lens    ? String(lens)    : undefined,
      fps:        fps     ? Number(fps)     : undefined,
      iso:        iso     ? Number(iso)     : undefined,
      ndFilter:   ndFilter ? String(ndFilter): undefined,
      notes:      notes   ? String(notes)   : undefined,
      loggedBy:   loggedBy ? String(loggedBy): undefined,
      loggedAt:   new Date().toISOString(),
    };
    const takes = takesStore.get(k) ?? [];
    takes.push(take);
    takesStore.set(k, takes);
    const resolvedNext = nextTake ? Number(nextTake) : Number(prev.currentTake ?? 1) + 1;
    liveStatusStore.set(k, { ...prev, currentTake: resolvedNext, isRolling: false,
      lastAction: `CUT - ${String(status).toUpperCase()}`, lastActionTime: new Date().toISOString() });
    appendAudit(projectId, String(shootingDayId), 'cut', take, String(loggedBy ?? 'unknown'));
    res.json(take);
  });

  // POST /api/liveset/:projectId/circle
  router.post('/liveset/:projectId/circle', apiKeyAuth(pool, activeSessions), (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { shootingDayId, takeId, userId } = req.body as Record<string, string>;
    if (!shootingDayId || !takeId) return res.status(400).json({ error: 'shootingDayId, takeId required' });
    const k = storeKey(projectId, shootingDayId);
    const takes = takesStore.get(k) ?? [];
    const take = takes.find(t => t.id === takeId);
    if (!take) return res.status(404).json({ error: 'Take not found' });
    take.status = 'circle';
    appendAudit(projectId, shootingDayId, 'circle_take', { takeId }, userId ?? 'unknown');
    res.json(take);
  });

  // GET /api/liveset/:projectId/takes?shootingDayId=
  router.get('/liveset/:projectId/takes', apiKeyAuth(pool, activeSessions), (req: Request, res: Response) => {
    const { projectId } = req.params;
    const did = req.query.shootingDayId as string;
    if (!did) return res.status(400).json({ error: 'shootingDayId required' });
    res.json(takesStore.get(storeKey(projectId, did)) ?? []);
  });

  // POST /api/liveset/:projectId/notes
  router.post('/liveset/:projectId/notes', apiKeyAuth(pool, activeSessions), (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { shootingDayId, sceneId, shotId, takeId, type, note, createdBy } = req.body as Record<string, string>;
    if (!shootingDayId || !sceneId || !note) return res.status(400).json({ error: 'shootingDayId, sceneId, note required' });
    const k = storeKey(projectId, shootingDayId);
    const entry: NoteRow = {
      id: `note-${Date.now()}`,
      projectId, shootingDayId, sceneId, shotId, takeId,
      type:       type ?? 'general',
      note,
      timestamp:  new Date().toISOString(),
      createdBy:  createdBy ?? 'unknown',
    };
    const notes = notesStore.get(k) ?? [];
    notes.push(entry);
    notesStore.set(k, notes);
    appendAudit(projectId, shootingDayId, 'add_note', entry, createdBy ?? 'unknown');
    res.json(entry);
  });

  // GET /api/liveset/:projectId/notes?shootingDayId=
  router.get('/liveset/:projectId/notes', apiKeyAuth(pool, activeSessions), (req: Request, res: Response) => {
    const { projectId } = req.params;
    const did = req.query.shootingDayId as string;
    if (!did) return res.status(400).json({ error: 'shootingDayId required' });
    res.json(notesStore.get(storeKey(projectId, did)) ?? []);
  });

  // POST /api/liveset/:projectId/setup-complete
  router.post('/liveset/:projectId/setup-complete', apiKeyAuth(pool, activeSessions), (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { shootingDayId, sceneId, shotId, userId } = req.body as Record<string, string>;
    if (!shootingDayId) return res.status(400).json({ error: 'shootingDayId required' });
    const k = storeKey(projectId, shootingDayId);
    const prev = liveStatusStore.get(k) ?? {};
    liveStatusStore.set(k, { ...prev, currentTake: 1, isRolling: false,
      lastAction: `SETUP COMPLETE — ${sceneId}/${shotId} — av ${userId}`,
      lastActionTime: new Date().toISOString() });
    appendAudit(projectId, shootingDayId, 'setup_complete', { sceneId, shotId }, userId ?? 'unknown');
    res.json({ ok: true });
  });

  // GET /api/liveset/:projectId/audit?shootingDayId=
  router.get('/liveset/:projectId/audit', apiKeyAuth(pool, activeSessions), (req: Request, res: Response) => {
    const { projectId } = req.params;
    const did = req.query.shootingDayId as string;
    if (!did) return res.status(400).json({ error: 'shootingDayId required' });
    res.json(auditLog.get(storeKey(projectId, did)) ?? []);
  });

  // ══════════════════════════════════════════════════════════
  //  EQUIPMENT MANAGEMENT SYSTEM
  // ══════════════════════════════════════════════════════════

  const db2 = drizzle(pool, { schema: roleRoomSchema });
  const { castingEquipment, equipmentBookings, equipmentCheckouts, equipmentTemplates } = roleRoomSchema;

  // ── Inventory ─────────────────────────────────────────────

  // GET /projects/:projectId/equipment
  router.get('/projects/:projectId/equipment', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const rows = await db2
        .select()
        .from(castingEquipment)
        .where(or(
          eq(castingEquipment.projectId, projectId),
          eq(castingEquipment.isGlobal, true),
        ))
        .orderBy(desc(castingEquipment.createdAt));
      res.json({ equipment: rows });
    } catch (e) {
      console.error('GET equipment error:', e);
      res.status(500).json({ error: 'Failed to load equipment' });
    }
  });

  // POST /equipment  — create
  router.post('/equipment', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const { project_id, name } = body as { project_id?: string; name?: string };
      if (!project_id || !name) return res.status(400).json({ error: 'project_id and name required' });
      const [row] = await db2
        .insert(castingEquipment)
        .values({
          projectId: project_id as string,
          name: name as string,
          brand: (body.brand as string) ?? null,
          model: (body.model as string) ?? null,
          category: (body.category as string) ?? null,
          status: (body.status as string) ?? 'available',
          condition: (body.condition as string) ?? 'good',
          serialNumber: (body.serial_number as string) ?? null,
          purchaseDate: (body.purchase_date as string) ?? null,
          purchasePrice: (body.purchase_price as string) ?? null,
          rentalRateDay: (body.rental_rate_day as string) ?? null,
          quantity: typeof body.quantity === 'number' ? body.quantity : 1,
          notes: (body.notes as string) ?? null,
          imageUrl: (body.image_url as string) ?? null,
          vendorUrl: (body.vendor_url as string) ?? null,
          isGlobal: Boolean(body.is_global),
          tags: Array.isArray(body.tags) ? body.tags : [],
          location: (body.location as string) ?? null,
          assignees: Array.isArray(body.assignees) ? body.assignees : [],
          bookingStart: (body.booking_start as string) ?? null,
          bookingEnd: (body.booking_end as string) ?? null,
          metadata: (body.metadata as Record<string, unknown>) ?? {},
          createdBy: getUserId(req),
        })
        .returning();
      res.status(201).json({ equipment: row });
    } catch (e) {
      console.error('POST equipment error:', e);
      res.status(500).json({ error: 'Failed to create equipment' });
    }
  });

  // PUT /equipment/:id  — update
  router.put('/equipment/:id', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = req.body as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      const FIELDS: Record<string, string> = {
        name: 'name', brand: 'brand', model: 'model', category: 'category',
        status: 'status', condition: 'condition', serial_number: 'serialNumber',
        purchase_date: 'purchaseDate', purchase_price: 'purchasePrice',
        rental_rate_day: 'rentalRateDay', quantity: 'quantity',
        notes: 'notes', image_url: 'imageUrl', vendor_url: 'vendorUrl',
        is_global: 'isGlobal', tags: 'tags', location: 'location',
        assignees: 'assignees', booking_start: 'bookingStart',
        booking_end: 'bookingEnd', metadata: 'metadata',
      };
      for (const [bodyKey, schemaKey] of Object.entries(FIELDS)) {
        if (bodyKey in body) patch[schemaKey] = body[bodyKey];
      }
      patch.updatedAt = new Date().toISOString();
      const [row] = await db2
        .update(castingEquipment)
        .set(patch)
        .where(eq(castingEquipment.id, id))
        .returning();
      if (!row) return res.status(404).json({ error: 'Equipment not found' });
      res.json({ equipment: row });
    } catch (e) {
      console.error('PUT equipment error:', e);
      res.status(500).json({ error: 'Failed to update equipment' });
    }
  });

  // DELETE /equipment/:id
  router.delete('/equipment/:id', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db2.delete(castingEquipment).where(eq(castingEquipment.id, id));
      res.json({ ok: true });
    } catch (e) {
      console.error('DELETE equipment error:', e);
      res.status(500).json({ error: 'Failed to delete equipment' });
    }
  });

  // POST /equipment/:id/assign  — assign a crew member
  router.post('/equipment/:id/assign', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { crew_id } = req.body as { crew_id?: string };
      if (!crew_id) return res.status(400).json({ error: 'crew_id required' });
      const [current] = await db2.select().from(castingEquipment).where(eq(castingEquipment.id, id));
      if (!current) return res.status(404).json({ error: 'Equipment not found' });
      const existing = Array.isArray(current.assignees) ? (current.assignees as string[]) : [];
      if (!existing.includes(crew_id)) {
        await db2.update(castingEquipment)
          .set({ assignees: [...existing, crew_id], status: 'in_use', updatedAt: new Date().toISOString() })
          .where(eq(castingEquipment.id, id));
      }
      const [updated] = await db2.select().from(castingEquipment).where(eq(castingEquipment.id, id));
      res.json({ equipment: updated });
    } catch (e) {
      console.error('POST assign error:', e);
      res.status(500).json({ error: 'Failed to assign equipment' });
    }
  });

  // DELETE /equipment/:id/assign/:crewId  — unassign
  router.delete('/equipment/:id/assign/:crewId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { id, crewId } = req.params;
      const [current] = await db2.select().from(castingEquipment).where(eq(castingEquipment.id, id));
      if (!current) return res.status(404).json({ error: 'Equipment not found' });
      const existing = Array.isArray(current.assignees) ? (current.assignees as string[]) : [];
      const next = existing.filter(c => c !== crewId);
      await db2.update(castingEquipment)
        .set({ assignees: next, status: next.length === 0 ? 'available' : 'in_use', updatedAt: new Date().toISOString() })
        .where(eq(castingEquipment.id, id));
      res.json({ ok: true });
    } catch (e) {
      console.error('DELETE assign error:', e);
      res.status(500).json({ error: 'Failed to unassign equipment' });
    }
  });

  // POST /equipment/bulk-assign
  router.post('/equipment/bulk-assign', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { equipment_ids, crew_id } = req.body as { equipment_ids?: string[]; crew_id?: string };
      if (!equipment_ids?.length || !crew_id) return res.status(400).json({ error: 'equipment_ids and crew_id required' });
      for (const eqId of equipment_ids) {
        const [current] = await db2.select().from(castingEquipment).where(eq(castingEquipment.id, eqId));
        if (!current) continue;
        const existing = Array.isArray(current.assignees) ? (current.assignees as string[]) : [];
        if (!existing.includes(crew_id)) {
          await db2.update(castingEquipment)
            .set({ assignees: [...existing, crew_id], status: 'in_use', updatedAt: new Date().toISOString() })
            .where(eq(castingEquipment.id, eqId));
        }
      }
      res.json({ ok: true, updated: equipment_ids.length });
    } catch (e) {
      console.error('POST bulk-assign error:', e);
      res.status(500).json({ error: 'Failed to bulk assign' });
    }
  });

  // GET /locations/:locationId/equipment
  router.get('/locations/:locationId/equipment', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { locationId } = req.params;
      const rows = await db2.select().from(castingEquipment)
        .where(eq(castingEquipment.location, locationId));
      res.json({ equipment: rows });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load location equipment' });
    }
  });

  // GET /crew/:crewId/equipment
  router.get('/crew/:crewId/equipment', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { crewId } = req.params;
      // assignees is a jsonb array of crew IDs
      const rows = await (pool.query(
        `SELECT * FROM casting_equipment WHERE assignees @> $1::jsonb`,
        [JSON.stringify([crewId])]
      ));
      res.json({ equipment: rows.rows });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load crew equipment' });
    }
  });

  // ── Bookings ─────────────────────────────────────────────

  // GET /equipment/:id/bookings
  router.get('/equipment/:id/bookings', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const rows = await db2.select().from(equipmentBookings)
        .where(eq(equipmentBookings.equipmentId, id))
        .orderBy(desc(equipmentBookings.startDate));
      res.json({ bookings: rows });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load bookings' });
    }
  });

  // GET /events/:eventId/equipment-bookings
  router.get('/events/:eventId/equipment-bookings', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const rows = await db2.select().from(equipmentBookings)
        .where(eq(equipmentBookings.eventId, eventId));
      res.json({ bookings: rows });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load event bookings' });
    }
  });

  // POST /equipment/:id/bookings
  router.post('/equipment/:id/bookings', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = req.body as Record<string, unknown>;
      const { start_date, end_date } = body as { start_date?: string; end_date?: string };
      if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date required' });
      const [row] = await db2.insert(equipmentBookings).values({
        equipmentId: id,
        projectId: body.project_id as string ?? '',
        bookedBy: (body.booked_by as string) ?? getUserId(req),
        eventId: (body.event_id as string) ?? null,
        startDate: start_date,
        endDate: end_date,
        status: (body.status as string) ?? 'confirmed',
        quantity: typeof body.quantity === 'number' ? body.quantity : 1,
        notes: (body.notes as string) ?? null,
      }).returning();
      res.status(201).json({ booking: row });
    } catch (e) {
      console.error('POST booking error:', e);
      res.status(500).json({ error: 'Failed to create booking' });
    }
  });

  // PUT /equipment/bookings/:bookingId
  router.put('/equipment/bookings/:bookingId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { bookingId } = req.params;
      const body = req.body as Record<string, unknown>;
      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      for (const k of ['start_date','end_date','status','quantity','notes','event_id'] as const) {
        const map: Record<string, string> = { start_date: 'startDate', end_date: 'endDate', event_id: 'eventId', quantity: 'quantity', notes: 'notes', status: 'status' };
        if (k in body) patch[map[k]] = body[k];
      }
      const [row] = await db2.update(equipmentBookings).set(patch)
        .where(eq(equipmentBookings.id, bookingId)).returning();
      if (!row) return res.status(404).json({ error: 'Booking not found' });
      res.json({ booking: row });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update booking' });
    }
  });

  // DELETE /equipment/bookings/:bookingId
  router.delete('/equipment/bookings/:bookingId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      await db2.delete(equipmentBookings).where(eq(equipmentBookings.id, req.params.bookingId));
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to delete booking' });
    }
  });

  // ── Availability (reuse bookings table with status='availability') ─────────
  // For MVP these share the bookings table – clients can filter by event_id

  // GET /equipment/:id/availability
  router.get('/equipment/:id/availability', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const rows = await db2.select().from(equipmentBookings)
        .where(and(eq(equipmentBookings.equipmentId, req.params.id), eq(equipmentBookings.status, 'confirmed')))
        .orderBy(equipmentBookings.startDate);
      res.json({ availability: rows });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load availability' });
    }
  });

  // POST /equipment/:id/availability
  router.post('/equipment/:id/availability', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const body = req.body as { start_date: string; end_date: string; project_id?: string };
      const [row] = await db2.insert(equipmentBookings).values({
        equipmentId: req.params.id,
        projectId: body.project_id ?? '',
        bookedBy: getUserId(req),
        startDate: body.start_date,
        endDate: body.end_date,
        status: 'confirmed',
        quantity: 1,
      }).returning();
      res.status(201).json({ availability: row });
    } catch (e) {
      res.status(500).json({ error: 'Failed to create availability' });
    }
  });

  // DELETE /equipment/availability/:id
  router.delete('/equipment/availability/:id', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      await db2.delete(equipmentBookings).where(eq(equipmentBookings.id, req.params.id));
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to delete availability' });
    }
  });

  // ── Conflict Detection ────────────────────────────────────

  // POST /equipment/:id/conflicts/check
  router.post('/equipment/:id/conflicts/check', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { start_date, end_date, exclude_booking_id } = req.body as Record<string, string>;
      if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date required' });

      // Overlapping: existing.start < req.end AND existing.end > req.start
      const overlapping = await db2.select().from(equipmentBookings)
        .where(and(
          eq(equipmentBookings.equipmentId, id),
          lte(equipmentBookings.startDate, end_date),
          gte(equipmentBookings.endDate, start_date),
          exclude_booking_id ? sql`${equipmentBookings.id} != ${exclude_booking_id}` : sql`true`,
        ));

      const conflicts = overlapping.map(b => ({
        booking_id: b.id,
        equipment_id: b.equipmentId,
        start_date: b.startDate,
        end_date: b.endDate,
        booked_by: b.bookedBy,
        status: b.status,
      }));

      res.json({ conflicts, has_conflicts: conflicts.length > 0 });
    } catch (e) {
      console.error('Conflict check error:', e);
      res.status(500).json({ error: 'Failed to check conflicts' });
    }
  });

  // ── Checkouts ─────────────────────────────────────────────

  // GET /projects/:projectId/equipment-checkouts?active=true&equipmentId=xxx
  router.get('/projects/:projectId/equipment-checkouts', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const activeOnly = req.query.active === 'true';
      const equipmentId = req.query.equipmentId as string | undefined;
      const conditions = [eq(equipmentCheckouts.projectId, projectId)];
      if (activeOnly) conditions.push(isNull(equipmentCheckouts.checkedInAt));
      if (equipmentId) conditions.push(eq(equipmentCheckouts.equipmentId, equipmentId));
      const rows = await db2.select().from(equipmentCheckouts)
        .where(and(...conditions))
        .orderBy(desc(equipmentCheckouts.checkedOutAt));
      res.json({ checkouts: rows });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load checkouts' });
    }
  });

  // POST /equipment/:id/checkout
  router.post('/equipment/:id/checkout', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = req.body as Record<string, unknown>;
      const checked_out_to = body.checked_out_to as string;
      if (!checked_out_to) return res.status(400).json({ error: 'checked_out_to required' });

      const [current] = await db2.select().from(castingEquipment).where(eq(castingEquipment.id, id));
      if (!current) return res.status(404).json({ error: 'Equipment not found' });

      const [checkout] = await db2.insert(equipmentCheckouts).values({
        equipmentId: id,
        projectId: (body.project_id as string) ?? current.projectId,
        checkedOutTo: checked_out_to,
        checkedOutBy: getUserId(req),
        quantity: typeof body.quantity === 'number' ? body.quantity : 1,
        purpose: (body.purpose as string) ?? null,
      }).returning();

      // Update equipment status to in_use
      await db2.update(castingEquipment)
        .set({ status: 'in_use', updatedAt: new Date().toISOString() })
        .where(eq(castingEquipment.id, id));

      res.status(201).json({ checkout });
    } catch (e) {
      console.error('POST checkout error:', e);
      res.status(500).json({ error: 'Failed to check out equipment' });
    }
  });

  // POST /equipment/checkouts/:checkoutId/checkin
  router.post('/equipment/checkouts/:checkoutId/checkin', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { checkoutId } = req.params;
      const body = req.body as { condition_on_return?: string; notes?: string };
      const [checkout] = await db2.select().from(equipmentCheckouts).where(eq(equipmentCheckouts.id, checkoutId));
      if (!checkout) return res.status(404).json({ error: 'Checkout not found' });

      const [updated] = await db2.update(equipmentCheckouts)
        .set({
          checkedInAt: new Date().toISOString(),
          conditionOnReturn: body.condition_on_return ?? null,
          notes: body.notes ?? checkout.notes,
        })
        .where(eq(equipmentCheckouts.id, checkoutId))
        .returning();

      // Update equipment status back to available and condition if provided
      const eqPatch: Record<string, unknown> = { status: 'available', updatedAt: new Date().toISOString() };
      if (body.condition_on_return) eqPatch.condition = body.condition_on_return;
      await db2.update(castingEquipment).set(eqPatch).where(eq(castingEquipment.id, checkout.equipmentId));

      res.json({ checkout: updated });
    } catch (e) {
      console.error('POST checkin error:', e);
      res.status(500).json({ error: 'Failed to check in equipment' });
    }
  });

  // ── Templates ─────────────────────────────────────────────

  // GET /projects/:projectId/equipment-templates
  router.get('/projects/:projectId/equipment-templates', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const rows = await db2.select().from(equipmentTemplates)
        .where(eq(equipmentTemplates.projectId, req.params.projectId))
        .orderBy(desc(equipmentTemplates.createdAt));
      res.json({ templates: rows });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load templates' });
    }
  });

  // GET /equipment-templates/:id
  router.get('/equipment-templates/:id', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const [row] = await db2.select().from(equipmentTemplates).where(eq(equipmentTemplates.id, req.params.id));
      if (!row) return res.status(404).json({ error: 'Template not found' });
      res.json({ template: row });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load template' });
    }
  });

  // POST /projects/:projectId/equipment-templates
  router.post('/projects/:projectId/equipment-templates', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      if (!body.name) return res.status(400).json({ error: 'name required' });
      const [row] = await db2.insert(equipmentTemplates).values({
        projectId: req.params.projectId,
        name: body.name as string,
        description: (body.description as string) ?? null,
        category: (body.category as string) ?? null,
        items: Array.isArray(body.items) ? body.items : [],
        createdBy: getUserId(req),
      }).returning();
      res.status(201).json({ template: row });
    } catch (e) {
      res.status(500).json({ error: 'Failed to create template' });
    }
  });

  // PUT /equipment-templates/:id
  router.put('/equipment-templates/:id', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      for (const k of ['name','description','category','items'] as const) {
        if (k in body) patch[k] = body[k];
      }
      const [row] = await db2.update(equipmentTemplates).set(patch)
        .where(eq(equipmentTemplates.id, req.params.id)).returning();
      if (!row) return res.status(404).json({ error: 'Template not found' });
      res.json({ template: row });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update template' });
    }
  });

  // DELETE /equipment-templates/:id
  router.delete('/equipment-templates/:id', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      await db2.delete(equipmentTemplates).where(eq(equipmentTemplates.id, req.params.id));
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to delete template' });
    }
  });

  // POST /equipment-templates/:id/apply — create equipment items from a template
  router.post('/equipment-templates/:id/apply', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { project_id } = req.body as { project_id?: string };
      if (!project_id) return res.status(400).json({ error: 'project_id required' });
      const [template] = await db2.select().from(equipmentTemplates).where(eq(equipmentTemplates.id, req.params.id));
      if (!template) return res.status(404).json({ error: 'Template not found' });
      const items = Array.isArray(template.items) ? template.items as Record<string, unknown>[] : [];
      const inserted: unknown[] = [];
      for (const item of items) {
        const [row] = await db2.insert(castingEquipment).values({
          projectId: project_id,
          name: (item.name as string) ?? 'Unnamed',
          brand: (item.brand as string) ?? null,
          model: (item.model as string) ?? null,
          category: (item.category as string) ?? template.category ?? null,
          status: 'available',
          condition: (item.condition as string) ?? 'good',
          quantity: typeof item.quantity === 'number' ? item.quantity : 1,
          notes: (item.notes as string) ?? null,
          metadata: {},
          createdBy: getUserId(req),
        }).returning();
        inserted.push(row);
      }
      res.status(201).json({ equipment: inserted, count: inserted.length });
    } catch (e) {
      console.error('POST template apply error:', e);
      res.status(500).json({ error: 'Failed to apply template' });
    }
  });

  // ── Schedule-maintenance stub (used by EquipmentManagementPanel) ──────────
  // Patch the existing /api/equipment/schedule-maintenance into the Role Room namespace too
  router.post('/equipment/schedule-maintenance', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const { equipment_id, scheduled_date, type, notes } = body as Record<string, string>;
      if (!equipment_id) return res.status(400).json({ error: 'equipment_id required' });
      // Update condition to maintenance and record note
      await db2.update(castingEquipment)
        .set({
          status: 'maintenance',
          notes: notes ?? null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(castingEquipment.id, equipment_id));
      res.json({ ok: true, scheduled_date, type });
    } catch (e) {
      res.status(500).json({ error: 'Failed to schedule maintenance' });
    }
  });

  return router;
}
