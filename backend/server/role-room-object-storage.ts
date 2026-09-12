import { S3Client } from "@aws-sdk/client-s3";
import { canonicalizeRoleRoomStorageKey } from "./role-room-storage-key.js";

export type RoleRoomStorageProvider = "aws_s3" | "backblaze_b2";
export type RoleRoomAwsAuthentication = "render_web_identity" | "static_access_key";

export interface RoleRoomObjectStorage {
  authentication?: RoleRoomAwsAuthentication;
  client: S3Client;
  bucket: string;
  provider: RoleRoomStorageProvider;
  region: string;
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

export function getConfiguredRoleRoomStorageProvider(): RoleRoomStorageProvider {
  const requested = (process.env.ROLE_ROOM_STORAGE_PROVIDER || "aws_s3")
    .trim()
    .toLowerCase();
  return requested === "aws_s3" || requested === "aws" || requested === "s3"
    ? "aws_s3"
    : "backblaze_b2";
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

  // Render injects AWS_WEB_IDENTITY_TOKEN_FILE after a service with
  // AWS_ROLE_ARN is deployed. Omitting explicit credentials lets the AWS SDK
  // use its supported web-identity provider and rotate the STS session.
  if (roleArn && webIdentityTokenFile) {
    return {
      authentication: "render_web_identity",
      provider: "aws_s3",
      bucket,
      region,
      client: getCachedClient(`aws-oidc:${region}:${bucket}:${roleArn}`, { region }),
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

/** Only used by unit tests that mutate process.env between cases. */
export function resetRoleRoomStorageClientsForTests(): void {
  clients.clear();
}
