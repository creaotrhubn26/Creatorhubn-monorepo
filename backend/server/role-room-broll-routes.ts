/**
 * B-roll Library — per-prosjekt klipp-bibliotek med Claude-vision-AI-
 * tagging og universal-læring-rangering.
 *
 * Endepunkter:
 *   GET    /api/role-room/broll?projectId=X
 *   POST   /api/role-room/broll                       (register clip)
 *   PATCH  /api/role-room/broll/:id                   (update tags/desc)
 *   PATCH  /api/role-room/broll/:id/analysis          (set vision-AI output)
 *   DELETE /api/role-room/broll/:id
 *   POST   /api/role-room/broll/suggest               (foreslå klipp for kontekst)
 *   POST   /api/role-room/broll/feedback              (approve/reject for læring)
 *
 * Auth: RR_BEARER_TOKEN via activeSessions. Tilgang per prosjekt-
 * medlemskap. Feedback-data lagres uten kontekst-tekst — kun
 * tag-signaturer brukes til universal-rangering.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

const MAX_VISION_BYTES = 100_000;
const MAX_DESCRIPTION = 500;

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

/** Bygg en tag-signatur fra tags-array. Sortert + lowercase for
 * konsistent matching i feedback-rangering. */
function buildTagSignature(tags: string[]): string {
  return tags
    .map(t => t.toLowerCase().trim())
    .filter(t => t.length > 0)
    .sort()
    .slice(0, 8)
    .join("+");
}

export function registerRoleRoomBrollRoutes(
  app: Express, deps: Deps,
): void {
  const { pool, activeSessions } = deps;

  // GET — list clips for project
  app.get("/api/role-room/broll",
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
          `SELECT id, project_id, file_path, preview_video_path,
                  preview_thumbnail_path, vision_analysis, tags,
                  user_description, duration_sec, width, height, fps,
                  suggestion_count, approval_count, rejection_count,
                  usage_count, last_used_at,
                  analysis_status, analysis_error,
                  created_by, created_at, updated_at
             FROM role_room_broll_clips
            WHERE project_id = $1
            ORDER BY last_used_at DESC NULLS LAST, created_at DESC`,
          [projectId],
        );
        res.json({
          clips: rows.map(r => ({
            id: r.id,
            projectId: r.project_id,
            filePath: r.file_path,
            previewVideoPath: r.preview_video_path,
            previewThumbnailPath: r.preview_thumbnail_path,
            visionAnalysis: r.vision_analysis,
            tags: r.tags ?? [],
            userDescription: r.user_description,
            durationSec: r.duration_sec,
            width: r.width,
            height: r.height,
            fps: r.fps,
            suggestionCount: r.suggestion_count,
            approvalCount: r.approval_count,
            rejectionCount: r.rejection_count,
            usageCount: r.usage_count,
            lastUsedAt: r.last_used_at,
            analysisStatus: r.analysis_status,
            analysisError: r.analysis_error,
            createdBy: r.created_by,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          })),
        });
      } catch (err) {
        console.error("[broll] GET failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // POST — register new clip (filsti + meta)
  app.post("/api/role-room/broll",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

      const body = req.body as {
        projectId?: unknown;
        filePath?: unknown;
        durationSec?: unknown;
        width?: unknown;
        height?: unknown;
        fps?: unknown;
        tags?: unknown;
        userDescription?: unknown;
      } | undefined;

      const projectId = typeof body?.projectId === "string"
        ? body.projectId.trim() : "";
      const filePath = typeof body?.filePath === "string"
        ? body.filePath.trim().slice(0, 1000) : "";
      if (!projectId || !filePath) {
        res.status(400).json({ error: "mangler_felter" }); return;
      }

      try {
        if (!await viewerCanAccessProject(pool, projectId, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }

        const tagsArray = Array.isArray(body?.tags)
          ? (body.tags as unknown[])
              .filter(t => typeof t === "string")
              .slice(0, 30)
              .map(t => String(t).slice(0, 50)) : [];

        const { rows } = await pool.query(
          `INSERT INTO role_room_broll_clips
             (project_id, file_path, duration_sec, width, height, fps,
              tags, user_description, created_by, analysis_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
           RETURNING id, created_at`,
          [
            projectId, filePath,
            typeof body?.durationSec === "number" ? body.durationSec : 0,
            typeof body?.width === "number" ? body.width : null,
            typeof body?.height === "number" ? body.height : null,
            typeof body?.fps === "number" ? body.fps : null,
            tagsArray,
            typeof body?.userDescription === "string"
              ? body.userDescription.slice(0, MAX_DESCRIPTION) : null,
            viewerId,
          ],
        );
        res.json({ ok: true, id: rows[0].id, createdAt: rows[0].created_at });
      } catch (err) {
        console.error("[broll] POST failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // PATCH — update tags/desc
  app.patch("/api/role-room/broll/:id",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

      const id = req.params.id;
      const body = req.body as {
        tags?: unknown;
        userDescription?: unknown;
      };
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }

      try {
        const { rows: existing } = await pool.query(
          `SELECT project_id FROM role_room_broll_clips WHERE id = $1`, [id]);
        if (existing.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, existing[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        let p = 1;
        if (Array.isArray(body?.tags)) {
          const tagsArray = (body.tags as unknown[])
            .filter(t => typeof t === "string")
            .slice(0, 30)
            .map(t => String(t).slice(0, 50));
          updates.push(`tags = $${p++}`);
          values.push(tagsArray);
        }
        if (typeof body?.userDescription === "string") {
          updates.push(`user_description = $${p++}`);
          values.push(body.userDescription.slice(0, MAX_DESCRIPTION));
        }
        if (updates.length === 0) {
          res.status(400).json({ error: "ingen_endringer" }); return;
        }
        updates.push(`updated_at = now()`);
        values.push(id);
        await pool.query(
          `UPDATE role_room_broll_clips SET ${updates.join(", ")} WHERE id = $${p}`,
          values,
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[broll] PATCH failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // PATCH /:id/analysis — set vision-AI output etter Python kjørt
  app.patch("/api/role-room/broll/:id/analysis",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

      const id = req.params.id;
      const body = req.body as {
        visionAnalysis?: unknown;
        tags?: unknown;
        previewVideoPath?: unknown;
        previewThumbnailPath?: unknown;
        analysisStatus?: unknown;
        analysisError?: unknown;
      };
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }

      const status = typeof body?.analysisStatus === "string"
        ? body.analysisStatus : "ready";
      if (!["pending", "analyzing", "ready", "failed"].includes(status)) {
        res.status(400).json({ error: "ugyldig_status" }); return;
      }
      const visionJson = body?.visionAnalysis && typeof body.visionAnalysis === "object"
        ? JSON.stringify(body.visionAnalysis) : "{}";
      if (visionJson.length > MAX_VISION_BYTES) {
        res.status(413).json({ error: "vision_analysis_for_stor" }); return;
      }

      try {
        const { rows: existing } = await pool.query(
          `SELECT project_id FROM role_room_broll_clips WHERE id = $1`, [id]);
        if (existing.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, existing[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }

        const tagsArray = Array.isArray(body?.tags)
          ? (body.tags as unknown[])
              .filter(t => typeof t === "string")
              .slice(0, 30)
              .map(t => String(t).slice(0, 50)) : null;

        await pool.query(
          `UPDATE role_room_broll_clips
              SET vision_analysis = $1::jsonb,
                  tags = COALESCE($2::text[], tags),
                  preview_video_path = COALESCE($3, preview_video_path),
                  preview_thumbnail_path = COALESCE($4, preview_thumbnail_path),
                  analysis_status = $5,
                  analysis_error = $6,
                  updated_at = now()
            WHERE id = $7`,
          [
            visionJson, tagsArray,
            typeof body?.previewVideoPath === "string"
              ? body.previewVideoPath.slice(0, 1000) : null,
            typeof body?.previewThumbnailPath === "string"
              ? body.previewThumbnailPath.slice(0, 1000) : null,
            status,
            typeof body?.analysisError === "string"
              ? body.analysisError.slice(0, 500) : null,
            id,
          ],
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[broll] analysis PATCH failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // DELETE
  app.delete("/api/role-room/broll/:id",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

      const id = req.params.id;
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }

      try {
        const { rows } = await pool.query(
          `SELECT project_id FROM role_room_broll_clips WHERE id = $1`, [id]);
        if (rows.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, rows[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        await pool.query(`DELETE FROM role_room_broll_clips WHERE id = $1`, [id]);
        res.json({ ok: true });
      } catch (err) {
        console.error("[broll] DELETE failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // POST /suggest — foreslå klipp for gitt kontekst, rangert med
  // universal-læring boost
  app.post("/api/role-room/broll/suggest",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

      const body = req.body as {
        projectId?: unknown;
        agentKind?: unknown;
        chapterId?: unknown;
        contextTags?: unknown;
        limit?: unknown;
      };

      const projectId = typeof body?.projectId === "string"
        ? body.projectId.trim() : "";
      const agentKind = typeof body?.agentKind === "string"
        ? body.agentKind.trim() : "";
      if (!projectId || !agentKind) {
        res.status(400).json({ error: "mangler_felter" }); return;
      }
      const contextTags = Array.isArray(body?.contextTags)
        ? (body.contextTags as unknown[])
            .filter(t => typeof t === "string")
            .slice(0, 12)
            .map(t => String(t).toLowerCase().trim()) : [];
      const contextSig = buildTagSignature(contextTags);
      const limit = typeof body?.limit === "number"
        ? Math.min(20, Math.max(1, body.limit)) : 6;

      try {
        if (!await viewerCanAccessProject(pool, projectId, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }

        // Hent alle ready-clips for prosjektet
        const { rows: clips } = await pool.query(
          `SELECT id, file_path, preview_thumbnail_path, vision_analysis,
                  tags, duration_sec, usage_count, last_used_at
             FROM role_room_broll_clips
            WHERE project_id = $1 AND analysis_status = 'ready'`,
          [projectId],
        );

        // Hent universal-læring-aggregat for denne agent-kind + context
        const { rows: feedbackRows } = await pool.query(
          `SELECT clip_tag_signature,
                  SUM(CASE WHEN approved THEN 1 ELSE 0 END) AS approvals,
                  SUM(CASE WHEN approved THEN 0 ELSE 1 END) AS rejections
             FROM role_room_broll_feedback
            WHERE agent_kind = $1
              AND context_tag_signature = $2
            GROUP BY clip_tag_signature`,
          [agentKind, contextSig],
        );
        const learningMap = new Map<string, { approvals: number; rejections: number }>();
        for (const r of feedbackRows) {
          learningMap.set(r.clip_tag_signature, {
            approvals: parseInt(r.approvals, 10),
            rejections: parseInt(r.rejections, 10),
          });
        }

        // Rank clips ved: tag-overlap-score × universal-læring-boost
        const ranked = clips.map(c => {
          const clipTags: string[] = c.tags ?? [];
          // Tag-overlap mellom context og clip-tags
          const overlap = clipTags.filter(t =>
            contextTags.includes(t.toLowerCase())).length;
          const baseScore = overlap > 0
            ? overlap / Math.max(contextTags.length, clipTags.length, 1)
            : 0;

          // Universal-læring boost
          const clipSig = buildTagSignature(clipTags);
          const fb = learningMap.get(clipSig);
          const learningBoost = fb
            ? (fb.approvals + 0.5) / (fb.approvals + fb.rejections + 1)
            : 0.5; // ukjent → nøytral

          // Penalize over-used clips litt så vi varierer
          const usagePenalty = Math.min(0.2, (c.usage_count || 0) * 0.02);

          const finalScore = baseScore * (0.4 + learningBoost * 0.6) - usagePenalty;
          return {
            clip: c,
            score: Math.max(0, finalScore),
            baseScore,
            learningBoost,
            overlap,
          };
        });
        ranked.sort((a, b) => b.score - a.score);
        const top = ranked.slice(0, limit);

        // Logg at vi har foreslått disse — øk suggestion_count
        if (top.length > 0) {
          await pool.query(
            `UPDATE role_room_broll_clips
                SET suggestion_count = suggestion_count + 1
              WHERE id = ANY($1::text[])`,
            [top.map(t => t.clip.id)],
          );
        }

        res.json({
          suggestions: top.map(t => ({
            id: t.clip.id,
            filePath: t.clip.file_path,
            previewThumbnailPath: t.clip.preview_thumbnail_path,
            visionAnalysis: t.clip.vision_analysis,
            tags: t.clip.tags ?? [],
            durationSec: t.clip.duration_sec,
            score: Math.round(t.score * 100) / 100,
            baseScore: Math.round(t.baseScore * 100) / 100,
            learningBoost: Math.round(t.learningBoost * 100) / 100,
            tagOverlap: t.overlap,
          })),
          contextSignature: contextSig,
          totalClips: clips.length,
        });
      } catch (err) {
        console.error("[broll] suggest failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // POST /feedback — approve/reject suggestion for universal læring
  app.post("/api/role-room/broll/feedback",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

      const body = req.body as {
        clipId?: unknown;
        approved?: unknown;
        agentKind?: unknown;
        chapterId?: unknown;
        contextTags?: unknown;
      };

      const clipId = typeof body?.clipId === "string" ? body.clipId.trim() : "";
      const approved = body?.approved === true;
      const agentKind = typeof body?.agentKind === "string"
        ? body.agentKind.trim() : "";
      const chapterId = typeof body?.chapterId === "string"
        ? body.chapterId.slice(0, 80) : null;
      const contextTags = Array.isArray(body?.contextTags)
        ? (body.contextTags as unknown[])
            .filter(t => typeof t === "string")
            .slice(0, 12)
            .map(t => String(t).toLowerCase().trim()) : [];

      if (!clipId || !agentKind) {
        res.status(400).json({ error: "mangler_felter" }); return;
      }
      const contextSig = buildTagSignature(contextTags);

      try {
        // Hent klipp-info for clip-tag-signature
        const { rows: clips } = await pool.query(
          `SELECT project_id, tags FROM role_room_broll_clips WHERE id = $1`,
          [clipId],
        );
        if (clips.length === 0) {
          res.status(404).json({ error: "klipp_ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, clips[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        const clipTags: string[] = clips[0].tags ?? [];
        const clipSig = buildTagSignature(clipTags);

        // Lagre feedback for universal læring
        await pool.query(
          `INSERT INTO role_room_broll_feedback
             (agent_kind, chapter_id, context_tag_signature,
              clip_tag_signature, approved, user_id, project_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [agentKind, chapterId, contextSig, clipSig, approved,
            viewerId, clips[0].project_id],
        );

        // Oppdater per-clip aggregate
        if (approved) {
          await pool.query(
            `UPDATE role_room_broll_clips
                SET approval_count = approval_count + 1,
                    usage_count = usage_count + 1,
                    last_used_at = now()
              WHERE id = $1`,
            [clipId],
          );
        } else {
          await pool.query(
            `UPDATE role_room_broll_clips
                SET rejection_count = rejection_count + 1
              WHERE id = $1`,
            [clipId],
          );
        }

        res.json({ ok: true });
      } catch (err) {
        console.error("[broll] feedback failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });
}
