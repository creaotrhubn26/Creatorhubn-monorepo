/**
 * project-notifications-routes.ts — innboks og prosjektaktivitet.
 *
 * Egen sti-familie (`/api/project-notifications`) med vilje: `/api/notifications/*`
 * eies allerede av `admin-notifications-routes.ts` (kringkastingsinnboksen bak
 * `UserNotificationModal`), og de to skal ikke slåss om samme prefiks.
 *
 * Tilgang: innboksrutene er per bruker og gates av sesjonen alene — du får
 * bare rader der du selv står som mottaker, og mottakerlista ble avgjort mot
 * prosjektteamet da varselet ble skrevet. Prosjektruta gates som naboene sine,
 * med `canAccessProject`.
 */

import type express from "express";
import type { Pool } from "pg";
import { canAccessProject } from "./project-team-routes";
import {
  listProjectActivity,
  listUserInbox,
  markAllNotificationsRead,
  markNotificationRead,
  sweepDueSoonDeliverables,
} from "./project-notifications";

export interface ProjectNotificationRoutesDeps {
  app: express.Express;
  pool: Pool;
  /** Samme synkrone sesjonsvakt som naborutene bruker. */
  requireUserSession: (
    req: any,
    res: any,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

export function setupProjectNotificationRoutes(
  deps: ProjectNotificationRoutesDeps,
): void {
  const { app, pool, requireUserSession } = deps;

  /** Bjella: mine varsler på tvers av prosjekter + ulest-teller. */
  app.get("/api/project-notifications", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const { notifications, unreadCount } = await listUserInbox(
        pool,
        session.userId,
        {
          limit: Number(req.query.limit ?? 30),
          unreadOnly: req.query.unreadOnly === "true",
        },
      );
      res.json({ notifications, unreadCount });
    } catch (error) {
      console.error("GET /api/project-notifications", error);
      res.status(500).json({ error: "failed" });
    }
  });

  app.post("/api/project-notifications/read-all", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const updated = await markAllNotificationsRead(pool, session.userId);
      res.json({ success: true, updated });
    } catch (error) {
      console.error("POST /api/project-notifications/read-all", error);
      res.status(500).json({ error: "failed" });
    }
  });

  app.post("/api/project-notifications/:id/read", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      // Ingen 404 når raden allerede var lest: å merke noe lest to ganger er
      // ikke en feil, og klienten skal ikke måtte skille de to tilfellene.
      const changed = await markNotificationRead(
        pool,
        session.userId,
        String(req.params.id),
      );
      res.json({ success: true, changed });
    } catch (error) {
      console.error("POST /api/project-notifications/:id/read", error);
      res.status(500).json({ error: "failed" });
    }
  });

  /** Nylig aktivitet i prosjektet — de samme radene, hele teamets. */
  app.get("/api/projects/:projectId/notifications", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const projectId = String(req.params.projectId ?? "").trim();
    if (!projectId) return res.status(400).json({ error: "missing_project_id" });
    if (!(await canAccessProject(pool, session.userId, projectId))) {
      return res.status(403).json({ error: "no_access" });
    }
    try {
      await sweepDueSoonDeliverables(pool, projectId);
      const activity = await listProjectActivity(pool, projectId, {
        limit: Number(req.query.limit ?? 30),
      });
      res.json({ activity });
    } catch (error) {
      console.error("GET /api/projects/:projectId/notifications", error);
      res.status(500).json({ error: "failed" });
    }
  });
}
