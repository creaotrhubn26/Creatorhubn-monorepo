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
 *   - assign-rep:        teamleder eller markedssjef+ med prosjekttilgang
 *   - unassign/reassign:  rollehierarki + eksplisitt prosjekttilgang
 */

import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { notifyAssignment } from "./lead-assignment-notification-service.js";
import {
  loadAccessibleLeadgridProject,
  type LeadgridAccessibleProject,
} from "./leadgrid-project-access.js";
import {
  loadAccessibleLeadgridLead,
} from "./leadgrid-lead-access.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { app: Express; pool: Pool; activeSessions: Map<string, SessionData>; }

const MGMT_ROLES = ["super_admin", "admin", "owner", "markedssjef", "salgssjef"];
const TEAM_LEADER_ROLES = ["teamleder"];
const REP_ROLES = ["salgskonsulent", "promotor"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const t = (req as any).cookies?.sessionToken;
  return t ? sessions.get(t) ?? null : null;
}

function requestedOrganizationId(req: Request): string | null {
  const queryValue = Array.isArray(req.query.organization_id)
    ? req.query.organization_id[0]
    : req.query.organization_id;
  const raw = typeof queryValue === "string"
    ? queryValue
    : req.get("X-Leadgrid-Organization-Id");
  const value = raw?.trim() ?? "";
  return UUID_PATTERN.test(value) ? value : null;
}

async function getUserRoleForOrganization(
  pool: Pick<Pool, "query">,
  userId: string,
  organizationId: string,
): Promise<{
  globalRole: string | null; orgRole: string | null;
}> {
  const u = await pool.query<{ role: string | null }>(
    `SELECT role FROM users WHERE id = $1`, [userId],
  );
  const m = await pool.query<{ role: string }>(
    `SELECT role FROM organization_members
      WHERE user_id = $1 AND organization_id = $2::uuid LIMIT 1`,
    [userId, organizationId],
  );
  return {
    globalRole: u.rows[0]?.role ?? null,
    orgRole: m.rows[0]?.role ?? null,
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

async function logAssignment(pool: Pick<Pool, "query">, params: {
  customerId: string;
  organizationId: string;
  assignedByUserId: string;
  fromUserId: string | null;
  toUserId: string | null;
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
  );
}

function requestedProjectId(req: Request): string | null {
  const raw = req.query.projectId ?? req.query.project_id;
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value && value.length <= 255 ? value : null;
}

function requestedLeadId(req: Request): string | null {
  const raw = req.query.leadId ?? req.query.lead_id;
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return UUID_PATTERN.test(value) ? value : null;
}

async function loadAssignmentProject(
  pool: Pool,
  req: Request,
  userId: string,
): Promise<LeadgridAccessibleProject | null> {
  const hasLeadSelector =
    req.query.leadId !== undefined || req.query.lead_id !== undefined;
  const leadId = requestedLeadId(req);
  if (hasLeadSelector) {
    if (!leadId) return null;
    const lead = await loadAccessibleLeadgridLead(pool, { leadId, userId });
    if (!lead) return null;
    const project = await loadAccessibleLeadgridProject(
      pool,
      lead.projectId,
      userId,
    );
    const hasProjectSelector =
      req.query.projectId !== undefined || req.query.project_id !== undefined;
    const selectedProjectId = requestedProjectId(req);
    if (
      !project ||
      (hasProjectSelector && selectedProjectId === null) ||
      (selectedProjectId !== null && selectedProjectId !== project.id)
    ) {
      return null;
    }
    return project;
  }
  const projectId = requestedProjectId(req);
  return projectId
    ? loadAccessibleLeadgridProject(pool, projectId, userId)
    : null;
}

async function loadTargetProjectRoles(
  pool: Pool,
  project: LeadgridAccessibleProject,
  userId: string,
): Promise<string[] | null> {
  const targetProject = await loadAccessibleLeadgridProject(pool, project.id, userId);
  if (
    !targetProject ||
    targetProject.id !== project.id ||
    targetProject.organizationId !== project.organizationId
  ) {
    return null;
  }
  const role = await getUserRoleForOrganization(pool, userId, project.organizationId);
  return Array.from(new Set(
    [role.orgRole, targetProject.memberRole].filter(
      (value): value is string => Boolean(value),
    ),
  ));
}

async function beginTransaction(pool: Pool): Promise<PoolClient> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    return client;
  } catch (error) {
    client.release();
    throw error;
  }
}

export function registerLeadAssignmentRoutes({ app, pool, activeSessions }: Deps): void {

  // ============================================================
  // ASSIGNABLE USERS (med workload-info)
  // ============================================================
  app.get("/api/leadgrid/assignable-users", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });

    const filterRole = (req.query.role as string) || "";
    const allowedRoles: string[] =
      filterRole === "team_leader" ? TEAM_LEADER_ROLES
      : filterRole === "rep" ? REP_ROLES
      : filterRole === "all" ? [...TEAM_LEADER_ROLES, ...REP_ROLES, ...MGMT_ROLES]
      : [...TEAM_LEADER_ROLES, ...REP_ROLES];

    try {
    const hasScopeSelector =
      typeof (req.query.leadId ?? req.query.lead_id) === "string" ||
      typeof (req.query.projectId ?? req.query.project_id) === "string";
    if (!hasScopeSelector) {
      return res.status(400).json({ error: "leadId_eller_projectId_pakrevd" });
    }
    const project = await loadAssignmentProject(pool, req, s.userId);
    if (!project) return res.status(404).json({ error: "Ikke funnet" });

    const r = await pool.query(
      `SELECT om.user_id, om.role,
              u.first_name, u.last_name, u.email,
              u.profile_image_url,
              -- Workload er kun for samme prosjekt. Ellers ville en travel
              -- bruker i et annet kundeprosjekt bli feilrangert her.
              (SELECT COUNT(*) FROM crm_customers c
                WHERE c.assigned_user_id = om.user_id::text
                  AND c.organization_id = $1::uuid
                  AND c.project_id = $3
                  AND c.status NOT IN ('won', 'lost', 'archived')) AS active_leads,
              (SELECT COUNT(*) FROM crm_customers c
                WHERE c.assigned_team_leader_id = om.user_id::text
                  AND c.organization_id = $1::uuid
                  AND c.project_id = $3
                  AND c.status NOT IN ('won', 'lost', 'archived')) AS team_leader_leads,
              -- Sist heartbeat (online-status) — fra user_presence.
              -- 🔴 up.user_id (uuid) = u.id (varchar) kastet «operator does
              -- not exist: uuid = character varying» → uten try/catch hang
              -- Express → «Tildel til teammedlem»-arket lastet ALDRI
              -- (Notification-QA 2026-07-07). Cast u.id::uuid.
              up.last_seen_at::text
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
         LEFT JOIN user_presence up ON up.user_id = u.id::uuid
        WHERE om.organization_id = $1
          AND om.role = ANY($2::text[])
        ORDER BY u.first_name, u.last_name`,
      [project.organizationId, allowedRoles, project.id],
    );

    const visibleRows = (
      await Promise.all(r.rows.map(async (row) => {
        const targetProject = await loadAccessibleLeadgridProject(
          pool,
          project.id,
          String(row.user_id),
        );
        return targetProject?.organizationId === project.organizationId
          ? row
          : null;
      }))
    ).filter((row): row is NonNullable<typeof row> => row !== null);

    res.json({
      users: visibleRows.map((row) => ({
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
    } catch (e) {
      console.error("[leadgrid] assignable-users feilet", e);
      res.status(500).json({ error: "Kunne ikke hente tildelbare brukere" });
    }
  });

  // ============================================================
  // ASSIGN TEAM LEADER (markedssjef → teamleder)
  // ============================================================
  app.post("/api/leadgrid/customers/:id/assign-team-leader", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const teamLeaderUserId =
      typeof req.body?.team_leader_user_id === "string"
        ? req.body.team_leader_user_id.trim()
        : "";
    const note = typeof req.body?.note === "string"
      ? req.body.note.trim().slice(0, 4_000) || null
      : null;
    if (!teamLeaderUserId) {
      return res.status(400).json({ error: "team_leader_user_id påkrevd" });
    }

    let client: PoolClient | null = null;
    try {
      const lead = await loadAccessibleLeadgridLead(pool, {
        leadId: req.params.id,
        userId: s.userId,
      });
      if (!lead) return res.status(404).json({ error: "Ikke funnet" });
      const callerProject = await loadAccessibleLeadgridProject(
        pool,
        lead.projectId,
        s.userId,
      );
      if (
        !callerProject ||
        callerProject.organizationId !== lead.organizationId
      ) {
        return res.status(404).json({ error: "Ikke funnet" });
      }
      const callerRole = await getUserRoleForOrganization(
        pool,
        s.userId,
        lead.organizationId,
      );
      if (
        !canAssignTeamLeader(callerRole.globalRole, callerRole.orgRole) &&
        !canAssignTeamLeader(null, callerProject.memberRole)
      ) {
        return res.status(403).json({ error: "Krever markedssjef-rolle eller høyere" });
      }

      const targetRoles = await loadTargetProjectRoles(
        pool,
        callerProject,
        teamLeaderUserId,
      );
      if (
        !targetRoles ||
        !targetRoles.some((role) => TEAM_LEADER_ROLES.includes(role))
      ) {
        return res.status(400).json({
          error: "Brukeren er ikke en tilgjengelig teamleder i prosjektet",
        });
      }

      client = await beginTransaction(pool);
      const current = await client.query<{
        assigned_team_leader_id: string | null;
        name: string;
        lead_category: string | null;
      }>(
        `SELECT assigned_team_leader_id, name, lead_category
           FROM crm_customers
          WHERE id = $1::uuid
            AND organization_id = $2::uuid
            AND project_id = $3
          FOR UPDATE`,
        [lead.id, lead.organizationId, lead.projectId],
      );
      if (!current.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Ikke funnet" });
      }
      const updated = await client.query(
        `UPDATE crm_customers SET
           assigned_team_leader_id = $4::text,
           assignment_note = COALESCE($5::text, assignment_note),
           assignment_chain = COALESCE(assignment_chain, '[]'::jsonb)
                              || jsonb_build_object(
                                   'type', 'team_leader',
                                   'user_id', $4::text,
                                   'by_user_id', $6::text,
                                   'at', now()::text,
                                   'note', $5::text
                                 ),
           updated_at = now()
         WHERE id = $1::uuid
           AND organization_id = $2::uuid
           AND project_id = $3
         RETURNING id`,
        [
          lead.id,
          lead.organizationId,
          lead.projectId,
          teamLeaderUserId,
          note,
          s.userId,
        ],
      );
      if (updated.rowCount !== 1) throw new Error("assignment_update_race");
      await logAssignment(client, {
        customerId: lead.id,
        organizationId: lead.organizationId,
        assignedByUserId: s.userId,
        fromUserId: current.rows[0].assigned_team_leader_id,
        toUserId: teamLeaderUserId,
        reason: "team_leader_assignment",
        meta: { type: "team_leader", project_id: lead.projectId, note },
      });
      await client.query("COMMIT");

      // Varsling skjer etter COMMIT, slik at mottakeren aldri varsles om en
      // tildeling som senere rulles tilbake.
      void notifyAssignment(pool, {
        recipientUserId: teamLeaderUserId,
        organizationId: lead.organizationId,
        eventType: "lead_assigned_as_team_leader",
        customerId: lead.id,
        customerName: current.rows[0].name ?? "Ny lead",
        customerTier: current.rows[0].lead_category ?? null,
        triggeredByUserId: s.userId,
        note,
      }).catch((e) => console.warn("[assign-tl] notify feilet", e));

      return res.json({ ok: true });
    } catch (e) {
      if (client) await client.query("ROLLBACK").catch(() => undefined);
      console.error("[assign-tl] tildeling feilet", e);
      return res.status(500).json({ error: "Kunne ikke tildele teamleder" });
    } finally {
      client?.release();
    }
  });

  // ============================================================
  // ASSIGN REP (teamleder → salgskonsulent/promotør)
  // ============================================================
  app.post("/api/leadgrid/customers/:id/assign-rep", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const repUserId =
      typeof req.body?.rep_user_id === "string"
        ? req.body.rep_user_id.trim()
        : "";
    const note = typeof req.body?.note === "string"
      ? req.body.note.trim().slice(0, 4_000) || null
      : null;
    if (!repUserId) return res.status(400).json({ error: "rep_user_id påkrevd" });

    let client: PoolClient | null = null;
    try {
      const lead = await loadAccessibleLeadgridLead(pool, {
        leadId: req.params.id,
        userId: s.userId,
      });
      if (!lead) return res.status(404).json({ error: "Ikke funnet" });
      const callerProject = await loadAccessibleLeadgridProject(
        pool,
        lead.projectId,
        s.userId,
      );
      if (
        !callerProject ||
        callerProject.organizationId !== lead.organizationId
      ) {
        return res.status(404).json({ error: "Ikke funnet" });
      }
      const callerRole = await getUserRoleForOrganization(
        pool,
        s.userId,
        lead.organizationId,
      );
      if (
        !canAssignRep(callerRole.globalRole, callerRole.orgRole) &&
        !canAssignRep(null, callerProject.memberRole)
      ) {
        return res.status(403).json({ error: "Krever teamleder-rolle eller høyere" });
      }

      const targetRoles = await loadTargetProjectRoles(
        pool,
        callerProject,
        repUserId,
      );
      if (!targetRoles || !targetRoles.some((role) => REP_ROLES.includes(role))) {
        return res.status(400).json({
          error: "Brukeren er ikke en tilgjengelig salgskonsulent/promotør i prosjektet",
        });
      }

      client = await beginTransaction(pool);
      const current = await client.query<{
        assigned_user_id: string | null;
        name: string;
        lead_category: string | null;
      }>(
        `SELECT assigned_user_id, name, lead_category
           FROM crm_customers
          WHERE id = $1::uuid
            AND organization_id = $2::uuid
            AND project_id = $3
          FOR UPDATE`,
        [lead.id, lead.organizationId, lead.projectId],
      );
      if (!current.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Ikke funnet" });
      }
      const updated = await client.query(
        `UPDATE crm_customers SET
           assigned_user_id = $4::text,
           assigned_by_user_id = $5::text,
           assigned_at = now(),
           assignment_note = COALESCE($6::text, assignment_note),
           assignment_chain = COALESCE(assignment_chain, '[]'::jsonb)
                              || jsonb_build_object(
                                   'type', 'rep',
                                   'user_id', $4::text,
                                   'by_user_id', $5::text,
                                   'at', now()::text,
                                   'note', $6::text
                                 ),
           updated_at = now()
         WHERE id = $1::uuid
           AND organization_id = $2::uuid
           AND project_id = $3
         RETURNING id`,
        [
          lead.id,
          lead.organizationId,
          lead.projectId,
          repUserId,
          s.userId,
          note,
        ],
      );
      if (updated.rowCount !== 1) throw new Error("assignment_update_race");
      await logAssignment(client, {
        customerId: lead.id,
        organizationId: lead.organizationId,
        assignedByUserId: s.userId,
        fromUserId: current.rows[0].assigned_user_id,
        toUserId: repUserId,
        reason: "rep_assignment",
        meta: { type: "rep", project_id: lead.projectId, note },
      });
      await client.query("COMMIT");

      void notifyAssignment(pool, {
        recipientUserId: repUserId,
        organizationId: lead.organizationId,
        eventType: "lead_assigned_as_rep",
        customerId: lead.id,
        customerName: current.rows[0].name ?? "(uten navn)",
        customerTier: current.rows[0].lead_category ?? null,
        triggeredByUserId: s.userId,
        note,
      }).catch((e) => console.warn("[assign-rep] notify feilet", e));
      return res.json({ ok: true });
    } catch (e) {
      if (client) await client.query("ROLLBACK").catch(() => undefined);
      console.error("[assign-rep] tildeling feilet", e);
      return res.status(500).json({ error: "Kunne ikke tildele rep" });
    } finally {
      client?.release();
    }
  });

  // ============================================================
  // UNASSIGN
  // ============================================================
  app.post("/api/leadgrid/customers/:id/unassign", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const { unassign_type } = req.body ?? {}; // 'rep' | 'team_leader' | 'all'
    const t = unassign_type ?? "rep";
    if (!["rep", "team_leader", "all"].includes(t)) {
      return res.status(400).json({ error: "Ugyldig unassign_type" });
    }

    let client: PoolClient | null = null;
    try {
      const lead = await loadAccessibleLeadgridLead(pool, {
        leadId: req.params.id,
        userId: s.userId,
      });
      if (!lead) return res.status(404).json({ error: "Ikke funnet" });
      const callerProject = await loadAccessibleLeadgridProject(
        pool,
        lead.projectId,
        s.userId,
      );
      if (
        !callerProject ||
        callerProject.organizationId !== lead.organizationId
      ) {
        return res.status(404).json({ error: "Ikke funnet" });
      }
      const callerRole = await getUserRoleForOrganization(
        pool,
        s.userId,
        lead.organizationId,
      );
      if (
        !canAssignRep(callerRole.globalRole, callerRole.orgRole) &&
        !canAssignRep(null, callerProject.memberRole)
      ) {
        return res.status(403).json({ error: "Krever teamleder-rolle eller høyere" });
      }
      if (
        (t === "team_leader" || t === "all") &&
        !canAssignTeamLeader(callerRole.globalRole, callerRole.orgRole) &&
        !canAssignTeamLeader(null, callerProject.memberRole)
      ) {
        return res.status(403).json({ error: "Krever markedssjef for å fjerne teamleder" });
      }

      client = await beginTransaction(pool);
      const current = await client.query<{
        assigned_user_id: string | null;
        assigned_team_leader_id: string | null;
      }>(
        `SELECT assigned_user_id, assigned_team_leader_id
           FROM crm_customers
          WHERE id = $1::uuid
            AND organization_id = $2::uuid
            AND project_id = $3
          FOR UPDATE`,
        [lead.id, lead.organizationId, lead.projectId],
      );
      if (!current.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Ikke funnet" });
      }

      const updated = await client.query(
        `UPDATE crm_customers SET
           assigned_user_id = CASE
             WHEN $4::text IN ('rep', 'all') THEN NULL
             ELSE assigned_user_id
           END,
           assigned_by_user_id = CASE
             WHEN $4::text IN ('rep', 'all') THEN NULL
             ELSE assigned_by_user_id
           END,
           assigned_at = CASE
             WHEN $4::text IN ('rep', 'all') THEN NULL
             ELSE assigned_at
           END,
           assigned_team_leader_id = CASE
             WHEN $4::text IN ('team_leader', 'all') THEN NULL
             ELSE assigned_team_leader_id
           END,
           assignment_chain = COALESCE(assignment_chain, '[]'::jsonb) ||
             CASE $4::text
               WHEN 'all' THEN jsonb_build_array(
                 jsonb_build_object(
                   'type', 'unassign_rep',
                   'by_user_id', $5::text,
                   'at', now()::text
                 ),
                 jsonb_build_object(
                   'type', 'unassign_team_leader',
                   'by_user_id', $5::text,
                   'at', now()::text
                 )
               )
               WHEN 'team_leader' THEN jsonb_build_object(
                 'type', 'unassign_team_leader',
                 'by_user_id', $5::text,
                 'at', now()::text
               )
               ELSE jsonb_build_object(
                 'type', 'unassign_rep',
                 'by_user_id', $5::text,
                 'at', now()::text
               )
             END,
           updated_at = now()
         WHERE id = $1::uuid
           AND organization_id = $2::uuid
           AND project_id = $3
         RETURNING id`,
        [lead.id, lead.organizationId, lead.projectId, t, s.userId],
      );
      if (updated.rowCount !== 1) throw new Error("unassignment_update_race");

      if (
        (t === "rep" || t === "all") &&
        current.rows[0].assigned_user_id
      ) {
        await logAssignment(client, {
          customerId: lead.id,
          organizationId: lead.organizationId,
          assignedByUserId: s.userId,
          fromUserId: current.rows[0].assigned_user_id,
          toUserId: null,
          reason: "unassign_rep",
          meta: { project_id: lead.projectId },
        });
      }
      if (
        (t === "team_leader" || t === "all") &&
        current.rows[0].assigned_team_leader_id
      ) {
        await logAssignment(client, {
          customerId: lead.id,
          organizationId: lead.organizationId,
          assignedByUserId: s.userId,
          fromUserId: current.rows[0].assigned_team_leader_id,
          toUserId: null,
          reason: "unassign_team_leader",
          meta: { project_id: lead.projectId },
        });
      }
      await client.query("COMMIT");
      return res.json({ ok: true });
    } catch (e) {
      if (client) await client.query("ROLLBACK").catch(() => undefined);
      console.error("[leadgrid] unassign feilet", e);
      return res.status(500).json({ error: "Kunne ikke fjerne tildeling" });
    } finally {
      client?.release();
    }
  });

  // ============================================================
  // ASSIGNMENT HISTORY
  // ============================================================
  app.get("/api/leadgrid/customers/:id/assignment-history", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    // Defensiv try/catch (Notification-QA 2026-07-08): malformet :id-uuid
    // eller DB-feil skal gi 500, ikke uhåndtert async → heng.
    try {
      const lead = await loadAccessibleLeadgridLead(pool, {
        leadId: req.params.id,
        userId: s.userId,
      });
      if (!lead) return res.status(404).json({ error: "Ikke funnet" });
      const r = await pool.query(
        `SELECT l.id::text, l.from_user_id, l.to_user_id, l.assigned_by_user_id,
                COALESCE(NULLIF(l.meta ->> 'note', ''), l.reason) AS reason,
                l.assigned_at::text, l.meta,
                fr.first_name AS from_first, fr.last_name AS from_last,
                to_.first_name AS to_first, to_.last_name AS to_last,
                by_.first_name AS by_first, by_.last_name AS by_last
           FROM crm_customers c
           JOIN lead_assignment_log l
             ON l.lead_id = c.id
            AND l.organization_id = c.organization_id
           LEFT JOIN users fr  ON fr.id = l.from_user_id
           LEFT JOIN users to_ ON to_.id = l.to_user_id
           LEFT JOIN users by_ ON by_.id = l.assigned_by_user_id
          WHERE c.id = $1::uuid
            AND c.organization_id = $2::uuid
            AND c.project_id = $3
          ORDER BY l.assigned_at DESC LIMIT 50`,
        [lead.id, lead.organizationId, lead.projectId],
      );
      res.json({ history: r.rows });
    } catch (e) {
      console.error("[leadgrid] assignment-history feilet", e);
      res.status(500).json({ error: "Kunne ikke hente historikk" });
    }
  });

  // ============================================================
  // MINE ASSIGNMENTS — lesing av listen endrer ikke sett-status.
  // Sett-status registreres først når brukeren åpner det enkelte leadet.
  // ============================================================
  app.get("/api/leadgrid/my-assignments", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const organizationId = requestedOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ error: "Gyldig organization_id er påkrevd" });
    }
    try {
    const projectRows = await pool.query<{ project_id: string }>(
      `SELECT DISTINCT c.project_id
         FROM crm_customers c
        WHERE c.organization_id = $2::uuid
          AND c.project_id IS NOT NULL
          AND (
            c.assigned_user_id = $1
            OR c.assigned_team_leader_id = $1
          )`,
      [s.userId, organizationId],
    );
    const accessibleProjectIds = (
      await Promise.all(projectRows.rows.map(async ({ project_id }) => {
        const project = await loadAccessibleLeadgridProject(
          pool,
          project_id,
          s.userId,
        );
        return project?.organizationId === organizationId ? project.id : null;
      }))
    ).filter((projectId): projectId is string => projectId !== null);
    if (accessibleProjectIds.length === 0) {
      return res.json({ items: [] });
    }

    const r = await pool.query(
      `SELECT c.id::text, c.name, c.email, c.phone, c.status,
              c.ai_opportunity_score, c.lead_category,
              c.assigned_at::text, c.assignment_note,
              c.team_leader_first_opened_at::text,
              c.team_leader_last_seen_at::text,
              c.rep_first_opened_at::text,
              c.rep_last_seen_at::text,
              c.last_action_at::text, c.last_action_type,
              c.project_id,
              p.name AS project_name
         FROM crm_customers c
         LEFT JOIN leadgrid_projects p
           ON p.id = c.project_id
          AND p.organization_id = c.organization_id
        WHERE c.organization_id = $2::uuid
          AND c.project_id = ANY($3::text[])
          AND (
            c.assigned_user_id = $1
            OR c.assigned_team_leader_id = $1
          )
        ORDER BY
          CASE c.lead_category WHEN 'hot' THEN 1 WHEN 'warm' THEN 2
                                WHEN 'cool' THEN 3 ELSE 4 END,
          c.assigned_at DESC NULLS LAST
        LIMIT 100`,
      [s.userId, organizationId, accessibleProjectIds],
    );

    res.json({ items: r.rows });
    } catch (e) {
      console.error("[leadgrid] my-assignments feilet", e);
      res.status(500).json({ error: "Kunne ikke hente tildelinger" });
    }
  });

  // ============================================================
  // MARK SEEN — eksplisitt registrering av at en lead ble åpnet
  // ============================================================
  app.post("/api/leadgrid/customers/:id/mark-seen", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    try {
    const lead = await loadAccessibleLeadgridLead(pool, {
      leadId: req.params.id,
      userId: s.userId,
    });
    if (!lead) return res.status(404).json({ error: "Ikke funnet" });
    const project = await loadAccessibleLeadgridProject(
      pool,
      lead.projectId,
      s.userId,
    );
    if (!project || project.organizationId !== lead.organizationId) {
      return res.status(404).json({ error: "Ikke funnet" });
    }
    const role = await getUserRoleForOrganization(
      pool,
      s.userId,
      lead.organizationId,
    );
    const viewerRole = role.orgRole ?? project.memberRole;

    const r = await pool.query<{
      assigned_team_leader_id: string | null; assigned_user_id: string | null;
    }>(
      `SELECT assigned_team_leader_id, assigned_user_id
         FROM crm_customers
        WHERE id = $1::uuid
          AND organization_id = $2::uuid
          AND project_id = $3`,
      [lead.id, lead.organizationId, lead.projectId],
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: "Ikke funnet" });

    if (row.assigned_team_leader_id === s.userId) {
      await pool.query(
        `UPDATE crm_customers SET
           team_leader_first_opened_at = COALESCE(team_leader_first_opened_at, now()),
           team_leader_last_seen_at = now()
         WHERE id = $1::uuid
           AND organization_id = $2::uuid
           AND project_id = $3
           AND assigned_team_leader_id = $4`,
        [lead.id, lead.organizationId, lead.projectId, s.userId],
      );
    }
    if (row.assigned_user_id === s.userId) {
      await pool.query(
        `UPDATE crm_customers SET
           rep_first_opened_at = COALESCE(rep_first_opened_at, now()),
           rep_last_seen_at = now()
         WHERE id = $1::uuid
           AND organization_id = $2::uuid
           AND project_id = $3
           AND assigned_user_id = $4`,
        [lead.id, lead.organizationId, lead.projectId, s.userId],
      );
    }

    await pool.query(
      `INSERT INTO crm_customer_view_log (
         customer_id, viewer_user_id, viewer_role
       )
       SELECT c.id, $4, $5
         FROM crm_customers c
        WHERE c.id = $1::uuid
          AND c.organization_id = $2::uuid
          AND c.project_id = $3`,
      [lead.id, lead.organizationId, lead.projectId, s.userId, viewerRole],
    );

    res.json({ ok: true });
    } catch (e) {
      console.error("[leadgrid] mark-seen feilet", e);
      res.status(500).json({ error: "Kunne ikke markere sett" });
    }
  });

  // ============================================================
  // GET/PUT NOTIFICATION-PREFS
  // ============================================================
  app.get("/api/leadgrid/my-notification-prefs", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    try {
      const r = await pool.query(
        `SELECT * FROM user_lead_notification_prefs WHERE user_id = $1`,
        [s.userId],
      );
      res.json(r.rows[0] ?? {
        notify_email: true, notify_whatsapp: false, notify_sms: false, notify_in_app: true,
        notify_on_assigned_team_leader: true, notify_on_assigned_as_rep: true,
        notify_on_lead_status_change: true, notify_on_lead_won: true, notify_on_lead_lost: false,
      });
    } catch (e) {
      console.error("[leadgrid] get notification-prefs feilet", e);
      res.status(500).json({ error: "Kunne ikke hente varsel-innstillinger" });
    }
  });
  app.put("/api/leadgrid/my-notification-prefs", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const b = req.body ?? {};
    try {
    await pool.query(
      `INSERT INTO user_lead_notification_prefs
         (user_id, notify_email, notify_whatsapp, notify_sms, notify_in_app,
          notify_on_assigned_team_leader, notify_on_assigned_as_rep,
          notify_on_lead_status_change, notify_on_lead_won, notify_on_lead_lost,
          notify_on_assignment_seen_status,
          quiet_hours_start, quiet_hours_end, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
       ON CONFLICT (user_id) DO UPDATE SET
         notify_email = EXCLUDED.notify_email,
         notify_whatsapp = EXCLUDED.notify_whatsapp,
         notify_sms = EXCLUDED.notify_sms,
         notify_in_app = EXCLUDED.notify_in_app,
         notify_on_assigned_team_leader = EXCLUDED.notify_on_assigned_team_leader,
         notify_on_assigned_as_rep = EXCLUDED.notify_on_assigned_as_rep,
         notify_on_lead_status_change = EXCLUDED.notify_on_lead_status_change,
         notify_on_lead_won = EXCLUDED.notify_on_lead_won,
         notify_on_lead_lost = EXCLUDED.notify_on_lead_lost,
         notify_on_assignment_seen_status = EXCLUDED.notify_on_assignment_seen_status,
         quiet_hours_start = EXCLUDED.quiet_hours_start,
         quiet_hours_end = EXCLUDED.quiet_hours_end,
         updated_at = now()`,
      [s.userId,
       b.notify_email !== false, !!b.notify_whatsapp, !!b.notify_sms,
       b.notify_in_app !== false,
       b.notify_on_assigned_team_leader !== false,
       b.notify_on_assigned_as_rep !== false,
       b.notify_on_lead_status_change !== false,
       b.notify_on_lead_won !== false,
       !!b.notify_on_lead_lost,
       !!b.notify_on_assignment_seen_status,
       b.quiet_hours_start ?? null, b.quiet_hours_end ?? null],
    );
    res.json({ ok: true });
    } catch (e) {
      console.error("[leadgrid] put notification-prefs feilet", e);
      res.status(500).json({ error: "Kunne ikke lagre varsel-innstillinger" });
    }
  });

  // ============================================================
  // GET/POST INBOX (in-app notifications)
  // ============================================================
  app.get("/api/leadgrid/my-notifications", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    // 🔴 `SELECT id` var TVETYDIG (både notification_events OG users har
    // `id`) → Postgres kastet «column reference "id" is ambiguous», og
    // uten try/catch svarte Express ALDRI → HENG. Dette er endepunktet
    // bjella (leadgridUnreadCount) poller hvert 60s → badgen oppdaterte
    // seg aldri. Kvalifiser `n.id` + try/catch (Notification-QA 2026-07-06).
    try {
      const r = await pool.query(
        `SELECT n.id, n.organization_id::text, n.project_id::text,
                n.event_type, n.title, n.body,
                n.lead_id, n.deep_link,
                n.meta, n.read_at::text, n.created_at::text,
                n.triggered_by_user_id,
                tb.first_name AS by_first, tb.last_name AS by_last
           FROM notification_events n
           LEFT JOIN users tb ON tb.id = n.triggered_by_user_id
          WHERE n.recipient_user_id = $1
          ORDER BY n.created_at DESC LIMIT 50`,
        [s.userId],
      );
      const unread = await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM notification_events
          WHERE recipient_user_id = $1 AND read_at IS NULL`,
        [s.userId],
      );
      res.json({ items: r.rows, unread_count: Number(unread.rows[0]?.n ?? 0) });
    } catch (e) {
      console.error("[leadgrid] my-notifications feilet", e);
      res.status(500).json({ error: "Kunne ikke hente varsler" });
    }
  });

  app.post("/api/leadgrid/my-notifications/mark-read", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    // Defensiv: en malformet uuid i `ids` ville kastet `$2::uuid[]` →
    // uten try/catch heng. 500 i stedet.
    try {
      if (ids.length === 0) {
        // Mark all
        await pool.query(
          `UPDATE notification_events SET read_at = now()
            WHERE recipient_user_id = $1 AND read_at IS NULL`,
          [s.userId],
        );
      } else {
        await pool.query(
          `UPDATE notification_events SET read_at = now()
            WHERE recipient_user_id = $1 AND id = ANY($2::uuid[])`,
          [s.userId, ids],
        );
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("[leadgrid] mark-read feilet", e);
      res.status(500).json({ error: "Kunne ikke markere lest" });
    }
  });

  // ============================================================
  // GDPR: last ned mine data (dataportabilitet, art. 20)
  // Samler brukerens EGNE Leadgrid-data som JSON. Session-scopet —
  // returnerer kun kallerens egne rader. Bygget etter QA 2026-07-06
  // (iPad-raden «Last ned mine data» var en død knapp uten backend).
  // ============================================================
  app.get("/api/leadgrid/me/export", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    try {
      const profile = await pool.query(
        `SELECT id::text, first_name, last_name, email, role, created_at::text
           FROM users WHERE id = $1`,
        [s.userId],
      );
      // Leads brukeren eier (som rep ELLER team-leader).
      const leads = await pool.query(
        `SELECT id::text, name, status, lead_category, created_at::text,
                CASE WHEN assigned_user_id = $1 THEN 'rep'
                     WHEN assigned_team_leader_id = $1::text THEN 'team_leader'
                     ELSE 'annen' END AS min_rolle
           FROM crm_customers
          WHERE assigned_user_id = $1 OR assigned_team_leader_id = $1::text
          ORDER BY created_at DESC`,
        [s.userId],
      );
      const notifications = await pool.query(
        `SELECT event_type, title, body, read_at::text, created_at::text
           FROM notification_events
          WHERE recipient_user_id = $1
          ORDER BY created_at DESC LIMIT 500`,
        [s.userId],
      );
      // Entitlements for brukerens org (via medlemskap).
      const entitlements = await pool.query(
        `SELECT e.feature_key, e.state, e.monthly_limit
           FROM leadgrid_org_entitlements e
           JOIN organization_members om ON om.organization_id = e.organization_id
          WHERE om.user_id = $1`,
        [s.userId],
      );
      const payload = {
        eksportert_at: new Date().toISOString(),
        beskrivelse: "Dine personlige Leadgrid-data (GDPR art. 20 dataportabilitet).",
        profil: profile.rows[0] ?? null,
        leads: leads.rows,
        varsler: notifications.rows,
        tilganger: entitlements.rows,
      };
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="leadgrid-mine-data-${s.userId}.json"`,
      );
      res.send(JSON.stringify(payload, null, 2));
    } catch (e) {
      console.error("[leadgrid] me/export feilet", e);
      res.status(500).json({ error: "Kunne ikke eksportere data" });
    }
  });

  // ============================================================
  // ASSIGNMENT STATUS — markedssjef vil se om mottakeren har sett
  // ============================================================
  app.get("/api/leadgrid/customers/:id/assignment-status", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    // 🔴 `user_presence.user_id` (uuid) = `users.id` (varchar) kastet
    // «operator does not exist: uuid = character varying» → uten try/catch
    // svarte Express aldri → HENG. Cast users.id::uuid + try/catch
    // (Notification-QA 2026-07-06).
    try {
      const lead = await loadAccessibleLeadgridLead(pool, {
        leadId: req.params.id,
        userId: s.userId,
      });
      if (!lead) return res.status(404).json({ error: "Ikke funnet" });
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
                tl.profile_image_url AS tl_avatar,
                tl_up.last_seen_at::text AS tl_last_online,
                tl_up.current_route AS tl_current_route,
                rep.first_name AS rep_first, rep.last_name AS rep_last,
                rep.profile_image_url AS rep_avatar,
                rep_up.last_seen_at::text AS rep_last_online,
                rep_up.current_route AS rep_current_route
           FROM crm_customers c
           LEFT JOIN users tl  ON tl.id = c.assigned_team_leader_id
           LEFT JOIN users rep ON rep.id = c.assigned_user_id
           LEFT JOIN user_presence tl_up  ON tl_up.user_id = tl.id::uuid
           LEFT JOIN user_presence rep_up ON rep_up.user_id = rep.id::uuid
          WHERE c.id = $1::uuid
            AND c.organization_id = $2::uuid
            AND c.project_id = $3`,
        [lead.id, lead.organizationId, lead.projectId],
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "Ikke funnet" });
      res.json(r.rows[0]);
    } catch (e) {
      console.error("[leadgrid] assignment-status feilet", e);
      res.status(500).json({ error: "Kunne ikke hente tildelings-status" });
    }
  });
}
