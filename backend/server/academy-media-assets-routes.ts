/**
 * Academy → media-assets fil/poster-leveranse + asset-deletion.
 *
 * Ekstrahert fra `index.ts` (#239-sekvens). Behandler:
 *   - DELETE /api/academy/media-assets/:assetId      (slett asset + dir)
 *   - GET    /api/academy/media-assets/:assetId/file (lever rå mediafil)
 *   - GET    /api/academy/media-assets/:assetId/poster
 *
 * Manifest-helpers (`loadAcademyMediaManifest`/`persistAcademyMediaManifest`/
 * `resolveAcademyMediaVersion`) bor fortsatt i index.ts og injecteres som
 * deps. Storage-rotpath injectes også (avhengig av REPO_ROOT som settes ved
 * boot).
 */
import type { Application, Request, Response } from "express";
import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";

import type {
  AcademyStoredMediaAssetRecord,
  AcademyStoredMediaManifest,
  AcademyStoredMediaVersionRecord,
} from "./index.js";

type AcademySession = {
  user: { id: string };
};

type AcademySessionRequirement = "authenticated" | "instructor";

export interface AcademyMediaAssetsRoutesDeps {
  app: Application;
  requireAcademySession: (
    req: Request,
    res: Response,
    requirement?: AcademySessionRequirement,
  ) => Promise<AcademySession | null>;
  loadAcademyMediaManifest: () => Promise<AcademyStoredMediaManifest>;
  persistAcademyMediaManifest: (
    manifest: AcademyStoredMediaManifest,
  ) => Promise<void>;
  resolveAcademyMediaVersion: (
    record: AcademyStoredMediaAssetRecord,
    requestedVersion?: number,
  ) => AcademyStoredMediaVersionRecord | null;
  /** Absolutt path til `tmp/academy-media`-storage-roten. */
  academyMediaStorageDir: string;
}

export function setupAcademyMediaAssetsRoutes(
  deps: AcademyMediaAssetsRoutesDeps,
): void {
  const {
    app,
    requireAcademySession,
    loadAcademyMediaManifest,
    persistAcademyMediaManifest,
    resolveAcademyMediaVersion,
    academyMediaStorageDir,
  } = deps;

  app.delete("/api/academy/media-assets/:assetId", async (req, res) => {
    try {
      if (!(await requireAcademySession(req, res, "instructor"))) {
        return;
      }
      const assetId = String(req.params.assetId || "").trim();
      if (!assetId) {
        return res.status(400).json({ error: "Missing asset id" });
      }
      const manifest = await loadAcademyMediaManifest();
      const nextAssets = manifest.assets.filter((entry) => entry.id !== assetId);
      if (nextAssets.length === manifest.assets.length) {
        return res.status(404).json({ error: "Academy media asset not found" });
      }

      manifest.assets = nextAssets;
      manifest.updatedAt = new Date().toISOString();
      await persistAcademyMediaManifest(manifest);

      const assetDir = path.join(academyMediaStorageDir, assetId);
      try {
        await fs.rm(assetDir, { recursive: true, force: true });
      } catch (error) {
        console.warn("[academy-media] failed to remove asset directory:", error);
      }

      return res.json({ success: true, assetId });
    } catch (error) {
      console.error("[academy-media] delete failed:", error);
      return res
        .status(500)
        .json({ error: "Failed to delete academy media asset" });
    }
  });

  app.get("/api/academy/media-assets/:assetId/file", async (req, res) => {
    try {
      if (!(await requireAcademySession(req, res, "authenticated"))) {
        return;
      }
      const assetId = String(req.params.assetId || "").trim();
      const requestedVersion = Number(req.query.version || 0);
      const manifest = await loadAcademyMediaManifest();
      const record = manifest.assets.find((entry) => entry.id === assetId);
      if (!record) {
        return res.status(404).json({ error: "Academy media asset not found" });
      }
      const versionRecord = resolveAcademyMediaVersion(
        record,
        Number.isFinite(requestedVersion) && requestedVersion > 0
          ? requestedVersion
          : undefined,
      );
      if (!versionRecord) {
        return res.status(404).json({ error: "Academy media version not found" });
      }

      const absolutePath = path.join(
        academyMediaStorageDir,
        versionRecord.relativePath,
      );
      if (!existsSync(absolutePath)) {
        return res
          .status(404)
          .json({ error: "Academy media file missing on disk" });
      }

      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.type(versionRecord.mimeType || "application/octet-stream");
      return res.sendFile(absolutePath);
    } catch (error) {
      console.error("[academy-media] serve file failed:", error);
      return res.status(500).json({ error: "Failed to load academy media file" });
    }
  });

  app.get("/api/academy/media-assets/:assetId/poster", async (req, res) => {
    try {
      if (!(await requireAcademySession(req, res, "authenticated"))) {
        return;
      }
      const assetId = String(req.params.assetId || "").trim();
      const requestedVersion = Number(req.query.version || 0);
      const manifest = await loadAcademyMediaManifest();
      const record = manifest.assets.find((entry) => entry.id === assetId);
      if (!record) {
        return res.status(404).json({ error: "Academy media asset not found" });
      }
      const versionRecord = resolveAcademyMediaVersion(
        record,
        Number.isFinite(requestedVersion) && requestedVersion > 0
          ? requestedVersion
          : undefined,
      );
      if (!versionRecord?.posterRelativePath) {
        return res
          .status(404)
          .json({ error: "Poster not available for this asset" });
      }

      const absolutePath = path.join(
        academyMediaStorageDir,
        versionRecord.posterRelativePath,
      );
      if (!existsSync(absolutePath)) {
        return res.status(404).json({ error: "Poster file missing on disk" });
      }

      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.type(versionRecord.posterMimeType || "image/jpeg");
      return res.sendFile(absolutePath);
    } catch (error) {
      console.error("[academy-media] serve poster failed:", error);
      return res
        .status(500)
        .json({ error: "Failed to load academy media poster" });
    }
  });
}
