/**
 * leadgrid-api-key-mgmt-routes.ts
 *
 * Admin-routes (session-auth) for å lage/liste/revokere Leadgrid API-keys.
 *
 *   POST   /api/leadgrid/api-keys              (api_keys.create)
 *   GET    /api/leadgrid/api-keys              (api_keys.view)
 *   POST   /api/leadgrid/api-keys/:id/revoke   (api_keys.revoke)
 *
 * Key-format: lgk_live_<24 bytes base64url>  (eller lgk_test_...)
 * Vi lagrer kun SHA-256-hash + prefix. Token vises KUN ved opprettelse.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { randomBytes, createHash } from "crypto";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

/**
 * Smart org-id resolve for API-key mgmt:
 *  1. body.organization_id eller query.organization_id eksplisitt
 *  2. brukerens første organization_members-rad (admin > salgssjef > annet)
 */
async function resolveOrgIdSmart(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const explicit =
    (req.body && (req.body as Record<string, unknown>).organization_id) ??
    (req.query && (req.query as Record<string, unknown>).organization_id);
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  try {
    const r = await pool.query<{ organization_id: string }>(
      `SELECT organization_id::text
         FROM organization_members
        WHERE user_id = $1
        ORDER BY CASE role
                   WHEN 'admin' THEN 1
                   WHEN 'salgssjef' THEN 2
                   ELSE 3
                 END,
                 joined_at ASC
        LIMIT 1`,
      [userId],
    );
    return r.rows[0]?.organization_id ?? null;
  } catch {
    return null;
  }
}

function generateApiKey(env: "live" | "test"): { token: string; prefix: string } {
  // Prefix er 9 tegn ("lgk_live_" / "lgk_test_") — matcher slice(0,9)
  // i leadgrid-api-key-auth.ts.
  const prefix = `lgk_${env}_`;
  const token = prefix + randomBytes(24).toString("base64url");
  return { token, prefix };
}

const VALID_SCOPES = new Set([
  "leads.read",
  "leads.write",
  "recommendations.read",
  "recommendations.write",
  "*",
]);

function sanitizeScopes(input: unknown): string[] {
  if (!Array.isArray(input)) return ["leads.read"];
  const cleaned = input
    .filter((s): s is string => typeof s === "string")
    .filter((s) => VALID_SCOPES.has(s));
  return cleaned.length > 0 ? Array.from(new Set(cleaned)) : ["leads.read"];
}

export function registerLeadgridApiKeyMgmtRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;
  const common = { pool, activeSessions, resolveOrgId: resolveOrgIdSmart };
  const permCreate = requireLeadMapPermission("api_keys.create", common);
  const permView = requireLeadMapPermission("api_keys.view", common);
  const permRevoke = requireLeadMapPermission("api_keys.revoke", common);

  // ───────────────────────────────────────────────────────────────────
  // POST /api/leadgrid/api-keys — opprett ny key
  // Body: { name, scopes?, env?, rate_limit_rpm?, expires_at? }
  // Returnerer { id, token, warning } — token vises KUN her, kan ikke
  // hentes senere (vi lagrer kun hash).
  // ───────────────────────────────────────────────────────────────────
  app.post("/api/leadgrid/api-keys", permCreate, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) {
      res.status(401).json({ error: "Innlogging kreves" });
      return;
    }
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) {
      res.status(400).json({ error: "mangler_organization_id" });
      return;
    }
    const b = (req.body ?? {}) as {
      name?: string;
      scopes?: string[];
      env?: "live" | "test";
      rate_limit_rpm?: number;
      expires_at?: string;
    };
    if (!b.name || typeof b.name !== "string" || b.name.trim().length === 0) {
      res.status(400).json({ error: "name kreves" });
      return;
    }
    const env: "live" | "test" = b.env === "test" ? "test" : "live";
    const scopes = sanitizeScopes(b.scopes);
    const rateLimit =
      typeof b.rate_limit_rpm === "number" &&
      b.rate_limit_rpm > 0 &&
      b.rate_limit_rpm <= 10_000
        ? Math.floor(b.rate_limit_rpm)
        : 60;
    const { token, prefix } = generateApiKey(env);
    const keyHash = createHash("sha256").update(token).digest("hex");

    try {
      const r = await pool.query<{ id: string }>(
        `INSERT INTO leadgrid_api_keys
           (organization_id, name, key_prefix, key_hash,
            scopes, rate_limit_rpm, expires_at, created_by)
         VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7, $8)
         RETURNING id::text`,
        [
          orgId,
          b.name.trim(),
          prefix,
          keyHash,
          JSON.stringify(scopes),
          rateLimit,
          b.expires_at ?? null,
          session.userId,
        ],
      );
      // Token vises KUN nå — kan ikke hentes igjen.
      res.status(201).json({
        id: r.rows[0].id,
        token,
        prefix,
        scopes,
        rate_limit_rpm: rateLimit,
        env,
        warning:
          "Token vises KUN nå. Lagre den trygt. Vi lagrer kun SHA-256-hash.",
      });
    } catch (err) {
      console.warn("[api-key-mgmt] create feilet:", err);
      res.status(500).json({ error: "create_failed", detail: String(err) });
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // GET /api/leadgrid/api-keys — list org-ens keys (uten klartekst-token)
  // ───────────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/api-keys", permView, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) {
      res.status(401).json({ error: "Innlogging kreves" });
      return;
    }
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) {
      res.status(400).json({ error: "mangler_organization_id" });
      return;
    }
    try {
      const r = await pool.query(
        `SELECT id::text, name, key_prefix, scopes, rate_limit_rpm,
                last_used_at::text, total_requests, expires_at::text,
                revoked_at::text, revoked_reason, created_at::text
           FROM leadgrid_api_keys
          WHERE organization_id = $1::uuid
          ORDER BY created_at DESC`,
        [orgId],
      );
      res.json({ data: r.rows });
    } catch (err) {
      console.warn("[api-key-mgmt] list feilet:", err);
      res.status(500).json({ error: "list_failed", detail: String(err) });
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // POST /api/leadgrid/api-keys/:id/revoke — revoker en key
  // Body: { reason? }
  // ───────────────────────────────────────────────────────────────────
  app.post("/api/leadgrid/api-keys/:id/revoke", permRevoke, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) {
      res.status(401).json({ error: "Innlogging kreves" });
      return;
    }
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) {
      res.status(400).json({ error: "mangler_organization_id" });
      return;
    }
    const reason = String(
      ((req.body as Record<string, unknown>)?.reason as string | undefined) ?? "manual",
    );
    try {
      const r = await pool.query(
        `UPDATE leadgrid_api_keys
            SET revoked_at = NOW(), revoked_reason = $1
          WHERE id = $2::uuid
            AND organization_id = $3::uuid
            AND revoked_at IS NULL
          RETURNING id::text`,
        [reason, req.params.id, orgId],
      );
      if (r.rowCount === 0) {
        res.status(404).json({ error: "ikke_funnet_eller_revokert" });
        return;
      }
      res.json({ ok: true, id: r.rows[0].id });
    } catch (err) {
      console.warn("[api-key-mgmt] revoke feilet:", err);
      res.status(500).json({ error: "revoke_failed", detail: String(err) });
    }
  });
}
