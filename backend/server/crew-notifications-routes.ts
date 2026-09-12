/**
 * crew-notifications-routes.ts — mountes under /api/role-room.
 *
 * Persisterte crew-notifikasjoner (tildeling til produksjonshendelser). Erstatter
 * det aldri-bygde `/crew/:id/notifications`-endepunktet som `crewNotificationsApi`
 * (frontend) kalte fra ProductionCalendarPanel (→ 404, varsel forsvant).
 *
 * Endepunkter:
 *   GET  /api/role-room/crew/:crewId/notifications[?status=]  — list
 *   POST /api/role-room/crew/:crewId/notifications             — opprett (+ e-post)
 *   PUT  /api/role-room/notifications/:notificationId/read     — marker lest
 *
 * Leveranse: raden PERSISTERES alltid (så den kan leses/vises). I tillegg, når
 * kanalen er 'email' og crew-medlemmet har en e-postadresse, sendes en
 * transaksjons-e-post («Du er tildelt: …»). 'push' er ikke implementert →
 * behandles som in_app (persisteres, ingen ekstern levering) — ærlig-inaktiv.
 *
 * Tilgang: innlogging + eier/medlem av crew-medlemmets prosjekt
 * (canAccessRoleRoomProject). Hindrer at hvem som helst spammer/leser andres crew.
 */

import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from "express";
import type { Pool } from "pg";
import { loadPersistedAuthSession } from "./auth-session-store.js";
import { canAccessRoleRoomProject } from "./role-room-projects-routes.js";
import { newEntityId } from "./_shared-ids.js";
import { sendTransactionalEmail } from "./transactional-email-service.js";

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}

export type CrewNotificationChannel = "in_app" | "email" | "push";

export interface CrewNotificationRow {
  id: string;
  crew_id: string;
  project_id: string | null;
  event_id: string | null;
  notification_type: string;
  channel: CrewNotificationChannel;
  title: string;
  message: string | null;
  payload: Record<string, unknown>;
  status: "pending" | "sent" | "read";
  read_at: string | null;
  sent_at: string | null;
  created_at: string | null;
}

/**
 * Velg leveringskanal. Uten eksplisitt kanal: e-post HVIS crew har adresse
 * (så varselet faktisk når fram), ellers in_app. 'push' finnes ikke → in_app.
 */
export function resolveChannel(
  requested: string | undefined,
  crewEmail: string | null | undefined,
): CrewNotificationChannel {
  const hasEmail = Boolean((crewEmail || "").trim());
  if (requested === "email") return hasEmail ? "email" : "in_app";
  if (requested === "in_app") return "in_app";
  if (requested === "push") return "in_app"; // ikke implementert → degrader
  return hasEmail ? "email" : "in_app";
}

function rowToNotification(r: Record<string, unknown>): CrewNotificationRow {
  return {
    id: String(r.id),
    crew_id: String(r.crew_id),
    project_id: (r.project_id as string) ?? null,
    event_id: (r.event_id as string) ?? null,
    notification_type: (r.notification_type as string) ?? "assignment",
    channel: (r.channel as CrewNotificationChannel) ?? "in_app",
    title: (r.title as string) ?? "",
    message: (r.message as string) ?? null,
    payload: (r.payload as Record<string, unknown>) ?? {},
    status: (r.status as "pending" | "sent" | "read") ?? "sent",
    read_at: r.read_at ? new Date(r.read_at as string).toISOString() : null,
    sent_at: r.sent_at ? new Date(r.sent_at as string).toISOString() : null,
    created_at: r.created_at ? new Date(r.created_at as string).toISOString() : null,
  };
}

async function resolveUser(
  pool: Pool,
  activeSessions: Map<string, SessionData> | undefined,
  bearer: string | null | undefined,
): Promise<SessionData | null> {
  const token = typeof bearer === "string" ? bearer.trim() : "";
  if (!token) return null;
  const inMemory = activeSessions?.get(token) ?? null;
  if (inMemory) return inMemory;
  const persisted = await loadPersistedAuthSession<SessionData>(pool, token);
  if (persisted) {
    activeSessions?.set(token, persisted);
    return persisted;
  }
  return null;
}

interface CrewRow {
  id: string;
  project_id: string;
  name: string;
  email: string | null;
}

async function loadCrew(pool: Pool, crewId: string): Promise<CrewRow | null> {
  const r = await pool.query(
    `SELECT id, project_id, name, email FROM casting_crew WHERE id = $1`,
    [crewId],
  );
  return (r.rows[0] as CrewRow | undefined) ?? null;
}

export interface CreateCrewNotificationsRouterDeps {
  activeSessions?: Map<string, SessionData>;
  /** Injiserbar e-postsender for test; default sendTransactionalEmail. */
  sendEmailImpl?: typeof sendTransactionalEmail;
  /** Injiserbar tilgangssjekk for test; default canAccessRoleRoomProject. */
  canAccessImpl?: (pool: Pool, userId: string, projectId: string) => Promise<boolean>;
}

export function createCrewNotificationsRouter(
  pool: Pool,
  deps: CreateCrewNotificationsRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const sendEmailImpl = deps.sendEmailImpl ?? sendTransactionalEmail;
  const canAccess = deps.canAccessImpl ?? canAccessRoleRoomProject;

  const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
    const session = await resolveUser(pool, deps.activeSessions, bearer);
    if (!session?.userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    (req as Request & { userId: string }).userId = session.userId;
    next();
  };

  // List for et crew-medlem.
  router.get("/crew/:crewId/notifications", requireAuth, async (req, res) => {
    const userId = (req as Request & { userId: string }).userId;
    const crew = await loadCrew(pool, String(req.params.crewId));
    if (!crew) {
      res.status(404).json({ error: "crew_not_found" });
      return;
    }
    if (!(await canAccess(pool, userId, crew.project_id))) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const status = typeof req.query.status === "string" ? req.query.status : null;
    try {
      const r = status
        ? await pool.query(
            `SELECT * FROM role_room_crew_notifications WHERE crew_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 200`,
            [crew.id, status],
          )
        : await pool.query(
            `SELECT * FROM role_room_crew_notifications WHERE crew_id = $1 ORDER BY created_at DESC LIMIT 200`,
            [crew.id],
          );
      res.json({ notifications: r.rows.map(rowToNotification) });
    } catch {
      res.json({ notifications: [] });
    }
  });

  // Opprett (+ evt. e-post).
  router.post("/crew/:crewId/notifications", requireAuth, async (req, res) => {
    const userId = (req as Request & { userId: string }).userId;
    const crew = await loadCrew(pool, String(req.params.crewId));
    if (!crew) {
      res.status(404).json({ error: "crew_not_found" });
      return;
    }
    if (!(await canAccess(pool, userId, crew.project_id))) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const body = (req.body ?? {}) as {
      project_id?: string;
      event_id?: string;
      notification_type?: string;
      channel?: string;
      title?: string;
      message?: string;
      payload?: Record<string, unknown>;
    };
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
    if (!title) {
      res.status(400).json({ error: "title_required" });
      return;
    }

    const channel = resolveChannel(body.channel, crew.email);
    const id = newEntityId("crew-notif");
    let sent = false;

    // Lever på e-post FØR persistering, så vi kan lagre korrekt status.
    if (channel === "email" && crew.email) {
      try {
        const result = await sendEmailImpl({
          to: crew.email,
          subject: title,
          html: `<p>Hei ${crew.name || ""},</p><p>${(body.message || title).replace(/</g, "&lt;")}</p>`,
          text: `Hei ${crew.name || ""},\n\n${body.message || title}`,
          kind: "crew_notification",
          projectId: crew.project_id,
          sentByUserId: userId,
          pool,
        });
        sent = Boolean(result?.sent);
      } catch (err) {
        console.warn("[crew-notif] e-post feilet:", (err as Error).message);
      }
    } else {
      sent = true; // in_app: regnes som «levert» (lesbar via getAll)
    }

    try {
      const r = await pool.query(
        `INSERT INTO role_room_crew_notifications
           (id, crew_id, project_id, event_id, notification_type, channel, title, message, payload, status, sent_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, CASE WHEN $11 THEN now() ELSE NULL END)
         RETURNING *`,
        [
          id,
          crew.id,
          body.project_id ?? crew.project_id,
          body.event_id ?? null,
          body.notification_type ?? "assignment",
          channel,
          title,
          body.message ?? null,
          JSON.stringify(body.payload ?? {}),
          sent ? "sent" : "pending",
          sent,
        ],
      );
      res.status(201).json({ notification: rowToNotification(r.rows[0]) });
    } catch (err) {
      console.error("[crew-notif] insert feilet:", (err as Error).message);
      res.status(500).json({ error: "create_failed" });
    }
  });

  // Marker lest.
  router.put("/notifications/:notificationId/read", requireAuth, async (req, res) => {
    const userId = (req as Request & { userId: string }).userId;
    const notifId = String(req.params.notificationId);
    const existing = await pool.query(
      `SELECT n.*, c.project_id AS crew_project_id
         FROM role_room_crew_notifications n
         JOIN casting_crew c ON c.id = n.crew_id
        WHERE n.id = $1`,
      [notifId],
    );
    const row = existing.rows[0];
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!(await canAccess(pool, userId, String(row.crew_project_id)))) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const updated = await pool.query(
      `UPDATE role_room_crew_notifications SET status = 'read', read_at = now() WHERE id = $1 RETURNING *`,
      [notifId],
    );
    res.json({ notification: rowToNotification(updated.rows[0]) });
  });

  return router;
}
