/**
 * admin-enterprise-pricing-routes.ts
 *
 * Stub-endpoints for AdminDashboard Forretning-gruppen:
 *   - enterprise pricing-tiers (volum-rabatter for store kunder)
 *   - analytics dashboard (revenue/customer/conversions)
 *
 * Endpoints:
 *   GET  /api/admin/enterprise-pricing             — list tiers + discounts
 *   POST /api/admin/enterprise-pricing             — opprett tier (placeholder)
 *   GET  /api/admin/analytics/dashboard?period=30d — totalRevenue/Customers/conv.
 *
 * Alle krever requireAdminSession. Pure stub-data nå; senere kobles dette
 * mot en `enterprise_pricing_tiers`-tabell + revenue-aggregat.
 */

import type express from "express";
import type { Pool } from "pg";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdminEnterprisePricingRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: express.Request, res: express.Response) => any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function setupAdminEnterprisePricingRoutes(
  deps: AdminEnterprisePricingRoutesDeps,
): void {
  const { app, requireAdminSession } = deps;

  app.get("/api/admin/enterprise-pricing", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      // TODO: les fra enterprise_pricing_tiers-tabell.
      res.json({ tiers: [], discounts: [] });
    } catch (err) {
      console.error("[enterprise-pricing] list failed:", err);
      res.status(500).json({ error: "enterprise_pricing_list_failed" });
    }
  });

  app.post("/api/admin/enterprise-pricing", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      const body = (req.body ?? {}) as {
        tierName?: string;
        basePrice?: number;
        discount?: number;
      };
      if (!body.tierName) {
        return res.status(400).json({ error: "tierName_required" });
      }
      // TODO: persister i enterprise_pricing_tiers + audit_log.
      res.json({
        success: true,
        id: "placeholder",
        tierName: body.tierName,
        basePrice: body.basePrice ?? 0,
        discount: body.discount ?? 0,
      });
    } catch (err) {
      console.error("[enterprise-pricing] create failed:", err);
      res.status(500).json({ error: "enterprise_pricing_create_failed" });
    }
  });

  app.get("/api/admin/analytics/dashboard", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      const period = typeof req.query.period === "string"
        ? req.query.period
        : "30d";
      // TODO: aggreger fra subscriptions + payment_events + user-tabell.
      res.json({
        period,
        totalRevenue: 0,
        totalCustomers: 0,
        conversions: 0,
        breakdownByPlan: [],
      });
    } catch (err) {
      console.error("[enterprise-pricing] analytics dashboard failed:", err);
      res.status(500).json({ error: "analytics_dashboard_failed" });
    }
  });
}
