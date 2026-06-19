/**
 * lead-assignment-routes.ts
 *
 * Hierarkisk lead-tildeling for Leadgrid:
 *
 *   Markedssjef → Teamleder → Salgskonsulent / Promotør
 *
 *   GET    /api/leadgrid/assignable-users?role=team_leader|salgskonsulent|promotor
 *   POST   /api/leadgrid/customers/:id/assign-team-leader
 *   POST   /api/leadgrid/customers/:id/assign-rep
 *   POST   /api/leadgrid/customers/:id/unassign
 *   GET    /api/leadgrid/customers/:id/assignment-history
 *   GET    /api/leadgrid/my-assignments   (mine tildelte leads)
 *
 * Role-policy:
 *   - assign-team-leader: kun markedssjef/salgssjef/admin/super_admin
 *   - assign-rep:        teamleder (sin egen lead) ELLER markedssjef+
 *   - unassign/reassign:  hierarki-respekterende (kan ikke unassigne over deg)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { app: Express; pool: Pool; activeSessions: Map<string, SessionData>; }

const MGMT_ROLES = ["super_admin", "admin", "owner", "markedssjef", "salgssjef"];
const TEAM_LEADER_ROLES = ["teamleder"];
const REP_ROLES = ["salgskonsulent", "promotor"];

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const t = (req as any).cookies?.sessionToken;
  return t ? sessions.get(t) ?? null : null;
}

async function getUserRole(pool: Pool, userId: string): Promise<{
  globalRole: string | null; orgRole: string | null; orgId: string | null;
}> {
  const u = await pool.query<{ role: string | null }>(
    `SELECT role FROM users WHERE id = $1`, [userId],
  );
  const m = await pool.query<{ organization_id: string; role: string }>(
    `SELECT organization_id::text, role FROM organization_members
      WHERE user_id = $1 ORDER BY role = 'owner' DESC LIMIT 1`,
    [userId],
  );
  return {
    globalRole: u.rows[0]?.role ?? null,
    orgRole: m.rows[0]?.role ?? null,
    orgId: m.rows[0]?.organization_id ?? null,
  };
}

function canAssignTeamLeader(globalRole: string | null, orgRole: string | null): boolean {
  return MGMT_ROLES.includes(globalRole ?? "") || MGMT_ROLES.includes(orgRole ?? "");
}

function canAssignRep(globalRole: string | null, orgRole: string | null): boolean {
  return MGMT_ROLES.includes(globalRole ?? "")
      || MGMT_ROLES.includes(orgRole ?? "")
      || TEAM_LEADER_ROLES.includes(orgRole ?? "");
}

async function logAssignment(pool: Pool, params: {
  customerId: string;
  organizationId: string;
  assignedByUserId: string;
  fromUserId: string | null;
  toUserId: string;
  reason: string;
  meta?: any;
}): Promise<void> {
  await pool.query(
    `INSERT INTO lead_assignment_log
       (lead_id, organization_id, from_user_id, to_user_id,
        assigned_by_user_id, reason, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [params.customerId, params.organizationId, params.fromUserId,
     params.toUserId, params.assignedByUserId, params.reason,
     JSON.stringify(params.meta ?? {})],
  ).catch((e) => console.warn("[lead-assignment] log-insert feilet", e));
}

export function registerLeadAssignmentRoutes({ app, pool, activeSessions }: Deps): void {

  // ============================================================
  // ASSIGNABLE USERS (med workload-info)
  // ============================================================
  app.get("/api/leadgrid/assignable-users", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const { orgRole, orgId, globalRole } = await getUserRole(pool, s.userId);
    if (!orgId) return res.status(403).json({ error: "Ikke i noen org" });

    const filterRole = (req.query.role as string) || "";
    const allowedRoles: string[] =
      filterRole === "team_leader" ? TEAM_LEADER_ROLES
      : filterRole === "rep" ? REP_ROLES
      : filterRole === "all" ? [...TEAM_LEADER_ROLES, ...REP_ROLES, ...MGMT_ROLES]
      : [...TEAM_LEADER_ROLES, ...REP_ROLES];

    const r = await pool.query(
      `SELECT om.user_id, om.role,
              u.first_name, u.last_name, u.email,
              u.profile_image_url,
              -- Workload: antall aktive tildelinger
              (SELECT COUNT(*) FROM crm_customers c
                WHERE c.assigned_user_id = om.user_id::text
                  AND c.status NOT IN ('won', 'lost', 'archived')) AS active_leads,
              (SELECT COUNT(*) FROM crm_customers c
                WHERE c.assigned_team_leader_id = om.user_id::text
                  AND c.status NOT IN ('won', 'lost', 'archived')) AS team_leader_leads,
              -- Sist heartbeat (online-status)
              u.last_seen_at::text
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
        WHERE om.organization_id = $1
          AND om.role = ANY($2::text[])
        ORDER BY u.first_name, u.last_name`,
      [orgId, allowedRoles],
    );

    res.json({
      users: r.rows.map((row) => ({
        user_id: row.user_id,
        role: row.role,
        full_name: [row.first_name, row.last_name].filter(Boolean).join(" "),
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        profile_image_url: row.profile_image_url,
        active_leads: Number(row.active_leads ?? 0),
        team_leader_leads: Number(row.team_leader_leads ?? 0),
        last_seen_at: row.last_seen_at,
        is_online: row.last_seen_at
          ? (Date.now() - new Date(row.last_seen_at).getTime()) < 90_000
          : false,
      })),
    });
  });

  // ============================================================
  // ASSIGN TEAM LEADER (markedssjef → teamleder)
  // ============================================================
  app.post("/api/leadgrid/customers/:id/assign-team-leader", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const { globalRole, orgRole, orgId } = await getUserRole(pool, s.userId);
    if (!canAssignTeamLeader(globalRole, orgRole)) {
      return res.status(403).json({ error: "Krever markedssjef-rolle eller høyere" });
    }

    const { team_leader_user_id, note } = req.body ?? {};
    if (!team_leader_user_id) return res.status(400).json({ error: "team_leader_user_id påkrevd" });

    // Verifiser at brukeren er teamleder i samme org
    const verify = await pool.query<{ role: string }>(
      `SELECT role FROM organization_members
        WHERE user_id = $1 AND organization_id = $2`,
      [team_leader_user_id, orgId],
    );
    if (!verify.rows[0] || !TEAM_LEADER_ROLES.includes(verify.rows[0].role)) {
      return res.status(400).json({ error: "Brukeren er ikke teamleder i din org" });
    }

    // Hent tidligere teamleder
    const prev = await pool.query<{ assigned_team_leader_id: string | null }>(
      `SELECT assigned_team_leader_id FROM crm_customers WHERE id = $1`,
      [req.params.id],
    );

    await pool.query(
      `UPDATE crm_customers SET
         assigned_team_leader_id = $1,
         assignment_note = COALESCE($2, assignment_note),
         assignment_chain = COALESCE(assignment_chain, '[]'::jsonb)
                            || jsonb_build_object(
                                 'type', 'team_leader',
                                 'user_id', $1,
                                 'by_user_id', $3,
                                 'at', now()::text,
                                 'note', $2
                               ),
         updated_at = now()
       WHERE id = $4`,
      [team_leader_user_id, note ?? null, s.userId, req.params.id],
    );

    await logAssignment(pool, {
      customerId: req.params.id,
      organizationId: orgId!,
      assignedByUserId: s.userId,
      fromUserId: prev.rows[0]?.assigned_team_leader_id ?? null,
      toUserId: team_leader_user_id,
      reason: note ?? "team_leader_assignment",
      meta: { type: "team_leader" },
    });

    // Intern notifikasjon
    try {
      const lead = await pool.query<{ name: string }>(
        `SELECT name FROM crm_customers WHERE id = $1`,
        [req.params.id],
      );
      await pool.query(
        `INSERT INTO notification_events (user_id, event_type, lead_id, message, created_at)
         VALUES ($1, 'lead_assigned_as_team_leader', $2::uuid, $3, now())`,
        [team_leader_user_id, req.params.id,
         `Du er nå teamleder for ${lead.rows[0]?.name ?? "en ny lead"}`],
      );
    } catch (e) { /* schema-variansjon — ikke avbryt */ }

    res.json({ ok: true });
  });

  // ============================================================
  // ASSIGN REP (teamleder → salgskonsulent/promotør)
  // ============================================================
  app.post("/api/leadgrid/customers/:id/assign-rep", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const { globalRole, orgRole, orgId } = await getUserRole(pool, s.userId);
    if (!canAssignRep(globalRole, orgRole)) {
      return res.status(403).json({ error: "Krever teamleder-rolle eller høyere" });
    }

    const { rep_user_id, note } = req.body ?? {};
    if (!rep_user_id) return res.status(400).json({ error: "rep_user_id påkrevd" });

    // Verifiser at brukeren er rep i samme org
    const verify = await pool.query<{ role: string }>(
      `SELECT role FROM organization_members
        WHERE user_id = $1 AND organization_id = $2`,
      [rep_user_id, orgId],
    );
    if (!verify.rows[0] || !REP_ROLES.includes(verify.rows[0].role)) {
      return res.status(400).json({ error: "Brukeren er ikke salgskonsulent/promotør i din org" });
    }

    // Hvis teamleder → må være tildelt selv som team_leader på denne lead-en
    if (orgRole === "teamleder") {
      const own = await pool.query<{ tl: string | null }>(
        `SELECT assigned_team_leader_id::text AS tl FROM crm_customers WHERE id = $1`,
        [req.params.id],
      );
      if (own.rows[0]?.tl !== s.userId) {
        return res.status(403).json({ error: "Du er ikke teamleder for denne leaden" });
      }
    }

    const prev = await pool.query<{ assigned_user_id: string | null }>(
      `SELECT assigned_user_id FROM crm_customers WHERE id = $1`,
      [req.params.id],
    );

    await pool.query(
      `UPDATE crm_customers SET
         assigned_user_id = $1,
         assigned_by_user_id = $2,
         assigned_at = now(),
         assignment_note = COALESCE($3, assignment_note),
         assignment_chain = COALESCE(assignment_chain, '[]'::jsonb)
                            || jsonb_build_object(
                                 'type', 'rep',
                                 'user_id', $1,
                                 'by_user_id', $2,
                                 'at', now()::text,
                                 'note', $3
                               ),
         updated_at = now()
       WHERE id = $4`,
      [rep_user_id, s.userId, note ?? null, req.params.id],
    );

    await logAssignment(pool, {
      customerId: req.params.id,
      organizationId: orgId!,
      assignedByUserId: s.userId,
      fromUserId: prev.rows[0]?.assigned_user_id ?? null,
      toUserId: rep_user_id,
      reason: note ?? "rep_assignment",
      meta: { type: "rep" },
    });

    try {
      const lead = await pool.query<{ name: string }>(
        `SELECT name FROM crm_customers WHERE id = $1`,
        [req.params.id],
      );
      await pool.query(
        `INSERT INTO notification_events (user_id, event_type, lead_id, message, created_at)
         VALUES ($1, 'lead_assigned_as_rep', $2::uuid, $3, now())`,
        [rep_user_id, req.params.id,
         `Du har fått tildelt en ny lead: ${lead.rows[0]?.name ?? "(uten navn)"}`],
      );
    } catch (e) { /* skip */ }

    res.json({ ok: true });
  });

  // ============================================================
  // UNASSIGN
  // ============================================================
  app.post("/api/leadgrid/customers/:id/unassign", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const { globalRole, orgRole, orgId } = await getUserRole(pool, s.userId);
    if (!canAssignRep(globalRole, orgRole)) {
      return res.status(403).json({ error: "Krever teamleder-rolle eller høyere" });
    }
    const { unassign_type } = req.body ?? {}; // 'rep' | 'team_leader' | 'all'
    const t = unassign_type ?? "rep";

    const prev = await pool.query<{
      assigned_user_id: string | null;
      assigned_team_leader_id: string | null;
    }>(
      `SELECT assigned_user_id, assigned_team_leader_id
         FROM crm_customers WHERE id = $1`,
      [req.params.id],
    );

    if (t === "rep" || t === "all") {
      await pool.query(
        `UPDATE crm_customers SET
           assigned_user_id = NULL, assigned_by_user_id = NULL, assigned_at = NULL,
           assignment_chain = COALESCE(assignment_chain, '[]'::jsonb)
                              || jsonb_build_object(
                                   'type', 'unassign_rep',
                                   'by_user_id', $1, 'at', now()::text
                                 ),
           updated_at = now()
         WHERE id = $2`, [s.userId, req.params.id],
      );
      if (prev.rows[0]?.assigned_user_id) {
        await logAssignment(pool, {
          customerId: req.params.id, organizationId: orgId!,
          assignedByUserId: s.userId, fromUserId: prev.rows[0].assigned_user_id,
          toUserId: "(unassigned)", reason: "unassign_rep",
        });
      }
    }
    if (t === "team_leader" || t === "all") {
      if (!canAssignTeamLeader(globalRole, orgRole)) {
        return res.status(403).json({ error: "Krever markedssjef for å fjerne teamleder" });
      }
      await pool.query(
        `UPDATE crm_customers SET
           assigned_team_leader_id = NULL,
           assignment_chain = COALESCE(assignment_chain, '[]'::jsonb)
                              || jsonb_build_object(
                                   'type', 'unassign_team_leader',
                                   'by_user_id', $1, 'at', now()::text
                                 ),
           updated_at = now()
         WHERE id = $2`, [s.userId, req.params.id],
      );
      if (prev.rows[0]?.assigned_team_leader_id) {
        await logAssignment(pool, {
          customerId: req.params.id, organizationId: orgId!,
          assignedByUserId: s.userId, fromUserId: prev.rows[0].assigned_team_leader_id,
          toUserId: "(unassigned)", reason: "unassign_team_leader",
        });
      }
    }
    res.json({ ok: true });
  });

  // ============================================================
  // ASSIGNMENT HISTORY
  // ============================================================
  app.get("/api/leadgrid/customers/:id/assignment-history", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const r = await pool.query(
      `SELECT l.id::text, l.from_user_id, l.to_user_id, l.assigned_by_user_id,
              l.reason, l.assigned_at::text, l.meta,
              fr.first_name AS from_first, fr.last_name AS from_last,
              to_.first_name AS to_first, to_.last_name AS to_last,
              by_.first_name AS by_first, by_.last_name AS by_last
         FROM lead_assignment_log l
         LEFT JOIN users fr  ON fr.id = l.from_user_id
         LEFT JOIN users to_ ON to_.id = l.to_user_id
         LEFT JOIN users by_ ON by_.id = l.assigned_by_user_id
        WHERE l.lead_id = $1
        ORDER BY l.assigned_at DESC LIMIT 50`,
      [req.params.id],
    );
    res.json({ history: r.rows });
  });

  // ============================================================
  // MINE ASSIGNMENTS — markerer også som "sett" når man åpner sin egen
  // ============================================================
  app.get("/api/leadgrid/my-assignments", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const { orgRole } = await getUserRole(pool, s.userId);

    const r = await pool.query(
      `SELECT c.id::text, c.name, c.email, c.phone, c.status,
              c.ai_opportunity_score, c.lead_category,
              c.assigned_at::text, c.assignment_note,
              c.team_leader_first_opened_at::text,
              c.team_leader_last_seen_at::text,
              c.rep_first_opened_at::text,
              c.rep_last_seen_at::text,
              c.last_action_at::text, c.last_action_type,
              p.name AS project_name
         FROM crm_customers c
         LEFT JOIN casting_projects p ON p.id = c.project_id
        WHERE c.assigned_user_id = $1
           OR c.assigned_team_leader_id = $1
        ORDER BY
          CASE c.lead_category WHEN 'hot' THEN 1 WHEN 'warm' THEN 2
                                WHEN 'cool' THEN 3 ELSE 4 END,
          c.assigned_at DESC NULLS LAST
        LIMIT 100`,
      [s.userId],
    );

    // Marker leads som "sett" når brukeren åpner sin liste —
    // setter team_leader_first_opened_at / rep_first_opened_at + sist sett.
    // Best-effort, ikke avbryt om noe feiler.
    try {
      const isTeamLeader = TEAM_LEADER_ROLES.includes(orgRole ?? "");
      const isRep = REP_ROLES.includes(orgRole ?? "");
      if (isTeamLeader) {
        await pool.query(
          `UPDATE crm_customers SET
             team_leader_first_opened_at = COALESCE(team_leader_first_opened_at, now()),
             team_leader_last_seen_at = now()
           WHERE assigned_team_leader_id = $1`,
          [s.userId],
        );
      }
      if (isRep) {
        await pool.query(
          `UPDATE crm_customers SET
             rep_first_opened_at = COALESCE(rep_first_opened_at, now()),
             rep_last_seen_at = now()
           WHERE assigned_user_id = $1`,
          [s.userId],
        );
      }
    } catch (e) { console.warn("[my-assignments] sett-tracking feilet", e); }

    res.json({ items: r.rows });
  });

  // ============================================================
  // MARK SEEN — eksplisitt registrering av at en lead ble åpnet
  // ============================================================
  app.post("/api/leadgrid/customers/:id/mark-seen", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const { orgRole } = await getUserRole(pool, s.userId);

    const isTeamLeader = TEAM_LEADER_ROLES.includes(orgRole ?? "");
    const isRep = REP_ROLES.includes(orgRole ?? "");

    // Sjekk at brukeren faktisk er tildelt
    const r = await pool.query<{
      assigned_team_leader_id: string | null; assigned_user_id: string | null;
    }>(
      `SELECT assigned_team_leader_id, assigned_user_id FROM crm_customers WHERE id = $1`,
      [req.params.id],
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: "Ikke funnet" });

    if (isTeamLeader && row.assigned_team_leader_id === s.userId) {
      await pool.query(
        `UPDATE crm_customers SET
           team_leader_first_opened_at = COALESCE(team_leader_first_opened_at, now()),
           team_leader_last_seen_at = now()
         WHERE id = $1`,
        [req.params.id],
      );
    }
    if (isRep && row.assigned_user_id === s.userId) {
      await pool.query(
        `UPDATE crm_customers SET
           rep_first_opened_at = COALESCE(rep_first_opened_at, now()),
           rep_last_seen_at = now()
         WHERE id = $1`,
        [req.params.id],
      );
    }

    await pool.query(
      `INSERT INTO crm_customer_view_log (customer_id, viewer_user_id, viewer_role)
       VALUES ($1, $2, $3)`,
      [req.params.id, s.userId, orgRole ?? null],
    );

    res.json({ ok: true });
  });

  // ============================================================
  // ASSIGNMENT STATUS — markedssjef vil se om mottakeren har sett
  // ============================================================
  app.get("/api/leadgrid/customers/:id/assignment-status", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });

    const r = await pool.query(
      `SELECT c.id::text,
              c.assigned_team_leader_id, c.assigned_user_id,
              c.team_leader_first_opened_at::text,
              c.team_leader_last_seen_at::text,
              c.rep_first_opened_at::text,
              c.rep_last_seen_at::text,
              c.assigned_at::text,
              c.last_action_at::text, c.last_action_type,
              tl.first_name AS tl_first, tl.last_name AS tl_last,
              tl.profile_image_url AS tl_avatar, tl.last_seen_at::text AS tl_last_online,
              rep.first_name AS rep_first, rep.last_name AS rep_last,
              rep.profile_image_url AS rep_avatar, rep.last_seen_at::text AS rep_last_online
         FROM crm_customers c
         LEFT JOIN users tl  ON tl.id = c.assigned_team_leader_id
         LEFT JOIN users rep ON rep.id = c.assigned_user_id
        WHERE c.id = $1`,
      [req.params.id],
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Ikke funnet" });
    res.json(r.rows[0]);
  });
}
