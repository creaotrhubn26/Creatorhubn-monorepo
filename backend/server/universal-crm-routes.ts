import express from "express";
import type { Pool } from "pg";

export interface UniversalCrmRoutesDeps {
  app: express.Application;
  pool: Pool;
}

export function setupUniversalCrmRoutes(deps: UniversalCrmRoutesDeps): void {
  const { app, pool } = deps;

  app.get("/api/universal-crm/customers", async (req, res) => {
    try {
      const {
        profession,
        search,
        status,
        limit = "100",
        offset = "0",
      } = req.query as Record<string, string>;

      let where = "WHERE 1=1";
      const params: any[] = [];
      let idx = 1;

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
    try {
      const result = await pool.query(
        "SELECT c.*, p.name as project_name, p.status as project_status FROM crm_customers c LEFT JOIN legacy.projects p ON c.project_id = p.id WHERE c.id = $1",
        [req.params.id],
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
        `INSERT INTO crm_customers (id, name, email, phone, company, profession, project_type, budget, status, tags, notes, source, custom_fields, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
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
   * GET /api/universal-crm/customers/:id
   * Get a single customer by ID
   */
  app.get("/api/universal-crm/customers/:id", async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM crm_customers WHERE id = $1",
        [req.params.id],
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
      });
    } catch (error) {
      console.error("CRM customer get error:", error);
      return res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  /**
   * PUT /api/universal-crm/customers/:id
   * Update a customer
   */
  app.put("/api/universal-crm/customers/:id", async (req, res) => {
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
      const result = await pool.query(
        `UPDATE crm_customers SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
        params,
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
    try {
      const result = await pool.query(
        "DELETE FROM crm_customers WHERE id = $1 RETURNING id",
        [req.params.id],
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
   * GET /api/universal-crm/stats
   * CRM dashboard statistics
   */
  app.get("/api/universal-crm/stats", async (req, res) => {
    try {
      const { profession } = req.query as Record<string, string>;
      const profFilter = profession ? " AND profession = $1" : "";
      const profParams = profession ? [profession] : [];

      const total = await pool.query(
        `SELECT count(*) as total FROM crm_customers WHERE 1=1${profFilter}`,
        profParams,
      );

      const byStatus = await pool.query(
        `SELECT status, count(*) as count FROM crm_customers WHERE 1=1${profFilter} GROUP BY status`,
        profParams,
      );

      const recentlyAdded = await pool.query(
        `SELECT count(*) as count FROM crm_customers WHERE created_at > now() - interval '30 days'${profFilter}`,
        profParams,
      );

      const byProfession = await pool.query(
        `SELECT profession, count(*) as count FROM crm_customers WHERE profession IS NOT NULL${profFilter} GROUP BY profession ORDER BY count DESC`,
        profParams,
      );

      // Deal stats
      const dealStats = await pool.query(
        `SELECT count(*) as total, COALESCE(sum(value), 0) as total_value,
                count(*) FILTER (WHERE stage = 'closed_won') as won,
                count(*) FILTER (WHERE stage = 'closed_lost') as lost
         FROM crm_deals WHERE 1=1`,
      );

      // Task stats
      const taskStats = await pool.query(
        `SELECT count(*) as total,
                count(*) FILTER (WHERE status = 'pending') as pending,
                count(*) FILTER (WHERE status = 'completed') as completed
         FROM crm_tasks WHERE 1=1`,
      );

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
    try {
      const {
        customer_id,
        stage,
        limit = "50",
      } = req.query as Record<string, string>;
      let where = "WHERE 1=1";
      const params: any[] = [];
      let idx = 1;
      if (customer_id) {
        where += ` AND customer_id = $${idx++}`;
        params.push(customer_id);
      }
      if (stage) {
        where += ` AND stage = $${idx++}`;
        params.push(stage);
      }

      const rows = await pool.query(
        `SELECT * FROM crm_deals ${where} ORDER BY created_at DESC LIMIT $${idx}`,
        [...params, parseInt(limit) || 50],
      );
      return res.json({ deals: rows.rows });
    } catch (error) {
      console.error("CRM deals error:", error);
      return res.status(500).json({ error: "Failed to fetch deals" });
    }
  });

  app.post("/api/universal-crm/deals", async (req, res) => {
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
        `INSERT INTO crm_deals (id, customer_id, title, value, currency, stage, probability, expected_close_date, assigned_to, service_type, notes, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now()) RETURNING *`,
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
        ],
      );
      return res.status(201).json({ deal: result.rows[0] });
    } catch (error) {
      console.error("CRM deal create error:", error);
      return res.status(500).json({ error: "Failed to create deal" });
    }
  });

  app.put("/api/universal-crm/deals/:id", async (req, res) => {
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
      params.push(req.params.id);
      const result = await pool.query(
        `UPDATE crm_deals SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
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

  // ============================================================
  // CRM Activities API – /api/universal-crm/activities/*
  // ============================================================

  app.get("/api/universal-crm/activities", async (req, res) => {
    try {
      const {
        customer_id,
        deal_id,
        type,
        limit = "50",
      } = req.query as Record<string, string>;
      let where = "WHERE 1=1";
      const params: any[] = [];
      let idx = 1;
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
        `INSERT INTO crm_activities (id, customer_id, deal_id, type, subject, description, scheduled_at, direction, outcome, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, now(), now()) RETURNING *`,
        [
          customer_id || null,
          deal_id || null,
          type,
          subject,
          description || null,
          scheduled_at || null,
          direction || null,
          outcome || null,
        ],
      );
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
    try {
      const {
        customer_id,
        status,
        assigned_to,
        limit = "50",
      } = req.query as Record<string, string>;
      let where = "WHERE 1=1";
      const params: any[] = [];
      let idx = 1;
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
        `INSERT INTO crm_tasks (id, customer_id, deal_id, title, description, assigned_to, priority, status, due_date, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, now(), now()) RETURNING *`,
        [
          customer_id || null,
          deal_id || null,
          title,
          description || null,
          assigned_to || null,
          priority || "medium",
          status || "pending",
          due_date || null,
        ],
      );
      return res.status(201).json({ task: result.rows[0] });
    } catch (error) {
      console.error("CRM task create error:", error);
      return res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.put("/api/universal-crm/tasks/:id", async (req, res) => {
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
      const result = await pool.query(
        `UPDATE crm_tasks SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
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
}
