/**
 * plan-routes.ts
 *
 * Endepunkter som UI bruker for å vise plan-state:
 *
 *   GET  /api/leadgrid/plan/summary?orgId=...
 *        → { plan, limits, usage, pct } for PlanUsageBar
 *
 *   GET  /api/leadgrid/plan/limits
 *        → liste over alle planer (for pricing-page)
 *
 *   POST /api/leadgrid/plan/upgrade
 *        → start Stripe Checkout for å oppgradere
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import Stripe from "stripe";
import { getPlanSummary } from "./plan-limits-service.js";

function getStripe(): Stripe | null {
  const key = process.env.CREATORHUB_STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}
const PUBLIC_BASE = process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const token = (req as any).cookies?.sessionToken;
  return token ? sessions.get(token) ?? null : null;
}

export function registerPlanRoutes({ app, pool, activeSessions }: Deps): void {

  // ---------- Liste planer (offentlig, brukes av /leadgrid og pricing-side)
  app.get("/api/leadgrid/plan/limits", async (_req, res) => {
    const r = await pool.query(
      `SELECT plan_key, display_name, price_monthly_nok,
              max_active_customers, max_auto_onboards_per_month,
              max_playbooks_visible, max_team_members,
              has_automation_rules, has_custom_fields,
              has_pitch_deck_studio, has_white_label_portal,
              has_salgshierarki, audit_log_retention_days
         FROM plan_limits
        WHERE is_active = TRUE
        ORDER BY display_order ASC`,
    );
    res.json({ plans: r.rows });
  });

  // ---------- Plan-summary for innlogget bruker
  app.get("/api/leadgrid/plan/summary", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    const orgId = (req.query.orgId as string) ?? null;
    if (!orgId) return res.status(400).json({ error: "orgId påkrevd" });
    // Bekreft at brukeren faktisk er medlem av org'en (eller super_admin)
    const memberCheck = await pool.query(
      `SELECT 1 FROM organization_members
       WHERE organization_id = $1 AND user_id = $2
       UNION SELECT 1 FROM users WHERE id = $2 AND role = 'super_admin'`,
      [orgId, session.userId],
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: "Ikke medlem av org'en" });
    }
    try {
      const summary = await getPlanSummary(pool, orgId);
      res.json(summary);
    } catch (e) {
      console.error("[plan-summary]", e);
      res.status(500).json({ error: "Kunne ikke hente plan-summary" });
    }
  });

  // ---------- Upgrade-checkout (in-app)
  // POST { orgId, planKey: 'solo_pro' | 'agency', billing: 'monthly' | 'yearly' }
  app.post("/api/leadgrid/plan/upgrade", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    const stripe = getStripe();
    if (!stripe) return res.status(500).json({ error: "Stripe ikke konfigurert" });

    const { orgId, planKey, billing } = req.body ?? {};
    if (!orgId || !planKey || !billing) {
      return res.status(400).json({ error: "Mangler orgId/planKey/billing" });
    }

    const memberR = await pool.query(
      `SELECT 1 FROM organization_members
        WHERE organization_id = $1 AND user_id = $2 AND role = 'admin'`,
      [orgId, session.userId],
    );
    if (memberR.rows.length === 0) {
      return res.status(403).json({ error: "Kun org-admin kan oppgradere" });
    }

    const planR = await pool.query<{
      stripe_price_id_monthly: string | null;
      stripe_price_id_yearly: string | null;
    }>(
      `SELECT stripe_price_id_monthly, stripe_price_id_yearly
         FROM plan_limits WHERE plan_key = $1`,
      [planKey],
    );
    const priceId = billing === "yearly"
      ? planR.rows[0]?.stripe_price_id_yearly
      : planR.rows[0]?.stripe_price_id_monthly;
    if (!priceId) {
      return res.status(404).json({ error: `Ingen pris for ${planKey}/${billing}` });
    }

    const orgR = await pool.query<{
      stripe_customer_id: string | null;
      contact_email: string | null;
      name: string;
    }>(
      `SELECT stripe_customer_id, contact_email, name
         FROM organizations WHERE id = $1`, [orgId],
    );
    if (orgR.rows.length === 0) return res.status(404).json({ error: "Org ikke funnet" });
    let customerId = orgR.rows[0].stripe_customer_id;

    // Opprett Stripe-kunde hvis ikke finnes (Free-orgs uten kort)
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: orgR.rows[0].contact_email ?? session.email ?? undefined,
        name: orgR.rows[0].name,
        metadata: { organization_id: orgId, user_id: session.userId },
      });
      customerId = customer.id;
      await pool.query(
        `UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2`,
        [customerId, orgId],
      );
    }

    try {
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${PUBLIC_BASE}/leadgrid?upgrade=success&plan=${planKey}`,
        cancel_url: `${PUBLIC_BASE}/leadgrid?upgrade=cancelled`,
        allow_promotion_codes: true,
        metadata: {
          organization_id: orgId,
          plan_key: planKey,
          product_family: "leadgrid",
          billing,
        },
        subscription_data: {
          metadata: {
            organization_id: orgId,
            plan_key: planKey,
            product_family: "leadgrid",
            billing,
          },
        },
      });
      res.json({ url: checkoutSession.url });
    } catch (e: any) {
      console.error("[plan upgrade]", e);
      res.status(500).json({ error: e.message ?? "Stripe-feil" });
    }
  });
}
