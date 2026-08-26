import express from "express";
import type { Pool } from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, desc, eq } from "drizzle-orm";
import * as schema from "../migrations/schema.js";
import { canAccessProject, canEditProject } from "./project-team-routes";
import { broadcastUserEvent } from "./realtime-user-events";

export interface ProjectsOutliersRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  pool: Pool;
  db: NodePgDatabase<typeof schema>;
}

export function setupProjectsOutliersRoutes(
  deps: ProjectsOutliersRoutesDeps,
): void {
  const { app, requireUserSession, pool, db } = deps;

  const authorizeProject = async (req: any, res: any, write = false): Promise<any | null> => {
    const session = await requireUserSession(req, res);
    if (!session) return null;
    const projectId = String(req.params.projectId || "").trim();
    if (!projectId) {
      res.status(400).json({ error: "missing_project_id" });
      return null;
    }
    const allowed = write
      ? await canEditProject(pool, session.userId, projectId)
      : await canAccessProject(pool, session.userId, projectId);
    if (!allowed) {
      // Skjul om prosjekt-ID-en finnes for brukere uten lesetilgang.
      res.status(404).json({ error: "not_found" });
      return null;
    }
    return session;
  };

  const mapMilestone = (row: any) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description ?? null,
    category: row.category,
    type: row.type,
    dueDate: row.due_date ?? null,
    scheduledDate: row.scheduled_date ?? null,
    status: row.status,
    progress: Number(row.progress ?? 0),
    priority: row.priority,
    location: row.location ?? null,
    notes: row.internal_notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const notifyMilestonesUpdated = async (projectId: string, actorUserId: string) => {
    try {
      const [owners, members] = await Promise.all([
        pool.query(
          `SELECT user_id::text AS user_id FROM projects WHERE id::text = $1
           UNION SELECT user_id FROM legacy.projects WHERE id = $1`,
          [projectId],
        ).catch(() => ({ rows: [] as any[] })),
        pool.query(
          `SELECT user_id FROM project_team_members
            WHERE project_id = $1 AND status = 'active'
              AND deactivated_at IS NULL AND user_id IS NOT NULL`,
          [projectId],
        ).catch(() => ({ rows: [] as any[] })),
      ]);
      const recipients = new Set([...owners.rows, ...members.rows].map((row: any) => String(row.user_id)));
      recipients.delete(actorUserId);
      const timestamp = new Date().toISOString();
      for (const userId of recipients) broadcastUserEvent(userId, { kind: "milestones.updated", projectId, timestamp });
    } catch { /* realtime is best-effort; the write already succeeded */ }
  };

  // Live story-logic ligger i role-room-routes.ts; disse stubs blokkerer
  // gammel non-authenticated URL for alle metoder (GET/POST/PUT/DELETE/PATCH).
  app.all("/api/projects/:projectId/story-logic", (req, res) => {
    console.warn("Deprecated unauthenticated Story Logic route blocked", {
      projectId: req.params.projectId,
      method: req.method,
    });
    res.status(410).json({
      error: "story_logic_moved_to_role_room",
      replacement: "/api/role-room/projects/:projectId/story-logic",
    });
  });

  app.get("/api/projects/:projectId/timeline", async (req, res) => {
    if (!(await authorizeProject(req, res))) return;
    try {
      const { projectId } = req.params;
      const result = await pool.query(
        `SELECT * FROM project_milestones WHERE project_id = $1 ORDER BY COALESCE(due_date, scheduled_date, created_at) ASC`,
        [projectId],
      );
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching project timeline:", error);
      res.json([]);
    }
  });


  // Kanonisk CRUD-kontrakt for ProsjektplanTab.
  app.get("/api/projects/:projectId/milestones", async (req, res) => {
    if (!(await authorizeProject(req, res))) return;
    try {
      const result = await pool.query(
        `SELECT * FROM project_milestones
          WHERE project_id = $1
          ORDER BY due_date ASC NULLS LAST, created_at ASC`,
        [req.params.projectId],
      );
      const milestones = result.rows.map(mapMilestone);
      const completedCount = milestones.filter((m: any) => m.status === "completed").length;
      res.json({
        milestones,
        completedCount,
        totalProgress: milestones.length ? Math.round((completedCount / milestones.length) * 100) : 0,
      });
    } catch (error) {
      console.error("Error fetching milestones:", error);
      res.status(500).json({ error: "Failed to fetch milestones" });
    }
  });
  // POST /api/projects/:projectId/milestones — Create a milestone/timeline event
  app.post("/api/projects/:projectId/milestones", async (req, res) => {
    const session = await authorizeProject(req, res, true);
    if (!session) return;
    try {
      const { projectId } = req.params;
      const userId = session.userId;
      const {
        title,
        description,
        dueDate,
        status = "planned",
        priority = "medium",
        type = "milestone",
        category,
        location,
        metadata,
        notes,
      } = req.body;


      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ error: "title_required" });
      }
      const id = crypto.randomUUID();
      await pool.query(
        `INSERT INTO project_milestones (id, project_id, user_id, title, description, category, type, due_date, status, priority, location, internal_notes, client_visible)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)`,
        [
          id,
          projectId,
          userId,
          title.trim(),
          description || null,
          category || type,
          type,
          dueDate || null,
          status,
          priority,
          location || metadata?.location || null,
          notes || metadata?.notes || null,
        ],
      );

      const result = await pool.query(
        "SELECT * FROM project_milestones WHERE id = $1",
        [id],
      );
      void notifyMilestonesUpdated(projectId, userId);
      res.status(201).json(mapMilestone(result.rows[0]));
    } catch (error) {
      console.error("Error creating milestone:", error);
      res.status(500).json({ error: "Failed to create milestone" });
    }
  });

  app.patch("/api/projects/:projectId/milestones/:milestoneId", async (req, res) => {
    const session = await authorizeProject(req, res, true);
    if (!session) return;
    const { projectId, milestoneId } = req.params;
    const body = req.body ?? {};
    const updates: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown) => {
      params.push(value);
      updates.push(`${column} = $${params.length}`);
    };

    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return res.status(400).json({ error: "title_required" });
      }
      add("title", body.title.trim());
    }
    if (body.description !== undefined) add("description", body.description || null);
    if (body.category !== undefined) add("category", body.category || "milestone");
    if (body.type !== undefined) add("type", body.type || "milestone");
    if (body.dueDate !== undefined) add("due_date", body.dueDate || null);
    if (body.scheduledDate !== undefined) add("scheduled_date", body.scheduledDate || null);
    if (body.status !== undefined) {
      add("status", body.status);
      updates.push(body.status === "completed" ? "completed_at = NOW()" : "completed_at = NULL");
    }
    if (body.progress !== undefined) {
      const progress = Number(body.progress);
      if (!Number.isFinite(progress)) return res.status(400).json({ error: "invalid_progress" });
      add("progress", Math.max(0, Math.min(100, Math.round(progress))));
    }
    if (body.priority !== undefined) add("priority", body.priority);
    if (body.location !== undefined) add("location", body.location || null);
    if (body.notes !== undefined) add("internal_notes", body.notes || null);
    if (!updates.length) return res.status(400).json({ error: "no_supported_fields" });
    updates.push("updated_at = NOW()");
    params.push(milestoneId, projectId);

    try {
      const result = await pool.query(
        `UPDATE project_milestones
            SET ${updates.join(", ")}
          WHERE id = $${params.length - 1} AND project_id = $${params.length}
          RETURNING *`,
        params,
      );
      if (!result.rows.length) return res.status(404).json({ error: "milestone_not_found" });
      void notifyMilestonesUpdated(projectId, session.userId);
      res.json(mapMilestone(result.rows[0]));
    } catch (error) {
      console.error("Error updating milestone:", error);
      res.status(500).json({ error: "Failed to update milestone" });
    }
  });

  app.delete("/api/projects/:projectId/milestones/:milestoneId", async (req, res) => {
    const session = await authorizeProject(req, res, true);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM project_milestones
          WHERE id = $1 AND project_id = $2
          RETURNING id`,
        [req.params.milestoneId, req.params.projectId],
      );
      if (!result.rows.length) return res.status(404).json({ error: "milestone_not_found" });
      void notifyMilestonesUpdated(req.params.projectId, session.userId);
      res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
      console.error("Error deleting milestone:", error);
      res.status(500).json({ error: "Failed to delete milestone" });
    }
  });

  // PUT /api/projects/:projectId/timeline/:eventId — Update timeline event
  app.put("/api/projects/:projectId/timeline/:eventId", async (req, res) => {
    if (!(await authorizeProject(req, res, true))) return;
    try {
      const { projectId, eventId } = req.params;
      const {
        title,
        description,
        eventDate,
        eventTime,
        location,
        type,
        status,
        priority,
        notes,
      } = req.body;

      const updates: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (title !== undefined) {
        updates.push(`title = $${idx++}`);
        params.push(title);
      }
      if (description !== undefined) {
        updates.push(`description = $${idx++}`);
        params.push(description);
      }
      if (eventDate !== undefined) {
        const dateVal = eventTime ? `${eventDate}T${eventTime}` : eventDate;
        updates.push(`due_date = $${idx++}`);
        params.push(dateVal);
      }
      if (location !== undefined) {
        updates.push(`location = $${idx++}`);
        params.push(location);
      }
      if (type !== undefined) {
        updates.push(`type = $${idx++}`);
        params.push(type);
      }
      if (status !== undefined) {
        updates.push(`status = $${idx++}`);
        params.push(status);
        if (status === "completed") {
          updates.push(`completed_at = NOW()`);
        }
      }
      if (priority !== undefined) {
        updates.push(`priority = $${idx++}`);
        params.push(priority);
      }
      if (notes !== undefined) {
        updates.push(`internal_notes = $${idx++}`);
        params.push(notes);
      }
      updates.push("updated_at = NOW()");

      params.push(eventId);
      params.push(projectId);
      await pool.query(
        `UPDATE project_milestones SET ${updates.join(", ")} WHERE id = $${idx} AND project_id = $${idx + 1}`,
        params,
      );

      const result = await pool.query(
        "SELECT * FROM project_milestones WHERE id = $1",
        [eventId],
      );
      res.json(result.rows[0] || { success: true });
    } catch (error) {
      console.error("Error updating timeline event:", error);
      res.status(500).json({ error: "Failed to update timeline event" });
    }
  });

  // DELETE /api/projects/:projectId/timeline/:eventId — Delete timeline event
  app.delete("/api/projects/:projectId/timeline/:eventId", async (req, res) => {
    if (!(await authorizeProject(req, res, true))) return;
    try {
      const { projectId, eventId } = req.params;
      await pool.query(
        "DELETE FROM project_milestones WHERE id = $1 AND project_id = $2",
        [eventId, projectId],
      );
      res.json({ success: true, message: "Timeline event deleted" });
    } catch (error) {
      console.error("Error deleting timeline event:", error);
      res.status(500).json({ error: "Failed to delete timeline event" });
    }
  });

  // GET /api/projects/:projectId/worklog — List worklog entries
  app.get("/api/projects/:projectId/worklog", async (req, res) => {
    if (!(await authorizeProject(req, res))) return;
    try {
      const { projectId } = req.params;

      const milestones = await pool.query(
        `SELECT id, project_id, user_id, title, description, category, time_spent, client_visible,
                internal_notes, created_at, updated_at
         FROM project_milestones
         WHERE project_id = $1 AND type = 'worklog'
         ORDER BY created_at ASC`,
        [projectId],
      );

      if (milestones.rows.length > 0) {
        const mapped = milestones.rows.map((row: any, index: number) => {
          const notes =
            row.internal_notes && typeof row.internal_notes === "string"
              ? (() => { try { return JSON.parse(row.internal_notes); } catch { return {}; } })()
              : row.internal_notes || {};
          return {
            id: row.id,
            projectId: row.project_id,
            userId: row.user_id,
            day: notes.day || index + 1,
            date: row.created_at,
            title: row.title,
            description: row.description,
            timeSpent: row.time_spent || 0,
            category: row.category || "general",
            mood: notes.mood,
            nextSteps: notes.nextSteps,
            isPrivate: row.client_visible === false,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        });

        return res.json({ data: mapped });
      }

      const entryCheck = await pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'worklog_entries')`,
      );

      if (entryCheck.rows[0].exists) {
        const entries = await pool.query(
          `SELECT id, project_id, user_id, title, description, time_spent, category, date, created_at, updated_at
           FROM worklog_entries WHERE project_id = $1 ORDER BY created_at ASC`,
          [projectId],
        );

        const mapped = entries.rows.map((row: any, index: number) => ({
          id: row.id,
          projectId: row.project_id,
          userId: row.user_id,
          day: index + 1,
          date: row.date || row.created_at,
          title: row.title,
          description: row.description,
          timeSpent: row.time_spent || 0,
          category: row.category || "general",
          isPrivate: false,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));

        return res.json({ data: mapped });
      }
      return res.json({ data: [] });
    } catch (error) {
      console.error("Error fetching worklog:", error);
      res.status(500).json({ error: "Kunne ikke hente arbeidslogg" });
    }
  });

  // GET /api/projects/:projectId/worklog/stats — Worklog stats
  app.get("/api/projects/:projectId/worklog/stats", async (req, res) => {
    if (!(await authorizeProject(req, res))) return;
    try {
      const { projectId } = req.params;
      const entriesRes = await pool.query(
        `SELECT time_spent, category FROM project_milestones WHERE project_id = $1 AND type = 'worklog'`,
        [projectId],
      );

      let entries = entriesRes.rows || [];

      if (entries.length === 0) {
        const entryCheck = await pool.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'worklog_entries')`,
        );
        if (entryCheck.rows[0].exists) {
          const fallback = await pool.query(
            `SELECT time_spent, category FROM worklog_entries WHERE project_id = $1`,
            [projectId],
          );
          entries = fallback.rows || [];
        }
      }
      const totalDays = entries.length;
      const totalTimeSpent = entries.reduce(
        (sum: number, row: any) => sum + (row.time_spent || 0),
        0,
      );
      const averageTimePerDay =
        totalDays > 0 ? Math.round(totalTimeSpent / totalDays) : 0;
      const categoriesUsed = Array.from(
        new Set(entries.map((row: any) => row.category).filter(Boolean)),
      );

      res.json({
        data: {
          totalDays,
          totalTimeSpent,
          averageTimePerDay,
          categoriesUsed,
        },
      });
    } catch (error) {
      console.error("Error fetching worklog stats:", error);
      res.status(500).json({ error: "Kunne ikke hente arbeidsloggstatistikk" });
    }
  });

  // POST /api/projects/:projectId/worklog — Create worklog entry
  app.post("/api/projects/:projectId/worklog", async (req, res) => {
    const session = await authorizeProject(req, res, true);
    if (!session) return;
    try {
      const { projectId } = req.params;
      const userId = session.userId;
      const {
        title,
        description,
        timeSpent,
        category,
        mood,
        nextSteps,
        isPrivate,
        day,
      } = req.body;

      // Store as a special milestone type 'worklog'
      const id = crypto.randomUUID();
      await pool.query(
        `INSERT INTO project_milestones (id, project_id, user_id, title, description, category, type, status, time_spent, client_visible, internal_notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'worklog', 'completed', $7, $8, $9)`,
        [
          id,
          projectId,
          userId,
          title || `Dag ${day || 1}`,
          description || null,
          category || "general",
          timeSpent || 0,
          !isPrivate,
          JSON.stringify({ mood, nextSteps, day }),
        ],
      );

      const result = await pool.query(
        "SELECT * FROM project_milestones WHERE id = $1",
        [id],
      );
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error creating worklog:", error);
      res.status(500).json({ error: "Failed to create worklog entry" });
    }
  });

  app.get("/api/projects/:projectId/email-activity", async (req, res) => {
    if (!(await authorizeProject(req, res))) return;
    try {
      const { projectId } = req.params;

      const emails = await db
        .select()
        .from(schema.emailProjectAssociations)
        .where(eq(schema.emailProjectAssociations.projectId, projectId))
        .orderBy(desc(schema.emailProjectAssociations.sentAt))
        .limit(100);

      const recentActivity = emails.map((email) => {
        const status = email.status || "sent";
        const opened = status === "opened" || status === "clicked";
        const clicks = status === "clicked" ? 1 : 0;

        return {
          trackingId: email.id,
          subject: email.subject,
          emailType: email.templateUsed || email.direction || "general",
          status,
          opened,
          clicks,
          sentAt: email.sentAt || email.createdAt || new Date().toISOString(),
          openedAt: opened
            ? email.sentAt || email.createdAt || new Date().toISOString()
            : null,
        };
      });

      const totalEmails = recentActivity.length;
      const openedCount = recentActivity.filter((email) => email.opened).length;
      const clickedCount = recentActivity.filter(
        (email) => email.clicks > 0,
      ).length;
      const engagementRate = totalEmails
        ? Number(((clickedCount / totalEmails) * 100).toFixed(1))
        : 0;

      res.json({
        recentActivity,
        totalEmails,
        deliveryStats: {
          opened: openedCount,
          clicked: clickedCount,
        },
        engagementRate,
      });
    } catch (error) {
      console.error("Project email activity error:", error);
      res.status(500).json({ error: "Failed to load project email activity" });
    }
  });

  app.get("/api/projects/timeline/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;

      // Get the project linked to this customer
      const projectResult = await pool.query(
        `SELECT p.id, p.name, p.status, p.created_at, p.updated_at
         FROM legacy.projects p
         JOIN crm_customers c ON c.project_id = p.id
         WHERE c.id = $1
         LIMIT 1`,
        [clientId],
      );

      if (projectResult.rows.length === 0) {
        return res.json({
          currentPhase: "initial-contact",
          milestones: [
            {
              name: "Initial Contact",
              status: "completed",
              date: new Date().toISOString(),
            },
            { name: "Quote Sent", status: "pending", date: null },
            { name: "Contract Signed", status: "pending", date: null },
            { name: "Project Started", status: "pending", date: null },
            { name: "Delivery", status: "pending", date: null },
          ],
        });
      }

      const project = projectResult.rows[0];
      const status = project.status || "active";
      const phases = [
        "initial-contact",
        "quote-sent",
        "contract-signed",
        "in-progress",
        "delivered",
      ];
      const currentPhaseIndex =
        status === "completed" ? 4 : status === "active" ? 3 : 1;

      const milestones = [
        {
          name: "Initial Contact",
          status: "completed",
          date: project.created_at,
        },
        {
          name: "Quote Sent",
          status: currentPhaseIndex >= 1 ? "completed" : "pending",
          date: project.created_at,
        },
        {
          name: "Contract Signed",
          status: currentPhaseIndex >= 2 ? "completed" : "pending",
          date: currentPhaseIndex >= 2 ? project.updated_at : null,
        },
        {
          name: "Project Started",
          status: currentPhaseIndex >= 3 ? "completed" : "pending",
          date: currentPhaseIndex >= 3 ? project.updated_at : null,
        },
        {
          name: "Delivery",
          status: currentPhaseIndex >= 4 ? "completed" : "pending",
          date: currentPhaseIndex >= 4 ? project.updated_at : null,
        },
      ];

      return res.json({
        currentPhase: phases[currentPhaseIndex],
        milestones,
        project: { id: project.id, name: project.name, status: project.status },
      });
    } catch (error) {
      console.error("Project timeline error:", error);
      return res.json({
        currentPhase: "initial-contact",
        milestones: [
          {
            name: "Initial Contact",
            status: "completed",
            date: new Date().toISOString(),
          },
        ],
      });
    }
  });
}
