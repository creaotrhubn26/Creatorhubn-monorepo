import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import type { WorkspaceParticipantCompensationSnapshot } from "../../frontend/shared/workspace-participant-documents.ts";
import {
  closeWorkspaceProjectParticipant,
  WorkspaceProjectParticipantClosureError,
} from "./workspace-project-participant-closure-service.js";
import {
  hashWorkspaceParticipantCompensationPublicTerms,
  workspaceParticipantDocumentHashMatches,
} from "./workspace-participant-documents-service.js";
import {
  workspaceParticipantAuditActorUserId,
  workspaceParticipantImpersonationPayload,
} from "./workspace-participant-authoritative-session.js";

export const WORKSPACE_PARTICIPANTS_FEATURE_ID =
  "workspace-project-participants";

type Queryer = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type AuthoritativeSession = {
  userId: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  impersonatedByAdmin?: boolean;
  impersonatorId?: string | null;
  impersonationExpiresAt?: number;
};

export type AuthoritativeSessionResolution =
  | { status: "authenticated"; session: AuthoritativeSession }
  | { status: "unauthenticated" }
  | { status: "unavailable" };

export interface WorkspaceProjectParticipantsRoutesDeps {
  app: Express;
  pool: Pool;
  resolveAuthoritativeSessionFromRequest: (
    req: Request,
  ) => Promise<AuthoritativeSessionResolution>;
}

export type WorkspaceParticipantAccess = {
  projectId: string;
  projectOwnerUserId: string;
  organizationId: string;
  enterprise: true;
  featureId: typeof WORKSPACE_PARTICIPANTS_FEATURE_ID;
  canView: boolean;
  canManage: boolean;
  canConfigureRequirements: boolean;
  scopeBound: boolean;
  role:
    | "project_owner"
    | "enterprise_admin"
    | "participant_manager"
    | "participant_viewer";
};

type FeaturePolicyInput = {
  role: string;
  policyPresent: boolean;
  permissionLevel?: unknown;
  allowedRoles?: unknown;
  adminOnlyFeatures?: unknown;
  disabledFeatures?: unknown;
  customPermissions?: unknown;
};

export type FeaturePolicyDecision = {
  allowed: boolean;
  reason:
    | "all"
    | "admin_only"
    | "custom"
    | "disabled"
    | "policy_missing"
    | "invalid_policy";
};

class RouteError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

const participantTypeSchema = z.enum([
  "extra",
  "model",
  "featured",
  "interviewee",
  "other",
]);
const engagementTypeSchema = z.enum([
  "undecided",
  "employee",
  "contractor",
  "agency",
  "volunteer",
]);
const mutableWorkflowStatusSchema = z.enum([
  "draft",
  "invited",
  "confirmed",
  "completed",
  "cancelled",
]);

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();
const metadataSchema = z
  .record(z.unknown())
  .refine(
    (value) => Buffer.byteLength(JSON.stringify(value), "utf8") <= 32_768,
    "metadata_too_large",
  );

const createParticipantSchema = z
  .object({
    externalReference: optionalText(120),
    displayName: z.string().trim().min(1).max(255),
    email: z.string().trim().email().max(320).nullable().optional(),
    phone: optionalText(50),
    participantType: participantTypeSchema.optional(),
    roleLabel: optionalText(255),
    engagementType: engagementTypeSchema.optional(),
    isMinor: z.boolean().optional(),
    requiresContract: z.boolean().optional(),
    requiresMediaConsent: z.boolean().optional(),
    requiresCompensation: z.boolean().optional(),
    notes: optionalText(5_000),
    metadata: metadataSchema.optional(),
  })
  .strict();

const patchParticipantSchema = z
  .object({
    version: z.number().int().positive(),
    externalReference: optionalText(120),
    displayName: z.string().trim().min(1).max(255).optional(),
    email: z.string().trim().email().max(320).nullable().optional(),
    phone: optionalText(50),
    participantType: participantTypeSchema.optional(),
    roleLabel: optionalText(255),
    engagementType: engagementTypeSchema.optional(),
    workflowStatus: mutableWorkflowStatusSchema.optional(),
    isMinor: z.boolean().optional(),
    requiresContract: z.boolean().optional(),
    requiresMediaConsent: z.boolean().optional(),
    requiresCompensation: z.boolean().optional(),
    notes: optionalText(5_000),
    metadata: metadataSchema.optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).some((key) => key !== "version"),
    "empty_patch",
  );

const archiveParticipantSchema = z
  .object({
    version: z.number().int().positive(),
  })
  .strict();

const bulkParticipantSchema = z
  .object({
    participants: z.array(createParticipantSchema).min(1).max(100),
  })
  .strict();

const routeParamsSchema = z.object({
  projectId: z.string().trim().min(1).max(255),
});

const participantRouteParamsSchema = routeParamsSchema.extend({
  participantId: z.string().uuid(),
});

const listQuerySchema = z
  .object({
    includeArchived: z.enum(["true", "false"]).optional(),
    workflowStatus: z
      .enum([
        "draft",
        "invited",
        "confirmed",
        "completed",
        "cancelled",
        "archived",
      ])
      .optional(),
    participantType: participantTypeSchema.optional(),
    search: z.string().trim().max(100).optional(),
  })
  .strict();

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.toLowerCase())
    : [];
}

function readCustomPolicy(
  value: unknown,
): { mode: unknown; allowedRoles: unknown } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const featureValue = record[WORKSPACE_PARTICIPANTS_FEATURE_ID];
  if (
    !featureValue ||
    typeof featureValue !== "object" ||
    Array.isArray(featureValue)
  )
    return null;
  const feature = featureValue as Record<string, unknown>;
  return {
    mode: feature.permissionLevel ?? feature.permission_level,
    allowedRoles: feature.allowedRoles ?? feature.allowed_roles,
  };
}

function evaluateMode(
  modeValue: unknown,
  role: string,
  allowedRolesValue: unknown,
): FeaturePolicyDecision {
  const mode = String(modeValue ?? "")
    .trim()
    .toLowerCase();
  if (mode === "disabled") return { allowed: false, reason: "disabled" };
  if (mode === "all") return { allowed: true, reason: "all" };
  if (mode === "admin_only") {
    return { allowed: role === "admin", reason: "admin_only" };
  }
  if (mode === "admin_member") {
    return { allowed: role === "admin" || role === "member", reason: "custom" };
  }
  if (mode === "custom") {
    const allowedRoles = stringArray(allowedRolesValue);
    return {
      allowed: allowedRoles.length > 0 && allowedRoles.includes(role),
      reason: "custom",
    };
  }
  return { allowed: false, reason: "invalid_policy" };
}

/**
 * Explicit, fail-closed feature policy. Organization-level disabled/admin-only
 * lists take precedence, followed by a custom policy and then the per-feature
 * row. Missing and unknown policies deny access.
 */
export function evaluateWorkspaceParticipantFeaturePolicy(
  input: FeaturePolicyInput,
): FeaturePolicyDecision {
  const role = String(input.role || "").toLowerCase();
  if (
    stringArray(input.disabledFeatures).includes(
      WORKSPACE_PARTICIPANTS_FEATURE_ID,
    )
  ) {
    return { allowed: false, reason: "disabled" };
  }
  if (
    stringArray(input.adminOnlyFeatures).includes(
      WORKSPACE_PARTICIPANTS_FEATURE_ID,
    )
  ) {
    return { allowed: role === "admin", reason: "admin_only" };
  }
  const custom = readCustomPolicy(input.customPermissions);
  if (custom) return evaluateMode(custom.mode, role, custom.allowedRoles);
  if (!input.policyPresent) return { allowed: false, reason: "policy_missing" };
  return evaluateMode(input.permissionLevel, role, input.allowedRoles);
}

function normalizePermissions(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function roleStrength(role: string): number {
  return role === "admin"
    ? 3
    : role === "member"
      ? 2
      : role === "viewer"
        ? 1
        : 0;
}

export async function resolveWorkspaceParticipantAccess(
  db: Queryer,
  userId: string,
  projectId: string,
): Promise<WorkspaceParticipantAccess> {
  const projectResult = await db.query(
    `SELECT p.id::text AS project_id,
            p.user_id::text AS project_owner_user_id,
            LOWER(owner.email::text) AS project_owner_email,
            scope.organization_id::text AS bound_organization_id,
            scope.project_owner_user_id::text AS bound_owner_user_id
       FROM public.projects p
       LEFT JOIN users owner ON owner.id::text = p.user_id::text
       LEFT JOIN workspace_project_enterprise_scopes scope ON scope.project_id = p.id
      WHERE p.id = $1
      LIMIT 1`,
    [projectId],
  );
  const project = projectResult.rows[0];
  if (!project)
    throw new RouteError(404, "project_not_found", "Prosjektet finnes ikke.");
  if (!project.project_owner_user_id) {
    throw new RouteError(
      403,
      "project_access_denied",
      "Prosjektet mangler en gyldig eier.",
    );
  }
  if (
    project.bound_owner_user_id &&
    project.bound_owner_user_id !== project.project_owner_user_id
  ) {
    throw new RouteError(
      409,
      "project_scope_conflict",
      "Prosjektets Enterprise-binding samsvarer ikke med eieren.",
    );
  }

  const callerResult = await db.query(
    `SELECT LOWER(email::text) AS email FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const callerEmail = callerResult.rows[0]?.email
    ? String(callerResult.rows[0].email)
    : null;
  const memberships = await db.query(
    `SELECT organization_id::text AS organization_id, LOWER(role::text) AS role
       FROM enterprise_team_members
      WHERE status = 'active'
        AND org_kind = 'enterprise'
        AND (user_id = $1 OR ($2::text IS NOT NULL AND LOWER(email) = $2))`,
    [userId, callerEmail],
  );
  if (memberships.rows.length === 0) {
    throw new RouteError(
      403,
      "enterprise_required",
      "Statister og medvirkende krever et aktivt Enterprise-medlemskap.",
    );
  }

  const callerMemberships = new Map<string, string>();
  for (const row of memberships.rows) {
    const organizationId = String(row.organization_id || "");
    const role = String(row.role || "").toLowerCase();
    if (!organizationId) continue;
    const current = callerMemberships.get(organizationId) || "";
    if (roleStrength(role) > roleStrength(current))
      callerMemberships.set(organizationId, role);
  }

  let organizationId: string;
  if (project.bound_organization_id) {
    organizationId = String(project.bound_organization_id);
    if (!callerMemberships.has(organizationId)) {
      throw new RouteError(
        403,
        "project_access_denied",
        "Prosjektet tilhører en annen Enterprise-organisasjon.",
      );
    }
  } else {
    const ownerMemberships = await db.query(
      `SELECT DISTINCT organization_id::text AS organization_id
         FROM enterprise_team_members
        WHERE status = 'active'
          AND org_kind = 'enterprise'
          AND (
            user_id = $1
            OR ($2::text IS NOT NULL AND LOWER(email) = $2)
          )`,
      [project.project_owner_user_id, project.project_owner_email || null],
    );
    const intersections = [
      ...new Set(
        ownerMemberships.rows
          .map((row) => String(row.organization_id || ""))
          .filter((value) => value && callerMemberships.has(value)),
      ),
    ];
    if (intersections.length === 0) {
      throw new RouteError(
        403,
        "project_access_denied",
        "Prosjektet er ikke knyttet til ditt Enterprise-medlemskap.",
      );
    }
    if (intersections.length !== 1) {
      throw new RouteError(
        409,
        "ambiguous_enterprise_scope",
        "Prosjektets Enterprise-organisasjon er tvetydig.",
      );
    }
    organizationId = intersections[0];
  }

  const organizationRole = callerMemberships.get(organizationId) || "";
  const policyResult = await db.query(
    `SELECT permission.id IS NOT NULL AS policy_present,
            permission.permission_level,
            permission.allowed_roles,
            settings.admin_only_features,
            settings.disabled_features,
            settings.custom_permissions
       FROM (SELECT 1) seed
       LEFT JOIN enterprise_feature_permissions permission
         ON permission.organization_id = $1
        AND permission.feature_id = $2
       LEFT JOIN enterprise_organization_settings settings
         ON settings.organization_id = $1`,
    [organizationId, WORKSPACE_PARTICIPANTS_FEATURE_ID],
  );
  const policy = policyResult.rows[0] || {};
  const decision = evaluateWorkspaceParticipantFeaturePolicy({
    role: organizationRole,
    policyPresent: policy.policy_present === true,
    permissionLevel: policy.permission_level,
    allowedRoles: policy.allowed_roles,
    adminOnlyFeatures: policy.admin_only_features,
    disabledFeatures: policy.disabled_features,
    customPermissions: policy.custom_permissions,
  });
  if (!decision.allowed) {
    throw new RouteError(
      403,
      "enterprise_feature_denied",
      "Organisasjonens feature-policy gir ikke tilgang.",
      {
        featureId: WORKSPACE_PARTICIPANTS_FEATURE_ID,
        reason: decision.reason,
      },
    );
  }

  const isProjectOwner = project.project_owner_user_id === userId;
  const isEnterpriseAdmin = organizationRole === "admin";
  let memberPermissions: Record<string, unknown> = {};
  if (!isProjectOwner && !isEnterpriseAdmin) {
    try {
      const memberResult = await db.query(
        `SELECT permissions
           FROM project_team_members
          WHERE project_id = $1
            AND user_id = $2
            AND status = 'active'
            AND deactivated_at IS NULL
          LIMIT 1`,
        [projectId, userId],
      );
      memberPermissions = normalizePermissions(
        memberResult.rows[0]?.permissions,
      );
    } catch (error) {
      if ((error as { code?: string })?.code !== "42P01") {
        throw new RouteError(
          503,
          "participant_authorization_unavailable",
          "Prosjekttilgang kunne ikke verifiseres.",
        );
      }
    }
  }

  const scopeBound = Boolean(project.bound_organization_id);
  const hasManageRole =
    isProjectOwner ||
    isEnterpriseAdmin ||
    memberPermissions.canManageParticipants === true;
  const canManage = hasManageRole && (scopeBound || isProjectOwner);
  const canView = hasManageRole || memberPermissions.canRead === true;
  const canConfigureRequirements =
    (isProjectOwner || isEnterpriseAdmin) && (scopeBound || isProjectOwner);
  if (!canView) {
    throw new RouteError(
      403,
      "project_access_denied",
      "Du har ikke tilgang til dette prosjektet.",
    );
  }

  return {
    projectId,
    projectOwnerUserId: String(project.project_owner_user_id),
    organizationId,
    enterprise: true,
    featureId: WORKSPACE_PARTICIPANTS_FEATURE_ID,
    canView,
    canManage,
    canConfigureRequirements,
    scopeBound,
    role: isProjectOwner
      ? "project_owner"
      : isEnterpriseAdmin
        ? "enterprise_admin"
        : canManage
          ? "participant_manager"
          : "participant_viewer",
  };
}

export async function ensureWorkspaceProjectScopeBinding(
  db: Queryer,
  access: WorkspaceParticipantAccess,
  actorUserId: string,
): Promise<void> {
  if (!access.scopeBound && access.role !== "project_owner") {
    throw new RouteError(
      403,
      "project_scope_owner_required",
      "Kun prosjekteieren kan etablere den første Enterprise-bindingen.",
    );
  }
  await db.query(
    `INSERT INTO workspace_project_enterprise_scopes
       (project_id, project_owner_user_id, organization_id, bound_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (project_id) DO NOTHING`,
    [
      access.projectId,
      access.projectOwnerUserId,
      access.organizationId,
      actorUserId,
    ],
  );
  const bound = await db.query(
    `SELECT organization_id::text AS organization_id,
            project_owner_user_id::text AS project_owner_user_id
       FROM workspace_project_enterprise_scopes
      WHERE project_id = $1
      LIMIT 1`,
    [access.projectId],
  );
  const row = bound.rows[0];
  if (
    !row ||
    row.organization_id !== access.organizationId ||
    row.project_owner_user_id !== access.projectOwnerUserId
  ) {
    throw new RouteError(
      409,
      "project_scope_conflict",
      "Prosjektet er allerede bundet til en annen Enterprise-organisasjon.",
    );
  }
}

function assertManage(access: WorkspaceParticipantAccess): void {
  if (!access.canManage) {
    throw new RouteError(
      403,
      "participant_manage_denied",
      "Du kan se, men ikke administrere medvirkende.",
    );
  }
}

function assertParticipantClosureAuthority(
  access: WorkspaceParticipantAccess,
): void {
  if (!access.canConfigureRequirements) {
    throw new RouteError(
      403,
      "participant_closure_denied",
      "Kun prosjekteier eller Enterprise-admin kan avslutte medvirkende med juridiske eller økonomiske koblinger.",
    );
  }
}

function iso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

const READINESS_HASH_PATTERN = /^[0-9a-f]{64}$/;
const READINESS_HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/i;

function readinessRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readinessNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readinessJsonNumberMatches(
  value: Record<string, unknown>,
  field: string,
  expected: number | null,
): boolean {
  const actual = value[field];
  if (expected === null) return actual === null || actual === undefined;
  return readinessNumber(actual) === expected;
}

function activeCompensationSnapshot(
  row: any,
): WorkspaceParticipantCompensationSnapshot | null {
  if (row.compensation_active !== true) return null;
  const id = String(row.active_compensation_id || "");
  const version = Number(row.active_compensation_version);
  const type = String(row.active_compensation_type || "");
  const currency = String(row.active_compensation_currency || "");
  const terms = readinessRecord(row.active_compensation_terms_snapshot);
  if (
    !id ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    !["hourly", "fixed", "unpaid"].includes(type) ||
    !/^[A-Z]{3}$/.test(currency) ||
    terms.source !== "workspace-participant-compensation" ||
    terms.workspaceProjectId !== String(row.project_id) ||
    terms.workspaceParticipantId !== String(row.id) ||
    terms.workspaceCompensationId !== id ||
    Number(terms.compensationVersion) !== version ||
    terms.compensationType !== type ||
    terms.currency !== currency
  ) {
    return null;
  }

  const hourlyRate = readinessNumber(row.active_compensation_hourly_rate);
  const estimatedHours = readinessNumber(
    row.active_compensation_estimated_hours,
  );
  const fixedAmount = readinessNumber(row.active_compensation_fixed_amount);
  let estimatedAmount: number | null = null;
  if (type === "hourly") {
    if (
      hourlyRate === null ||
      hourlyRate <= 0 ||
      estimatedHours === null ||
      estimatedHours <= 0 ||
      fixedAmount !== null
    ) {
      return null;
    }
    estimatedAmount =
      Math.round((hourlyRate * estimatedHours + Number.EPSILON) * 100) / 100;
  } else if (type === "fixed") {
    if (
      fixedAmount === null ||
      fixedAmount <= 0 ||
      hourlyRate !== null ||
      estimatedHours !== null
    ) {
      return null;
    }
    estimatedAmount = fixedAmount;
  } else if (
    hourlyRate !== null ||
    estimatedHours !== null ||
    fixedAmount !== null
  ) {
    return null;
  }

  const rawNote = terms.note;
  const note =
    rawNote === null || rawNote === undefined || rawNote === ""
      ? null
      : typeof rawNote === "string"
        ? rawNote.normalize("NFC").trim()
        : null;
  if (
    (rawNote !== null &&
      rawNote !== undefined &&
      rawNote !== "" &&
      (note === null ||
        note !== rawNote ||
        READINESS_HTML_TAG_PATTERN.test(note))) ||
    !readinessJsonNumberMatches(terms, "hourlyRate", hourlyRate) ||
    !readinessJsonNumberMatches(terms, "estimatedHours", estimatedHours) ||
    !readinessJsonNumberMatches(terms, "fixedAmount", fixedAmount) ||
    !readinessJsonNumberMatches(terms, "estimatedAmount", estimatedAmount)
  ) {
    return null;
  }

  const publicTerms: Omit<
    WorkspaceParticipantCompensationSnapshot,
    "publicTermsHash"
  > = {
    id,
    version,
    type: type as WorkspaceParticipantCompensationSnapshot["type"],
    hourlyRate,
    estimatedHours,
    fixedAmount,
    estimatedAmount,
    currency,
    note,
  };
  return {
    ...publicTerms,
    publicTermsHash:
      hashWorkspaceParticipantCompensationPublicTerms(publicTerms),
  };
}

function isNullableJsonNumber(value: unknown): boolean {
  return (
    value === null || (typeof value === "number" && Number.isFinite(value))
  );
}

function signedContractMatchesActiveCompensation(
  row: any,
  active: WorkspaceParticipantCompensationSnapshot,
): boolean {
  const documentSnapshot = readinessRecord(
    row.signed_contract_terms_snapshot ?? row.contract_terms_snapshot,
  );
  if (
    !workspaceParticipantDocumentHashMatches(
      documentSnapshot,
      String(
        row.signed_contract_content_hash ?? row.contract_content_hash ?? "",
      ),
    )
  ) {
    return false;
  }
  const embedded = readinessRecord(documentSnapshot.compensation);
  const expectedKeys = [
    "currency",
    "estimatedAmount",
    "estimatedHours",
    "fixedAmount",
    "hourlyRate",
    "id",
    "note",
    "publicTermsHash",
    "type",
    "version",
  ];
  if (
    Object.keys(embedded).sort().join("|") !== expectedKeys.join("|") ||
    typeof embedded.id !== "string" ||
    !Number.isSafeInteger(embedded.version) ||
    !["hourly", "fixed", "unpaid"].includes(String(embedded.type)) ||
    !/^[A-Z]{3}$/.test(String(embedded.currency || "")) ||
    !READINESS_HASH_PATTERN.test(String(embedded.publicTermsHash || "")) ||
    !isNullableJsonNumber(embedded.hourlyRate) ||
    !isNullableJsonNumber(embedded.estimatedHours) ||
    !isNullableJsonNumber(embedded.fixedAmount) ||
    !isNullableJsonNumber(embedded.estimatedAmount) ||
    !(embedded.note === null || typeof embedded.note === "string")
  ) {
    return false;
  }
  const { publicTermsHash, ...publicTerms } = embedded;
  if (
    hashWorkspaceParticipantCompensationPublicTerms(
      publicTerms as unknown as Omit<
        WorkspaceParticipantCompensationSnapshot,
        "publicTermsHash"
      >,
    ) !== publicTermsHash
  ) {
    return false;
  }
  return (
    embedded.id === active.id &&
    embedded.version === active.version &&
    publicTermsHash === active.publicTermsHash
  );
}

function mapParticipant(row: any, canManage: boolean) {
  const workflowStatus = String(row.workflow_status || "draft");
  const blockers: string[] = [];
  if (workflowStatus === "archived") blockers.push("participant_archived");
  else if (workflowStatus === "cancelled")
    blockers.push("participant_cancelled");
  else if (!["confirmed", "completed"].includes(workflowStatus))
    blockers.push("participant_not_confirmed");
  const requiresCompensation = row.requires_compensation === true;
  const contractSigned = row.contract_status === "signed";
  const hasSignedContractEvidence =
    contractSigned || row.contract_signed_evidence === true;
  const activeCompensation = requiresCompensation
    ? activeCompensationSnapshot(row)
    : null;
  const signedContractHasCurrentCompensation =
    activeCompensation !== null &&
    hasSignedContractEvidence &&
    signedContractMatchesActiveCompensation(row, activeCompensation);
  if (
    row.requires_contract === true &&
    !requiresCompensation &&
    !contractSigned
  )
    blockers.push("contract_required");
  if (requiresCompensation) {
    if (activeCompensation === null) blockers.push("compensation_required");
    if (contractSigned) {
      if (
        activeCompensation !== null &&
        !signedContractHasCurrentCompensation
      ) {
        blockers.push("contract_compensation_stale");
      }
    } else if (
      activeCompensation !== null &&
      hasSignedContractEvidence &&
      !signedContractHasCurrentCompensation
    ) {
      blockers.push("contract_compensation_stale");
    } else {
      blockers.push("contract_required");
    }
  }
  if (
    row.requires_media_consent === true &&
    row.media_consent_status !== "signed"
  )
    blockers.push("media_consent_required");
  if (
    row.is_minor === true &&
    !["approved", "not_required"].includes(String(row.guardian_status))
  ) {
    blockers.push("guardian_approval_required");
  }
  if (
    row.is_minor === true &&
    !["approved", "not_required"].includes(String(row.work_permit_status))
  ) {
    blockers.push("work_permit_required");
  }
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    organizationId: String(row.organization_id),
    externalReference: row.external_reference ?? null,
    displayName: String(row.display_name),
    email: canManage ? (row.email ?? null) : null,
    phone: canManage ? (row.phone ?? null) : null,
    participantType: row.participant_type,
    roleLabel: row.role_label ?? null,
    engagementType: row.engagement_type,
    workflowStatus,
    isMinor: row.is_minor === true,
    guardianStatus: row.guardian_status,
    workPermitStatus: row.work_permit_status,
    requiresContract: row.requires_contract === true,
    requiresMediaConsent: row.requires_media_consent === true,
    requiresCompensation: row.requires_compensation === true,
    notes: canManage ? (row.notes ?? null) : null,
    metadata: canManage ? (row.metadata ?? {}) : {},
    readiness: { ready: blockers.length === 0, blockers },
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    archivedAt: iso(row.archived_at),
    version: Number(row.version),
  };
}

const PARTICIPANT_READINESS_SELECT = `
  SELECT participant.*,
         COALESCE(latest_contract.status, '') AS contract_status,
         latest_contract.terms_snapshot AS contract_terms_snapshot,
         latest_contract.content_hash::text AS contract_content_hash,
         (latest_signed_contract.id IS NOT NULL) AS contract_signed_evidence,
         latest_signed_contract.terms_snapshot AS signed_contract_terms_snapshot,
         latest_signed_contract.content_hash::text AS signed_contract_content_hash,
         COALESCE(latest_media_consent.status, '') AS media_consent_status,
         (active_compensation.id IS NOT NULL) AS compensation_active,
         active_compensation.id AS active_compensation_id,
         active_compensation.version AS active_compensation_version,
         active_compensation.compensation_type AS active_compensation_type,
         active_compensation.hourly_rate AS active_compensation_hourly_rate,
         active_compensation.estimated_hours AS active_compensation_estimated_hours,
         active_compensation.fixed_amount AS active_compensation_fixed_amount,
         active_compensation.currency AS active_compensation_currency,
         active_compensation.terms_snapshot AS active_compensation_terms_snapshot
    FROM workspace_project_participants participant
    LEFT JOIN LATERAL (
           SELECT document.status, document.terms_snapshot, document.content_hash
             FROM workspace_participant_documents document
            WHERE document.organization_id = participant.organization_id
              AND document.project_id = participant.project_id
              AND document.participant_id = participant.id
              AND document.document_type = 'contract'
              AND document.status <> 'draft'
            ORDER BY document.version DESC, document.created_at DESC, document.id DESC
            LIMIT 1
         ) latest_contract ON TRUE
    LEFT JOIN LATERAL (
           SELECT document.id::text AS id,
                  document.terms_snapshot,
                  document.content_hash
             FROM workspace_participant_documents document
            WHERE document.organization_id = participant.organization_id
              AND document.project_id = participant.project_id
              AND document.participant_id = participant.id
              AND document.document_type = 'contract'
              AND document.signed_at IS NOT NULL
            ORDER BY document.signed_at DESC,
                     document.version DESC,
                     document.created_at DESC,
                     document.id DESC
            LIMIT 1
         ) latest_signed_contract ON TRUE
    LEFT JOIN LATERAL (
           SELECT document.status
             FROM workspace_participant_documents document
            WHERE document.organization_id = participant.organization_id
              AND document.project_id = participant.project_id
              AND document.participant_id = participant.id
              AND document.document_type = 'media_consent'
              AND document.status <> 'draft'
            ORDER BY document.version DESC, document.created_at DESC, document.id DESC
            LIMIT 1
         ) latest_media_consent ON TRUE
    LEFT JOIN LATERAL (
           SELECT compensation.id::text AS id,
                  compensation.version,
                  compensation.compensation_type,
                  compensation.hourly_rate,
                  compensation.estimated_hours,
                  compensation.fixed_amount,
                  compensation.currency,
                  compensation.terms_snapshot
             FROM workspace_participant_compensation_links compensation
            WHERE compensation.organization_id = participant.organization_id
              AND compensation.project_id = participant.project_id
              AND compensation.participant_id = participant.id
              AND compensation.status = 'active'
            LIMIT 1
         ) active_compensation ON TRUE`;

async function loadParticipant(
  db: Queryer,
  organizationId: string,
  projectId: string,
  participantId: string,
): Promise<any | null> {
  const result = await db.query(
    `${PARTICIPANT_READINESS_SELECT}
      WHERE participant.organization_id = $1
        AND participant.project_id = $2
        AND participant.id = $3`,
    [organizationId, projectId, participantId],
  );
  return result.rows[0] ?? null;
}

function normalizedCreate(input: z.infer<typeof createParticipantSchema>) {
  const isMinor = input.isMinor === true;
  return {
    externalReference: input.externalReference || null,
    displayName: input.displayName,
    email: input.email ? input.email.toLowerCase() : null,
    phone: input.phone || null,
    participantType: input.participantType ?? "extra",
    roleLabel: input.roleLabel || null,
    engagementType: input.engagementType ?? "undecided",
    workflowStatus: "draft",
    isMinor,
    guardianStatus: isMinor ? "required" : "not_required",
    workPermitStatus: isMinor ? "required" : "not_required",
    requiresContract: input.requiresContract ?? true,
    requiresMediaConsent: input.requiresMediaConsent ?? true,
    requiresCompensation: input.requiresCompensation ?? true,
    notes: input.notes || null,
    metadata: input.metadata ?? {},
  };
}

async function insertParticipant(
  db: Queryer,
  access: WorkspaceParticipantAccess,
  userId: string,
  rawInput: z.infer<typeof createParticipantSchema>,
  idempotent: boolean,
  auditPayload: Record<string, unknown> = {},
): Promise<{ participant: any; created: boolean }> {
  const input = normalizedCreate(rawInput);
  if (
    !access.canConfigureRequirements &&
    (input.requiresContract === false ||
      input.requiresMediaConsent === false ||
      input.requiresCompensation === false)
  ) {
    throw new RouteError(
      403,
      "requirements_manage_denied",
      "Kun prosjekteier eller Enterprise-admin kan fravike standardkrav.",
    );
  }
  const params = [
    access.organizationId,
    access.projectId,
    input.externalReference,
    input.displayName,
    input.email,
    input.phone,
    input.participantType,
    input.roleLabel,
    input.engagementType,
    input.workflowStatus,
    input.isMinor,
    input.guardianStatus,
    input.workPermitStatus,
    input.requiresContract,
    input.requiresMediaConsent,
    input.requiresCompensation,
    input.notes,
    JSON.stringify(input.metadata),
    userId,
  ];
  const conflictClause =
    idempotent && input.externalReference
      ? `ON CONFLICT (organization_id, project_id, external_reference)
       WHERE external_reference IS NOT NULL DO NOTHING`
      : "";
  const inserted = await db.query(
    `INSERT INTO workspace_project_participants
       (organization_id, project_id, external_reference, display_name, email, phone,
        participant_type, role_label, engagement_type, workflow_status, is_minor,
        guardian_status, work_permit_status, requires_contract, requires_media_consent,
        requires_compensation, notes, metadata, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$19)
     ${conflictClause}
     RETURNING id`,
    params,
  );
  let participantId = inserted.rows[0]?.id ? String(inserted.rows[0].id) : null;
  const created = Boolean(participantId);
  if (!participantId && input.externalReference) {
    const existing = await db.query(
      `SELECT id FROM workspace_project_participants
        WHERE organization_id = $1 AND project_id = $2 AND external_reference = $3
        LIMIT 1`,
      [access.organizationId, access.projectId, input.externalReference],
    );
    participantId = existing.rows[0]?.id ? String(existing.rows[0].id) : null;
  }
  if (!participantId)
    throw new RouteError(
      409,
      "duplicate_participant",
      "Medvirkende finnes allerede.",
    );
  if (created) {
    await db.query(
      `INSERT INTO workspace_participant_events
         (organization_id, project_id, participant_id, event_type, actor_type, actor_user_id, payload)
       VALUES ($1,$2,$3,'participant_created','user',$4,$5::jsonb)`,
      [
        access.organizationId,
        access.projectId,
        participantId,
        userId,
        JSON.stringify({ source: "workspace", ...auditPayload }),
      ],
    );
  }
  const participant = await loadParticipant(
    db,
    access.organizationId,
    access.projectId,
    participantId,
  );
  if (!participant)
    throw new RouteError(
      500,
      "participant_persistence_failed",
      "Medvirkende kunne ikke leses etter lagring.",
    );
  return { participant, created };
}

const workflowTransitions: Record<string, ReadonlySet<string>> = {
  draft: new Set(["draft", "invited", "confirmed", "cancelled"]),
  invited: new Set(["invited", "confirmed", "cancelled"]),
  confirmed: new Set(["confirmed", "completed", "cancelled"]),
  completed: new Set(["completed"]),
  cancelled: new Set(["cancelled"]),
};

async function authoritativeSession(
  deps: WorkspaceProjectParticipantsRoutesDeps,
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

function sendError(res: Response, error: unknown): void {
  if (
    error instanceof RouteError ||
    error instanceof WorkspaceProjectParticipantClosureError
  ) {
    res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    });
    return;
  }
  const pgCode = (error as { code?: string })?.code;
  if (pgCode === "23505") {
    res.status(409).json({
      error: "duplicate_participant",
      message: "En medvirkende med samme eksterne referanse finnes allerede.",
    });
    return;
  }
  console.error("[workspace-project-participants] request failed", {
    code: pgCode || "unknown",
  });
  res.status(500).json({
    error: "workspace_participants_unavailable",
    message: "Medvirkende kunne ikke behandles.",
  });
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

function preventSensitiveCaching(res: Response): void {
  res.setHeader("Cache-Control", "no-store, private");
}

export function setupWorkspaceProjectParticipantsRoutes(
  deps: WorkspaceProjectParticipantsRoutesDeps,
): void {
  const { app, pool } = deps;

  app.get("/api/projects/:projectId/participants/access", async (req, res) => {
    preventSensitiveCaching(res);
    const session = await authoritativeSession(deps, req, res);
    if (!session) return;
    const params = routeParamsSchema.safeParse(req.params);
    if (!params.success) return validationError(res, params);
    try {
      const access = await resolveWorkspaceParticipantAccess(
        pool,
        session.userId,
        params.data.projectId,
      );
      res.json({ access });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/projects/:projectId/participants", async (req, res) => {
    preventSensitiveCaching(res);
    const session = await authoritativeSession(deps, req, res);
    if (!session) return;
    const params = routeParamsSchema.safeParse(req.params);
    const query = listQuerySchema.safeParse(req.query ?? {});
    if (!params.success) return validationError(res, params);
    if (!query.success) return validationError(res, query);
    try {
      const access = await resolveWorkspaceParticipantAccess(
        pool,
        session.userId,
        params.data.projectId,
      );
      const values: unknown[] = [access.organizationId, access.projectId];
      const conditions = [
        "participant.organization_id = $1",
        "participant.project_id = $2",
      ];
      if (query.data.includeArchived !== "true")
        conditions.push("participant.archived_at IS NULL");
      if (query.data.workflowStatus) {
        values.push(query.data.workflowStatus);
        conditions.push(`participant.workflow_status = $${values.length}`);
      }
      if (query.data.participantType) {
        values.push(query.data.participantType);
        conditions.push(`participant.participant_type = $${values.length}`);
      }
      if (query.data.search) {
        values.push(`%${query.data.search}%`);
        const searchableColumns = [
          "participant.display_name",
          "participant.role_label",
        ];
        if (access.canManage) searchableColumns.push("participant.email");
        conditions.push(
          `(${searchableColumns.map((column) => `${column} ILIKE $${values.length}`).join(" OR ")})`,
        );
      }
      const result = await pool.query(
        `${PARTICIPANT_READINESS_SELECT}
          WHERE ${conditions.join(" AND ")}
          ORDER BY participant.created_at DESC, participant.id DESC`,
        values,
      );
      const participants = result.rows.map((row) =>
        mapParticipant(row, access.canManage),
      );
      res.json({
        participants,
        summary: {
          total: participants.length,
          ready: participants.filter(
            (participant) => participant.readiness.ready,
          ).length,
          blocked: participants.filter(
            (participant) => !participant.readiness.ready,
          ).length,
          archived: participants.filter(
            (participant) => participant.workflowStatus === "archived",
          ).length,
        },
        access,
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/projects/:projectId/participants", async (req, res) => {
    preventSensitiveCaching(res);
    const session = await authoritativeSession(deps, req, res);
    if (!session) return;
    const auditActorUserId = workspaceParticipantAuditActorUserId(session);
    const impersonationPayload =
      workspaceParticipantImpersonationPayload(session);
    const params = routeParamsSchema.safeParse(req.params);
    const body = createParticipantSchema.safeParse(req.body ?? {});
    if (!params.success) return validationError(res, params);
    if (!body.success) return validationError(res, body);
    try {
      const result = await transaction(pool, async (client) => {
        const access = await resolveWorkspaceParticipantAccess(
          client,
          session.userId,
          params.data.projectId,
        );
        assertManage(access);
        await ensureWorkspaceProjectScopeBinding(
          client,
          access,
          auditActorUserId,
        );
        const inserted = await insertParticipant(
          client,
          access,
          auditActorUserId,
          body.data,
          false,
          impersonationPayload,
        );
        return {
          access,
          participant: mapParticipant(inserted.participant, true),
        };
      });
      res.status(201).json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  // Retries are idempotent only for rows carrying a stable externalReference;
  // rows without one intentionally create distinct people on every request.
  app.post("/api/projects/:projectId/participants/bulk", async (req, res) => {
    preventSensitiveCaching(res);
    const session = await authoritativeSession(deps, req, res);
    if (!session) return;
    const auditActorUserId = workspaceParticipantAuditActorUserId(session);
    const impersonationPayload =
      workspaceParticipantImpersonationPayload(session);
    const params = routeParamsSchema.safeParse(req.params);
    const body = bulkParticipantSchema.safeParse(req.body ?? {});
    if (!params.success) return validationError(res, params);
    if (!body.success) return validationError(res, body);
    try {
      const result = await transaction(pool, async (client) => {
        const access = await resolveWorkspaceParticipantAccess(
          client,
          session.userId,
          params.data.projectId,
        );
        assertManage(access);
        await ensureWorkspaceProjectScopeBinding(
          client,
          access,
          auditActorUserId,
        );
        const participants: ReturnType<typeof mapParticipant>[] = [];
        let createdCount = 0;
        for (const input of body.data.participants) {
          const inserted = await insertParticipant(
            client,
            access,
            auditActorUserId,
            input,
            true,
            impersonationPayload,
          );
          if (inserted.created) createdCount += 1;
          participants.push(mapParticipant(inserted.participant, true));
        }
        return {
          participants,
          createdCount,
          existingCount: participants.length - createdCount,
          access,
        };
      });
      res.status(result.createdCount > 0 ? 201 : 200).json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.patch(
    "/api/projects/:projectId/participants/:participantId",
    async (req, res) => {
      preventSensitiveCaching(res);
      const session = await authoritativeSession(deps, req, res);
      if (!session) return;
      const auditActorUserId = workspaceParticipantAuditActorUserId(session);
      const impersonationPayload =
        workspaceParticipantImpersonationPayload(session);
      const params = participantRouteParamsSchema.safeParse(req.params);
      const body = patchParticipantSchema.safeParse(req.body ?? {});
      if (!params.success) return validationError(res, params);
      if (!body.success) return validationError(res, body);
      try {
        const result = await transaction(pool, async (client) => {
          const access = await resolveWorkspaceParticipantAccess(
            client,
            session.userId,
            params.data.projectId,
          );
          assertManage(access);
          if (body.data.workflowStatus === "cancelled") {
            assertParticipantClosureAuthority(access);
          }
          await ensureWorkspaceProjectScopeBinding(
            client,
            access,
            auditActorUserId,
          );
          if (body.data.workflowStatus === "cancelled") {
            const hasAdditionalChanges = Object.keys(body.data).some(
              (key) => key !== "version" && key !== "workflowStatus",
            );
            if (hasAdditionalChanges) {
              throw new RouteError(
                400,
                "terminal_transition_requires_dedicated_request",
                "Avbryt medvirkende i en egen forespørsel.",
              );
            }
            await closeWorkspaceProjectParticipant({
              db: client,
              organizationId: access.organizationId,
              projectId: access.projectId,
              projectOwnerUserId: access.projectOwnerUserId,
              participantId: params.data.participantId,
              expectedVersion: body.data.version,
              actorUserId: auditActorUserId,
              auditPayload: impersonationPayload,
              terminalStatus: "cancelled",
            });
            const participant = await loadParticipant(
              client,
              access.organizationId,
              access.projectId,
              params.data.participantId,
            );
            if (!participant) {
              throw new RouteError(
                500,
                "participant_persistence_failed",
                "Medvirkende kunne ikke leses etter lagring.",
              );
            }
            return { participant: mapParticipant(participant, true), access };
          }
          const currentResult = await client.query(
            `SELECT * FROM workspace_project_participants
            WHERE organization_id = $1 AND project_id = $2 AND id = $3
            FOR UPDATE`,
            [
              access.organizationId,
              access.projectId,
              params.data.participantId,
            ],
          );
          const current = currentResult.rows[0];
          if (!current || current.archived_at)
            throw new RouteError(
              404,
              "participant_not_found",
              "Medvirkende finnes ikke.",
            );
          if (Number(current.version) !== body.data.version) {
            throw new RouteError(
              409,
              "version_conflict",
              "Medvirkende er endret av noen andre.",
              { currentVersion: Number(current.version) },
            );
          }
          if (
            body.data.workflowStatus &&
            !workflowTransitions[String(current.workflow_status)]?.has(
              body.data.workflowStatus,
            )
          ) {
            throw new RouteError(
              409,
              "workflow_transition_invalid",
              "Statusendringen er ikke tillatt.",
            );
          }
          const changesMinorStatus =
            body.data.isMinor !== undefined &&
            body.data.isMinor !== current.is_minor;
          const requirementFields = [
            "requiresContract",
            "requiresMediaConsent",
            "requiresCompensation",
          ] as const;
          const requirementColumns = {
            requiresContract: "requires_contract",
            requiresMediaConsent: "requires_media_consent",
            requiresCompensation: "requires_compensation",
          } as const;
          const changesRequirements = requirementFields.some(
            (field) =>
              Object.prototype.hasOwnProperty.call(body.data, field) &&
              body.data[field] !== current[requirementColumns[field]],
          );
          if (changesRequirements && !access.canConfigureRequirements) {
            throw new RouteError(
              403,
              "requirements_manage_denied",
              "Kun prosjekteier eller Enterprise-admin kan endre juridiske krav.",
            );
          }
          if (changesMinorStatus || changesRequirements) {
            const legal = await client.query(
              `SELECT EXISTS (
               SELECT 1 FROM workspace_participant_documents
                WHERE organization_id = $1 AND project_id = $2 AND participant_id = $3
             ) AS has_documents,
             EXISTS (
               SELECT 1 FROM workspace_participant_compensation_links
                WHERE organization_id = $1 AND project_id = $2 AND participant_id = $3
             ) AS has_compensation`,
              [
                access.organizationId,
                access.projectId,
                params.data.participantId,
              ],
            );
            if (
              current.workflow_status !== "draft" ||
              legal.rows[0]?.has_documents === true ||
              legal.rows[0]?.has_compensation === true
            ) {
              throw new RouteError(
                409,
                "legal_configuration_locked",
                "Juridiske krav og mindreårig-status er låst etter at avtaleprosessen har startet.",
              );
            }
          }

          const fieldMap: Record<string, string> = {
            externalReference: "external_reference",
            displayName: "display_name",
            email: "email",
            phone: "phone",
            participantType: "participant_type",
            roleLabel: "role_label",
            engagementType: "engagement_type",
            workflowStatus: "workflow_status",
            isMinor: "is_minor",
            requiresContract: "requires_contract",
            requiresMediaConsent: "requires_media_consent",
            requiresCompensation: "requires_compensation",
            notes: "notes",
            metadata: "metadata",
          };
          const sets: string[] = [];
          const values: unknown[] = [
            access.organizationId,
            access.projectId,
            params.data.participantId,
            body.data.version,
          ];
          const changedFields: string[] = [];
          for (const [apiField, column] of Object.entries(fieldMap)) {
            if (!Object.prototype.hasOwnProperty.call(body.data, apiField))
              continue;
            let value = (body.data as unknown as Record<string, unknown>)[
              apiField
            ];
            if (apiField === "email" && typeof value === "string")
              value = value.toLowerCase();
            if (apiField === "metadata") value = JSON.stringify(value);
            values.push(value === "" ? null : value);
            sets.push(
              `${column} = $${values.length}${apiField === "metadata" ? "::jsonb" : ""}`,
            );
            changedFields.push(apiField);
          }
          if (changesMinorStatus) {
            values.push(body.data.isMinor ? "required" : "not_required");
            sets.push(
              `guardian_status = $${values.length}`,
              `work_permit_status = $${values.length}`,
            );
          }
          values.push(auditActorUserId);
          sets.push(`updated_by = $${values.length}`, "version = version + 1");
          const updated = await client.query(
            `UPDATE workspace_project_participants
              SET ${sets.join(", ")}
            WHERE organization_id = $1 AND project_id = $2 AND id = $3
              AND version = $4 AND archived_at IS NULL
          RETURNING id`,
            values,
          );
          if (updated.rowCount !== 1)
            throw new RouteError(
              409,
              "version_conflict",
              "Medvirkende er endret av noen andre.",
            );
          await client.query(
            `INSERT INTO workspace_participant_events
             (organization_id, project_id, participant_id, event_type, actor_type, actor_user_id, payload)
           VALUES ($1,$2,$3,'participant_updated','user',$4,$5::jsonb)`,
            [
              access.organizationId,
              access.projectId,
              params.data.participantId,
              auditActorUserId,
              JSON.stringify({ fields: changedFields, ...impersonationPayload }),
            ],
          );
          const participant = await loadParticipant(
            client,
            access.organizationId,
            access.projectId,
            params.data.participantId,
          );
          return { participant: mapParticipant(participant, true), access };
        });
        res.json(result);
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.post(
    "/api/projects/:projectId/participants/:participantId/archive",
    async (req, res) => {
      preventSensitiveCaching(res);
      const session = await authoritativeSession(deps, req, res);
      if (!session) return;
      const auditActorUserId = workspaceParticipantAuditActorUserId(session);
      const impersonationPayload =
        workspaceParticipantImpersonationPayload(session);
      const params = participantRouteParamsSchema.safeParse(req.params);
      const body = archiveParticipantSchema.safeParse(req.body ?? {});
      if (!params.success) return validationError(res, params);
      if (!body.success) return validationError(res, body);
      try {
        const result = await transaction(pool, async (client) => {
          const access = await resolveWorkspaceParticipantAccess(
            client,
            session.userId,
            params.data.projectId,
          );
          assertManage(access);
          assertParticipantClosureAuthority(access);
          await ensureWorkspaceProjectScopeBinding(
            client,
            access,
            auditActorUserId,
          );
          await closeWorkspaceProjectParticipant({
            db: client,
            organizationId: access.organizationId,
            projectId: access.projectId,
            projectOwnerUserId: access.projectOwnerUserId,
            participantId: params.data.participantId,
            expectedVersion: body.data.version,
            actorUserId: auditActorUserId,
            auditPayload: impersonationPayload,
            terminalStatus: "archived",
          });
          const participant = await loadParticipant(
            client,
            access.organizationId,
            access.projectId,
            params.data.participantId,
          );
          return { participant: mapParticipant(participant, true), access };
        });
        res.json(result);
      } catch (error) {
        sendError(res, error);
      }
    },
  );
}
