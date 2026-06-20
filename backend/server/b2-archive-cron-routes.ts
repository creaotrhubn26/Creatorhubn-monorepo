/**
 * b2-archive-cron-routes.ts
 *
 * Cron-trigger-endepunkter for daglige B2-snapshots av DB-baserte artefakter
 * (business-plan + AI citation dashboard). Marketing-cockpit-snapshot er
 * utelatt foreløpig fordi den kaller Meta-API live (krever orkestrering;
 * gjør i Phase 4 hvis behov).
 *
 * Auth: x-cron-secret-header mot ADMIN_ROOM_CRON_SECRET. Samme mønster som
 * role-room-approval-cron.ts og role-room-ads-cron.ts.
 *
 * Cron-konfig (Render Cron Job / GitHub Actions / hva som helst):
 *   0 3 * * *   POST /api/internal/b2-archive/cron/business-plan
 *   30 3 * * *  POST /api/internal/b2-archive/cron/ai-citation
 *
 * Daniel kan også trigge manuelt:
 *   curl -X POST -H "x-cron-secret: <secret>" \
 *     https://creatorhub-backend-rtbl.onrender.com/api/internal/b2-archive/cron/business-plan
 */

import type express from "express";
import type { Pool } from "pg";
import {
  archiveToRoleRoomB2,
  businessPlanSnapshotKey,
} from "./b2-archive-helper.js";

interface CronRoutesDeps {
  app: express.Application;
  pool: Pool;
}

function checkCronSecret(req: express.Request, res: express.Response): boolean {
  const provided = req.headers["x-cron-secret"];
  const secret = process.env.ADMIN_ROOM_CRON_SECRET;
  if (!secret) {
    res.status(503).json({ error: "ADMIN_ROOM_CRON_SECRET ikke satt på server" });
    return false;
  }
  if (typeof provided !== "string" || provided.trim() !== secret.trim()) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  return true;
}

export function registerB2ArchiveCronRoutes(deps: CronRoutesDeps): void {
  const { app, pool } = deps;

  // ── Business plan daily snapshot ──────────────────────────────────────
  app.post("/api/internal/b2-archive/cron/business-plan", async (req, res) => {
    if (!checkCronSecret(req, res)) return;

    try {
      // Mig 0335 (multi-produkt): én rad per (user_id, product_key).
      // Cron snapshotter siste oppdaterte rad PER PRODUKT.
      const result = await pool.query(
        `SELECT DISTINCT ON (product_key) *
           FROM admin_business_plan
          ORDER BY product_key, updated_at DESC`,
      );
      if (result.rows.length === 0) {
        return res.json({ archived: false, reason: "Ingen business-plan i DB" });
      }

      const archived: Array<{ productKey: string; bucket: string; key: string; sizeBytes: number }> = [];
      for (const plan of result.rows) {
        const productKey: "role_room" | "leadgrid" =
          plan.product_key === "leadgrid" ? "leadgrid" : "role_room";
        const snapshot = {
          snapshotAt: new Date().toISOString(),
          productKey,
          plan,
        };
        const archiveResult = await archiveToRoleRoomB2(
          businessPlanSnapshotKey(productKey),
          JSON.stringify(snapshot, null, 2),
          "application/json; charset=utf-8",
        );
        if (archiveResult) {
          archived.push({
            productKey,
            bucket: archiveResult.bucket,
            key: archiveResult.key,
            sizeBytes: archiveResult.size,
          });
        }
      }

      if (archived.length === 0) {
        return res.status(503).json({ archived: false, reason: "B2 ikke konfigurert" });
      }
      return res.json({ archived: true, snapshots: archived });
    } catch (err) {
      console.error("[b2-archive-cron] business-plan error", err);
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // ── AI citation dashboard daily snapshot ──────────────────────────────
  app.post("/api/internal/b2-archive/cron/ai-citation", async (req, res) => {
    if (!checkCronSecret(req, res)) return;

    try {
      // Henter queries + siste resultat per query (samme aggregering som
      // /api/admin-room/ai-citation/dashboard, men uten å gå via HTTP).
      const queriesResult = await pool.query(
        `SELECT * FROM role_room_ai_citation_queries ORDER BY created_at DESC`,
      );
      const resultsResult = await pool.query(
        `SELECT DISTINCT ON (query_id) *
           FROM role_room_ai_citation_results
          ORDER BY query_id, created_at DESC`,
      );

      const snapshot = {
        snapshotAt: new Date().toISOString(),
        queryCount: queriesResult.rowCount,
        resultCount: resultsResult.rowCount,
        queries: queriesResult.rows,
        latestResultsPerQuery: resultsResult.rows,
      };

      const now = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const key = `marketing-reports/ai-citation/${now}-snapshot.json`;
      const archiveResult = await archiveToRoleRoomB2(
        key,
        JSON.stringify(snapshot, null, 2),
        "application/json; charset=utf-8",
      );

      if (!archiveResult) {
        return res.status(503).json({ archived: false, reason: "B2 ikke konfigurert" });
      }
      return res.json({
        archived: true,
        bucket: archiveResult.bucket,
        key: archiveResult.key,
        sizeBytes: archiveResult.size,
        queriesArchived: queriesResult.rowCount,
        resultsArchived: resultsResult.rowCount,
      });
    } catch (err) {
      console.error("[b2-archive-cron] ai-citation error", err);
      return res.status(500).json({ error: (err as Error).message });
    }
  });
}
