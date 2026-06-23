/**
 * leadgrid-api-key-auth.ts
 *
 * API-key-middleware for Leadgrid Public API v1.
 *
 * Auth-format: `Authorization: Bearer lgk_live_<...>` (eller lgk_test_<...>).
 *
 * - Key_prefix er 9 første tegn ("lgk_live_" / "lgk_test_") for å unngå
 *   full-table-scan på hash-kolonnen.
 * - Key_hash er SHA-256(token) hex. Vi lagrer ALDRI klartekst-token.
 * - Scopes-array i DB (JSONB). Wildcard "*" gir alle scopes.
 * - Rate-limit: per-minutt-bucket i in-memory Map. Buckets ryddes hver 60s.
 *
 * Brukes av leadgrid-public-api-v1.ts:
 *   app.get("/api/v1/leads", requireApiKey(pool, ["leads.read"]), handler)
 */

import type { Request, Response, NextFunction } from "express";
import type { Pool } from "pg";
import { createHash } from "crypto";

interface ApiKeyContext {
  apiKeyId: string;
  organizationId: string;
  scopes: string[];
  rateLimitRpm: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKey?: ApiKeyContext;
    }
  }
}

// In-process minute-bucket counters for rate-limiting (avoid DB roundtrip
// on each request). Cleaned via setInterval below.
const usageCounters = new Map<string, { minute: string; count: number }>();

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function currentMinuteBucket(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}-${d.getUTCMinutes()}`;
}

/**
 * Middleware som krever en gyldig API-key i Authorization: Bearer <key>-headeren.
 * Setter req.apiKey hvis vellykket.
 *
 * @param pool           PG-pool
 * @param requiredScopes OR-logikk: minst én av disse må være i nøkkelens
 *                       scopes-array (eller "*" som wildcard).
 *                       Tom array = ingen scope-kontroll (kun gyldig key).
 */
export function requireApiKey(pool: Pool, requiredScopes: string[] = []) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      res.status(401).json({
        error: "missing_api_key",
        message: "Authorization: Bearer <key> kreves",
      });
      return;
    }
    const token = auth.slice(7).trim();
    if (!token.startsWith("lgk_")) {
      res.status(401).json({ error: "invalid_api_key_format" });
      return;
    }

    // Prefix = "lgk_live_" eller "lgk_test_" (9 tegn inkl. trailing underscore)
    const prefix = token.slice(0, 9);
    const hash = hashToken(token);

    let row: {
      id: string;
      organization_id: string;
      scopes: unknown;
      rate_limit_rpm: number;
    } | null = null;
    try {
      const r = await pool.query<{
        id: string;
        organization_id: string;
        scopes: unknown;
        rate_limit_rpm: number;
      }>(
        `SELECT id::text, organization_id::text, scopes, rate_limit_rpm
           FROM leadgrid_api_keys
          WHERE key_prefix = $1
            AND key_hash = $2
            AND revoked_at IS NULL
            AND (expires_at IS NULL OR expires_at > NOW())
          LIMIT 1`,
        [prefix, hash],
      );
      if (r.rowCount === 0) {
        res.status(401).json({ error: "invalid_or_revoked_api_key" });
        return;
      }
      row = r.rows[0];
    } catch (err) {
      console.warn("[api-key-auth] lookup feilet:", err);
      res.status(500).json({ error: "auth_lookup_failed" });
      return;
    }

    // Scope check (OR-logikk + wildcard)
    const scopes: string[] = Array.isArray(row.scopes)
      ? (row.scopes as string[])
      : [];
    if (requiredScopes.length > 0) {
      const ok = requiredScopes.some(
        (s) => scopes.includes(s) || scopes.includes("*"),
      );
      if (!ok) {
        res.status(403).json({
          error: "insufficient_scope",
          required: requiredScopes,
          granted: scopes,
        });
        return;
      }
    }

    // Rate-limit (per-minutt bucket)
    const minute = currentMinuteBucket();
    const counterKey = `${row.id}:${minute}`;
    const counter = usageCounters.get(counterKey);
    if (counter && counter.count >= row.rate_limit_rpm) {
      res.status(429).json({
        error: "rate_limit_exceeded",
        limit_rpm: row.rate_limit_rpm,
        retry_after_seconds: 60 - new Date().getUTCSeconds(),
      });
      return;
    }
    usageCounters.set(counterKey, {
      minute,
      count: (counter?.count ?? 0) + 1,
    });

    // Background-update DB-stats (fire-and-forget — ikke blokker request)
    void pool
      .query(
        `UPDATE leadgrid_api_keys
            SET last_used_at = NOW(), total_requests = total_requests + 1
          WHERE id = $1::uuid`,
        [row.id],
      )
      .catch(() => {
        /* ignore — telleren er beste-innsats */
      });

    req.apiKey = {
      apiKeyId: row.id,
      organizationId: row.organization_id,
      scopes,
      rateLimitRpm: row.rate_limit_rpm,
    };
    next();
  };
}

// ---------------------------------------------------------------------------
// Cleanup: drop old minute-buckets fra usageCounters hver minutt.
// .unref?.() så ikke vi holder Node fra å exit-e under tester.
// ---------------------------------------------------------------------------
const cleanupTimer = setInterval(() => {
  const cutoff = currentMinuteBucket();
  for (const [key, val] of usageCounters) {
    if (val.minute !== cutoff) usageCounters.delete(key);
  }
}, 60_000);
cleanupTimer.unref?.();
