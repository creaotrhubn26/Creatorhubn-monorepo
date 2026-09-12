/**
 * admin-workspace-aggregator-routes.ts
 *
 * Workspace-bredte aggregator-endepunkter for AdminWorkspace (PR #828).
 * Bytter ut empty-states for «Dagens agenda» og «Kommende frister» i
 * AdminWorkspace høyre kolonne med live, sammenslåtte feeds på tvers
 * av eksisterende kilder.
 *
 * Endpoints (alle bak `requireAdminRoomAccess`):
 *
 *   GET /api/admin-room/workspace/today-agenda
 *     Aggregert dag-feed: alle meetings som starter i dag (Europe/Oslo),
 *     på tvers av alle prosjekter brukeren eier/har tilgang til.
 *     Sortert chronologisk.
 *
 *   GET /api/admin-room/workspace/upcoming-deadlines?days=14
 *     Aggregert deadline-feed: kommende frister fra ulike kilder
 *     (admin_funding_apps.deadline + admin_workspace_cases.due_date +
 *     fremtidige role_room_meetings) sammenslått og sortert.
 *     Default-vindu: 14 dager.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupAdminWorkspaceAggregatorRoutes } from "./admin-workspace-aggregator-routes";
 *
 *   setupAdminWorkspaceAggregatorRoutes({
 *     app, pool, requireAdminRoomAccess,
 *   });
 *
 * Multi-produkt: ingen filtrering — agenda + frister krysser produkter.
 * Brukeren ser alle uavhengig av aktivt produkt-tab. (Hvis vi ønsker
 * produkt-filter senere, legger vi `?product=`.)
 */

import type { AdminRoomRoutesDeps } from "./_shared";

// ─── typer som returneres til frontend ───────────────────────────
interface AgendaItem {
  id: string;
  source: "meeting";
  title: string;
  starts_at: string;      // ISO
  ends_at: string | null;
  time_zone: string;
  meet_link: string | null;
  project_id: string | null;
  status: string;         // upcoming | completed | cancelled
}

interface DeadlineItem {
  id: string;
  source: "funding_app" | "case" | "meeting";
  title: string;
  due_date: string;       // ISO date eller datetime
  product_key: string | null;  // role_room | leadgrid | null=intern
  priority: string | null;     // case only: low|normal|high|urgent
  status: string | null;
  link_path: string | null;    // hvor frontend kan navigere til
}

export function setupAdminWorkspaceAggregatorRoutes(
  deps: Pick<AdminRoomRoutesDeps, "app" | "pool" | "requireAdminRoomAccess">,
): void {
  const { app, pool, requireAdminRoomAccess } = deps;

  // ─── Dagens agenda ─────────────────────────────────────────────
  // Møter i dag (Europe/Oslo) på tvers av alle prosjekter brukeren
  // eier eller har tilgang til via casting_projects.
  app.get("/api/admin-room/workspace/today-agenda", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    try {
      // role_room_meetings.project_id → casting_projects.id (VARCHAR).
      // Vi viser møter som starter "i dag" i Europe/Oslo, uavhengig av
      // server-tz. Bruker AT TIME ZONE for trygg konvertering.
      const result = await pool.query<AgendaItem & { project_id: string | null }>(
        `SELECT
            m.id::text                                                 AS id,
            'meeting'::text                                            AS source,
            m.title                                                    AS title,
            m.starts_at                                                AS starts_at,
            m.ends_at                                                  AS ends_at,
            m.time_zone                                                AS time_zone,
            m.meet_link                                                AS meet_link,
            m.project_id::text                                         AS project_id,
            m.status                                                   AS status
           FROM role_room_meetings m
           LEFT JOIN casting_projects p ON p.id = m.project_id
          WHERE m.starts_at IS NOT NULL
            AND m.status = 'upcoming'
            AND (m.starts_at AT TIME ZONE 'Europe/Oslo')::date
                = (NOW() AT TIME ZONE 'Europe/Oslo')::date
            AND (
              p.user_id = $1
              OR EXISTS (
                SELECT 1 FROM casting_project_collaborators c
                 WHERE c.project_id = m.project_id AND c.user_id = $1
              )
            )
          ORDER BY m.starts_at ASC
          LIMIT 50`,
        [session.userId],
      );
      res.json({ items: result.rows });
    } catch (err) {
      // Hvis casting_project_collaborators ikke finnes (avhengig av
      // mig-rekkefølge), fallback til kun project-eier-filter.
      const msg = (err as Error).message;
      if (msg.includes("casting_project_collaborators")) {
        try {
          const fallback = await pool.query<AgendaItem>(
            `SELECT
                m.id::text AS id, 'meeting'::text AS source, m.title,
                m.starts_at, m.ends_at, m.time_zone, m.meet_link,
                m.project_id::text AS project_id, m.status
               FROM role_room_meetings m
               JOIN casting_projects p ON p.id = m.project_id
              WHERE m.starts_at IS NOT NULL
                AND m.status = 'upcoming'
                AND (m.starts_at AT TIME ZONE 'Europe/Oslo')::date
                    = (NOW() AT TIME ZONE 'Europe/Oslo')::date
                AND p.user_id = $1
              ORDER BY m.starts_at ASC
              LIMIT 50`,
            [session.userId],
          );
          res.json({ items: fallback.rows });
          return;
        } catch (innerErr) {
          console.error("[workspace/today-agenda] fallback failed", innerErr);
        }
      }
      console.error("[workspace/today-agenda] error", err);
      res.status(500).json({ error: "Kunne ikke hente dagens agenda" });
    }
  });

  // ─── Kommende frister ──────────────────────────────────────────
  // Aggregert deadline-feed fra 3 kilder, sortert chronologisk:
  //   1. admin_funding_apps.deadline (kun ikke-completed)
  //   2. admin_workspace_cases.due_date (kun open/in_progress/blocked)
  //   3. role_room_meetings.starts_at (kun upcoming, neste 14 dager)
  app.get("/api/admin-room/workspace/upcoming-deadlines", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const daysParam = Number(req.query.days ?? 14);
    const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 90
      ? Math.round(daysParam)
      : 14;

    try {
      // Bygg union av 3 kilder. Cases-tabellen kan mangle om mig 0336
      // ikke er kjørt — derfor try/catch.
      const items: DeadlineItem[] = [];

      // 1. Funding-app deadlines
      const fundingResult = await pool.query(
        `SELECT id::text, project_name AS title, deadline, status
           FROM admin_funding_apps
          WHERE user_id = $1
            AND deadline IS NOT NULL
            AND status NOT IN ('completed', 'submitted', 'rejected', 'withdrawn')
            AND deadline <= (CURRENT_DATE + ($2::int || ' days')::interval)
            AND deadline >= CURRENT_DATE
          ORDER BY deadline ASC
          LIMIT 30`,
        [session.userId, days],
      );
      for (const r of fundingResult.rows) {
        items.push({
          id: `funding:${r.id}`,
          source: "funding_app",
          title: r.title,
          due_date: typeof r.deadline === "string" ? r.deadline : r.deadline.toISOString().slice(0, 10),
          product_key: null,
          priority: null,
          status: r.status,
          link_path: `/admin-room?tab=funding&id=${r.id}`,
        });
      }

      // 2. Workspace-cases (kun hvis tabellen finnes)
      try {
        const caseResult = await pool.query(
          `SELECT id::text, title, due_date, status, priority, product_key
             FROM admin_workspace_cases
            WHERE user_id = $1
              AND due_date IS NOT NULL
              AND status IN ('open', 'in_progress', 'blocked')
              AND due_date <= (CURRENT_DATE + ($2::int || ' days')::interval)
              AND due_date >= CURRENT_DATE
            ORDER BY due_date ASC, priority DESC
            LIMIT 30`,
          [session.userId, days],
        );
        for (const r of caseResult.rows) {
          items.push({
            id: `case:${r.id}`,
            source: "case",
            title: r.title,
            due_date: typeof r.due_date === "string" ? r.due_date : r.due_date.toISOString().slice(0, 10),
            product_key: r.product_key ?? null,
            priority: r.priority,
            status: r.status,
            link_path: `/admin-workspace?sidebar=cases&caseId=${r.id}`,
          });
        }
      } catch (caseErr) {
        const msg = (caseErr as Error).message;
        if (!msg.includes("admin_workspace_cases")) {
          console.warn("[workspace/upcoming-deadlines] cases-query failed", msg);
        }
      }

      // 3. Kommende møter
      const meetingResult = await pool.query(
        `SELECT m.id::text, m.title, m.starts_at, m.status
           FROM role_room_meetings m
           JOIN casting_projects p ON p.id = m.project_id
          WHERE p.user_id = $1
            AND m.starts_at IS NOT NULL
            AND m.status = 'upcoming'
            AND m.starts_at <= (NOW() + ($2::int || ' days')::interval)
            AND m.starts_at >= NOW()
          ORDER BY m.starts_at ASC
          LIMIT 30`,
        [session.userId, days],
      );
      for (const r of meetingResult.rows) {
        items.push({
          id: `meeting:${r.id}`,
          source: "meeting",
          title: r.title,
          due_date: r.starts_at instanceof Date ? r.starts_at.toISOString() : String(r.starts_at),
          product_key: null,
          priority: null,
          status: r.status,
          link_path: null,
        });
      }

      // Slå sammen + sorter på due_date (string-sort fungerer fordi alle
      // er ISO 8601 — date eller datetime).
      items.sort((a, b) => a.due_date.localeCompare(b.due_date));

      res.json({ items, windowDays: days });
    } catch (err) {
      console.error("[workspace/upcoming-deadlines] error", err);
      res.status(500).json({ error: "Kunne ikke hente kommende frister" });
    }
  });
}
