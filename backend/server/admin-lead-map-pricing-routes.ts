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
