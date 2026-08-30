import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import type { WorkspaceParticipantCompensationRequest } from "../../frontend/shared/workspace-participant-compensation.ts";
import {
  ensureWorkspaceProjectScopeBinding,
  resolveWorkspaceParticipantAccess,
  type AuthoritativeSession,
  type AuthoritativeSessionResolution,
  type WorkspaceParticipantAccess,
} from "./workspace-project-participants-routes.js";
import {
  workspaceParticipantAuditActorUserId,
  workspaceParticipantImpersonationPayload,
} from "./workspace-participant-authoritative-session.js";
import {
  createWorkspaceParticipantCompensationVersion,
  listWorkspaceParticipantCompensation,
  WorkspaceParticipantCompensationError,
} from "./workspace-participant-compensation-service.js";

export interface WorkspaceParticipantCompensationRoutesDeps {
  app: Express;
  pool: Pool;
  createCompensationVersion?: typeof createWorkspaceParticipantCompensationVersion;
  listCompensation?: typeof listWorkspaceParticipantCompensation;
  resolveAuthoritativeSessionFromRequest: (
    req: Request,
  ) => Promise<AuthoritativeSessionResolution>;
}

const paramsSchema = z
  .object({
    projectId: z.string().trim().min(1).max(255),
    participantId: z.string().uuid(),
  })
  .strict();

const positiveMoney = z
  .number()
  .finite()
  .positive()
  .max(10_000_000_000)
  .refine(
    (value) =>
      Math.abs(value - Math.round((value + Number.EPSILON) * 100) / 100) <=
      1e-8,
    "Maksimalt to desimaler.",
  );

const estimatedHours = z
  .number()
  .finite()
  .positive()
  .max(10_000)
  .refine(
    (value) =>
      Math.abs(value - Math.round((value + Number.EPSILON) * 100) / 100) <=
      1e-8,
    "Maksimalt to desimaler.",
  );

const requestBase = {
  idempotencyKey: z.string().uuid(),
  expectedCurrentVersion: z.number().int().positive().nullable(),
  note: z
    .string()
    .trim()
    .max(2_000)
    .refine((value) => !/<\/?[a-z][^>]*>/i.test(value), "HTML er ikke tillatt.")
    .transform((value) => value.normalize("NFC"))
    .nullable()
    .optional(),
};

export const workspaceParticipantCompensationRequestSchema =
  z.discriminatedUnion("compensationType", [
    z
      .object({
        ...requestBase,
        compensationType: z.literal("hourly"),
        hourlyRate: positiveMoney.refine((value) => value <= 10_000_000),
        estimatedHours,
        currency: z.string().regex(/^[A-Z]{3}$/),
      })
      .strict(),
    z
      .object({
        ...requestBase,
        compensationType: z.literal("fixed"),
        fixedAmount: positiveMoney,
        currency: z.string().regex(/^[A-Z]{3}$/),
      })
      .strict(),
    z
      .object({
        ...requestBase,
        compensationType: z.literal("unpaid"),
      })
      .strict(),
  ]);

async function authoritativeSession(
  deps: WorkspaceParticipantCompensationRoutesDeps,
  req: Request,
  res: Response,
): Promise<AuthoritativeSession | null> {
  let resolution: AuthoritativeSessionResolution;
  try {
    resolution = await deps.resolveAuthoritativeSessionFromRequest(req);
  } catch {
    res.status(503).json({
      error: "authentication_unavailable",
      message: "Innlogging kunne ikke verifiseres.",
    });
    return null;
  }
  if (resolution.status === "unavailable") {
    res.status(503).json({
      error: "authentication_unavailable",
      message: "Innlogging kunne ikke verifiseres.",
    });
    return null;
  }
  if (resolution.status !== "authenticated" || !resolution.session.userId) {
    res
      .status(401)
      .json({ error: "auth_required", message: "Du må logge inn." });
    return null;
  }
  return resolution.session;
}

function assertCompensationManage(access: WorkspaceParticipantAccess): void {
  if (!access.canManage) {
    throw new WorkspaceParticipantCompensationError(
      403,
      "participant_compensation_manage_denied",
      "Du har ikke tilgang til medvirkendes kompensasjonsvilkår.",
    );
  }
}

function assertCompensationConfigure(access: WorkspaceParticipantAccess): void {
  if (!access.canConfigureRequirements) {
    throw new WorkspaceParticipantCompensationError(
      403,
      "participant_compensation_configure_denied",
      "Kun prosjekteier eller Enterprise-admin kan opprette nye kompensasjonsvilkår.",
    );
  }
}

function preventSensitiveCaching(res: Response): void {
  res.setHeader("Cache-Control", "no-store, private");
}

function validationError(
  res: Response,
  parsed: z.SafeParseError<unknown>,
): void {
  res.status(400).json({
    error: "validation_error",
    message: "Forespørselen inneholder ugyldige felt.",
    details: parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function sendError(res: Response, error: unknown): void {
  const known = error as {
    statusCode?: unknown;
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
  if (
    Number.isInteger(known?.statusCode) &&
    typeof known.code === "string" &&
    typeof known.message === "string"
  ) {
    res.status(Number(known.statusCode)).json({
      error: known.code,
      message: known.message,
      ...(known.details === undefined ? {} : { details: known.details }),
    });
    return;
  }
  const pgCode = (error as { code?: string })?.code;
  if (["23503", "23505", "23514"].includes(String(pgCode))) {
    res.status(409).json({
      error: "compensation_integrity_conflict",
      message: "Kompensasjonsvilkårene er endret eller kunne ikke lagres.",
    });
    return;
  }
  console.error("[workspace-participant-compensation] request failed", {
    code: pgCode || "unknown",
  });
  res.status(500).json({
    error: "workspace_participant_compensation_unavailable",
    message: "Kompensasjonsvilkårene kunne ikke behandles.",
  });
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
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function setupWorkspaceParticipantCompensationRoutes(
  deps: WorkspaceParticipantCompensationRoutesDeps,
): void {
  const { app, pool } = deps;
  const createCompensationVersion =
    deps.createCompensationVersion ??
    createWorkspaceParticipantCompensationVersion;
  const listCompensation =
    deps.listCompensation ?? listWorkspaceParticipantCompensation;
  const basePath =
    "/api/projects/:projectId/participants/:participantId/compensation";

  app.get(`${basePath}/current`, async (req, res) => {
    preventSensitiveCaching(res);
    const session = await authoritativeSession(deps, req, res);
    if (!session) return;
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return validationError(res, params);
    try {
      const access = await resolveWorkspaceParticipantAccess(
        pool,
        session.userId,
        params.data.projectId,
      );
      assertCompensationManage(access);
      const result = await listCompensation(
        pool,
        access,
        params.data.participantId,
      );
      res.json({ compensation: result.current, access });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get(`${basePath}/history`, async (req, res) => {
    preventSensitiveCaching(res);
    const session = await authoritativeSession(deps, req, res);
    if (!session) return;
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return validationError(res, params);
    try {
      const access = await resolveWorkspaceParticipantAccess(
        pool,
        session.userId,
        params.data.projectId,
      );
      assertCompensationManage(access);
      const result = await listCompensation(
        pool,
        access,
        params.data.participantId,
      );
      res.json({ compensations: result.history, access });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post(basePath, async (req, res) => {
    preventSensitiveCaching(res);
    const session = await authoritativeSession(deps, req, res);
    if (!session) return;
    const auditActorUserId = workspaceParticipantAuditActorUserId(session);
    const impersonationPayload =
      workspaceParticipantImpersonationPayload(session);
    const params = paramsSchema.safeParse(req.params);
    const body = workspaceParticipantCompensationRequestSchema.safeParse(
      req.body ?? {},
    );
    if (!params.success) return validationError(res, params);
    if (!body.success) return validationError(res, body);
    try {
      const result = await transaction(pool, async (client) => {
        const access = await resolveWorkspaceParticipantAccess(
          client,
          session.userId,
          params.data.projectId,
        );
        assertCompensationConfigure(access);
        await ensureWorkspaceProjectScopeBinding(
          client,
          access,
          auditActorUserId,
        );
        const created = await createCompensationVersion({
          db: client,
          access,
          actorUserId: auditActorUserId,
          auditPayload: impersonationPayload,
          participantId: params.data.participantId,
          request: body.data as WorkspaceParticipantCompensationRequest,
        });
        return { ...created, access };
      });
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      sendError(res, error);
    }
  });
}
