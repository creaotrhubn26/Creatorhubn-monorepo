/**
 * api-error — strukturert error-respons-helper for The Role Room-API.
 *
 * Stabilitetsaudit § 5.5: 744 `} catch (err)` -patterns i index.ts. Mange av
 * dem returnerer enten 500 med nakent objekt, eller verre — `res.json([])`
 * eller `res.json({ok: true})` — så frontend ikke kan skille "data finnes
 * ikke" fra "vi kan ikke nå databasen".
 *
 * Etter denne helperen får alle handlers et felles error-format:
 *   {
 *     error: <kode, en av FAILURE_CODES>,
 *     message: <human-readable>,
 *     retryable: <boolean>,
 *     retryAfterSeconds?: <hvis kjent>,
 *     traceId?: <hvis Sentry returnerer den>
 *   }
 *
 * Status-koder:
 *   - 503 Service Unavailable (retryable)         — DB nede, eksternal API time-out
 *   - 502 Bad Gateway (retryable)                  — Render-upstream som ikke svarer
 *   - 500 Internal Server Error (NOT retryable)    — uventet bug, ikke prøv igjen
 *
 * Bruk:
 *   import { respondWithError } from './api-error';
 *
 *   try {
 *     const result = await pool.query('SELECT ...');
 *     res.json(result.rows);
 *   } catch (err) {
 *     respondWithError(res, err, { endpoint: 'GET /api/foo', userId: req.user?.id });
 *   }
 */

import type { Response } from "express";

export type ApiFailureCode =
  | "database_unavailable"
  | "database_timeout"
  | "upstream_unavailable"
  | "rate_limited"
  | "validation_failed"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "internal_error";

export interface ApiErrorBody {
  error: ApiFailureCode;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
  traceId?: string;
}

interface RespondOptions {
  /** Beskriv hvor feilen oppstod for logger. */
  endpoint?: string;
  /** Kontekst for logger (user, project, etc). */
  context?: Record<string, unknown>;
  /** Override default status-code-mapping. */
  status?: number;
  /** Override message. Hvis ikke gitt brukes auto-mapping fra error. */
  message?: string;
}

// ─────────────────────────────────────────────────────────
// Error-klassifikator — kobler raw error til failure-code + status
// ─────────────────────────────────────────────────────────

interface Classification {
  status: number;
  code: ApiFailureCode;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
}

function classifyError(error: unknown): Classification {
  const errAny = error as Record<string, unknown> | null;
  const code = errAny && typeof errAny.code === "string" ? errAny.code : "";
  const message = errAny && typeof errAny.message === "string" ? errAny.message : "";

  // PostgreSQL-feilkoder (https://www.postgresql.org/docs/current/errcodes-appendix.html)
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ENOTFOUND") {
    return {
      status: 503,
      code: "database_unavailable",
      message: "Database kan ikke nås akkurat nå",
      retryable: true,
      retryAfterSeconds: 30,
    };
  }
  if (code === "57P01" || code === "57P02" || code === "57P03") {
    return {
      status: 503,
      code: "database_unavailable",
      message: "Database starter på nytt — prøv igjen om litt",
      retryable: true,
      retryAfterSeconds: 10,
    };
  }
  if (code === "53300" || code === "53400") {
    // too_many_connections / configuration_limit_exceeded
    return {
      status: 503,
      code: "database_unavailable",
      message: "For mange samtidige databasekall — prøv igjen",
      retryable: true,
      retryAfterSeconds: 5,
    };
  }
  if (code === "57014") {
    return {
      status: 503,
      code: "database_timeout",
      message: "Database-spørringen tok for lang tid",
      retryable: true,
      retryAfterSeconds: 15,
    };
  }
  if (typeof code === "string" && code.startsWith("23")) {
    // Integrity violations (unique key, foreign key, not null, etc)
    return {
      status: 409,
      code: "conflict",
      message: message || "Konflikt — data finnes allerede eller refererer noe som ikke finnes",
      retryable: false,
    };
  }

  // Nettverks-feil mot upstream API
  if (
    typeof message === "string" &&
    (message.includes("fetch failed") ||
      message.includes("getaddrinfo") ||
      message.includes("ECONNRESET"))
  ) {
    return {
      status: 502,
      code: "upstream_unavailable",
      message: "Avhengig tjeneste svarer ikke",
      retryable: true,
      retryAfterSeconds: 20,
    };
  }

  // Default: 500 Internal Server Error
  return {
    status: 500,
    code: "internal_error",
    message: "Uventet feil på serveren",
    retryable: false,
  };
}

// ─────────────────────────────────────────────────────────
// Main respond-funksjon
// ─────────────────────────────────────────────────────────

export function respondWithError(
  res: Response,
  error: unknown,
  options: RespondOptions = {},
): void {
  const classification = classifyError(error);
  const status = options.status ?? classification.status;
  const body: ApiErrorBody = {
    error: classification.code,
    message: options.message ?? classification.message,
    retryable: classification.retryable,
  };
  if (classification.retryAfterSeconds !== undefined) {
    body.retryAfterSeconds = classification.retryAfterSeconds;
    res.setHeader("Retry-After", String(classification.retryAfterSeconds));
  }

  // Logg — full feil + kontekst går til Render-logs. Hvis Sentry er
  // konfigurert kunne vi sendt der her — gjøres når SENTRY_DSN er satt.
  const logPayload = {
    endpoint: options.endpoint,
    context: options.context,
    classification,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error,
  };
  console.error("[api-error]", JSON.stringify(logPayload, null, 2));

  res.status(status).json(body);
}

/**
 * 503-spesial: når en handler IKKE kan svare pga tabell ikke finnes, eller
 * eksternal tjeneste midlertidig nede. Frontend kan retry med backoff.
 */
export function respondServiceUnavailable(
  res: Response,
  message: string,
  retryAfterSeconds = 30,
): void {
  res.setHeader("Retry-After", String(retryAfterSeconds));
  const body: ApiErrorBody = {
    error: "database_unavailable",
    message,
    retryable: true,
    retryAfterSeconds,
  };
  res.status(503).json(body);
}

/**
 * 400-spesial: validation-feil. Bruker har sendt feil data.
 */
export function respondValidationError(
  res: Response,
  message: string,
  fieldErrors?: Record<string, string>,
): void {
  const body: ApiErrorBody & { fields?: Record<string, string> } = {
    error: "validation_failed",
    message,
    retryable: false,
  };
  if (fieldErrors) (body as { fields?: Record<string, string> }).fields = fieldErrors;
  res.status(400).json(body);
}
