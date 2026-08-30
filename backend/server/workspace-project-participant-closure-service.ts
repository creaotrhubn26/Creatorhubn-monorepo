import type { PoolClient } from "pg";

type Queryer = Pick<PoolClient, "query">;

export type WorkspaceProjectParticipantTerminalStatus =
  | "cancelled"
  | "archived";

export class WorkspaceProjectParticipantClosureError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface CloseWorkspaceProjectParticipantInput {
  db: Queryer;
  organizationId: string;
  projectId: string;
  projectOwnerUserId: string;
  participantId: string;
  expectedVersion: number;
  actorUserId: string;
  auditPayload?: Record<string, unknown>;
  terminalStatus: WorkspaceProjectParticipantTerminalStatus;
}

export interface CloseWorkspaceProjectParticipantResult {
  participantId: string;
  previousWorkflowStatus: string;
  workflowStatus: WorkspaceProjectParticipantTerminalStatus;
  version: number;
  revokedDocumentTokens: number;
  supersededDocuments: number;
  archivedCompensations: number;
  archivedSplitSheets: number;
}

const CANCELLABLE_WORKFLOW_STATUSES = new Set([
  "draft",
  "invited",
  "confirmed",
  "cancelled",
]);

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function rowCount(result: { rowCount?: number | null }): number {
  return Number(result.rowCount || 0);
}

/**
 * Closes every pending legal/economic capability before making a participant
 * terminal. Call this inside the request transaction after authorization and
 * immutable project↔Enterprise scope binding have succeeded.
 *
 * Global lock order:
 * participant → active compensation → private sheet → documents → signers.
 * Public signing, document issue, and compensation versioning use the same
 * participant-first order, so either transaction observes the other's commit.
 */
export async function closeWorkspaceProjectParticipant(
  input: CloseWorkspaceProjectParticipantInput,
): Promise<CloseWorkspaceProjectParticipantResult> {
  const {
    db,
    organizationId,
    projectId,
    projectOwnerUserId,
    participantId,
    expectedVersion,
    actorUserId,
    auditPayload = {},
    terminalStatus,
  } = input;

  const participantResult = await db.query(
    `SELECT id::text, workflow_status, version, archived_at
       FROM workspace_project_participants
      WHERE organization_id = $1 AND project_id = $2 AND id = $3::uuid
      FOR UPDATE`,
    [organizationId, projectId, participantId],
  );
  const participant = participantResult.rows[0];
  if (!participant) {
    throw new WorkspaceProjectParticipantClosureError(
      404,
      "participant_not_found",
      "Medvirkende finnes ikke.",
    );
  }
  if (
    participant.archived_at ||
    String(participant.workflow_status) === "archived"
  ) {
    throw new WorkspaceProjectParticipantClosureError(
      409,
      "participant_already_archived",
      "Medvirkende er allerede arkivert.",
      { currentVersion: Number(participant.version) },
    );
  }
  if (Number(participant.version) !== expectedVersion) {
    throw new WorkspaceProjectParticipantClosureError(
      409,
      "version_conflict",
      "Medvirkende er endret av noen andre.",
      { currentVersion: Number(participant.version) },
    );
  }
  const previousWorkflowStatus = String(participant.workflow_status);
  if (
    terminalStatus === "cancelled" &&
    !CANCELLABLE_WORKFLOW_STATUSES.has(previousWorkflowStatus)
  ) {
    throw new WorkspaceProjectParticipantClosureError(
      409,
      "workflow_transition_invalid",
      "Statusendringen er ikke tillatt.",
    );
  }

  const compensationResult = await db.query(
    `SELECT id::text, split_sheet_id::text, compensation_type
       FROM workspace_participant_compensation_links
      WHERE organization_id = $1 AND project_id = $2
        AND project_owner_user_id = $3 AND participant_id = $4::uuid
        AND status = 'active'
      ORDER BY version DESC, id
      FOR UPDATE`,
    [organizationId, projectId, projectOwnerUserId, participantId],
  );
  if (compensationResult.rows.length > 1) {
    throw new WorkspaceProjectParticipantClosureError(
      409,
      "compensation_integrity_conflict",
      "Flere aktive honorarversjoner ble funnet.",
    );
  }
  const activeCompensation = compensationResult.rows[0] ?? null;

  let lockedSplitSheet: Record<string, unknown> | null = null;
  if (activeCompensation?.split_sheet_id) {
    const splitSheetResult = await db.query(
      `SELECT id::text, status, metadata
         FROM split_sheets
        WHERE id = $1::uuid AND project_id = $2 AND user_id = $3
        FOR UPDATE`,
      [
        String(activeCompensation.split_sheet_id),
        projectId,
        projectOwnerUserId,
      ],
    );
    lockedSplitSheet = splitSheetResult.rows[0] ?? null;
    const metadata = metadataRecord(lockedSplitSheet?.metadata);
    if (
      !lockedSplitSheet ||
      metadata.source !== "workspace-participant-compensation" ||
      metadata.workspaceOrganizationId !== organizationId ||
      metadata.workspaceProjectId !== projectId ||
      metadata.workspaceParticipantId !== participantId ||
      metadata.workspaceCompensationId !== String(activeCompensation.id) ||
      String(lockedSplitSheet.status) !== "draft"
    ) {
      throw new WorkspaceProjectParticipantClosureError(
        409,
        "compensation_integrity_conflict",
        "Det private honorararket kunne ikke verifiseres.",
      );
    }
  } else if (
    activeCompensation &&
    String(activeCompensation.compensation_type) !== "unpaid"
  ) {
    throw new WorkspaceProjectParticipantClosureError(
      409,
      "compensation_integrity_conflict",
      "Betalte vilkår mangler privat honorarark.",
    );
  }

  const documentsResult = await db.query(
    `SELECT id::text, document_type, status
       FROM workspace_participant_documents
      WHERE organization_id = $1 AND project_id = $2
        AND participant_id = $3::uuid
      ORDER BY id
      FOR UPDATE`,
    [organizationId, projectId, participantId],
  );
  const documentIds = documentsResult.rows.map((row) => String(row.id));
  if (documentIds.length > 0) {
    await db.query(
      `SELECT id::text, document_id::text, status, signing_token_hash,
              token_revoked_at
         FROM workspace_participant_document_signers
        WHERE organization_id = $1 AND project_id = $2
          AND participant_id = $3::uuid
          AND document_id = ANY($4::uuid[])
        ORDER BY document_id, id
        FOR UPDATE`,
      [organizationId, projectId, participantId, documentIds],
    );
  }

  const revoked = await db.query(
    `UPDATE workspace_participant_document_signers signer
        SET signing_token_hash = NULL,
            token_revoked_at = COALESCE(signer.token_revoked_at, NOW())
       FROM workspace_participant_documents document
      WHERE document.organization_id = $1 AND document.project_id = $2
        AND document.participant_id = $3::uuid
        AND document.id = signer.document_id
        AND document.status IN ('issued', 'viewed')
        AND signer.organization_id = document.organization_id
        AND signer.project_id = document.project_id
        AND signer.participant_id = document.participant_id
        AND signer.status = 'pending'
        AND signer.signing_token_hash IS NOT NULL`,
    [organizationId, projectId, participantId],
  );
  const superseded = await db.query(
    `UPDATE workspace_participant_documents
        SET status = 'superseded'
      WHERE organization_id = $1 AND project_id = $2
        AND participant_id = $3::uuid
        AND status IN ('issued', 'viewed')`,
    [organizationId, projectId, participantId],
  );

  let archivedSplitSheets = 0;
  if (lockedSplitSheet) {
    const archivedSheet = await db.query(
      `UPDATE split_sheets
          SET status = 'archived', updated_at = NOW()
        WHERE id = $1::uuid AND project_id = $2 AND user_id = $3
          AND status = 'draft'`,
      [String(lockedSplitSheet.id), projectId, projectOwnerUserId],
    );
    if (archivedSheet.rowCount !== 1) {
      throw new WorkspaceProjectParticipantClosureError(
        409,
        "compensation_integrity_conflict",
        "Det private honorararket ble endret samtidig.",
      );
    }
    archivedSplitSheets = 1;
  }

  let archivedCompensations = 0;
  if (activeCompensation) {
    const archivedCompensation = await db.query(
      `UPDATE workspace_participant_compensation_links
          SET status = 'archived', archived_at = COALESCE(archived_at, NOW())
        WHERE organization_id = $1 AND project_id = $2
          AND project_owner_user_id = $3 AND participant_id = $4::uuid
          AND id = $5::uuid AND status = 'active'`,
      [
        organizationId,
        projectId,
        projectOwnerUserId,
        participantId,
        String(activeCompensation.id),
      ],
    );
    if (archivedCompensation.rowCount !== 1) {
      throw new WorkspaceProjectParticipantClosureError(
        409,
        "compensation_version_conflict",
        "Aktivt honorar ble endret samtidig.",
      );
    }
    archivedCompensations = 1;
  }

  const participantUpdate =
    terminalStatus === "archived"
      ? await db.query(
          `UPDATE workspace_project_participants
              SET workflow_status = 'archived', archived_at = NOW(),
                  archived_by = $5, updated_by = $5, version = version + 1
            WHERE organization_id = $1 AND project_id = $2 AND id = $3::uuid
              AND version = $4 AND archived_at IS NULL
          RETURNING version`,
          [
            organizationId,
            projectId,
            participantId,
            expectedVersion,
            actorUserId,
          ],
        )
      : await db.query(
          `UPDATE workspace_project_participants
              SET workflow_status = 'cancelled', updated_by = $5,
                  version = version + 1
            WHERE organization_id = $1 AND project_id = $2 AND id = $3::uuid
              AND version = $4 AND archived_at IS NULL
          RETURNING version`,
          [
            organizationId,
            projectId,
            participantId,
            expectedVersion,
            actorUserId,
          ],
        );
  if (participantUpdate.rowCount !== 1) {
    throw new WorkspaceProjectParticipantClosureError(
      409,
      "version_conflict",
      "Medvirkende er endret av noen andre.",
    );
  }
  const version = Number(participantUpdate.rows[0]?.version);

  await db.query(
    `INSERT INTO workspace_participant_events
       (organization_id, project_id, participant_id, event_type, actor_type,
        actor_user_id, payload)
     VALUES ($1,$2,$3::uuid,$4,'user',$5,$6::jsonb)`,
    [
      organizationId,
      projectId,
      participantId,
      terminalStatus === "archived"
        ? "participant_archived"
        : "participant_cancelled",
      actorUserId,
      JSON.stringify({
        previousWorkflowStatus,
        workflowStatus: terminalStatus,
        version,
        revokedDocumentTokens: rowCount(revoked),
        supersededDocuments: rowCount(superseded),
        archivedCompensations,
        archivedSplitSheets,
        ...auditPayload,
      }),
    ],
  );

  return {
    participantId,
    previousWorkflowStatus,
    workflowStatus: terminalStatus,
    version,
    revokedDocumentTokens: rowCount(revoked),
    supersededDocuments: rowCount(superseded),
    archivedCompensations,
    archivedSplitSheets,
  };
}
