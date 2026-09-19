import crypto from "node:crypto";
import type express from "express";
import type { Pool } from "pg";
import { z } from "zod";

import {
  getStreamVideoStatus,
  importStreamFromUrl,
  isStreamEnabled,
  signStreamPlaybackUrl,
  signStreamThumbnailUrl,
} from "./cloudflare-stream-service.js";
import { requireProjectAccess } from "./project-access.js";
import {
  completeVideoRoomUpload,
  createSoundRoomObjectDownloadUrl,
  deleteCreatorHubMediaObject,
  getVideoRoomUploadStatus,
  initiateVideoCaptureUpload,
  readOwnedVideoRoomObject,
  resumeVideoRoomUpload,
  signVideoRoomUploadParts,
  type VideoRoomCompletedPart,
} from "./sound-room-storage-service.js";

type Session = { userId: string; email: string; name: string; role: string };
type RequireSession = (req: any, res: any) => Session | null;

const VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/mpeg",
  "video/x-m4v",
  "application/octet-stream",
] as const;

const initiateBody = z.object({
  assetId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive().max(20 * 1024 ** 3),
  contentType: z.enum(VIDEO_TYPES),
  checksumSha256: z.string().regex(/^[0-9a-f]{64}$/),
  sourceType: z.enum([
    "ipad_camera", "uvc", "canon_ccapi", "blackmagic_rest",
    "sony_companion", "ndi_bridge", "import",
  ]),
  recordedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative().optional(),
  frameRate: z.number().positive().max(1000).optional(),
  width: z.number().int().positive().max(32768).optional(),
  height: z.number().int().positive().max(32768).optional(),
  timecodeStart: z.string().trim().max(32).optional(),
  cameraManufacturer: z.string().trim().max(120).optional(),
  cameraModel: z.string().trim().max(160).optional(),
  cameraSerial: z.string().trim().max(160).optional(),
  sceneId: z.string().trim().max(160).optional(),
  shotId: z.string().trim().max(160).optional(),
  slate: z.string().trim().max(80).optional(),
  takeNumber: z.number().int().positive().max(100000).default(1),
  forceMultipart: z.boolean().default(true),
});

const partsBody = z.object({
  parts: z.array(z.object({
    partNumber: z.number().int().positive(),
    checksumSha256: z.string().regex(/^[0-9a-f]{64}$/),
  })).min(1).max(200),
});

const completeBody = z.object({
  parts: z.array(z.object({
    partNumber: z.number().int().positive(),
    etag: z.string().trim().min(1).max(512),
    checksumSha256: z.string().regex(/^[0-9a-f]{64}$/),
  })).optional(),
});

const takePatchBody = z.object({
  status: z.enum(["unrated", "hold", "good", "no_good"]).optional(),
  circled: z.boolean().optional(),
  continuityNotes: z.string().max(10000).nullable().optional(),
  performanceNotes: z.string().max(10000).nullable().optional(),
  technicalNotes: z.string().max(10000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "empty_patch");

const promoteBody = z.object({
  versionLabel: z.string().trim().min(1).max(80).optional(),
});

function storageError(error: unknown): { code: string; status: number } {
  const statusByCode: Record<string, number> = {
    invalid_project_id: 400,
    invalid_size: 400,
    invalid_checksum: 400,
    invalid_parts: 400,
    invalid_part_number: 400,
    invalid_part_checksum: 400,
    multipart_parts_required: 400,
    unsupported_video_type: 415,
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
    asset_upload_changed: 409,
  };
  const candidate = String((error as any)?.message || error || "");
  const code = Object.prototype.hasOwnProperty.call(statusByCode, candidate)
    ? candidate
    : "video_capture_storage_failed";
  return { code, status: statusByCode[code] || 503 };
}

function mapAsset(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    fileName: row.original_filename,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    checksumSha256: row.checksum_sha256,
    sourceType: row.source_type,
    cameraManufacturer: row.camera_manufacturer || null,
    cameraModel: row.camera_model || null,
    cameraSerial: row.camera_serial || null,
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    frameRate: row.frame_rate == null ? null : Number(row.frame_rate),
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
    timecodeStart: row.timecode_start || null,
    recordedAt: row.recorded_at,
    captureState: row.capture_state,
    streamUid: row.stream_uid || null,
    streamState: row.stream_state,
    streamError: row.stream_error || null,
    take: row.take_id ? {
      id: row.take_id,
      sceneId: row.scene_id || null,
      shotId: row.shot_id || null,
      slate: row.slate || null,
      takeNumber: Number(row.take_number || 1),
      status: row.take_status || "unrated",
      circled: row.circled === true,
      continuityNotes: row.continuity_notes || null,
      performanceNotes: row.performance_notes || null,
      technicalNotes: row.technical_notes || null,
    } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validAssetId(value: string): boolean {
  return z.string().uuid().safeParse(value).success;
}

function mapPromotedVersion(row: any) {
  return {
    id: String(row.id),
    versionNumber: Number(row.version_number),
    versionLabel: row.version_label || null,
    status: String(row.status),
  };
}

const assetSelect = `
  SELECT asset.*, take.id AS take_id, take.scene_id, take.shot_id, take.slate,
         take.take_number, take.status AS take_status, take.circled,
         take.continuity_notes, take.performance_notes, take.technical_notes,
         COALESCE(account.user_id, project.user_id) AS storage_owner_user_id,
         object_row.status AS storage_status
    FROM project_video_assets asset
    JOIN projects project ON project.id = asset.project_id
    LEFT JOIN project_video_takes take ON take.asset_id = asset.id
    LEFT JOIN role_room_storage_objects object_row ON object_row.id = asset.storage_object_id
    LEFT JOIN role_room_storage_accounts account ON account.id = object_row.storage_account_id`;

export function setupProjectVideoCaptureRoutes(input: {
  app: express.Application;
  pool: Pool;
  requireUserSession: RequireSession;
  resolveUserSession?: (req: any) => Promise<Session | null>;
}): void {
  const { app, pool } = input;

  const sessionFor = async (req: any, res: any): Promise<Session | null> => {
    if (!input.resolveUserSession) return input.requireUserSession(req, res);
    const session = await input.resolveUserSession(req);
    if (!session) res.status(401).json({ error: "auth_required" });
    return session;
  };
  const access = (req: any, res: any, level: "read" | "edit" = "read") =>
    requireProjectAccess(
      { pool, requireUserSession: sessionFor },
      req,
      res,
      { level, hideExistence: level === "read" },
    );

  const loadAsset = async (projectId: string, assetId: string) => {
    const result = await pool.query(
      `${assetSelect} WHERE asset.project_id=$1 AND asset.id=$2::uuid LIMIT 1`,
      [projectId, assetId],
    );
    return result.rows[0] || null;
  };

  app.get("/api/projects/:projectId/video-capture/assets", async (req, res) => {
    const auth = await access(req, res); if (!auth) return;
    const limit = Math.min(200, Math.max(1, Math.trunc(Number(req.query.limit) || 50)));
    const before = typeof req.query.before === "string" && !Number.isNaN(Date.parse(req.query.before))
      ? req.query.before : null;
    const rows = await pool.query(
      `${assetSelect}
        WHERE asset.project_id=$1
          AND ($2::timestamptz IS NULL OR asset.recorded_at < $2::timestamptz)
        ORDER BY asset.recorded_at DESC, asset.id DESC LIMIT $3`,
      [req.params.projectId, before, limit],
    );
    const assets = await Promise.all(rows.rows.map(async (row) => ({
      ...mapAsset(row),
      playbackUrl: row.stream_uid && row.stream_state === "ready"
        ? await signStreamPlaybackUrl(row.stream_uid, 15 * 60) : null,
      thumbnailUrl: row.stream_uid && row.stream_state === "ready"
        ? await signStreamThumbnailUrl(row.stream_uid, 15 * 60) : null,
    })));
    return res.json({ assets, nextBefore: rows.rows.length === limit ? rows.rows.at(-1)?.recorded_at : null });
  });

  app.post("/api/projects/:projectId/video-capture/assets/initiate", async (req, res) => {
    const auth = await access(req, res, "edit"); if (!auth) return;
    const parsed = initiateBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_video_asset", details: parsed.error.flatten() });
    const body = parsed.data;
    const existing = await loadAsset(req.params.projectId, body.assetId);
    if (existing) {
      if (existing.checksum_sha256 !== body.checksumSha256 || Number(existing.size_bytes) !== body.sizeBytes) {
        return res.status(409).json({ error: "asset_id_conflict" });
      }
      if (existing.capture_state === "ready") {
        return res.status(200).json({ asset: mapAsset(existing), upload: null });
      }
      if (existing.storage_status === "active") {
        return res.status(200).json({
          asset: mapAsset(existing),
          upload: {
            objectId: String(existing.storage_object_id),
            strategy: "verified",
            expiresInSeconds: 0,
          },
        });
      }
      try {
        const upload = await resumeVideoRoomUpload(
          pool,
          String(existing.storage_object_id),
          String(existing.storage_owner_user_id),
        );
        return res.status(200).json({ asset: mapAsset(existing), upload });
      } catch (error) {
        const mapped = storageError(error);
        return res.status(mapped.status).json({ error: mapped.code });
      }
    }

    const owner = await pool.query<{ user_id: string }>(
      `SELECT user_id::text FROM projects WHERE id=$1 LIMIT 1`,
      [req.params.projectId],
    );
    const storageOwnerUserId = owner.rows[0]?.user_id;
    if (!storageOwnerUserId) return res.status(404).json({ error: "project_not_found" });

    let objectId: string | null = null;
    try {
      const upload = await initiateVideoCaptureUpload(pool, {
        userId: storageOwnerUserId,
        organizationId: null,
        createdByUserId: auth.userId,
        projectId: req.params.projectId,
        assetId: body.assetId,
        fileName: body.fileName,
        sizeBytes: body.sizeBytes,
        contentType: body.contentType,
        checksumSha256: body.checksumSha256,
        channel: "capture-ios",
        forceMultipart: body.forceMultipart,
      });
      objectId = upload.objectId;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO project_video_assets (
             id,project_id,storage_object_id,created_by_user_id,original_filename,
             content_type,size_bytes,checksum_sha256,source_type,camera_manufacturer,
             camera_model,camera_serial,duration_ms,frame_rate,width,height,timecode_start,
             recorded_at,capture_state,stream_state
           ) VALUES (
             $1::uuid,$2,$3::uuid,$4,$5,$6,$7::bigint,$8,$9,$10,$11,$12,
             $13::bigint,$14,$15,$16,$17,$18::timestamptz,'uploading','pending'
           )`,
          [
            body.assetId, req.params.projectId, upload.objectId, auth.userId,
            body.fileName, body.contentType, body.sizeBytes, body.checksumSha256,
            body.sourceType, body.cameraManufacturer || null, body.cameraModel || null,
            body.cameraSerial || null, body.durationMs ?? null, body.frameRate ?? null,
            body.width ?? null, body.height ?? null, body.timecodeStart || null, body.recordedAt,
          ],
        );
        await client.query(
          `INSERT INTO project_video_takes (
             project_id,asset_id,scene_id,shot_id,slate,take_number,created_by_user_id
           ) VALUES ($1,$2::uuid,$3,$4,$5,$6,$7)`,
          [req.params.projectId, body.assetId, body.sceneId || null, body.shotId || null,
           body.slate || null, body.takeNumber, auth.userId],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
      const created = await loadAsset(req.params.projectId, body.assetId);
      return res.status(201).json({ asset: mapAsset(created), upload });
    } catch (error) {
      if (objectId) await deleteCreatorHubMediaObject(pool, objectId, storageOwnerUserId).catch(() => undefined);
      const mapped = storageError(error);
      return res.status(mapped.status).json({ error: mapped.code });
    }
  });

  app.post("/api/projects/:projectId/video-capture/assets/:assetId/upload/parts", async (req, res) => {
    const auth = await access(req, res, "edit"); if (!auth) return;
    if (!validAssetId(req.params.assetId)) return res.status(400).json({ error: "invalid_asset_id" });
    const parsed = partsBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_parts" });
    const asset = await loadAsset(req.params.projectId, req.params.assetId);
    if (!asset?.storage_object_id) return res.status(404).json({ error: "upload_not_found" });
    try {
      const parts = await signVideoRoomUploadParts(pool, {
        objectId: String(asset.storage_object_id),
        userId: String(asset.storage_owner_user_id),
        parts: parsed.data.parts,
      });
      return res.json({ parts });
    } catch (error) {
      const mapped = storageError(error);
      return res.status(mapped.status).json({ error: mapped.code });
    }
  });

  app.get("/api/projects/:projectId/video-capture/assets/:assetId/upload/status", async (req, res) => {
    const auth = await access(req, res, "edit"); if (!auth) return;
    if (!validAssetId(req.params.assetId)) return res.status(400).json({ error: "invalid_asset_id" });
    const asset = await loadAsset(req.params.projectId, req.params.assetId);
    if (!asset?.storage_object_id) return res.status(404).json({ error: "upload_not_found" });
    try {
      return res.json(await getVideoRoomUploadStatus(
        pool,
        String(asset.storage_object_id),
        String(asset.storage_owner_user_id),
      ));
    } catch (error) {
      const mapped = storageError(error);
      return res.status(mapped.status).json({ error: mapped.code });
    }
  });

  app.post("/api/projects/:projectId/video-capture/assets/:assetId/upload/complete", async (req, res) => {
    const auth = await access(req, res, "edit"); if (!auth) return;
    if (!validAssetId(req.params.assetId)) return res.status(400).json({ error: "invalid_asset_id" });
    const parsed = completeBody.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "invalid_completion" });
    const asset = await loadAsset(req.params.projectId, req.params.assetId);
    if (!asset?.storage_object_id) return res.status(404).json({ error: "upload_not_found" });
    if (asset.capture_state === "ready") return res.json({ asset: mapAsset(asset) });
    try {
      const claim = await pool.query(
        `UPDATE project_video_assets SET capture_state='verifying',updated_at=NOW()
          WHERE id=$1::uuid AND project_id=$2
            AND capture_state IN ('registered','uploading','failed')
          RETURNING id`,
        [req.params.assetId, req.params.projectId],
      );
      if (!claim.rows[0]) {
        const latest = await loadAsset(req.params.projectId, req.params.assetId);
        if (latest?.capture_state === "ready") return res.json({ asset: mapAsset(latest) });
        return res.status(409).json({ error: "asset_verification_in_progress" });
      }
      await completeVideoRoomUpload(pool, {
        objectId: String(asset.storage_object_id),
        userId: String(asset.storage_owner_user_id),
        parts: parsed.data.parts?.map((part): VideoRoomCompletedPart => part),
      });

      let streamUid: string | null = null;
      let streamState = "skipped";
      let streamError: string | null = null;
      if (isStreamEnabled()) {
        try {
          const stored = await readOwnedVideoRoomObject(
            pool,
            String(asset.storage_object_id),
            String(asset.storage_owner_user_id),
          );
          if (!stored) throw new Error("upload_not_found");
          const sourceUrl = await createSoundRoomObjectDownloadUrl(stored.object_key, 60 * 60);
          const imported = await importStreamFromUrl({
            sourceUrl,
            filename: asset.original_filename,
            creatorId: crypto.createHash("sha256").update(auth.userId).digest("hex").slice(0, 32),
            projectId: req.params.projectId,
            versionId: req.params.assetId,
          });
          streamUid = imported.uid;
          streamState = imported.ready ? "ready" : "processing";
        } catch (error) {
          streamState = "failed";
          streamError = String((error as any)?.message || "stream_import_failed").slice(0, 1000);
        }
      }
      await pool.query(
        `UPDATE project_video_assets
            SET capture_state='ready',stream_uid=$3,stream_state=$4,stream_error=$5,updated_at=NOW()
          WHERE id=$1::uuid AND project_id=$2 AND storage_object_id=$6::uuid`,
        [req.params.assetId, req.params.projectId, streamUid, streamState, streamError, asset.storage_object_id],
      );
      const completed = await loadAsset(req.params.projectId, req.params.assetId);
      return res.json({ asset: mapAsset(completed) });
    } catch (error) {
      await pool.query(
        `UPDATE project_video_assets SET capture_state='failed',updated_at=NOW()
          WHERE id=$1::uuid AND project_id=$2 AND capture_state='verifying'`,
        [req.params.assetId, req.params.projectId],
      ).catch(() => undefined);
      const mapped = storageError(error);
      return res.status(mapped.status).json({ error: mapped.code });
    }
  });

  app.get("/api/projects/:projectId/video-capture/assets/:assetId", async (req, res) => {
    const auth = await access(req, res); if (!auth) return;
    if (!validAssetId(req.params.assetId)) return res.status(400).json({ error: "invalid_asset_id" });
    let asset = await loadAsset(req.params.projectId, req.params.assetId);
    if (!asset) return res.status(404).json({ error: "asset_not_found" });
    if (asset.stream_uid && ["processing", "importing"].includes(asset.stream_state)) {
      const status = await getStreamVideoStatus(asset.stream_uid).catch(() => null);
      if (status) {
        const state = status.ready ? "ready" : status.state === "error" ? "failed" : "processing";
        await pool.query(
          `UPDATE project_video_assets
              SET stream_state=$3,stream_error=$4,duration_ms=COALESCE(duration_ms,$5),
                  width=COALESCE(width,$6),height=COALESCE(height,$7),updated_at=NOW()
            WHERE id=$1::uuid AND project_id=$2`,
          [req.params.assetId, req.params.projectId, state, status.error || null,
           status.duration == null ? null : Math.round(status.duration * 1000),
           status.width || null, status.height || null],
        );
        asset = await loadAsset(req.params.projectId, req.params.assetId);
      }
    }
    return res.json({
      asset: mapAsset(asset),
      playbackUrl: asset.stream_uid && asset.stream_state === "ready"
        ? await signStreamPlaybackUrl(asset.stream_uid, 15 * 60) : null,
      thumbnailUrl: asset.stream_uid && asset.stream_state === "ready"
        ? await signStreamThumbnailUrl(asset.stream_uid, 15 * 60) : null,
    });
  });

  app.post("/api/projects/:projectId/video-capture/assets/:assetId/promote", async (req, res) => {
    const auth = await access(req, res, "edit"); if (!auth) return;
    if (!validAssetId(req.params.assetId)) return res.status(400).json({ error: "invalid_asset_id" });
    const parsed = promoteBody.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "invalid_promotion" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const selected = await client.query(
        `SELECT asset.*, take.slate, take.take_number
           FROM project_video_assets asset
           LEFT JOIN project_video_takes take ON take.asset_id=asset.id
          WHERE asset.id=$1::uuid AND asset.project_id=$2
          FOR UPDATE OF asset`,
        [req.params.assetId, req.params.projectId],
      );
      const asset = selected.rows[0];
      if (!asset) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "asset_not_found" });
      }
      if (asset.capture_state !== "ready" || !asset.storage_object_id) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "asset_not_ready" });
      }

      const existing = await client.query(
        `SELECT id,version_number,version_label,status
           FROM project_video_versions
          WHERE project_id=$1::uuid AND capture_asset_id=$2::uuid
          LIMIT 1`,
        [req.params.projectId, req.params.assetId],
      );
      if (existing.rows[0]) {
        await client.query("COMMIT");
        return res.json({ version: mapPromotedVersion(existing.rows[0]), created: false });
      }

      const next = await client.query(
        `SELECT COALESCE(MAX(version_number),0)+1 AS n
           FROM project_video_versions WHERE project_id=$1::uuid`,
        [req.params.projectId],
      );
      const versionNumber = Number(next.rows[0]?.n || 1);
      const versionId = crypto.randomUUID();
      const defaultLabel = asset.slate
        ? `${String(asset.slate).slice(0, 60)} T${Number(asset.take_number || 1)}`
        : `V${versionNumber}`;
      const versionLabel = parsed.data.versionLabel || defaultLabel;

      await client.query(
        `UPDATE project_video_versions
            SET status='superseded'
          WHERE project_id=$1::uuid AND status IN ('under_review','changes_requested')`,
        [req.params.projectId],
      );
      const inserted = await client.query(
        `INSERT INTO project_video_versions (
           id,project_id,capture_asset_id,version_label,version_number,
           storage_object_id,stream_uid,duration,content_type,size_bytes,
           status,uploaded_by,stream_ready,stream_state,stream_error,stream_checked_at
         ) VALUES (
           $1::uuid,$2::uuid,$3::uuid,$4,$5,$6::uuid,$7,$8,$9,$10,
           'under_review',$11,$12,$13,$14,NOW()
         )
         RETURNING id,version_number,version_label,status`,
        [
          versionId, req.params.projectId, req.params.assetId, versionLabel, versionNumber,
          asset.storage_object_id, asset.stream_uid || null,
          asset.duration_ms == null ? null : Number(asset.duration_ms) / 1000,
          asset.content_type, Number(asset.size_bytes), auth.userId,
          asset.stream_state === "ready", asset.stream_state || "pending", asset.stream_error || null,
        ],
      );
      await client.query("COMMIT");
      return res.status(201).json({ version: mapPromotedVersion(inserted.rows[0]), created: true });
    } catch (error: any) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (String(error?.code) === "23505") {
        const existing = await pool.query(
          `SELECT id,version_number,version_label,status
             FROM project_video_versions
            WHERE project_id=$1::uuid AND capture_asset_id=$2::uuid
            LIMIT 1`,
          [req.params.projectId, req.params.assetId],
        ).catch(() => ({ rows: [] }));
        if (existing.rows[0]) return res.json({ version: mapPromotedVersion(existing.rows[0]), created: false });
      }
      console.error("POST video capture promote", error);
      return res.status(500).json({ error: "promotion_failed" });
    } finally {
      client.release();
    }
  });

  app.patch("/api/projects/:projectId/video-capture/assets/:assetId/take", async (req, res) => {
    const auth = await access(req, res, "edit"); if (!auth) return;
    if (!validAssetId(req.params.assetId)) return res.status(400).json({ error: "invalid_asset_id" });
    const parsed = takePatchBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_take_patch" });
    const body = parsed.data;
    const updated = await pool.query(
      `UPDATE project_video_takes
          SET status=COALESCE($3,status),circled=COALESCE($4,circled),
              continuity_notes=CASE WHEN $5::boolean THEN $6 ELSE continuity_notes END,
              performance_notes=CASE WHEN $7::boolean THEN $8 ELSE performance_notes END,
              technical_notes=CASE WHEN $9::boolean THEN $10 ELSE technical_notes END,
              updated_at=NOW()
        WHERE project_id=$1 AND asset_id=$2::uuid RETURNING id`,
      [req.params.projectId, req.params.assetId, body.status || null,
       body.circled ?? null,
       Object.prototype.hasOwnProperty.call(body, "continuityNotes"), body.continuityNotes ?? null,
       Object.prototype.hasOwnProperty.call(body, "performanceNotes"), body.performanceNotes ?? null,
       Object.prototype.hasOwnProperty.call(body, "technicalNotes"), body.technicalNotes ?? null],
    );
    if (!updated.rows[0]) return res.status(404).json({ error: "take_not_found" });
    const asset = await loadAsset(req.params.projectId, req.params.assetId);
    return res.json({ asset: mapAsset(asset) });
  });
}
