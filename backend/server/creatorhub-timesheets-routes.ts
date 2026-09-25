import crypto from "crypto";
import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import {
  ensureWorkspaceProjectScopeBinding,
  type AuthoritativeSession,
  type AuthoritativeSessionResolution,
} from "./workspace-project-participants-routes.js";
import { getProjectAccess } from "./project-team-routes.js";
import {
  CREATORHUB_ENTERPRISE_FEATURES,
  CreatorHubEnterpriseAccessError,
  resolveCreatorHubDelegatedProjectAccess,
  resolveCreatorHubEnterpriseAccess,
  sendCreatorHubEnterpriseError,
} from "./creatorhub-enterprise-access.js";

export interface CreatorHubTimesheetsRoutesDeps {
  app: Express;
  pool: Pool;
  resolveAuthoritativeSessionFromRequest: (req: Request) => Promise<AuthoritativeSessionResolution>;
}

class TimesheetError extends Error {
  constructor(readonly statusCode: number, readonly code: string, message: string) {
    super(message);
  }
}

const projectParams = z.object({ projectId: z.string().trim().min(1).max(255) }).strict();
const periodParams = projectParams.extend({ periodId: z.string().uuid() }).strict();
const entryParams = periodParams.extend({ entryId: z.string().uuid() }).strict();
const periodSchema = z.object({
  participantId: z.string().uuid(),
  employeeUserId: z.string().trim().min(1).max(255).optional(),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  employeeNote: z.string().trim().max(2_000).nullable().optional(),
}).strict();
const entryObject = z.object({
  idempotencyKey: z.string().uuid(),
  workDate: z.string().date(),
  activity: z.string().trim().min(1).max(100),
  description: z.string().trim().max(4_000).nullable().optional(),
  taskId: z.string().trim().max(255).nullable().optional(),
  startedAt: z.string().datetime().nullable().optional(),
  endedAt: z.string().datetime().nullable().optional(),
  durationMinutes: z.number().int().min(1).max(1_440),
  breakMinutes: z.number().int().min(0).max(1_439).default(0),
  billable: z.boolean().default(true),
  source: z.enum(["manual", "timer", "import"]).default("manual"),
}).strict();
const entrySchema = entryObject.refine((value) => value.breakMinutes < value.durationMinutes, {
  message: "Pause må være kortere enn registrert tid.", path: ["breakMinutes"],
}).refine((value) => Boolean(value.startedAt) === Boolean(value.endedAt), {
  message: "Start og slutt må oppgis sammen.", path: ["startedAt"],
});
const entryPatchSchema = entryObject.omit({ idempotencyKey: true }).partial().extend({
  version: z.number().int().positive(),
}).strict().refine((value: Record<string, unknown>) => Object.keys(value).some((key) => key !== "version"), "empty_patch")
  .refine((value) => value.durationMinutes === undefined || value.breakMinutes === undefined || value.breakMinutes < value.durationMinutes, {
    message: "Pause må være kortere enn registrert tid.", path: ["breakMinutes"],
  }).refine((value) => value.startedAt === undefined || value.endedAt === undefined || Boolean(value.startedAt) === Boolean(value.endedAt), {
    message: "Start og slutt må oppgis sammen.", path: ["startedAt"],
  });
const reviewSchema = z.object({ note: z.string().trim().max(2_000).nullable().optional() }).strict();
const currentPeriodSchema = z.object({
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
}).strict().refine((value) => value.periodEnd >= value.periodStart, {
  message: "Sluttdato må være lik eller etter startdato.", path: ["periodEnd"],
}).refine((value) => {
  const start = Date.parse(`${value.periodStart}T00:00:00Z`);
  const end = Date.parse(`${value.periodEnd}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) && end - start <= 31 * 86_400_000;
}, {
  message: "En periode kan ikke være lengre enn 31 dager.", path: ["periodEnd"],
});

type TimesheetProjectAccess = {
  projectId: string;
  projectOwnerUserId: string;
  organizationId: string;
  enterprise: true;
  featureId: "workspace-project-participants";
  canView: boolean;
  canManage: boolean;
  canConfigureRequirements: boolean;
  scopeBound: boolean;
  role: "project_owner" | "enterprise_admin" | "participant_manager" | "participant_viewer";
};

async function sessionFor(deps: CreatorHubTimesheetsRoutesDeps, req: Request, res: Response): Promise<AuthoritativeSession | null> {
  const result = await deps.resolveAuthoritativeSessionFromRequest(req).catch(() => ({ status: "unavailable" as const }));
  if (result.status === "unavailable") {
    res.status(503).json({ error: "authentication_unavailable", message: "Innlogging kunne ikke verifiseres." });
    return null;
  }
  if (result.status !== "authenticated" || !result.session.userId) {
    res.status(401).json({ error: "auth_required", message: "Du må logge inn." });
    return null;
  }
  return result.session;
}

async function accessFor(
  deps: CreatorHubTimesheetsRoutesDeps,
  req: Request,
  res: Response,
): Promise<{ session: AuthoritativeSession; project: TimesheetProjectAccess; role: string } | null> {
  const session = await sessionFor(deps, req, res);
  if (!session) return null;
  try {
    const projectId = String(req.params.projectId);
    const projectTeamAccess = await getProjectAccess(deps.pool, session.userId, projectId);
    if (!projectTeamAccess.canRead) {
      throw new TimesheetError(403, "project_access_denied", "Du har ikke tilgang til dette prosjektet.");
    }
    const projectResult = await deps.pool.query(
      `SELECT project.id::text AS project_id,
              project.user_id::text AS project_owner_user_id,
              scope.organization_id::text AS organization_id
         FROM public.projects project
         LEFT JOIN workspace_project_enterprise_scopes scope ON scope.project_id=project.id
        WHERE project.id=$1 LIMIT 1`,
      [projectId],
    );
    const row = projectResult.rows[0];
    if (!row) throw new TimesheetError(404, "project_not_found", "Prosjektet finnes ikke.");
    const isOwner = String(row.project_owner_user_id) === session.userId;
    if (!isOwner && !projectTeamAccess.canEdit) {
      throw new TimesheetError(403, "timesheet_access_denied", "Du må være et aktivt arbeidsmedlem i prosjektet for å bruke timelister.");
    }
    if (!row.organization_id && !isOwner) {
      throw new TimesheetError(409, "timesheet_project_not_configured", "Prosjekteieren må aktivere timelister for prosjektet først.");
    }
    let enterprise;
    try {
      enterprise = await resolveCreatorHubEnterpriseAccess(deps.pool, {
        userId: session.userId,
        organizationId: row.organization_id ? String(row.organization_id) : null,
        featureId: CREATORHUB_ENTERPRISE_FEATURES.timesheets,
      });
    } catch (error) {
      // A project invite is sufficient for an employee to record their own
      // hours. It is not an organization-wide membership: delegated access is
      // scoped to this already-verified project and never grants review/admin.
      if (
        isOwner
        || !row.organization_id
        || !(error instanceof CreatorHubEnterpriseAccessError)
        || error.code !== "enterprise_required"
      ) throw error;
      enterprise = await resolveCreatorHubDelegatedProjectAccess(deps.pool, {
        userId: session.userId,
        organizationId: String(row.organization_id),
        featureId: CREATORHUB_ENTERPRISE_FEATURES.timesheets,
      });
    }
    if (req.method !== "GET" && !enterprise.canWrite) {
      throw new TimesheetError(403, "timesheet_write_denied", "Rollen din har bare lesetilgang til timelister.");
    }
    const canConfigureRequirements = isOwner || enterprise.canAdminister;
    const project: TimesheetProjectAccess = {
      projectId,
      projectOwnerUserId: String(row.project_owner_user_id),
      organizationId: enterprise.organizationId,
      enterprise: true,
      featureId: "workspace-project-participants",
      canView: true,
      canManage: canConfigureRequirements || projectTeamAccess.canEdit,
      canConfigureRequirements,
      scopeBound: Boolean(row.organization_id),
      role: isOwner ? "project_owner" : enterprise.canAdminister ? "enterprise_admin" : projectTeamAccess.canEdit ? "participant_manager" : "participant_viewer",
    };
    return { session, project, role: enterprise.role };
  } catch (error) {
    sendCreatorHubEnterpriseError(res, error);
    return null;
  }
}

async function tx<T>(pool: Pool, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const value = await run(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

const iso = (value: unknown): string | null => value ? new Date(String(value)).toISOString() : null;
const number = (value: unknown): number => Number(value || 0);
const mapPeriod = (row: any) => ({
  id: String(row.id), organizationId: String(row.organization_id), projectId: String(row.project_id),
  participantId: String(row.participant_id), employeeUserId: String(row.employee_user_id),
  employeeName: row.employee_name || null, employeeEmail: row.employee_email || null,
  periodStart: String(row.period_start), periodEnd: String(row.period_end), status: String(row.status),
  version: number(row.version), employeeNote: row.employee_note || null, reviewerNote: row.reviewer_note || null,
  totalMinutes: number(row.total_minutes), billableMinutes: number(row.billable_minutes), entryCount: number(row.entry_count),
  submittedAt: iso(row.submitted_at), reviewedAt: iso(row.reviewed_at), lockedAt: iso(row.locked_at),
  settlement: row.settlement_id ? {
    id: String(row.settlement_id), totalMinutes: number(row.settlement_total_minutes),
    hourlyRate: number(row.hourly_rate), amount: number(row.amount), currency: String(row.currency),
    agreementStatus: String(row.agreement_status), splitSheetId: String(row.split_sheet_id),
  } : null,
  createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
});
const mapEntry = (row: any) => ({
  id: String(row.id), periodId: String(row.period_id), workDate: String(row.work_date),
  idempotencyKey: String(row.idempotency_key),
  activity: String(row.activity), description: row.description || null, taskId: row.task_id || null,
  startedAt: iso(row.started_at), endedAt: iso(row.ended_at), durationMinutes: number(row.duration_minutes),
  breakMinutes: number(row.break_minutes), netMinutes: number(row.duration_minutes) - number(row.break_minutes),
  billable: row.billable === true, source: String(row.source), version: number(row.version),
  createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
});

const PERIOD_SELECT = `
  SELECT period.*, CONCAT_WS(' ', employee.first_name, employee.last_name) AS employee_name,
         employee.email AS employee_email,
         COALESCE(entry_totals.total_minutes, 0) AS total_minutes,
         COALESCE(entry_totals.billable_minutes, 0) AS billable_minutes,
         COALESCE(entry_totals.entry_count, 0) AS entry_count,
         settlement.id AS settlement_id,
         settlement.total_minutes AS settlement_total_minutes,
         settlement.hourly_rate, settlement.amount, settlement.currency,
         settlement.agreement_status, settlement.split_sheet_id
    FROM creatorhub_timesheet_periods period
    JOIN users employee ON employee.id = period.employee_user_id
    LEFT JOIN LATERAL (
      SELECT SUM(duration_minutes - break_minutes)::int AS total_minutes,
             SUM(CASE WHEN billable THEN duration_minutes - break_minutes ELSE 0 END)::int AS billable_minutes,
             COUNT(*)::int AS entry_count
        FROM creatorhub_time_entries entry WHERE entry.period_id = period.id
    ) entry_totals ON TRUE
    LEFT JOIN creatorhub_timesheet_settlements settlement ON settlement.period_id = period.id`;

async function event(db: PoolClient | Pool, periodId: string, organizationId: string, type: string, actor: string, payload: unknown = {}): Promise<void> {
  await db.query(
    `INSERT INTO creatorhub_timesheet_events (period_id, organization_id, event_type, actor_user_id, payload)
     VALUES ($1::uuid,$2,$3,$4,$5::jsonb)`,
    [periodId, organizationId, type, actor, JSON.stringify(payload)],
  );
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof TimesheetError || error instanceof CreatorHubEnterpriseAccessError) {
    res.status(error.statusCode).json({ error: error.code, message: error.message }); return;
  }
  const code = String((error as { code?: string })?.code || "");
  if (code === "23505") {
    res.status(409).json({ error: "timesheet_conflict", message: "Perioden eller registreringen finnes allerede." }); return;
  }
  if (["23503", "23514"].includes(code)) {
    res.status(409).json({ error: "timesheet_integrity_conflict", message: "Timelisten bryter med prosjektets vilkår." }); return;
  }
  console.error("[creatorhub-timesheets] request failed", { code: code || "unknown" });
  res.status(500).json({ error: "timesheets_unavailable", message: "Timelisten kunne ikke behandles." });
}

function invalid(res: Response, parsed: z.SafeParseError<unknown>): void {
  res.status(400).json({ error: "validation_error", details: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) });
}

export function setupCreatorHubTimesheetsRoutes(deps: CreatorHubTimesheetsRoutesDeps): void {
  const { app, pool } = deps;
  const root = "/api/projects/:projectId/timesheets";

  app.get(root, async (req, res) => {
    const params = projectParams.safeParse(req.params); if (!params.success) return invalid(res, params);
    const access = await accessFor(deps, req, res); if (!access) return;
    try {
      const canReview = access.project.canConfigureRequirements || access.role === "admin";
      const result = await pool.query(
        `${PERIOD_SELECT}
          WHERE period.organization_id = $1 AND period.project_id = $2
            AND ($3::boolean OR period.employee_user_id = $4)
          ORDER BY period.period_start DESC, period.created_at DESC`,
        [access.project.organizationId, params.data.projectId, canReview, access.session.userId],
      );
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ periods: result.rows.map(mapPeriod), access: { canReview, role: access.role, userId: access.session.userId } });
    } catch (error) { sendError(res, error); }
  });

  app.get(`${root}/:periodId`, async (req, res) => {
    const params = periodParams.safeParse(req.params); if (!params.success) return invalid(res, params);
    const access = await accessFor(deps, req, res); if (!access) return;
    try {
      const canReview = access.project.canConfigureRequirements || access.role === "admin";
      const periods = await pool.query(
        `${PERIOD_SELECT} WHERE period.organization_id=$1 AND period.project_id=$2 AND period.id=$3::uuid
          AND ($4::boolean OR period.employee_user_id=$5) LIMIT 1`,
        [access.project.organizationId, params.data.projectId, params.data.periodId, canReview, access.session.userId],
      );
      if (!periods.rows[0]) return res.status(404).json({ error: "timesheet_not_found" });
      const entries = await pool.query(
        `SELECT * FROM creatorhub_time_entries WHERE period_id=$1::uuid ORDER BY work_date, created_at`,
        [params.data.periodId],
      );
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ period: mapPeriod(periods.rows[0]), entries: entries.rows.map(mapEntry), access: { canReview, role: access.role } });
    } catch (error) { sendError(res, error); }
  });

  // Capture/iPad bootstrap: derive the signed-in employee from the bearer,
  // provision their project participant once, and return the requested period.
  // No client-supplied employee identity is trusted.
  app.post(`${root}/current`, async (req, res) => {
    const params = projectParams.safeParse(req.params); if (!params.success) return invalid(res, params);
    const body = currentPeriodSchema.safeParse(req.body); if (!body.success) return invalid(res, body);
    const access = await accessFor(deps, req, res); if (!access) return;
    try {
      const output = await tx(pool, async (db) => {
        await ensureWorkspaceProjectScopeBinding(db, access.project, access.session.userId);
        await db.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`creatorhub-timesheet:${access.project.organizationId}:${params.data.projectId}:${access.session.userId}`]);
        const employeeResult = await db.query(
          `SELECT id::text AS id, email::text AS email,
                  COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', first_name, last_name)), ''), email::text, 'Teammedlem') AS display_name
             FROM users WHERE id=$1 LIMIT 1`,
          [access.session.userId],
        );
        const employee = employeeResult.rows[0];
        if (!employee?.email) throw new TimesheetError(409, "timesheet_employee_email_required", "Teammedlemmet må ha en verifisert e-postadresse.");
        const externalReference = `creatorhub-user:${access.session.userId}`;
        let participantResult = await db.query(
          `SELECT id FROM workspace_project_participants
            WHERE organization_id=$1 AND project_id=$2 AND archived_at IS NULL
              AND (external_reference=$3 OR LOWER(email)=LOWER($4))
            ORDER BY CASE WHEN external_reference=$3 THEN 0 ELSE 1 END, created_at
            LIMIT 1`,
          [access.project.organizationId, params.data.projectId, externalReference, employee.email],
        );
        if (!participantResult.rows[0]) {
          participantResult = await db.query(
            `INSERT INTO workspace_project_participants
               (organization_id,project_id,external_reference,display_name,email,participant_type,
                engagement_type,workflow_status,requires_contract,requires_media_consent,
                requires_compensation,notes,metadata,created_by,updated_by)
             VALUES ($1,$2,$3,$4,$5,'other','employee','confirmed',FALSE,FALSE,TRUE,
                     'Opprettet automatisk ved første timeregistrering i CreatorHub Capture.',
                     $6::jsonb,$7,$7)
             RETURNING id`,
            [access.project.organizationId, params.data.projectId, externalReference, employee.display_name, employee.email,
             JSON.stringify({ source: "capture-timesheet", employeeUserId: access.session.userId }), access.session.userId],
          );
        }
        const participantId = String(participantResult.rows[0].id);
        const inserted = await db.query(
          `INSERT INTO creatorhub_timesheet_periods
             (organization_id,project_id,participant_id,employee_user_id,period_start,period_end)
           VALUES ($1,$2,$3::uuid,$4,$5::date,$6::date)
           ON CONFLICT (organization_id,project_id,employee_user_id,period_start,period_end) DO NOTHING
           RETURNING id`,
          [access.project.organizationId, params.data.projectId, participantId, access.session.userId, body.data.periodStart, body.data.periodEnd],
        );
        const periodResult = await db.query(
          `${PERIOD_SELECT}
            WHERE period.organization_id=$1 AND period.project_id=$2 AND period.employee_user_id=$3
              AND period.period_start=$4::date AND period.period_end=$5::date
            LIMIT 1`,
          [access.project.organizationId, params.data.projectId, access.session.userId, body.data.periodStart, body.data.periodEnd],
        );
        const period = periodResult.rows[0];
        if (!period) throw new TimesheetError(500, "timesheet_period_unavailable", "Timelisteperioden kunne ikke opprettes.");
        if (inserted.rows[0]) await event(db, String(period.id), access.project.organizationId, "created", access.session.userId, { employeeUserId: access.session.userId, source: "capture" });
        return { period: mapPeriod(period), participantId };
      });
      res.status(200).json(output);
    } catch (error) { sendError(res, error); }
  });

  app.post(root, async (req, res) => {
    const params = projectParams.safeParse(req.params); if (!params.success) return invalid(res, params);
    const body = periodSchema.safeParse(req.body); if (!body.success) return invalid(res, body);
    const access = await accessFor(deps, req, res); if (!access) return;
    try {
      const created = await tx(pool, async (db) => {
        await ensureWorkspaceProjectScopeBinding(db, access.project, access.session.userId);
        const employeeUserId = body.data.employeeUserId || access.session.userId;
        const canCreateForOther = access.project.canConfigureRequirements || access.role === "admin";
        if (employeeUserId !== access.session.userId && !canCreateForOther) {
          throw new TimesheetError(403, "timesheet_employee_denied", "Du kan bare opprette din egen timeliste.");
        }
        const participant = await db.query(
          `SELECT participant.id, LOWER(participant.email) AS email, LOWER(employee.email) AS employee_email
             FROM workspace_project_participants participant
             JOIN users employee ON employee.id=$4
            WHERE participant.organization_id=$1 AND participant.project_id=$2 AND participant.id=$3::uuid
              AND participant.archived_at IS NULL LIMIT 1`,
          [access.project.organizationId, params.data.projectId, body.data.participantId, employeeUserId],
        );
        if (!participant.rows[0]) throw new TimesheetError(404, "participant_not_found", "Medvirkende finnes ikke i prosjektet.");
        if (!canCreateForOther && participant.rows[0].email !== participant.rows[0].employee_email) {
          throw new TimesheetError(403, "timesheet_participant_mismatch", "Timelisten må knyttes til din egen deltakerprofil.");
        }
        const id = crypto.randomUUID();
        const inserted = await db.query(
          `INSERT INTO creatorhub_timesheet_periods
             (id,organization_id,project_id,participant_id,employee_user_id,period_start,period_end,employee_note)
           VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6::date,$7::date,$8)
           RETURNING *`,
          [id, access.project.organizationId, params.data.projectId, body.data.participantId, employeeUserId, body.data.periodStart, body.data.periodEnd, body.data.employeeNote || null],
        );
        await event(db, id, access.project.organizationId, "created", access.session.userId, { employeeUserId });
        return inserted.rows[0];
      });
      res.status(201).json({ period: mapPeriod(created) });
    } catch (error) { sendError(res, error); }
  });

  app.post(`${root}/:periodId/entries`, async (req, res) => {
    const params = periodParams.safeParse(req.params); if (!params.success) return invalid(res, params);
    const body = entrySchema.safeParse(req.body); if (!body.success) return invalid(res, body);
    const access = await accessFor(deps, req, res); if (!access) return;
    try {
      const entry = await tx(pool, async (db) => {
        const period = await db.query(
          `SELECT * FROM creatorhub_timesheet_periods WHERE organization_id=$1 AND project_id=$2 AND id=$3::uuid FOR UPDATE`,
          [access.project.organizationId, params.data.projectId, params.data.periodId],
        );
        const row = period.rows[0];
        if (!row) throw new TimesheetError(404, "timesheet_not_found", "Timelisten finnes ikke.");
        const canEditOther = access.project.canConfigureRequirements || access.role === "admin";
        if (row.employee_user_id !== access.session.userId && !canEditOther) throw new TimesheetError(403, "timesheet_edit_denied", "Du kan ikke endre denne timelisten.");
        await db.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`creatorhub-time-entry:${row.employee_user_id}`]);
        const existing = await db.query(
          `SELECT * FROM creatorhub_time_entries WHERE period_id=$1::uuid AND idempotency_key=$2::uuid LIMIT 1`,
          [params.data.periodId, body.data.idempotencyKey],
        );
        if (existing.rows[0]) return existing.rows[0];
        if (!["draft", "rejected"].includes(String(row.status))) throw new TimesheetError(409, "timesheet_locked_for_editing", "Innsendte eller godkjente timelister kan ikke endres.");
        if (body.data.workDate < String(row.period_start) || body.data.workDate > String(row.period_end)) throw new TimesheetError(400, "entry_outside_period", "Arbeidsdatoen er utenfor perioden.");
        if (body.data.startedAt && body.data.endedAt) {
          const overlap = await db.query(
            `SELECT id FROM creatorhub_time_entries
              WHERE organization_id=$1 AND employee_user_id=$2
                AND started_at IS NOT NULL AND ended_at IS NOT NULL
                AND started_at < $3::timestamptz AND ended_at > $4::timestamptz
              LIMIT 1`,
            [access.project.organizationId, row.employee_user_id, body.data.endedAt, body.data.startedAt],
          );
          if (overlap.rows[0]) throw new TimesheetError(409, "time_entry_overlap", "Tidsrommet overlapper en eksisterende registrering.");
        }
        if (row.status === "rejected") {
          await db.query(`UPDATE creatorhub_timesheet_periods SET status='draft', submitted_at=NULL, submitted_by=NULL, reviewed_at=NULL, reviewed_by=NULL, reviewer_note=NULL, version=version+1, updated_at=NOW() WHERE id=$1::uuid`, [params.data.periodId]);
        }
        const result = await db.query(
          `INSERT INTO creatorhub_time_entries
             (period_id,organization_id,project_id,employee_user_id,task_id,activity,description,work_date,started_at,ended_at,duration_minutes,break_minutes,billable,source,idempotency_key,created_by)
           VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8::date,$9::timestamptz,$10::timestamptz,$11,$12,$13,$14,$15::uuid,$16)
           ON CONFLICT (period_id,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key
           RETURNING *`,
          [params.data.periodId, access.project.organizationId, params.data.projectId, row.employee_user_id, body.data.taskId || null, body.data.activity, body.data.description || null, body.data.workDate, body.data.startedAt || null, body.data.endedAt || null, body.data.durationMinutes, body.data.breakMinutes, body.data.billable, body.data.source, body.data.idempotencyKey, access.session.userId],
        );
        await event(db, params.data.periodId, access.project.organizationId, "entry_created", access.session.userId, { entryId: result.rows[0].id });
        return result.rows[0];
      });
      res.status(201).json({ entry: mapEntry(entry) });
    } catch (error) { sendError(res, error); }
  });

  app.patch(`${root}/:periodId/entries/:entryId`, async (req, res) => {
    const params = entryParams.safeParse(req.params); if (!params.success) return invalid(res, params);
    const body = entryPatchSchema.safeParse(req.body); if (!body.success) return invalid(res, body);
    const access = await accessFor(deps, req, res); if (!access) return;
    try {
      const result = await tx(pool, async (db) => {
        const current = await db.query(
          `SELECT entry.*, period.status, period.period_start, period.period_end
             FROM creatorhub_time_entries entry JOIN creatorhub_timesheet_periods period ON period.id=entry.period_id
            WHERE entry.organization_id=$1 AND entry.project_id=$2 AND entry.period_id=$3::uuid AND entry.id=$4::uuid FOR UPDATE`,
          [access.project.organizationId, params.data.projectId, params.data.periodId, params.data.entryId],
        );
        const row = current.rows[0]; if (!row) throw new TimesheetError(404, "time_entry_not_found", "Tidsregistreringen finnes ikke.");
        const canEditOther = access.project.canConfigureRequirements || access.role === "admin";
        if (row.employee_user_id !== access.session.userId && !canEditOther) throw new TimesheetError(403, "timesheet_edit_denied", "Du kan ikke endre denne registreringen.");
        if (!["draft", "rejected"].includes(String(row.status))) throw new TimesheetError(409, "timesheet_locked_for_editing", "Timelisten kan ikke endres nå.");
        const workDate = body.data.workDate || String(row.work_date);
        if (workDate < String(row.period_start) || workDate > String(row.period_end)) throw new TimesheetError(400, "entry_outside_period", "Arbeidsdatoen er utenfor perioden.");
        const duration = body.data.durationMinutes ?? number(row.duration_minutes);
        const breaks = body.data.breakMinutes ?? number(row.break_minutes);
        if (breaks >= duration) throw new TimesheetError(400, "invalid_break", "Pause må være kortere enn registrert tid.");
        const startedAt = body.data.startedAt === undefined ? row.started_at : body.data.startedAt;
        const endedAt = body.data.endedAt === undefined ? row.ended_at : body.data.endedAt;
        if (Boolean(startedAt) !== Boolean(endedAt)) {
          throw new TimesheetError(400, "invalid_time_interval", "Start og slutt må oppgis sammen.");
        }
        await db.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`creatorhub-time-entry:${row.employee_user_id}`]);
        if (startedAt && endedAt) {
          const overlap = await db.query(
            `SELECT id FROM creatorhub_time_entries
              WHERE organization_id=$1 AND employee_user_id=$2 AND id<>$3::uuid
                AND started_at IS NOT NULL AND ended_at IS NOT NULL
                AND started_at < $4::timestamptz AND ended_at > $5::timestamptz
              LIMIT 1`,
            [access.project.organizationId, row.employee_user_id, params.data.entryId, endedAt, startedAt],
          );
          if (overlap.rows[0]) throw new TimesheetError(409, "time_entry_overlap", "Tidsrommet overlapper en eksisterende registrering.");
        }
        const updated = await db.query(
          `UPDATE creatorhub_time_entries SET
             work_date=$1::date, activity=$2, description=$3, task_id=$4,
             started_at=$5::timestamptz, ended_at=$6::timestamptz,
             duration_minutes=$7, break_minutes=$8, billable=$9, source=$10,
             version=version+1, updated_at=NOW()
           WHERE id=$11::uuid AND version=$12 RETURNING *`,
          [workDate, body.data.activity ?? row.activity, body.data.description === undefined ? row.description : body.data.description, body.data.taskId === undefined ? row.task_id : body.data.taskId, startedAt, endedAt, duration, breaks, body.data.billable ?? row.billable, body.data.source ?? row.source, params.data.entryId, body.data.version],
        );
        if (!updated.rows[0]) throw new TimesheetError(409, "time_entry_version_conflict", "Registreringen er endret av noen andre.");
        if (row.status === "rejected") await db.query(`UPDATE creatorhub_timesheet_periods SET status='draft', submitted_at=NULL, submitted_by=NULL, reviewed_at=NULL, reviewed_by=NULL, reviewer_note=NULL, version=version+1, updated_at=NOW() WHERE id=$1::uuid`, [params.data.periodId]);
        await event(db, params.data.periodId, access.project.organizationId, "entry_updated", access.session.userId, { entryId: params.data.entryId });
        return updated.rows[0];
      });
      res.json({ entry: mapEntry(result) });
    } catch (error) { sendError(res, error); }
  });

  app.delete(`${root}/:periodId/entries/:entryId`, async (req, res) => {
    const params = entryParams.safeParse(req.params); if (!params.success) return invalid(res, params);
    const access = await accessFor(deps, req, res); if (!access) return;
    try {
      await tx(pool, async (db) => {
        const deleted = await db.query(
          `DELETE FROM creatorhub_time_entries entry USING creatorhub_timesheet_periods period
            WHERE entry.id=$1::uuid AND entry.period_id=$2::uuid AND entry.period_id=period.id
              AND entry.organization_id=$3 AND entry.project_id=$4
              AND period.status IN ('draft','rejected')
              AND (entry.employee_user_id=$5 OR $6::boolean)
          RETURNING entry.id`,
          [params.data.entryId, params.data.periodId, access.project.organizationId, params.data.projectId, access.session.userId, access.project.canConfigureRequirements || access.role === "admin"],
        );
        if (!deleted.rows[0]) throw new TimesheetError(404, "time_entry_not_found", "Registreringen finnes ikke eller kan ikke slettes.");
        await db.query(
          `UPDATE creatorhub_timesheet_periods
              SET status='draft', submitted_at=NULL, submitted_by=NULL,
                  reviewed_at=NULL, reviewed_by=NULL, reviewer_note=NULL,
                  version=version+1, updated_at=NOW()
            WHERE id=$1::uuid AND status='rejected'`,
          [params.data.periodId],
        );
        await event(db, params.data.periodId, access.project.organizationId, "entry_deleted", access.session.userId, { entryId: params.data.entryId });
      });
      res.json({ deleted: true });
    } catch (error) { sendError(res, error); }
  });

  app.post(`${root}/:periodId/submit`, async (req, res) => {
    const params = periodParams.safeParse(req.params); if (!params.success) return invalid(res, params);
    const access = await accessFor(deps, req, res); if (!access) return;
    try {
      const period = await tx(pool, async (db) => {
        const result = await db.query(
          `UPDATE creatorhub_timesheet_periods period SET status='submitted', submitted_at=NOW(), submitted_by=$1,
             reviewer_note=NULL, reviewed_at=NULL, reviewed_by=NULL, version=version+1, updated_at=NOW()
           WHERE organization_id=$2 AND project_id=$3 AND id=$4::uuid AND status='draft'
             AND (employee_user_id=$1 OR $5::boolean)
             AND EXISTS (SELECT 1 FROM creatorhub_time_entries entry WHERE entry.period_id=period.id)
           RETURNING *`,
          [access.session.userId, access.project.organizationId, params.data.projectId, params.data.periodId, access.project.canConfigureRequirements || access.role === "admin"],
        );
        if (!result.rows[0]) throw new TimesheetError(409, "timesheet_not_submittable", "Timelisten er tom, låst eller allerede sendt inn.");
        await event(db, params.data.periodId, access.project.organizationId, "submitted", access.session.userId);
        return result.rows[0];
      });
      res.json({ period: mapPeriod(period) });
    } catch (error) { sendError(res, error); }
  });

  app.post(`${root}/:periodId/reject`, async (req, res) => {
    const params = periodParams.safeParse(req.params); if (!params.success) return invalid(res, params);
    const body = reviewSchema.safeParse(req.body); if (!body.success) return invalid(res, body);
    const access = await accessFor(deps, req, res); if (!access) return;
    if (!(access.project.canConfigureRequirements || access.role === "admin")) return res.status(403).json({ error: "timesheet_review_denied" });
    try {
      const period = await tx(pool, async (db) => {
        const result = await db.query(
          `UPDATE creatorhub_timesheet_periods SET status='rejected', reviewer_note=$1, reviewed_at=NOW(), reviewed_by=$2, version=version+1, updated_at=NOW()
            WHERE organization_id=$3 AND project_id=$4 AND id=$5::uuid AND status='submitted' RETURNING *`,
          [body.data.note || null, access.session.userId, access.project.organizationId, params.data.projectId, params.data.periodId],
        );
        if (!result.rows[0]) throw new TimesheetError(409, "timesheet_not_reviewable", "Timelisten er ikke klar for behandling.");
        await event(db, params.data.periodId, access.project.organizationId, "rejected", access.session.userId, { note: body.data.note || null });
        return result.rows[0];
      });
      res.json({ period: mapPeriod(period) });
    } catch (error) { sendError(res, error); }
  });

  app.post(`${root}/:periodId/approve`, async (req, res) => {
    const params = periodParams.safeParse(req.params); if (!params.success) return invalid(res, params);
    const body = reviewSchema.safeParse(req.body); if (!body.success) return invalid(res, body);
    const access = await accessFor(deps, req, res); if (!access) return;
    if (!(access.project.canConfigureRequirements || access.role === "admin")) return res.status(403).json({ error: "timesheet_review_denied" });
    try {
      const output = await tx(pool, async (db) => {
        const periodResult = await db.query(
          `SELECT * FROM creatorhub_timesheet_periods WHERE organization_id=$1 AND project_id=$2 AND id=$3::uuid AND status='submitted' FOR UPDATE`,
          [access.project.organizationId, params.data.projectId, params.data.periodId],
        );
        const period = periodResult.rows[0];
        if (!period) throw new TimesheetError(409, "timesheet_not_reviewable", "Timelisten er ikke klar for godkjenning.");
        const totals = await db.query(
          `SELECT COALESCE(SUM(duration_minutes-break_minutes),0)::int AS total_minutes
             FROM creatorhub_time_entries WHERE period_id=$1::uuid`, [params.data.periodId],
        );
        const totalMinutes = number(totals.rows[0]?.total_minutes);
        if (totalMinutes <= 0) throw new TimesheetError(409, "timesheet_empty", "En tom timeliste kan ikke godkjennes.");
        const compensation = await db.query(
          `SELECT link.id, link.hourly_rate, link.currency, link.split_sheet_id, sheet.status AS split_sheet_status
             FROM workspace_participant_compensation_links link
             JOIN split_sheets sheet ON sheet.id=link.split_sheet_id
            WHERE link.organization_id=$1 AND link.project_id=$2 AND link.participant_id=$3::uuid
              AND link.status='active' AND link.compensation_type='hourly'
            LIMIT 1 FOR UPDATE OF link`,
          [access.project.organizationId, params.data.projectId, period.participant_id],
        );
        const terms = compensation.rows[0];
        if (!terms) throw new TimesheetError(409, "hourly_compensation_required", "Medvirkende må ha en aktiv timeavtale i Split Sheet før godkjenning.");
        const rate = number(terms.hourly_rate);
        const amount = Math.round((rate * totalMinutes / 60 + Number.EPSILON) * 100) / 100;
        const settlementId = crypto.randomUUID();
        const agreementStatus = String(terms.split_sheet_status) === "completed" ? "signed" : "pending_signature";
        await db.query(
          `INSERT INTO creatorhub_timesheet_settlements
             (id,period_id,organization_id,project_id,participant_id,compensation_id,split_sheet_id,total_minutes,hourly_rate,amount,currency,agreement_status,terms_snapshot,created_by)
           VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::uuid,$7::uuid,$8,$9,$10,$11,$12,$13::jsonb,$14)`,
          [settlementId, params.data.periodId, access.project.organizationId, params.data.projectId, period.participant_id, terms.id, terms.split_sheet_id, totalMinutes, rate, amount, terms.currency, agreementStatus, JSON.stringify({ source: "creatorhub-timesheet", periodId: params.data.periodId, compensationId: terms.id, splitSheetId: terms.split_sheet_id, totalMinutes, hourlyRate: rate, amount, currency: terms.currency }), access.session.userId],
        );
        const approved = await db.query(
          `UPDATE creatorhub_timesheet_periods SET status='approved', reviewer_note=$1, reviewed_at=NOW(), reviewed_by=$2, version=version+1, updated_at=NOW()
            WHERE id=$3::uuid RETURNING *`,
          [body.data.note || null, access.session.userId, params.data.periodId],
        );
        await event(db, params.data.periodId, access.project.organizationId, "approved", access.session.userId, { settlementId, totalMinutes, amount, agreementStatus });
        return { period: approved.rows[0], settlement: { id: settlementId, totalMinutes, hourlyRate: rate, amount, currency: terms.currency, agreementStatus, splitSheetId: terms.split_sheet_id } };
      });
      res.json(output);
    } catch (error) { sendError(res, error); }
  });

  app.post(`${root}/:periodId/lock`, async (req, res) => {
    const params = periodParams.safeParse(req.params); if (!params.success) return invalid(res, params);
    const access = await accessFor(deps, req, res); if (!access) return;
    if (!(access.project.canConfigureRequirements || access.role === "admin")) return res.status(403).json({ error: "timesheet_review_denied" });
    try {
      const result = await tx(pool, async (db) => {
        const locked = await db.query(
          `UPDATE creatorhub_timesheet_periods SET status='locked', locked_at=NOW(), version=version+1, updated_at=NOW()
            WHERE organization_id=$1 AND project_id=$2 AND id=$3::uuid AND status='approved'
              AND EXISTS (SELECT 1 FROM creatorhub_timesheet_settlements settlement WHERE settlement.period_id=creatorhub_timesheet_periods.id)
            RETURNING *`,
          [access.project.organizationId, params.data.projectId, params.data.periodId],
        );
        if (!locked.rows[0]) throw new TimesheetError(409, "timesheet_not_lockable", "Bare godkjente timelister med oppgjør kan låses.");
        await event(db, params.data.periodId, access.project.organizationId, "locked", access.session.userId);
        return locked.rows[0];
      });
      res.json({ period: mapPeriod(result) });
    } catch (error) { sendError(res, error); }
  });
}
