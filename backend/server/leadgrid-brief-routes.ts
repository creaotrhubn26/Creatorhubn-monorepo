// leadgrid-brief-routes.ts
//
// Dørsalg brief-møter (mig 0398): salgssjef/teamleder samler teamet før
// felt. Dørsalg-selgere har ingen lead-møter — Møter-fanen deres drives
// av disse. Kun admin/salgssjef/teamleder kan opprette/slette; alle i
// org-en kan lese. Gjentakelse (none/daily/weekdays/weekly) ekspanderes
// til forekomster i klienten.
//
// Org-scoping: org-id deriveres ALLTID fra sesjonen (IDOR-linsen).

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";

const LEADER_ROLES = new Set(["admin", "salgssjef", "teamleder"]);
const RECURRENCES = new Set(["none", "daily", "weekdays", "weekly"]);

function isoNoMillis(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function registerLeadgridBriefRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}) {
  const { app, pool, requireUserSession } = deps;

  async function isLeader(orgId: string, userId: string): Promise<boolean> {
    try {
      const { role, permissions } = await resolveEffectivePermissions(pool, orgId, userId);
      return (role != null && LEADER_ROLES.has(role)) || permissions.has("meetings.manage");
    } catch {
      return false;
    }
  }

  // GET /api/leadgrid/brief-meetings — alle briefer for callerens org.
  app.get("/api/leadgrid/brief-meetings", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const r = await pool.query(
        `SELECT b.id, b.title, b.note, b.start_at, b.duration_min, b.recurrence,
                b.participants, b.created_by,
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
                         u.username) AS created_by_name
           FROM leadgrid_brief_meetings b
           LEFT JOIN users u ON u.id = b.created_by
          WHERE b.org_id = $1
          ORDER BY b.start_at ASC
          LIMIT 200`,
        [orgId],
      );
      const lederFlagg = await isLeader(orgId, session.userId);
      return res.json({
        canManage: lederFlagg,
        meetings: r.rows.map((row) => ({
          id: row.id as string,
          title: row.title as string,
          note: row.note as string,
          startAt: isoNoMillis(row.start_at as Date),
          durationMin: row.duration_min as number,
          recurrence: row.recurrence as string,
          participants: (row.participants ?? []) as string[],
          createdBy: row.created_by as string,
          createdByName: (row.created_by_name as string | null) ?? null,
        })),
      });
    } catch (err) {
      console.error("[leadgrid-brief] list feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /api/leadgrid/brief-meetings — opprett (kun leder-roller).
  app.post("/api/leadgrid/brief-meetings", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const b = (req.body ?? {}) as {
      title?: string;
      note?: string;
      startAt?: string;
      durationMin?: number;
      recurrence?: string;
      participants?: string[];
    };
    const title = String(b.title ?? "").trim();
    if (!title || title.length > 200) {
      return res.status(400).json({ error: "ugyldig_tittel" });
    }
    const startAt = new Date(String(b.startAt ?? ""));
    if (Number.isNaN(startAt.getTime())) {
      return res.status(400).json({ error: "ugyldig_starttid" });
    }
    const recurrence = String(b.recurrence ?? "none");
    if (!RECURRENCES.has(recurrence)) {
      return res.status(400).json({ error: "ugyldig_gjentakelse" });
    }
    const durationMin = Math.min(240, Math.max(5, Number(b.durationMin) || 15));
    const participants = Array.isArray(b.participants)
      ? b.participants.map((p) => String(p)).slice(0, 100)
      : [];
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      if (!(await isLeader(orgId, session.userId))) {
        return res.status(403).json({ error: "forbidden" });
      }
      const ins = await pool.query(
        `INSERT INTO leadgrid_brief_meetings
           (org_id, title, note, start_at, duration_min, recurrence,
            participants, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
         RETURNING id`,
        [
          orgId, title, String(b.note ?? "").slice(0, 2000),
          startAt.toISOString(), durationMin, recurrence,
          JSON.stringify(participants), session.userId,
        ],
      );
      const briefId = ins.rows[0]?.id as string;
      // Varsle inviterte (bjelle-innboksen) — best effort, aldri velt opprettelsen.
      const tid = startAt.toLocaleString("nb-NO", {
        weekday: "short", hour: "2-digit", minute: "2-digit",
        timeZone: "Europe/Oslo",
      });
      for (const uid of participants) {
        if (uid === session.userId) continue;
        try {
          await pool.query(
            `INSERT INTO notification_events
               (recipient_user_id, organization_id, event_type, title, body,
                triggered_by_user_id, deep_link, meta, email_sent)
             VALUES ($1, $2, 'brief_meeting_invite', $3, $4, $5, $6, $7::jsonb, FALSE)`,
            [
              uid, orgId,
              `Brief-møte: ${title}`,
              recurrence === "none"
                ? `Du er invitert — ${tid}.`
                : `Du er invitert — ${tid}, gjentas (${recurrence === "daily" ? "daglig" : recurrence === "weekdays" ? "hverdager" : "ukentlig"}).`,
              session.userId, "leadgrid://moter",
              JSON.stringify({ brief_id: briefId, recurrence }),
            ],
          );
        } catch (e) {
          console.warn("[leadgrid-brief] varsel feilet:", (e as Error).message);
        }
      }
      return res.json({ ok: true, id: briefId });
    } catch (err) {
      console.error("[leadgrid-brief] opprett feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // DELETE /api/leadgrid/brief-meetings/:id — oppretter eller leder.
  app.delete("/api/leadgrid/brief-meetings/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const id = String(req.params.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "ugyldig_id" });
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const own = await pool.query(
        `SELECT created_by FROM leadgrid_brief_meetings
          WHERE id = $1::uuid AND org_id = $2`,
        [id, orgId],
      );
      if (own.rows.length === 0) return res.status(404).json({ error: "not_found" });
      const erOppretter = own.rows[0].created_by === session.userId;
      if (!erOppretter && !(await isLeader(orgId, session.userId))) {
        return res.status(403).json({ error: "forbidden" });
      }
      await pool.query(
        `DELETE FROM leadgrid_brief_meetings WHERE id = $1::uuid AND org_id = $2`,
        [id, orgId],
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error("[leadgrid-brief] delete feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });
}
