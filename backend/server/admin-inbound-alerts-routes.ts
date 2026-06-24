/**
 * admin-inbound-alerts-routes.ts — admin-innboksen for innkommende hendelser
 * skrevet av notifyAdmins() (admin-notify.ts). Dette er admin-SIDENS varsler
 * (søknader/leads/bookinger som krever oppfølging), atskilt fra
 * admin_notifications (som er admin → bruker-bredkringkasting).
 *
 *   GET   /api/admin/inbound-alerts            — siste varsler (+ ?unread=1)
 *   GET   /api/admin/inbound-alerts/count      — antall uleste (til badge)
 *   POST  /api/admin/inbound-alerts/:id/read   — marker ett som lest
 *   POST  /api/admin/inbound-alerts/read-all   — marker alle som lest
 */
import type express from "express";
import type { Pool } from "pg";

export interface AdminInboundAlertsDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string; loginAt: string } | null;
}

export function setupAdminInboundAlertsRoutes(deps: AdminInboundAlertsDeps): void {
  const { app, pool, requireAdminSession } = deps;

  app.get("/api/admin/inbound-alerts", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const unreadOnly = req.query.unread === "1" || req.query.unread === "true";
      const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
      const where: string[] = [];
      const params: unknown[] = [];
      if (unreadOnly) where.push("read_at IS NULL");
      if (typeof req.query.type === "string" && req.query.type) {
        params.push(req.query.type);
        where.push(`type = $${params.length}`);
      }
      if (typeof req.query.source === "string" && req.query.source) {
        params.push(`%${req.query.source}%`);
        where.push(`source ILIKE $${params.length}`);
      }
      params.push(limit);
      const r = await pool.query(
        `SELECT id, type, source, title, summary, cta, page, utm, link, related_id, read_at, created_at
           FROM admin_inbound_alerts
          ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
          ORDER BY created_at DESC
          LIMIT $${params.length}`,
        params,
      );
      res.json({ alerts: r.rows });
    } catch (err) {
      console.error("GET /admin/inbound-alerts:", err);
      // Tom liste i stedet for 500 hvis tabellen ikke finnes ennå.
      res.json({ alerts: [] });
    }
  });

  app.get("/api/admin/inbound-alerts/count", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const r = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM admin_inbound_alerts WHERE read_at IS NULL`,
      );
      res.json({ unread: Number(r.rows[0]?.count || 0) });
    } catch {
      res.json({ unread: 0 });
    }
  });

  app.post("/api/admin/inbound-alerts/:id/read", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      await pool.query(
        `UPDATE admin_inbound_alerts SET read_at = NOW() WHERE id = $1 AND read_at IS NULL`,
        [req.params.id],
      );
      res.json({ ok: true });
    } catch (err) {
      console.error("POST /admin/inbound-alerts/:id/read:", err);
      res.status(500).json({ error: "kunne_ikke_markere_lest" });
    }
  });

  app.post("/api/admin/inbound-alerts/read-all", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      await pool.query(`UPDATE admin_inbound_alerts SET read_at = NOW() WHERE read_at IS NULL`);
      res.json({ ok: true });
    } catch (err) {
      console.error("POST /admin/inbound-alerts/read-all:", err);
      res.status(500).json({ error: "kunne_ikke_markere_lest" });
    }
  });
}
