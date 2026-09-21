import type express from "express";
import type { Pool } from "pg";
import { z } from "zod";

import { requireProjectAccess } from "./project-access.js";
import {
  completeVideoRoomUpload,
  createSoundRoomObjectDownloadUrl,
  deleteCreatorHubMediaObject,
  getVideoRoomUploadStatus,
  initiateProductionAudioUpload,
  resumeVideoRoomUpload,
  signVideoRoomUploadParts,
  type VideoRoomCompletedPart,
} from "./sound-room-storage-service.js";

type Session = { userId: string; email: string; name: string; role: string };
type RequireSession = (req: any, res: any) => Session | null;

const AUDIO_TYPES = [
  "audio/aac", "audio/aiff", "audio/flac", "audio/mp4", "audio/mpeg",
  "audio/ogg", "audio/wav", "audio/wave", "audio/vnd.wave", "audio/webm",
  "audio/x-aiff", "audio/x-flac", "audio/x-m4a", "audio/x-wav",
  "application/octet-stream",
] as const;

const initiateBody = z.object({
  assetId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive().max(20 * 1024 ** 3),
  contentType: z.enum(AUDIO_TYPES),
  checksumSha256: z.string().regex(/^[0-9a-f]{64}$/),
  sourceType: z.enum(["memory_card", "external_recorder", "import", "migration"]),
  recordedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative().optional(),
  sampleRate: z.number().int().positive().max(768000).optional(),
  bitDepth: z.number().int().positive().max(64).optional(),
  channelCount: z.number().int().positive().max(256).optional(),
  channelNames: z.array(z.string().trim().min(1).max(160)).max(256).default([]),
  timecodeStart: z.string().trim().max(32).optional(),
  timeReferenceSamples: z.number().int().nonnegative().optional(),
  frameRate: z.number().positive().max(1000).optional(),
  dropFrame: z.boolean().optional(),
  scene: z.string().trim().max(160).optional(),
  take: z.string().trim().max(80).optional(),
  tape: z.string().trim().max(160).optional(),
  circled: z.boolean().optional(),
  recorderManufacturer: z.string().trim().max(120).optional(),
  recorderModel: z.string().trim().max(160).optional(),
  recorderSerial: z.string().trim().max(160).optional(),
  notes: z.string().max(10000).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
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

const linkBody = z.object({
  videoAssetId: z.string().uuid(),
  syncMethod: z.enum(["timecode", "metadata", "waveform", "clap", "manual"]),
  offsetSeconds: z.number().finite().max(86400).min(-86400).default(0),
  offsetFrames: z.number().finite().max(10_000_000).min(-10_000_000).optional(),
  confidence: z.number().min(0).max(1).optional(),
  driftPpm: z.number().finite().max(100_000).min(-100_000).optional(),
  selectedChannels: z.array(z.number().int().nonnegative().max(255)).max(256).default([]),
});

const assetSelect = `
  SELECT asset.*, COALESCE(account.user_id, project.user_id) AS storage_owner_user_id,
         object_row.status AS storage_status, object_row.object_key AS storage_object_key
    FROM project_production_audio_assets asset
    JOIN projects project ON project.id = asset.project_id
    LEFT JOIN role_room_storage_objects object_row ON object_row.id = asset.storage_object_id
    LEFT JOIN role_room_storage_accounts account ON account.id = object_row.storage_account_id`;

function mapAsset(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    fileName: row.original_filename,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    checksumSha256: row.checksum_sha256,
    sourceType: row.source_type,
    recordedAt: row.recorded_at,
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    sampleRate: row.sample_rate == null ? null : Number(row.sample_rate),
    bitDepth: row.bit_depth == null ? null : Number(row.bit_depth),
    channelCount: row.channel_count == null ? null : Number(row.channel_count),
    channelNames: row.channel_names || [],
    timecodeStart: row.timecode_start || null,
    timeReferenceSamples: row.time_reference_samples == null ? null : Number(row.time_reference_samples),
    frameRate: row.frame_rate == null ? null : Number(row.frame_rate),
    dropFrame: row.drop_frame == null ? null : row.drop_frame === true,
    scene: row.scene || null,
    take: row.take || null,
    tape: row.tape || null,
    circled: row.circled == null ? null : row.circled === true,
    recorderManufacturer: row.recorder_manufacturer || null,
    recorderModel: row.recorder_model || null,
    recorderSerial: row.recorder_serial || null,
    notes: row.notes || null,
    captureState: row.capture_state,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function storageError(error: unknown): { code: string; status: number } {
  const statusByCode: Record<string, number> = {
    invalid_project_id: 400, invalid_size: 400, invalid_checksum: 400,
    invalid_parts: 400, invalid_part_number: 400, invalid_part_checksum: 400,
    multipart_parts_required: 400, unsupported_audio_type: 415, file_too_large: 413,
    storage_quota_exceeded: 507, storage_not_configured: 503, upload_not_found: 404,
    not_multipart_upload: 409, upload_not_completable: 409,
    multipart_parts_incomplete: 409, multipart_part_verification_failed: 422,
    size_mismatch: 422, checksum_mismatch: 422,
  };
  const candidate = String((error as any)?.message || error || "");
  const code = Object.prototype.hasOwnProperty.call(statusByCode, candidate)
    ? candidate : "production_audio_storage_failed";
  return { code, status: statusByCode[code] || 503 };
}

function validAssetId(value: string): boolean {
  return z.string().uuid().safeParse(value).success;
}

export function setupProjectProductionAudioRoutes(input: {
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
      { pool, requireUserSession: sessionFor }, req, res,
      { level, hideExistence: level === "read" },
    );
  const loadAsset = async (projectId: string, assetId: string) => {
    const result = await pool.query(
      `${assetSelect} WHERE asset.project_id=$1 AND asset.id=$2::uuid LIMIT 1`,
      [projectId, assetId],
    );
    return result.rows[0] || null;
  };

  app.get("/api/projects/:projectId/production-audio/assets", async (req, res) => {
    const auth = await access(req, res); if (!auth) return;
    const limit = Math.min(200, Math.max(1, Math.trunc(Number(req.query.limit) || 100)));
    const rows = await pool.query(
      `${assetSelect} WHERE asset.project_id=$1 ORDER BY asset.recorded_at DESC, asset.id DESC LIMIT $2`,
      [req.params.projectId, limit],
    );
    return res.json({ assets: rows.rows.map(mapAsset) });
  });

  app.post("/api/projects/:projectId/production-audio/assets/initiate", async (req, res) => {
    const auth = await access(req, res, "edit"); if (!auth) return;
    const parsed = initiateBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_audio_asset", details: parsed.error.flatten() });
    const body = parsed.data;
    const existing = await loadAsset(req.params.projectId, body.assetId);
    if (existing) {
      if (existing.checksum_sha256 !== body.checksumSha256 || Number(existing.size_bytes) !== body.sizeBytes) {
        return res.status(409).json({ error: "asset_id_conflict" });
      }
      if (existing.capture_state === "ready") return res.json({ asset: mapAsset(existing), upload: null });
      if (existing.storage_status === "active") {
        return res.json({ asset: mapAsset(existing), upload: {
          objectId: String(existing.storage_object_id), strategy: "verified", expiresInSeconds: 0,
        } });
      }
      try {
        const upload = await resumeVideoRoomUpload(
          pool, String(existing.storage_object_id), String(existing.storage_owner_user_id),
        );
        return res.json({ asset: mapAsset(existing), upload });
      } catch (error) {
        const mapped = storageError(error);
        return res.status(mapped.status).json({ error: mapped.code });
      }
    }

    const owner = await pool.query<{ user_id: string }>(
      `SELECT user_id::text FROM projects WHERE id=$1 LIMIT 1`, [req.params.projectId],
    );
    const storageOwnerUserId = owner.rows[0]?.user_id;
    if (!storageOwnerUserId) return res.status(404).json({ error: "project_not_found" });

    let objectId: string | null = null;
    try {
      const upload = await initiateProductionAudioUpload(pool, {
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
      await pool.query(
        `INSERT INTO project_production_audio_assets (
           id,project_id,storage_object_id,created_by_user_id,original_filename,
           content_type,size_bytes,checksum_sha256,source_type,recorded_at,duration_ms,
           sample_rate,bit_depth,channel_count,channel_names,timecode_start,
           time_reference_samples,frame_rate,drop_frame,scene,take,tape,circled,
           recorder_manufacturer,recorder_model,recorder_serial,notes,capture_state,metadata
         ) VALUES (
           $1::uuid,$2,$3::uuid,$4,$5,$6,$7::bigint,$8,$9,$10::timestamptz,$11::bigint,
           $12,$13,$14,$15::jsonb,$16,$17::bigint,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,
           'uploading',$28::jsonb
         )`,
        [
          body.assetId, req.params.projectId, upload.objectId, auth.userId, body.fileName,
          body.contentType, body.sizeBytes, body.checksumSha256, body.sourceType, body.recordedAt,
          body.durationMs ?? null, body.sampleRate ?? null, body.bitDepth ?? null,
          body.channelCount ?? null, JSON.stringify(body.channelNames), body.timecodeStart || null,
          body.timeReferenceSamples ?? null, body.frameRate ?? null, body.dropFrame ?? null,
          body.scene || null, body.take || null, body.tape || null, body.circled ?? null,
          body.recorderManufacturer || null, body.recorderModel || null,
          body.recorderSerial || null, body.notes || null, JSON.stringify(body.metadata),
        ],
      );
      const created = await loadAsset(req.params.projectId, body.assetId);
      return res.status(201).json({ asset: mapAsset(created), upload });
    } catch (error) {
      if (objectId) await deleteCreatorHubMediaObject(pool, objectId, storageOwnerUserId).catch(() => undefined);
      const mapped = storageError(error);
      return res.status(mapped.status).json({ error: mapped.code });
    }
  });

  app.post("/api/projects/:projectId/production-audio/assets/:assetId/upload/parts", async (req, res) => {
    const auth = await access(req, res, "edit"); if (!auth) return;
    if (!validAssetId(req.params.assetId)) return res.status(400).json({ error: "invalid_asset_id" });
    const parsed = partsBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_parts" });
    const asset = await loadAsset(req.params.projectId, req.params.assetId);
    if (!asset?.storage_object_id) return res.status(404).json({ error: "upload_not_found" });
    try {
      return res.json({ parts: await signVideoRoomUploadParts(pool, {
        objectId: String(asset.storage_object_id),
        userId: String(asset.storage_owner_user_id),
        parts: parsed.data.parts,
      }) });
    } catch (error) {
      const mapped = storageError(error);
      return res.status(mapped.status).json({ error: mapped.code });
    }
  });

  app.get("/api/projects/:projectId/production-audio/assets/:assetId/upload/status", async (req, res) => {
    const auth = await access(req, res, "edit"); if (!auth) return;
    if (!validAssetId(req.params.assetId)) return res.status(400).json({ error: "invalid_asset_id" });
    const asset = await loadAsset(req.params.projectId, req.params.assetId);
    if (!asset?.storage_object_id) return res.status(404).json({ error: "upload_not_found" });
    try {
      return res.json(await getVideoRoomUploadStatus(
        pool, String(asset.storage_object_id), String(asset.storage_owner_user_id),
      ));
    } catch (error) {
      const mapped = storageError(error);
      return res.status(mapped.status).json({ error: mapped.code });
    }
  });

  app.post("/api/projects/:projectId/production-audio/assets/:assetId/upload/complete", async (req, res) => {
    const auth = await access(req, res, "edit"); if (!auth) return;
    if (!validAssetId(req.params.assetId)) return res.status(400).json({ error: "invalid_asset_id" });
    const parsed = completeBody.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "invalid_completion" });
    const asset = await loadAsset(req.params.projectId, req.params.assetId);
    if (!asset?.storage_object_id) return res.status(404).json({ error: "upload_not_found" });
    if (asset.capture_state === "ready") return res.json({ asset: mapAsset(asset) });
    try {
      const claim = await pool.query(
        `UPDATE project_production_audio_assets SET capture_state='verifying',updated_at=NOW()
          WHERE id=$1::uuid AND project_id=$2 AND capture_state IN ('registered','uploading','failed')
          RETURNING id`,
        [req.params.assetId, req.params.projectId],
      );
      if (!claim.rows[0]) return res.status(409).json({ error: "asset_verification_in_progress" });
      await completeVideoRoomUpload(pool, {
        objectId: String(asset.storage_object_id),
        userId: String(asset.storage_owner_user_id),
        parts: parsed.data.parts?.map((part): VideoRoomCompletedPart => part),
      });
      await pool.query(
        `UPDATE project_production_audio_assets SET capture_state='ready',updated_at=NOW()
          WHERE id=$1::uuid AND project_id=$2 AND storage_object_id=$3::uuid`,
        [req.params.assetId, req.params.projectId, asset.storage_object_id],
      );
      // An exact shared start-timecode is safe to link automatically. Files
      // without matching timecode stay ready but explicitly unlinked for the
      // waveform/manual sync stage; CreatorHub never guesses destructively.
      await pool.query(
        `INSERT INTO project_video_audio_links (
           project_id,video_asset_id,audio_asset_id,sync_method,offset_seconds,
           confidence,created_by_user_id
         )
         SELECT audio.project_id,video.id,audio.id,'timecode',0,1,$3
           FROM project_production_audio_assets audio
           JOIN project_video_assets video
             ON video.project_id=audio.project_id
            AND video.timecode_start=audio.timecode_start
          WHERE audio.project_id=$1 AND audio.id=$2::uuid
            AND audio.timecode_start IS NOT NULL
         ON CONFLICT(video_asset_id,audio_asset_id) DO NOTHING`,
        [req.params.projectId, req.params.assetId, auth.userId],
      );
      return res.json({ asset: mapAsset(await loadAsset(req.params.projectId, req.params.assetId)) });
    } catch (error) {
      await pool.query(
        `UPDATE project_production_audio_assets SET capture_state='failed',updated_at=NOW()
          WHERE id=$1::uuid AND project_id=$2 AND capture_state='verifying'`,
        [req.params.assetId, req.params.projectId],
      ).catch(() => undefined);
      const mapped = storageError(error);
      return res.status(mapped.status).json({ error: mapped.code });
    }
  });

  app.get("/api/projects/:projectId/production-audio/assets/:assetId", async (req, res) => {
    const auth = await access(req, res); if (!auth) return;
    if (!validAssetId(req.params.assetId)) return res.status(400).json({ error: "invalid_asset_id" });
    const asset = await loadAsset(req.params.projectId, req.params.assetId);
    if (!asset) return res.status(404).json({ error: "asset_not_found" });
    const links = await pool.query(
      `SELECT id,video_asset_id,sync_method,offset_seconds,offset_frames,confidence,
              drift_ppm,selected_channels,created_at,updated_at
         FROM project_video_audio_links
        WHERE project_id=$1 AND audio_asset_id=$2::uuid ORDER BY created_at`,
      [req.params.projectId, req.params.assetId],
    );
    const playbackUrl = asset.capture_state === "ready" && asset.storage_object_key
      ? await createSoundRoomObjectDownloadUrl(asset.storage_object_key, 15 * 60) : null;
    return res.json({ asset: mapAsset(asset), playbackUrl, links: links.rows });
  });

  app.post("/api/projects/:projectId/production-audio/assets/:assetId/links", async (req, res) => {
    const auth = await access(req, res, "edit"); if (!auth) return;
    if (!validAssetId(req.params.assetId)) return res.status(400).json({ error: "invalid_asset_id" });
    const parsed = linkBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_audio_link", details: parsed.error.flatten() });
    const body = parsed.data;
    const inserted = await pool.query(
      `INSERT INTO project_video_audio_links (
         project_id,video_asset_id,audio_asset_id,sync_method,offset_seconds,
         offset_frames,confidence,drift_ppm,selected_channels,created_by_user_id
       )
       SELECT $1,video.id,audio.id,$4,$5,$6,$7,$8,$9::jsonb,$10
         FROM project_video_assets video
         JOIN project_production_audio_assets audio ON audio.project_id=video.project_id
        WHERE video.project_id=$1 AND video.id=$2::uuid AND audio.id=$3::uuid
       ON CONFLICT(video_asset_id,audio_asset_id) DO UPDATE SET
         sync_method=EXCLUDED.sync_method,offset_seconds=EXCLUDED.offset_seconds,
         offset_frames=EXCLUDED.offset_frames,confidence=EXCLUDED.confidence,
         drift_ppm=EXCLUDED.drift_ppm,selected_channels=EXCLUDED.selected_channels,
         updated_at=NOW()
       RETURNING *`,
      [req.params.projectId, body.videoAssetId, req.params.assetId, body.syncMethod,
       body.offsetSeconds, body.offsetFrames ?? null, body.confidence ?? null,
       body.driftPpm ?? null, JSON.stringify(body.selectedChannels), auth.userId],
    );
    if (!inserted.rows[0]) return res.status(404).json({ error: "audio_or_video_asset_not_found" });
    return res.status(201).json({ link: inserted.rows[0] });
  });
}
