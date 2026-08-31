import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { z, ZodError } from "zod";

import { discoveryApiError } from "./leadgrid-discovery-contract.js";
import {
  getLeadgridSession,
  loadAccessibleLeadgridProject,
  type LeadgridAccessibleProject,
  type LeadgridSession,
} from "./leadgrid-project-access.js";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import {
  assertAutoDiscoveryProfileCapacity,
  DiscoveryGovernanceError,
  lockAutoDiscoveryProfileGovernance,
} from "./leadgrid-discovery-governance.js";

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, LeadgridSession>;
}

const configBodySchema = z
  .object({
    industry_query: z.string().trim().min(1).max(120).nullable().optional(),
    industry_queries: z
      .array(z.string().trim().min(1).max(120))
      .max(8)
      .nullable()
      .optional(),
    city_filter: z
      .array(z.string().trim().min(1).max(120))
      .max(20)
      .nullable()
      .optional(),
    geography_lat: z.number().finite().min(-90).max(90).nullable().optional(),
    geography_lng: z.number().finite().min(-180).max(180).nullable().optional(),
    geography_radius_km: z.number().int().min(1).max(50).nullable().optional(),
    count_per_run: z.number().int().min(1).max(60).nullable().optional(),
    enrichment_count: z.number().int().min(1).max(60).nullable().optional(),
    auto_discover_enabled: z.boolean().nullable().optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    const hasLatitude =
      body.geography_lat !== undefined && body.geography_lat !== null;
    const hasLongitude =
      body.geography_lng !== undefined && body.geography_lng !== null;
    if (hasLatitude !== hasLongitude) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [hasLatitude ? "geography_lng" : "geography_lat"],
        message: "Breddegrad og lengdegrad må oppgis sammen.",
      });
    }
    const target = body.count_per_run ?? 10;
    const enrichment = body.enrichment_count ?? Math.min(10, target);
    if (enrichment > target) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["enrichment_count"],
        message: "Antall som berikes kan ikke være høyere enn måltallet.",
      });
    }
  });

interface LegacyConfigRow {
  project_id: string;
  industry_query: string | null;
  industry_queries: string[] | null;
  city_filter: string[] | null;
  geography_lat: string | number | null;
  geography_lng: string | number | null;
  geography_radius_km: number | null;
  count_per_run: number;
  auto_discover_enabled: boolean;
  last_run_at: Date | string | null;
  next_run_at: Date | string | null;
  total_discoveries: number;
  total_pinned: number;
}

interface DefaultProfileRow {
  id: string;
  target_customer_types: string[];
  city_filters: string[];
  geography_lat: string | number | null;
  geography_lng: string | number | null;
  geography_radius_km: number;
  max_candidates_per_run: number;
  enrichment_count: number;
  auto_discover_enabled: boolean;
  last_run_at: Date | string | null;
  next_run_at: Date | string | null;
  version: number;
}

function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  retryable = false,
  field?: string,
): void {
  res.status(status).json(discoveryApiError(code, message, retryable, field));
}

function handleError(res: Response, error: unknown): void {
  if (error instanceof DiscoveryGovernanceError) {
    sendError(res, error.status, error.code, error.message);
    return;
  }
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    sendError(
      res,
      400,
      "invalid_config",
      issue?.message ?? "Ugyldig Discovery-oppsett.",
      false,
      issue?.path.length ? issue.path.join(".") : undefined,
    );
    return;
  }
  console.error("[leadgrid-discovery-config] route failed", error);
  sendError(
    res,
    500,
    "discovery_config_failed",
    "Discovery-oppsettet kunne ikke behandles.",
    true,
  );
}

function wrapped(
  handler: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      handleError(res, error);
    }
  };
}

async function loadContext(
  req: Request,
  res: Response,
  pool: Pool,
  activeSessions: Map<string, LeadgridSession>,
): Promise<{
  project: LeadgridAccessibleProject;
  session: LeadgridSession;
} | null> {
  const session = getLeadgridSession(req, activeSessions);
  if (!session?.userId) {
    sendError(res, 401, "authentication_required", "Innlogging kreves.");
    return null;
  }
  const project = await loadAccessibleLeadgridProject(
    pool,
    req.params.projectId,
    session.userId,
  );
  if (!project) {
    sendError(
      res,
      404,
      "project_not_found",
      "Leadgrid-prosjektet finnes ikke.",
    );
    return null;
  }
  return { project, session };
}

function iso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function numberOrNull(value: string | number | null | undefined) {
  return value === null || value === undefined ? null : Number(value);
}

async function transaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function registerLeadgridDiscoveryConfigRoutes({
  app,
  pool,
  activeSessions,
}: Deps): void {
  const permission = requireLeadMapPermission("lead_research.run", {
    pool,
    activeSessions,
    resolveOrgId: async (req, db, userId) =>
      (await loadAccessibleLeadgridProject(db, req.params.projectId, userId))
        ?.organizationId ?? null,
  });
  const path = "/api/leadgrid/projects/:projectId/discovery-config";

  app.get(
    path,
    permission,
    wrapped(async (req, res) => {
      const context = await loadContext(req, res, pool, activeSessions);
      if (!context) return;
      const { project } = context;
      const [legacyResult, profileResult] = await Promise.all([
        pool.query<LegacyConfigRow>(
          `SELECT project_id, industry_query, industry_queries, city_filter,
                  geography_lat::text, geography_lng::text,
                  geography_radius_km, count_per_run,
                  auto_discover_enabled, last_run_at, next_run_at,
                  total_discoveries, total_pinned
             FROM leadgrid_project_discovery_config
            WHERE project_id = $1
              AND (organization_id = $2::uuid OR organization_id IS NULL)
            ORDER BY (organization_id = $2::uuid) DESC
            LIMIT 1`,
          [project.id, project.organizationId],
        ),
        pool.query<DefaultProfileRow>(
          `SELECT id::text, target_customer_types, city_filters,
                  geography_lat::text, geography_lng::text,
                  geography_radius_km, max_candidates_per_run,
                  enrichment_count, auto_discover_enabled,
                  last_run_at, next_run_at, version
             FROM leadgrid_discovery_profiles
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND is_default = TRUE
              AND status <> 'archived'
            LIMIT 1`,
          [project.organizationId, project.id],
        ),
      ]);

      const legacy = legacyResult.rows[0];
      const profile = profileResult.rows[0];
      if (!legacy && !profile) {
        res.json({ config: null, project_id: project.id });
        return;
      }
      const industryQueries = profile?.target_customer_types?.length
        ? profile.target_customer_types
        : legacy?.industry_queries?.length
          ? legacy.industry_queries
          : legacy?.industry_query
            ? [legacy.industry_query]
            : [];
      res.json({
        config: {
          project_id: project.id,
          industry_query: industryQueries[0] ?? legacy?.industry_query ?? null,
          industry_queries: industryQueries,
          city_filter: profile?.city_filters ?? legacy?.city_filter ?? [],
          geography_lat: numberOrNull(
            profile?.geography_lat ?? legacy?.geography_lat,
          ),
          geography_lng: numberOrNull(
            profile?.geography_lng ?? legacy?.geography_lng,
          ),
          geography_radius_km:
            profile?.geography_radius_km ?? legacy?.geography_radius_km ?? 10,
          count_per_run:
            profile?.max_candidates_per_run ?? legacy?.count_per_run ?? 10,
          enrichment_count:
            profile?.enrichment_count ??
            Math.min(10, legacy?.count_per_run ?? 10),
          auto_discover_enabled:
            profile?.auto_discover_enabled ??
            legacy?.auto_discover_enabled ??
            false,
          last_run_at: iso(profile?.last_run_at ?? legacy?.last_run_at),
          next_run_at: iso(profile?.next_run_at ?? legacy?.next_run_at),
          total_discoveries: legacy?.total_discoveries ?? 0,
          total_pinned: legacy?.total_pinned ?? 0,
          profile_id: profile?.id ?? null,
          profile_version: profile?.version ?? null,
        },
      });
    }),
  );

  app.put(
    path,
    permission,
    wrapped(async (req, res) => {
      const context = await loadContext(req, res, pool, activeSessions);
      if (!context) return;
      const body = configBodySchema.parse(req.body ?? {});
      const industryQueries = body.industry_queries?.length
        ? body.industry_queries
        : body.industry_query
          ? [body.industry_query]
          : [];
      const industryQuery = body.industry_query ?? industryQueries[0] ?? null;
      const cities = body.city_filter ?? [];
      const radius = body.geography_radius_km ?? 10;
      const targetCount = body.count_per_run ?? 10;
      const enrichmentCount =
        body.enrichment_count ?? Math.min(10, targetCount);
      const enabled = body.auto_discover_enabled === true;
      const actor = UUID_RE.test(context.session.userId)
        ? context.session.userId
        : null;
      const briefPatch = {
        industry_queries: industryQueries,
        exclusion_terms: [],
        city: cities[0] ?? null,
        geo:
          body.geography_lat !== null &&
          body.geography_lat !== undefined &&
          body.geography_lng !== null &&
          body.geography_lng !== undefined
            ? {
                latitude: body.geography_lat,
                longitude: body.geography_lng,
                radius_km: radius,
              }
            : null,
        target_count: targetCount,
        enrichment_count: enrichmentCount,
        minimum_fit_score: 50,
      };

      const profile = await transaction(pool, async (client) => {
        if (enabled) {
          await lockAutoDiscoveryProfileGovernance(
            client,
            context.project.organizationId,
          );
        }
        await client.query(
          `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
          [
            `${context.project.organizationId}|${context.project.id}|discovery-config`,
          ],
        );
        await client.query(
          `INSERT INTO leadgrid_project_discovery_config (
             project_id, industry_query, industry_queries, city_filter,
             geography_lat, geography_lng, geography_radius_km,
             count_per_run, auto_discover_enabled, organization_id,
             created_by_user_id, next_run_at, created_at, updated_at
           ) VALUES (
             $1, $2, $3::text[], $4::text[], $5::numeric, $6::numeric,
             $7, $8, $9, $10::uuid, $11::uuid,
             CASE WHEN $9 THEN NOW() ELSE NULL END, NOW(), NOW()
           )
           ON CONFLICT (project_id) DO UPDATE SET
             industry_query = EXCLUDED.industry_query,
             industry_queries = EXCLUDED.industry_queries,
             city_filter = EXCLUDED.city_filter,
             geography_lat = EXCLUDED.geography_lat,
             geography_lng = EXCLUDED.geography_lng,
             geography_radius_km = EXCLUDED.geography_radius_km,
             count_per_run = EXCLUDED.count_per_run,
             auto_discover_enabled = EXCLUDED.auto_discover_enabled,
             organization_id = EXCLUDED.organization_id,
             created_by_user_id = COALESCE(
               leadgrid_project_discovery_config.created_by_user_id,
               EXCLUDED.created_by_user_id
             ),
             next_run_at = CASE
               WHEN EXCLUDED.auto_discover_enabled
                    AND NOT leadgrid_project_discovery_config.auto_discover_enabled
                 THEN NOW()
               WHEN NOT EXCLUDED.auto_discover_enabled THEN NULL
               ELSE leadgrid_project_discovery_config.next_run_at
             END,
             updated_at = NOW()`,
          [
            context.project.id,
            industryQuery,
            industryQueries,
            cities,
            body.geography_lat ?? null,
            body.geography_lng ?? null,
            radius,
            Math.min(50, targetCount),
            enabled,
            context.project.organizationId,
            actor,
          ],
        );

        const existing = await client.query<{ id: string }>(
          `SELECT id::text
             FROM leadgrid_discovery_profiles
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND status <> 'archived'
              AND (is_default = TRUE OR LOWER(name) = 'standard')
            ORDER BY is_default DESC, created_at ASC, id ASC
            LIMIT 1
            FOR UPDATE`,
          [context.project.organizationId, context.project.id],
        );
        const profileId = existing.rows[0]?.id;
        if (enabled) {
          await assertAutoDiscoveryProfileCapacity(client, {
            organizationId: context.project.organizationId,
            excludeProfileId: profileId ?? null,
          });
        }
        if (profileId) {
          await client.query(
            `UPDATE leadgrid_discovery_profiles
                SET is_default = FALSE, version = version + 1,
                    updated_by = $4
              WHERE organization_id = $1::uuid
                AND project_id = $2
                AND id <> $3::uuid
                AND is_default = TRUE
                AND status <> 'archived'`,
            [
              context.project.organizationId,
              context.project.id,
              profileId,
              context.session.userId,
            ],
          );
          const updated = await client.query<{ id: string; version: number }>(
            `UPDATE leadgrid_discovery_profiles
                SET name = CASE WHEN name = '' THEN 'Standard' ELSE name END,
                    is_default = TRUE,
                    status = 'active',
                    target_customer_types = $4::text[],
                    city_filters = $5::text[],
                    geography_lat = $6::numeric,
                    geography_lng = $7::numeric,
                    geography_radius_km = $8,
                    brief = brief || $9::jsonb,
                    max_candidates_per_run = $10,
                    enrichment_count = $11,
                    auto_discover_enabled = $12,
                    next_run_at = CASE
                      WHEN $12 AND NOT auto_discover_enabled THEN NOW()
                      WHEN NOT $12 THEN NULL
                      ELSE next_run_at
                    END,
                    version = version + 1,
                    updated_by = $13
              WHERE organization_id = $1::uuid
                AND project_id = $2
                AND id = $3::uuid
              RETURNING id::text, version`,
            [
              context.project.organizationId,
              context.project.id,
              profileId,
              industryQueries,
              cities,
              body.geography_lat ?? null,
              body.geography_lng ?? null,
              radius,
              JSON.stringify(briefPatch),
              targetCount,
              enrichmentCount,
              enabled,
              context.session.userId,
            ],
          );
          return updated.rows[0];
        }

        const inserted = await client.query<{ id: string; version: number }>(
          `INSERT INTO leadgrid_discovery_profiles (
             organization_id, project_id, name, is_default, status,
             target_customer_types, city_filters, geography_lat,
             geography_lng, geography_radius_km, brief,
             max_candidates_per_run, enrichment_count,
             auto_discover_enabled, created_by, updated_by
           ) VALUES (
             $1::uuid, $2, 'Standard', TRUE, 'active', $3::text[],
             $4::text[], $5::numeric, $6::numeric, $7, $8::jsonb,
             $9, $10, $11, $12, $12
           ) RETURNING id::text, version`,
          [
            context.project.organizationId,
            context.project.id,
            industryQueries,
            cities,
            body.geography_lat ?? null,
            body.geography_lng ?? null,
            radius,
            JSON.stringify(briefPatch),
            targetCount,
            enrichmentCount,
            enabled,
            context.session.userId,
          ],
        );
        return inserted.rows[0];
      });
      res.json({
        ok: true,
        profile_id: profile.id,
        profile_version: profile.version,
      });
    }),
  );

  app.delete(
    path,
    permission,
    wrapped(async (req, res) => {
      const context = await loadContext(req, res, pool, activeSessions);
      if (!context) return;
      await transaction(pool, async (client) => {
        await client.query(
          `DELETE FROM leadgrid_project_discovery_config
            WHERE project_id = $1
              AND (organization_id = $2::uuid OR organization_id IS NULL)`,
          [context.project.id, context.project.organizationId],
        );
        await client.query(
          `UPDATE leadgrid_discovery_profiles
              SET status = 'archived', is_default = FALSE,
                  auto_discover_enabled = FALSE, next_run_at = NULL,
                  version = version + 1, updated_by = $3
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND is_default = TRUE
              AND status <> 'archived'`,
          [
            context.project.organizationId,
            context.project.id,
            context.session.userId,
          ],
        );
      });
      res.json({ ok: true });
    }),
  );
}
