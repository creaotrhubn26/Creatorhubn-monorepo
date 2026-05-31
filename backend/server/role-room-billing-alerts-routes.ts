/**
 * Admin-endepunkter for Role Room billing-alerts. Brukes til å oppdage
 * Stripe-sync-feil (f.eks. når soft-delete frigjorde seat men quantity
 * ikke ble senket).
 *
 * Endepunkter:
 *   - GET /api/admin-room/role-room/billing-alerts?status=unresolved|all
 *   - POST /api/admin-room/role-room/billing-alerts/:id/resolve
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { syncRoleRoomSeatQuantity, countActiveSeats } from "./role-room-seat-stripe-sync.js";

type SessionData = { userId: string; role?: string };

interface Deps {
  pool: Pool;
  requireAdminSession: (req: Request, res: Response) => { userId: string } | null;
}

export function registerRoleRoomBillingAlertsRoutes(app: Express, deps: Deps): void {
  const { pool, requireAdminSession } = deps;

  app.get(
    "/api/admin-room/role-room/billing-alerts",
    async (req: Request, res: Response) => {
      const admin = requireAdminSession(req, res);
      if (!admin) return;

      const status = String(req.query.status ?? "unresolved").toLowerCase();
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));

      try {
        const where = status === "all" ? "TRUE" : "a.resolved_at IS NULL";
        // JOIN med users + casting_projects så admin ser email + prosjektnavn
        // istedet for opake IDer. LEFT JOIN tåler sletting av brukere/prosjekter.
        const { rows } = await pool.query(
          `SELECT a.id, a.project_id, a.owner_user_id, a.actor_user_id, a.kind, a.detail,
                  a.stripe_subscription_id, a.resolved_at, a.resolved_by_user_id,
                  a.resolution_note, a.created_at,
                  p.name AS project_name,
                  uo.email AS owner_email,
                  ua.email AS actor_email,
                  ur.email AS resolved_by_email
             FROM role_room_billing_alerts a
             LEFT JOIN casting_projects p ON p.id = a.project_id
             LEFT JOIN users uo ON uo.id = a.owner_user_id
             LEFT JOIN users ua ON ua.id = a.actor_user_id
             LEFT JOIN users ur ON ur.id = a.resolved_by_user_id
            WHERE ${where}
            ORDER BY a.created_at DESC
            LIMIT $1`,
          [limit],
        );
        res.json({
          alerts: rows.map((row: {
            id: number; project_id: string; owner_user_id: string; actor_user_id: string;
            kind: string; detail: string; stripe_subscription_id: string | null;
            resolved_at: Date | null; resolved_by_user_id: string | null;
            resolution_note: string | null; created_at: Date;
            project_name: string | null; owner_email: string | null;
            actor_email: string | null; resolved_by_email: string | null;
          }) => ({
            id: row.id,
            projectId: row.project_id,
            projectName: row.project_name,
            ownerUserId: row.owner_user_id,
            ownerEmail: row.owner_email,
            actorUserId: row.actor_user_id,
            actorEmail: row.actor_email,
            kind: row.kind,
            detail: row.detail,
            stripeSubscriptionId: row.stripe_subscription_id,
            resolvedAt: row.resolved_at,
            resolvedByUserId: row.resolved_by_user_id,
            resolvedByEmail: row.resolved_by_email,
            resolutionNote: row.resolution_note,
            createdAt: row.created_at,
          })),
        });
      } catch (err) {
        if ((err as { code?: string }).code === "42P01") {
          // Tabellen finnes ikke ennå — ingen alerts er logget
          res.json({ alerts: [] });
          return;
        }
        console.error("[rr-billing-alerts] GET failed:", err);
        res.status(500).json({ error: "intern_feil" });
      }
    },
  );

  // POST .../retry-sync: kjør sync på nytt for prosjektet og marker alert
  // som løst hvis det går. Bruker syncRoleRoomSeatQuantity med dagens
  // active-user-count, så Stripe-quantity matcher virkeligheten.
  app.post(
    "/api/admin-room/role-room/billing-alerts/:id/retry-sync",
    async (req: Request, res: Response) => {
      const admin = requireAdminSession(req, res);
      if (!admin) return;
      const id = parseInt(String(req.params.id ?? ""), 10);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "ugyldig_id" }); return;
      }

      try {
        const { rows } = await pool.query(
          `SELECT project_id, owner_user_id, resolved_at
             FROM role_room_billing_alerts WHERE id = $1 LIMIT 1`,
          [id],
        );
        if (rows.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (rows[0].resolved_at) {
          res.status(400).json({ error: "allerede_resolved" }); return;
        }
        const projectId = String(rows[0].project_id);
        const ownerUserId = String(rows[0].owner_user_id);

        const used = await countActiveSeats(pool, ownerUserId, projectId);
        const sync = await syncRoleRoomSeatQuantity({
          pool, ownerUserId, projectId,
          targetActiveUsers: used,
          actorUserId: admin.userId,
        });

        if (!sync.ok) {
          // Sync feilet igjen — alert forblir åpen, men admin har prøvd
          res.status(502).json({
            ok: false,
            reason: sync.reason,
            previousQuantity: sync.previousQuantity,
            newQuantity: sync.newQuantity,
          });
          return;
        }

        // Sync OK — marker alert som løst med auto-notat
        await pool.query(
          `UPDATE role_room_billing_alerts
              SET resolved_at = NOW(),
                  resolved_by_user_id = $1,
                  resolution_note = $2
            WHERE id = $3`,
          [
            admin.userId,
            `Auto-løst via retry-sync: Stripe-quantity satt til ${sync.newQuantity} (var ${sync.previousQuantity})`,
            id,
          ],
        );
        res.json({
          ok: true,
          previousQuantity: sync.previousQuantity,
          newQuantity: sync.newQuantity,
        });
      } catch (err) {
        console.error("[rr-billing-alerts] retry-sync failed:", err);
        res.status(500).json({ error: "intern_feil" });
      }
    },
  );

  app.post(
    "/api/admin-room/role-room/billing-alerts/:id/resolve",
    async (req: Request, res: Response) => {
      const admin = requireAdminSession(req, res);
      if (!admin) return;

      const id = parseInt(String(req.params.id ?? ""), 10);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "ugyldig_id" }); return;
      }
      const note = String(req.body?.note ?? "").trim().slice(0, 1000);

      try {
        const result = await pool.query(
          `UPDATE role_room_billing_alerts
              SET resolved_at = NOW(),
                  resolved_by_user_id = $1,
                  resolution_note = NULLIF($2, '')
            WHERE id = $3 AND resolved_at IS NULL`,
          [admin.userId, note, id],
        );
        if (result.rowCount === 0) {
          res.status(404).json({ error: "ikke_funnet_eller_allerede_resolved" }); return;
        }
        res.json({ ok: true });
      } catch (err) {
        console.error("[rr-billing-alerts] resolve failed:", err);
        res.status(500).json({ error: "intern_feil" });
      }
    },
  );
}
