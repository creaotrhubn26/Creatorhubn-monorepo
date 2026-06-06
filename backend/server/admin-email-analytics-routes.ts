// Admin email-analytics routes.
//
// Stub-endepunkter for AdminDashboard "Lab" → email-analytics-tab.
// Returnerer tomme/forutsigbare strukturer slik at UI ikke krasjer.

import express from "express";
import type { Pool } from "pg";

export interface AdminEmailAnalyticsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

export function setupAdminEmailAnalyticsRoutes(
  deps: AdminEmailAnalyticsRoutesDeps,
): void {
  const { app, requireAdminSession } = deps;

  // ─── Aggregert oversikt ───────────────────────────────────
  app.get("/api/admin/email-analytics", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ totalSent: 0, openRate: 0, clickRate: 0 });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Kampanjer ────────────────────────────────────────────
  app.get("/api/admin/email-campaigns", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ campaigns: [], total: 0 });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Lenke-klikk ──────────────────────────────────────────
  app.get("/api/admin/email-link-analytics", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ links: [], total: 0 });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
}
