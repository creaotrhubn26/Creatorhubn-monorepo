// Admin feature-customizations routes.
//
// Stub-endepunkter for AdminDashboard "Lab" → feature-customizations-tab.
// Returnerer tomme/forutsigbare strukturer slik at UI ikke krasjer.

import express from "express";
import type { Pool } from "pg";

export interface AdminFeatureCustomizationsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

export function setupAdminFeatureCustomizationsRoutes(
  deps: AdminFeatureCustomizationsRoutesDeps,
): void {
  const { app, requireAdminSession } = deps;

  // ─── List ─────────────────────────────────────────────────
  app.get("/api/admin/feature-customizations", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ customizations: [], total: 0 });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Update override ──────────────────────────────────────
  app.put("/api/admin/feature-customizations/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const { override = null } = req.body || {};
      res.json({ success: true, id: req.params.id, override });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
}
