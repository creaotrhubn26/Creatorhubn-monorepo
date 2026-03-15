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
import QRCode from 'qrcode';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, desc, sql, or, gte, lte, isNull, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
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

type ProducerPhase = 'preproduction' | 'production' | 'postproduction';
type ProducerReviewDecision = 'approved' | 'rejected' | 'changes_requested';

interface ProjectRoleRecord {
  role: string;
  permissions: Record<string, boolean>;
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

function isRoleRoomDevBypassEnabled(): boolean {
  if (process.env.ROLE_ROOM_DEV_AUTH_BYPASS === '1') return true;
  if (process.env.ROLE_ROOM_DEV_AUTH_BYPASS === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

function deriveDevUserIdFromBearer(token: string): string {
  const fallback = 'dev-session-user';
  const trimmed = token.trim();
  if (!trimmed) return fallback;

  const jwtParts = trimmed.split('.');
  if (jwtParts.length >= 2) {
    try {
      const payloadJson = Buffer.from(jwtParts[1], 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson) as { sub?: string; userId?: string; id?: string };
      const fromPayload = payload.sub ?? payload.userId ?? payload.id;
      if (typeof fromPayload === 'string' && fromPayload.trim()) {
        return fromPayload.trim();
      }
    } catch {
      // Ignore decode errors and continue with deterministic fallback.
    }
  }

  return `dev-${hashApiKey(trimmed).slice(0, 16)}`;
}

// ── API Key Middleware ───────────────────────────────────────

/**
 * Dual-auth middleware: accepts either
 *   • x-api-key header  (external integrations)
 *   • Authorization: Bearer <session-token>  (in-app users)
 */
function apiKeyAuth(pool: Pool, activeSessions?: Map<string, SessionData>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const devBypassEnabled = isRoleRoomDevBypassEnabled();

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

    // ── 1b. Dev-mode bypass for local UI integration ───────
    if (devBypassEnabled) {
      const userId = bearer ? deriveDevUserIdFromBearer(bearer) : 'dev-local-user';
      (req as Request & { apiKeyUser: { userId: string; scopes: string[] } }).apiKeyUser = {
        userId,
        scopes: ['read', 'write', 'admin'],
      };
      next();
      return;
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
  const LEGACY_COMPAT_TABLE_NAME = 'legacy_compat_store';
  let legacyCompatTableReadyPromise: Promise<boolean> | null = null;

  async function ensureLegacyCompatTable(): Promise<boolean> {
    if (legacyCompatTableReadyPromise) return legacyCompatTableReadyPromise;
    legacyCompatTableReadyPromise = (async () => {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS ${LEGACY_COMPAT_TABLE_NAME} (
            store_key TEXT PRIMARY KEY,
            store_value JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        return true;
      } catch (error) {
        console.warn('Role Room compat store unavailable:', error);
        return false;
      }
    })();
    return legacyCompatTableReadyPromise;
  }

  async function compatStoreGet<T>(storeKey: string): Promise<T | null> {
    if (!(await ensureLegacyCompatTable())) return null;
    try {
      const result = await pool.query(
        `SELECT store_value FROM ${LEGACY_COMPAT_TABLE_NAME} WHERE store_key = $1 LIMIT 1`,
        [storeKey],
      );
      if (!Array.isArray(result.rows) || result.rows.length === 0) return null;
      return (result.rows[0]?.store_value as T | undefined) ?? null;
    } catch (error) {
      console.warn('Role Room compatStoreGet failed:', { storeKey, error });
      return null;
    }
  }

  async function compatStoreSet(storeKey: string, storeValue: unknown): Promise<void> {
    if (!(await ensureLegacyCompatTable())) return;
    try {
      await pool.query(
        `INSERT INTO ${LEGACY_COMPAT_TABLE_NAME} (store_key, store_value, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (store_key)
         DO UPDATE SET
           store_value = EXCLUDED.store_value,
           updated_at = NOW()`,
        [storeKey, JSON.stringify(storeValue ?? null) ?? 'null'],
      );
    } catch (error) {
      console.warn('Role Room compatStoreSet failed:', { storeKey, error });
    }
  }

  const PRODUCER_PHASES: readonly ProducerPhase[] = ['preproduction', 'production', 'postproduction'];
  const PRODUCER_DECISIONS: readonly ProducerReviewDecision[] = ['approved', 'rejected', 'changes_requested'];

  function isProducerPhase(value: unknown): value is ProducerPhase {
    return typeof value === 'string' && PRODUCER_PHASES.includes(value as ProducerPhase);
  }

  function isProducerReviewDecision(value: unknown): value is ProducerReviewDecision {
    return typeof value === 'string' && PRODUCER_DECISIONS.includes(value as ProducerReviewDecision);
  }

  function parseRolePermissions(raw: unknown): Record<string, boolean> {
    if (!raw || typeof raw !== 'object') return {};
    const input = raw as Record<string, unknown>;
    return Object.entries(input).reduce<Record<string, boolean>>((acc, [key, value]) => {
      if (typeof value === 'boolean') acc[key] = value;
      return acc;
    }, {});
  }

  function getDefaultProjectRolePermissions(role: string): Record<string, boolean> {
    switch (role) {
      case 'director':
      case 'producer':
        return {
          canViewAll: true,
          canEditCasting: true,
          canEditProduction: true,
          canManageCrew: true,
          canManageLocations: true,
          canEditShots: true,
          canEditShotLists: true,
          canApprove: true,
          canEditScript: true,
          canLockScript: true,
          canRunTableRead: true,
          canComment: true,
          canRequestChanges: true,
          canViewEconomy: true,
        };
      case 'content_producer':
        return {
          canViewAll: true,
          canEditCasting: true,
          canEditProduction: true,
          canManageCrew: false,
          canManageLocations: true,
          canEditShots: true,
          canEditShotLists: true,
          canApprove: false,
          canEditScript: true,
          canLockScript: false,
          canRunTableRead: true,
          canComment: true,
          canRequestChanges: true,
          canViewEconomy: true,
        };
      case 'client_reviewer':
        return {
          canViewAll: true,
          canEditCasting: false,
          canEditProduction: false,
          canManageCrew: false,
          canManageLocations: false,
          canEditShots: false,
          canEditShotLists: false,
          canApprove: true,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
          canComment: true,
          canRequestChanges: true,
          canViewEconomy: false,
        };
      case 'casting_director':
        return {
          canViewAll: true,
          canEditCasting: true,
          canEditProduction: false,
          canManageCrew: false,
          canManageLocations: false,
          canEditShots: false,
          canEditShotLists: false,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: false,
        };
      case 'production_manager':
        return {
          canViewAll: true,
          canEditCasting: false,
          canEditProduction: true,
          canManageCrew: true,
          canManageLocations: true,
          canEditShots: false,
          canEditShotLists: false,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: false,
        };
      case 'camera_team':
        return {
          canViewAll: false,
          canEditCasting: false,
          canEditProduction: false,
          canManageCrew: false,
          canManageLocations: false,
          canEditShots: true,
          canEditShotLists: true,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: false,
        };
      case 'writer':
      case 'script_editor':
        return {
          canViewAll: true,
          canEditCasting: false,
          canEditProduction: false,
          canManageCrew: false,
          canManageLocations: false,
          canEditShots: false,
          canEditShotLists: false,
          canApprove: false,
          canEditScript: true,
          canLockScript: role === 'script_editor',
          canRunTableRead: true,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: false,
        };
      default:
        return {
          canViewAll: false,
          canEditCasting: false,
          canEditProduction: false,
          canManageCrew: false,
          canManageLocations: false,
          canEditShots: false,
          canEditShotLists: false,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: false,
        };
    }
  }

  function buildProjectRolePermissions(role: string, overrides?: unknown): Record<string, boolean> {
    return {
      ...getDefaultProjectRolePermissions(role),
      ...parseRolePermissions(overrides),
    };
  }

  async function getProjectRoleRecord(projectId: string, userId: string): Promise<ProjectRoleRecord | null> {
    const result = await pool.query(
      `SELECT role, permissions FROM casting_user_roles WHERE project_id = $1 AND user_id = $2 LIMIT 1`,
      [projectId, userId],
    );
    let row = result.rows[0] as { role?: string; permissions?: unknown } | undefined;

    if (!row) {
      const fallbackResult = await pool.query(
        `SELECT role, permissions FROM casting_user_roles WHERE project_id = '__global__' AND user_id = $1 LIMIT 1`,
        [userId],
      );
      row = fallbackResult.rows[0] as { role?: string; permissions?: unknown } | undefined;
    }

    if (!row) return null;
    if (!row?.role) return null;
    return {
      role: String(row.role),
      permissions: parseRolePermissions(row.permissions),
    };
  }

  function canReadProducerData(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    if (requireScope(req, 'admin')) return true;
    if (!roleRecord) return false;
    if ([
      'director',
      'producer',
      'production_manager',
      'content_producer',
      'client_reviewer',
    ].includes(roleRecord.role)) return true;
    return roleRecord.permissions.canViewAll === true
      || roleRecord.permissions.canEditProduction === true
      || roleRecord.permissions.canComment === true;
  }

  function canReadProducerEconomy(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    if (requireScope(req, 'admin')) return true;
    if (!roleRecord) return false;
    if (['director', 'producer', 'content_producer'].includes(roleRecord.role)) return true;
    return roleRecord.permissions.canViewEconomy === true;
  }

  function canWriteProducerData(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    if (requireScope(req, 'admin')) return true;
    if (!roleRecord) return false;
    if (['director', 'producer', 'production_manager', 'content_producer'].includes(roleRecord.role)) return true;
    return roleRecord.permissions.canEditProduction === true;
  }

  function canCommentProducerReview(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    if (requireScope(req, 'admin')) return true;
    if (!roleRecord) return false;
    if (['director', 'producer', 'content_producer', 'client_reviewer'].includes(roleRecord.role)) return true;
    return roleRecord.permissions.canComment === true;
  }

  function canDecideProducerReview(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    if (requireScope(req, 'admin')) return true;
    if (!roleRecord) return false;
    if (['director', 'producer', 'client_reviewer'].includes(roleRecord.role)) return true;
    return roleRecord.permissions.canApprove === true || roleRecord.permissions.canRequestChanges === true;
  }

  let producerWorkflowTablesReadyPromise: Promise<boolean> | null = null;
  async function ensureProducerWorkflowTables(): Promise<boolean> {
    if (producerWorkflowTablesReadyPromise) return producerWorkflowTablesReadyPromise;
    producerWorkflowTablesReadyPromise = (async () => {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS role_room_phase_timeline_items (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            phase VARCHAR(32) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            owner_user_id VARCHAR(255),
            due_at TIMESTAMPTZ,
            status VARCHAR(32) NOT NULL DEFAULT 'planned',
            linked_entity_type VARCHAR(100),
            linked_entity_id VARCHAR(255),
            sort_order INTEGER NOT NULL DEFAULT 0,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_phase_timeline_project ON role_room_phase_timeline_items(project_id);
          CREATE INDEX IF NOT EXISTS idx_rr_phase_timeline_phase ON role_room_phase_timeline_items(phase);

          CREATE TABLE IF NOT EXISTS role_room_budget_items (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            phase VARCHAR(32) NOT NULL,
            category VARCHAR(120) NOT NULL,
            item_name VARCHAR(255) NOT NULL,
            description TEXT,
            estimate NUMERIC(12, 2) NOT NULL DEFAULT 0,
            approved NUMERIC(12, 2) NOT NULL DEFAULT 0,
            actual NUMERIC(12, 2) NOT NULL DEFAULT 0,
            currency VARCHAR(10) NOT NULL DEFAULT 'NOK',
            status VARCHAR(32) NOT NULL DEFAULT 'draft',
            client_visible BOOLEAN NOT NULL DEFAULT TRUE,
            linked_entity_type VARCHAR(100),
            linked_entity_id VARCHAR(255),
            sort_order INTEGER NOT NULL DEFAULT 0,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_budget_project ON role_room_budget_items(project_id);
          CREATE INDEX IF NOT EXISTS idx_rr_budget_phase ON role_room_budget_items(phase);

          CREATE TABLE IF NOT EXISTS role_room_client_reviews (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            review_type VARCHAR(80) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            target_entity_type VARCHAR(100),
            target_entity_id VARCHAR(255),
            requested_by_user_id VARCHAR(255),
            requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            due_at TIMESTAMPTZ,
            status VARCHAR(40) NOT NULL DEFAULT 'pending',
            decision_by_user_id VARCHAR(255),
            decision_at TIMESTAMPTZ,
            decision_reason TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_client_reviews_project ON role_room_client_reviews(project_id);
          CREATE INDEX IF NOT EXISTS idx_rr_client_reviews_status ON role_room_client_reviews(status);

          CREATE TABLE IF NOT EXISTS role_room_client_review_comments (
            id UUID PRIMARY KEY,
            review_id UUID NOT NULL REFERENCES role_room_client_reviews(id) ON DELETE CASCADE,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            author_user_id VARCHAR(255),
            author_role VARCHAR(80),
            comment_text TEXT NOT NULL,
            timestamp_seconds INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_review_comments_project ON role_room_client_review_comments(project_id);
          CREATE INDEX IF NOT EXISTS idx_rr_review_comments_review ON role_room_client_review_comments(review_id);
        `);
        return true;
      } catch (error) {
        console.warn('Role Room producer workflow tables unavailable:', error);
        return false;
      }
    })();
    return producerWorkflowTablesReadyPromise;
  }

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
        [makeId(), id, userId, JSON.stringify(buildProjectRolePermissions('director'))]
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
        [
          makeId(),
          req.params.projectId,
          userId,
          email ?? null,
          role,
          JSON.stringify(buildProjectRolePermissions(role, permissions)),
          addedBy,
        ]
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
  // Producer Workflow (Timeline / Economy / Client Reviews)
  // ═══════════════════════════════════════════════════════════

  router.get('/projects/:projectId/producer/timeline', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);
    try {
      const roleRecord = await getProjectRoleRecord(projectId, userId);
      if (!canReadProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til tidslinje' });
        return;
      }

      const result = await pool.query(
        `SELECT * FROM role_room_phase_timeline_items
         WHERE project_id = $1
         ORDER BY
           CASE phase
             WHEN 'preproduction' THEN 1
             WHEN 'production' THEN 2
             WHEN 'postproduction' THEN 3
             ELSE 4
           END,
           sort_order ASC,
           due_at NULLS LAST,
           created_at ASC`,
        [projectId],
      );
      res.json({ items: result.rows });
    } catch (error) {
      console.error('Producer timeline fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente tidslinje' });
    }
  });

  router.post('/projects/:projectId/producer/timeline', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);
    const {
      phase,
      title,
      description,
      ownerUserId,
      dueAt,
      status,
      linkedEntityType,
      linkedEntityId,
      sortOrder,
      metadata,
    } = req.body as Record<string, unknown>;

    if (!isProducerPhase(phase)) {
      res.status(400).json({ error: 'phase må være preproduction, production eller postproduction' });
      return;
    }
    if (typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'title er påkrevd' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, userId);
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å opprette tidslinjeelementer' });
        return;
      }

      const id = crypto.randomUUID();
      const result = await pool.query(
        `INSERT INTO role_room_phase_timeline_items (
          id, project_id, phase, title, description, owner_user_id, due_at, status,
          linked_entity_type, linked_entity_id, sort_order, metadata, created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12::jsonb, $13, NOW(), NOW()
        )
        RETURNING *`,
        [
          id,
          projectId,
          phase,
          title.trim(),
          typeof description === 'string' ? description : null,
          typeof ownerUserId === 'string' ? ownerUserId : null,
          typeof dueAt === 'string' ? dueAt : null,
          typeof status === 'string' && status.trim() ? status : 'planned',
          typeof linkedEntityType === 'string' ? linkedEntityType : null,
          typeof linkedEntityId === 'string' ? linkedEntityId : null,
          typeof sortOrder === 'number' ? sortOrder : 0,
          JSON.stringify(metadata && typeof metadata === 'object' ? metadata : {}),
          userId,
        ],
      );

      res.status(201).json({ item: result.rows[0] });
    } catch (error) {
      console.error('Producer timeline create error:', error);
      res.status(500).json({ error: 'Kunne ikke opprette tidslinjeelement' });
    }
  });

  router.patch('/projects/:projectId/producer/timeline/:itemId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const itemId = req.params.itemId;
    const userId = getUserId(req);

    try {
      const roleRecord = await getProjectRoleRecord(projectId, userId);
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å oppdatere tidslinjeelementer' });
        return;
      }

      const payload = req.body as Record<string, unknown>;
      const sets: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      const addField = (column: string, value: unknown, cast?: string) => {
        const suffix = cast ? `::${cast}` : '';
        sets.push(`${column} = $${idx}${suffix}`);
        values.push(value);
        idx += 1;
      };

      if (isProducerPhase(payload.phase)) addField('phase', payload.phase);
      if (typeof payload.title === 'string') addField('title', payload.title.trim());
      if (typeof payload.description === 'string' || payload.description === null) addField('description', payload.description);
      if (typeof payload.ownerUserId === 'string' || payload.ownerUserId === null) addField('owner_user_id', payload.ownerUserId);
      if (typeof payload.dueAt === 'string' || payload.dueAt === null) addField('due_at', payload.dueAt);
      if (typeof payload.status === 'string') addField('status', payload.status.trim() || 'planned');
      if (typeof payload.linkedEntityType === 'string' || payload.linkedEntityType === null) addField('linked_entity_type', payload.linkedEntityType);
      if (typeof payload.linkedEntityId === 'string' || payload.linkedEntityId === null) addField('linked_entity_id', payload.linkedEntityId);
      if (typeof payload.sortOrder === 'number') addField('sort_order', payload.sortOrder);
      if (payload.metadata && typeof payload.metadata === 'object') addField('metadata', JSON.stringify(payload.metadata), 'jsonb');

      if (sets.length === 0) {
        res.status(400).json({ error: 'Ingen felter å oppdatere' });
        return;
      }

      sets.push(`updated_at = NOW()`);
      values.push(projectId, itemId);

      const result = await pool.query(
        `UPDATE role_room_phase_timeline_items
         SET ${sets.join(', ')}
         WHERE project_id = $${idx} AND id = $${idx + 1}
         RETURNING *`,
        values,
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke tidslinjeelement' });
        return;
      }

      res.json({ item: result.rows[0] });
    } catch (error) {
      console.error('Producer timeline update error:', error);
      res.status(500).json({ error: 'Kunne ikke oppdatere tidslinjeelement' });
    }
  });

  router.delete('/projects/:projectId/producer/timeline/:itemId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const itemId = req.params.itemId;
    const userId = getUserId(req);

    try {
      const roleRecord = await getProjectRoleRecord(projectId, userId);
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å fjerne tidslinjeelementer' });
        return;
      }

      const deleted = await pool.query(
        `DELETE FROM role_room_phase_timeline_items
         WHERE project_id = $1 AND id = $2
         RETURNING id`,
        [projectId, itemId],
      );
      if (deleted.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke tidslinjeelement' });
        return;
      }

      res.json({ success: true, itemId });
    } catch (error) {
      console.error('Producer timeline delete error:', error);
      res.status(500).json({ error: 'Kunne ikke fjerne tidslinjeelement' });
    }
  });

  router.get('/projects/:projectId/producer/economy/items', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);
    try {
      const roleRecord = await getProjectRoleRecord(projectId, userId);
      if (!canReadProducerEconomy(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til økonomi' });
        return;
      }

      const result = await pool.query(
        `SELECT * FROM role_room_budget_items
         WHERE project_id = $1
         ORDER BY
           CASE phase
             WHEN 'preproduction' THEN 1
             WHEN 'production' THEN 2
             WHEN 'postproduction' THEN 3
             ELSE 4
           END,
           sort_order ASC,
           created_at ASC`,
        [projectId],
      );
      res.json({ items: result.rows });
    } catch (error) {
      console.error('Producer economy fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente økonomilinjer' });
    }
  });

  router.post('/projects/:projectId/producer/economy/items', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);
    const {
      phase,
      category,
      itemName,
      description,
      estimate,
      approved,
      actual,
      currency,
      status,
      clientVisible,
      linkedEntityType,
      linkedEntityId,
      sortOrder,
      metadata,
    } = req.body as Record<string, unknown>;

    if (!isProducerPhase(phase)) {
      res.status(400).json({ error: 'phase må være preproduction, production eller postproduction' });
      return;
    }
    if (typeof category !== 'string' || !category.trim()) {
      res.status(400).json({ error: 'category er påkrevd' });
      return;
    }
    if (typeof itemName !== 'string' || !itemName.trim()) {
      res.status(400).json({ error: 'itemName er påkrevd' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, userId);
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å opprette økonomilinjer' });
        return;
      }

      const id = crypto.randomUUID();
      const result = await pool.query(
        `INSERT INTO role_room_budget_items (
          id, project_id, phase, category, item_name, description,
          estimate, approved, actual, currency, status, client_visible,
          linked_entity_type, linked_entity_id, sort_order, metadata, created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16::jsonb, $17, NOW(), NOW()
        )
        RETURNING *`,
        [
          id,
          projectId,
          phase,
          category.trim(),
          itemName.trim(),
          typeof description === 'string' ? description : null,
          typeof estimate === 'number' ? estimate : 0,
          typeof approved === 'number' ? approved : 0,
          typeof actual === 'number' ? actual : 0,
          typeof currency === 'string' && currency.trim() ? currency.trim() : 'NOK',
          typeof status === 'string' && status.trim() ? status.trim() : 'draft',
          clientVisible !== false,
          typeof linkedEntityType === 'string' ? linkedEntityType : null,
          typeof linkedEntityId === 'string' ? linkedEntityId : null,
          typeof sortOrder === 'number' ? sortOrder : 0,
          JSON.stringify(metadata && typeof metadata === 'object' ? metadata : {}),
          userId,
        ],
      );

      res.status(201).json({ item: result.rows[0] });
    } catch (error) {
      console.error('Producer economy create error:', error);
      res.status(500).json({ error: 'Kunne ikke opprette økonomilinje' });
    }
  });

  router.patch('/projects/:projectId/producer/economy/items/:itemId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const itemId = req.params.itemId;
    const userId = getUserId(req);

    try {
      const roleRecord = await getProjectRoleRecord(projectId, userId);
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å oppdatere økonomilinjer' });
        return;
      }

      const payload = req.body as Record<string, unknown>;
      const sets: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      const addField = (column: string, value: unknown, cast?: string) => {
        const suffix = cast ? `::${cast}` : '';
        sets.push(`${column} = $${idx}${suffix}`);
        values.push(value);
        idx += 1;
      };

      if (isProducerPhase(payload.phase)) addField('phase', payload.phase);
      if (typeof payload.category === 'string') addField('category', payload.category.trim());
      if (typeof payload.itemName === 'string') addField('item_name', payload.itemName.trim());
      if (typeof payload.description === 'string' || payload.description === null) addField('description', payload.description);
      if (typeof payload.estimate === 'number') addField('estimate', payload.estimate);
      if (typeof payload.approved === 'number') addField('approved', payload.approved);
      if (typeof payload.actual === 'number') addField('actual', payload.actual);
      if (typeof payload.currency === 'string') addField('currency', payload.currency.trim() || 'NOK');
      if (typeof payload.status === 'string') addField('status', payload.status.trim() || 'draft');
      if (typeof payload.clientVisible === 'boolean') addField('client_visible', payload.clientVisible);
      if (typeof payload.linkedEntityType === 'string' || payload.linkedEntityType === null) addField('linked_entity_type', payload.linkedEntityType);
      if (typeof payload.linkedEntityId === 'string' || payload.linkedEntityId === null) addField('linked_entity_id', payload.linkedEntityId);
      if (typeof payload.sortOrder === 'number') addField('sort_order', payload.sortOrder);
      if (payload.metadata && typeof payload.metadata === 'object') addField('metadata', JSON.stringify(payload.metadata), 'jsonb');

      if (sets.length === 0) {
        res.status(400).json({ error: 'Ingen felter å oppdatere' });
        return;
      }

      sets.push(`updated_at = NOW()`);
      values.push(projectId, itemId);

      const result = await pool.query(
        `UPDATE role_room_budget_items
         SET ${sets.join(', ')}
         WHERE project_id = $${idx} AND id = $${idx + 1}
         RETURNING *`,
        values,
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke økonomilinje' });
        return;
      }

      res.json({ item: result.rows[0] });
    } catch (error) {
      console.error('Producer economy update error:', error);
      res.status(500).json({ error: 'Kunne ikke oppdatere økonomilinje' });
    }
  });

  router.delete('/projects/:projectId/producer/economy/items/:itemId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const itemId = req.params.itemId;
    const userId = getUserId(req);

    try {
      const roleRecord = await getProjectRoleRecord(projectId, userId);
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å slette økonomilinjer' });
        return;
      }

      const deleted = await pool.query(
        `DELETE FROM role_room_budget_items
         WHERE project_id = $1 AND id = $2
         RETURNING id`,
        [projectId, itemId],
      );
      if (deleted.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke økonomilinje' });
        return;
      }

      res.json({ success: true, itemId });
    } catch (error) {
      console.error('Producer economy delete error:', error);
      res.status(500).json({ error: 'Kunne ikke slette økonomilinje' });
    }
  });

  router.get('/projects/:projectId/producer/reviews', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);
    try {
      const roleRecord = await getProjectRoleRecord(projectId, userId);
      if (!canReadProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til godkjenningsflyt' });
        return;
      }

      const reviewsResult = await pool.query(
        `SELECT * FROM role_room_client_reviews
         WHERE project_id = $1
         ORDER BY requested_at DESC, created_at DESC`,
        [projectId],
      );
      const commentsResult = await pool.query(
        `SELECT * FROM role_room_client_review_comments
         WHERE project_id = $1
         ORDER BY created_at ASC`,
        [projectId],
      );

      const commentsByReview = commentsResult.rows.reduce<Record<string, unknown[]>>((acc, row) => {
        const reviewId = String((row as { review_id?: string }).review_id ?? '');
        if (!reviewId) return acc;
        if (!acc[reviewId]) acc[reviewId] = [];
        acc[reviewId].push(row);
        return acc;
      }, {});

      const items = reviewsResult.rows.map((row) => ({
        ...row,
        comments: commentsByReview[String((row as { id?: string }).id ?? '')] ?? [],
      }));
      res.json({ items });
    } catch (error) {
      console.error('Producer reviews fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente review-flyt' });
    }
  });

  router.post('/projects/:projectId/producer/reviews', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);
    const {
      reviewType,
      title,
      description,
      targetEntityType,
      targetEntityId,
      dueAt,
      metadata,
    } = req.body as Record<string, unknown>;

    if (typeof reviewType !== 'string' || !reviewType.trim()) {
      res.status(400).json({ error: 'reviewType er påkrevd' });
      return;
    }
    if (typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'title er påkrevd' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, userId);
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å opprette review' });
        return;
      }

      const id = crypto.randomUUID();
      const result = await pool.query(
        `INSERT INTO role_room_client_reviews (
          id, project_id, review_type, title, description, target_entity_type, target_entity_id,
          requested_by_user_id, requested_at, due_at, status, metadata, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, NOW(), $9, 'pending', $10::jsonb, NOW(), NOW()
        )
        RETURNING *`,
        [
          id,
          projectId,
          reviewType.trim(),
          title.trim(),
          typeof description === 'string' ? description : null,
          typeof targetEntityType === 'string' ? targetEntityType : null,
          typeof targetEntityId === 'string' ? targetEntityId : null,
          userId,
          typeof dueAt === 'string' ? dueAt : null,
          JSON.stringify(metadata && typeof metadata === 'object' ? metadata : {}),
        ],
      );
      res.status(201).json({ review: result.rows[0] });
    } catch (error) {
      console.error('Producer review create error:', error);
      res.status(500).json({ error: 'Kunne ikke opprette review' });
    }
  });

  router.post('/projects/:projectId/producer/reviews/:reviewId/comments', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const reviewId = req.params.reviewId;
    const userId = getUserId(req);
    const { commentText, timestampSeconds } = req.body as Record<string, unknown>;

    if (typeof commentText !== 'string' || !commentText.trim()) {
      res.status(400).json({ error: 'commentText er påkrevd' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, userId);
      if (!canCommentProducerReview(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å kommentere review' });
        return;
      }

      const reviewCheck = await pool.query(
        `SELECT id FROM role_room_client_reviews WHERE id = $1 AND project_id = $2`,
        [reviewId, projectId],
      );
      if (reviewCheck.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke review' });
        return;
      }

      const id = crypto.randomUUID();
      const result = await pool.query(
        `INSERT INTO role_room_client_review_comments (
          id, review_id, project_id, author_user_id, author_role, comment_text, timestamp_seconds, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *`,
        [
          id,
          reviewId,
          projectId,
          userId,
          roleRecord?.role ?? (requireScope(req, 'admin') ? 'admin' : 'unknown'),
          commentText.trim(),
          typeof timestampSeconds === 'number' ? Math.max(0, Math.floor(timestampSeconds)) : null,
        ],
      );
      await pool.query(`UPDATE role_room_client_reviews SET updated_at = NOW() WHERE id = $1`, [reviewId]);
      res.status(201).json({ comment: result.rows[0] });
    } catch (error) {
      console.error('Producer review comment create error:', error);
      res.status(500).json({ error: 'Kunne ikke opprette kommentar' });
    }
  });

  router.post('/projects/:projectId/producer/reviews/:reviewId/decision', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const reviewId = req.params.reviewId;
    const userId = getUserId(req);
    const { decision, reason, timestampSeconds } = req.body as Record<string, unknown>;

    if (!isProducerReviewDecision(decision)) {
      res.status(400).json({ error: 'decision må være approved, rejected eller changes_requested' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, userId);
      if (!canDecideProducerReview(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å beslutte review' });
        return;
      }

      const reviewResult = await pool.query(
        `SELECT * FROM role_room_client_reviews WHERE id = $1 AND project_id = $2 LIMIT 1`,
        [reviewId, projectId],
      );
      if (reviewResult.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke review' });
        return;
      }

      const reviewRow = reviewResult.rows[0] as { title?: string; id?: string };
      const updated = await pool.query(
        `UPDATE role_room_client_reviews
         SET status = $1,
             decision_by_user_id = $2,
             decision_at = NOW(),
             decision_reason = $3,
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [decision, userId, typeof reason === 'string' ? reason : null, reviewId],
      );

      if (typeof reason === 'string' && reason.trim()) {
        await pool.query(
          `INSERT INTO role_room_client_review_comments (
            id, review_id, project_id, author_user_id, author_role, comment_text, timestamp_seconds, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          [
            crypto.randomUUID(),
            reviewId,
            projectId,
            userId,
            roleRecord?.role ?? (requireScope(req, 'admin') ? 'admin' : 'unknown'),
            reason.trim(),
            typeof timestampSeconds === 'number' ? Math.max(0, Math.floor(timestampSeconds)) : null,
          ],
        );
      }

      await pool.query(
        `INSERT INTO role_room_phase_timeline_items (
          id, project_id, phase, title, description, status, linked_entity_type, linked_entity_id, sort_order, metadata, created_by, created_at, updated_at
        ) VALUES (
          $1, $2, 'production', $3, $4, $5, 'client_review', $6, 0, $7::jsonb, $8, NOW(), NOW()
        )`,
        [
          crypto.randomUUID(),
          projectId,
          `Klientbeslutning: ${reviewRow.title ?? 'Review'}`,
          typeof reason === 'string' ? reason : null,
          decision,
          reviewRow.id ?? reviewId,
          JSON.stringify({ decision }),
          userId,
        ],
      );

      res.json({ review: updated.rows[0] });
    } catch (error) {
      console.error('Producer review decision error:', error);
      res.status(500).json({ error: 'Kunne ikke oppdatere review-beslutning' });
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
  // Locations (compat routes expected by role-room frontend)
  // ═══════════════════════════════════════════════════════════

  router.get('/projects/:projectId/locations', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        'SELECT * FROM casting_locations WHERE project_id = $1 ORDER BY name',
        [req.params.projectId]
      );
      res.json({ locations: result.rows });
    } catch (err) {
      console.error('Fetch locations error:', err);
      res.status(500).json({ error: 'Kunne ikke hente lokasjoner' });
    }
  });

  router.post('/locations', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const projectId = body.project_id as string | undefined;
    const name = body.name as string | undefined;
    if (!projectId || !name) {
      res.status(400).json({ error: 'project_id og name er påkrevd' });
      return;
    }

    const id = makeId();
    const locationData = (body.location_data as Record<string, unknown> | undefined) ?? {};
    const coordinates = (locationData.coordinates as Record<string, unknown> | undefined)
      ?? (body.coordinates as Record<string, unknown> | undefined)
      ?? null;
    const contactInfo = (locationData.contact_info as Record<string, unknown> | undefined)
      ?? (body.contact_info as Record<string, unknown> | undefined)
      ?? {};
    const photos = Array.isArray(locationData.photos)
      ? locationData.photos
      : Array.isArray(body.photos)
        ? body.photos
        : [];

    try {
      const result = await pool.query(
        `INSERT INTO casting_locations
          (id, project_id, name, address, coordinates, type, contact_info, access_notes, photos)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          id,
          projectId,
          name,
          (body.address as string | undefined) ?? (locationData.address as string | undefined) ?? null,
          coordinates ? JSON.stringify(coordinates) : null,
          (body.type as string | undefined) ?? (locationData.type as string | undefined) ?? null,
          JSON.stringify(contactInfo),
          (locationData.access_notes as string | undefined) ?? (body.access_notes as string | undefined) ?? null,
          JSON.stringify(photos),
        ]
      );
      res.status(201).json({ location: result.rows[0] });
    } catch (err) {
      console.error('Create location error:', err);
      res.status(500).json({ error: 'Kunne ikke opprette lokasjon' });
    }
  });

  router.delete('/locations/:locationId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    try {
      await pool.query('DELETE FROM casting_locations WHERE id = $1', [req.params.locationId]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete location error:', err);
      res.status(500).json({ error: 'Kunne ikke slette lokasjon' });
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
  // Calendar Events (Role Room planner compatibility API)
  // ═══════════════════════════════════════════════════════════

  router.get('/projects/:projectId/calendar-events', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const hasProjectAccess = await ensureProjectAccess(projectId);
    if (!hasProjectAccess) {
      res.status(404).json({ success: false, error: 'Prosjekt ikke funnet' });
      return;
    }
    if (!(await ensureRoleRoomCalendarEventsTable())) {
      res.status(500).json({ success: false, error: 'Kalenderlager ikke tilgjengelig' });
      return;
    }

    try {
      const result = await pool.query(
        `SELECT
          id,
          project_id,
          title,
          description,
          event_type,
          start_time,
          end_time,
          location_id,
          all_day,
          candidate_ids,
          crew_ids,
          equipment_ids,
          shot_list_ids,
          notes,
          status
         FROM role_room_calendar_events
         WHERE project_id = $1
         ORDER BY start_time ASC, created_at ASC`,
        [projectId],
      );
      const events = result.rows.map((row) => ({
        id: String(row.id),
        project_id: String(row.project_id),
        title: String(row.title),
        description: row.description ?? undefined,
        event_type: String(row.event_type || 'general'),
        start_time: row.start_time instanceof Date ? row.start_time.toISOString() : String(row.start_time),
        end_time: row.end_time instanceof Date ? row.end_time.toISOString() : (row.end_time ? String(row.end_time) : undefined),
        location_id: row.location_id ?? undefined,
        all_day: row.all_day === true,
        candidate_ids: toStringArray(row.candidate_ids),
        crew_ids: toStringArray(row.crew_ids),
        equipment_ids: toStringArray(row.equipment_ids),
        shot_list_ids: toStringArray(row.shot_list_ids),
        notes: row.notes ?? undefined,
        status: row.status ?? 'scheduled',
      }));
      res.json({ events });
    } catch (error) {
      console.error('GET calendar events error:', error);
      res.status(500).json({ success: false, error: 'Kunne ikke hente kalenderhendelser' });
    }
  });

  router.post('/calendar-events', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    if (!(await ensureRoleRoomCalendarEventsTable())) {
      res.status(500).json({ success: false, error: 'Kalenderlager ikke tilgjengelig' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const projectId = typeof body.projectId === 'string'
      ? body.projectId
      : typeof body.project_id === 'string'
        ? body.project_id
        : '';
    if (!projectId || !(await ensureProjectAccess(projectId))) {
      res.status(404).json({ success: false, error: 'Prosjekt ikke funnet' });
      return;
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const startTimeRaw = typeof body.startTime === 'string'
      ? body.startTime
      : typeof body.start_time === 'string'
        ? body.start_time
        : '';
    const endTimeRaw = typeof body.endTime === 'string'
      ? body.endTime
      : typeof body.end_time === 'string'
        ? body.end_time
        : '';
    const startTime = Date.parse(startTimeRaw);
    const endTime = endTimeRaw ? Date.parse(endTimeRaw) : NaN;
    if (!title || !Number.isFinite(startTime)) {
      res.status(400).json({ success: false, error: 'Tittel og gyldig starttid er påkrevd' });
      return;
    }
    if (endTimeRaw && !Number.isFinite(endTime)) {
      res.status(400).json({ success: false, error: 'Sluttid er ugyldig' });
      return;
    }

    const eventId = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : makeId();
    const eventType = typeof body.eventType === 'string'
      ? body.eventType
      : typeof body.event_type === 'string'
        ? body.event_type
        : 'general';
    const actorId = getUserId(req);

    try {
      await pool.query(
        `INSERT INTO role_room_calendar_events (
          id,
          project_id,
          title,
          description,
          event_type,
          start_time,
          end_time,
          location_id,
          all_day,
          candidate_ids,
          crew_ids,
          equipment_ids,
          shot_list_ids,
          notes,
          status,
          created_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$16
        )`,
        [
          eventId,
          projectId,
          title,
          typeof body.description === 'string' ? body.description : null,
          eventType,
          new Date(startTime).toISOString(),
          Number.isFinite(endTime) ? new Date(endTime).toISOString() : null,
          typeof body.locationId === 'string'
            ? body.locationId
            : typeof body.location_id === 'string'
              ? body.location_id
              : null,
          body.allDay === true || body.all_day === true,
          JSON.stringify(toStringArray(body.candidateIds ?? body.candidate_ids)),
          JSON.stringify(toStringArray(body.crewIds ?? body.crew_ids)),
          JSON.stringify(toStringArray(body.equipmentIds ?? body.equipment_ids)),
          JSON.stringify(toStringArray(body.shotListIds ?? body.shot_list_ids)),
          typeof body.notes === 'string' ? body.notes : null,
          typeof body.status === 'string' ? body.status : 'scheduled',
          actorId,
        ],
      );
      res.status(201).json({ eventId });
    } catch (error) {
      console.error('POST calendar event error:', error);
      res.status(500).json({ success: false, error: 'Kunne ikke opprette kalenderhendelse' });
    }
  });

  router.put('/calendar-events/:eventId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    if (!(await ensureRoleRoomCalendarEventsTable())) {
      res.status(500).json({ success: false, error: 'Kalenderlager ikke tilgjengelig' });
      return;
    }

    const { eventId } = req.params;
    const body = req.body as Record<string, unknown>;

    try {
      const existing = await pool.query(
        `SELECT project_id FROM role_room_calendar_events WHERE id = $1 LIMIT 1`,
        [eventId],
      );
      if ((existing.rowCount ?? 0) === 0) {
        res.status(404).json({ success: false, error: 'Kalenderhendelse ikke funnet' });
        return;
      }
      const projectId = String(existing.rows[0].project_id);
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ success: false, error: 'Prosjekt ikke funnet' });
        return;
      }

      const updates: string[] = [];
      const values: unknown[] = [eventId];

      const setField = (column: string, value: unknown): void => {
        values.push(value);
        updates.push(`${column} = $${values.length}`);
      };

      if (typeof body.title === 'string') setField('title', body.title.trim());
      if ('description' in body) setField('description', typeof body.description === 'string' ? body.description : null);
      if (typeof body.eventType === 'string') setField('event_type', body.eventType);
      if (typeof body.event_type === 'string') setField('event_type', body.event_type);

      if (typeof body.startTime === 'string' || typeof body.start_time === 'string') {
        const raw = typeof body.startTime === 'string' ? body.startTime : body.start_time as string;
        const parsed = Date.parse(raw);
        if (!Number.isFinite(parsed)) {
          res.status(400).json({ success: false, error: 'Starttid er ugyldig' });
          return;
        }
        setField('start_time', new Date(parsed).toISOString());
      }

      if ('endTime' in body || 'end_time' in body) {
        const raw = typeof body.endTime === 'string'
          ? body.endTime
          : typeof body.end_time === 'string'
            ? body.end_time
            : '';
        if (!raw) {
          setField('end_time', null);
        } else {
          const parsed = Date.parse(raw);
          if (!Number.isFinite(parsed)) {
            res.status(400).json({ success: false, error: 'Sluttid er ugyldig' });
            return;
          }
          setField('end_time', new Date(parsed).toISOString());
        }
      }

      if ('locationId' in body || 'location_id' in body) {
        const locationId = typeof body.locationId === 'string'
          ? body.locationId
          : typeof body.location_id === 'string'
            ? body.location_id
            : null;
        setField('location_id', locationId);
      }
      if ('allDay' in body || 'all_day' in body) {
        setField('all_day', body.allDay === true || body.all_day === true);
      }
      if ('candidateIds' in body || 'candidate_ids' in body) {
        setField('candidate_ids', JSON.stringify(toStringArray(body.candidateIds ?? body.candidate_ids)));
        updates[updates.length - 1] += '::jsonb';
      }
      if ('crewIds' in body || 'crew_ids' in body) {
        setField('crew_ids', JSON.stringify(toStringArray(body.crewIds ?? body.crew_ids)));
        updates[updates.length - 1] += '::jsonb';
      }
      if ('equipmentIds' in body || 'equipment_ids' in body) {
        setField('equipment_ids', JSON.stringify(toStringArray(body.equipmentIds ?? body.equipment_ids)));
        updates[updates.length - 1] += '::jsonb';
      }
      if ('shotListIds' in body || 'shot_list_ids' in body) {
        setField('shot_list_ids', JSON.stringify(toStringArray(body.shotListIds ?? body.shot_list_ids)));
        updates[updates.length - 1] += '::jsonb';
      }
      if ('notes' in body) {
        setField('notes', typeof body.notes === 'string' ? body.notes : null);
      }
      if ('status' in body) {
        setField('status', typeof body.status === 'string' ? body.status : 'scheduled');
      }

      if (updates.length === 0) {
        res.json({ ok: true });
        return;
      }

      await pool.query(
        `UPDATE role_room_calendar_events
         SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $1`,
        values,
      );
      res.json({ ok: true });
    } catch (error) {
      console.error('PUT calendar event error:', error);
      res.status(500).json({ success: false, error: 'Kunne ikke oppdatere kalenderhendelse' });
    }
  });

  router.delete('/calendar-events/:eventId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    if (!(await ensureRoleRoomCalendarEventsTable())) {
      res.status(500).json({ success: false, error: 'Kalenderlager ikke tilgjengelig' });
      return;
    }
    const { eventId } = req.params;
    try {
      const result = await pool.query(
        `DELETE FROM role_room_calendar_events WHERE id = $1`,
        [eventId],
      );
      if ((result.rowCount ?? 0) === 0) {
        res.status(404).json({ success: false, error: 'Kalenderhendelse ikke funnet' });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      console.error('DELETE calendar event error:', error);
      res.status(500).json({ success: false, error: 'Kunne ikke slette kalenderhendelse' });
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
          [makeId(), castingProjectId, userId, JSON.stringify(buildProjectRolePermissions('director'))]
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
         ON CONFLICT (project_id, user_id) DO UPDATE SET role = $4, permissions = $5, email = $3, updated_at = NOW()`,
        [makeId(), userId, email ?? null, mappedRole, JSON.stringify(buildProjectRolePermissions(mappedRole))]
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

  type LiveSetEventTypeV2 =
    | 'roll'
    | 'cut'
    | 'capture_take'
    | 'set_take_status'
    | 'add_flag'
    | 'add_note'
    | 'update_note'
    | 'delete_note'
    | 'set_scene'
    | 'setup_complete'
    | 'advance_scene'
    | 'set_camera'
    | 'set_setup'
    | 'set_cam'
    | 'quick_action';

  interface LiveSetEventV2 {
    eventId: string;
    sessionId: string;
    seq: number;
    type: LiveSetEventTypeV2;
    payload: Record<string, unknown>;
    capturedAt: string;
    deviceId: string;
    operatorId: string;
    projectId: string;
    shootingDayId?: string;
    ingestedAt: string;
  }

  interface LiveSetSessionV2 {
    sessionId: string;
    projectId: string;
    operatorId: string;
    deviceId: string;
    shootingDayId?: string;
    startedAt: string;
    endedAt?: string;
    metadata?: Record<string, unknown>;
  }

  interface LiveSetConflictV2 {
    eventId?: string;
    sessionId?: string;
    seq?: number;
    type: string;
    reason: string;
    serverValue?: unknown;
    clientValue?: unknown;
    resolvedBy?: 'server' | 'client' | 'merge';
    timestamp?: string;
  }

  const liveSetEventTypeValues = [
    'roll',
    'cut',
    'capture_take',
    'set_take_status',
    'add_flag',
    'add_note',
    'update_note',
    'delete_note',
    'set_scene',
    'setup_complete',
    'advance_scene',
    'set_camera',
    'set_setup',
    'set_cam',
    'quick_action',
  ] as const satisfies readonly LiveSetEventTypeV2[];

  const liveSetSessionSchema = z.object({
    sessionId: z.string().min(2).max(128).optional(),
    operatorId: z.string().min(1).max(160),
    deviceId: z.string().min(1).max(240),
    shootingDayId: z.string().min(1).max(160).optional(),
    metadata: z.record(z.unknown()).optional(),
  });

  const liveSetEventSchema = z.object({
    eventId: z.string().min(4).max(160),
    sessionId: z.string().min(2).max(128),
    seq: z.number().int().positive(),
    type: z.enum(liveSetEventTypeValues),
    payload: z.record(z.unknown()).default({}),
    capturedAt: z.string().min(4),
    deviceId: z.string().min(1).max(240),
    operatorId: z.string().min(1).max(160),
    projectId: z.string().min(1).max(160).optional(),
    shootingDayId: z.string().max(160).optional(),
  });

  const liveSetBatchSchema = z.object({
    sessionId: z.string().min(2).max(128),
    events: z.array(liveSetEventSchema).min(1).max(500),
  });

  const liveSetAckSchema = z.object({
    sessionId: z.string().min(2).max(128),
    eventIds: z.array(z.string().min(4).max(160)).min(1).max(2000),
  });

  const liveSetSessionsStore = new Map<string, LiveSetSessionV2[]>();
  const liveSetEventsV2Store = new Map<string, LiveSetEventV2[]>();
  const liveSetAckStore = new Map<string, Record<string, string[]>>();

  const liveSetSessionsDbKey = (projectId: string) => `role-room:liveset:v2:sessions:${projectId}`;
  const liveSetEventsV2DbKey = (projectId: string) => `role-room:liveset:v2:events:${projectId}`;
  const liveSetAckDbKey = (projectId: string) => `role-room:liveset:v2:acks:${projectId}`;
  const roleRoomProjectAccessCache = new Set<string>();
  let castingProjectsTableReadyPromise: Promise<boolean> | null = null;

  function normalizeRoleRoomProjectName(projectId: string): string {
    const normalized = projectId
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return 'Role Room prosjekt';
    return normalized
      .split(' ')
      .map((segment) => (segment ? `${segment[0].toUpperCase()}${segment.slice(1)}` : segment))
      .join(' ')
      .slice(0, 255);
  }

  async function ensureCastingProjectsTable(): Promise<boolean> {
    if (castingProjectsTableReadyPromise) return castingProjectsTableReadyPromise;
    castingProjectsTableReadyPromise = (async () => {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS casting_projects (
            id VARCHAR(255) PRIMARY KEY NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(50) DEFAULT 'active',
            created_by VARCHAR(255),
            genre VARCHAR(100),
            project_type VARCHAR(100),
            start_date DATE,
            end_date DATE,
            budget NUMERIC(12, 2),
            currency VARCHAR(10) DEFAULT 'NOK',
            settings JSONB DEFAULT '{}'::jsonb,
            metadata JSONB DEFAULT '{}'::jsonb,
            creatorhub_project_id VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
          );
          CREATE INDEX IF NOT EXISTS casting_projects_created_by_idx ON casting_projects (created_by);
          CREATE INDEX IF NOT EXISTS casting_projects_status_idx ON casting_projects (status);
          CREATE INDEX IF NOT EXISTS casting_projects_creatorhub_project_id_idx ON casting_projects (creatorhub_project_id);
        `);
        return true;
      } catch (error) {
        console.warn('Role Room casting_projects table unavailable:', error);
        return false;
      }
    })();
    return castingProjectsTableReadyPromise;
  }

  async function ensureProjectAccess(projectId: string, options?: { allowBootstrap?: boolean }): Promise<boolean> {
    const trimmedProjectId = projectId?.trim();
    if (!trimmedProjectId) return false;
    if (roleRoomProjectAccessCache.has(trimmedProjectId)) return true;
    const tableReady = await ensureCastingProjectsTable();
    if (!tableReady) {
      if (isRoleRoomDevBypassEnabled()) {
        roleRoomProjectAccessCache.add(trimmedProjectId);
        return true;
      }
      return false;
    }
    try {
      const result = await pool.query('SELECT id FROM casting_projects WHERE id = $1 LIMIT 1', [trimmedProjectId]);
      if ((result.rowCount ?? 0) > 0) {
        roleRoomProjectAccessCache.add(trimmedProjectId);
        return true;
      }

      const allowBootstrap = options?.allowBootstrap ?? true;
      if (!allowBootstrap) {
        return false;
      }

      await pool.query(
        `INSERT INTO casting_projects
          (id, name)
         VALUES ($1, $2)
         ON CONFLICT (id) DO NOTHING`,
        [
          trimmedProjectId,
          normalizeRoleRoomProjectName(trimmedProjectId),
        ],
      );

      const postInsertResult = await pool.query(
        'SELECT id FROM casting_projects WHERE id = $1 LIMIT 1',
        [trimmedProjectId],
      );
      if ((postInsertResult.rowCount ?? 0) > 0) {
        roleRoomProjectAccessCache.add(trimmedProjectId);
        return true;
      }

      if (isRoleRoomDevBypassEnabled()) {
        roleRoomProjectAccessCache.add(trimmedProjectId);
        return true;
      }
      return false;
    } catch {
      if (isRoleRoomDevBypassEnabled()) {
        roleRoomProjectAccessCache.add(trimmedProjectId);
        return true;
      }
      return false;
    }
  }

  let roleRoomCalendarEventsTableReadyPromise: Promise<boolean> | null = null;
  async function ensureRoleRoomCalendarEventsTable(): Promise<boolean> {
    if (roleRoomCalendarEventsTableReadyPromise) return roleRoomCalendarEventsTableReadyPromise;
    roleRoomCalendarEventsTableReadyPromise = (async () => {
      try {
        const castingProjectsReady = await ensureCastingProjectsTable();
        if (!castingProjectsReady) return false;
        await pool.query(`
          CREATE TABLE IF NOT EXISTS role_room_calendar_events (
            id VARCHAR(255) PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            event_type VARCHAR(64) NOT NULL DEFAULT 'general',
            start_time TIMESTAMPTZ NOT NULL,
            end_time TIMESTAMPTZ,
            location_id VARCHAR(255),
            all_day BOOLEAN NOT NULL DEFAULT FALSE,
            candidate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            crew_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            equipment_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            shot_list_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            notes TEXT,
            status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
            created_by VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_calendar_events_project ON role_room_calendar_events(project_id);
          CREATE INDEX IF NOT EXISTS idx_rr_calendar_events_start_time ON role_room_calendar_events(start_time);
        `);
        return true;
      } catch (error) {
        console.warn('Role Room calendar events table unavailable:', error);
        return false;
      }
    })();
    return roleRoomCalendarEventsTableReadyPromise;
  }

  function toStringArray(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
        }
      } catch {
        // ignore malformed json payloads
      }
      return raw.trim().length > 0 ? [raw.trim()] : [];
    }
    return [];
  }

  async function getLiveSetSessionsV2(projectId: string): Promise<LiveSetSessionV2[]> {
    const memory = liveSetSessionsStore.get(projectId);
    if (Array.isArray(memory)) return memory;
    const fromDb = await compatStoreGet<LiveSetSessionV2[]>(liveSetSessionsDbKey(projectId));
    if (Array.isArray(fromDb)) {
      liveSetSessionsStore.set(projectId, fromDb);
      return fromDb;
    }
    return [];
  }

  async function setLiveSetSessionsV2(projectId: string, sessions: LiveSetSessionV2[]): Promise<void> {
    liveSetSessionsStore.set(projectId, sessions);
    await compatStoreSet(liveSetSessionsDbKey(projectId), sessions.slice(-500));
  }

  async function getLiveSetEventsV2(projectId: string): Promise<LiveSetEventV2[]> {
    const memory = liveSetEventsV2Store.get(projectId);
    if (Array.isArray(memory)) return memory;
    const fromDb = await compatStoreGet<LiveSetEventV2[]>(liveSetEventsV2DbKey(projectId));
    if (Array.isArray(fromDb)) {
      liveSetEventsV2Store.set(projectId, fromDb);
      return fromDb;
    }
    return [];
  }

  async function setLiveSetEventsV2(projectId: string, events: LiveSetEventV2[]): Promise<void> {
    const trimmed = events.slice(-25000);
    liveSetEventsV2Store.set(projectId, trimmed);
    await compatStoreSet(liveSetEventsV2DbKey(projectId), trimmed);
  }

  async function getLiveSetAcks(projectId: string): Promise<Record<string, string[]>> {
    const memory = liveSetAckStore.get(projectId);
    if (memory && typeof memory === 'object') return memory;
    const fromDb = await compatStoreGet<Record<string, string[]>>(liveSetAckDbKey(projectId));
    if (fromDb && typeof fromDb === 'object') {
      liveSetAckStore.set(projectId, fromDb);
      return fromDb;
    }
    return {};
  }

  async function setLiveSetAcks(projectId: string, ackState: Record<string, string[]>): Promise<void> {
    liveSetAckStore.set(projectId, ackState);
    await compatStoreSet(liveSetAckDbKey(projectId), ackState);
  }

  function normalizeTakeStatus(raw: unknown): string {
    const value = typeof raw === 'string' ? raw.trim().toLowerCase() : 'normal';
    if (value === 'circle') return 'circled';
    if (value === 'good') return 'selected';
    if (value === 'ok' || value === 'bad') return 'normal';
    if (['selected', 'circled', 'print', 'normal'].includes(value)) return value;
    return 'normal';
  }

  function statusPriority(raw: unknown): number {
    const normalized = normalizeTakeStatus(raw);
    if (normalized === 'selected') return 4;
    if (normalized === 'circled') return 3;
    if (normalized === 'print') return 2;
    return 1;
  }

  function extractTakeStatusSignal(event: LiveSetEventV2): { takeKey: string; status: string } | null {
    const payload = event.payload;
    const takeId = typeof payload.id === 'string'
      ? payload.id
      : typeof payload.takeId === 'string'
        ? payload.takeId
        : typeof payload.shotId === 'string'
          ? `shot:${payload.shotId}`
          : '';
    if (!takeId) return null;

    if (event.type === 'set_take_status') {
      return { takeKey: takeId, status: normalizeTakeStatus(payload.status) };
    }
    if (event.type === 'capture_take') {
      return { takeKey: takeId, status: normalizeTakeStatus(payload.quality ?? payload.status) };
    }
    return null;
  }

  const backupKeys = ['backupOriginal', 'backupPrimary', 'backupSecondary', 'backupOffsite'] as const;

  function hasBackupFields(payload: Record<string, unknown>): boolean {
    return backupKeys.some((field) => field in payload);
  }

  function toBoolean(raw: unknown): boolean {
    return raw === true;
  }

  interface WeatherCacheEntry {
    locationLabel: string;
    lat: number;
    lon: number;
    current: Record<string, unknown>;
    alerts: Array<Record<string, unknown>>;
    fetchedAt: number;
  }

  const liveWeatherCache = new Map<string, WeatherCacheEntry>();
  const LIVE_WEATHER_TTL_MS = 60_000;
  const LIVE_SET_RATE_LIMIT_WINDOW_MS = 10_000;
  const LIVE_SET_RATE_LIMIT_MAX_BATCHES = 20;

  const liveSetBatchRateLimit = new Map<string, { windowStart: number; count: number }>();
  const liveSetMetrics = {
    takeCaptureLatencyMs: [] as number[],
    syncQueueDepthSamples: [] as number[],
    syncFailures: 0,
    syncBatches: 0,
    weatherFetchErrors: 0,
  };

  function sampleMetric(values: number[], value: number, maxSamples = 1000): void {
    if (!Number.isFinite(value)) return;
    values.push(value);
    if (values.length > maxSamples) {
      values.splice(0, values.length - maxSamples);
    }
  }

  function isLiveSetBatchRateLimited(rateKey: string): boolean {
    const now = Date.now();
    const current = liveSetBatchRateLimit.get(rateKey);
    if (!current || now - current.windowStart > LIVE_SET_RATE_LIMIT_WINDOW_MS) {
      liveSetBatchRateLimit.set(rateKey, { windowStart: now, count: 1 });
      return false;
    }
    current.count += 1;
    liveSetBatchRateLimit.set(rateKey, current);
    return current.count > LIVE_SET_RATE_LIMIT_MAX_BATCHES;
  }

  function resolveWeatherCoordinates(location?: string, latRaw?: unknown, lonRaw?: unknown): {
    locationLabel: string;
    lat: number;
    lon: number;
  } {
    const lat = typeof latRaw === 'number' && Number.isFinite(latRaw) ? latRaw : null;
    const lon = typeof lonRaw === 'number' && Number.isFinite(lonRaw) ? lonRaw : null;
    if (lat != null && lon != null) {
      return { locationLabel: location?.trim() || 'Scene', lat, lon };
    }

    const label = (location || 'oslo').trim().toLowerCase();
    const map: Record<string, { lat: number; lon: number; label: string }> = {
      oslo: { lat: 59.9139, lon: 10.7522, label: 'Oslo' },
      bergen: { lat: 60.3913, lon: 5.3221, label: 'Bergen' },
      trondheim: { lat: 63.4305, lon: 10.3951, label: 'Trondheim' },
      stavanger: { lat: 58.97, lon: 5.7331, label: 'Stavanger' },
      tromsø: { lat: 69.6492, lon: 18.9553, label: 'Tromsø' },
      kristiansand: { lat: 58.1467, lon: 7.9956, label: 'Kristiansand' },
    };
    const fallback = map[label] ?? map.oslo;
    return { locationLabel: fallback.label, lat: fallback.lat, lon: fallback.lon };
  }

  function normalizeWeatherAlerts(current: Record<string, unknown>): Array<Record<string, unknown>> {
    const alerts: Array<Record<string, unknown>> = [];
    const symbol = typeof current.symbolCode === 'string' ? current.symbolCode.toLowerCase() : '';
    const precipitation = typeof current.precipitation === 'number' ? current.precipitation : 0;
    const windSpeed = typeof current.windSpeed === 'number' ? current.windSpeed : 0;

    if (symbol.includes('thunder')) {
      alerts.push({
        id: `alert-thunder-${Date.now()}`,
        severity: 'critical',
        category: 'thunder',
        title: 'Tordenvær registrert',
        description: 'Sterk torden i området. Vurder å stoppe opptak utendørs.',
        recommendedAction: 'Stans utsatt opptak og sikre crew/utstyr.',
        blockingRisk: true,
        startsAt: nowISO(),
      });
    }
    if (windSpeed >= 14) {
      alerts.push({
        id: `alert-wind-${Date.now()}`,
        severity: windSpeed >= 20 ? 'critical' : 'warning',
        category: 'wind',
        title: 'Sterk vind varslet',
        description: `Vind opp til ${windSpeed} m/s.`,
        recommendedAction: 'Sikre lysrigg, stativer og lette rekvisitter.',
        blockingRisk: windSpeed >= 18,
        startsAt: nowISO(),
      });
    }
    if (precipitation >= 5) {
      alerts.push({
        id: `alert-rain-${Date.now()}`,
        severity: precipitation >= 8 ? 'critical' : 'warning',
        category: 'rain',
        title: 'Kraftig nedbør',
        description: `${precipitation} mm nedbør registrert/forventet.`,
        recommendedAction: 'Flytt til værbeskyttet oppsett eller dekk teknisk rigg.',
        blockingRisk: precipitation >= 8,
        startsAt: nowISO(),
      });
    }

    return alerts;
  }

  router.post('/projects/:projectId/live-set/sessions', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    if (!(await ensureProjectAccess(projectId))) {
      res.status(404).json({ success: false, error: 'Prosjekt ikke funnet' });
      return;
    }

    const parsed = liveSetSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Ugyldig session payload', issues: parsed.error.issues });
      return;
    }

    const payload = parsed.data;
    const sessions = await getLiveSetSessionsV2(projectId);
    const existing = payload.sessionId
      ? sessions.find((entry) => entry.sessionId === payload.sessionId)
      : undefined;
    if (existing) {
      res.json({ success: true, session: existing });
      return;
    }

    const session: LiveSetSessionV2 = {
      sessionId: payload.sessionId || `liveset-${crypto.randomUUID()}`,
      projectId,
      operatorId: payload.operatorId,
      deviceId: payload.deviceId,
      shootingDayId: payload.shootingDayId,
      startedAt: nowISO(),
      metadata: payload.metadata,
    };
    sessions.push(session);
    await setLiveSetSessionsV2(projectId, sessions);
    await appendAudit(projectId, payload.shootingDayId ?? 'global', 'live_set_session_started', session, payload.operatorId);

    res.json({ success: true, session });
  });

  router.post('/projects/:projectId/live-set/events/batch', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    if (!(await ensureProjectAccess(projectId))) {
      res.status(404).json({ success: false, error: 'Prosjekt ikke funnet' });
      return;
    }

    const actorId = getUserId(req);
    const rateKey = `${projectId}:${actorId}`;
    if (isLiveSetBatchRateLimited(rateKey)) {
      res.status(429).json({ success: false, error: 'Rate limit exceeded for live set batch ingest' });
      return;
    }

    const parsed = liveSetBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Ugyldig batch payload', issues: parsed.error.issues });
      return;
    }

    const { sessionId, events } = parsed.data;
    const normalized = [...events].sort((left, right) => left.seq - right.seq);
    const sessions = await getLiveSetSessionsV2(projectId);
    const hasRegisteredSession = sessions.some((entry) => entry.sessionId === sessionId);
    if (!hasRegisteredSession) {
      const seedEvent = normalized[0];
      if (!seedEvent) {
        res.status(400).json({ success: false, error: 'Batch mangler events' });
        return;
      }

      const bootstrappedSession: LiveSetSessionV2 = {
        sessionId,
        projectId,
        operatorId: seedEvent.operatorId,
        deviceId: seedEvent.deviceId,
        shootingDayId: seedEvent.shootingDayId,
        startedAt: seedEvent.capturedAt || nowISO(),
        metadata: {
          source: 'batch-bootstrap',
        },
      };
      sessions.push(bootstrappedSession);
      await setLiveSetSessionsV2(projectId, sessions);
      await appendAudit(
        projectId,
        seedEvent.shootingDayId ?? 'global',
        'live_set_session_bootstrapped',
        {
          sessionId,
          operatorId: seedEvent.operatorId,
          deviceId: seedEvent.deviceId,
          seedEventId: seedEvent.eventId,
        },
        actorId,
      );
    }

    const storedEvents = await getLiveSetEventsV2(projectId);
    const existingById = new Map(storedEvents.map((event) => [event.eventId, event]));
    const highestSeqBySession = new Map<string, number>();
    const strongestStatusByTake = new Map<string, { status: string; priority: number; eventId: string }>();
    const backupState = {
      backupOriginal: false,
      backupPrimary: false,
      backupSecondary: false,
      backupOffsite: false,
    };

    for (const event of storedEvents) {
      highestSeqBySession.set(
        event.sessionId,
        Math.max(highestSeqBySession.get(event.sessionId) ?? 0, event.seq),
      );
      const signal = extractTakeStatusSignal(event);
      if (signal) {
        const priority = statusPriority(signal.status);
        const current = strongestStatusByTake.get(signal.takeKey);
        if (!current || priority >= current.priority) {
          strongestStatusByTake.set(signal.takeKey, { status: signal.status, priority, eventId: event.eventId });
        }
      }
      if (hasBackupFields(event.payload)) {
        backupKeys.forEach((field) => {
          if (toBoolean(event.payload[field])) {
            backupState[field] = true;
          }
        });
      }
    }

    const ackedEventIds: string[] = [];
    const rejected: Array<{ eventId: string; reason: string; code?: string }> = [];
    const conflicts: LiveSetConflictV2[] = [];
    const accepted: LiveSetEventV2[] = [];

    for (const incoming of normalized) {
      if (incoming.sessionId !== sessionId) {
        rejected.push({ eventId: incoming.eventId, reason: 'sessionId mismatch in batch', code: 'session_mismatch' });
        continue;
      }
      if (existingById.has(incoming.eventId)) {
        ackedEventIds.push(incoming.eventId);
        continue;
      }

      const highestSeq = highestSeqBySession.get(incoming.sessionId) ?? 0;
      if (incoming.seq <= highestSeq) {
        rejected.push({
          eventId: incoming.eventId,
          reason: `Sequence replay detected (${incoming.seq} <= ${highestSeq})`,
          code: 'seq_replay',
        });
        continue;
      }

      const payload: Record<string, unknown> = { ...incoming.payload };
      const event: LiveSetEventV2 = {
        eventId: incoming.eventId,
        sessionId: incoming.sessionId,
        seq: incoming.seq,
        type: incoming.type,
        payload,
        capturedAt: incoming.capturedAt,
        deviceId: incoming.deviceId,
        operatorId: incoming.operatorId,
        projectId,
        shootingDayId: incoming.shootingDayId,
        ingestedAt: nowISO(),
      };

      const signal = extractTakeStatusSignal(event);
      if (signal) {
        const incomingPriority = statusPriority(signal.status);
        const existing = strongestStatusByTake.get(signal.takeKey);
        if (existing && incomingPriority < existing.priority) {
          conflicts.push({
            eventId: event.eventId,
            sessionId: event.sessionId,
            seq: event.seq,
            type: 'take_status_priority',
            reason: 'Lower-priority take status was overridden by server',
            serverValue: existing.status,
            clientValue: signal.status,
            resolvedBy: 'server',
            timestamp: nowISO(),
          });
          payload.status = existing.status;
          payload.quality = existing.status;
        } else {
          strongestStatusByTake.set(signal.takeKey, {
            status: normalizeTakeStatus(payload.status ?? payload.quality),
            priority: Math.max(incomingPriority, existing?.priority ?? 0),
            eventId: event.eventId,
          });
        }
      }

      if (hasBackupFields(payload)) {
        backupKeys.forEach((field) => {
          if (backupState[field] && payload[field] === false) {
            conflicts.push({
              eventId: event.eventId,
              sessionId: event.sessionId,
              seq: event.seq,
              type: 'backup_monotonic',
              reason: `${field} cannot auto-downgrade once true`,
              serverValue: true,
              clientValue: false,
              resolvedBy: 'server',
              timestamp: nowISO(),
            });
            payload[field] = true;
          }
          if (toBoolean(payload[field])) {
            backupState[field] = true;
          }
        });
      }

      accepted.push(event);
      ackedEventIds.push(event.eventId);
      existingById.set(event.eventId, event);
      highestSeqBySession.set(event.sessionId, event.seq);
    }

    if (accepted.length > 0) {
      await setLiveSetEventsV2(projectId, [...storedEvents, ...accepted]);
      await appendAudit(projectId, accepted[0].shootingDayId ?? 'global', 'live_set_batch_ingest', {
        sessionId,
        acceptedCount: accepted.length,
        rejectedCount: rejected.length,
        conflictCount: conflicts.length,
      }, actorId);
      const now = Date.now();
      accepted.forEach((event) => {
        const captured = Date.parse(event.capturedAt);
        if (Number.isFinite(captured)) {
          sampleMetric(liveSetMetrics.takeCaptureLatencyMs, Math.max(0, now - captured));
        }
      });
    }

    liveSetMetrics.syncBatches += 1;
    if (rejected.length > 0) {
      liveSetMetrics.syncFailures += 1;
    }
    sampleMetric(liveSetMetrics.syncQueueDepthSamples, normalized.length);
    console.info('[liveset.batch_ingest]', {
      projectId,
      sessionId,
      actorId,
      batchSize: normalized.length,
      accepted: accepted.length,
      rejected: rejected.length,
      conflicts: conflicts.length,
      firstEventId: normalized[0]?.eventId,
      lastEventId: normalized[normalized.length - 1]?.eventId,
    });

    res.json({
      success: true,
      ackedEventIds,
      rejected,
      conflicts,
      serverTime: nowISO(),
    });
  });

  router.get('/projects/:projectId/live-set/events', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    if (!(await ensureProjectAccess(projectId))) {
      res.status(404).json({ success: false, error: 'Prosjekt ikke funnet' });
      return;
    }

    const sinceRaw = typeof req.query.since === 'string' ? req.query.since : '';
    const sinceTs = sinceRaw ? Date.parse(sinceRaw) : NaN;
    const events = await getLiveSetEventsV2(projectId);
    const filtered = Number.isFinite(sinceTs)
      ? events.filter((event) => {
          const captured = Date.parse(event.capturedAt || event.ingestedAt);
          return Number.isFinite(captured) && captured > sinceTs;
        })
      : events;

    res.json({
      success: true,
      events: filtered.slice(-5000),
      conflicts: [],
      serverCursor: nowISO(),
    });
  });

  router.post('/projects/:projectId/live-set/sync/ack', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    if (!(await ensureProjectAccess(projectId))) {
      res.status(404).json({ success: false, error: 'Prosjekt ikke funnet' });
      return;
    }

    const parsed = liveSetAckSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Ugyldig ack payload', issues: parsed.error.issues });
      return;
    }

    const { sessionId, eventIds } = parsed.data;
    const events = await getLiveSetEventsV2(projectId);
    const knownSet = new Set(events.map((event) => event.eventId));
    const ackedEventIds = eventIds.filter((eventId) => knownSet.has(eventId));
    const unknownEventIds = eventIds.filter((eventId) => !knownSet.has(eventId));

    const ackState = await getLiveSetAcks(projectId);
    const prev = Array.isArray(ackState[sessionId]) ? ackState[sessionId] : [];
    const merged = Array.from(new Set([...prev, ...ackedEventIds])).slice(-25000);
    ackState[sessionId] = merged;
    await setLiveSetAcks(projectId, ackState);

    res.json({
      success: true,
      ackedEventIds,
      unknownEventIds,
    });
  });

  router.get('/projects/:projectId/live-set/health', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    if (!(await ensureProjectAccess(projectId))) {
      res.status(404).json({ success: false, error: 'Prosjekt ikke funnet' });
      return;
    }

    let dbStatus: 'ok' | 'degraded' | 'down' = 'ok';
    try {
      await pool.query('SELECT 1');
    } catch {
      dbStatus = 'down';
    }

    let weatherStatus: 'ok' | 'degraded' | 'down' = 'ok';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1800);
      const weatherRes = await fetch('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=59.9139&lon=10.7522', {
        headers: { 'User-Agent': 'CreatorHub-RoleRoom/1.0 https://creatorhub.no' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      weatherStatus = weatherRes.ok ? 'ok' : 'degraded';
    } catch {
      weatherStatus = 'degraded';
    }

    const websocketStatus: 'ok' | 'degraded' | 'down' =
      process.env.DISABLE_WEBSOCKET === '1' ? 'down' : 'ok';

    const hasDown = dbStatus === 'down' || websocketStatus === 'down';
    const hasDegraded = weatherStatus === 'degraded';
    const status: 'ok' | 'degraded' | 'down' =
      hasDown
        ? 'down'
        : hasDegraded
          ? 'degraded'
          : 'ok';

    res.json({
      success: true,
      status,
      dependencies: {
        db: dbStatus,
        weatherUpstream: weatherStatus,
        websocket: websocketStatus,
      },
      metrics: {
        take_capture_latency_ms: liveSetMetrics.takeCaptureLatencyMs.length > 0
          ? Math.round(liveSetMetrics.takeCaptureLatencyMs.reduce((sum, value) => sum + value, 0) / liveSetMetrics.takeCaptureLatencyMs.length)
          : 0,
        sync_queue_depth: liveSetMetrics.syncQueueDepthSamples.length > 0
          ? Math.round(liveSetMetrics.syncQueueDepthSamples.reduce((sum, value) => sum + value, 0) / liveSetMetrics.syncQueueDepthSamples.length)
          : 0,
        sync_failure_rate: liveSetMetrics.syncBatches > 0
          ? Number((liveSetMetrics.syncFailures / liveSetMetrics.syncBatches).toFixed(4))
          : 0,
        weather_fetch_error_rate: liveSetMetrics.syncBatches > 0
          ? Number((liveSetMetrics.weatherFetchErrors / liveSetMetrics.syncBatches).toFixed(4))
          : 0,
      },
      timestamp: nowISO(),
    });
  });

  router.get('/projects/:projectId/live-set/weather', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const hasProjectAccess = await ensureProjectAccess(projectId);
    if (!hasProjectAccess) {
      // Weather should still work for local/demo projects that are not yet persisted in backend DB.
      // We keep auth but allow weather fetch by location-only context.
      console.warn('[liveset.weather] project not found in DB, falling back to location-only weather', { projectId });
    }

    const location = typeof req.query.location === 'string' ? req.query.location : undefined;
    const lat = typeof req.query.lat === 'string' ? Number(req.query.lat) : undefined;
    const lon = typeof req.query.lon === 'string' ? Number(req.query.lon) : undefined;
    const coords = resolveWeatherCoordinates(location, lat, lon);
    const cacheKey = `${coords.locationLabel}:${coords.lat.toFixed(4)}:${coords.lon.toFixed(4)}`;
    const cached = liveWeatherCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < LIVE_WEATHER_TTL_MS) {
      res.json({
        success: true,
        current: cached.current,
        alerts: cached.alerts,
        cache: { hit: true, ttlMs: Math.max(0, LIVE_WEATHER_TTL_MS - (now - cached.fetchedAt)) },
      });
      return;
    }

    try {
      const weatherRes = await fetch(
        `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${coords.lat.toFixed(4)}&lon=${coords.lon.toFixed(4)}`,
        { headers: { 'User-Agent': 'CreatorHub-RoleRoom/1.0 https://creatorhub.no' } },
      );
      if (!weatherRes.ok) {
        throw new Error(`Weather upstream status ${weatherRes.status}`);
      }
      const weatherPayload = await weatherRes.json() as Record<string, unknown>;
      const timeseries = Array.isArray((weatherPayload as { properties?: { timeseries?: unknown[] } }).properties?.timeseries)
        ? ((weatherPayload as { properties?: { timeseries?: unknown[] } }).properties?.timeseries as Array<Record<string, unknown>>)
        : [];
      const first = timeseries[0] ?? {};
      const details = ((first.data as { instant?: { details?: Record<string, unknown> } })?.instant?.details) ?? {};
      const nextHour = ((first.data as { next_1_hours?: { details?: Record<string, unknown>; summary?: Record<string, unknown> } })?.next_1_hours) ?? {};
      const current = {
        location: coords.locationLabel,
        temperature: typeof details.air_temperature === 'number' ? details.air_temperature : undefined,
        precipitation: typeof nextHour.details?.precipitation_amount === 'number' ? nextHour.details.precipitation_amount : 0,
        windSpeed: typeof details.wind_speed === 'number' ? details.wind_speed : 0,
        symbolCode: typeof nextHour.summary?.symbol_code === 'string' ? nextHour.summary.symbol_code : undefined,
        source: 'yr_api',
        timestamp: typeof first.time === 'string' ? first.time : nowISO(),
      };
      const alerts = normalizeWeatherAlerts(current);
      const entry: WeatherCacheEntry = {
        locationLabel: coords.locationLabel,
        lat: coords.lat,
        lon: coords.lon,
        current,
        alerts,
        fetchedAt: Date.now(),
      };
      liveWeatherCache.set(cacheKey, entry);

      res.json({
        success: true,
        current,
        alerts,
        cache: { hit: false, ttlMs: LIVE_WEATHER_TTL_MS },
      });
    } catch (error) {
      liveSetMetrics.weatherFetchErrors += 1;
      if (cached) {
        res.json({
          success: true,
          current: cached.current,
          alerts: cached.alerts,
          cache: { hit: true, ttlMs: 0, stale: true },
          warning: error instanceof Error ? error.message : 'Weather upstream failed',
        });
        return;
      }
      res.status(502).json({ success: false, error: error instanceof Error ? error.message : 'Weather upstream failed' });
    }
  });

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

  // In-memory caches backed by legacy_compat_store for persistence across restarts
  const liveStatusStore  = new Map<string, Record<string, unknown>>();
  const takesStore       = new Map<string, TakeRow[]>();
  const notesStore       = new Map<string, NoteRow[]>();
  const auditLog         = new Map<string, Array<{ action: string; payload: unknown; userId: string; ts: string }>>();

  const storeKey = (pid: string, did: string) => `${pid}:${did}`;
  const livesetStatusDbKey = (pid: string, did: string) => `role-room:liveset:status:${pid}:${did}`;
  const livesetTakesDbKey = (pid: string, did: string) => `role-room:liveset:takes:${pid}:${did}`;
  const livesetNotesDbKey = (pid: string, did: string) => `role-room:liveset:notes:${pid}:${did}`;
  const livesetAuditDbKey = (pid: string, did: string) => `role-room:liveset:audit:${pid}:${did}`;

  async function getLiveStatus(pid: string, did: string): Promise<Record<string, unknown> | null> {
    const memory = liveStatusStore.get(storeKey(pid, did));
    if (memory) return memory;
    const dbValue = await compatStoreGet<Record<string, unknown>>(livesetStatusDbKey(pid, did));
    if (dbValue && typeof dbValue === 'object') {
      liveStatusStore.set(storeKey(pid, did), dbValue);
      return dbValue;
    }
    return null;
  }

  async function getLiveTakes(pid: string, did: string): Promise<TakeRow[]> {
    const memory = takesStore.get(storeKey(pid, did));
    if (Array.isArray(memory)) return memory;
    const dbValue = await compatStoreGet<TakeRow[]>(livesetTakesDbKey(pid, did));
    if (Array.isArray(dbValue)) {
      takesStore.set(storeKey(pid, did), dbValue);
      return dbValue;
    }
    return [];
  }

  async function getLiveNotes(pid: string, did: string): Promise<NoteRow[]> {
    const memory = notesStore.get(storeKey(pid, did));
    if (Array.isArray(memory)) return memory;
    const dbValue = await compatStoreGet<NoteRow[]>(livesetNotesDbKey(pid, did));
    if (Array.isArray(dbValue)) {
      notesStore.set(storeKey(pid, did), dbValue);
      return dbValue;
    }
    return [];
  }

  async function getLiveAudit(pid: string, did: string): Promise<Array<{ action: string; payload: unknown; userId: string; ts: string }>> {
    const memory = auditLog.get(storeKey(pid, did));
    if (Array.isArray(memory)) return memory;
    const dbValue = await compatStoreGet<Array<{ action: string; payload: unknown; userId: string; ts: string }>>(livesetAuditDbKey(pid, did));
    if (Array.isArray(dbValue)) {
      auditLog.set(storeKey(pid, did), dbValue);
      return dbValue;
    }
    return [];
  }

  async function appendAudit(pid: string, did: string, action: string, payload: unknown, userId: string) {
    const k = storeKey(pid, did);
    const log = await getLiveAudit(pid, did);
    log.push({ action, payload, userId, ts: new Date().toISOString() });
    const trimmed = log.slice(-500); // keep last 500
    auditLog.set(k, trimmed);
    await compatStoreSet(livesetAuditDbKey(pid, did), trimmed);
  }

  // GET /api/liveset/:projectId/status?shootingDayId=
  router.get('/liveset/:projectId/status', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const did = req.query.shootingDayId as string;
    if (!did) return res.status(400).json({ error: 'shootingDayId required' });
    const status = (await getLiveStatus(projectId, did)) ?? {
      currentScene: null, currentShot: null, currentTake: 1,
      isRolling: false, lastAction: '', lastActionTime: new Date().toISOString(),
    };
    res.json(status);
  });

  // POST /api/liveset/:projectId/roll
  router.post('/liveset/:projectId/roll', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { shootingDayId, sceneId, shotId, userId } = req.body as Record<string, string>;
    if (!shootingDayId || !sceneId || !shotId) return res.status(400).json({ error: 'shootingDayId, sceneId, shotId required' });
    const k = storeKey(projectId, shootingDayId);
    const prev = (await getLiveStatus(projectId, shootingDayId)) ?? {};
    const next = { ...prev, currentScene: sceneId, currentShot: shotId, isRolling: true,
      lastAction: 'ROLLING', lastActionTime: new Date().toISOString() };
    liveStatusStore.set(k, next);
    await compatStoreSet(livesetStatusDbKey(projectId, shootingDayId), next);
    await appendAudit(projectId, shootingDayId, 'roll', { sceneId, shotId }, userId ?? 'unknown');
    res.json(next);
  });

  // POST /api/liveset/:projectId/cut
  router.post('/liveset/:projectId/cut', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { shootingDayId, status, notes, cameraId, camera, lens, fps, iso, ndFilter,
            nextTake, loggedBy } = req.body as Record<string, string | number>;
    if (!shootingDayId || !status) return res.status(400).json({ error: 'shootingDayId, status required' });
    const k = storeKey(projectId, String(shootingDayId));
    const prev = ((await getLiveStatus(projectId, String(shootingDayId))) ?? { currentScene: null, currentShot: null, currentTake: 1 }) as Record<string, unknown>;
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
    const takes = await getLiveTakes(projectId, String(shootingDayId));
    takes.push(take);
    takesStore.set(k, takes);
    await compatStoreSet(livesetTakesDbKey(projectId, String(shootingDayId)), takes);
    const resolvedNext = nextTake ? Number(nextTake) : Number(prev.currentTake ?? 1) + 1;
    const nextStatus = { ...prev, currentTake: resolvedNext, isRolling: false,
      lastAction: `CUT - ${String(status).toUpperCase()}`, lastActionTime: new Date().toISOString() };
    liveStatusStore.set(k, nextStatus);
    await compatStoreSet(livesetStatusDbKey(projectId, String(shootingDayId)), nextStatus);
    await appendAudit(projectId, String(shootingDayId), 'cut', take, String(loggedBy ?? 'unknown'));
    res.json(take);
  });

  // POST /api/liveset/:projectId/circle
  router.post('/liveset/:projectId/circle', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { shootingDayId, takeId, userId } = req.body as Record<string, string>;
    if (!shootingDayId || !takeId) return res.status(400).json({ error: 'shootingDayId, takeId required' });
    const k = storeKey(projectId, shootingDayId);
    const takes = await getLiveTakes(projectId, shootingDayId);
    const take = takes.find(t => t.id === takeId);
    if (!take) return res.status(404).json({ error: 'Take not found' });
    take.status = 'circle';
    takesStore.set(k, takes);
    await compatStoreSet(livesetTakesDbKey(projectId, shootingDayId), takes);
    await appendAudit(projectId, shootingDayId, 'circle_take', { takeId }, userId ?? 'unknown');
    res.json(take);
  });

  // GET /api/liveset/:projectId/takes?shootingDayId=
  router.get('/liveset/:projectId/takes', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const did = req.query.shootingDayId as string;
    if (!did) return res.status(400).json({ error: 'shootingDayId required' });
    res.json(await getLiveTakes(projectId, did));
  });

  // POST /api/liveset/:projectId/notes
  router.post('/liveset/:projectId/notes', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
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
    const notes = await getLiveNotes(projectId, shootingDayId);
    notes.push(entry);
    notesStore.set(k, notes);
    await compatStoreSet(livesetNotesDbKey(projectId, shootingDayId), notes);
    await appendAudit(projectId, shootingDayId, 'add_note', entry, createdBy ?? 'unknown');
    res.json(entry);
  });

  // GET /api/liveset/:projectId/notes?shootingDayId=
  router.get('/liveset/:projectId/notes', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const did = req.query.shootingDayId as string;
    if (!did) return res.status(400).json({ error: 'shootingDayId required' });
    res.json(await getLiveNotes(projectId, did));
  });

  // POST /api/liveset/:projectId/setup-complete
  router.post('/liveset/:projectId/setup-complete', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { shootingDayId, sceneId, shotId, userId } = req.body as Record<string, string>;
    if (!shootingDayId) return res.status(400).json({ error: 'shootingDayId required' });
    const k = storeKey(projectId, shootingDayId);
    const prev = (await getLiveStatus(projectId, shootingDayId)) ?? {};
    const next = { ...prev, currentTake: 1, isRolling: false,
      lastAction: `SETUP COMPLETE — ${sceneId}/${shotId} — av ${userId}`,
      lastActionTime: new Date().toISOString() };
    liveStatusStore.set(k, next);
    await compatStoreSet(livesetStatusDbKey(projectId, shootingDayId), next);
    await appendAudit(projectId, shootingDayId, 'setup_complete', { sceneId, shotId }, userId ?? 'unknown');
    res.json({ ok: true });
  });

  // GET /api/liveset/:projectId/audit?shootingDayId=
  router.get('/liveset/:projectId/audit', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const did = req.query.shootingDayId as string;
    if (!did) return res.status(400).json({ error: 'shootingDayId required' });
    res.json(await getLiveAudit(projectId, did));
  });

  // ══════════════════════════════════════════════════════════
  //  MEMORY CARD BACKUP CONTROL (Shotlist-linked production log)
  // ══════════════════════════════════════════════════════════

  const defaultMemoryCardControlState = () => ({
    shootDayLabel: '',
    entries: [] as Array<Record<string, unknown>>,
    updatedAt: nowISO(),
  });

  const sanitizeMemoryCardControlState = (raw: unknown) => {
    const fallback = defaultMemoryCardControlState();
    if (!raw || typeof raw !== 'object') return fallback;
    const value = raw as Record<string, unknown>;

    const shootDayLabel =
      typeof value.shootDayLabel === 'string' ? value.shootDayLabel.trim() : fallback.shootDayLabel;
    const updatedAt =
      typeof value.updatedAt === 'string' && value.updatedAt.trim() ? value.updatedAt : nowISO();
    const entries = Array.isArray(value.entries)
      ? value.entries
          .filter((entry) => entry && typeof entry === 'object')
          .slice(0, 1500)
          .map((entry) => entry as Record<string, unknown>)
      : fallback.entries;

    return {
      shootDayLabel,
      entries,
      updatedAt,
    };
  };

  const computeMemoryCardControlReport = (state: {
    shootDayLabel: string;
    entries: Array<Record<string, unknown>>;
    updatedAt: string;
  }) => {
    const total = state.entries.length;
    const statusCounts = {
      not_backed_up: 0,
      backing_up: 0,
      verified: 0,
    };
    const lifecycleCounts = new Map<string, number>();
    const crewCounts = new Map<string, number>();
    let checksumVerifiedCount = 0;
    let fullyCompliantCount = 0;
    let offsiteCount = 0;
    let backup1Count = 0;
    let backup2Count = 0;

    const pendingOverSixHours: Array<{
      id: string;
      cardLabel: string;
      hours: number;
      updatedAt: string;
    }> = [];

    const duplicateLabelSet = new Set<string>();
    const knownLabels = new Set<string>();

    for (const entry of state.entries) {
      const status = typeof entry.status === 'string' ? entry.status : 'not_backed_up';
      if (status in statusCounts) {
        statusCounts[status as keyof typeof statusCounts] += 1;
      }

      const lifecycleStage = typeof entry.lifecycleStage === 'string' ? entry.lifecycleStage : 'in_use';
      lifecycleCounts.set(lifecycleStage, (lifecycleCounts.get(lifecycleStage) ?? 0) + 1);

      const crewName = typeof entry.assignedCrewName === 'string' ? entry.assignedCrewName.trim() : '';
      if (crewName) {
        crewCounts.set(crewName, (crewCounts.get(crewName) ?? 0) + 1);
      }

      const cardLabel = typeof entry.cardLabel === 'string' ? entry.cardLabel.trim().toUpperCase() : '';
      if (cardLabel) {
        if (knownLabels.has(cardLabel)) duplicateLabelSet.add(cardLabel);
        knownLabels.add(cardLabel);
      }

      const backups = entry.backups && typeof entry.backups === 'object'
        ? (entry.backups as Record<string, unknown>)
        : {};
      const backup1 = Boolean(backups.backup1);
      const backup2 = Boolean(backups.backup2);
      const offsite = Boolean(backups.offsite);
      const checksumVerified = Boolean(entry.checksumVerified);

      if (backup1) backup1Count += 1;
      if (backup2) backup2Count += 1;
      if (offsite) offsiteCount += 1;
      if (checksumVerified) checksumVerifiedCount += 1;
      if (backup1 && backup2 && offsite && checksumVerified) {
        fullyCompliantCount += 1;
      }

      const updatedAt = typeof entry.updatedAt === 'string' ? entry.updatedAt : '';
      const updatedTime = Date.parse(updatedAt);
      if (status !== 'verified' && Number.isFinite(updatedTime)) {
        const ageHours = (Date.now() - updatedTime) / (1000 * 60 * 60);
        if (ageHours >= 6) {
          pendingOverSixHours.push({
            id: typeof entry.id === 'string' ? entry.id : `entry-${pendingOverSixHours.length + 1}`,
            cardLabel: cardLabel || 'Uten etikett',
            hours: Math.round(ageHours),
            updatedAt,
          });
        }
      }
    }

    const compliancePercent = total > 0 ? Math.round((fullyCompliantCount / total) * 100) : 100;
    const copyCoveragePercent = total > 0 ? Math.round((backup1Count / total) * 100) : 100;
    const dualMediaCoveragePercent = total > 0 ? Math.round((backup2Count / total) * 100) : 100;
    const offsiteCoveragePercent = total > 0 ? Math.round((offsiteCount / total) * 100) : 100;

    const risks: string[] = [];
    if (statusCounts.not_backed_up > 0) risks.push(`${statusCounts.not_backed_up} lagringsenheter er ikke sikkerhetskopiert`);
    if (offsiteCount < total && total > 0) risks.push(`Manglende offsite-kopi på ${total - offsiteCount} lagringsenheter`);
    if (duplicateLabelSet.size > 0) risks.push(`Dupliserte etiketter: ${Array.from(duplicateLabelSet).join(', ')}`);
    if (pendingOverSixHours.length > 0) risks.push(`${pendingOverSixHours.length} enheter har vært uverifisert i over 6 timer`);

    return {
      shootDayLabel: state.shootDayLabel,
      updatedAt: state.updatedAt,
      summary: {
        total,
        notBackedUp: statusCounts.not_backed_up,
        backingUp: statusCounts.backing_up,
        verified: statusCounts.verified,
        checksumVerified: checksumVerifiedCount,
        fullyCompliant: fullyCompliantCount,
        compliancePercent,
        copyCoveragePercent,
        dualMediaCoveragePercent,
        offsiteCoveragePercent,
      },
      counts: {
        status: statusCounts,
        lifecycle: Array.from(lifecycleCounts.entries()).map(([key, value]) => ({ key, value })),
        crew: Array.from(crewCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([crewName, count]) => ({ crewName, count })),
      },
      alerts: {
        riskLevel: compliancePercent >= 90 ? 'low' : compliancePercent >= 70 ? 'medium' : 'high',
        risks,
        pendingOverSixHours: pendingOverSixHours.slice(0, 50),
      },
      rule321: {
        description: '3-2-1-regel: 3 kopier (original + 2 backup), 2 medier (SSD + RAID/NAS), 1 offsite.',
        original: total,
        backup1: backup1Count,
        backup2: backup2Count,
        offsite: offsiteCount,
      },
    };
  };

  router.get('/projects/:projectId/memory-card-control', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const result = await pool.query<{ settings: unknown }>(
        'SELECT settings FROM casting_projects WHERE id = $1',
        [projectId]
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const settingsValue = result.rows[0]?.settings;
      const settings =
        settingsValue && typeof settingsValue === 'object'
          ? (settingsValue as Record<string, unknown>)
          : {};
      const controlState = sanitizeMemoryCardControlState(settings.memoryCardControl);

      res.json({
        state: controlState,
        source: 'casting_projects.settings.memoryCardControl',
      });
    } catch (err) {
      console.error('GET memory-card-control error:', err);
      res.status(500).json({ error: 'Kunne ikke hente minnekortkontroll' });
    }
  });

  router.put('/projects/:projectId/memory-card-control', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      if (!requireScope(req, 'write')) {
        res.status(403).json({ error: 'Skrive-tilgang kreves' });
        return;
      }

      const { projectId } = req.params;
      const body = req.body as Record<string, unknown>;
      const nextState = sanitizeMemoryCardControlState(body.state ?? body);

      const existing = await pool.query<{ settings: unknown }>(
        'SELECT settings FROM casting_projects WHERE id = $1',
        [projectId]
      );

      if (existing.rowCount === 0) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const currentSettingsValue = existing.rows[0]?.settings;
      const currentSettings =
        currentSettingsValue && typeof currentSettingsValue === 'object'
          ? (currentSettingsValue as Record<string, unknown>)
          : {};

      const updatedSettings = {
        ...currentSettings,
        memoryCardControl: {
          ...nextState,
          updatedAt: nowISO(),
        },
      };

      await pool.query(
        'UPDATE casting_projects SET settings = $1::jsonb, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(updatedSettings), projectId]
      );

      res.json({
        ok: true,
        state: updatedSettings.memoryCardControl,
      });
    } catch (err) {
      console.error('PUT memory-card-control error:', err);
      res.status(500).json({ error: 'Kunne ikke lagre minnekortkontroll' });
    }
  });

  router.get('/projects/:projectId/memory-card-control/report', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const result = await pool.query<{ settings: unknown }>(
        'SELECT settings FROM casting_projects WHERE id = $1',
        [projectId]
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const settingsValue = result.rows[0]?.settings;
      const settings =
        settingsValue && typeof settingsValue === 'object'
          ? (settingsValue as Record<string, unknown>)
          : {};
      const state = sanitizeMemoryCardControlState(settings.memoryCardControl);
      const report = computeMemoryCardControlReport(state);

      res.json({
        ok: true,
        projectId,
        report,
      });
    } catch (err) {
      console.error('GET memory-card-control report error:', err);
      res.status(500).json({ error: 'Kunne ikke hente minnekort-rapport' });
    }
  });

  router.post('/projects/:projectId/memory-card-control/qr-label', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const body = req.body as Record<string, unknown>;
      const requestedEntryId = typeof body.entryId === 'string' ? body.entryId : '';

      let selectedEntry: Record<string, unknown> | null = null;
      let shootDayLabel = typeof body.shootDayLabel === 'string' ? body.shootDayLabel : '';

      if (requestedEntryId) {
        const result = await pool.query<{ settings: unknown }>(
          'SELECT settings FROM casting_projects WHERE id = $1',
          [projectId]
        );
        if ((result.rowCount ?? 0) > 0) {
          const settingsValue = result.rows[0]?.settings;
          const settings =
            settingsValue && typeof settingsValue === 'object'
              ? (settingsValue as Record<string, unknown>)
              : {};
          const state = sanitizeMemoryCardControlState(settings.memoryCardControl);
          shootDayLabel = shootDayLabel || state.shootDayLabel;
          selectedEntry =
            state.entries.find(
              (entry) =>
                entry &&
                typeof entry === 'object' &&
                (entry as Record<string, unknown>).id === requestedEntryId
            ) ?? null;
        }
      }

      const cardLabel =
        typeof body.cardLabel === 'string'
          ? body.cardLabel.trim()
          : typeof selectedEntry?.cardLabel === 'string'
          ? selectedEntry.cardLabel.trim()
          : '';
      const cameraLabel =
        typeof body.cameraLabel === 'string'
          ? body.cameraLabel.trim()
          : typeof selectedEntry?.cameraLabel === 'string'
          ? selectedEntry.cameraLabel.trim()
          : '';
      const capacity =
        typeof body.capacity === 'string'
          ? body.capacity.trim()
          : typeof selectedEntry?.capacity === 'string'
          ? selectedEntry.capacity.trim()
          : '';
      const storageType =
        typeof body.storageType === 'string'
          ? body.storageType.trim()
          : typeof selectedEntry?.cardTypeName === 'string'
          ? selectedEntry.cardTypeName.trim()
          : '';

      if (!cardLabel) {
        res.status(400).json({ error: 'cardLabel er påkrevd for QR-etikett' });
        return;
      }

      const payload = {
        schema: 'role-room.memory-card-control.label.v1',
        projectId,
        entryId: requestedEntryId || (typeof selectedEntry?.id === 'string' ? selectedEntry.id : null),
        cardLabel,
        cameraLabel: cameraLabel || null,
        capacity: capacity || null,
        storageType: storageType || null,
        shootDayLabel: shootDayLabel || null,
        generatedAt: nowISO(),
      };
      const payloadString = JSON.stringify(payload);
      const qrDataUrl = await QRCode.toDataURL(payloadString, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 512,
      });
      const safeLabel = cardLabel.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 48) || 'lagringsenhet';

      res.json({
        ok: true,
        payload,
        payloadString,
        qrDataUrl,
        suggestedFileName: `${safeLabel}-qr.png`,
      });
    } catch (err) {
      console.error('POST memory-card-control qr-label error:', err);
      res.status(500).json({ error: 'Kunne ikke generere QR-etikett' });
    }
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
