/**
 * Dance billing routes — plan-katalog, abonnement, tester-invites,
 * admin-settings, og Stripe checkout/webhook.
 *
 * Mountes under /api/dance/billing.
 */

import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
  raw as expressRaw,
} from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { loadPersistedAuthSession } from './auth-session-store.js';
import * as svc from './dance-billing-service.js';

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

function isAdminRole(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'academy_admin';
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

const planSlugSchema = z.string().min(1).max(80).regex(/^[a-z0-9_]+$/);
const planBody = z.object({
  slug: planSlugSchema,
  name: z.string().min(1).max(200),
  persona: z.enum(['dance_freelance', 'dance_studio', 'both']).optional(),
  description: z.string().max(2000).nullable().optional(),
  monthlyPriceKr: z.number().int().min(0).nullable().optional(),
  yearlyPriceKr: z.number().int().min(0).nullable().optional(),
  stripeMonthlyPriceId: z.string().max(120).nullable().optional(),
  stripeYearlyPriceId: z.string().max(120).nullable().optional(),
  features: z.array(z.string().max(120)).max(50).optional(),
  limits: z.record(z.string(), z.unknown()).optional(),
  trialDays: z.number().int().min(0).max(365).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(10000).optional(),
});

const inviteBody = z.object({
  invitedEmail: z.string().email().max(200).nullable().optional(),
  invitedName: z.string().max(200).nullable().optional(),
  planSlug: planSlugSchema,
  trialDays: z.number().int().min(1).max(3650).optional(),
  maxUses: z.number().int().min(1).max(1000).optional(),
  validUntil: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const checkoutBody = z.object({
  planSlug: planSlugSchema,
  billingPeriod: z.enum(['monthly', 'yearly']),
  successUrl: z.string().url().max(2000),
  cancelUrl: z.string().url().max(2000),
});

const settingBody = z.object({
  value: z.record(z.string(), z.unknown()),
  description: z.string().max(500).nullable().optional(),
});

// ─── Router ─────────────────────────────────────────────────────────────

export interface CreateDanceBillingRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createDanceBillingRouter(
  pool: Pool,
  deps: CreateDanceBillingRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);
  const admin = requireAdmin(pool, deps.activeSessions);

  // ─── PLANS ──────────────────────────────────────────────────────────
  // Public listing av aktive planer (krever ikke admin men krever auth
  // for å unngå nett-skanning; pricing-side kan vises før login uten
  // disse dataene).
  router.get('/plans', auth, async (_req, res) => {
    const plans = await svc.listPlans(pool, { activeOnly: true });
    res.json({ success: true, data: plans });
  });

  // Admin: alle planer inkl. inaktive.
  router.get('/admin/plans', admin, async (_req, res) => {
    res.json({ success: true, data: await svc.listPlans(pool, { activeOnly: false }) });
  });

  router.post('/admin/plans', admin, async (req, res) => {
    const parsed = planBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    try {
      res.status(201).json({ success: true, data: await svc.createPlan(pool, parsed.data) });
    } catch (err) {
      res.status(400).json({ error: 'create_failed', detail: String(err) });
    }
  });

  router.patch('/admin/plans/:slug', admin, async (req, res) => {
    const parsed = planBody.partial().omit({ slug: true }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const r = await svc.patchPlan(pool, req.params.slug, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  });

  router.delete('/admin/plans/:slug', admin, async (req, res) => {
    try {
      const ok = await svc.deletePlan(pool, req.params.slug);
      res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
    } catch (err) {
      res.status(409).json({ error: 'conflict', detail: String(err) });
    }
  });

  // ─── SUBSCRIPTIONS ──────────────────────────────────────────────────
  router.get('/subscription', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const sub = await svc.getSubscription(pool, userId);
    res.json({ success: true, data: sub });
  });

  router.get('/admin/subscriptions', admin, async (_req, res) => {
    res.json({ success: true, data: await svc.listAllSubscriptions(pool) });
  });

  // Admin: gi comp-tilgang til en bruker.
  router.post('/admin/subscriptions/comp', admin, async (req, res) => {
    const compBody = z.object({
      userId: z.string().min(1).max(200),
      planSlug: planSlugSchema,
      expiresAt: z.string().datetime().nullable().optional(),
      notes: z.string().max(2000).nullable().optional(),
    });
    const parsed = compBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const { userId: adminUserId } = req as AuthedRequest;
    const sub = await svc.upsertSubscription(pool, parsed.data.userId, {
      planSlug: parsed.data.planSlug,
      billingPeriod: 'comp',
      status: 'comp',
      compGrantedByUserId: adminUserId,
      compExpiresAt: parsed.data.expiresAt ?? null,
      currentPeriodEnd: parsed.data.expiresAt ?? null,
      notes: parsed.data.notes ?? null,
    });
    res.json({ success: true, data: sub });
  });

  // ─── CHECKOUT (Stripe) ──────────────────────────────────────────────
  router.post('/checkout-session', auth, async (req, res) => {
    const parsed = checkoutBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const { userId, userEmail } = req as AuthedRequest;
    const result = await svc.createCheckoutSession(
      pool,
      userId,
      userEmail ?? null,
      parsed.data.planSlug,
      parsed.data.billingPeriod,
      parsed.data.successUrl,
      parsed.data.cancelUrl,
    );
    if (!result.ok) {
      const status = result.error === 'stripe_not_configured' ? 503
        : result.error === 'plan_not_found' ? 404
        : result.error === 'plan_inactive' ? 410
        : result.error === 'price_not_configured' ? 409
        : 500;
      res.status(status).json({ error: result.error, detail: result.detail });
      return;
    }
    res.json({ success: true, data: { sessionUrl: result.sessionUrl } });
  });

  router.post('/customer-portal', auth, async (req, res) => {
    const parsed = z.object({ returnUrl: z.string().url().max(2000) }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const { userId } = req as AuthedRequest;
    const result = await svc.createCustomerPortalSession(pool, userId, parsed.data.returnUrl);
    if (!result.ok) {
      res.status(503).json({ error: result.error });
      return;
    }
    res.json({ success: true, data: { portalUrl: result.portalUrl } });
  });

  // Stripe webhook: rå body, ingen auth.
  router.post(
    '/stripe-webhook',
    expressRaw({ type: 'application/json' }),
    async (req: Request, res: Response): Promise<void> => {
      const sig = req.header('stripe-signature') ?? '';
      const result = await svc.handleStripeWebhook(pool, req.body as Buffer, sig);
      if (result.received) {
        res.json({ received: true });
      } else {
        res.status(400).json({ error: result.error });
      }
    },
  );

  // ─── TESTER INVITES ─────────────────────────────────────────────────
  router.get('/admin/tester-invites', admin, async (_req, res) => {
    res.json({ success: true, data: await svc.listInvites(pool) });
  });

  router.post('/admin/tester-invites', admin, async (req, res) => {
    const parsed = inviteBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const { userId } = req as AuthedRequest;
    res.status(201).json({ success: true, data: await svc.createInvite(pool, userId, parsed.data) });
  });

  router.patch('/admin/tester-invites/:token', admin, async (req, res) => {
    const parsed = inviteBody.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const r = await svc.patchInvite(pool, req.params.token, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  });

  router.delete('/admin/tester-invites/:token', admin, async (req, res) => {
    const ok = await svc.deleteInvite(pool, req.params.token);
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  });

  // Public lookup på token — for landing-side uten login.
  router.get('/tester-invites/:token', async (req, res) => {
    const tokenParsed = z.string().min(8).max(200).safeParse(req.params.token);
    if (!tokenParsed.success) { res.status(400).json({ error: 'invalid_token' }); return; }
    const invite = await svc.getInvite(pool, tokenParsed.data);
    if (!invite) { res.status(404).json({ error: 'not_found' }); return; }
    const plan = await svc.getPlan(pool, invite.planSlug);
    // Returner kun det som trengs for landing-page (ikke email/notes til random user).
    res.json({
      success: true,
      data: {
        token: invite.token,
        planSlug: invite.planSlug,
        planName: plan?.name ?? invite.planSlug,
        trialDays: invite.trialDays,
        validUntil: invite.validUntil,
        usesRemaining: Math.max(0, invite.maxUses - invite.usedCount),
      },
    });
  });

  router.post('/tester-invites/:token/accept', auth, async (req, res) => {
    const tokenParsed = z.string().min(8).max(200).safeParse(req.params.token);
    if (!tokenParsed.success) { res.status(400).json({ error: 'invalid_token' }); return; }
    const { userId } = req as AuthedRequest;
    const result = await svc.acceptInvite(pool, tokenParsed.data, userId);
    if (!result.ok) {
      const status = result.error === 'invite_not_found' ? 404
        : result.error === 'invite_expired' ? 410
        : 409;
      res.status(status).json({ error: result.error });
      return;
    }
    res.json({ success: true, data: result.subscription });
  });

  // ─── ADMIN SETTINGS ─────────────────────────────────────────────────
  router.get('/admin/settings', admin, async (_req, res) => {
    res.json({ success: true, data: await svc.listSettings(pool) });
  });

  router.put('/admin/settings/:key', admin, async (req, res) => {
    const keyParsed = z.string().min(1).max(80).safeParse(req.params.key);
    if (!keyParsed.success) { res.status(400).json({ error: 'invalid_key' }); return; }
    const parsed = settingBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const { userId } = req as AuthedRequest;
    const r = await svc.upsertSetting(
      pool, keyParsed.data, parsed.data.value, userId, parsed.data.description ?? null,
    );
    res.json({ success: true, data: r });
  });

  return router;
}
