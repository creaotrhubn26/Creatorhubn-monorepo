/**
 * partner-documents-service.ts
 *
 * Partner-application documents. New uploads use Leadgrid's private AWS S3
 * contract; existing B2 objects remain readable during migration.
 */

import {
  S3Client, GetObjectCommand, DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Pool } from "pg";
import crypto from "crypto";
import {
  getLeadgridObjectStorage,
  leadgridStorageKeys,
  type LeadgridStorageProvider,
} from "./leadgrid-s3-storage-service.js";
import { leadgridStoragePersistenceError } from "./leadgrid-org-storage-service.js";

const B2_REGION = process.env.B2_REGION || "eu-central-003";
const B2_ENDPOINT = `https://s3.${B2_REGION}.backblazeb2.com`;

const ALLOWED_DOCUMENT_TYPES = new Set([
  "privacy_policy", "dpa", "security_doc", "portfolio",
  "reference", "org_cert", "subprocessor_list",
]);

const ALLOWED_MIMES = new Set([
  "application/pdf", "image/png", "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/markdown",
]);

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

function matchesDocumentSignature(body: Buffer, mimeType: string): boolean {
  if (body.length === 0) return false;
  if (mimeType === "application/pdf") {
    return body.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (mimeType === "image/png") {
    return body.length >= 8 && body.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  if (mimeType === "image/jpeg") {
    return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  }
  if (mimeType === "application/msword") {
    return body.length >= 8 && body.subarray(0, 8).equals(
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    );
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return body.length >= 4 && body.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  }
  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return !body.subarray(0, Math.min(body.length, 4096)).includes(0);
  }
  return false;
}

function getB2Client(): { client: S3Client; bucket: string } | null {
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

export interface UploadResult {
  ok: boolean;
  document_id?: string;
  storage_key?: string;
  error?: string;
  status?: number;
}

export async function uploadPartnerDocument(
  pool: Pool,
  opts: {
    applicationId: string;
    organizationId: string;
    documentType: string;
    filename: string;
    mimeType: string;
    fileBuffer: Buffer;
    uploadedBy: string;
  },
): Promise<UploadResult> {
  if (!ALLOWED_DOCUMENT_TYPES.has(opts.documentType)) {
    return { ok: false, error: "Ugyldig dokument-type" };
  }
  if (!ALLOWED_MIMES.has(opts.mimeType)) {
    return { ok: false, error: `Ikke støttet filtype: ${opts.mimeType}` };
  }
  if (opts.fileBuffer.length > MAX_FILE_BYTES) {
    return { ok: false, error: `Fil er for stor (max ${MAX_FILE_BYTES / 1024 / 1024} MB)` };
  }
  if (!matchesDocumentSignature(opts.fileBuffer, opts.mimeType)) {
    return { ok: false, error: "Filinnholdet samsvarer ikke med valgt filtype" };
  }

  const storage = getLeadgridObjectStorage();
  if (!storage) {
    return { ok: false, error: "Leadgrid S3 er ikke konfigurert" };
  }

  const storageObjectId = crypto.randomUUID();
  let key: string;
  try {
    key = leadgridStorageKeys.partnerDocument({
      organizationId: opts.organizationId,
      applicationId: opts.applicationId,
      assetId: storageObjectId,
    });
  } catch {
    return { ok: false, error: "Ugyldig organisasjon eller søknad" };
  }

  let uploaded;
  try {
    uploaded = await storage.putObject({
      key,
      body: opts.fileBuffer,
      contentType: opts.mimeType,
      purpose: "partner_document",
    });
  } catch (e: any) {
    console.error("[partner-documents S3-upload]", e);
    return { ok: false, error: "Upload til Leadgrid S3 feilet" };
  }

  try {
    const r = await pool.query<{ id: string }>(
      `WITH stored AS (
         INSERT INTO leadgrid_storage_objects
           (id, organization_id, uploaded_by, storage_provider, bucket_name,
            object_key, purpose, display_name, size_bytes, content_type,
            checksum_sha256, metadata)
         VALUES
           ($1::uuid, $2::uuid, $3, 'aws_s3', $4, $5,
            'partner_document', $6, $7, $8, $9, $10::jsonb)
         RETURNING id
       )
       INSERT INTO partner_application_documents
         (application_id, document_type, filename, storage_url,
          file_size_bytes, mime_type, uploaded_by, storage_provider,
          storage_object_id)
       SELECT $11::uuid, $12, $6, $5, $7, $8, $3, 'aws_s3', id
         FROM stored
       RETURNING id::text`,
      [
        storageObjectId,
        opts.organizationId,
        opts.uploadedBy,
        uploaded.bucket,
        uploaded.key,
        opts.filename.substring(0, 300),
        uploaded.sizeBytes,
        opts.mimeType,
        uploaded.checksumSha256,
        JSON.stringify({
          applicationId: opts.applicationId,
          documentType: opts.documentType,
        }),
        opts.applicationId,
        opts.documentType,
      ],
    );

    return { ok: true, document_id: r.rows[0].id, storage_key: key };
  } catch (error) {
    await storage.deleteObject(uploaded.key).catch((cleanupError) => {
      console.error("[partner-documents] orphan cleanup failed", cleanupError);
    });
    const storageError = leadgridStoragePersistenceError(error);
    if (storageError) {
      return { ok: false, error: storageError.code, status: storageError.status };
    }
    throw error;
  }
}

export async function presignPartnerDocument(
  storageKey: string,
  ttlSeconds = 3600,
  storageProvider: LeadgridStorageProvider = "aws_s3",
): Promise<string | null> {
  if (storageProvider === "aws_s3") {
    const storage = getLeadgridObjectStorage();
    if (!storage) return null;
    try {
      return await storage.createDownloadUrl(storageKey, ttlSeconds);
    } catch (e) {
      console.error("[partner-documents S3-presign]", e);
      return null;
    }
  }
  const b2 = getB2Client();
  if (!b2) return null;
  try {
    return await getSignedUrl(b2.client,
      new GetObjectCommand({ Bucket: b2.bucket, Key: storageKey }),
      { expiresIn: ttlSeconds });
  } catch (e) {
    console.error("[partner-documents presign]", e);
    return null;
  }
}

export async function deletePartnerDocument(
  pool: Pool, documentId: string,
): Promise<boolean> {
  const r = await pool.query<{
    storage_url: string;
    storage_provider: LeadgridStorageProvider;
    storage_object_id: string | null;
  }>(
    `SELECT storage_url, storage_provider, storage_object_id::text
       FROM partner_application_documents WHERE id = $1`,
    [documentId],
  );
  if (r.rows.length === 0) return false;
  const document = r.rows[0];
  if (document.storage_provider === "aws_s3") {
    const storage = getLeadgridObjectStorage();
    if (!storage) return false;
    if (document.storage_object_id) {
      await pool.query(
        `UPDATE leadgrid_storage_objects SET deleted_at = NOW()
          WHERE id = $1::uuid AND deleted_at IS NULL`,
        [document.storage_object_id],
      );
    }
    try {
      await storage.deleteObject(document.storage_url);
    } catch (e) {
      if (document.storage_object_id) {
        await pool.query(
          `UPDATE leadgrid_storage_objects SET deleted_at = NULL
            WHERE id = $1::uuid AND deleted_at IS NOT NULL`,
          [document.storage_object_id],
        ).catch(() => undefined);
      }
      console.error("[partner-documents delete-S3]", e);
      return false;
    }
  } else {
    const b2 = getB2Client();
    if (!b2) return false;
    try {
      await b2.client.send(new DeleteObjectCommand({
        Bucket: b2.bucket, Key: document.storage_url,
      }));
    } catch (e) {
      console.error("[partner-documents delete-B2]", e);
      return false;
    }
  }
  await pool.query(`DELETE FROM partner_application_documents WHERE id = $1`, [documentId]);
  if (document.storage_object_id) {
    await pool.query(
      `DELETE FROM leadgrid_storage_objects WHERE id = $1::uuid`,
      [document.storage_object_id],
    );
  }
  return true;
}
