import crypto from "node:crypto";
import { Readable, Transform } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { Pool, PoolClient } from "pg";

import { ensureRoleRoomUserStorageAccount } from "./role-room-storage-billing.js";
import {
  getLegacyRoleRoomB2Storage,
  getRoleRoomObjectStorage,
  type RoleRoomObjectStorage,
} from "./role-room-object-storage.js";
import { buildSoundRoomObjectKey, extractLegacyB2Key } from "./sound-room-storage-contract.js";
export { extractLegacyB2Key } from "./sound-room-storage-contract.js";

export interface LegacySoundRoomVersion {
  id: string;
  project_id: string;
  owner_user_id: string;
  file_name: string | null;
  file_url: string;
  file_size: string | null;
  content_type: string | null;
}

export interface SoundRoomMigrationDeps {
  source?: RoleRoomObjectStorage | null;
  target?: RoleRoomObjectStorage | null;
  upload?: (input: {
    client: S3Client;
    bucket: string;
    key: string;
    body: Readable;
    contentType: string;
    metadata: Record<string, string>;
  }) => Promise<void>;
}

export interface SoundRoomMigrationResult {
  migrationId: string;
  objectId: string;
  versionId: string;
  sourceKey: string;
  targetKey: string;
  sizeBytes: number;
  checksumSha256: string;
  sourceRetained: true;
}

function asReadable(body: any): Readable {
  if (body && typeof body.pipe === "function") return body as Readable;
  if (body?.transformToWebStream) return Readable.fromWeb(body.transformToWebStream() as any);
  throw new Error("legacy_source_body_unreadable");
}

async function hashRemoteObject(
  storage: RoleRoomObjectStorage,
  key: string,
): Promise<{ checksum: string; bytes: number }> {
  const result = await storage.client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key }));
  const hash = crypto.createHash("sha256");
  let bytes = 0;
  for await (const chunk of asReadable(result.Body)) {
    const value = Buffer.from(chunk);
    hash.update(value);
    bytes += value.length;
  }
  return { checksum: hash.digest("hex"), bytes };
}

async function defaultUpload(input: Parameters<NonNullable<SoundRoomMigrationDeps["upload"]>>[0]): Promise<void> {
  await new Upload({
    client: input.client,
    queueSize: 3,
    partSize: 16 * 1024 * 1024,
    leavePartsOnError: false,
    params: {
      Bucket: input.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      Metadata: input.metadata,
    },
  }).done();
}

async function releaseReservation(db: Pool | PoolClient, accountId: string, bytes: number): Promise<void> {
  await db.query(`SELECT role_room_release_storage_reservation($1::uuid,$2::bigint)`, [accountId, bytes]);
}

export async function migrateLegacySoundRoomVersion(
  pool: Pool,
  version: LegacySoundRoomVersion,
  deps: SoundRoomMigrationDeps = {},
): Promise<SoundRoomMigrationResult> {
  const source = deps.source === undefined ? getLegacyRoleRoomB2Storage() : deps.source;
  const target = deps.target === undefined ? getRoleRoomObjectStorage() : deps.target;
  const upload = deps.upload ?? defaultUpload;
  if (!source) throw new Error("legacy_b2_not_configured");
  if (!target || target.provider !== "aws_s3") throw new Error("aws_s3_not_configured");
  const sourceKey = extractLegacyB2Key(version.file_url, source.bucket);
  if (!sourceKey) throw new Error("unsupported_legacy_b2_url");

  const sourceHead = await source.client.send(new HeadObjectCommand({ Bucket: source.bucket, Key: sourceKey }));
  const sizeBytes = Number(sourceHead.ContentLength);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) throw new Error("legacy_source_size_invalid");
  if (version.file_size && Number(version.file_size) !== sizeBytes) throw new Error("legacy_source_size_mismatch");

  const account = await ensureRoleRoomUserStorageAccount(pool, version.owner_user_id);
  const reservation = await pool.query<{ role_room_reserve_storage: boolean }>(
    `SELECT role_room_reserve_storage($1::uuid,$2::bigint)`, [account.id, sizeBytes],
  );
  if (reservation.rows[0]?.role_room_reserve_storage !== true) throw new Error("storage_quota_exceeded");

  const objectId = crypto.randomUUID();
  const migrationId = crypto.randomUUID();
  const fileName = version.file_name || sourceKey.split("/").pop() || "legacy-audio.bin";
  const contentType = sourceHead.ContentType || version.content_type || "application/octet-stream";
  const targetKey = buildSoundRoomObjectKey(version.owner_user_id, version.project_id, objectId, fileName);
  let copied = false;
  try {
    await pool.query(
      `INSERT INTO role_room_storage_objects (
         id,storage_account_id,object_key,display_name,size_bytes,content_type,
         source_module,created_by_user_id,metadata,status,reservation_expires_at,
         upload_strategy,source_channel,legacy_source_provider,legacy_source_key
       ) VALUES ($1::uuid,$2::uuid,$3,$4,$5::bigint,$6,'sound-room',$7,$8::jsonb,
         'pending',NOW()+INTERVAL '24 hours','server_copy','migration','backblaze_b2',$9)`,
      [objectId, account.id, targetKey, fileName.slice(0, 255), sizeBytes, contentType,
       version.owner_user_id, JSON.stringify({ entityType: "audio_review_version", entityId: version.id }), sourceKey],
    );
    const migrationRow = await pool.query<{ id: string }>(
      `INSERT INTO role_room_storage_migrations (
         id,source_provider,source_key,source_url,destination_object_id,entity_type,entity_id,
         expected_size_bytes,state,attempts
       ) VALUES ($1::uuid,'backblaze_b2',$2,$3,$4::uuid,'audio_review_version',$5,$6::bigint,'copying',1)
       ON CONFLICT (source_provider,source_key,entity_type,entity_id) DO UPDATE SET
         destination_object_id=EXCLUDED.destination_object_id,state='copying',attempts=role_room_storage_migrations.attempts+1,
         last_error=NULL,updated_at=NOW()
       RETURNING id`,
      [migrationId, sourceKey, version.file_url, objectId, version.id, sizeBytes],
    );
    const persistedMigrationId = migrationRow.rows[0]?.id || migrationId;

    const sourceObject = await source.client.send(new GetObjectCommand({ Bucket: source.bucket, Key: sourceKey }));
    const sourceHash = crypto.createHash("sha256");
    let sourceBytes = 0;
    const hashingStream = new Transform({
      transform(chunk, _encoding, callback) {
        const bytes = Buffer.from(chunk);
        sourceHash.update(bytes);
        sourceBytes += bytes.length;
        callback(null, bytes);
      },
    });
    asReadable(sourceObject.Body).pipe(hashingStream);
    await upload({
      client: target.client,
      bucket: target.bucket,
      key: targetKey,
      body: hashingStream,
      contentType,
      metadata: { "creatorhub-object-id": objectId, "legacy-provider": "backblaze-b2" },
    });
    copied = true;
    const sourceChecksum = sourceHash.digest("hex");
    if (sourceBytes !== sizeBytes) throw new Error("legacy_source_size_changed_during_copy");

    await pool.query(`UPDATE role_room_storage_migrations SET state='verifying',updated_at=NOW() WHERE source_provider='backblaze_b2' AND source_key=$1 AND entity_type='audio_review_version' AND entity_id=$2`, [sourceKey, version.id]);
    const targetHead = await target.client.send(new HeadObjectCommand({ Bucket: target.bucket, Key: targetKey }));
    if (Number(targetHead.ContentLength) !== sizeBytes) throw new Error("target_size_mismatch");
    const targetDigest = await hashRemoteObject(target, targetKey);
    if (targetDigest.bytes !== sizeBytes || targetDigest.checksum !== sourceChecksum) throw new Error("target_checksum_mismatch");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE role_room_storage_objects SET status='active',checksum_sha256=$2,verified_at=NOW(),
           reservation_expires_at=NULL,verification=$3::jsonb WHERE id=$1::uuid AND status='pending'`,
        [objectId, sourceChecksum, JSON.stringify({ sizeVerified: true, checksumVerified: true, sourceRetained: true, sourceProvider: "backblaze_b2" })],
      );
      await releaseReservation(client, account.id, sizeBytes);
      await client.query(
        `SELECT role_room_apply_storage_usage($1::uuid,$2::uuid,$3,$4::bigint,1,'migration',$5::jsonb)`,
        [account.id, objectId, `sound-room-migration:${version.id}`, sizeBytes, JSON.stringify({ sourceProvider: "backblaze_b2", sourceKey })],
      );
      await client.query(
        `UPDATE audio_review_versions SET storage_object_id=$1::uuid,storage_state='processing',
           checksum_sha256=$2,content_type=COALESCE(content_type,$3),file_size=$4::bigint
         WHERE id=$5::uuid AND storage_object_id IS NULL`,
        [objectId, sourceChecksum, contentType, sizeBytes, version.id],
      );
      await client.query(
        `UPDATE role_room_storage_migrations SET expected_checksum_sha256=$1,copied_size_bytes=$2::bigint,
           copied_checksum_sha256=$1,state='verified',verified_at=NOW(),updated_at=NOW(),last_error=NULL
         WHERE source_provider='backblaze_b2' AND source_key=$3 AND entity_type='audio_review_version' AND entity_id=$4`,
        [sourceChecksum, sizeBytes, sourceKey, version.id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }

    return { migrationId: persistedMigrationId, objectId, versionId: version.id, sourceKey, targetKey, sizeBytes, checksumSha256: sourceChecksum, sourceRetained: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "migration_failed";
    await pool.query(
      `UPDATE role_room_storage_migrations SET state='failed',last_error=$1,updated_at=NOW()
        WHERE source_provider='backblaze_b2' AND source_key=$2 AND entity_type='audio_review_version' AND entity_id=$3`,
      [message.slice(0, 2000), sourceKey, version.id],
    ).catch(() => undefined);
    await pool.query(`UPDATE role_room_storage_objects SET status='quarantined',deleted_at=NOW() WHERE id=$1::uuid AND status='pending'`, [objectId]).catch(() => undefined);
    await releaseReservation(pool, account.id, sizeBytes).catch(() => undefined);
    if (copied) await target.client.send(new DeleteObjectCommand({ Bucket: target.bucket, Key: targetKey })).catch(() => undefined);
    throw error;
  }
}

/**
 * Separate, explicit cleanup phase. It re-hashes both sides and refuses to
 * delete B2 unless the migration ledger is already verified and still exact.
 */
export async function deleteVerifiedLegacySoundRoomSource(
  pool: Pool,
  migrationId: string,
  deps: Pick<SoundRoomMigrationDeps, "source" | "target"> = {},
): Promise<boolean> {
  const source = deps.source === undefined ? getLegacyRoleRoomB2Storage() : deps.source;
  const target = deps.target === undefined ? getRoleRoomObjectStorage() : deps.target;
  if (!source) throw new Error("legacy_b2_not_configured");
  if (!target || target.provider !== "aws_s3") throw new Error("aws_s3_not_configured");
  const result = await pool.query<{
    source_key: string;
    object_key: string;
    expected_size_bytes: string;
    expected_checksum_sha256: string;
    copied_checksum_sha256: string;
    state: string;
    source_deleted_at: Date | null;
    verified_at: Date | null;
  }>(
    `SELECT migration.source_key,migration.expected_size_bytes,migration.expected_checksum_sha256,
            migration.copied_checksum_sha256,migration.state,migration.source_deleted_at,migration.verified_at,
            object_row.object_key
       FROM role_room_storage_migrations migration
       JOIN role_room_storage_objects object_row ON object_row.id=migration.destination_object_id
      WHERE migration.id=$1::uuid AND migration.source_provider='backblaze_b2'
        AND migration.entity_type='audio_review_version' AND object_row.status='active'
      LIMIT 1`,
    [migrationId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("migration_not_found");
  if (row.source_deleted_at) return false;
  if (row.state !== "verified" || !row.verified_at || !row.expected_checksum_sha256) {
    throw new Error("migration_not_verified");
  }
  const [sourceDigest, targetDigest] = await Promise.all([
    hashRemoteObject(source, row.source_key),
    hashRemoteObject(target, row.object_key),
  ]);
  const expectedBytes = Number(row.expected_size_bytes);
  if (
    sourceDigest.bytes !== expectedBytes || targetDigest.bytes !== expectedBytes ||
    sourceDigest.checksum !== row.expected_checksum_sha256 ||
    targetDigest.checksum !== row.expected_checksum_sha256 ||
    row.copied_checksum_sha256 !== row.expected_checksum_sha256
  ) throw new Error("predelete_verification_failed");
  await source.client.send(new DeleteObjectCommand({ Bucket: source.bucket, Key: row.source_key }));
  await pool.query(
    `UPDATE role_room_storage_migrations SET source_deleted_at=NOW(),updated_at=NOW()
      WHERE id=$1::uuid AND state='verified' AND source_deleted_at IS NULL`,
    [migrationId],
  );
  return true;
}
