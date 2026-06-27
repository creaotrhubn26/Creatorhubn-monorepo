/**
 * project-workspace-routes.ts — Team Workspace egne panel-data (project_id-scopet)
 *
 * HELT UAVHENGIG av Role Room / casting / wedding. Dedikerte tabeller for
 * foto/video-prosjektets workspace, alle scopet til public.projects.id og
 * gated via canAccessProject (eier ELLER aktivt team-medlem).
 *
 * Ressurser:
 *   project_board_tasks   — Samkjøringsboard / Oppgaver (kanban per crew_role)
 *   project_checklist_items — Sjekkliste (utstyr/backup)
 *   project_deliverables  — Leveranser
 *
 * Endpoints (alle /api/projects/:projectId/...):
 *   GET/POST  board-tasks      PATCH/DELETE board-tasks/:id
 *   GET/POST  checklist        PATCH/DELETE checklist/:id
 *   GET/POST  deliverables     PATCH/DELETE deliverables/:id
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type express from "express";
import { canAccessProject } from "./project-team-routes";

export interface ProjectWorkspaceRoutesDeps {
  app: express.Application;
  pool: any;
  requireUserSession: (
    req: any,
    res: any,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

let schemaReady: Promise<void> | null = null;
async function ensureSchema(pool: any): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS project_board_tasks (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id  VARCHAR(64) NOT NULL,
          crew_role   VARCHAR(20) NOT NULL DEFAULT 'begge',
          title       TEXT NOT NULL,
          time_label  VARCHAR(60),
          status      VARCHAR(20) NOT NULL DEFAULT 'todo',
          order_index INTEGER NOT NULL DEFAULT 0,
          created_by  VARCHAR(64),
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pbt_project ON project_board_tasks (project_id, crew_role, order_index);

        CREATE TABLE IF NOT EXISTS project_checklist_items (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id  VARCHAR(64) NOT NULL,
          label       TEXT NOT NULL,
          checked     BOOLEAN NOT NULL DEFAULT FALSE,
          category    VARCHAR(40),
          order_index INTEGER NOT NULL DEFAULT 0,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pci_project ON project_checklist_items (project_id, order_index);

        CREATE TABLE IF NOT EXISTS project_deliverables (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id  VARCHAR(64) NOT NULL,
          title       TEXT NOT NULL,
          type        VARCHAR(60),
          status      VARCHAR(20) NOT NULL DEFAULT 'not_started',
          due_date    DATE,
          order_index INTEGER NOT NULL DEFAULT 0,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pd_project ON project_deliverables (project_id, order_index);
      `).catch(() => undefined);
    })();
  }
  return schemaReady;
}

export function setupProjectWorkspaceRoutes(deps: ProjectWorkspaceRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  // Felles gate: innlogget + canAccessProject. Returnerer userId, eller null
  // (og har allerede sendt respons).
  const guard = async (req: any, res: any): Promise<string | null> => {
    const session = requireUserSession(req, res);
    if (!session) return null;
    const projectId = String(req.params.projectId || "").trim();
    if (!projectId) { res.status(400).json({ error: "missing_project_id" }); return null; }
    if (!(await canAccessProject(pool, session.userId, projectId))) {
      res.status(403).json({ error: "no_access" });
      return null;
    }
    return session.userId;
  };

  // ─────────── Samkjøringsboard / Oppgaver ───────────
  app.get("/api/projects/:projectId/board-tasks", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `SELECT * FROM project_board_tasks WHERE project_id = $1 ORDER BY crew_role, order_index, created_at`,
        [req.params.projectId],
      );
      res.json({ tasks: r.rows.map((t: any) => ({ id: t.id, crewRole: t.crew_role, title: t.title, timeLabel: t.time_label, status: t.status, orderIndex: t.order_index })) });
    } catch (e) { console.error("GET board-tasks", e); res.status(500).json({ error: "failed" }); }
  });
  app.post("/api/projects/:projectId/board-tasks", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const b = req.body ?? {};
      const title = typeof b.title === "string" ? b.title.trim() : "";
      if (!title) return res.status(400).json({ error: "title_required" });
      const r = await pool.query(
        `INSERT INTO project_board_tasks (project_id, crew_role, title, time_label, status, order_index, created_by)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, 0), $7) RETURNING *`,
        [req.params.projectId, (b.crewRole || "begge"), title, b.timeLabel || null, b.status || "todo", b.orderIndex ?? null, uid],
      );
      const t = r.rows[0];
      res.status(201).json({ id: t.id, crewRole: t.crew_role, title: t.title, timeLabel: t.time_label, status: t.status, orderIndex: t.order_index });
    } catch (e) { console.error("POST board-tasks", e); res.status(500).json({ error: "failed" }); }
  });
  app.patch("/api/projects/:projectId/board-tasks/:id", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const b = req.body ?? {};
      const r = await pool.query(
        `UPDATE project_board_tasks SET
            title = COALESCE($1, title), status = COALESCE($2, status),
            time_label = COALESCE($3, time_label), crew_role = COALESCE($4, crew_role),
            updated_at = NOW()
          WHERE id = $5 AND project_id = $6 RETURNING *`,
        [b.title ?? null, b.status ?? null, b.timeLabel ?? null, b.crewRole ?? null, req.params.id, req.params.projectId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const t = r.rows[0];
      res.json({ id: t.id, crewRole: t.crew_role, title: t.title, timeLabel: t.time_label, status: t.status, orderIndex: t.order_index });
    } catch (e) { console.error("PATCH board-tasks", e); res.status(500).json({ error: "failed" }); }
  });
  app.delete("/api/projects/:projectId/board-tasks/:id", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try { await ensureSchema(pool); await pool.query(`DELETE FROM project_board_tasks WHERE id = $1 AND project_id = $2`, [req.params.id, req.params.projectId]); res.json({ success: true }); }
    catch (e) { console.error("DELETE board-tasks", e); res.status(500).json({ error: "failed" }); }
  });

  // ─────────── Shotlist (LESER shot_lists wizarden skrev) ───────────
  // GET — drift-trygt: rå SQL mot de EKTE kolonnene (shots_data/name/
  // template_type/critical_shots), IKKE Drizzle-helperen som har skjema-drift.
  // ProjectCreationWithMemoryCards skriver shot_lists via POST; her leser vi den.
  app.get("/api/projects/:projectId/shot-list", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const r = await pool.query(
        `SELECT id, name, template_type, culture, shots_data,
                total_shots, completed_shots, critical_shots, completed_critical_shots, updated_at
           FROM shot_lists
          WHERE project_id = $1 AND is_active = TRUE
          ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
        [req.params.projectId],
      );
      if (r.rowCount === 0) return res.json({ shotList: null, shots: [] });
      const s = r.rows[0];
      const shots = Array.isArray(s.shots_data) ? s.shots_data : [];
      res.json({
        shotList: {
          id: s.id, name: s.name, templateType: s.template_type, culture: s.culture,
          totalShots: s.total_shots ?? shots.length, completedShots: s.completed_shots ?? 0,
          criticalShots: s.critical_shots ?? 0, completedCriticalShots: s.completed_critical_shots ?? 0,
        },
        shots,
      });
    } catch (e) { console.error("GET shot-list", e); res.status(500).json({ error: "failed" }); }
  });

  // ─────────── Sjekkliste ───────────
  app.get("/api/projects/:projectId/checklist", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const r = await pool.query(`SELECT * FROM project_checklist_items WHERE project_id = $1 ORDER BY order_index, created_at`, [req.params.projectId]);
      res.json({ items: r.rows.map((i: any) => ({ id: i.id, label: i.label, checked: i.checked, category: i.category })) });
    } catch (e) { console.error("GET checklist", e); res.status(500).json({ error: "failed" }); }
  });
  app.post("/api/projects/:projectId/checklist", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const b = req.body ?? {};
      const label = typeof b.label === "string" ? b.label.trim() : "";
      if (!label) return res.status(400).json({ error: "label_required" });
      const r = await pool.query(
        `INSERT INTO project_checklist_items (project_id, label, checked, category, order_index)
         VALUES ($1, $2, COALESCE($3, FALSE), $4, COALESCE($5, 0)) RETURNING *`,
        [req.params.projectId, label, b.checked ?? false, b.category || null, b.orderIndex ?? null],
      );
      const i = r.rows[0];
      res.status(201).json({ id: i.id, label: i.label, checked: i.checked, category: i.category });
    } catch (e) { console.error("POST checklist", e); res.status(500).json({ error: "failed" }); }
  });
  app.patch("/api/projects/:projectId/checklist/:id", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const b = req.body ?? {};
      const r = await pool.query(
        `UPDATE project_checklist_items SET checked = COALESCE($1, checked), label = COALESCE($2, label) WHERE id = $3 AND project_id = $4 RETURNING *`,
        [typeof b.checked === "boolean" ? b.checked : null, b.label ?? null, req.params.id, req.params.projectId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const i = r.rows[0];
      res.json({ id: i.id, label: i.label, checked: i.checked, category: i.category });
    } catch (e) { console.error("PATCH checklist", e); res.status(500).json({ error: "failed" }); }
  });
  app.delete("/api/projects/:projectId/checklist/:id", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try { await ensureSchema(pool); await pool.query(`DELETE FROM project_checklist_items WHERE id = $1 AND project_id = $2`, [req.params.id, req.params.projectId]); res.json({ success: true }); }
    catch (e) { console.error("DELETE checklist", e); res.status(500).json({ error: "failed" }); }
  });

  // ─────────── Leveranser ───────────
  app.get("/api/projects/:projectId/deliverables", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const r = await pool.query(`SELECT * FROM project_deliverables WHERE project_id = $1 ORDER BY order_index, due_date NULLS LAST, created_at`, [req.params.projectId]);
      res.json({ deliverables: r.rows.map((d: any) => ({ id: d.id, title: d.title, type: d.type, status: d.status, dueDate: d.due_date })) });
    } catch (e) { console.error("GET deliverables", e); res.status(500).json({ error: "failed" }); }
  });
  app.post("/api/projects/:projectId/deliverables", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const b = req.body ?? {};
      const title = typeof b.title === "string" ? b.title.trim() : "";
      if (!title) return res.status(400).json({ error: "title_required" });
      const r = await pool.query(
        `INSERT INTO project_deliverables (project_id, title, type, status, due_date, order_index)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, 0)) RETURNING *`,
        [req.params.projectId, title, b.type || null, b.status || "not_started", b.dueDate || null, b.orderIndex ?? null],
      );
      const d = r.rows[0];
      res.status(201).json({ id: d.id, title: d.title, type: d.type, status: d.status, dueDate: d.due_date });
    } catch (e) { console.error("POST deliverables", e); res.status(500).json({ error: "failed" }); }
  });
  app.patch("/api/projects/:projectId/deliverables/:id", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const b = req.body ?? {};
      const r = await pool.query(
        `UPDATE project_deliverables SET title = COALESCE($1, title), type = COALESCE($2, type),
            status = COALESCE($3, status), due_date = COALESCE($4, due_date), updated_at = NOW()
          WHERE id = $5 AND project_id = $6 RETURNING *`,
        [b.title ?? null, b.type ?? null, b.status ?? null, b.dueDate ?? null, req.params.id, req.params.projectId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const d = r.rows[0];
      res.json({ id: d.id, title: d.title, type: d.type, status: d.status, dueDate: d.due_date });
    } catch (e) { console.error("PATCH deliverables", e); res.status(500).json({ error: "failed" }); }
  });
  app.delete("/api/projects/:projectId/deliverables/:id", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try { await ensureSchema(pool); await pool.query(`DELETE FROM project_deliverables WHERE id = $1 AND project_id = $2`, [req.params.id, req.params.projectId]); res.json({ success: true }); }
    catch (e) { console.error("DELETE deliverables", e); res.status(500).json({ error: "failed" }); }
  });
}
