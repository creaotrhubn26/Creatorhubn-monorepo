/**
 * role-room-user-storage-service.ts
 *
 * L3a-implementasjon: Per-bruker storage på admin-B2 (`the-role-room-prod`).
 * Hver bruker får automatisk en logisk bucket i form av prefikset
 * `users/{userId}/` med 1 GB default-quota (tier='free').
 *
 * Bruker eksisterende S3-klient fra b2-archive-helper.ts — vi gjenbruker
 * samme B2-credentials og region (eu-central-003). Forskjellen fra
 * archive-helper-en er at vi:
 *   1. Sjekker quota FØR upload (returnerer 'quota_exceeded' istedenfor å feile)
 *   2. Registrerer hver fil i `role_room_user_files`
 *   3. Tracker consumption per bruker i `role_room_user_storage_consumption`
 *
 * L3b (BYO B2) bygger på dette ved å sette `tier='byo'` og bytte ut
 * S3-klienten til brukerens egen — alle metoder her aksepterer en optional
 * `clientOverride` for å støtte den varianten senere.
 */

import type { Pool } from "pg";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const B2_REGION = process.env.B2_REGION || "eu-central-003";
const B2_ENDPOINT = `https://s3.${B2_REGION}.backblazeb2.com`;
const DEFAULT_FREE_QUOTA_BYTES = 1_073_741_824; // 1 GiB

function getAdminB2Client(): { client: S3Client; bucket: string } | null {
  const keyId = process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID;
  const appKey = process.env.B2_ROLE_ROOM_APPLICATION_KEY;
  const bucket = process.env.B2_ROLE_ROOM_BUCKET_NAME;
  if (!keyId || !appKey || !bucket) return null;
  return {
    client: new S3Client({
      region: B2_REGION,
      endpoint: B2_ENDPOINT,
      credentials: { accessKeyId: keyId, secretAccessKey: appKey },
      forcePathStyle: true,
    }),
    bucket,
  };
}

export interface UserBucket {
  userId: string;
  bucketPrefix: string;          // 'users/{userId}/'
  tier: 'free' | 'paid' | 'byo';
  quotaBytes: number | null;     // null = ubegrenset (byo)
  createdAt: string;
}

export interface UserStorageStats {
  userId: string;
  tier: 'free' | 'paid' | 'byo';
  usedBytes: number;
  quotaBytes: number | null;
  fileCount: number;
  percentageUsed: number;        // 0–100, eller 0 hvis ubegrenset
  lastCalculatedAt: string;
}

export interface UserFile {
  id: string;
  displayName: string;
  sizeBytes: number;
  contentType: string | null;
  sourceModule: string | null;
  metadata: Record<string, unknown>;
  uploadedAt: string;
  b2Key: string;
  // L4 — kontekst-kobling
  projectId: string | null;
  sceneId: string | null;
  attachedToEntityType: string | null;
  attachedToEntityId: string | null;
  attachmentNote: string | null;
}

export interface UploadContext {
  /** Prosjekt-ID (FK til casting_projects) — filen kan filtreres per prosjekt */
  projectId?: string;
  /** Scene-ID (valgfri) */
  sceneId?: string;
  /** Polymorfisk binding: 'storyboard' | 'role' | 'role_research' | 'deck_slide' | 'self_tape_thumbnail' | 'casting_call_poster' */
  attachedToEntityType?: string;
  attachedToEntityId?: string;
  /** Menneskelig beskrivelse: "Referansebilde for scene 4" */
  attachmentNote?: string;
}

/**
 * Sørg for at brukeren har en bucket-rad. Idempotent — kalles lazy ved
 * første upload, men kan også kalles eksplisitt fra UI ("init mitt
 * lagringsområde").
 */
export async function ensureUserBucket(pool: Pool, userId: string): Promise<UserBucket> {
  const prefix = `users/${userId}/`;
  const r = await pool.query<{
    user_id: string;
    bucket_prefix: string;
    tier: 'free' | 'paid' | 'byo';
    quota_bytes: string | null;
    created_at: Date;
  }>(
    `INSERT INTO role_room_user_buckets (user_id, bucket_prefix, tier, quota_bytes)
     VALUES ($1::uuid, $2, 'free', $3::bigint)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
     RETURNING user_id, bucket_prefix, tier, quota_bytes, created_at`,
    [userId, prefix, DEFAULT_FREE_QUOTA_BYTES],
  );
  const row = r.rows[0];
  // Sørg for at consumption-raden også finnes
  await pool.query(
    `INSERT INTO role_room_user_storage_consumption (user_id, used_bytes, file_count)
     VALUES ($1::uuid, 0, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
  return {
    userId: row.user_id,
    bucketPrefix: row.bucket_prefix,
    tier: row.tier,
    quotaBytes: row.quota_bytes ? Number(row.quota_bytes) : null,
    createdAt: row.created_at.toISOString(),
  };
}

/** Hent gjeldende statistikk. Oppretter rad hvis bruker ikke finnes ennå. */
export async function getUserStorageStats(pool: Pool, userId: string): Promise<UserStorageStats> {
  const bucket = await ensureUserBucket(pool, userId);
  const r = await pool.query<{
    used_bytes: string;
    file_count: number;
    last_calculated_at: Date;
  }>(
    `SELECT used_bytes, file_count, last_calculated_at
     FROM role_room_user_storage_consumption
     WHERE user_id = $1::uuid`,
    [userId],
  );
  const row = r.rows[0] ?? { used_bytes: "0", file_count: 0, last_calculated_at: new Date() };
  const usedBytes = Number(row.used_bytes);
  const percentageUsed = bucket.quotaBytes
    ? Math.min(100, Math.round((usedBytes / bucket.quotaBytes) * 100))
    : 0;
  return {
    userId,
    tier: bucket.tier,
    usedBytes,
    quotaBytes: bucket.quotaBytes,
    fileCount: row.file_count,
    percentageUsed,
    lastCalculatedAt: row.last_calculated_at.toISOString(),
  };
}

/**
 * Upload en fil for brukeren. Sjekker quota før noe blir sendt til B2 —
 * hvis filen ville sprenge taket, returneres `'quota_exceeded'` UTEN at
 * data nådde nettverket. Returnerer file-row hvis ok.
 *
 * Med `context` knytter vi filen til prosjekt/scene/entity så panelet
 * kan filtrere og vise "denne storyboarden bruker 3 referansebilder".
 */
export async function uploadUserFile(
  pool: Pool,
  opts: {
    userId: string;
    displayName: string;
    body: Buffer | Uint8Array | string;
    contentType: string;
    sourceModule?: string;          // 'selftape' | 'deck' | 'casting-poster' | ...
    metadata?: Record<string, unknown>;
    context?: UploadContext;        // L4 — kontekst-kobling
  },
): Promise<
  | { ok: true; file: UserFile }
  | { ok: false; reason: 'quota_exceeded' | 'b2_not_configured' | 'upload_failed'; detail?: string; stats?: UserStorageStats }
> {
  const buf = typeof opts.body === "string" ? Buffer.from(opts.body, "utf8") : Buffer.from(opts.body);

  // Quota-check FØR upload
  const stats = await getUserStorageStats(pool, opts.userId);
  if (stats.quotaBytes !== null && stats.usedBytes + buf.length > stats.quotaBytes) {
    return { ok: false, reason: 'quota_exceeded', stats };
  }

  const config = getAdminB2Client();
  if (!config) {
    return { ok: false, reason: 'b2_not_configured' };
  }

  const bucket = await ensureUserBucket(pool, opts.userId);
  const fileId = crypto.randomUUID();
  const safeName = opts.displayName
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200) || 'file';
  const b2Key = `${bucket.bucketPrefix}${fileId}-${safeName}`;

  try {
    await config.client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: b2Key,
        Body: buf,
        ContentType: opts.contentType,
      }),
    );
  } catch (err) {
    return { ok: false, reason: 'upload_failed', detail: (err as Error).message };
  }

  // Registrer i DB (atomisk: oppretter fil + bumper consumption + kobler kontekst)
  const ctx = opts.context ?? {};
  const r = await pool.query<{ role_room_register_user_upload: string }>(
    `SELECT role_room_register_user_upload(
       $1::uuid, $2, $3, $4::bigint, $5, $6, $7::jsonb,
       $8::varchar, $9::varchar, $10::text, $11::text, $12::text
     )`,
    [
      opts.userId,
      b2Key,
      opts.displayName,
      buf.length,
      opts.contentType,
      opts.sourceModule ?? null,
      JSON.stringify(opts.metadata ?? {}),
      ctx.projectId ?? null,
      ctx.sceneId ?? null,
      ctx.attachedToEntityType ?? null,
      ctx.attachedToEntityId ?? null,
      ctx.attachmentNote ?? null,
    ],
  );
  const newFileId = r.rows[0].role_room_register_user_upload;

  return {
    ok: true,
    file: {
      id: newFileId,
      displayName: opts.displayName,
      sizeBytes: buf.length,
      contentType: opts.contentType,
      sourceModule: opts.sourceModule ?? null,
      metadata: opts.metadata ?? {},
      uploadedAt: new Date().toISOString(),
      b2Key,
      projectId: ctx.projectId ?? null,
      sceneId: ctx.sceneId ?? null,
      attachedToEntityType: ctx.attachedToEntityType ?? null,
      attachedToEntityId: ctx.attachedToEntityId ?? null,
      attachmentNote: ctx.attachmentNote ?? null,
    },
  };
}

/** Liste over (ikke-slettede) filer, nyeste først. */
export async function listUserFiles(
  pool: Pool,
  opts: {
    userId: string;
    limit?: number;
    sourceModule?: string;
    projectId?: string;
    entityType?: string;
    entityId?: string;
  },
): Promise<UserFile[]> {
  const r = await pool.query<{
    id: string;
    display_name: string;
    size_bytes: string;
    content_type: string | null;
    source_module: string | null;
    metadata: Record<string, unknown>;
    uploaded_at: Date;
    b2_key: string;
    project_id: string | null;
    scene_id: string | null;
    attached_to_entity_type: string | null;
    attached_to_entity_id: string | null;
    attachment_note: string | null;
  }>(
    `SELECT id, display_name, size_bytes, content_type, source_module,
            metadata, uploaded_at, b2_key,
            project_id, scene_id, attached_to_entity_type,
            attached_to_entity_id, attachment_note
     FROM role_room_user_files
     WHERE user_id = $1::uuid
       AND deleted_at IS NULL
       AND ($2::text IS NULL OR source_module = $2)
       AND ($3::varchar IS NULL OR project_id = $3)
       AND ($4::text IS NULL OR attached_to_entity_type = $4)
       AND ($5::text IS NULL OR attached_to_entity_id = $5)
     ORDER BY uploaded_at DESC
     LIMIT $6`,
    [
      opts.userId,
      opts.sourceModule ?? null,
      opts.projectId ?? null,
      opts.entityType ?? null,
      opts.entityId ?? null,
      opts.limit ?? 50,
    ],
  );
  return r.rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    sizeBytes: Number(row.size_bytes),
    contentType: row.content_type,
    sourceModule: row.source_module,
    metadata: row.metadata,
    uploadedAt: row.uploaded_at.toISOString(),
    b2Key: row.b2_key,
    projectId: row.project_id,
    sceneId: row.scene_id,
    attachedToEntityType: row.attached_to_entity_type,
    attachedToEntityId: row.attached_to_entity_id,
    attachmentNote: row.attachment_note,
  }));
}

/**
 * Hent et sammendrag per prosjekt for bruker: hvor mange filer + bytes
 * per prosjekt. Brukes til "Per prosjekt"-tab i storage-panelet.
 */
export async function getUserFilesPerProject(
  pool: Pool,
  userId: string,
): Promise<Array<{ projectId: string | null; projectName: string | null; fileCount: number; totalBytes: number }>> {
  const r = await pool.query<{
    project_id: string | null;
    project_name: string | null;
    file_count: number;
    total_bytes: string;
  }>(
    `SELECT
       f.project_id,
       p.name AS project_name,
       COUNT(*)::int AS file_count,
       COALESCE(SUM(f.size_bytes), 0)::text AS total_bytes
     FROM role_room_user_files f
     LEFT JOIN casting_projects p ON p.id = f.project_id
     WHERE f.user_id = $1::uuid AND f.deleted_at IS NULL
     GROUP BY f.project_id, p.name
     ORDER BY total_bytes::numeric DESC NULLS LAST`,
    [userId],
  );
  return r.rows.map((row) => ({
    projectId: row.project_id,
    projectName: row.project_name,
    fileCount: row.file_count,
    totalBytes: Number(row.total_bytes),
  }));
}

/**
 * Hent alle filer som er knyttet til en spesifikk entitet (f.eks. en
 * storyboard, en role, en research-tab). Brukes av disse modulene for
 * å vise "vedlegg" inline.
 */
export async function listFilesForEntity(
  pool: Pool,
  opts: { userId: string; entityType: string; entityId: string },
): Promise<UserFile[]> {
  return listUserFiles(pool, {
    userId: opts.userId,
    entityType: opts.entityType,
    entityId: opts.entityId,
    limit: 200,
  });
}

/**
 * Slett fil. Markerer den som slettet i DB + decrementer consumption
 * umiddelbart. Den faktiske B2-delete kjøres i background (vi rydder
 * `deleted_at IS NOT NULL` rader i en cron) for å unngå at quota
 * blokkerer brukeren mens vi venter på B2-respons.
 *
 * For umiddelbar B2-delete (f.eks. fra UI med "slett permanent")
 * kall hardDeleteUserFile.
 */
export async function softDeleteUserFile(
  pool: Pool,
  opts: { userId: string; fileId: string },
): Promise<{ ok: boolean; freedBytes: number }> {
  const r = await pool.query<{ role_room_mark_user_file_deleted: string }>(
    `SELECT role_room_mark_user_file_deleted($1::uuid, $2::uuid)`,
    [opts.userId, opts.fileId],
  );
  const freed = Number(r.rows[0]?.role_room_mark_user_file_deleted ?? 0);
  return { ok: freed > 0, freedBytes: freed };
}

/** Slett fra B2 + DB synkront. */
export async function hardDeleteUserFile(
  pool: Pool,
  opts: { userId: string; fileId: string },
): Promise<{ ok: boolean; freedBytes: number; b2Deleted: boolean }> {
  // Hent b2-key først
  const lookup = await pool.query<{ b2_key: string; size_bytes: string }>(
    `SELECT b2_key, size_bytes FROM role_room_user_files
     WHERE id = $1::uuid AND user_id = $2::uuid AND deleted_at IS NULL`,
    [opts.fileId, opts.userId],
  );
  const row = lookup.rows[0];
  if (!row) return { ok: false, freedBytes: 0, b2Deleted: false };

  let b2Deleted = false;
  const config = getAdminB2Client();
  if (config) {
    try {
      await config.client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: row.b2_key }),
      );
      b2Deleted = true;
    } catch (err) {
      console.warn("[role-room-user-storage] B2 delete feilet", {
        key: row.b2_key, err: (err as Error).message,
      });
    }
  }

  await pool.query(
    `DELETE FROM role_room_user_files WHERE id = $1::uuid AND user_id = $2::uuid`,
    [opts.fileId, opts.userId],
  );
  await pool.query(
    `UPDATE role_room_user_storage_consumption
       SET used_bytes = GREATEST(0, used_bytes - $1::bigint),
           file_count = GREATEST(0, file_count - 1),
           last_calculated_at = NOW()
     WHERE user_id = $2::uuid`,
    [row.size_bytes, opts.userId],
  );
  return { ok: true, freedBytes: Number(row.size_bytes), b2Deleted };
}

/** Lag en tidsbegrenset GET-URL for filen — brukes til nedlasting i UI. */
export async function getUserFileDownloadUrl(
  pool: Pool,
  opts: { userId: string; fileId: string; expiresInSeconds?: number },
): Promise<{ ok: true; url: string; displayName: string } | { ok: false; reason: string }> {
  const r = await pool.query<{ b2_key: string; display_name: string }>(
    `SELECT b2_key, display_name FROM role_room_user_files
     WHERE id = $1::uuid AND user_id = $2::uuid AND deleted_at IS NULL`,
    [opts.fileId, opts.userId],
  );
  const row = r.rows[0];
  if (!row) return { ok: false, reason: 'not_found' };

  const config = getAdminB2Client();
  if (!config) return { ok: false, reason: 'b2_not_configured' };

  try {
    const url = await getSignedUrl(
      config.client,
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: row.b2_key,
        ResponseContentDisposition: `attachment; filename="${row.display_name}"`,
      }),
      { expiresIn: opts.expiresInSeconds ?? 300 },
    );
    return { ok: true, url, displayName: row.display_name };
  } catch (err) {
    return { ok: false, reason: `presign_failed: ${(err as Error).message}` };
  }
}

/** Admin-helper: alle brukere som er nær eller over kvoten. */
export async function listUsersNearQuota(
  pool: Pool,
  thresholdPercentage = 80,
): Promise<Array<{
  userId: string;
  tier: 'free' | 'paid' | 'byo';
  usedBytes: number;
  quotaBytes: number | null;
  percentageUsed: number;
  fileCount: number;
}>> {
  const r = await pool.query<{
    user_id: string;
    tier: 'free' | 'paid' | 'byo';
    used_bytes: string;
    quota_bytes: string | null;
    file_count: number;
  }>(
    `SELECT b.user_id, b.tier, c.used_bytes, b.quota_bytes, c.file_count
     FROM role_room_user_buckets b
     JOIN role_room_user_storage_consumption c USING (user_id)
     WHERE b.quota_bytes IS NOT NULL
       AND c.used_bytes::numeric / NULLIF(b.quota_bytes, 0) * 100 >= $1
     ORDER BY c.used_bytes::numeric / NULLIF(b.quota_bytes, 0) DESC
     LIMIT 100`,
    [thresholdPercentage],
  );
  return r.rows.map((row) => {
    const used = Number(row.used_bytes);
    const quota = row.quota_bytes ? Number(row.quota_bytes) : null;
    return {
      userId: row.user_id,
      tier: row.tier,
      usedBytes: used,
      quotaBytes: quota,
      percentageUsed: quota ? Math.round((used / quota) * 100) : 0,
      fileCount: row.file_count,
    };
  });
}
