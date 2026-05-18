/**
 * admin-notifications-routes.ts — Slice 9X.54
 *
 * Bredkringkasting-system fra admin (Daniel) til segmenterte brukergrupper.
 * Den eksisterende AdminNotificationManager.tsx UI-en kalte endpoints som
 * aldri var implementert; dette fil-et fyller backenden.
 *
 * Endpoints:
 *   Admin:
 *     GET    /api/admin/notifications              — alle varslinger
 *     POST   /api/admin/notifications              — opprett ny
 *     PUT    /api/admin/notifications/:id          — oppdater
 *     DELETE /api/admin/notifications/:id          — slett
 *   User:
 *     GET    /api/notifications/inbox              — uleste/aktive for innlogget bruker
 *     POST   /api/notifications/:id/seen           — marker som sett
 *     POST   /api/notifications/:id/act            — utfør action (f.eks. extend_program)
 *
 * Target audiences:
 *   - 'all', 'photographers', 'videographers', 'music_producers', 'vendors'
 *   - 'prototype_testers' (NY — Slice 9X.54: filtrert mot aktive
 *     prototype_tester_invites)
 *
 * Action types:
 *   - 'open_url' — bare navigerer til action_url
 *   - 'extend_program' — payload: { weeks: number } — forlenger
 *     prototype-tester-perioden hvis brukeren er aktiv tester
 *   - 'acknowledge' — bare bekrefter (ingen side-effekt)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type express from "express";

export interface AdminNotificationsDeps {
  app: express.Application;
  pool: any;
  getPricingUserId: (req: any) => string;
  requireAdminSession?: (req: any, res: any) => boolean;
}

const VALID_TYPES = ["info", "warning", "success", "error", "announcement"];
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];
const VALID_AUDIENCES = [
  "all",
  "photographers",
  "videographers",
  "music_producers",
  "vendors",
  "prototype_testers",
];
const VALID_ACTION_TYPES = ["open_url", "extend_program", "acknowledge"];

async function ensureSchema(pool: any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_notifications (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title           TEXT NOT NULL,
      message         TEXT NOT NULL,
      type            VARCHAR(20) NOT NULL DEFAULT 'info',
      priority        VARCHAR(20) NOT NULL DEFAULT 'medium',
      target_audience VARCHAR(50) NOT NULL DEFAULT 'all',
      action_label    TEXT,
      action_url      TEXT,
      action_type     VARCHAR(50),
      action_payload  JSONB DEFAULT '{}'::jsonb,
      scheduled_for   TIMESTAMPTZ,
      expires_at      TIMESTAMPTZ,
      created_by      TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => undefined);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_admin_notifications_audience_active
       ON admin_notifications (target_audience, scheduled_for, expires_at)`,
  ).catch(() => undefined);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_notification_acks (
      user_id         TEXT NOT NULL,
      notification_id UUID NOT NULL,
      seen_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      acted_at        TIMESTAMPTZ,
      action_result   TEXT,
      PRIMARY KEY (user_id, notification_id)
    )
  `).catch(() => undefined);
}

function rowToNotification(r: any): any {
  return {
    id: r.id,
    title: r.title,
    message: r.message,
    type: r.type,
    priority: r.priority,
    targetAudience: r.target_audience,
    actionLabel: r.action_label,
    actionUrl: r.action_url,
    actionType: r.action_type,
    actionPayload: r.action_payload || {},
    scheduledFor: r.scheduled_for,
    expiresAt: r.expires_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Sjekk om en bruker matcher en notifications target-audience.
 * Returnerer true hvis brukeren skal motta varselet.
 */
async function userMatchesAudience(pool: any, userId: string, audience: string): Promise<boolean> {
  if (audience === "all") return true;

  // Profesjons-baserte audiences
  if (["photographers", "videographers", "music_producers", "vendors"].includes(audience)) {
    const map: Record<string, string> = {
      photographers: "photographer",
      videographers: "videographer",
      music_producers: "music_producer",
      vendors: "vendor",
    };
    const r = await pool.query(
      `SELECT 1 FROM users WHERE id = $1 AND profession = $2 LIMIT 1`,
      [userId, map[audience]],
    );
    return (r.rowCount ?? 0) > 0;
  }

  // Prototype-tester-audience: matcher hvis e-post-en på brukeren er aktiv tester
  if (audience === "prototype_testers") {
    const r = await pool.query(
      `SELECT 1 FROM prototype_tester_invites i
         JOIN users u ON LOWER(u.email) = LOWER(i.email)
         WHERE u.id = $1
           AND i.status = 'accepted'
           AND i.program_ends_at > NOW()
        LIMIT 1`,
      [userId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  return false;
}

export function setupAdminNotificationsRoutes(deps: AdminNotificationsDeps): void {
  const { app, pool, getPricingUserId, requireAdminSession } = deps;

  // ─── ADMIN: GET alle varslinger ─────────────────────────────
  app.get("/api/admin/notifications", async (req, res) => {
    if (requireAdminSession && !requireAdminSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 200`,
      );
      res.json({ notifications: r.rows.map(rowToNotification) });
    } catch (err) {
      console.error("GET /admin/notifications:", err);
      res.status(500).json({ error: "Kunne ikke hente varslinger" });
    }
  });

  // ─── ADMIN: POST opprett varsling ───────────────────────────
  app.post("/api/admin/notifications", async (req, res) => {
    if (requireAdminSession && !requireAdminSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const b = req.body ?? {};
      const title = typeof b.title === "string" ? b.title.trim().slice(0, 200) : "";
      const message = typeof b.message === "string" ? b.message.trim().slice(0, 4000) : "";
      const type = VALID_TYPES.includes(b.type) ? b.type : "info";
      const priority = VALID_PRIORITIES.includes(b.priority) ? b.priority : "medium";
      const targetAudience = VALID_AUDIENCES.includes(b.targetAudience) ? b.targetAudience : "all";
      const actionLabel = typeof b.actionLabel === "string" ? b.actionLabel.slice(0, 100) : null;
      const actionUrl = typeof b.actionUrl === "string" ? b.actionUrl.slice(0, 2000) : null;
      const actionType = VALID_ACTION_TYPES.includes(b.actionType) ? b.actionType : null;
      const actionPayload = typeof b.actionPayload === "object" && b.actionPayload !== null ? b.actionPayload : {};
      const scheduledFor = b.scheduledFor ? new Date(b.scheduledFor) : null;
      const expiresAt = b.expiresAt ? new Date(b.expiresAt) : null;
      const createdBy = getPricingUserId(req) || null;

      if (!title || !message) {
        return res.status(400).json({ error: "Tittel og melding er påkrevd" });
      }
      // extend_program må ha weeks i payload
      if (actionType === "extend_program") {
        const weeks = Number((actionPayload as any).weeks);
        if (!Number.isFinite(weeks) || weeks < 1 || weeks > 52) {
          return res.status(400).json({ error: "extend_program krever actionPayload.weeks (1-52)" });
        }
      }

      const ins = await pool.query(
        `INSERT INTO admin_notifications
           (title, message, type, priority, target_audience, action_label,
            action_url, action_type, action_payload, scheduled_for, expires_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)
         RETURNING *`,
        [
          title, message, type, priority, targetAudience, actionLabel,
          actionUrl, actionType, JSON.stringify(actionPayload),
          scheduledFor, expiresAt, createdBy,
        ],
      );
      res.status(201).json({ notification: rowToNotification(ins.rows[0]) });
    } catch (err) {
      console.error("POST /admin/notifications:", err);
      res.status(500).json({ error: "Kunne ikke opprette varsling" });
    }
  });

  // ─── ADMIN: PUT oppdater ────────────────────────────────────
  app.put("/api/admin/notifications/:id", async (req, res) => {
    if (requireAdminSession && !requireAdminSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const b = req.body ?? {};
      const updates: string[] = [];
      const vals: any[] = [];
      const push = (col: string, v: any) => { vals.push(v); updates.push(`${col} = $${vals.length}`); };

      if (typeof b.title === "string") push("title", b.title.trim().slice(0, 200));
      if (typeof b.message === "string") push("message", b.message.trim().slice(0, 4000));
      if (VALID_TYPES.includes(b.type)) push("type", b.type);
      if (VALID_PRIORITIES.includes(b.priority)) push("priority", b.priority);
      if (VALID_AUDIENCES.includes(b.targetAudience)) push("target_audience", b.targetAudience);
      if (b.expiresAt !== undefined) push("expires_at", b.expiresAt ? new Date(b.expiresAt) : null);
      if (updates.length === 0) return res.status(400).json({ error: "Ingen felter å oppdatere" });

      vals.push(req.params.id);
      const r = await pool.query(
        `UPDATE admin_notifications SET ${updates.join(", ")}, updated_at = NOW()
           WHERE id = $${vals.length} RETURNING *`,
        vals,
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Ikke funnet" });
      res.json({ notification: rowToNotification(r.rows[0]) });
    } catch (err) {
      console.error("PUT /admin/notifications/:id:", err);
      res.status(500).json({ error: "Kunne ikke oppdatere" });
    }
  });

  // ─── ADMIN: DELETE ──────────────────────────────────────────
  app.delete("/api/admin/notifications/:id", async (req, res) => {
    if (requireAdminSession && !requireAdminSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `DELETE FROM admin_notifications WHERE id = $1 RETURNING id`,
        [req.params.id],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Ikke funnet" });
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /admin/notifications/:id:", err);
      res.status(500).json({ error: "Kunne ikke slette" });
    }
  });

  // ─── USER: GET inbox (uleste, aktive, som matcher target) ───
  app.get("/api/notifications/inbox", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.json({ notifications: [] });

      // Hent alle aktive notifikasjoner som ennå ikke er sett av brukeren
      const r = await pool.query(
        `SELECT n.*
           FROM admin_notifications n
           LEFT JOIN user_notification_acks a
             ON a.notification_id = n.id AND a.user_id = $1
          WHERE a.user_id IS NULL
            AND (n.scheduled_for IS NULL OR n.scheduled_for <= NOW())
            AND (n.expires_at IS NULL OR n.expires_at > NOW())
          ORDER BY
            CASE n.priority
              WHEN 'urgent' THEN 4
              WHEN 'high' THEN 3
              WHEN 'medium' THEN 2
              WHEN 'low' THEN 1
            END DESC,
            n.created_at DESC
          LIMIT 50`,
        [uid],
      );

      // Filtrer mot audience i app-laget (krever DB-spørringer)
      const matching: any[] = [];
      for (const row of r.rows) {
        if (await userMatchesAudience(pool, uid, row.target_audience)) {
          matching.push(rowToNotification(row));
        }
      }
      res.json({ notifications: matching });
    } catch (err) {
      console.error("GET /notifications/inbox:", err);
      res.json({ notifications: [] });
    }
  });

  // ─── USER: POST seen ────────────────────────────────────────
  app.post("/api/notifications/:id/seen", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      await pool.query(
        `INSERT INTO user_notification_acks (user_id, notification_id, seen_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id, notification_id) DO NOTHING`,
        [uid, req.params.id],
      );
      res.json({ success: true });
    } catch (err) {
      console.error("POST /notifications/:id/seen:", err);
      res.status(500).json({ error: "Kunne ikke registrere sett" });
    }
  });

  // ─── USER: POST act — utfør tilhørende action ──────────────
  app.post("/api/notifications/:id/act", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const n = await pool.query(
        `SELECT * FROM admin_notifications WHERE id = $1 LIMIT 1`,
        [req.params.id],
      );
      if (n.rowCount === 0) return res.status(404).json({ error: "Ikke funnet" });
      const notif = n.rows[0];

      let result = "no_action";
      if (notif.action_type === "extend_program") {
        const weeks = Number((notif.action_payload as any)?.weeks || 0);
        if (weeks > 0) {
          // Forleng aktiv tester-periode for innlogget bruker
          const userR = await pool.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [uid]);
          if (userR.rowCount > 0 && userR.rows[0].email) {
            const upd = await pool.query(
              `UPDATE prototype_tester_invites
                  SET program_ends_at = program_ends_at + ($1 * INTERVAL '1 week'),
                      updated_at = NOW()
                WHERE LOWER(email) = LOWER($2)
                  AND status = 'accepted'
                  AND program_ends_at > NOW()
              RETURNING id, program_ends_at`,
              [weeks, userR.rows[0].email],
            );
            if ((upd.rowCount ?? 0) > 0) {
              result = `extended_${weeks}w_until_${new Date(upd.rows[0].program_ends_at).toISOString()}`;
            } else {
              result = "user_is_not_active_tester";
            }
          }
        }
      } else if (notif.action_type === "open_url") {
        result = "url_opened_client_side";
      } else if (notif.action_type === "acknowledge") {
        result = "acknowledged";
      }

      // Marker som handlet
      await pool.query(
        `INSERT INTO user_notification_acks (user_id, notification_id, seen_at, acted_at, action_result)
         VALUES ($1, $2, NOW(), NOW(), $3)
         ON CONFLICT (user_id, notification_id) DO UPDATE
           SET acted_at = NOW(), action_result = EXCLUDED.action_result`,
        [uid, req.params.id, result],
      );

      res.json({ success: true, result });
    } catch (err) {
      console.error("POST /notifications/:id/act:", err);
      res.status(500).json({ error: "Action feilet" });
    }
  });
}
