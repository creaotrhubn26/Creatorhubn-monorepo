import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { fromTokenFile } from "@aws-sdk/credential-providers";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { canonicalizeRoleRoomStorageKey } from "./role-room-storage-key.js";
import type { PrivateObjectStorage } from "./private-object-storage.js";

export type RoleRoomStorageProvider = "aws_s3" | "backblaze_b2";
export type RoleRoomAwsAuthentication = "render_web_identity" | "static_access_key";

export interface RoleRoomObjectStorage extends PrivateObjectStorage {
  authentication?: RoleRoomAwsAuthentication;
  provider: RoleRoomStorageProvider;
}

const clients = new Map<string, S3Client>();

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value && value.trim().length > 0)?.trim();
}

function getCachedClient(
  cacheKey: string,
  options: NonNullable<ConstructorParameters<typeof S3Client>[0]>,
): S3Client {
  const existing = clients.get(cacheKey);
  if (existing) return existing;
  const client = new S3Client(options);
  clients.set(cacheKey, client);
  return client;
}

/** Only these opt in to the retired Backblaze bucket. */
const LEGACY_B2_PROVIDER_VALUES = new Set(["backblaze_b2", "backblaze", "b2"]);

/**
 * S3 is the default, and the fallback for anything unrecognised.
 *
 * The switch used to work the other way round: only "aws_s3", "aws" or "s3"
 * chose S3, and every other value — a typo, a stray quote, an empty string
 * that survived trimming — silently selected Backblaze. That is the retired
 * bucket, so a misspelling in one environment variable was enough to send
 * writes somewhere nothing reads.
 *
 * Now B2 has to be asked for by name.
 */
export function getConfiguredRoleRoomStorageProvider(): RoleRoomStorageProvider {
  const requested = (process.env.ROLE_ROOM_STORAGE_PROVIDER || "")
    .trim()
    .toLowerCase();
  return LEGACY_B2_PROVIDER_VALUES.has(requested) ? "backblaze_b2" : "aws_s3";
}

function getAwsStorage(): RoleRoomObjectStorage | null {
  const roleArn = firstNonEmpty(process.env.AWS_ROLE_ARN);
  const webIdentityTokenFile = firstNonEmpty(process.env.AWS_WEB_IDENTITY_TOKEN_FILE);
  const accessKeyId = firstNonEmpty(process.env.AWS_ROLE_ROOM_ACCESS_KEY_ID);
  const secretAccessKey = firstNonEmpty(process.env.AWS_ROLE_ROOM_SECRET_ACCESS_KEY);
  const sessionToken = firstNonEmpty(process.env.AWS_ROLE_ROOM_SESSION_TOKEN);
  const bucket = firstNonEmpty(process.env.AWS_ROLE_ROOM_BUCKET_NAME);
  const region = firstNonEmpty(process.env.AWS_ROLE_ROOM_REGION) || "eu-north-1";
  if (!bucket) return null;

  // Select web identity explicitly. Generic CreatorHub access keys coexist in
  // the Render service and precede web identity in the SDK default chain.
  if (roleArn && webIdentityTokenFile) {
    return {
      authentication: "render_web_identity",
      provider: "aws_s3",
      bucket,
      region,
      client: getCachedClient(`aws-oidc:${region}:${bucket}:${roleArn}`, {
        region,
        credentials: fromTokenFile({
          roleArn,
          webIdentityTokenFile,
          roleSessionName: "the-role-room-object-storage",
          clientConfig: { region },
        }),
      }),
    };
  }

  if (!accessKeyId || !secretAccessKey) return null;

  return {
    authentication: "static_access_key",
    provider: "aws_s3",
    bucket,
    region,
    client: getCachedClient(`aws:${region}:${bucket}:${accessKeyId}`, {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
      },
    }),
  };
}

/**
 * Explicit legacy B2 connection. Kept for the non-destructive migration and a
 * controlled rollback; normal application traffic uses getRoleRoomObjectStorage.
 */
export function getLegacyRoleRoomB2Storage(): RoleRoomObjectStorage | null {
  const accessKeyId = firstNonEmpty(process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID);
  const secretAccessKey = firstNonEmpty(process.env.B2_ROLE_ROOM_APPLICATION_KEY);
  const bucket = firstNonEmpty(process.env.B2_ROLE_ROOM_BUCKET_NAME);
  const region = firstNonEmpty(process.env.B2_REGION) || "eu-central-003";
  if (!accessKeyId || !secretAccessKey || !bucket) return null;
  const endpoint = `https://s3.${region}.backblazeb2.com`;

  return {
    provider: "backblaze_b2",
    bucket,
    region,
    client: getCachedClient(`b2:${region}:${bucket}:${accessKeyId}`, {
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    }),
  };
}

/** Resolve the private object store used by The Role Room. */
export function getRoleRoomObjectStorage(): RoleRoomObjectStorage | null {
  return getConfiguredRoleRoomStorageProvider() === "aws_s3"
    ? getAwsStorage()
    : getLegacyRoleRoomB2Storage();
}

export function isRoleRoomObjectStorageConfigured(): boolean {
  return getRoleRoomObjectStorage() !== null;
}

export function resolveRoleRoomObjectKey(key: string): string {
  return getConfiguredRoleRoomStorageProvider() === "aws_s3"
    ? canonicalizeRoleRoomStorageKey(key)
    : key;
}

function safeDownloadName(value: string): string {
  return value
    .replace(/[\r\n"\\]/g, "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .slice(0, 200) || "download";
}

/** Create a short-lived direct read URL for the selected private S3-compatible store. */
export async function presignRoleRoomObjectDownload(
  key: string,
  downloadFilename?: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  const storage = getRoleRoomObjectStorage();
  if (!storage) return null;
  try {
    return await getSignedUrl(storage.client, new GetObjectCommand({
      Bucket: storage.bucket,
      Key: key,
      ...(downloadFilename
        ? { ResponseContentDisposition: `attachment; filename="${safeDownloadName(downloadFilename)}"` }
        : {}),
    }), { expiresIn: Math.min(3600, Math.max(60, expiresInSeconds)) });
  } catch (error) {
    console.warn("[role-room-storage] presign failed", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Only used by unit tests that mutate process.env between cases. */
export function resetRoleRoomStorageClientsForTests(): void {
  clients.clear();
}
