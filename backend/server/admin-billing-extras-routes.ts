/**
 * admin-billing-extras-routes.ts
 *
 * Stub-endpoints for AdminDashboard sin Forretning-gruppe ("billing extras"):
 * invoices, coupons, payment-methods. Returnerer tom liste nå slik at
 * UI ikke krasjer; senere kobles dette mot Stripe (invoices + coupons) og
 * en internt vedlikeholdt payment_methods-tabell.
 *
 * Endpoints:
 *   GET /api/admin/billing/invoices       — Stripe-faktura-stub
 *   GET /api/admin/billing/coupons        — Stripe-rabattkode-stub
 *   GET /api/admin/payment-methods        — payment methods katalog-stub
 *
 * Alle krever requireAdminSession.
 */

import type express from "express";
import type { Pool } from "pg";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdminBillingExtrasRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: express.Request, res: express.Response) => any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function setupAdminBillingExtrasRoutes(
  deps: AdminBillingExtrasRoutesDeps,
): void {
  const { app, requireAdminSession } = deps;

  app.get("/api/admin/billing/invoices", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      // TODO: koble mot Stripe Invoices API.
      // Foreløpig tom liste så Forretning-fanen i AdminDashboard kan rendre.
      res.json({ invoices: [], total: 0 });
    } catch (err) {
      console.error("[admin-billing-extras] invoices failed:", err);
      res.status(500).json({ error: "billing_invoices_failed" });
    }
  });

  app.get("/api/admin/billing/coupons", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      // TODO: koble mot Stripe Coupons / Promotion Codes API.
      res.json({ coupons: [], total: 0 });
    } catch (err) {
      console.error("[admin-billing-extras] coupons failed:", err);
      res.status(500).json({ error: "billing_coupons_failed" });
    }
  });

  app.get("/api/admin/payment-methods", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      // TODO: aggreger fra stripe_payment_methods når den tabellen finnes.
      res.json({ paymentMethods: [], total: 0 });
    } catch (err) {
      console.error("[admin-billing-extras] payment-methods failed:", err);
      res.status(500).json({ error: "payment_methods_failed" });
    }
  });
}
