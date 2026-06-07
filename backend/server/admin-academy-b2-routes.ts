/**
 * admin-academy-b2-routes.ts
 *
 * Academy-arkivering mot Backblaze B2 — ADMIN-ONLY.
 *
 * Constraint (eksplisitt fra Daniel 2026-06-07):
 *   "kun til admin, creatorhub brukere lager egen avtale sånn som det er gjort"
 *
 * Dette betyr: B2 eksponeres KUN for CreatorHub-admin gjennom disse rutene.
 * Vanlige CreatorHub-instruktører/brukere får IKKE noen B2-credentials —
 * de må lage sin egen Backblaze-avtale hvis de vil arkivere uavhengig av
 * plattformen. Alle endepunkter under er bak `requireAdminSession`.
 *
 * Gjenbruker `B2_APPLICATION_KEY_ID` + `B2_APPLICATION_KEY` + `B2_BUCKET_NAME`
 * fra Render (samme bucket som `admin-system-backup-routes.ts`).
 * Alt scopes til `academy/`-prefix; DELETE-endepunktet avviser keys utenfor
 * det prefixet defensivt for å hindre ulykker.
 *
 * Endpoints (alle krever requireAdminSession):
 *   GET    /api/admin/academy/b2/list?prefix=&limit=          — list objekter
 *   GET    /api/admin/academy/b2/stats                        — aggregert KPI
 *   POST   /api/admin/academy/b2/upload-url                   — presigned PUT
 *   POST   /api/admin/academy/b2/download-url                 — presigned GET
 *   DELETE /api/admin/academy/b2/object?key=academy/…         — slett objekt
 *
 * Defensive:
 *   - Hvis B2-env mangler → 200 m/ `b2Configured: false` + tom liste.
 *     Aldri 500 fra manglende konfig.
 *   - Returner aldri credentials i respons.
 *   - Signed URLs: 15 min upload / 30 min download.
 *   - DELETE: bare keys som starter med `academy/`.
 */

import type express from "express";
import type { Pool } from "pg";
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdminAcademyB2RoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const B2_REGION = process.env.B2_REGION || "us-west-001";
const B2_ENDPOINT = `https://s3.${B2_REGION}.backblazeb2.com`;

const ACADEMY_PREFIX = "academy/";
const UPLOAD_URL_EXPIRY_SECONDS = 15 * 60; // 15 min
const DOWNLOAD_URL_EXPIRY_SECONDS = 30 * 60; // 30 min

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

/**
 * Parse `academy/courses/:courseId/(masters|assets)/:filename` → metadata.
 * Returnerer `null` for `courseId` hvis keyen ikke matcher pattern.
 */
function parseAcademyKey(key: string): {
  courseId: string | null;
  isMaster: boolean;
  fileName: string;
} {
  // Vi støtter `academy/courses/<id>/masters/<name>` og
  // `academy/courses/<id>/assets/<name>` (samt undermapper under disse).
  const courseMatch = key.match(/^academy\/courses\/([^/]+)\/(masters|assets)\/(.+)$/);
  if (courseMatch) {
    return {
      courseId: courseMatch[1] ?? null,
      isMaster: courseMatch[2] === "masters",
      fileName: courseMatch[3] ?? key,
    };
  }
  // Fallback: bare under `academy/` uten kurs-struktur (legacy/manuell).
  const trailing = key.startsWith(ACADEMY_PREFIX) ? key.slice(ACADEMY_PREFIX.length) : key;
  return { courseId: null, isMaster: false, fileName: trailing };
}

function extFromName(name: string): string {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot < 0 || dot === lower.length - 1) return "(none)";
  return lower.slice(dot + 1);
}

/** Sanitiser file-name fragment så vi ikke bygger ondsinnete keys. */
function sanitizeFileNameSegment(name: string): string {
  return (name || "")
    .trim()
    .replace(/[\\]/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/")
    .replace(/[^A-Za-z0-9._\-/() ]+/g, "-")
    .slice(0, 256);
}

/** Sanitiser courseId. UUID-er + slug-er aksepteres; kontrollerer at det ikke er tomt eller inneholder `/`. */
function sanitizeCourseId(courseId: string): string {
  return (courseId || "")
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, "")
    .slice(0, 128);
}

/**
 * Liste alle keys under et prefix. Brukes både til list- og stats-endepunkter.
 * Avgrenset til `academy/`-prefix uansett hva caller sender.
 */
async function listAcademyObjects(
  config: B2Config,
  prefix: string,
  maxObjects: number,
): Promise<
  Array<{ key: string; size: number; lastModified: string | null }>
> {
  const objects: Array<{ key: string; size: number; lastModified: string | null }> = [];
  let continuationToken: string | undefined;

  // Sikkerhetsbelte: hard upper bound på paginering.
  for (let i = 0; i < 100; i++) {
    const result = await config.client.send(
      new ListObjectsV2Command({
        Bucket: config.bucketName,
        Prefix: prefix,
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
      });
      if (objects.length >= maxObjects) return objects;
    }
    if (!result.IsTruncated) break;
    continuationToken = result.NextContinuationToken;
  }
  return objects;
}

export function setupAdminAcademyB2Routes(deps: AdminAcademyB2RoutesDeps): void {
  const { app, pool, requireAdminSession } = deps;

  // ─── GET /api/admin/academy/b2/list ──────────────────────────────────
  app.get("/api/admin/academy/b2/list", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      const config = getB2Config();
      if (!config) {
        console.warn(
          "[admin-academy-b2] list — B2-creds mangler (B2_APPLICATION_KEY_ID/KEY/BUCKET_NAME), returnerer tom liste",
        );
        return res.json({ files: [], total: 0, b2Configured: false });
      }

      // Klem prefix til academy/-tre uansett.
      const rawPrefix =
        typeof req.query.prefix === "string" ? req.query.prefix : ACADEMY_PREFIX;
      const prefix = rawPrefix.startsWith(ACADEMY_PREFIX) ? rawPrefix : ACADEMY_PREFIX;

      const limit = Math.min(
        Math.max(parseInt(String(req.query.limit ?? "100"), 10) || 100, 1),
        1000,
      );

      const objects = await listAcademyObjects(config, prefix, limit);

      // Sorter nyeste først.
      objects.sort((a, b) => {
        const ta = a.lastModified ? Date.parse(a.lastModified) : 0;
        const tb = b.lastModified ? Date.parse(b.lastModified) : 0;
        return tb - ta;
      });

      const files = objects.map((obj) => {
        const parsed = parseAcademyKey(obj.key);
        return {
          key: obj.key,
          sizeBytes: obj.size,
          lastModified: obj.lastModified,
          isMaster: parsed.isMaster,
          courseId: parsed.courseId,
          fileName: parsed.fileName,
        };
      });

      return res.json({
        files,
        total: files.length,
        b2Configured: true,
        bucketName: config.bucketName,
        prefix,
      });
    } catch (err) {
      console.error("[admin-academy-b2] list failed:", err);
      res.status(500).json({ error: "academy_b2_list_failed" });
    }
  });

  // ─── GET /api/admin/academy/b2/stats ─────────────────────────────────
  app.get("/api/admin/academy/b2/stats", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      const config = getB2Config();
      if (!config) {
        console.warn(
          "[admin-academy-b2] stats — B2-creds mangler, returnerer tomt aggregat",
        );
        return res.json({
          totalFiles: 0,
          totalSizeBytes: 0,
          byCourse: [],
          byType: [],
          b2Configured: false,
        });
      }

      // Hent alt under academy/ (cap 50k for å unngå quota-runaway; nok i praksis).
      const objects = await listAcademyObjects(config, ACADEMY_PREFIX, 50000);

      let totalSizeBytes = 0;
      const byCourseMap = new Map<string, { fileCount: number; sizeBytes: number }>();
      const byTypeMap = new Map<string, { count: number; sizeBytes: number }>();

      const courseIdsSeen = new Set<string>();
      for (const obj of objects) {
        totalSizeBytes += obj.size;
        const parsed = parseAcademyKey(obj.key);
        const courseKey = parsed.courseId || "(uten kurs)";
        if (parsed.courseId) courseIdsSeen.add(parsed.courseId);
        const courseAgg = byCourseMap.get(courseKey) || {
          fileCount: 0,
          sizeBytes: 0,
        };
        courseAgg.fileCount += 1;
        courseAgg.sizeBytes += obj.size;
        byCourseMap.set(courseKey, courseAgg);

        const ext = extFromName(parsed.fileName);
        const typeAgg = byTypeMap.get(ext) || { count: 0, sizeBytes: 0 };
        typeAgg.count += 1;
        typeAgg.sizeBytes += obj.size;
        byTypeMap.set(ext, typeAgg);
      }

      // Slå opp kurs-titler hvis vi har noen kurs-ID-er — defensivt mot
      // manglende tabell / DI-mismatch (samme `isUndefinedTableError`-mønster
      // som resten av academy-routene følger, men inline her).
      const courseNames = new Map<string, string>();
      if (courseIdsSeen.size > 0) {
        try {
          const ids = Array.from(courseIdsSeen);
          // academy_courses.id er UUID — vi caster begge sider til text for å
          // tolerere både UUID- og slug-aktige IDer i prefixen.
          const result = await pool.query<{ id: string; title: string }>(
            `SELECT c.id::text AS id, c.title
               FROM academy_courses c
              WHERE c.id::text = ANY($1::text[])`,
            [ids],
          );
          for (const row of result.rows) {
            courseNames.set(row.id, row.title);
          }
        } catch (err) {
          const code = (err as { code?: string } | null)?.code;
          if (code !== "42P01") {
            // 42P01 = undefined_table. Andre feil logges, men vi feiler ikke
            // hele stats-endepunktet — fortsetter uten kurs-titler.
            console.warn(
              "[admin-academy-b2] stats — kunne ikke slå opp course-titler:",
              (err as Error).message,
            );
          }
        }
      }

      const byCourse = Array.from(byCourseMap.entries())
        .map(([courseId, agg]) => ({
          courseId,
          courseName: courseNames.get(courseId) ?? null,
          fileCount: agg.fileCount,
          sizeBytes: agg.sizeBytes,
        }))
        .sort((a, b) => b.sizeBytes - a.sizeBytes);

      const byType = Array.from(byTypeMap.entries())
        .map(([ext, agg]) => ({ ext, count: agg.count, sizeBytes: agg.sizeBytes }))
        .sort((a, b) => b.sizeBytes - a.sizeBytes);

      return res.json({
        totalFiles: objects.length,
        totalSizeBytes,
        byCourse,
        byType,
        b2Configured: true,
        bucketName: config.bucketName,
      });
    } catch (err) {
      console.error("[admin-academy-b2] stats failed:", err);
      res.status(500).json({ error: "academy_b2_stats_failed" });
    }
  });

  // ─── POST /api/admin/academy/b2/upload-url ───────────────────────────
  // Body: { courseId: string, fileName: string, contentType?: string, isMaster?: boolean }
  app.post("/api/admin/academy/b2/upload-url", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      const config = getB2Config();
      if (!config) {
        return res.json({
          uploadUrl: null,
          key: null,
          expiresAt: null,
          b2Configured: false,
        });
      }

      const body = (req.body || {}) as {
        courseId?: unknown;
        fileName?: unknown;
        contentType?: unknown;
        isMaster?: unknown;
      };

      const courseIdRaw = typeof body.courseId === "string" ? body.courseId : "";
      const fileNameRaw = typeof body.fileName === "string" ? body.fileName : "";
      const contentType =
        typeof body.contentType === "string" && body.contentType.trim().length > 0
          ? body.contentType.trim()
          : "application/octet-stream";
      const isMaster = body.isMaster === true;

      const courseId = sanitizeCourseId(courseIdRaw);
      const fileName = sanitizeFileNameSegment(fileNameRaw);

      if (!courseId) {
        return res.status(400).json({ error: "invalid_course_id" });
      }
      if (!fileName) {
        return res.status(400).json({ error: "invalid_file_name" });
      }

      const subDir = isMaster ? "masters" : "assets";
      const key = `${ACADEMY_PREFIX}courses/${courseId}/${subDir}/${fileName}`;

      // Defensiv: doble at vi havner under academy/ etter all sanitisering.
      if (!key.startsWith(ACADEMY_PREFIX)) {
        return res.status(400).json({ error: "invalid_key" });
      }

      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(config.client, command, {
        expiresIn: UPLOAD_URL_EXPIRY_SECONDS,
      });

      return res.json({
        uploadUrl,
        key,
        expiresAt: new Date(
          Date.now() + UPLOAD_URL_EXPIRY_SECONDS * 1000,
        ).toISOString(),
        b2Configured: true,
      });
    } catch (err) {
      console.error("[admin-academy-b2] upload-url failed:", err);
      res.status(500).json({ error: "academy_b2_upload_url_failed" });
    }
  });

  // ─── POST /api/admin/academy/b2/download-url ─────────────────────────
  // Body: { key: string }
  app.post("/api/admin/academy/b2/download-url", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      const config = getB2Config();
      if (!config) {
        return res.json({
          downloadUrl: null,
          expiresAt: null,
          b2Configured: false,
        });
      }

      const key = typeof req.body?.key === "string" ? req.body.key.trim() : "";
      if (!key) {
        return res.status(400).json({ error: "invalid_key" });
      }
      if (!key.startsWith(ACADEMY_PREFIX)) {
        return res.status(400).json({ error: "key_outside_academy_prefix" });
      }

      const command = new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      });

      const downloadUrl = await getSignedUrl(config.client, command, {
        expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS,
      });

      return res.json({
        downloadUrl,
        expiresAt: new Date(
          Date.now() + DOWNLOAD_URL_EXPIRY_SECONDS * 1000,
        ).toISOString(),
        b2Configured: true,
      });
    } catch (err) {
      console.error("[admin-academy-b2] download-url failed:", err);
      res.status(500).json({ error: "academy_b2_download_url_failed" });
    }
  });

  // ─── DELETE /api/admin/academy/b2/object ─────────────────────────────
  // Query: ?key=academy/...
  app.delete("/api/admin/academy/b2/object", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      const config = getB2Config();
      if (!config) {
        return res.json({ success: false, b2Configured: false });
      }

      const key =
        typeof req.query.key === "string" ? (req.query.key as string).trim() : "";
      if (!key) {
        return res.status(400).json({ error: "invalid_key" });
      }
      if (!key.startsWith(ACADEMY_PREFIX)) {
        return res.status(400).json({ error: "key_outside_academy_prefix" });
      }

      await config.client.send(
        new DeleteObjectCommand({
          Bucket: config.bucketName,
          Key: key,
        }),
      );

      return res.json({ success: true, b2Configured: true });
    } catch (err) {
      console.error("[admin-academy-b2] delete failed:", err);
      res.status(500).json({ error: "academy_b2_delete_failed" });
    }
  });
}
