/**
 * showcase-image-ops-routes.ts
 *
 * Setup-funksjon for image-manipulasjons- og bulk-operasjons-endpoints
 * under /api/showcase/. Avslutter showcase-clusteret — etter denne
 * commiten er alle 60 showcase-endpoints ekstraktert.
 *
 * 12 endpoints:
 *   - POST   /upload-media               (multer single/many file upload)
 *   - POST   /bulk-upload                (multer + auto-create showcase-items)
 *   - POST   /enhance-photo              (lagre enhancement-preset på item)
 *   - POST   /crop                       (lagre crop-aspectRatio på items)
 *   - POST   /watermark                  (lagre vannmerke-config på items)
 *   - POST   /copy-images                (kopier til target-prosjekt/kategori)
 *   - POST   /move-images                (flytt items)
 *   - POST   /toggle-favorite            (toggle favorite-flag i crop_data)
 *   - POST   /archive-images             (bulk is_active = false)
 *   - DELETE /delete-images              (bulk DELETE)
 *   - POST   /quick-transform            (logg transform-historikk)
 *   - POST   /bulk-download              (zip-streaming via archiver)
 *
 * Auth: åpen — userId fra payload/header.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupShowcaseImageOpsRoutes } from "./showcase-image-ops-routes";
 *
 *   setupShowcaseImageOpsRoutes({
 *     app, pool,
 *     showcaseMediaUpload, fileBufferToDataUrl, persistUploadedShowcaseAsset,
 *     inferShowcaseFileType,
 *     mapShowcaseItemRow, updateShowcaseItemRecord, createShowcaseItemRecord,
 *     getShowcaseCollectionShowcaseIds, setShowcaseCollectionShowcaseIds,
 *   });
 *
 * Mode-noter: ingen mode-branching.
 */

import type express from "express";
import type { Pool } from "pg";
import type { Multer } from "multer";
import crypto from "crypto";
import path from "path";
import archiver from "archiver";

import {
  readNumber,
  readString,
  readStringArray,
  normalizeJsonObjectField,
} from "./_shared";

interface PersistShowcaseAssetParams {
  userId: string;
  fileName: string;
  mimeType: string;
  fileUrl: string;
  size: number;
  metadata?: Record<string, unknown>;
}

export interface ShowcaseImageOpsRoutesDeps {
  app: express.Application;
  pool: Pool;
  showcaseMediaUpload: Multer;
  fileBufferToDataUrl: (file: Express.Multer.File) => string;
  persistUploadedShowcaseAsset: (
    params: PersistShowcaseAssetParams,
  ) => Promise<void>;
  inferShowcaseFileType: (
    profession: string | null,
    rawType: string | null,
    fileUrl: string | null,
  ) => string;
  mapShowcaseItemRow: (row: Record<string, unknown>) => Record<string, unknown>;
  updateShowcaseItemRecord: (
    itemId: string,
    payload: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>;
  createShowcaseItemRecord: (
    payload: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  getShowcaseCollectionShowcaseIds: (collectionId: string) => Promise<string[]>;
  setShowcaseCollectionShowcaseIds: (
    collectionId: string,
    showcaseIds: string[],
  ) => Promise<void>;
}

export function setupShowcaseImageOpsRoutes(
  deps: ShowcaseImageOpsRoutesDeps,
): void {
  const {
    app,
    pool,
    showcaseMediaUpload,
    fileBufferToDataUrl,
    persistUploadedShowcaseAsset,
    inferShowcaseFileType,
    mapShowcaseItemRow,
    updateShowcaseItemRecord,
    createShowcaseItemRecord,
    getShowcaseCollectionShowcaseIds,
    setShowcaseCollectionShowcaseIds,
  } = deps;

  app.post(
    "/api/showcase/upload-media",
    showcaseMediaUpload.any(),
    async (req, res) => {
      try {
        const files = Array.isArray(req.files)
          ? (req.files as Express.Multer.File[])
          : [];
        const userId =
          readString(req.body?.userId) ||
          readString(req.headers["x-user-id"]) ||
          "system";
        const uploaded = await Promise.all(
          files.map(async (file) => {
            const url = fileBufferToDataUrl(file);
            await persistUploadedShowcaseAsset({
              userId,
              fileName: file.originalname,
              mimeType: file.mimetype,
              fileUrl: url,
              size: file.size,
              metadata: { source: "showcase-upload-media" },
            });
            return {
              id: crypto.randomUUID(),
              name: file.originalname,
              url,
              thumbnailUrl: url,
              mimeType: file.mimetype,
              size: file.size,
            };
          }),
        );
        res.json(uploaded);
      } catch (error) {
        console.error("Error uploading showcase media:", error);
        res.status(500).json({ error: "Kunne ikke laste opp showcase-media" });
      }
    },
  );

  app.post(
    "/api/showcase/bulk-upload",
    showcaseMediaUpload.any(),
    async (req, res) => {
      try {
        const files = Array.isArray(req.files)
          ? (req.files as Express.Multer.File[])
          : [];
        const userId =
          readString(req.body?.userId) ||
          readString(req.headers["x-user-id"]) ||
          "system";
        const profession = readString(req.body?.profession) || "photographer";
        const collectionId = readString(req.body?.collectionId) || null;

        const createdItems: Array<Record<string, unknown>> = [];
        for (const file of files) {
          const url = fileBufferToDataUrl(file);
          await persistUploadedShowcaseAsset({
            userId,
            fileName: file.originalname,
            mimeType: file.mimetype,
            fileUrl: url,
            size: file.size,
            metadata: { source: "showcase-bulk-upload", collectionId },
          });
          const createdRow = await createShowcaseItemRecord({
            userId,
            profession,
            title: file.originalname.replace(/\.[^.]+$/, ""),
            description: "",
            category: collectionId ? "Collection Upload" : "Bulk Upload",
            fileUrl: url,
            thumbnailUrl: url,
            fileType: inferShowcaseFileType(profession, null, file.originalname),
            tags: [],
            metadata: {
              fileName: file.originalname,
              collectionId,
              source: "bulk-upload",
            },
            fileSize: file.size,
          });
          createdItems.push(mapShowcaseItemRow(createdRow));
        }

        if (collectionId && createdItems.length) {
          const existing = await getShowcaseCollectionShowcaseIds(collectionId);
          await setShowcaseCollectionShowcaseIds(collectionId, [
            ...existing,
            ...createdItems.map((item) => String(item.id)),
          ]);
        }

        res.json({
          success: true,
          items: createdItems,
          uploadedCount: createdItems.length,
        });
      } catch (error) {
        console.error("Error bulk-uploading showcase media:", error);
        res.status(500).json({ error: "Kunne ikke bulk-laste opp media" });
      }
    },
  );

  app.post("/api/showcase/enhance-photo", async (req, res) => {
    try {
      const payload = req.body as Record<string, unknown>;
      const itemId = readString(payload.imageId);
      if (!itemId) {
        return res.status(400).json({ error: "imageId er paakrevd" });
      }
      const updated = await updateShowcaseItemRecord(itemId, {
        transformations: {
          enhancedAt: new Date().toISOString(),
          preset: readString(payload.preset) || "custom",
          customOptions: normalizeJsonObjectField(payload.customOptions) || {},
        },
      });
      if (!updated) {
        return res.status(404).json({ error: "Bilde ikke funnet" });
      }
      res.json({ success: true, item: mapShowcaseItemRow(updated) });
    } catch (error) {
      console.error("Error enhancing showcase photo:", error);
      res.status(500).json({ error: "Kunne ikke forbedre bildet" });
    }
  });

  app.post("/api/showcase/crop", async (req, res) => {
    try {
      const payload = req.body as Record<string, unknown>;
      const itemIds = readStringArray(payload.itemIds);
      const aspectRatio = readString(payload.aspectRatio) || "free";
      const compositionOverlay =
        readString(payload.compositionOverlay) || "none";
      let successful = 0;
      for (const itemId of itemIds) {
        const updated = await updateShowcaseItemRecord(itemId, {
          transformations: {
            croppedAt: new Date().toISOString(),
            aspectRatio,
            compositionOverlay,
          },
        });
        if (updated) {
          successful += 1;
        }
      }
      res.json({
        success: true,
        summary: { total: itemIds.length, successful },
      });
    } catch (error) {
      console.error("Error cropping showcase images:", error);
      res.status(500).json({ error: "Kunne ikke beskjare bilder" });
    }
  });

  app.post("/api/showcase/watermark", async (req, res) => {
    try {
      const payload = req.body as Record<string, unknown>;
      const itemIds = readStringArray(payload.itemIds);
      let successful = 0;
      for (const itemId of itemIds) {
        const updated = await updateShowcaseItemRecord(itemId, {
          transformations: {
            watermarkedAt: new Date().toISOString(),
            watermarkType: readString(payload.watermarkType) || "text",
            text: readString(payload.text) || "",
            position: readString(payload.position) || "bottom-right",
            opacity: readNumber(payload.opacity) ?? 0.5,
          },
        });
        if (updated) {
          successful += 1;
        }
      }
      res.json({
        success: true,
        summary: { total: itemIds.length, successful },
      });
    } catch (error) {
      console.error("Error watermarking showcase images:", error);
      res.status(500).json({ error: "Kunne ikke vannmerke bilder" });
    }
  });

  app.post("/api/showcase/copy-images", async (req, res) => {
    try {
      const payload = req.body as Record<string, unknown>;
      const imageIds = readStringArray(payload.imageIds);
      const targetProject = readString(payload.targetProject) || null;
      const targetCategory = readString(payload.targetCategory) || "Portfolio";
      const rows = await pool.query(
        `SELECT * FROM showcase_items WHERE id = ANY($1)`,
        [imageIds],
      );
      const copied: string[] = [];
      for (const row of rows.rows as Array<Record<string, unknown>>) {
        const created = await createShowcaseItemRecord({
          ...row,
          id: undefined,
          projectId: targetProject,
          category: targetCategory,
          status: "draft",
        });
        copied.push(String(created.id));
      }
      res.json({ success: true, copiedIds: copied });
    } catch (error) {
      console.error("Error copying showcase images:", error);
      res.status(500).json({ error: "Kunne ikke kopiere bilder" });
    }
  });

  app.post("/api/showcase/move-images", async (req, res) => {
    try {
      const payload = req.body as Record<string, unknown>;
      const imageIds = readStringArray(payload.imageIds);
      const targetProject = readString(payload.targetProject) || null;
      const targetCategory = readString(payload.targetCategory) || "Portfolio";
      for (const imageId of imageIds) {
        await updateShowcaseItemRecord(imageId, {
          projectId: targetProject,
          category: targetCategory,
        });
      }
      res.json({ success: true, movedIds: imageIds });
    } catch (error) {
      console.error("Error moving showcase images:", error);
      res.status(500).json({ error: "Kunne ikke flytte bilder" });
    }
  });

  app.post("/api/showcase/toggle-favorite", async (req, res) => {
    try {
      const imageIds = readStringArray(req.body?.imageIds);
      const rows = await pool.query(
        `SELECT id, crop_data FROM showcase_items WHERE id = ANY($1)`,
        [imageIds],
      );
      for (const row of rows.rows as Array<Record<string, unknown>>) {
        const cropData = normalizeJsonObjectField(row.crop_data) || {};
        await updateShowcaseItemRecord(String(row.id), {
          cropData: {
            ...cropData,
            favorite: !Boolean(cropData.favorite),
          },
        });
      }
      res.json({ success: true, count: imageIds.length });
    } catch (error) {
      console.error("Error toggling showcase favorites:", error);
      res.status(500).json({ error: "Kunne ikke endre favoritter" });
    }
  });

  app.post("/api/showcase/archive-images", async (req, res) => {
    try {
      const imageIds = readStringArray(req.body?.imageIds);
      await pool.query(
        `UPDATE showcase_items
            SET is_active = false,
                updated_at = NOW()
          WHERE id = ANY($1)`,
        [imageIds],
      );
      res.json({ success: true, archivedIds: imageIds });
    } catch (error) {
      console.error("Error archiving showcase images:", error);
      res.status(500).json({ error: "Kunne ikke arkivere bilder" });
    }
  });

  app.delete("/api/showcase/delete-images", async (req, res) => {
    try {
      const imageIds = readStringArray(req.body?.imageIds);
      await pool.query(`DELETE FROM showcase_items WHERE id = ANY($1)`, [imageIds]);
      res.json({ success: true, deletedIds: imageIds });
    } catch (error) {
      console.error("Error deleting showcase images:", error);
      res.status(500).json({ error: "Kunne ikke slette bilder" });
    }
  });

  app.post("/api/showcase/quick-transform", async (req, res) => {
    try {
      const payload = req.body as Record<string, unknown>;
      const imageIds = readStringArray(payload.imageIds);
      const operation = readString(payload.operation) || "transform";
      for (const imageId of imageIds) {
        const existing = await pool.query(
          `SELECT crop_data FROM showcase_items WHERE id = $1 LIMIT 1`,
          [imageId],
        );
        const cropData = normalizeJsonObjectField(existing.rows[0]?.crop_data) || {};
        const transformations =
          normalizeJsonObjectField(cropData.transformations) || {};
        await updateShowcaseItemRecord(imageId, {
          cropData: {
            ...cropData,
            transformations: {
              ...transformations,
              lastQuickTransform: operation,
              quickTransforms: [
                ...(Array.isArray(transformations.quickTransforms)
                  ? transformations.quickTransforms
                  : []),
                {
                  operation,
                  appliedAt: new Date().toISOString(),
                },
              ],
            },
          },
        });
      }
      res.json({ success: true, operation, count: imageIds.length });
    } catch (error) {
      console.error("Error applying quick showcase transform:", error);
      res.status(500).json({ error: "Kunne ikke transformere bilder" });
    }
  });

  app.post("/api/showcase/bulk-download", async (req, res) => {
    try {
      const imageIds = readStringArray(req.body?.imageIds);
      const rows = await pool.query(
        `SELECT id, title, image_url, thumbnail_url
           FROM showcase_items
          WHERE id = ANY($1)`,
        [imageIds],
      );

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="showcase-selection-${Date.now()}.zip"`,
      );

      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.on("error", (error: Error) => {
        throw error;
      });
      archive.pipe(res);

      for (const row of rows.rows as Array<Record<string, unknown>>) {
        const fileUrl =
          readString(row.image_url) || readString(row.thumbnail_url) || "";
        const title =
          (readString(row.title) || `showcase-${String(row.id)}`).replace(
            /[^a-z0-9-_]+/gi,
            "-",
          ) || `showcase-${String(row.id)}`;
        if (!fileUrl) {
          archive.append("Missing file URL", { name: `${title}.txt` });
          continue;
        }
        if (fileUrl.startsWith("data:")) {
          const [, base64 = ""] = fileUrl.split(",");
          archive.append(Buffer.from(base64, "base64"), {
            name: `${title}.bin`,
          });
          continue;
        }
        try {
          const response = await fetch(fileUrl);
          if (!response.ok) {
            archive.append(fileUrl, { name: `${title}.url.txt` });
            continue;
          }
          const buffer = Buffer.from(await response.arrayBuffer());
          const extension =
            path.extname(new URL(fileUrl).pathname) ||
            path.extname(fileUrl) ||
            ".bin";
          archive.append(buffer, { name: `${title}${extension}` });
        } catch {
          archive.append(fileUrl, { name: `${title}.url.txt` });
        }
      }

      await archive.finalize();
    } catch (error) {
      console.error("Error bulk-downloading showcase images:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Kunne ikke laste ned bilder" });
      }
    }
  });
}
