// Admin-routes for å lese file_access_audit-loggen.
//
// Brukes til forensics:
//   - "Har bruker X hentet en fil de ikke skulle ha?"
//   - "Hvilke filer har feilet 'forbidden' siste uken? Mulig probing?"
//   - "Hvor mange ganger har bruker Y hentet fil Z?"

import express from "express";
import type { Pool } from "pg";
import { queryFileAccessAudit } from "./file-access-audit.js";

export interface AdminFileAuditRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

export function setupAdminFileAuditRoutes(
  deps: AdminFileAuditRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  // GET /api/admin/file-access-audit?userId=...&fileId=...&outcome=...&sinceHours=24&limit=100
  app.get("/api/admin/file-access-audit", async (req, res) => {
    const adminSession = requireAdminSession(req, res);
    if (!adminSession) return;

    try {
      const userId = req.query.userId
        ? String(req.query.userId)
        : undefined;
      const fileId = req.query.fileId
        ? String(req.query.fileId)
        : undefined;
      const outcomeRaw = req.query.outcome;
      const outcomeOnly = outcomeRaw
        ? String(outcomeRaw)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
      const sinceHours = req.query.sinceHours
        ? parseInt(String(req.query.sinceHours), 10)
        : 24;
      const limit = req.query.limit
        ? parseInt(String(req.query.limit), 10)
        : 100;

      const rows = await queryFileAccessAudit(pool, {
        userId,
        fileId,
        outcomeOnly: outcomeOnly as any,
        sinceHours,
        limit,
      });

      res.json({
        success: true,
        total: rows.length,
        rows,
      });
    } catch (err: any) {
      console.error("[admin-file-audit] query failed:", err);
      res.status(500).json({
        success: false,
        error: "query_failed",
        message: String(err?.message || err).slice(0, 200),
      });
    }
  });

  // GET /api/admin/file-access-audit/suspicious?sinceHours=24
  // Returnerer aggregert "suspect activity"-rapport:
  //   - Top users med flest 'forbidden'/'not_found' siste sinceHours
  //   - Top IPs med flest forskjellige user_ids siste sinceHours
  //     (kan indikere credential-stuffing eller en deltlenke-spreder)
  app.get(
    "/api/admin/file-access-audit/suspicious",
    async (req, res) => {
      const adminSession = requireAdminSession(req, res);
      if (!adminSession) return;
      const sinceHours = Math.min(
        720,
        Math.max(1, parseInt(String(req.query.sinceHours ?? "24"), 10) || 24),
      );

      try {
        const failedByUser = await pool.query(
          `SELECT user_id,
                  COUNT(*) FILTER (WHERE outcome != 'success') AS failed_count,
                  COUNT(*) AS total_count
             FROM file_access_audit
            WHERE created_at > NOW() - ($1 || ' hours')::interval
            GROUP BY user_id
            HAVING COUNT(*) FILTER (WHERE outcome != 'success') > 5
            ORDER BY failed_count DESC
            LIMIT 50`,
          [sinceHours],
        );

        const ipsWithMultipleUsers = await pool.query(
          `SELECT ip,
                  COUNT(DISTINCT user_id) AS distinct_users,
                  COUNT(*) AS total_requests
             FROM file_access_audit
            WHERE created_at > NOW() - ($1 || ' hours')::interval
              AND ip IS NOT NULL
            GROUP BY ip
            HAVING COUNT(DISTINCT user_id) >= 3
            ORDER BY distinct_users DESC
            LIMIT 50`,
          [sinceHours],
        );

        const outcomeBreakdown = await pool.query(
          `SELECT outcome, COUNT(*) AS count
             FROM file_access_audit
            WHERE created_at > NOW() - ($1 || ' hours')::interval
            GROUP BY outcome
            ORDER BY count DESC`,
          [sinceHours],
        );

        res.json({
          success: true,
          windowHours: sinceHours,
          failedByUser: failedByUser.rows,
          ipsWithMultipleUsers: ipsWithMultipleUsers.rows,
          outcomeBreakdown: outcomeBreakdown.rows,
        });
      } catch (err: any) {
        console.error("[admin-file-audit] suspicious failed:", err);
        res.status(500).json({
          success: false,
          error: "query_failed",
          message: String(err?.message || err).slice(0, 200),
        });
      }
    },
  );
}
