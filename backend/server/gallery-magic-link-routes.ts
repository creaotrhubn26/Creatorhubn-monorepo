// Gallery magic-link public + admin routes.
//
// PUBLIC (ingen login kreves — kun tokenet i URL-en):
//   GET  /api/gallery/m/:token              — manifest med fil-liste
//   GET  /api/gallery/m/:token/files/:fileId — dekrypter + serve én fil
//   GET  /api/gallery/m/:token/zip          — ZIP-stream med alle filer
//
// ADMIN (krever requireAdminSession ELLER eier-bruker via requireUserSession):
//   POST   /api/gallery/magic-links             — opprett
//   GET    /api/gallery/magic-links             — list mine
//   GET    /api/gallery/magic-links/:id         — detaljer + audit-trail
//   POST   /api/gallery/magic-links/:id/revoke  — kanseller
//
// Bytes går alltid gjennom backend for krypterte filer — det er hele
// poenget. For ikke-krypterte filer 302-redirecter vi til R2 signed-URL
// (samme spar-bandwidth-tradeoff som /api/chunked-upload/files).

import express from "express";
import type { Pool } from "pg";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as path from "path";
import * as os from "os";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import {
  generateToken,
  validateToken,
  isFileInBundle,
  incrementDownloadCount,
  incrementZipDownloadCount,
  checkZipQuota,
  recordAccess,
  checkRateLimit,
  type MagicLinkRow,
} from "./gallery-magic-link-service.js";

const CHUNKED_UPLOAD_ROOT =
  process.env.CHUNKED_UPLOAD_DIR ||
  path.join(os.tmpdir(), "creatorhub-chunked-uploads");

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  "https://creatorhubn.com";

const firstNonEmpty = (...vals: (string | undefined)[]): string | undefined => {
  for (const v of vals) if (v && v.trim().length > 0) return v.trim();
  return undefined;
};

let cachedR2: S3Client | null = null;
const getGenericR2 = (): { client: S3Client; bucket: string } | null => {
  const endpoint = firstNonEmpty(
    process.env.GENERIC_UPLOADS_R2_ENDPOINT,
    process.env.CLOUDFLARE_R2_ENDPOINT,
    process.env.R2_ENDPOINT,
  );
  const bucket = firstNonEmpty(
    process.env.GENERIC_UPLOADS_R2_BUCKET,
    process.env.CLOUDFLARE_R2_BUCKET,
    process.env.R2_BUCKET,
  );
  const accessKeyId = firstNonEmpty(
    process.env.GENERIC_UPLOADS_R2_ACCESS_KEY_ID,
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    process.env.R2_ACCESS_KEY_ID,
  );
  const secretAccessKey = firstNonEmpty(
    process.env.GENERIC_UPLOADS_R2_SECRET_ACCESS_KEY,
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    process.env.R2_SECRET_ACCESS_KEY,
  );
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  if (!cachedR2) {
    cachedR2 = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return { client: cachedR2, bucket };
};

interface FileRow {
  final_file_id: string;
  file_name: string;
  mime_type: string | null;
  final_file_path: string;
  metadata: Record<string, unknown>;
  user_id: string;
  file_size: number;
}

const fetchFileRow = async (
  pool: Pool,
  fileId: string,
  expectedOwnerUserId: string,
): Promise<FileRow | null> => {
  const r = await pool.query<FileRow>(
    `SELECT final_file_id, file_name, mime_type, final_file_path, metadata,
            user_id, file_size
       FROM chunked_uploads
      WHERE final_file_id = $1
        AND user_id = $2
        AND status = 'completed'
      LIMIT 1`,
    [fileId, expectedOwnerUserId],
  );
  return r.rows[0] || null;
};

// Bygg en lese-stream for fila (dekryptert hvis nødvendig). Returnerer
// stream + plaintext-size og mime-type. Kaster ved feil.
const buildDecryptedReadStream = async (
  row: FileRow,
  userId: string,
): Promise<{
  stream: NodeJS.ReadableStream;
  size: number;
  mime: string;
}> => {
  const metadata = row.metadata || {};
  const backend = metadata.storageBackend as string | undefined;
  const mime = row.mime_type || "application/octet-stream";

  if (backend === "cloudflare_stream") {
    throw new Error(
      "stream_video_not_downloadable: " +
        "video som ligger i Cloudflare Stream kan ikke leveres som nedlasting via magic-link. " +
        "Last opp som encryptAtRest=true for å aktivere fil-nedlasting.",
    );
  }

  // Last encryption-helper kun hvis vi trenger den
  const isEncrypted = metadata.encryptedAtRest === true;
  let dek: Buffer | null = null;
  let DecryptStream: any = null;
  let ciphertextSize = 0;
  if (isEncrypted) {
    const enc = await import("./file-encryption.js");
    if (!enc.isEncryptionAvailable()) {
      throw new Error("encryption_key_missing");
    }
    const userKek = enc.deriveUserKek(userId);
    dek = enc.decryptDek(String(metadata.encryptedDek), userKek);
    ciphertextSize = Number(metadata.ciphertextSize ?? 0);
    if (ciphertextSize <= 0) {
      throw new Error("ciphertext_size_missing");
    }
    DecryptStream = enc.DecryptStream;
  }

  // R2-pathen
  if (backend === "r2" && metadata.r2Key) {
    const r2 = getGenericR2();
    if (!r2) throw new Error("r2_not_configured");
    const obj = await r2.client.send(
      new GetObjectCommand({ Bucket: r2.bucket, Key: String(metadata.r2Key) }),
    );
    if (!obj.Body) throw new Error("r2_empty_body");
    const sourceStream = obj.Body as NodeJS.ReadableStream;
    if (isEncrypted) {
      const decryptStream = new DecryptStream(dek!, ciphertextSize);
      sourceStream.pipe(decryptStream);
      return { stream: decryptStream, size: row.file_size, mime };
    }
    return { stream: sourceStream, size: row.file_size, mime };
  }

  // Filesystem-pathen
  const fullPath = path.join(CHUNKED_UPLOAD_ROOT, row.final_file_path);
  if (!fullPath.startsWith(CHUNKED_UPLOAD_ROOT)) {
    throw new Error("path_traversal_blocked");
  }
  const readStream = fs.createReadStream(fullPath);
  if (isEncrypted) {
    const decryptStream = new DecryptStream(dek!, ciphertextSize);
    readStream.pipe(decryptStream);
    return { stream: decryptStream, size: row.file_size, mime };
  }
  return { stream: readStream, size: row.file_size, mime };
};

export interface GalleryMagicLinkRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
}

export function setupGalleryMagicLinkRoutes(
  deps: GalleryMagicLinkRoutesDeps,
): void {
  const { app, pool, requireUserSession } = deps;

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC ENDPOINTS — token-validert, ingen login
  // ─────────────────────────────────────────────────────────────────

  // GET /api/gallery/m/:token — manifest
  app.get("/api/gallery/m/:token", async (req, res) => {
    const { token } = req.params;
    const ip =
      typeof req.headers["x-forwarded-for"] === "string"
        ? (req.headers["x-forwarded-for"] as string).split(",")[0].trim()
        : req.ip || null;
    if (!checkRateLimit(ip)) {
      return res
        .status(429)
        .json({ error: "rate_limited", message: "For mange forespørsler." });
    }

    const v = await validateToken(pool, token);
    if (!v.ok) {
      if (v.link) {
        void recordAccess(pool, {
          linkId: v.link.id,
          accessType: "rejected",
          outcome: v.reason!,
          req,
        });
      }
      return res
        .status(v.reason === "not_found" ? 404 : 410)
        .json({ error: v.reason, message: msgForReason(v.reason!) });
    }
    const link = v.link!;

    // Hent metadata om hver fil for å bygge manifest
    const files = await pool.query<{
      final_file_id: string;
      file_name: string;
      mime_type: string | null;
      file_size: number;
      metadata: Record<string, unknown>;
    }>(
      `SELECT final_file_id, file_name, mime_type, file_size, metadata
         FROM chunked_uploads
        WHERE final_file_id = ANY($1::text[])
          AND user_id = $2
          AND status = 'completed'
        ORDER BY created_at ASC`,
      [link.file_ids, link.owner_user_id],
    );

    void recordAccess(pool, {
      linkId: link.id,
      accessType: "manifest",
      outcome: "success",
      req,
    });

    res.json({
      success: true,
      galleryName: link.gallery_name,
      message: link.message,
      recipientLabel: link.recipient_label,
      expiresAt: link.expires_at,
      downloadsRemaining:
        link.max_downloads != null
          ? Math.max(0, link.max_downloads - link.downloads_used)
          : null,
      zipDownloadsRemaining:
        link.max_zip_downloads != null
          ? Math.max(0, link.max_zip_downloads - link.zip_downloads_used)
          : null,
      files: files.rows.map((f) => {
        const meta = f.metadata || {};
        const isVideo = meta.storageBackend === "cloudflare_stream";
        return {
          fileId: f.final_file_id,
          fileName: f.file_name,
          mimeType: f.mime_type,
          size: f.file_size,
          isEncrypted: meta.encryptedAtRest === true,
          // Hvis video: client UI skal vise "spilles av i nettleser",
          // ikke "last ned"-knapp
          deliveryMode: isVideo ? "stream" : "download",
          downloadUrl: `${PUBLIC_BASE_URL}/api/gallery/m/${token}/files/${f.final_file_id}`,
        };
      }),
      zipUrl: `${PUBLIC_BASE_URL}/api/gallery/m/${token}/zip`,
    });
  });

  // GET /api/gallery/m/:token/files/:fileId — dekrypter + serve én fil
  app.get("/api/gallery/m/:token/files/:fileId", async (req, res) => {
    const { token, fileId } = req.params;
    const ip =
      typeof req.headers["x-forwarded-for"] === "string"
        ? (req.headers["x-forwarded-for"] as string).split(",")[0].trim()
        : req.ip || null;
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: "rate_limited" });
    }

    const v = await validateToken(pool, token);
    if (!v.ok) {
      if (v.link) {
        void recordAccess(pool, {
          linkId: v.link.id,
          fileId,
          accessType: "rejected",
          outcome: v.reason!,
          req,
        });
      }
      return res
        .status(v.reason === "not_found" ? 404 : 410)
        .json({ error: v.reason, message: msgForReason(v.reason!) });
    }
    const link = v.link!;

    if (!isFileInBundle(link, fileId)) {
      void recordAccess(pool, {
        linkId: link.id,
        fileId,
        accessType: "rejected",
        outcome: "invalid_file_id",
        req,
      });
      return res
        .status(404)
        .json({ error: "invalid_file_id", message: "Fila er ikke en del av denne lenken." });
    }

    const row = await fetchFileRow(pool, fileId, link.owner_user_id);
    if (!row) {
      void recordAccess(pool, {
        linkId: link.id,
        fileId,
        accessType: "rejected",
        outcome: "not_found",
        req,
      });
      return res.status(404).json({ error: "file_missing" });
    }

    try {
      const { stream, mime } = await buildDecryptedReadStream(
        row,
        link.owner_user_id,
      );
      res.setHeader("Content-Type", mime);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${row.file_name.replace(/"/g, "")}"`,
      );
      void incrementDownloadCount(pool, link.id);
      void recordAccess(pool, {
        linkId: link.id,
        fileId,
        accessType: "file",
        outcome: "success",
        req,
        metadata: { encrypted: row.metadata?.encryptedAtRest === true },
      });
      stream.pipe(res);
    } catch (err: any) {
      console.error("[gallery-magic-link] serve failed:", err);
      const msg = String(err?.message || err);
      let outcome: any = "decrypt_failed";
      if (msg.includes("stream_video_not_downloadable")) {
        outcome = "decrypt_failed";
        void recordAccess(pool, {
          linkId: link.id,
          fileId,
          accessType: "rejected",
          outcome,
          req,
          metadata: { reason: "video_in_stream" },
        });
        return res.status(409).json({
          error: "video_in_stream",
          message:
            "Videoen ligger i Cloudflare Stream og kan ikke lastes ned som fil. Bruk preview-funksjonen i stedet.",
        });
      }
      void recordAccess(pool, {
        linkId: link.id,
        fileId,
        accessType: "rejected",
        outcome,
        req,
        metadata: { error: msg.slice(0, 200) },
      });
      res.status(500).json({ error: "decrypt_failed" });
    }
  });

  // GET /api/gallery/m/:token/zip — ZIP-stream med alle ikke-video-filer
  app.get("/api/gallery/m/:token/zip", async (req, res) => {
    const { token } = req.params;
    const ip =
      typeof req.headers["x-forwarded-for"] === "string"
        ? (req.headers["x-forwarded-for"] as string).split(",")[0].trim()
        : req.ip || null;
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: "rate_limited" });
    }

    const v = await validateToken(pool, token);
    if (!v.ok || !v.link) {
      if (v.link) {
        void recordAccess(pool, {
          linkId: v.link.id,
          accessType: "rejected",
          outcome: v.reason!,
          req,
        });
      }
      return res
        .status(v.reason === "not_found" ? 404 : 410)
        .json({ error: v.reason, message: msgForReason(v.reason!) });
    }
    const link = v.link;
    if (!checkZipQuota(link)) {
      void recordAccess(pool, {
        linkId: link.id,
        accessType: "rejected",
        outcome: "over_quota",
        req,
        metadata: { quotaType: "zip" },
      });
      return res
        .status(429)
        .json({ error: "over_quota", message: "ZIP-kvote nådd." });
    }

    const files = await pool.query<FileRow>(
      `SELECT final_file_id, file_name, mime_type, final_file_path,
              metadata, user_id, file_size
         FROM chunked_uploads
        WHERE final_file_id = ANY($1::text[])
          AND user_id = $2
          AND status = 'completed'
        ORDER BY created_at ASC`,
      [link.file_ids, link.owner_user_id],
    );

    // Importer archiver dynamisk for å ikke laste ved app-start
    const archiverMod: any = await import("archiver");
    const archiver: any = archiverMod.default || archiverMod;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${(link.gallery_name || "bilder").replace(/[^A-Za-z0-9_-]+/g, "-")}.zip"`,
    );

    const archive: any = archiver("zip", { zlib: { level: 1 } }); // level 1 = rask, lite kompresjon (bilder er allerede komprimert)
    archive.on("warning", (err: any) => {
      console.warn("[gallery-magic-link] archive warning:", err);
    });
    archive.on("error", (err: any) => {
      console.error("[gallery-magic-link] archive error:", err);
      try {
        res.status(500).end();
      } catch {}
    });

    archive.pipe(res);

    let added = 0;
    let skipped = 0;
    for (const file of files.rows) {
      try {
        if (file.metadata?.storageBackend === "cloudflare_stream") {
          // Stream-videoer kan ikke inkluderes i ZIP — hopp over
          skipped++;
          continue;
        }
        const { stream } = await buildDecryptedReadStream(file, link.owner_user_id);
        archive.append(stream as any, { name: file.file_name });
        added++;
      } catch (err) {
        console.error("[gallery-magic-link] zip-append failed:", err);
        skipped++;
      }
    }

    if (skipped > 0 && added > 0) {
      // Legg til en README som forklarer hopp-over-ene
      archive.append(
        `${skipped} video(er) er tilgjengelig som streaming-preview via galleri-lenken.\n` +
          `De er ikke inkludert i ZIP-en fordi de ikke kan lastes ned som filer fra Cloudflare Stream.\n` +
          `Last opp samme video med encryptAtRest=true hvis fil-nedlasting er ønskelig.\n`,
        { name: "VIDEOER_README.txt" },
      );
    }

    void incrementZipDownloadCount(pool, link.id);
    void recordAccess(pool, {
      linkId: link.id,
      accessType: "zip",
      outcome: "success",
      req,
      metadata: { filesIncluded: added, filesSkipped: skipped },
    });

    await archive.finalize();
  });

  // ─────────────────────────────────────────────────────────────────
  // OWNER / ADMIN ENDPOINTS — krever login
  // ─────────────────────────────────────────────────────────────────

  // POST /api/gallery/magic-links — opprett ny
  app.post("/api/gallery/magic-links", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const userId = session.userId;

    const {
      fileIds,
      galleryName,
      recipientLabel,
      recipientEmail,
      message,
      expiresInDays,
      maxDownloads,
      maxZipDownloads,
    } = req.body || {};

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "missing_file_ids",
        message: "fileIds må være en array med minst én fil-id.",
      });
    }
    if (fileIds.length > 5000) {
      return res
        .status(400)
        .json({ success: false, error: "too_many_files", message: "Max 5000 filer per lenke." });
    }

    // Verifiser at alle filer tilhører innloggetbruker (eier-sjekk)
    const ownership = await pool.query<{ final_file_id: string }>(
      `SELECT final_file_id
         FROM chunked_uploads
        WHERE final_file_id = ANY($1::text[])
          AND user_id = $2
          AND status = 'completed'`,
      [fileIds, userId],
    );
    const owned = new Set(ownership.rows.map((r) => r.final_file_id));
    const missing = (fileIds as string[]).filter((id) => !owned.has(id));
    if (missing.length > 0) {
      return res.status(403).json({
        success: false,
        error: "file_not_owned",
        message: `Du eier ikke ${missing.length} av filene. Lenken kan kun inneholde filer du har lastet opp.`,
        missing,
      });
    }

    const days =
      typeof expiresInDays === "number" && expiresInDays > 0
        ? Math.min(365, Math.floor(expiresInDays))
        : 14;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const token = generateToken();

    const insert = await pool.query<{ id: string }>(
      `INSERT INTO gallery_magic_links
         (token, owner_user_id, recipient_label, recipient_email, file_ids,
          gallery_name, message, expires_at, max_downloads, max_zip_downloads)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        token,
        userId,
        typeof recipientLabel === "string" ? recipientLabel.slice(0, 200) : null,
        typeof recipientEmail === "string" ? recipientEmail.slice(0, 200) : null,
        JSON.stringify(fileIds),
        typeof galleryName === "string" ? galleryName.slice(0, 200) : null,
        typeof message === "string" ? message.slice(0, 2000) : null,
        expiresAt.toISOString(),
        typeof maxDownloads === "number" && maxDownloads > 0 ? maxDownloads : null,
        typeof maxZipDownloads === "number" && maxZipDownloads >= 0
          ? maxZipDownloads
          : 5,
      ],
    );

    res.json({
      success: true,
      id: insert.rows[0].id,
      token,
      shareUrl: `${PUBLIC_BASE_URL}/api/gallery/m/${token}`,
      expiresAt: expiresAt.toISOString(),
    });
  });

  // GET /api/gallery/magic-links — eierens egne lenker
  app.get("/api/gallery/magic-links", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const userId = session.userId;

    const r = await pool.query(
      `SELECT id, token, recipient_label, recipient_email, gallery_name,
              expires_at, max_downloads, downloads_used,
              max_zip_downloads, zip_downloads_used, revoked_at,
              created_at, last_accessed_at,
              jsonb_array_length(file_ids) AS file_count
         FROM gallery_magic_links
        WHERE owner_user_id = $1
        ORDER BY created_at DESC
        LIMIT 200`,
      [userId],
    );
    res.json({
      success: true,
      links: r.rows.map((row) => ({
        id: row.id,
        shareUrl: `${PUBLIC_BASE_URL}/api/gallery/m/${row.token}`,
        recipientLabel: row.recipient_label,
        recipientEmail: row.recipient_email,
        galleryName: row.gallery_name,
        fileCount: row.file_count,
        expiresAt: row.expires_at,
        maxDownloads: row.max_downloads,
        downloadsUsed: row.downloads_used,
        maxZipDownloads: row.max_zip_downloads,
        zipDownloadsUsed: row.zip_downloads_used,
        revokedAt: row.revoked_at,
        createdAt: row.created_at,
        lastAccessedAt: row.last_accessed_at,
      })),
    });
  });

  // GET /api/gallery/magic-links/:id — detaljer + siste 100 audit-rader
  app.get("/api/gallery/magic-links/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const userId = session.userId;

    const linkRes = await pool.query(
      `SELECT * FROM gallery_magic_links
        WHERE id = $1 AND owner_user_id = $2`,
      [req.params.id, userId],
    );
    if ((linkRes.rowCount ?? 0) === 0) {
      return res.status(404).json({ success: false, error: "not_found" });
    }
    const audit = await pool.query(
      `SELECT id, file_id, access_type, outcome, ip, user_agent, referer,
              bytes_served, metadata, created_at
         FROM gallery_magic_link_access
        WHERE link_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [req.params.id],
    );
    res.json({
      success: true,
      link: linkRes.rows[0],
      access: audit.rows,
    });
  });

  // POST /api/gallery/magic-links/:id/revoke
  app.post(
    "/api/gallery/magic-links/:id/revoke",
    async (req, res) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = session.userId;

      const reason =
        typeof req.body?.reason === "string"
          ? req.body.reason.slice(0, 500)
          : null;

      const r = await pool.query(
        `UPDATE gallery_magic_links
            SET revoked_at = now(),
                revoked_by = $2,
                revoke_reason = $3
          WHERE id = $1
            AND owner_user_id = $2
            AND revoked_at IS NULL
          RETURNING id`,
        [req.params.id, userId, reason],
      );
      if ((r.rowCount ?? 0) === 0) {
        return res
          .status(404)
          .json({ success: false, error: "not_found_or_already_revoked" });
      }
      res.json({ success: true, id: req.params.id });
    },
  );
}

const msgForReason = (reason: string): string => {
  switch (reason) {
    case "expired":
      return "Lenken er utløpt.";
    case "revoked":
      return "Lenken er kansellert av fotografen.";
    case "over_quota":
      return "Nedlastings-grensen for denne lenken er nådd.";
    case "not_found":
    default:
      return "Lenken eksisterer ikke eller har blitt fjernet.";
  }
};
