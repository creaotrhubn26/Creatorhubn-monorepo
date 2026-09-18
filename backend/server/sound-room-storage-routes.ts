import crypto from "node:crypto";
import type express from "express";
import type { Pool } from "pg";

import { canAccessProject } from "./project-team-routes.js";
import { getRoleRoomObjectStorage } from "./role-room-object-storage.js";
import { processSoundRoomAudioVersion } from "./sound-room-audio-processing.js";
import { validatedSoundRoomRange } from "./sound-room-storage-contract.js";
export { validatedSoundRoomRange } from "./sound-room-storage-contract.js";
import {
  abortSoundRoomUpload,
  completeSoundRoomUpload,
  getSoundRoomObjectStream,
  getSoundRoomUploadStatus,
  initiateSoundRoomUpload,
  resumeSoundRoomUpload,
  signSoundRoomUploadParts,
  type SoundRoomCompletedPart,
} from "./sound-room-storage-service.js";

export interface SoundRoomStorageRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (
    req: any,
    res: any,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeFileName(value: string): string {
  return value.replace(/[\r\n"\\]/g, "").replace(/[\x00-\x1f\x7f]/g, "").slice(0, 200) || "audio";
}

function sendStorageError(res: any, error: unknown): void {
  const code = error instanceof Error ? error.message : "storage_failed";
  const statuses: Record<string, number> = {
    invalid_project_id: 400,
    invalid_size: 400,
    invalid_checksum: 400,
    invalid_parts: 400,
    invalid_part_number: 400,
    invalid_part_checksum: 400,
    multipart_parts_required: 400,
    unsupported_audio_type: 415,
    file_too_large: 413,
    storage_quota_exceeded: 507,
    storage_not_configured: 503,
    upload_not_found: 404,
    not_multipart_upload: 409,
    upload_not_completable: 409,
    multipart_parts_incomplete: 409,
    multipart_part_verification_failed: 422,
    size_mismatch: 422,
    checksum_mismatch: 422,
  };
  res.status(statuses[code] || 503).json({ error: code });
}

async function ownedAudioProject(pool: Pool, projectId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM audio_review_projects
      WHERE id = $1::uuid AND owner_user_id = $2 LIMIT 1`,
    [projectId, userId],
  ).catch(() => ({ rowCount: 0 }));
  return (result.rowCount ?? 0) > 0;
}

async function canReadAudioProject(pool: Pool, projectId: string, userId: string): Promise<boolean> {
  if (await ownedAudioProject(pool, projectId, userId)) return true;
  const workspace = await pool.query<{ project_id: string }>(
    `SELECT project_id FROM project_audio_rooms
      WHERE audio_review_project_id = $1::uuid LIMIT 1`,
    [projectId],
  ).catch(() => ({ rows: [] as Array<{ project_id: string }> }));
  return workspace.rows[0]?.project_id
    ? canAccessProject(pool, userId, workspace.rows[0].project_id)
    : false;
}

async function sharedMemberForVersion(pool: Pool, token: string, versionId: string) {
  const result = await pool.query<{
    project_id: string;
    owner_user_id: string;
  }>(
    `SELECT member.project_id, project.owner_user_id
       FROM audio_review_members member
       JOIN audio_review_projects project ON project.id = member.project_id
       JOIN audio_review_versions version ON version.project_id = project.id
      WHERE member.invite_token = $1
        AND (member.invite_expires_at IS NULL OR member.invite_expires_at > NOW())
        AND version.id = $2::uuid
      LIMIT 1`,
    [token, versionId],
  ).catch(() => ({ rows: [] as Array<{ project_id: string; owner_user_id: string }> }));
  return result.rows[0] ?? null;
}

async function versionObject(
  pool: Pool,
  versionId: string,
  preview: boolean,
) {
  const result = await pool.query<{
    project_id: string;
    owner_user_id: string;
    object_id: string | null;
    object_key: string | null;
    content_type: string | null;
    display_name: string | null;
    size_bytes: string | null;
  }>(
    `SELECT version.project_id, project.owner_user_id,
            object_row.id AS object_id, object_row.object_key,
            object_row.content_type, object_row.display_name,
            object_row.size_bytes
       FROM audio_review_versions version
       JOIN audio_review_projects project ON project.id = version.project_id
       LEFT JOIN role_room_storage_objects object_row
         ON object_row.id = CASE WHEN $2::boolean
              THEN version.preview_storage_object_id
              ELSE version.storage_object_id
            END
        AND object_row.status = 'active' AND object_row.deleted_at IS NULL
      WHERE version.id = $1::uuid
      LIMIT 1`,
    [versionId, preview],
  );
  return result.rows[0] ?? null;
}

async function pipePrivateAudio(
  req: any,
  res: any,
  row: Awaited<ReturnType<typeof versionObject>>,
  download: boolean,
): Promise<void> {
  if (!row?.object_key) {
    res.status(404).json({ error: "media_not_found" });
    return;
  }
  const range = validatedSoundRoomRange(req.headers.range);
  if (range === false) {
    res.status(416).setHeader("Accept-Ranges", "bytes").end();
    return;
  }
  try {
    const object = await getSoundRoomObjectStream(row.object_key, range || undefined);
    res.status(range ? 206 : 200);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", object.ContentType || row.content_type || "application/octet-stream");
    if (object.ContentLength != null) res.setHeader("Content-Length", String(object.ContentLength));
    if (object.ContentRange) res.setHeader("Content-Range", object.ContentRange);
    if (object.ETag) res.setHeader("ETag", object.ETag);
    if (object.LastModified) res.setHeader("Last-Modified", object.LastModified.toUTCString());
    if (download) {
      res.setHeader("Content-Disposition", `attachment; filename="${safeFileName(row.display_name || "audio")}"`);
    }
    const body: any = object.Body;
    if (!body || typeof body.pipe !== "function") {
      res.status(502).end();
      return;
    }
    body.on("error", (error: unknown) => {
      console.error("[sound-room-storage] response stream failed", error);
      if (!res.headersSent) res.status(502);
      res.end();
    });
    req.on("close", () => body.destroy?.());
    body.pipe(res);
  } catch (error: any) {
    if (error?.$metadata?.httpStatusCode === 416) {
      res.status(416).setHeader("Accept-Ranges", "bytes").end();
      return;
    }
    console.error("[sound-room-storage] private stream failed", error);
    if (!res.headersSent) res.status(503).json({ error: "media_unavailable" });
  }
}

export function setupSoundRoomStorageRoutes({
  app,
  pool,
  requireUserSession,
}: SoundRoomStorageRoutesDeps): void {
  app.post("/api/audio-showcases/:projectId/storage/initiate", async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    const projectId = text(req.params.projectId, 160);
    if (!await ownedAudioProject(pool, projectId, session.userId)) {
      return res.status(404).json({ error: "project_not_found" });
    }
    try {
      const ticket = await initiateSoundRoomUpload(pool, {
        userId: session.userId,
        projectId,
        fileName: text(req.body?.fileName, 255),
        sizeBytes: Number(req.body?.sizeBytes),
        contentType: text(req.body?.contentType, 200) || "application/octet-stream",
        checksumSha256: text(req.body?.checksumSha256, 64).toLowerCase(),
        channel: "browser",
        forceMultipart: req.body?.forceMultipart === true,
      });
      return res.status(201).json(ticket);
    } catch (error) {
      console.error("[sound-room-storage] initiate", error);
      return sendStorageError(res, error);
    }
  });

  app.post("/api/audio-storage/:objectId/parts", async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    try {
      const parts = await signSoundRoomUploadParts(pool, {
        objectId: text(req.params.objectId, 64),
        userId: session.userId,
        parts: Array.isArray(req.body?.parts) ? req.body.parts.map((part: any) => ({
          partNumber: Number(part.partNumber),
          checksumSha256: text(part.checksumSha256, 64).toLowerCase(),
        })) : [],
      });
      return res.json({ parts });
    } catch (error) {
      return sendStorageError(res, error);
    }
  });

  app.post("/api/audio-storage/:objectId/resume", async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    try {
      return res.json(await resumeSoundRoomUpload(
        pool,
        text(req.params.objectId, 64),
        session.userId,
      ));
    } catch (error) {
      return sendStorageError(res, error);
    }
  });

  app.get("/api/audio-storage/:objectId/status", async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    try {
      return res.json(await getSoundRoomUploadStatus(
        pool,
        text(req.params.objectId, 64),
        session.userId,
      ));
    } catch (error) {
      return sendStorageError(res, error);
    }
  });

  app.delete("/api/audio-storage/:objectId", async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    try {
      const aborted = await abortSoundRoomUpload(
        pool,
        text(req.params.objectId, 64),
        session.userId,
      );
      return res.json({ ok: true, aborted });
    } catch (error) {
      return sendStorageError(res, error);
    }
  });

  app.post("/api/audio-storage/:objectId/complete", async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    try {
      const objectRow = await completeSoundRoomUpload(pool, {
        objectId: text(req.params.objectId, 64),
        userId: session.userId,
        parts: Array.isArray(req.body?.parts) ? req.body.parts.map((part: any): SoundRoomCompletedPart => ({
          partNumber: Number(part.partNumber),
          etag: text(part.etag, 512),
          checksumSha256: text(part.checksumSha256, 64).toLowerCase(),
        })) : undefined,
      });
      const projectId = text(objectRow.metadata?.entityId, 160);
      if (!projectId || !await ownedAudioProject(pool, projectId, session.userId)) {
        return res.status(403).json({ error: "object_project_mismatch" });
      }
      const existing = await pool.query(
        `SELECT * FROM audio_review_versions WHERE storage_object_id = $1::uuid LIMIT 1`,
        [objectRow.id],
      );
      if (existing.rows[0]) {
        return res.json({ version: existing.rows[0], idempotent: true });
      }

      const versionId = crypto.randomUUID();
      const client = await pool.connect();
      let created: any;
      try {
        await client.query("BEGIN");
        await client.query(
          `SELECT id FROM audio_review_projects
            WHERE id = $1::uuid AND owner_user_id = $2 FOR UPDATE`,
          [projectId, session.userId],
        );
        await client.query(
          `UPDATE audio_review_versions SET status = 'superseded'
            WHERE project_id = $1::uuid AND status = 'under_review'`,
          [projectId],
        );
        const next = await client.query<{ n: number }>(
          `SELECT COALESCE(MAX(version_number), 0) + 1 AS n
             FROM audio_review_versions WHERE project_id = $1::uuid`,
          [projectId],
        );
        const versionNumber = Number(next.rows[0]?.n || 1);
        const inserted = await client.query(
          `INSERT INTO audio_review_versions (
             id, project_id, version_label, version_number, file_name,
             file_url, file_size, uploaded_by, storage_object_id,
             storage_state, checksum_sha256, content_type
           ) VALUES (
             $1::uuid,$2::uuid,$3,$4,$5,$6,$7::bigint,$8,$9::uuid,
             'processing',$10,$11
           ) RETURNING *`,
          [
            versionId,
            projectId,
            text(req.body?.versionLabel, 80) || `Mix V${versionNumber}`,
            versionNumber,
            objectRow.display_name,
            `/api/audio-versions/${versionId}/media`,
            Number(objectRow.size_bytes),
            session.userId,
            objectRow.id,
            objectRow.checksum_sha256,
            objectRow.content_type,
          ],
        );
        created = inserted.rows[0];
        await client.query(
          `UPDATE audio_review_projects
              SET status = 'under_review', updated_at = NOW()
            WHERE id = $1::uuid`,
          [projectId],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
      void processSoundRoomAudioVersion(pool, versionId, session.userId);
      return res.status(201).json({ version: created });
    } catch (error: any) {
      if (error?.code === "23505") {
        const duplicate = await pool.query(
          `SELECT * FROM audio_review_versions WHERE storage_object_id = $1::uuid LIMIT 1`,
          [text(req.params.objectId, 64)],
        ).catch(() => ({ rows: [] }));
        if (duplicate.rows[0]) return res.json({ version: duplicate.rows[0], idempotent: true });
      }
      console.error("[sound-room-storage] complete", error);
      return sendStorageError(res, error);
    }
  });

  const authenticatedMedia = async (req: any, res: any, download: boolean) => {
    const session = requireUserSession(req, res); if (!session) return;
    const versionId = text(req.params.id, 64);
    const row = await versionObject(pool, versionId, req.query.preview === "1").catch(() => null);
    if (!row || !await canReadAudioProject(pool, row.project_id, session.userId)) {
      return res.status(404).json({ error: "media_not_found" });
    }
    return pipePrivateAudio(req, res, row, download);
  };
  app.get("/api/audio-versions/:id/media", (req, res) => authenticatedMedia(req, res, false));
  app.get("/api/audio-versions/:id/download", (req, res) => authenticatedMedia(req, res, true));

  app.get("/api/audio-versions/:id/waveform", async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    const result = await pool.query(
      `SELECT version.project_id, version.waveform_peaks
         FROM audio_review_versions version WHERE version.id = $1::uuid LIMIT 1`,
      [text(req.params.id, 64)],
    ).catch(() => ({ rows: [] }));
    const row = result.rows[0];
    if (!row || !await canReadAudioProject(pool, row.project_id, session.userId)) {
      return res.status(404).json({ error: "waveform_not_found" });
    }
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.json({ version: 1, peaks: row.waveform_peaks || [] });
  });

  app.get("/api/audio-review-shared/:token/versions/:id/media", async (req, res) => {
    const token = text(req.params.token, 100);
    const versionId = text(req.params.id, 64);
    const member = token.startsWith("inv_")
      ? await sharedMemberForVersion(pool, token, versionId)
      : null;
    if (!member) return res.status(404).json({ error: "media_not_found" });
    const row = await versionObject(pool, versionId, req.query.preview === "1").catch(() => null);
    if (!row || row.project_id !== member.project_id) return res.status(404).json({ error: "media_not_found" });
    return pipePrivateAudio(req, res, row, false);
  });

  app.get("/api/audio-review-shared/:token/versions/:id/waveform", async (req, res) => {
    const token = text(req.params.token, 100);
    const versionId = text(req.params.id, 64);
    const member = token.startsWith("inv_")
      ? await sharedMemberForVersion(pool, token, versionId)
      : null;
    if (!member) return res.status(404).json({ error: "waveform_not_found" });
    const result = await pool.query(
      `SELECT waveform_peaks FROM audio_review_versions
        WHERE id = $1::uuid AND project_id = $2::uuid LIMIT 1`,
      [versionId, member.project_id],
    );
    if (!result.rows[0]) return res.status(404).json({ error: "waveform_not_found" });
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.json({ version: 1, peaks: result.rows[0].waveform_peaks || [] });
  });

  // Lightweight readiness probe used by Sound Room and the desktop companion.
  app.get("/api/audio-storage/health", async (_req, res) => {
    const storage = getRoleRoomObjectStorage();
    if (!storage) return res.status(503).json({ ready: false, provider: null });
    return res.json({ ready: true, provider: storage.provider, region: storage.region });
  });
}
