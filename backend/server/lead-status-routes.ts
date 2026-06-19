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

/** Hent kunde-data + org via casting_projects-join. */
async function getCustomer(pool: Pool, id: string): Promise<CustomerSnapshot | null> {
  const r = await pool.query<CustomerSnapshot>(
    `SELECT c.id::text, c.name, c.status, c.lead_category,
            p.organization_id::text AS organization_id,
            c.assigned_team_leader_id, c.assigned_user_id,
            c.project_id
       FROM crm_customers c
       LEFT JOIN casting_projects p ON p.id = c.project_id
      WHERE c.id = $1`,
    [id],
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

export function registerLeadStatusRoutes({ app, pool, activeSessions }: Deps): void {

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

    const customer = await getCustomer(pool, req.params.id);
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

    params.push(req.params.id);
    await pool.query(
      `UPDATE crm_customers SET ${sets.join(", ")} WHERE id = $${n}`,
      params,
    );

    // Audit-log
    await pool.query(
      `INSERT INTO crm_customer_status_history
         (customer_id, from_status, to_status, changed_by_user_id, note, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [req.params.id, fromStatus, to_status, s.userId, note ?? null,
       JSON.stringify({
         won_amount_oere, won_recurring_oere, lost_reason, lost_reason_detail,
       })],
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
    const r = await pool.query(
      `SELECT h.id::text, h.from_status, h.to_status, h.note, h.metadata,
              h.changed_at::text, h.changed_by_user_id,
              u.first_name, u.last_name, u.profile_image_url
         FROM crm_customer_status_history h
         LEFT JOIN users u ON u.id = h.changed_by_user_id
        WHERE h.customer_id = $1
        ORDER BY h.changed_at DESC LIMIT 50`,
      [req.params.id],
    );
    res.json({ history: r.rows });
  });

  // ============================================================
  // GET /won-lost-stats
  // ============================================================
  app.get("/api/leadgrid/won-lost-stats", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });

    const orgR = await pool.query<{ organization_id: string }>(
      `SELECT organization_id::text FROM organization_members
        WHERE user_id = $1 LIMIT 1`,
      [s.userId],
    );
    const orgId = orgR.rows[0]?.organization_id;
    if (!orgId) return res.status(403).json({ error: "Ikke i noen org" });

    const period = (req.query.period as string) ?? "30d";
    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;

    const r = await pool.query(
      `WITH base AS (
         SELECT c.*
           FROM crm_customers c
           JOIN casting_projects p ON p.id = c.project_id
          WHERE p.organization_id::text = $1
            AND COALESCE(c.won_at, c.lost_at, c.status_changed_at)
                > now() - ($2::int * INTERVAL '1 day')
       )
       SELECT
         COUNT(*) FILTER (WHERE status = 'won') AS won_count,
         COUNT(*) FILTER (WHERE status = 'lost') AS lost_count,
         COALESCE(SUM(won_amount_oere) FILTER (WHERE status = 'won'), 0) AS total_won_oere,
         COALESCE(SUM(won_recurring_oere) FILTER (WHERE status = 'won'), 0) AS total_recurring_oere,
         COUNT(*) FILTER (WHERE status IN ('contacted', 'meeting_booked', 'proposal_sent', 'negotiating')) AS in_pipeline
        FROM base`,
      [orgId, days],
    );

    // Top lost-årsaker
    const lostR = await pool.query(
      `SELECT lost_reason, COUNT(*) AS n
         FROM crm_customers c
         JOIN casting_projects p ON p.id = c.project_id
        WHERE p.organization_id::text = $1
          AND c.status = 'lost'
          AND c.lost_at > now() - ($2::int * INTERVAL '1 day')
          AND c.lost_reason IS NOT NULL
        GROUP BY lost_reason
        ORDER BY n DESC LIMIT 5`,
      [orgId, days],
    );

    res.json({
      period_days: days,
      ...r.rows[0],
      top_lost_reasons: lostR.rows,
      win_rate: Number(r.rows[0].won_count) /
                Math.max(1, Number(r.rows[0].won_count) + Number(r.rows[0].lost_count)),
    });
  });
}
