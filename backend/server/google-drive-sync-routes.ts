// Google Drive sync — bygger mappestrukturen som UniversalFileUpload trenger
// i Fredriks Drive-konto. Tidligere kalte frontend
// `/api/google-drive/sync-uploads-to-project-folders` som ikke eksisterte i
// backend i det hele tatt; sync feilet derfor stille med 404 og frontend
// viste bare "Failed to sync to Google Drive".
//
// Endepunktet:
//   1. Laster Drive-klient med automatisk token-refresh (google-drive-helpers).
//   2. Sjekker Drive-kvote før vi prøver å lage noe.
//   3. Sikrer at root-mappa for prosjektet eksisterer (idempotent).
//   4. Lager target-undermappa (f.eks. "01_Raw") under prosjekt-mappa.
//   5. Returnerer ferdig folder-struktur + items markert som "ready".
//
// Det faktiske oppload-trinnet (kopiere filer fra intern lagring til Drive)
// er en separat operasjon (`upload-contextual`); det krever fil-bytes som
// ikke alltid er tilgjengelig på vår side. Dette endepunktet gir Fredrik
// minst en ærlig folder-setup-respons i stedet for 404.

import express from "express";
import type { Pool } from "pg";
import {
  loadDriveClient,
  ensureDriveFolder,
  checkDriveQuota,
  withDriveRetry,
  mapDriveError,
} from "./google-drive-helpers.js";

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

        const driveItems = Array.isArray(items)
          ? items.map((item: any) => ({
              id: item?.id ?? null,
              fileName: item?.name ?? item?.fileName ?? "ukjent",
              status: "folder_ready",
              targetFolderId,
            }))
          : [];

        res.json({
          success: true,
          folderId: targetFolderId,
          projectFolderId,
          folderUrl: `https://drive.google.com/drive/folders/${targetFolderId}`,
          items: driveItems,
          quota: {
            limit: quota.limit,
            usage: quota.usage,
            free: quota.free,
          },
          note: items?.length
            ? "Mappestrukturen er klar i Drive. Last opp filer på nytt for å kopiere dem dit, eller bruk fil-upload-flowen for å pushe direkte."
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
