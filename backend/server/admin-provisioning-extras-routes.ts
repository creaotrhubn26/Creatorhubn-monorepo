// Admin provisioning-extras routes.
//
// Stub-endepunkt for AdminDashboard "Oversikt" → provisioning-tab.
// Utvider admin-provisioning-routes.ts med metrics-summary
// uten å rote i den eksisterende fila.

import express from "express";
import type { Pool } from "pg";

export interface AdminProvisioningExtrasRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

export function setupAdminProvisioningExtrasRoutes(
  deps: AdminProvisioningExtrasRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  // ─── Metrics ──────────────────────────────────────────────
  app.get("/api/admin-provisioning/metrics", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      // Best-effort: les invite_requests-tabellen om den finnes.
      // Faller stille tilbake til 0-er hvis tabellen ikke er migrert.
      let pendingApprovals = 0;
      let approvedToday = 0;
      let rejectedToday = 0;
      let totalProvisionedUsers = 0;

      try {
        const pending = await pool.query(
          `SELECT COUNT(*)::int AS n FROM invite_requests WHERE status = 'pending'`,
        );
        pendingApprovals = pending.rows[0]?.n ?? 0;

        const today = await pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE status = 'approved' AND processed_at >= CURRENT_DATE)::int AS approved_today,
             COUNT(*) FILTER (WHERE status = 'rejected' AND processed_at >= CURRENT_DATE)::int AS rejected_today,
             COUNT(*) FILTER (WHERE status = 'approved')::int AS total_provisioned
           FROM invite_requests`,
        );
        approvedToday = today.rows[0]?.approved_today ?? 0;
        rejectedToday = today.rows[0]?.rejected_today ?? 0;
        totalProvisionedUsers = today.rows[0]?.total_provisioned ?? 0;
      } catch {
        // tabell finnes ikke ennå — returnerer 0-stub
      }

      res.json({
        pendingApprovals,
        approvedToday,
        rejectedToday,
        totalProvisionedUsers,
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
}
