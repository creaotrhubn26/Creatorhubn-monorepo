import express from "express";
import type { Pool } from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type Stripe from "stripe";
import { createRequire } from "module";
import * as schema from "../migrations/schema.js";
import { broadcastUserEvent } from "./realtime-user-events.js";
import { recordProjectChange } from "./project-change-log.js";
import {
  fetchClientGalleryByAccessToken,
  listClientGalleryImages,
} from "./client-gallery-render.js";

const _require = createRequire(import.meta.url);
const archiverFactory = _require("archiver") as (
  format: "zip",
  options?: { zlib?: { level?: number } },
) => {
  on(
    event: "warning" | "error",
    listener: (err: Error & { code?: string }) => void,
  ): unknown;
  pipe(dest: NodeJS.WritableStream): unknown;
  append(
    input: NodeJS.ReadableStream | Buffer | string,
    opts: { name: string },
  ): unknown;
  finalize(): Promise<void>;
};

export interface ClientGalleryRoutesDeps {
  app: express.Application;
  pool: Pool;
  db: NodePgDatabase<typeof schema>;
  gateGalleryAccess: (
    accessToken: string,
    password: string | null,
  ) => Promise<any>;
  readGalleryPasswordHeader: (req: express.Request) => string | null;
  recordAnalyticsEvent: (eventType: string, opts: any) => void;
  ensureCanonicalClientId: (
    photographerId: string,
    email: string,
    clientName: string | null,
  ) => Promise<string | null>;
  ensureGalleryDownloadAuditSchema: () => Promise<void>;
  ensurePrintStoreSchema: () => Promise<void>;
  ensureVideoTimecodeCommentsSchema: () => Promise<void>;
  buildGalleryShareUrl: (accessToken: string) => string;
  fetchGalleryWithSettingsByToken: (accessToken: string) => Promise<any>;
  calculateGalleryPricing: (
    gallery: any,
    selectedImageIds: string[],
  ) => any;
  checkContractSignature: (galleryId: string) => Promise<any>;
  countUniqueDownloadedImages: (
    galleryId: string,
    imageIds: string[],
  ) => Promise<number>;
  notifyPhotographerOfDownload: (input: any) => Promise<void>;
  dispatchGalleryNotification: (
    type: string,
    photographerId: string,
    payload: any,
  ) => Promise<void>;
  getCreatorHubStripeClient: () => Stripe | null;
  getActiveSessionFromRequest: (req: express.Request) => any;
}

export function setupClientGalleryRoutes(
  deps: ClientGalleryRoutesDeps,
): void {
  const {
    app,
    pool,
    db,
    gateGalleryAccess,
    readGalleryPasswordHeader,
    recordAnalyticsEvent,
    ensureCanonicalClientId,
    ensureGalleryDownloadAuditSchema,
    ensurePrintStoreSchema,
    ensureVideoTimecodeCommentsSchema,
    buildGalleryShareUrl,
    fetchGalleryWithSettingsByToken,
    calculateGalleryPricing,
    checkContractSignature,
    countUniqueDownloadedImages,
    notifyPhotographerOfDownload,
    dispatchGalleryNotification,
    getCreatorHubStripeClient,
    getActiveSessionFromRequest,
  } = deps;

  const VALID_COMMENT_CATEGORIES = new Set([
    "color",
    "audio",
    "edit",
    "vfx",
    "structure",
    "text",
    "other",
  ]);
  const VALID_COMMENT_PRIORITIES = new Set([
    "must-fix",
    "nice-to-have",
    "suggestion",
  ]);

  //
  // Unauthenticated — the accessToken IS the auth. Every request re-signs
  // Capture-sourced image URLs so the gallery keeps working past R2's
  // 7-day signed-URL ceiling.

  app.get("/api/client/gallery/:accessToken", async (req, res) => {
    const accessToken = String(req.params.accessToken || "").trim();
    if (!accessToken) {
      return res.status(400).json({ error: "missing_access_token" });
    }
    try {
      const gallery = await fetchClientGalleryByAccessToken(db, accessToken);
      if (!gallery) return res.status(404).json({ error: "not_found" });
      // Slice 9.4 — this endpoint deliberately does NOT enforce the
      // password (the viewer needs to know whether to prompt for one),
      // but it surfaces the requiresPassword + isExpired flags + the
      // gallery_settings so the viewer can render the right gate UI.
      // Subsequent routes (images, comments, selections, etc) DO enforce.
      const detail = await fetchGalleryWithSettingsByToken(accessToken);
      const settings = detail?.settings ?? {};
      const expiresAtRaw = settings.expiresAt;
      let isExpired = false;
      if (typeof expiresAtRaw === 'string' && expiresAtRaw.trim()) {
        const t = new Date(expiresAtRaw).getTime();
        isExpired = Number.isFinite(t) && t < Date.now();
      }
      const requiresPassword =
        settings.requiresPassword === true && typeof settings.passwordHash === 'string';

      // Slice 9P — surface photographer's profession so the viewer can
      // render profession-aware copy (foto-galleri / video-galleri /
      // lyd-galleri, bilder / klipp / spor). Failure to look this up is
      // non-fatal; viewer falls back to photographer-flavoured copy.
      let photographerProfession: string | null = null;
      try {
        if (gallery.photographerId) {
          const profRow = await pool.query(
            'SELECT profession FROM users WHERE id = $1 LIMIT 1',
            [gallery.photographerId],
          );
          const raw = profRow.rows[0]?.profession;
          if (typeof raw === 'string' && raw.trim()) photographerProfession = raw.trim();
        }
      } catch (lookupErr) {
        console.warn('[client-gallery] profession lookup failed', lookupErr);
      }

      return res.json({
        id: gallery.id,
        clientName: gallery.clientName,
        clientEmail: gallery.clientEmail,
        projectTitle: gallery.projectTitle,
        status: gallery.status,
        createdAt: gallery.createdAt,
        completedAt: gallery.completedAt,
        source: gallery.source,
        captureSessionId: gallery.captureSessionId,
        // Slice 9P — drives client-gallery viewer terminology.
        photographerProfession,
        // Slice 9.4 — gate hints. Viewer reads these BEFORE attempting
        // to fetch images so it can render password-prompt or
        // expired-state cleanly.
        requiresPassword,
        isExpired,
        expiresAt: typeof expiresAtRaw === 'string' ? expiresAtRaw : null,
        // Slice 9 — surface gallery_settings the viewer needs without
        // requiring it to call a separate settings endpoint. We strip
        // passwordHash here — the viewer doesn't need to see it, and
        // shipping it cross-origin to anyone with the access token
        // would let them brute-force offline.
        gallerySettings: (() => {
          const safe = { ...settings };
          delete safe.passwordHash;
          return safe;
        })(),
      });
    } catch (error) {
      console.error("[client-gallery] fetch failed", error);
      return res.status(500).json({ error: "gallery_fetch_failed" });
    }
  });

  app.get("/api/client/gallery/:accessToken/images", async (req, res) => {
    const accessToken = String(req.params.accessToken || "").trim();
    if (!accessToken) {
      return res.status(400).json({ error: "missing_access_token" });
    }
    try {
      // Slice 9.4 — gate enforces password + expiration before serving
      // the actual image URLs. Returning 401 with requiresPassword=true
      // tells the viewer to prompt + retry with x-gallery-password header.
      const access = await gateGalleryAccess(accessToken, readGalleryPasswordHeader(req));
      if (!access.ok) {
        return res.status(access.status).json({
          error: access.error,
          ...(access.requiresPassword ? { requiresPassword: true } : {}),
        });
      }
      const images = await listClientGalleryImages(db, access.gallery.id, {
        accessToken,
      });
      return res.json({
        galleryId: access.gallery.id,
        images,
        // Client can display a banner when any image came back with
        // signingFailed: true (e.g. the captureAssets row was deleted).
        anySigningFailed: images.some((i) => i.signingFailed),
      });
    } catch (error) {
      console.error("[client-gallery] list images failed", error);
      return res.status(500).json({ error: "gallery_images_failed" });
    }
  });

  // GET /api/client/gallery/:accessToken/files/:imageId/download
  // Token-gated decrypt-proxy for chunked-upload-bilder. Validerer
  // accessToken via samme gate som /images, slår opp imageId mot
  // client_gallery_images + chunked_uploads, og piper plaintext til
  // klienten. Stream-videoer kan ikke serveres her (Cloudflare må
  // kunne lese for transcoding) — returnerer 409 i så fall.
  app.get(
    "/api/client/gallery/:accessToken/files/:imageId/download",
    async (req, res) => {
      const accessToken = String(req.params.accessToken || "").trim();
      const imageId = String(req.params.imageId || "").trim();
      if (!accessToken || !imageId) {
        return res.status(400).json({ error: "missing_params" });
      }

      try {
        const access = await gateGalleryAccess(
          accessToken,
          readGalleryPasswordHeader(req),
        );
        if (!access.ok) {
          return res.status(access.status).json({
            error: access.error,
            ...(access.requiresPassword ? { requiresPassword: true } : {}),
          });
        }

        // Slå opp galleri-bildet for å finne chunkedUploadId
        const imgRes = await pool.query(
          `SELECT id, gallery_id, image_metadata, photographer_id
             FROM client_gallery_images
            WHERE id = $1 AND gallery_id = $2 AND is_visible = TRUE`,
          [imageId, access.gallery.id],
        );
        if ((imgRes.rowCount ?? 0) === 0) {
          return res.status(404).json({ error: "image_not_found" });
        }
        const imgRow = imgRes.rows[0];
        const md =
          imgRow.image_metadata && typeof imgRow.image_metadata === "object"
            ? imgRow.image_metadata
            : {};
        const chunkedUploadId =
          typeof md.chunkedUploadId === "string" ? md.chunkedUploadId : null;
        if (!chunkedUploadId) {
          return res.status(404).json({
            error: "no_chunked_upload",
            message:
              "Dette bildet er ikke en chunked-upload (har ingen chunkedUploadId).",
          });
        }

        // Slå opp chunked_uploads med eier-sjekk mot fotografens user_id.
        // Defense-in-depth: selv om accessToken validerte, sikrer vi at
        // fila tilhører galleriets eier.
        const chunkedRes = await pool.query(
          `SELECT user_id, file_name, mime_type, final_file_path, metadata, file_size
             FROM chunked_uploads
            WHERE final_file_id = $1 AND status = 'completed'`,
          [chunkedUploadId],
        );
        if ((chunkedRes.rowCount ?? 0) === 0) {
          return res.status(404).json({ error: "file_not_found" });
        }
        const chunkedRow = chunkedRes.rows[0];
        if (chunkedRow.user_id !== imgRow.photographer_id) {
          // Owner-mismatch — sett aldri tilgang. Lagger denne som
          // mistenkelig fordi det betyr at noen har tuklet med
          // image_metadata på en eksisterende rad.
          console.warn(
            `[client-gallery] owner-mismatch på file ${chunkedUploadId} for image ${imageId}`,
          );
          return res.status(403).json({ error: "owner_mismatch" });
        }

        const metadata =
          chunkedRow.metadata && typeof chunkedRow.metadata === "object"
            ? chunkedRow.metadata
            : {};
        const backend = metadata.storageBackend as string | undefined;
        const isEncrypted = metadata.encryptedAtRest === true;
        const mime = chunkedRow.mime_type || "application/octet-stream";

        if (backend === "cloudflare_stream") {
          return res.status(409).json({
            error: "video_in_stream",
            message:
              "Videoen ligger i Cloudflare Stream og kan ikke lastes ned som fil. Bruk preview-funksjonen i stedet.",
          });
        }

        // Last encryption-helpers dynamisk
        let dek: Buffer | null = null;
        let DecryptStream: any = null;
        let ciphertextSize = 0;
        if (isEncrypted) {
          const enc = await import("./file-encryption.js");
          if (!enc.isEncryptionAvailable()) {
            return res.status(503).json({
              error: "encryption_key_missing",
              message: "Master-KEK mangler — kan ikke dekryptere fila.",
            });
          }
          try {
            const userKek = enc.deriveUserKek(chunkedRow.user_id);
            dek = enc.decryptDek(String(metadata.encryptedDek), userKek);
          } catch (err) {
            console.error("[client-gallery] DEK decrypt failed", err);
            return res.status(500).json({ error: "decrypt_failed" });
          }
          ciphertextSize = Number(metadata.ciphertextSize ?? 0);
          if (ciphertextSize <= 0) {
            return res.status(500).json({ error: "ciphertext_size_missing" });
          }
          DecryptStream = enc.DecryptStream;
        }

        res.setHeader("Content-Type", mime);
        res.setHeader(
          "Content-Disposition",
          `inline; filename="${(chunkedRow.file_name || "fil").replace(/"/g, "")}"`,
        );

        // R2-pathen
        if (backend === "r2" && metadata.r2Key) {
          const { S3Client, GetObjectCommand } = await import(
            "@aws-sdk/client-s3"
          );
          const r2 = new S3Client({
            region: "auto",
            endpoint:
              process.env.GENERIC_UPLOADS_R2_ENDPOINT ||
              process.env.CLOUDFLARE_R2_ENDPOINT ||
              process.env.R2_ENDPOINT,
            credentials: {
              accessKeyId:
                process.env.GENERIC_UPLOADS_R2_ACCESS_KEY_ID ||
                process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
                process.env.R2_ACCESS_KEY_ID ||
                "",
              secretAccessKey:
                process.env.GENERIC_UPLOADS_R2_SECRET_ACCESS_KEY ||
                process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
                process.env.R2_SECRET_ACCESS_KEY ||
                "",
            },
          });
          const bucket =
            process.env.GENERIC_UPLOADS_R2_BUCKET ||
            process.env.CLOUDFLARE_R2_BUCKET ||
            process.env.R2_BUCKET ||
            "";
          if (!bucket) {
            return res.status(503).json({ error: "r2_not_configured" });
          }
          const obj = await r2.send(
            new GetObjectCommand({
              Bucket: bucket,
              Key: String(metadata.r2Key),
            }),
          );
          if (!obj.Body) {
            return res.status(502).json({ error: "r2_empty_body" });
          }
          const source = obj.Body as NodeJS.ReadableStream;
          if (isEncrypted) {
            const ds = new DecryptStream(dek!, ciphertextSize);
            source.pipe(ds).pipe(res);
          } else {
            source.pipe(res);
          }
          return;
        }

        // Filesystem-pathen
        const path = await import("path");
        const os = await import("os");
        const fsSync = await import("fs");
        const UPLOAD_ROOT =
          process.env.CHUNKED_UPLOAD_DIR ||
          path.join(os.tmpdir(), "creatorhub-chunked-uploads");
        const fullPath = path.join(UPLOAD_ROOT, chunkedRow.final_file_path);
        if (!fullPath.startsWith(UPLOAD_ROOT)) {
          return res.status(403).json({ error: "path_traversal_blocked" });
        }
        const readStream = fsSync.createReadStream(fullPath);
        if (isEncrypted) {
          const ds = new DecryptStream(dek!, ciphertextSize);
          readStream.pipe(ds).pipe(res);
        } else {
          readStream.pipe(res);
        }
      } catch (err: any) {
        console.error("[client-gallery] download failed:", err);
        return res.status(500).json({ error: "download_failed" });
      }
    },
  );

  // GET /api/photographer/chunked-uploads
  // Lister innlogget fotografs ferdig-opplastede filer slik at frontend
  // kan vise en picker for å legge dem til i et galleri.
  //
  // Query params:
  //   ?search=substring     (matcher mot file_name, case-insensitive)
  //   ?mimePrefix=image/    (filter på MIME, eks "image/" eller "video/")
  //   ?encryptedOnly=true   (kun encryptedAtRest=true filer)
  //   ?cursor=ISO_TIMESTAMP (paginering — created_at < cursor)
  //   ?limit=N              (1–200, default 50)
  app.get("/api/photographer/chunked-uploads", async (req, res) => {
    const session = getActiveSessionFromRequest(req);
    if (!session?.userId) {
      return res.status(401).json({ error: "not_authenticated" });
    }
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    const mimePrefix =
      typeof req.query.mimePrefix === "string"
        ? req.query.mimePrefix.trim()
        : "";
    const encryptedOnly = req.query.encryptedOnly === "true";
    const cursor =
      typeof req.query.cursor === "string" && req.query.cursor.trim()
        ? req.query.cursor.trim()
        : null;
    const limit = Math.min(
      200,
      Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50),
    );

    const where: string[] = [
      "user_id = $1",
      "status = 'completed'",
      "final_file_id IS NOT NULL",
    ];
    const params: any[] = [session.userId];
    let i = 2;
    if (search) {
      where.push(`file_name ILIKE $${i++}`);
      params.push(`%${search}%`);
    }
    if (mimePrefix) {
      where.push(`mime_type LIKE $${i++}`);
      params.push(`${mimePrefix}%`);
    }
    if (encryptedOnly) {
      where.push(`(metadata->>'encryptedAtRest')::boolean = true`);
    }
    if (cursor) {
      where.push(`created_at < $${i++}`);
      params.push(cursor);
    }

    try {
      const r = await pool.query<{
        final_file_id: string;
        file_name: string;
        mime_type: string | null;
        file_size: string | number | null;
        created_at: string;
        metadata: Record<string, unknown> | null;
      }>(
        `SELECT final_file_id, file_name, mime_type, file_size, created_at, metadata
           FROM chunked_uploads
          WHERE ${where.join(" AND ")}
          ORDER BY created_at DESC
          LIMIT ${limit}`,
        params,
      );

      const rows = r.rows.map((row) => {
        const md = row.metadata || {};
        return {
          fileId: row.final_file_id,
          fileName: row.file_name,
          mimeType: row.mime_type,
          size: Number(row.file_size ?? 0),
          createdAt: row.created_at,
          encryptedAtRest: md.encryptedAtRest === true,
          storageBackend: md.storageBackend ?? null,
          isVideo:
            (row.mime_type ?? "").startsWith("video/") ||
            md.storageBackend === "cloudflare_stream",
        };
      });

      const nextCursor =
        rows.length === limit ? rows[rows.length - 1].createdAt : null;

      res.json({
        success: true,
        files: rows,
        nextCursor,
      });
    } catch (err: any) {
      console.error("[photographer-chunked-uploads] list failed", err);
      res.status(500).json({
        error: "list_failed",
        message: String(err?.message || err).slice(0, 200),
      });
    }
  });

  // POST /api/photographer/galleries/:galleryId/attach-uploads
  // Owner-endepunkt: koble chunked_uploads (krypterte eller ikke) inn
  // som client_gallery_images. Brukes når fotograf vil legge til
  // krypterte filer i et eksisterende galleri uten å gå via
  // photo-delivery-service eller capture-bridge.
  //
  // Body: { fileIds: string[], titles?: string[] }
  // Returnerer { added: number, skipped: number, imageIds: string[] }
  app.post(
    "/api/photographer/galleries/:galleryId/attach-uploads",
    async (req, res) => {
      const session = getActiveSessionFromRequest(req);
      if (!session?.userId) {
        return res.status(401).json({ error: "not_authenticated" });
      }
      const { galleryId } = req.params;
      const fileIds: string[] = Array.isArray(req.body?.fileIds)
        ? req.body.fileIds.filter((s: any) => typeof s === "string")
        : [];
      const titles: string[] | null = Array.isArray(req.body?.titles)
        ? req.body.titles
        : null;
      if (fileIds.length === 0) {
        return res.status(400).json({
          error: "missing_file_ids",
          message: "fileIds må være en array med minst én chunked_upload final_file_id.",
        });
      }
      if (fileIds.length > 5000) {
        return res
          .status(400)
          .json({ error: "too_many_files", message: "Max 5000 filer per kall." });
      }

      try {
        // 1. Verifiser at galleriet tilhører innlogget bruker
        const galleryRes = await pool.query(
          `SELECT id, photographer_id
             FROM photographer_client_galleries
            WHERE id = $1`,
          [galleryId],
        );
        if ((galleryRes.rowCount ?? 0) === 0) {
          return res.status(404).json({ error: "gallery_not_found" });
        }
        if (galleryRes.rows[0].photographer_id !== session.userId) {
          return res.status(403).json({ error: "not_gallery_owner" });
        }

        // 2. Verifiser eierskap på alle filene
        const owned = await pool.query<{
          final_file_id: string;
          file_name: string;
        }>(
          `SELECT final_file_id, file_name
             FROM chunked_uploads
            WHERE final_file_id = ANY($1::text[])
              AND user_id = $2
              AND status = 'completed'`,
          [fileIds, session.userId],
        );
        const ownedMap = new Map(owned.rows.map((r) => [r.final_file_id, r]));
        const missing = fileIds.filter((id) => !ownedMap.has(id));
        if (missing.length > 0) {
          return res.status(403).json({
            error: "file_not_owned",
            message: `Du eier ikke ${missing.length} av filene.`,
            missing,
          });
        }

        // 3. Insert client_gallery_images-rader
        const inserted: string[] = [];
        const skipped: string[] = [];
        for (let i = 0; i < fileIds.length; i++) {
          const fileId = fileIds[i];
          const fileRow = ownedMap.get(fileId)!;
          const title =
            titles && typeof titles[i] === "string" && titles[i].trim()
              ? titles[i]
              : fileRow.file_name;
          try {
            const ins = await pool.query<{ id: string }>(
              `INSERT INTO client_gallery_images
                 (gallery_id, photographer_id, image_title, image_description,
                  thumbnail_url, full_size_url, image_metadata, sort_order,
                  is_visible)
               VALUES ($1, $2, $3, NULL, '', '',
                       jsonb_build_object(
                         'chunkedUploadId', $4::text,
                         'encryptedAtRest', TRUE,
                         'attachedBy', $2,
                         'attachedAt', now()::text
                       ),
                       $5, TRUE)
               RETURNING id`,
              [galleryId, session.userId, title, fileId, i],
            );
            inserted.push(ins.rows[0].id);
          } catch (err) {
            console.warn(
              `[client-gallery] insert failed for ${fileId}:`,
              err,
            );
            skipped.push(fileId);
          }
        }

        res.json({
          success: true,
          added: inserted.length,
          skipped: skipped.length,
          imageIds: inserted,
          skippedFileIds: skipped,
        });
      } catch (err: any) {
        console.error("[client-gallery] attach-uploads failed", err);
        res.status(500).json({
          error: "attach_failed",
          message: String(err?.message || err).slice(0, 200),
        });
      }
    },
  );

  // ── Client-facing interactions ─────────────────────────────────────────
  // The gallery viewer (frontend/client/src/pages/client-gallery.tsx) has
  // been POSTing to these endpoints for a while, but they were never
  // implemented server-side — the UI mutations silently 404'd and nothing
  // persisted. The tables already exist (client_image_selections,
  // client_image_comments) so wiring them up is a simple REST surface.
  // Access is gated only by the gallery's access_token (clients don't
  // authenticate); all writes are namespaced by the gallery this token
  // resolves to.

  app.post("/api/client/gallery/:accessToken/selections", async (req, res) => {
    const accessToken = String(req.params.accessToken || "").trim();
    if (!accessToken) return res.status(400).json({ error: "missing_access_token" });
    const imageId = typeof req.body?.imageId === "string" ? req.body.imageId : null;
    const selectionType = typeof req.body?.selectionType === "string" ? req.body.selectionType : null;
    const clientEmail = typeof req.body?.clientEmail === "string" ? req.body.clientEmail : "";
    const clientNotes = typeof req.body?.clientNotes === "string" ? req.body.clientNotes : null;
    const priority = Number.isFinite(Number(req.body?.priority)) ? Number(req.body.priority) : 0;
    const allowedTypes = new Set(["favorite", "selected", "rejected", "pending"]);
    if (!imageId || !selectionType || !allowedTypes.has(selectionType)) {
      return res.status(400).json({ error: "invalid_request" });
    }
    try {
      // Slice 9.4 — password + expiration gate. Same gate semantics as
      // /images: 401 with requiresPassword=true, 410 if expired.
      const access = await gateGalleryAccess(accessToken, readGalleryPasswordHeader(req));
      if (!access.ok) {
        return res.status(access.status).json({
          error: access.error,
          ...(access.requiresPassword ? { requiresPassword: true } : {}),
        });
      }
      const gallery = await fetchClientGalleryByAccessToken(db, accessToken);
      if (!gallery) return res.status(404).json({ error: "not_found" });
      // Upsert by (gallery, image, client_email) so each repeat click just
      // toggles the row's selectionType rather than piling up duplicates.
      await pool.query(
        `INSERT INTO client_image_selections (
           gallery_id, image_id, client_email, selection_type, priority, client_notes, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (gallery_id, image_id, client_email)
         DO UPDATE SET
           selection_type = EXCLUDED.selection_type,
           priority       = EXCLUDED.priority,
           client_notes   = COALESCE(EXCLUDED.client_notes, client_image_selections.client_notes),
           updated_at     = NOW()`,
        [gallery.id, imageId, clientEmail || gallery.clientEmail, selectionType, priority, clientNotes],
      ).catch(async (err) => {
        // No unique constraint yet on (gallery_id, image_id, client_email)?
        // Fall back to a manual upsert so a fresh DB still works.
        if (String(err?.message || "").includes("ON CONFLICT")) {
          const existing = await pool.query(
            `SELECT id FROM client_image_selections
             WHERE gallery_id = $1 AND image_id = $2 AND client_email = $3 LIMIT 1`,
            [gallery.id, imageId, clientEmail || gallery.clientEmail],
          );
          if (existing.rowCount && existing.rows[0]) {
            await pool.query(
              `UPDATE client_image_selections
               SET selection_type = $1, priority = $2,
                   client_notes = COALESCE($3, client_notes), updated_at = NOW()
               WHERE id = $4`,
              [selectionType, priority, clientNotes, existing.rows[0].id],
            );
          } else {
            await pool.query(
              `INSERT INTO client_image_selections (
                 gallery_id, image_id, client_email, selection_type, priority, client_notes
               ) VALUES ($1, $2, $3, $4, $5, $6)`,
              [gallery.id, imageId, clientEmail || gallery.clientEmail, selectionType, priority, clientNotes],
            );
          }
          return;
        }
        throw err;
      });

      // Push a realtime event to the photographer's connected clients
      // (iPad + any open tabs) AND persist to the project change-log
      // so the iPad ContextPanel/timeline can surface the activity
      // even after the iPad reconnects post-outage. Both calls are
      // best-effort: a failure here mustn't block the selection save.
      if (gallery.captureSessionId && (selectionType === "favorite" || selectionType === "pending")) {
        const hearted = selectionType === "favorite";
        const timestamp = new Date().toISOString();
        try {
          broadcastUserEvent(gallery.photographerId, {
            kind: "asset.hearted",
            assetId: imageId,
            sessionId: gallery.captureSessionId,
            clientName: gallery.clientName ?? null,
            hearted,
            timestamp,
          });
        } catch (err) {
          console.warn("[client-gallery] broadcast asset.hearted failed", err);
        }
        if (gallery.projectId) {
          try {
            await recordProjectChange(pool, {
              projectId: gallery.projectId,
              kind: "asset.hearted",
              actorKind: "client",
              actorLabel: gallery.clientName ?? null,
              payload: {
                assetId: imageId,
                sessionId: gallery.captureSessionId,
                hearted,
              },
            });
          } catch (err) {
            console.warn("[project-change-log] record failed", err);
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[client-gallery] selection save failed", error);
      res.status(500).json({ error: "selection_save_failed" });
    }
  });

  app.get("/api/client/gallery/:accessToken/selections", async (req, res) => {
    const accessToken = String(req.params.accessToken || "").trim();
    if (!accessToken) return res.status(400).json({ error: "missing_access_token" });
    try {
      const access = await gateGalleryAccess(accessToken, readGalleryPasswordHeader(req));
      if (!access.ok) {
        return res.status(access.status).json({
          error: access.error,
          ...(access.requiresPassword ? { requiresPassword: true } : {}),
        });
      }
      const gallery = await fetchClientGalleryByAccessToken(db, accessToken);
      if (!gallery) return res.status(404).json({ error: "not_found" });
      const result = await pool.query(
        `SELECT id, image_id, client_email, selection_type, priority, client_notes, updated_at
         FROM client_image_selections WHERE gallery_id = $1
         ORDER BY updated_at DESC`,
        [gallery.id],
      );
      res.json({
        galleryId: gallery.id,
        selections: result.rows.map((r: any) => ({
          id: r.id,
          imageId: r.image_id,
          clientEmail: r.client_email,
          selectionType: r.selection_type,
          priority: r.priority,
          clientNotes: r.client_notes,
          updatedAt: r.updated_at,
        })),
      });
    } catch (error) {
      console.error("[client-gallery] selection list failed", error);
      res.status(500).json({ error: "selection_list_failed" });
    }
  });



  app.get("/api/client/gallery/:accessToken/video-comments", async (req, res) => {
    const accessToken = String(req.params.accessToken || "").trim();
    if (!accessToken) return res.status(400).json({ error: "missing_access_token" });
    const chapterId = typeof req.query.chapterId === 'string' ? req.query.chapterId : null;
    try {
      const access = await gateGalleryAccess(accessToken, readGalleryPasswordHeader(req));
      if (!access.ok) {
        return res.status(access.status).json({
          error: access.error,
          ...(access.requiresPassword ? { requiresPassword: true } : {}),
        });
      }
      await ensureVideoTimecodeCommentsSchema();
      const params: any[] = [access.gallery.id];
      let where = `gallery_id = $1`;
      if (chapterId) { params.push(chapterId); where += ` AND chapter_id = $${params.length}`; }
      const result = await pool.query(
        `SELECT id, chapter_id, timecode_sec, end_timecode_sec,
                category, priority, comment, client_email, client_name,
                status, resolved_at, created_at, updated_at,
                suggested_media_url, suggested_media_label,
                suggested_media_from_sec, suggested_media_to_sec,
                parent_id, author_kind
           FROM video_timecode_comments
          WHERE ${where}
          ORDER BY timecode_sec ASC, created_at ASC`,
        params,
      );
      res.json({
        galleryId: access.gallery.id,
        comments: result.rows.map((r: any) => ({
          id: r.id,
          chapterId: r.chapter_id,
          timecodeSec: Number(r.timecode_sec),
          endTimecodeSec: r.end_timecode_sec != null ? Number(r.end_timecode_sec) : null,
          category: r.category || 'other',
          priority: r.priority || 'suggestion',
          comment: r.comment,
          clientEmail: r.client_email,
          clientName: r.client_name,
          status: r.status,
          resolvedAt: r.resolved_at,
          createdAt: r.created_at,
          suggestedMediaUrl: r.suggested_media_url,
          suggestedMediaLabel: r.suggested_media_label,
          suggestedMediaFromSec: r.suggested_media_from_sec != null ? Number(r.suggested_media_from_sec) : null,
          suggestedMediaToSec: r.suggested_media_to_sec != null ? Number(r.suggested_media_to_sec) : null,
          parentId: r.parent_id,
          authorKind: r.author_kind || 'client',
        })),
      });
    } catch (e) {
      console.error("[video-comments] list failed", e);
      res.status(500).json({ error: "list_failed" });
    }
  });

  app.post("/api/client/gallery/:accessToken/video-comments", async (req, res) => {
    const accessToken = String(req.params.accessToken || "").trim();
    if (!accessToken) return res.status(400).json({ error: "missing_access_token" });
    const timecodeSec = Number(req.body?.timecodeSec);
    const endTimecodeSecRaw = req.body?.endTimecodeSec;
    const endTimecodeSec = endTimecodeSecRaw != null && Number.isFinite(Number(endTimecodeSecRaw)) && Number(endTimecodeSecRaw) > timecodeSec
      ? Number(endTimecodeSecRaw)
      : null;
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim().slice(0, 2000) : '';
    const chapterId = typeof req.body?.chapterId === 'string' ? req.body.chapterId.slice(0, 64) : null;
    const clientEmail = typeof req.body?.clientEmail === 'string' ? req.body.clientEmail.trim().toLowerCase() : '';
    const clientName = typeof req.body?.clientName === 'string' ? req.body.clientName.trim().slice(0, 255) : '';
    const categoryRaw = typeof req.body?.category === 'string' ? req.body.category.toLowerCase() : 'other';
    const category = VALID_COMMENT_CATEGORIES.has(categoryRaw) ? categoryRaw : 'other';
    const priorityRaw = typeof req.body?.priority === 'string' ? req.body.priority.toLowerCase() : 'suggestion';
    const priority = VALID_COMMENT_PRIORITIES.has(priorityRaw) ? priorityRaw : 'suggestion';
    // Slice 9X.82 — music suggestion fields
    const suggestedMediaUrl = typeof req.body?.suggestedMediaUrl === 'string'
      && /^https?:\/\//.test(req.body.suggestedMediaUrl)
        ? req.body.suggestedMediaUrl.slice(0, 1024)
        : null;
    const suggestedMediaLabel = typeof req.body?.suggestedMediaLabel === 'string'
      ? req.body.suggestedMediaLabel.trim().slice(0, 255)
      : null;
    const suggestedMediaFromSec = Number.isFinite(Number(req.body?.suggestedMediaFromSec))
      ? Math.max(0, Number(req.body.suggestedMediaFromSec))
      : null;
    const suggestedMediaToSec = Number.isFinite(Number(req.body?.suggestedMediaToSec))
      && Number(req.body.suggestedMediaToSec) > (suggestedMediaFromSec ?? 0)
        ? Number(req.body.suggestedMediaToSec)
        : null;
    // Slice 9X.86 — reply på eksisterende kommentar
    const parentIdRaw = typeof req.body?.parentId === 'string' ? req.body.parentId.trim() : null;
    if (!Number.isFinite(timecodeSec) || timecodeSec < 0) return res.status(400).json({ error: "invalid_timecode" });
    if (!comment) return res.status(400).json({ error: "comment_required" });
    if (!clientEmail) return res.status(400).json({ error: "client_email_required" });
    try {
      const access = await gateGalleryAccess(accessToken, readGalleryPasswordHeader(req));
      if (!access.ok) {
        return res.status(access.status).json({
          error: access.error,
          ...(access.requiresPassword ? { requiresPassword: true } : {}),
        });
      }
      await ensureVideoTimecodeCommentsSchema();
      let parentId: string | null = null;
      if (parentIdRaw) {
        const p = await pool.query(
          `SELECT id FROM video_timecode_comments WHERE id = $1 AND gallery_id = $2 LIMIT 1`,
          [parentIdRaw, access.gallery.id],
        );
        if (p.rowCount === 0) return res.status(400).json({ error: "invalid_parent" });
        parentId = parentIdRaw;
      }
      const inserted = await pool.query(
        `INSERT INTO video_timecode_comments
           (gallery_id, chapter_id, timecode_sec, end_timecode_sec,
            category, priority, comment, client_email, client_name,
            suggested_media_url, suggested_media_label,
            suggested_media_from_sec, suggested_media_to_sec,
            parent_id, author_kind)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'client')
         RETURNING id, created_at`,
        [access.gallery.id, chapterId, timecodeSec, endTimecodeSec,
         category, priority, comment, clientEmail, clientName || null,
         suggestedMediaUrl, suggestedMediaLabel,
         suggestedMediaFromSec, suggestedMediaToSec, parentId],
      );

      // Broadcast realtime så Bjarne ser kommentaren umiddelbart i sitt admin-view
      try {
        const ownerRow = await pool.query(
          `SELECT photographer_id FROM photographer_client_galleries WHERE id = $1 LIMIT 1`,
          [access.gallery.id],
        );
        const photographerId = ownerRow.rows[0]?.photographer_id;
        if (photographerId) {
          broadcastUserEvent(photographerId, {
            kind: "video.comment-added",
            galleryId: access.gallery.id,
            chapterId,
            timecodeSec,
            commentId: inserted.rows[0].id,
            clientLabel: clientName || clientEmail || null,
            category,
            priority,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (e: any) {
        console.warn('[video-comments] broadcast failed:', e.message);
      }

      res.status(201).json({
        success: true,
        id: inserted.rows[0].id,
        createdAt: inserted.rows[0].created_at,
      });
    } catch (e) {
      console.error("[video-comments] create failed", e);
      res.status(500).json({ error: "create_failed" });
    }
  });

  // Slice 9X.82 — Klient submitter sitt endelig utvalg. Låser favoritt-listen
  // for klient (submitted_at != NULL) og sender e-post-varsel til fotograf
  // med curated summary. Bygger på eksisterende client_image_selections.
  app.post("/api/client/gallery/:accessToken/selections/submit", async (req, res) => {
    const accessToken = String(req.params.accessToken || "").trim();
    if (!accessToken) return res.status(400).json({ error: "missing_access_token" });
    const clientEmail = typeof req.body?.clientEmail === "string" ? req.body.clientEmail.trim().toLowerCase() : "";
    const clientName = typeof req.body?.clientName === "string" ? req.body.clientName.trim() : "";
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 1000) : "";
    if (!clientEmail) return res.status(400).json({ error: "missing_client_email" });

    try {
      const access = await gateGalleryAccess(accessToken, readGalleryPasswordHeader(req));
      if (!access.ok) {
        return res.status(access.status).json({
          error: access.error,
          ...(access.requiresPassword ? { requiresPassword: true } : {}),
        });
      }
      const gallery = await fetchClientGalleryByAccessToken(db, accessToken);
      if (!gallery) return res.status(404).json({ error: "not_found" });

      // Forsikre at submitted_at-kolonnen finnes (idempotent — migration 157 også gjør det)
      try {
        await pool.query(
          `ALTER TABLE client_image_selections
             ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
             ADD COLUMN IF NOT EXISTS submission_note TEXT`,
        );
      } catch { /* ignore — kolonner kan allerede finnes */ }

      // Hent favoritt-utvalget før vi låser, så vi kan inkludere i e-post
      const favs = await pool.query(
        `SELECT image_id, priority, client_notes
           FROM client_image_selections
          WHERE gallery_id = $1
            AND client_email = $2
            AND selection_type IN ('favorite', 'selected')
            AND submitted_at IS NULL
          ORDER BY priority DESC NULLS LAST, updated_at ASC`,
        [gallery.id, clientEmail],
      );
      const favCount = favs.rowCount || 0;
      if (favCount === 0) {
        return res.status(400).json({ error: "no_favorites_to_submit", message: "Velg minst ett bilde før du sender utvalget." });
      }

      // Lås alle nye favoritter til denne klienten
      await pool.query(
        `UPDATE client_image_selections
            SET submitted_at = NOW(),
                submission_note = COALESCE($3, submission_note)
          WHERE gallery_id = $1
            AND client_email = $2
            AND submitted_at IS NULL`,
        [gallery.id, clientEmail, note || null],
      );

      // Best-effort: send e-post til fotograf. Vi vil ikke at en e-post-feil
      // skal hindre at klientens utvalg blir registrert som submitted.
      void (async () => {
        try {
          const photographerEmail = (gallery as any).photographerEmail
            || (await pool.query(
              `SELECT email FROM users WHERE id = $1 LIMIT 1`,
              [gallery.photographerId],
            )).rows[0]?.email;
          if (!photographerEmail) return;

          const { sendEmail } = await import('./casting-reminder-sender.js').catch(() => ({ sendEmail: null as any }));
          if (!sendEmail) return;

          const subject = `${clientName || clientEmail} har sendt sitt utvalg (${favCount} bilder)`;
          const galleryUrl = `${(process.env.PUBLIC_APP_URL || 'https://creatorhubn.com').replace(/\/$/, '')}/photographer/galleries/${gallery.id}`;
          const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 580px; margin: 0 auto; padding: 24px;">
              <h2 style="font-family: Georgia, serif; font-weight: 400; font-size: 28px; color: #0b1020; margin: 0 0 8px;">
                ${clientName || clientEmail} har valgt
              </h2>
              <p style="font-size: 14px; color: #5b6478; margin: 0 0 24px;">
                ${favCount} ${favCount === 1 ? 'bilde' : 'bilder'} fra galleriet "${gallery.projectTitle}"
              </p>
              ${note ? `
                <div style="background: #f7f9fc; border-left: 3px solid #ffba6c; padding: 16px; margin: 16px 0; font-style: italic; color: #2a2f3a;">
                  "${note.replace(/</g, '&lt;')}"
                </div>
              ` : ''}
              <a href="${galleryUrl}" style="display: inline-block; background: #0b1020; color: #fff; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-weight: 600; margin-top: 16px;">
                Se klientens utvalg
              </a>
              <p style="font-size: 12px; color: #98a0b3; margin: 32px 0 0;">
                CreatorHub · Du mottar dette fordi en klient sendte inn et galleri-utvalg.
              </p>
            </div>
          `;
          await sendEmail({
            to: photographerEmail,
            subject,
            html,
            fromName: 'CreatorHub',
          });
        } catch (e: any) {
          console.warn('[gallery-selection-submit] email failed:', e.message);
        }
      })();

      // Broadcast realtime så Stine ser submission i admin-portalen umiddelbart
      try {
        broadcastUserEvent(gallery.photographerId, {
          kind: "gallery.selection-submitted",
          galleryId: gallery.id,
          clientEmail,
          clientName: clientName || gallery.clientName || null,
          selectedCount: favCount,
          submissionNote: note || null,
          timestamp: new Date().toISOString(),
        });
      } catch { /* best-effort */ }

      res.json({ success: true, favoriteCount: favCount, submittedAt: new Date().toISOString() });
    } catch (error) {
      console.error("[client-gallery] selection submit failed", error);
      res.status(500).json({ error: "selection_submit_failed" });
    }
  });

  app.post("/api/client/gallery/:accessToken/comments", async (req, res) => {
    const accessToken = String(req.params.accessToken || "").trim();
    if (!accessToken) return res.status(400).json({ error: "missing_access_token" });
    const imageId = typeof req.body?.imageId === "string" ? req.body.imageId : null;
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";
    const clientName = typeof req.body?.clientName === "string" ? req.body.clientName : "";
    const clientEmail = typeof req.body?.clientEmail === "string" ? req.body.clientEmail : "";
    const commentType = typeof req.body?.commentType === "string" ? req.body.commentType : "general";
    if (!imageId || !comment) {
      return res.status(400).json({ error: "invalid_request" });
    }
    if (comment.length > 2000) {
      return res.status(400).json({ error: "comment_too_long" });
    }
    try {
      const access = await gateGalleryAccess(accessToken, readGalleryPasswordHeader(req));
      if (!access.ok) {
        return res.status(access.status).json({
          error: access.error,
          ...(access.requiresPassword ? { requiresPassword: true } : {}),
        });
      }
      const gallery = await fetchClientGalleryByAccessToken(db, accessToken);
      if (!gallery) return res.status(404).json({ error: "not_found" });
      const result = await pool.query(
        `INSERT INTO client_image_comments (
           gallery_id, image_id, client_name, client_email, comment, comment_type, status, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, 'open', NOW(), NOW())
         RETURNING id, created_at`,
        [
          gallery.id,
          imageId,
          clientName || gallery.clientName,
          clientEmail || gallery.clientEmail,
          comment,
          commentType,
        ],
      );
      const row = result.rows[0];
      res.json({
        success: true,
        comment: {
          id: row?.id,
          imageId,
          comment,
          commentType,
          createdAt: row?.created_at,
        },
      });

      // Slice 9.6 — fire-and-forget photographer notification. Spawns
      // a microtask AFTER res.json so the client never waits on SMTP.
      setImmediate(() => {
        void dispatchGalleryNotification('comment_created', gallery.photographerId, {
          galleryId: gallery.id,
          galleryTitle: gallery.projectTitle ?? null,
          shareUrl: buildGalleryShareUrl(accessToken),
          clientName: clientName || gallery.clientName || 'Klient',
          clientEmail: clientEmail || gallery.clientEmail || '',
          details: { comment, imageId, commentType },
        });
      });
      recordAnalyticsEvent('comment.created', {
        entityType: 'gallery',
        entityId: gallery.id,
        actorUserId: gallery.photographerId,
        metadata: {
          imageId: imageId ?? null,
          commentType,
          clientEmail: clientEmail || gallery.clientEmail || null,
        },
      });
    } catch (error) {
      console.error("[client-gallery] comment save failed", error);
      res.status(500).json({ error: "comment_save_failed" });
    }
  });

  app.get("/api/client/gallery/:accessToken/comments", async (req, res) => {
    const accessToken = String(req.params.accessToken || "").trim();
    if (!accessToken) return res.status(400).json({ error: "missing_access_token" });
    const imageId = typeof req.query?.imageId === "string" ? req.query.imageId : null;
    try {
      const access = await gateGalleryAccess(accessToken, readGalleryPasswordHeader(req));
      if (!access.ok) {
        return res.status(access.status).json({
          error: access.error,
          ...(access.requiresPassword ? { requiresPassword: true } : {}),
        });
      }
      const gallery = await fetchClientGalleryByAccessToken(db, accessToken);
      if (!gallery) return res.status(404).json({ error: "not_found" });
      const params: any[] = [gallery.id];
      let query = `SELECT id, image_id, client_name, comment, comment_type, status,
                          photographer_response, responded_at, created_at, updated_at
                   FROM client_image_comments WHERE gallery_id = $1`;
      if (imageId) {
        params.push(imageId);
        query += ` AND image_id = $${params.length}`;
      }
      query += ` ORDER BY created_at DESC LIMIT 500`;
      const result = await pool.query(query, params);
      res.json({
        galleryId: gallery.id,
        comments: result.rows.map((r: any) => ({
          id: r.id,
          imageId: r.image_id,
          clientName: r.client_name,
          comment: r.comment,
          commentType: r.comment_type,
          status: r.status,
          photographerResponse: r.photographer_response,
          respondedAt: r.responded_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      });
    } catch (error) {
      console.error("[client-gallery] comment list failed", error);
      res.status(500).json({ error: "comment_list_failed" });
    }
  });

  // ── Slice 9D — photographer-side gallery management ────────────────────
  // Backs UniversalDashboard + ShowcaseAdmin + AdministrationHub.
  // Without these, the photographer can only manage galleries via direct
  // DB writes; with them, the dashboard can list, create, configure, and
  // surface activity. All routes auth-gated via requireUserSession;
  // per-row ownership enforced by photographerId match.

  function requireUserSession(
    req: express.Request,
    res: express.Response,
  ): { userId: string; email: string; name: string; role: string } | null {
    const session = getActiveSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    return session;
  }

  // ── Slice 10.1 — Stripe payment intent for client checkout ─────────────
  // The viewer flips to checkout when submit-selection returns
  // requiresPayment=true. This route creates the PaymentIntent + records
  // the pending row in client_image_payments. Stripe webhook (Slice 10.2,
  // added to the existing CreatorHub webhook switch) flips the row to
  // 'succeeded' on confirmation. Re-submitting a selection issues a new
  // intent — the prior pending row stays for audit but only the latest
  // 'succeeded' counts when /download-zip checks payment status.
  //
  // Body: { selectedImageIds, clientEmail }
  // Returns: { clientSecret, paymentIntentId, pricing } or 4xx.
  app.post("/api/client/gallery/:accessToken/create-payment-intent", async (req, res) => {
    const accessToken = String(req.params.accessToken || "").trim();
    if (!accessToken) return res.status(400).json({ error: "missing_access_token" });
    const clientEmail = typeof req.body?.clientEmail === 'string' ? req.body.clientEmail.trim() : '';
    const selectedImageIds = Array.isArray(req.body?.selectedImageIds)
      ? req.body.selectedImageIds.filter((s: unknown): s is string => typeof s === 'string')
      : null;
    if (!selectedImageIds || selectedImageIds.length === 0) {
      return res.status(400).json({ error: "selectedImageIds_required" });
    }
    try {
      const access = await gateGalleryAccess(accessToken, readGalleryPasswordHeader(req));
      if (!access.ok) {
        return res.status(access.status).json({
          error: access.error,
          ...(access.requiresPassword ? { requiresPassword: true } : {}),
        });
      }
      const gallery = access.gallery;
      const effectiveEmail = clientEmail || gallery.clientEmail;
      if (!effectiveEmail) return res.status(400).json({ error: "client_email_required" });

      const pricing = calculateGalleryPricing(access.settings, selectedImageIds.length);
      if (pricing.totalAmount <= 0) {
        return res.status(400).json({ error: "no_payment_needed", pricing });
      }

      const stripe = getCreatorHubStripeClient();
      if (!stripe) {
        return res.status(503).json({ error: "stripe_not_configured" });
      }

      // Stripe wants amount in the smallest currency unit. NOK + most
      // EUR are 100 cents/øre per unit.
      const amount = Math.round(pricing.totalAmount * 100);

      const intent = await stripe.paymentIntents.create({
        amount,
        currency: pricing.currency.toLowerCase(),
        receipt_email: effectiveEmail,
        // Metadata feeds the webhook handler — without galleryId it
        // can't associate the success event with the right row.
        metadata: {
          galleryId: gallery.id,
          clientEmail: effectiveEmail,
          extraImages: String(pricing.extraImages),
          accessToken: accessToken.slice(0, 32), // truncated for log readability
        },
        description: `CreatorHub klient-galleri ekstra-bilder (${pricing.extraImages} stk)`,
        automatic_payment_methods: { enabled: true },
      });

      // Insert pending payment row. Webhook flips status to 'succeeded'
      // and stamps download_token on confirmation.
      await pool.query(
        `INSERT INTO client_image_payments
           (gallery_id, client_email, stripe_payment_intent_id, total_amount,
            currency, additional_images, selected_image_ids, payment_status,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW(), NOW())`,
        [
          gallery.id,
          effectiveEmail,
          intent.id,
          pricing.totalAmount,
          pricing.currency,
          pricing.extraImages,
          JSON.stringify(selectedImageIds),
        ],
      );

      res.json({
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        pricing,
      });
    } catch (error) {
      console.error("[client-gallery] create-payment-intent failed", error);
      res.status(500).json({ error: "create_payment_intent_failed" });
    }
  });

  // Slice 10.3 — Stripe Checkout Session for klient-galleri ekstra-bilder.
  // Bruker Stripe-hostet checkout-side i stedet for å bygge Elements-UI
  // fra grunnen av. Fordel: ingen @stripe/stripe-js-dep i frontend, full
  // PCI-compliance håndtert av Stripe, 3DS-flyt automatisk. Ulempe:
  // klient redirectes ut av galleriet og tilbake (success_url = samme
  // gallery-token).
  app.post("/api/client/gallery/:accessToken/create-checkout-session", async (req, res) => {
    const accessToken = String(req.params.accessToken || "").trim();
    if (!accessToken) return res.status(400).json({ error: "missing_access_token" });
    const clientEmail = typeof req.body?.clientEmail === 'string' ? req.body.clientEmail.trim() : '';
    const selectedImageIds = Array.isArray(req.body?.selectedImageIds)
      ? req.body.selectedImageIds.filter((s: unknown): s is string => typeof s === 'string')
      : null;
    if (!selectedImageIds || selectedImageIds.length === 0) {
      return res.status(400).json({ error: "selectedImageIds_required" });
    }
    try {
      const access = await gateGalleryAccess(accessToken, readGalleryPasswordHeader(req));
      if (!access.ok) {
        return res.status(access.status).json({
          error: access.error,
          ...(access.requiresPassword ? { requiresPassword: true } : {}),
        });
      }
      const gallery = access.gallery;
      const effectiveEmail = clientEmail || gallery.clientEmail;
      if (!effectiveEmail) return res.status(400).json({ error: "client_email_required" });

      const pricing = calculateGalleryPricing(access.settings, selectedImageIds.length);
      if (pricing.totalAmount <= 0) {
        return res.status(400).json({ error: "no_payment_needed", pricing });
      }

      const stripe = getCreatorHubStripeClient();
      if (!stripe) return res.status(503).json({ error: "stripe_not_configured" });

      const amount = Math.round(pricing.totalAmount * 100);
      const publicHost = (process.env.CREATORHUB_PUBLIC_URL ?? 'https://app.creatorhubn.com').replace(/\/$/, '');
      const successUrl = `${publicHost}/client/gallery/${accessToken}?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${publicHost}/client/gallery/${accessToken}?checkout=cancelled`;

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            quantity: pricing.extraImages,
            price_data: {
              currency: pricing.currency.toLowerCase(),
              unit_amount: Math.round(pricing.pricePerImage * 100),
              product_data: {
                name: `Ekstra bilde — ${(access.settings.projectTitle as string | undefined) ?? 'klient-galleri'}`,
                description: `${pricing.extraImages} bilder utover inkluderte. Total: ${pricing.totalAmount.toFixed(2)} ${pricing.currency}`,
              },
            },
          },
        ],
        customer_email: effectiveEmail,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          galleryId: gallery.id,
          clientEmail: effectiveEmail,
          extraImages: String(pricing.extraImages),
          accessToken: accessToken.slice(0, 32),
        },
        payment_intent_data: {
          // Mirror metadata på PaymentIntent slik at den eksisterende
          // payment_intent.succeeded-webhook (Slice 10.2) finner
          // galleryId og kan stempe ned download_token.
          metadata: {
            galleryId: gallery.id,
            clientEmail: effectiveEmail,
            extraImages: String(pricing.extraImages),
            accessToken: accessToken.slice(0, 32),
          },
          receipt_email: effectiveEmail,
          description: `CreatorHub klient-galleri ekstra-bilder (${pricing.extraImages} stk)`,
        },
      });

      // Insert pending row så webhook har noe å oppdatere.
      await pool.query(
        `INSERT INTO client_image_payments
           (gallery_id, client_email, stripe_payment_intent_id, total_amount,
            currency, additional_images, selected_image_ids, payment_status,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW(), NOW())`,
        [
          gallery.id,
          effectiveEmail,
          session.payment_intent as string,
          pricing.totalAmount,
          pricing.currency,
          pricing.extraImages,
          JSON.stringify(selectedImageIds),
        ],
      );

      res.json({
        sessionId: session.id,
        checkoutUrl: session.url,
        pricing,
      });
    } catch (error) {
      console.error("[client-gallery] create-checkout-session failed", error);
      res.status(500).json({
        error: "create_checkout_session_failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });
  // Public — klient ser tilgjengelige prints for sitt galleri
  app.get("/api/client/gallery/:accessToken/print-products", async (req, res) => {
    const accessToken = String(req.params.accessToken || "").trim();
    if (!accessToken) return res.status(400).json({ error: "missing_access_token" });
    try {
      const access = await gateGalleryAccess(accessToken, readGalleryPasswordHeader(req));
      if (!access.ok) {
        return res.status(access.status).json({
          error: access.error,
          ...(access.requiresPassword ? { requiresPassword: true } : {}),
        });
      }
      await ensurePrintStoreSchema();
      const galleryRow = await pool.query(
        `SELECT photographer_id FROM photographer_client_galleries WHERE id = $1 LIMIT 1`,
        [access.gallery.id],
      );
      const photographerId = galleryRow.rows[0]?.photographer_id;
      if (!photographerId) return res.json({ products: [] });
      const result = await pool.query(
        `SELECT id, name, description, size_label, material, unit_price, currency, sort_order
         FROM print_products
         WHERE photographer_id = $1 AND is_active = true
         ORDER BY sort_order ASC, created_at DESC`,
        [photographerId],
      );
      res.json({
        products: result.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          name: r.name,
          description: r.description ?? '',
          sizeLabel: r.size_label ?? '',
          material: r.material ?? '',
          unitPrice: Number(r.unit_price),
          currency: r.currency,
        })),
      });
    } catch (err) {
      console.warn('[print-store] public list failed:', err);
      res.json({ products: [] });
    }
  });

  // Klient bestiller prints — oppretter ordre + Stripe Checkout-session.
  // Webhook handler nedenfor stempler payment_status='succeeded' og fyrer
  // fulfillment-event til fotograf.
  app.post("/api/client/gallery/:accessToken/print-order", async (req, res) => {
    const accessToken = String(req.params.accessToken || "").trim();
    if (!accessToken) return res.status(400).json({ error: "missing_access_token" });
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    const shippingAddress = req.body?.shippingAddress ?? null;
    const clientEmail = typeof req.body?.clientEmail === 'string' ? req.body.clientEmail.trim() : '';
    const clientName = typeof req.body?.clientName === 'string' ? req.body.clientName.trim() : '';
    if (!items || items.length === 0) {
      return res.status(400).json({ error: "items_required" });
    }
    try {
      const access = await gateGalleryAccess(accessToken, readGalleryPasswordHeader(req));
      if (!access.ok) {
        return res.status(access.status).json({
          error: access.error,
          ...(access.requiresPassword ? { requiresPassword: true } : {}),
        });
      }
      await ensurePrintStoreSchema();
      const galleryRow = await pool.query(
        `SELECT photographer_id FROM photographer_client_galleries WHERE id = $1 LIMIT 1`,
        [access.gallery.id],
      );
      const photographerId = galleryRow.rows[0]?.photographer_id;
      if (!photographerId) return res.status(404).json({ error: 'gallery_owner_not_found' });

      // Resolve product prices server-side så klient ikke kan
      // manipulere unit_price på vei inn.
      const productIds = items.map((i: Record<string, unknown>) => String(i.productId));
      const productRows = await pool.query(
        `SELECT id, name, unit_price, currency FROM print_products
         WHERE id = ANY($1::uuid[]) AND photographer_id = $2 AND is_active = true`,
        [productIds, photographerId],
      );
      const productMap = new Map<string, { name: string; unitPrice: number; currency: string }>();
      for (const r of productRows.rows) {
        productMap.set(String(r.id), {
          name: r.name,
          unitPrice: Number(r.unit_price),
          currency: r.currency,
        });
      }
      let total = 0;
      let currency = 'NOK';
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
      for (const item of items as Array<Record<string, unknown>>) {
        const pid = String(item.productId);
        const product = productMap.get(pid);
        if (!product) continue;
        const qty = Math.max(1, Math.min(99, Number(item.quantity) || 1));
        total += product.unitPrice * qty;
        currency = product.currency;
        lineItems.push({
          quantity: qty,
          price_data: {
            currency: product.currency.toLowerCase(),
            unit_amount: Math.round(product.unitPrice * 100),
            product_data: {
              name: product.name,
              description: item.imageId ? `Bilde-id: ${String(item.imageId).slice(0, 16)}` : undefined,
            },
          },
        });
      }
      if (lineItems.length === 0) {
        return res.status(400).json({ error: 'no_valid_items' });
      }

      const effectiveEmail = clientEmail || access.gallery.clientEmail;
      if (!effectiveEmail) return res.status(400).json({ error: 'client_email_required' });

      const stripe = getCreatorHubStripeClient();
      if (!stripe) return res.status(503).json({ error: 'stripe_not_configured' });

      const publicHost = (process.env.CREATORHUB_PUBLIC_URL ?? 'https://app.creatorhubn.com').replace(/\/$/, '');
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: lineItems,
        customer_email: effectiveEmail,
        shipping_address_collection: { allowed_countries: ['NO', 'SE', 'DK', 'FI', 'IS'] },
        success_url: `${publicHost}/client/gallery/${accessToken}?print=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${publicHost}/client/gallery/${accessToken}?print=cancelled`,
        metadata: {
          kind: 'print_order',
          galleryId: access.gallery.id,
          photographerId,
          accessToken: accessToken.slice(0, 32),
        },
        payment_intent_data: {
          metadata: {
            kind: 'print_order',
            galleryId: access.gallery.id,
            photographerId,
            accessToken: accessToken.slice(0, 32),
          },
          receipt_email: effectiveEmail,
          description: `CreatorHub print-bestilling — ${lineItems.length} produkter`,
        },
      });

      // Insert pending ordre + items. Slice 9X.8.C — sett canonical_client_id.
      const canonicalClientId = await ensureCanonicalClientId(photographerId, effectiveEmail, clientName ?? null);
      const orderResult = await pool.query(
        `INSERT INTO print_orders
           (gallery_id, photographer_id, client_email, client_name, shipping_address,
            stripe_payment_intent_id, stripe_session_id, total_amount, currency,
            payment_status, fulfillment_status, canonical_client_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', 'pending', $10)
         RETURNING id`,
        [
          access.gallery.id,
          photographerId,
          effectiveEmail,
          clientName || null,
          shippingAddress ? JSON.stringify(shippingAddress) : null,
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
          session.id,
          total,
          currency,
          canonicalClientId,
        ],
      );
      const orderId = orderResult.rows[0].id;
      for (const item of items as Array<Record<string, unknown>>) {
        const pid = String(item.productId);
        const product = productMap.get(pid);
        if (!product) continue;
        await pool.query(
          `INSERT INTO print_order_items (order_id, product_id, image_id, quantity, unit_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            orderId,
            pid,
            item.imageId ? String(item.imageId) : null,
            Math.max(1, Math.min(99, Number(item.quantity) || 1)),
            product.unitPrice,
          ],
        );
      }

      recordAnalyticsEvent('print_order.created', {
        entityType: 'print_order',
        entityId: orderId,
        actorUserId: photographerId,
        metadata: {
          galleryId: access.gallery.id,
          clientEmail: effectiveEmail,
          itemCount: lineItems.length,
          totalAmount: total,
          currency,
        },
      });

      res.json({
        orderId,
        sessionId: session.id,
        checkoutUrl: session.url,
        total,
        currency,
      });
    } catch (err) {
      console.error('[print-store] create order failed:', err);
      res.status(500).json({
        error: 'create_order_failed',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post("/api/client/gallery/:accessToken/calculate-pricing", async (req, res) => {
    const accessToken = String(req.params.accessToken || "").trim();
    if (!accessToken) return res.status(400).json({ error: "missing_access_token" });
    const selectedImageIds = Array.isArray(req.body?.selectedImageIds)
      ? req.body.selectedImageIds.filter((s: unknown): s is string => typeof s === 'string')
      : null;
    if (!selectedImageIds) {
      return res.status(400).json({ error: "selectedImageIds_required" });
    }
    try {
      const access = await gateGalleryAccess(accessToken, readGalleryPasswordHeader(req));
      if (!access.ok) {
        return res.status(access.status).json({
          error: access.error,
          ...(access.requiresPassword ? { requiresPassword: true } : {}),
        });
      }
      const pricing = calculateGalleryPricing(access.settings, selectedImageIds.length);
      res.json({ pricing });
    } catch (error) {
      console.error("[client-gallery] calculate-pricing failed", error);
      res.status(500).json({ error: "calculate_pricing_failed" });
    }
  });

  app.post("/api/client/gallery/:accessToken/submit-selection", async (req, res) => {
    const accessToken = String(req.params.accessToken || "").trim();
    if (!accessToken) return res.status(400).json({ error: "missing_access_token" });
    const clientEmail = typeof req.body?.clientEmail === 'string' ? req.body.clientEmail.trim() : '';
    const selectedImageIds = Array.isArray(req.body?.selectedImageIds)
      ? req.body.selectedImageIds.filter((s: unknown): s is string => typeof s === 'string')
      : null;
    if (!selectedImageIds || selectedImageIds.length === 0) {
      return res.status(400).json({ error: "selectedImageIds_required" });
    }
    try {
      const access = await gateGalleryAccess(accessToken, readGalleryPasswordHeader(req));
      if (!access.ok) {
        return res.status(access.status).json({
          error: access.error,
          ...(access.requiresPassword ? { requiresPassword: true } : {}),
        });
      }
      const gallery = access.gallery;
      const effectiveEmail = clientEmail || gallery.clientEmail;
      if (!effectiveEmail) return res.status(400).json({ error: "client_email_required" });

      // Re-derive pricing server-side — never trust client-supplied total.
      const pricing = calculateGalleryPricing(access.settings, selectedImageIds.length);

      // Persist selections in one batch. Replace any stale 'selected' rows
      // for this client by setting them to 'rejected' first, then upserting
      // the chosen ids as 'selected'. Future Slice 10 download/checkout
      // gating reads from these rows.
      await pool.query('BEGIN');
      try {
        // Demote any 'selected' rows for this client+gallery that aren't
        // in the new selection list (they got unticked).
        await pool.query(
          `UPDATE client_image_selections
           SET selection_type = 'rejected', updated_at = NOW()
           WHERE gallery_id = $1
             AND client_email = $2
             AND selection_type = 'selected'
             AND NOT (image_id = ANY($3::uuid[]))`,
          [gallery.id, effectiveEmail, selectedImageIds],
        );
        // Upsert the new selection set.
        for (const imageId of selectedImageIds) {
          await pool.query(
            `INSERT INTO client_image_selections
               (gallery_id, image_id, client_email, selection_type, created_at, updated_at)
             VALUES ($1, $2, $3, 'selected', NOW(), NOW())
             ON CONFLICT (gallery_id, image_id, client_email)
             DO UPDATE SET selection_type = 'selected', updated_at = NOW()`,
            [gallery.id, imageId, effectiveEmail],
          );
        }
        await pool.query('COMMIT');
      } catch (err) {
        await pool.query('ROLLBACK');
        throw err;
      }

      res.json({
        ok: true,
        pricing,
        requiresPayment: pricing.totalAmount > 0,
        // Stripe payment intent comes from Slice 10's create-payment-intent
        // route — surfaced as a separate call so that endpoint owns the
        // Stripe API call + idempotency key handling.
      });

      // Slice 9.6 — fire-and-forget photographer notification with the
      // pricing snapshot baked into the email so Daniel knows whether
      // checkout still needs to happen. Same fire-and-forget posture as
      // the comment dispatcher — never blocks the client's POST.
      setImmediate(async () => {
        try {
          const photographerRow = await pool.query(
            `SELECT photographer_id, project_title, client_name, client_email
             FROM photographer_client_galleries WHERE id = $1 LIMIT 1`,
            [gallery.id],
          );
          const row = photographerRow.rows[0];
          if (!row?.photographer_id) return;
          void dispatchGalleryNotification('selection_submitted', row.photographer_id, {
            galleryId: gallery.id,
            galleryTitle: row.project_title ?? null,
            shareUrl: buildGalleryShareUrl(accessToken),
            clientName: row.client_name || effectiveEmail.split('@')[0] || 'Klient',
            clientEmail: effectiveEmail,
            details: {
              selectedCount: selectedImageIds.length,
              totalAmount: pricing.totalAmount,
              currency: pricing.currency,
              requiresPayment: pricing.totalAmount > 0,
            },
          });
        } catch (err) {
          console.warn('[gallery-notify] selection_submitted dispatch failed:', err);
        }
      });
      recordAnalyticsEvent('selection.submitted', {
        entityType: 'gallery',
        entityId: gallery.id,
        actorUserId: null,
        metadata: {
          selectedCount: selectedImageIds.length,
          totalAmount: pricing.totalAmount,
          currency: pricing.currency,
          requiresPayment: pricing.totalAmount > 0,
          clientEmail: effectiveEmail,
        },
      });
    } catch (error) {
      console.error("[client-gallery] submit-selection failed", error);
      res.status(500).json({ error: "submit_selection_failed" });
    }
  });
  // Body: { imageIds: string[], clientEmail?: string }
  // Returns: streamed ZIP, or 4xx on validation failures.
  app.post("/api/client/gallery/:accessToken/download-zip", async (req, res) => {
    const accessToken = String(req.params.accessToken || "").trim();
    if (!accessToken) return res.status(400).json({ error: "missing_access_token" });
    const imageIds = Array.isArray(req.body?.imageIds)
      ? req.body.imageIds.filter((s: unknown): s is string => typeof s === 'string')
      : null;
    if (!imageIds || imageIds.length === 0) {
      return res.status(400).json({ error: "imageIds_required" });
    }
    if (imageIds.length > 1000) {
      // Defence-in-depth: huge zips are slow + Render request timeouts
      // hit. Photographers will rarely deliver more than a few hundred.
      return res.status(413).json({ error: "too_many_images", max: 1000 });
    }

    try {
      const access = await gateGalleryAccess(accessToken, readGalleryPasswordHeader(req));
      if (!access.ok) {
        return res.status(access.status).json({
          error: access.error,
          ...(access.requiresPassword ? { requiresPassword: true } : {}),
        });
      }
      const gallery = access.gallery;
      const settings = access.settings;
      if (settings.allowDownload === false) {
        return res.status(403).json({ error: "download_disabled" });
      }

      // Slice 9X.11 — kontrakt-gate. Hvis galleriet er linket til en
      // kontrakt, sjekk signature_status før vi serverer noe.
      const contractCheck = await checkContractSignature(gallery.contractId);
      if (!contractCheck.ok) {
        return res.status(contractCheck.status).json({
          error: contractCheck.error,
          ...(contractCheck.signatureStatus ? { signatureStatus: contractCheck.signatureStatus } : {}),
          message: contractCheck.error === 'contract_not_signed'
            ? 'Kontrakten må signeres av begge parter før nedlasting tillates.'
            : 'Kontrakt-status hindrer nedlasting.',
        });
      }

      const clientEmail = typeof req.body?.clientEmail === 'string'
        ? req.body.clientEmail.trim()
        : gallery.clientEmail;

      // Slice 9X.11 — count-gate mot contractedImages. Tell HVOR MANGE
      // UNIKE bilder denne klienten allerede har lastet ned, og blokker
      // hvis denne batchen ville overskredet contracted limit. Klienten
      // får tilbake hvor mange "slots" de har igjen så frontend kan
      // vise klar feilmelding ("Du har 50 av 50 brukt — kontakt fotograf").
      const contractedImages = Math.max(0, Number(settings.contractedImages) || 0);
      if (contractedImages > 0) {
        const alreadyUsed = await countUniqueDownloadedImages(gallery.id, clientEmail);
        // Tell kun NYE bilder mot limiten (re-download av samme bilde gratis).
        const newImageIds = imageIds.filter(async () => true); // initial — we filter properly inside loop later
        // Faster path: hent allerede-nedlastede image-ids
        const previouslyDownloaded = await pool.query(
          `SELECT DISTINCT image_id::text AS image_id
             FROM gallery_download_audit
            WHERE gallery_id = $1 AND client_email = $2`,
          [gallery.id, clientEmail],
        );
        const alreadyDownloadedSet = new Set(
          previouslyDownloaded.rows.map((r: Record<string, unknown>) => String(r.image_id)),
        );
        const trulyNew = imageIds.filter((id: string) => !alreadyDownloadedSet.has(id));
        const wouldUse = alreadyUsed + trulyNew.length;
        if (wouldUse > contractedImages) {
          return res.status(403).json({
            error: 'contracted_limit_exceeded',
            message: `Kontrakten dekker ${contractedImages} bilder. Du har allerede lastet ned ${alreadyUsed} — denne batchen ville økt totalen til ${wouldUse}. Kontakt fotografen for å utvide leveransen.`,
            contractedImages,
            alreadyDownloaded: alreadyUsed,
            requested: imageIds.length,
            alreadyHadInBatch: imageIds.length - trulyNew.length,
            wouldUse,
            remaining: Math.max(0, contractedImages - alreadyUsed),
          });
        }
      }

      // Payment-gate (samme som før). Pricing-modellen kicker in når
      // selectedCount > contractedImages — så denne sjekken er primært
      // for galleries UTEN contracted-limit (rene per-image-pakker).
      const pricing = calculateGalleryPricing(settings, imageIds.length);
      if (pricing.totalAmount > 0) {
        const paid = await pool.query(
          `SELECT 1 FROM client_image_payments
           WHERE gallery_id = $1
             AND client_email = $2
             AND payment_status = 'succeeded'
           LIMIT 1`,
          [gallery.id, clientEmail],
        );
        if (paid.rowCount === 0) {
          return res.status(402).json({
            error: "payment_required",
            pricing,
          });
        }
      }

      // Resolve image URLs the same way listClientGalleryImages does so
      // the zip contents match what the viewer is showing. This re-signs
      // each capture-sourced image's R2 key fresh — the caller doesn't
      // need to pre-pass URLs (which could go stale anyway).
      const allImages = await listClientGalleryImages(db, gallery.id);
      const idSet = new Set(imageIds);
      const picked = allImages.filter((img) => idSet.has(img.id));
      if (picked.length === 0) {
        return res.status(404).json({ error: "no_matching_images" });
      }
      const watermarked = settings.watermarkEnabled === true;

      const zipFilename = `gallery-${gallery.id.slice(0, 8)}-${Date.now()}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

      const archive = archiverFactory('zip', { zlib: { level: 6 } });
      archive.on('warning', (err: Error & { code?: string }) => {
        if (err.code !== 'ENOENT') console.warn('[client-gallery] zip warning:', err);
      });
      archive.on('error', (err: Error) => {
        console.error('[client-gallery] zip error:', err);
        try { res.status(500).end(); } catch {}
      });
      archive.pipe(res);

      // Pull each image as a node-fetch stream and append. archiver
      // handles back-pressure so we only buffer one in flight at a
      // time (the connection drives consumption).
      let appended = 0;
      for (const img of picked) {
        const sourceUrl = watermarked && img.watermarkedUrl
          ? img.watermarkedUrl
          : (img.autoCleanedUrl ?? img.fullSizeUrl);
        try {
          const fetchRes = await fetch(sourceUrl);
          if (!fetchRes.ok || !fetchRes.body) {
            console.warn(`[client-gallery] zip skip ${img.id}: ${fetchRes.status}`);
            continue;
          }
          // node-fetch v3 returns a web ReadableStream; archiver wants a
          // Node Readable. The Node-native fetch gives us .body as a
          // web stream too — convert via Readable.fromWeb.
          const { Readable } = await import('node:stream');
          const nodeStream = Readable.fromWeb(fetchRes.body as never);
          const safeName = `${img.imageTitle.replace(/[\\/:*?"<>|]/g, '_')}.jpg`;
          archive.append(nodeStream, { name: safeName });
          appended++;
        } catch (err) {
          console.warn(`[client-gallery] zip fetch failed ${img.id}:`, err);
        }
      }

      if (appended === 0) {
        // We declared application/zip headers already; finalize an empty
        // archive rather than swap to JSON (which would confuse the client).
        console.warn(`[client-gallery] zip download produced 0 entries for gallery ${gallery.id}`);
      }
      await archive.finalize();

      // Slice 9X.11 — audit hver bilde som faktisk ble inkludert i zipen.
      // ON CONFLICT DO NOTHING gjør re-download idempotent (samme klient
      // som laster ned samme bilde flere ganger bruker ikke nye slots).
      // Best-effort etter response er ferdig — feiler stille.
      if (appended > 0) {
        try {
          await ensureGalleryDownloadAuditSchema();
          const auditedIds = picked.slice(0, appended).map((img) => img.id);
          const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
            .toString().split(',')[0].trim().slice(0, 45);
          const userAgent = String(req.headers['user-agent'] || '').slice(0, 500);
          // Bulk insert via UNNEST for å unngå én query per bilde.
          const insertResult = await pool.query(
            `INSERT INTO gallery_download_audit
               (gallery_id, image_id, client_email, client_ip, user_agent,
                download_method, photographer_id)
             SELECT $1::uuid, unnest($2::uuid[]), $3, $4, $5, 'zip', $6
             ON CONFLICT (gallery_id, client_email, image_id) DO NOTHING
             RETURNING image_id`,
            [gallery.id, auditedIds, clientEmail, clientIp || null, userAgent, gallery.photographerId],
          );
          const newDownloads = insertResult.rowCount ?? 0;

          // Slice 9X.12 — notify Stine + CRM-logg. Kun ved nye downloads
          // (re-download teller ikke). Begge best-effort, feiler stille.
          if (newDownloads > 0) {
            notifyPhotographerOfDownload({
              photographerId: gallery.photographerId,
              galleryId: gallery.id,
              clientEmail,
              newDownloadCount: newDownloads,
              totalRequestedInBatch: imageIds.length,
              clientIp,
              userAgent,
            }).catch((err) => console.warn('[download-notify] failed (non-fatal):', err));
          }
        } catch (auditErr) {
          console.warn('[client-gallery] audit-log failed (non-fatal):', auditErr);
        }
      }
    } catch (error) {
      console.error("[client-gallery] download-zip failed", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "download_zip_failed" });
      } else {
        try { res.end(); } catch {}
      }
    }
  });
}
