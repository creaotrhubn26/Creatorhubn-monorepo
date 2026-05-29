/**
 * Brand asset library — per-prosjekt bibliotek av logoer, icons og
 * overlay-bilder som gjenbrukes i Thumbnail Creator og Creative Editor.
 *
 * Endepunkter:
 *   GET    /api/role-room/brand-assets?projectId=X&kind=logo
 *   POST   /api/role-room/brand-assets
 *   DELETE /api/role-room/brand-assets/:id
 *
 * Auth: RR_BEARER_TOKEN. Tilgang gates på prosjekt-medlemskap.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

const MAX_DATA_URL = 1_500_000;
const MAX_NAME = 120;
const VALID_KINDS = ["logo", "icon", "overlay", "template-bg"] as const;
type AssetKind = (typeof VALID_KINDS)[number];

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

export function registerRoleRoomBrandAssetsRoutes(
  app: Express, deps: Deps,
): void {
  const { pool, activeSessions } = deps;

  // GET — list assets for a project
  app.get("/api/role-room/brand-assets",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

      const projectId = String(req.query.projectId ?? "").trim();
      const kind = String(req.query.kind ?? "").trim();
      if (!projectId) {
        res.status(400).json({ error: "mangler_project_id" }); return;
      }

      try {
        if (!await viewerCanAccessProject(pool, projectId, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        const query = kind
          ? `SELECT id, project_id, kind, name, data_url, source_filename,
                    width_px, height_px, tags, created_by, created_at
               FROM role_room_brand_assets
              WHERE project_id = $1 AND kind = $2
              ORDER BY created_at DESC`
          : `SELECT id, project_id, kind, name, data_url, source_filename,
                    width_px, height_px, tags, created_by, created_at
               FROM role_room_brand_assets
              WHERE project_id = $1
              ORDER BY created_at DESC`;
        const params = kind ? [projectId, kind] : [projectId];
        const { rows } = await pool.query(query, params);
        res.json({
          assets: rows.map(r => ({
            id: r.id,
            projectId: r.project_id,
            kind: r.kind,
            name: r.name,
            dataUrl: r.data_url,
            sourceFilename: r.source_filename,
            widthPx: r.width_px,
            heightPx: r.height_px,
            tags: r.tags ?? [],
            createdBy: r.created_by,
            createdAt: r.created_at,
          })),
        });
      } catch (err) {
        console.error("[brand-assets] GET failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // POST — upload new asset
  app.post("/api/role-room/brand-assets",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

      const body = req.body as {
        projectId?: unknown;
        kind?: unknown;
        name?: unknown;
        dataUrl?: unknown;
        sourceFilename?: unknown;
        widthPx?: unknown;
        heightPx?: unknown;
        tags?: unknown;
      } | undefined;

      const projectId = typeof body?.projectId === "string"
        ? body.projectId.trim() : "";
      const kind = typeof body?.kind === "string"
        ? body.kind.trim() : "";
      const name = typeof body?.name === "string"
        ? body.name.trim().slice(0, MAX_NAME) : "";
      const dataUrl = typeof body?.dataUrl === "string"
        ? body.dataUrl.trim() : "";

      if (!projectId || !name || !dataUrl) {
        res.status(400).json({ error: "mangler_felter" }); return;
      }
      if (!(VALID_KINDS as readonly string[]).includes(kind)) {
        res.status(400).json({ error: "ugyldig_kind",
          allowed: VALID_KINDS }); return;
      }
      if (!dataUrl.startsWith("data:image/")) {
        res.status(400).json({ error: "ugyldig_data_url" }); return;
      }
      if (dataUrl.length > MAX_DATA_URL) {
        res.status(413).json({
          error: "asset_for_stor",
          maxBytes: MAX_DATA_URL,
          gotBytes: dataUrl.length,
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
          `INSERT INTO role_room_brand_assets
             (project_id, kind, name, data_url, source_filename,
              width_px, height_px, tags, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, created_at`,
          [
            projectId, kind as AssetKind, name, dataUrl,
            typeof body?.sourceFilename === "string"
              ? body.sourceFilename.slice(0, 200) : null,
            typeof body?.widthPx === "number" ? body.widthPx : null,
            typeof body?.heightPx === "number" ? body.heightPx : null,
            tagsArray,
            viewerId,
          ],
        );
        res.json({
          ok: true,
          id: rows[0].id,
          createdAt: rows[0].created_at,
        });
      } catch (err) {
        console.error("[brand-assets] POST failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // DELETE — remove asset
  app.delete("/api/role-room/brand-assets/:id",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

      const id = req.params.id;
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }

      try {
        // Verifiser at brukeren har tilgang til prosjektet før delete
        const { rows: assetRows } = await pool.query(
          `SELECT project_id FROM role_room_brand_assets WHERE id = $1 LIMIT 1`,
          [id],
        );
        if (assetRows.length === 0) {
          res.status(404).json({ error: "asset_ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, assetRows[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }

        await pool.query(`DELETE FROM role_room_brand_assets WHERE id = $1`, [id]);
        res.json({ ok: true, id });
      } catch (err) {
        console.error("[brand-assets] DELETE failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });
}
