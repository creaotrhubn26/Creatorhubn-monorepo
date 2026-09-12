/**
 * admin-system-backup-routes.ts
 *
 * Plattform-gruppe: backup-oversikt mot Backblaze B2 (selskap-bucket).
 * Leser fra `B2_*`-env-vars (samme som b2-company-archive-routes registreres
 * med). Returnerer ALDRI 500 ved manglende env — UI rendres med tom liste +
 * `b2Configured: false`.
 *
 * Endpoints:
 *   GET /api/system-backup/list             — backups + total (ListObjectsV2)
 *   GET /api/system-backup/stats            — aggregat (bytes, oldest, newest, byFolder)
 *   GET /api/system-backup/folder-structure — prefix-tre (foldere som virtuelle keys)
 *
 * Alle krever requireAdminSession.
 *
 * Caching:
 *   B2 list-call er treg + bruker API-transaksjons-quota. Vi cacher hele
 *   "snapshot" (alle objekter, paginert) i 60s og avleder list/stats/folders
 *   fra samme datasett. Cache-flush ved env-endring (lat re-init av klient).
 */

import type express from "express";
import type { Pool } from "pg";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdminSystemBackupRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: express.Request, res: express.Response) => any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const B2_REGION = process.env.B2_REGION || "us-west-001";
const B2_ENDPOINT = `https://s3.${B2_REGION}.backblazeb2.com`;

interface B2Config {
  bucketName: string;
  client: S3Client;
}

function getB2Config(): B2Config | null {
  const keyId = process.env.B2_APPLICATION_KEY_ID;
  const appKey = process.env.B2_APPLICATION_KEY;
  const bucketName = process.env.B2_BUCKET_NAME;
  if (!keyId || !appKey || !bucketName) return null;

  const client = new S3Client({
    region: B2_REGION,
    endpoint: B2_ENDPOINT,
    credentials: { accessKeyId: keyId, secretAccessKey: appKey },
    forcePathStyle: true,
  });
  return { bucketName, client };
}

interface B2Object {
  key: string;
  size: number;
  lastModified: string | null;
  etag: string | null;
}

interface BackupSnapshot {
  objects: B2Object[];
  fetchedAt: number;
  bucketName: string;
}

const SNAPSHOT_TTL_MS = 60 * 1000;
let snapshotCache: BackupSnapshot | null = null;

async function loadSnapshot(config: B2Config): Promise<BackupSnapshot> {
  const now = Date.now();
  if (
    snapshotCache &&
    snapshotCache.bucketName === config.bucketName &&
    now - snapshotCache.fetchedAt < SNAPSHOT_TTL_MS
  ) {
    return snapshotCache;
  }

  const objects: B2Object[] = [];
  let continuationToken: string | undefined;
  // Hard upper bound på paginering for å unngå runaway-quota.
  // 1000 pages * 1000 keys = 1M objekter. Mer enn nok.
  for (let i = 0; i < 1000; i++) {
    const result = await config.client.send(
      new ListObjectsV2Command({
        Bucket: config.bucketName,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );
    for (const obj of result.Contents || []) {
      if (!obj.Key) continue;
      objects.push({
        key: obj.Key,
        size: obj.Size || 0,
        lastModified: obj.LastModified
          ? new Date(obj.LastModified).toISOString()
          : null,
        etag: obj.ETag || null,
      });
    }
    if (!result.IsTruncated) break;
    continuationToken = result.NextContinuationToken;
  }

  snapshotCache = { objects, fetchedAt: now, bucketName: config.bucketName };
  return snapshotCache;
}

/** Hent "folder"-segment fra key. `funding-apps/foo/bar.pdf` → `funding-apps` */
function folderFromKey(key: string): string {
  const idx = key.indexOf("/");
  return idx === -1 ? "" : key.slice(0, idx);
}

/** Gjett content-type basert på filendelse — B2-ListObjects gir oss ikke MIME. */
function contentTypeFromKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".html")) return "text/html";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

export function setupAdminSystemBackupRoutes(
  deps: AdminSystemBackupRoutesDeps,
): void {
  const { app, requireAdminSession } = deps;

  // ── GET /api/system-backup/list ───────────────────────────────────────
  app.get("/api/system-backup/list", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      const config = getB2Config();
      if (!config) {
        console.warn(
          "[admin-system-backup] B2_APPLICATION_KEY_ID/KEY/BUCKET_NAME ikke satt — returnerer tom liste",
        );
        return res.json({
          backups: [],
          total: 0,
          b2Configured: false,
        });
      }

      const limit = Math.min(
        Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1),
        500,
      );
      const offset = Math.max(
        parseInt(String(req.query.offset ?? "0"), 10) || 0,
        0,
      );

      const snapshot = await loadSnapshot(config);

      // Stabil sortering: nyeste først
      const sorted = [...snapshot.objects].sort((a, b) => {
        const ta = a.lastModified ? Date.parse(a.lastModified) : 0;
        const tb = b.lastModified ? Date.parse(b.lastModified) : 0;
        return tb - ta;
      });

      const page = sorted.slice(offset, offset + limit).map((obj) => ({
        fileId: obj.etag || obj.key,
        fileName: obj.key,
        uploadedAt: obj.lastModified,
        sizeBytes: obj.size,
        contentType: contentTypeFromKey(obj.key),
        folder: folderFromKey(obj.key),
      }));

      return res.json({
        backups: page,
        total: snapshot.objects.length,
        b2Configured: true,
        bucketName: config.bucketName,
      });
    } catch (err) {
      console.error("[admin-system-backup] list failed:", err);
      res.status(500).json({ error: "system_backup_list_failed" });
    }
  });

  // ── GET /api/system-backup/stats ──────────────────────────────────────
  app.get("/api/system-backup/stats", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      const config = getB2Config();
      if (!config) {
        console.warn(
          "[admin-system-backup] stats — B2-creds mangler, returnerer tomt aggregat",
        );
        return res.json({
          totalSize: 0,
          oldestBackup: null,
          newestBackup: null,
          fileCount: 0,
          byFolder: [],
          b2Configured: false,
        });
      }

      const snapshot = await loadSnapshot(config);

      let totalSize = 0;
      let oldestTs = Number.POSITIVE_INFINITY;
      let newestTs = Number.NEGATIVE_INFINITY;
      const folderMap = new Map<string, { count: number; sizeBytes: number }>();

      for (const obj of snapshot.objects) {
        totalSize += obj.size;
        const ts = obj.lastModified ? Date.parse(obj.lastModified) : NaN;
        if (Number.isFinite(ts)) {
          if (ts < oldestTs) oldestTs = ts;
          if (ts > newestTs) newestTs = ts;
        }
        const folder = folderFromKey(obj.key) || "(root)";
        const existing = folderMap.get(folder) || { count: 0, sizeBytes: 0 };
        existing.count += 1;
        existing.sizeBytes += obj.size;
        folderMap.set(folder, existing);
      }

      const byFolder = Array.from(folderMap.entries())
        .map(([folder, agg]) => ({
          folder,
          count: agg.count,
          sizeBytes: agg.sizeBytes,
        }))
        .sort((a, b) => b.sizeBytes - a.sizeBytes);

      return res.json({
        totalSize,
        oldestBackup: Number.isFinite(oldestTs)
          ? new Date(oldestTs).toISOString()
          : null,
        newestBackup: Number.isFinite(newestTs)
          ? new Date(newestTs).toISOString()
          : null,
        fileCount: snapshot.objects.length,
        byFolder,
        b2Configured: true,
        bucketName: config.bucketName,
      });
    } catch (err) {
      console.error("[admin-system-backup] stats failed:", err);
      res.status(500).json({ error: "system_backup_stats_failed" });
    }
  });

  // ── GET /api/system-backup/folder-structure ───────────────────────────
  app.get("/api/system-backup/folder-structure", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      const config = getB2Config();
      if (!config) {
        console.warn(
          "[admin-system-backup] folder-structure — B2-creds mangler, returnerer tom liste",
        );
        return res.json({ folders: [], b2Configured: false });
      }

      const snapshot = await loadSnapshot(config);

      interface FolderAgg {
        fileCount: number;
        totalSize: number;
        latestTs: number;
        latestFile: string | null;
      }
      const folders = new Map<string, FolderAgg>();

      for (const obj of snapshot.objects) {
        const folder = folderFromKey(obj.key);
        if (!folder) continue; // hopper over root-objekter
        const agg = folders.get(folder) || {
          fileCount: 0,
          totalSize: 0,
          latestTs: Number.NEGATIVE_INFINITY,
          latestFile: null,
        };
        agg.fileCount += 1;
        agg.totalSize += obj.size;
        const ts = obj.lastModified ? Date.parse(obj.lastModified) : NaN;
        if (Number.isFinite(ts) && ts > agg.latestTs) {
          agg.latestTs = ts;
          agg.latestFile = obj.key;
        }
        folders.set(folder, agg);
      }

      const list = Array.from(folders.entries())
        .map(([name, agg]) => ({
          name,
          fileCount: agg.fileCount,
          totalSize: agg.totalSize,
          latestFile: agg.latestFile
            ? {
                key: agg.latestFile,
                uploadedAt: Number.isFinite(agg.latestTs)
                  ? new Date(agg.latestTs).toISOString()
                  : null,
              }
            : null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return res.json({
        folders: list,
        b2Configured: true,
        bucketName: config.bucketName,
      });
    } catch (err) {
      console.error("[admin-system-backup] folder-structure failed:", err);
      res.status(500).json({ error: "system_backup_folder_failed" });
    }
  });
}
