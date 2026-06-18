/**
 * role-room-byo-storage-routes.ts
 *
 * L3b — BYO B2 connect + migrate.
 *
 *   POST   /api/role-room/storage/byo/validate    → test creds uten å lagre
 *   POST   /api/role-room/storage/byo/connect     → lagre + sett tier=byo
 *   DELETE /api/role-room/storage/byo             → koble fra (→ tier=free, 1 GB)
 *   GET    /api/role-room/storage/byo/status      → connection status + aktiv migrate
 *   POST   /api/role-room/storage/byo/migrate     → start admin → byo migrasjon
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  connectByoB2,
  disconnectByoB2,
  getActiveMigration,
  getByoCreds,
  startMigrationToByo,
  validateByoB2,
  type ByoB2Creds,
} from "./role-room-byo-storage-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

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
  // Fallback: ?token= for browser-redirect-flows (download-URL)
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
  if (queryToken) {
    const session = activeSessions.get(queryToken);
    if (session?.userId) return session.userId;
  }
  return null;
}

function parseCreds(body: unknown): ByoB2Creds | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const keyId = typeof b.keyId === 'string' ? b.keyId.trim() : '';
  const applicationKey = typeof b.applicationKey === 'string' ? b.applicationKey.trim() : '';
  const bucketName = typeof b.bucketName === 'string' ? b.bucketName.trim() : '';
  const endpointUrl = typeof b.endpointUrl === 'string' && b.endpointUrl.trim()
    ? b.endpointUrl.trim() : undefined;
  const region = typeof b.region === 'string' && b.region.trim()
    ? b.region.trim() : undefined;
  if (!keyId || !applicationKey || !bucketName) return null;
  return { keyId, applicationKey, bucketName, endpointUrl, region };
}

export function registerRoleRoomByoStorageRoutes(
  app: Express, deps: Deps,
): void {
  const { pool, activeSessions } = deps;

  // ──────────────────────────────────────────────────────────────────
  // POST /byo/validate — sjekk creds uten å lagre noe
  // ──────────────────────────────────────────────────────────────────
  app.post("/api/role-room/storage/byo/validate", async (req: Request, res: Response) => {
    const viewerId = getUserIdFromRequest(req, activeSessions);
    if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

    const creds = parseCreds(req.body);
    if (!creds) { res.status(400).json({ error: "mangler_creds" }); return; }

    const r = await validateByoB2(creds);
    if (!r.ok) {
      res.status(400).json({ ok: false, error: r.error });
      return;
    }
    res.json({ ok: true, region: r.region, endpoint: r.endpoint });
  });

  // ──────────────────────────────────────────────────────────────────
  // POST /byo/connect — validate + save + sett tier=byo
  // ──────────────────────────────────────────────────────────────────
  app.post("/api/role-room/storage/byo/connect", async (req: Request, res: Response) => {
    const viewerId = getUserIdFromRequest(req, activeSessions);
    if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

    const creds = parseCreds(req.body);
    if (!creds) { res.status(400).json({ error: "mangler_creds" }); return; }

    const validation = await validateByoB2(creds);
    if (!validation.ok) {
      res.status(400).json({ ok: false, error: validation.error });
      return;
    }

    const connect = await connectByoB2(pool, { userId: viewerId, creds });
    if (!connect.ok) {
      res.status(503).json({ ok: false, error: connect.reason });
      return;
    }
    res.json({ ok: true });
  });

  // ──────────────────────────────────────────────────────────────────
  // DELETE /byo — koble fra (filene blir igjen på brukerens B2)
  // ──────────────────────────────────────────────────────────────────
  app.delete("/api/role-room/storage/byo", async (req: Request, res: Response) => {
    const viewerId = getUserIdFromRequest(req, activeSessions);
    if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

    await disconnectByoB2(pool, { userId: viewerId });
    res.json({ ok: true });
  });

  // ──────────────────────────────────────────────────────────────────
  // GET /byo/status — connection-status + aktiv migrasjon
  // ──────────────────────────────────────────────────────────────────
  app.get("/api/role-room/storage/byo/status", async (req: Request, res: Response) => {
    const viewerId = getUserIdFromRequest(req, activeSessions);
    if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

    const creds = await getByoCreds(pool, viewerId);
    const job = await getActiveMigration(pool, viewerId);
    res.json({
      connected: !!creds,
      bucketName: creds?.bucketName ?? null,
      region: creds?.region ?? null,
      migration: job,
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // POST /byo/migrate — start admin-B2 → user-B2 migrate
  // ──────────────────────────────────────────────────────────────────
  app.post("/api/role-room/storage/byo/migrate", async (req: Request, res: Response) => {
    const viewerId = getUserIdFromRequest(req, activeSessions);
    if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }

    const r = await startMigrationToByo(pool, viewerId);
    if (!r.ok) {
      res.status(r.reason === 'migration_already_running' ? 409 : 400).json(r);
      return;
    }
    res.json({ ok: true, jobId: r.jobId });
  });
}
