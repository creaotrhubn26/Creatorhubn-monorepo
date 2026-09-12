import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import type { WorkspaceParticipantWorkPermitClearanceRequest } from "../../frontend/shared/workspace-participant-clearance.ts";
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
  getWorkspaceParticipantWorkPermitClearance,
  setWorkspaceParticipantWorkPermitClearance,
  WorkspaceParticipantClearanceError,
} from "./workspace-participant-clearance-service.js";

export interface WorkspaceParticipantClearanceRoutesDeps {
  app: Express;
  pool: Pool;
  getClearance?: typeof getWorkspaceParticipantWorkPermitClearance;
  setClearance?: typeof setWorkspaceParticipantWorkPermitClearance;
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

const withoutControlCharacters = (value: string): boolean =>
  !/[\u0000-\u001f\u007f]/u.test(value);

const evidenceReferenceSchema = z
  .string()
  .trim()
  .min(1)
  .max(1_024)
  .refine(withoutControlCharacters, "Kontrolltegn er ikke tillatt.")
  .refine((value) => {
    if (
      /^(creatorhub-document|workspace-file):[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    ) {
      return true;
    }
    try {
      const parsed = new URL(value);
      return (
        parsed.protocol === "https:" &&
        parsed.username === "" &&
        parsed.password === ""
      );
    } catch {
      return false;
    }
  }, "Bruk en HTTPS-lenke eller en intern CreatorHub-referanse.");

const noteSchema = z
  .string()
  .trim()
  .max(2_000)
  .refine(withoutControlCharacters, "Kontrolltegn er ikke tillatt.");

export const workspaceParticipantWorkPermitClearanceRequestSchema = z
  .object({
    version: z.number().int().positive(),
    status: z.enum(["pending", "approved", "rejected", "not_required"]),
    evidenceReference: evidenceReferenceSchema.nullable().optional(),
    note: noteSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "approved" && !value.evidenceReference) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidenceReference"],
        message: "Godkjent arbeidstillatelse krever en bevisreferanse.",
      });
    }
  });

async function authoritativeSession(
  deps: WorkspaceParticipantClearanceRoutesDeps,
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

function assertClearanceConfigure(access: WorkspaceParticipantAccess): void {
  if (!access.canConfigureRequirements) {
    throw new WorkspaceParticipantClearanceError(
      403,
      "work_permit_clearance_denied",
      "Kun prosjekteier eller Enterprise-admin kan behandle arbeidstillatelse.",
    );
  }
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
      error: "work_permit_integrity_conflict",
      message: "Arbeidstillatelsen er endret eller kunne ikke lagres.",
    });
    return;
  }
  console.error("[workspace-participant-clearance] request failed", {
    code: pgCode || "unknown",
  });
  res.status(500).json({
    error: "workspace_participant_clearance_unavailable",
    message: "Arbeidstillatelsen kunne ikke behandles.",
  });
}

function preventSensitiveCaching(res: Response): void {
  res.setHeader("Cache-Control", "no-store, private");
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

export function setupWorkspaceParticipantClearanceRoutes(
  deps: WorkspaceParticipantClearanceRoutesDeps,
): void {
  const { app, pool } = deps;
  const getClearance =
    deps.getClearance ?? getWorkspaceParticipantWorkPermitClearance;
  const setClearance =
    deps.setClearance ?? setWorkspaceParticipantWorkPermitClearance;
  const path =
    "/api/projects/:projectId/participants/:participantId/work-permit-clearance";

  app.get(path, async (req, res) => {
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
      assertClearanceConfigure(access);
      const result = await getClearance({
        db: pool,
        access,
        participantId: params.data.participantId,
      });
      res.json({ ...result, access });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post(path, async (req, res) => {
    preventSensitiveCaching(res);
    const session = await authoritativeSession(deps, req, res);
    if (!session) return;
    const auditActorUserId = workspaceParticipantAuditActorUserId(session);
    const impersonationPayload =
      workspaceParticipantImpersonationPayload(session);
    const params = paramsSchema.safeParse(req.params);
    const body = workspaceParticipantWorkPermitClearanceRequestSchema.safeParse(
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
        assertClearanceConfigure(access);
        await ensureWorkspaceProjectScopeBinding(
          client,
          access,
          auditActorUserId,
        );
        const clearance = await setClearance({
          db: client,
          access,
          actorUserId: auditActorUserId,
          auditPayload: impersonationPayload,
          participantId: params.data.participantId,
          request: body.data as WorkspaceParticipantWorkPermitClearanceRequest,
        });
        return { ...clearance, access };
      });
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });
}
