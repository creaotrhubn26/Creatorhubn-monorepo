import { createReadStream } from 'node:fs';
import crypto from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Pool } from 'pg';

import {
  checksumFile,
  organizationForUser,
  readRoleRoomContinuityS3Config,
  ROLE_ROOM_AWS_ACCOUNT_ID,
  roleRoomS3Client,
} from './casting-production-continuity-s3.js';
import { roleRoomLocationScoutMediaKey } from './role-room-storage-key.js';
import type { LocationScoutMediaKind } from './casting-production-location-media.js';

export interface LocationScoutCaptureMetadata {
  capturedAt?: string;
  coordinates?: { latitude: number; longitude: number; accuracyMeters?: number };
  bearingDegrees?: number;
  source: 'camera' | 'library' | 'recorder' | 'import';
  deviceLabel?: string;
  sceneIds: string[];
  checkId?: string;
  note?: string;
}

export interface StoredLocationScoutMedia {
  id: string;
  projectId: string;
  locationId: string;
  uploadedBy: string;
  clientUploadId: string;
  kind: LocationScoutMediaKind;
  captureMetadata: LocationScoutCaptureMetadata;
  displayName: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: string;
}

type UploadResult =
  | { ok: true; media: StoredLocationScoutMedia; deduplicated?: boolean }
  | { ok: false; reason: 'storage_not_configured' | 'upload_failed' };

type DownloadResult =
  | { ok: true; url: string; displayName: string; contentType: string; sizeBytes: number }
  | { ok: false; reason: 'not_found' | 'storage_not_configured' | 'storage_unavailable' };

function mapStoredMedia(row: {
  id: string; project_id: string; location_id: string; uploaded_by: string; client_upload_id: string;
  media_kind: LocationScoutMediaKind; capture_metadata: LocationScoutCaptureMetadata | null; display_name: string;
  content_type: string; size_bytes: string; checksum_sha256: string; created_at: Date | string;
}): StoredLocationScoutMedia {
  return {
    id: row.id,
    projectId: row.project_id,
    locationId: row.location_id,
    uploadedBy: row.uploaded_by,
    clientUploadId: row.client_upload_id || row.id,
    kind: row.media_kind || 'photo',
    captureMetadata: { source: 'import', sceneIds: [], ...(row.capture_metadata ?? {}) },
    displayName: row.display_name,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    checksumSha256: row.checksum_sha256,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

async function findExistingMedia(pool: Pool, input: {
  projectId: string;
  locationId: string;
  clientUploadId: string;
}): Promise<StoredLocationScoutMedia | null> {
  const result = await pool.query<{
    id: string; project_id: string; location_id: string; uploaded_by: string; client_upload_id: string;
    media_kind: LocationScoutMediaKind; capture_metadata: LocationScoutCaptureMetadata | null; display_name: string;
    content_type: string; size_bytes: string; checksum_sha256: string; created_at: Date | string;
  }>(
    `SELECT id::text, project_id, location_id, uploaded_by, client_upload_id::text,
            media_kind, capture_metadata, display_name, content_type, size_bytes, checksum_sha256, created_at
       FROM casting_location_scout_media
      WHERE project_id = $1 AND location_id = $2 AND deleted_at IS NULL
        AND client_upload_id = $3::uuid
      ORDER BY created_at DESC
      LIMIT 1`,
    [input.projectId, input.locationId, input.clientUploadId],
  );
  return result.rows[0] ? mapStoredMedia(result.rows[0]) : null;
}

export async function uploadLocationScoutMediaToS3(pool: Pool, input: {
  userId: string;
  projectId: string;
  locationId: string;
  clientUploadId: string;
  kind: LocationScoutMediaKind;
  captureMetadata: LocationScoutCaptureMetadata;
  displayName: string;
  filePath: string;
  sizeBytes: number;
  contentType: string;
}): Promise<UploadResult> {
  let config;
  try {
    config = readRoleRoomContinuityS3Config();
  } catch {
    return { ok: false, reason: 'storage_not_configured' };
  }
  if (!config) return { ok: false, reason: 'storage_not_configured' };

  let organizationId: string | null;
  let checksum: { hex: string; base64: string };
  try {
    [organizationId, checksum] = await Promise.all([
      organizationForUser(pool, input.userId),
      checksumFile(input.filePath),
    ]);
  } catch {
    return { ok: false, reason: 'upload_failed' };
  }
  try {
    const existing = await findExistingMedia(pool, {
      projectId: input.projectId,
      locationId: input.locationId,
      clientUploadId: input.clientUploadId,
    });
    if (existing) return { ok: true, media: existing, deduplicated: true };
  } catch {
    return { ok: false, reason: 'upload_failed' };
  }

  const id = crypto.randomUUID();
  const objectKey = roleRoomLocationScoutMediaKey({
    organizationId,
    userId: input.userId,
    projectId: input.projectId,
    locationId: input.locationId,
    objectId: id,
    fileName: input.displayName,
  });
  const client = roleRoomS3Client(config);
  try {
    await client.send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: createReadStream(input.filePath),
      ContentLength: input.sizeBytes,
      ContentType: input.contentType,
      CacheControl: 'private, no-store',
      ChecksumSHA256: checksum.base64,
      ServerSideEncryption: 'AES256',
      ExpectedBucketOwner: ROLE_ROOM_AWS_ACCOUNT_ID,
      Metadata: {
        purpose: 'role-room-location-scout',
        'media-kind': input.kind,
        'client-upload-id': input.clientUploadId,
      },
    }));
  } catch {
    return { ok: false, reason: 'upload_failed' };
  }

  try {
    const result = await pool.query<{ created_at: Date | string }>(
      `INSERT INTO casting_location_scout_media (
         id, project_id, location_id, uploaded_by, client_upload_id, media_kind, capture_metadata,
         storage_provider, bucket_name, object_key, display_name, size_bytes, content_type, checksum_sha256
       ) VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6, $7::jsonb, 'aws_s3', $8, $9, $10, $11::bigint, $12, $13)
       RETURNING created_at`,
      [id, input.projectId, input.locationId, input.userId, input.clientUploadId, input.kind,
        JSON.stringify(input.captureMetadata), config.bucket, objectKey, input.displayName, input.sizeBytes, input.contentType, checksum.hex],
    );
    const createdAt = result.rows[0]?.created_at;
    return { ok: true, media: {
      id,
      projectId: input.projectId,
      locationId: input.locationId,
      uploadedBy: input.userId,
      clientUploadId: input.clientUploadId,
      kind: input.kind,
      captureMetadata: input.captureMetadata,
      displayName: input.displayName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      checksumSha256: checksum.hex,
      createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt || new Date().toISOString()),
    } };
  } catch (error) {
    await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: objectKey, ExpectedBucketOwner: ROLE_ROOM_AWS_ACCOUNT_ID })).catch(() => undefined);
    if ((error as { code?: string }).code === '23505') {
      const existing = await findExistingMedia(pool, {
        projectId: input.projectId,
        locationId: input.locationId,
        clientUploadId: input.clientUploadId,
      }).catch(() => null);
      if (existing) return { ok: true, media: existing, deduplicated: true };
    }
    return { ok: false, reason: 'upload_failed' };
  }
}

export async function listLocationScoutMedia(pool: Pool, input: { projectId: string; locationId: string }): Promise<StoredLocationScoutMedia[]> {
  const result = await pool.query<{
    id: string; project_id: string; location_id: string; uploaded_by: string; client_upload_id: string;
    media_kind: LocationScoutMediaKind; capture_metadata: LocationScoutCaptureMetadata | null; display_name: string;
    content_type: string; size_bytes: string; checksum_sha256: string; created_at: Date | string;
  }>(
    `SELECT id::text, project_id, location_id, uploaded_by, client_upload_id::text,
            media_kind, capture_metadata, display_name, content_type, size_bytes, checksum_sha256, created_at
       FROM casting_location_scout_media
      WHERE project_id = $1 AND location_id = $2 AND deleted_at IS NULL
      ORDER BY created_at DESC`,
    [input.projectId, input.locationId],
  );
  return result.rows.map(mapStoredMedia);
}

export async function getLocationScoutMediaDownloadUrl(pool: Pool, input: {
  fileId: string;
  projectId: string;
  locationId: string;
  expiresInSeconds?: number;
}): Promise<DownloadResult> {
  const result = await pool.query<{ bucket_name: string; object_key: string; display_name: string; content_type: string; size_bytes: string }>(
    `SELECT bucket_name, object_key, display_name, content_type, size_bytes
       FROM casting_location_scout_media
      WHERE id = $1::uuid AND project_id = $2 AND location_id = $3
        AND storage_provider = 'aws_s3' AND deleted_at IS NULL`,
    [input.fileId, input.projectId, input.locationId],
  );
  const row = result.rows[0];
  if (!row) return { ok: false, reason: 'not_found' };
  let config;
  try {
    config = readRoleRoomContinuityS3Config();
  } catch {
    return { ok: false, reason: 'storage_not_configured' };
  }
  if (!config || row.bucket_name !== config.bucket) return { ok: false, reason: 'storage_not_configured' };
  try {
    const url = await getSignedUrl(roleRoomS3Client(config), new GetObjectCommand({
      Bucket: config.bucket,
      Key: row.object_key,
      ExpectedBucketOwner: ROLE_ROOM_AWS_ACCOUNT_ID,
    }), { expiresIn: Math.max(60, Math.min(600, Math.trunc(input.expiresInSeconds ?? 300))) });
    return { ok: true, url, displayName: row.display_name, contentType: row.content_type, sizeBytes: Number(row.size_bytes) };
  } catch {
    return { ok: false, reason: 'storage_unavailable' };
  }
}

// Backwards-compatible aliases while callers migrate from photo-only naming.
export const uploadLocationScoutPhotoToS3 = uploadLocationScoutMediaToS3;
export const listLocationScoutPhotos = listLocationScoutMedia;
export const getLocationScoutPhotoDownloadUrl = getLocationScoutMediaDownloadUrl;
