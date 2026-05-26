/**
 * showcase-analytics-routes.ts
 *
 * Setup-funksjon for /api/showcase/analytics endpoints — tracking og
 * aggregat av view/like/share/download for showcase-elementer.
 *
 * 2 endpoints:
 *   - POST /analytics  (track view/like/share/download — UPSERT per dag)
 *   - GET  /analytics  (aggregert summary, filtrer på profession+userId)
 *
 * Auth: åpen — userId fra query/header, ingen session-validering.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupShowcaseAnalyticsRoutes } from "./showcase-analytics-routes";
 *
 *   setupShowcaseAnalyticsRoutes({ app, pool });
 *
 * Mode-noter: ingen mode-branching.
 */

import type express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

import { readString } from "./_shared";

export interface ShowcaseAnalyticsRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  pool: Pool;
}

export function setupShowcaseAnalyticsRoutes(
  deps: ShowcaseAnalyticsRoutesDeps,
): void {
  const { app, pool, requireUserSession } = deps;

  // POST /api/showcase/analytics — Track showcase view/interaction
  app.post("/api/showcase/analytics", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const {
        showcaseItemId,
        configurationId,
        type,
        referrer,
        deviceType,
        browser,
        country,
      } = req.body;
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const updateField =
        type === "view"
          ? "views"
          : type === "like"
            ? "likes"
            : type === "share"
              ? "shares"
              : type === "download"
                ? "downloads"
                : "views";

      // Try to update existing record for today
      const existing = await pool.query(
        "SELECT id FROM showcase_analytics WHERE showcase_item_id = $1 AND date::date = CURRENT_DATE",
        [showcaseItemId],
      );

      if (existing.rowCount && existing.rowCount > 0) {
        await pool.query(
          `UPDATE showcase_analytics SET ${updateField} = ${updateField} + 1 WHERE id = $1`,
          [existing.rows[0].id],
        );
      } else {
        const fields: Record<string, number> = {
          views: 0,
          unique_views: 0,
          likes: 0,
          shares: 0,
          downloads: 0,
          time_spent: 0,
        };
        fields[updateField] = 1;
        await pool.query(
          `INSERT INTO showcase_analytics (id, showcase_item_id, configuration_id, views, unique_views, likes, shares, downloads, time_spent, referrer, device_type, browser, country, date, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_DATE, $14::timestamp)`,
          [
            id,
            showcaseItemId,
            configurationId || null,
            fields.views,
            fields.unique_views,
            fields.likes,
            fields.shares,
            fields.downloads,
            fields.time_spent,
            referrer || "",
            deviceType || "",
            browser || "",
            country || "",
            now,
          ],
        );
      }
      res.json({ tracked: true });
    } catch (error) {
      console.error("Error tracking showcase analytics:", error);
      res.status(500).json({ error: "Kunne ikke registrere analyse" });
    }
  });

  app.get("/api/showcase/analytics", async (req, res) => {
    try {
      const profession = readString(req.query.profession);
      const userId =
        readString(req.query.userId) ||
        readString(req.headers["x-user-id"]) ||
        null;
      const params: unknown[] = [];
      const filters: string[] = [];
      if (profession) {
        params.push(profession);
        filters.push(`profession = $${params.length}`);
      }
      if (userId) {
        params.push(userId);
        filters.push(`user_id = $${params.length}`);
      }
      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const itemsResult = await pool.query(
        `SELECT id FROM showcase_items ${whereClause}`,
        params,
      );
      const itemIds = itemsResult.rows.map((row) => String(row.id));
      if (!itemIds.length) {
        return res.json({
          totalViews: 0,
          totalLikes: 0,
          totalShares: 0,
          totalComments: 0,
        });
      }

      const analyticsResult = await pool.query(
        `SELECT
            COALESCE(SUM(views), 0)::int AS total_views,
            COALESCE(SUM(likes), 0)::int AS total_likes,
            COALESCE(SUM(shares), 0)::int AS total_shares,
            COALESCE(SUM(downloads), 0)::int AS total_downloads
           FROM showcase_analytics
          WHERE showcase_item_id = ANY($1)`,
        [itemIds],
      );
      const commentsResult = await pool
        .query(
          `SELECT COUNT(*)::int AS total
             FROM showcase_comments
            WHERE showcase_item_id = ANY($1)`,
          [itemIds],
        )
        .catch(() => ({ rows: [{ total: 0 }] }));

      const row = analyticsResult.rows[0] as Record<string, unknown>;
      res.json({
        totalViews: Number(row.total_views || 0),
        totalLikes: Number(row.total_likes || 0),
        totalShares: Number(row.total_shares || 0),
        totalDownloads: Number(row.total_downloads || 0),
        totalComments: Number(commentsResult.rows[0]?.total || 0),
      });
    } catch (error) {
      console.error("Error loading showcase analytics:", error);
      res.status(500).json({ error: "Kunne ikke hente showcase-analyse" });
    }
  });
}
