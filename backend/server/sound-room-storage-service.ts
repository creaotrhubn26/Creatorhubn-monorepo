import crypto from "node:crypto";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  UploadPartCommand,
  type CompletedPart,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Pool, PoolClient } from "pg";

import { ensureRoleRoomUserStorageAccount } from "./role-room-storage-billing.js";
import {
  getRoleRoomObjectStorage,
  type RoleRoomObjectStorage,
} from "./role-room-object-storage.js";
import { buildSoundRoomObjectKey } from "./sound-room-storage-contract.js";
export { buildSoundRoomObjectKey } from "./sound-room-storage-contract.js";

const MIB = 1024 ** 2;
const GIB = 1024 ** 3;
const SINGLE_PUT_LIMIT = 100 * MIB;
const MIN_PART_SIZE = 16 * MIB;
const MAX_UPLOAD_BYTES = 20 * GIB;
const MAX_PARTS = 10_000;
const UPLOAD_TTL_SECONDS = 60 * 60;

export const SOUND_ROOM_AUDIO_TYPES = new Set([
  "audio/aac",
  "audio/aiff",
  "audio/flac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/wave",
  "audio/vnd.wave",
  "audio/webm",
  "audio/x-aiff",
  "audio/x-flac",
  "audio/x-m4a",
  "audio/x-wav",
  "application/octet-stream",
]);

export type SoundRoomUploadChannel = "browser" | "protools" | "migration";

export interface SoundRoomUploadInput {
  userId: string;
  projectId: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  checksumSha256: string;
  channel: SoundRoomUploadChannel;
  sessionId?: string | null;
  clientEventId?: string | null;
  forceMultipart?: boolean;
}

export interface SoundRoomUploadTicket {
  objectId: string;
  strategy: "single" | "multipart";
  expiresInSeconds: number;
  uploadUrl?: string;
  uploadId?: string;
  partSize?: number;
  partCount?: number;
  requiredHeaders?: Record<string, string>;
}

export interface SoundRoomCompletedPart {
  partNumber: number;
  etag: string;
  checksumSha256: string;
}

export interface SoundRoomStorageObjectRow {
  id: string;
  storage_account_id: string;
  object_key: string;
  display_name: string;
  size_bytes: string;
  content_type: string | null;
  checksum_sha256: string | null;
  status: string;
  upload_strategy: "single" | "multipart" | "server_copy";
  multipart_upload_id: string | null;
  multipart_part_size: string | null;
  source_channel: string | null;
  metadata: Record<string, unknown>;
}

type Signer = (
  client: S3Client,
  command: PutObjectCommand | UploadPartCommand,
  expiresIn: number,
) => Promise<string>;

export interface SoundRoomStorageDeps {
  storage?: RoleRoomObjectStorage | null;
  signer?: Signer;
}

function normalizeContentType(value: string): string {
  return String(value || "application/octet-stream").trim().toLowerCase();
}

function validChecksum(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function partSizeFor(sizeBytes: number): number {
  const minimumForPartLimit = Math.ceil(sizeBytes / MAX_PARTS / MIB) * MIB;
  return Math.max(MIN_PART_SIZE, minimumForPartLimit);
}

function checksumBase64(checksumHex: string): string {
  return Buffer.from(checksumHex, "hex").toString("base64");
}

async function defaultSigner(
  client: S3Client,
  command: PutObjectCommand | UploadPartCommand,
  expiresIn: number,
): Promise<string> {
  return getSignedUrl(client, command as any, { expiresIn });
}

async function releaseReservation(
  db: Pool | PoolClient,
  accountId: string,
  sizeBytes: number,
): Promise<void> {
  await db.query(
    `SELECT role_room_release_storage_reservation($1::uuid, $2::bigint)`,
    [accountId, sizeBytes],
  );
}

export async function readOwnedSoundRoomObject(
  pool: Pool,
  objectId: string,
  userId: string,
): Promise<SoundRoomStorageObjectRow | null> {
  const result = await pool.query<SoundRoomStorageObjectRow>(
    `SELECT object_row.id, object_row.storage_account_id, object_row.object_key,
            object_row.display_name, object_row.size_bytes,
            object_row.content_type, object_row.checksum_sha256,
            object_row.status, object_row.upload_strategy,
            object_row.multipart_upload_id, object_row.multipart_part_size,
            object_row.source_channel, object_row.metadata
       FROM role_room_storage_objects object_row
       JOIN role_room_storage_accounts account
         ON account.id = object_row.storage_account_id
      WHERE object_row.id = $1::uuid
        AND account.user_id = $2
        AND object_row.deleted_at IS NULL
      LIMIT 1`,
    [objectId, userId],
  );
  return result.rows[0] ?? null;
}

export async function initiateSoundRoomUpload(
  pool: Pool,
  input: SoundRoomUploadInput,
  deps: SoundRoomStorageDeps = {},
): Promise<SoundRoomUploadTicket> {
  const storage = deps.storage === undefined ? getRoleRoomObjectStorage() : deps.storage;
  const signer = deps.signer ?? defaultSigner;
  if (!storage) throw new Error("storage_not_configured");
  if (!input.projectId || input.projectId.length > 160 || !/^[a-zA-Z0-9_-]+$/.test(input.projectId)) {
    throw new Error("invalid_project_id");
  }
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) throw new Error("invalid_size");
  if (input.sizeBytes > MAX_UPLOAD_BYTES) throw new Error("file_too_large");
  if (!validChecksum(input.checksumSha256)) throw new Error("invalid_checksum");
  const contentType = normalizeContentType(input.contentType);
  if (!SOUND_ROOM_AUDIO_TYPES.has(contentType)) throw new Error("unsupported_audio_type");
  if (
    contentType === "application/octet-stream" &&
    !/\.(?:aac|aif|aiff|flac|m4a|mp3|oga|ogg|wav|wave|webm)$/i.test(input.fileName)
  ) {
    throw new Error("unsupported_audio_type");
  }

  const account = await ensureRoleRoomUserStorageAccount(pool, input.userId);
  const reservation = await pool.query<{ role_room_reserve_storage: boolean }>(
    `SELECT role_room_reserve_storage($1::uuid, $2::bigint)`,
    [account.id, input.sizeBytes],
  );
  if (reservation.rows[0]?.role_room_reserve_storage !== true) {
    throw new Error("storage_quota_exceeded");
  }

  const objectId = crypto.randomUUID();
  const objectKey = buildSoundRoomObjectKey(input.userId, input.projectId, objectId, input.fileName);
  const multipart = input.forceMultipart === true || input.sizeBytes > SINGLE_PUT_LIMIT;
  const strategy = multipart ? "multipart" : "single";
  const partSize = multipart ? partSizeFor(input.sizeBytes) : null;
  const metadata = {
    entityType: "audio_review_project",
    entityId: input.projectId,
    sessionId: input.sessionId || null,
    clientEventId: input.clientEventId || null,
    originalChecksumSha256: input.checksumSha256.toLowerCase(),
  };
  let uploadId: string | null = null;
  try {
    if (multipart) {
      const created = await storage.client.send(new CreateMultipartUploadCommand({
        Bucket: storage.bucket,
        Key: objectKey,
        ContentType: contentType,
        ChecksumAlgorithm: "SHA256",
        Metadata: {
          "creatorhub-object-id": objectId,
          "creatorhub-sha256": input.checksumSha256.toLowerCase(),
        },
      }));
      uploadId = created.UploadId || null;
      if (!uploadId) throw new Error("multipart_upload_id_missing");
    }
    await pool.query(
      `INSERT INTO role_room_storage_objects (
         id, storage_account_id, object_key, display_name, size_bytes,
         content_type, checksum_sha256, source_module, created_by_user_id,
         metadata, status, reservation_expires_at, upload_strategy,
         multipart_upload_id, multipart_part_size, source_channel
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4, $5::bigint,
         $6, $7, 'sound-room', $8, $9::jsonb, 'pending',
         NOW() + INTERVAL '1 hour', $10, $11, $12::bigint, $13
       )`,
      [
        objectId,
        account.id,
        objectKey,
        input.fileName.slice(0, 255),
        input.sizeBytes,
        contentType,
        input.checksumSha256.toLowerCase(),
        input.userId,
        JSON.stringify(metadata),
        strategy,
        uploadId,
        partSize,
        input.channel,
      ],
    );

    if (multipart) {
      return {
        objectId,
        strategy,
        uploadId: uploadId!,
        partSize: partSize!,
        partCount: Math.ceil(input.sizeBytes / partSize!),
        expiresInSeconds: UPLOAD_TTL_SECONDS,
      };
    }
    const encodedChecksum = checksumBase64(input.checksumSha256);
    const uploadUrl = await signer(storage.client, new PutObjectCommand({
      Bucket: storage.bucket,
      Key: objectKey,
      ContentType: contentType,
      ChecksumSHA256: encodedChecksum,
      Metadata: {
        "creatorhub-object-id": objectId,
        "creatorhub-sha256": input.checksumSha256.toLowerCase(),
      },
    }), UPLOAD_TTL_SECONDS);
    return {
      objectId,
      strategy,
      uploadUrl,
      expiresInSeconds: UPLOAD_TTL_SECONDS,
      requiredHeaders: {
        "content-type": contentType,
        "x-amz-checksum-sha256": encodedChecksum,
      },
    };
  } catch (error) {
    if (uploadId) {
      await storage.client.send(new AbortMultipartUploadCommand({
        Bucket: storage.bucket,
        Key: objectKey,
        UploadId: uploadId,
      })).catch(() => undefined);
    }
    await pool.query(
      `UPDATE role_room_storage_objects
          SET status = 'quarantined', deleted_at = NOW()
        WHERE id = $1::uuid AND status = 'pending'`,
      [objectId],
    ).catch(() => undefined);
    await releaseReservation(pool, account.id, input.sizeBytes).catch(() => undefined);
    throw error;
  }
}

export async function resumeSoundRoomUpload(
  pool: Pool,
  objectId: string,
  userId: string,
  deps: SoundRoomStorageDeps = {},
): Promise<SoundRoomUploadTicket> {
  const storage = deps.storage === undefined ? getRoleRoomObjectStorage() : deps.storage;
  const signer = deps.signer ?? defaultSigner;
  if (!storage) throw new Error("storage_not_configured");
  const objectRow = await readOwnedSoundRoomObject(pool, objectId, userId);
  if (!objectRow || objectRow.status !== "pending") throw new Error("upload_not_found");
  if (objectRow.upload_strategy === "multipart") {
    const partSize = Number(objectRow.multipart_part_size);
    return {
      objectId: objectRow.id,
      strategy: "multipart",
      uploadId: objectRow.multipart_upload_id || undefined,
      partSize,
      partCount: Math.ceil(Number(objectRow.size_bytes) / partSize),
      expiresInSeconds: UPLOAD_TTL_SECONDS,
    };
  }
  if (!objectRow.checksum_sha256) throw new Error("invalid_checksum");
  const encodedChecksum = checksumBase64(objectRow.checksum_sha256);
  const uploadUrl = await signer(storage.client, new PutObjectCommand({
    Bucket: storage.bucket,
    Key: objectRow.object_key,
    ContentType: objectRow.content_type || "application/octet-stream",
    ChecksumSHA256: encodedChecksum,
    Metadata: {
      "creatorhub-object-id": objectRow.id,
      "creatorhub-sha256": objectRow.checksum_sha256,
    },
  }), UPLOAD_TTL_SECONDS);
  return {
    objectId: objectRow.id,
    strategy: "single",
    uploadUrl,
    expiresInSeconds: UPLOAD_TTL_SECONDS,
    requiredHeaders: {
      "content-type": objectRow.content_type || "application/octet-stream",
      "x-amz-checksum-sha256": encodedChecksum,
    },
  };
}

export async function signSoundRoomUploadParts(
  pool: Pool,
  input: {
    objectId: string;
    userId: string;
    parts: Array<{ partNumber: number; checksumSha256: string }>;
  },
  deps: SoundRoomStorageDeps = {},
): Promise<Array<{ partNumber: number; uploadUrl: string; requiredHeaders: Record<string, string> }>> {
  const storage = deps.storage === undefined ? getRoleRoomObjectStorage() : deps.storage;
  const signer = deps.signer ?? defaultSigner;
  if (!storage) throw new Error("storage_not_configured");
  const objectRow = await readOwnedSoundRoomObject(pool, input.objectId, input.userId);
  if (!objectRow || objectRow.status !== "pending") throw new Error("upload_not_found");
  if (objectRow.upload_strategy !== "multipart" || !objectRow.multipart_upload_id) {
    throw new Error("not_multipart_upload");
  }
  if (!Array.isArray(input.parts) || input.parts.length < 1 || input.parts.length > 200) {
    throw new Error("invalid_parts");
  }
  const expectedPartCount = Math.ceil(
    Number(objectRow.size_bytes) / Number(objectRow.multipart_part_size),
  );
  const seen = new Set<number>();
  for (const part of input.parts) {
    if (!Number.isInteger(part.partNumber) || part.partNumber < 1 || part.partNumber > expectedPartCount) {
      throw new Error("invalid_part_number");
    }
    if (seen.has(part.partNumber) || !validChecksum(part.checksumSha256)) {
      throw new Error("invalid_part_checksum");
    }
    seen.add(part.partNumber);
  }
  return Promise.all(input.parts.map(async (part) => {
    const checksum = checksumBase64(part.checksumSha256);
    const uploadUrl = await signer(storage.client, new UploadPartCommand({
      Bucket: storage.bucket,
      Key: objectRow.object_key,
      UploadId: objectRow.multipart_upload_id!,
      PartNumber: part.partNumber,
      ChecksumSHA256: checksum,
    }), UPLOAD_TTL_SECONDS);
    return {
      partNumber: part.partNumber,
      uploadUrl,
      requiredHeaders: { "x-amz-checksum-sha256": checksum },
    };
  }));
}

async function listAllParts(
  storage: RoleRoomObjectStorage,
  objectRow: SoundRoomStorageObjectRow,
): Promise<Array<{ PartNumber: number; ETag: string; ChecksumSHA256: string | undefined; Size: number }>> {
  const rows: Array<{ PartNumber: number; ETag: string; ChecksumSHA256: string | undefined; Size: number }> = [];
  let marker: string | undefined;
  do {
    const result = await storage.client.send(new ListPartsCommand({
      Bucket: storage.bucket,
      Key: objectRow.object_key,
      UploadId: objectRow.multipart_upload_id!,
      PartNumberMarker: marker,
    }));
    for (const part of result.Parts || []) {
      if (part.PartNumber && part.ETag && part.Size != null) {
        rows.push({
          PartNumber: part.PartNumber,
          ETag: part.ETag,
          ChecksumSHA256: part.ChecksumSHA256,
          Size: part.Size,
        });
      }
    }
    marker = result.IsTruncated ? result.NextPartNumberMarker : undefined;
  } while (marker);
  return rows;
}

export async function getSoundRoomUploadStatus(
  pool: Pool,
  objectId: string,
  userId: string,
  deps: SoundRoomStorageDeps = {},
): Promise<{ status: string; strategy: string; uploadedParts: Array<{ partNumber: number; etag: string; checksumSha256?: string; sizeBytes: number }> }> {
  const storage = deps.storage === undefined ? getRoleRoomObjectStorage() : deps.storage;
  if (!storage) throw new Error("storage_not_configured");
  const objectRow = await readOwnedSoundRoomObject(pool, objectId, userId);
  if (!objectRow) throw new Error("upload_not_found");
  const uploadedParts = objectRow.status === "pending" && objectRow.multipart_upload_id
    ? await listAllParts(storage, objectRow)
    : [];
  return {
    status: objectRow.status,
    strategy: objectRow.upload_strategy,
    uploadedParts: uploadedParts.map((part) => ({
      partNumber: part.PartNumber,
      etag: part.ETag,
      // S3 exposes the checksum as base64, while every public Sound Room
      // upload contract uses lowercase hex. Keep the restart payload in the
      // same representation as initiate/sign/complete.
      checksumSha256: part.ChecksumSHA256
        ? Buffer.from(part.ChecksumSHA256, "base64").toString("hex")
        : undefined,
      sizeBytes: part.Size,
    })),
  };
}

export async function completeSoundRoomUpload(
  pool: Pool,
  input: {
    objectId: string;
    userId: string;
    parts?: SoundRoomCompletedPart[];
  },
  deps: SoundRoomStorageDeps = {},
): Promise<SoundRoomStorageObjectRow> {
  const storage = deps.storage === undefined ? getRoleRoomObjectStorage() : deps.storage;
  if (!storage) throw new Error("storage_not_configured");
  const objectRow = await readOwnedSoundRoomObject(pool, input.objectId, input.userId);
  if (!objectRow) throw new Error("upload_not_found");
  if (objectRow.status === "active") return objectRow;
  if (objectRow.status !== "pending") throw new Error("upload_not_completable");

  let multipartChecksums: string[] = [];
  if (objectRow.upload_strategy === "multipart") {
    if (!objectRow.multipart_upload_id || !Array.isArray(input.parts) || input.parts.length === 0) {
      throw new Error("multipart_parts_required");
    }
    const remoteParts = await listAllParts(storage, objectRow);
    const submitted = [...input.parts].sort((a, b) => a.partNumber - b.partNumber);
    if (remoteParts.length !== submitted.length) throw new Error("multipart_parts_incomplete");
    let totalBytes = 0;
    const completed: CompletedPart[] = [];
    for (let index = 0; index < submitted.length; index += 1) {
      const local = submitted[index];
      const remote = remoteParts[index];
      if (
        local.partNumber !== remote.PartNumber ||
        local.etag.replace(/\"/g, "") !== remote.ETag.replace(/\"/g, "") ||
        !validChecksum(local.checksumSha256) ||
        remote.ChecksumSHA256 !== checksumBase64(local.checksumSha256)
      ) {
        throw new Error("multipart_part_verification_failed");
      }
      totalBytes += remote.Size;
      multipartChecksums.push(local.checksumSha256.toLowerCase());
      completed.push({
        PartNumber: local.partNumber,
        ETag: remote.ETag,
        ChecksumSHA256: remote.ChecksumSHA256,
      });
    }
    if (totalBytes !== Number(objectRow.size_bytes)) throw new Error("size_mismatch");
    await storage.client.send(new CompleteMultipartUploadCommand({
      Bucket: storage.bucket,
      Key: objectRow.object_key,
      UploadId: objectRow.multipart_upload_id,
      MultipartUpload: { Parts: completed },
    }));
  }

  const head = await storage.client.send(new HeadObjectCommand({
    Bucket: storage.bucket,
    Key: objectRow.object_key,
    ChecksumMode: "ENABLED",
  }));
  if (head.ContentLength !== Number(objectRow.size_bytes)) throw new Error("size_mismatch");
  const expectedChecksum = objectRow.checksum_sha256
    ? checksumBase64(objectRow.checksum_sha256)
    : null;
  if (objectRow.upload_strategy === "single" && expectedChecksum && head.ChecksumSHA256 !== expectedChecksum) {
    throw new Error("checksum_mismatch");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const changed = await client.query(
      `UPDATE role_room_storage_objects
          SET status = 'active', reservation_expires_at = NULL,
              verified_at = NOW(), multipart_upload_id = NULL,
              verification = $2::jsonb
        WHERE id = $1::uuid AND status = 'pending'
        RETURNING id`,
      [
        objectRow.id,
        JSON.stringify({
          sizeVerified: true,
          checksumVerified: objectRow.upload_strategy === "single",
          partChecksumsVerified: objectRow.upload_strategy === "multipart",
          multipartChecksums,
          s3ChecksumSha256: head.ChecksumSHA256 || null,
          etag: head.ETag || null,
        }),
      ],
    );
    if ((changed.rowCount ?? 0) > 0) {
      await releaseReservation(client, objectRow.storage_account_id, Number(objectRow.size_bytes));
      await client.query(
        `SELECT role_room_apply_storage_usage(
           $1::uuid, $2::uuid, $3, $4::bigint, 1, 'upload', $5::jsonb
         )`,
        [
          objectRow.storage_account_id,
          objectRow.id,
          `sound-room-upload:${objectRow.id}`,
          Number(objectRow.size_bytes),
          JSON.stringify({ sourceChannel: objectRow.source_channel }),
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return (await readOwnedSoundRoomObject(pool, objectRow.id, input.userId))!;
}

export async function abortSoundRoomUpload(
  pool: Pool,
  objectId: string,
  userId: string,
  deps: SoundRoomStorageDeps = {},
): Promise<boolean> {
  const storage = deps.storage === undefined ? getRoleRoomObjectStorage() : deps.storage;
  if (!storage) throw new Error("storage_not_configured");
  const objectRow = await readOwnedSoundRoomObject(pool, objectId, userId);
  if (!objectRow || objectRow.status !== "pending") return false;
  if (objectRow.multipart_upload_id) {
    await storage.client.send(new AbortMultipartUploadCommand({
      Bucket: storage.bucket,
      Key: objectRow.object_key,
      UploadId: objectRow.multipart_upload_id,
    })).catch(() => undefined);
  } else {
    await storage.client.send(new DeleteObjectCommand({
      Bucket: storage.bucket,
      Key: objectRow.object_key,
    })).catch(() => undefined);
  }
  const changed = await pool.query(
    `UPDATE role_room_storage_objects
        SET status = 'deleted', deleted_at = NOW(), multipart_upload_id = NULL
      WHERE id = $1::uuid AND status = 'pending'`,
    [objectRow.id],
  );
  if ((changed.rowCount ?? 0) > 0) {
    await releaseReservation(pool, objectRow.storage_account_id, Number(objectRow.size_bytes));
  }
  return (changed.rowCount ?? 0) > 0;
}

export async function getSoundRoomObjectStream(
  objectKey: string,
  range?: string,
  deps: SoundRoomStorageDeps = {},
) {
  const storage = deps.storage === undefined ? getRoleRoomObjectStorage() : deps.storage;
  if (!storage) throw new Error("storage_not_configured");
  return storage.client.send(new GetObjectCommand({
    Bucket: storage.bucket,
    Key: objectKey,
    ...(range ? { Range: range } : {}),
  }));
}

export async function putSoundRoomDerivedObject(
  pool: Pool,
  input: {
    userId: string;
    parentObject: SoundRoomStorageObjectRow;
    kind: "preview" | "waveform";
    body: Buffer;
    contentType: string;
    extension: string;
  },
  deps: SoundRoomStorageDeps = {},
): Promise<SoundRoomStorageObjectRow> {
  const storage = deps.storage === undefined ? getRoleRoomObjectStorage() : deps.storage;
  if (!storage) throw new Error("storage_not_configured");
  const objectId = crypto.randomUUID();
  const keyBase = input.parentObject.object_key.replace(/\/original\.[^/.]+$/, "");
  const objectKey = `${keyBase}/${input.kind}.${input.extension.replace(/[^a-z0-9]/gi, "") || "bin"}`;
  const checksum = crypto.createHash("sha256").update(input.body).digest("hex");
  const existing = await pool.query<{ id: string }>(
    `SELECT object_row.id
       FROM role_room_storage_objects object_row
       JOIN role_room_storage_accounts account
         ON account.id = object_row.storage_account_id
      WHERE object_row.object_key = $1
        AND object_row.status = 'active'
        AND object_row.deleted_at IS NULL
        AND account.user_id = $2
      LIMIT 1`,
    [objectKey, input.userId],
  );
  if (existing.rows[0]) {
    const reusable = await readOwnedSoundRoomObject(pool, existing.rows[0].id, input.userId);
    if (reusable) return reusable;
  }
  const reserved = await pool.query<{ role_room_reserve_storage: boolean }>(
    `SELECT role_room_reserve_storage($1::uuid, $2::bigint)`,
    [input.parentObject.storage_account_id, input.body.length],
  );
  if (reserved.rows[0]?.role_room_reserve_storage !== true) throw new Error("storage_quota_exceeded");
  try {
    await storage.client.send(new PutObjectCommand({
      Bucket: storage.bucket,
      Key: objectKey,
      Body: input.body,
      ContentType: input.contentType,
      ChecksumSHA256: checksumBase64(checksum),
    }));
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO role_room_storage_objects (
           id, storage_account_id, object_key, display_name, size_bytes,
           content_type, checksum_sha256, source_module, created_by_user_id,
           metadata, status, upload_strategy, source_channel, verified_at,
           verification
         ) VALUES (
           $1::uuid,$2::uuid,$3,$4,$5::bigint,$6,$7,'sound-room',$8,$9::jsonb,
           'active','server_copy','server',NOW(),$10::jsonb
         )`,
        [
          objectId,
          input.parentObject.storage_account_id,
          objectKey,
          `${input.kind}-${input.parentObject.display_name}`.slice(0, 255),
          input.body.length,
          input.contentType,
          checksum,
          input.userId,
          JSON.stringify({ parentObjectId: input.parentObject.id, kind: input.kind }),
          JSON.stringify({ sizeVerified: true, checksumVerified: true }),
        ],
      );
      await releaseReservation(client, input.parentObject.storage_account_id, input.body.length);
      await client.query(
        `SELECT role_room_apply_storage_usage(
           $1::uuid,$2::uuid,$3,$4::bigint,1,'upload',$5::jsonb
         )`,
        [
          input.parentObject.storage_account_id,
          objectId,
          `sound-room-derived:${objectId}`,
          input.body.length,
          JSON.stringify({ parentObjectId: input.parentObject.id, kind: input.kind }),
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    await releaseReservation(pool, input.parentObject.storage_account_id, input.body.length).catch(() => undefined);
    await storage.client.send(new DeleteObjectCommand({
      Bucket: storage.bucket,
      Key: objectKey,
    })).catch(() => undefined);
    throw error;
  }
  return (await readOwnedSoundRoomObject(pool, objectId, input.userId))!;
}
