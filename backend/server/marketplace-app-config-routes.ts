/**
 * Marketplace App Config — Slice 9X.70
 *
 * Admin-styrt konfigurasjon for marketplace-apper. Daniel kan oppdatere
 * priser, tiers, bilder, beskrivelser og anbefalings-regler via admin-
 * dashboardet uten kode-deploy.
 *
 * Endepunkter:
 *   GET    /api/marketplace/apps                — public, fetches active apps
 *   GET    /api/admin/marketplace/apps          — admin, fetches ALL apps
 *   PUT    /api/admin/marketplace/apps/:id      — admin, upsert app
 *   POST   /api/admin/marketplace/apps          — admin, create app
 *   DELETE /api/admin/marketplace/apps/:id      — admin, soft-delete (is_active=false)
 *
 * Tabell: marketplace_app_config (migration 0127)
 */

import type { Express, Request, Response, NextFunction } from "express";
import type { Pool } from "pg";
import Stripe from "stripe";

type RequireAdminSession = (req: Request, res: Response, next: NextFunction) => void;

// ─── Stripe-klient (delt med resten av backend) ─────────────────────
let stripeClient: Stripe | null = null;
const getStripe = (): Stripe | null => {
  if (stripeClient) return stripeClient;
  const key = process.env.CREATORHUB_STRIPE_SECRET_KEY
    || process.env.STRIPE_SECRET_KEY
    || process.env.STRIPE_API_KEY;
  if (!key) return null;
  stripeClient = new Stripe(key.trim());
  return stripeClient;
};

/**
 * Konverterer prisstreng som "495 kr / mnd" til (495, 'mnd').
 * Returnerer null hvis vi ikke kan parse — admin må da sette pris manuelt
 * i Stripe.
 */
const parsePriceString = (priceStr: string): { amount: number; interval: 'month' | 'year' } | null => {
  if (!priceStr) return null;
  // Match første tall (med valgfri space/tusenskille) — "1 495 kr/mnd" → 1495
  const match = priceStr.replace(/\s/g, '').match(/(\d+)/);
  if (!match) return null;
  const amount = parseInt(match[1], 10);
  if (Number.isNaN(amount) || amount <= 0) return null;
  const isYearly = /år|ar|year|yr/i.test(priceStr);
  return { amount, interval: isYearly ? 'year' : 'month' };
};

/**
 * Sync én app til Stripe — oppretter/oppdaterer produkt + priser per tier.
 * Returnerer oppdaterte tiers med stripeProductId/stripePriceId.
 *
 * Strategy:
 *   - Hvert tier får sitt eget Stripe-produkt (slik at de kan kjøpes hver
 *     for seg). Navn = "<appName> — <tierName>".
 *   - Stripe-priser er immutable; ny pris opprettes hvis amount endres,
 *     og den gamle arkiveres.
 */
async function syncAppToStripe(app: any): Promise<any[]> {
  const stripe = getStripe();
  if (!stripe || !Array.isArray(app.subscriptionTiers)) {
    return app.subscriptionTiers || [];
  }

  const updated = [];
  for (const tier of app.subscriptionTiers) {
    const parsed = parsePriceString(tier.price);
    if (!parsed) {
      // Kan ikke parse pris (f.eks. "Tilpasset tilbud") — la tier være.
      updated.push(tier);
      continue;
    }

    try {
      // 1. Opprett/oppdater Stripe-produkt
      const productName = `${app.name} — ${tier.name}`;
      const productMetadata = {
        app_id: app.id,
        tier_id: tier.id,
        creatorhub_marketplace: 'true',
      };

      let productId = tier.stripeProductId;
      if (productId) {
        await stripe.products.update(productId, {
          name: productName,
          description: tier.bestFor,
          metadata: productMetadata,
          active: true,
        });
      } else {
        const product = await stripe.products.create({
          name: productName,
          description: tier.bestFor,
          metadata: productMetadata,
        });
        productId = product.id;
      }

      // 2. Sjekk om eksisterende pris fortsatt stemmer
      let priceId = tier.stripePriceId;
      const targetAmount = parsed.amount * 100; // NOK → øre
      let needsNewPrice = !priceId;

      if (priceId) {
        try {
          const existing = await stripe.prices.retrieve(priceId);
          if (
            existing.unit_amount !== targetAmount
            || existing.recurring?.interval !== parsed.interval
            || !existing.active
          ) {
            needsNewPrice = true;
            // Arkiver gammel pris (kan ikke slettes hvis brukt)
            await stripe.prices.update(priceId, { active: false });
          }
        } catch {
          needsNewPrice = true;
        }
      }

      if (needsNewPrice) {
        const price = await stripe.prices.create({
          product: productId,
          unit_amount: targetAmount,
          currency: 'nok',
          recurring: { interval: parsed.interval },
          metadata: productMetadata,
        });
        priceId = price.id;
      }

      updated.push({
        ...tier,
        stripeProductId: productId,
        stripePriceId: priceId,
        stripeAmount: parsed.amount,
        stripeInterval: parsed.interval,
        stripeSyncedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error(`[stripe-sync] Tier "${tier.name}" feilet:`, err.message);
      updated.push({ ...tier, stripeSyncError: err.message });
    }
  }
  return updated;
}

const mapRow = (row: any) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  description: row.description,
  longDescription: row.long_description,
  logoSrc: row.logo_src,
  logoAlt: row.logo_alt,
  gradientStart: row.gradient_start,
  gradientEnd: row.gradient_end,
  featured: !!row.featured,
  trending: !!row.trending,
  ctaLabel: row.cta_label,
  rating: row.rating != null ? Number(row.rating) : undefined,
  reviewsCount: row.reviews_count,
  downloadCount: row.download_count,
  monthlyGrowth: row.monthly_growth,
  pricing: row.pricing,
  subscriptionTiers: row.subscription_tiers,
  features: row.features,
  mediaGallery: row.media_gallery,
  partnerLogos: row.partner_logos,
  displayOrder: row.display_order ?? 0,
  isActive: !!row.is_active,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
});

export function registerMarketplaceAppConfigRoutes(
  app: Express,
  pool: Pool,
  requireAdminSession: RequireAdminSession,
) {
  // requireAdminSession is a GUARD (returns session | null, sends 401/403) — it
  // is NOT Express middleware. Used directly as `app.get(path, requireAdminSession, …)`
  // it never calls next(), so for a VALID admin the request hangs forever (it
  // only "works" for non-admins, who get a 403 response). Wrap it as real
  // middleware so the routes below proceed for admins.
  // The runtime value is the index.ts guard `(req,res) => session | null` (sends
  // 401/403 itself), even though the local type models it as middleware — which
  // is exactly why tsc never flagged the hang. Call it as the guard.
  const guard = requireAdminSession as unknown as (req: Request, res: Response) => unknown;
  const adminGuard = (req: Request, res: Response, next: NextFunction): void => {
    if (guard(req, res)) next();
  };

  // ─── Public: motta event-log fra frontend (fire-and-forget) ────
  // Lar creatorhub-events.ts skrive til samme analytics_events-tabell
  // som backend bruker, slik at admin-overview-card kan vise lokale tall.
  //
  // Idempotent tabell-ensure ved første INSERT — produsenten har egen
  // ensureAnalyticsEventsSchema i index.ts, men hvis den routen aldri
  // er kalt vil tabellen ikke finnes. Vi lager den her som fallback.
  let analyticsEventsTableEnsured = false;
  async function ensureAnalyticsEventsTable() {
    if (analyticsEventsTableEnsured) return;
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS analytics_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type VARCHAR(64) NOT NULL,
          entity_type VARCHAR(32),
          entity_id VARCHAR(64),
          actor_user_id VARCHAR(64),
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
          ON analytics_events (created_at DESC);
        CREATE INDEX IF NOT EXISTS analytics_events_type_idx
          ON analytics_events (event_type, created_at DESC);
      `);
      analyticsEventsTableEnsured = true;
    } catch (err: any) {
      console.warn('[analytics/event] ensure-table failed:', err.message);
    }
  }

  app.post("/api/analytics/event", async (req, res) => {
    const b = req.body || {};
    if (!b.eventType) return res.json({ success: false, error: 'missing_event_type' });
    await ensureAnalyticsEventsTable();
    try {
      await pool.query(
        `INSERT INTO analytics_events (event_type, entity_type, entity_id, actor_user_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          String(b.eventType).slice(0, 64),
          b.entityType ? String(b.entityType).slice(0, 32) : null,
          b.entityId ? String(b.entityId).slice(0, 64) : null,
          b.actorUserId || (req.headers["x-user-id"] as string) || null,
          b.metadata ? JSON.stringify(b.metadata) : '{}',
        ],
      );
      res.json({ success: true });
    } catch (err: any) {
      // Tabell mangler → ikke fail-stopper noe; klienten har allerede sendt til GA4
      if (err?.code !== '42P01') {
        console.error('[analytics/event] insert failed:', err.message);
      }
      res.json({ success: false });
    }
  });

  // ─── Admin: analytics overview (inline GA4-erstatning) ─────────
  app.get("/api/admin/analytics/overview", adminGuard, async (_req, res) => {
    const result: any = {
      totals: { last24h: 0, last7d: 0, last30d: 0 },
      topEvents: [],
      funnel: { inquiry_received: 0, inquiry_replied: 0, inquiry_converted_to_project: 0 },
      recentEvents: [],
      stripeConfigured: !!getStripe(),
    };
    try {
      const totals = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS last24h,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')   AS last7d,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')  AS last30d
         FROM analytics_events`,
      );
      result.totals = {
        last24h: parseInt(totals.rows[0]?.last24h || '0', 10),
        last7d: parseInt(totals.rows[0]?.last7d || '0', 10),
        last30d: parseInt(totals.rows[0]?.last30d || '0', 10),
      };

      const top = await pool.query(
        `SELECT event_type, COUNT(*) AS n
           FROM analytics_events
           WHERE created_at > NOW() - INTERVAL '7 days'
           GROUP BY event_type
           ORDER BY n DESC
           LIMIT 12`,
      );
      result.topEvents = top.rows.map((r: any) => ({ eventType: r.event_type, count: parseInt(r.n, 10) }));

      const funnel = await pool.query(
        `SELECT event_type, COUNT(*) AS n
           FROM analytics_events
           WHERE created_at > NOW() - INTERVAL '30 days'
             AND event_type IN ('creatorhub_inquiry_received','creatorhub_inquiry_replied','creatorhub_inquiry_converted_to_project')
           GROUP BY event_type`,
      );
      for (const r of funnel.rows) {
        const key = r.event_type.replace(/^creatorhub_/, '');
        result.funnel[key] = parseInt(r.n, 10);
      }

      const recent = await pool.query(
        `SELECT event_type, entity_type, entity_id, actor_user_id, metadata, created_at
           FROM analytics_events
           ORDER BY created_at DESC
           LIMIT 20`,
      );
      result.recentEvents = recent.rows.map((r: any) => ({
        eventType: r.event_type,
        entityType: r.entity_type,
        entityId: r.entity_id,
        actorUserId: r.actor_user_id,
        metadata: r.metadata,
        createdAt: r.created_at,
      }));
    } catch (err: any) {
      result.error = err.code === '42P01' ? 'Tabellen analytics_events finnes ikke ennå.' : err.message;
    }
    res.json(result);
  });

  // ─── Admin: per-bruker installasjoner + Stripe-abonnement ─────
  app.get(
    "/api/admin/users/:userId/installations",
    adminGuard,
    async (req, res) => {
      const userId = req.params.userId;
      const result: any = {
        userId,
        installedApps: [],
        subscriptions: [],
        stripeCustomerId: null,
      };

      // 1. Installasjoner fra marketplace_installations
      try {
        const r = await pool.query(
          `SELECT app_id, installed_at, is_active, updated_at
             FROM marketplace_installations
             WHERE user_id = $1
             ORDER BY installed_at DESC NULLS LAST`,
          [userId],
        );
        result.installedApps = r.rows.map((row: any) => ({
          appId: row.app_id,
          installedAt: row.installed_at,
          isActive: !!row.is_active,
          updatedAt: row.updated_at,
        }));
      } catch (err: any) {
        if (err?.code !== '42P01') {
          console.error('[admin/users/installations] db read failed:', err.message);
        }
      }

      // 2. Stripe-kunde-ID — sjekk vanlige steder (users-tabell)
      try {
        const u = await pool.query(
          `SELECT email, stripe_customer_id FROM users WHERE id = $1 LIMIT 1`,
          [userId],
        );
        if (u.rows[0]) {
          result.email = u.rows[0].email;
          result.stripeCustomerId = u.rows[0].stripe_customer_id || null;
        }
      } catch {}

      // 3. Stripe-abonnement med fornyelses-dato
      const stripe = getStripe();
      if (stripe) {
        try {
          let customerId = result.stripeCustomerId;
          // Fallback: søk etter customer via email hvis ingen customer-ID
          if (!customerId && result.email) {
            const search = await stripe.customers.list({ email: result.email, limit: 1 });
            customerId = search.data[0]?.id || null;
            result.stripeCustomerId = customerId;
          }

          if (customerId) {
            const subs = await stripe.subscriptions.list({
              customer: customerId,
              status: 'all',
              limit: 20,
              expand: ['data.items.data.price.product'],
            });
            result.subscriptions = subs.data.map((s: any) => {
              const item = s.items?.data?.[0];
              const price = item?.price;
              const product: any = price?.product;
              return {
                id: s.id,
                status: s.status,
                // Stripe v19: current_period_start/end er flyttet fra Subscription til items.data[i].
                ...((): { currentPeriodStart: string | null; currentPeriodEnd: string | null } => {
                  const firstItem = s.items?.data?.[0] as { current_period_start?: number; current_period_end?: number } | undefined;
                  return {
                    currentPeriodStart: firstItem?.current_period_start
                      ? new Date(firstItem.current_period_start * 1000).toISOString()
                      : null,
                    currentPeriodEnd: firstItem?.current_period_end
                      ? new Date(firstItem.current_period_end * 1000).toISOString()
                      : null,
                  };
                })(),
                cancelAtPeriodEnd: !!s.cancel_at_period_end,
                canceledAt: s.canceled_at
                  ? new Date(s.canceled_at * 1000).toISOString()
                  : null,
                trialEnd: s.trial_end
                  ? new Date(s.trial_end * 1000).toISOString()
                  : null,
                amount: price?.unit_amount != null ? price.unit_amount / 100 : null,
                currency: price?.currency || null,
                interval: price?.recurring?.interval || null,
                productName: typeof product === 'object' ? product?.name : null,
                appId: typeof product === 'object' ? product?.metadata?.app_id : null,
                tierId: typeof product === 'object' ? product?.metadata?.tier_id : null,
                stripePriceId: price?.id || null,
              };
            });
          }
        } catch (err: any) {
          result.stripeError = err.message;
        }
      }

      res.json(result);
    },
  );

  // ─── Admin: Stripe payment status — for ALLE betalinger ────────
  // Dekker alle inntekter til CreatorHub som går via Stripe — marketplace,
  // enterprise-plan, prototype-tester-offers osv. Henter direkte fra Stripe API.
  const stripePaymentStatusHandler = async (_req: Request, res: Response) => {
      const stripe = getStripe();
      const result: any = {
        configured: !!stripe,
        webhookConfigured: !!process.env.CREATORHUB_STRIPE_WEBHOOK_SECRET,
        events: [],
        recentRevenue: { last24h: 0, last7d: 0, last30d: 0 },
        counts: { succeeded: 0, failed: 0, refunded: 0 },
      };

      if (!stripe) {
        return res.json({
          ...result,
          message: 'STRIPE_SECRET_KEY mangler — sett miljøvariabel for å aktivere status-overvåkning.',
        });
      }

      try {
        // Hent siste 25 events fra Stripe
        const events = await stripe.events.list({
          limit: 25,
          types: [
            'invoice.paid',
            'invoice.payment_failed',
            'charge.succeeded',
            'charge.failed',
            'charge.refunded',
            'customer.subscription.created',
            'customer.subscription.updated',
            'customer.subscription.deleted',
          ],
        });

        const now = Date.now() / 1000;
        const day = 24 * 3600;
        for (const ev of events.data) {
          const obj: any = ev.data?.object || {};
          const amountKr = (obj.amount_paid || obj.amount || 0) / 100;
          const isSuccess = ev.type.endsWith('succeeded') || ev.type === 'invoice.paid';
          const isFailed = ev.type.endsWith('failed');
          const isRefund = ev.type === 'charge.refunded';

          if (isSuccess) result.counts.succeeded++;
          if (isFailed) result.counts.failed++;
          if (isRefund) result.counts.refunded++;

          if (isSuccess && amountKr > 0) {
            const ageSec = now - ev.created;
            if (ageSec < day) result.recentRevenue.last24h += amountKr;
            if (ageSec < 7 * day) result.recentRevenue.last7d += amountKr;
            if (ageSec < 30 * day) result.recentRevenue.last30d += amountKr;
          }

          result.events.push({
            id: ev.id,
            type: ev.type,
            createdAt: new Date(ev.created * 1000).toISOString(),
            amount: amountKr,
            customer: obj.customer || null,
            status: isSuccess ? 'success' : isFailed ? 'failed' : isRefund ? 'refunded' : 'info',
            description: obj.description || obj.statement_descriptor || null,
          });
        }

        // Aktive abonnementer (kort liste)
        const subs = await stripe.subscriptions.list({ limit: 10, status: 'active' });
        result.activeSubscriptions = subs.data.length;
      } catch (err: any) {
        result.error = err.message;
      }

      res.json(result);
    };
  // Registreres under generelt navn + bakoverkompatibelt marketplace-path
  app.get("/api/admin/stripe/payment-status", adminGuard, stripePaymentStatusHandler);
  app.get("/api/admin/marketplace/stripe-status", adminGuard, stripePaymentStatusHandler);

  // ─── Public: hent aktive apper ─────────────────────────────────
  app.get("/api/marketplace/apps", async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM marketplace_app_config
         WHERE is_active = TRUE
         ORDER BY display_order ASC, name ASC`,
      );
      res.json({ success: true, data: result.rows.map(mapRow) });
    } catch (err: any) {
      // Tabell mangler (relation does not exist) → tom liste, lar frontend
      // falle tilbake på hardkodet katalog inntil migrasjonen kjører.
      if (err?.code === "42P01") {
        return res.json({ success: true, data: [] });
      }
      console.error("[marketplace/apps] fetch failed:", err);
      res.status(500).json({ success: false, error: "fetch_failed" });
    }
  });

  // ─── Admin: hent alle apper (inkludert deaktiverte) ────────────
  app.get(
    "/api/admin/marketplace/apps",
    adminGuard,
    async (_req, res) => {
      try {
        const result = await pool.query(
          `SELECT * FROM marketplace_app_config
           ORDER BY display_order ASC, name ASC`,
        );
        res.json({ success: true, data: result.rows.map(mapRow) });
      } catch (err: any) {
        if (err?.code === "42P01") {
          return res.json({ success: true, data: [] });
        }
        console.error("[admin/marketplace/apps] fetch failed:", err);
        res.status(500).json({ success: false, error: "fetch_failed" });
      }
    },
  );

  // ─── Admin: opprett ny app ─────────────────────────────────────
  app.post(
    "/api/admin/marketplace/apps",
    adminGuard,
    async (req, res) => {
      const b = req.body || {};
      const adminEmail = (req.headers["x-user-email"] as string) || "admin";
      if (!b.id || !b.name) {
        return res.status(400).json({ success: false, error: "missing_id_or_name" });
      }
      try {
        const result = await pool.query(
          `INSERT INTO marketplace_app_config (
             id, name, category, description, long_description,
             logo_src, logo_alt, gradient_start, gradient_end,
             featured, trending, cta_label, rating, reviews_count,
             download_count, monthly_growth, pricing, subscription_tiers,
             features, media_gallery, partner_logos, display_order,
             is_active, updated_by, updated_at
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW()
           ) RETURNING *`,
          [
            b.id, b.name, b.category || null, b.description || null,
            b.longDescription || null, b.logoSrc || null, b.logoAlt || null,
            b.gradientStart || null, b.gradientEnd || null,
            !!b.featured, !!b.trending, b.ctaLabel || null,
            b.rating || null, b.reviewsCount || null,
            b.downloadCount || null, b.monthlyGrowth || null,
            b.pricing ? JSON.stringify(b.pricing) : null,
            b.subscriptionTiers ? JSON.stringify(b.subscriptionTiers) : null,
            b.features ? JSON.stringify(b.features) : null,
            b.mediaGallery ? JSON.stringify(b.mediaGallery) : null,
            b.partnerLogos ? JSON.stringify(b.partnerLogos) : null,
            b.displayOrder ?? 0,
            b.isActive ?? true,
            adminEmail,
          ],
        );
        res.json({ success: true, data: mapRow(result.rows[0]) });
      } catch (err: any) {
        console.error("[admin/marketplace/apps POST] failed:", err);
        res.status(500).json({ success: false, error: err.message || "create_failed" });
      }
    },
  );

  // ─── Admin: oppdater app (upsert) — auto-syncer til Stripe ─────
  // ?skipStripe=1 hopper over Stripe-sync (for raske utkast-lagringer)
  app.put(
    "/api/admin/marketplace/apps/:id",
    adminGuard,
    async (req, res) => {
      const b = req.body || {};
      const id = req.params.id;
      const adminEmail = (req.headers["x-user-email"] as string) || "admin";
      const skipStripe = req.query.skipStripe === '1';

      // Sync til Stripe FØR vi lagrer, slik at vi får IDs på tier-objektene
      if (!skipStripe && b.subscriptionTiers) {
        try {
          b.subscriptionTiers = await syncAppToStripe({ id, name: b.name, subscriptionTiers: b.subscriptionTiers });
        } catch (syncErr: any) {
          console.error('[marketplace] Stripe-sync feilet — lagrer uten:', syncErr.message);
        }
      }

      try {
        const result = await pool.query(
          `INSERT INTO marketplace_app_config (
             id, name, category, description, long_description,
             logo_src, logo_alt, gradient_start, gradient_end,
             featured, trending, cta_label, rating, reviews_count,
             download_count, monthly_growth, pricing, subscription_tiers,
             features, media_gallery, partner_logos, display_order,
             is_active, updated_by, updated_at
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW()
           ) ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             category = EXCLUDED.category,
             description = EXCLUDED.description,
             long_description = EXCLUDED.long_description,
             logo_src = EXCLUDED.logo_src,
             logo_alt = EXCLUDED.logo_alt,
             gradient_start = EXCLUDED.gradient_start,
             gradient_end = EXCLUDED.gradient_end,
             featured = EXCLUDED.featured,
             trending = EXCLUDED.trending,
             cta_label = EXCLUDED.cta_label,
             rating = EXCLUDED.rating,
             reviews_count = EXCLUDED.reviews_count,
             download_count = EXCLUDED.download_count,
             monthly_growth = EXCLUDED.monthly_growth,
             pricing = EXCLUDED.pricing,
             subscription_tiers = EXCLUDED.subscription_tiers,
             features = EXCLUDED.features,
             media_gallery = EXCLUDED.media_gallery,
             partner_logos = EXCLUDED.partner_logos,
             display_order = EXCLUDED.display_order,
             is_active = EXCLUDED.is_active,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()
           RETURNING *`,
          [
            id, b.name || id, b.category || null, b.description || null,
            b.longDescription || null, b.logoSrc || null, b.logoAlt || null,
            b.gradientStart || null, b.gradientEnd || null,
            !!b.featured, !!b.trending, b.ctaLabel || null,
            b.rating || null, b.reviewsCount || null,
            b.downloadCount || null, b.monthlyGrowth || null,
            b.pricing ? JSON.stringify(b.pricing) : null,
            b.subscriptionTiers ? JSON.stringify(b.subscriptionTiers) : null,
            b.features ? JSON.stringify(b.features) : null,
            b.mediaGallery ? JSON.stringify(b.mediaGallery) : null,
            b.partnerLogos ? JSON.stringify(b.partnerLogos) : null,
            b.displayOrder ?? 0,
            b.isActive ?? true,
            adminEmail,
          ],
        );
        res.json({ success: true, data: mapRow(result.rows[0]) });
      } catch (err: any) {
        console.error("[admin/marketplace/apps PUT] failed:", err);
        res.status(500).json({ success: false, error: err.message || "update_failed" });
      }
    },
  );

  // ─── Admin: publiser til Stripe ────────────────────────────────
  // Brukes når admin har laget utkast og deretter trykker "Publiser".
  // Henter eksisterende DB-rad, syncer tiers til Stripe, lagrer tilbake.
  app.post(
    "/api/admin/marketplace/apps/:id/publish",
    adminGuard,
    async (req, res) => {
      const id = req.params.id;
      try {
        const existing = await pool.query(
          `SELECT * FROM marketplace_app_config WHERE id = $1`,
          [id],
        );
        if (existing.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'not_found' });
        }
        const row = existing.rows[0];

        if (!getStripe()) {
          return res.status(400).json({
            success: false,
            error: 'stripe_not_configured',
            message: 'STRIPE_SECRET_KEY mangler. Sett miljøvariabel i Render.',
          });
        }

        const syncedTiers = await syncAppToStripe({
          id,
          name: row.name,
          subscriptionTiers: row.subscription_tiers,
        });

        const updated = await pool.query(
          `UPDATE marketplace_app_config
             SET subscription_tiers = $1, updated_at = NOW(), is_active = TRUE
             WHERE id = $2 RETURNING *`,
          [JSON.stringify(syncedTiers), id],
        );

        res.json({
          success: true,
          data: mapRow(updated.rows[0]),
          message: `Publisert til Stripe — ${syncedTiers.length} tier(s) synkronisert.`,
        });
      } catch (err: any) {
        console.error('[marketplace publish] failed:', err);
        res.status(500).json({ success: false, error: err.message || 'publish_failed' });
      }
    },
  );

  // ─── Admin: soft-delete ────────────────────────────────────────
  app.delete(
    "/api/admin/marketplace/apps/:id",
    adminGuard,
    async (req, res) => {
      try {
        await pool.query(
          `UPDATE marketplace_app_config SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
          [req.params.id],
        );
        res.json({ success: true });
      } catch (err: any) {
        console.error("[admin/marketplace/apps DELETE] failed:", err);
        res.status(500).json({ success: false, error: err.message || "delete_failed" });
      }
    },
  );

  // ─── Public: Stripe Checkout Session for app subscription ──────
  //
  // POST /api/marketplace/apps/:appId/checkout body { tierId, mode? }
  // → returnerer { url } som klient redirecter til Stripe Checkout.
  // Krever at admin har "publisert" appen først (kjørt Stripe-sync) så
  // tier-en har stripePriceId. Trial-tier er gratis (ingen Stripe).
  app.post(
    "/api/marketplace/apps/:appId/checkout",
    async (req, res) => {
      const stripe = getStripe();
      if (!stripe) {
        res.status(503).json({ error: "stripe_not_configured" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const tierId = typeof body.tierId === "string" ? body.tierId : "";
      if (!tierId) {
        res.status(400).json({ error: "tierId_required" });
        return;
      }
      // Hent app + tier
      const result = await pool.query(
        `SELECT id, name, subscription_tiers FROM marketplace_app_config WHERE id = $1 AND is_active = TRUE LIMIT 1`,
        [req.params.appId],
      );
      if (!result.rowCount) {
        res.status(404).json({ error: "app_not_found" });
        return;
      }
      const app_ = result.rows[0];
      const tiers = (app_.subscription_tiers as any[]) ?? [];
      const tier = tiers.find((t) => t?.id === tierId);
      if (!tier) {
        res.status(404).json({ error: "tier_not_found" });
        return;
      }
      // Trial er gratis — ingen Stripe-checkout, bare returner redirect
      // til app-en. (Frontend gjør entitlement-flagget basert på user.)
      if (tier.id === "trial" || !tier.stripePriceId) {
        const isTrial = tier.id === "trial";
        if (isTrial) {
          res.json({
            url: "/resume-builder?trial=started",
            trial: true,
            message: "Trial aktivert — ingen kortinformasjon nødvendig",
          });
          return;
        }
        res.status(503).json({
          error: "tier_not_published_to_stripe",
          detail: "Admin må klikke 'Publiser' på app-konfigen først",
        });
        return;
      }
      // Bygg Stripe Checkout Session
      const publicHost = (
        process.env.CREATORHUB_PUBLIC_URL ?? "https://app.creatorhubn.com"
      ).replace(/\/$/, "");
      const xUserId =
        (req.headers["x-user-id"] as string | undefined) ?? null;
      try {
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [
            { price: tier.stripePriceId as string, quantity: 1 },
          ],
          success_url: `${publicHost}/resume-builder?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${publicHost}/nextrole?checkout=cancelled`,
          subscription_data: {
            metadata: {
              app_id: app_.id as string,
              tier_id: tier.id as string,
              user_id: xUserId ?? "",
            },
            // 14-dagers trial for standard og pro (kun ved første kjøp)
            trial_period_days: tier.id === "trial" ? undefined : 14,
          },
          metadata: {
            app_id: app_.id as string,
            tier_id: tier.id as string,
            user_id: xUserId ?? "",
          },
          allow_promotion_codes: true,
          locale: "nb",
        });
        res.json({
          url: session.url,
          sessionId: session.id,
          tier: {
            id: tier.id,
            name: tier.name,
            price: tier.price,
          },
        });
      } catch (err: any) {
        console.error("[marketplace checkout] Stripe error:", err);
        res.status(500).json({
          error: "stripe_checkout_failed",
          detail: String(err?.message ?? err).slice(0, 200),
        });
      }
    },
  );
}
