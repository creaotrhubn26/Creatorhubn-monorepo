/**
 * role-room-project-meetings-routes.ts
 *
 * The Role Room prosjektrom-møtenotater (egen feature, prosjekt-scoped).
 * Tittel, dato, deltakere, agenda og handlingspunkter. CRUD. Eier
 * role_room_project_meeting (mig 288).
 *
 *   GET    /api/role-room/projects/:projectId/meetings
 *   POST   /api/role-room/projects/:projectId/meetings
 *   PATCH  /api/role-room/meetings/:id
 *   DELETE /api/role-room/meetings/:id
 */

import type express from "express";
import type { Pool } from "pg";

interface SessionLike { userId: string; email?: string; name?: string }

export interface RoleRoomProjectMeetingsRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

interface ActionItem { text: string; owner: string | null; done: boolean }

interface MeetingRow {
  id: string;
  project_id: string;
  title: string;
  meeting_date: string | null;
  participants: string[];
  agenda: string[];
  action_items: ActionItem[];
  created_at: string;
  updated_at: string;
}

function strArr(raw: unknown): string[] {
  const a = Array.isArray(raw) ? raw : typeof raw === "string" ? safeJson(raw) : [];
  return a.filter((x): x is string => typeof x === "string");
}
function safeJson(s: string): any[] { try { const p = JSON.parse(s); return Array.isArray(p) ? p : []; } catch { return []; } }
function actionArr(raw: unknown): ActionItem[] {
  const a = Array.isArray(raw) ? raw : typeof raw === "string" ? safeJson(raw) : [];
  return a.filter((x) => x && typeof x === "object").map((x: any) => ({
    text: typeof x.text === "string" ? x.text : "",
    owner: typeof x.owner === "string" && x.owner.trim() ? x.owner : null,
    done: Boolean(x.done),
  })).filter((x) => x.text);
}

function mapRow(r: Record<string, unknown>): MeetingRow {
  return {
    id: String(r.id),
    project_id: String(r.project_id),
    title: String(r.title ?? "Møte"),
    meeting_date: r.meeting_date == null ? null : (r.meeting_date instanceof Date ? r.meeting_date.toISOString().slice(0, 10) : String(r.meeting_date)),
    participants: strArr(r.participants),
    agenda: strArr(r.agenda),
    action_items: actionArr(r.action_items),
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

function parseBody(body: Record<string, unknown>): { title: string; meetingDate: string | null; participants: string[]; agenda: string[]; actionItems: ActionItem[] } {
  return {
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 200) : "Møte",
    meetingDate: typeof body.meetingDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.meetingDate) ? body.meetingDate : null,
    participants: strArr(body.participants).map((s) => s.slice(0, 120)).slice(0, 30),
    agenda: strArr(body.agenda).map((s) => s.slice(0, 400)).slice(0, 50),
    actionItems: actionArr(body.actionItems).map((a) => ({ text: a.text.slice(0, 400), owner: a.owner ? a.owner.slice(0, 120) : null, done: a.done })).slice(0, 50),
  };
}

export function setupRoleRoomProjectMeetingsRoutes(deps: RoleRoomProjectMeetingsRoutesDeps): void {
  const { app, pool, getActiveSession } = deps;

  app.get("/api/role-room/projects/:projectId/meetings", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const r = await pool.query(
        `SELECT * FROM role_room_project_meeting WHERE project_id = $1 ORDER BY meeting_date DESC NULLS LAST, created_at DESC LIMIT 200`,
        [req.params.projectId],
      );
      return res.json({ meetings: r.rows.map(mapRow) });
    } catch (err) {
      console.error("[meetings GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente møter" });
    }
  });

  app.post("/api/role-room/projects/:projectId/meetings", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const b = parseBody((req.body || {}) as Record<string, unknown>);
    try {
      const r = await pool.query(
        `INSERT INTO role_room_project_meeting
           (project_id, owner_user_id, title, meeting_date, participants, agenda, action_items)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)
         RETURNING *`,
        [req.params.projectId, session.userId, b.title, b.meetingDate, JSON.stringify(b.participants), JSON.stringify(b.agenda), JSON.stringify(b.actionItems)],
      );
      return res.json({ meeting: mapRow(r.rows[0]) });
    } catch (err) {
      console.error("[meetings POST] failed", err);
      return res.status(500).json({ error: "Klarte ikke å lagre møte" });
    }
  });

  app.patch("/api/role-room/meetings/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const b = parseBody((req.body || {}) as Record<string, unknown>);
    try {
      const r = await pool.query(
        `UPDATE role_room_project_meeting
            SET title = $2, meeting_date = $3, participants = $4::jsonb, agenda = $5::jsonb, action_items = $6::jsonb, updated_at = now()
          WHERE id = $1 RETURNING *`,
        [req.params.id, b.title, b.meetingDate, JSON.stringify(b.participants), JSON.stringify(b.agenda), JSON.stringify(b.actionItems)],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      return res.json({ meeting: mapRow(r.rows[0]) });
    } catch (err) {
      console.error("[meetings PATCH] failed", err);
      return res.status(500).json({ error: "Klarte ikke å oppdatere møte" });
    }
  });

  app.delete("/api/role-room/meetings/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const r = await pool.query(`DELETE FROM role_room_project_meeting WHERE id = $1`, [req.params.id]);
      return res.json({ deleted: r.rowCount ?? 0 });
    } catch (err) {
      console.error("[meetings DELETE] failed", err);
      return res.status(500).json({ error: "Klarte ikke å slette møte" });
    }
  });
}
