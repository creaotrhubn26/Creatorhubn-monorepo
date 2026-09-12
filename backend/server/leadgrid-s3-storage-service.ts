import crypto from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const LEADGRID_AWS_ACCOUNT_ID = "745600963362";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_KEY_PREFIXES = ["organizations/", "users/", "temporary/", "exports/", "quarantine/"];

export type LeadgridStorageProvider = "aws_s3" | "legacy_b2";

export interface LeadgridStoredObject {
  provider: "aws_s3";
  bucket: string;
  key: string;
  checksumSha256: string;
  sizeBytes: number;
}

export interface LeadgridFinalizedObject extends LeadgridStoredObject {
  contentType: string;
}

export interface LeadgridObjectStorage {
  readonly provider: "aws_s3";
  readonly bucket: string;
  putObject(input: {
    key: string;
    body: Buffer;
    contentType: string;
    purpose: string;
  }): Promise<LeadgridStoredObject>;
  createDownloadUrl(key: string, ttlSeconds?: number): Promise<string>;
  createUploadUrl(input: {
    key: string;
    contentType: string;
    ttlSeconds?: number;
  }): Promise<string>;
  finalizeTemporaryObject(input: {
    temporaryKey: string;
    finalKey: string;
    allowedContentTypes: readonly string[];
    maxBytes: number;
    purpose: string;
    validatePrefix?: (prefix: Buffer, contentType: string) => boolean;
  }): Promise<LeadgridFinalizedObject>;
  getObjectBuffer(key: string, maxBytes: number): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
}

export interface LeadgridS3Config {
  accessKeyId: string;
  secretAccessKey: string;
  /** Used only by short-lived local/CI sessions; Render needs the four AWS_LEADGRID_* values. */
  sessionToken?: string;
  bucket: string;
  region: string;
}

function requiredValue(raw: string | undefined): string | null {
  const value = raw?.trim();
  return value ? value : null;
}

export function readLeadgridS3Config(
  env: NodeJS.ProcessEnv = process.env,
): LeadgridS3Config | null {
  const accessKeyId = requiredValue(env.AWS_LEADGRID_ACCESS_KEY_ID);
  const secretAccessKey = requiredValue(env.AWS_LEADGRID_SECRET_ACCESS_KEY);
  const bucket = requiredValue(env.AWS_LEADGRID_BUCKET_NAME);
  const region = requiredValue(env.AWS_LEADGRID_REGION);
  if (!accessKeyId || !secretAccessKey || !bucket || !region) return null;

  const expectedBucket = `leadgrid-prod-${LEADGRID_AWS_ACCOUNT_ID}-${region}`;
  if (bucket !== expectedBucket) {
    throw new Error(`AWS_LEADGRID_BUCKET_NAME må være ${expectedBucket}`);
  }
  return { accessKeyId, secretAccessKey, bucket, region };
}

function uuid(value: string, label: string): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error(`${label} må være en UUID`);
  }
  return normalized;
}

/**
 * Leadgrid project/user identifiers are historically TEXT and can contain a
 * human-readable slug. Object keys must not expose those values, so non-UUID
 * identifiers are mapped deterministically to an opaque UUID-shaped segment.
 * PostgreSQL remains authoritative; the segment is never used for access.
 */
export function opaqueLeadgridStorageId(value: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error("Lagringsidentifikator mangler");
  if (UUID_PATTERN.test(normalized)) return normalized.toLowerCase();
  const bytes = crypto
    .createHash("sha256")
    .update("leadgrid-storage-v1\0", "utf8")
    .update(normalized, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function assertManagedKey(key: string): string {
  const normalized = String(key ?? "").trim();
  if (
    !normalized ||
    normalized.length > 1024 ||
    normalized.startsWith("/") ||
    normalized.includes("//") ||
    normalized.split("/").some((segment) => segment === "." || segment === "..") ||
    !ALLOWED_KEY_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  ) {
    throw new Error("Ugyldig Leadgrid S3-nøkkel");
  }
  return normalized;
}

function assertTemporaryKey(key: string): string {
  const normalized = assertManagedKey(key);
  if (!normalized.startsWith("temporary/")) {
    throw new Error("Direkte Leadgrid-opplasting må bruke temporary/-prefix");
  }
  return normalized;
}

export const leadgridStorageKeys = {
  leadAttachment(input: {
    organizationId: string;
    projectId: string;
    leadId: string;
    assetId: string;
  }): string {
    return assertManagedKey(
      `organizations/${uuid(input.organizationId, "organizationId")}` +
        `/projects/${opaqueLeadgridStorageId(input.projectId)}` +
        `/leads/${uuid(input.leadId, "leadId")}` +
        `/attachments/${uuid(input.assetId, "assetId")}/original`,
    );
  },

  pitchDeckAsset(input: {
    organizationId: string;
    deckId: string;
    slideId: string;
    assetId: string;
  }): string {
    return assertManagedKey(
      `organizations/${uuid(input.organizationId, "organizationId")}` +
        `/shared/pitch-decks/${uuid(input.deckId, "deckId")}` +
        `/slides/${uuid(input.slideId, "slideId")}` +
        `/assets/${uuid(input.assetId, "assetId")}/original`,
    );
  },

  partnerDocument(input: {
    organizationId: string;
    applicationId: string;
    assetId: string;
  }): string {
    return assertManagedKey(
      `organizations/${uuid(input.organizationId, "organizationId")}` +
        `/shared/partner-applications/${uuid(input.applicationId, "applicationId")}` +
        `/documents/${uuid(input.assetId, "assetId")}/original`,
    );
  },

  canvasDocument(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    assetId: string;
  }): string {
    return assertManagedKey(
      `organizations/${uuid(input.organizationId, "organizationId")}` +
        `/projects/${opaqueLeadgridStorageId(input.projectId)}` +
        `/users/${opaqueLeadgridStorageId(input.userId)}` +
        `/files/${uuid(input.assetId, "assetId")}/original`,
    );
  },

  academyVideo(input: {
    organizationId: string;
    courseId: string;
    chapterId: string;
    assetId: string;
  }): string {
    return assertManagedKey(
      `organizations/${uuid(input.organizationId, "organizationId")}` +
        `/shared/academy/courses/${uuid(input.courseId, "courseId")}` +
        `/chapters/${uuid(input.chapterId, "chapterId")}` +
        `/videos/${uuid(input.assetId, "assetId")}/original`,
    );
  },

  prizeImage(input: {
    organizationId: string;
    assetId: string;
  }): string {
    return assertManagedKey(
      `organizations/${uuid(input.organizationId, "organizationId")}` +
        `/shared/sales-prizes/${uuid(input.assetId, "assetId")}/original`,
    );
  },

  temporaryAcademyVideo(input: {
    organizationId: string;
    chapterId: string;
    uploadId: string;
  }): string {
    return assertTemporaryKey(
      `temporary/organizations/${uuid(input.organizationId, "organizationId")}` +
        `/academy/chapters/${uuid(input.chapterId, "chapterId")}` +
        `/uploads/${uuid(input.uploadId, "uploadId")}/original`,
    );
  },

  privateUserFile(input: { userId: string; assetId: string }): string {
    return assertManagedKey(
      `users/${opaqueLeadgridStorageId(input.userId)}` +
        `/files/${uuid(input.assetId, "assetId")}/original`,
    );
  },
};

function clampTtl(ttlSeconds: number | undefined, fallback: number): number {
  if (!Number.isFinite(ttlSeconds)) return fallback;
  return Math.max(60, Math.min(3600, Math.trunc(ttlSeconds!)));
}

export function createLeadgridObjectStorage(
  config: LeadgridS3Config,
): LeadgridObjectStorage {
  const client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      ...(config.sessionToken ? { sessionToken: config.sessionToken } : {}),
    },
  });

  return {
    provider: "aws_s3",
    bucket: config.bucket,

    async putObject({ key, body, contentType, purpose }) {
      const managedKey = assertManagedKey(key);
      const checksum = crypto.createHash("sha256").update(body).digest();
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: managedKey,
          Body: body,
          ContentLength: body.byteLength,
          ContentType: contentType,
          CacheControl: "private, no-store",
          ChecksumSHA256: checksum.toString("base64"),
          ServerSideEncryption: "AES256",
          ExpectedBucketOwner: LEADGRID_AWS_ACCOUNT_ID,
          Metadata: { purpose: purpose.slice(0, 64) },
        }),
      );
      return {
        provider: "aws_s3",
        bucket: config.bucket,
        key: managedKey,
        checksumSha256: checksum.toString("hex"),
        sizeBytes: body.byteLength,
      };
    },

    async createDownloadUrl(key, ttlSeconds) {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: config.bucket, Key: assertManagedKey(key) }),
        { expiresIn: clampTtl(ttlSeconds, 600) },
      );
    },

    async createUploadUrl({ key, contentType, ttlSeconds }) {
      return getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: assertTemporaryKey(key),
          ContentType: contentType,
        }),
        { expiresIn: clampTtl(ttlSeconds, 900) },
      );
    },

    async finalizeTemporaryObject({
      temporaryKey,
      finalKey,
      allowedContentTypes,
      maxBytes,
      purpose,
      validatePrefix,
    }) {
      const sourceKey = assertTemporaryKey(temporaryKey);
      const destinationKey = assertManagedKey(finalKey);
      if (destinationKey.startsWith("temporary/")) {
        throw new Error("Ferdigstilt Leadgrid-objekt kan ikke ligge i temporary/");
      }
      const head = await client.send(
        new HeadObjectCommand({
          Bucket: config.bucket,
          Key: sourceKey,
          ExpectedBucketOwner: LEADGRID_AWS_ACCOUNT_ID,
        }),
      );
      const sizeBytes = Number(head.ContentLength ?? -1);
      const contentType = String(head.ContentType ?? "").toLowerCase();
      if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxBytes) {
        throw new Error("Direkteopplastingen har ugyldig størrelse");
      }
      if (!allowedContentTypes.map((value) => value.toLowerCase()).includes(contentType)) {
        throw new Error("Direkteopplastingen har ugyldig innholdstype");
      }
      if (validatePrefix) {
        const prefixResponse = await client.send(
          new GetObjectCommand({
            Bucket: config.bucket,
            Key: sourceKey,
            Range: "bytes=0-31",
            ExpectedBucketOwner: LEADGRID_AWS_ACCOUNT_ID,
          }),
        );
        if (!prefixResponse.Body) {
          throw new Error("Direkteopplastingen mangler innhold");
        }
        const prefix = Buffer.from(await prefixResponse.Body.transformToByteArray());
        if (!validatePrefix(prefix, contentType)) {
          throw new Error("Direkteopplastingens filsignatur er ugyldig");
        }
      }

      let copied = false;
      try {
        const copy = await client.send(
          new CopyObjectCommand({
            Bucket: config.bucket,
            Key: destinationKey,
            CopySource: encodeURIComponent(`${config.bucket}/${sourceKey}`).replace(/%2F/g, "/"),
            ContentType: contentType,
            CacheControl: "private, no-store",
            MetadataDirective: "REPLACE",
            Metadata: { purpose: purpose.slice(0, 64) },
            ChecksumAlgorithm: "SHA256",
            ServerSideEncryption: "AES256",
            ExpectedBucketOwner: LEADGRID_AWS_ACCOUNT_ID,
            ExpectedSourceBucketOwner: LEADGRID_AWS_ACCOUNT_ID,
          }),
        );
        copied = true;
        let checksumBase64 = copy.CopyObjectResult?.ChecksumSHA256;
        if (!checksumBase64) {
          const finalizedHead = await client.send(
            new HeadObjectCommand({
              Bucket: config.bucket,
              Key: destinationKey,
              ChecksumMode: "ENABLED",
              ExpectedBucketOwner: LEADGRID_AWS_ACCOUNT_ID,
            }),
          );
          checksumBase64 = finalizedHead.ChecksumSHA256;
        }
        const checksumBytes = checksumBase64
          ? Buffer.from(checksumBase64, "base64")
          : Buffer.alloc(0);
        if (checksumBytes.byteLength !== 32) {
          throw new Error("S3 returnerte ikke SHA-256 for ferdigstilt objekt");
        }
        await client.send(
          new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: sourceKey,
            ExpectedBucketOwner: LEADGRID_AWS_ACCOUNT_ID,
          }),
        );
        return {
          provider: "aws_s3",
          bucket: config.bucket,
          key: destinationKey,
          checksumSha256: checksumBytes.toString("hex"),
          sizeBytes,
          contentType,
        };
      } catch (error) {
        if (copied) {
          await client.send(
            new DeleteObjectCommand({
              Bucket: config.bucket,
              Key: destinationKey,
              ExpectedBucketOwner: LEADGRID_AWS_ACCOUNT_ID,
            }),
          ).catch(() => undefined);
        }
        throw error;
      }
    },

    async getObjectBuffer(key, maxBytes) {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: assertManagedKey(key),
          ExpectedBucketOwner: LEADGRID_AWS_ACCOUNT_ID,
        }),
      );
      if ((response.ContentLength ?? 0) > maxBytes) {
        throw new Error("Leadgrid-objektet er større enn tillatt lesegrense");
      }
      if (!response.Body) throw new Error("Leadgrid-objektet mangler body");
      const bytes = await response.Body.transformToByteArray();
      if (bytes.byteLength > maxBytes) {
        throw new Error("Leadgrid-objektet er større enn tillatt lesegrense");
      }
      return Buffer.from(bytes);
    },

    async deleteObject(key) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: assertManagedKey(key),
          ExpectedBucketOwner: LEADGRID_AWS_ACCOUNT_ID,
        }),
      );
    },
  };
}

let cachedStorage: { signature: string; storage: LeadgridObjectStorage } | null = null;

export function getLeadgridObjectStorage(
  env: NodeJS.ProcessEnv = process.env,
): LeadgridObjectStorage | null {
  const config = readLeadgridS3Config(env);
  if (!config) return null;
  const signature = crypto.createHash("sha256").update([
    config.accessKeyId,
    config.secretAccessKey,
    config.bucket,
    config.region,
  ].join("\0")).digest("hex");
  if (cachedStorage?.signature === signature) return cachedStorage.storage;
  const storage = createLeadgridObjectStorage(config);
  cachedStorage = { signature, storage };
  return storage;
}

export function resetLeadgridObjectStorageForTests(): void {
  cachedStorage = null;
}
