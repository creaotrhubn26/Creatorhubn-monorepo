/**
 * admin-lead-map-pricing-routes.ts
 *
 * Admin-only routes for Lead Map module pricing-styring.
 *
 *   GET  /api/admin/lead-map/pricing — current Stripe-products + priser + env-vars + usage
 *   POST /api/admin/lead-map/pricing/update — opprett ny pris (Stripe-priser er immutable)
 *                                            arkiverer gammel, auto-oppdaterer Render env-var
 *
 * Mønster speilet fra post-agent-anthropic-routes (admin/prices).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import Stripe from "stripe";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  isAdminEmail: (email: string | undefined) => boolean;
}

function getSession(req: Request, activeSessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    return activeSessions.get(token) ?? null;
  }
  return null;
}

type LeadMapTier = 'discover' | 'pro' | 'agency';
const TIER_ENV_KEYS: Record<LeadMapTier, string> = {
  discover: 'STRIPE_PRICE_LEAD_MAP_DISCOVER',
  pro: 'STRIPE_PRICE_LEAD_MAP_PRO',
  agency: 'STRIPE_PRICE_LEAD_MAP_AGENCY',
};

/** Oppdater Render env-var via single-key PUT — bevarer alle andre vars. */
async function updateRenderEnvVar(key: string, value: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RENDER_API_KEY;
  const serviceId = process.env.RENDER_SERVICE_ID;
  if (!apiKey || !serviceId) {
    return { ok: false, error: 'render_credentials_missing' };
  }
  try {
    const r = await fetch(
      `https://api.render.com/v1/services/${serviceId}/env-vars/${key}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      },
    );
    if (!r.ok) {
      const t = await r.text();
      return { ok: false, error: `render_http_${r.status}: ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `render_error: ${(err as Error).message}` };
  }
}

export function setupAdminLeadMapPricingRoutes(deps: Deps): void {
  const { app, pool, activeSessions, isAdminEmail } = deps;

  function requireAdmin(req: Request, res: Response): SessionData | null {
    const session = getSession(req, activeSessions);
    if (!session?.userId) { res.status(401).json({ error: "Innlogging kreves" }); return null; }
    if (!isAdminEmail(session.email)) { res.status(403).json({ error: "admin_required" }); return null; }
    return session;
  }

  // GET /pricing — full overview
  app.get("/api/admin/lead-map/pricing", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'stripe_not_configured' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const result: Record<string, unknown> = {
      mode: process.env.STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'test',
      envVars: {
        STRIPE_PRICE_LEAD_MAP_DISCOVER: process.env.STRIPE_PRICE_LEAD_MAP_DISCOVER,
        STRIPE_PRICE_LEAD_MAP_PRO: process.env.STRIPE_PRICE_LEAD_MAP_PRO,
        STRIPE_PRICE_LEAD_MAP_AGENCY: process.env.STRIPE_PRICE_LEAD_MAP_AGENCY,
      },
      tiers: [] as Array<Record<string, unknown>>,
    };

    try {
      for (const tier of ['discover', 'pro', 'agency'] as LeadMapTier[]) {
        const envKey = TIER_ENV_KEYS[tier];
        const priceId = process.env[envKey];
        let priceData: Stripe.Price | null = null;
        let productData: Stripe.Product | null = null;
        if (priceId && priceId.startsWith('price_')) {
          try {
            priceData = await stripe.prices.retrieve(priceId, { expand: ['product'] });
            if (priceData.product && typeof priceData.product !== 'string') {
              productData = priceData.product as Stripe.Product;
            }
          } catch {
            // ugyldig price-id
          }
        }
        (result.tiers as Array<Record<string, unknown>>).push({
          tier,
          envKey,
          envValue: priceId ?? null,
          price: priceData ? {
            id: priceData.id,
            unit_amount: priceData.unit_amount,
            currency: priceData.currency,
            recurring: priceData.recurring,
            nickname: priceData.nickname,
            active: priceData.active,
            metadata: priceData.metadata,
          } : null,
          product: productData ? {
            id: productData.id,
            name: productData.name,
            description: productData.description,
            active: productData.active,
          } : null,
        });
      }

      // Usage metrics fra entitlement-tabell
      try {
        const usage = await pool.query<{
          active_entitlements: number;
          trial_entitlements: number;
          revenue_monthly_nok: string;
        }>(
          `SELECT
             COUNT(*) FILTER (WHERE status = 'active')::int AS active_entitlements,
             COUNT(*) FILTER (WHERE status = 'trial')::int AS trial_entitlements,
             COALESCE(SUM(CASE
               WHEN tier = 'discover' THEN 299
               WHEN tier = 'pro' THEN 599
               WHEN tier = 'agency' THEN 1490
               ELSE 0
             END) FILTER (WHERE status = 'active'), 0)::text AS revenue_monthly_nok
           FROM lead_map_module_entitlements
           WHERE revoked_at IS NULL`,
        );
        result.usageMetrics = {
          activeEntitlements: usage.rows[0]?.active_entitlements ?? 0,
          trialEntitlements: usage.rows[0]?.trial_entitlements ?? 0,
          revenueMonthlyNok: Number(usage.rows[0]?.revenue_monthly_nok ?? 0),
        };
      } catch {
        result.usageMetrics = { tableDoesNotExistYet: true };
      }

      return res.json(result);
    } catch (err) {
      return res.status(502).json({ error: "stripe_query_failed", detail: String(err) });
    }
  });

  // ── Entitlement-admin ───────────────────────────────────────────────

  // GET /entitlements — alle entitlements (med config-info + producer-email)
  app.get("/api/admin/lead-map/entitlements", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const r = await pool.query(
        `SELECT
           e.id::text, e.config_id::text, e.producer_user_id, e.tier, e.status,
           e.source, e.trial_ends_at, e.expires_at, e.granted_at, e.revoked_at,
           e.leads_per_month_limit, e.ai_pitches_per_month_limit,
           e.stripe_subscription_id, e.notes,
           u.email AS producer_email,
           u.first_name AS producer_first_name,
           u.last_name AS producer_last_name,
           c.client_name AS config_client_name
         FROM lead_map_module_entitlements e
         LEFT JOIN users u ON u.id = e.producer_user_id
         LEFT JOIN client_ads_configs c ON c.id = e.config_id
         ORDER BY e.granted_at DESC
         LIMIT 500`,
      );
      return res.json({ entitlements: r.rows });
    } catch (err) {
      return res.status(500).json({ error: "entitlements_failed", detail: String(err) });
    }
  });

  // POST /entitlements/grant — admin gir gratis entitlement
  // Body: { configId, producerUserId, tier, notes? }
  app.post("/api/admin/lead-map/entitlements/grant", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as {
      configId?: string; producerUserId?: string;
      tier?: string; notes?: string;
    };
    if (!body.configId || !body.producerUserId) {
      return res.status(400).json({ error: "mangler_config_eller_producer" });
    }
    if (!body.tier || !['discover', 'pro', 'agency'].includes(body.tier)) {
      return res.status(400).json({ error: "ugyldig_tier" });
    }
    const limits = {
      discover: { leads: 50,   ai: 0 },
      pro:      { leads: 250,  ai: 50 },
      agency:   { leads: null, ai: null },
    }[body.tier as 'discover'|'pro'|'agency'];
    try {
      // Revoker eksisterende aktiv først
      await pool.query(
        `UPDATE lead_map_module_entitlements
           SET revoked_at = NOW(), updated_at = NOW()
         WHERE config_id = $1::uuid AND revoked_at IS NULL`,
        [body.configId],
      );
      const r = await pool.query<{ id: string }>(
        `INSERT INTO lead_map_module_entitlements (
           config_id, producer_user_id, tier, status, source,
           leads_per_month_limit, ai_pitches_per_month_limit, notes
         ) VALUES ($1::uuid, $2, $3, 'active', 'admin_grant', $4, $5, $6)
         RETURNING id::text`,
        [
          body.configId, body.producerUserId, body.tier,
          limits.leads, limits.ai,
          (body.notes ?? `Admin-grant av ${session.email}`).slice(0, 500),
        ],
      );
      return res.json({ ok: true, entitlementId: r.rows[0].id });
    } catch (err) {
      return res.status(500).json({ error: "grant_failed", detail: String(err) });
    }
  });

  // POST /entitlements/:id/revoke
  app.post("/api/admin/lead-map/entitlements/:id/revoke", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as { notes?: string };
    try {
      const r = await pool.query(
        `UPDATE lead_map_module_entitlements
           SET status = 'revoked', revoked_at = NOW(), updated_at = NOW(),
               notes = COALESCE(notes, '') || E'\\n[REVOKED] ' || $2
         WHERE id = $1::uuid AND revoked_at IS NULL`,
        [
          req.params.id,
          (body.notes ?? `Admin-revoke av ${session.email} ${new Date().toISOString()}`).slice(0, 500),
        ],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found_or_already_revoked" });
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: "revoke_failed", detail: String(err) });
    }
  });

  // POST /pricing/update — endre pris for én tier
  // Body: { tier: 'discover'|'pro'|'agency', priceNok: number, autoUpdateEnv?: boolean }
  app.post("/api/admin/lead-map/pricing/update", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'stripe_not_configured' });
    }

    const body = (req.body ?? {}) as {
      tier?: string;
      priceNok?: number;
      autoUpdateEnv?: boolean;
    };
    if (!body.tier || !['discover', 'pro', 'agency'].includes(body.tier)) {
      return res.status(400).json({ error: "ugyldig_tier" });
    }
    if (typeof body.priceNok !== 'number' || body.priceNok < 0 || body.priceNok > 1_000_000) {
      return res.status(400).json({ error: "ugyldig_pris" });
    }

    const tier = body.tier as LeadMapTier;
    const envKey = TIER_ENV_KEYS[tier];
    const oldPriceId = process.env[envKey];

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    try {
      // Hent eksisterende price for å få product-ID
      let productId: string | null = null;
      if (oldPriceId && oldPriceId.startsWith('price_')) {
        try {
          const oldPrice = await stripe.prices.retrieve(oldPriceId);
          productId = typeof oldPrice.product === 'string' ? oldPrice.product : oldPrice.product?.id ?? null;
        } catch {
          // Pris finnes ikke — opprett nytt produkt
        }
      }

      if (!productId) {
        // Opprett nytt produkt
        const tierLabels: Record<LeadMapTier, string> = {
          discover: 'Lead Map Discover',
          pro: 'Lead Map Pro',
          agency: 'Lead Map Agency',
        };
        const product = await stripe.products.create({
          name: tierLabels[tier],
          metadata: { module: 'lead_map', tier },
        });
        productId = product.id;
      }

      // Opprett ny pris (Stripe-priser er immutable — må alltid lage ny)
      const newPrice = await stripe.prices.create({
        product: productId,
        currency: 'nok',
        unit_amount: Math.round(body.priceNok * 100),
        recurring: { interval: 'month' },
        metadata: { module: 'lead_map', tier },
        nickname: `Lead Map ${tier} (monthly)`,
      });

      // Arkiver gammel pris
      if (oldPriceId && oldPriceId.startsWith('price_')) {
        try {
          await stripe.prices.update(oldPriceId, { active: false });
        } catch {
          // ignorer hvis arkivering feiler
        }
      }

      // Auto-oppdater Render env-var (default TRUE)
      let envUpdate: { ok: boolean; error?: string } = { ok: false, error: 'skipped' };
      if (body.autoUpdateEnv !== false) {
        envUpdate = await updateRenderEnvVar(envKey, newPrice.id);
      }

      return res.json({
        ok: true,
        tier,
        newPriceId: newPrice.id,
        oldPriceId: oldPriceId ?? null,
        envKey,
        envUpdate,
        priceNok: body.priceNok,
        note: envUpdate.ok
          ? 'Render env-var oppdatert. Render auto-redeploy starter om noen sekunder.'
          : `Render env-var IKKE auto-oppdatert (${envUpdate.error}). Sett manuelt: ${envKey}=${newPrice.id}`,
      });
    } catch (err) {
      return res.status(502).json({ error: "stripe_update_failed", detail: String(err) });
    }
  });
}
