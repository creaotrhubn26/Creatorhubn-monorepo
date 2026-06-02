import express from "express";
import type { Pool } from "pg";

export interface UniversalCrmRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
}

export function setupUniversalCrmRoutes(deps: UniversalCrmRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  // ── Self-applying, idempotent schema for the CRM workflow-gap features.
  // Mirrors the CREATE TABLE IF NOT EXISTS pattern used across the codebase
  // (ergonomics/marketplace/role-room) rather than the fire-and-forget
  // migrate runner — safer and verifiable (see docs/UNIVERSAL-CRM-WORKFLOW-GAPS.md).
  const ensureCrmExtraSchema = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_invoices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id uuid,
        contract_id uuid,
        invoice_number text,
        description text,
        total_amount numeric DEFAULT 0,
        deposit_amount numeric DEFAULT 0,
        paid_amount numeric DEFAULT 0,
        currency text DEFAULT 'NOK',
        status text DEFAULT 'draft',              -- draft|sent|partial|paid|overdue
        due_date date,
        issued_at timestamptz,
        paid_at timestamptz,
        profession text,
        owner_user_id text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS crm_invoices_customer_idx ON crm_invoices(customer_id);

      CREATE TABLE IF NOT EXISTS crm_meetings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id uuid,
        title text,
        description text,
        location text,
        meet_link text,
        web_view_url text,
        scheduled_at timestamptz,
        duration_minutes int DEFAULT 60,
        profession text,
        owner_user_id text,
        created_at timestamptz DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS crm_meetings_customer_idx ON crm_meetings(customer_id);
      CREATE INDEX IF NOT EXISTS crm_meetings_scheduled_idx ON crm_meetings(scheduled_at);

      CREATE TABLE IF NOT EXISTS event_customer_relations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id text NOT NULL,
        customer_id uuid,
        customer_email text,
        role text DEFAULT 'Client',
        notes text,
        owner_user_id text,
        created_at timestamptz DEFAULT now(),
        UNIQUE (event_id, customer_id)
      );
      CREATE INDEX IF NOT EXISTS event_customer_relations_event_idx ON event_customer_relations(event_id);

      CREATE TABLE IF NOT EXISTS lead_form_tokens (
        token text PRIMARY KEY,
        owner_user_id text NOT NULL,
        profession text,
        created_at timestamptz DEFAULT now()
      );

      ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS owner_user_id text;
      -- Wave 0 multi-tenancy: every CRM-owned table gets an owner so reads can
      -- be scoped per user. Idempotent; safe to run on every boot.
      ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS owner_user_id text;
      -- Wave 1 (#20-lean) — immutable win/loss timestamps, captured on close.
      ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS won_at timestamptz;
      ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS lost_at timestamptz;
      ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS lost_reason text;
      ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS owner_user_id text;
      ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS owner_user_id text;
      -- Wave 1: staleness signal — bumped on every activity insert (#35).
      ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS last_contact timestamptz;
      -- Wave 2: post-delivery lifecycle + rebook loop (#8/#21/#24).
      ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS lifecycle_stage text;
      ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS last_delivered_at timestamptz;
      ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS next_rebook_due_at timestamptz;
      ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz;
      CREATE INDEX IF NOT EXISTS crm_customers_owner_idx ON crm_customers(owner_user_id);
      CREATE INDEX IF NOT EXISTS crm_deals_owner_idx ON crm_deals(owner_user_id);
      CREATE INDEX IF NOT EXISTS crm_activities_owner_idx ON crm_activities(owner_user_id);
      CREATE INDEX IF NOT EXISTS crm_tasks_owner_idx ON crm_tasks(owner_user_id);
    `);
  };
  ensureCrmExtraSchema().catch((e) =>
    console.error("CRM extra-schema bootstrap failed:", e),
  );

  // ── Wave 2 automation engine (#9/#21/#24) ────────────────────────────
  // Idempotent sweep: for every customer whose rebook window has arrived and
  // who has no open rebook task, create one (throttled via last_reminded_at so
  // we never spam). This is the motor that turns "delivered 11 months ago"
  // into a concrete follow-up instead of a lead rotting in silence.
  const runCrmAutomationSweep = async (): Promise<{ rebookTasks: number }> => {
    try {
      const due = await pool.query(
        `SELECT id, owner_user_id, name FROM crm_customers
         WHERE next_rebook_due_at IS NOT NULL
           AND next_rebook_due_at <= now()
           AND status <> 'archived'
           AND (last_reminded_at IS NULL OR last_reminded_at < now() - interval '30 days')`,
      );
      let created = 0;
      for (const c of due.rows) {
        const ins = await pool.query(
          `INSERT INTO crm_tasks (id, customer_id, title, description, priority, status, due_date, owner_user_id, created_at, updated_at)
           SELECT gen_random_uuid(), $1, 'Følg opp gjenbestilling', 'Det er ~1 år siden levering — foreslå ny fotografering.', 'medium', 'pending', now() + interval '7 days', $2, now(), now()
           WHERE NOT EXISTS (
             SELECT 1 FROM crm_tasks WHERE customer_id = $1 AND owner_user_id = $2 AND status = 'pending' AND title = 'Følg opp gjenbestilling'
           ) RETURNING id`,
          [c.id, c.owner_user_id],
        );
        if (ins.rows.length > 0) {
          created++;
          await pool.query(
            `UPDATE crm_customers SET last_reminded_at = now(), lifecycle_stage = 'rebook-window' WHERE id = $1`,
            [c.id],
          );
        }
      }
      return { rebookTasks: created };
    } catch (e) {
      console.error("CRM automation sweep failed:", e);
      return { rebookTasks: 0 };
    }
  };
  // Hourly scheduler (best-effort; idempotent + throttled so duplicate boots
  // are harmless). Mirrors the other worker loops in this server.
  const automationTimer = setInterval(() => { void runCrmAutomationSweep(); }, 60 * 60 * 1000);
  automationTimer.unref?.();
  console.log("[crm-automation] sweep loop started (hourly)");

  app.get("/api/universal-crm/customers", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const {
        profession,
        search,
        status,
        limit = "100",
        offset = "0",
      } = req.query as Record<string, string>;

      // Wave 0 — tenant isolation: only the signed-in owner's customers.
      let where = "WHERE owner_user_id = $1";
      const params: any[] = [session.userId];
      let idx = 2;

      if (profession) {
        where += ` AND profession = $${idx++}`;
        params.push(profession);
      }
      if (status) {
        where += ` AND status = $${idx++}`;
        params.push(status);
      }
      if (search) {
        where += ` AND (name ILIKE $${idx} OR email ILIKE $${idx} OR company ILIKE $${idx})`;
        params.push(`%${search}%`);
        idx++;
      }

      const countResult = await pool.query(
        `SELECT count(*) as total FROM crm_customers ${where}`,
        params,
      );

      const rows = await pool.query(
        `SELECT * FROM crm_customers ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, parseInt(limit) || 100, parseInt(offset) || 0],
      );

      // Map DB snake_case to camelCase for the frontend
      const customers = rows.rows.map((r: any) => ({
        id: r.id,
        name: r.name || "",
        email: r.email || "",
        phone: r.phone || "",
        company: r.company || "",
        profession: r.profession || "",
        projectType: r.project_type || "",
        budget: r.budget ? parseFloat(r.budget) : undefined,
        status: r.status || "lead",
        tags: r.tags || [],
        notes: r.notes || "",
        source: r.source || "",
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        customFields: r.custom_fields || {},
        projectId: r.project_id || null,
      }));

      return res.json({ customers, total: parseInt(countResult.rows[0].total) });
    } catch (error) {
      console.error("CRM customers list error:", error);
      return res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  /**
   * GET /api/universal-crm/customers/:id
   * Get a single customer with project link
   */
  app.get("/api/universal-crm/customers/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        "SELECT c.*, p.name as project_name, p.status as project_status FROM crm_customers c LEFT JOIN legacy.projects p ON c.project_id = p.id WHERE c.id = $1 AND c.owner_user_id = $2",
        [req.params.id, session.userId],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Customer not found" });
      }
      const r = result.rows[0];
      return res.json({
        id: r.id,
        name: r.name || "",
        email: r.email || "",
        phone: r.phone || "",
        company: r.company || "",
        profession: r.profession || "",
        projectType: r.project_type || "",
        budget: r.budget ? parseFloat(r.budget) : undefined,
        status: r.status || "lead",
        tags: r.tags || [],
        notes: r.notes || "",
        source: r.source || "",
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        customFields: r.custom_fields || {},
        projectId: r.project_id || null,
        project: r.project_id
          ? {
              id: r.project_id,
              name: r.project_name || "",
              status: r.project_status || "",
            }
          : null,
      });
    } catch (error) {
      console.error("CRM customer fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  /**
   * POST /api/universal-crm/customers
   * Create a new CRM customer
   */
  app.post("/api/universal-crm/customers", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const {
        name,
        email,
        phone,
        company,
        profession,
        projectType,
        budget,
        status,
        tags,
        notes,
        source,
        customFields,
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      const result = await pool.query(
        `INSERT INTO crm_customers (id, name, email, phone, company, profession, project_type, budget, status, tags, notes, source, custom_fields, owner_user_id, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), now())
         RETURNING *`,
        [
          name,
          email || null,
          phone || null,
          company || null,
          profession || null,
          projectType || null,
          budget || null,
          status || "lead",
          tags || null,
          notes || null,
          source || null,
          JSON.stringify(customFields || {}),
          session.userId,
        ],
      );

      const r = result.rows[0];
      const customer = {
        id: r.id,
        name: r.name,
        email: r.email || "",
        phone: r.phone || "",
        company: r.company || "",
        profession: r.profession || "",
        projectType: r.project_type || "",
        budget: r.budget ? parseFloat(r.budget) : undefined,
        status: r.status,
        tags: r.tags || [],
        notes: r.notes || "",
        source: r.source || "",
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        customFields: r.custom_fields || {},
        projectId: r.project_id || null,
      };

      return res.status(201).json({ customer });
    } catch (error) {
      console.error("CRM customer create error:", error);
      return res.status(500).json({ error: "Failed to create customer" });
    }
  });

  /**
   * PUT /api/universal-crm/customers/:id
   * Update a customer
   */
  app.put("/api/universal-crm/customers/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const { id } = req.params;
      const updates = req.body;

      // Build SET clause dynamically from provided fields
      const fieldMap: Record<string, string> = {
        name: "name",
        email: "email",
        phone: "phone",
        company: "company",
        profession: "profession",
        projectType: "project_type",
        budget: "budget",
        status: "status",
        tags: "tags",
        notes: "notes",
        source: "source",
        customFields: "custom_fields",
      };

      const setClauses: string[] = ["updated_at = now()"];
      const params: any[] = [];
      let idx = 1;

      for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
        if (updates[jsKey] !== undefined) {
          setClauses.push(`${dbCol} = $${idx++}`);
          params.push(
            dbCol === "custom_fields"
              ? JSON.stringify(updates[jsKey])
              : updates[jsKey],
          );
        }
      }

      params.push(id);
      params.push(session.userId);
      const result = await pool.query(
        `UPDATE crm_customers SET ${setClauses.join(", ")} WHERE id = $${idx} AND owner_user_id = $${idx + 1} RETURNING *`,
        params,
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // #8/#38 — delivery trigger: completing a customer starts the post-
      // delivery lifecycle (review request now, rebook nudge in ~11 months).
      if (updates.status === "completed") {
        await pool.query(
          `UPDATE crm_customers
             SET lifecycle_stage = 'delivered', last_delivered_at = now(),
                 next_rebook_due_at = now() + interval '11 months'
           WHERE id = $1 AND owner_user_id = $2`,
          [id, session.userId],
        ).catch((e) => console.warn("lifecycle set skipped:", e));
        // Create a review-request task if none open for this customer.
        await pool.query(
          `INSERT INTO crm_tasks (id, customer_id, title, description, priority, status, due_date, owner_user_id, created_at, updated_at)
           SELECT gen_random_uuid(), $1, 'Be om anmeldelse', 'Leveranse fullført — be kunden om en anmeldelse.', 'medium', 'pending', now() + interval '3 days', $2, now(), now()
           WHERE NOT EXISTS (
             SELECT 1 FROM crm_tasks WHERE customer_id = $1 AND owner_user_id = $2 AND status = 'pending' AND title = 'Be om anmeldelse'
           )`,
          [id, session.userId],
        ).catch((e) => console.warn("review task skipped:", e));
      }

      const r = result.rows[0];
      return res.json({
        id: r.id,
        name: r.name || "",
        email: r.email || "",
        phone: r.phone || "",
        company: r.company || "",
        profession: r.profession || "",
        projectType: r.project_type || "",
        budget: r.budget ? parseFloat(r.budget) : undefined,
        status: r.status || "lead",
        tags: r.tags || [],
        notes: r.notes || "",
        source: r.source || "",
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        customFields: r.custom_fields || {},
        projectId: r.project_id || null,
      });
    } catch (error) {
      console.error("CRM customer update error:", error);
      return res.status(500).json({ error: "Failed to update customer" });
    }
  });

  /**
   * DELETE /api/universal-crm/customers/:id
   * Delete a customer
   */
  app.delete("/api/universal-crm/customers/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        "DELETE FROM crm_customers WHERE id = $1 AND owner_user_id = $2 RETURNING id",
        [req.params.id, session.userId],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Customer not found" });
      }
      return res.json({ success: true, id: req.params.id });
    } catch (error) {
      console.error("CRM customer delete error:", error);
      return res.status(500).json({ error: "Failed to delete customer" });
    }
  });

  /**
   * GET /api/universal-crm/customers/:id/overview
   * Wave 1 (#2) — everything about one customer in a single owner-scoped
   * round-trip: the record + deals + tasks + invoices + meetings + the
   * activity timeline. Powers the CustomerDetailDrawer.
   */
  app.get("/api/universal-crm/customers/:id/overview", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const id = req.params.id;
      const owner = session.userId;
      const cust = await pool.query(
        `SELECT * FROM crm_customers WHERE id = $1 AND owner_user_id = $2`,
        [id, owner],
      );
      if (cust.rows.length === 0) {
        return res.status(404).json({ error: "Customer not found" });
      }
      const c = cust.rows[0];
      const [deals, tasks, invoices, meetings, activities] = await Promise.all([
        pool.query(`SELECT * FROM crm_deals WHERE customer_id = $1 AND owner_user_id = $2 ORDER BY created_at DESC`, [id, owner]),
        pool.query(`SELECT * FROM crm_tasks WHERE customer_id = $1 AND owner_user_id = $2 ORDER BY due_date ASC NULLS LAST`, [id, owner]),
        pool.query(`SELECT * FROM crm_invoices WHERE customer_id = $1 AND owner_user_id = $2 ORDER BY created_at DESC`, [id, owner]).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM crm_meetings WHERE customer_id = $1 AND owner_user_id = $2 ORDER BY scheduled_at DESC NULLS LAST`, [id, owner]).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM crm_activities WHERE customer_id = $1 AND owner_user_id = $2 ORDER BY created_at DESC LIMIT 200`, [id, owner]),
      ]);

      // Build a unified reverse-chronological timeline from activities +
      // derived events (deal stage, invoice issued/paid, meeting scheduled).
      const timeline: any[] = [];
      for (const a of activities.rows) {
        timeline.push({ kind: "activity", type: a.type, title: a.subject, detail: a.description, direction: a.direction, at: a.scheduled_at || a.created_at });
      }
      for (const d of deals.rows) {
        timeline.push({ kind: "deal", type: d.stage, title: `Deal: ${d.title}`, detail: d.value ? `${Number(d.value).toLocaleString("nb-NO")} ${d.currency || "NOK"}` : null, at: d.created_at });
      }
      for (const inv of invoices.rows) {
        timeline.push({ kind: "invoice", type: inv.status, title: `Faktura ${inv.invoice_number || ""}`.trim(), detail: `NOK ${Number(inv.total_amount || 0).toLocaleString("nb-NO")}`, at: inv.issued_at || inv.created_at });
      }
      for (const m of meetings.rows) {
        timeline.push({ kind: "meeting", type: "meeting", title: m.title || "Møte", detail: m.location, at: m.scheduled_at || m.created_at });
      }
      timeline.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

      return res.json({
        customer: {
          id: c.id, name: c.name, email: c.email, phone: c.phone, company: c.company,
          status: c.status, projectType: c.project_type, budget: c.budget ? parseFloat(c.budget) : null,
          source: c.source, tags: c.tags || [], notes: c.notes, lastContact: c.last_contact,
          createdAt: c.created_at,
        },
        deals: deals.rows,
        tasks: tasks.rows,
        invoices: invoices.rows,
        meetings: meetings.rows,
        timeline,
      });
    } catch (error) {
      console.error("CRM customer overview error:", error);
      return res.status(500).json({ error: "Failed to fetch overview" });
    }
  });

  /**
   * GET /api/universal-crm/stats
   * CRM dashboard statistics
   */
  app.get("/api/universal-crm/stats", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const { profession } = req.query as Record<string, string>;
      // Wave 0 — every aggregate is owner-scoped ($1); profession is optional $2.
      const owner = session.userId;
      const profFilter = profession ? " AND profession = $2" : "";
      const custParams = profession ? [owner, profession] : [owner];

      const total = await pool.query(
        `SELECT count(*) as total FROM crm_customers WHERE owner_user_id = $1${profFilter}`,
        custParams,
      );

      const byStatus = await pool.query(
        `SELECT status, count(*) as count FROM crm_customers WHERE owner_user_id = $1${profFilter} GROUP BY status`,
        custParams,
      );

      const recentlyAdded = await pool.query(
        `SELECT count(*) as count FROM crm_customers WHERE owner_user_id = $1 AND created_at > now() - interval '30 days'${profFilter}`,
        custParams,
      );

      const byProfession = await pool.query(
        `SELECT profession, count(*) as count FROM crm_customers WHERE owner_user_id = $1 AND profession IS NOT NULL${profFilter} GROUP BY profession ORDER BY count DESC`,
        custParams,
      );

      // Deal stats — owner-scoped
      const dealStats = await pool.query(
        `SELECT count(*) as total, COALESCE(sum(value), 0) as total_value,
                count(*) FILTER (WHERE stage = 'closed_won') as won,
                count(*) FILTER (WHERE stage = 'closed_lost') as lost
         FROM crm_deals WHERE owner_user_id = $1`,
        [owner],
      );

      // Task stats — owner-scoped, with overdue/due-today for the inbox badge (#37)
      const taskStats = await pool.query(
        `SELECT count(*) as total,
                count(*) FILTER (WHERE status = 'pending') as pending,
                count(*) FILTER (WHERE status = 'completed') as completed,
                count(*) FILTER (WHERE status = 'pending' AND due_date IS NOT NULL AND due_date < CURRENT_DATE) as overdue,
                count(*) FILTER (WHERE status = 'pending' AND due_date::date = CURRENT_DATE) as due_today
         FROM crm_tasks WHERE owner_user_id = $1`,
        [owner],
      );

      // Invoice / accounts-receivable stats (#10/#11), owner-scoped. Guarded so
      // a missing table (pre-bootstrap) never breaks the whole stats endpoint.
      let invoiceRow: any = { total: 0, billed: 0, collected: 0, outstanding: 0, overdue: 0 };
      try {
        const invoiceStats = await pool.query(
          `SELECT count(*) as total,
                  COALESCE(sum(total_amount), 0) as billed,
                  COALESCE(sum(paid_amount), 0) as collected,
                  COALESCE(sum(total_amount - paid_amount) FILTER (WHERE status <> 'paid'), 0) as outstanding,
                  count(*) FILTER (WHERE status <> 'paid' AND due_date IS NOT NULL AND due_date < CURRENT_DATE) as overdue
           FROM crm_invoices WHERE owner_user_id = $1`,
          [owner],
        );
        invoiceRow = invoiceStats.rows[0];
      } catch (e) {
        console.warn("Invoice stats skipped (table may not exist yet):", e);
      }

      const statusMap: Record<string, number> = {};
      byStatus.rows.forEach((r: any) => {
        statusMap[r.status || "unknown"] = parseInt(r.count);
      });

      const professionMap: Record<string, number> = {};
      byProfession.rows.forEach((r: any) => {
        professionMap[r.profession || "unknown"] = parseInt(r.count);
      });

      return res.json({
        stats: {
          total: parseInt(total.rows[0].total),
          byStatus: statusMap,
          byProfession: professionMap,
          recentlyAdded: parseInt(recentlyAdded.rows[0].count),
          deals: {
            total: parseInt(dealStats.rows[0].total),
            totalValue: parseFloat(dealStats.rows[0].total_value),
            won: parseInt(dealStats.rows[0].won),
            lost: parseInt(dealStats.rows[0].lost),
          },
          tasks: {
            total: parseInt(taskStats.rows[0].total),
            pending: parseInt(taskStats.rows[0].pending),
            completed: parseInt(taskStats.rows[0].completed),
            overdue: parseInt(taskStats.rows[0].overdue),
            dueToday: parseInt(taskStats.rows[0].due_today),
          },
          invoices: {
            total: parseInt(invoiceRow.total),
            billed: parseFloat(invoiceRow.billed),
            collected: parseFloat(invoiceRow.collected),
            outstanding: parseFloat(invoiceRow.outstanding),
            overdue: parseInt(invoiceRow.overdue),
          },
        },
      });
    } catch (error) {
      console.error("CRM stats error:", error);
      return res.status(500).json({ error: "Failed to fetch CRM stats" });
    }
  });

  // ============================================================
  // CRM Deals API – /api/universal-crm/deals/*
  // ============================================================

  app.get("/api/universal-crm/deals", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const {
        customer_id,
        stage,
        limit = "50",
      } = req.query as Record<string, string>;
      let where = "WHERE d.owner_user_id = $1";
      const params: any[] = [session.userId];
      let idx = 2;
      if (customer_id) {
        where += ` AND d.customer_id = $${idx++}`;
        params.push(customer_id);
      }
      if (stage) {
        where += ` AND d.stage = $${idx++}`;
        params.push(stage);
      }

      const rows = await pool.query(
        `SELECT d.*, c.name AS customer_name, c.email AS customer_email
         FROM crm_deals d LEFT JOIN crm_customers c ON c.id = d.customer_id
         ${where} ORDER BY d.created_at DESC LIMIT $${idx}`,
        [...params, parseInt(limit) || 200],
      );
      return res.json({ deals: rows.rows });
    } catch (error) {
      console.error("CRM deals error:", error);
      return res.status(500).json({ error: "Failed to fetch deals" });
    }
  });

  app.post("/api/universal-crm/deals", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const {
        customerId,
        customer_id: cid,
        title,
        value,
        currency,
        stage,
        probability,
        expectedCloseDate,
        expected_close_date: ecd,
        assignedTo,
        assigned_to: ato,
        serviceType,
        service_type: st,
        notes,
      } = req.body;
      const customer_id = customerId || cid || null;
      const expected_close_date = expectedCloseDate || ecd || null;
      const assigned_to = assignedTo || ato || null;
      const service_type = serviceType || st || null;
      if (!title) return res.status(400).json({ error: "Title is required" });

      const result = await pool.query(
        `INSERT INTO crm_deals (id, customer_id, title, value, currency, stage, probability, expected_close_date, assigned_to, service_type, notes, owner_user_id, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now()) RETURNING *`,
        [
          customer_id || null,
          title,
          value || 0,
          currency || "NOK",
          stage || "prospecting",
          probability || 50,
          expected_close_date || null,
          assigned_to || null,
          service_type || null,
          notes || null,
          session.userId,
        ],
      );
      return res.status(201).json({ deal: result.rows[0] });
    } catch (error) {
      console.error("CRM deal create error:", error);
      return res.status(500).json({ error: "Failed to create deal" });
    }
  });

  app.put("/api/universal-crm/deals/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const allowed = [
        "customer_id",
        "title",
        "value",
        "currency",
        "stage",
        "probability",
        "expected_close_date",
        "assigned_to",
        "service_type",
        "notes",
      ];
      const setClauses = ["updated_at = now()"];
      const params: any[] = [];
      let idx = 1;
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          setClauses.push(`${key} = $${idx++}`);
          params.push(req.body[key]);
        }
      }
      // #20-lean — stamp the immutable close moment when the stage closes.
      if (req.body.stage === "closed_won") setClauses.push("won_at = COALESCE(won_at, now())");
      if (req.body.stage === "closed_lost") setClauses.push("lost_at = COALESCE(lost_at, now())");
      params.push(req.params.id);
      params.push(session.userId);
      const result = await pool.query(
        `UPDATE crm_deals SET ${setClauses.join(", ")} WHERE id = $${idx} AND owner_user_id = $${idx + 1} RETURNING *`,
        params,
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Deal not found" });
      return res.json({ deal: result.rows[0] });
    } catch (error) {
      console.error("CRM deal update error:", error);
      return res.status(500).json({ error: "Failed to update deal" });
    }
  });

  // #46 — single deal with customer + its activities/tasks.
  app.get("/api/universal-crm/deals/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const deal = await pool.query(
        `SELECT d.*, c.name AS customer_name, c.email AS customer_email
         FROM crm_deals d LEFT JOIN crm_customers c ON c.id = d.customer_id
         WHERE d.id = $1 AND d.owner_user_id = $2`,
        [req.params.id, session.userId],
      );
      if (deal.rows.length === 0)
        return res.status(404).json({ error: "Deal not found" });
      const [tasks, activities] = await Promise.all([
        pool.query(`SELECT * FROM crm_tasks WHERE deal_id = $1 AND owner_user_id = $2 ORDER BY due_date ASC NULLS LAST`, [req.params.id, session.userId]),
        pool.query(`SELECT * FROM crm_activities WHERE deal_id = $1 AND owner_user_id = $2 ORDER BY created_at DESC`, [req.params.id, session.userId]),
      ]);
      return res.json({ deal: deal.rows[0], tasks: tasks.rows, activities: activities.rows });
    } catch (error) {
      console.error("CRM deal get error:", error);
      return res.status(500).json({ error: "Failed to fetch deal" });
    }
  });

  // #46 — delete a deal (owner-scoped).
  app.delete("/api/universal-crm/deals/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM crm_deals WHERE id = $1 AND owner_user_id = $2 RETURNING id`,
        [req.params.id, session.userId],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Deal not found" });
      return res.json({ success: true, id: req.params.id });
    } catch (error) {
      console.error("CRM deal delete error:", error);
      return res.status(500).json({ error: "Failed to delete deal" });
    }
  });

  // ============================================================
  // CRM Activities API – /api/universal-crm/activities/*
  // ============================================================

  app.get("/api/universal-crm/activities", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const {
        customer_id,
        deal_id,
        type,
        limit = "50",
      } = req.query as Record<string, string>;
      let where = "WHERE owner_user_id = $1";
      const params: any[] = [session.userId];
      let idx = 2;
      if (customer_id) {
        where += ` AND customer_id = $${idx++}`;
        params.push(customer_id);
      }
      if (deal_id) {
        where += ` AND deal_id = $${idx++}`;
        params.push(deal_id);
      }
      if (type) {
        where += ` AND type = $${idx++}`;
        params.push(type);
      }

      const rows = await pool.query(
        `SELECT * FROM crm_activities ${where} ORDER BY created_at DESC LIMIT $${idx}`,
        [...params, parseInt(limit) || 50],
      );
      return res.json({ activities: rows.rows });
    } catch (error) {
      console.error("CRM activities error:", error);
      return res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  app.post("/api/universal-crm/activities", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const {
        customerId,
        customer_id: cid,
        dealId,
        deal_id: did,
        type,
        subject,
        description,
        scheduledAt,
        scheduled_at: sa,
        direction,
        outcome,
      } = req.body;
      const customer_id = customerId || cid || null;
      const deal_id = dealId || did || null;
      const scheduled_at = scheduledAt || sa || null;
      if (!type || !subject)
        return res.status(400).json({ error: "Type and subject are required" });

      const result = await pool.query(
        `INSERT INTO crm_activities (id, customer_id, deal_id, type, subject, description, scheduled_at, direction, outcome, owner_user_id, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now()) RETURNING *`,
        [
          customer_id || null,
          deal_id || null,
          type,
          subject,
          description || null,
          scheduled_at || null,
          direction || null,
          outcome || null,
          session.userId,
        ],
      );
      // #35 — bump the customer's last-contacted timestamp (owner-scoped).
      if (customer_id) {
        await pool.query(
          `UPDATE crm_customers SET last_contact = now() WHERE id = $1 AND owner_user_id = $2`,
          [customer_id, session.userId],
        ).catch(() => { /* best-effort */ });
      }
      return res.status(201).json({ activity: result.rows[0] });
    } catch (error) {
      console.error("CRM activity create error:", error);
      return res.status(500).json({ error: "Failed to create activity" });
    }
  });

  // ============================================================
  // CRM Tasks API – /api/universal-crm/tasks/*
  // ============================================================

  app.get("/api/universal-crm/tasks", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const {
        customer_id,
        status,
        assigned_to,
        limit = "50",
      } = req.query as Record<string, string>;
      let where = "WHERE owner_user_id = $1";
      const params: any[] = [session.userId];
      let idx = 2;
      if (customer_id) {
        where += ` AND customer_id = $${idx++}`;
        params.push(customer_id);
      }
      if (status) {
        where += ` AND status = $${idx++}`;
        params.push(status);
      }
      if (assigned_to) {
        where += ` AND assigned_to = $${idx++}`;
        params.push(assigned_to);
      }

      const rows = await pool.query(
        `SELECT * FROM crm_tasks ${where} ORDER BY due_date ASC NULLS LAST, created_at DESC LIMIT $${idx}`,
        [...params, parseInt(limit) || 50],
      );
      return res.json({ tasks: rows.rows });
    } catch (error) {
      console.error("CRM tasks error:", error);
      return res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/api/universal-crm/tasks", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const {
        customerId,
        customer_id: cid,
        dealId,
        deal_id: did,
        title,
        description,
        assignedTo,
        assigned_to: ato,
        priority,
        status,
        dueDate,
        due_date: dd,
      } = req.body;
      const customer_id = customerId || cid || null;
      const deal_id = dealId || did || null;
      const assigned_to = assignedTo || ato || null;
      const due_date = dueDate || dd || null;
      if (!title) return res.status(400).json({ error: "Title is required" });

      const result = await pool.query(
        `INSERT INTO crm_tasks (id, customer_id, deal_id, title, description, assigned_to, priority, status, due_date, owner_user_id, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now()) RETURNING *`,
        [
          customer_id || null,
          deal_id || null,
          title,
          description || null,
          assigned_to || null,
          priority || "medium",
          status || "pending",
          due_date || null,
          session.userId,
        ],
      );
      return res.status(201).json({ task: result.rows[0] });
    } catch (error) {
      console.error("CRM task create error:", error);
      return res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.put("/api/universal-crm/tasks/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const allowed = [
        "customer_id",
        "deal_id",
        "title",
        "description",
        "assigned_to",
        "priority",
        "status",
        "due_date",
        "completed_at",
      ];
      const setClauses = ["updated_at = now()"];
      const params: any[] = [];
      let idx = 1;
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          setClauses.push(`${key} = $${idx++}`);
          params.push(req.body[key]);
        }
      }
      params.push(req.params.id);
      params.push(session.userId);
      const result = await pool.query(
        `UPDATE crm_tasks SET ${setClauses.join(", ")} WHERE id = $${idx} AND owner_user_id = $${idx + 1} RETURNING *`,
        params,
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Task not found" });
      return res.json({ task: result.rows[0] });
    } catch (error) {
      console.error("CRM task update error:", error);
      return res.status(500).json({ error: "Failed to update task" });
    }
  });

  // ============================================================
  // CRM Pipeline Stages API
  // ============================================================

  app.get("/api/universal-crm/pipeline-stages", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const rows = await pool.query(
        "SELECT * FROM crm_pipeline_stages WHERE is_active = true ORDER BY position ASC",
      );
      return res.json({ stages: rows.rows });
    } catch (error) {
      console.error("CRM pipeline stages error:", error);
      return res.status(500).json({ error: "Failed to fetch pipeline stages" });
    }
  });

  app.post("/api/universal-crm/pipeline-stages", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const { name, description, position, color } = req.body;
      if (!name) return res.status(400).json({ error: "Name is required" });
      const maxPos = await pool.query(
        "SELECT COALESCE(max(position), 0) + 1 as next FROM crm_pipeline_stages",
      );
      const result = await pool.query(
        `INSERT INTO crm_pipeline_stages (id, name, description, position, color, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, now(), now()) RETURNING *`,
        [
          name,
          description || null,
          position || maxPos.rows[0].next,
          color || "#3B82F6",
        ],
      );
      return res.status(201).json({ stage: result.rows[0] });
    } catch (error) {
      console.error("CRM pipeline stage create error:", error);
      return res.status(500).json({ error: "Failed to create pipeline stage" });
    }
  });

  // ============================================================
  // CRM Email Templates API
  // ============================================================

  app.get("/api/universal-crm/email-templates", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const rows = await pool.query(
        "SELECT * FROM crm_email_templates WHERE is_active = true ORDER BY name ASC",
      );
      return res.json({ templates: rows.rows });
    } catch (error) {
      console.error("CRM email templates error:", error);
      return res.status(500).json({ error: "Failed to fetch email templates" });
    }
  });

  // ============================================================
  // CRM Invoices API – #9/#10 manual invoice + payment-status tracking
  // ============================================================

  const mapInvoice = (r: any) => ({
    id: r.id,
    customerId: r.customer_id,
    contractId: r.contract_id,
    invoiceNumber: r.invoice_number,
    description: r.description || "",
    totalAmount: r.total_amount != null ? parseFloat(r.total_amount) : 0,
    depositAmount: r.deposit_amount != null ? parseFloat(r.deposit_amount) : 0,
    paidAmount: r.paid_amount != null ? parseFloat(r.paid_amount) : 0,
    balanceDue:
      (r.total_amount != null ? parseFloat(r.total_amount) : 0) -
      (r.paid_amount != null ? parseFloat(r.paid_amount) : 0),
    currency: r.currency || "NOK",
    status: r.status || "draft",
    dueDate: r.due_date,
    issuedAt: r.issued_at,
    paidAt: r.paid_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });

  app.get("/api/universal-crm/invoices", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const { customer_id } = req.query as Record<string, string>;
      const where = customer_id
        ? "WHERE owner_user_id = $1 AND customer_id = $2"
        : "WHERE owner_user_id = $1";
      const params = customer_id ? [session.userId, customer_id] : [session.userId];
      const rows = await pool.query(
        `SELECT * FROM crm_invoices ${where} ORDER BY created_at DESC`,
        params,
      );
      return res.json({ invoices: rows.rows.map(mapInvoice) });
    } catch (error) {
      console.error("CRM invoices list error:", error);
      return res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.post("/api/universal-crm/invoices", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const {
        customerId,
        contractId,
        description,
        totalAmount,
        depositAmount,
        dueDate,
        profession,
      } = req.body;
      // Human-friendly sequential-ish invoice number.
      const seq = await pool.query(
        `SELECT count(*) + 1 AS n FROM crm_invoices`,
      );
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(seq.rows[0].n).padStart(4, "0")}`;
      const result = await pool.query(
        `INSERT INTO crm_invoices (id, customer_id, contract_id, invoice_number, description, total_amount, deposit_amount, paid_amount, status, due_date, issued_at, profession, owner_user_id, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 0, 'sent', $7, now(), $8, $9, now(), now()) RETURNING *`,
        [
          customerId || null,
          contractId || null,
          invoiceNumber,
          description || null,
          totalAmount || 0,
          depositAmount || 0,
          dueDate || null,
          profession || null,
          session.userId,
        ],
      );
      return res.status(201).json({ invoice: mapInvoice(result.rows[0]) });
    } catch (error) {
      console.error("CRM invoice create error:", error);
      return res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  // Update an invoice — primarily to record payments / change status.
  app.put("/api/universal-crm/invoices/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const { paidAmount, status, dueDate, description, totalAmount } = req.body;
      const setClauses: string[] = ["updated_at = now()"];
      const params: any[] = [];
      let idx = 1;
      if (paidAmount !== undefined) {
        setClauses.push(`paid_amount = $${idx++}`);
        params.push(paidAmount);
      }
      if (totalAmount !== undefined) {
        setClauses.push(`total_amount = $${idx++}`);
        params.push(totalAmount);
      }
      if (description !== undefined) {
        setClauses.push(`description = $${idx++}`);
        params.push(description);
      }
      if (dueDate !== undefined) {
        setClauses.push(`due_date = $${idx++}`);
        params.push(dueDate || null);
      }
      if (status !== undefined) {
        setClauses.push(`status = $${idx++}`);
        params.push(status);
        if (status === "paid") setClauses.push("paid_at = now()");
      }
      params.push(req.params.id);
      params.push(session.userId);
      const result = await pool.query(
        `UPDATE crm_invoices SET ${setClauses.join(", ")} WHERE id = $${idx} AND owner_user_id = $${idx + 1} RETURNING *`,
        params,
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Invoice not found" });
      // Auto-resolve status from amounts when not explicitly set.
      const inv = mapInvoice(result.rows[0]);
      if (status === undefined) {
        const newStatus =
          inv.paidAmount <= 0
            ? "sent"
            : inv.paidAmount >= inv.totalAmount
              ? "paid"
              : "partial";
        if (newStatus !== inv.status) {
          await pool.query(
            `UPDATE crm_invoices SET status = $1${newStatus === "paid" ? ", paid_at = now()" : ""} WHERE id = $2`,
            [newStatus, req.params.id],
          );
          inv.status = newStatus;
        }
      }
      return res.json({ invoice: inv });
    } catch (error) {
      console.error("CRM invoice update error:", error);
      return res.status(500).json({ error: "Failed to update invoice" });
    }
  });

  // ============================================================
  // CRM Meetings API – #7 agenda / upcoming meetings
  // ============================================================

  app.get("/api/universal-crm/meetings", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const { customer_id, upcoming } = req.query as Record<string, string>;
      let where = "WHERE owner_user_id = $1";
      const params: any[] = [session.userId];
      let idx = 2;
      if (customer_id) {
        where += ` AND customer_id = $${idx++}`;
        params.push(customer_id);
      }
      if (upcoming === "true") {
        where += ` AND scheduled_at >= now()`;
      }
      const rows = await pool.query(
        `SELECT * FROM crm_meetings ${where} ORDER BY scheduled_at ASC NULLS LAST LIMIT 100`,
        params,
      );
      return res.json({ meetings: rows.rows });
    } catch (error) {
      console.error("CRM meetings list error:", error);
      return res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  app.post("/api/universal-crm/meetings", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const {
        customerId,
        title,
        description,
        location,
        meetLink,
        webViewUrl,
        scheduledAt,
        durationMinutes,
        profession,
      } = req.body;
      const result = await pool.query(
        `INSERT INTO crm_meetings (id, customer_id, title, description, location, meet_link, web_view_url, scheduled_at, duration_minutes, profession, owner_user_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now()) RETURNING *`,
        [
          customerId || null,
          title || "Møte",
          description || null,
          location || null,
          meetLink || null,
          webViewUrl || null,
          scheduledAt || null,
          durationMinutes || 60,
          profession || null,
          session.userId,
        ],
      );
      return res.status(201).json({ meeting: result.rows[0] });
    } catch (error) {
      console.error("CRM meeting create error:", error);
      return res.status(500).json({ error: "Failed to create meeting" });
    }
  });

  // ============================================================
  // Event ↔ Customer relations – #15 (was a 404 + false-positive toast)
  // ============================================================

  app.get("/api/events/:id/relations", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const rows = await pool.query(
        `SELECT r.*, c.name AS customer_name, c.email AS customer_email_resolved
         FROM event_customer_relations r
         LEFT JOIN crm_customers c ON c.id = r.customer_id
         WHERE r.event_id = $1 AND r.owner_user_id = $2 ORDER BY r.created_at DESC`,
        [req.params.id, session.userId],
      );
      return res.json({ relations: rows.rows });
    } catch (error) {
      console.error("Event relations list error:", error);
      return res.status(500).json({ error: "Failed to fetch relations" });
    }
  });

  app.post("/api/events/:id/relations", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const { customerId, customerEmail, role, notes } = req.body;
      const result = await pool.query(
        `INSERT INTO event_customer_relations (id, event_id, customer_id, customer_email, role, notes, owner_user_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (event_id, customer_id) DO UPDATE SET role = EXCLUDED.role, notes = EXCLUDED.notes
         RETURNING *`,
        [
          req.params.id,
          customerId || null,
          customerEmail || null,
          role || "Client",
          notes || null,
          session.userId,
        ],
      );
      return res.status(201).json({ relation: result.rows[0] });
    } catch (error) {
      console.error("Event relation create error:", error);
      return res.status(500).json({ error: "Failed to link customer to event" });
    }
  });

  // ============================================================
  // Lead intake – #1/#16 public web-form endpoint + form token
  // ============================================================

  // Authenticated: get-or-create the caller's public lead-form token.
  app.get("/api/universal-crm/lead-form-token", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const { profession } = req.query as Record<string, string>;
      const existing = await pool.query(
        `SELECT * FROM lead_form_tokens WHERE owner_user_id = $1 LIMIT 1`,
        [session.userId],
      );
      let row = existing.rows[0];
      if (!row) {
        const created = await pool.query(
          `INSERT INTO lead_form_tokens (token, owner_user_id, profession, created_at)
           VALUES (encode(gen_random_bytes(12), 'hex'), $1, $2, now()) RETURNING *`,
          [session.userId, profession || null],
        );
        row = created.rows[0];
      }
      return res.json({ token: row.token, profession: row.profession });
    } catch (error) {
      console.error("Lead-form token error:", error);
      return res.status(500).json({ error: "Failed to get lead form token" });
    }
  });

  // Public: a website inquiry form posts here. No auth — the token maps the
  // lead to its photographer. Creates a lead (source='website') + an SLA task.
  app.post("/api/public/lead/:formToken", async (req, res) => {
    try {
      const tokenRow = await pool.query(
        `SELECT * FROM lead_form_tokens WHERE token = $1`,
        [req.params.formToken],
      );
      if (tokenRow.rows.length === 0) {
        return res.status(404).json({ error: "Unknown form" });
      }
      const owner = tokenRow.rows[0];
      const { name, email, phone, projectType, budget, notes } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: "Name and email are required" });
      }
      const inserted = await pool.query(
        `INSERT INTO crm_customers (id, name, email, phone, profession, project_type, budget, status, notes, source, owner_user_id, custom_fields, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'lead', $7, 'website', $8, '{}'::jsonb, now(), now()) RETURNING id`,
        [
          name,
          email,
          phone || null,
          owner.profession || null,
          projectType || null,
          budget || null,
          notes || null,
          owner.owner_user_id,
        ],
      );
      const customerId = inserted.rows[0].id;
      // SLA: follow up within 24h.
      await pool.query(
        `INSERT INTO crm_tasks (id, customer_id, title, description, priority, status, due_date, assigned_to, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 'high', 'pending', now() + interval '24 hours', $4, now(), now())`,
        [
          customerId,
          `Følg opp ny henvendelse: ${name}`,
          `Innkommet via nettside-skjema. ${notes || ""}`.trim(),
          owner.owner_user_id,
        ],
      ).catch((e) => console.warn("Lead SLA task insert skipped:", e));
      return res.status(201).json({ ok: true, message: "Takk! Vi tar kontakt snart." });
    } catch (error) {
      console.error("Public lead intake error:", error);
      return res.status(500).json({ error: "Failed to submit lead" });
    }
  });

  // ============================================================
  // Action queue (#24) + automation trigger (#9)
  // ============================================================

  // What needs proactive attention right now — owner-scoped buckets that turn
  // the lifecycle data into a daily to-do that drives repeat revenue.
  app.get("/api/universal-crm/action-queue", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const owner = session.userId;
      const [overdue, rebook, dormant, reviewDue] = await Promise.all([
        pool.query(
          `SELECT t.id, t.title, t.due_date, t.customer_id, c.name AS customer_name
           FROM crm_tasks t LEFT JOIN crm_customers c ON c.id = t.customer_id
           WHERE t.owner_user_id = $1 AND t.status = 'pending' AND t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE
           ORDER BY t.due_date ASC LIMIT 50`,
          [owner],
        ),
        pool.query(
          `SELECT id, name, email, last_delivered_at, next_rebook_due_at
           FROM crm_customers
           WHERE owner_user_id = $1 AND status <> 'archived'
             AND next_rebook_due_at IS NOT NULL AND next_rebook_due_at <= now()
           ORDER BY next_rebook_due_at ASC LIMIT 50`,
          [owner],
        ),
        pool.query(
          `SELECT id, name, email, last_contact
           FROM crm_customers
           WHERE owner_user_id = $1 AND status IN ('lead','prospect','active')
             AND (last_contact IS NULL OR last_contact < now() - interval '45 days')
           ORDER BY last_contact ASC NULLS FIRST LIMIT 50`,
          [owner],
        ),
        pool.query(
          `SELECT id, name, email, last_delivered_at
           FROM crm_customers
           WHERE owner_user_id = $1 AND lifecycle_stage = 'delivered'
             AND last_delivered_at IS NOT NULL AND last_delivered_at > now() - interval '60 days'
           ORDER BY last_delivered_at DESC LIMIT 50`,
          [owner],
        ),
      ]);
      return res.json({
        overdueTasks: overdue.rows,
        rebookDue: rebook.rows,
        dormant: dormant.rows,
        reviewDue: reviewDue.rows,
      });
    } catch (error) {
      console.error("CRM action-queue error:", error);
      return res.status(500).json({ error: "Failed to fetch action queue" });
    }
  });

  // Manual trigger for the automation sweep (also runs hourly on a timer).
  app.post("/api/universal-crm/automation/run", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const result = await runCrmAutomationSweep();
      return res.json({ ok: true, ...result });
    } catch (error) {
      console.error("CRM automation run error:", error);
      return res.status(500).json({ error: "Failed to run automation" });
    }
  });

  // ============================================================
  // Reporting / intelligence (#10/#25/#40/#41/#42/#43) — owner-scoped
  // ============================================================
  app.get("/api/universal-crm/reports", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const owner = session.userId;
      const [funnel, forecast, sourceRoi, ltv, revenue] = await Promise.all([
        // Funnel: deals count + value per stage (#25)
        pool.query(
          `SELECT stage, count(*)::int AS count, COALESCE(sum(value),0) AS value
           FROM crm_deals WHERE owner_user_id = $1 GROUP BY stage`,
          [owner],
        ),
        // Weighted forecast for OPEN deals, bucketed by expected-close month (#42)
        pool.query(
          `SELECT to_char(date_trunc('month', COALESCE(expected_close_date, now())), 'YYYY-MM') AS month,
                  COALESCE(sum(value * probability / 100.0), 0) AS weighted, COALESCE(sum(value),0) AS gross, count(*)::int AS deals
           FROM crm_deals
           WHERE owner_user_id = $1 AND stage NOT IN ('closed_won','closed_lost')
           GROUP BY 1 ORDER BY 1`,
          [owner],
        ),
        // Source ROI: leads + won revenue + win-rate per source (#41)
        pool.query(
          `SELECT COALESCE(c.source,'ukjent') AS source,
                  count(DISTINCT c.id)::int AS customers,
                  count(d.id) FILTER (WHERE d.stage = 'closed_won')::int AS won_deals,
                  COALESCE(sum(d.value) FILTER (WHERE d.stage = 'closed_won'),0) AS won_value
           FROM crm_customers c LEFT JOIN crm_deals d ON d.customer_id = c.id AND d.owner_user_id = $1
           WHERE c.owner_user_id = $1 GROUP BY 1 ORDER BY won_value DESC`,
          [owner],
        ),
        // Top customers by lifetime value: won deals + paid invoices (#40/#43)
        pool.query(
          `SELECT c.id, c.name,
                  COALESCE((SELECT sum(value) FROM crm_deals d WHERE d.customer_id = c.id AND d.stage='closed_won'),0)
                  + COALESCE((SELECT sum(paid_amount) FROM crm_invoices i WHERE i.customer_id = c.id),0) AS ltv,
                  (SELECT count(*) FROM crm_deals d WHERE d.customer_id = c.id AND d.stage='closed_won')::int AS won_count
           FROM crm_customers c WHERE c.owner_user_id = $1
           ORDER BY ltv DESC LIMIT 10`,
          [owner],
        ),
        // Revenue: pipeline / won / realized (paid invoices) (#10)
        pool.query(
          `SELECT
             (SELECT COALESCE(sum(value),0) FROM crm_deals WHERE owner_user_id=$1 AND stage NOT IN ('closed_won','closed_lost')) AS pipeline,
             (SELECT COALESCE(sum(value),0) FROM crm_deals WHERE owner_user_id=$1 AND stage='closed_won') AS won,
             (SELECT COALESCE(sum(paid_amount),0) FROM crm_invoices WHERE owner_user_id=$1) AS realized,
             (SELECT COALESCE(sum(total_amount - paid_amount),0) FROM crm_invoices WHERE owner_user_id=$1 AND status<>'paid') AS outstanding`,
          [owner],
        ).catch(() => ({ rows: [{ pipeline: 0, won: 0, realized: 0, outstanding: 0 }] })),
      ]);
      const num = (v: any) => Number(v) || 0;
      return res.json({
        funnel: funnel.rows.map((r: any) => ({ stage: r.stage, count: r.count, value: num(r.value) })),
        forecast: forecast.rows.map((r: any) => ({ month: r.month, weighted: Math.round(num(r.weighted)), gross: num(r.gross), deals: r.deals })),
        sourceRoi: sourceRoi.rows.map((r: any) => ({ source: r.source, customers: r.customers, wonDeals: r.won_deals, wonValue: num(r.won_value) })),
        topCustomers: ltv.rows.map((r: any) => ({ id: r.id, name: r.name, ltv: num(r.ltv), wonCount: r.won_count })),
        revenue: {
          pipeline: num(revenue.rows[0].pipeline),
          won: num(revenue.rows[0].won),
          realized: num(revenue.rows[0].realized),
          outstanding: num(revenue.rows[0].outstanding),
        },
      });
    } catch (error) {
      console.error("CRM reports error:", error);
      return res.status(500).json({ error: "Failed to build reports" });
    }
  });

  // Owner-scoped export of customers (#29) — JSON rows; frontend builds CSV.
  app.get("/api/universal-crm/export", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const rows = await pool.query(
        `SELECT c.name, c.email, c.phone, c.company, c.profession, c.project_type, c.budget,
                c.status, c.source, c.created_at, c.last_contact,
                COALESCE((SELECT sum(d.value) FROM crm_deals d WHERE d.customer_id=c.id AND d.stage='closed_won'),0) AS won_value,
                COALESCE((SELECT sum(i.paid_amount) FROM crm_invoices i WHERE i.customer_id=c.id),0) AS paid
         FROM crm_customers c WHERE c.owner_user_id = $1 ORDER BY c.created_at DESC`,
        [session.userId],
      );
      return res.json({ rows: rows.rows });
    } catch (error) {
      console.error("CRM export error:", error);
      return res.status(500).json({ error: "Failed to export" });
    }
  });
}
