/**
 * leadgrid-public-api-v1.ts
 *
 * Public Leadgrid API v1 — stable schema for 3.-parts-integrasjoner
 * (Salesforce, HubSpot, custom connectors).
 *
 * Auth: Bearer <api_key> (Authorization-header). Se leadgrid-api-key-auth.ts.
 * Scopes: leads.read, leads.write, outcomes.write,
 *         recommendations.read, recommendations.write, *
 *
 * Endpoints:
 *   GET  /api/v1/health             — verifiser API-key (alle scopes)
 *   GET  /api/v1/leads              — list leads for org    (leads.read)
 *   GET  /api/v1/leads/:id          — hent én lead          (leads.read)
 *   POST /api/v1/leads              — opprett ny lead       (leads.write)
 *   GET  /api/v1/recommendations    — list NBA              (recommendations.read)
 *
 * crm_customers.organization_id and project_id form the authoritative boundary.
 * Project-bound keys default to their immutable project. Explicit admin-only
 * organization keys must name an active Leadgrid project on every data call.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  apiKeyAllowsProject,
  requireApiKey,
  type ApiKeyContext,
} from "./leadgrid-api-key-auth.js";

interface Deps {
  app: Express;
  pool: Pool;
}

function clampInt(v: unknown, min: number, max: number, def: number): number {
  const n = parseInt(String(v ?? def), 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function optionalProjectId(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string") return undefined;
  const normalized = candidate.trim();
  if (!normalized || normalized.length > 255) return undefined;
  return normalized;
}

async function isActiveApiProject(
  pool: Pick<Pool, "query">,
  organizationId: string,
  projectId: string,
): Promise<boolean> {
  const result = await pool.query<{ id: string }>(
    `SELECT id::text
       FROM leadgrid_projects
      WHERE organization_id = $1::uuid
        AND id = $2
        AND (status IS NULL OR status NOT IN ('archived', 'deleted'))
        AND (project_type IS NULL OR project_type NOT IN (
          'feature_film','documentary','film','short_film','tv_series',
          'commercial','music_video','casting'))
      LIMIT 1`,
    [organizationId, projectId],
  );
  return Boolean(result.rows[0]);
}

type ProjectResolution =
  | { ok: true; projectId: string }
  | { ok: false; status: 400 | 403 | 404; error: string };

async function resolvePublicApiProject(
  pool: Pick<Pool, "query">,
  apiKey: ApiKeyContext,
  rawProjectId: unknown,
): Promise<ProjectResolution> {
  const requestedProjectId = optionalProjectId(rawProjectId);
  if (requestedProjectId === undefined) {
    return { ok: false, status: 400, error: "invalid_project_id" };
  }

  let projectId: string;
  if (apiKey.accessScope === "project") {
    if (!apiKey.projectId) {
      return { ok: false, status: 403, error: "invalid_api_key_scope" };
    }
    if (requestedProjectId && !apiKeyAllowsProject(apiKey, requestedProjectId)) {
      return { ok: false, status: 404, error: "project_not_found" };
    }
    projectId = apiKey.projectId;
  } else {
    if (!apiKeyAllowsProject(apiKey, requestedProjectId ?? "")) {
      return { ok: false, status: 403, error: "invalid_api_key_scope" };
    }
    if (!requestedProjectId) {
      return { ok: false, status: 400, error: "project_id_required" };
    }
    projectId = requestedProjectId;
  }

  if (!(await isActiveApiProject(pool, apiKey.organizationId, projectId))) {
    return { ok: false, status: 404, error: "project_not_found" };
  }
  return { ok: true, projectId };
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
      project_id: req.apiKey!.projectId,
      access_scope: req.apiKey!.accessScope,
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
    const rawProjectId = req.query.project_id ?? req.query.projectId;
    try {
      const project = await resolvePublicApiProject(
        pool,
        req.apiKey!,
        rawProjectId,
      );
      if (!project.ok) {
        res.status(project.status).json({ error: project.error });
        return;
      }
      const projectId = project.projectId;
      const r = await pool.query(
        `SELECT id::text, project_id, name, company, email, phone,
                pipeline_stage, lead_status, lead_temperature,
                lead_score, expected_value::float8 AS expected_value,
                conversion_probability::float8 AS conversion_probability,
                next_best_action, next_follow_up_at::text,
                latitude::float8 AS latitude, longitude::float8 AS longitude,
                city, country, lead_source, lead_category,
                created_at::text, updated_at::text
           FROM crm_customers
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND archived_at IS NULL
          ORDER BY updated_at DESC NULLS LAST, created_at DESC
          LIMIT $3 OFFSET $4`,
        [orgId, projectId, limit, offset],
      );
      const totalR = await pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM crm_customers
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND archived_at IS NULL`,
        [orgId, projectId],
      );
      res.json({
        data: r.rows,
        meta: {
          total: Number(totalR.rows[0]?.total ?? 0),
          limit,
          offset,
          project_id: projectId,
          version: "v1",
        },
      });
    } catch (err) {
      console.warn("[public-api-v1] /leads list feilet:", err);
      res.status(500).json({ error: "list_failed", detail: "internal_error" });
    }
  });
  // ───────────────────────────────────────────────────────────────────
  // GET /api/v1/leads/:id — én lead (org + project-scoped)
  // ───────────────────────────────────────────────────────────────────
  app.get("/api/v1/leads/:id", requireLeadsRead, async (req: Request, res: Response) => {
    const orgId = req.apiKey!.organizationId;
    const rawProjectId = req.query.project_id ?? req.query.projectId;
    try {
      const project = await resolvePublicApiProject(
        pool,
        req.apiKey!,
        rawProjectId,
      );
      if (!project.ok) {
        res.status(project.status).json({ error: project.error });
        return;
      }
      const r = await pool.query(
        `SELECT id::text, project_id, name, company, email, phone,
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
            AND organization_id = $2::uuid
            AND project_id = $3
            AND archived_at IS NULL`,
        [req.params.id, orgId, project.projectId],
      );
      if (r.rowCount === 0) {
        res.status(404).json({ error: "lead_not_found" });
        return;
      }
      res.json({
        data: r.rows[0],
        meta: { version: "v1", project_id: project.projectId },
      });
    } catch (err) {
      console.warn("[public-api-v1] /leads/:id feilet:", err);
      res.status(500).json({ error: "get_failed", detail: "internal_error" });
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // POST /api/v1/leads — opprett ny lead i API-keyens prosjekt
  // Body: { name (required), company, email, phone, address, city,
  //         country, postal_code, latitude, longitude,
  //         lead_source, lead_category }
  // Returnerer { data: { id }, meta: { version: "v1" } } 201.
  //
  // organization_id er tenant-grensen. Vi velger i tillegg en faktisk
  // organisasjonsbruker som operativ owner, slik at leadet kan tildeles og
  // vises korrekt i eksisterende arbeidsflyter.
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
      project_id?: string;
      projectId?: string;
    };
    if (!b.name || typeof b.name !== "string" || b.name.trim().length === 0) {
      res.status(400).json({
        error: "validation_failed",
        issues: [{ path: "name", message: "påkrevd" }],
      });
      return;
    }

    const rawProjectId = b.project_id ?? b.projectId;
    let projectId: string;
    try {
      const project = await resolvePublicApiProject(
        pool,
        req.apiKey!,
        rawProjectId,
      );
      if (!project.ok) {
        res.status(project.status).json({ error: project.error });
        return;
      }
      projectId = project.projectId;
    } catch (err) {
      console.warn("[public-api-v1] project lookup feilet:", err);
      res.status(500).json({ error: "project_lookup_failed", detail: "internal_error" });
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
           (organization_id, project_id, name, company, email, phone,
            address, city, country, postal_code,
            latitude, longitude, lead_source, lead_category,
            pipeline_stage, lead_status, owner_user_id)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                 $13, $14, 'new', 'unvisited', $15)
         RETURNING id::text`,
        [
          orgId,
          projectId,
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
        data: { id: r.rows[0].id, project_id: projectId },
        meta: { version: "v1" },
      });
    } catch (err) {
      console.warn("[public-api-v1] /leads POST feilet:", err);
      res.status(500).json({ error: "create_failed", detail: "internal_error" });
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // GET /api/v1/recommendations — list Next Best Action for project
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
    const rawProjectId = req.query.project_id ?? req.query.projectId;
    try {
      const project = await resolvePublicApiProject(
        pool,
        req.apiKey!,
        rawProjectId,
      );
      if (!project.ok) {
        res.status(project.status).json({ error: project.error });
        return;
      }
      const projectId = project.projectId;
      const params: (string | number)[] = [orgId, projectId, limit];
      let where = "";
      if (priority) {
        params.push(priority);
        where = "AND r.priority = $4";
      }
      const r = await pool.query(
        `SELECT r.id::text, r.lead_id::text, r.action_type, r.channel, r.priority,
                r.reason, r.status, r.confidence::float8 AS confidence,
                r.created_at::text, r.expires_at::text
           FROM lead_recommendations r
           JOIN crm_customers c
             ON c.organization_id = r.organization_id
            AND c.id = r.lead_id
            AND c.project_id = r.project_id
          WHERE r.organization_id = $1::uuid
            AND r.project_id = $2
            AND c.project_id = $2
            AND c.archived_at IS NULL
            AND r.status = 'pending'
            ${where}
          ORDER BY
            CASE r.priority
              WHEN 'urgent' THEN 1
              WHEN 'high' THEN 2
              WHEN 'normal' THEN 3
              WHEN 'low' THEN 4
              ELSE 5
            END,
            r.created_at DESC
          LIMIT $3`,
        params,
      );
      res.json({
        data: r.rows,
        meta: { version: "v1", total: r.rows.length, limit, project_id: projectId },
      });
    } catch (err) {
      console.warn("[public-api-v1] /recommendations feilet:", err);
      res.status(500).json({ error: "list_failed", detail: "internal_error" });
    }
  });
}
