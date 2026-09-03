import type { Express, NextFunction, Request, Response } from "express";
import type { Pool } from "pg";
import multer from "multer";
import {
  ensureUserBucket,
  getUserFileDownloadUrl,
  softDeleteUserFile,
  uploadUserFile,
} from "./role-room-user-storage-service.js";
import {
  requestedLeadMapOrganizationId,
  resolveLeadOrganizationScope,
  sendLeadMapOrganizationScopeError,
} from "./lead-map-org-scope.js";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { resolveLeadMapSession } from "./lead-map-session-helper.js";

type SessionData = { userId: string; role?: string; email?: string };
type ScopedRequest = Request & {
  leadgridUserId?: string;
  leadgridOrganizationId?: string;
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
}): void {
  const { app, pool, activeSessions } = deps;

  const resolveScope = async (req: ScopedRequest, res: Response, next: NextFunction) => {
    const current = await resolveLeadMapSession(req, pool, activeSessions);
    if (!current?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const organizationId = await resolveLeadOrganizationScope(
        pool,
        current.userId,
        req.params.id,
        requestedLeadMapOrganizationId(req),
      );
      if (!organizationId) return res.status(409).json({ error: "workspace_scope_required" });
      const lead = await pool.query(
        `SELECT 1 FROM crm_customers
          WHERE id = $1::uuid AND organization_id = $2::uuid AND archived_at IS NULL
          LIMIT 1`,
        [req.params.id, organizationId],
      );
      if (!lead.rows.length) return res.status(404).json({ error: "lead_not_found" });
      req.leadgridUserId = current.userId;
      req.leadgridOrganizationId = organizationId;
      next();
    } catch (error) {
      if (sendLeadMapOrganizationScopeError(error, res)) return;
      return res.status(500).json({ error: "file_scope_failed" });
    }
  };

  app.get("/api/admin-room/lead-map/leads/:id/files", resolveScope, async (req: ScopedRequest, res: Response) => {
    const result = await pool.query(
      `SELECT lf.file_id::text AS id, f.display_name, f.size_bytes, f.content_type,
              f.uploaded_at, lf.description, lf.tags,
              lf.uploader_user_id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS uploader_name
         FROM leadgrid_lead_files lf
         JOIN role_room_user_files f ON f.id = lf.file_id AND f.deleted_at IS NULL
         LEFT JOIN users u ON u.id = lf.uploader_user_id
        WHERE lf.organization_id = $1::uuid AND lf.lead_id = $2::uuid
        ORDER BY f.uploaded_at DESC`,
      [req.leadgridOrganizationId, req.params.id],
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
      if (!file?.buffer?.length) return res.status(400).json({ error: "mangler_fil" });
      const tags = typeof req.body?.tags === "string"
        ? req.body.tags.split(",").map((value: string) => value.trim()).filter(Boolean).slice(0, 20)
        : [];
      const description = typeof req.body?.description === "string"
        ? req.body.description.trim().slice(0, 2000)
        : "";
      await ensureUserBucket(pool, userId);
      const uploaded = await uploadUserFile(pool, {
        userId,
        displayName: String(req.body?.displayName || file.originalname || "upload.bin").slice(0, 255),
        body: file.buffer,
        contentType: file.mimetype,
        sourceModule: "leadgrid",
        metadata: { organizationId, leadId: req.params.id, tags, description },
        context: {
          attachedToEntityType: "leadgrid_lead",
          attachedToEntityId: req.params.id,
          attachmentNote: description || undefined,
        },
      });
      if (!uploaded.ok) {
        const status = uploaded.reason === "quota_exceeded" ? 507
          : uploaded.reason === "b2_not_configured" ? 503 : 502;
        return res.status(status).json({ error: uploaded.reason });
      }
      try {
        await pool.query(
          `INSERT INTO leadgrid_lead_files
             (file_id, organization_id, lead_id, uploader_user_id, description, tags)
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::text[])`,
          [uploaded.file.id, organizationId, req.params.id, userId, description || null, tags],
        );
      } catch (error) {
        // Filen er allerede registrert i den delte storage-tabellen. Rull den
        // tilbake hvis lead-koblingen feiler, ellers blir den en usynlig orphan.
        await softDeleteUserFile(pool, { userId, fileId: uploaded.file.id }).catch(() => undefined);
        throw error;
      }
      return res.status(201).json({ file: uploaded.file });
    },
  );

  app.get("/api/admin-room/lead-map/leads/:id/files/:fileId/download", resolveScope, async (req: ScopedRequest, res: Response) => {
    const linked = await pool.query<{ uploader_user_id: string }>(
      `SELECT uploader_user_id FROM leadgrid_lead_files
        WHERE file_id = $1::uuid AND lead_id = $2::uuid AND organization_id = $3::uuid`,
      [req.params.fileId, req.params.id, req.leadgridOrganizationId],
    );
    if (!linked.rows.length) return res.status(404).json({ error: "not_found" });
    const result = await getUserFileDownloadUrl(pool, {
      userId: linked.rows[0].uploader_user_id,
      fileId: req.params.fileId,
    });
    if (!result.ok) return res.status(404).json({ error: result.reason });
    return res.json({ url: result.url, displayName: result.displayName });
  });
}
