import type { Pool, PoolClient } from "pg";
import type {
  WorkspaceParticipantWorkPermitClearanceChange,
  WorkspaceParticipantWorkPermitClearanceRequest,
  WorkspaceParticipantWorkPermitClearanceState,
  WorkspaceParticipantWorkPermitClearanceStatus,
} from "../../frontend/shared/workspace-participant-clearance.ts";
import type { WorkspaceParticipantAccess } from "./workspace-project-participants-routes.js";

type Queryer = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export class WorkspaceParticipantClearanceError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

const iso = (value: unknown): string => {
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? String(value ?? "")
    : parsed.toISOString();
};

const clearanceStatus = (
  value: unknown,
): WorkspaceParticipantWorkPermitClearanceStatus => {
  if (
    value === "pending" ||
    value === "approved" ||
    value === "rejected" ||
    value === "not_required"
  ) {
    return value;
  }
  throw new WorkspaceParticipantClearanceError(
    500,
    "work_permit_event_invalid",
    "Arbeidstillatelseshistorikken inneholder en ugyldig status.",
  );
};

function mapChange(
  row: Record<string, unknown>,
): WorkspaceParticipantWorkPermitClearanceChange {
  const payload =
    row.payload &&
    typeof row.payload === "object" &&
    !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
  return {
    id: String(row.id),
    previousStatus: String(payload.previousStatus ?? "required"),
    status: clearanceStatus(payload.status),
    evidenceReference:
      typeof payload.evidenceReference === "string"
        ? payload.evidenceReference
        : null,
    note: typeof payload.note === "string" ? payload.note : null,
    actorUserId: String(row.actor_user_id ?? ""),
    participantVersion: Number(payload.participantVersion),
    occurredAt: iso(row.occurred_at),
  };
}

async function readParticipant(
  db: Queryer,
  access: WorkspaceParticipantAccess,
  participantId: string,
  lock: boolean,
): Promise<Record<string, unknown>> {
  const participant = await db.query(
    `SELECT id::text, is_minor, work_permit_status, workflow_status,
            version, updated_at, archived_at
       FROM workspace_project_participants
      WHERE organization_id = $1 AND project_id = $2 AND id = $3::uuid
      ${lock ? "FOR UPDATE" : ""}`,
    [access.organizationId, access.projectId, participantId],
  );
  if (participant.rowCount !== 1) {
    throw new WorkspaceParticipantClearanceError(
      404,
      "participant_not_found",
      "Medvirkende ble ikke funnet i dette prosjektet.",
    );
  }
  return participant.rows[0] as Record<string, unknown>;
}

async function readHistory(
  db: Queryer,
  access: WorkspaceParticipantAccess,
  participantId: string,
): Promise<WorkspaceParticipantWorkPermitClearanceChange[]> {
  const result = await db.query(
    `SELECT id::text, actor_user_id, payload, occurred_at
       FROM workspace_participant_events
      WHERE organization_id = $1 AND project_id = $2
        AND participant_id = $3::uuid
        AND event_type = 'work_permit_status_changed'
      ORDER BY occurred_at DESC, id DESC`,
    [access.organizationId, access.projectId, participantId],
  );
  return result.rows.map((row) => mapChange(row as Record<string, unknown>));
}

function stateFrom(
  participantId: string,
  participant: Record<string, unknown>,
  latestChange: WorkspaceParticipantWorkPermitClearanceChange | null,
): WorkspaceParticipantWorkPermitClearanceState {
  return {
    participantId,
    status: String(participant.work_permit_status),
    participantVersion: Number(participant.version),
    isMinor: participant.is_minor === true,
    updatedAt: iso(participant.updated_at),
    latestChange,
  };
}

export async function getWorkspaceParticipantWorkPermitClearance(input: {
  db: Queryer;
  access: WorkspaceParticipantAccess;
  participantId: string;
}): Promise<{
  clearance: WorkspaceParticipantWorkPermitClearanceState;
  history: WorkspaceParticipantWorkPermitClearanceChange[];
}> {
  const participant = await readParticipant(
    input.db,
    input.access,
    input.participantId,
    false,
  );
  const history = await readHistory(
    input.db,
    input.access,
    input.participantId,
  );
  return {
    clearance: stateFrom(input.participantId, participant, history[0] ?? null),
    history,
  };
}

export async function setWorkspaceParticipantWorkPermitClearance(input: {
  db: Queryer;
  access: WorkspaceParticipantAccess;
  actorUserId: string;
  auditPayload?: Record<string, unknown>;
  participantId: string;
  request: WorkspaceParticipantWorkPermitClearanceRequest;
}): Promise<{
  clearance: WorkspaceParticipantWorkPermitClearanceState;
  change: WorkspaceParticipantWorkPermitClearanceChange;
}> {
  const participant = await readParticipant(
    input.db,
    input.access,
    input.participantId,
    true,
  );
  const currentVersion = Number(participant.version);
  if (currentVersion !== input.request.version) {
    throw new WorkspaceParticipantClearanceError(
      409,
      "version_conflict",
      "Medvirkende er endret av noen andre.",
      { currentVersion },
    );
  }
  if (
    participant.archived_at != null ||
    ["archived", "cancelled"].includes(String(participant.workflow_status))
  ) {
    throw new WorkspaceParticipantClearanceError(
      409,
      "participant_not_editable",
      "Arbeidstillatelse kan ikke endres for en arkivert eller avbrutt medvirkende.",
    );
  }
  if (
    participant.is_minor !== true &&
    input.request.status !== "not_required"
  ) {
    throw new WorkspaceParticipantClearanceError(
      409,
      "work_permit_not_applicable",
      "Arbeidstillatelse kan bare klareres for en mindreårig.",
    );
  }
  if (input.request.status === "approved" && !input.request.evidenceReference) {
    throw new WorkspaceParticipantClearanceError(
      400,
      "work_permit_evidence_required",
      "Godkjent arbeidstillatelse krever en sikker bevisreferanse.",
    );
  }

  const previousStatus = String(participant.work_permit_status);
  const newVersion = currentVersion + 1;
  const updated = await input.db.query(
    `UPDATE workspace_project_participants
        SET work_permit_status = $5, updated_by = $6, version = version + 1
      WHERE organization_id = $1 AND project_id = $2 AND id = $3::uuid
        AND version = $4 AND archived_at IS NULL
      RETURNING id::text, is_minor, work_permit_status, workflow_status,
                version, updated_at, archived_at`,
    [
      input.access.organizationId,
      input.access.projectId,
      input.participantId,
      currentVersion,
      input.request.status,
      input.actorUserId,
    ],
  );
  if (updated.rowCount !== 1) {
    throw new WorkspaceParticipantClearanceError(
      409,
      "version_conflict",
      "Medvirkende er endret av noen andre.",
    );
  }

  const event = await input.db.query(
    `INSERT INTO workspace_participant_events
       (organization_id, project_id, participant_id, event_type, actor_type,
        actor_user_id, payload)
     VALUES ($1,$2,$3::uuid,'work_permit_status_changed','user',$4,$5::jsonb)
     RETURNING id::text, actor_user_id, payload, occurred_at`,
    [
      input.access.organizationId,
      input.access.projectId,
      input.participantId,
      input.actorUserId,
      JSON.stringify({
        schemaVersion: 1,
        previousStatus,
        status: input.request.status,
        evidenceReference: input.request.evidenceReference ?? null,
        note: input.request.note ?? null,
        participantVersion: newVersion,
        ...(input.auditPayload ?? {}),
      }),
    ],
  );
  if (event.rowCount !== 1) {
    throw new WorkspaceParticipantClearanceError(
      500,
      "work_permit_audit_failed",
      "Arbeidstillatelsen kunne ikke loggføres.",
    );
  }

  const change = mapChange(event.rows[0] as Record<string, unknown>);
  return {
    clearance: stateFrom(
      input.participantId,
      updated.rows[0] as Record<string, unknown>,
      change,
    ),
    change,
  };
}
