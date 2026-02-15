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
import { eq, and, desc, sql } from 'drizzle-orm';
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

// ── API Key Middleware ───────────────────────────────────────

function apiKeyAuth(pool: Pool) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.headers['x-api-key'];
    if (typeof key !== 'string' || !key) {
      res.status(401).json({ error: 'Mangler x-api-key header' });
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

export function createRoleRoomRouter(pool: Pool): Router {
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

  router.get('/test-connection', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.delete('/api-keys/:keyId', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.get('/projects', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.get('/projects/:id', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.post('/projects', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.put('/projects/:id', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.delete('/projects/:id', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.get('/projects/:projectId/roles', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.post('/projects/:projectId/roles', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.delete('/projects/:projectId/roles/:userId', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.get('/projects/:projectId/casting-roles', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.post('/projects/:projectId/casting-roles', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.get('/projects/:projectId/candidates', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.post('/projects/:projectId/candidates', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.get('/projects/:projectId/crew', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.post('/projects/:projectId/crew', apiKeyAuth(pool), async (req: Request, res: Response) => {
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
  // Schedules
  // ═══════════════════════════════════════════════════════════

  router.get('/projects/:projectId/schedules', apiKeyAuth(pool), async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        'SELECT * FROM casting_schedules WHERE project_id = $1 ORDER BY date, start_time',
        [req.params.projectId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke hente tidsplan' });
    }
  });

  router.post('/projects/:projectId/schedules', apiKeyAuth(pool), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const { candidateId, roleId, sceneId, locationId, date, startTime, endTime, type, notes } = req.body as Record<string, unknown>;
    const id = makeId();
    try {
      await pool.query(
        `INSERT INTO casting_schedules (id, project_id, candidate_id, role_id, scene_id, location_id, date, start_time, end_time, type, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [id, req.params.projectId, candidateId ?? null, roleId ?? null, sceneId ?? null, locationId ?? null, date ?? null, startTime ?? null, endTime ?? null, type ?? null, notes ?? null]
      );
      res.status(201).json({ id });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke opprette tidsplan' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Project Sync (Creatorhub ↔ Role Room)
  // ═══════════════════════════════════════════════════════════

  router.post('/sync/project', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.get('/sync/status/:creatorhubProjectId', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.post('/onboarding/register-role', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.post('/marketplace/install', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.get('/marketplace/installed', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  router.delete('/marketplace/uninstall/:appId', apiKeyAuth(pool), async (req: Request, res: Response) => {
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

  return router;
}
