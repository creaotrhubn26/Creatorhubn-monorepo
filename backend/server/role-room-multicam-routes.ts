/**
 * Multi-cam sync-grupper — per-prosjekt CRUD.
 *
 * Endepunkter:
 *   GET    /api/role-room/multicam?projectId=X
 *   POST   /api/role-room/multicam              (create new group)
 *   PUT    /api/role-room/multicam/:id          (full upsert clips + sync-state)
 *   DELETE /api/role-room/multicam/:id
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { pool: Pool; activeSessions: Map<string, SessionData>; }

const MAX_CLIPS_JSON = 500_000;

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

export function registerRoleRoomMulticamRoutes(
  app: Express, deps: Deps,
): void {
  const { pool, activeSessions } = deps;

  app.get("/api/role-room/multicam",
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
          `SELECT id, project_id, group_name, clips, agent_kind,
                  sync_status, sync_error, sync_method, last_synced_at,
                  created_by, created_at, updated_at
             FROM role_room_multicam_groups
            WHERE project_id = $1
            ORDER BY updated_at DESC`,
          [projectId],
        );
        res.json({
          groups: rows.map(r => ({
            id: r.id,
            projectId: r.project_id,
            groupName: r.group_name,
            clips: r.clips,
            agentKind: r.agent_kind,
            syncStatus: r.sync_status,
            syncError: r.sync_error,
            syncMethod: r.sync_method,
            lastSyncedAt: r.last_synced_at,
            createdBy: r.created_by,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          })),
        });
      } catch (err) {
        console.error("[multicam] GET failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  app.post("/api/role-room/multicam",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const body = req.body as {
        projectId?: unknown; groupName?: unknown;
        clips?: unknown; agentKind?: unknown;
      };
      const projectId = typeof body?.projectId === "string"
        ? body.projectId.trim() : "";
      const groupName = typeof body?.groupName === "string"
        ? body.groupName.trim().slice(0, 200) : "Nytt sync-gruppe";
      if (!projectId) {
        res.status(400).json({ error: "mangler_project_id" }); return;
      }
      const clipsArray = Array.isArray(body?.clips) ? body.clips : [];
      const clipsJson = JSON.stringify(clipsArray);
      if (clipsJson.length > MAX_CLIPS_JSON) {
        res.status(413).json({ error: "clips_for_stor" }); return;
      }
      try {
        if (!await viewerCanAccessProject(pool, projectId, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        const { rows } = await pool.query(
          `INSERT INTO role_room_multicam_groups
             (project_id, group_name, clips, agent_kind, created_by)
           VALUES ($1, $2, $3::jsonb, $4, $5)
           RETURNING id, created_at`,
          [
            projectId, groupName, clipsJson,
            typeof body?.agentKind === "string"
              ? body.agentKind.slice(0, 50) : null,
            viewerId,
          ],
        );
        res.json({ ok: true, id: rows[0].id });
      } catch (err) {
        console.error("[multicam] POST failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  app.put("/api/role-room/multicam/:id",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const id = req.params.id;
      const body = req.body as {
        groupName?: unknown; clips?: unknown;
        syncStatus?: unknown; syncError?: unknown;
        syncMethod?: unknown;
      };
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }
      try {
        const { rows: existing } = await pool.query(
          `SELECT project_id FROM role_room_multicam_groups WHERE id = $1`, [id]);
        if (existing.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, existing[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        const updates: string[] = [];
        const values: unknown[] = [];
        let p = 1;
        if (typeof body?.groupName === "string") {
          updates.push(`group_name = $${p++}`);
          values.push(body.groupName.slice(0, 200));
        }
        if (Array.isArray(body?.clips)) {
          const json = JSON.stringify(body.clips);
          if (json.length > MAX_CLIPS_JSON) {
            res.status(413).json({ error: "clips_for_stor" }); return;
          }
          updates.push(`clips = $${p++}::jsonb`);
          values.push(json);
        }
        if (typeof body?.syncStatus === "string"
            && ["pending", "syncing", "ready", "failed"].includes(body.syncStatus)) {
          updates.push(`sync_status = $${p++}`);
          values.push(body.syncStatus);
          if (body.syncStatus === "ready") {
            updates.push(`last_synced_at = now()`);
          }
        }
        if (typeof body?.syncError === "string") {
          updates.push(`sync_error = $${p++}`);
          values.push(body.syncError.slice(0, 500));
        }
        if (typeof body?.syncMethod === "string") {
          updates.push(`sync_method = $${p++}`);
          values.push(body.syncMethod.slice(0, 50));
        }
        if (updates.length === 0) {
          res.status(400).json({ error: "ingen_endringer" }); return;
        }
        updates.push(`updated_at = now()`);
        values.push(id);
        await pool.query(
          `UPDATE role_room_multicam_groups SET ${updates.join(", ")} WHERE id = $${p}`,
          values,
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[multicam] PUT failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  app.delete("/api/role-room/multicam/:id",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const id = req.params.id;
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }
      try {
        const { rows } = await pool.query(
          `SELECT project_id FROM role_room_multicam_groups WHERE id = $1`, [id]);
        if (rows.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, rows[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        await pool.query(`DELETE FROM role_room_multicam_groups WHERE id = $1`, [id]);
        res.json({ ok: true });
      } catch (err) {
        console.error("[multicam] DELETE failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });
}
