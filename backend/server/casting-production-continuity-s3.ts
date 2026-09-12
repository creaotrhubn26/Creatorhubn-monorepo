import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { fromTokenFile } from '@aws-sdk/credential-providers';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Pool } from 'pg';

import { roleRoomContinuityMediaKey } from './role-room-storage-key.js';

const ROLE_ROOM_AWS_ACCOUNT_ID = '745600963362';
const ROLE_ROOM_AWS_REGION = 'eu-north-1';
const ROLE_ROOM_BUCKET = `the-role-room-prod-${ROLE_ROOM_AWS_ACCOUNT_ID}-${ROLE_ROOM_AWS_REGION}`;
const ROLE_ROOM_RUNTIME_ROLE_ARN =
  `arn:aws:iam::${ROLE_ROOM_AWS_ACCOUNT_ID}:role/TheRoleRoomStorageRuntimeProd`;
const DEFAULT_DOWNLOAD_TTL_SECONDS = 300;

export interface RoleRoomContinuityS3Config {
  authentication: 'render_oidc' | 'dedicated_access_key';
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  roleArn?: string;
  webIdentityTokenFile?: string;
  bucket: string;
  region: string;
}

export interface StoredContinuityMedia {
  id: string;
  projectId: string;
  productionDayId: string;
  sceneId: string;
  uploadedBy: string;
  displayName: string;
  kind: 'photo' | 'video';
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: string;
}

type UploadContinuityMediaResult =
  | { ok: true; media: StoredContinuityMedia }
  | { ok: false; reason: 'storage_not_configured' | 'upload_failed' };

type ContinuityMediaDownloadResult =
  | {
      ok: true;
      url: string;
      displayName: string;
      contentType: string;
      sizeBytes: number;
    }
  | { ok: false; reason: 'not_found' | 'storage_not_configured' | 'storage_unavailable' };

function configuredValue(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

export function readRoleRoomContinuityS3Config(
  env: NodeJS.ProcessEnv = process.env,
): RoleRoomContinuityS3Config | null {
  const accessKeyId = configuredValue(env.AWS_ROLE_ROOM_ACCESS_KEY_ID);
  const secretAccessKey = configuredValue(env.AWS_ROLE_ROOM_SECRET_ACCESS_KEY);
  const sessionToken = configuredValue(env.AWS_ROLE_ROOM_SESSION_TOKEN) ?? undefined;
  const roleArn = configuredValue(env.AWS_ROLE_ARN);
  const webIdentityTokenFile = configuredValue(env.AWS_WEB_IDENTITY_TOKEN_FILE);
  const bucket = configuredValue(env.AWS_ROLE_ROOM_BUCKET_NAME);
  const region = configuredValue(env.AWS_ROLE_ROOM_REGION);
  if (!bucket || !region) return null;
  if (region !== ROLE_ROOM_AWS_REGION) {
    throw new Error(`AWS_ROLE_ROOM_REGION må være ${ROLE_ROOM_AWS_REGION}`);
  }
  if (bucket !== ROLE_ROOM_BUCKET) {
    throw new Error(`AWS_ROLE_ROOM_BUCKET_NAME må være ${ROLE_ROOM_BUCKET}`);
  }

  // Render injects the rotating token file when AWS_ROLE_ARN is assigned to
  // the service. Prefer this even if unrelated AWS access keys also exist.
  if (roleArn || webIdentityTokenFile) {
    if (roleArn !== ROLE_ROOM_RUNTIME_ROLE_ARN) {
      throw new Error(`AWS_ROLE_ARN må være ${ROLE_ROOM_RUNTIME_ROLE_ARN}`);
    }
    if (!webIdentityTokenFile) {
      throw new Error('AWS_WEB_IDENTITY_TOKEN_FILE mangler for Role Room OIDC');
    }
    return {
      authentication: 'render_oidc',
      roleArn,
      webIdentityTokenFile,
      bucket,
      region,
    };
  }

  // Dedicated keys remain available for local/emergency operation, but the
  // generic AWS_ACCESS_KEY_ID variables are deliberately never accepted.
  if (!accessKeyId || !secretAccessKey) return null;
  return {
    authentication: 'dedicated_access_key',
    accessKeyId,
    secretAccessKey,
    sessionToken,
    bucket,
    region,
  };
}

let cachedClient: { signature: string; client: S3Client } | null = null;

function roleRoomS3Client(config: RoleRoomContinuityS3Config): S3Client {
  const signature = crypto.createHash('sha256').update([
    config.authentication,
    config.roleArn ?? '',
    config.webIdentityTokenFile ?? '',
    config.accessKeyId ?? '',
    config.secretAccessKey ?? '',
    config.sessionToken ?? '',
    config.region,
    config.bucket,
  ].join('\0')).digest('hex');
  if (cachedClient?.signature === signature) return cachedClient.client;
  const client = new S3Client({
    region: config.region,
    credentials: config.authentication === 'render_oidc'
      ? fromTokenFile({
          roleArn: config.roleArn,
          webIdentityTokenFile: config.webIdentityTokenFile,
          roleSessionName: 'the-role-room-backend',
          clientConfig: { region: config.region },
        })
      : {
          accessKeyId: config.accessKeyId!,
          secretAccessKey: config.secretAccessKey!,
          ...(config.sessionToken ? { sessionToken: config.sessionToken } : {}),
        },
  });
  cachedClient = { signature, client };
  return client;
}

export function resetRoleRoomContinuityS3ClientForTests(): void {
  cachedClient = null;
}

async function checksumFile(filePath: string): Promise<{ hex: string; base64: string }> {
  const checksum = crypto.createHash('sha256');
  for await (const chunk of createReadStream(filePath)) checksum.update(chunk);
  const digest = checksum.digest();
  return { hex: digest.toString('hex'), base64: digest.toString('base64') };
}

async function organizationForUser(pool: Pool, userId: string): Promise<string | null> {
  const result = await pool.query<{ organization_id: string }>(
    `SELECT om.organization_id::text AS organization_id
       FROM organization_members om
       LEFT JOIN users u ON u.id::text = om.user_id::text
      WHERE om.user_id::text = $1
      ORDER BY (om.organization_id::text = COALESCE(u.meta->>'active_org_id', '')) DESC,
               om.joined_at ASC,
               om.organization_id ASC
      LIMIT 1`,
    [userId],
  );
  return result.rows[0]?.organization_id ?? null;
}

export async function uploadContinuityMediaToS3(
  pool: Pool,
  input: {
    userId: string;
    projectId: string;
    productionDayId: string;
    sceneId: string;
    displayName: string;
    filePath: string;
    sizeBytes: number;
    contentType: string;
    kind: 'photo' | 'video';
  },
): Promise<UploadContinuityMediaResult> {
  let config: RoleRoomContinuityS3Config | null;
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
  const objectKey = roleRoomContinuityMediaKey({
    organizationId,
    userId: input.userId,
    projectId: input.projectId,
    productionDayId: input.productionDayId,
    sceneId: input.sceneId,
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
      Metadata: { purpose: 'role-room-continuity' },
    }));
  } catch {
    return { ok: false, reason: 'upload_failed' };
  }

  try {
    const registered = await pool.query<{
      id: string;
      created_at: Date | string;
    }>(
      `INSERT INTO casting_production_continuity_media (
         id, project_id, production_day_id, scene_id, uploaded_by,
         storage_provider, bucket_name, object_key, display_name,
         media_kind, size_bytes, content_type, checksum_sha256
       ) VALUES (
         $1::uuid, $2, $3, $4, $5,
         'aws_s3', $6, $7, $8,
         $9, $10::bigint, $11, $12
       )
       RETURNING id::text, created_at`,
      [
        id,
        input.projectId,
        input.productionDayId,
        input.sceneId,
        input.userId,
        config.bucket,
        objectKey,
        input.displayName,
        input.kind,
        input.sizeBytes,
        input.contentType,
        checksum.hex,
      ],
    );
    const createdAt = registered.rows[0]?.created_at;
    return {
      ok: true,
      media: {
        id,
        projectId: input.projectId,
        productionDayId: input.productionDayId,
        sceneId: input.sceneId,
        uploadedBy: input.userId,
        displayName: input.displayName,
        kind: input.kind,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        checksumSha256: checksum.hex,
        createdAt: createdAt instanceof Date
          ? createdAt.toISOString()
          : String(createdAt || new Date().toISOString()),
      },
    };
  } catch {
    await client.send(new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      ExpectedBucketOwner: ROLE_ROOM_AWS_ACCOUNT_ID,
    })).catch(() => undefined);
    return { ok: false, reason: 'upload_failed' };
  }
}

export async function getContinuityMediaS3DownloadUrl(
  pool: Pool,
  input: {
    fileId: string;
    projectId: string;
    productionDayId: string;
    expiresInSeconds?: number;
  },
): Promise<ContinuityMediaDownloadResult> {
  const result = await pool.query<{
    bucket_name: string;
    object_key: string;
    display_name: string;
    content_type: string;
    size_bytes: string;
  }>(
    `SELECT bucket_name, object_key, display_name, content_type, size_bytes
       FROM casting_production_continuity_media
      WHERE id = $1::uuid
        AND project_id = $2
        AND production_day_id = $3
        AND storage_provider = 'aws_s3'
        AND deleted_at IS NULL`,
    [input.fileId, input.projectId, input.productionDayId],
  );
  const row = result.rows[0];
  if (!row) return { ok: false, reason: 'not_found' };

  let config: RoleRoomContinuityS3Config | null;
  try {
    config = readRoleRoomContinuityS3Config();
  } catch {
    return { ok: false, reason: 'storage_not_configured' };
  }
  if (!config || row.bucket_name !== config.bucket) {
    return { ok: false, reason: 'storage_not_configured' };
  }
  const ttl = Math.max(60, Math.min(600, Math.trunc(input.expiresInSeconds ?? DEFAULT_DOWNLOAD_TTL_SECONDS)));
  try {
    const url = await getSignedUrl(
      roleRoomS3Client(config),
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: row.object_key,
        ExpectedBucketOwner: ROLE_ROOM_AWS_ACCOUNT_ID,
      }),
      { expiresIn: ttl },
    );
    return {
      ok: true,
      url,
      displayName: row.display_name,
      contentType: row.content_type,
      sizeBytes: Number(row.size_bytes),
    };
  } catch {
    return { ok: false, reason: 'storage_unavailable' };
  }
}
