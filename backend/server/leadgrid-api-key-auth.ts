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

export type LeadgridApiKeyAccessScope = "project" | "organization";

export interface ApiKeyContext {
  apiKeyId: string;
  organizationId: string;
  projectId: string | null;
  accessScope: LeadgridApiKeyAccessScope;
  scopes: string[];
  rateLimitRpm: number;
}

/**
 * A project-bound key can only address its configured project. Organization
 * keys are a legacy/admin-only escape hatch and must still name a project on
 * every data request; this helper only verifies that the named project is
 * compatible with the immutable key binding.
 */
export function apiKeyAllowsProject(
  context: ApiKeyContext,
  projectId: string,
): boolean {
  if (context.accessScope === "organization") {
    return context.projectId === null;
  }
  return Boolean(context.projectId && context.projectId === projectId);
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
      project_id: string | null;
      access_scope: LeadgridApiKeyAccessScope;
      scopes: unknown;
      rate_limit_rpm: number;
    } | null = null;
    try {
      const r = await pool.query<{
        id: string;
        organization_id: string;
        project_id: string | null;
        access_scope: LeadgridApiKeyAccessScope;
        scopes: unknown;
        rate_limit_rpm: number;
      }>(
        `SELECT k.id::text,
                k.organization_id::text,
                k.project_id,
                k.access_scope,
                k.scopes,
                k.rate_limit_rpm
           FROM leadgrid_api_keys k
           LEFT JOIN leadgrid_projects p
             ON p.organization_id = k.organization_id
            AND p.id = k.project_id
          WHERE k.key_prefix = $1
            AND k.key_hash = $2
            AND k.revoked_at IS NULL
            AND (k.expires_at IS NULL OR k.expires_at > NOW())
            AND (
              (k.access_scope = 'organization' AND k.project_id IS NULL)
              OR (
                k.access_scope = 'project'
                AND k.project_id IS NOT NULL
                AND p.id IS NOT NULL
                AND (p.status IS NULL OR p.status NOT IN ('archived', 'deleted'))
                AND (p.project_type IS NULL OR p.project_type NOT IN (
                  'feature_film', 'documentary', 'film', 'short_film',
                  'tv_series', 'commercial', 'music_video', 'casting'
                ))
              )
            )
          LIMIT 1`,
        [prefix, hash],
      );
      if (!r.rows.length) {
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
      projectId: row.project_id,
      accessScope: row.access_scope,
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
