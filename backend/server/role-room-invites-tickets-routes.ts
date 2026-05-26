import express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

export interface RoleRoomInvitesTicketsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
  requireAdminSession: (req: any, res: any) => any;
}

export function setupRoleRoomInvitesTicketsRoutes(
  deps: RoleRoomInvitesTicketsRoutesDeps,
): void {
  const { app, pool, requireUserSession, requireAdminSession } = deps;

  async function ensureRoleRoomTesterInvitesTable(): Promise<boolean> {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS role_room_tester_invites (
          id              SERIAL PRIMARY KEY,
          token           TEXT NOT NULL UNIQUE,
          email           TEXT NOT NULL,
          name            TEXT NOT NULL,
          testing_areas   JSONB NOT NULL DEFAULT '[]'::jsonb,
          personal_message TEXT,
          nda_version     VARCHAR(16) NOT NULL DEFAULT '1.0',
          status          VARCHAR(20) NOT NULL DEFAULT 'pending',
          invited_by      TEXT,
          accepted_at     TIMESTAMPTZ,
          accepted_nda_name TEXT,
          expires_at      TIMESTAMPTZ NOT NULL,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      return true;
    } catch (err) {
      console.error("Failed to ensure role_room_tester_invites table:", err);
      return false;
    }
  }

  app.post("/api/role-room/tester-invites", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await ensureRoleRoomTesterInvitesTable())) {
        return res.status(503).json({ error: "Tester invites table unavailable" });
      }
      const body = req.body ?? {};
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const testingAreas = Array.isArray(body.testingAreas) ? body.testingAreas : [];
      const personalMessage = typeof body.personalMessage === "string" ? body.personalMessage : null;
      const ndaVersion = typeof body.ndaVersion === "string" ? body.ndaVersion : "1.0";
      const expiresAtRaw = typeof body.expiresAt === "string" ? body.expiresAt : null;
      const invitedBy = typeof body.invitedBy === "string" ? body.invitedBy : null;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Valid email required" });
      }
      if (!name || name.length < 2) {
        return res.status(400).json({ error: "Name required (min 2 chars)" });
      }
      if (testingAreas.length === 0) {
        return res.status(400).json({ error: "At least one testingArea required" });
      }
      const expiresAt = expiresAtRaw
        ? new Date(expiresAtRaw)
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
        return res.status(400).json({ error: "expiresAt must be a future date" });
      }

      const token = crypto.randomBytes(24).toString("hex");
      const result = await pool.query(
        `INSERT INTO role_room_tester_invites
          (token, email, name, testing_areas, personal_message, nda_version, expires_at, invited_by)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
         RETURNING id, token, expires_at, created_at`,
        [
          token,
          email,
          name,
          JSON.stringify(testingAreas),
          personalMessage,
          ndaVersion,
          expiresAt.toISOString(),
          invitedBy,
        ],
      );
      const row = result.rows[0];
      const baseUrl = req.headers.origin || `https://${req.headers.host || "creatorhubn.com"}`;
      res.json({
        id: String(row.id),
        token: row.token,
        inviteUrl: `${baseUrl}/role-room/accept-invite?token=${encodeURIComponent(row.token)}`,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      });
    } catch (err) {
      console.error("Error creating role-room tester invite:", err);
      res.status(500).json({ error: "Could not create invite" });
    }
  });

  app.get("/api/role-room/tester-invites/:token", async (req, res) => {
    try {
      if (!(await ensureRoleRoomTesterInvitesTable())) {
        return res.status(503).json({ error: "Tester invites table unavailable" });
      }
      const { token } = req.params;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Token required" });
      }
      const result = await pool.query(
        `SELECT id, email, name, testing_areas, personal_message, nda_version, status, expires_at, accepted_at, created_at
         FROM role_room_tester_invites WHERE token = $1 LIMIT 1`,
        [token],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Invite not found" });
      }
      const row = result.rows[0];
      const expired = new Date(row.expires_at).getTime() < Date.now();
      res.json({
        id: String(row.id),
        email: row.email,
        name: row.name,
        testingAreas: row.testing_areas,
        personalMessage: row.personal_message,
        ndaVersion: row.nda_version,
        status: expired && row.status === "pending" ? "expired" : row.status,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at,
        createdAt: row.created_at,
      });
    } catch (err) {
      console.error("Error fetching role-room tester invite:", err);
      res.status(500).json({ error: "Could not fetch invite" });
    }
  });

  app.post("/api/role-room/tester-invites/:token/accept", async (req, res) => {
    try {
      if (!(await ensureRoleRoomTesterInvitesTable())) {
        return res.status(503).json({ error: "Tester invites table unavailable" });
      }
      const { token } = req.params;
      const body = req.body ?? {};
      const ndaName = typeof body.ndaName === "string" ? body.ndaName.trim() : "";
      if (!ndaName || ndaName.length < 2) {
        return res.status(400).json({ error: "NDA signature name required" });
      }
      const existing = await pool.query(
        `SELECT id, status, expires_at FROM role_room_tester_invites WHERE token = $1 LIMIT 1`,
        [token],
      );
      if (existing.rowCount === 0) {
        return res.status(404).json({ error: "Invite not found" });
      }
      const inv = existing.rows[0];
      if (inv.status !== "pending") {
        return res.status(409).json({ error: `Invite already ${inv.status}` });
      }
      if (new Date(inv.expires_at).getTime() < Date.now()) {
        await pool.query(
          `UPDATE role_room_tester_invites SET status = 'expired', updated_at = NOW() WHERE id = $1`,
          [inv.id],
        );
        return res.status(410).json({ error: "Invite has expired" });
      }
      const result = await pool.query(
        `UPDATE role_room_tester_invites
         SET status = 'accepted', accepted_at = NOW(), accepted_nda_name = $1, updated_at = NOW()
         WHERE id = $2 RETURNING accepted_at`,
        [ndaName, inv.id],
      );
      res.json({
        success: true,
        acceptedAt: result.rows[0].accepted_at,
      });
    } catch (err) {
      console.error("Error accepting role-room tester invite:", err);
      res.status(500).json({ error: "Could not accept invite" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // Role Room: Tickets (Sprint 7.2)
  //   POST   /api/role-room/tickets              — create feedback ticket
  //   GET    /api/role-room/tickets               — list tickets (admin)
  //   PATCH  /api/role-room/tickets/:id           — update status/assignment
  // ─────────────────────────────────────────────────────────

  async function ensureRoleRoomTicketsTable(): Promise<boolean> {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS role_room_tickets (
          id              SERIAL PRIMARY KEY,
          category        VARCHAR(24) NOT NULL,
          priority        VARCHAR(16) NOT NULL,
          status          VARCHAR(20) NOT NULL DEFAULT 'open',
          title           TEXT NOT NULL,
          description     TEXT NOT NULL,
          user_id         TEXT,
          user_email      TEXT,
          user_name       TEXT,
          context         JSONB NOT NULL DEFAULT '{}'::jsonb,
          assigned_to     TEXT,
          resolution_note TEXT,
          resolved_at     TIMESTAMPTZ,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      return true;
    } catch (err) {
      console.error("Failed to ensure role_room_tickets table:", err);
      return false;
    }
  }

  const VALID_TICKET_CATEGORIES = new Set(["bug", "feature", "question", "other"]);
  const VALID_TICKET_PRIORITIES = new Set(["low", "medium", "high", "critical"]);
  const VALID_TICKET_STATUSES = new Set(["open", "in_progress", "resolved", "closed"]);

  app.post("/api/role-room/tickets", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      if (!(await ensureRoleRoomTicketsTable())) {
        return res.status(503).json({ error: "Tickets table unavailable" });
      }
      const body = req.body ?? {};
      const category = typeof body.category === "string" ? body.category : "";
      const priority = typeof body.priority === "string" ? body.priority : "";
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const description = typeof body.description === "string" ? body.description.trim() : "";

      if (!VALID_TICKET_CATEGORIES.has(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }
      if (!VALID_TICKET_PRIORITIES.has(priority)) {
        return res.status(400).json({ error: "Invalid priority" });
      }
      if (title.length < 3 || title.length > 200) {
        return res.status(400).json({ error: "Title must be 3-200 chars" });
      }
      if (description.length < 10 || description.length > 5000) {
        return res.status(400).json({ error: "Description must be 10-5000 chars" });
      }

      const user = body.user ?? {};
      const context = body.context ?? {};
      const result = await pool.query(
        `INSERT INTO role_room_tickets
          (category, priority, title, description, user_id, user_email, user_name, context)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         RETURNING id, created_at`,
        [
          category,
          priority,
          title,
          description,
          typeof user.id === "string" ? user.id : null,
          typeof user.email === "string" ? user.email : null,
          typeof user.name === "string" ? user.name : null,
          JSON.stringify(context),
        ],
      );
      const row = result.rows[0];
      res.json({
        id: String(row.id),
        createdAt: row.created_at,
        status: "open",
      });
    } catch (err) {
      console.error("Error creating role-room ticket:", err);
      res.status(500).json({ error: "Could not create ticket" });
    }
  });

  app.get("/api/role-room/tickets", async (req, res) => {
    try {
      if (!(await ensureRoleRoomTicketsTable())) {
        return res.json([]);
      }
      const statusFilter = typeof req.query.status === "string" ? req.query.status : null;
      const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
      const params: unknown[] = [];
      let where = "";
      if (statusFilter && VALID_TICKET_STATUSES.has(statusFilter)) {
        params.push(statusFilter);
        where = `WHERE status = $${params.length}`;
      }
      params.push(limit);
      const result = await pool.query(
        `SELECT id, category, priority, status, title, description, user_id, user_email, user_name,
                context, assigned_to, resolution_note, resolved_at, created_at, updated_at
         FROM role_room_tickets
         ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
        params,
      );
      res.json(
        result.rows.map((r: any) => ({
          id: String(r.id),
          category: r.category,
          priority: r.priority,
          status: r.status,
          title: r.title,
          description: r.description,
          userId: r.user_id,
          userEmail: r.user_email,
          userName: r.user_name,
          context: r.context,
          assignedTo: r.assigned_to,
          resolutionNote: r.resolution_note,
          resolvedAt: r.resolved_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      );
    } catch (err) {
      console.error("Error fetching role-room tickets:", err);
      res.json([]);
    }
  });

  app.patch("/api/role-room/tickets/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await ensureRoleRoomTicketsTable())) {
        return res.status(503).json({ error: "Tickets table unavailable" });
      }
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid ticket id" });
      }
      const body = req.body ?? {};
      const updates: string[] = [];
      const values: unknown[] = [];
      if (typeof body.status === "string" && VALID_TICKET_STATUSES.has(body.status)) {
        values.push(body.status);
        updates.push(`status = $${values.length}`);
        if (body.status === "resolved" || body.status === "closed") {
          updates.push(`resolved_at = NOW()`);
        }
      }
      if (typeof body.assignedTo === "string" || body.assignedTo === null) {
        values.push(body.assignedTo);
        updates.push(`assigned_to = $${values.length}`);
      }
      if (typeof body.resolutionNote === "string") {
        values.push(body.resolutionNote);
        updates.push(`resolution_note = $${values.length}`);
      }
      if (updates.length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      updates.push("updated_at = NOW()");
      values.push(id);
      const result = await pool.query(
        `UPDATE role_room_tickets SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`,
        values,
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      const r = result.rows[0];
      res.json({
        id: String(r.id),
        category: r.category,
        priority: r.priority,
        status: r.status,
        title: r.title,
        description: r.description,
        assignedTo: r.assigned_to,
        resolutionNote: r.resolution_note,
        resolvedAt: r.resolved_at,
        updatedAt: r.updated_at,
      });
    } catch (err) {
      console.error("Error updating role-room ticket:", err);
      res.status(500).json({ error: "Could not update ticket" });
    }
  });
}
