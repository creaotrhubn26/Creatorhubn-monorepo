import express from "express";
import type { Pool } from "pg";

export interface WorklogRoutesDeps {
  app: express.Application;
  pool: Pool;
  getUserIdFromAuth: (req: any) => string | null;
}

export function setupWorklogRoutes(deps: WorklogRoutesDeps): void {
  const { app, pool, getUserIdFromAuth } = deps;

  app.post("/api/worklog", async (req, res) => {
    try {
      const { projectId, description, hours, date, type, userId, task } =
        req.body;

      const tableCheck = await pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'worklogs')`,
      );

      if (tableCheck.rows[0].exists) {
        const result = await pool.query(
          `INSERT INTO worklogs (id, project_id, task, description, time_spent, date, status, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
           RETURNING *`,
          [
            projectId || null,
            task || type || "general",
            description || "",
            hours ? hours * 60 : 0,
            date || new Date().toISOString(),
            "completed",
          ],
        );
        return res.status(201).json(result.rows[0]);
      }

      const entryTableCheck = await pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'worklog_entries')`,
      );
      if (entryTableCheck.rows[0].exists) {
        const result = await pool.query(
          `INSERT INTO worklog_entries (id, user_id, project_id, title, description, time_spent, category, date, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
           RETURNING *`,
          [
            userId || getUserIdFromAuth(req) || null,
            projectId || null,
            task || type || "general",
            description || "",
            hours ? hours * 60 : 0,
            type || "general",
            date || new Date().toISOString(),
          ],
        );
        return res.status(201).json(result.rows[0]);
      }

      res.status(201).json({
        id: `wl_${Date.now()}`,
        description,
        hours,
        date,
        type,
        projectId,
      });
    } catch (error) {
      console.error("Error creating worklog:", error);
      res.status(500).json({ error: "Kunne ikke opprette arbeidslogg" });
    }
  });

  app.patch("/api/worklog/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        timeSpent,
        category,
        mood,
        nextSteps,
        isPrivate,
        day,
      } = req.body || {};
      const internalNotes = JSON.stringify({ mood, nextSteps, day });

      const milestoneUpdate = await pool.query(
        `UPDATE project_milestones
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             category = COALESCE($3, category),
             time_spent = COALESCE($4, time_spent),
             client_visible = COALESCE($5, client_visible),
             internal_notes = COALESCE($6, internal_notes),
             updated_at = NOW()
         WHERE id = $7 AND type = 'worklog'
         RETURNING *`,
        [
          title || null,
          description || null,
          category || null,
          timeSpent ?? null,
          typeof isPrivate === "boolean" ? !isPrivate : null,
          internalNotes || null,
          id,
        ],
      );

      if (milestoneUpdate.rowCount) {
        return res.json(milestoneUpdate.rows[0]);
      }

      const entryUpdate = await pool.query(
        `UPDATE worklog_entries
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             category = COALESCE($3, category),
             time_spent = COALESCE($4, time_spent),
             updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [
          title || null,
          description || null,
          category || null,
          timeSpent ?? null,
          id,
        ],
      );

      if (entryUpdate.rowCount) {
        return res.json(entryUpdate.rows[0]);
      }

      const legacyUpdate = await pool.query(
        `UPDATE worklogs
         SET task = COALESCE($1, task),
             description = COALESCE($2, description),
             time_spent = COALESCE($3, time_spent),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [title || null, description || null, timeSpent ?? null, id],
      );

      if (!legacyUpdate.rowCount) {
        return res.status(404).json({ error: "Arbeidslogg ikke funnet" });
      }

      res.json(legacyUpdate.rows[0]);
    } catch (error) {
      console.error("Error updating worklog:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere arbeidslogg" });
    }
  });

  app.delete("/api/worklog/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const milestoneDelete = await pool.query(
        `DELETE FROM project_milestones WHERE id = $1 AND type = 'worklog' RETURNING id`,
        [id],
      );
      if (milestoneDelete.rowCount) {
        return res.json({ deleted: true, id });
      }

      const entryDelete = await pool.query(
        `DELETE FROM worklog_entries WHERE id = $1 RETURNING id`,
        [id],
      );
      if (entryDelete.rowCount) {
        return res.json({ deleted: true, id });
      }

      const legacyDelete = await pool.query(
        `DELETE FROM worklogs WHERE id = $1 RETURNING id`,
        [id],
      );
      if (legacyDelete.rowCount) {
        return res.json({ deleted: true, id });
      }

      res.status(404).json({ error: "Arbeidslogg ikke funnet" });
    } catch (error) {
      console.error("Error deleting worklog:", error);
      res.status(500).json({ error: "Kunne ikke slette arbeidslogg" });
    }
  });
}
