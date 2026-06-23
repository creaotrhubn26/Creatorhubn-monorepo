/**
 * sentry-init.ts
 *
 * Sentry-initialisering for backend-prosessen.
 *
 * SDK-en er optional dependency. Hvis `SENTRY_DSN` env-var ikke er satt
 * eller pakken ikke kan lastes, skipper vi initialisering helt — appen
 * starter ren uten Sentry. Slik kan vi rulle dette ut uten å bryte
 * eksisterende dev/prod-flyt.
 *
 * Bruk i `index.ts` SOM ALLER FØRSTE import etter dotenv:
 *
 *   import { initBackendSentry } from "./sentry-init.js";
 *   initBackendSentry();
 *
 * Etter wire-up:
 *   - Unhandled exceptions logges automatisk
 *   - Express error-middleware fanger 500 fra alle routes
 *   - Stack traces inkluderer user-context hvis tilgjengelig
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";

// Sentry typer som any siden modulen lastes dynamisk
type SentryModule = {
  init: (config: Record<string, unknown>) => void;
  setUser: (user: Record<string, unknown> | null) => void;
  captureException: (err: unknown, hint?: Record<string, unknown>) => void;
  expressErrorHandler?: () => RequestHandler;
};

let sentry: SentryModule | null = null;
let initialized = false;

export function initBackendSentry(): boolean {
  if (initialized) return sentry !== null;
  initialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log("[sentry] SENTRY_DSN ikke satt — Sentry deaktivert");
    return false;
  }

  try {
    // Dynamisk import for å unngå å kreve @sentry/node ved oppstart
    // hvis det ikke er installert.

    const Sentry = require("@sentry/node") as SentryModule;
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      release: process.env.RENDER_GIT_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA,
      tracesSampleRate: 0.1,           // 10% av requests = traces
      profilesSampleRate: 0.1,
      sendDefaultPii: false,           // GDPR-vennlig — vi setter user selv
      // Ignorer kjente Chrome-extension-støy
      ignoreErrors: [
        "ResizeObserver loop limit exceeded",
        "Network request failed",
        /^Non-Error promise rejection captured/,
      ],
      // Filtrer ut PII fra request-body før send
      beforeSend(event: Record<string, unknown>) {
        const eventRecord = event as { request?: { headers?: Record<string, unknown>; data?: unknown } };
        if (eventRecord.request?.headers) {
          delete eventRecord.request.headers["authorization"];
          delete eventRecord.request.headers["cookie"];
          delete eventRecord.request.headers["x-cron-trigger-token"];
        }
        if (eventRecord.request?.data && typeof eventRecord.request.data === "object") {
          const data = eventRecord.request.data as Record<string, unknown>;
          if (typeof data.password === "string") data.password = "[REDACTED]";
          if (typeof data.token === "string") data.token = "[REDACTED]";
        }
        return event;
      },
    });
    sentry = Sentry;
    console.log("[sentry] Initialisert · environment:", process.env.NODE_ENV ?? "development");
    return true;
  } catch (err) {
    console.warn("[sentry] Kunne ikke laste @sentry/node:", (err as Error).message);
    return false;
  }
}

/** Logger en exception manuelt. No-op hvis Sentry ikke er initialisert. */
export function captureBackendException(
  err: unknown,
  context?: {
    endpoint?: string;
    userId?: string;
    email?: string;
    extra?: Record<string, unknown>;
  },
): void {
  if (!sentry) return;
  try {
    sentry.captureException(err, {
      tags: { endpoint: context?.endpoint },
      user: context?.userId
        ? { id: context.userId, email: context?.email }
        : undefined,
      extra: context?.extra,
    });
  } catch {
    // ignore
  }
}

/**
 * Express middleware som fanger ukjente errors (next(err)) og logger til
 * Sentry uten å overskrive eksisterende error-handlers.
 *
 * Mount RETT FØR siste error-handler i Express-stacken:
 *
 *   app.use(buildSentryErrorMiddleware());
 *   app.use(errorResponder);  // din egen 500-responder
 */
export function buildSentryErrorMiddleware(): (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  return (err, req, res, next) => {
    captureBackendException(err, {
      endpoint: `${req.method} ${req.path}`,
      extra: {
        query: req.query,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });
    next(err);
  };
}

export function isSentryEnabled(): boolean {
  return sentry !== null;
}

/**
 * Spesialvariant av captureBackendException for Leadgrid-moduler.
 * Setter `leadgrid_module`-tag for å filtrere i Sentry-dashboardet.
 * Brukes f.eks. fra intelligence-cron, retention-cron, route-service.
 */
export function captureLeadgridError(
  module: string,
  err: unknown,
  context?: Record<string, unknown>,
): void {
  if (!sentry) {
    console.error(`[${module}] error (sentry off):`, err);
    return;
  }
  try {
    sentry.captureException(err, {
      tags: { leadgrid_module: module },
      extra: context,
    });
  } catch {
    // ignore — Sentry må aldri abort'e parent-flow
  }
}
