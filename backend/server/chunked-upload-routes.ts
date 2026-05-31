// Chunked-upload routes — resumable opplasting med per-chunk retry.
//
// Endepunkter (alle krever session):
//   POST   /api/chunked-upload/init                       → { uploadId, receivedChunks }
//   GET    /api/chunked-upload/:uploadId/status           → { receivedChunks, totalChunks, complete }
//   PUT    /api/chunked-upload/:uploadId/chunks/:index    → 200 OK ved suksess
//   POST   /api/chunked-upload/:uploadId/finish           → { fileId, downloadUrl }
//   DELETE /api/chunked-upload/:uploadId                  → 204 No Content
//
// Storage:
//   - Hver chunk skrives til <CHUNKED_UPLOAD_DIR>/<uploadId>/<index>.bin
//   - Etter /finish assembleres til <CHUNKED_UPLOAD_DIR>/finished/<fileId>/<filename>
//   - chunks-mappen slettes etter assembly
//
// Default CHUNKED_UPLOAD_DIR = os.tmpdir() + '/creatorhub-chunked-uploads'.
// I prod bør volumet være mounted persistent storage.

import express from "express";
import type { Pool } from "pg";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as os from "os";
import * as path from "path";
import { randomUUID } from "crypto";
import {
  routeAssembledUpload,
  getStorageStatus,
} from "./upload-storage-router.js";
import {
  canUserUpload,
  recordStorageUsage,
  pushStorageUsageToStripe,
  getStorageStatus as getQuotaStatus,
} from "./storage-quota-service.js";

export interface ChunkedUploadRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
}

const UPLOAD_ROOT =
  process.env.CHUNKED_UPLOAD_DIR ||
  path.join(os.tmpdir(), "creatorhub-chunked-uploads");

const MAX_CHUNK_SIZE = 20 * 1024 * 1024; // 20 MB hard limit per chunk
const MAX_TOTAL_SIZE = 200 * 1024 * 1024 * 1024; // 200 GB hard limit per upload
const MAX_TOTAL_CHUNKS = 100_000;

const ensureDir = async (dir: string): Promise<void> => {
  await fs.mkdir(dir, { recursive: true });
};

const chunkPathFor = (uploadId: string, index: number): string =>
  path.join(UPLOAD_ROOT, uploadId, `${index}.bin`);

const uploadDirFor = (uploadId: string): string =>
  path.join(UPLOAD_ROOT, uploadId);

const finishedDirFor = (fileId: string): string =>
  path.join(UPLOAD_ROOT, "finished", fileId);

const safeFileName = (raw: string): string => {
  // Strip path separators, control chars, slashes
  const cleaned = raw.replace(/[\\/:*?"<>|\x00-\x1F]/g, "_").trim();
  return cleaned.length > 0 ? cleaned.slice(0, 255) : "upload.bin";
};

// Les binær body som Buffer. Express får ikke automatisk raw bytes,
// så vi lytter på 'data'-events selv.
const readRawBody = (req: express.Request, maxBytes: number): Promise<Buffer> =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let bailed = false;
    req.on("data", (c: Buffer) => {
      if (bailed) return;
      total += c.length;
      if (total > maxBytes) {
        bailed = true;
        reject(new Error("chunk_too_large"));
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (bailed) return;
      resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });

export function setupChunkedUploadRoutes(
  deps: ChunkedUploadRoutesDeps,
): void {
  const { app, pool, requireUserSession } = deps;

  // Sikre at upload-root finnes ved server-start
  fs.mkdir(UPLOAD_ROOT, { recursive: true }).catch((err) => {
    console.error("[chunked-upload] Kunne ikke opprette upload-root:", err);
  });

  // INIT — starter en ny upload eller resumer en eksisterende.
  // Hvis klient sender { resumeUploadId } prøver vi å gjenoppta den.
  app.post("/api/chunked-upload/init", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const userId = session.userId;

    const {
      fileName,
      fileSize,
      chunkSize,
      totalChunks,
      mimeType,
      metadata,
      resumeUploadId,
    } = req.body || {};

    if (
      typeof fileName !== "string" ||
      typeof fileSize !== "number" ||
      typeof chunkSize !== "number" ||
      typeof totalChunks !== "number"
    ) {
      return res.status(400).json({
        success: false,
        error: "invalid_init_payload",
        message:
          "fileName, fileSize, chunkSize og totalChunks må sendes som JSON.",
      });
    }
    if (fileSize <= 0 || fileSize > MAX_TOTAL_SIZE) {
      return res.status(400).json({
        success: false,
        error: "file_too_large",
        message: `Filer over ${MAX_TOTAL_SIZE / (1024 * 1024 * 1024)} GB støttes ikke.`,
      });
    }
    if (
      chunkSize <= 0 ||
      chunkSize > MAX_CHUNK_SIZE ||
      totalChunks <= 0 ||
      totalChunks > MAX_TOTAL_CHUNKS
    ) {
      return res.status(400).json({
        success: false,
        error: "invalid_chunk_config",
        message: "Ugyldig chunkSize eller totalChunks.",
      });
    }

    // Quota-sjekk FØR vi tillater upload. Returnerer 507 hvis plan-grensen
    // er nådd og planen ikke tillater overforbruk; ellers ok (overage
    // håndteres ved finish via Stripe metered usage).
    const quota = await canUserUpload(pool, userId, fileSize);
    if (!quota.ok) {
      return res.status(507).json({
        success: false,
        error: quota.reason || "storage_quota_exceeded",
        message: quota.message,
        usage: {
          tier: quota.status.user.tier,
          usedBytes: quota.status.usedBytes,
          limitBytes: quota.status.user.storageLimitBytes,
          allowsOverage: quota.status.user.allowsOverage,
        },
      });
    }

    try {
      // Resume eksisterende?
      if (typeof resumeUploadId === "string" && resumeUploadId) {
        const existing = await pool.query(
          `SELECT id, file_name, total_chunks, received_chunks, status, expires_at
             FROM chunked_uploads
            WHERE id = $1 AND user_id = $2`,
          [resumeUploadId, userId],
        );
        if ((existing.rowCount ?? 0) > 0) {
          const row = existing.rows[0];
          if (row.status === "in_progress") {
            return res.json({
              success: true,
              uploadId: row.id,
              receivedChunks: row.received_chunks || [],
              totalChunks: row.total_chunks,
              resumed: true,
              expiresAt: row.expires_at,
            });
          }
        }
      }

      // Ny upload
      await ensureDir(UPLOAD_ROOT);
      const insert = await pool.query(
        `INSERT INTO chunked_uploads
           (user_id, file_name, file_size, chunk_size, total_chunks,
            mime_type, metadata, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'in_progress')
         RETURNING id, expires_at`,
        [
          userId,
          safeFileName(fileName),
          fileSize,
          chunkSize,
          totalChunks,
          typeof mimeType === "string" ? mimeType : null,
          metadata && typeof metadata === "object" ? metadata : {},
        ],
      );
      const row = insert.rows[0];

      await ensureDir(uploadDirFor(row.id));

      res.json({
        success: true,
        uploadId: row.id,
        receivedChunks: [],
        totalChunks,
        resumed: false,
        expiresAt: row.expires_at,
      });
    } catch (err) {
      console.error("[chunked-upload] init failed:", err);
      res.status(500).json({
        success: false,
        error: "init_failed",
        message: "Kunne ikke starte chunked upload.",
      });
    }
  });

  // STATUS — sjekk hvilke chunks som allerede er mottatt.
  app.get("/api/chunked-upload/:uploadId/status", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const userId = session.userId;
    const { uploadId } = req.params;

    try {
      const r = await pool.query(
        `SELECT received_chunks, total_chunks, status, file_name, final_file_id
           FROM chunked_uploads
          WHERE id = $1 AND user_id = $2`,
        [uploadId, userId],
      );
      if ((r.rowCount ?? 0) === 0) {
        return res.status(404).json({
          success: false,
          error: "upload_not_found",
        });
      }
      const row = r.rows[0];
      const received: number[] = row.received_chunks || [];
      res.json({
        success: true,
        uploadId,
        status: row.status,
        receivedChunks: received,
        totalChunks: row.total_chunks,
        complete: received.length >= row.total_chunks,
        finalFileId: row.final_file_id ?? null,
        fileName: row.file_name,
      });
    } catch (err) {
      console.error("[chunked-upload] status failed:", err);
      res.status(500).json({ success: false, error: "status_failed" });
    }
  });

  // CHUNK — last opp én chunk. Body er rå binær (Content-Type: application/octet-stream).
  app.put(
    "/api/chunked-upload/:uploadId/chunks/:index",
    async (req, res) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = session.userId;
      const { uploadId, index } = req.params;
      const chunkIndex = parseInt(index, 10);

      if (!Number.isFinite(chunkIndex) || chunkIndex < 0) {
        return res
          .status(400)
          .json({ success: false, error: "invalid_chunk_index" });
      }

      try {
        const meta = await pool.query(
          `SELECT total_chunks, status, chunk_size, received_chunks
             FROM chunked_uploads
            WHERE id = $1 AND user_id = $2`,
          [uploadId, userId],
        );
        if ((meta.rowCount ?? 0) === 0) {
          return res
            .status(404)
            .json({ success: false, error: "upload_not_found" });
        }
        const row = meta.rows[0];
        if (row.status !== "in_progress") {
          return res
            .status(409)
            .json({ success: false, error: "upload_not_in_progress" });
        }
        if (chunkIndex >= row.total_chunks) {
          return res
            .status(400)
            .json({ success: false, error: "chunk_index_out_of_range" });
        }

        // Idempotent: hvis denne chunken allerede er mottatt, godta uten å skrive på nytt
        const received: number[] = row.received_chunks || [];
        if (received.includes(chunkIndex)) {
          return res.json({
            success: true,
            uploadId,
            chunkIndex,
            duplicate: true,
            receivedChunks: received,
          });
        }

        const maxBytes = row.chunk_size + 1024; // litt slack for siste chunk
        const body = await readRawBody(req, maxBytes);

        const chunkPath = chunkPathFor(uploadId, chunkIndex);
        await ensureDir(path.dirname(chunkPath));
        await fs.writeFile(chunkPath, body);

        // Oppdater received_chunks atomisk
        const updated = await pool.query(
          `UPDATE chunked_uploads
              SET received_chunks =
                    CASE WHEN received_chunks @> $2::jsonb
                         THEN received_chunks
                         ELSE received_chunks || $2::jsonb
                    END,
                  updated_at = now()
            WHERE id = $1
            RETURNING received_chunks`,
          [uploadId, JSON.stringify([chunkIndex])],
        );

        const receivedAfter = updated.rows[0]?.received_chunks || [];
        res.json({
          success: true,
          uploadId,
          chunkIndex,
          duplicate: false,
          receivedCount: receivedAfter.length,
          totalChunks: row.total_chunks,
        });
      } catch (err: any) {
        if (err?.message === "chunk_too_large") {
          return res.status(413).json({
            success: false,
            error: "chunk_too_large",
            message: "Chunken er større enn tillatt.",
          });
        }
        console.error("[chunked-upload] chunk upload failed:", err);
        res
          .status(500)
          .json({ success: false, error: "chunk_upload_failed" });
      }
    },
  );

  // FINISH — assembler alle chunks til én fil.
  app.post(
    "/api/chunked-upload/:uploadId/finish",
    async (req, res) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = session.userId;
      const { uploadId } = req.params;

      try {
        const meta = await pool.query(
          `SELECT file_name, total_chunks, received_chunks, status, mime_type, metadata
             FROM chunked_uploads
            WHERE id = $1 AND user_id = $2`,
          [uploadId, userId],
        );
        if ((meta.rowCount ?? 0) === 0) {
          return res
            .status(404)
            .json({ success: false, error: "upload_not_found" });
        }
        const row = meta.rows[0];
        if (row.status === "completed") {
          return res.json({
            success: true,
            uploadId,
            fileId: row.final_file_id,
            alreadyFinished: true,
          });
        }
        if (row.status !== "in_progress") {
          return res
            .status(409)
            .json({ success: false, error: "upload_not_in_progress" });
        }

        const received: number[] = row.received_chunks || [];
        if (received.length < row.total_chunks) {
          const missing: number[] = [];
          for (let i = 0; i < row.total_chunks; i++) {
            if (!received.includes(i)) missing.push(i);
          }
          return res.status(409).json({
            success: false,
            error: "chunks_missing",
            missingChunks: missing.slice(0, 100),
            missingCount: missing.length,
            message: `${missing.length} chunk(s) mangler — last opp dem først.`,
          });
        }

        // Assembler
        const fileId = randomUUID();
        const finishedDir = finishedDirFor(fileId);
        await ensureDir(finishedDir);
        const finalPath = path.join(finishedDir, row.file_name);

        const writeStream = fsSync.createWriteStream(finalPath);
        try {
          for (let i = 0; i < row.total_chunks; i++) {
            const cp = chunkPathFor(uploadId, i);
            const data = await fs.readFile(cp);
            await new Promise<void>((resolve, reject) => {
              writeStream.write(data, (err) => (err ? reject(err) : resolve()));
            });
          }
        } finally {
          await new Promise<void>((resolve) => writeStream.end(resolve));
        }

        // Rydd chunks-mappa
        try {
          await fs.rm(uploadDirFor(uploadId), { recursive: true, force: true });
        } catch (cleanupErr) {
          console.warn(
            "[chunked-upload] kunne ikke rydde chunks-mappe:",
            cleanupErr,
          );
        }

        const stats = await fs.stat(finalPath);

        // Rute den ferdige fila til riktig storage-backend:
        //   - video/* → Cloudflare Stream
        //   - annet → R2 hvis konfigurert
        //   - fallback → filesystem (servet via /api/chunked-upload/files/:fileId)
        const storage = await routeAssembledUpload({
          fileId,
          fileName: row.file_name,
          mimeType: row.mime_type,
          size: stats.size,
          sourcePath: finalPath,
          metadata: row.metadata,
          userId,
        });

        // Hvis backend ikke er filesystem, oppdater final_file_path til å
        // peke til hvor fila faktisk endte opp (intern referanse). Hvis
        // den fortsatt er på filesystem behold relativ sti slik at
        // /api/chunked-upload/files/:fileId fortsatt fungerer.
        const finalRelPath =
          storage.backend === "filesystem"
            ? path.relative(UPLOAD_ROOT, finalPath)
            : storage.backend === "r2"
              ? `r2://${storage.r2Bucket}/${storage.r2Key}`
              : `stream://${storage.streamUid}`;

        // Lagre storage-metadata i metadata-feltet (vi har ikke egen kolonne)
        const updatedMetadata = {
          ...(row.metadata && typeof row.metadata === "object"
            ? row.metadata
            : {}),
          storageBackend: storage.backend,
          ...(storage.streamUid ? { streamUid: storage.streamUid } : {}),
          ...(storage.playbackUrl ? { playbackUrl: storage.playbackUrl } : {}),
          ...(storage.thumbnailUrl
            ? { thumbnailUrl: storage.thumbnailUrl }
            : {}),
          ...(storage.r2Key
            ? { r2Key: storage.r2Key, r2Bucket: storage.r2Bucket }
            : {}),
          ...(storage.downloadUrl ? { downloadUrl: storage.downloadUrl } : {}),
        };

        await pool.query(
          `UPDATE chunked_uploads
              SET status = 'completed',
                  final_file_id = $2,
                  final_file_path = $3,
                  metadata = $4::jsonb,
                  completed_at = now(),
                  updated_at = now()
            WHERE id = $1`,
          [uploadId, fileId, finalRelPath, JSON.stringify(updatedMetadata)],
        );

        // Registrer i storage-ledger. Bryter ikke responsen hvis det feiler,
        // men logger så vi kan reconcile senere.
        try {
          await recordStorageUsage(
            pool,
            userId,
            stats.size,
            storage.backend,
            "chunked_finish",
            fileId,
            { fileName: row.file_name },
          );
        } catch (ledgerErr) {
          console.error(
            "[chunked-upload] storage-ledger update failed:",
            ledgerErr,
          );
        }

        // Push usage til Stripe i bakgrunnen (fire-and-forget) — vi vil
        // ikke at finish skal blokkeres av Stripe-svartid.
        void pushStorageUsageToStripe(pool, userId).catch((err) => {
          console.error("[chunked-upload] Stripe usage push failed:", err);
        });

        const finalQuota = await getQuotaStatus(pool, userId).catch(() => null);

        res.json({
          success: true,
          uploadId,
          fileId,
          fileName: row.file_name,
          size: stats.size,
          mimeType: row.mime_type,
          metadata: row.metadata,
          storage: {
            backend: storage.backend,
            streamUid: storage.streamUid,
            playbackUrl: storage.playbackUrl,
            thumbnailUrl: storage.thumbnailUrl,
            ready: storage.ready,
            r2Key: storage.r2Key,
            r2Bucket: storage.r2Bucket,
          },
          downloadUrl:
            storage.downloadUrl || `/api/chunked-upload/files/${fileId}`,
          quota: finalQuota
            ? {
                tier: finalQuota.user.tier,
                usedBytes: finalQuota.usedBytes,
                limitBytes: finalQuota.user.storageLimitBytes,
                overageBytes: finalQuota.overageBytes,
                allowsOverage: finalQuota.user.allowsOverage,
              }
            : null,
        });
      } catch (err) {
        console.error("[chunked-upload] finish failed:", err);
        try {
          await pool.query(
            `UPDATE chunked_uploads
                SET status = 'failed',
                    error_message = $2,
                    updated_at = now()
              WHERE id = $1`,
            [uploadId, String((err as Error)?.message ?? err).slice(0, 500)],
          );
        } catch {}
        res
          .status(500)
          .json({ success: false, error: "finish_failed" });
      }
    },
  );

  // DELETE — avbryt en pågående upload.
  app.delete("/api/chunked-upload/:uploadId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const userId = session.userId;
    const { uploadId } = req.params;

    try {
      await pool.query(
        `UPDATE chunked_uploads
            SET status = 'cancelled', updated_at = now()
          WHERE id = $1 AND user_id = $2 AND status = 'in_progress'`,
        [uploadId, userId],
      );
      try {
        await fs.rm(uploadDirFor(uploadId), { recursive: true, force: true });
      } catch {}
      res.status(204).end();
    } catch (err) {
      console.error("[chunked-upload] cancel failed:", err);
      res.status(500).json({ success: false, error: "cancel_failed" });
    }
  });

  // FILES — serve assemblet fil (kun for upload-eieren).
  // Hvis fila ble flyttet til R2 eller Stream: redirect til ekte URL.
  app.get("/api/chunked-upload/files/:fileId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const userId = session.userId;
    const { fileId } = req.params;

    try {
      const r = await pool.query(
        `SELECT file_name, mime_type, final_file_path, metadata
           FROM chunked_uploads
          WHERE final_file_id = $1 AND user_id = $2 AND status = 'completed'`,
        [fileId, userId],
      );
      if ((r.rowCount ?? 0) === 0) {
        return res.status(404).end();
      }
      const row = r.rows[0];
      const metadata =
        row.metadata && typeof row.metadata === "object" ? row.metadata : {};
      const backend = metadata.storageBackend as string | undefined;

      if (backend === "cloudflare_stream" && metadata.playbackUrl) {
        return res.redirect(302, String(metadata.playbackUrl));
      }
      if (backend === "r2" && metadata.downloadUrl) {
        return res.redirect(302, String(metadata.downloadUrl));
      }

      // Filesystem-pathen — final_file_path er relativ til UPLOAD_ROOT
      const fullPath = path.join(UPLOAD_ROOT, row.final_file_path);
      if (!fullPath.startsWith(UPLOAD_ROOT)) {
        return res.status(403).end();
      }
      if (row.mime_type) {
        res.setHeader("Content-Type", row.mime_type);
      }
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${row.file_name.replace(/"/g, "")}"`,
      );
      fsSync.createReadStream(fullPath).pipe(res);
    } catch (err) {
      console.error("[chunked-upload] file serve failed:", err);
      res.status(500).end();
    }
  });

  // STORAGE STATUS — diagnoseendpoint for å vise hva som er koblet til.
  app.get("/api/chunked-upload/storage-status", (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    res.json({ success: true, ...getStorageStatus() });
  });
}
