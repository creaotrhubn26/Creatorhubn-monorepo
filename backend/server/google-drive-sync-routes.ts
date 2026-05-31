// Google Drive sync — bygger mappestrukturen + kopierer fil-bytes til
// Fredriks Drive-konto. Tidligere kalte frontend
// `/api/google-drive/sync-uploads-to-project-folders` som ikke eksisterte i
// backend i det hele tatt; sync feilet derfor stille med 404 og frontend
// viste bare "Failed to sync to Google Drive".
//
// Endepunktet:
//   1. Laster Drive-klient med automatisk token-refresh (google-drive-helpers).
//   2. Sjekker Drive-kvote før vi prøver å lage noe.
//   3. Sikrer at root-mappa for prosjektet eksisterer (idempotent).
//   4. Lager target-undermappa (f.eks. "01_Raw") under prosjekt-mappa.
//   5. For hver item med fileId (referanse til chunked_uploads): henter
//      bytes fra storage-backend (filesystem eller R2) og kopierer til
//      Drive via files.create med media body. Stream-videoer hoppes
//      over (de lever som streaming, ikke files). Per-fil retry på
//      429/5xx + 401-reauth.

import express from "express";
import type { Pool } from "pg";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as path from "path";
import * as os from "os";
import { Readable } from "stream";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  loadDriveClient,
  ensureDriveFolder,
  checkDriveQuota,
  withDriveRetry,
  mapDriveError,
} from "./google-drive-helpers.js";

const CHUNKED_UPLOAD_ROOT =
  process.env.CHUNKED_UPLOAD_DIR ||
  path.join(os.tmpdir(), "creatorhub-chunked-uploads");

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

export interface GoogleDriveSyncRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
}

const PROJECT_ROOT_BASE = "Creatorhubn Photographer";

const safeFolderName = (raw: unknown, fallback: string): string => {
  if (typeof raw !== "string") return fallback;
  // Strip risky chars for Drive-query og rim av whitespace
  const cleaned = raw.replace(/[\\/:*?"<>|]/g, " ").trim();
  return cleaned.length > 0 ? cleaned.slice(0, 120) : fallback;
};

export function setupGoogleDriveSyncRoutes(
  deps: GoogleDriveSyncRoutesDeps,
): void {
  const { app, pool, requireUserSession } = deps;

  app.post(
    "/api/google-drive/sync-uploads-to-project-folders",
    async (req, res) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = session.userId;

      const {
        items = [],
        projectId,
        projectName,
        clientName,
        targetFolder = "01_Raw",
        googleDriveFolderId,
      } = req.body || {};

      try {
        const { driveApi, oauthClient } = await loadDriveClient(pool, userId);

        // Kvotesjekk. Vi vet ikke fil-størrelsene her (frontend sender bare
        // metadata), så vi sjekker minst at det er litt plass igjen.
        const quota = await checkDriveQuota(driveApi, 10 * 1024 * 1024);
        if (!quota.hasSpace) {
          return res.status(507).json({
            success: false,
            error: "drive_quota_full",
            message:
              "Google Drive er fullt. Rydd plass eller oppgrader lagringen før du prøver igjen.",
            quota,
          });
        }

        // Bygg eller finn root-mappa for prosjektet.
        let projectFolderId: string;

        const onReauth = async () => {
          try {
            await oauthClient.getAccessToken();
          } catch {}
        };

        if (typeof googleDriveFolderId === "string" && googleDriveFolderId) {
          // Bekreft at mappa fortsatt eksisterer (kan ha blitt slettet).
          try {
            await withDriveRetry(
              () =>
                driveApi.files.get({
                  fileId: googleDriveFolderId,
                  fields: "id, name, trashed",
                }),
              { onReauth },
            );
            projectFolderId = googleDriveFolderId;
          } catch (err: any) {
            // Hvis mappa er borte, lag ny under root
            const root = await ensureDriveFolder(driveApi, PROJECT_ROOT_BASE);
            const folderName = safeFolderName(
              projectName,
              `Prosjekt ${projectId || ""}`.trim() || "Uten navn",
            );
            const compositeName = clientName
              ? `${folderName} — ${safeFolderName(clientName, "Klient")}`
              : folderName;
            projectFolderId = await ensureDriveFolder(
              driveApi,
              compositeName,
              root,
            );
          }
        } else {
          const root = await ensureDriveFolder(driveApi, PROJECT_ROOT_BASE);
          const folderName = safeFolderName(
            projectName,
            `Prosjekt ${projectId || ""}`.trim() || "Uten navn",
          );
          const compositeName = clientName
            ? `${folderName} — ${safeFolderName(clientName, "Klient")}`
            : folderName;
          projectFolderId = await ensureDriveFolder(
            driveApi,
            compositeName,
            root,
          );
        }

        // Sikre target-undermappa (f.eks. "01_Raw")
        const targetFolderName = safeFolderName(targetFolder, "01_Raw");
        const targetFolderId = await ensureDriveFolder(
          driveApi,
          targetFolderName,
          projectFolderId,
        );

        // For hver item: hvis fileId (eller id som peker til chunked_uploads)
        // er sendt inn, hent bytes fra storage-backend og last opp til Drive.
        // Stream-videoer hoppes over — de er ikke filer.
        const driveItems: Array<{
          id: string | null;
          fileName: string;
          status: string;
          driveFileId?: string;
          driveFileUrl?: string;
          message?: string;
        }> = [];

        const itemsArray = Array.isArray(items) ? items : [];
        for (const item of itemsArray) {
          const itemId: string | null =
            item?.fileId || item?.chunkedUploadId || item?.id || null;
          const itemName = String(
            item?.name || item?.fileName || "ukjent",
          ).slice(0, 200);

          if (!itemId) {
            driveItems.push({
              id: null,
              fileName: itemName,
              status: "skipped_no_id",
              message: "Item mangler fileId — kan ikke finne kilden.",
            });
            continue;
          }

          // Slå opp i chunked_uploads
          const lookup = await pool.query(
            `SELECT file_name, mime_type, final_file_path, metadata
               FROM chunked_uploads
              WHERE (final_file_id = $1 OR id::text = $1)
                AND user_id = $2
                AND status = 'completed'`,
            [itemId, userId],
          );
          if ((lookup.rowCount ?? 0) === 0) {
            driveItems.push({
              id: itemId,
              fileName: itemName,
              status: "skipped_not_found",
              message: "Fant ikke fila i chunked_uploads.",
            });
            continue;
          }
          const row = lookup.rows[0];
          const metadata =
            row.metadata && typeof row.metadata === "object" ? row.metadata : {};
          const backend = metadata.storageBackend as string | undefined;
          const mime = row.mime_type || "application/octet-stream";

          if (backend === "cloudflare_stream") {
            driveItems.push({
              id: itemId,
              fileName: row.file_name,
              status: "skipped_stream",
              message:
                "Video er lagret i Cloudflare Stream som streaming, ikke fil — hoppes over.",
            });
            continue;
          }

          // Bygg lesestrøm fra riktig backend
          let bodyStream: Readable | null = null;
          let bytesLength: number | undefined;

          try {
            if (backend === "r2") {
              const r2 = getGenericR2();
              if (!r2) {
                driveItems.push({
                  id: itemId,
                  fileName: row.file_name,
                  status: "failed",
                  message: "R2 er ikke konfigurert i miljøvariabler.",
                });
                continue;
              }
              const key = metadata.r2Key as string | undefined;
              if (!key) {
                driveItems.push({
                  id: itemId,
                  fileName: row.file_name,
                  status: "failed",
                  message: "R2-key mangler i metadata.",
                });
                continue;
              }
              const obj = await r2.client.send(
                new GetObjectCommand({ Bucket: r2.bucket, Key: key }),
              );
              if (!obj.Body) {
                driveItems.push({
                  id: itemId,
                  fileName: row.file_name,
                  status: "failed",
                  message: "R2 returnerte tom body.",
                });
                continue;
              }
              bodyStream = obj.Body as Readable;
              bytesLength = obj.ContentLength;
            } else {
              // filesystem
              const fullPath = path.join(
                CHUNKED_UPLOAD_ROOT,
                row.final_file_path,
              );
              if (!fullPath.startsWith(CHUNKED_UPLOAD_ROOT)) {
                driveItems.push({
                  id: itemId,
                  fileName: row.file_name,
                  status: "failed",
                  message: "Ugyldig sti i metadata.",
                });
                continue;
              }
              try {
                const stat = await fsPromises.stat(fullPath);
                bytesLength = stat.size;
              } catch {}
              bodyStream = fs.createReadStream(fullPath);
            }

            // Last opp til Drive med retry
            const driveRes = await withDriveRetry<any>(
              () =>
                driveApi.files.create({
                  requestBody: {
                    name: row.file_name,
                    parents: [targetFolderId],
                    mimeType: mime,
                  },
                  media: { mimeType: mime, body: bodyStream! },
                  fields: "id, webViewLink",
                }),
              { onReauth },
            );

            driveItems.push({
              id: itemId,
              fileName: row.file_name,
              status: "uploaded",
              driveFileId: driveRes?.data?.id ?? undefined,
              driveFileUrl: driveRes?.data?.webViewLink ?? undefined,
            });
          } catch (err: any) {
            const mapped = mapDriveError(err);
            driveItems.push({
              id: itemId,
              fileName: row.file_name,
              status: "failed",
              message: mapped.message,
            });
          }
        }

        const counts = driveItems.reduce(
          (acc, it) => {
            acc[it.status] = (acc[it.status] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        res.json({
          success: true,
          folderId: targetFolderId,
          projectFolderId,
          folderUrl: `https://drive.google.com/drive/folders/${targetFolderId}`,
          items: driveItems,
          counts,
          quota: {
            limit: quota.limit,
            usage: quota.usage,
            free: quota.free,
          },
          note: itemsArray.length
            ? `Mappestruktur klar + ${counts.uploaded || 0} fil(er) kopiert til Drive. ${counts.skipped_stream || 0} video(er) hoppet over (lagres i Cloudflare Stream).`
            : "Mappestrukturen er klar i Drive.",
        });
      } catch (err: any) {
        const mapped = mapDriveError(err);
        console.error(
          "[drive-sync] /api/google-drive/sync-uploads-to-project-folders failed:",
          mapped.code,
          err?.message,
        );
        res.status(mapped.status).json({
          success: false,
          error: mapped.code,
          message: mapped.message,
        });
      }
    },
  );
}
