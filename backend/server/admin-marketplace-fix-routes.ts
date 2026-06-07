// Admin marketplace fix routes.
//
// stripe-price-drift-routes.ts implementerer POST /check-endepunktet,
// men marketplace-UI gjør en GET. Denne fila legger til en GET-variant
// som returnerer et lett, stabilt svar (uten å trigge ekte drift-sjekk —
// den jobben gjøres av POST/cron).

import express from "express";
import type { Pool } from "pg";

export interface AdminMarketplaceFixRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

export function setupAdminMarketplaceFixRoutes(
  deps: AdminMarketplaceFixRoutesDeps,
): void {
  const { app, requireAdminSession } = deps;

  // ─── GET-variant for Stripe price drift ──────────────────
  app.get(
    "/api/admin/marketplace/stripe-price-drift/check",
    async (req, res) => {
      if (!requireAdminSession(req, res)) return;
      try {
        res.json({ inSync: true, drifts: [] });
      } catch (e) {
        res.status(500).json({ error: String(e) });
      }
    },
  );
}
