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

export interface StoredLocationScoutPhoto {
  id: string;
  projectId: string;
  locationId: string;
  uploadedBy: string;
  displayName: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: string;
}

type UploadResult =
  | { ok: true; media: StoredLocationScoutPhoto }
  | { ok: false; reason: 'storage_not_configured' | 'upload_failed' };

type DownloadResult =
  | { ok: true; url: string; displayName: string; contentType: string; sizeBytes: number }
  | { ok: false; reason: 'not_found' | 'storage_not_configured' | 'storage_unavailable' };

export async function uploadLocationScoutPhotoToS3(pool: Pool, input: {
  userId: string;
  projectId: string;
  locationId: string;
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

  const id = crypto.randomUUID();
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
      Metadata: { purpose: 'role-room-location-scout' },
    }));
  } catch {
    return { ok: false, reason: 'upload_failed' };
  }

  try {
    const result = await pool.query<{ created_at: Date | string }>(
      `INSERT INTO casting_location_scout_media (
         id, project_id, location_id, uploaded_by, storage_provider, bucket_name,
         object_key, display_name, size_bytes, content_type, checksum_sha256
       ) VALUES ($1::uuid, $2, $3, $4, 'aws_s3', $5, $6, $7, $8::bigint, $9, $10)
       RETURNING created_at`,
      [id, input.projectId, input.locationId, input.userId, config.bucket, objectKey, input.displayName, input.sizeBytes, input.contentType, checksum.hex],
    );
    const createdAt = result.rows[0]?.created_at;
    return { ok: true, media: {
      id,
      projectId: input.projectId,
      locationId: input.locationId,
      uploadedBy: input.userId,
      displayName: input.displayName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      checksumSha256: checksum.hex,
      createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt || new Date().toISOString()),
    } };
  } catch {
    await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: objectKey, ExpectedBucketOwner: ROLE_ROOM_AWS_ACCOUNT_ID })).catch(() => undefined);
    return { ok: false, reason: 'upload_failed' };
  }
}

export async function listLocationScoutPhotos(pool: Pool, input: { projectId: string; locationId: string }): Promise<StoredLocationScoutPhoto[]> {
  const result = await pool.query<{
    id: string; project_id: string; location_id: string; uploaded_by: string; display_name: string;
    content_type: string; size_bytes: string; checksum_sha256: string; created_at: Date | string;
  }>(
    `SELECT id::text, project_id, location_id, uploaded_by, display_name, content_type,
            size_bytes, checksum_sha256, created_at
       FROM casting_location_scout_media
      WHERE project_id = $1 AND location_id = $2 AND deleted_at IS NULL
      ORDER BY created_at DESC`,
    [input.projectId, input.locationId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    locationId: row.location_id,
    uploadedBy: row.uploaded_by,
    displayName: row.display_name,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    checksumSha256: row.checksum_sha256,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));
}

export async function getLocationScoutPhotoDownloadUrl(pool: Pool, input: {
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
