// Admin automations routes.
//
// Stub-endepunkter for AdminDashboard "Lab" → automations-tab.
// Returnerer tomme/forutsigbare strukturer slik at UI ikke krasjer.

import express from "express";
import type { Pool } from "pg";

export interface AdminAutomationsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

export function setupAdminAutomationsRoutes(
  deps: AdminAutomationsRoutesDeps,
): void {
  const { app, requireAdminSession } = deps;

  // ─── List ─────────────────────────────────────────────────
  app.get("/api/admin/automations", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ automations: [], total: 0 });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Stats ────────────────────────────────────────────────
  app.get("/api/admin/automation-stats", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ totalRuns: 0, successRate: 100, lastRun: null });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Toggle ───────────────────────────────────────────────
  app.patch("/api/admin/automations/:id/toggle", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const { enabled = false } = req.body || {};
      res.json({ success: true, enabled: Boolean(enabled) });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Manual run ───────────────────────────────────────────
  app.post("/api/admin/automations/:id/run", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ success: true, runId: "placeholder-" + Date.now() });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
}
