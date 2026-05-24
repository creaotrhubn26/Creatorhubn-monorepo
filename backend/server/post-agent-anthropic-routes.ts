/**
 * The Role Room — Post Agent backend.
 *
 *   POST  /api/post-agent/pairing/start            (no auth)
 *   POST  /api/post-agent/pairing/poll             (no auth)
 *   POST  /api/post-agent/pairing/redeem           (user auth)
 *   POST  /api/post-agent/anthropic/messages       (post-agent auth + entitlement)
 *   GET   /api/post-agent/health                   (post-agent auth)
 *   GET   /api/post-agent/devices                  (user auth — list paired installs)
 *   DELETE /api/post-agent/devices/:token          (user auth — revoke)
 *   GET   /api/post-agent/usage/me                 (post-agent auth)
 *
 * Robustness invariants:
 *   - Pairing codes live in DB (survive Render restarts / multi-pod)
 *   - Bearer tokens are checked against device-revocation on every request
 *   - Anthropic-proxy requires checkAgentEntitlement (Role Room sub or trial)
 *   - All errors are passed through cleanly (Anthropic 429 → client 429)
 *   - Usage is persisted for billing / audit
 */

import crypto from 'crypto';
import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from 'express';
import type { Pool } from 'pg';
import { loadPersistedAuthSession, persistAuthSession } from './auth-session-store.js';
import { aiRateLimit } from './ai-rate-limiter.js';
import { checkAgentEntitlement } from './role-room-agent-entitlements.js';
import {
  deletePairingCode,
  ensurePostAgentTables,
  getPairingCode,
  insertPairingCode,
  insertUsage,
  isDeviceRevoked,
  listDevicesForUser,
  markPairingPaired,
  prunePairingCodes,
  registerDevice,
  revokeDevice,
  summarizeUsageForUser,
  touchDeviceLastSeen,
} from './post-agent-storage.js';

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}

type AuthedRequest = Request & { userId: string; bearerToken: string };

const PAIRING_TTL_MS = 10 * 60 * 1000;

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
  if (persisted) {
    activeSessions?.set(token, persisted);
    return persisted;
  }
  return null;
}

function requireUser(pool: Pool, activeSessions?: Map<string, SessionData>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    const session = await resolveUser(pool, activeSessions, bearer);
    if (!session?.userId || !bearer) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    (req as AuthedRequest).userId = session.userId;
    (req as AuthedRequest).bearerToken = bearer;
    next();
  };
}

/**
 * Like requireUser, but also blocks revoked Post Agent tokens. Used on the
 * proxy endpoint so a stolen-laptop's token immediately stops working when
 * the user clicks Revoke in the web UI.
 */
function requirePostAgent(pool: Pool, activeSessions?: Map<string, SessionData>) {
  const userGate = requireUser(pool, activeSessions);
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await userGate(req, res, async () => {
      const token = (req as AuthedRequest).bearerToken;
      if (await isDeviceRevoked(pool, token)) {
        // Also evict from in-memory cache so a re-issue doesn't get bypassed
        activeSessions?.delete(token);
        res.status(401).json({ error: 'token_revoked' });
        return;
      }
      // Fire-and-forget last-seen update
      void touchDeviceLastSeen(pool, token);
      next();
    });
  };
}

// ---- Anthropic SDK lazy-init ----

let anthropicClient: { messages: { create(opts: unknown): Promise<unknown> } } | null = null;
async function getClient() {
  if (anthropicClient) return anthropicClient;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw Object.assign(new Error('ANTHROPIC_API_KEY not configured on backend'), {
      status: 503,
      code: 'not_configured',
    });
  }
  const mod: { default?: unknown; Anthropic?: unknown } = await import('@anthropic-ai/sdk');
  const AnthropicCtor = (mod.default ?? mod.Anthropic) as new (opts: {
    apiKey: string;
    maxRetries?: number;
    timeout?: number;
  }) => { messages: { create(opts: unknown): Promise<unknown> } };
  anthropicClient = new AnthropicCtor({
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxRetries: 1,
    timeout: 90_000,
  });
  return anthropicClient;
}

// ---- Pairing helpers ----

function generatePairingCode(): string {
  // Human-readable: no I/O/0/1 confusion. 6 chars, 32^6 ≈ 1B possibilities.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = (n: number) =>
    Array.from({ length: n }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join('');
  return `${pick(3)}-${pick(3)}`;
}

export function createPostAgentRouter(
  pool: Pool,
  activeSessions?: Map<string, SessionData>,
): ExpressRouter {
  const router = Router();

  // Ensure tables exist as soon as the router is mounted, so the first
  // request doesn't pay the migration cost. Non-blocking — if the DB is
  // unreachable, storage functions silently degrade.
  void ensurePostAgentTables(pool);

  const userAuth = requireUser(pool, activeSessions);
  const postAgentAuth = requirePostAgent(pool, activeSessions);

  // ---- Health ----

  router.get('/health', postAgentAuth, (req: Request, res: Response) => {
    res.json({
      ok: true,
      userId: (req as AuthedRequest).userId,
      anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    });
  });

  // ---- Pairing flow ----

  router.post(
    '/pairing/start',
    aiRateLimit({ windowMs: 60_000, max: 10, label: 'post-agent-pairing-start' }),
    async (_req: Request, res: Response) => {
      void prunePairingCodes(pool);
      let code = generatePairingCode();
      let attempts = 0;
      while (attempts < 5) {
        const stored = await insertPairingCode(pool, code, PAIRING_TTL_MS);
        if (stored) break;
        code = generatePairingCode();
        attempts += 1;
      }
      if (attempts >= 5) {
        res.status(503).json({ error: 'pairing_storage_unavailable' });
        return;
      }
      res.json({
        code,
        expiresAt: new Date(Date.now() + PAIRING_TTL_MS).toISOString(),
        verificationUrl: 'https://theroleroom.com/link',
        pollIntervalMs: 2000,
      });
    },
  );

  router.post(
    '/pairing/poll',
    aiRateLimit({ windowMs: 60_000, max: 120, label: 'post-agent-pairing-poll' }),
    async (req: Request, res: Response) => {
      const code = String(req.body?.code ?? '').trim().toUpperCase();
      if (!code) {
        res.status(400).json({ error: 'missing_code' });
        return;
      }
      const entry = await getPairingCode(pool, code);
      if (!entry || entry.expiresAt.getTime() < Date.now()) {
        res.status(410).json({ status: 'expired', error: 'pairing_code_unknown_or_expired' });
        return;
      }
      if (!entry.bearerToken) {
        res.status(202).json({ status: 'pending' });
        return;
      }
      // Hand off the token, then immediately destroy the pairing record
      const token = entry.bearerToken;
      const userId = entry.pairedUserId;
      await deletePairingCode(pool, code);
      res.json({ status: 'paired', bearerToken: token, userId });
    },
  );

  router.post(
    '/pairing/redeem',
    userAuth,
    async (req: Request, res: Response): Promise<void> => {
      const userId = (req as AuthedRequest).userId;
      const code = String(req.body?.code ?? '').trim().toUpperCase();
      if (!code) {
        res.status(400).json({ error: 'missing_code' });
        return;
      }
      const entry = await getPairingCode(pool, code);
      if (!entry || entry.expiresAt.getTime() < Date.now()) {
        res.status(404).json({ error: 'pairing_code_unknown_or_expired' });
        return;
      }
      if (entry.bearerToken) {
        res.status(409).json({ error: 'pairing_code_already_redeemed' });
        return;
      }
      const bearer = (req as AuthedRequest).bearerToken;
      const session = await resolveUser(pool, activeSessions, bearer);
      if (!session) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }

      // Mint a per-device token, separate from the web session's token so
      // revoking one Post Agent install doesn't log the user out of the web app.
      const newToken = crypto.randomUUID();
      const deviceLabel = String(req.body?.deviceLabel ?? '').trim().slice(0, 80) || null;
      const postAgentSession: SessionData = {
        ...session,
        userId,
        loginAt: new Date().toISOString(),
        device: 'post-agent',
      };

      activeSessions?.set(newToken, postAgentSession);
      await persistAuthSession(pool, newToken, postAgentSession);
      await registerDevice(pool, newToken, userId, deviceLabel);

      const claimed = await markPairingPaired(pool, code, newToken, userId);
      if (!claimed) {
        // Someone else won the race or the row got pruned; clean up the orphan
        activeSessions?.delete(newToken);
        res.status(409).json({ error: 'pairing_code_race' });
        return;
      }

      res.json({ ok: true, pairedAt: new Date().toISOString() });
    },
  );

  // ---- Anthropic proxy ----

  router.post(
    '/anthropic/messages',
    postAgentAuth,
    aiRateLimit({ windowMs: 60_000, max: 60, label: 'post-agent-anthropic' }),
    async (req: Request, res: Response): Promise<void> => {
      const userId = (req as AuthedRequest).userId;

      // Entitlement gate — must have active Role Room sub OR be admin.
      // Pass role from session so admin/super_admin bypass works (without
      // this hint, checkAgentEntitlement can't see the role and 402s
      // even privileged users).
      const session = activeSessions?.get((req as AuthedRequest).bearerToken);
      const entitlement = await checkAgentEntitlement(pool, userId, session?.role);
      if (!entitlement.allowed) {
        res.status(402).json({
          error: 'subscription_required',
          detail: entitlement.reason,
          upsell: entitlement.upsell,
        });
        return;
      }

      const body = req.body ?? {};
      if (!body.model || !Array.isArray(body.messages)) {
        res.status(400).json({ error: 'invalid_request', detail: 'model + messages required' });
        return;
      }

      try {
        const client = await getClient();
        const response = (await client.messages.create(body)) as {
          usage?: { input_tokens?: number; output_tokens?: number };
          model?: string;
        };
        const usage = response.usage ?? {};
        const inputTokens = usage.input_tokens ?? 0;
        const outputTokens = usage.output_tokens ?? 0;
        const modelUsed = response.model ?? String(body.model ?? 'unknown');

        void insertUsage(pool, {
          userId,
          model: modelUsed,
          inputTokens,
          outputTokens,
        });

        res.json(response);
      } catch (err) {
        // Pass through Anthropic errors with their actual status codes so
        // clients can distinguish rate-limit (429), bad-request (400), etc.
        const status = (err as { status?: number }).status ?? 502;
        const code = (err as { code?: string }).code ?? 'upstream_error';
        const message = (err as Error).message ?? 'Anthropic call failed';
        console.error('[post-agent] anthropic proxy error:', code, message);
        res.status(status).json({ error: code, detail: message });
      }
    },
  );

  // ---- Devices (per-user installation management) ----

  router.get('/devices', userAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthedRequest).userId;
    const devices = await listDevicesForUser(pool, userId);
    res.json({
      devices: devices.map((d) => ({
        // NEVER expose the actual token — only a prefix for identification
        tokenPreview: `${d.token.slice(0, 8)}…${d.token.slice(-4)}`,
        token: d.token, // full token returned only to owner; for revoke action
        label: d.label,
        createdAt: d.createdAt,
        lastSeen: d.lastSeen,
        revokedAt: d.revokedAt,
        isCurrent: d.token === (req as AuthedRequest).bearerToken,
      })),
    });
  });

  router.delete('/devices/:token', userAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthedRequest).userId;
    const tokenToRevoke = req.params.token;
    const ok = await revokeDevice(pool, tokenToRevoke, userId);
    if (!ok) {
      res.status(404).json({ error: 'device_not_found_or_already_revoked' });
      return;
    }
    activeSessions?.delete(tokenToRevoke);
    res.json({ ok: true });
  });

  // ---- Usage ----

  router.get('/usage/me', postAgentAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthedRequest).userId;
    const summary = await summarizeUsageForUser(pool, userId);
    res.json(summary);
  });

  // ---- Billing / Add-on ----

  /**
   * Returns the current user's Stripe subscription state + Post Agent add-on info,
   * so the /billing/post-agent page can show "Add for X NOK/mo".
   * Doesn't mutate anything.
   */
  router.get('/billing/preview', userAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthedRequest).userId;
    const postAgentPriceMonthly = process.env.STRIPE_PRICE_POST_AGENT_MONTHLY;
    const postAgentPriceYearly = process.env.STRIPE_PRICE_POST_AGENT_YEARLY;

    if (!postAgentPriceMonthly && !postAgentPriceYearly) {
      res.json({
        configured: false,
        reason: 'post_agent_prices_not_configured',
        detail: 'Run backend/scripts/seed-post-agent-stripe-product.ts to create products + set STRIPE_PRICE_POST_AGENT_* env vars.',
      });
      return;
    }

    let stripeSubscriptionId: string | null = null;
    try {
      const { rows } = await pool.query(
        `SELECT stripe_subscription_id FROM subscriptions
         WHERE user_id = $1 AND status IN ('active','trialing')
         ORDER BY start_date DESC LIMIT 1`,
        [userId],
      );
      stripeSubscriptionId = rows[0]?.stripe_subscription_id ?? null;
    } catch {
      // Table missing or query failed — treat as no sub
    }

    if (!stripeSubscriptionId) {
      res.json({
        configured: true,
        hasActiveSubscription: false,
        hasPostAgent: false,
        canAddPostAgent: false,
        reason: 'no_active_role_room_subscription',
        availablePrices: {
          monthly: postAgentPriceMonthly ?? null,
          yearly: postAgentPriceYearly ?? null,
        },
      });
      return;
    }

    try {
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ['items.data.price'],
      });
      const items = sub.items?.data ?? [];
      const postAgentItem = items.find(
        (it) =>
          it.price?.id === postAgentPriceMonthly ||
          it.price?.id === postAgentPriceYearly,
      );
      res.json({
        configured: true,
        hasActiveSubscription: true,
        hasPostAgent: Boolean(postAgentItem),
        canAddPostAgent: !postAgentItem,
        subscriptionId: sub.id,
        currentItemCount: items.length,
        availablePrices: {
          monthly: postAgentPriceMonthly ?? null,
          yearly: postAgentPriceYearly ?? null,
        },
      });
    } catch (err) {
      res.status(502).json({
        configured: true,
        error: 'stripe_lookup_failed',
        detail: (err as Error).message,
      });
    }
  });

  /**
   * Adds the Post Agent price as a subscription item on the user's current Stripe
   * subscription. Stripe handles proration automatically — user pays the
   * remainder of the current period on next invoice.
   *
   * Body: { interval: 'monthly' | 'yearly' }
   */
  router.post('/billing/add-to-subscription', userAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthedRequest).userId;
    const interval = (req.body?.interval ?? 'monthly') as 'monthly' | 'yearly';
    const priceId =
      interval === 'yearly'
        ? process.env.STRIPE_PRICE_POST_AGENT_YEARLY
        : process.env.STRIPE_PRICE_POST_AGENT_MONTHLY;

    if (!priceId) {
      res.status(503).json({
        error: 'post_agent_price_not_configured',
        detail: `Missing env var STRIPE_PRICE_POST_AGENT_${interval.toUpperCase()}`,
      });
      return;
    }

    let stripeSubscriptionId: string | null = null;
    try {
      const { rows } = await pool.query(
        `SELECT stripe_subscription_id FROM subscriptions
         WHERE user_id = $1 AND status IN ('active','trialing')
         ORDER BY start_date DESC LIMIT 1`,
        [userId],
      );
      stripeSubscriptionId = rows[0]?.stripe_subscription_id ?? null;
    } catch (err) {
      res.status(500).json({ error: 'subscription_lookup_failed', detail: (err as Error).message });
      return;
    }

    if (!stripeSubscriptionId) {
      res.status(404).json({
        error: 'no_active_subscription',
        detail: 'User must have an active Role Room subscription before adding Post Agent.',
      });
      return;
    }

    try {
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');

      // Check it isn't already added (idempotent)
      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const existing = (sub.items?.data ?? []).find((it) => it.price?.id === priceId);
      if (existing) {
        res.json({
          ok: true,
          already_subscribed: true,
          subscriptionItemId: existing.id,
        });
        return;
      }

      const item = await stripe.subscriptionItems.create({
        subscription: stripeSubscriptionId,
        price: priceId,
        proration_behavior: 'create_prorations',
      });

      // Write entitlement immediately so checkAgentEntitlement sees access on
      // the next request (rather than waiting for Stripe webhook propagation).
      try {
        await pool.query(
          `INSERT INTO role_room_agent_entitlements (user_id, status, source, notes)
           VALUES ($1, 'active', 'plan_pro', $2)
           ON CONFLICT DO NOTHING`,
          [userId, `Auto-granted by post-agent add-on (item ${item.id})`],
        );
      } catch (entErr) {
        console.warn('[post-agent] entitlement upsert failed (Stripe still added):', entErr);
      }

      console.log(`[post-agent] added subscription item for user=${userId} item=${item.id}`);
      res.json({
        ok: true,
        already_subscribed: false,
        subscriptionItemId: item.id,
      });
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 502;
      res.status(status).json({
        error: 'stripe_add_item_failed',
        detail: (err as Error).message,
      });
    }
  });

  // ---- Admin: manage Post Agent prices ----

  /**
   * Admin-only — returns the current Post Agent Stripe product + prices + env-var
   * configuration so the AdminDashboard's price-management panel can display
   * what's actually configured live in Stripe.
   */
  router.get(
    '/billing/admin/prices',
    userAuth,
    async (req: Request, res: Response) => {
      const session = activeSessions?.get((req as AuthedRequest).bearerToken);
      if (!session || (session.role !== 'admin' && session.role !== 'owner' && session.role !== 'super_admin')) {
        res.status(403).json({ error: 'admin_required' });
        return;
      }
      if (!process.env.STRIPE_SECRET_KEY) {
        res.status(503).json({
          error: 'stripe_not_configured',
          detail: 'STRIPE_SECRET_KEY missing on backend.',
        });
        return;
      }
      try {
        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const search = await stripe.products.search({
          query: `metadata['app']:'post-agent'`,
          limit: 5,
        });
        const product = search.data.find((p) => p.active) ?? null;
        let prices: unknown[] = [];
        if (product) {
          const priceList = await stripe.prices.list({ product: product.id, limit: 20 });
          prices = priceList.data;
        }

        // Usage metrics
        let activeSubscriptions = 0;
        let tokensThisMonth = 0;
        let revenueThisMonthNok = 0;
        try {
          const r = await pool.query(
            `SELECT
               COALESCE(SUM(input_tokens + output_tokens), 0)::BIGINT AS total_tokens,
               COUNT(DISTINCT user_id)::BIGINT AS users
             FROM post_agent_usage
             WHERE at >= date_trunc('month', NOW())`,
          );
          tokensThisMonth = Number(r.rows[0]?.total_tokens ?? 0);
          activeSubscriptions = Number(r.rows[0]?.users ?? 0);
          revenueThisMonthNok = activeSubscriptions * 299; // approximate (monthly base)
        } catch {
          // Table may not exist yet
        }

        res.json({
          product: product
            ? {
                id: product.id,
                name: product.name,
                description: product.description,
                active: product.active,
              }
            : null,
          prices,
          envVars: {
            STRIPE_PRODUCT_POST_AGENT: process.env.STRIPE_PRODUCT_POST_AGENT,
            STRIPE_PRICE_POST_AGENT_MONTHLY: process.env.STRIPE_PRICE_POST_AGENT_MONTHLY,
            STRIPE_PRICE_POST_AGENT_YEARLY: process.env.STRIPE_PRICE_POST_AGENT_YEARLY,
          },
          mode: process.env.STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'test',
          usageMetrics: {
            activeSubscriptions,
            tokensThisMonth,
            revenueThisMonthNok,
          },
        });
      } catch (err) {
        res.status(502).json({
          error: 'stripe_query_failed',
          detail: (err as Error).message,
        });
      }
    },
  );

  /**
   * Admin-only — updates monthly/yearly Post Agent prices in Stripe.
   * Implementation: creates NEW prices (Stripe prices are immutable), archives
   * old ones, and reports the new IDs for the admin to update env vars.
   */
  router.post(
    '/billing/admin/prices',
    userAuth,
    async (req: Request, res: Response) => {
      const session = activeSessions?.get((req as AuthedRequest).bearerToken);
      if (!session || (session.role !== 'admin' && session.role !== 'owner' && session.role !== 'super_admin')) {
        res.status(403).json({ error: 'admin_required' });
        return;
      }
      if (!process.env.STRIPE_SECRET_KEY) {
        res.status(503).json({ error: 'stripe_not_configured' });
        return;
      }

      const monthlyNok = Number(req.body?.monthlyNok ?? 0);
      const yearlyNok = Number(req.body?.yearlyNok ?? 0);
      if (monthlyNok <= 0 && yearlyNok <= 0) {
        res.status(400).json({ error: 'invalid_prices', detail: 'monthlyNok and/or yearlyNok required' });
        return;
      }

      try {
        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const search = await stripe.products.search({
          query: `metadata['app']:'post-agent'`,
          limit: 5,
        });
        const product = search.data.find((p) => p.active);
        if (!product) {
          res.status(404).json({
            error: 'product_not_seeded',
            detail: 'Run backend/scripts/seed-post-agent-stripe-product.ts first.',
          });
          return;
        }

        const existing = await stripe.prices.list({ product: product.id, active: true, limit: 50 });
        const result: Record<string, unknown> = { productId: product.id };

        for (const tier of ['monthly', 'yearly'] as const) {
          const targetNok = tier === 'monthly' ? monthlyNok : yearlyNok;
          if (targetNok <= 0) continue;
          const interval = tier === 'monthly' ? 'month' : 'year';
          const oldPrice = existing.data.find(
            (p) => p.recurring?.interval === interval && p.metadata?.tier_key === tier,
          );
          const targetAmountOre = Math.round(targetNok * 100);
          if (oldPrice && oldPrice.unit_amount === targetAmountOre) {
            result[`${tier}PriceId`] = oldPrice.id;
            result[`${tier}Changed`] = false;
            continue;
          }
          if (oldPrice) {
            await stripe.prices.update(oldPrice.id, { active: false });
          }
          const newPrice = await stripe.prices.create({
            product: product.id,
            unit_amount: targetAmountOre,
            currency: 'nok',
            recurring: { interval: interval as 'month' | 'year' },
            nickname: `Post Agent · ${tier}`,
            metadata: { app: 'post-agent', tier_key: tier, source: 'admin_update' },
          });
          result[`${tier}PriceId`] = newPrice.id;
          result[`${tier}Changed`] = true;
        }

        res.json({
          ok: true,
          ...result,
          envVarUpdateNeeded: 'Set STRIPE_PRICE_POST_AGENT_MONTHLY/YEARLY env vars in Render to the new price IDs above.',
        });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode ?? 502;
        res.status(status).json({
          error: 'stripe_update_failed',
          detail: (err as Error).message,
        });
      }
    },
  );

  return router;
}
