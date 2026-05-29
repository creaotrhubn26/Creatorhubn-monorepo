/**
 * Thumbnail templates — gjenbrukbare design-presets per prosjekt.
 *
 * Endepunkter:
 *   GET    /api/role-room/thumbnail-templates?projectId=X
 *   POST   /api/role-room/thumbnail-templates
 *   PATCH  /api/role-room/thumbnail-templates/:id     (oppdater design)
 *   DELETE /api/role-room/thumbnail-templates/:id
 *   POST   /api/role-room/thumbnail-templates/:id/use (inkrementer use_count)
 *
 * Auth: RR_BEARER_TOKEN. Tilgang via prosjekt-medlemskap.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

const MAX_NAME = 120;
const MAX_DESIGN_BYTES = 200_000;     // 200 KB JSONB
const MAX_PREVIEW = 500_000;          // 500 KB data:URL

function getUserIdFromRequest(
  req: Request,
  activeSessions: Map<string, SessionData>,
): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const session = activeSessions.get(token);
    if (session?.userId) return session.userId;
  }
  return null;
}

async function viewerCanAccessProject(
  pool: Pool, projectId: string, viewerId: string,
): Promise<boolean> {
  const { rows } = await pool.query<{ owns: boolean; member: boolean }>(
    `SELECT
       EXISTS(SELECT 1 FROM casting_projects
               WHERE id = $1 AND created_by = $2) AS owns,
       EXISTS(SELECT 1 FROM casting_user_roles
               WHERE project_id = $1 AND user_id = $2
                 AND deactivated_at IS NULL) AS member`,
    [projectId, viewerId],
  );
  return rows[0]?.owns === true || rows[0]?.member === true;
}

export function registerRoleRoomThumbnailTemplatesRoutes(
  app: Express, deps: Deps,
): void {
  const { pool, activeSessions } = deps;

  // GET — list templates for a project
  app.get("/api/role-room/thumbnail-templates",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

      const projectId = String(req.query.projectId ?? "").trim();
      if (!projectId) {
        res.status(400).json({ error: "mangler_project_id" }); return;
      }

      try {
        if (!await viewerCanAccessProject(pool, projectId, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        const { rows } = await pool.query(
          `SELECT id, project_id, name, design, preview_data_url,
                  use_count, last_used_at, tags, created_by,
                  created_at, updated_at
             FROM role_room_thumbnail_templates
            WHERE project_id = $1
            ORDER BY last_used_at DESC NULLS LAST, created_at DESC`,
          [projectId],
        );
        res.json({
          templates: rows.map(r => ({
            id: r.id,
            projectId: r.project_id,
            name: r.name,
            design: r.design,
            previewDataUrl: r.preview_data_url,
            useCount: r.use_count,
            lastUsedAt: r.last_used_at,
            tags: r.tags ?? [],
            createdBy: r.created_by,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          })),
        });
      } catch (err) {
        console.error("[thumb-templates] GET failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // POST — create new template
  app.post("/api/role-room/thumbnail-templates",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

      const body = req.body as {
        projectId?: unknown;
        name?: unknown;
        design?: unknown;
        previewDataUrl?: unknown;
        tags?: unknown;
      } | undefined;

      const projectId = typeof body?.projectId === "string"
        ? body.projectId.trim() : "";
      const name = typeof body?.name === "string"
        ? body.name.trim().slice(0, MAX_NAME) : "";
      if (!projectId || !name) {
        res.status(400).json({ error: "mangler_felter" }); return;
      }

      const design = body?.design;
      if (!design || typeof design !== "object") {
        res.status(400).json({ error: "ugyldig_design" }); return;
      }
      const designJson = JSON.stringify(design);
      if (designJson.length > MAX_DESIGN_BYTES) {
        res.status(413).json({
          error: "design_for_stort",
          maxBytes: MAX_DESIGN_BYTES,
          gotBytes: designJson.length,
        }); return;
      }

      const previewDataUrl = typeof body?.previewDataUrl === "string"
        ? body.previewDataUrl : null;
      if (previewDataUrl && previewDataUrl.length > MAX_PREVIEW) {
        res.status(413).json({
          error: "preview_for_stor",
          maxBytes: MAX_PREVIEW,
          gotBytes: previewDataUrl.length,
        }); return;
      }

      try {
        if (!await viewerCanAccessProject(pool, projectId, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }

        const tagsArray = Array.isArray(body?.tags)
          ? (body.tags as unknown[])
              .filter(t => typeof t === "string")
              .slice(0, 20)
              .map(t => String(t).slice(0, 50))
          : [];

        const { rows } = await pool.query(
          `INSERT INTO role_room_thumbnail_templates
             (project_id, name, design, preview_data_url, tags, created_by)
           VALUES ($1, $2, $3::jsonb, $4, $5, $6)
           RETURNING id, created_at`,
          [projectId, name, designJson, previewDataUrl, tagsArray, viewerId],
        );
        res.json({ ok: true, id: rows[0].id, createdAt: rows[0].created_at });
      } catch (err) {
        console.error("[thumb-templates] POST failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // PATCH — update template (rename, replace design)
  app.patch("/api/role-room/thumbnail-templates/:id",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

      const id = req.params.id;
      const body = req.body as {
        name?: unknown; design?: unknown; previewDataUrl?: unknown;
      } | undefined;
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }

      try {
        const { rows: existing } = await pool.query(
          `SELECT project_id FROM role_room_thumbnail_templates WHERE id = $1`,
          [id],
        );
        if (existing.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, existing[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        let p = 1;
        if (typeof body?.name === "string") {
          updates.push(`name = $${p++}`);
          values.push(body.name.slice(0, MAX_NAME));
        }
        if (body?.design && typeof body.design === "object") {
          const designJson = JSON.stringify(body.design);
          if (designJson.length > MAX_DESIGN_BYTES) {
            res.status(413).json({ error: "design_for_stort" }); return;
          }
          updates.push(`design = $${p++}::jsonb`);
          values.push(designJson);
        }
        if (typeof body?.previewDataUrl === "string") {
          if (body.previewDataUrl.length > MAX_PREVIEW) {
            res.status(413).json({ error: "preview_for_stor" }); return;
          }
          updates.push(`preview_data_url = $${p++}`);
          values.push(body.previewDataUrl);
        }
        if (updates.length === 0) {
          res.status(400).json({ error: "ingen_endringer" }); return;
        }
        updates.push(`updated_at = now()`);
        values.push(id);
        await pool.query(
          `UPDATE role_room_thumbnail_templates SET ${updates.join(", ")} WHERE id = $${p}`,
          values,
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[thumb-templates] PATCH failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // DELETE
  app.delete("/api/role-room/thumbnail-templates/:id",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

      const id = req.params.id;
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }

      try {
        const { rows } = await pool.query(
          `SELECT project_id FROM role_room_thumbnail_templates WHERE id = $1`,
          [id],
        );
        if (rows.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, rows[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        await pool.query(`DELETE FROM role_room_thumbnail_templates WHERE id = $1`, [id]);
        res.json({ ok: true });
      } catch (err) {
        console.error("[thumb-templates] DELETE failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // POST /:id/use — inkrementerer use_count + setter last_used_at
  app.post("/api/role-room/thumbnail-templates/:id/use",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

      const id = req.params.id;
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }

      try {
        const { rows } = await pool.query(
          `SELECT project_id FROM role_room_thumbnail_templates WHERE id = $1`,
          [id],
        );
        if (rows.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, rows[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        await pool.query(
          `UPDATE role_room_thumbnail_templates
              SET use_count = use_count + 1, last_used_at = now()
            WHERE id = $1`,
          [id],
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[thumb-templates] use failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });
}
