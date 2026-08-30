import type { WorkspaceParticipantAccess } from "./workspace-project-participants";

export type WorkspaceParticipantWorkPermitClearanceStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "not_required";

export interface WorkspaceParticipantWorkPermitClearanceRequest {
  version: number;
  status: WorkspaceParticipantWorkPermitClearanceStatus;
  evidenceReference?: string | null;
  note?: string | null;
}

export interface WorkspaceParticipantWorkPermitClearanceChange {
  id: string;
  previousStatus: string;
  status: WorkspaceParticipantWorkPermitClearanceStatus;
  evidenceReference: string | null;
  note: string | null;
  actorUserId: string;
  participantVersion: number;
  occurredAt: string;
}

export interface WorkspaceParticipantWorkPermitClearanceState {
  participantId: string;
  status: string;
  participantVersion: number;
  isMinor: boolean;
  updatedAt: string;
  latestChange: WorkspaceParticipantWorkPermitClearanceChange | null;
}

export interface WorkspaceParticipantWorkPermitClearanceResponse {
  clearance: WorkspaceParticipantWorkPermitClearanceState;
  history: WorkspaceParticipantWorkPermitClearanceChange[];
  access: WorkspaceParticipantAccess;
}

export interface WorkspaceParticipantWorkPermitClearanceUpdateResponse {
  clearance: WorkspaceParticipantWorkPermitClearanceState;
  change: WorkspaceParticipantWorkPermitClearanceChange;
  access: WorkspaceParticipantAccess;
}

/**
 * Detailed clearance evidence is restricted to project owners and Enterprise
 * admins. Participant managers use the roster's read-only workPermitStatus.
 */
export const workspaceParticipantWorkPermitClearancePath = (
  projectId: string,
  participantId: string,
): string =>
  `/api/projects/${encodeURIComponent(projectId)}/participants/${encodeURIComponent(participantId)}/work-permit-clearance`;
