/**
 * _shared-auth.ts
 *
 * 3-fase auth-rollout for tidligere åpne endpoints (eks. casting).
 *
 * **Bakgrunn:** Casting-clusteret hadde ÅPNE endpoints (ingen
 * requireAdminSession-check), basert på legacy-antagelser. Direkte
 * skifte til 401 ville brekke alle eksisterende klienter. 3-fase-rollout
 * (open → log → enforce) gir trygg migrering.
 *
 * **Modi (env-styrt):**
 *   - `open` (default): Helper er no-op. Eksisterende oppførsel.
 *   - `log`: Helper logger unauth requests men slipper gjennom. Brukes
 *     for å samle data om hvor mye unauth-trafikk som finnes før enforce.
 *   - `enforce`: Returnerer 401 hvis ingen session.
 *
 * Skifte mellom modi via env-var `CASTING_AUTH_MODE` (eller modul-
 * spesifikk variant). Default `open` for backwards-compat.
 */

import type express from "express";

export type AuthMode = "open" | "log" | "enforce";

/**
 * Minimal session-shape — kun det helperen trenger. Matcher det
 * eksisterende `getActiveSessionFromRequest` returnerer i index.ts.
 */
export interface AuthSession {
  userId?: string;
  email?: string;
  [key: string]: unknown;
}

export interface AuthCheckDeps {
  /** Funksjon som henter session fra request (eks. fra Bearer/cookie). */
  getActiveSessionFromRequest: (
    req: express.Request,
  ) => AuthSession | null | undefined;
  /** Modus-flagg, vanligvis lest fra env. */
  authMode: AuthMode;
  /** Logisk scope-navn for logging (eks. "casting"). */
  scope: string;
}

/**
 * Sjekker auth ved request-handler-entry. Returnerer:
 *   - `{ proceed: true, session }` — request kan fortsette
 *   - `{ proceed: false }` — respons allerede sendt (kun i enforce-mode)
 *
 * I open/log-mode returneres ALLTID `proceed: true` slik at eksisterende
 * trafikk ikke brekkes.
 *
 * @example
 *   const auth = requireScopedAccess(req, res, { ...authDeps, scope: "casting" });
 *   if (!auth.proceed) return;
 *   // ...handler logic, har auth.session tilgjengelig (kan være null i open-mode)
 */
export function requireScopedAccess(
  req: express.Request,
  res: express.Response,
  deps: AuthCheckDeps,
): { proceed: boolean; session: AuthSession | null } {
  const session = deps.getActiveSessionFromRequest(req) ?? null;

  if (session) {
    // Authenticated request — gå videre i alle modi.
    return { proceed: true, session };
  }

  switch (deps.authMode) {
    case "open":
      // Default: ingen auth-check.
      return { proceed: true, session: null };

    case "log":
      // Log unauth requests for å vurdere enforcement-impact.
      console.info("[auth-log] unauthenticated request", {
        scope: deps.scope,
        method: req.method,
        path: req.path,
        userAgent: req.headers["user-agent"],
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });
      return { proceed: true, session: null };

    case "enforce":
      res.status(401).json({
        error: "Authentication required for this endpoint.",
      });
      return { proceed: false, session: null };
  }
}

/**
 * Parser env-variabel for auth-mode. Default `open` ved ukjent/missing.
 */
export function parseAuthMode(value: string | undefined): AuthMode {
  if (value === "log" || value === "enforce") return value;
  return "open";
}

/**
 * Bygger en Express-middleware som anvender requireScopedAccess på alle
 * requests under en path-prefix. Klassisk `(req, res, next)`-signatur.
 *
 * I open/log-modi: alltid `next()` (request går videre). I enforce-mode:
 * 401-respons hvis ingen session — `next()` ikke kalt.
 *
 * Setter `req.scopedSession` til parsert session (kan være null) for at
 * handlere skal kunne lese den uten gjenfetching.
 *
 * @example
 *   app.use("/api/casting", createScopedAuthMiddleware({
 *     getActiveSessionFromRequest, authMode: parseAuthMode(process.env.CASTING_AUTH_MODE), scope: "casting"
 *   }));
 */
export function createScopedAuthMiddleware(
  deps: AuthCheckDeps,
): express.RequestHandler {
  return function scopedAuthMiddleware(req, res, next) {
    const result = requireScopedAccess(req, res, deps);
    if (!result.proceed) {
      // 401 allerede sendt — IKKE next()
      return;
    }
    // Fest session på request for handlerne (best-effort — kan være null).
    (req as express.Request & { scopedSession?: AuthSession | null }).scopedSession =
      result.session;
    next();
  };
}
