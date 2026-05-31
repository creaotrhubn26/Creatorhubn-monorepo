/**
 * Captions / Transcripts — per-prosjekt Whisper-transkript + caption-
 * style. Brukes av Caption Studio.
 *
 * Endepunkter:
 *   GET    /api/role-room/captions?projectId=X
 *   PUT    /api/role-room/captions       (upsert pr prosjekt)
 *   DELETE /api/role-room/captions/:id
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

// Whisper-transkript kan bli stort — base-model ~2 MB pr time tale,
// large-v3 ~5 MB. Cap på 8 MB.
const MAX_TRANSCRIPT_BYTES = 8_000_000;

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

export function registerRoleRoomCaptionsRoutes(
  app: Express, deps: Deps,
): void {
  const { pool, activeSessions } = deps;

  app.get("/api/role-room/captions",
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
          `SELECT id, project_id, source_video_path, transcript, style,
                  style_preset_id, whisper_model, language,
                  created_at, updated_at
             FROM role_room_captions
            WHERE project_id = $1
            ORDER BY updated_at DESC LIMIT 1`,
          [projectId],
        );
        if (rows.length === 0) {
          res.json({ collection: null });
          return;
        }
        const r = rows[0];
        res.json({
          collection: {
            id: r.id,
            projectId: r.project_id,
            sourceVideoPath: r.source_video_path,
            transcript: r.transcript,
            style: r.style,
            stylePresetId: r.style_preset_id,
            whisperModel: r.whisper_model,
            language: r.language,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          },
        });
      } catch (err) {
        console.error("[captions] GET failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  app.put("/api/role-room/captions",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

      const body = req.body as {
        projectId?: unknown;
        sourceVideoPath?: unknown;
        transcript?: unknown;
        style?: unknown;
        stylePresetId?: unknown;
        whisperModel?: unknown;
        language?: unknown;
      } | undefined;

      const projectId = typeof body?.projectId === "string"
        ? body.projectId.trim() : "";
      if (!projectId) {
        res.status(400).json({ error: "mangler_project_id" }); return;
      }
      if (!body?.transcript || typeof body.transcript !== "object") {
        res.status(400).json({ error: "ugyldig_transcript" }); return;
      }
      const transcriptJson = JSON.stringify(body.transcript);
      if (transcriptJson.length > MAX_TRANSCRIPT_BYTES) {
        res.status(413).json({
          error: "transcript_for_stort",
          maxBytes: MAX_TRANSCRIPT_BYTES,
          gotBytes: transcriptJson.length,
        }); return;
      }
      const styleJson = body?.style && typeof body.style === "object"
        ? JSON.stringify(body.style) : "{}";

      try {
        if (!await viewerCanAccessProject(pool, projectId, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }

        // En collection per prosjekt — slett gamle og insert ny
        await pool.query(
          `DELETE FROM role_room_captions WHERE project_id = $1`,
          [projectId],
        );
        const { rows } = await pool.query(
          `INSERT INTO role_room_captions
             (project_id, source_video_path, transcript, style,
              style_preset_id, whisper_model, language, created_by)
           VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8)
           RETURNING id, updated_at`,
          [
            projectId,
            typeof body?.sourceVideoPath === "string"
              ? body.sourceVideoPath.slice(0, 500) : null,
            transcriptJson,
            styleJson,
            typeof body?.stylePresetId === "string"
              ? body.stylePresetId.slice(0, 80) : null,
            typeof body?.whisperModel === "string"
              ? body.whisperModel.slice(0, 50) : null,
            typeof body?.language === "string"
              ? body.language.slice(0, 10) : null,
            viewerId,
          ],
        );
        res.json({ ok: true, id: rows[0].id, updatedAt: rows[0].updated_at });
      } catch (err) {
        console.error("[captions] PUT failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  app.delete("/api/role-room/captions/:id",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const id = req.params.id;
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }
      try {
        const { rows } = await pool.query(
          `SELECT project_id FROM role_room_captions WHERE id = $1`,
          [id],
        );
        if (rows.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, rows[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        await pool.query(`DELETE FROM role_room_captions WHERE id = $1`, [id]);
        res.json({ ok: true });
      } catch (err) {
        console.error("[captions] DELETE failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });
}
