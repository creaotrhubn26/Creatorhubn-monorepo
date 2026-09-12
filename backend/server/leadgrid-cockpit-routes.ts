// leadgrid-cockpit-routes.ts
//
// Persisterer to Salgssjef-cockpit-ark som var demo-only (mig 0406):
//   1. Godkjenningskø (deals/rabatter)  → /api/leadgrid/approvals/*
//   2. Coaching 1-til-1                  → /api/leadgrid/coaching/*
//
// Egne Leadgrid-tabeller, speiler mileage-godkjenning-mønsteret (0405).
// camelCase DTO ut. ensureTable() self-healer i tilfelle migrasjonen henger.

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";

type SessionUser = { userId: string; email: string; name: string; role: string };

export interface LeadgridCockpitRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
}

function isManagerRole(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return r === "admin" || r === "super_admin" || r === "owner" || r === "sales_manager";
}

function approvalDTO(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    kind: String(row.kind ?? "deal"),
    title: String(row.title ?? ""),
    sellerName: (row.seller_name as string | null) ?? null,
    customerName: (row.customer_name as string | null) ?? null,
    amountNok: Number(row.amount_nok ?? 0),
    rationale: (row.rationale as string | null) ?? null,
    status: String(row.status ?? "pending"),
    comment: (row.comment as string | null) ?? null,
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
  };
}

function coachingDTO(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    memberUserId: (row.member_user_id as string | null) ?? null,
    memberName: String(row.member_name ?? ""),
    scheduledAt: row.scheduled_at ? new Date(String(row.scheduled_at)).toISOString() : null,
    focus: (row.focus as string | null) ?? null,
    status: String(row.status ?? "scheduled"),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
  };
}

export function registerLeadgridCockpitRoutes(deps: LeadgridCockpitRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  let ensured = false;
  async function ensureTables(): Promise<void> {
    if (ensured) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leadgrid_approvals (
        id SERIAL PRIMARY KEY, organization_id VARCHAR(255) NOT NULL,
        kind VARCHAR(16) NOT NULL DEFAULT 'deal', title VARCHAR(255) NOT NULL,
        seller_user_id VARCHAR(255), seller_name VARCHAR(255), customer_name VARCHAR(255),
        amount_nok NUMERIC(12,2) NOT NULL DEFAULT 0, rationale TEXT,
        status VARCHAR(16) NOT NULL DEFAULT 'pending', decided_by VARCHAR(255),
        decided_at TIMESTAMPTZ, comment TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS leadgrid_approvals_org_idx ON leadgrid_approvals (organization_id, status)`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leadgrid_coaching_sessions (
        id SERIAL PRIMARY KEY, organization_id VARCHAR(255) NOT NULL,
        member_user_id VARCHAR(255), member_name VARCHAR(255) NOT NULL,
        scheduled_at TIMESTAMPTZ NOT NULL, focus VARCHAR(500),
        status VARCHAR(16) NOT NULL DEFAULT 'scheduled', created_by VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS leadgrid_coaching_org_idx ON leadgrid_coaching_sessions (organization_id, status, scheduled_at)`);
    ensured = true;
  }

  // ═══════════════ GODKJENNINGSKØ ═══════════════

  // Selger/system: opprett godkjenningssak.
  app.post("/api/leadgrid/approvals", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensureTables();
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const b = (req.body ?? {}) as Record<string, unknown>;
      const kind = ["deal", "discount", "special"].includes(String(b.kind)) ? String(b.kind) : "deal";
      const title = typeof b.title === "string" ? b.title.slice(0, 255) : "";
      if (!title) return res.status(400).json({ error: "missing_title" });
      const { rows } = await pool.query(
        `INSERT INTO leadgrid_approvals
           (organization_id, kind, title, seller_user_id, seller_name, customer_name, amount_nok, rationale, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING *`,
        [orgId, kind, title, session.userId, session.name || null,
         typeof b.customerName === "string" ? b.customerName.slice(0, 255) : null,
         Number.isFinite(Number(b.amountNok)) ? Number(b.amountNok) : 0,
         typeof b.rationale === "string" ? b.rationale.slice(0, 2000) : null],
      );
      return res.json({ approval: approvalDTO(rows[0]) });
    } catch (err) {
      console.error("[leadgrid-cockpit] approval create failed:", err);
      return res.status(500).json({ error: "approval_create_failed" });
    }
  });

  // Leder: ventende godkjenninger.
  app.get("/api/leadgrid/approvals/pending", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isManagerRole(session.role)) return res.status(403).json({ error: "manager_role_required" });
    try {
      await ensureTables();
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const { rows } = await pool.query(
        `SELECT * FROM leadgrid_approvals WHERE organization_id = $1 AND status = 'pending'
          ORDER BY created_at DESC`,
        [orgId],
      );
      return res.json({ approvals: rows.map(approvalDTO) });
    } catch (err) {
      console.error("[leadgrid-cockpit] approvals pending failed:", err);
      return res.status(500).json({ error: "approvals_pending_failed" });
    }
  });

  // Leder: godkjenn / avslå.
  async function decide(req: Request, res: Response, status: "approved" | "rejected") {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isManagerRole(session.role)) return res.status(403).json({ error: "manager_role_required" });
    try {
      await ensureTables();
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
      const comment = typeof (req.body ?? {}).comment === "string" ? (req.body.comment as string).slice(0, 2000) : null;
      const { rows } = await pool.query(
        `UPDATE leadgrid_approvals
            SET status = $1, decided_by = $2, decided_at = NOW(),
                comment = COALESCE($3, comment), updated_at = NOW()
          WHERE id = $4 AND organization_id = $5 AND status = 'pending'
          RETURNING *`,
        [status, session.userId, comment, id, orgId],
      );
      if (rows.length === 0) return res.status(404).json({ error: "not_found_or_decided" });
      return res.json({ approval: approvalDTO(rows[0]) });
    } catch (err) {
      console.error("[leadgrid-cockpit] approval decide failed:", err);
      return res.status(500).json({ error: "approval_decide_failed" });
    }
  }
  app.post("/api/leadgrid/approvals/:id/approve", (req, res) => { void decide(req, res, "approved"); });
  app.post("/api/leadgrid/approvals/:id/reject", (req, res) => { void decide(req, res, "rejected"); });

  // Leder: legg til kommentar uten å avgjøre.
  app.post("/api/leadgrid/approvals/:id/comment", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isManagerRole(session.role)) return res.status(403).json({ error: "manager_role_required" });
    try {
      await ensureTables();
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
      const comment = typeof (req.body ?? {}).comment === "string" ? (req.body.comment as string).slice(0, 2000) : "";
      const { rows } = await pool.query(
        `UPDATE leadgrid_approvals SET comment = $1, updated_at = NOW()
          WHERE id = $2 AND organization_id = $3 RETURNING *`,
        [comment, id, orgId],
      );
      if (rows.length === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ approval: approvalDTO(rows[0]) });
    } catch (err) {
      console.error("[leadgrid-cockpit] approval comment failed:", err);
      return res.status(500).json({ error: "approval_comment_failed" });
    }
  });

  // ═══════════════ COACHING 1-TIL-1 ═══════════════

  // Leder: org-ens planlagte 1-til-1.
  app.get("/api/leadgrid/coaching/sessions", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isManagerRole(session.role)) return res.status(403).json({ error: "manager_role_required" });
    try {
      await ensureTables();
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const { rows } = await pool.query(
        `SELECT * FROM leadgrid_coaching_sessions
          WHERE organization_id = $1 AND status = 'scheduled'
          ORDER BY scheduled_at ASC`,
        [orgId],
      );
      return res.json({ sessions: rows.map(coachingDTO) });
    } catch (err) {
      console.error("[leadgrid-cockpit] coaching list failed:", err);
      return res.status(500).json({ error: "coaching_list_failed" });
    }
  });

  // Leder: planlegg ny 1-til-1.
  app.post("/api/leadgrid/coaching/sessions", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isManagerRole(session.role)) return res.status(403).json({ error: "manager_role_required" });
    try {
      await ensureTables();
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const b = (req.body ?? {}) as Record<string, unknown>;
      const memberName = typeof b.memberName === "string" ? b.memberName.slice(0, 255) : "";
      if (!memberName) return res.status(400).json({ error: "missing_member" });
      const scheduledAt = typeof b.scheduledAt === "string" && !isNaN(Date.parse(b.scheduledAt))
        ? new Date(b.scheduledAt).toISOString()
        : new Date().toISOString();
      const { rows } = await pool.query(
        `INSERT INTO leadgrid_coaching_sessions
           (organization_id, member_user_id, member_name, scheduled_at, focus, status, created_by)
         VALUES ($1,$2,$3,$4,$5,'scheduled',$6) RETURNING *`,
        [orgId, typeof b.memberUserId === "string" ? b.memberUserId : null, memberName,
         scheduledAt, typeof b.focus === "string" ? b.focus.slice(0, 500) : null, session.userId],
      );
      return res.json({ session: coachingDTO(rows[0]) });
    } catch (err) {
      console.error("[leadgrid-cockpit] coaching create failed:", err);
      return res.status(500).json({ error: "coaching_create_failed" });
    }
  });

  // Leder: marker fullført / avlys.
  app.post("/api/leadgrid/coaching/sessions/:id/status", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isManagerRole(session.role)) return res.status(403).json({ error: "manager_role_required" });
    try {
      await ensureTables();
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
      const status = ["done", "cancelled", "scheduled"].includes(String((req.body ?? {}).status))
        ? String(req.body.status) : "done";
      const { rows } = await pool.query(
        `UPDATE leadgrid_coaching_sessions SET status = $1, updated_at = NOW()
          WHERE id = $2 AND organization_id = $3 RETURNING *`,
        [status, id, orgId],
      );
      if (rows.length === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ session: coachingDTO(rows[0]) });
    } catch (err) {
      console.error("[leadgrid-cockpit] coaching status failed:", err);
      return res.status(500).json({ error: "coaching_status_failed" });
    }
  });
}
