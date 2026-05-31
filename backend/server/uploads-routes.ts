// /api/uploads/* — generelle små opplastinger som rutes via
// upload-storage-router (Cloudflare Stream for video, R2 for resten,
// filesystem som fallback).
//
// Tidligere defaulted UniversalFileUpload til '/api/upload' som ikke
// fantes i backend — alle ikke-spesifikke opplastinger feilet stille
// med 404. Dette er det manglende motstykket.
//
// Større filer (≥ 25MB) går via /api/chunked-upload/* og er resumable;
// dette endepunktet håndterer alt mindre i én single-shot multipart.

import express from "express";
import multer from "multer";
import type { Pool } from "pg";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { randomUUID } from "crypto";
import {
  routeAssembledUpload,
  getStorageStatus,
} from "./upload-storage-router.js";

export interface UploadsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
}

const SMALL_UPLOAD_MAX = 25 * 1024 * 1024; // 25 MB — over dette skal klient bruke chunked

const TEMP_DIR =
  process.env.UPLOAD_TEMP_DIR ||
  path.join(os.tmpdir(), "creatorhub-single-uploads");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: SMALL_UPLOAD_MAX,
    files: 1,
  },
});

export function setupUploadsRoutes(deps: UploadsRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  fs.mkdir(TEMP_DIR, { recursive: true }).catch((err) => {
    console.error("[uploads] kunne ikke opprette temp-dir:", err);
  });

  // POST /api/uploads/file — multer + storage-router
  app.post(
    "/api/uploads/file",
    upload.single("file"),
    async (req, res) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = session.userId;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "no_file",
          message: "Mangler 'file' i multipart body.",
        });
      }

      const fileId = randomUUID();
      const safeName = (req.file.originalname || "upload.bin")
        .replace(/[\\/:*?"<>|\x00-\x1F]/g, "_")
        .slice(0, 200);
      const tempPath = path.join(TEMP_DIR, `${fileId}-${safeName}`);

      try {
        await fs.writeFile(tempPath, req.file.buffer);

        const metadataRaw = req.body?.metadata;
        let metadata: Record<string, unknown> = {};
        if (typeof metadataRaw === "string") {
          try {
            metadata = JSON.parse(metadataRaw);
          } catch {}
        } else if (metadataRaw && typeof metadataRaw === "object") {
          metadata = metadataRaw as Record<string, unknown>;
        }

        const storage = await routeAssembledUpload({
          fileId,
          fileName: safeName,
          mimeType: req.file.mimetype || null,
          size: req.file.size,
          sourcePath: tempPath,
          metadata,
          userId,
        });

        res.json({
          success: true,
          fileId,
          fileName: safeName,
          size: req.file.size,
          mimeType: req.file.mimetype,
          storage: {
            backend: storage.backend,
            streamUid: storage.streamUid,
            playbackUrl: storage.playbackUrl,
            thumbnailUrl: storage.thumbnailUrl,
            ready: storage.ready,
            r2Key: storage.r2Key,
            r2Bucket: storage.r2Bucket,
          },
          downloadUrl: storage.downloadUrl,
        });
      } catch (err: any) {
        // Rydd opp temp-fila ved feil
        try {
          await fs.rm(tempPath, { force: true });
        } catch {}
        console.error("[uploads] /api/uploads/file failed:", err);
        const message = String(err?.message || "Ukjent feil").slice(0, 200);
        res.status(500).json({
          success: false,
          error: "upload_failed",
          message,
        });
      }
    },
  );

  // Diagnose hva som er aktiv backend
  app.get("/api/uploads/storage-status", (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    res.json({ success: true, ...getStorageStatus() });
  });
}
