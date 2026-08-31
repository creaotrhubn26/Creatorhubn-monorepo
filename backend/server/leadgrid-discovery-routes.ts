import type {
  Express,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import type { Pool, PoolClient } from "pg";
import { z, ZodError } from "zod";

import {
  discoveryApiError,
  discoveryBriefSchema,
  discoveryCandidateQuerySchema,
  discoveryDecisionSchema,
  discoveryFeedbackSchema,
  discoveryPreviewSchema,
  discoveryRunCreateSchema,
  parseIdempotencyKey,
} from "./leadgrid-discovery-contract.js";
import {
  appendDiscoveryFeedback,
  cancelDiscoveryRun,
  confirmDiscoveryRun,
  createDiscoveryRun,
  decideDiscoveryCandidate,
  DiscoveryServiceError,
  getDiscoveryRun,
  listDiscoveryCandidates,
  listDiscoveryRuns,
  previewDiscovery,
} from "./leadgrid-discovery-service.js";
import {
  isValidDiscoverySchedule,
  nextDiscoveryScheduledAt,
} from "./leadgrid-continuous-discovery.js";
import {
  getLeadgridSession,
  loadAccessibleLeadgridProject,
  type LeadgridAccessibleProject,
  type LeadgridSession,
} from "./leadgrid-project-access.js";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";
import {
  assertAutoDiscoveryProfileCapacity,
  DiscoveryGovernanceError,
  lockAutoDiscoveryProfileGovernance,
} from "./leadgrid-discovery-governance.js";
import {
  DiscoveryPlacesDetailsError,
  fetchTransientDiscoveryPlaceDetails,
} from "./leadgrid-discovery-places-details.js";
import {
  checkEndpointRateLimit,
  RateLimitExceededError,
} from "./role-room-agent-ratelimit.js";

interface DiscoveryRouteDeps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, LeadgridSession>;
}

interface RouteContext {
  project: LeadgridAccessibleProject;
  userId: string;
}

const discoveryContextByRequest = new WeakMap<Request, RouteContext>();

const uuidSchema = z.string().uuid();
const runListQuerySchema = z.object({
  status: z.string().trim().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
const runListStatusSchema = z.enum([
  "active",
  "planning",
  "awaiting_confirmation",
  "queued",
  "searching",
  "researching",
  "review_ready",
  "completed",
  "partial",
  "cancel_requested",
  "cancelled",
  "failed",
]);

const profileMutableShape = {
  name: z.string().trim().min(1).max(120),
  is_default: z.boolean(),
  status: z.enum(["active", "paused"]),
  brief: discoveryBriefSchema,
  approval_mode: z.literal("manual"),
  places_details_enabled: z.boolean(),
  auto_discover_enabled: z.boolean(),
  schedule_cron: z.string().trim().min(1).max(120),
  schedule_timezone: z.string().trim().min(1).max(80),
};

const profileCreateSchema = z
  .object({
    ...profileMutableShape,
    name: profileMutableShape.name.default("Standard"),
    is_default: profileMutableShape.is_default.default(false),
    status: profileMutableShape.status.default("active"),
    approval_mode: profileMutableShape.approval_mode.default("manual"),
    places_details_enabled:
      profileMutableShape.places_details_enabled.default(false),
    auto_discover_enabled:
      profileMutableShape.auto_discover_enabled.default(false),
    schedule_cron: profileMutableShape.schedule_cron.default("0 6 * * *"),
    schedule_timezone:
      profileMutableShape.schedule_timezone.default("Europe/Oslo"),
  })
  .strict();

const profilePatchSchema = z
  .object({
    expected_version: z.number().int().positive(),
    name: profileMutableShape.name.optional(),
    is_default: profileMutableShape.is_default.optional(),
    status: profileMutableShape.status.optional(),
    brief: profileMutableShape.brief.optional(),
    approval_mode: profileMutableShape.approval_mode.optional(),
    auto_discover_enabled: profileMutableShape.auto_discover_enabled.optional(),
    places_details_enabled:
      profileMutableShape.places_details_enabled.optional(),
    schedule_cron: profileMutableShape.schedule_cron.optional(),
    schedule_timezone: profileMutableShape.schedule_timezone.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).every((key) => key === "expected_version")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minst ett profilfelt må endres.",
      });
    }
  });

interface ProfileRow {
  id: string;
  organization_id: string;
  project_id: string;
  name: string;
  is_default: boolean;
  status: "active" | "paused" | "archived";
  target_customer_types: string[];
  city_filters: string[];
  geography_lat: string | number | null;
  geography_lng: string | number | null;
  geography_radius_km: number;
  brief: Record<string, unknown>;
  source_config: Record<string, unknown>;
  approval_mode: string;
  max_candidates_per_run: number;
  enrichment_count: number;
  auto_discover_enabled: boolean;
  schedule_cron: string;
  schedule_timezone: string;
  last_run_at: Date | string | null;
  next_run_at: Date | string | null;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ProfileScheduleRow {
  version: number;
  status: "active" | "paused";
  auto_discover_enabled: boolean;
  schedule_cron: string;
  schedule_timezone: string;
  next_run_at: Date | string | null;
}

const PROFILE_COLUMNS = `
  id::text, organization_id::text, project_id, name, is_default, status,
  target_customer_types, city_filters, geography_lat::text,
  geography_lng::text, geography_radius_km, brief, source_config, approval_mode,
  max_candidates_per_run, enrichment_count,
  auto_discover_enabled, schedule_cron, schedule_timezone,
  last_run_at, next_run_at, version, created_at, updated_at`;

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}
function profilePlacesDetailsEnabled(value: unknown): boolean {
  const config =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const places =
    config.google_places && typeof config.google_places === "object"
      ? (config.google_places as Record<string, unknown>)
      : {};
  return places.enabled === true && places.mode === "transient_details_only";
}

function profileDto(row: ProfileRow) {
  const latitude =
    row.geography_lat === null ? null : Number(row.geography_lat);
  const longitude =
    row.geography_lng === null ? null : Number(row.geography_lng);
  const storedBrief = row.brief ?? {};
  const geo =
    latitude !== null && longitude !== null
      ? {
          latitude,
          longitude,
          radius_km: row.geography_radius_km,
        }
      : null;
  const city = row.city_filters[0] ?? (geo ? null : "Norge");
  const minimumFitScore =
    typeof storedBrief.minimum_fit_score === "number"
      ? storedBrief.minimum_fit_score
      : Number.NaN;
  const idealCustomer =
    typeof storedBrief.ideal_customer === "string" &&
    storedBrief.ideal_customer.trim()
      ? storedBrief.ideal_customer.trim()
      : null;
  const goal =
    typeof storedBrief.goal === "string" && storedBrief.goal.trim()
      ? storedBrief.goal.trim()
      : null;
  return {
    id: row.id,
    organization_id: row.organization_id,
    project_id: row.project_id,
    name: row.name,
    is_default: row.is_default,
    status: row.status,
    brief: {
      industry_queries: row.target_customer_types,
      exclusion_terms: Array.isArray(storedBrief.exclusion_terms)
        ? storedBrief.exclusion_terms.filter(
            (term): term is string => typeof term === "string",
          )
        : [],
      city,
      geo,
      target_count: row.max_candidates_per_run,
      enrichment_count: row.enrichment_count,
      minimum_fit_score:
        Number.isInteger(minimumFitScore) &&
        minimumFitScore >= 0 &&
        minimumFitScore <= 100
          ? minimumFitScore
          : 50,
      ideal_customer: idealCustomer,
      goal,
    },
    // Rules-based approval is deliberately not part of the public contract.
    // Existing rows are rendered fail-closed until a real rules engine ships.
    approval_mode: "manual" as const,
    places_details_enabled: profilePlacesDetailsEnabled(row.source_config),
    auto_discover_enabled: row.auto_discover_enabled,
    schedule_cron: row.schedule_cron,
    schedule_timezone: row.schedule_timezone,
    last_run_at: iso(row.last_run_at),
    next_run_at: iso(row.next_run_at),
    version: row.version,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
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

function firstZodField(error: ZodError): string | undefined {
  const path = error.issues[0]?.path;
  return path && path.length > 0 ? path.join(".") : undefined;
}

function handleRouteError(res: Response, error: unknown): void {
  if (error instanceof RouteFailure) {
    sendError(
      res,
      error.status,
      error.code,
      error.message,
      error.retryable,
      error.field,
    );
    return;
  }
  if (error instanceof DiscoveryServiceError) {
    sendError(
      res,
      error.status,
      error.code,
      error.message,
      error.retryable,
      error.field,
    );
    return;
  }
  if (error instanceof DiscoveryGovernanceError) {
    sendError(res, error.status, error.code, error.message);
    return;
  }
  if (error instanceof DiscoveryPlacesDetailsError) {
    sendError(res, error.status, error.code, error.message, error.retryable);
    return;
  }
  if (error instanceof ZodError) {
    sendError(
      res,
      400,
      "invalid_request",
      error.issues[0]?.message ?? "Ugyldig forespørsel.",
      false,
      firstZodField(error),
    );
    return;
  }
  const pgCode = (error as { code?: unknown } | null)?.code;
  if (pgCode === "23505") {
    sendError(res, 409, "profile_conflict", "Profilnavnet er allerede i bruk.");
    return;
  }
  console.error("[leadgrid-discovery] route failed", error);
  sendError(
    res,
    500,
    "internal_error",
    "Discovery kunne ikke fullføre forespørselen.",
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
      handleRouteError(res, error);
    }
  };
}

/**
 * Discovery uses the exact same session resolver as its route context. This is
 * intentionally local instead of the bearer-only legacy RBAC helper: the web
 * admin's hydrated cookie session and native bearer sessions must pass through
 * the same tenant and permission checks.
 */
function createDiscoveryPermissionMiddleware(
  permissionKey: string,
  pool: Pool,
  activeSessions: Map<string, LeadgridSession>,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = getLeadgridSession(req, activeSessions);
      if (!session?.userId) {
        sendError(res, 401, "authentication_required", "Innlogging kreves.");
        return;
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
        return;
      }
      const { role, permissions } = await resolveEffectivePermissions(
        pool,
        project.organizationId,
        session.userId,
      );
      if (!role) {
        res.status(403).json({
          error: "ikke_medlem_av_org",
          organization_id: project.organizationId,
        });
        return;
      }
      if (!permissions.has(permissionKey)) {
        res.status(403).json({
          error: "mangler_tillatelse",
          required: permissionKey,
          organization_id: project.organizationId,
        });
        return;
      }
      discoveryContextByRequest.set(req, {
        project,
        userId: session.userId,
      });
      next();
    } catch (error) {
      handleRouteError(res, error);
    }
  };
}

async function contextFor(
  req: Request,
  res: Response,
  pool: Pool,
  activeSessions: Map<string, LeadgridSession>,
): Promise<RouteContext | null> {
  const cached = discoveryContextByRequest.get(req);
  if (cached) return cached;
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
  return { project, userId: session.userId };
}

function requiredIdempotencyKey(req: Request, res: Response): string | null {
  const key = parseIdempotencyKey(req.get("Idempotency-Key"));
  if (!key) {
    sendError(
      res,
      400,
      "idempotency_key_required",
      "En gyldig Idempotency-Key-header er påkrevd.",
      false,
      "Idempotency-Key",
    );
  }
  return key;
}

function parseUuid(value: string, field: string): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `${field} må være en gyldig UUID.`,
      },
    ]);
  }
  return parsed.data;
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

function profileValues(brief: z.infer<typeof discoveryBriefSchema>) {
  return {
    targetCustomerTypes: brief.industry_queries,
    cityFilters: brief.city ? [brief.city] : [],
    latitude: brief.geo?.latitude ?? null,
    longitude: brief.geo?.longitude ?? null,
    radiusKm: brief.geo?.radius_km ?? 25,
    targetCount: brief.target_count,
    enrichmentCount: brief.enrichment_count,
    exclusionRules: { terms: brief.exclusion_terms },
  };
}

function validatedNextRunAt(
  scheduleCron: string,
  scheduleTimezone: string,
  after = new Date(),
): Date {
  if (!isValidDiscoverySchedule(scheduleCron, scheduleTimezone)) {
    const field = isValidDiscoverySchedule(scheduleCron, "UTC")
      ? "schedule_timezone"
      : "schedule_cron";
    throw new RouteFailure(
      400,
      "invalid_discovery_schedule",
      "Tidsplanen må ha gyldig cron-format, IANA-tidssone og kan kjøre maksimalt én gang daglig.",
      false,
      field,
    );
  }
  return nextDiscoveryScheduledAt(scheduleCron, scheduleTimezone, after);
}

export function registerLeadgridDiscoveryRoutes({
  app,
  pool,
  activeSessions,
}: DiscoveryRouteDeps): void {
  const permission = createDiscoveryPermissionMiddleware(
    "lead_research.run",
    pool,
    activeSessions,
  );
  const base = "/api/leadgrid/projects/:projectId/discovery";

  app.post(
    `${base}/preview`,
    permission,
    wrapped(async (req, res) => {
      const context = await contextFor(req, res, pool, activeSessions);
      if (!context) return;
      const body = discoveryPreviewSchema.parse(req.body ?? {});
      res.json(previewDiscovery(body.brief));
    }),
  );

  app.post(
    `${base}/runs`,
    permission,
    wrapped(async (req, res) => {
      const context = await contextFor(req, res, pool, activeSessions);
      if (!context) return;
      const idempotencyKey = requiredIdempotencyKey(req, res);
      if (!idempotencyKey) return;
      const body = discoveryRunCreateSchema.parse(req.body ?? {});
      const result = await createDiscoveryRun(pool, {
        project: context.project,
        userId: context.userId,
        brief: body.brief,
        profileId: body.profile_id,
        expectedProfileVersion: body.expected_profile_version,
        idempotencyKey,
        startImmediately: body.start_immediately,
        planHash: body.plan_hash,
        triggerKind: "manual",
      });
      res.status(202).json(result);
    }),
  );

  app.get(
    `${base}/runs`,
    permission,
    wrapped(async (req, res) => {
      const context = await contextFor(req, res, pool, activeSessions);
      if (!context) return;
      const query = runListQuerySchema.parse(req.query);
      const statuses = query.status
        ? query.status
            .split(",")
            .map((value) => runListStatusSchema.parse(value.trim()))
        : undefined;
      res.json(
        await listDiscoveryRuns(pool, {
          project: context.project,
          statuses,
          limit: query.limit,
        }),
      );
    }),
  );

  app.get(
    `${base}/runs/:runId`,
    permission,
    wrapped(async (req, res) => {
      const context = await contextFor(req, res, pool, activeSessions);
      if (!context) return;
      res.json(
        await getDiscoveryRun(pool, {
          project: context.project,
          runId: parseUuid(req.params.runId, "runId"),
        }),
      );
    }),
  );

  app.post(
    `${base}/runs/:runId/confirm`,
    permission,
    wrapped(async (req, res) => {
      const context = await contextFor(req, res, pool, activeSessions);
      if (!context) return;
      res.status(202).json(
        await confirmDiscoveryRun(pool, {
          project: context.project,
          userId: context.userId,
          runId: parseUuid(req.params.runId, "runId"),
        }),
      );
    }),
  );

  app.post(
    `${base}/runs/:runId/cancel`,
    permission,
    wrapped(async (req, res) => {
      const context = await contextFor(req, res, pool, activeSessions);
      if (!context) return;
      res.status(202).json(
        await cancelDiscoveryRun(pool, {
          project: context.project,
          userId: context.userId,
          runId: parseUuid(req.params.runId, "runId"),
        }),
      );
    }),
  );

  app.get(
    `${base}/runs/:runId/candidates`,
    permission,
    wrapped(async (req, res) => {
      const context = await contextFor(req, res, pool, activeSessions);
      if (!context) return;
      const query = discoveryCandidateQuerySchema.parse(req.query);
      res.json(
        await listDiscoveryCandidates(pool, {
          project: context.project,
          runId: parseUuid(req.params.runId, "runId"),
          ...query,
        }),
      );
    }),
  );

  app.post(
    `${base}/runs/:runId/candidates/:candidateId/place-details`,
    permission,
    wrapped(async (req, res) => {
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      const context = await contextFor(req, res, pool, activeSessions);
      if (!context) return;
      try {
        checkEndpointRateLimit(
          context.userId,
          "leadgrid_discovery_places_details",
          10,
        );
      } catch (error) {
        if (error instanceof RateLimitExceededError) {
          res.setHeader("Retry-After", String(error.retryAfterSeconds));
          sendError(
            res,
            429,
            "places_details_rate_limited",
            "Du har gjort mange detaljoppslag. Vent litt og prøv igjen.",
            true,
          );
          return;
        }
        throw error;
      }
      res.json(
        await fetchTransientDiscoveryPlaceDetails(pool, {
          project: context.project,
          runId: parseUuid(req.params.runId, "runId"),
          candidateId: parseUuid(req.params.candidateId, "candidateId"),
        }),
      );
    }),
  );

  app.post(
    `${base}/runs/:runId/candidates/:candidateId/decision`,
    permission,
    wrapped(async (req, res) => {
      const context = await contextFor(req, res, pool, activeSessions);
      if (!context) return;
      const decision = discoveryDecisionSchema.parse(req.body ?? {});
      if (decision.decision === "approve") {
        const { permissions } = await resolveEffectivePermissions(
          pool,
          context.project.organizationId,
          context.userId,
        );
        if (!permissions.has("leads.create")) {
          res.status(403).json({
            error: "mangler_tillatelse",
            required: "leads.create",
            organization_id: context.project.organizationId,
          });
          return;
        }
      }
      const idempotencyKey = requiredIdempotencyKey(req, res);
      if (!idempotencyKey) return;
      res.json(
        await decideDiscoveryCandidate(pool, {
          project: context.project,
          userId: context.userId,
          runId: parseUuid(req.params.runId, "runId"),
          candidateId: parseUuid(req.params.candidateId, "candidateId"),
          idempotencyKey,
          decision,
        }),
      );
    }),
  );

  app.post(
    `${base}/runs/:runId/candidates/:candidateId/feedback`,
    permission,
    wrapped(async (req, res) => {
      const context = await contextFor(req, res, pool, activeSessions);
      if (!context) return;
      const idempotencyKey = requiredIdempotencyKey(req, res);
      if (!idempotencyKey) return;
      res.status(201).json(
        await appendDiscoveryFeedback(pool, {
          project: context.project,
          userId: context.userId,
          runId: parseUuid(req.params.runId, "runId"),
          candidateId: parseUuid(req.params.candidateId, "candidateId"),
          idempotencyKey,
          feedback: discoveryFeedbackSchema.parse(req.body ?? {}),
        }),
      );
    }),
  );

  app.get(
    `${base}/profiles`,
    permission,
    wrapped(async (req, res) => {
      const context = await contextFor(req, res, pool, activeSessions);
      if (!context) return;
      const result = await pool.query<ProfileRow>(
        `SELECT ${PROFILE_COLUMNS}
           FROM leadgrid_discovery_profiles
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND status <> 'archived'
          ORDER BY is_default DESC, updated_at DESC, id DESC`,
        [context.project.organizationId, context.project.id],
      );
      res.json({ profiles: result.rows.map(profileDto) });
    }),
  );

  app.post(
    `${base}/profiles`,
    permission,
    wrapped(async (req, res) => {
      const context = await contextFor(req, res, pool, activeSessions);
      if (!context) return;
      const body = profileCreateSchema.parse(req.body ?? {});
      const values = profileValues(body.brief);
      const validatedNext = validatedNextRunAt(
        body.schedule_cron,
        body.schedule_timezone,
      );
      const nextRunAt =
        body.auto_discover_enabled && body.status === "active"
          ? validatedNext
          : null;
      const row = await transaction(pool, async (client) => {
        if (body.auto_discover_enabled && body.status === "active") {
          await assertAutoDiscoveryProfileCapacity(client, {
            organizationId: context.project.organizationId,
          });
        }
        if (body.is_default) {
          await client.query(
            `UPDATE leadgrid_discovery_profiles
                SET is_default = FALSE, version = version + 1,
                    updated_by = $3
              WHERE organization_id = $1::uuid
                AND project_id = $2
                AND is_default = TRUE
                AND status <> 'archived'`,
            [
              context.project.organizationId,
              context.project.id,
              context.userId,
            ],
          );
        }
        const result = await client.query<ProfileRow>(
          `INSERT INTO leadgrid_discovery_profiles (
             organization_id, project_id, name, is_default, status,
             target_customer_types, city_filters, geography_lat,
             geography_lng, geography_radius_km, brief, exclusion_rules,
             source_config, approval_mode, approval_rules, max_candidates_per_run,
             enrichment_count, auto_discover_enabled, schedule_cron,
             schedule_timezone, next_run_at, created_by, updated_by
           ) VALUES (
             $1::uuid, $2, $3, $4, $5, $6::text[], $7::text[],
             $8::numeric, $9::numeric, $10, $11::jsonb, $12::jsonb,
             $13::jsonb, $14, $15::jsonb, $16, $17, $18, $19, $20,
             $21::timestamptz, $22, $22
           ) RETURNING ${PROFILE_COLUMNS}`,
          [
            context.project.organizationId,
            context.project.id,
            body.name,
            body.is_default,
            body.status,
            values.targetCustomerTypes,
            values.cityFilters,
            values.latitude,
            values.longitude,
            values.radiusKm,
            JSON.stringify(body.brief),
            JSON.stringify(values.exclusionRules),
            JSON.stringify({
              brreg_open_data: { enabled: true },
              google_places: {
                enabled: body.places_details_enabled,
                mode: "transient_details_only",
              },
            }),
            body.approval_mode,
            JSON.stringify({}),
            values.targetCount,
            values.enrichmentCount,
            body.auto_discover_enabled,
            body.schedule_cron,
            body.schedule_timezone,
            nextRunAt?.toISOString() ?? null,
            context.userId,
          ],
        );
        return result.rows[0];
      });
      res.status(201).json({ profile: profileDto(row) });
    }),
  );

  app.patch(
    `${base}/profiles/:profileId`,
    permission,
    wrapped(async (req, res) => {
      const context = await contextFor(req, res, pool, activeSessions);
      if (!context) return;
      const profileId = parseUuid(req.params.profileId, "profileId");
      const body = profilePatchSchema.parse(req.body ?? {});
      const row = await transaction(pool, async (client) => {
        await lockAutoDiscoveryProfileGovernance(
          client,
          context.project.organizationId,
        );
        const currentResult = await client.query<ProfileScheduleRow>(
          `SELECT version, status, auto_discover_enabled, schedule_cron,
                  schedule_timezone, next_run_at
             FROM leadgrid_discovery_profiles
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND id = $3::uuid
              AND status <> 'archived'
            FOR UPDATE`,
          [context.project.organizationId, context.project.id, profileId],
        );
        const current = currentResult.rows[0];
        if (!current) {
          throw new RouteFailure(
            404,
            "profile_not_found",
            "Discovery-profilen finnes ikke.",
          );
        }
        if (current.version !== body.expected_version) {
          throw new RouteFailure(
            409,
            "profile_version_conflict",
            "Profilen er endret på en annen enhet. Last den inn på nytt.",
          );
        }

        const effectiveCron = body.schedule_cron ?? current.schedule_cron;
        const effectiveTimezone =
          body.schedule_timezone ?? current.schedule_timezone;
        const validatedNext = validatedNextRunAt(
          effectiveCron,
          effectiveTimezone,
        );
        const effectiveAuto =
          body.auto_discover_enabled ?? current.auto_discover_enabled;
        const effectiveStatus = body.status ?? current.status;
        const scheduleChanged =
          body.schedule_cron !== undefined ||
          body.schedule_timezone !== undefined;
        const becameRunnable =
          effectiveAuto &&
          effectiveStatus === "active" &&
          ((!current.auto_discover_enabled &&
            body.auto_discover_enabled === true) ||
            (current.status !== "active" && body.status === "active"));

        if (effectiveAuto && effectiveStatus === "active") {
          await assertAutoDiscoveryProfileCapacity(client, {
            organizationId: context.project.organizationId,
            excludeProfileId: profileId,
          });
        }

        if (body.is_default === true) {
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
              context.userId,
            ],
          );
        }

        const params: unknown[] = [
          context.project.organizationId,
          context.project.id,
          profileId,
          body.expected_version,
          context.userId,
        ];
        const sets = ["version = version + 1", "updated_by = $5"];
        const set = (column: string, value: unknown, cast = "") => {
          params.push(value);
          sets.push(`${column} = $${params.length}${cast}`);
        };
        if (body.name !== undefined) set("name", body.name);
        if (body.is_default !== undefined) set("is_default", body.is_default);
        if (body.status !== undefined) set("status", body.status);
        if (body.approval_mode !== undefined) {
          set("approval_mode", body.approval_mode);
        }
        if (body.places_details_enabled !== undefined) {
          params.push(body.places_details_enabled);
          const placesEnabledParam = params.length;
          sets.push(
            `source_config = jsonb_set(source_config, '{google_places}', jsonb_build_object('enabled', $${placesEnabledParam}::boolean, 'mode', 'transient_details_only'), true)`,
          );
        }

        if (body.auto_discover_enabled !== undefined) {
          set("auto_discover_enabled", body.auto_discover_enabled);
        }
        if (body.schedule_cron !== undefined) {
          set("schedule_cron", body.schedule_cron);
        }
        if (body.schedule_timezone !== undefined) {
          set("schedule_timezone", body.schedule_timezone);
        }
        if (!effectiveAuto || effectiveStatus !== "active") {
          if (
            body.auto_discover_enabled !== undefined ||
            body.status !== undefined ||
            scheduleChanged
          ) {
            set("next_run_at", null, "::timestamptz");
          }
        } else if (
          becameRunnable ||
          scheduleChanged ||
          current.next_run_at === null
        ) {
          set("next_run_at", validatedNext.toISOString(), "::timestamptz");
        }
        if (body.brief !== undefined) {
          const values = profileValues(body.brief);
          set("target_customer_types", values.targetCustomerTypes, "::text[]");
          set("city_filters", values.cityFilters, "::text[]");
          set("geography_lat", values.latitude, "::numeric");
          set("geography_lng", values.longitude, "::numeric");
          set("geography_radius_km", values.radiusKm);
          set("brief", JSON.stringify(body.brief), "::jsonb");
          set(
            "exclusion_rules",
            JSON.stringify(values.exclusionRules),
            "::jsonb",
          );
          set("max_candidates_per_run", values.targetCount);
          set("enrichment_count", values.enrichmentCount);
        }

        const updated = await client.query<ProfileRow>(
          `UPDATE leadgrid_discovery_profiles
              SET ${sets.join(", ")}
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND id = $3::uuid
              AND version = $4
              AND status <> 'archived'
            RETURNING ${PROFILE_COLUMNS}`,
          params,
        );
        if (updated.rows[0]) return updated.rows[0];

        throw new RouteFailure(
          409,
          "profile_version_conflict",
          "Profilen er endret på en annen enhet. Last den inn på nytt.",
        );
      });
      res.json({ profile: profileDto(row) });
    }),
  );

  app.delete(
    `${base}/profiles/:profileId`,
    permission,
    wrapped(async (req, res) => {
      const context = await contextFor(req, res, pool, activeSessions);
      if (!context) return;
      const profileId = parseUuid(req.params.profileId, "profileId");
      const result = await pool.query<{ id: string }>(
        `UPDATE leadgrid_discovery_profiles
            SET status = 'archived', is_default = FALSE,
                auto_discover_enabled = FALSE, next_run_at = NULL,
                version = version + 1, updated_by = $4
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND id = $3::uuid
            AND status <> 'archived'
          RETURNING id::text`,
        [
          context.project.organizationId,
          context.project.id,
          profileId,
          context.userId,
        ],
      );
      if (!result.rows[0]) {
        throw new RouteFailure(
          404,
          "profile_not_found",
          "Discovery-profilen finnes ikke.",
        );
      }
      res.json({ ok: true, profile_id: result.rows[0].id });
    }),
  );
}

class RouteFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false,
    readonly field?: string,
  ) {
    super(message);
    this.name = "RouteFailure";
  }
}
