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
import {
  ensureUserBucket,
  getUserFileDownloadUrl,
  getUserStorageStats,
  listUserFiles,
  softDeleteUserFile,
  uploadUserFile,
} from "./role-room-user-storage-service.js";

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
  //   ?limit=20&sourceModule=selftape
  // ──────────────────────────────────────────────────────────────────
  app.get("/api/role-room/storage/files", async (req: Request, res: Response) => {
    const viewerId = getUserIdFromRequest(req, activeSessions);
    if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const sourceModule = typeof req.query.sourceModule === 'string' && req.query.sourceModule
      ? req.query.sourceModule
      : undefined;

    try {
      const files = await listUserFiles(pool, { userId: viewerId, limit, sourceModule });
      res.json({ files });
    } catch (err) {
      console.error("[storage/files]", err);
      res.status(500).json({ error: "list_failed", detail: String(err) });
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

    const body = (req.body ?? {}) as { sourceModule?: string; metadata?: string };
    const sourceModule = typeof body.sourceModule === 'string' && body.sourceModule
      ? body.sourceModule.slice(0, 64)
      : undefined;
    let metadata: Record<string, unknown> = {};
    if (typeof body.metadata === 'string' && body.metadata) {
      try { metadata = JSON.parse(body.metadata); } catch { metadata = {}; }
    }

    try {
      const result = await uploadUserFile(pool, {
        userId: viewerId,
        displayName: file.originalname || 'upload.bin',
        body: file.buffer,
        contentType: file.mimetype || 'application/octet-stream',
        sourceModule,
        metadata,
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
