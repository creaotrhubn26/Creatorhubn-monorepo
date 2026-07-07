/**
 * support-tickets-routes.ts — produkt-support (workspace m.fl.).
 *
 * Dedikert løsning, adskilt fra role_room_tickets (The Role Room er et separat
 * produkt). Brukere sender inn via workspace-support-dialogen; admin leser +
 * triagerer i AdminDashboard → «Kundestøtte».
 *
 *   POST  /api/support/tickets        (innlogget bruker) — opprett
 *   GET   /api/support/tickets        (admin)            — kø-liste
 *   PATCH /api/support/tickets/:id     (admin)            — triage
 *
 * Køen inneholder brukeres e-post + kontekst (PII) → GET/PATCH er admin-only.
 */
import type { Pool } from "pg";
import { notifySupportTicket } from "./support-notify";

interface Deps {
  app: any;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
  requireAdminSession: (req: any, res: any) => any;
  sendEmail?: (opts: any) => Promise<any>;
}

export function setupSupportTicketsRoutes(deps: Deps): void {
  const { app, pool, requireUserSession, requireAdminSession, sendEmail } = deps;

  async function ensureTable(): Promise<boolean> {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS support_tickets (
          id              SERIAL PRIMARY KEY,
          source          VARCHAR(32) NOT NULL DEFAULT 'workspace',
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
      console.error("Failed to ensure support_tickets table:", err);
      return false;
    }
  }

  const VALID_CATEGORIES = new Set(["bug", "feature", "question", "other"]);
  const VALID_PRIORITIES = new Set(["low", "medium", "high", "critical"]);
  const VALID_STATUSES = new Set(["open", "in_progress", "resolved", "closed"]);

  const rowDTO = (r: any) => ({
    id: String(r.id),
    source: r.source,
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
  });

  // ── Opprett (innlogget bruker) ──────────────────────────────────────────
  app.post("/api/support/tickets", async (req: any, res: any) => {
    if (!requireUserSession(req, res)) return;
    try {
      if (!(await ensureTable())) {
        return res.status(503).json({ error: "Support table unavailable" });
      }
      const body = req.body ?? {};
      const category = typeof body.category === "string" ? body.category : "";
      const priority = typeof body.priority === "string" ? body.priority : "";
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const description = typeof body.description === "string" ? body.description.trim() : "";
      const source = typeof body?.context?.source === "string" ? String(body.context.source).slice(0, 32) : "workspace";

      if (!VALID_CATEGORIES.has(category)) return res.status(400).json({ error: "Invalid category" });
      if (!VALID_PRIORITIES.has(priority)) return res.status(400).json({ error: "Invalid priority" });
      if (title.length < 3 || title.length > 200) return res.status(400).json({ error: "Title must be 3-200 chars" });
      if (description.length < 10 || description.length > 5000) return res.status(400).json({ error: "Description must be 10-5000 chars" });

      const user = body.user ?? {};
      const context = body.context ?? {};
      const result = await pool.query(
        `INSERT INTO support_tickets
           (source, category, priority, title, description, user_id, user_email, user_name, context)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         RETURNING id, created_at`,
        [
          source,
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
      // Varsle admin (fire-and-forget — blokkerer ikke svaret).
      void notifySupportTicket(sendEmail, pool, {
        id: String(row.id), origin: "Support", category, priority, title, description, source,
        userName: typeof user.name === "string" ? user.name : null,
        userEmail: typeof user.email === "string" ? user.email : null,
        context,
      });
      res.json({ id: String(row.id), createdAt: row.created_at, status: "open" });
    } catch (err) {
      console.error("Error creating support ticket:", err);
      res.status(500).json({ error: "Could not create ticket" });
    }
  });

  // ── Kø-liste (admin) ────────────────────────────────────────────────────
  app.get("/api/support/tickets", async (req: any, res: any) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await ensureTable())) return res.json([]);
      const statusFilter = typeof req.query.status === "string" ? req.query.status : null;
      const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
      const params: unknown[] = [];
      let where = "";
      if (statusFilter && VALID_STATUSES.has(statusFilter)) {
        params.push(statusFilter);
        where = `WHERE status = $${params.length}`;
      }
      params.push(limit);
      const result = await pool.query(
        `SELECT * FROM support_tickets ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
        params,
      );
      res.json(result.rows.map(rowDTO));
    } catch (err) {
      console.error("Error fetching support tickets:", err);
      res.json([]);
    }
  });

  // ── Triage (admin) ──────────────────────────────────────────────────────
  app.patch("/api/support/tickets/:id", async (req: any, res: any) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await ensureTable())) return res.status(503).json({ error: "Support table unavailable" });
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid ticket id" });
      const body = req.body ?? {};
      const updates: string[] = [];
      const values: unknown[] = [];
      if (typeof body.status === "string" && VALID_STATUSES.has(body.status)) {
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
      if (updates.length === 0) return res.status(400).json({ error: "No valid fields to update" });
      updates.push("updated_at = NOW()");
      values.push(id);
      const result = await pool.query(
        `UPDATE support_tickets SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`,
        values,
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "Ticket not found" });
      res.json(rowDTO(result.rows[0]));
    } catch (err) {
      console.error("Error updating support ticket:", err);
      res.status(500).json({ error: "Could not update ticket" });
    }
  });
}
