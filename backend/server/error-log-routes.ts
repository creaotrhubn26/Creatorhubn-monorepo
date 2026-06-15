/**
 * error-log-routes.ts
 *
 *   GET    /api/admin-room/errors          — list (filters + pagination)
 *   GET    /api/admin-room/errors/stats    — 24t-statistikk
 *   POST   /api/admin-room/errors          — frontend JS-crash submit
 *   PATCH  /api/admin-room/errors/:id/resolve   — marker som løst
 *   PATCH  /api/admin-room/errors/:id/reopen    — gjenåpne
 *   DELETE /api/admin-room/errors/:id      — slett
 *
 * Plus: Express error-middleware som fanger alle ukjente 500-feil
 * automatisk og logger dem.
 */

import type { Express, Request, Response, NextFunction } from "express";
import type { Pool } from "pg";
import {
  logError,
  listErrors,
  getErrorStats,
  markErrorResolved,
  reopenError,
  deleteError,
} from "./error-log-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  isAdminEmail: (email: string | undefined) => boolean;
}

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    return activeSessions.get(token) ?? null;
  }
  return null;
}

function ipFromReq(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

export function registerErrorLogRoutes({
  app,
  pool,
  activeSessions,
  isAdminEmail,
}: Deps): void {
  function requireAdmin(req: Request, res: Response): SessionData | null {
    const session = getSession(req, activeSessions);
    if (!session) {
      res.status(401).json({ error: "ikke_innlogget" });
      return null;
    }
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      res.status(403).json({ error: "krever_admin" });
      return null;
    }
    return session;
  }

  // ── Frontend JS-crash submit (åpent — alle innloggede kan rapportere) ──
  app.post("/api/admin-room/errors", async (req, res) => {
    const session = getSession(req, activeSessions);
    const body = (req.body ?? {}) as {
      message?: string;
      stack?: string;
      errorName?: string;
      url?: string;
      claritySessionId?: string;
      meta?: Record<string, unknown>;
      level?: "error" | "warning" | "info";
    };
    if (!body.message || typeof body.message !== "string") {
      return res.status(400).json({ error: "mangler_message" });
    }
    try {
      const id = await logError(pool, {
        level: body.level ?? "error",
        source: "frontend",
        message: body.message,
        errorName: body.errorName,
        stack: body.stack,
        url: body.url,
        claritySessionId: body.claritySessionId,
        userId: session?.userId,
        userEmail: session?.email,
        ip: ipFromReq(req),
        userAgent: req.headers["user-agent"] as string | undefined,
        meta: body.meta ?? {},
      });
      return res.json({ ok: true, errorId: id });
    } catch (err) {
      return res.status(500).json({ error: "log_failed", detail: String(err) });
    }
  });

  // ── List (admin) ────────────────────────────────────────────────
  app.get("/api/admin-room/errors", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const errors = await listErrors(pool, {
        showResolved: req.query.showResolved === "true",
        source: req.query.source as "backend" | "frontend" | undefined,
        level: req.query.level as "error" | "warning" | "info" | undefined,
        endpoint: req.query.endpoint as string | undefined,
        userEmail: req.query.userEmail as string | undefined,
        hoursAgo: req.query.hoursAgo ? Number(req.query.hoursAgo) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : 200,
      });
      return res.json({ errors });
    } catch (err) {
      return res.status(500).json({ error: "list_failed", detail: String(err) });
    }
  });

  // ── Stats ────────────────────────────────────────────────────────
  app.get("/api/admin-room/errors/stats", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const stats = await getErrorStats(pool);
      return res.json({ stats });
    } catch (err) {
      return res.status(500).json({ error: "stats_failed", detail: String(err) });
    }
  });

  // ── Resolve ──────────────────────────────────────────────────────
  app.patch("/api/admin-room/errors/:id/resolve", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as { note?: string };
    try {
      const ok = await markErrorResolved(pool, {
        errorId: req.params.id,
        resolvedByUserId: session.userId,
        note: body.note,
      });
      return res.json({ ok });
    } catch (err) {
      return res.status(500).json({ error: "resolve_failed", detail: String(err) });
    }
  });

  // ── Reopen ──────────────────────────────────────────────────────
  app.patch("/api/admin-room/errors/:id/reopen", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const ok = await reopenError(pool, req.params.id);
      return res.json({ ok });
    } catch (err) {
      return res.status(500).json({ error: "reopen_failed", detail: String(err) });
    }
  });

  // ── Delete ──────────────────────────────────────────────────────
  app.delete("/api/admin-room/errors/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const ok = await deleteError(pool, req.params.id);
      return res.json({ ok });
    } catch (err) {
      return res.status(500).json({ error: "delete_failed", detail: String(err) });
    }
  });
}

/**
 * Express error-middleware som fanger 500-er fra alle routes.
 *
 * Mount ETTER alle routes, RETT FØR siste error-responder:
 *
 *   app.use(buildErrorLogMiddleware(pool));
 *   app.use((err, req, res, next) => res.status(500).json({...}));
 */
export function buildErrorLogMiddleware(pool: Pool) {
  return async (err: Error, req: Request, res: Response, next: NextFunction) => {
    try {
      const session = (req as Request & { session?: SessionData }).session;
      await logError(pool, {
        level: "error",
        source: "backend",
        statusCode: 500,
        endpoint: `${req.method} ${req.path}`,
        message: err.message ?? "Unknown error",
        errorName: err.name,
        stack: err.stack,
        userId: session?.userId,
        userEmail: session?.email,
        ip: ipFromReq(req),
        userAgent: req.headers["user-agent"] as string | undefined,
        meta: {
          query: req.query,
          headers: { "content-type": req.headers["content-type"] },
        },
      });
    } catch {
      /* never throw from logger */
    }
    next(err);
  };
}

/**
 * Catcher for unhandled promise rejections + uncaught exceptions.
 * Logger uten å crashe prosessen.
 *
 * Mount én gang i index.ts etter pool er klar.
 */
export function installProcessErrorHandlers(pool: Pool): void {
  process.on("unhandledRejection", (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    void logError(pool, {
      level: "error",
      source: "backend",
      endpoint: "<unhandledRejection>",
      message: err.message,
      errorName: err.name,
      stack: err.stack,
      meta: { kind: "unhandledRejection" },
    });
  });
  process.on("uncaughtException", (err) => {
    void logError(pool, {
      level: "error",
      source: "backend",
      endpoint: "<uncaughtException>",
      message: err.message,
      errorName: err.name,
      stack: err.stack,
      meta: { kind: "uncaughtException" },
    });
  });
}
