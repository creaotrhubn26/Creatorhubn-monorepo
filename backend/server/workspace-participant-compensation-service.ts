import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  WORKSPACE_PARTICIPANT_COMPENSATION_SOURCE,
  type WorkspaceParticipantCompensation,
  type WorkspaceParticipantCompensationRequest,
} from "../../frontend/shared/workspace-participant-compensation.ts";
import { supersedeStalePendingWorkspaceParticipantContracts } from "./workspace-participant-documents-service.js";
import type { WorkspaceParticipantAccess } from "./workspace-project-participants-routes.js";

type Queryer = Pick<PoolClient, "query">;

export class WorkspaceParticipantCompensationError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

interface CanonicalCompensationTerms {
  compensationType: "hourly" | "fixed" | "unpaid";
  hourlyRate: string | null;
  estimatedHours: string | null;
  fixedAmount: string | null;
  estimatedAmount: number | null;
  currency: string;
  note: string | null;
  expectedCurrentVersion: number | null;
}

export interface CreateWorkspaceParticipantCompensationVersionInput {
  db: Queryer;
  access: WorkspaceParticipantAccess;
  actorUserId: string;
  auditPayload?: Record<string, unknown>;
  participantId: string;
  request: WorkspaceParticipantCompensationRequest;
  createId?: () => string;
}

export interface CreateWorkspaceParticipantCompensationVersionResult {
  compensation: WorkspaceParticipantCompensation;
  replayed: boolean;
}

const COMPENSATION_SELECT = `
  SELECT link.id, link.organization_id, link.project_id,
         link.project_owner_user_id, link.participant_id, link.split_sheet_id,
         link.contributor_id, link.compensation_type, link.hourly_rate,
         link.estimated_hours, link.day_rate, link.fixed_amount,
         link.share_percentage, link.currency, link.status,
         link.terms_snapshot, link.version, link.idempotency_key,
         link.request_hash, link.supersedes_link_id, link.created_at,
         link.updated_at, link.superseded_at, link.archived_at,
         sheet.status AS split_sheet_status
    FROM workspace_participant_compensation_links link
    LEFT JOIN split_sheets sheet ON sheet.id = link.split_sheet_id`;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function dateIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function canonicalPublicNote(value: string | null | undefined): string | null {
  const note = value?.normalize("NFC").trim() || null;
  if (!note) return null;
  if (note.length > 2_000 || /<\/?[a-z][^>]*>/i.test(note)) {
    throw new WorkspaceParticipantCompensationError(
      400,
      "validation_error",
      "Merknaden er ugyldig eller inneholder HTML.",
    );
  }
  return note;
}

function canonicalPositiveDecimal(
  value: number,
  field: string,
  maximum: number,
): string {
  if (!Number.isFinite(value) || value <= 0 || value > maximum) {
    throw new WorkspaceParticipantCompensationError(
      400,
      "validation_error",
      `${field} er ugyldig.`,
    );
  }
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  if (Math.abs(value - rounded) > 1e-8) {
    throw new WorkspaceParticipantCompensationError(
      400,
      "validation_error",
      `${field} kan ha maksimalt to desimaler.`,
    );
  }
  return rounded.toFixed(2);
}

function canonicalTerms(
  request: WorkspaceParticipantCompensationRequest,
): CanonicalCompensationTerms {
  const note = canonicalPublicNote(request.note);
  if (request.compensationType === "unpaid") {
    return {
      compensationType: "unpaid",
      hourlyRate: null,
      estimatedHours: null,
      fixedAmount: null,
      estimatedAmount: null,
      currency: "NOK",
      note,
      expectedCurrentVersion: request.expectedCurrentVersion,
    };
  }
  if (!/^[A-Z]{3}$/.test(request.currency)) {
    throw new WorkspaceParticipantCompensationError(
      400,
      "validation_error",
      "Valutakoden må bestå av tre store bokstaver.",
    );
  }
  if (request.compensationType === "fixed") {
    const fixedAmount = canonicalPositiveDecimal(
      request.fixedAmount,
      "fixedAmount",
      10_000_000_000,
    );
    return {
      compensationType: "fixed",
      hourlyRate: null,
      estimatedHours: null,
      fixedAmount,
      estimatedAmount: Number(fixedAmount),
      currency: request.currency,
      note,
      expectedCurrentVersion: request.expectedCurrentVersion,
    };
  }
  const hourlyRate = canonicalPositiveDecimal(
    request.hourlyRate,
    "hourlyRate",
    10_000_000,
  );
  const estimatedHours = canonicalPositiveDecimal(
    request.estimatedHours,
    "estimatedHours",
    10_000,
  );
  return {
    compensationType: "hourly",
    hourlyRate,
    estimatedHours,
    fixedAmount: null,
    estimatedAmount:
      Math.round(Number(hourlyRate) * Number(estimatedHours) * 100) / 100,
    currency: request.currency,
    note,
    expectedCurrentVersion: request.expectedCurrentVersion,
  };
}

export function workspaceParticipantCompensationRequestHash(
  request: WorkspaceParticipantCompensationRequest,
): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalTerms(request)))
    .digest("hex");
}

export function mapWorkspaceParticipantCompensation(
  row: Record<string, unknown>,
): WorkspaceParticipantCompensation {
  const snapshot = record(row.terms_snapshot);
  return {
    id: String(row.id),
    participantId: String(row.participant_id),
    projectId: String(row.project_id),
    version: Number(row.version),
    compensationType: String(
      row.compensation_type,
    ) as WorkspaceParticipantCompensation["compensationType"],
    status: String(row.status) as WorkspaceParticipantCompensation["status"],
    hourlyRate: numberOrNull(row.hourly_rate),
    estimatedHours: numberOrNull(row.estimated_hours),
    dayRate: numberOrNull(row.day_rate),
    fixedAmount: numberOrNull(row.fixed_amount),
    sharePercentage: numberOrNull(row.share_percentage),
    estimatedAmount: numberOrNull(snapshot.estimatedAmount),
    currency: String(row.currency || "NOK"),
    note: typeof snapshot.note === "string" ? snapshot.note : null,
    splitSheetId: row.split_sheet_id ? String(row.split_sheet_id) : null,
    splitSheetStatus: row.split_sheet_status
      ? (String(
          row.split_sheet_status,
        ) as WorkspaceParticipantCompensation["splitSheetStatus"])
      : null,
    supersedesCompensationId: row.supersedes_link_id
      ? String(row.supersedes_link_id)
      : null,
    createdAt: dateIso(row.created_at) || "",
    updatedAt: dateIso(row.updated_at) || "",
    supersededAt: dateIso(row.superseded_at),
    archivedAt: dateIso(row.archived_at),
  };
}

async function loadCompensationByIdempotencyKey(
  db: Queryer,
  access: WorkspaceParticipantAccess,
  participantId: string,
  idempotencyKey: string,
): Promise<Record<string, unknown> | null> {
  const result = await db.query(
    `${COMPENSATION_SELECT}
      WHERE link.organization_id = $1
        AND link.project_id = $2
        AND link.project_owner_user_id = $3
        AND link.participant_id = $4
        AND link.idempotency_key = $5::uuid
      LIMIT 1`,
    [
      access.organizationId,
      access.projectId,
      access.projectOwnerUserId,
      participantId,
      idempotencyKey,
    ],
  );
  return result.rows[0] ?? null;
}

export async function listWorkspaceParticipantCompensation(
  db: Queryer,
  access: WorkspaceParticipantAccess,
  participantId: string,
): Promise<{
  current: WorkspaceParticipantCompensation | null;
  history: WorkspaceParticipantCompensation[];
}> {
  const participant = await db.query(
    `SELECT id
       FROM workspace_project_participants
      WHERE organization_id = $1 AND project_id = $2 AND id = $3
      LIMIT 1`,
    [access.organizationId, access.projectId, participantId],
  );
  if (participant.rowCount !== 1) {
    throw new WorkspaceParticipantCompensationError(
      404,
      "participant_not_found",
      "Medvirkende finnes ikke.",
    );
  }
  const result = await db.query(
    `${COMPENSATION_SELECT}
      WHERE link.organization_id = $1
        AND link.project_id = $2
        AND link.project_owner_user_id = $3
        AND link.participant_id = $4
      ORDER BY link.version DESC, link.created_at DESC, link.id DESC`,
    [
      access.organizationId,
      access.projectId,
      access.projectOwnerUserId,
      participantId,
    ],
  );
  const history = result.rows.map((row) =>
    mapWorkspaceParticipantCompensation(row),
  );
  return {
    current: history.find((item) => item.status === "active") ?? null,
    history,
  };
}

export async function createWorkspaceParticipantCompensationVersion(
  input: CreateWorkspaceParticipantCompensationVersionInput,
): Promise<CreateWorkspaceParticipantCompensationVersionResult> {
  const {
    db,
    access,
    actorUserId,
    participantId,
    request,
    auditPayload = {},
  } = input;
  const createId = input.createId ?? randomUUID;
  const terms = canonicalTerms(request);
  const requestHash = workspaceParticipantCompensationRequestHash(request);

  const participantResult = await db.query(
    `SELECT id, display_name, email, role_label, workflow_status, archived_at
       FROM workspace_project_participants
      WHERE organization_id = $1 AND project_id = $2 AND id = $3
      FOR UPDATE`,
    [access.organizationId, access.projectId, participantId],
  );
  const participant = participantResult.rows[0];
  if (!participant) {
    throw new WorkspaceParticipantCompensationError(
      404,
      "participant_not_found",
      "Medvirkende finnes ikke.",
    );
  }
  if (
    participant.archived_at ||
    ["archived", "cancelled"].includes(String(participant.workflow_status))
  ) {
    throw new WorkspaceParticipantCompensationError(
      409,
      "participant_inactive",
      "Kompensasjon kan ikke endres for en arkivert eller avbrutt medvirkende.",
    );
  }

  const replay = await loadCompensationByIdempotencyKey(
    db,
    access,
    participantId,
    request.idempotencyKey,
  );
  if (replay) {
    if (String(replay.request_hash || "") !== requestHash) {
      throw new WorkspaceParticipantCompensationError(
        409,
        "idempotency_conflict",
        "Idempotensnøkkelen er allerede brukt med andre vilkår.",
      );
    }
    return {
      compensation: mapWorkspaceParticipantCompensation(replay),
      replayed: true,
    };
  }

  const currentResult = await db.query(
    `${COMPENSATION_SELECT}
      WHERE link.organization_id = $1
        AND link.project_id = $2
        AND link.project_owner_user_id = $3
        AND link.participant_id = $4
        AND link.status = 'active'
      LIMIT 1
      FOR UPDATE OF link`,
    [
      access.organizationId,
      access.projectId,
      access.projectOwnerUserId,
      participantId,
    ],
  );
  const current = currentResult.rows[0] as Record<string, unknown> | undefined;
  const currentVersion = current ? Number(current.version) : null;
  if (currentVersion !== terms.expectedCurrentVersion) {
    throw new WorkspaceParticipantCompensationError(
      409,
      "version_conflict",
      "Kompensasjonsvilkårene er endret av noen andre.",
      { currentVersion },
    );
  }

  const maxVersionResult = await db.query(
    `SELECT COALESCE(MAX(version), 0)::integer AS max_version
       FROM workspace_participant_compensation_links
      WHERE organization_id = $1 AND project_id = $2 AND participant_id = $3`,
    [access.organizationId, access.projectId, participantId],
  );
  const version = Number(maxVersionResult.rows[0]?.max_version || 0) + 1;
  const compensationId = createId();
  const paid = terms.compensationType !== "unpaid";
  const splitSheetId = paid ? createId() : null;
  const contributorId = paid ? createId() : null;

  const termsSnapshot = {
    schemaVersion: 1,
    source: WORKSPACE_PARTICIPANT_COMPENSATION_SOURCE,
    workspaceProjectId: access.projectId,
    workspaceParticipantId: participantId,
    workspaceCompensationId: compensationId,
    compensationVersion: version,
    compensationType: terms.compensationType,
    hourlyRate: terms.hourlyRate ? Number(terms.hourlyRate) : null,
    estimatedHours: terms.estimatedHours ? Number(terms.estimatedHours) : null,
    fixedAmount: terms.fixedAmount ? Number(terms.fixedAmount) : null,
    estimatedAmount: terms.estimatedAmount,
    currency: terms.currency,
    note: terms.note,
  };

  if (paid && splitSheetId && contributorId) {
    const compensationModel =
      terms.compensationType === "hourly" ? "hourly" : "mixed";
    const sheetMetadata = {
      agreementVersion: 1,
      visibility: "private",
      source: WORKSPACE_PARTICIPANT_COMPENSATION_SOURCE,
      workspaceOrganizationId: access.organizationId,
      workspaceProjectId: access.projectId,
      workspaceParticipantId: participantId,
      workspaceCompensationId: compensationId,
      compensationVersion: version,
      compensationModel,
      distributionModel: "external-participant-compensation",
      projectAmount: terms.estimatedAmount,
      currency: terms.currency,
    };
    const contributorFields = {
      roleLabel: participant.role_label || "Medvirkende",
      compensationType: terms.compensationType,
      hourlyRate: terms.hourlyRate ? Number(terms.hourlyRate) : null,
      estimatedHours: terms.estimatedHours
        ? Number(terms.estimatedHours)
        : null,
      estimatedAmount: terms.estimatedAmount,
      currency: terms.currency,
      externalParticipant: true,
      workspaceProjectId: access.projectId,
      workspaceParticipantId: participantId,
      workspaceCompensationId: compensationId,
      compensationVersion: version,
    };
    const title = `Honorar – ${String(participant.display_name)}`;
    const description = `Versjon ${version} av honorarvilkårene for ${String(participant.display_name)}.`;

    await db.query(
      `INSERT INTO split_sheets
         (id, user_id, project_id, track_id, title, description, status,
          total_percentage, metadata, access_code, security_enabled)
       VALUES ($1::uuid, $2, $3, NULL, $4, $5, 'draft', 0, $6::jsonb, NULL, FALSE)`,
      [
        splitSheetId,
        access.projectOwnerUserId,
        access.projectId,
        title,
        description,
        JSON.stringify(sheetMetadata),
      ],
    );
    await db.query(
      `INSERT INTO split_sheet_contributors
         (id, split_sheet_id, name, email, role, percentage, signed_at,
          signature_data, invitation_status, user_id, order_index, custom_fields)
       VALUES ($1::uuid, $2::uuid, $3, $4, 'other', 0, NULL, NULL,
               'not_sent', NULL, 0, $5::jsonb)`,
      [
        contributorId,
        splitSheetId,
        String(participant.display_name),
        participant.email ? String(participant.email).toLowerCase() : null,
        JSON.stringify(contributorFields),
      ],
    );
    await db.query(
      `INSERT INTO split_sheet_versions
         (id, split_sheet_id, version_number, changes, created_by, snapshot_data)
       VALUES ($1::uuid, $2::uuid, 1, $3::jsonb, $4, $5::jsonb)`,
      [
        createId(),
        splitSheetId,
        JSON.stringify({
          action: "created",
          source: WORKSPACE_PARTICIPANT_COMPENSATION_SOURCE,
          compensationVersion: version,
        }),
        actorUserId,
        JSON.stringify({
          title,
          description,
          metadata: sheetMetadata,
          contributor: {
            id: contributorId,
            name: String(participant.display_name),
            role: "other",
            percentage: 0,
            customFields: contributorFields,
          },
        }),
      ],
    );
  }

  await db.query(
    `INSERT INTO workspace_participant_compensation_links
       (id, organization_id, project_id, project_owner_user_id, participant_id,
        split_sheet_id, contributor_id, compensation_type, hourly_rate,
        estimated_hours, day_rate, fixed_amount, share_percentage, currency,
        status, terms_snapshot, version, idempotency_key, request_hash,
        supersedes_link_id, created_by)
     VALUES ($1::uuid,$2,$3,$4,$5,$6::uuid,$7::uuid,$8,$9,$10,NULL,$11,NULL,$12,
             'draft',$13::jsonb,$14,$15::uuid,$16,$17::uuid,$18)`,
    [
      compensationId,
      access.organizationId,
      access.projectId,
      access.projectOwnerUserId,
      participantId,
      splitSheetId,
      contributorId,
      terms.compensationType,
      terms.hourlyRate,
      terms.estimatedHours,
      terms.fixedAmount,
      terms.currency,
      JSON.stringify(termsSnapshot),
      version,
      request.idempotencyKey,
      requestHash,
      current ? String(current.id) : null,
      actorUserId,
    ],
  );

  let previousSplitSheetArchived = false;
  if (current?.split_sheet_id) {
    const oldSheet = await db.query(
      `SELECT id, status
         FROM split_sheets
        WHERE id = $1::uuid AND project_id = $2 AND user_id = $3
        FOR UPDATE`,
      [
        String(current.split_sheet_id),
        access.projectId,
        access.projectOwnerUserId,
      ],
    );
    if (oldSheet.rowCount !== 1) {
      throw new WorkspaceParticipantCompensationError(
        409,
        "compensation_integrity_conflict",
        "Tidligere split sheet kunne ikke verifiseres.",
      );
    }
    const signatureEvidence = await db.query(
      `SELECT EXISTS (
         SELECT 1 FROM split_sheet_contributors
          WHERE split_sheet_id = $1::uuid
            AND (signed_at IS NOT NULL OR signature_data IS NOT NULL)
       ) AS has_signature_evidence`,
      [String(current.split_sheet_id)],
    );
    const oldStatus = String(oldSheet.rows[0].status);
    if (
      ["draft", "pending_signatures"].includes(oldStatus) &&
      signatureEvidence.rows[0]?.has_signature_evidence !== true
    ) {
      const archived = await db.query(
        `UPDATE split_sheets
            SET status = 'archived', updated_at = NOW()
          WHERE id = $1::uuid AND project_id = $2 AND user_id = $3 AND status = $4`,
        [
          String(current.split_sheet_id),
          access.projectId,
          access.projectOwnerUserId,
          oldStatus,
        ],
      );
      if (archived.rowCount !== 1) {
        throw new WorkspaceParticipantCompensationError(
          409,
          "compensation_version_conflict",
          "Tidligere split sheet endret status under lagring.",
        );
      }
      previousSplitSheetArchived = true;
    }
  }

  if (current) {
    const superseded = await db.query(
      `UPDATE workspace_participant_compensation_links
          SET status = 'superseded', superseded_at = NOW()
        WHERE organization_id = $1 AND project_id = $2 AND participant_id = $3
          AND id = $4::uuid AND status = 'active'`,
      [
        access.organizationId,
        access.projectId,
        participantId,
        String(current.id),
      ],
    );
    if (superseded.rowCount !== 1) {
      throw new WorkspaceParticipantCompensationError(
        409,
        "compensation_version_conflict",
        "Tidligere kompensasjonsversjon kunne ikke erstattes.",
      );
    }
  }

  const activated = await db.query(
    `UPDATE workspace_participant_compensation_links
        SET status = 'active'
      WHERE organization_id = $1 AND project_id = $2 AND participant_id = $3
        AND id = $4::uuid AND status = 'draft'`,
    [access.organizationId, access.projectId, participantId, compensationId],
  );
  if (activated.rowCount !== 1) {
    throw new WorkspaceParticipantCompensationError(
      409,
      "compensation_version_conflict",
      "Ny kompensasjonsversjon kunne ikke aktiveres.",
    );
  }

  await supersedeStalePendingWorkspaceParticipantContracts(db, {
    organizationId: access.organizationId,
    projectId: access.projectId,
    participantId,
    activeCompensationId: compensationId,
    activeCompensationVersion: version,
    actorUserId,
    auditPayload,
  });

  await db.query(
    `INSERT INTO workspace_participant_events
       (organization_id, project_id, participant_id, event_type, actor_type,
        actor_user_id, payload)
     VALUES ($1,$2,$3,'participant_compensation_version_created','user',$4,$5::jsonb)`,
    [
      access.organizationId,
      access.projectId,
      participantId,
      actorUserId,
      JSON.stringify({
        compensationId,
        compensationVersion: version,
        compensationType: terms.compensationType,
        splitSheetId,
        supersedesCompensationId: current ? String(current.id) : null,
        previousSplitSheetArchived,
        ...auditPayload,
      }),
    ],
  );

  const inserted = await db.query(
    `${COMPENSATION_SELECT}
      WHERE link.organization_id = $1
        AND link.project_id = $2
        AND link.project_owner_user_id = $3
        AND link.participant_id = $4
        AND link.id = $5::uuid
      LIMIT 1`,
    [
      access.organizationId,
      access.projectId,
      access.projectOwnerUserId,
      participantId,
      compensationId,
    ],
  );
  if (inserted.rowCount !== 1) {
    throw new WorkspaceParticipantCompensationError(
      500,
      "compensation_persistence_failed",
      "Kompensasjonsversjonen kunne ikke leses etter lagring.",
    );
  }
  return {
    compensation: mapWorkspaceParticipantCompensation(inserted.rows[0]),
    replayed: false,
  };
}
