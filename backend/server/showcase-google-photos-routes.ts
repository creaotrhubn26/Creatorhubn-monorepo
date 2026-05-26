/**
 * showcase-google-photos-routes.ts
 *
 * Setup-funksjon for /api/showcase/sync-google-photos +
 * /api/showcase/import-google-photos endpoints — sync av bilder fra
 * Google Photos inn i showcase-items.
 *
 * 2 endpoints:
 *   - POST /sync-google-photos     (oppretter showcase-items fra rå
 *                                   Google Photos-data i payload)
 *   - POST /import-google-photos   (oppretter fra forhåndssynkronisert
 *                                   Google-album, basert på photoIds)
 *
 * NB: De andre /api/google-photos/*-endpoints (test-connection, auth,
 * albums) er ikke under /api/showcase/ og blir værende i index.ts.
 *
 * Auth: åpen — userId fra payload/header.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupShowcaseGooglePhotosRoutes } from "./showcase-google-photos-routes";
 *
 *   setupShowcaseGooglePhotosRoutes({
 *     app,
 *     getShowcaseGoogleAlbumPhotos,
 *     createShowcaseItemRecord,
 *     mapShowcaseItemRow,
 *   });
 *
 * Mode-noter: ingen mode-branching.
 */

import type express from "express";

import { readString, readStringArray } from "./_shared";

interface ShowcaseGooglePhotoRecord {
  id: string;
  filename: string;
  baseUrl: string;
  mimeType: string;
  creationTime: string;
  productUrl: string;
  width?: string;
  height?: string;
}

export interface ShowcaseGooglePhotosRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  getShowcaseGoogleAlbumPhotos: (
    albumId: string,
  ) => Promise<ShowcaseGooglePhotoRecord[]>;
  createShowcaseItemRecord: (
    payload: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  mapShowcaseItemRow: (row: Record<string, unknown>) => Record<string, unknown>;
}

export function setupShowcaseGooglePhotosRoutes(
  deps: ShowcaseGooglePhotosRoutesDeps,
): void {
  const {
    app,
    requireUserSession,
    getShowcaseGoogleAlbumPhotos,
    createShowcaseItemRecord,
    mapShowcaseItemRow,
  } = deps;

  app.post("/api/showcase/sync-google-photos", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const payload = req.body as Record<string, unknown>;
      const userId =
        readString(payload.userId) ||
        readString(req.headers["x-user-id"]) ||
        "system";
      const profession = readString(payload.profession) || "photographer";
      const items = Array.isArray(payload.items) ? payload.items : [];
      const createdItems: Array<Record<string, unknown>> = [];
      for (const item of items as Array<Record<string, unknown>>) {
        const baseUrl = readString(item.baseUrl) || readString(item.url) || "";
        if (!baseUrl) continue;
        const created = await createShowcaseItemRecord({
          userId,
          profession,
          title:
            readString(item.filename) ||
            readString(item.title) ||
            `Google Photos ${readString(item.id) || ""}`,
          description: readString(item.description) || "",
          category: "Google Photos",
          fileUrl: baseUrl,
          thumbnailUrl: baseUrl,
          tags: readStringArray(item.tags),
          googlePhotosData: item,
        });
        createdItems.push(mapShowcaseItemRow(created));
      }
      res.json({ success: true, createdCount: createdItems.length, items: createdItems });
    } catch (error) {
      console.error("Error syncing Google Photos to showcase:", error);
      res.status(500).json({ error: "Kunne ikke synkronisere Google Photos" });
    }
  });

  app.post("/api/showcase/import-google-photos", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const payload = req.body as Record<string, unknown>;
      const photoIds = new Set(readStringArray(payload.photoIds));
      const albumId = readString(payload.albumId);
      const userId =
        readString(payload.userId) ||
        readString(req.headers["x-user-id"]) ||
        "system";
      const profession = readString(payload.profession) || "photographer";
      const photos = albumId ? await getShowcaseGoogleAlbumPhotos(albumId) : [];
      const selected = photos.filter((photo) => photoIds.has(photo.id));
      const createdItems: Array<Record<string, unknown>> = [];
      for (const photo of selected) {
        const created = await createShowcaseItemRecord({
          userId,
          profession,
          title: photo.filename,
          category: "Google Photos",
          fileUrl: photo.baseUrl,
          thumbnailUrl: photo.baseUrl,
          googlePhotosData: photo,
        });
        createdItems.push(mapShowcaseItemRow(created));
      }
      res.json({ success: true, createdCount: createdItems.length, items: createdItems });
    } catch (error) {
      console.error("Error importing Google Photos into showcase:", error);
      res.status(500).json({ error: "Kunne ikke importere Google Photos" });
    }
  });
}
