/**
 * _shared-idempotency.ts
 *
 * Opt-in idempotency-key middleware for POST/PUT-endpoints.
 *
 * Bakgrunn: REST-klienter kan oppleve nettverks-feil etter at server har
 * mottatt og prosessert en request (men før respons-ack når frem). Hvis
 * klienten gjør automatisk retry, kan samme operasjon utføres flere ganger
 * — duplikate rows, doble emails, doble Stripe-charges. Idempotency-keys
 * løser dette ved at klienten genererer en unik nøkkel pr "logisk
 * operasjon" og inkluderer den i `Idempotency-Key`-headeren. Server lagrer
 * (key, request-hash, response) i 24 timer; ved repeat returneres cached
 * respons istedenfor å re-utføre.
 *
 * **API-design (Stripe-mønster):**
 *   - Klient sender `Idempotency-Key: <UUID>` header (opt-in — ingen header
 *     = ingen idempotency-check, eksisterende oppførsel bevart)
 *   - Server hash'er (method + path + body) → `requestHash`
 *   - Lookup på (scope, method, path, key):
 *       - INGEN match: lagre respons etter at handler ferdig
 *       - MATCH + samme hash: returner cached respons
 *       - MATCH + ulik hash: 422 (klient prøver samme key for annen body)
 *
 * **Tabell:** `idempotency_keys_v1` (opprettes idempotent ved oppstart).
 *
 * Eksporterer:
 *   - ensureIdempotencyTable(pool)
 *   - readIdempotencyKey(req)
 *   - hashRequest(req)
 *   - idempotencyMiddleware(deps)
 */

import { createHash } from "crypto";
import type express from "express";
import type { Pool } from "pg";

export const IDEMPOTENCY_TABLE = "idempotency_keys_v1";

let tableReadyPromise: Promise<boolean> | null = null;

/**
 * Oppretter idempotency-tabellen idempotent. Trygt å kalle flere ganger
 * (cacher resultat). Returnerer false hvis DB-feil.
 */
export async function ensureIdempotencyTable(pool: Pool): Promise<boolean> {
  if (tableReadyPromise) return tableReadyPromise;
  tableReadyPromise = (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${IDEMPOTENCY_TABLE} (
          scope VARCHAR(64) NOT NULL,
          request_method VARCHAR(10) NOT NULL,
          request_path TEXT NOT NULL,
          idempotency_key VARCHAR(255) NOT NULL,
          request_hash VARCHAR(64) NOT NULL,
          response_status INTEGER NOT NULL,
          response_body JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (scope, request_method, request_path, idempotency_key)
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS ${IDEMPOTENCY_TABLE}_created_at_idx
          ON ${IDEMPOTENCY_TABLE} (created_at)
      `);
      return true;
    } catch (error) {
      console.warn("ensureIdempotencyTable failed:", error);
      return false;
    }
  })();
  return tableReadyPromise;
}

/**
 * Henter Idempotency-Key fra request. Aksepterer både `Idempotency-Key`
 * (Stripe-stil) og `X-Idempotency-Key` (legacy). Tom/missing → null.
 */
export function readIdempotencyKey(req: express.Request): string | null {
  const direct = req.headers["idempotency-key"];
  const xed = req.headers["x-idempotency-key"];
  const value = Array.isArray(direct)
    ? direct[0]
    : Array.isArray(xed)
      ? xed[0]
      : direct ?? xed;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null;
}

/**
 * Hash'er request-body for å oppdage mismatch (samme key + ulik body).
 * Bruker stabil JSON-stringify (key-sortering) slik at object-property-
 * rekkefølge ikke påvirker hash. SHA256 → hex.
 */
export function hashRequest(req: express.Request): string {
  const payload = {
    method: req.method,
    path: req.path,
    body: stableStringify(req.body ?? null),
  };
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

/**
 * Stable JSON-stringify (rekursiv key-sortering). Sikrer at
 * `{a:1,b:2}` og `{b:2,a:1}` gir samme streng.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`,
  );
  return `{${entries.join(",")}}`;
}

export interface IdempotencyMiddlewareDeps {
  pool: Pool;
  /** Logisk scope-prefiks (eks. "casting"). Hindrer at samme key kolliderer på tvers av API-domener. */
  scope: string;
  /** TTL i sekunder. Etter dette ses keys som "ikke sett før". Default 86400 (24t). */
  ttlSeconds?: number;
}

/**
 * Bygger en Express-middleware som håndterer Idempotency-Key.
 *
 * - Hvis request ikke har Idempotency-Key-header: no-op (next()).
 * - Hvis key + request_hash matcher tidligere respons innenfor TTL:
 *   returner cached respons med 'Idempotent-Replayed: true' header.
 * - Hvis key matcher men hash IKKE matcher (samme key + ulik body):
 *   returner 422.
 * - Ellers: la handler kjøre. Lagre respons-status+body i tabellen for
 *   fremtidige replays.
 *
 * NB: Middleware må kjøre ETTER body-parser (vanligvis `express.json()`).
 */
export function idempotencyMiddleware(
  deps: IdempotencyMiddlewareDeps,
): express.RequestHandler {
  const { pool, scope } = deps;
  const ttlSeconds = deps.ttlSeconds ?? 86400; // 24 timer default

  return async function idempotencyHandler(req, res, next) {
    const key = readIdempotencyKey(req);
    if (!key) {
      // Opt-in: ingen header = ingen idempotency-håndtering.
      return next();
    }

    const tableReady = await ensureIdempotencyTable(pool);
    if (!tableReady) {
      // DB utilgjengelig → la handler kjøre uten cache (failure mode skal
      // ikke blokkere normal trafikk).
      return next();
    }

    const hash = hashRequest(req);

    try {
      const lookup = await pool.query<{
        request_hash: string;
        response_status: number;
        response_body: unknown;
        created_at: Date;
      }>(
        `SELECT request_hash, response_status, response_body, created_at
         FROM ${IDEMPOTENCY_TABLE}
         WHERE scope = $1
           AND request_method = $2
           AND request_path = $3
           AND idempotency_key = $4
           AND created_at > NOW() - $5 * INTERVAL '1 second'
         LIMIT 1`,
        [scope, req.method, req.path, key, ttlSeconds],
      );

      const cached = lookup.rows[0];
      if (cached) {
        if (cached.request_hash !== hash) {
          // Samme key, ulik body — klient-feil.
          return res.status(422).json({
            error:
              "Idempotency-Key er brukt tidligere med forskjellig payload. Bruk en ny nøkkel eller send samme payload.",
          });
        }
        // Replay cached respons.
        res.setHeader("Idempotent-Replayed", "true");
        return res.status(cached.response_status).json(cached.response_body);
      }
    } catch (error) {
      console.warn("idempotency lookup failed:", error);
      return next();
    }

    // Capture respons for lagring. Monkey-patch res.json (samme mønster
    // som mange middleware-libs bruker).
    const originalJson = res.json.bind(res);
    res.json = function patchedJson(body: unknown) {
      const status = res.statusCode || 200;
      // Lagre i bakgrunnen — IKKE blokker respons.
      pool
        .query(
          `INSERT INTO ${IDEMPOTENCY_TABLE}
             (scope, request_method, request_path, idempotency_key, request_hash, response_status, response_body)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
           ON CONFLICT DO NOTHING`,
          [scope, req.method, req.path, key, hash, status, JSON.stringify(body)],
        )
        .catch((error) => {
          console.warn("idempotency record-store failed:", error);
        });
      return originalJson(body);
    };

    return next();
  };
}

/**
 * Periodisk cleanup av utløpte idempotency-rows. Returnerer antall rader
 * slettet. Skal kalles fra cron/scheduler — IKKE pr request.
 */
export async function cleanupExpiredIdempotencyRows(
  pool: Pool,
  ttlSeconds = 86400,
): Promise<number> {
  if (!(await ensureIdempotencyTable(pool))) return 0;
  try {
    const result = await pool.query(
      `DELETE FROM ${IDEMPOTENCY_TABLE}
       WHERE created_at < NOW() - $1 * INTERVAL '1 second'`,
      [ttlSeconds],
    );
    return result.rowCount ?? 0;
  } catch (error) {
    console.warn("cleanupExpiredIdempotencyRows failed:", error);
    return 0;
  }
}
