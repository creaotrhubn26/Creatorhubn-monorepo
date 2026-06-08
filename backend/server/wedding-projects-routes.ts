import express from "express";
import type { Pool } from "pg";

export interface WeddingProjectsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
  compatResolveUserId: (req: express.Request) => string;
  mapProjectRow: (row: any) => any;
}

export function setupWeddingProjectsRoutes(
  deps: WeddingProjectsRoutesDeps,
): void {
  const { app, pool, requireUserSession, compatResolveUserId, mapProjectRow } = deps;

  app.get("/api/wedding-projects", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const userId = compatResolveUserId(req);
      const params: Array<string> = [];
      const clauses = [
        `(COALESCE(category, '') ILIKE 'wedding%' OR COALESCE(profession, '') IN ('photographer','wedding'))`,
      ];
      if (userId && userId !== "guest") {
        params.push(userId);
        clauses.push(`user_id = $${params.length}`);
      }
      const query = `
        SELECT * FROM legacy.projects
        WHERE ${clauses.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT 200
      `;
      const result = await pool.query(query, params);
      const projects = result.rows.map((row: any) => ({
        ...mapProjectRow(row),
        projectType: "wedding",
      }));

      res.json({ success: true, projects });
    } catch (error) {
      console.warn(
        "Wedding projects query failed, returning empty list:",
        (error as Error).message,
      );
      res.json({ success: true, projects: [] });
    }
  });

  app.get("/api/wedding-projects/:projectId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const result = await pool.query(
        "SELECT * FROM legacy.projects WHERE id = $1 LIMIT 1",
        [req.params.projectId],
      );
      if (!result.rowCount || result.rowCount === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Project not found" });
      }
      res.json({
        success: true,
        project: {
          ...mapProjectRow(result.rows[0]),
          projectType: "wedding",
        },
      });
    } catch (error) {
      // Manglende legacy.projects-tabell/kolonner skal ikke krasje wedding-
      // dashbordet. Logg som warning og returner not-found istedet for 500
      // — frontend håndterer 404 som "ingen prosjekt" og rendrer tom state.
      console.warn(
        "[wedding-projects] detail degraded:",
        (error as Error).message,
      );
      res.status(404).json({ success: false, error: "Project not found" });
    }
  });
}
