import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { PrivateObjectStorage } from "./private-object-storage.js";

const clients = new Map<string, S3Client>();

function configured(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

/**
 * CreatorHub media storage uses the dedicated CreatorHub IAM user in Render.
 * Credentials are selected explicitly so the co-located Role Room OIDC token
 * can never be chosen for the CreatorHub bucket by the AWS default chain.
 */
export function getCreatorHubObjectStorage(): PrivateObjectStorage | null {
  const accessKeyId = configured(process.env.AWS_ACCESS_KEY_ID);
  const secretAccessKey = configured(process.env.AWS_SECRET_ACCESS_KEY);
  const sessionToken = configured(process.env.AWS_SESSION_TOKEN);
  const bucket = configured(process.env.CREATORHUB_S3_BUCKET);
  const region = configured(process.env.CREATORHUB_S3_REGION) || "eu-north-1";
  if (!accessKeyId || !secretAccessKey || !bucket) return null;

  const cacheKey = `${region}:${bucket}:${accessKeyId}`;
  let client = clients.get(cacheKey);
  if (!client) {
    client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
      },
    });
    clients.set(cacheKey, client);
  }
  return {
    authentication: "creatorhub_access_key",
    provider: "aws_s3",
    bucket,
    region,
    client,
  };
}

function safeDownloadName(value: string): string {
  return value
    .replace(/[\r\n"\\]/g, "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .slice(0, 200) || "download";
}

export async function presignCreatorHubObjectDownload(
  key: string,
  downloadFilename?: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  const storage = getCreatorHubObjectStorage();
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
    console.warn("[creatorhub-storage] presign failed", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}

/** Only used by unit tests that mutate process.env between cases. */
export function resetCreatorHubObjectStorageForTests(): void {
  clients.clear();
}
