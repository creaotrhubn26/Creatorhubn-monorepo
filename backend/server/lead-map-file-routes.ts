import type { Express, NextFunction, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "node:crypto";
import multer from "multer";
import {
  getUserFileDownloadUrl,
  softDeleteUserFile,
} from "./role-room-user-storage-service.js";
import { loadAccessibleLeadgridLead } from "./leadgrid-lead-access.js";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { resolveLeadMapSession } from "./lead-map-session-helper.js";
import {
  getLeadgridObjectStorage,
  leadgridStorageKeys,
  type LeadgridObjectStorage,
  type LeadgridStorageProvider,
} from "./leadgrid-s3-storage-service.js";
import { leadgridStoragePersistenceError } from "./leadgrid-org-storage-service.js";

type SessionData = { userId: string; role?: string; email?: string };
type ScopedRequest = Request & {
  leadgridUserId?: string;
  leadgridOrganizationId?: string;
  leadgridProjectId?: string;
  file?: Express.Multer.File;
};

const MAX_LEAD_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
  "video/mp4", "video/quicktime", "audio/mpeg", "audio/mp4", "audio/wav",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
]);

function matchesLeadFileSignature(body: Buffer, mimeType: string): boolean {
  if (body.length === 0) return false;
  const ascii = (start: number, end: number) => body.subarray(start, end).toString("ascii");
  if (mimeType === "image/jpeg") {
    return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return body.length >= 8 && body.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  if (mimeType === "image/webp") {
    return body.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  }
  if (mimeType === "image/heic" || mimeType === "image/heif") {
    const brand = ascii(8, 12);
    return body.length >= 12 && ascii(4, 8) === "ftyp" &&
      ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand);
  }
  if (["video/mp4", "video/quicktime", "audio/mp4"].includes(mimeType)) {
    return body.length >= 12 && ascii(4, 8) === "ftyp";
  }
  if (mimeType === "audio/mpeg") {
    return ascii(0, 3) === "ID3" ||
      (body.length >= 2 && body[0] === 0xff && (body[1] & 0xe0) === 0xe0);
  }
  if (mimeType === "audio/wav") {
    return body.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE";
  }
  if (mimeType === "application/pdf") return ascii(0, 5) === "%PDF-";
  if ([
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
  ].includes(mimeType)) {
    return body.length >= 8 && body.subarray(0, 8).equals(
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    );
  }
  if ([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ].includes(mimeType)) {
    return body.length >= 4 && body.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  }
  return mimeType === "text/plain" &&
    !body.subarray(0, Math.min(body.length, 4096)).includes(0);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_LEAD_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_MIME.has(file.mimetype)) callback(null, true);
    else callback(new Error("Filtype ikke tillatt"));
  },
});

export function registerLeadMapFileRoutes(deps: {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  objectStorage?: LeadgridObjectStorage | null;
}): void {
  const { app, pool, activeSessions } = deps;
  const objectStorage = deps.objectStorage === undefined
    ? getLeadgridObjectStorage()
    : deps.objectStorage;

  const resolveScope = async (req: ScopedRequest, res: Response, next: NextFunction) => {
    const current = await resolveLeadMapSession(req, pool, activeSessions);
    if (!current?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const lead = await loadAccessibleLeadgridLead(
        pool,
        { leadId: req.params.id, userId: current.userId },
      );
      if (!lead) return res.status(404).json({ error: "lead_not_found" });
      req.leadgridUserId = current.userId;
      req.leadgridOrganizationId = lead.organizationId;
      req.leadgridProjectId = lead.projectId;
      next();
    } catch {
      return res.status(500).json({ error: "file_scope_failed" });
    }
  };

  app.get("/api/admin-room/lead-map/leads/:id/files", resolveScope, async (req: ScopedRequest, res: Response) => {
    const result = await pool.query(
      `SELECT lf.file_id::text AS id, f.display_name, f.size_bytes, f.content_type,
              f.created_at AS uploaded_at, lf.description, lf.tags,
              lf.uploader_user_id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS uploader_name
         FROM leadgrid_lead_files lf
         JOIN leadgrid_storage_objects f ON f.id = lf.file_id AND f.deleted_at IS NULL
         LEFT JOIN users u ON u.id = lf.uploader_user_id
        WHERE lf.organization_id = $1::uuid
          AND lf.project_id = $2
          AND lf.lead_id = $3::uuid
        ORDER BY f.created_at DESC`,
      [req.leadgridOrganizationId, req.leadgridProjectId, req.params.id],
    );
    return res.json({ files: result.rows });
  });

  app.post(
    "/api/admin-room/lead-map/leads/:id/files",
    requireLeadMapPermission("leads.update", { pool, activeSessions }),
    resolveScope,
    upload.single("file"),
    async (req: ScopedRequest, res: Response) => {
      const file = req.file;
      const userId = req.leadgridUserId!;
      const organizationId = req.leadgridOrganizationId!;
      const projectId = req.leadgridProjectId!;
      if (!file?.buffer?.length) return res.status(400).json({ error: "mangler_fil" });
      if (!matchesLeadFileSignature(file.buffer, file.mimetype)) {
        return res.status(415).json({ error: "mime_stemmer_ikke_med_fil" });
      }
      if (!objectStorage) {
        return res.status(503).json({ error: "leadgrid_storage_not_configured" });
      }
      const tags = typeof req.body?.tags === "string"
        ? req.body.tags.split(",").map((value: string) => value.trim()).filter(Boolean).slice(0, 20)
        : [];
      const description = typeof req.body?.description === "string"
        ? req.body.description.trim().slice(0, 2000)
        : "";
      const displayName = String(
        req.body?.displayName || file.originalname || "upload.bin",
      ).trim().slice(0, 255) || "upload.bin";
      const assetId = crypto.randomUUID();
      const objectKey = leadgridStorageKeys.leadAttachment({
        organizationId,
        projectId,
        leadId: req.params.id,
        assetId,
      });
      let uploaded;
      try {
        uploaded = await objectStorage.putObject({
          key: objectKey,
          body: file.buffer,
          contentType: file.mimetype,
          purpose: "lead_attachment",
        });
      } catch (error) {
        console.error("[leadgrid-files] S3 upload failed", error);
        return res.status(502).json({ error: "leadgrid_storage_upload_failed" });
      }
      try {
        await pool.query(
          `WITH stored AS (
             INSERT INTO leadgrid_storage_objects
               (id, organization_id, project_id, uploaded_by,
                storage_provider, bucket_name, object_key, purpose,
                display_name, size_bytes, content_type, checksum_sha256,
                metadata)
             VALUES
               ($1::uuid, $2::uuid, $3, $4, 'aws_s3', $5, $6,
                'lead_attachment', $7, $8, $9, $10, $11::jsonb)
             RETURNING id
           )
           INSERT INTO leadgrid_lead_files
             (file_id, organization_id, project_id, lead_id,
              uploader_user_id, description, tags)
           SELECT id, $2::uuid, $3, $12::uuid, $4, $13, $14::text[]
             FROM stored`,
          [
            assetId,
            organizationId,
            projectId,
            userId,
            uploaded.bucket,
            uploaded.key,
            displayName,
            uploaded.sizeBytes,
            file.mimetype,
            uploaded.checksumSha256,
            JSON.stringify({ leadId: req.params.id }),
            req.params.id,
            description || null,
            tags,
          ],
        );
      } catch (error) {
        await objectStorage.deleteObject(uploaded.key).catch((cleanupError) => {
          console.error("[leadgrid-files] orphan cleanup failed", cleanupError);
        });
        const storageError = leadgridStoragePersistenceError(error);
        if (storageError) return res.status(storageError.status).json({ error: storageError.code });
        throw error;
      }
      return res.status(201).json({
        file: {
          id: assetId,
          displayName,
          sizeBytes: uploaded.sizeBytes,
          contentType: file.mimetype,
          uploadedAt: new Date().toISOString(),
          description: description || null,
          tags,
          uploaderUserId: userId,
        },
      });
    },
  );

  app.get("/api/admin-room/lead-map/leads/:id/files/:fileId/download", resolveScope, async (req: ScopedRequest, res: Response) => {
    const linked = await pool.query<{
      uploader_user_id: string;
      storage_provider: LeadgridStorageProvider;
      object_key: string;
      display_name: string;
    }>(
      `SELECT lf.uploader_user_id, f.storage_provider, f.object_key, f.display_name
         FROM leadgrid_lead_files lf
         JOIN leadgrid_storage_objects f ON f.id = lf.file_id AND f.deleted_at IS NULL
        WHERE lf.file_id = $1::uuid
          AND lf.lead_id = $2::uuid
          AND lf.organization_id = $3::uuid
          AND lf.project_id = $4`,
      [
        req.params.fileId,
        req.params.id,
        req.leadgridOrganizationId,
        req.leadgridProjectId,
      ],
    );
    if (!linked.rows.length) return res.status(404).json({ error: "not_found" });
    const file = linked.rows[0];
    if (file.storage_provider === "aws_s3") {
      if (!objectStorage) {
        return res.status(503).json({ error: "leadgrid_storage_not_configured" });
      }
      try {
        const url = await objectStorage.createDownloadUrl(file.object_key, 600);
        return res.json({ url, displayName: file.display_name });
      } catch (error) {
        console.error("[leadgrid-files] S3 presign failed", error);
        return res.status(502).json({ error: "leadgrid_storage_download_failed" });
      }
    }
    const legacy = await getUserFileDownloadUrl(pool, {
      userId: file.uploader_user_id,
      fileId: req.params.fileId,
    });
    if (!legacy.ok) return res.status(404).json({ error: legacy.reason });
    return res.json({ url: legacy.url, displayName: legacy.displayName });
  });

  app.delete(
    "/api/admin-room/lead-map/leads/:id/files/:fileId",
    requireLeadMapPermission("leads.update", { pool, activeSessions }),
    resolveScope,
    async (req: ScopedRequest, res: Response) => {
      const linked = await pool.query<{
        uploader_user_id: string;
        storage_provider: LeadgridStorageProvider;
        object_key: string;
        size_bytes: string | number;
      }>(
        `SELECT lf.uploader_user_id, f.storage_provider, f.object_key, f.size_bytes
           FROM leadgrid_lead_files lf
           JOIN leadgrid_storage_objects f ON f.id = lf.file_id AND f.deleted_at IS NULL
          WHERE lf.file_id = $1::uuid
            AND lf.lead_id = $2::uuid
            AND lf.organization_id = $3::uuid
            AND lf.project_id = $4
          LIMIT 1`,
        [
          req.params.fileId,
          req.params.id,
          req.leadgridOrganizationId,
          req.leadgridProjectId,
        ],
      );
      const file = linked.rows[0];
      if (!file) return res.status(404).json({ error: "not_found" });

      if (file.storage_provider === "aws_s3") {
        if (!objectStorage) {
          return res.status(503).json({ error: "leadgrid_storage_not_configured" });
        }
        await pool.query(
          `UPDATE leadgrid_storage_objects storage
              SET deleted_at = NOW()
             FROM leadgrid_lead_files attachment
            WHERE storage.id = $1::uuid
              AND attachment.file_id = storage.id
              AND attachment.lead_id = $2::uuid
              AND attachment.organization_id = $3::uuid
              AND attachment.project_id = $4
              AND storage.deleted_at IS NULL`,
          [
            req.params.fileId,
            req.params.id,
            req.leadgridOrganizationId,
            req.leadgridProjectId,
          ],
        );
        try {
          await objectStorage.deleteObject(file.object_key);
        } catch (error) {
          await pool.query(
            `UPDATE leadgrid_storage_objects SET deleted_at = NULL
              WHERE id = $1::uuid AND deleted_at IS NOT NULL`,
            [req.params.fileId],
          );
          console.error("[leadgrid-files] S3 delete failed", error);
          return res.status(502).json({ error: "leadgrid_storage_delete_failed" });
        }
      } else {
        const legacy = await softDeleteUserFile(pool, {
          userId: file.uploader_user_id,
          fileId: req.params.fileId,
        });
        if (!legacy.ok) return res.status(404).json({ error: "not_found" });
      }

      await pool.query(
        `DELETE FROM leadgrid_storage_objects WHERE id = $1::uuid`,
        [req.params.fileId],
      );
      return res.json({ ok: true, freedBytes: Number(file.size_bytes) || 0 });
    },
  );
}
