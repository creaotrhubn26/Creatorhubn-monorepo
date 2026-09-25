/**
 * stageone-scene-routes.ts
 *
 * Sky-lagring av StageOne Virtual Studio-scener (iPad-appen ipad/StageOne).
 * Scenene er selv-beskrivende JSON-dokumenter (SceneData i Swift) — backend
 * lagrer dem opakt per bruker, ingen server-side tolkning.
 *
 *   GET    /api/stageone/scenes        — liste (id, name, updatedAt) for innlogget bruker
 *   GET    /api/stageone/scenes/:id    — hele scene-JSON-en
 *   PUT    /api/stageone/scenes/:id    — upsert { name, data }
 *   DELETE /api/stageone/scenes/:id    — slett
 *
 * Auth: requireUserSession (samme bearer-tokens som LeadMapApp — ipad-pairing/
 * Google). Bruker-scoping ALLTID fra sesjonen, aldri fra body.
 * Tabell: lat CREATE TABLE IF NOT EXISTS (selvhelings-mønsteret fra
 * leadgrid-pricing-config-routes) — ingen manuell migrasjon nødvendig.
 */
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };

export interface StageOneSceneRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionData | null;
}

const MAX_SCENE_BYTES = 2 * 1024 * 1024; // 2 MB — scenene er små JSON-dokumenter
const SCENE_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

let tableReady = false;
async function ensureTable(pool: Pool): Promise<void> {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stageone_scenes (
      user_id    TEXT NOT NULL,
      id         TEXT NOT NULL,
      name       TEXT NOT NULL DEFAULT '',
      data       JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, id)
    )
  `);
  tableReady = true;
}

export function registerStageOneSceneRoutes(deps: StageOneSceneRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  app.get("/api/stageone/scenes", async (req: Request, res: Response) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensureTable(pool);
      const r = await pool.query(
        `SELECT id, name, updated_at FROM stageone_scenes WHERE user_id = $1 ORDER BY updated_at DESC`,
        [session.userId],
      );
      res.json({
        scenes: r.rows.map((row) => ({
          id: row.id,
          name: row.name,
          updatedAt: row.updated_at,
        })),
      });
    } catch (err) {
      console.error("[stageone] list scenes feilet:", err);
      res.status(500).json({ error: "scene_list_failed" });
    }
  });

  app.get("/api/stageone/scenes/:id", async (req: Request, res: Response) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensureTable(pool);
      const r = await pool.query(
        `SELECT id, name, data, updated_at FROM stageone_scenes WHERE user_id = $1 AND id = $2`,
        [session.userId, req.params.id],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "scene_not_found" });
      const row = r.rows[0];
      res.json({ id: row.id, name: row.name, data: row.data, updatedAt: row.updated_at });
    } catch (err) {
      console.error("[stageone] get scene feilet:", err);
      res.status(500).json({ error: "scene_get_failed" });
    }
  });

  app.put("/api/stageone/scenes/:id", async (req: Request, res: Response) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const id = String(req.params.id);
    if (!SCENE_ID_RE.test(id)) {
      return res.status(400).json({ error: "ugyldig_scene_id" });
    }
    const { name, data } = (req.body ?? {}) as { name?: unknown; data?: unknown };
    if (typeof data !== "object" || data === null) {
      return res.status(400).json({ error: "data_mangler" });
    }
    const serialized = JSON.stringify(data);
    if (serialized.length > MAX_SCENE_BYTES) {
      return res.status(413).json({ error: "scene_for_stor" });
    }
    try {
      await ensureTable(pool);
      const r = await pool.query(
        `INSERT INTO stageone_scenes (user_id, id, name, data, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, now())
         ON CONFLICT (user_id, id)
         DO UPDATE SET name = EXCLUDED.name, data = EXCLUDED.data, updated_at = now()
         RETURNING updated_at`,
        [session.userId, id, typeof name === "string" ? name.slice(0, 200) : "", serialized],
      );
      res.json({ ok: true, updatedAt: r.rows[0].updated_at });
    } catch (err) {
      console.error("[stageone] put scene feilet:", err);
      res.status(500).json({ error: "scene_save_failed" });
    }
  });

  app.delete("/api/stageone/scenes/:id", async (req: Request, res: Response) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensureTable(pool);
      const r = await pool.query(
        `DELETE FROM stageone_scenes WHERE user_id = $1 AND id = $2`,
        [session.userId, req.params.id],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "scene_not_found" });
      res.json({ ok: true });
    } catch (err) {
      console.error("[stageone] delete scene feilet:", err);
      res.status(500).json({ error: "scene_delete_failed" });
    }
  });
}
