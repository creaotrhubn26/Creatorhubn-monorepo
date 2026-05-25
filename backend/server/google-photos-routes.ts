import express from "express";
import type { Pool } from "pg";
import type { Multer } from "multer";
import crypto from "crypto";
import { readString, readStringArray } from "./_shared";

export interface GooglePhotosRoutesDeps {
  app: express.Application;
  pool: Pool;
  showcaseMediaUpload: Multer;
  buildGooglePhotosStatusSnapshot: () => Promise<any>;
  getShowcaseGoogleAlbums: (userId: string) => Promise<any[]>;
  setShowcaseGoogleAlbums: (
    userId: string,
    albums: any[],
  ) => Promise<void>;
  getShowcaseGoogleAlbumPhotos: (albumId: string) => Promise<any[]>;
  setShowcaseGoogleAlbumPhotos: (
    albumId: string,
    photos: any[],
  ) => Promise<void>;
  mapGooglePhotoRow: (row: Record<string, unknown>) => any;
  fileBufferToDataUrl: (file: Express.Multer.File) => string;
}

export function setupGooglePhotosRoutes(
  deps: GooglePhotosRoutesDeps,
): void {
  const {
    app,
    pool,
    showcaseMediaUpload,
    buildGooglePhotosStatusSnapshot,
    getShowcaseGoogleAlbums,
    setShowcaseGoogleAlbums,
    getShowcaseGoogleAlbumPhotos,
    setShowcaseGoogleAlbumPhotos,
    mapGooglePhotoRow,
    fileBufferToDataUrl,
  } = deps;

  app.get("/api/google-photos/test-connection", async (_req, res) => {
    const snapshot = await buildGooglePhotosStatusSnapshot();
    res.json({
      success: snapshot.connected,
      authenticated: snapshot.connected,
      message: snapshot.connected
        ? `Koblet til ${snapshot.itemsSynced} elementer`
        : "Google Photos er ikke koblet til",
      itemsSynced: snapshot.itemsSynced,
      lastSynced: snapshot.lastSynced,
    });
  });

  app.get("/api/google-photos/auth", async (_req, res) => {
    res.json({
      success: true,
      authUrl: "https://photos.google.com",
    });
  });

  app.get("/api/google-photos/albums", async (req, res) => {
    try {
      const userId =
        readString(req.headers["x-user-id"]) ||
        readString(req.headers["x-user-email"]) ||
        "system";
      const compatAlbums = await getShowcaseGoogleAlbums(userId);
      const syncedResult = await pool
        .query(
          `SELECT COUNT(*)::int AS total, MAX(base_url) AS cover FROM google_photos`,
        )
        .catch(() => ({ rows: [{ total: 0, cover: null }] }));
      const syncedCount = Number(syncedResult.rows[0]?.total || 0);
      const albums = [...compatAlbums];
      if (syncedCount > 0) {
        albums.unshift({
          id: "synced-library",
          title: "Google Photos bibliotek",
          description: "Synkroniserte bilder lagret i CreatorHub",
          mediaItemsCount: String(syncedCount),
          coverPhotoBaseUrl:
            readString(syncedResult.rows[0]?.cover) || undefined,
          productUrl: "https://photos.google.com",
          isWriteable: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      res.json({ albums });
    } catch (error) {
      console.error("Error loading Google Photos albums:", error);
      res
        .status(500)
        .json({ error: "Kunne ikke hente Google Photos-album" });
    }
  });

  app.get(
    "/api/google-photos/albums/:albumId/photos",
    async (req, res) => {
      try {
        if (req.params.albumId === "synced-library") {
          const result = await pool
            .query(
              `SELECT * FROM google_photos ORDER BY creation_time DESC NULLS LAST, created_at DESC NULLS LAST`,
            )
            .catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
          return res.json({ photos: result.rows.map(mapGooglePhotoRow) });
        }
        const photos = await getShowcaseGoogleAlbumPhotos(req.params.albumId);
        res.json({ photos });
      } catch (error) {
        console.error("Error loading Google Photos album photos:", error);
        res.status(500).json({ error: "Kunne ikke hente bilder fra album" });
      }
    },
  );

  app.post("/api/google-photos/albums/create", async (req, res) => {
    try {
      const payload = req.body as Record<string, unknown>;
      const userId =
        readString(req.headers["x-user-id"]) ||
        readString(req.headers["x-user-email"]) ||
        "system";
      const albums = await getShowcaseGoogleAlbums(userId);
      const now = new Date().toISOString();
      const album: any = {
        id: crypto.randomUUID(),
        title: readString(payload.title) || "Nytt album",
        description: readString(payload.description) || "",
        mediaItemsCount: "0",
        productUrl: "https://photos.google.com",
        isWriteable: true,
        profession: readString(payload.profession) || undefined,
        projectId: readString(payload.projectId) || undefined,
        createdAt: now,
        updatedAt: now,
      };
      await setShowcaseGoogleAlbums(userId, [album, ...albums]);
      await setShowcaseGoogleAlbumPhotos(album.id, []);
      res.status(201).json({ album });
    } catch (error) {
      console.error("Error creating Google Photos album:", error);
      res
        .status(500)
        .json({ error: "Kunne ikke opprette Google Photos-album" });
    }
  });

  app.post(
    "/api/google-photos/albums/:albumId/share",
    async (req, res) => {
      try {
        const userId =
          readString(req.headers["x-user-id"]) ||
          readString(req.headers["x-user-email"]) ||
          "system";
        const albums = await getShowcaseGoogleAlbums(userId);
        const updatedAlbums = albums.map((album: any) =>
          album.id === req.params.albumId
            ? {
                ...album,
                updatedAt: new Date().toISOString(),
                shareInfo: {
                  shareToken: crypto.randomUUID(),
                  shareableUrl: `https://photos.google.com/share/${req.params.albumId}`,
                  isOwned: true,
                  isJoined: true,
                },
              }
            : album,
        );
        await setShowcaseGoogleAlbums(userId, updatedAlbums);
        const updated = updatedAlbums.find(
          (album: any) => album.id === req.params.albumId,
        );
        if (!updated) {
          return res.status(404).json({ error: "Album ikke funnet" });
        }
        res.json({ album: updated });
      } catch (error) {
        console.error("Error sharing Google Photos album:", error);
        res.status(500).json({ error: "Kunne ikke dele album" });
      }
    },
  );

  app.post(
    "/api/google-photos/upload",
    showcaseMediaUpload.any(),
    async (req, res) => {
      try {
        const albumId = readString(req.body?.albumId) || null;
        if (!albumId) {
          return res.status(400).json({ error: "albumId er paakrevd" });
        }
        const files = Array.isArray(req.files)
          ? (req.files as Express.Multer.File[])
          : [];
        const existingPhotos =
          await getShowcaseGoogleAlbumPhotos(albumId);
        const createdPhotos: any[] = [];
        for (const file of files) {
          const photo: any = {
            id: crypto.randomUUID(),
            filename: file.originalname,
            baseUrl: fileBufferToDataUrl(file),
            mimeType: file.mimetype,
            creationTime: new Date().toISOString(),
            productUrl: "https://photos.google.com",
          };
          createdPhotos.push(photo);
          await pool
            .query(
              `INSERT INTO google_photos (id, media_item_id, filename, mime_type, base_url, creation_time, last_synced, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW(), NOW())
               ON CONFLICT (media_item_id)
               DO UPDATE SET filename = EXCLUDED.filename, mime_type = EXCLUDED.mime_type, base_url = EXCLUDED.base_url, updated_at = NOW(), last_synced = NOW()`,
              [
                crypto.randomUUID(),
                photo.id,
                photo.filename,
                photo.mimeType,
                photo.baseUrl,
              ],
            )
            .catch(() => undefined);
        }
        const nextPhotos = [...createdPhotos, ...existingPhotos];
        await setShowcaseGoogleAlbumPhotos(albumId, nextPhotos);
        res.json({ success: true, photos: createdPhotos });
      } catch (error) {
        console.error("Error uploading Google Photos media:", error);
        res
          .status(500)
          .json({ error: "Kunne ikke laste opp til Google Photos" });
      }
    },
  );

  app.post("/api/google-photos/upload-for-edit", async (req, res) => {
    try {
      const payload = req.body as Record<string, unknown>;
      const imageIds = readStringArray(payload.imageIds);
      const userId =
        readString(payload.userId) ||
        readString(req.headers["x-user-id"]) ||
        "system";
      const albumId = crypto.randomUUID();
      const albumName =
        readString(payload.albumName) ||
        `CreatorHub Editing ${new Date().toLocaleDateString("no-NO")}`;
      const album: any = {
        id: albumId,
        title: albumName,
        description: "Bilder sendt fra CreatorHub for redigering",
        mediaItemsCount: String(imageIds.length),
        productUrl: `https://photos.google.com/album/${albumId}`,
        isWriteable: true,
        projectId: readString(payload.projectId) || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const rows = await pool.query(
        `SELECT id, title, image_url, thumbnail_url
           FROM showcase_items
          WHERE id = ANY($1)`,
        [imageIds],
      );
      const photos = rows.rows.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        filename: readString(row.title) || `Showcase ${String(row.id)}`,
        baseUrl:
          readString(row.image_url) || readString(row.thumbnail_url) || "",
        mimeType: "image/jpeg",
        creationTime: new Date().toISOString(),
        productUrl: `https://photos.google.com/album/${albumId}`,
      }));

      const albums = await getShowcaseGoogleAlbums(userId);
      await setShowcaseGoogleAlbums(userId, [album, ...albums]);
      await setShowcaseGoogleAlbumPhotos(albumId, photos);
      res.json({
        success: true,
        albumId,
        albumUrl: album.productUrl,
        uploadedCount: photos.length,
      });
    } catch (error) {
      console.error(
        "Error uploading showcase images for Google Photos edit:",
        error,
      );
      res
        .status(500)
        .json({ error: "Kunne ikke sende bilder til Google Photos" });
    }
  });
}
