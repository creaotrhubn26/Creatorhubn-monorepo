/**
 * role-room-user-storage-routes.ts
 *
 * L3a-/L3c-endepunkter for per-bruker storage på admin-B2.
 *
 *   GET    /api/role-room/storage/stats              → { tier, usedBytes, quotaBytes, percentageUsed, fileCount }
 *   GET    /api/role-room/storage/files              → { files: [...] }
 *   POST   /api/role-room/storage/upload             → multipart, returnerer { file }
 *   GET    /api/role-room/storage/files/:id/download → 302 til signed B2-URL
 *   DELETE /api/role-room/storage/files/:id          → soft-delete (worker rydder B2)
 *
 * Auth: RR_BEARER_TOKEN via activeSessions.
 * Quota: 1 GiB free-tier per bruker. Quota-overskridelse returnerer HTTP 507.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureUserBucket,
  getUserFileDownloadUrl,
  getUserFilesPerProject,
  getUserStorageStats,
  listFilesForEntity,
  listUserFiles,
  softDeleteUserFile,
  uploadUserFile,
} from "./role-room-user-storage-service.js";
import {
  migrateAllStoryboardImagesForUser,
  moveStoryboardImageToB2,
} from "./role-room-storage-integrations.js";
import { cleanupSoftDeletedFiles } from "./role-room-storage-cleanup-worker.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB per fil (hard cap separat fra kvote)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

function getUserIdFromRequest(
  req: Request,
  activeSessions: Map<string, SessionData>,
): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const session = activeSessions.get(token);
    if (session?.userId) return session.userId;
  }
  // Fallback: ?token= for browser-redirect-flows (window.location.href
  // til /download kan ikke sette Authorization-header)
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
  if (queryToken) {
    const session = activeSessions.get(queryToken);
    if (session?.userId) return session.userId;
  }
  return null;
}

export function registerRoleRoomUserStorageRoutes(
  app: Express,
  deps: Deps,
): void {
  const { pool, activeSessions } = deps;

  // ──────────────────────────────────────────────────────────────────
  // GET /api/role-room/storage/stats
  // ──────────────────────────────────────────────────────────────────
  app.get("/api/role-room/storage/stats", async (req: Request, res: Response) => {
    const viewerId = getUserIdFromRequest(req, activeSessions);
    if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

    try {
      const stats = await getUserStorageStats(pool, viewerId);
      res.json(stats);
    } catch (err) {
      console.error("[storage/stats]", err);
      res.status(500).json({ error: "stats_failed", detail: String(err) });
    }
  });

  // ──────────────────────────────────────────────────────────────────
  // GET /api/role-room/storage/files
  //   ?limit=20&sourceModule=selftape&projectId=X&entityType=Y&entityId=Z
  // ──────────────────────────────────────────────────────────────────
  app.get("/api/role-room/storage/files", async (req: Request, res: Response) => {
    const viewerId = getUserIdFromRequest(req, activeSessions);
    if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const sourceModule = typeof req.query.sourceModule === 'string' && req.query.sourceModule
      ? req.query.sourceModule : undefined;
    const projectId = typeof req.query.projectId === 'string' && req.query.projectId
      ? req.query.projectId : undefined;
    const entityType = typeof req.query.entityType === 'string' && req.query.entityType
      ? req.query.entityType : undefined;
    const entityId = typeof req.query.entityId === 'string' && req.query.entityId
      ? req.query.entityId : undefined;

    try {
      const files = await listUserFiles(pool, {
        userId: viewerId, limit, sourceModule, projectId, entityType, entityId,
      });
      res.json({ files });
    } catch (err) {
      console.error("[storage/files]", err);
      res.status(500).json({ error: "list_failed", detail: String(err) });
    }
  });

  // ──────────────────────────────────────────────────────────────────
  // GET /api/role-room/storage/per-project
  // Sammendrag — { projectId, projectName, fileCount, totalBytes }[]
  // ──────────────────────────────────────────────────────────────────
  app.get("/api/role-room/storage/per-project", async (req: Request, res: Response) => {
    const viewerId = getUserIdFromRequest(req, activeSessions);
    if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

    try {
      const projects = await getUserFilesPerProject(pool, viewerId);
      res.json({ projects });
    } catch (err) {
      console.error("[storage/per-project]", err);
      res.status(500).json({ error: "per_project_failed", detail: String(err) });
    }
  });

  // ──────────────────────────────────────────────────────────────────
  // GET /api/role-room/storage/entity-files
  //   ?entityType=storyboard&entityId=<uuid>
  // Brukes av storyboard-/role-/research-views for å vise vedlegg inline.
  // ──────────────────────────────────────────────────────────────────
  app.get("/api/role-room/storage/entity-files", async (req: Request, res: Response) => {
    const viewerId = getUserIdFromRequest(req, activeSessions);
    if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

    const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : '';
    const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : '';
    if (!entityType || !entityId) {
      res.status(400).json({ error: "mangler_entity_type_id" });
      return;
    }

    try {
      const files = await listFilesForEntity(pool, { userId: viewerId, entityType, entityId });
      res.json({ files });
    } catch (err) {
      console.error("[storage/entity-files]", err);
      res.status(500).json({ error: "entity_files_failed", detail: String(err) });
    }
  });

  // ──────────────────────────────────────────────────────────────────
  // POST /api/role-room/storage/upload  (multipart/form-data)
  //   fields: file (required), sourceModule (optional), metadata (optional, JSON-string)
  // ──────────────────────────────────────────────────────────────────
  app.post("/api/role-room/storage/upload", upload.single('file'), async (req: Request, res: Response) => {
    const viewerId = getUserIdFromRequest(req, activeSessions);
    if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

    // Sørg for bucket-rad opprettet før upload
    await ensureUserBucket(pool, viewerId).catch(() => {});

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file || !file.buffer || file.buffer.length === 0) {
      res.status(400).json({ error: 'mangler_fil' });
      return;
    }

    const body = (req.body ?? {}) as {
      sourceModule?: string;
      metadata?: string;
      projectId?: string;
      sceneId?: string;
      attachedToEntityType?: string;
      attachedToEntityId?: string;
      attachmentNote?: string;
    };
    const sourceModule = typeof body.sourceModule === 'string' && body.sourceModule
      ? body.sourceModule.slice(0, 64) : undefined;
    let metadata: Record<string, unknown> = {};
    if (typeof body.metadata === 'string' && body.metadata) {
      try { metadata = JSON.parse(body.metadata); } catch { metadata = {}; }
    }
    const context = {
      projectId: typeof body.projectId === 'string' && body.projectId ? body.projectId.slice(0, 255) : undefined,
      sceneId: typeof body.sceneId === 'string' && body.sceneId ? body.sceneId.slice(0, 255) : undefined,
      attachedToEntityType: typeof body.attachedToEntityType === 'string' && body.attachedToEntityType ? body.attachedToEntityType.slice(0, 64) : undefined,
      attachedToEntityId: typeof body.attachedToEntityId === 'string' && body.attachedToEntityId ? body.attachedToEntityId.slice(0, 255) : undefined,
      attachmentNote: typeof body.attachmentNote === 'string' && body.attachmentNote ? body.attachmentNote.slice(0, 500) : undefined,
    };

    try {
      const result = await uploadUserFile(pool, {
        userId: viewerId,
        displayName: file.originalname || 'upload.bin',
        body: file.buffer,
        contentType: file.mimetype || 'application/octet-stream',
        sourceModule,
        metadata,
        context,
      });

      if (!result.ok) {
        if (result.reason === 'quota_exceeded') {
          res.status(507).json({
            error: 'kvote_overskredet',
            detail: 'Du har brukt opp 1 GB-grensen. Slett filer eller oppgrader.',
            stats: result.stats,
          });
          return;
        }
        if (result.reason === 'b2_not_configured') {
          res.status(503).json({ error: 'lagring_ikke_konfigurert' });
          return;
        }
        res.status(502).json({ error: 'opplasting_feilet', detail: result.detail });
        return;
      }

      res.json({ file: result.file });
    } catch (err) {
      console.error("[storage/upload]", err);
      res.status(500).json({ error: "upload_failed", detail: String(err) });
    }
  });

  // ──────────────────────────────────────────────────────────────────
  // GET /api/role-room/storage/files/:id/download → 302 til signed URL
  // ──────────────────────────────────────────────────────────────────
  app.get("/api/role-room/storage/files/:id/download", async (req: Request, res: Response) => {
    const viewerId = getUserIdFromRequest(req, activeSessions);
    if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

    const fileId = String(req.params.id ?? "").trim();
    if (!fileId) { res.status(400).json({ error: "mangler_id" }); return; }

    try {
      const r = await getUserFileDownloadUrl(pool, { userId: viewerId, fileId, expiresInSeconds: 300 });
      if (!r.ok) {
        res.status(r.reason === 'not_found' ? 404 : 503).json({ error: r.reason });
        return;
      }
      res.redirect(302, r.url);
    } catch (err) {
      console.error("[storage/download]", err);
      res.status(500).json({ error: "download_failed", detail: String(err) });
    }
  });

  // ──────────────────────────────────────────────────────────────────
  // POST /api/role-room/storage/admin/run-storage-migrations
  // Token-gated (samme cleanup-token). Kjører migrasjon 267/268/269
  // inline via Pool — bypasser migrate.sh hvis det feiler stille.
  // Idempotent: bruker _migrations_applied for å skippe allerede-applied.
  // ──────────────────────────────────────────────────────────────────
  app.post("/api/role-room/storage/admin/run-storage-migrations", async (req: Request, res: Response) => {
    const cronToken = req.headers['x-cron-trigger-token'] as string | undefined;
    const expectedToken = process.env.ROLE_ROOM_STORAGE_CLEANUP_TOKEN
      || process.env.CRON_TRIGGER_TOKEN;
    const tokenValid = expectedToken && cronToken && cronToken === expectedToken;
    if (!tokenValid) {
      res.status(401).json({ error: "krever_cron_token" });
      return;
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const migrationsDir = path.resolve(__dirname, "..", "migrations");
    const targetFiles = [
      "267_role_room_per_user_storage.sql",
      "268_role_room_byo_migration_jobs.sql",
      "269_role_room_user_files_context.sql",
    ];

    const force = req.query.force === 'true';
    const results: Array<{ file: string; status: string; error?: string; tableExists?: boolean }> = [];

    try {
      // Sørg for at _migrations_applied finnes
      await pool.query(`CREATE TABLE IF NOT EXISTS _migrations_applied (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      )`);

      for (const filename of targetFiles) {
        try {
          // Sjekk om "produktet" av migrasjonen faktisk eksisterer i DB
          // (vi sjekker den primære tabellen som hver migrasjon oppretter)
          const tableName = filename.includes("267") ? "role_room_user_buckets"
            : filename.includes("268") ? "role_room_byo_migration_jobs"
            : filename.includes("269") ? "role_room_user_files" // utvidet kolonner — sjekk eksistens
            : null;

          let tableExists = false;
          if (tableName) {
            const t = await pool.query(
              `SELECT to_regclass($1) IS NOT NULL AS exists`,
              [tableName],
            );
            tableExists = t.rows[0]?.exists === true;
          }

          // Skip hvis allerede applied OG tabellen eksisterer (eller force er av)
          const check = await pool.query(
            `SELECT 1 FROM _migrations_applied WHERE filename = $1`,
            [filename],
          );
          const alreadyMarked = !!(check.rowCount && check.rowCount > 0);

          if (alreadyMarked && tableExists && !force) {
            results.push({ file: filename, status: "already_applied", tableExists });
            continue;
          }

          if (alreadyMarked && !tableExists) {
            // Stale tracking-row — fjern så vi kan re-kjøre
            await pool.query(
              `DELETE FROM _migrations_applied WHERE filename = $1`,
              [filename],
            );
          }

          // Les og kjør SQL
          const sqlPath = path.join(migrationsDir, filename);
          const sql = await fs.readFile(sqlPath, "utf-8");
          await pool.query(sql);

          // Verifiser at tabellen faktisk eksisterer ETTER SQL-kjøring
          let postExists = false;
          if (tableName) {
            const t = await pool.query(
              `SELECT to_regclass($1) IS NOT NULL AS exists`,
              [tableName],
            );
            postExists = t.rows[0]?.exists === true;
          }

          if (!postExists) {
            results.push({
              file: filename,
              status: "sql_ran_but_table_missing",
              error: `Tabell '${tableName}' eksisterer ikke etter SQL-kjøring. Mulig krasj inni TRANSACTION.`,
            });
            continue;
          }

          // Marker som applied
          await pool.query(
            `INSERT INTO _migrations_applied (filename) VALUES ($1)
             ON CONFLICT (filename) DO NOTHING`,
            [filename],
          );
          results.push({ file: filename, status: "applied", tableExists: true });
        } catch (err) {
          results.push({
            file: filename,
            status: "failed",
            error: (err as Error).message?.slice(0, 500),
          });
        }
      }

      res.json({ ok: true, results });
    } catch (err) {
      res.status(500).json({ error: "migration_failed", detail: String(err), results });
    }
  });

  // ──────────────────────────────────────────────────────────────────
  // POST /api/role-room/storage/admin/cleanup-soft-deleted
  // Dual-auth: admin-sesjon ELLER x-cron-trigger-token header.
  // Rydder opptil 100 soft-deleted filer fra B2 per kall.
  // ──────────────────────────────────────────────────────────────────
  app.post("/api/role-room/storage/admin/cleanup-soft-deleted", async (req: Request, res: Response) => {
    const cronToken = req.headers['x-cron-trigger-token'] as string | undefined;
    const expectedToken = process.env.ROLE_ROOM_STORAGE_CLEANUP_TOKEN
      || process.env.CRON_TRIGGER_TOKEN;

    const tokenValid = expectedToken && cronToken && cronToken === expectedToken;
    if (!tokenValid) {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging_eller_cron_token" });
        return;
      }
      // Sjekk at brukeren har admin-role
      const session = activeSessions.get(req.headers.authorization?.slice(7).trim() ?? '');
      if (session?.role !== 'admin') {
        res.status(403).json({ error: "krever_admin" });
        return;
      }
    }

    const dryRun = req.query.dryRun === 'true';
    const batchSize = Math.min(500, Math.max(1, Number(req.query.batchSize) || 100));

    try {
      const result = await cleanupSoftDeletedFiles(pool, { batchSize, dryRun });
      res.json(result);
    } catch (err) {
      console.error("[storage/cleanup]", err);
      res.status(500).json({ error: "cleanup_failed", detail: String(err) });
    }
  });

  // ──────────────────────────────────────────────────────────────────
  // POST /api/role-room/storage/storyboards/:id/move-to-b2
  // Migrer én storyboard-skisse fra PG image_data → B2 m/ kontekst.
  // ──────────────────────────────────────────────────────────────────
  app.post("/api/role-room/storage/storyboards/:id/move-to-b2", async (req: Request, res: Response) => {
    const viewerId = getUserIdFromRequest(req, activeSessions);
    if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

    const storyboardId = String(req.params.id ?? "").trim();
    if (!storyboardId) { res.status(400).json({ error: "mangler_id" }); return; }

    try {
      const r = await moveStoryboardImageToB2(pool, { userId: viewerId, storyboardId });
      if (!r.ok) {
        res.status(r.reason === 'not_found' ? 404 : 400).json(r);
        return;
      }
      res.json(r);
    } catch (err) {
      console.error("[storage/storyboards/move-to-b2]", err);
      res.status(500).json({ error: "move_failed", detail: String(err) });
    }
  });

  // ──────────────────────────────────────────────────────────────────
  // POST /api/role-room/storage/storyboards/migrate-all
  // Batch — migrer ALLE storyboards for innlogget bruker.
  // ──────────────────────────────────────────────────────────────────
  app.post("/api/role-room/storage/storyboards/migrate-all", async (req: Request, res: Response) => {
    const viewerId = getUserIdFromRequest(req, activeSessions);
    if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

    const limit = Math.min(500, Math.max(1, Number(req.body?.limit) || 200));
    try {
      const summary = await migrateAllStoryboardImagesForUser(pool, viewerId, { limit });
      res.json(summary);
    } catch (err) {
      console.error("[storage/storyboards/migrate-all]", err);
      res.status(500).json({ error: "migrate_all_failed", detail: String(err) });
    }
  });

  // ──────────────────────────────────────────────────────────────────
  // DELETE /api/role-room/storage/files/:id  (soft-delete)
  // ──────────────────────────────────────────────────────────────────
  app.delete("/api/role-room/storage/files/:id", async (req: Request, res: Response) => {
    const viewerId = getUserIdFromRequest(req, activeSessions);
    if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

    const fileId = String(req.params.id ?? "").trim();
    if (!fileId) { res.status(400).json({ error: "mangler_id" }); return; }

    try {
      const r = await softDeleteUserFile(pool, { userId: viewerId, fileId });
      if (!r.ok) { res.status(404).json({ error: "ikke_funnet" }); return; }
      res.json({ ok: true, freedBytes: r.freedBytes });
    } catch (err) {
      console.error("[storage/delete]", err);
      res.status(500).json({ error: "delete_failed", detail: String(err) });
    }
  });
}
