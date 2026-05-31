/**
 * Social Cuts — per-prosjekt repurpose-cuts fra long-form-content.
 *
 * Endepunkter:
 *   GET    /api/role-room/social-cuts?projectId=X
 *   POST   /api/role-room/social-cuts            (register new cut)
 *   PATCH  /api/role-room/social-cuts/:id        (update fields)
 *   DELETE /api/role-room/social-cuts/:id
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { pool: Pool; activeSessions: Map<string, SessionData>; }

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

const VALID_STATUSES = ["extracted", "reviewed", "approved", "published", "rejected"];
const VALID_ASPECTS = ["9:16", "1:1", "4:5", "16:9"];

export function registerRoleRoomSocialCutsRoutes(
  app: Express, deps: Deps,
): void {
  const { pool, activeSessions } = deps;

  app.get("/api/role-room/social-cuts",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const projectId = String(req.query.projectId ?? "").trim();
      const status = String(req.query.status ?? "").trim();
      if (!projectId) {
        res.status(400).json({ error: "mangler_project_id" }); return;
      }
      try {
        if (!await viewerCanAccessProject(pool, projectId, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        const query = status && VALID_STATUSES.includes(status)
          ? `SELECT * FROM role_room_social_cuts
              WHERE project_id = $1 AND status = $2
              ORDER BY standout_score DESC NULLS LAST, created_at DESC`
          : `SELECT * FROM role_room_social_cuts
              WHERE project_id = $1
              ORDER BY standout_score DESC NULLS LAST, created_at DESC`;
        const params = status && VALID_STATUSES.includes(status)
          ? [projectId, status] : [projectId];
        const { rows } = await pool.query(query, params);
        res.json({
          cuts: rows.map(r => ({
            id: r.id,
            projectId: r.project_id,
            sourceVideoPath: r.source_video_path,
            startSec: parseFloat(r.start_sec),
            endSec: parseFloat(r.end_sec),
            outputPath: r.output_path,
            aspectRatio: r.aspect_ratio,
            captionsBurnt: r.captions_burnt,
            thumbnailPath: r.thumbnail_path,
            standoutScore: r.standout_score
              ? parseFloat(r.standout_score) : null,
            transcriptSnippet: r.transcript_snippet,
            headline: r.headline,
            status: r.status,
            agentKind: r.agent_kind,
            renderCount: r.render_count,
            renderedAt: r.rendered_at,
            createdBy: r.created_by,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          })),
        });
      } catch (err) {
        console.error("[social-cuts] GET failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  app.post("/api/role-room/social-cuts",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const body = req.body as {
        projectId?: unknown; sourceVideoPath?: unknown;
        startSec?: unknown; endSec?: unknown;
        aspectRatio?: unknown; captionsBurnt?: unknown;
        outputPath?: unknown; thumbnailPath?: unknown;
        standoutScore?: unknown; transcriptSnippet?: unknown;
        headline?: unknown; agentKind?: unknown;
      };
      const projectId = typeof body?.projectId === "string"
        ? body.projectId.trim() : "";
      const sourceVideoPath = typeof body?.sourceVideoPath === "string"
        ? body.sourceVideoPath.trim() : "";
      const startSec = typeof body?.startSec === "number" ? body.startSec : null;
      const endSec = typeof body?.endSec === "number" ? body.endSec : null;
      if (!projectId || !sourceVideoPath
          || startSec === null || endSec === null
          || endSec <= startSec) {
        res.status(400).json({ error: "mangler_felter" }); return;
      }
      const aspectRatio = typeof body?.aspectRatio === "string"
        && VALID_ASPECTS.includes(body.aspectRatio)
        ? body.aspectRatio : "9:16";
      try {
        if (!await viewerCanAccessProject(pool, projectId, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        const { rows } = await pool.query(
          `INSERT INTO role_room_social_cuts
             (project_id, source_video_path, start_sec, end_sec,
              aspect_ratio, captions_burnt, output_path, thumbnail_path,
              standout_score, transcript_snippet, headline, agent_kind,
              created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING id, created_at`,
          [
            projectId, sourceVideoPath.slice(0, 1000),
            startSec, endSec, aspectRatio,
            body?.captionsBurnt === true,
            typeof body?.outputPath === "string"
              ? body.outputPath.slice(0, 1000) : null,
            typeof body?.thumbnailPath === "string"
              ? body.thumbnailPath.slice(0, 1000) : null,
            typeof body?.standoutScore === "number" ? body.standoutScore : null,
            typeof body?.transcriptSnippet === "string"
              ? body.transcriptSnippet.slice(0, 5000) : null,
            typeof body?.headline === "string"
              ? body.headline.slice(0, 200) : null,
            typeof body?.agentKind === "string"
              ? body.agentKind.slice(0, 50) : null,
            viewerId,
          ],
        );
        res.json({ ok: true, id: rows[0].id });
      } catch (err) {
        console.error("[social-cuts] POST failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  app.patch("/api/role-room/social-cuts/:id",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const id = req.params.id;
      const body = req.body as Record<string, unknown>;
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }
      try {
        const { rows: existing } = await pool.query(
          `SELECT project_id FROM role_room_social_cuts WHERE id = $1`, [id]);
        if (existing.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, existing[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        const updates: string[] = [];
        const values: unknown[] = [];
        let p = 1;
        if (typeof body?.outputPath === "string") {
          updates.push(`output_path = $${p++}`);
          values.push(body.outputPath.slice(0, 1000));
          updates.push(`render_count = render_count + 1`);
          updates.push(`rendered_at = now()`);
        }
        if (typeof body?.thumbnailPath === "string") {
          updates.push(`thumbnail_path = $${p++}`);
          values.push(body.thumbnailPath.slice(0, 1000));
        }
        if (typeof body?.headline === "string") {
          updates.push(`headline = $${p++}`);
          values.push(body.headline.slice(0, 200));
        }
        if (typeof body?.status === "string"
            && VALID_STATUSES.includes(body.status)) {
          updates.push(`status = $${p++}`);
          values.push(body.status);
        }
        if (typeof body?.captionsBurnt === "boolean") {
          updates.push(`captions_burnt = $${p++}`);
          values.push(body.captionsBurnt);
        }
        if (typeof body?.aspectRatio === "string"
            && VALID_ASPECTS.includes(body.aspectRatio)) {
          updates.push(`aspect_ratio = $${p++}`);
          values.push(body.aspectRatio);
        }
        if (updates.length === 0) {
          res.status(400).json({ error: "ingen_endringer" }); return;
        }
        updates.push(`updated_at = now()`);
        values.push(id);
        await pool.query(
          `UPDATE role_room_social_cuts SET ${updates.join(", ")} WHERE id = $${p}`,
          values,
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[social-cuts] PATCH failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  app.delete("/api/role-room/social-cuts/:id",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const id = req.params.id;
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }
      try {
        const { rows } = await pool.query(
          `SELECT project_id FROM role_room_social_cuts WHERE id = $1`, [id]);
        if (rows.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, rows[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        await pool.query(`DELETE FROM role_room_social_cuts WHERE id = $1`, [id]);
        res.json({ ok: true });
      } catch (err) {
        console.error("[social-cuts] DELETE failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });
}
