/**
 * casting-production-routes.ts — mountes under /api/role-room.
 *
 * Ekte REST-API for casting_props og casting_production_days. Erstatter den tidligere
 * tilstanden der disse kjerne-OS-funksjonene kun ble lagret i prosjekt-bloben (de
 * dedikerte frontend-API-klientene var dødkode, ingen backend-endepunkter fantes).
 *
 *   • GET    /projects/:projectId/props            → { props: [...] }
 *   • POST   /props                                 → { prop }
 *   • DELETE /props/:propId
 *   • GET    /projects/:projectId/production-days   → { productionDays: [...] }
 *   • POST   /production-days                       → { productionDay }
 *   • DELETE /production-days/:dayId
 *
 * Schema er smalere enn frontend-modellene, så en `data JSONB`-kolonne lagrer hele
 * modell-objektet tapsfritt; typede kolonner (name, date, status …) holdes i synk for
 * spørrbarhet og for å matche GET /projects-aggregeringen.
 */

import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from 'express';
import type { Pool } from 'pg';
import { randomBytes } from 'node:crypto';
import { loadPersistedAuthSession } from './auth-session-store.js';

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}
type AuthedRequest = Request & { userId: string };

async function resolveUser(
  pool: Pool,
  activeSessions: Map<string, SessionData> | undefined,
  bearer: string | null | undefined,
): Promise<SessionData | null> {
  const token = typeof bearer === 'string' ? bearer.trim() : '';
  if (!token) return null;
  const inMemory = activeSessions?.get(token) ?? null;
  if (inMemory) return inMemory;
  const persisted = await loadPersistedAuthSession<SessionData>(pool, token);
  if (persisted) { activeSessions?.set(token, persisted); return persisted; }
  return null;
}

function requireAuth(pool: Pool, activeSessions?: Map<string, SessionData>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    const session = await resolveUser(pool, activeSessions, bearer);
    if (!session?.userId) { res.status(401).json({ error: 'unauthorized' }); return; }
    (req as AuthedRequest).userId = session.userId;
    next();
  };
}

// ── Schema: legg til data-kolonne (idempotent) ──
let schemaReadyPromise: Promise<void> | null = null;
async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`ALTER TABLE casting_props ADD COLUMN IF NOT EXISTS data JSONB`);
  await pool.query(`ALTER TABLE casting_production_days ADD COLUMN IF NOT EXISTS data JSONB`);
}
function schemaReady(pool: Pool): Promise<void> {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureSchema(pool).catch((err) => { schemaReadyPromise = null; throw err; });
  }
  return schemaReadyPromise;
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && value) return value.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

// Slår sammen typede kolonner (autoritative) med det rike `data`-objektet (overstyrer rike felt).
function mapPropRow(row: Record<string, any>) {
  const base = {
    id: row.id,
    projectId: row.project_id,
    project_id: row.project_id,
    name: row.name,
    category: row.category ?? undefined,
    description: row.description ?? undefined,
    images: row.images ?? [],
    availability: row.availability ?? undefined,
    quantity: row.quantity ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return {
    ...base,
    ...(row.data && typeof row.data === 'object' ? row.data : {}),
    id: row.id,
    projectId: row.project_id,
    project_id: row.project_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDayRow(row: Record<string, any>) {
  const base = {
    id: row.id,
    projectId: row.project_id,
    project_id: row.project_id,
    date: toDateString(row.date),
    scenes: row.scene_ids ?? [],
    crew: row.crew_ids ?? [],
    props: row.prop_ids ?? [],
    locationId: row.location_id ?? undefined,
    status: row.status ?? undefined,
    notes: row.notes ?? undefined,
    weatherForecast: row.weather_forecast ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return {
    ...base,
    ...(row.data && typeof row.data === 'object' ? row.data : {}),
    id: row.id,
    projectId: row.project_id,
    project_id: row.project_id,
    date: toDateString(row.date),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateCastingProductionRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createCastingProductionRouter(
  pool: Pool,
  deps: CreateCastingProductionRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);

  // ────────────── PROPS ──────────────
  router.get('/projects/:projectId/props', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const result = await pool.query(
        'SELECT * FROM casting_props WHERE project_id = $1 ORDER BY created_at',
        [req.params.projectId],
      );
      res.json({ props: result.rows.map(mapPropRow) });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke hente props', detail: String(err) });
    }
  });

  router.post('/props', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const b = (req.body ?? {}) as Record<string, any>;
      const projectId = b.projectId || b.project_id;
      if (!projectId) { res.status(400).json({ error: 'projectId er påkrevd' }); return; }
      const id = String(b.id || genId('prop'));
      const images = JSON.stringify(asArray(b.images));
      const availability = typeof b.availability === 'string' ? b.availability : null;
      const quantity = Number.isFinite(Number(b.quantity)) ? Number(b.quantity) : 1;
      const result = await pool.query(
        `INSERT INTO casting_props
           (id, project_id, name, category, description, images, availability, quantity, data, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           project_id = EXCLUDED.project_id, name = EXCLUDED.name, category = EXCLUDED.category,
           description = EXCLUDED.description, images = EXCLUDED.images, availability = EXCLUDED.availability,
           quantity = EXCLUDED.quantity, data = EXCLUDED.data, updated_at = NOW()
         RETURNING *`,
        [id, projectId, b.name || 'Uten navn', b.category ?? null, b.description ?? null,
         images, availability, quantity, JSON.stringify(b)],
      );
      res.status(201).json({ prop: mapPropRow(result.rows[0]) });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke lagre prop', detail: String(err) });
    }
  });

  router.delete('/props/:propId', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const result = await pool.query('DELETE FROM casting_props WHERE id = $1', [req.params.propId]);
      if (result.rowCount === 0) { res.status(404).json({ error: 'Prop ikke funnet' }); return; }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke slette prop', detail: String(err) });
    }
  });

  // ────────────── PRODUCTION DAYS ──────────────
  router.get('/projects/:projectId/production-days', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const result = await pool.query(
        'SELECT * FROM casting_production_days WHERE project_id = $1 ORDER BY date',
        [req.params.projectId],
      );
      res.json({ productionDays: result.rows.map(mapDayRow) });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke hente produksjonsdager', detail: String(err) });
    }
  });

  router.post('/production-days', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const b = (req.body ?? {}) as Record<string, any>;
      const projectId = b.projectId || b.project_id;
      if (!projectId) { res.status(400).json({ error: 'projectId er påkrevd' }); return; }
      const id = String(b.id || genId('pday'));
      const result = await pool.query(
        `INSERT INTO casting_production_days
           (id, project_id, date, scene_ids, crew_ids, location_id, prop_ids, status, notes, weather_forecast, data, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           project_id = EXCLUDED.project_id, date = EXCLUDED.date, scene_ids = EXCLUDED.scene_ids,
           crew_ids = EXCLUDED.crew_ids, location_id = EXCLUDED.location_id, prop_ids = EXCLUDED.prop_ids,
           status = EXCLUDED.status, notes = EXCLUDED.notes, weather_forecast = EXCLUDED.weather_forecast,
           data = EXCLUDED.data, updated_at = NOW()
         RETURNING *`,
        [
          id, projectId, toDateString(b.date),
          JSON.stringify(asArray(b.scenes ?? b.scene_ids)),
          JSON.stringify(asArray(b.crew ?? b.crew_ids)),
          b.locationId || b.location_id || null,
          JSON.stringify(asArray(b.props ?? b.prop_ids)),
          b.status || 'planned',
          b.notes ?? null,
          b.weatherForecast ? JSON.stringify(b.weatherForecast) : null,
          JSON.stringify(b),
        ],
      );
      res.status(201).json({ productionDay: mapDayRow(result.rows[0]) });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke lagre produksjonsdag', detail: String(err) });
    }
  });

  router.delete('/production-days/:dayId', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const result = await pool.query('DELETE FROM casting_production_days WHERE id = $1', [req.params.dayId]);
      if (result.rowCount === 0) { res.status(404).json({ error: 'Produksjonsdag ikke funnet' }); return; }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke slette produksjonsdag', detail: String(err) });
    }
  });

  return router;
}
