/**
 * Music Library — per-prosjekt musikk-bibliotek med librosa-analyse,
 * suggest-rangering og universal læring.
 *
 * Endepunkter (samme pattern som B-roll):
 *   GET    /api/role-room/music?projectId=X
 *   POST   /api/role-room/music                       (register track)
 *   PATCH  /api/role-room/music/:id                   (update tags/desc/license)
 *   PATCH  /api/role-room/music/:id/analysis          (set librosa-output)
 *   DELETE /api/role-room/music/:id
 *   POST   /api/role-room/music/suggest               (foreslå for kontekst)
 *   POST   /api/role-room/music/feedback              (approve/reject)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { pool: Pool; activeSessions: Map<string, SessionData>; }

const MAX_ANALYSIS_BYTES = 200_000; // librosa-output kan være større enn vision

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

function buildTagSignature(tags: string[]): string {
  return tags
    .map(t => t.toLowerCase().trim())
    .filter(t => t.length > 0)
    .sort()
    .slice(0, 8)
    .join("+");
}

function bpmToBucket(bpm: number | null | undefined): number | null {
  if (!bpm || bpm < 40 || bpm > 220) return null;
  return Math.round(bpm / 10) * 10;
}

export function registerRoleRoomMusicRoutes(
  app: Express, deps: Deps,
): void {
  const { pool, activeSessions } = deps;

  // GET
  app.get("/api/role-room/music",
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
          `SELECT id, project_id, file_path, preview_audio_path,
                  waveform_image_path, audio_analysis, tags,
                  user_description, duration_sec,
                  suggestion_count, approval_count, rejection_count,
                  usage_count, last_used_at,
                  analysis_status, analysis_error,
                  license_type, license_info,
                  created_by, created_at, updated_at
             FROM role_room_music_tracks
            WHERE project_id = $1
            ORDER BY last_used_at DESC NULLS LAST, created_at DESC`,
          [projectId],
        );
        res.json({
          tracks: rows.map(r => ({
            id: r.id,
            projectId: r.project_id,
            filePath: r.file_path,
            previewAudioPath: r.preview_audio_path,
            waveformImagePath: r.waveform_image_path,
            audioAnalysis: r.audio_analysis,
            tags: r.tags ?? [],
            userDescription: r.user_description,
            durationSec: r.duration_sec,
            suggestionCount: r.suggestion_count,
            approvalCount: r.approval_count,
            rejectionCount: r.rejection_count,
            usageCount: r.usage_count,
            lastUsedAt: r.last_used_at,
            analysisStatus: r.analysis_status,
            analysisError: r.analysis_error,
            licenseType: r.license_type,
            licenseInfo: r.license_info,
            createdBy: r.created_by,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          })),
        });
      } catch (err) {
        console.error("[music] GET failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // POST — register
  app.post("/api/role-room/music",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const body = req.body as {
        projectId?: unknown; filePath?: unknown;
        durationSec?: unknown; tags?: unknown;
        userDescription?: unknown;
        licenseType?: unknown; licenseInfo?: unknown;
      };
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
          `INSERT INTO role_room_music_tracks
             (project_id, file_path, duration_sec, tags, user_description,
              license_type, license_info, created_by, analysis_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
           RETURNING id, created_at`,
          [
            projectId, filePath,
            typeof body?.durationSec === "number" ? body.durationSec : 0,
            tagsArray,
            typeof body?.userDescription === "string"
              ? body.userDescription.slice(0, 500) : null,
            typeof body?.licenseType === "string"
              ? body.licenseType.slice(0, 50) : null,
            typeof body?.licenseInfo === "string"
              ? body.licenseInfo.slice(0, 500) : null,
            viewerId,
          ],
        );
        res.json({ ok: true, id: rows[0].id });
      } catch (err) {
        console.error("[music] POST failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // PATCH
  app.patch("/api/role-room/music/:id",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const id = req.params.id;
      const body = req.body as {
        tags?: unknown; userDescription?: unknown;
        licenseType?: unknown; licenseInfo?: unknown;
      };
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }
      try {
        const { rows: existing } = await pool.query(
          `SELECT project_id FROM role_room_music_tracks WHERE id = $1`, [id]);
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
          values.push(body.userDescription.slice(0, 500));
        }
        if (typeof body?.licenseType === "string") {
          updates.push(`license_type = $${p++}`);
          values.push(body.licenseType.slice(0, 50));
        }
        if (typeof body?.licenseInfo === "string") {
          updates.push(`license_info = $${p++}`);
          values.push(body.licenseInfo.slice(0, 500));
        }
        if (updates.length === 0) {
          res.status(400).json({ error: "ingen_endringer" }); return;
        }
        updates.push(`updated_at = now()`);
        values.push(id);
        await pool.query(
          `UPDATE role_room_music_tracks SET ${updates.join(", ")} WHERE id = $${p}`,
          values,
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[music] PATCH failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // PATCH /:id/analysis
  app.patch("/api/role-room/music/:id/analysis",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const id = req.params.id;
      const body = req.body as {
        audioAnalysis?: unknown; tags?: unknown;
        previewAudioPath?: unknown; waveformImagePath?: unknown;
        analysisStatus?: unknown; analysisError?: unknown;
        durationSec?: unknown;
      };
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }
      const status = typeof body?.analysisStatus === "string"
        ? body.analysisStatus : "ready";
      if (!["pending", "analyzing", "ready", "failed"].includes(status)) {
        res.status(400).json({ error: "ugyldig_status" }); return;
      }
      const analysisJson = body?.audioAnalysis && typeof body.audioAnalysis === "object"
        ? JSON.stringify(body.audioAnalysis) : "{}";
      if (analysisJson.length > MAX_ANALYSIS_BYTES) {
        res.status(413).json({ error: "audio_analysis_for_stor" }); return;
      }
      try {
        const { rows: existing } = await pool.query(
          `SELECT project_id FROM role_room_music_tracks WHERE id = $1`, [id]);
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
          `UPDATE role_room_music_tracks
              SET audio_analysis = $1::jsonb,
                  tags = COALESCE($2::text[], tags),
                  preview_audio_path = COALESCE($3, preview_audio_path),
                  waveform_image_path = COALESCE($4, waveform_image_path),
                  duration_sec = COALESCE($5, duration_sec),
                  analysis_status = $6,
                  analysis_error = $7,
                  updated_at = now()
            WHERE id = $8`,
          [
            analysisJson, tagsArray,
            typeof body?.previewAudioPath === "string"
              ? body.previewAudioPath.slice(0, 1000) : null,
            typeof body?.waveformImagePath === "string"
              ? body.waveformImagePath.slice(0, 1000) : null,
            typeof body?.durationSec === "number" ? body.durationSec : null,
            status,
            typeof body?.analysisError === "string"
              ? body.analysisError.slice(0, 500) : null,
            id,
          ],
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[music] analysis PATCH failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // DELETE
  app.delete("/api/role-room/music/:id",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const id = req.params.id;
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }
      try {
        const { rows } = await pool.query(
          `SELECT project_id FROM role_room_music_tracks WHERE id = $1`, [id]);
        if (rows.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, rows[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        await pool.query(`DELETE FROM role_room_music_tracks WHERE id = $1`, [id]);
        res.json({ ok: true });
      } catch (err) {
        console.error("[music] DELETE failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // POST /suggest — context-baserte forslag rangert med universal læring
  app.post("/api/role-room/music/suggest",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const body = req.body as {
        projectId?: unknown; agentKind?: unknown; chapterId?: unknown;
        contextTags?: unknown; targetBpmRange?: unknown; limit?: unknown;
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
      const bpmRange = Array.isArray(body?.targetBpmRange)
        ? (body.targetBpmRange as unknown[])
            .filter(n => typeof n === "number") as number[] : null;
      const limit = typeof body?.limit === "number"
        ? Math.min(20, Math.max(1, body.limit)) : 6;

      try {
        if (!await viewerCanAccessProject(pool, projectId, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        const { rows: tracks } = await pool.query(
          `SELECT id, file_path, preview_audio_path, waveform_image_path,
                  audio_analysis, tags, duration_sec, usage_count
             FROM role_room_music_tracks
            WHERE project_id = $1 AND analysis_status = 'ready'`,
          [projectId],
        );

        // Universal-læring-aggregat
        const { rows: feedbackRows } = await pool.query(
          `SELECT track_tag_signature,
                  SUM(CASE WHEN approved THEN 1 ELSE 0 END) AS approvals,
                  SUM(CASE WHEN approved THEN 0 ELSE 1 END) AS rejections
             FROM role_room_music_feedback
            WHERE agent_kind = $1
              AND context_tag_signature = $2
            GROUP BY track_tag_signature`,
          [agentKind, contextSig],
        );
        const learningMap = new Map<string, { approvals: number; rejections: number }>();
        for (const r of feedbackRows) {
          learningMap.set(r.track_tag_signature, {
            approvals: parseInt(r.approvals, 10),
            rejections: parseInt(r.rejections, 10),
          });
        }

        const ranked = tracks.map(t => {
          const trackTags: string[] = t.tags ?? [];
          const overlap = trackTags.filter(tt =>
            contextTags.includes(tt.toLowerCase())).length;
          const baseScore = overlap > 0
            ? overlap / Math.max(contextTags.length, trackTags.length, 1)
            : 0;

          // BPM-match boost (hvis bpmRange spesifisert)
          let bpmBoost = 1.0;
          const trackBpm = t.audio_analysis?.bpm;
          if (bpmRange && bpmRange.length === 2 && typeof trackBpm === "number") {
            const [minBpm, maxBpm] = bpmRange;
            if (trackBpm >= minBpm && trackBpm <= maxBpm) {
              bpmBoost = 1.4; // 40% boost for BPM-match
            } else {
              const dist = Math.min(
                Math.abs(trackBpm - minBpm),
                Math.abs(trackBpm - maxBpm));
              bpmBoost = Math.max(0.6, 1 - dist / 60); // gradually penalize
            }
          }

          const trackSig = buildTagSignature(trackTags);
          const fb = learningMap.get(trackSig);
          const learningBoost = fb
            ? (fb.approvals + 0.5) / (fb.approvals + fb.rejections + 1)
            : 0.5;

          const usagePenalty = Math.min(0.2, (t.usage_count || 0) * 0.02);

          const finalScore = baseScore * bpmBoost * (0.4 + learningBoost * 0.6)
                              - usagePenalty;
          return {
            track: t,
            score: Math.max(0, finalScore),
            baseScore, learningBoost, bpmBoost, overlap,
          };
        });
        ranked.sort((a, b) => b.score - a.score);
        const top = ranked.slice(0, limit);

        if (top.length > 0) {
          await pool.query(
            `UPDATE role_room_music_tracks
                SET suggestion_count = suggestion_count + 1
              WHERE id = ANY($1::text[])`,
            [top.map(t => t.track.id)],
          );
        }

        res.json({
          suggestions: top.map(t => ({
            id: t.track.id,
            filePath: t.track.file_path,
            previewAudioPath: t.track.preview_audio_path,
            waveformImagePath: t.track.waveform_image_path,
            audioAnalysis: t.track.audio_analysis,
            tags: t.track.tags ?? [],
            durationSec: t.track.duration_sec,
            score: Math.round(t.score * 100) / 100,
            baseScore: Math.round(t.baseScore * 100) / 100,
            learningBoost: Math.round(t.learningBoost * 100) / 100,
            bpmBoost: Math.round(t.bpmBoost * 100) / 100,
            tagOverlap: t.overlap,
          })),
          contextSignature: contextSig,
          totalTracks: tracks.length,
        });
      } catch (err) {
        console.error("[music] suggest failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // POST /feedback
  app.post("/api/role-room/music/feedback",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const body = req.body as {
        trackId?: unknown; approved?: unknown;
        agentKind?: unknown; chapterId?: unknown;
        contextTags?: unknown;
      };
      const trackId = typeof body?.trackId === "string" ? body.trackId.trim() : "";
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
      if (!trackId || !agentKind) {
        res.status(400).json({ error: "mangler_felter" }); return;
      }
      const contextSig = buildTagSignature(contextTags);

      try {
        const { rows: tracks } = await pool.query(
          `SELECT project_id, tags, audio_analysis
             FROM role_room_music_tracks WHERE id = $1`,
          [trackId],
        );
        if (tracks.length === 0) {
          res.status(404).json({ error: "track_ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, tracks[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        const trackTags: string[] = tracks[0].tags ?? [];
        const trackSig = buildTagSignature(trackTags);
        const analysis = tracks[0].audio_analysis || {};
        const bpmBucket = bpmToBucket(analysis.bpm);

        await pool.query(
          `INSERT INTO role_room_music_feedback
             (agent_kind, chapter_id, context_tag_signature,
              track_tag_signature, track_bpm_bucket, track_key, track_mode,
              approved, user_id, project_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            agentKind, chapterId, contextSig, trackSig,
            bpmBucket,
            typeof analysis.key === "string" ? analysis.key : null,
            typeof analysis.mode === "string" ? analysis.mode : null,
            approved, viewerId, tracks[0].project_id,
          ],
        );

        if (approved) {
          await pool.query(
            `UPDATE role_room_music_tracks
                SET approval_count = approval_count + 1,
                    usage_count = usage_count + 1,
                    last_used_at = now()
              WHERE id = $1`,
            [trackId],
          );
        } else {
          await pool.query(
            `UPDATE role_room_music_tracks
                SET rejection_count = rejection_count + 1
              WHERE id = $1`,
            [trackId],
          );
        }
        res.json({ ok: true });
      } catch (err) {
        console.error("[music] feedback failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });
}
