/**
 * role-room-calendar-routes.ts
 *
 * Envegs kalendersynk (Del A punkt 60).
 *
 *   POST   /api/role-room/projects/:projectId/calendar-feeds   — opprett abonnement
 *   GET    /api/role-room/projects/:projectId/calendar-feeds   — list abonnement
 *   DELETE /api/role-room/calendar-feeds/:feedId               — trekk tilbake
 *   GET    /api/role-room/calendar/:token.ics                  — selve feeden (åpen)
 *
 * Feed-endepunktet er bevisst uten sesjonsautentisering: kalenderklienter
 * henter en URL periodisk uten mulighet for innlogging. Tokenet ER
 * hemmeligheten, og kan trekkes tilbake når som helst.
 */

import type express from "express";
import type { Pool } from "pg";
import { randomBytes } from "crypto";
import { buildIcsFeed, toLocalDateString, type CalendarEvent } from "./role-room-calendar-ics.js";
import { canAccessRoleRoomProject } from "./role-room-projects-routes.js";

export interface CalendarRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
}

function publicBaseUrl(): string {
  return (
    process.env.ROLE_ROOM_PUBLIC_BASE_URL ||
    process.env.PUBLIC_BASE_URL ||
    "https://www.theroleroom.com"
  ).replace(/\/+$/, "");
}

export function feedUrlFor(token: string): string {
  return `${publicBaseUrl()}/api/role-room/calendar/${token}.ics`;
}

/**
 * Henter hendelsene feeden skal inneholde. Opptaksdager og frister er to
 * ulike kilder som slås sammen — abonnenten vil ha begge i samme kalender.
 */
export async function collectCalendarEvents(
  pool: Pool,
  projectId: string,
  scope: string,
): Promise<{ projectName: string; events: CalendarEvent[] }> {
  const project = await pool.query<{ name: string }>(
    `SELECT name FROM casting_projects WHERE id = $1 LIMIT 1`,
    [projectId],
  );
  const projectName = project.rows[0]?.name ?? "Role Room";
  const events: CalendarEvent[] = [];

  if (scope === "shoot_days" || scope === "all") {
    const days = await pool.query(
      `SELECT d.id, d.date, d.status, d.notes, l.name AS location_name, l.address
         FROM casting_production_days d
         LEFT JOIN casting_locations l ON l.id = d.location_id
        WHERE d.project_id = $1 AND d.date IS NOT NULL
        ORDER BY d.date`,
      [projectId],
    );
    for (const row of days.rows as Array<Record<string, unknown>>) {
      events.push({
        uid: `shoot-${row.id}@theroleroom.com`,
        // Lokale datodeler — se toLocalDateString: UTC-omregning ville flyttet
        // dagen ett døgn tilbake i norsk tid.
        date: toLocalDateString(row.date as Date | string),
        summary: `Opptak – ${projectName}`,
        description: (row.notes as string) || null,
        location: [row.location_name, row.address].filter(Boolean).join(", ") || null,
        cancelled: row.status === "cancelled",
      });
    }
  }

  if (scope === "deadlines" || scope === "all") {
    const items = await pool.query(
      `SELECT id, title, description, due_at, status
         FROM role_room_phase_timeline_items
        WHERE project_id = $1 AND due_at IS NOT NULL
        ORDER BY due_at`,
      [projectId],
    );
    for (const row of items.rows as Array<Record<string, unknown>>) {
      events.push({
        uid: `task-${row.id}@theroleroom.com`,
        // En frist kl. 12:00 UTC hører til den norske datoen, ikke UTC-datoen.
        date: toLocalDateString(row.due_at as Date | string),
        summary: `Frist: ${row.title}`,
        description: (row.description as string) || null,
        location: null,
        cancelled: row.status === "cancelled",
      });
    }
  }

  return { projectName, events };
}

export function setupRoleRoomCalendarRoutes(deps: CalendarRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  // ── Opprett abonnement ───────────────────────────────────────────────────
  app.post("/api/role-room/projects/:projectId/calendar-feeds", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const projectId = String(req.params.projectId || "");
      if (!(await canAccessRoleRoomProject(pool, session.userId, projectId))) {
        return res.status(403).json({ error: "ingen_tilgang" });
      }

      const body = req.body && typeof req.body === "object" ? req.body : {};
      const scope = ["shoot_days", "deadlines", "all"].includes(body.scope) ? body.scope : "all";
      const label = typeof body.label === "string" ? body.label.slice(0, 255) : null;
      const token = randomBytes(24).toString("base64url");

      const r = await pool.query<{ id: string }>(
        `INSERT INTO role_room_calendar_feeds
           (project_id, feed_token, label, created_by_user_id, scope)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [projectId, token, label, session.userId, scope],
      );

      res.status(201).json({
        id: r.rows[0].id,
        scope,
        label,
        // Vises kun her — URL-en er hemmeligheten og lagres ikke i klartekst noe annet sted.
        url: feedUrlFor(token),
        notice: "Abonnements-URL-en gir lesetilgang til planen. Del den kun med dem som skal ha den.",
      });
    } catch (err) {
      console.error("[calendar] kunne ikke opprette feed:", err);
      res.status(500).json({ error: "Kunne ikke opprette kalender-abonnement." });
    }
  });

  // ── List abonnement ──────────────────────────────────────────────────────
  app.get("/api/role-room/projects/:projectId/calendar-feeds", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const projectId = String(req.params.projectId || "");
      if (!(await canAccessRoleRoomProject(pool, session.userId, projectId))) {
        return res.status(403).json({ error: "ingen_tilgang" });
      }
      // Tokenet utleveres ikke igjen — den som mistet URL-en lager et nytt
      // abonnement framfor å hente ut en eksisterende hemmelighet.
      const r = await pool.query(
        `SELECT id, label, scope, created_by_user_id, created_at,
                last_accessed_at, access_count, revoked_at
           FROM role_room_calendar_feeds
          WHERE project_id = $1
          ORDER BY created_at DESC`,
        [projectId],
      );
      res.json({ feeds: r.rows });
    } catch (err) {
      console.error("[calendar] kunne ikke liste feeds:", err);
      res.status(500).json({ error: "Kunne ikke hente kalender-abonnement." });
    }
  });

  // ── Trekk tilbake ────────────────────────────────────────────────────────
  app.delete("/api/role-room/calendar-feeds/:feedId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const feedId = String(req.params.feedId || "");
      const feed = await pool.query<{ project_id: string }>(
        `SELECT project_id FROM role_room_calendar_feeds WHERE id = $1 LIMIT 1`,
        [feedId],
      );
      if (feed.rowCount === 0) return res.status(404).json({ error: "Fant ikke abonnementet." });

      // Object-first: feeden slås opp globalt på id, så prosjekt-tilgang må
      // sjekkes mot dens faktiske prosjekt.
      if (!(await canAccessRoleRoomProject(pool, session.userId, feed.rows[0].project_id))) {
        return res.status(403).json({ error: "ingen_tilgang" });
      }

      await pool.query(
        `UPDATE role_room_calendar_feeds
            SET revoked_at = COALESCE(revoked_at, NOW()), revoked_by_user_id = $2
          WHERE id = $1`,
        [feedId, session.userId],
      );
      res.json({ ok: true, revoked: feedId });
    } catch (err) {
      console.error("[calendar] kunne ikke trekke tilbake feed:", err);
      res.status(500).json({ error: "Kunne ikke trekke tilbake abonnementet." });
    }
  });

  // ── Selve feeden (åpen — tokenet er autentiseringen) ─────────────────────
  app.get("/api/role-room/calendar/:token.ics", async (req, res) => {
    try {
      const token = String((req.params as Record<string, string>).token || "");
      if (!token) return res.status(404).type("text/plain").send("Not found");

      const feed = await pool.query<{ id: string; project_id: string; scope: string }>(
        `SELECT id, project_id, scope
           FROM role_room_calendar_feeds
          WHERE feed_token = $1 AND revoked_at IS NULL
          LIMIT 1`,
        [token],
      );
      if (feed.rowCount === 0) {
        // Samme svar for ukjent og tilbaketrukket token — et tilbaketrukket
        // abonnement skal ikke kunne skilles fra et som aldri fantes.
        return res.status(404).type("text/plain").send("Not found");
      }

      const { projectName, events } = await collectCalendarEvents(
        pool,
        feed.rows[0].project_id,
        feed.rows[0].scope,
      );

      // Bruks-telemetri skal aldri hindre at kalenderen leveres.
      pool
        .query(
          `UPDATE role_room_calendar_feeds
              SET last_accessed_at = NOW(), access_count = access_count + 1
            WHERE id = $1`,
          [feed.rows[0].id],
        )
        .catch((err) => console.error("[calendar] kunne ikke logge henting:", err));

      res.setHeader("content-type", "text/calendar; charset=utf-8");
      res.setHeader("content-disposition", 'inline; filename="roleroom.ics"');
      res.setHeader("cache-control", "public, max-age=900");
      res.send(buildIcsFeed({ projectName, events }));
    } catch (err) {
      console.error("[calendar] feed feilet:", err);
      res.status(500).type("text/plain").send("Internal error");
    }
  });
}
