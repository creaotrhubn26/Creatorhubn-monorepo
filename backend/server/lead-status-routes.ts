/**
 * lead-status-routes.ts
 *
 * Status-flow for Leadgrid-leads med automatisk notifikasjon til
 * markedssjef, tildelt teamleder og rep.
 *
 *   PUT  /api/leadgrid/customers/:id/status
 *   GET  /api/leadgrid/customers/:id/status-history
 *   GET  /api/leadgrid/won-lost-stats?period=30d
 *
 * Status-flow:
 *   new → contacted → meeting_booked → proposal_sent
 *       → negotiating → won | lost | archived
 *
 * Hver overgang loggges i crm_customer_status_history + sender
 * notifyAssignment til alle interessenter (rep + teamleder + markedssjef).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { notifyAssignment } from "./lead-assignment-notification-service.js";
import { loadAccessibleLeadgridLead } from "./leadgrid-lead-access.js";
import { loadAccessibleLeadgridProject } from "./leadgrid-project-access.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { app: Express; pool: Pool; activeSessions: Map<string, SessionData>; }

const VALID_STATUSES = [
  "new", "active", "lead", "contacted", "meeting_booked", "proposal_sent",
  "negotiating", "won", "lost", "archived", "paused",
];

const LOST_REASONS = [
  "no_budget", "no_decision_maker", "no_timeline",
  "competitor", "bad_fit", "unresponsive", "too_expensive",
  "other",
];

const TIMESTAMPS_BY_STATUS: Record<string, string> = {
  contacted: "contacted_at",
  meeting_booked: "meeting_booked_at",
  proposal_sent: "proposal_sent_at",
  won: "won_at",
  lost: "lost_at",
  archived: "archived_at",
};

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const t = (req as any).cookies?.sessionToken;
  return t ? sessions.get(t) ?? null : null;
}

interface CustomerSnapshot {
  id: string;
  name: string;
  status: string;
  lead_category: string | null;
  organization_id: string | null;
  assigned_team_leader_id: string | null;
  assigned_user_id: string | null;
  project_id: string | null;
}

/** Hent kunde-data innenfor en allerede autorisert, lagret tenant-tuple. */
async function getCustomer(
  pool: Pool,
  scope: { id: string; organizationId: string; projectId: string },
): Promise<CustomerSnapshot | null> {
  const r = await pool.query<CustomerSnapshot>(
    `SELECT c.id::text, c.name, c.status, c.lead_category,
            c.organization_id::text AS organization_id,
            c.assigned_team_leader_id, c.assigned_user_id,
            c.project_id::text
       FROM crm_customers c
      WHERE c.id = $1::uuid
        AND c.organization_id = $2::uuid
        AND c.project_id = $3
      LIMIT 1`,
    [scope.id, scope.organizationId, scope.projectId],
  );
  return r.rows[0] ?? null;
}

/** Finn markedssjef-er i org (alle som har rolle markedssjef/salgssjef/admin/owner). */
async function getOrgManagerUserIds(pool: Pool, orgId: string): Promise<string[]> {
  const r = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM organization_members
      WHERE organization_id = $1
        AND role IN ('markedssjef', 'salgssjef', 'admin', 'owner')`,
    [orgId],
  );
  return r.rows.map((row) => row.user_id);
}

function parseRequiredWonLostProjectId(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    throw new Error("project_id_required");
  }
  if (typeof value !== "string") throw new Error("invalid_project_id");
  const projectId = value.trim();
  if (!projectId || projectId.length > 255) {
    throw new Error("invalid_project_id");
  }
  return projectId;
}

export async function buildWonLostStats(
  pool: Pick<Pool, "query">,
  input: { organizationId: string; projectId: string; days: number },
) {
  const { organizationId, projectId, days } = input;
  const [statsR, lostR, momR, topRepR, funnelR] = await Promise.all([
    pool.query<any>(
      `WITH base AS (
         SELECT c.*
           FROM crm_customers c
          WHERE c.organization_id = $1::uuid
            AND c.project_id = $2
            AND COALESCE(c.won_at, c.lost_at, c.status_changed_at)
                > now() - ($3::int * INTERVAL '1 day')
       )
       SELECT
         COUNT(*) FILTER (WHERE status = 'won') AS won_count,
         COUNT(*) FILTER (WHERE status = 'lost') AS lost_count,
         COALESCE(SUM(won_amount_oere) FILTER (WHERE status = 'won'), 0) AS total_won_oere,
         COALESCE(SUM(won_recurring_oere) FILTER (WHERE status = 'won'), 0) AS total_recurring_oere,
         COUNT(*) FILTER (WHERE status IN ('contacted', 'meeting_booked', 'proposal_sent', 'negotiating')) AS in_pipeline
        FROM base`,
      [organizationId, projectId, days],
    ),
    pool.query(
      `SELECT c.lost_reason, COUNT(*) AS n
         FROM crm_customers c
        WHERE c.organization_id = $1::uuid
          AND c.project_id = $2
          AND c.status = 'lost'
          AND c.lost_at > now() - ($3::int * INTERVAL '1 day')
          AND c.lost_reason IS NOT NULL
        GROUP BY c.lost_reason
        ORDER BY n DESC LIMIT 5`,
      [organizationId, projectId, days],
    ),
    pool.query(
      `WITH months AS (
         SELECT date_trunc('month', generate_series(
           now() - INTERVAL '5 months', now(), INTERVAL '1 month'
         )) AS m
       )
       SELECT
         to_char(months.m, 'YYYY-MM') AS month,
         COUNT(c.id) FILTER (WHERE c.status = 'won'
                              AND date_trunc('month', c.won_at) = months.m) AS won,
         COUNT(c.id) FILTER (WHERE c.status = 'lost'
                              AND date_trunc('month', c.lost_at) = months.m) AS lost,
         COALESCE(SUM(c.won_amount_oere) FILTER (WHERE c.status = 'won'
                       AND date_trunc('month', c.won_at) = months.m), 0) AS won_amount_oere,
         COALESCE(SUM(c.won_recurring_oere) FILTER (WHERE c.status = 'won'
                       AND date_trunc('month', c.won_at) = months.m), 0) AS won_recurring_oere
        FROM months
        LEFT JOIN crm_customers c
          ON c.organization_id = $1::uuid
         AND c.project_id = $2
       GROUP BY months.m
       ORDER BY months.m`,
      [organizationId, projectId],
    ),
    pool.query(
      `SELECT c.assigned_user_id, u.first_name, u.last_name, u.profile_image_url,
              COUNT(*) FILTER (WHERE c.status = 'won') AS won_count,
              COALESCE(SUM(c.won_amount_oere) FILTER (WHERE c.status = 'won'), 0) AS won_amount_oere
         FROM crm_customers c
         LEFT JOIN users u ON u.id = c.assigned_user_id
        WHERE c.organization_id = $1::uuid
          AND c.project_id = $2
          AND c.assigned_user_id IS NOT NULL
          AND COALESCE(c.won_at, c.lost_at, c.status_changed_at)
              > now() - ($3::int * INTERVAL '1 day')
        GROUP BY c.assigned_user_id, u.first_name, u.last_name, u.profile_image_url
        HAVING COUNT(*) FILTER (WHERE c.status = 'won') > 0
        ORDER BY won_amount_oere DESC LIMIT 5`,
      [organizationId, projectId, days],
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE c.status IN ('new', 'lead', 'active')) AS new_leads,
         COUNT(*) FILTER (WHERE c.status = 'contacted') AS contacted,
         COUNT(*) FILTER (WHERE c.status = 'meeting_booked') AS meeting_booked,
         COUNT(*) FILTER (WHERE c.status = 'proposal_sent') AS proposal_sent,
         COUNT(*) FILTER (WHERE c.status = 'negotiating') AS negotiating,
         COUNT(*) FILTER (WHERE c.status = 'won') AS won,
         COUNT(*) FILTER (WHERE c.status = 'lost') AS lost
        FROM crm_customers c
       WHERE c.organization_id = $1::uuid
         AND c.project_id = $2
         AND c.created_at > now() - ($3::int * INTERVAL '1 day')`,
      [organizationId, projectId, days],
    ),
  ]);

  const stats = statsR.rows[0] ?? {};
  return {
    period_days: days,
    ...stats,
    top_lost_reasons: lostR.rows,
    win_rate: Number(stats.won_count) /
      Math.max(1, Number(stats.won_count) + Number(stats.lost_count)),
    month_over_month: momR.rows,
    top_reps: topRepR.rows,
    funnel: funnelR.rows[0] ?? {},
  };
}

export function registerLeadStatusRoutes({ app, pool, activeSessions }: Deps): void {

  // ============================================================
  // GET /customers/:id — basis kunde-info for detail-drawer
  // ============================================================
  app.get("/api/leadgrid/customers/:id", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    try {
      const lead = await loadAccessibleLeadgridLead(pool, {
        leadId: req.params.id,
        userId: s.userId,
      });
      if (!lead) return res.status(404).json({ error: "Ikke funnet" });
      const r = await pool.query(
        `SELECT id::text, name, email, phone, website_url, logo_url,
                status, lead_category, ai_opportunity_score, assignment_note,
                assigned_team_leader_id, assigned_user_id
           FROM crm_customers
          WHERE id = $1::uuid
            AND organization_id = $2::uuid
            AND project_id = $3
          LIMIT 1`,
        [lead.id, lead.organizationId, lead.projectId],
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "Ikke funnet" });
      return res.json(r.rows[0]);
    } catch (error) {
      console.error("[lead-status/customer] fetch failed", error);
      return res.status(500).json({ error: "customer_failed" });
    }
  });

  // ============================================================
  // PUT /status — endre status + audit + notify
  // ============================================================
  app.put("/api/leadgrid/customers/:id/status", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });

    const {
      to_status, note,
      won_amount_oere, won_recurring_oere, won_note,
      lost_reason, lost_reason_detail,
    } = req.body ?? {};

    if (!to_status || !VALID_STATUSES.includes(to_status)) {
      return res.status(400).json({
        error: "Ugyldig status. Tillatte: " + VALID_STATUSES.join(", "),
      });
    }
    if (to_status === "lost" && (!lost_reason || !LOST_REASONS.includes(lost_reason))) {
      return res.status(400).json({
        error: "lost_reason påkrevd. Tillatte: " + LOST_REASONS.join(", "),
      });
    }

    const lead = await loadAccessibleLeadgridLead(pool, {
      leadId: req.params.id,
      userId: s.userId,
    });
    if (!lead) return res.status(404).json({ error: "Ikke funnet" });

    const customer = await getCustomer(pool, lead);
    if (!customer) return res.status(404).json({ error: "Ikke funnet" });

    // Tilgang: må være markedssjef+, teamleder for leaden, eller rep for leaden
    const userR = await pool.query<{ role: string | null }>(
      `SELECT role FROM organization_members
        WHERE user_id = $1 AND organization_id = $2`,
      [s.userId, customer.organization_id],
    );
    const orgRole = userR.rows[0]?.role ?? null;
    const isManagement = ["super_admin", "admin", "owner", "markedssjef", "salgssjef"].includes(orgRole ?? "");
    const isOwnLead = customer.assigned_team_leader_id === s.userId
                  || customer.assigned_user_id === s.userId;
    if (!isManagement && !isOwnLead) {
      return res.status(403).json({ error: "Du eier ikke denne leaden" });
    }

    const fromStatus = customer.status;
    if (fromStatus === to_status) {
      return res.json({ ok: true, no_change: true });
    }

    // Bygg UPDATE-statement dynamisk
    const sets: string[] = [
      "status = $1",
      "status_changed_at = now()",
      "status_changed_by_user_id = $2",
      "updated_at = now()",
    ];
    const params: any[] = [to_status, s.userId];
    let n = 3;

    // Sett timestamp-felt for visse statuser (idempotent — bare første gang)
    const tsField = TIMESTAMPS_BY_STATUS[to_status];
    if (tsField) {
      sets.push(`${tsField} = COALESCE(${tsField}, now())`);
    }

    if (to_status === "won") {
      sets.push(`won_amount_oere = $${n++}`); params.push(won_amount_oere ?? null);
      sets.push(`won_recurring_oere = $${n++}`); params.push(won_recurring_oere ?? null);
      sets.push(`won_note = $${n++}`); params.push(won_note ?? null);
    }
    if (to_status === "lost") {
      sets.push(`lost_reason = $${n++}`); params.push(lost_reason);
      sets.push(`lost_reason_detail = $${n++}`); params.push(lost_reason_detail ?? null);
    }

    const leadIdParam = n++;
    params.push(lead.id);
    const organizationIdParam = n++;
    params.push(lead.organizationId);
    const projectIdParam = n++;
    params.push(lead.projectId);
    const updated = await pool.query(
      `UPDATE crm_customers
          SET ${sets.join(", ")}
        WHERE id = $${leadIdParam}::uuid
          AND organization_id = $${organizationIdParam}::uuid
          AND project_id = $${projectIdParam}
        RETURNING id`,
      params,
    );
    if (!updated.rows.length) return res.status(404).json({ error: "Ikke funnet" });

    // Audit-log
    await pool.query(
      `INSERT INTO crm_customer_status_history
         (customer_id, from_status, to_status, changed_by_user_id, note, metadata)
       SELECT c.id, $2, $3, $4, $5, $6::jsonb
         FROM crm_customers c
        WHERE c.id = $1::uuid
          AND c.organization_id = $7::uuid
          AND c.project_id = $8`,
      [lead.id, fromStatus, to_status, s.userId, note ?? null,
       JSON.stringify({
         won_amount_oere, won_recurring_oere, lost_reason, lost_reason_detail,
       }), lead.organizationId, lead.projectId],
    );

    // ============================================================
    // Notifikasjoner til interessenter
    // ============================================================
    const eventType = to_status === "won" ? "lead_won"
                    : to_status === "lost" ? "lead_lost"
                    : "lead_status_change";

    const recipients = new Set<string>();
    if (customer.assigned_team_leader_id && customer.assigned_team_leader_id !== s.userId) {
      recipients.add(customer.assigned_team_leader_id);
    }
    if (customer.assigned_user_id && customer.assigned_user_id !== s.userId) {
      recipients.add(customer.assigned_user_id);
    }
    // Markedssjef-er (men ikke den som gjorde endringen)
    if (customer.organization_id) {
      const managers = await getOrgManagerUserIds(pool, customer.organization_id);
      managers.forEach((uid) => { if (uid !== s.userId) recipients.add(uid); });
    }

    const noteForNotif = to_status === "won"
      ? (won_note ?? note ?? `Beløp: ${(won_amount_oere ?? 0) / 100} kr`)
      : to_status === "lost"
        ? (lost_reason_detail ?? note ?? `Årsak: ${lost_reason}`)
        : note;

    for (const recipientId of recipients) {
      await notifyAssignment(pool, {
        recipientUserId: recipientId,
        organizationId: customer.organization_id ?? "",
        eventType: eventType as any,
        customerId: req.params.id,
        customerName: customer.name,
        customerTier: customer.lead_category,
        triggeredByUserId: s.userId,
        note: noteForNotif,
      }).catch((e) => console.warn("[lead-status] notify feilet", e));
    }

    res.json({ ok: true, from_status: fromStatus, to_status });
  });

  // ============================================================
  // GET /status-history
  // ============================================================
  app.get("/api/leadgrid/customers/:id/status-history", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    try {
      const lead = await loadAccessibleLeadgridLead(pool, {
        leadId: req.params.id,
        userId: s.userId,
      });
      if (!lead) return res.status(404).json({ error: "Ikke funnet" });
      const r = await pool.query(
        `SELECT h.id::text, h.from_status, h.to_status, h.note, h.metadata,
                h.changed_at::text, h.changed_by_user_id,
                u.first_name, u.last_name, u.profile_image_url
           FROM crm_customer_status_history h
           JOIN crm_customers c ON c.id = h.customer_id
           LEFT JOIN users u ON u.id = h.changed_by_user_id
          WHERE h.customer_id = $1::uuid
            AND c.organization_id = $2::uuid
            AND c.project_id = $3
          ORDER BY h.changed_at DESC LIMIT 50`,
        [lead.id, lead.organizationId, lead.projectId],
      );
      return res.json({ history: r.rows });
    } catch (error) {
      console.error("[lead-status/history] fetch failed", error);
      return res.status(500).json({ error: "history_failed" });
    }
  });

  // ============================================================
  // GET /won-lost-stats — alltid ett eksplisitt Leadgrid-kundeprosjekt
  // ============================================================
  app.get("/api/leadgrid/won-lost-stats", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });

    let projectId: string;
    try {
      projectId = parseRequiredWonLostProjectId(
        req.query.projectId ?? req.query.project_id,
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : "invalid_project_id";
      return res.status(400).json({ error: code });
    }

    try {
      const project = await loadAccessibleLeadgridProject(
        pool,
        projectId,
        session.userId,
      );
      if (!project) {
        return res.status(404).json({ error: "project_not_found" });
      }

      const period = (req.query.period as string) ?? "30d";
      const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
      const stats = await buildWonLostStats(pool, {
        organizationId: project.organizationId,
        projectId: project.id,
        days,
      });
      return res.json({
        project_id: project.id,
        project_name: project.name,
        ...stats,
      });
    } catch (error) {
      console.error("[lead-status/won-lost] report failed", error);
      return res.status(500).json({ error: "report_failed" });
    }
  });
}
