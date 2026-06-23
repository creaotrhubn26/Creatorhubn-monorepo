/**
 * leadgrid-public-api-v1.ts
 *
 * Public Leadgrid API v1 — stable schema for 3.-parts-integrasjoner
 * (Salesforce, HubSpot, custom connectors).
 *
 * Auth: Bearer <api_key> (Authorization-header). Se leadgrid-api-key-auth.ts.
 * Scopes: leads.read, leads.write, recommendations.read, recommendations.write, *
 *
 * Endpoints:
 *   GET  /api/v1/health             — verifiser API-key (alle scopes)
 *   GET  /api/v1/leads              — list leads for org    (leads.read)
 *   GET  /api/v1/leads/:id          — hent én lead          (leads.read)
 *   POST /api/v1/leads              — opprett ny lead       (leads.write)
 *   GET  /api/v1/recommendations    — list NBA              (recommendations.read)
 *
 * NB: crm_customers har IKKE organization_id-kolonne. Vi filtrerer via
 * owner_user_id IN (SELECT user_id FROM organization_members WHERE org=$1).
 * Samme mønster som leadgrid-analytics-service.ts.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireApiKey } from "./leadgrid-api-key-auth.js";

interface Deps {
  app: Express;
  pool: Pool;
}

/**
 * CTE-fragment for å filtrere crm_customers på org. Brukes som
 *   `WHERE owner_user_id IN (${ORG_MEMBERS_SUBQUERY})` med $1 = orgId.
 * Matcher leadgrid-analytics-service.ts.
 */
const ORG_MEMBERS_SUBQUERY = `SELECT user_id::text FROM organization_members WHERE organization_id = $1::uuid`;

function clampInt(v: unknown, min: number, max: number, def: number): number {
  const n = parseInt(String(v ?? def), 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export function registerLeadgridPublicApiV1(deps: Deps): void {
  const { app, pool } = deps;

  // Wildcard "*" matches alle scopes (sjekkes i requireApiKey selv).
  const requireLeadsRead = requireApiKey(pool, ["leads.read"]);
  const requireLeadsWrite = requireApiKey(pool, ["leads.write"]);
  const requireRecRead = requireApiKey(pool, ["recommendations.read"]);

  // ───────────────────────────────────────────────────────────────────
  // GET /api/v1/health — verifiser API-key gyldighet + se scopes
  // (Bruker tom requiredScopes = kun gyldig-key-sjekk.)
  // ───────────────────────────────────────────────────────────────────
  app.get("/api/v1/health", requireApiKey(pool, []), (req: Request, res: Response) => {
    res.json({
      ok: true,
      organization_id: req.apiKey!.organizationId,
      scopes: req.apiKey!.scopes,
      rate_limit_rpm: req.apiKey!.rateLimitRpm,
      version: "v1",
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // GET /api/v1/leads — paginert liste av leads for API-keyens org
  // Query: ?limit=50&offset=0
  // ───────────────────────────────────────────────────────────────────
  app.get("/api/v1/leads", requireLeadsRead, async (req: Request, res: Response) => {
    const orgId = req.apiKey!.organizationId;
    const limit = clampInt(req.query.limit, 1, 200, 50);
    const offset = clampInt(req.query.offset, 0, 1_000_000, 0);
    try {
      const r = await pool.query(
        `SELECT id::text, name, company, email, phone,
                pipeline_stage, lead_status, lead_temperature,
                lead_score, expected_value::float8 AS expected_value,
                conversion_probability::float8 AS conversion_probability,
                next_best_action, next_follow_up_at::text,
                latitude::float8 AS latitude, longitude::float8 AS longitude,
                city, country, lead_source, lead_category,
                created_at::text, updated_at::text
           FROM crm_customers
          WHERE owner_user_id IN (${ORG_MEMBERS_SUBQUERY})
            AND archived_at IS NULL
          ORDER BY updated_at DESC NULLS LAST, created_at DESC
          LIMIT $2 OFFSET $3`,
        [orgId, limit, offset],
      );
      const totalR = await pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM crm_customers
          WHERE owner_user_id IN (${ORG_MEMBERS_SUBQUERY})
            AND archived_at IS NULL`,
        [orgId],
      );
      res.json({
        data: r.rows,
        meta: {
          total: Number(totalR.rows[0]?.total ?? 0),
          limit,
          offset,
          version: "v1",
        },
      });
    } catch (err) {
      console.warn("[public-api-v1] /leads list feilet:", err);
      res.status(500).json({ error: "list_failed", detail: String(err) });
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // GET /api/v1/leads/:id — én lead (org-scoped)
  // ───────────────────────────────────────────────────────────────────
  app.get("/api/v1/leads/:id", requireLeadsRead, async (req: Request, res: Response) => {
    const orgId = req.apiKey!.organizationId;
    try {
      const r = await pool.query(
        `SELECT id::text, name, company, email, phone,
                pipeline_stage, lead_status, lead_temperature,
                lead_score, expected_value::float8 AS expected_value,
                conversion_probability::float8 AS conversion_probability,
                next_best_action, next_best_action_reason,
                next_follow_up_at::text, last_contacted_at::text,
                latitude::float8 AS latitude, longitude::float8 AS longitude,
                address, city, country, postal_code,
                lead_source, lead_category, website_url,
                created_at::text, updated_at::text
           FROM crm_customers
          WHERE id = $1::uuid
            AND owner_user_id IN (${ORG_MEMBERS_SUBQUERY.replace("$1::uuid", "$2::uuid")})
            AND archived_at IS NULL`,
        [req.params.id, orgId],
      );
      if (r.rowCount === 0) {
        res.status(404).json({ error: "lead_not_found" });
        return;
      }
      res.json({ data: r.rows[0], meta: { version: "v1" } });
    } catch (err) {
      console.warn("[public-api-v1] /leads/:id feilet:", err);
      res.status(500).json({ error: "get_failed", detail: String(err) });
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // POST /api/v1/leads — opprett ny lead i API-keyens org
  // Body: { name (required), company, email, phone, address, city,
  //         country, postal_code, latitude, longitude,
  //         lead_source, lead_category }
  // Returnerer { data: { id }, meta: { version: "v1" } } 201.
  //
  // NB: vi setter owner_user_id = "leadgrid_api" (system-owner) slik at
  // raden tilhører org-en via owner→org-medlemskap. Hvis du heller vil
  // ha en konkret bruker som eier: bytt ut owner_user_id-defaulten etter
  // org_id-resolve. Dagens analytics filtrerer via org_members, så vi må
  // velge en owner som ER medlem av org-en.
  // ───────────────────────────────────────────────────────────────────
  app.post("/api/v1/leads", requireLeadsWrite, async (req: Request, res: Response) => {
    const orgId = req.apiKey!.organizationId;
    const b = (req.body ?? {}) as {
      name?: string;
      company?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      country?: string;
      postal_code?: string;
      latitude?: number;
      longitude?: number;
      lead_source?: string;
      lead_category?: string;
    };
    if (!b.name || typeof b.name !== "string" || b.name.trim().length === 0) {
      res.status(400).json({
        error: "validation_failed",
        issues: [{ path: "name", message: "påkrevd" }],
      });
      return;
    }

    // Velg en owner_user_id som faktisk er medlem av org-en. Hvis ingen
    // medlem finnes (org tom), brekker insertet på org-filter senere uansett.
    let ownerUserId: string | null = null;
    try {
      const ownerR = await pool.query<{ user_id: string }>(
        `SELECT user_id::text
           FROM organization_members
          WHERE organization_id = $1::uuid
          ORDER BY CASE role
                     WHEN 'admin' THEN 1
                     WHEN 'salgssjef' THEN 2
                     ELSE 3
                   END,
                   joined_at ASC
          LIMIT 1`,
        [orgId],
      );
      ownerUserId = ownerR.rows[0]?.user_id ?? null;
    } catch {
      ownerUserId = null;
    }
    if (!ownerUserId) {
      res.status(400).json({
        error: "no_org_members",
        message: "API-keyens org har ingen medlemmer å assigne lead til.",
      });
      return;
    }

    try {
      const r = await pool.query<{ id: string }>(
        `INSERT INTO crm_customers
           (name, company, email, phone,
            address, city, country, postal_code,
            latitude, longitude, lead_source, lead_category,
            pipeline_stage, lead_status, owner_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                 'new', 'unvisited', $13)
         RETURNING id::text`,
        [
          b.name.trim(),
          b.company ?? null,
          b.email ?? null,
          b.phone ?? null,
          b.address ?? null,
          b.city ?? null,
          b.country ?? null,
          b.postal_code ?? null,
          b.latitude ?? null,
          b.longitude ?? null,
          b.lead_source ?? "api",
          b.lead_category ?? null,
          ownerUserId,
        ],
      );
      res.status(201).json({
        data: { id: r.rows[0].id },
        meta: { version: "v1" },
      });
    } catch (err) {
      console.warn("[public-api-v1] /leads POST feilet:", err);
      res.status(500).json({ error: "create_failed", detail: String(err) });
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // GET /api/v1/recommendations — list Next Best Action for org
  // Query: ?priority=urgent|high|normal|low&limit=50
  // ───────────────────────────────────────────────────────────────────
  app.get("/api/v1/recommendations", requireRecRead, async (req: Request, res: Response) => {
    const orgId = req.apiKey!.organizationId;
    const limit = clampInt(req.query.limit, 1, 200, 50);
    const priorityRaw = req.query.priority;
    const priority =
      typeof priorityRaw === "string" &&
      ["low", "normal", "high", "urgent"].includes(priorityRaw)
        ? priorityRaw
        : null;
    try {
      const params: (string | number)[] = [orgId, limit];
      let where = "";
      if (priority) {
        params.push(priority);
        where = "AND priority = $3";
      }
      const r = await pool.query(
        `SELECT id::text, lead_id::text, action_type, channel, priority,
                reason, status, confidence::float8 AS confidence,
                created_at::text, expires_at::text
           FROM lead_recommendations
          WHERE organization_id = $1::uuid
            AND status = 'pending'
            ${where}
          ORDER BY
            CASE priority
              WHEN 'urgent' THEN 1
              WHEN 'high' THEN 2
              WHEN 'normal' THEN 3
              WHEN 'low' THEN 4
              ELSE 5
            END,
            created_at DESC
          LIMIT $2`,
        params,
      );
      res.json({
        data: r.rows,
        meta: { version: "v1", total: r.rows.length, limit },
      });
    } catch (err) {
      console.warn("[public-api-v1] /recommendations feilet:", err);
      res.status(500).json({ error: "list_failed", detail: String(err) });
    }
  });
}
