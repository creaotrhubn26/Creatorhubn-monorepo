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
import { sendEmail } from './casting-reminder-sender.js';
import { presignTakeReadUrl } from './coverage-take-service.js';
import {
  countActiveSeats,
  deletePairingCode,
  ensurePostAgentTables,
  getPairingCode,
  getTeamSubscription,
  grantTeamSeat,
  insertPairingCode,
  insertUsage,
  isDeviceRevoked,
  listDevicesForUser,
  listProjectSeats,
  listUserActiveSeats,
  markPairingPaired,
  prunePairingCodes,
  registerDevice,
  revokeDevice,
  revokeTeamSeat,
  summarizeUsageForUser,
  touchDeviceLastSeen,
  upsertTeamSubscription,
  userHasActiveTeamSeat,
  type TeamSeatRow,
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

      // Entitlement gate — multi-path access check, in priority order:
      //  1. Admin/super_admin role  (session.role)        → allowed
      //  2. Active Role Room sub / personal Post Agent    → allowed
      //  3. Production team-seat granted by a project lead → allowed
      //  4. Otherwise → 402
      const session = activeSessions?.get((req as AuthedRequest).bearerToken);
      const entitlement = await checkAgentEntitlement(pool, userId, session?.role);
      if (!entitlement.allowed) {
        // Try the team-seat fallback before returning 402
        const teamAccess = await userHasActiveTeamSeat(pool, userId);
        if (!teamAccess) {
          res.status(402).json({
            error: 'subscription_required',
            detail: entitlement.reason,
            upsell: entitlement.upsell,
          });
          return;
        }
        // User has team-seat — allow and log for usage tracking
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

  // ---- Current user profile ----

  /**
   * Returns the signed-in user's basic profile so the Tauri app can render
   * avatar + name + role without direct DB access. Used by HeaderBar.
   */
  router.get('/me', postAgentAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthedRequest).userId;
    try {
      const { rows } = await pool.query(
        `SELECT id, email, first_name, last_name, role, profile_image_url, profession, company_name, is_administrator
         FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      );
      const u = rows[0];
      if (!u) {
        res.status(404).json({ error: 'user_not_found' });
        return;
      }
      const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
      res.json({
        id: u.id,
        email: u.email,
        name: fullName || u.email?.split('@')[0] || 'Bruker',
        firstName: u.first_name,
        lastName: u.last_name,
        role: u.role || 'user',
        profileImageUrl: u.profile_image_url,
        profession: u.profession,
        companyName: u.company_name,
        isAdministrator: u.is_administrator === true,
      });
    } catch (err) {
      res.status(500).json({ error: 'profile_lookup_failed', detail: (err as Error).message });
    }
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
  /**
   * Billing overview — every active/trialing Stripe subscription for the
   * signed-in user, with line-item breakdowns + monthly-equivalent totals.
   * Used by the dashboard's "Mine abonnementer"-dialog so the lead sees ALL
   * their paid services in one place, not just Post Agent.
   */
  router.get('/billing/overview', userAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthedRequest).userId;
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      res.json({ subscriptions: [], totalMonthlyNok: 0, currency: 'NOK', degraded: true, detail: 'stripe_not_configured' });
      return;
    }
    try {
      const { rows } = await pool.query(
        `SELECT stripe_customer_id FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      );
      let customerId = rows[0]?.stripe_customer_id as string | null | undefined;
      if (!customerId) {
        const sub = await pool.query(
          `SELECT stripe_customer_id FROM subscriptions
           WHERE user_id = $1 AND stripe_customer_id IS NOT NULL
           ORDER BY start_date DESC LIMIT 1`,
          [userId],
        );
        customerId = sub.rows[0]?.stripe_customer_id;
      }
      if (!customerId) {
        res.json({ subscriptions: [], totalMonthlyNok: 0, currency: 'NOK' });
        return;
      }

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(secret);
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        expand: ['data.items.data.price.product'],
        limit: 20,
      });

      const active = subs.data.filter((s) => s.status === 'active' || s.status === 'trialing');
      const out = active.map((s) => {
        // Stripe v19: current_period_end er flyttet fra Subscription til items.data[i]
        const firstItem = s.items?.data?.[0] as { current_period_end?: number } | undefined;
        const currentPeriodEnd = firstItem?.current_period_end ?? null;
        return ({
        id: s.id,
        status: s.status,
        currentPeriodEnd,
        cancelAtPeriodEnd: s.cancel_at_period_end,
        items: s.items.data.map((it) => {
          const product = it.price?.product as any;
          const productName = (typeof product === 'object' ? product?.name : undefined) || 'Subscription item';
          const amount = (it.price?.unit_amount || 0) / 100;
          const interval = it.price?.recurring?.interval || 'month';
          const qty = it.quantity || 1;
          // Normalize to monthly equivalent
          const perMonth = interval === 'year' ? (amount * qty) / 12 : interval === 'week' ? (amount * qty) * (52 / 12) : amount * qty;
          return {
            itemId: it.id,
            productName,
            unitAmount: amount,
            currency: (it.price?.currency || 'nok').toUpperCase(),
            interval,
            quantity: qty,
            monthlyEquivalent: perMonth,
          };
        }),
        });
      });

      // Sum monthlyEquivalent across all NOK items (skip mixed-currency totals)
      let totalMonthlyNok = 0;
      let currency = 'NOK';
      const currencies = new Set<string>();
      out.forEach((s) => s.items.forEach((it) => {
        currencies.add(it.currency);
        if (it.currency === 'NOK') totalMonthlyNok += it.monthlyEquivalent;
      }));
      if (currencies.size === 1) currency = Array.from(currencies)[0];

      res.json({ subscriptions: out, totalMonthlyNok: Math.round(totalMonthlyNok), currency, mixedCurrencies: currencies.size > 1 });
    } catch (err) {
      res.json({ subscriptions: [], totalMonthlyNok: 0, currency: 'NOK', degraded: true, detail: (err as Error).message });
    }
  });

  /**
   * Stripe Customer Portal — self-serve sub management (cancel, update card,
   * invoices, billing history). Returns a one-time URL the lead can be
   * redirected to.
   */
  router.post('/billing/customer-portal', userAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthedRequest).userId;
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      res.status(503).json({ error: 'stripe_not_configured' });
      return;
    }
    try {
      const { rows } = await pool.query(
        `SELECT stripe_customer_id FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      );
      let customerId = rows[0]?.stripe_customer_id as string | null | undefined;
      // Fallback: look up via subscriptions table (some flows write the customer
      // there but not on users)
      if (!customerId) {
        const sub = await pool.query(
          `SELECT stripe_customer_id FROM subscriptions
           WHERE user_id = $1 AND stripe_customer_id IS NOT NULL
           ORDER BY start_date DESC LIMIT 1`,
          [userId],
        );
        customerId = sub.rows[0]?.stripe_customer_id;
      }
      if (!customerId) {
        res.status(409).json({
          error: 'no_stripe_customer',
          detail: 'Du har ingen aktiv betalingskobling ennå. Kjøp Post Agent først via /marketplace/post-agent.',
        });
        return;
      }

      const origin =
        (req.headers.origin as string | undefined) ||
        (process.env.PUBLIC_APP_URL ?? 'https://creatorhubn.com');
      const returnPath = typeof req.body?.returnPath === 'string' ? req.body.returnPath : '/';

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(secret);
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}${returnPath}`,
      });
      res.json({ ok: true, url: session.url });
    } catch (err) {
      console.error('[post-agent] customer-portal failed:', err);
      res.status(500).json({ error: 'portal_create_failed', detail: (err as Error).message });
    }
  });

  /**
   * Standalone Post Agent purchase — for users who do NOT have a Role Room
   * subscription yet. Creates a Stripe Checkout session with a single line-item
   * (Post Agent monthly) at the requested quantity. The webhook then writes the
   * subscriptions-row + entitlement when checkout completes.
   *
   * Request body: { productionId?: string; seatCount?: number }
   *   - productionId: where to redirect back to after checkout
   *   - seatCount: how many crew seats to provision (defaults to 1 = lead only)
   */
  router.post('/billing/standalone-checkout', userAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthedRequest).userId;
    const productionId = String(req.body?.productionId ?? '').trim();
    const seatCount = Math.max(1, parseInt(String(req.body?.seatCount ?? 1), 10) || 1);
    const priceId = process.env.STRIPE_PRICE_POST_AGENT_MONTHLY;
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!priceId || !secret) {
      res.status(503).json({ error: 'stripe_not_configured' });
      return;
    }

    try {
      const { rows: userRows } = await pool.query(
        `SELECT email, stripe_customer_id FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      );
      const email = userRows[0]?.email;
      const existingCustomer = userRows[0]?.stripe_customer_id;

      const origin =
        (req.headers.origin as string | undefined) ||
        (process.env.PUBLIC_APP_URL ?? 'https://creatorhubn.com');
      const successQuery = productionId
        ? `productionId=${encodeURIComponent(productionId)}&checkout=success`
        : 'checkout=success';
      const cancelQuery = productionId ? `productionId=${encodeURIComponent(productionId)}` : '';

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(secret);
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: seatCount }],
        success_url: `${origin}/marketplace/post-agent?${successQuery}`,
        cancel_url: `${origin}/marketplace/post-agent${cancelQuery ? '?' + cancelQuery : ''}`,
        client_reference_id: userId,
        ...(existingCustomer ? { customer: existingCustomer } : email ? { customer_email: email } : {}),
        metadata: {
          product: 'post_agent_standalone',
          role_room_user_id: userId,
          ...(productionId ? { productionId } : {}),
          seatCount: String(seatCount),
        },
        subscription_data: {
          metadata: {
            product: 'post_agent_standalone',
            role_room_user_id: userId,
            ...(productionId ? { productionId } : {}),
          },
        },
      });

      res.json({ ok: true, url: session.url, id: session.id });
    } catch (err) {
      console.error('[post-agent] standalone-checkout failed:', err);
      res.status(500).json({ error: 'checkout_create_failed', detail: (err as Error).message });
    }
  });

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

  // ---- Team-seats per production ----

  /**
   * Verify the requesting user owns the given project (= production lead).
   * Returns null on success; an Error to throw otherwise.
   */
  async function requireProjectOwnership(
    req: Request,
    res: Response,
    projectId: string,
  ): Promise<boolean> {
    const userId = (req as AuthedRequest).userId;
    try {
      const { rows } = await pool.query(
        `SELECT user_id FROM projects WHERE id = $1 LIMIT 1`,
        [projectId],
      );
      if (rows.length === 0) {
        res.status(404).json({ error: 'project_not_found' });
        return false;
      }
      if (rows[0].user_id !== userId) {
        res.status(403).json({ error: 'not_project_owner' });
        return false;
      }
      return true;
    } catch (err) {
      res.status(500).json({ error: 'project_lookup_failed', detail: (err as Error).message });
      return false;
    }
  }

  /**
   * Sync Stripe subscription_item.quantity to match current active seat count.
   * Creates the subscription_item on first seat, deletes it when count hits 0.
   */
  async function syncStripeQuantity(projectId: string, ownerUserId: string): Promise<{ ok: boolean; error?: string; quantity: number }> {
    const quantity = await countActiveSeats(pool, projectId);
    const priceId = process.env.STRIPE_PRICE_POST_AGENT_MONTHLY;
    if (!priceId || !process.env.STRIPE_SECRET_KEY) {
      return { ok: false, error: 'stripe_not_configured', quantity };
    }
    try {
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const existing = await getTeamSubscription(pool, projectId);

      if (quantity === 0) {
        // Tear down the subscription_item if no seats left
        if (existing?.stripeSubscriptionItemId) {
          try {
            await stripe.subscriptionItems.del(existing.stripeSubscriptionItemId, {
              proration_behavior: 'create_prorations',
            });
          } catch (e) {
            console.warn('[post-agent] failed to delete subscription_item:', (e as Error).message);
          }
        }
        if (existing) {
          await upsertTeamSubscription(pool, { ...existing, seatCount: 0, status: 'cancelled' });
        }
        return { ok: true, quantity };
      }

      // Look up the owner's active subscription so we can attach the seat item
      const { rows: subRows } = await pool.query(
        `SELECT stripe_subscription_id FROM subscriptions
         WHERE user_id = $1 AND status IN ('active','trialing')
         ORDER BY start_date DESC LIMIT 1`,
        [ownerUserId],
      );
      const stripeSubId: string | undefined = subRows[0]?.stripe_subscription_id;
      if (!stripeSubId) {
        return { ok: false, error: 'owner_has_no_subscription', quantity };
      }

      if (!existing?.stripeSubscriptionItemId) {
        // First time — create the subscription_item with the right quantity
        const item = await stripe.subscriptionItems.create({
          subscription: stripeSubId,
          price: priceId,
          quantity,
          proration_behavior: 'create_prorations',
        });
        await upsertTeamSubscription(pool, {
          projectId,
          ownerUserId,
          stripeSubscriptionId: stripeSubId,
          stripeSubscriptionItemId: item.id,
          seatCount: quantity,
          status: 'active',
        });
        return { ok: true, quantity };
      }

      // Update quantity on existing subscription_item
      await stripe.subscriptionItems.update(existing.stripeSubscriptionItemId, {
        quantity,
        proration_behavior: 'create_prorations',
      });
      await upsertTeamSubscription(pool, { ...existing, seatCount: quantity, status: 'active' });
      return { ok: true, quantity };
    } catch (err) {
      console.error('[post-agent] syncStripeQuantity failed:', err);
      return { ok: false, error: (err as Error).message, quantity };
    }
  }

  router.get(
    '/team/:projectId/seats',
    userAuth,
    async (req: Request, res: Response) => {
      const projectId = req.params.projectId;
      if (!(await requireProjectOwnership(req, res, projectId))) return;
      const seats = await listProjectSeats(pool, projectId);
      const sub = await getTeamSubscription(pool, projectId);

      // Hydrate user info for each seat
      const userIds = [...new Set(seats.map((s) => s.userId))];
      let userMap: Record<string, { email: string; name: string; profileImageUrl?: string }> = {};
      if (userIds.length > 0) {
        const { rows } = await pool.query(
          `SELECT id, email, first_name, last_name, profile_image_url FROM users WHERE id = ANY($1)`,
          [userIds],
        );
        userMap = Object.fromEntries(
          rows.map((u) => [
            u.id,
            {
              email: u.email,
              name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
              profileImageUrl: u.profile_image_url ?? undefined,
            },
          ]),
        );
      }

      res.json({
        projectId,
        subscription: sub,
        seats: seats.map((s) => ({
          userId: s.userId,
          email: userMap[s.userId]?.email,
          name: userMap[s.userId]?.name,
          profileImageUrl: userMap[s.userId]?.profileImageUrl,
          grantedAt: s.grantedAt,
          revokedAt: s.revokedAt,
          isActive: s.revokedAt === null,
        })),
        activeSeatCount: seats.filter((s) => s.revokedAt === null).length,
        pricePerSeatNok: 299,
      });
    },
  );

  router.post(
    '/team/:projectId/grant',
    userAuth,
    async (req: Request, res: Response) => {
      const projectId = req.params.projectId;
      if (!(await requireProjectOwnership(req, res, projectId))) return;
      const ownerUserId = (req as AuthedRequest).userId;
      const targetEmail = String(req.body?.email ?? '').trim().toLowerCase();
      let targetUserId = String(req.body?.userId ?? '').trim();

      if (!targetUserId && !targetEmail) {
        res.status(400).json({ error: 'userId or email required' });
        return;
      }
      if (!targetUserId && targetEmail) {
        const { rows } = await pool.query(`SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`, [targetEmail]);
        if (rows.length === 0) {
          res.status(404).json({ error: 'user_not_found', detail: `No Role Room user with email ${targetEmail}` });
          return;
        }
        targetUserId = rows[0].id;
      }

      // Pre-flight: confirm owner has an active Stripe subscription before
      // writing the seat — otherwise we'd grant access without billing
      // (the seat row is created but syncStripeQuantity silently fails with
      // 'owner_has_no_subscription'). Block early with a self-service CTA.
      const { rows: subCheck } = await pool.query(
        `SELECT 1 FROM subscriptions
         WHERE user_id = $1 AND status IN ('active','trialing')
         LIMIT 1`,
        [ownerUserId],
      );
      if (subCheck.length === 0) {
        res.status(402).json({
          error: 'owner_subscription_required',
          detail:
            'Du må ha et aktivt Role Room-abonnement før du kan tildele Post Agent-seats. Seat-fakturering legges som en line-item på ditt eksisterende abonnement.',
          actionUrl: '/billing/post-agent',
          actionLabel: 'Sett opp billing først',
        });
        return;
      }

      const granted = await grantTeamSeat(pool, projectId, targetUserId, ownerUserId);
      const sync = await syncStripeQuantity(projectId, ownerUserId);

      // Roll back the grant if Stripe sync failed for any reason —
      // otherwise crew gets free access and we lose money on the AI bill.
      if (!sync.ok) {
        await revokeTeamSeat(pool, projectId, targetUserId).catch(() => null);
        res.status(502).json({
          error: 'stripe_sync_failed',
          detail: sync.error || 'Stripe-syncen feilet — seat ble rullet tilbake.',
        });
        return;
      }

      // Fire-and-forget: notify the crew member that they now have access.
      // Doesn't block the response — email failures shouldn't break the grant.
      void notifyCrewOfGrant(targetEmail, targetUserId, projectId, ownerUserId);

      res.json({
        granted,
        userId: targetUserId,
        ...sync,
      });
    },
  );

  async function notifyCrewOfGrant(
    fallbackEmail: string,
    targetUserId: string,
    projectId: string,
    ownerUserId: string,
  ): Promise<void> {
    try {
      // Look up the crew member's email + name (fallback to the email used in the grant)
      const { rows: targetRows } = await pool.query(
        `SELECT email, first_name, last_name FROM users WHERE id = $1 LIMIT 1`,
        [targetUserId],
      );
      const crewEmail = (targetRows[0]?.email || fallbackEmail || '').trim();
      if (!crewEmail) return;
      const crewName = [targetRows[0]?.first_name, targetRows[0]?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();

      const { rows: ownerRows } = await pool.query(
        `SELECT email, first_name, last_name FROM users WHERE id = $1 LIMIT 1`,
        [ownerUserId],
      );
      const ownerName = [ownerRows[0]?.first_name, ownerRows[0]?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() || ownerRows[0]?.email || 'Produksjonslederen';

      const { rows: projectRows } = await pool.query(
        `SELECT title, name FROM projects WHERE id = $1 LIMIT 1`,
        [projectId],
      );
      const productionName = projectRows[0]?.title || projectRows[0]?.name || 'produksjonen';

      const greeting = crewName ? `Hei ${crewName.split(' ')[0]},` : 'Hei,';
      const subject = `Du har fått Post Agent-tilgang til ${productionName}`;
      const text = `${greeting}

${ownerName} har gitt deg tilgang til The Role Room Post Agent for produksjonen "${productionName}".

Slik kommer du i gang:

  1. Last ned Post Agent for Mac (Apple Silicon kreves):
     https://creatorhubn.com/link

  2. Logg inn med Role Room-kontoen din (${crewEmail}).

  3. Velg "${productionName}" i prosjekt-pickeren — appen leser automatisk
     scener, utstyr og klipp som er fanget under shoot.

Post Agent kjører lokalt på Mac-en din — ingen filer forlater maskinen utenom
thumbnails som sendes til Claude Vision for klipp-scoring.

Spørsmål? Svar på denne eposten.

— The Role Room`;

      const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; max-width: 560px; color: #1a0d45; line-height: 1.6;">
  <div style="border-left: 3px solid #a030c0; padding-left: 16px; margin-bottom: 24px;">
    <h2 style="font-size: 18px; margin: 0 0 4px; font-weight: 700;">Du har fått Post Agent-tilgang</h2>
    <p style="margin: 0; color: #6e3fc7; font-size: 14px;">Produksjon: <strong>${productionName}</strong></p>
  </div>

  <p>${greeting}</p>

  <p><strong>${ownerName}</strong> har gitt deg tilgang til The Role Room Post Agent for denne produksjonen.</p>

  <p style="margin-top: 24px;"><strong>Slik kommer du i gang:</strong></p>
  <ol style="padding-left: 20px;">
    <li style="margin-bottom: 8px;">Last ned <a href="https://creatorhubn.com/link" style="color: #a030c0; text-decoration: none; font-weight: 600;">Post Agent for Mac</a> (Apple Silicon).</li>
    <li style="margin-bottom: 8px;">Logg inn med Role Room-kontoen din (<code>${crewEmail}</code>).</li>
    <li style="margin-bottom: 8px;">Velg <strong>${productionName}</strong> i prosjekt-pickeren — appen leser scener, utstyr og fangede klipp automatisk.</li>
  </ol>

  <p style="background: #f4eefd; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #4a2e7a;">
    <strong>Privacy:</strong> Post Agent kjører lokalt på Mac-en din. Ingen filer forlater maskinen
    utenom thumbnails som sendes til Claude Vision for klipp-scoring.
  </p>

  <p style="margin-top: 32px; font-size: 13px; color: #6e3fc7;">
    Spørsmål? Svar på denne eposten.<br>
    — The Role Room
  </p>
</div>`;

      const result = await sendEmail({
        to: crewEmail,
        subject,
        text,
        html,
        fromName: 'The Role Room',
      });
      if (!result.success) {
        console.warn('[post-agent] crew-grant email failed:', result.error || 'unknown');
      }
    } catch (err) {
      console.warn('[post-agent] notifyCrewOfGrant threw:', (err as Error).message);
    }
  }

  router.delete(
    '/team/:projectId/grant/:userId',
    userAuth,
    async (req: Request, res: Response) => {
      const projectId = req.params.projectId;
      if (!(await requireProjectOwnership(req, res, projectId))) return;
      const ownerUserId = (req as AuthedRequest).userId;
      const userId = req.params.userId;

      const revoked = await revokeTeamSeat(pool, projectId, userId);
      const sync = await syncStripeQuantity(projectId, ownerUserId);
      if (revoked) {
        void notifyCrewOfRevoke(userId, projectId, ownerUserId);
      }
      res.json({ revoked, ...sync });
    },
  );

  async function notifyCrewOfRevoke(
    targetUserId: string,
    projectId: string,
    ownerUserId: string,
  ): Promise<void> {
    try {
      const { rows: targetRows } = await pool.query(
        `SELECT email, first_name, last_name FROM users WHERE id = $1 LIMIT 1`,
        [targetUserId],
      );
      const crewEmail = (targetRows[0]?.email || '').trim();
      if (!crewEmail) return;
      const crewName = [targetRows[0]?.first_name, targetRows[0]?.last_name]
        .filter(Boolean).join(' ').trim();

      const { rows: ownerRows } = await pool.query(
        `SELECT email, first_name, last_name FROM users WHERE id = $1 LIMIT 1`,
        [ownerUserId],
      );
      const ownerName = [ownerRows[0]?.first_name, ownerRows[0]?.last_name]
        .filter(Boolean).join(' ').trim() || ownerRows[0]?.email || 'Produksjonslederen';

      const { rows: projectRows } = await pool.query(
        `SELECT title, name FROM projects WHERE id = $1 LIMIT 1`,
        [projectId],
      );
      const productionName = projectRows[0]?.title || projectRows[0]?.name || 'produksjonen';

      const greeting = crewName ? `Hei ${crewName.split(' ')[0]},` : 'Hei,';
      const subject = `Post Agent-tilgangen din til ${productionName} er avsluttet`;
      const text = `${greeting}

${ownerName} har avsluttet Post Agent-tilgangen din til produksjonen "${productionName}".

Det betyr at du ikke lenger kan kjøre AI-cull, scene-detection eller andre Post Agent-funksjoner på denne produksjonen. Eventuelle lokale klipp og prosjektfiler på Mac-en din er upåvirket — appen mister bare AI-funksjonene for dette prosjektet.

Hvis dette virker feil, ta kontakt med ${ownerName}.

— The Role Room`;

      const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; max-width: 560px; color: #1a0d45; line-height: 1.6;">
  <div style="border-left: 3px solid #6e3fc7; padding-left: 16px; margin-bottom: 24px;">
    <h2 style="font-size: 18px; margin: 0 0 4px; font-weight: 700;">Post Agent-tilgang avsluttet</h2>
    <p style="margin: 0; color: #6e3fc7; font-size: 14px;">Produksjon: <strong>${productionName}</strong></p>
  </div>

  <p>${greeting}</p>

  <p><strong>${ownerName}</strong> har avsluttet Post Agent-tilgangen din til denne produksjonen.</p>

  <p>Det betyr at AI-cull, scene-detection og andre Post Agent-funksjoner ikke lenger er
  tilgjengelige for dette prosjektet. Lokale klipp og prosjektfiler er upåvirket.</p>

  <p style="margin-top: 24px; font-size: 13px; color: #6e3fc7;">
    Hvis dette virker feil, ta kontakt med ${ownerName}.<br>
    — The Role Room
  </p>
</div>`;

      const result = await sendEmail({
        to: crewEmail, subject, text, html, fromName: 'The Role Room',
      });
      if (!result.success) {
        console.warn('[post-agent] crew-revoke email failed:', result.error || 'unknown');
      }
    } catch (err) {
      console.warn('[post-agent] notifyCrewOfRevoke threw:', (err as Error).message);
    }
  }

  /** Where the signed-in user has Post Agent access via team-seats. */
  router.get('/team/my-seats', postAgentAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthedRequest).userId;
    const seats = await listUserActiveSeats(pool, userId);
    if (seats.length === 0) {
      res.json({ seats: [] });
      return;
    }
    const projectIds = seats.map((s) => s.projectId);
    const { rows } = await pool.query(
      `SELECT id, name, title, project_type FROM projects WHERE id = ANY($1)`,
      [projectIds],
    );
    const meta = Object.fromEntries(rows.map((r) => [r.id, r]));
    res.json({
      seats: seats.map((s) => ({
        projectId: s.projectId,
        projectName: meta[s.projectId]?.title || meta[s.projectId]?.name || 'Untitled production',
        projectType: meta[s.projectId]?.project_type,
        grantedAt: s.grantedAt,
      })),
    });
  });

  /** Admin: list all active Post Agent team-seats across all productions,
   *  with crew + lead names + summary (count, MRR). Admin/super_admin only.
   */
  router.get('/admin/team-seats', userAuth, async (req: Request, res: Response) => {
    const session = activeSessions?.get((req as AuthedRequest).bearerToken);
    const role = session?.role || '';
    if (role !== 'admin' && role !== 'super_admin') {
      res.status(403).json({ error: 'admin_only' });
      return;
    }
    try {
      const { rows } = await pool.query(
        `SELECT s.user_id, s.project_id, s.granted_at, s.granted_by,
                cu.email AS crew_email, cu.first_name AS crew_first_name, cu.last_name AS crew_last_name,
                p.title AS project_title, p.name AS project_name,
                lu.email AS lead_email, lu.first_name AS lead_first_name, lu.last_name AS lead_last_name
         FROM post_agent_team_seats s
         LEFT JOIN users cu ON cu.id = s.user_id
         LEFT JOIN projects p ON p.id = s.project_id
         LEFT JOIN users lu ON lu.id = s.granted_by
         WHERE s.is_active = true
         ORDER BY s.granted_at DESC NULLS LAST
         LIMIT 500`,
      );
      const seats = rows.map((r) => ({
        userId: r.user_id,
        projectId: r.project_id,
        projectName: r.project_title || r.project_name || 'Untitled production',
        grantedAt: r.granted_at,
        crew: {
          email: r.crew_email,
          name: [r.crew_first_name, r.crew_last_name].filter(Boolean).join(' ') || r.crew_email || '?',
        },
        lead: {
          email: r.lead_email,
          name: [r.lead_first_name, r.lead_last_name].filter(Boolean).join(' ') || r.lead_email || '?',
        },
      }));
      const seatPrice = 299;
      res.json({
        seats,
        summary: {
          activeSeatCount: seats.length,
          seatPriceNok: seatPrice,
          monthlyMrrNok: seats.length * seatPrice,
        },
      });
    } catch (e) {
      res.json({ seats: [], summary: { activeSeatCount: 0, seatPriceNok: 299, monthlyMrrNok: 0 }, degraded: true, detail: (e as Error).message });
    }
  });

  /** Crew members from a project who could be seated (have an email).
   *  Marks ones who already have an active team-seat so the marketplace UI
   *  can pre-check + disable them instead of double-granting.
   */
  router.get(
    '/team/:projectId/crew-candidates',
    userAuth,
    async (req: Request, res: Response) => {
      const projectId = req.params.projectId;
      if (!(await requireProjectOwnership(req, res, projectId))) return;
      try {
        const crewQ = pool.query(
          `SELECT id, name, email, role, department
           FROM casting_crew
           WHERE project_id = $1 AND email IS NOT NULL AND email <> ''
           ORDER BY name ASC
           LIMIT 200`,
          [projectId],
        );
        const seatsQ = pool.query(
          `SELECT s.user_id, u.email
           FROM post_agent_team_seats s
           LEFT JOIN users u ON u.id = s.user_id
           WHERE s.project_id = $1 AND s.is_active = true`,
          [projectId],
        );
        const [crewRes, seatsRes] = await Promise.all([crewQ, seatsQ]);
        const seatedEmails = new Set<string>(
          seatsRes.rows
            .map((r) => (r.email || '').toLowerCase().trim())
            .filter(Boolean),
        );
        res.json({
          crew: crewRes.rows.map((r) => ({
            id: r.id,
            name: r.name,
            email: r.email,
            role: r.role,
            department: r.department,
            alreadySeated: seatedEmails.has((r.email || '').toLowerCase().trim()),
          })),
        });
      } catch (e) {
        res.json({ crew: [], degraded: true, detail: (e as Error).message });
      }
    },
  );

  /** Productions where the signed-in user is the owner (=team lead). */
  router.get('/team/my-productions', postAgentAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthedRequest).userId;
    try {
      const { rows } = await pool.query(
        `SELECT p.id, p.title, p.name, p.project_type, p.event_date,
                COALESCE(s.active_seats, 0)::int AS active_seats
         FROM projects p
         LEFT JOIN (
           SELECT project_id, COUNT(*) AS active_seats
           FROM post_agent_team_seats
           WHERE is_active = true
           GROUP BY project_id
         ) s ON s.project_id = p.id
         WHERE p.owner_id = $1
         ORDER BY p.event_date DESC NULLS LAST, p.created_at DESC NULLS LAST
         LIMIT 100`,
        [userId],
      );
      res.json({
        productions: rows.map((r) => ({
          id: r.id,
          name: r.title || r.name || 'Untitled production',
          projectType: r.project_type,
          eventDate: r.event_date,
          activeSeats: r.active_seats,
        })),
      });
    } catch (e) {
      res.json({ productions: [], degraded: true, detail: (e as Error).message });
    }
  });

  // ---- Project-context for Tauri Post Agent app ----
  //
  // These read-only endpoints expose the data the desktop client needs to
  // pre-configure DaVinci Resolve from the Role Room project:
  //   • scenes  → pre-create matching bins
  //   • equipment → derive resolution/fps/color settings
  //   • live-set state → ingest captured clips with scene metadata
  //
  // Access: project owner OR active team-seat holder.

  async function requireProjectAccess(
    req: Request,
    res: Response,
    projectId: string,
  ): Promise<boolean> {
    const userId = (req as AuthedRequest).userId;
    try {
      const { rows } = await pool.query(
        `SELECT user_id FROM projects WHERE id = $1 LIMIT 1`,
        [projectId],
      );
      if (rows.length === 0) {
        res.status(404).json({ error: 'project_not_found' });
        return false;
      }
      if (rows[0].user_id === userId) return true;
      const hasSeat = await pool
        .query(
          `SELECT 1 FROM post_agent_team_seats
           WHERE project_id = $1 AND user_id = $2 AND is_active = true LIMIT 1`,
          [projectId, userId],
        )
        .then((r) => r.rows.length > 0)
        .catch(() => false);
      if (!hasSeat) {
        res.status(403).json({ error: 'no_project_access' });
        return false;
      }
      return true;
    } catch (err) {
      res.status(500).json({ error: 'project_lookup_failed', detail: (err as Error).message });
      return false;
    }
  }

  router.get('/projects/:projectId/scenes', postAgentAuth, async (req: Request, res: Response) => {
    const projectId = req.params.projectId;
    if (!(await requireProjectAccess(req, res, projectId))) return;
    try {
      const { rows } = await pool.query(
        `SELECT id, scene_number, title, description, setting, time_of_day, int_ext, characters
         FROM casting_scenes
         WHERE project_id = $1
         ORDER BY scene_number ASC NULLS LAST, created_at ASC NULLS LAST
         LIMIT 500`,
        [projectId],
      );
      res.json({
        scenes: rows.map((r) => ({
          id: r.id,
          sceneNumber: r.scene_number,
          title: r.title,
          description: r.description,
          setting: r.setting,
          timeOfDay: r.time_of_day,
          intExt: r.int_ext,
          characters: r.characters || [],
        })),
      });
    } catch (e) {
      res.json({ scenes: [], degraded: true, detail: (e as Error).message });
    }
  });

  router.get('/projects/:projectId/equipment', postAgentAuth, async (req: Request, res: Response) => {
    const projectId = req.params.projectId;
    if (!(await requireProjectAccess(req, res, projectId))) return;
    try {
      const { rows } = await pool.query(
        `SELECT id, name, brand, model, category, metadata
         FROM casting_equipment
         WHERE project_id = $1
         ORDER BY category ASC, name ASC
         LIMIT 500`,
        [projectId],
      );
      const equipment = rows.map((r) => ({
        id: r.id,
        name: r.name,
        brand: r.brand,
        model: r.model,
        category: r.category,
        metadata: r.metadata || {},
      }));
      // Derive a Resolve-ready settings hint from the first camera with usable metadata.
      const cameras = equipment.filter(
        (e) => (e.category || '').toLowerCase().includes('camera') || (e.category || '').toLowerCase() === 'kamera',
      );
      const primary = cameras.find((c) => c.metadata?.resolution || c.metadata?.frameRate) || cameras[0];
      res.json({
        equipment,
        projectSettings: primary
          ? {
              resolution: primary.metadata?.resolution || null,
              frameRate: primary.metadata?.frameRate || null,
              colorScience: primary.metadata?.colorScience || null,
              primaryCamera: { brand: primary.brand, model: primary.model, name: primary.name },
            }
          : null,
      });
    } catch (e) {
      res.json({ equipment: [], projectSettings: null, degraded: true, detail: (e as Error).message });
    }
  });

  router.get('/projects/:projectId/live-set-state', postAgentAuth, async (req: Request, res: Response) => {
    const projectId = req.params.projectId;
    if (!(await requireProjectAccess(req, res, projectId))) return;
    try {
      const takesQ = pool.query(
        `SELECT t.id, t.scene_id, t.shot_index, t.take_number, t.media_key,
                t.captured_at, t.marked_circled, t.processing_status,
                s.scene_number, s.title AS scene_title
         FROM casting_takes t
         LEFT JOIN casting_scenes s ON s.id = t.scene_id
         WHERE t.project_id = $1
         ORDER BY t.captured_at DESC NULLS LAST
         LIMIT 500`,
        [projectId],
      );
      const scenesQ = pool.query(
        `SELECT id, scene_number, title FROM casting_scenes
         WHERE project_id = $1 ORDER BY scene_number ASC NULLS LAST LIMIT 500`,
        [projectId],
      );
      const [takes, scenes] = await Promise.all([takesQ, scenesQ]);
      res.json({
        clips: takes.rows.map((r) => ({
          id: r.id,
          sceneId: r.scene_id,
          sceneNumber: r.scene_number,
          sceneTitle: r.scene_title,
          shotIndex: r.shot_index,
          takeNumber: r.take_number,
          mediaKey: r.media_key,
          capturedAt: r.captured_at,
          circled: !!r.marked_circled,
          processingStatus: r.processing_status,
        })),
        sceneMarkers: scenes.rows.map((r) => ({
          sceneId: r.id,
          sceneNumber: r.scene_number,
          title: r.title,
        })),
      });
    } catch (e) {
      res.json({ clips: [], sceneMarkers: [], degraded: true, detail: (e as Error).message });
    }
  });

  /** Batch: signed download URLs for a set of captured-clip IDs. Tauri uses
   *  these to stream clips to a local staging folder before importing into
   *  the Resolve Media Pool with bin-placement.
   *
   *  Body: { clipIds: string[] }  (max 200 per call)
   *  Returns: { urls: [{ clipId, mediaKey, downloadUrl?, sceneId, sceneTitle,
   *                       takeNumber, fileName, error? }] }
   */
  router.post(
    '/projects/:projectId/clips/download-urls',
    postAgentAuth,
    async (req: Request, res: Response) => {
      const projectId = req.params.projectId;
      if (!(await requireProjectAccess(req, res, projectId))) return;
      const clipIds = Array.isArray(req.body?.clipIds) ? req.body.clipIds : [];
      if (clipIds.length === 0 || clipIds.length > 200) {
        res.status(400).json({ error: 'clipIds must be a 1-200 length array' });
        return;
      }
      try {
        const { rows } = await pool.query(
          `SELECT t.id, t.media_key, t.take_number, t.scene_id,
                  s.scene_number, s.title AS scene_title
           FROM casting_takes t
           LEFT JOIN casting_scenes s ON s.id = t.scene_id
           WHERE t.project_id = $1 AND t.id = ANY($2)`,
          [projectId, clipIds],
        );
        const urls = await Promise.all(
          rows.map(async (r) => {
            const mediaKey = r.media_key as string | null;
            const downloadUrl = mediaKey ? await presignTakeReadUrl(mediaKey) : null;
            const ext = mediaKey ? (mediaKey.match(/\.[a-zA-Z0-9]+$/)?.[0] || '.mov') : '.mov';
            const safeTitle = (r.scene_title || `scene-${r.scene_number || '?'}`).replace(/[\s/\\]+/g, '_');
            const fileName = `${String(r.scene_number || 0).padStart(2, '0')}_${safeTitle}_take${r.take_number || 1}${ext}`;
            return {
              clipId: r.id,
              mediaKey,
              downloadUrl,
              sceneId: r.scene_id,
              sceneTitle: r.scene_title,
              sceneNumber: r.scene_number,
              takeNumber: r.take_number,
              fileName,
              error: downloadUrl ? null : (mediaKey ? 'presign_failed' : 'no_media_key'),
            };
          }),
        );
        res.json({ urls });
      } catch (e) {
        res.status(500).json({ error: 'download_urls_failed', detail: (e as Error).message });
      }
    },
  );

  void userHasActiveTeamSeat;

  return router;
}
