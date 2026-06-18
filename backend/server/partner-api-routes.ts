/**
 * partner-api-routes.ts
 *
 * Public API for integration-partnere på /api/v1/partner/*.
 *
 * Auth:
 *   - Header: Authorization: Bearer lg_live_<key>
 *   - Key valideres mot partner_api_keys (sha256-hash)
 *   - Hver request audit-logges i partner_api_audit_log
 *
 * Endepunkter (MVP):
 *   GET  /api/v1/partner/me                          (validate + partner-info)
 *   GET  /api/v1/partner/customers                   (list)
 *   GET  /api/v1/partner/customers/:id               (detail)
 *   GET  /api/v1/partner/customers/:id/needs
 *   GET  /api/v1/partner/customers/:id/signals
 *   GET  /api/v1/partner/customers/:id/deliverables
 *   POST /api/v1/partner/customers                   (opprett — krever customers.write)
 *   GET  /api/v1/partner/organizations/:id
 *
 * Scopes (matcher Leadgrid internt RBAC):
 *   - customers.read
 *   - customers.write
 *   - needs.read
 *   - signals.read
 *   - deliverables.read
 *   - organizations.read
 *   - webhooks.read
 */

import type { Express, Request, Response, NextFunction } from "express";
import type { Pool } from "pg";
import crypto from "crypto";

interface Deps {
  app: Express;
  pool: Pool;
}

interface ApiKeyContext {
  api_key_id: string;
  partner_id: string | null;
  organization_id: string | null;
  scopes: string[];
}

function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

async function authenticateApiKey(
  req: Request, pool: Pool,
): Promise<ApiKeyContext | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const rawKey = auth.substring(7).trim();
  if (!rawKey.startsWith("lg_")) return null;

  const keyHash = hashApiKey(rawKey);
  const prefix = rawKey.substring(0, 12);

  const r = await pool.query<ApiKeyContext>(
    `SELECT id::text AS api_key_id,
            partner_id::text AS partner_id,
            organization_id::text AS organization_id,
            scopes
       FROM partner_api_keys
      WHERE key_prefix = $1
        AND key_hash = $2
        AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > now())
        AND revoked_at IS NULL`,
    [prefix, keyHash],
  );
  if (r.rows.length === 0) return null;
  // Touch last_used_at (fire-and-forget)
  void pool.query(`UPDATE partner_api_keys SET last_used_at = now() WHERE id = $1`,
    [r.rows[0].api_key_id]).catch(() => {});
  return r.rows[0];
}

function hasScope(ctx: ApiKeyContext, scope: string): boolean {
  return ctx.scopes.includes("*") || ctx.scopes.includes(scope);
}

async function logApiCall(
  pool: Pool, ctx: ApiKeyContext | null, req: Request,
  status: number, durationMs: number,
): Promise<void> {
  if (!ctx) return;
  try {
    await pool.query(
      `INSERT INTO partner_api_audit_log
        (api_key_id, method, path, status_code, duration_ms,
         ip_address, user_agent, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        ctx.api_key_id, req.method, req.path.slice(0, 300),
        status, durationMs,
        req.ip ?? null,
        (req.headers["user-agent"] as string)?.slice(0, 500) ?? null,
        (req.headers["x-request-id"] as string) ?? crypto.randomUUID(),
      ],
    );
  } catch (e) { console.error("[partner-api audit]", e); }
}

// Express middleware factory
function requireApiKey(pool: Pool, requiredScope: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const ctx = await authenticateApiKey(req, pool);
    if (!ctx) {
      const dur = Date.now() - start;
      await logApiCall(pool, null, req, 401, dur);
      return res.status(401).json({
        error: "unauthorized",
        message: "Mangler eller ugyldig Authorization-header. Bruk 'Bearer lg_live_…'.",
      });
    }
    if (!hasScope(ctx, requiredScope)) {
      const dur = Date.now() - start;
      await logApiCall(pool, ctx, req, 403, dur);
      return res.status(403).json({
        error: "insufficient_scope",
        required_scope: requiredScope,
        granted_scopes: ctx.scopes,
      });
    }
    (req as any).apiKey = ctx;
    (req as any)._startTime = start;
    next();
  };
}

function getCtx(req: Request): ApiKeyContext {
  return (req as any).apiKey as ApiKeyContext;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerPartnerApiRoutes({ app, pool }: Deps): void {
  const ROOT = "/api/v1/partner";

  // ---- GET /me -----------------------------------------------------------
  app.get(`${ROOT}/me`, requireApiKey(pool, "*"), async (req, res) => {
    const ctx = getCtx(req);
    const r = await pool.query(
      `SELECT k.id::text, k.name, k.scopes, k.last_used_at, k.expires_at,
              p.name AS partner_name, p.partner_type,
              o.name AS organization_name
         FROM partner_api_keys k
         LEFT JOIN leadgrid_partners p ON p.id = k.partner_id
         LEFT JOIN organizations o ON o.id = k.organization_id
        WHERE k.id::text = $1`,
      [ctx.api_key_id],
    );
    const dur = Date.now() - (req as any)._startTime;
    await logApiCall(pool, ctx, req, 200, dur);
    res.json({ api_key: r.rows[0], api_version: "v1" });
  });

  // ---- GET /customers ----------------------------------------------------
  app.get(`${ROOT}/customers`, requireApiKey(pool, "customers.read"), async (req, res) => {
    const ctx = getCtx(req);
    if (!ctx.organization_id) {
      return res.status(400).json({ error: "api_key_not_org_scoped" });
    }
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const r = await pool.query(
      `SELECT id::text, name, website_url, email, phone, status, lead_status,
              lead_category, ai_opportunity_score, tags, created_at::text
         FROM crm_customers
        WHERE organization_id = $1
        ORDER BY created_at DESC LIMIT $2`,
      [ctx.organization_id, limit],
    );
    const dur = Date.now() - (req as any)._startTime;
    await logApiCall(pool, ctx, req, 200, dur);
    res.json({ data: r.rows, count: r.rows.length });
  });

  // ---- GET /customers/:id ------------------------------------------------
  app.get(`${ROOT}/customers/:id`, requireApiKey(pool, "customers.read"), async (req, res) => {
    const ctx = getCtx(req);
    const r = await pool.query(
      `SELECT id::text, name, website_url, email, phone, status, lead_status,
              lead_category, ai_opportunity_score, tags, custom_fields,
              created_at::text, updated_at::text
         FROM crm_customers
        WHERE id::text = $1 AND organization_id = $2`,
      [req.params.id, ctx.organization_id],
    );
    const dur = Date.now() - (req as any)._startTime;
    if (r.rows.length === 0) {
      await logApiCall(pool, ctx, req, 404, dur);
      return res.status(404).json({ error: "not_found" });
    }
    await logApiCall(pool, ctx, req, 200, dur);
    res.json({ data: r.rows[0] });
  });

  // ---- GET /customers/:id/needs ------------------------------------------
  app.get(`${ROOT}/customers/:id/needs`, requireApiKey(pool, "needs.read"), async (req, res) => {
    const ctx = getCtx(req);
    // Bekreft tilgang via org-eierskap
    const own = await pool.query(
      `SELECT 1 FROM crm_customers WHERE id::text = $1 AND organization_id = $2`,
      [req.params.id, ctx.organization_id],
    );
    if (own.rows.length === 0) {
      return res.status(404).json({ error: "customer_not_found" });
    }
    const r = await pool.query(
      `SELECT need_type, priority, status, evidence,
              detected_at::text, updated_at::text
         FROM crm_customer_needs
        WHERE customer_id = $1
        ORDER BY priority DESC`,
      [req.params.id],
    );
    const dur = Date.now() - (req as any)._startTime;
    await logApiCall(pool, ctx, req, 200, dur);
    res.json({ data: r.rows });
  });

  // ---- GET /customers/:id/signals ----------------------------------------
  app.get(`${ROOT}/customers/:id/signals`, requireApiKey(pool, "signals.read"), async (req, res) => {
    const ctx = getCtx(req);
    const own = await pool.query(
      `SELECT 1 FROM crm_customers WHERE id::text = $1 AND organization_id = $2`,
      [req.params.id, ctx.organization_id],
    );
    if (own.rows.length === 0) {
      return res.status(404).json({ error: "customer_not_found" });
    }
    const r = await pool.query(
      `SELECT signal_type, polarity, raw_value, detected_at::text
         FROM crm_customer_signals
        WHERE customer_id = $1
        ORDER BY detected_at DESC`,
      [req.params.id],
    );
    const dur = Date.now() - (req as any)._startTime;
    await logApiCall(pool, ctx, req, 200, dur);
    res.json({ data: r.rows });
  });

  // ---- GET /customers/:id/deliverables -----------------------------------
  app.get(`${ROOT}/customers/:id/deliverables`, requireApiKey(pool, "deliverables.read"), async (req, res) => {
    const ctx = getCtx(req);
    // Hent via project_id
    const projR = await pool.query(
      `SELECT project_id FROM crm_customers
        WHERE id::text = $1 AND organization_id = $2`,
      [req.params.id, ctx.organization_id],
    );
    if (projR.rows.length === 0 || !projR.rows[0].project_id) {
      return res.json({ data: [] });
    }
    const r = await pool.query(
      `SELECT id::text, title, client_summary, status,
              target_date::text, completed_at::text,
              related_need_type, created_at::text
         FROM project_deliverables
        WHERE project_id = $1
        ORDER BY created_at DESC`,
      [projR.rows[0].project_id],
    );
    const dur = Date.now() - (req as any)._startTime;
    await logApiCall(pool, ctx, req, 200, dur);
    res.json({ data: r.rows });
  });

  // ---- POST /customers ---------------------------------------------------
  app.post(`${ROOT}/customers`, requireApiKey(pool, "customers.write"), async (req, res) => {
    const ctx = getCtx(req);
    if (!ctx.organization_id) {
      return res.status(400).json({ error: "api_key_not_org_scoped" });
    }
    const { name, website_url, email, phone, lead_category, tags } = req.body ?? {};
    if (!name) return res.status(400).json({ error: "name_required" });

    try {
      const r = await pool.query(
        `INSERT INTO crm_customers
          (id, name, website_url, email, phone, lead_category, tags,
           status, lead_status, organization_id, custom_fields)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6::text[],
                 'lead', 'unvisited', $7, '{}'::jsonb)
         RETURNING id::text, name, website_url, status, created_at::text`,
        [
          name, website_url ?? null, email ?? null, phone ?? null,
          lead_category ?? null, tags ?? [],
          ctx.organization_id,
        ],
      );
      const dur = Date.now() - (req as any)._startTime;
      await logApiCall(pool, ctx, req, 201, dur);

      // Fyre customer.created webhook (fire-and-forget)
      try {
        const { fireCustomerCreated } = await import("./partner-webhook-service.js");
        void fireCustomerCreated(pool, r.rows[0].id, ctx.organization_id);
      } catch (e) { console.error("[partner-api customer.created webhook]", e); }

      res.status(201).json({ data: r.rows[0] });
    } catch (e: any) {
      console.error("[partner-api create-customer]", e);
      const dur = Date.now() - (req as any)._startTime;
      await logApiCall(pool, ctx, req, 500, dur);
      res.status(500).json({ error: "create_failed" });
    }
  });

  // ---- GET /organizations/:id --------------------------------------------
  app.get(`${ROOT}/organizations/:id`, requireApiKey(pool, "organizations.read"), async (req, res) => {
    const ctx = getCtx(req);
    if (ctx.organization_id && req.params.id !== ctx.organization_id) {
      return res.status(403).json({ error: "wrong_organization" });
    }
    const r = await pool.query(
      `SELECT id::text, name, org_type, plan, website, industry,
              created_at::text
         FROM organizations WHERE id = $1`,
      [req.params.id],
    );
    const dur = Date.now() - (req as any)._startTime;
    if (r.rows.length === 0) {
      await logApiCall(pool, ctx, req, 404, dur);
      return res.status(404).json({ error: "not_found" });
    }
    await logApiCall(pool, ctx, req, 200, dur);
    res.json({ data: r.rows[0] });
  });
}
