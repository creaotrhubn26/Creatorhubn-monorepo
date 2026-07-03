/**
 * leadgrid-sales-teams-routes.ts
 *
 * Backend for team-oppsettet (LeadgridSalesTeamStore på iPad) og
 * lead-tildelinger (AssignToTeamMemberSheet) — flytter begge fra
 * enhets-lokal UserDefaults til delt org-tilstand.
 *
 * Prefix: /api/leadgrid/*
 *
 * Endepunkter (6):
 *   GET    /sales-teams                → { teams: [...] }
 *   PUT    /sales-teams/:id            → upsert (klient-generert id)
 *   DELETE /sales-teams/:id
 *   GET    /lead-assignments?box=inbox|sent&status=
 *   POST   /lead-assignments           → opprett + in-app varsel til mottaker
 *   PATCH  /lead-assignments/:id       → status-overgang (seen/accepted/…)
 *
 * Forutsetter mig 0361 (leadgrid_sales_teams + leadgrid_lead_assignments).
 *
 * Auth: samme mønster som sales-leadership-routes.ts — requireUserSession
 * + resolveOrgIdForUser (enterprise-org, fallback userId i solo-modus).
 * JSON-feltnavn er snake_case (matcher team-members-endepunktet og iPad-ens
 * _sharedEncoder/-Decoder som konverterer til/fra snake_case) slik at
 * `LeadgridSalesTeam` kan brukes direkte som Codable-payload.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export interface SalesTeamsRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
}

/** Samme org-oppslag som sales-leadership-routes.ts (modul-privat der). */
async function resolveOrgIdForUser(
  pool: Pool,
  userId: string,
): Promise<string> {
  try {
    const r = await pool.query<{ organization_id: string }>(
      `SELECT organization_id
         FROM enterprise_team_members
        WHERE user_id = $1 AND status = 'active'
        ORDER BY joined_at DESC NULLS LAST
        LIMIT 1`,
      [userId],
    );
    const orgId = r.rows[0]?.organization_id;
    if (orgId) return String(orgId);
  } catch {
    // Tabell mangler eller spørring feilet — fall til userId-modell.
  }
  return userId;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const ROLES = new Set(["seller", "promoter", "manager"]);
const PRIORITIES = new Set(["normal", "high", "urgent"]);
const STATUSES = new Set(["sent", "seen", "accepted", "completed", "cancelled"]);

function mapTeamRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    color_hex: String(row.color_hex ?? "#a852fc"),
    leader_id: row.leader_user_id ?? null,
    member_ids: Array.isArray(row.member_user_ids) ? row.member_user_ids : [],
    area_center_lat: row.area_center_lat !== null && row.area_center_lat !== undefined ? Number(row.area_center_lat) : null,
    area_center_lng: row.area_center_lng !== null && row.area_center_lng !== undefined ? Number(row.area_center_lng) : null,
    area_radius_km: row.area_radius_km !== null && row.area_radius_km !== undefined ? Number(row.area_radius_km) : null,
  };
}

function mapAssignmentRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(row.id),
    lead_id: row.lead_id ?? null,
    lead_name: String(row.lead_name ?? ""),
    lead_lat: row.lead_lat !== null && row.lead_lat !== undefined ? Number(row.lead_lat) : null,
    lead_lng: row.lead_lng !== null && row.lead_lng !== undefined ? Number(row.lead_lng) : null,
    assignee_user_id: String(row.assignee_user_id),
    assigned_by_user_id: row.assigned_by_user_id ?? null,
    assignee_role: String(row.assignee_role ?? "seller"),
    priority: String(row.priority ?? "normal"),
    message: String(row.message ?? ""),
    status: String(row.status ?? "sent"),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

export function registerLeadgridSalesTeamsRoutes(deps: SalesTeamsRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  // ───────────────────────────────────────────────────────────────
  // SALES TEAMS
  // ───────────────────────────────────────────────────────────────

  app.get("/api/leadgrid/sales-teams", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    try {
      const r = await pool.query(
        `SELECT * FROM leadgrid_sales_teams
          WHERE organization_id = $1
          ORDER BY LOWER(name) ASC`,
        [orgId],
      );
      return res.json({ teams: r.rows.map(mapTeamRow) });
    } catch (err) {
      console.error("[sales-teams] GET failed:", err);
      return res.status(500).json({ error: "sales_teams_failed", detail: String((err as Error).message) });
    }
  });

  app.put("/api/leadgrid/sales-teams/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const id = String(req.params.id ?? "").trim();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const colorHex = typeof body.color_hex === "string" && HEX_RE.test(body.color_hex)
      ? body.color_hex
      : "#a852fc";
    const leaderId = typeof body.leader_id === "string" && body.leader_id ? body.leader_id : null;
    const memberIds = Array.isArray(body.member_ids)
      ? body.member_ids.filter((m): m is string => typeof m === "string").slice(0, 200)
      : [];
    const lat = typeof body.area_center_lat === "number" ? body.area_center_lat : null;
    const lng = typeof body.area_center_lng === "number" ? body.area_center_lng : null;
    const radius = typeof body.area_radius_km === "number" ? body.area_radius_km : null;

    if (!id || id.length > 120) return res.status(400).json({ error: "ugyldig_id" });
    if (!name || name.length > 120) return res.status(400).json({ error: "ugyldig_navn" });

    try {
      // leader_user_id har FK til users — dropp verdien stille hvis
      // brukeren ikke finnes (seed-data bruker fiktive ids som "u-sofie").
      let safeLeaderId: string | null = leaderId;
      if (safeLeaderId) {
        const u = await pool.query(`SELECT 1 FROM users WHERE id = $1`, [safeLeaderId]);
        if (u.rowCount === 0) safeLeaderId = null;
      }
      const r = await pool.query(
        `INSERT INTO leadgrid_sales_teams
           (organization_id, id, name, color_hex, leader_user_id,
            member_user_ids, area_center_lat, area_center_lng, area_radius_km,
            created_by)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
         ON CONFLICT (organization_id, id) DO UPDATE SET
           name = EXCLUDED.name,
           color_hex = EXCLUDED.color_hex,
           leader_user_id = EXCLUDED.leader_user_id,
           member_user_ids = EXCLUDED.member_user_ids,
           area_center_lat = EXCLUDED.area_center_lat,
           area_center_lng = EXCLUDED.area_center_lng,
           area_radius_km = EXCLUDED.area_radius_km,
           updated_at = NOW()
         RETURNING *`,
        [orgId, id, name, colorHex, safeLeaderId, JSON.stringify(memberIds), lat, lng, radius, session.userId],
      );
      return res.json({ team: mapTeamRow(r.rows[0]) });
    } catch (err) {
      console.error("[sales-teams] PUT failed:", err);
      return res.status(500).json({ error: "sales_team_upsert_failed", detail: String((err as Error).message) });
    }
  });

  app.delete("/api/leadgrid/sales-teams/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    try {
      await pool.query(
        `DELETE FROM leadgrid_sales_teams WHERE organization_id = $1 AND id = $2`,
        [orgId, String(req.params.id ?? "")],
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error("[sales-teams] DELETE failed:", err);
      return res.status(500).json({ error: "sales_team_delete_failed", detail: String((err as Error).message) });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // LEAD ASSIGNMENTS
  // ───────────────────────────────────────────────────────────────

  app.get("/api/leadgrid/lead-assignments", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    // box=inbox → oppdrag TIL meg; box=sent → oppdrag FRA meg; default org-alle.
    const box = String(req.query.box ?? "");
    const status = String(req.query.status ?? "");
    const conds: string[] = ["organization_id = $1"];
    const params: unknown[] = [orgId];
    if (box === "inbox") {
      params.push(session.userId);
      conds.push(`assignee_user_id = $${params.length}`);
    } else if (box === "sent") {
      params.push(session.userId);
      conds.push(`assigned_by_user_id = $${params.length}`);
    }
    if (status && STATUSES.has(status)) {
      params.push(status);
      conds.push(`status = $${params.length}`);
    }
    try {
      const r = await pool.query(
        `SELECT * FROM leadgrid_lead_assignments
          WHERE ${conds.join(" AND ")}
          ORDER BY created_at DESC
          LIMIT 200`,
        params,
      );
      return res.json({ assignments: r.rows.map(mapAssignmentRow) });
    } catch (err) {
      console.error("[lead-assignments] GET failed:", err);
      return res.status(500).json({ error: "assignments_failed", detail: String((err as Error).message) });
    }
  });

  app.post("/api/leadgrid/lead-assignments", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const leadId = typeof body.lead_id === "string" && /^[0-9a-f-]{36}$/i.test(body.lead_id) ? body.lead_id : null;
    const leadName = typeof body.lead_name === "string" ? body.lead_name.trim().slice(0, 200) : "";
    const leadLat = typeof body.lead_lat === "number" ? body.lead_lat : null;
    const leadLng = typeof body.lead_lng === "number" ? body.lead_lng : null;
    const assigneeUserId = typeof body.assignee_user_id === "string" ? body.assignee_user_id : "";
    const assigneeRole = typeof body.assignee_role === "string" && ROLES.has(body.assignee_role)
      ? body.assignee_role : "seller";
    const priority = typeof body.priority === "string" && PRIORITIES.has(body.priority)
      ? body.priority : "normal";
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";

    if (!leadName) return res.status(400).json({ error: "mangler_lead_name" });
    if (!assigneeUserId) return res.status(400).json({ error: "mangler_assignee" });

    try {
      const r = await pool.query(
        `INSERT INTO leadgrid_lead_assignments
           (organization_id, lead_id, lead_name, lead_lat, lead_lng,
            assignee_user_id, assigned_by_user_id, assignee_role, priority, message)
         VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [orgId, leadId, leadName, leadLat, leadLng,
         assigneeUserId, session.userId, assigneeRole, priority, message],
      );
      const assignment = mapAssignmentRow(r.rows[0]);

      // In-app varsel til mottakeren (best-effort — samme mønster som
      // notifyAwardStatusChange i sales-leadership-routes.ts).
      try {
        const prioLabel = priority === "urgent" ? "HASTER" : priority === "high" ? "Høy prioritet" : "Nytt oppdrag";
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, priority, action_url, action_text, metadata)
           VALUES ($1, 'lead_assignment', $2, $3, $4, '/leadgrid', 'Se oppdrag', $5::jsonb)`,
          [
            assigneeUserId,
            `${prioLabel}: ${leadName}`,
            message || `${session.name || "Salgssjef"} sendte deg til ${leadName}.`,
            priority === "urgent" ? "high" : "normal",
            JSON.stringify({ assignmentId: assignment.id, leadName, leadLat, leadLng }),
          ],
        );
      } catch (err) {
        console.warn("[lead-assignments] varsel feilet:", (err as Error).message);
      }

      return res.status(201).json({ assignment });
    } catch (err) {
      console.error("[lead-assignments] POST failed:", err);
      return res.status(500).json({ error: "assignment_create_failed", detail: String((err as Error).message) });
    }
  });

  app.patch("/api/leadgrid/lead-assignments/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const status = String((req.body ?? {}).status ?? "");
    if (!STATUSES.has(status)) return res.status(400).json({ error: "ugyldig_status" });
    try {
      const r = await pool.query(
        `UPDATE leadgrid_lead_assignments
            SET status = $1, updated_at = NOW()
          WHERE id = $2::uuid AND organization_id = $3
            AND (assignee_user_id = $4 OR assigned_by_user_id = $4)
          RETURNING *`,
        [status, String(req.params.id ?? ""), orgId, session.userId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "ikke_funnet" });
      return res.json({ assignment: mapAssignmentRow(r.rows[0]) });
    } catch (err) {
      console.error("[lead-assignments] PATCH failed:", err);
      return res.status(500).json({ error: "assignment_update_failed", detail: String((err as Error).message) });
    }
  });
}
