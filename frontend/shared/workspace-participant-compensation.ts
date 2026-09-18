import type { WorkspaceParticipantAccess } from "./workspace-project-participants";

export const WORKSPACE_PARTICIPANT_COMPENSATION_SOURCE =
  "workspace-participant-compensation" as const;

export const isWorkspaceParticipantCompensationMetadata = (
  value: unknown,
): boolean => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return (
    (value as Record<string, unknown>).source ===
    WORKSPACE_PARTICIPANT_COMPENSATION_SOURCE
  );
};

/**
 * Public contract for project-scoped compensation of an external Workspace
 * participant. These records do not grant an account, team seat, or access.
 */
export type WorkspaceParticipantCompensationType =
  | "hourly"
  | "fixed"
  | "unpaid"
  | "day_rate"
  | "share";

export type WorkspaceParticipantCompensationStatus =
  | "draft"
  | "active"
  | "superseded"
  | "archived";

export type WorkspaceParticipantCompensationSplitSheetStatus =
  | "draft"
  | "pending_signatures"
  | "completed"
  | "archived";

interface WorkspaceParticipantCompensationRequestBase {
  /** UUID generated once by the caller and reused verbatim for safe retries. */
  idempotencyKey: string;
  /** null means that the caller expects no current compensation version. */
  expectedCurrentVersion: number | null;
  note?: string | null;
}

export interface WorkspaceParticipantHourlyCompensationRequest extends WorkspaceParticipantCompensationRequestBase {
  compensationType: "hourly";
  hourlyRate: number;
  estimatedHours: number;
  currency: string;
}

export interface WorkspaceParticipantFixedCompensationRequest extends WorkspaceParticipantCompensationRequestBase {
  compensationType: "fixed";
  fixedAmount: number;
  currency: string;
}

export interface WorkspaceParticipantUnpaidCompensationRequest extends WorkspaceParticipantCompensationRequestBase {
  compensationType: "unpaid";
}

export type WorkspaceParticipantCompensationRequest =
  | WorkspaceParticipantHourlyCompensationRequest
  | WorkspaceParticipantFixedCompensationRequest
  | WorkspaceParticipantUnpaidCompensationRequest;

export interface WorkspaceParticipantCompensation {
  id: string;
  participantId: string;
  projectId: string;
  version: number;
  compensationType: WorkspaceParticipantCompensationType;
  status: WorkspaceParticipantCompensationStatus;
  hourlyRate: number | null;
  estimatedHours: number | null;
  dayRate: number | null;
  fixedAmount: number | null;
  sharePercentage: number | null;
  estimatedAmount: number | null;
  currency: string;
  note: string | null;
  splitSheetId: string | null;
  splitSheetStatus: WorkspaceParticipantCompensationSplitSheetStatus | null;
  supersedesCompensationId: string | null;
  createdAt: string;
  updatedAt: string;
  supersededAt: string | null;
  archivedAt: string | null;
}

export interface WorkspaceParticipantCompensationCurrentResponse {
  compensation: WorkspaceParticipantCompensation | null;
  access: WorkspaceParticipantAccess;
}

export interface WorkspaceParticipantCompensationHistoryResponse {
  compensations: WorkspaceParticipantCompensation[];
  access: WorkspaceParticipantAccess;
}

export interface WorkspaceParticipantCompensationCreateResponse {
  compensation: WorkspaceParticipantCompensation;
  replayed: boolean;
  access: WorkspaceParticipantAccess;
}

export const workspaceParticipantCompensationPath = (
  projectId: string,
  participantId: string,
): string =>
  `/api/projects/${encodeURIComponent(projectId)}/participants/${encodeURIComponent(participantId)}/compensation`;

export const workspaceParticipantCompensationCurrentPath = (
  projectId: string,
  participantId: string,
): string =>
  `${workspaceParticipantCompensationPath(projectId, participantId)}/current`;

export const workspaceParticipantCompensationHistoryPath = (
  projectId: string,
  participantId: string,
): string =>
  `${workspaceParticipantCompensationPath(projectId, participantId)}/history`;
