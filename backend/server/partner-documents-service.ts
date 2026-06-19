/**
 * partner-documents-service.ts
 *
 * Backblaze B2-basert dokument-upload for partner-applications.
 * Lagres under partner-applications/{appId}/{docType}/{filename}.
 * Returnerer presigned download-URLs (7d expiry) for admin-review.
 */

import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Pool } from "pg";
import crypto from "crypto";

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

function partnerDocKey(applicationId: string, documentType: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 200);
  return `partner-applications/${applicationId}/${documentType}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safe}`;
}

export interface UploadResult {
  ok: boolean;
  document_id?: string;
  storage_key?: string;
  error?: string;
}

export async function uploadPartnerDocument(
  pool: Pool,
  opts: {
    applicationId: string;
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

  const b2 = getB2Client();
  if (!b2) {
    return { ok: false, error: "B2 ikke konfigurert" };
  }

  const key = partnerDocKey(opts.applicationId, opts.documentType, opts.filename);

  try {
    await b2.client.send(new PutObjectCommand({
      Bucket: b2.bucket,
      Key: key,
      Body: opts.fileBuffer,
      ContentType: opts.mimeType,
      Metadata: {
        application_id: opts.applicationId,
        document_type: opts.documentType,
        uploaded_by: opts.uploadedBy,
        original_filename: opts.filename.substring(0, 200),
      },
    }));
  } catch (e: any) {
    console.error("[partner-documents B2-upload]", e);
    return { ok: false, error: "Upload til B2 feilet" };
  }

  // Lagre i DB. storage_url er B2-keyen, vi presigner ved nedlasting.
  const r = await pool.query<{ id: string }>(
    `INSERT INTO partner_application_documents
      (application_id, document_type, filename, storage_url,
       file_size_bytes, mime_type, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id::text`,
    [
      opts.applicationId, opts.documentType,
      opts.filename.substring(0, 300),
      key, opts.fileBuffer.length, opts.mimeType,
      opts.uploadedBy,
    ],
  );

  return { ok: true, document_id: r.rows[0].id, storage_key: key };
}

export async function presignPartnerDocument(
  storageKey: string,
  ttlSeconds = 3600,
): Promise<string | null> {
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
  const r = await pool.query<{ storage_url: string }>(
    `SELECT storage_url FROM partner_application_documents WHERE id = $1`,
    [documentId],
  );
  if (r.rows.length === 0) return false;
  const b2 = getB2Client();
  if (b2) {
    try {
      await b2.client.send(new DeleteObjectCommand({
        Bucket: b2.bucket, Key: r.rows[0].storage_url,
      }));
    } catch (e) { console.error("[partner-documents delete-B2]", e); }
  }
  await pool.query(`DELETE FROM partner_application_documents WHERE id = $1`, [documentId]);
  return true;
}
