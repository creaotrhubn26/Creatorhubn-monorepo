/**
 * admin-system-backup-routes.ts
 *
 * Plattform-gruppe: backup-oversikt (DB-dumps, B2-arkiver, mappe-strukturer).
 * Stub-endpoints nå slik at SystemBackupTab i AdminDashboard kan rendre.
 * Senere kobles dette mot eksisterende b2-archive-cron-routes for å vise
 * faktisk backup-historikk.
 *
 * Endpoints:
 *   GET /api/system-backup/list             — backups + total
 *   GET /api/system-backup/stats            — aggregat (total bytes + tid)
 *   GET /api/system-backup/folder-structure — folder-tree-snapshot
 *
 * Alle krever requireAdminSession.
 */

import type express from "express";
import type { Pool } from "pg";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdminSystemBackupRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: express.Request, res: express.Response) => any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function setupAdminSystemBackupRoutes(
  deps: AdminSystemBackupRoutesDeps,
): void {
  const { app, requireAdminSession } = deps;

  app.get("/api/system-backup/list", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      // TODO: aggreger fra b2_company_archives + db_backup_log-tabellene.
      res.json({ backups: [], total: 0 });
    } catch (err) {
      console.error("[admin-system-backup] list failed:", err);
      res.status(500).json({ error: "system_backup_list_failed" });
    }
  });

  app.get("/api/system-backup/stats", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      res.json({ totalSize: 0, oldestBackup: null, newestBackup: null });
    } catch (err) {
      console.error("[admin-system-backup] stats failed:", err);
      res.status(500).json({ error: "system_backup_stats_failed" });
    }
  });

  app.get("/api/system-backup/folder-structure", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      // TODO: snapshot fra B2-bucket-listing.
      res.json({ folders: [] });
    } catch (err) {
      console.error("[admin-system-backup] folder-structure failed:", err);
      res.status(500).json({ error: "system_backup_folder_failed" });
    }
  });
}
