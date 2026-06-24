/**
 * leadgrid-retention-cron.ts
 *
 * Daglig data-retention-cleanup for Leadgrid:
 *   - lead_scores_history > 90 dager → DELETE
 *   - lead_recommendations (dismissed) > 30 dager → DELETE
 *   - lead_recommendations (expired) > 30 dager → DELETE
 *   - webhook_delivery_queue (exhausted) > 30 dager → DELETE
 *   - lead_territory_events > 180 dager → DELETE
 *
 * Trigger: GitHub Actions (workflow: leadgrid-retention-cleanup.yml)
 *          @ 03:00 UTC daglig (1 time før intelligence-rescore for
 *          å holde history-tabellen slank).
 *
 * Auth: samme `LEADGRID_INTELLIGENCE_CRON_TOKEN` som rescore-cronen,
 *       med timing-safe compare.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { captureLeadgridError } from "./sentry-init.js";

interface Deps {
  app: Express;
  pool: Pool;
}

const SCORES_HISTORY_DAYS = 90;
const RECOMMENDATIONS_DISMISSED_DAYS = 30;
const RECOMMENDATIONS_EXPIRED_DAYS = 30;
const WEBHOOK_QUEUE_EXHAUSTED_DAYS = 30;
const TERRITORY_EVENTS_DAYS = 180;

export function registerLeadgridRetentionCron(deps: Deps): void {
  const { app, pool } = deps;

  app.post(
    "/api/leadgrid/cron/retention-cleanup",
    async (req: Request, res: Response): Promise<void> => {
      const expected = process.env.LEADGRID_INTELLIGENCE_CRON_TOKEN;
      const provided = req.headers["x-cron-trigger-token"];
      if (!expected) {
        res.status(503).json({ error: "cron_token_not_configured" });
        return;
      }
      if (typeof provided !== "string" || provided.length !== expected.length) {
        res.status(401).json({ error: "invalid_cron_token" });
        return;
      }
      // Timing-safe compare — beskytter mot timing-attack på prefix
      const { timingSafeEqual } = await import("crypto");
      if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
        res.status(401).json({ error: "invalid_cron_token" });
        return;
      }

      const start = Date.now();
      const stats: Record<string, number> = {};
      try {
        // 1. lead_scores_history
        try {
          const r1 = await pool.query(
            `DELETE FROM lead_scores_history WHERE computed_at < NOW() - ($1 || ' days')::interval`,
            [String(SCORES_HISTORY_DAYS)],
          );
          stats.scores_history_deleted = r1.rowCount ?? 0;
        } catch (err) {
          console.warn("[retention-cron] scores_history feilet:", err);
          stats.scores_history_deleted = -1;
        }

        // 2. lead_recommendations (dismissed)
        try {
          const r2 = await pool.query(
            `DELETE FROM lead_recommendations
              WHERE status = 'dismissed' AND created_at < NOW() - ($1 || ' days')::interval`,
            [String(RECOMMENDATIONS_DISMISSED_DAYS)],
          );
          stats.dismissed_recommendations_deleted = r2.rowCount ?? 0;
        } catch (err) {
          console.warn("[retention-cron] dismissed_recommendations feilet:", err);
          stats.dismissed_recommendations_deleted = -1;
        }

        // 3. lead_recommendations (expired)
        try {
          const r3 = await pool.query(
            `DELETE FROM lead_recommendations
              WHERE status = 'expired' AND created_at < NOW() - ($1 || ' days')::interval`,
            [String(RECOMMENDATIONS_EXPIRED_DAYS)],
          );
          stats.expired_recommendations_deleted = r3.rowCount ?? 0;
        } catch (err) {
          console.warn("[retention-cron] expired_recommendations feilet:", err);
          stats.expired_recommendations_deleted = -1;
        }

        // 4. webhook_delivery_queue (exhausted) — tabell kanskje ikke finnes
        try {
          const r4 = await pool.query(
            `DELETE FROM webhook_delivery_queue
              WHERE status = 'exhausted' AND created_at < NOW() - ($1 || ' days')::interval`,
            [String(WEBHOOK_QUEUE_EXHAUSTED_DAYS)],
          );
          stats.webhook_queue_deleted = r4.rowCount ?? 0;
        } catch {
          stats.webhook_queue_deleted = -1;
        }

        // 5. lead_territory_events (audit-log)
        try {
          const r5 = await pool.query(
            `DELETE FROM lead_territory_events WHERE created_at < NOW() - ($1 || ' days')::interval`,
            [String(TERRITORY_EVENTS_DAYS)],
          );
          stats.territory_events_deleted = r5.rowCount ?? 0;
        } catch {
          stats.territory_events_deleted = -1;
        }

        const durationMs = Date.now() - start;
        console.log(`[retention-cron] OK ${durationMs}ms:`, stats);
        res.json({ ok: true, stats, duration_ms: durationMs });
      } catch (err) {
        captureLeadgridError("retention-cron", err, { stats });
        const durationMs = Date.now() - start;
        res.status(500).json({
          error: "retention_failed",
          detail: String(err).slice(0, 300),
          stats,
          duration_ms: durationMs,
        });
      }
    },
  );
}
