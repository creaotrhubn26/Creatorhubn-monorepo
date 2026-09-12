import crypto from "node:crypto";
import { isIP } from "node:net";
import express, {
  type ErrorRequestHandler,
  type Express,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import { rateLimit } from "express-rate-limit";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import type {
  WorkspaceParticipantDocumentIssueInput,
  WorkspaceParticipantDocumentMutationResponse,
  WorkspaceParticipantDocumentPublicMutationResponse,
  WorkspaceParticipantDocumentType,
} from "../../frontend/shared/workspace-participant-documents.ts";
import {
  ensureWorkspaceProjectScopeBinding,
  resolveWorkspaceParticipantAccess,
  type AuthoritativeSession,
  type AuthoritativeSessionResolution,
} from "./workspace-project-participants-routes.js";
import {
  workspaceParticipantAuditActorUserId,
  workspaceParticipantImpersonationPayload,
} from "./workspace-participant-authoritative-session.js";
import {
  appendWorkspaceParticipantDocumentDeliveryEvent,
  buildWorkspaceParticipantDocumentPortalUrl,
  hashWorkspaceParticipantDocumentToken,
  isWorkspaceParticipantDocumentToken,
  issueWorkspaceParticipantDocument,
  listWorkspaceParticipantDocuments,
  reissueWorkspaceParticipantDocumentToken,
  signWorkspaceParticipantDocument,
  verifyWorkspaceParticipantDocumentToken,
  viewWorkspaceParticipantDocument,
  withdrawWorkspaceParticipantMediaConsent,
  WorkspaceParticipantDocumentError,
  type WorkspaceParticipantDocumentRuntime,
} from "./workspace-participant-documents-service.js";

export const WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER =
  "x-workspace-participant-document-token" as const;

export const WORKSPACE_PARTICIPANT_DOCUMENT_PUBLIC_PATH =
  "/api/public/workspace-participant-documents/:documentId" as const;

export type WorkspaceParticipantDocumentDeliveryKind =
  | "workspace_participant_document_issued"
  | "workspace_participant_document_reissued"
  | "workspace_participant_document_signed"
  | "workspace_participant_consent_withdrawn";

/**
 * Post-commit delivery boundary. Personal signing credentials may cross this
 * boundary only for direct delivery to the persisted signer address. Manager
 * responses and delivery audit events must never contain the credential.
 */
export interface WorkspaceParticipantDocumentDeliveryRequest {
  kind: WorkspaceParticipantDocumentDeliveryKind;
  to: string | null;
  recipientName: string;
  projectId: string;
  projectTitle: string;
  documentId: string;
  documentType: WorkspaceParticipantDocumentType;
  documentTitle: string;
  portalUrl?: string;
  actorUserId?: string | null;
}

export interface WorkspaceParticipantDocumentDeliveryResult {
  sent: boolean;
  provider: string | null;
  reason: string | null;
}

export type WorkspaceParticipantDocumentDeliveryAdapter = (
  request: WorkspaceParticipantDocumentDeliveryRequest,
) => Promise<WorkspaceParticipantDocumentDeliveryResult>;

export interface WorkspaceParticipantDocumentOperations {
  list: typeof listWorkspaceParticipantDocuments;
  issue: typeof issueWorkspaceParticipantDocument;
  reissue: typeof reissueWorkspaceParticipantDocumentToken;
  view: typeof viewWorkspaceParticipantDocument;
  sign: typeof signWorkspaceParticipantDocument;
  withdraw: typeof withdrawWorkspaceParticipantMediaConsent;
  appendDelivery: typeof appendWorkspaceParticipantDocumentDeliveryEvent;
}

const DEFAULT_OPERATIONS: WorkspaceParticipantDocumentOperations = {
  list: listWorkspaceParticipantDocuments,
  issue: issueWorkspaceParticipantDocument,
  reissue: reissueWorkspaceParticipantDocumentToken,
  view: viewWorkspaceParticipantDocument,
  sign: signWorkspaceParticipantDocument,
  withdraw: withdrawWorkspaceParticipantMediaConsent,
  appendDelivery: appendWorkspaceParticipantDocumentDeliveryEvent,
};

type AccessResolver = typeof resolveWorkspaceParticipantAccess;
type ScopeBinder = typeof ensureWorkspaceProjectScopeBinding;
type TransactionRunner = <T>(
  work: (client: PoolClient) => Promise<T>,
) => Promise<T>;

export interface WorkspaceParticipantDocumentRoutesDeps {
  app: Express;
  pool: Pool;
  resolveAuthoritativeSessionFromRequest: (
    req: Request,
  ) => Promise<AuthoritativeSessionResolution>;
  publicAppUrl?: string;
  runtime?: WorkspaceParticipantDocumentRuntime;
  deliveryAdapter?: WorkspaceParticipantDocumentDeliveryAdapter;
  operations?: Partial<WorkspaceParticipantDocumentOperations>;
  resolveAccess?: AccessResolver;
  ensureScope?: ScopeBinder;
  runTransaction?: TransactionRunner;
}

const noHtml = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine((value) => !/<\/?[a-z][^>]*>/i.test(value), "html_not_allowed");
const optionalNoHtml = (maximum: number) =>
  noHtml(maximum).nullable().optional();
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();
const guardianSchema = z
  .object({
    name: noHtml(255),
    email: z.string().trim().email().max(320),
    relationship: noHtml(120),
  })
  .strict();
const commonIssue = {
  title: noHtml(255).optional(),
  invitationExpiresInDays: z.number().int().min(1).max(90).optional(),
  guardian: guardianSchema.optional(),
};
const contractIssueSchema = z
  .object({
    ...commonIssue,
    documentType: z.literal("contract"),
    terms: z
      .object({
        workDescription: noHtml(5_000),
        role: noHtml(255),
        startsOn: dateOnly,
        endsOn: dateOnly,
        cancellationTerms: optionalNoHtml(5_000),
        safetyTerms: optionalNoHtml(5_000),
        confidentialityTerms: optionalNoHtml(5_000),
        additionalTerms: optionalNoHtml(10_000),
      })
      .strict()
      .superRefine((value, context) => {
        if (value.startsOn && value.endsOn && value.endsOn < value.startsOn) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["endsOn"],
            message: "ends_before_start",
          });
        }
      }),
  })
  .strict();
const mediaConsentIssueSchema = z
  .object({
    ...commonIssue,
    documentType: z.literal("media_consent"),
    terms: z
      .object({
        mediaTypes: z
          .array(z.enum(["photo", "video", "audio"]))
          .min(1)
          .max(3)
          .refine(
            (items) => new Set(items).size === items.length,
            "duplicate_media_type",
          ),
        purposes: z.array(noHtml(500)).min(1).max(20),
        channels: z.array(noHtml(255)).min(1).max(20),
        territory: noHtml(255),
        duration: noHtml(255),
        retention: noHtml(500),
        editingAllowed: z.boolean(),
        paidMediaAllowed: z.boolean(),
        withdrawalContact: noHtml(500),
        additionalTerms: optionalNoHtml(10_000),
      })
      .strict(),
  })
  .strict();
const issueSchema = z.discriminatedUnion("documentType", [
  contractIssueSchema,
  mediaConsentIssueSchema,
]);

const managerParamsSchema = z
  .object({
    projectId: z.string().trim().min(1).max(255),
    participantId: z.string().uuid(),
  })
  .strict();
const managerDocumentParamsSchema = managerParamsSchema
  .extend({ documentId: z.string().uuid() })
  .strict();
const publicParamsSchema = z.object({ documentId: z.string().uuid() }).strict();
const signSchema = z
  .object({
    signerName: noHtml(255),
    accepted: z.literal(true),
    signatureMethod: z.literal("typed"),
  })
  .strict();
const withdrawSchema = z
  .object({
    confirmed: z.literal(true),
    reason: optionalNoHtml(1_000),
  })
  .strict();
const emptySchema = z.object({}).strict();
const PUBLIC_MUTATION_PRELIMITED =
  "workspaceParticipantDocumentMutationPrelimited" as const;

export const workspaceParticipantDocumentSecurityHeaders: RequestHandler = (
  _req,
  res,
  next,
) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
};

function requireJsonContentType(
  req: Request,
  res: Response,
  next: () => void,
): void {
  const contentType = String(req.headers["content-type"] || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (
    contentType !== "application/json" &&
    !/^application\/[a-z0-9!#$&^_.+-]+\+json$/i.test(contentType)
  ) {
    res.status(415).json({ error: "unsupported_media_type" });
    return;
  }
  next();
}

const publicBodyErrorHandler = ((error, _req, res, next) => {
  const bodyError = error as { status?: unknown; type?: unknown };
  if (bodyError.status === 413 || bodyError.type === "entity.too.large") {
    res.status(413).json({ error: "request_body_too_large" });
    return;
  }
  if (bodyError.status === 400 || bodyError.type === "entity.parse.failed") {
    res.status(400).json({ error: "invalid_request_body" });
    return;
  }
  next(error);
}) satisfies ErrorRequestHandler;

/**
 * Register this before the historical global 50 MB parser in index.ts.
 * The limiter deliberately runs before content-type and JSON parsing so
 * malformed and oversized requests consume the same budget as valid ones.
 */
export function setupWorkspaceParticipantDocumentBodyParserBoundary(
  app: Express,
  credentialLimit = 15,
  perDocumentLimit = 120,
  runtime?: WorkspaceParticipantDocumentRuntime,
): void {
  const authenticateToken =
    createWorkspaceParticipantDocumentTokenAuthenticityBoundary(runtime);
  const mutationCredentialLimit =
    createWorkspaceParticipantDocumentCredentialRateLimit(credentialLimit);
  const mutationDocumentLimit =
    createWorkspaceParticipantDocumentRateLimit(perDocumentLimit);
  const markPrelimited: RequestHandler = (_req, res, next) => {
    res.locals[PUBLIC_MUTATION_PRELIMITED] = true;
    next();
  };
  for (const suffix of ["sign", "withdraw"] as const) {
    app.post(
      `${WORKSPACE_PARTICIPANT_DOCUMENT_PUBLIC_PATH}/${suffix}`,
      workspaceParticipantDocumentSecurityHeaders,
      authenticateToken,
      mutationDocumentLimit,
      mutationCredentialLimit,
      markPrelimited,
      requireJsonContentType,
      express.json({
        limit: "32kb",
        strict: true,
        type: ["application/json", "application/*+json"],
      }),
      publicBodyErrorHandler,
      (_req: Request, _res: Response, next: NextFunction) => next(),
    );
  }
}

function documentTokenOf(req: Request): string {
  const value = req.headers[WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER];
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" ? candidate.trim() : "";
}

function rateLimitDocumentIdOf(req: Request): string {
  const normalized = String(req.params.documentId || "")
    .trim()
    .toLowerCase();
  return normalized || "missing";
}

function normalizeWorkspaceParticipantDocumentIp(
  value: unknown,
): string | null {
  let candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate || candidate.length > 64) return null;
  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  }
  const zoneIndex = candidate.indexOf("%");
  if (zoneIndex > -1) candidate = candidate.slice(0, zoneIndex);
  return isIP(candidate) === 0 ? null : candidate.toLowerCase();
}

/**
 * Returns only the directly connected network peer. X-Forwarded-For is
 * deliberately ignored because this route cannot attest every ingress path or
 * a fixed proxy-hop count. This value is evidence metadata, never a user
 * identity claim or a rate-limit partition.
 */
export function resolveWorkspaceParticipantDocumentSocketPeerIp(
  req: Request,
): string {
  return (
    normalizeWorkspaceParticipantDocumentIp(req.socket?.remoteAddress) ??
    "unknown"
  );
}

function publicSocketPeerIp(req: Request): string | null {
  const value = resolveWorkspaceParticipantDocumentSocketPeerIp(req);
  return value && value !== "unknown" ? value.slice(0, 128) : null;
}

function publicUserAgent(req: Request): string | null {
  const value = String(req.headers["user-agent"] || "").trim();
  return value ? value.slice(0, 512) : null;
}

/**
 * Statelessly authenticates the 43-character bearer before it can allocate a
 * rate-limit key, parse a request body or reach PostgreSQL. The MAC is bound to
 * the canonical document UUID, so random UUID/token rotation stays O(1).
 */
export function createWorkspaceParticipantDocumentTokenAuthenticityBoundary(
  runtime?: WorkspaceParticipantDocumentRuntime,
): RequestHandler {
  return (req, res, next) => {
    try {
      const token = documentTokenOf(req);
      if (
        !verifyWorkspaceParticipantDocumentToken(
          String(req.params.documentId || ""),
          token,
          runtime,
        )
      ) {
        throw new WorkspaceParticipantDocumentError(
          404,
          "document_not_found",
          "Dokumentlenken er ugyldig.",
        );
      }
      next();
    } catch (error) {
      sendRouteError(res, error, true);
    }
  };
}

/**
 * Secondary credential partition for a known document. This is never the
 * independent security ceiling: callers must mount the per-document limiter
 * first so rotating credentials cannot reset the request budget.
 */
export function createWorkspaceParticipantDocumentCredentialRateLimit(
  limit = 30,
): RequestHandler {
  // The default MemoryStore is intentionally process-local abuse dampening,
  // not a distributed/global quota. Keep this claim explicit if the backend
  // is scaled horizontally; a shared store can be introduced separately.
  return rateLimit({
    windowMs: 15 * 60_000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const credential = documentTokenOf(req);
      const partition = isWorkspaceParticipantDocumentToken(credential)
        ? `credential:${crypto
            .createHash("sha256")
            .update(credential, "utf8")
            .digest("hex")}`
        : "anonymous";
      return crypto
        .createHash("sha256")
        .update(`${rateLimitDocumentIdOf(req)}:${partition}`, "utf8")
        .digest("hex");
    },
    handler: (_req, res) =>
      res.status(429).json({ error: "too_many_requests" }),
  });
}

/**
 * Independent per-document ceiling. The key deliberately excludes client IP,
 * X-Forwarded-For and the bearer credential, so neither spoofed forwarding
 * headers nor rotating syntactically valid tokens can reset this budget.
 */
export function createWorkspaceParticipantDocumentRateLimit(
  limit = 120,
): RequestHandler {
  return rateLimit({
    windowMs: 15 * 60_000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) =>
      crypto
        .createHash("sha256")
        .update(rateLimitDocumentIdOf(req), "utf8")
        .digest("hex"),
    handler: (_req, res) =>
      res.status(429).json({ error: "too_many_requests" }),
  });
}

export async function runWorkspaceParticipantDocumentTransaction<T>(
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

async function authoritativeSession(
  deps: WorkspaceParticipantDocumentRoutesDeps,
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

function errorShape(
  error: unknown,
): { statusCode: number; code: string; message: string } | null {
  if (error instanceof WorkspaceParticipantDocumentError) return error;
  if (!error || typeof error !== "object") return null;
  const candidate = error as {
    statusCode?: unknown;
    code?: unknown;
    message?: unknown;
  };
  return typeof candidate.statusCode === "number" &&
    typeof candidate.code === "string"
    ? {
        statusCode: candidate.statusCode,
        code: candidate.code,
        message: String(candidate.message || candidate.code),
      }
    : null;
}

const PUBLIC_HIDDEN_DOCUMENT_ERRORS = new Set([
  "document_not_found",
  "document_token_revoked",
  "document_token_expired",
]);

function sendRouteError(
  res: Response,
  error: unknown,
  publicRoute = false,
): void {
  const known = errorShape(error);
  if (known) {
    if (publicRoute && PUBLIC_HIDDEN_DOCUMENT_ERRORS.has(known.code)) {
      res.status(404).json({
        error: "document_not_found",
        message: "Dokumentlenken er ugyldig.",
      });
      return;
    }
    res
      .status(known.statusCode)
      .json({ error: known.code, message: known.message });
    return;
  }
  const pgCode = (error as { code?: string })?.code;
  if (pgCode === "23505") {
    res.status(409).json({
      error: "document_conflict",
      message: "Dokumentet ble endret samtidig.",
    });
    return;
  }
  if (pgCode === "23514") {
    res.status(409).json({
      error: "document_lifecycle_conflict",
      message: "Dokumentets statusendring er ikke tillatt.",
    });
    return;
  }
  console.error("[workspace-participant-documents] request failed", {
    publicRoute,
    code: pgCode || "unknown",
  });
  res.status(500).json({
    error: "workspace_participant_documents_unavailable",
    message: "Dokumentet kunne ikke behandles.",
  });
}

function validatedTokenHash(
  req: Request,
  runtime?: WorkspaceParticipantDocumentRuntime,
): string {
  const token = documentTokenOf(req);
  if (
    !verifyWorkspaceParticipantDocumentToken(
      String(req.params.documentId || ""),
      token,
      runtime,
    )
  ) {
    throw new WorkspaceParticipantDocumentError(
      404,
      "document_not_found",
      "Dokumentlenken er ugyldig.",
    );
  }
  return hashWorkspaceParticipantDocumentToken(token);
}

function publicAppUrl(deps: WorkspaceParticipantDocumentRoutesDeps): string {
  return (
    deps.publicAppUrl ||
    process.env.PUBLIC_APP_URL ||
    "https://creatorhubn.com"
  ).replace(/\/+$/, "");
}

async function deliver(
  deps: WorkspaceParticipantDocumentRoutesDeps,
  request: WorkspaceParticipantDocumentDeliveryRequest,
): Promise<WorkspaceParticipantDocumentDeliveryResult> {
  if (!deps.deliveryAdapter) {
    return { sent: false, provider: null, reason: "delivery_not_configured" };
  }
  if (!request.to) {
    return { sent: false, provider: null, reason: "recipient_missing" };
  }
  try {
    const result = await deps.deliveryAdapter(request);
    const safeCode = (value: unknown): string | null => {
      if (typeof value !== "string") return null;
      const normalized = value.trim();
      const credential = request.portalUrl?.split("#token=", 2)[1] ?? "";
      if (credential && normalized.includes(credential)) return null;
      return /^[a-z0-9][a-z0-9_.:-]{0,79}$/i.test(normalized)
        ? normalized
        : null;
    };
    const sent = result?.sent === true;
    return {
      sent,
      provider: safeCode(result?.provider),
      reason: sent ? null : safeCode(result?.reason) ?? "delivery_failed",
    };
  } catch {
    return { sent: false, provider: null, reason: "delivery_failed" };
  }
}

async function appendDeliverySafely(
  operations: WorkspaceParticipantDocumentOperations,
  pool: Pool,
  input: Parameters<typeof appendWorkspaceParticipantDocumentDeliveryEvent>[1],
): Promise<void> {
  try {
    await operations.appendDelivery(pool, input);
  } catch (error) {
    console.warn(
      "[workspace-participant-documents] delivery event unavailable",
      {
        documentId: input.documentId,
        sent: input.sent,
        code: (error as { code?: string })?.code || "unknown",
      },
    );
  }
}

export function setupWorkspaceParticipantDocumentRoutes(
  deps: WorkspaceParticipantDocumentRoutesDeps,
): void {
  const operations: WorkspaceParticipantDocumentOperations = {
    ...DEFAULT_OPERATIONS,
    ...deps.operations,
  };
  const resolveAccess = deps.resolveAccess ?? resolveWorkspaceParticipantAccess;
  const ensureScope = deps.ensureScope ?? ensureWorkspaceProjectScopeBinding;
  const runTransaction =
    deps.runTransaction ??
    ((work) => runWorkspaceParticipantDocumentTransaction(deps.pool, work));
  const authenticatePublicToken =
    createWorkspaceParticipantDocumentTokenAuthenticityBoundary(deps.runtime);
  const viewDocumentLimit = createWorkspaceParticipantDocumentRateLimit(240);
  const viewCredentialLimit =
    createWorkspaceParticipantDocumentCredentialRateLimit(60);
  const mutationDocumentLimit =
    createWorkspaceParticipantDocumentRateLimit(120);
  const mutationCredentialLimit =
    createWorkspaceParticipantDocumentCredentialRateLimit(15);
  const mutationLimitFallback: RequestHandler = (req, res, next) => {
    if (res.locals[PUBLIC_MUTATION_PRELIMITED] === true) {
      next();
      return;
    }
    return authenticatePublicToken(req, res, (authError?: unknown) => {
      if (authError) return next(authError);
      return mutationDocumentLimit(req, res, (error?: unknown) => {
        if (error) return next(error);
        return mutationCredentialLimit(req, res, next);
      });
    });
  };

  deps.app.get(
    "/api/projects/:projectId/participants/:participantId/documents",
    workspaceParticipantDocumentSecurityHeaders,
    async (req, res) => {
      const session = await authoritativeSession(deps, req, res);
      if (!session) return;
      const params = managerParamsSchema.safeParse(req.params);
      if (!params.success) return validationError(res, params);
      try {
        const access = await resolveAccess(
          deps.pool,
          session.userId,
          params.data.projectId,
        );
        if (!access.canView) {
          throw new WorkspaceParticipantDocumentError(
            403,
            "participant_document_view_denied",
            "Du har ikke tilgang til dokumentene.",
          );
        }
        const result = await operations.list(deps.pool, {
          organizationId: access.organizationId,
          projectId: access.projectId,
          participantId: params.data.participantId,
          includeSignerEmail: access.canManage,
        });
        res.json(result);
      } catch (error) {
        sendRouteError(res, error);
      }
    },
  );

  deps.app.post(
    "/api/projects/:projectId/participants/:participantId/documents/issue",
    workspaceParticipantDocumentSecurityHeaders,
    async (req, res) => {
      const session = await authoritativeSession(deps, req, res);
      if (!session) return;
      const auditActorUserId = workspaceParticipantAuditActorUserId(session);
      const impersonationPayload =
        workspaceParticipantImpersonationPayload(session);
      const params = managerParamsSchema.safeParse(req.params);
      const body = issueSchema.safeParse(req.body ?? {});
      if (!params.success) return validationError(res, params);
      if (!body.success) return validationError(res, body);
      try {
        const issued = await runTransaction(async (client) => {
          const access = await resolveAccess(
            client,
            session.userId,
            params.data.projectId,
          );
          if (!access.canConfigureRequirements) {
            throw new WorkspaceParticipantDocumentError(
              403,
              "participant_document_issue_denied",
              "Kun prosjekteier eller Enterprise-admin kan utstede dokumenter.",
            );
          }
          await ensureScope(client, access, auditActorUserId);
          return operations.issue(client, {
            scope: {
              organizationId: access.organizationId,
              projectId: access.projectId,
              participantId: params.data.participantId,
            },
            projectOwnerUserId: access.projectOwnerUserId,
            actorUserId: auditActorUserId,
            auditPayload: impersonationPayload,
            issue: body.data as WorkspaceParticipantDocumentIssueInput,
            runtime: deps.runtime,
          });
        });
        const portalUrl = buildWorkspaceParticipantDocumentPortalUrl(
          publicAppUrl(deps),
          issued.document.id,
          issued.rawToken,
        );
        const delivery = await deliver(deps, {
          kind: "workspace_participant_document_issued",
          to: issued.signerEmail,
          recipientName: issued.signerName,
          projectId: issued.scope.projectId,
          projectTitle: issued.projectTitle,
          documentId: issued.document.id,
          documentType: issued.document.documentType,
          documentTitle: issued.document.title,
          portalUrl,
          actorUserId: auditActorUserId,
        });
        await appendDeliverySafely(operations, deps.pool, {
          ...issued.scope,
          documentId: issued.document.id,
          signerId: issued.document.signer.id,
          ...delivery,
          kind: "workspace_participant_document_issued",
          actorUserId: auditActorUserId,
          auditPayload: impersonationPayload,
        });
        issued.document.delivery = {
          status: delivery.sent ? "sent" : "failed",
          provider: delivery.provider,
          reason: delivery.reason,
          at: new Date().toISOString(),
        };
        const response: WorkspaceParticipantDocumentMutationResponse = {
          document: issued.document,
          delivery,
        };
        res.status(201).json(response);
      } catch (error) {
        sendRouteError(res, error);
      }
    },
  );

  deps.app.post(
    "/api/projects/:projectId/participants/:participantId/documents/:documentId/reissue-link",
    workspaceParticipantDocumentSecurityHeaders,
    async (req, res) => {
      const session = await authoritativeSession(deps, req, res);
      if (!session) return;
      const auditActorUserId = workspaceParticipantAuditActorUserId(session);
      const impersonationPayload =
        workspaceParticipantImpersonationPayload(session);
      const params = managerDocumentParamsSchema.safeParse(req.params);
      const body = emptySchema.safeParse(req.body ?? {});
      if (!params.success) return validationError(res, params);
      if (!body.success) return validationError(res, body);
      try {
        const issued = await runTransaction(async (client) => {
          const access = await resolveAccess(
            client,
            session.userId,
            params.data.projectId,
          );
          if (!access.canConfigureRequirements) {
            throw new WorkspaceParticipantDocumentError(
              403,
              "participant_document_issue_denied",
              "Kun prosjekteier eller Enterprise-admin kan sende nye dokumentlenker.",
            );
          }
          await ensureScope(client, access, auditActorUserId);
          return operations.reissue(client, {
            organizationId: access.organizationId,
            projectId: access.projectId,
            participantId: params.data.participantId,
            documentId: params.data.documentId,
            actorUserId: auditActorUserId,
            auditPayload: impersonationPayload,
            runtime: deps.runtime,
          });
        });
        const portalUrl = buildWorkspaceParticipantDocumentPortalUrl(
          publicAppUrl(deps),
          issued.document.id,
          issued.rawToken,
        );
        const delivery = await deliver(deps, {
          kind: "workspace_participant_document_reissued",
          to: issued.signerEmail,
          recipientName: issued.signerName,
          projectId: issued.scope.projectId,
          projectTitle: issued.projectTitle,
          documentId: issued.document.id,
          documentType: issued.document.documentType,
          documentTitle: issued.document.title,
          portalUrl,
          actorUserId: auditActorUserId,
        });
        await appendDeliverySafely(operations, deps.pool, {
          ...issued.scope,
          documentId: issued.document.id,
          signerId: issued.document.signer.id,
          ...delivery,
          kind: "workspace_participant_document_reissued",
          actorUserId: auditActorUserId,
          auditPayload: impersonationPayload,
        });
        const response: WorkspaceParticipantDocumentMutationResponse = {
          document: issued.document,
          delivery,
        };
        res.json(response);
      } catch (error) {
        sendRouteError(res, error);
      }
    },
  );

  deps.app.get(
    WORKSPACE_PARTICIPANT_DOCUMENT_PUBLIC_PATH,
    workspaceParticipantDocumentSecurityHeaders,
    authenticatePublicToken,
    viewDocumentLimit,
    viewCredentialLimit,
    async (req, res) => {
      const params = publicParamsSchema.safeParse(req.params);
      if (!params.success) return validationError(res, params);
      try {
        const tokenHash = validatedTokenHash(req, deps.runtime);
        const document = await runTransaction((client) =>
          operations.view(client, {
            documentId: params.data.documentId,
            tokenHash,
            ip: publicSocketPeerIp(req),
            runtime: deps.runtime,
          }),
        );
        res.json(document);
      } catch (error) {
        sendRouteError(res, error, true);
      }
    },
  );

  deps.app.post(
    `${WORKSPACE_PARTICIPANT_DOCUMENT_PUBLIC_PATH}/sign`,
    workspaceParticipantDocumentSecurityHeaders,
    mutationLimitFallback,
    async (req, res) => {
      const params = publicParamsSchema.safeParse(req.params);
      const body = signSchema.safeParse(req.body ?? {});
      if (!params.success) return validationError(res, params);
      if (!body.success) return validationError(res, body);
      try {
        const tokenHash = validatedTokenHash(req, deps.runtime);
        const signed = await runTransaction((client) =>
          operations.sign(client, {
            documentId: params.data.documentId,
            tokenHash,
            signerName: body.data.signerName,
            accepted: body.data.accepted,
            signatureMethod: body.data.signatureMethod,
            ip: publicSocketPeerIp(req),
            userAgent: publicUserAgent(req),
            runtime: deps.runtime,
          }),
        );
        let delivery: WorkspaceParticipantDocumentDeliveryResult | undefined;
        if (!signed.already) {
          delivery = await deliver(deps, {
            kind: "workspace_participant_document_signed",
            to: signed.notification.producerEmail,
            recipientName: signed.notification.producerName,
            projectId: signed.notification.projectId,
            projectTitle: signed.notification.projectTitle,
            documentId: signed.document.documentId,
            documentType: signed.document.documentType,
            documentTitle: signed.document.title,
          });
          await appendDeliverySafely(operations, deps.pool, {
            ...signed.scope,
            ...delivery,
            kind: "workspace_participant_document_signed",
          });
        }
        const response: WorkspaceParticipantDocumentPublicMutationResponse = {
          document: signed.document,
          alreadySigned: signed.already,
          ...(delivery ? { delivery } : {}),
        };
        res.json(response);
      } catch (error) {
        sendRouteError(res, error, true);
      }
    },
  );

  deps.app.post(
    `${WORKSPACE_PARTICIPANT_DOCUMENT_PUBLIC_PATH}/withdraw`,
    workspaceParticipantDocumentSecurityHeaders,
    mutationLimitFallback,
    async (req, res) => {
      const params = publicParamsSchema.safeParse(req.params);
      const body = withdrawSchema.safeParse(req.body ?? {});
      if (!params.success) return validationError(res, params);
      if (!body.success) return validationError(res, body);
      try {
        const tokenHash = validatedTokenHash(req, deps.runtime);
        const withdrawn = await runTransaction((client) =>
          operations.withdraw(client, {
            documentId: params.data.documentId,
            tokenHash,
            confirmed: body.data.confirmed,
            reason: body.data.reason ?? null,
            ip: publicSocketPeerIp(req),
            userAgent: publicUserAgent(req),
            runtime: deps.runtime,
          }),
        );
        let delivery: WorkspaceParticipantDocumentDeliveryResult | undefined;
        if (!withdrawn.already) {
          delivery = await deliver(deps, {
            kind: "workspace_participant_consent_withdrawn",
            to: withdrawn.notification.producerEmail,
            recipientName: withdrawn.notification.producerName,
            projectId: withdrawn.notification.projectId,
            projectTitle: withdrawn.notification.projectTitle,
            documentId: withdrawn.document.documentId,
            documentType: withdrawn.document.documentType,
            documentTitle: withdrawn.document.title,
          });
          await appendDeliverySafely(operations, deps.pool, {
            ...withdrawn.scope,
            ...delivery,
            kind: "workspace_participant_consent_withdrawn",
          });
        }
        const response: WorkspaceParticipantDocumentPublicMutationResponse = {
          document: withdrawn.document,
          alreadyWithdrawn: withdrawn.already,
          ...(delivery ? { delivery } : {}),
        };
        res.json(response);
      } catch (error) {
        sendRouteError(res, error, true);
      }
    },
  );
}

export type { WorkspaceParticipantDocumentIssueInput };
