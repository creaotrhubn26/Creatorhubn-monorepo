/**
 * Dance addon routes — mountes under /api/dance/addons.
 *
 * MVP-skopet:
 *   • Public-listing av aktive addons (auth-required for å unngå skanning)
 *   • Brukerens aktive add-ons + start trial / cancel
 *   • Admin: comp-grant, list-all, deactivate addon
 *
 * Stripe checkout for betalt aktivering kommer i neste fase når
 * Stripe-prisene er konfigurert via PlanAdminPanel.
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
import * as svc from './dance-addon-service.js';

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}
type AuthedRequest = Request & { userId: string; userRole: string; userEmail: string };

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
    (req as AuthedRequest).userRole = session.role;
    (req as AuthedRequest).userEmail = session.email;
    next();
  };
}

function isAdminRole(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'academy_admin';
}

function requireAdmin(pool: Pool, activeSessions?: Map<string, SessionData>) {
  const auth = requireAuth(pool, activeSessions);
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    auth(req, res, () => {
      const role = (req as AuthedRequest).userRole;
      if (!isAdminRole(role)) { res.status(403).json({ error: 'forbidden' }); return; }
      next();
    });
  };
}

// ─── Validation schemas ─────────────────────────────────────────────────

const addonSlugSchema = z.string().min(1).max(80).regex(/^[a-z0-9_]+$/);
const grantBody = z.object({
  userId: z.string().min(1).max(255),
  addonSlug: addonSlugSchema,
  expiresAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

// ─── Router ─────────────────────────────────────────────────────────────

export interface CreateDanceAddonRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createDanceAddonRouter(
  pool: Pool,
  deps: CreateDanceAddonRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);
  const admin = requireAdmin(pool, deps.activeSessions);

  // ─── Public listing (auth-required) ──────────────────────────────────
  router.get('/', auth, async (req, res) => {
    const persona = req.query.persona === 'dance_studio'
      ? 'dance_studio' as const
      : req.query.persona === 'dance_freelance'
        ? 'dance_freelance' as const
        : undefined;
    const addons = await svc.listAddons(pool, { activeOnly: true, persona });
    res.json({ success: true, data: addons });
  });

  // Brukerens aktive add-ons
  router.get('/me', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const subs = await svc.listUserActiveAddons(pool, userId);
    res.json({ success: true, data: subs });
  });

  // Resolvet feature-flags-set fra aktive add-ons (brukes av useDancePlanGate)
  router.get('/me/feature-flags', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const flags = await svc.resolveAddonFeatureFlags(pool, userId);
    res.json({ success: true, data: { featureFlags: flags } });
  });

  // Start trial (gir trial_days tilgang uten Stripe)
  router.post('/me/:slug/trial', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const slug = String(req.params.slug);
    try {
      const r = await svc.startTrialAddon(pool, userId, slug);
      if (!r.started) {
        const status = r.reason === 'addon_not_found' ? 404
          : r.reason === 'already_active' ? 409
          : 400;
        res.status(status).json({ error: r.reason });
        return;
      }
      res.status(201).json({ success: true, data: r.subscription });
    } catch (err) {
      res.status(500).json({ error: 'trial_start_failed', detail: String(err) });
    }
  });

  // Cancel addon
  router.delete('/me/:slug', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const r = await svc.cancelAddon(pool, userId, String(req.params.slug));
    if (!r.canceled) {
      res.status(404).json({ error: r.reason });
      return;
    }
    res.json({ success: true });
  });

  // ─── Admin endpoints ────────────────────────────────────────────────

  router.get('/admin/all', admin, async (_req, res) => {
    const addons = await svc.listAddons(pool, { activeOnly: false });
    res.json({ success: true, data: addons });
  });

  router.post('/admin/grant', admin, async (req, res) => {
    const parsed = grantBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId: grantedBy } = req as AuthedRequest;
    try {
      const r = await svc.grantCompAddon(pool, {
        ...parsed.data,
        expiresAt: parsed.data.expiresAt ?? undefined,
        notes: parsed.data.notes ?? undefined,
        grantedByUserId: grantedBy,
      });
      if (!r.granted) {
        res.status(404).json({ error: r.reason });
        return;
      }
      res.status(201).json({ success: true, data: r.subscription });
    } catch (err) {
      res.status(500).json({ error: 'grant_failed', detail: String(err) });
    }
  });

  return router;
}
