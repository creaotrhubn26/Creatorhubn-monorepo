/**
 * Competitor Watchlist Routes — Page Metadata 2.0 Fase 1.
 *
 * CRUD over competitor_watchlist + read-only access til
 * competitor_metadata_snapshots (historikk for trend-grafer).
 *
 * Mountes inn i createRoleRoomRouter sammen med composer-routes.
 * Bruker apiKeyAuth fra eksisterende mønster.
 */
import type { Pool } from "pg";
import type { Request, RequestHandler, Response, Router } from "express";

interface WatchlistRow {
  id: string;
  project_id: string;
  user_id: string;
  brand_name: string;
  platform: string;
  external_id: string;
  added_at: string;
  last_fetched_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface SnapshotRow {
  id: string;
  watchlist_id: string;
  fetched_at: string;
  followers_count: string | null;
  posts_30d: number | null;
  engagement_avg_30d: string | null;
  about_text: string | null;
  category: string | null;
}

const SUPPORTED_PLATFORMS = ["facebook", "instagram", "tiktok", "linkedin", "youtube"];

export function registerCompetitorWatchlistRoutes(
  router: Router,
  pool: Pool,
  authMiddleware: RequestHandler,
  getUserId: (req: Request) => string,
): void {
  // ── GET /competitors/watchlist — list per project ──
  router.get("/competitors/watchlist", authMiddleware, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (userId === "anonymous") return res.status(401).json({ error: "auth required" });
    const projectId = String(req.query.projectId ?? "").trim();
    if (!projectId) return res.status(400).json({ error: "projectId query-param required" });

    try {
      // Inkluder siste snapshot for rask sparkline-rendering
      const { rows } = await pool.query<WatchlistRow & {
        latest_followers: string | null;
        latest_fetched: string | null;
      }>(
        `SELECT w.*,
                s.followers_count::text AS latest_followers,
                s.fetched_at::text AS latest_fetched
         FROM competitor_watchlist w
         LEFT JOIN LATERAL (
           SELECT followers_count, fetched_at
           FROM competitor_metadata_snapshots
           WHERE watchlist_id = w.id
           ORDER BY fetched_at DESC
           LIMIT 1
         ) s ON true
         WHERE w.project_id = $1
         ORDER BY w.added_at DESC`,
        [projectId],
      );
      return res.json({ watchlist: rows });
    } catch (err) {
      console.error("[competitors/watchlist] list failed:", err);
      return res.status(500).json({ error: "list failed" });
    }
  });

  // ── POST /competitors/watchlist — add new ──
  router.post("/competitors/watchlist", authMiddleware, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (userId === "anonymous") return res.status(401).json({ error: "auth required" });
    const body = req.body as {
      projectId?: string;
      brandName?: string;
      platform?: string;
      externalId?: string;
    };
    if (!body?.projectId || !body?.brandName || !body?.platform || !body?.externalId) {
      return res.status(400).json({ error: "projectId, brandName, platform, externalId required" });
    }
    if (!SUPPORTED_PLATFORMS.includes(body.platform)) {
      return res.status(400).json({
        error: `platform må være en av: ${SUPPORTED_PLATFORMS.join(", ")}`,
      });
    }

    try {
      const { rows } = await pool.query<WatchlistRow>(
        `INSERT INTO competitor_watchlist (project_id, user_id, brand_name, platform, external_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (project_id, platform, external_id) DO UPDATE
           SET brand_name = EXCLUDED.brand_name
         RETURNING *`,
        [body.projectId, userId, body.brandName, body.platform, body.externalId],
      );
      return res.status(201).json({ watchlist: rows[0] });
    } catch (err) {
      console.error("[competitors/watchlist] add failed:", err);
      return res.status(500).json({ error: "add failed" });
    }
  });

  // ── DELETE /competitors/watchlist/:id — remove ──
  router.delete("/competitors/watchlist/:id", authMiddleware, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (userId === "anonymous") return res.status(401).json({ error: "auth required" });
    try {
      const { rowCount } = await pool.query(
        `DELETE FROM competitor_watchlist WHERE id = $1 AND user_id = $2`,
        [req.params.id, userId],
      );
      if (rowCount === 0) return res.status(404).json({ error: "not found or not yours" });
      return res.status(204).send();
    } catch (err) {
      console.error("[competitors/watchlist] delete failed:", err);
      return res.status(500).json({ error: "delete failed" });
    }
  });

  // ── GET /competitors/watchlist/:id/snapshots — historikk ──
  router.get(
    "/competitors/watchlist/:id/snapshots",
    authMiddleware,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (userId === "anonymous") return res.status(401).json({ error: "auth required" });
      const days = Math.min(Math.max(Number(req.query.days ?? 30), 1), 365);
      try {
        const { rows } = await pool.query<SnapshotRow>(
          `SELECT id, watchlist_id, fetched_at::text, followers_count::text,
                  posts_30d, engagement_avg_30d::text, about_text, category
           FROM competitor_metadata_snapshots
           WHERE watchlist_id = $1
             AND fetched_at >= now() - $2::interval
           ORDER BY fetched_at ASC`,
          [req.params.id, `${days} days`],
        );
        return res.json({ snapshots: rows });
      } catch (err) {
        console.error("[competitors/snapshots] list failed:", err);
        return res.status(500).json({ error: "snapshot list failed" });
      }
    },
  );
}
