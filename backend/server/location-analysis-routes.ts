/**
 * location-analysis-routes.ts
 * Mountes under /api/role-room/locations/analysis.
 * Authed routes for Kartverket geocode + permit-lookup.
 */

import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { loadPersistedAuthSession } from './auth-session-store.js';
import { analyzeLocation, geocodeAddress } from './location-analysis-service.js';
import { KOMMUNE_PERMIT_DB, lookupKommunePermit } from './data/norway-kommune-permit-info.js';

interface SessionData { userId: string; email: string; name: string; role: string; loginAt: string; [key: string]: unknown; }

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
    next();
  };
}

const addressBody = z.object({ address: z.string().trim().min(3).max(500) });

export interface CreateLocationAnalysisRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createLocationAnalysisRouter(
  pool: Pool,
  deps: CreateLocationAnalysisRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);

  // Geocode kun (Kartverket-spørring)
  router.post('/geocode', auth, async (req, res) => {
    const parsed = addressBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    try {
      const result = await geocodeAddress(parsed.data.address);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ error: 'geocode_failed', detail: String(err) });
    }
  });

  // Full analyse: geocode + permit-info + anbefalinger
  router.post('/analyze', auth, async (req, res) => {
    const parsed = addressBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    try {
      const analysis = await analyzeLocation(parsed.data.address);
      res.json({ success: true, data: analysis });
    } catch (err) {
      res.status(500).json({ error: 'analyze_failed', detail: String(err) });
    }
  });

  // Static permit-info per kommunenummer (admin-readable)
  router.get('/kommune/:kommunenummer', auth, (req, res) => {
    const info = lookupKommunePermit(String(req.params.kommunenummer));
    if (!info) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: info });
  });

  // Liste alle kommuner i database (for admin / debug)
  router.get('/kommune', auth, (_req, res) => {
    const list = Object.values(KOMMUNE_PERMIT_DB).sort((a, b) => a.kommune.localeCompare(b.kommune, 'nb'));
    res.json({ success: true, data: list, total: list.length });
  });

  return router;
}
