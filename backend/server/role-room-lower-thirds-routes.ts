/**
 * Lower Thirds — per-prosjekt collection av navn/title-overlays med
 * timeline-position, style-preset og animasjon.
 *
 * Endepunkter:
 *   GET    /api/role-room/lower-thirds?projectId=X
 *   PUT    /api/role-room/lower-thirds         (upsert collection)
 *   DELETE /api/role-room/lower-thirds/:id
 *
 * UI eier items-shape — backend validerer kun ytre struktur og caps
 * size.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

const MAX_ITEMS_JSON_BYTES = 500_000;

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

export function registerRoleRoomLowerThirdsRoutes(
  app: Express, deps: Deps,
): void {
  const { pool, activeSessions } = deps;

  // GET — list collections for a project
  app.get("/api/role-room/lower-thirds",
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
          `SELECT id, project_id, collection_name, items, agent_kind,
                  default_style_preset, created_at, updated_at
             FROM role_room_lower_thirds
            WHERE project_id = $1
            ORDER BY updated_at DESC`,
          [projectId],
        );
        res.json({
          collections: rows.map(r => ({
            id: r.id,
            projectId: r.project_id,
            collectionName: r.collection_name,
            items: r.items,
            agentKind: r.agent_kind,
            defaultStylePreset: r.default_style_preset,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          })),
        });
      } catch (err) {
        console.error("[lower-thirds] GET failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // PUT — upsert collection (project_id + collection_name unique)
  app.put("/api/role-room/lower-thirds",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

      const body = req.body as {
        projectId?: unknown;
        collectionName?: unknown;
        items?: unknown;
        agentKind?: unknown;
        defaultStylePreset?: unknown;
      } | undefined;

      const projectId = typeof body?.projectId === "string"
        ? body.projectId.trim() : "";
      const collectionName = typeof body?.collectionName === "string"
        ? body.collectionName.trim().slice(0, 80) : "Default";
      if (!projectId) {
        res.status(400).json({ error: "mangler_project_id" }); return;
      }
      if (!Array.isArray(body?.items)) {
        res.status(400).json({ error: "items_må_være_array" }); return;
      }
      const itemsJson = JSON.stringify(body.items);
      if (itemsJson.length > MAX_ITEMS_JSON_BYTES) {
        res.status(413).json({
          error: "items_for_stor",
          maxBytes: MAX_ITEMS_JSON_BYTES,
          gotBytes: itemsJson.length,
        }); return;
      }

      try {
        if (!await viewerCanAccessProject(pool, projectId, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }

        const { rows } = await pool.query(
          `INSERT INTO role_room_lower_thirds
             (project_id, collection_name, items, agent_kind,
              default_style_preset, created_by, updated_at)
           VALUES ($1, $2, $3::jsonb, $4, $5, $6, now())
           ON CONFLICT (project_id, collection_name) DO UPDATE SET
             items = EXCLUDED.items,
             agent_kind = EXCLUDED.agent_kind,
             default_style_preset = EXCLUDED.default_style_preset,
             updated_at = now()
           RETURNING id, updated_at`,
          [
            projectId, collectionName, itemsJson,
            typeof body?.agentKind === "string"
              ? body.agentKind.slice(0, 50) : null,
            typeof body?.defaultStylePreset === "string"
              ? body.defaultStylePreset.slice(0, 80) : null,
            viewerId,
          ],
        );
        res.json({
          ok: true,
          id: rows[0].id,
          updatedAt: rows[0].updated_at,
        });
      } catch (err) {
        console.error("[lower-thirds] PUT failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // DELETE
  app.delete("/api/role-room/lower-thirds/:id",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

      const id = req.params.id;
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }

      try {
        const { rows } = await pool.query(
          `SELECT project_id FROM role_room_lower_thirds WHERE id = $1`,
          [id],
        );
        if (rows.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, rows[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        await pool.query(`DELETE FROM role_room_lower_thirds WHERE id = $1`, [id]);
        res.json({ ok: true });
      } catch (err) {
        console.error("[lower-thirds] DELETE failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });
}
