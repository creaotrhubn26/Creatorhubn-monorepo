/**
 * backup-routes.ts
 *
 * Standalone modul for Google Workspace backup-endpoints. Ekstraktert
 * fra backend/server/index.ts (linje 24306-24500) som del av backend-
 * extraction-roadmappen.
 *
 * 3 endpoints:
 *   - GET  /api/backup/status         — read latest backup metadata
 *   - POST /api/backup/create         — opprett ny backup (lokal + Drive)
 *   - GET  /api/backup/download/latest — last ned siste backup som JSON
 *
 * Wire opp i backend/server/index.ts:
 *
 *   import { setupBackupRoutes } from "./backup-routes";
 *
 *   setupBackupRoutes({
 *     app,
 *     pool,
 *     readGoogleWorkspaceBackupStatus,
 *     derivePreferredGoogleWorkspaceOauthApps,
 *     buildGoogleWorkspaceStorageSnapshot,
 *     buildGoogleContactsStatusSnapshot,
 *     buildGooglePhotosStatusSnapshot,
 *     resolveRoleRoomGoogleConnection,
 *     ensureGoogleDriveBackupFolder,
 *     sanitizeBackupFileSegment,
 *     ensureGoogleWorkspaceBackupDir,
 *     getGoogleWorkspaceLatestBackupPath,
 *     getGoogleWorkspaceLatestBackupMetaPath,
 *   });
 */

import type express from "express";
import type { Pool } from "pg";
import { google } from "googleapis";
import * as fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { Readable } from "stream";

// Deps bruker `any` for å hold seg unna kompleks Google-type-grafen som
// importeres til index.ts. Følger samme mønster som andre route-extractions
// (akseptert trade-off mot enklere dep-wiring).
export interface BackupRoutesDeps {
  app: express.Application;
  pool: Pool;
  // index.ts readString returnerer string | null — bruk samme signatur så
  // wiring matcher (vi koalescerer til "" inni route-handlers ved behov).
  readString: (value: unknown) => string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readGoogleWorkspaceBackupStatus: (userId: string) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  derivePreferredGoogleWorkspaceOauthApps: (req: express.Request) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildGoogleWorkspaceStorageSnapshot: (userId: string, preferredOauthApps: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildGoogleContactsStatusSnapshot: (userId: string, preferredOauthApps: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildGooglePhotosStatusSnapshot: () => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolveRoleRoomGoogleConnection: (pool: Pool, userId: string, opts: { preferredOauthApps: any }) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ensureGoogleDriveBackupFolder: (driveApi: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sanitizeBackupFileSegment: (value: any, fallback: string) => string;
  ensureGoogleWorkspaceBackupDir: (userId: string) => Promise<string>;
  getGoogleWorkspaceLatestBackupPath: (userId: string) => string;
  getGoogleWorkspaceLatestBackupMetaPath: (userId: string) => string;
}

export function setupBackupRoutes(deps: BackupRoutesDeps): void {
  const {
    app,
    pool,
    readString,
    readGoogleWorkspaceBackupStatus,
    derivePreferredGoogleWorkspaceOauthApps,
    buildGoogleWorkspaceStorageSnapshot,
    buildGoogleContactsStatusSnapshot,
    buildGooglePhotosStatusSnapshot,
    resolveRoleRoomGoogleConnection,
    ensureGoogleDriveBackupFolder,
    sanitizeBackupFileSegment,
    ensureGoogleWorkspaceBackupDir,
    getGoogleWorkspaceLatestBackupPath,
    getGoogleWorkspaceLatestBackupMetaPath,
  } = deps;

  app.get("/api/backup/status", async (req, res) => {
    try {
      const userId =
        readString(req.query.userId) ||
        readString(req.headers["x-user-id"]) ||
        "guest";
      const status = await readGoogleWorkspaceBackupStatus(userId);
      res.json(status);
    } catch (error) {
      console.error("Error fetching backup status:", error);
      res.status(500).json({ error: "Could not fetch backup status" });
    }
  });

  app.post("/api/backup/create", async (req, res) => {
    try {
      const userId =
        readString(req.body?.userId) ||
        readString(req.headers["x-user-id"]) ||
        "guest";
      if (userId === "guest") {
        return res
          .status(400)
          .json({ error: "Bruker-ID kreves for å opprette backup." });
      }

      const profession = readString(req.body?.profession) || "general";
      const projectId = readString(req.body?.projectId);
      const projectName = readString(req.body?.projectName);
      const customerId = readString(req.body?.customerId);
      const customerName = readString(req.body?.customerName);
      const companyName = readString(req.body?.companyName);

      const preferredOauthApps = derivePreferredGoogleWorkspaceOauthApps(req);
      const storageSnapshot = await buildGoogleWorkspaceStorageSnapshot(
        userId,
        preferredOauthApps,
      );
      if (!storageSnapshot.googleDriveConnected) {
        return res.status(409).json({
          error:
            "Google Workspace må være koblet til før backup kan lagres i Google Drive.",
        });
      }

      const [contactsSnapshot, photosSnapshot, existingBackupStatus] =
        await Promise.all([
          buildGoogleContactsStatusSnapshot(userId, preferredOauthApps),
          buildGooglePhotosStatusSnapshot(),
          readGoogleWorkspaceBackupStatus(userId),
        ]);

      const backupCreatedAt = new Date().toISOString();
      const backupManifest = {
        version: 1,
        createdAt: backupCreatedAt,
        userId,
        profession,
        project: {
          projectId,
          projectName,
          customerId,
          customerName,
          companyName,
        },
        previousBackup: existingBackupStatus.available
          ? existingBackupStatus
          : null,
        workspace: {
          storage: storageSnapshot,
          contacts: contactsSnapshot,
          photos: photosSnapshot,
        },
      };

      const authorized = await resolveRoleRoomGoogleConnection(pool, userId, {
        preferredOauthApps,
      });
      const driveApi = google.drive({
        version: "v3",
        auth: authorized.oauthClient as Parameters<typeof google.drive>[0]["auth"],
      });
      const backupFolder = await ensureGoogleDriveBackupFolder(driveApi);
      const timestampToken = backupCreatedAt.replace(/[:.]/g, "-");
      const professionToken = sanitizeBackupFileSegment(profession, "workspace");
      const projectToken = sanitizeBackupFileSegment(projectName, "general");
      const backupFileName = `${professionToken}-${projectToken}-backup-${timestampToken}.json`;
      const serializedManifest = JSON.stringify(backupManifest, null, 2);

      const driveFile = await driveApi.files.create({
        requestBody: {
          name: backupFileName,
          parents: [backupFolder.id],
          description: [
            "CreatorHub Google Workspace backup",
            projectName || null,
            customerName || companyName || null,
          ]
            .filter(Boolean)
            .join(" • "),
        },
        media: {
          mimeType: "application/json",
          body: Readable.from([serializedManifest]),
        },
        supportsAllDrives: true,
        fields: "id,name,webViewLink,modifiedTime,size",
      });

      const backupDirectory = await ensureGoogleWorkspaceBackupDir(userId);
      const latestPath = getGoogleWorkspaceLatestBackupPath(userId);
      const latestMetaPath = getGoogleWorkspaceLatestBackupMetaPath(userId);
      const versionedPath = path.join(backupDirectory, backupFileName);

      await Promise.all([
        fs.writeFile(versionedPath, serializedManifest, "utf8"),
        fs.writeFile(latestPath, serializedManifest, "utf8"),
        fs.writeFile(
          latestMetaPath,
          JSON.stringify(
            {
              createdAt: backupCreatedAt,
              fileName: backupFileName,
              driveFileId: readString(driveFile.data.id),
              driveWebViewLink: readString(driveFile.data.webViewLink),
              profession,
              projectId,
              projectName,
              customerId,
              customerName,
              companyName,
            },
            null,
            2,
          ),
          "utf8",
        ),
      ]);

      return res.status(201).json({
        success: true,
        createdAt: backupCreatedAt,
        fileName: backupFileName,
        localPath: versionedPath,
        driveFolderId: backupFolder.id,
        driveFolderName: backupFolder.name,
        driveFolderWebViewLink: backupFolder.webViewLink,
        driveFileId: readString(driveFile.data.id),
        driveFileWebViewLink: readString(driveFile.data.webViewLink),
        downloadUrl: `/api/backup/download/latest?userId=${encodeURIComponent(userId)}`,
      });
    } catch (error) {
      console.error("Error creating Google Workspace backup:", error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Could not create Google Workspace backup",
      });
    }
  });

  app.get("/api/backup/download/latest", async (req, res) => {
    try {
      const userId =
        readString(req.query.userId) ||
        readString(req.headers["x-user-id"]) ||
        "guest";
      if (userId === "guest") {
        return res
          .status(400)
          .json({ error: "Bruker-ID kreves for å laste ned backup." });
      }

      const latestPath = getGoogleWorkspaceLatestBackupPath(userId);
      const status = await readGoogleWorkspaceBackupStatus(userId);
      if (!existsSync(latestPath) || !status.available) {
        return res
          .status(404)
          .json({ error: "Fant ingen lagret backup for denne brukeren." });
      }

      const payload = await fs.readFile(latestPath, "utf8");
      const fileName =
        status.fileName || `creatorhub-google-workspace-backup-${userId}.json`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(payload);
    } catch (error) {
      console.error("Error downloading latest backup:", error);
      res.status(500).json({ error: "Could not download latest backup" });
    }
  });
}
