import type { Pool } from "pg";

import { getRoleRoomObjectStorage } from "./role-room-object-storage.js";
import {
  abortSoundRoomUpload,
  completeSoundRoomUpload,
  createSoundRoomObjectDownloadUrl,
  deleteCreatorHubMediaObject,
  getSoundRoomObjectStream,
  getSoundRoomUploadStatus,
  initiateProductionSoundUpload,
  readOwnedSoundRoomObject,
  resumeSoundRoomUpload,
  signSoundRoomUploadParts,
  type SoundRoomCompletedPart,
  type SoundRoomStorageDeps,
  type SoundRoomStorageObjectRow,
  type SoundRoomUploadTicket,
} from "./sound-room-storage-service.js";
import {
  organizationForUser,
  readRoleRoomContinuityS3Config,
} from "./casting-production-continuity-s3.js";
import {
  inspectProductionSoundWave,
  PRODUCTION_SOUND_WAVE_MIME_TYPES,
  type ProductionSoundWaveMetadata,
} from "./casting-production-sound-media.js";

export interface StoredProductionSoundMedia {
  id: string;
  projectId: string;
  productionDayId: string;
  storageObjectId: string;
  uploadedBy?: string;
  displayName: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  recorderMetadata: ProductionSoundWaveMetadata;
  reconciliationStatus: "unmatched" | "matched";
  continuityTakeId?: string;
  reconciledBy?: string;
  reconciledAt?: string;
  createdAt: string;
}

type ProductionSoundMediaRow = {
  id: string;
  project_id: string;
  production_day_id: string;
  storage_object_id: string;
  uploaded_by: string | null;
  display_name: string;
  content_type: string;
  size_bytes: string | number;
  checksum_sha256: string;
  recorder_metadata: ProductionSoundWaveMetadata;
  reconciliation_status: "unmatched" | "matched";
  continuity_take_id: string | null;
  reconciled_by: string | null;
  reconciled_at: Date | string | null;
  created_at: Date | string;
};

function iso(value: Date | string | null): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : String(value);
}

export function mapProductionSoundMediaRow(
  row: ProductionSoundMediaRow,
): StoredProductionSoundMedia {
  return {
    id: row.id,
    projectId: row.project_id,
    productionDayId: row.production_day_id,
    storageObjectId: row.storage_object_id,
    uploadedBy: row.uploaded_by ?? undefined,
    displayName: row.display_name,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    checksumSha256: row.checksum_sha256,
    recorderMetadata: row.recorder_metadata,
    reconciliationStatus: row.reconciliation_status,
    continuityTakeId: row.continuity_take_id ?? undefined,
    reconciledBy: row.reconciled_by ?? undefined,
    reconciledAt: iso(row.reconciled_at),
    createdAt: iso(row.created_at)!,
  };
}

function productionSoundStorageDeps(): SoundRoomStorageDeps {
  const strictConfig = readRoleRoomContinuityS3Config();
  const storage = getRoleRoomObjectStorage();
  if (
    !strictConfig ||
    !storage ||
    storage.provider !== "aws_s3" ||
    storage.bucket !== strictConfig.bucket ||
    storage.region !== strictConfig.region
  ) {
    throw new Error("storage_not_configured");
  }
  return { storage };
}

function normalizeWaveContentType(value: string, fileName: string): string {
  const contentType = String(value || "application/octet-stream")
    .trim()
    .toLowerCase();
  if (!PRODUCTION_SOUND_WAVE_MIME_TYPES.has(contentType))
    throw new Error("unsupported_audio_type");
  if (
    contentType === "application/octet-stream" &&
    !/\.(?:wav|wave)$/i.test(fileName)
  ) {
    throw new Error("unsupported_audio_type");
  }
  return contentType;
}

async function scopedStorageObject(
  pool: Pool,
  input: {
    objectId: string;
    userId: string;
    projectId: string;
    productionDayId: string;
  },
): Promise<SoundRoomStorageObjectRow | null> {
  const object = await readOwnedSoundRoomObject(
    pool,
    input.objectId,
    input.userId,
  );
  return object &&
    object.source_module === "production-sound" &&
    object.project_id === input.projectId &&
    object.metadata?.entityType === "production_sound_day" &&
    object.metadata?.productionDayId === input.productionDayId
    ? object
    : null;
}

export async function initiateProductionSoundMediaUpload(
  pool: Pool,
  input: {
    userId: string;
    projectId: string;
    productionDayId: string;
    fileName: string;
    sizeBytes: number;
    contentType: string;
    checksumSha256: string;
  },
): Promise<SoundRoomUploadTicket> {
  const fileName = input.fileName.trim().slice(0, 255);
  if (!fileName) throw new Error("invalid_file_name");
  const contentType = normalizeWaveContentType(input.contentType, fileName);
  const organizationId = await organizationForUser(pool, input.userId);
  return initiateProductionSoundUpload(
    pool,
    {
      userId: input.userId,
      organizationId,
      projectId: input.projectId,
      productionDayId: input.productionDayId,
      fileName,
      sizeBytes: input.sizeBytes,
      contentType,
      checksumSha256: input.checksumSha256.toLowerCase(),
      channel: "browser",
      forceMultipart: input.sizeBytes > 100 * 1024 ** 2,
    },
    productionSoundStorageDeps(),
  );
}

export async function resumeProductionSoundMediaUpload(
  pool: Pool,
  input: {
    objectId: string;
    userId: string;
    projectId: string;
    productionDayId: string;
  },
): Promise<SoundRoomUploadTicket> {
  if (!(await scopedStorageObject(pool, input)))
    throw new Error("upload_not_found");
  return resumeSoundRoomUpload(
    pool,
    input.objectId,
    input.userId,
    productionSoundStorageDeps(),
  );
}

export async function signProductionSoundMediaUploadParts(
  pool: Pool,
  input: {
    objectId: string;
    userId: string;
    projectId: string;
    productionDayId: string;
    parts: Array<{ partNumber: number; checksumSha256: string }>;
  },
) {
  if (!(await scopedStorageObject(pool, input)))
    throw new Error("upload_not_found");
  return signSoundRoomUploadParts(
    pool,
    {
      objectId: input.objectId,
      userId: input.userId,
      parts: input.parts,
    },
    productionSoundStorageDeps(),
  );
}

export async function getProductionSoundMediaUploadStatus(
  pool: Pool,
  input: {
    objectId: string;
    userId: string;
    projectId: string;
    productionDayId: string;
  },
) {
  if (!(await scopedStorageObject(pool, input)))
    throw new Error("upload_not_found");
  return getSoundRoomUploadStatus(
    pool,
    input.objectId,
    input.userId,
    productionSoundStorageDeps(),
  );
}

async function bodyBuffer(body: unknown): Promise<Buffer> {
  const candidate = body as {
    transformToByteArray?: () => Promise<Uint8Array>;
    [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array | Buffer | string>;
  } | null;
  if (candidate?.transformToByteArray)
    return Buffer.from(await candidate.transformToByteArray());
  if (candidate?.[Symbol.asyncIterator]) {
    const chunks: Buffer[] = [];
    for await (const chunk of candidate as AsyncIterable<
      Uint8Array | Buffer | string
    >) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error("storage_unavailable");
}

async function inspectStoredWave(
  object: SoundRoomStorageObjectRow,
  deps: SoundRoomStorageDeps,
): Promise<ProductionSoundWaveMetadata> {
  const fileSize = Number(object.size_bytes);
  return inspectProductionSoundWave(async (offset, length) => {
    const response = await getSoundRoomObjectStream(
      object.object_key,
      `bytes=${offset}-${offset + length - 1}`,
      deps,
    );
    return bodyBuffer(response.Body);
  }, fileSize);
}

async function existingMedia(
  pool: Pool,
  storageObjectId: string,
): Promise<StoredProductionSoundMedia | null> {
  const result = await pool.query<ProductionSoundMediaRow>(
    `SELECT id::text, project_id, production_day_id, storage_object_id::text,
            uploaded_by, display_name, content_type, size_bytes, checksum_sha256,
            recorder_metadata, reconciliation_status, continuity_take_id,
            reconciled_by, reconciled_at, created_at
       FROM casting_production_sound_media
      WHERE storage_object_id = $1::uuid AND deleted_at IS NULL
      LIMIT 1`,
    [storageObjectId],
  );
  return result.rows[0] ? mapProductionSoundMediaRow(result.rows[0]) : null;
}

export async function completeProductionSoundMediaUpload(
  pool: Pool,
  input: {
    objectId: string;
    userId: string;
    projectId: string;
    productionDayId: string;
    parts?: SoundRoomCompletedPart[];
  },
): Promise<StoredProductionSoundMedia> {
  const scoped = await scopedStorageObject(pool, input);
  if (!scoped) throw new Error("upload_not_found");
  const duplicate = await existingMedia(pool, input.objectId);
  if (duplicate) return duplicate;
  const deps = productionSoundStorageDeps();
  const object = await completeSoundRoomUpload(
    pool,
    {
      objectId: input.objectId,
      userId: input.userId,
      parts: input.parts,
    },
    deps,
  );
  try {
    const metadata = await inspectStoredWave(object, deps);
    const inserted = await pool.query<ProductionSoundMediaRow>(
      `INSERT INTO casting_production_sound_media (
         project_id, production_day_id, storage_object_id, uploaded_by,
         display_name, content_type, size_bytes, checksum_sha256, recorder_metadata
       ) VALUES ($1, $2, $3::uuid, $4, $5, $6, $7::bigint, $8, $9::jsonb)
       ON CONFLICT (storage_object_id) DO NOTHING
       RETURNING id::text, project_id, production_day_id, storage_object_id::text,
                 uploaded_by, display_name, content_type, size_bytes, checksum_sha256,
                 recorder_metadata, reconciliation_status, continuity_take_id,
                 reconciled_by, reconciled_at, created_at`,
      [
        input.projectId,
        input.productionDayId,
        object.id,
        input.userId,
        object.display_name,
        object.content_type || "application/octet-stream",
        Number(object.size_bytes),
        object.checksum_sha256,
        JSON.stringify(metadata),
      ],
    );
    if (inserted.rows[0]) return mapProductionSoundMediaRow(inserted.rows[0]);
    const raced = await existingMedia(pool, object.id);
    if (raced) return raced;
    throw new Error("media_registration_failed");
  } catch (error) {
    await deleteCreatorHubMediaObject(
      pool,
      object.id,
      input.userId,
      deps,
    ).catch(() => undefined);
    throw error;
  }
}

export async function listProductionSoundMedia(
  pool: Pool,
  input: { projectId: string; productionDayId: string },
): Promise<StoredProductionSoundMedia[]> {
  const result = await pool.query<ProductionSoundMediaRow>(
    `SELECT media.id::text, media.project_id, media.production_day_id,
            media.storage_object_id::text, media.uploaded_by, media.display_name,
            media.content_type, media.size_bytes, media.checksum_sha256,
            media.recorder_metadata, media.reconciliation_status,
            media.continuity_take_id, media.reconciled_by, media.reconciled_at,
            media.created_at
       FROM casting_production_sound_media media
       JOIN role_room_storage_objects object_row
         ON object_row.id = media.storage_object_id
        AND object_row.status = 'active'
        AND object_row.deleted_at IS NULL
        AND object_row.source_module = 'production-sound'
      WHERE media.project_id = $1
        AND media.production_day_id = $2
        AND media.deleted_at IS NULL
      ORDER BY media.created_at DESC, media.id DESC`,
    [input.projectId, input.productionDayId],
  );
  return result.rows.map(mapProductionSoundMediaRow);
}

export async function getProductionSoundMediaDownloadUrl(
  pool: Pool,
  input: { mediaId: string; projectId: string; productionDayId: string },
): Promise<{
  url: string;
  displayName: string;
  contentType: string;
  sizeBytes: number;
} | null> {
  const result = await pool.query<{
    object_key: string;
    display_name: string;
    content_type: string;
    size_bytes: string;
  }>(
    `SELECT object_row.object_key, media.display_name, media.content_type, media.size_bytes
       FROM casting_production_sound_media media
       JOIN role_room_storage_objects object_row
         ON object_row.id = media.storage_object_id
        AND object_row.status = 'active'
        AND object_row.deleted_at IS NULL
        AND object_row.source_module = 'production-sound'
      WHERE media.id = $1::uuid
        AND media.project_id = $2
        AND media.production_day_id = $3
        AND media.deleted_at IS NULL
      LIMIT 1`,
    [input.mediaId, input.projectId, input.productionDayId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    url: await createSoundRoomObjectDownloadUrl(
      row.object_key,
      300,
      productionSoundStorageDeps(),
    ),
    displayName: row.display_name,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
  };
}

/**
 * Abort an unfinished direct upload owned by the current user.
 *
 * The project/day scope is checked before the shared storage service sees the
 * object id, so a valid id from another production cannot be used as an
 * object-storage oracle.
 */
export async function abortProductionSoundMediaUpload(
  pool: Pool,
  input: {
    objectId: string;
    userId: string;
    projectId: string;
    productionDayId: string;
  },
): Promise<boolean> {
  if (!(await scopedStorageObject(pool, input)))
    throw new Error("upload_not_found");
  return abortSoundRoomUpload(
    pool,
    input.objectId,
    input.userId,
    productionSoundStorageDeps(),
  );
}

type DeleteProductionSoundMediaDeps = {
  deleteStorageObject?: typeof deleteCreatorHubMediaObject;
  storageDeps?: SoundRoomStorageDeps;
};

/**
 * Permanently remove one unmatched recorder file.
 *
 * The media row is locked while its reconciliation state is checked. This
 * serializes deletion with the existing reconcile transaction and guarantees
 * that a file cannot become linked to a take while it is being removed. The
 * storage object is deleted first; if the following metadata update fails, a
 * retry observes the already-deleted storage row and finishes the soft delete.
 */
export async function deleteProductionSoundMedia(
  pool: Pool,
  input: {
    mediaId: string;
    projectId: string;
    productionDayId: string;
  },
  deps: DeleteProductionSoundMediaDeps = {},
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      storage_object_id: string;
      reconciliation_status: "unmatched" | "matched";
      storage_status: string;
      storage_owner_user_id: string | null;
    }>(
      `SELECT media.storage_object_id::text, media.reconciliation_status,
              object_row.status AS storage_status,
              COALESCE(account.user_id, media.uploaded_by) AS storage_owner_user_id
         FROM casting_production_sound_media media
         JOIN role_room_storage_objects object_row
           ON object_row.id = media.storage_object_id
         JOIN role_room_storage_accounts account
           ON account.id = object_row.storage_account_id
        WHERE media.id = $1::uuid
          AND media.project_id = $2
          AND media.production_day_id = $3
          AND media.deleted_at IS NULL
        LIMIT 1
        FOR UPDATE OF media`,
      [input.mediaId, input.projectId, input.productionDayId],
    );
    const row = result.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return false;
    }
    if (row.reconciliation_status === "matched") {
      throw new Error("media_reconciled");
    }
    if (row.storage_status === "active") {
      if (!row.storage_owner_user_id) throw new Error("media_owner_missing");
      const deleted = await (deps.deleteStorageObject ??
        deleteCreatorHubMediaObject)(
        pool,
        row.storage_object_id,
        row.storage_owner_user_id,
        deps.storageDeps ?? productionSoundStorageDeps(),
        client,
      );
      if (!deleted) {
        const latest = await client.query<{ status: string }>(
          `SELECT status
             FROM role_room_storage_objects
            WHERE id = $1::uuid
            LIMIT 1`,
          [row.storage_object_id],
        );
        if (latest.rows[0]?.status !== "deleted")
          throw new Error("media_delete_failed");
      }
    } else if (row.storage_status !== "deleted") {
      throw new Error("media_delete_failed");
    }
    await client.query(
      `UPDATE casting_production_sound_media
          SET deleted_at = COALESCE(deleted_at, NOW()),
              continuity_take_id = NULL,
              reconciled_by = NULL,
              reconciled_at = NULL,
              reconciliation_status = 'unmatched'
        WHERE id = $1::uuid
          AND project_id = $2
          AND production_day_id = $3
          AND deleted_at IS NULL`,
      [input.mediaId, input.projectId, input.productionDayId],
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
