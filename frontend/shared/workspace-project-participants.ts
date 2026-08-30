/**
 * Public contract for the standalone Workspace participant roster.
 *
 * This domain belongs to CreatorHub Workspace. It deliberately has no
 * dependency on Role Room, casting candidates, talent profiles or team seats.
 */

export const WORKSPACE_PROJECT_PARTICIPANTS_FEATURE_ID =
  "workspace-project-participants" as const;

export type WorkspaceParticipantType =
  | "extra"
  | "model"
  | "featured"
  | "interviewee"
  | "other";

export type WorkspaceParticipantEngagementType =
  | "undecided"
  | "employee"
  | "contractor"
  | "agency"
  | "volunteer";

export type WorkspaceParticipantWorkflowStatus =
  | "draft"
  | "invited"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "archived";

export type WorkspaceParticipantRequirementStatus =
  | "not_required"
  | "required"
  | "pending"
  | "approved"
  | "rejected";

export type WorkspaceParticipantReadinessBlocker =
  | "contract_required"
  | "contract_compensation_stale"
  | "media_consent_required"
  | "compensation_required"
  | "guardian_approval_required"
  | "work_permit_required"
  | "participant_archived"
  | "participant_cancelled"
  | string;

export interface WorkspaceParticipantReadiness {
  ready: boolean;
  blockers: WorkspaceParticipantReadinessBlocker[];
}

export interface WorkspaceProjectParticipant {
  id: string;
  projectId: string;
  organizationId: string;
  externalReference: string | null;
  displayName: string;
  email: string | null;
  phone: string | null;
  participantType: WorkspaceParticipantType;
  roleLabel: string | null;
  engagementType: WorkspaceParticipantEngagementType;
  workflowStatus: WorkspaceParticipantWorkflowStatus;
  isMinor: boolean;
  guardianStatus: WorkspaceParticipantRequirementStatus;
  workPermitStatus: WorkspaceParticipantRequirementStatus;
  requiresContract: boolean;
  requiresMediaConsent: boolean;
  requiresCompensation: boolean;
  notes: string | null;
  metadata: Record<string, unknown>;
  readiness: WorkspaceParticipantReadiness;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  version: number;
}

export interface WorkspaceParticipantAccess {
  projectId: string;
  projectOwnerUserId: string;
  organizationId: string;
  enterprise: true;
  featureId: typeof WORKSPACE_PROJECT_PARTICIPANTS_FEATURE_ID;
  canView: boolean;
  canManage: boolean;
  canConfigureRequirements: boolean;
  scopeBound: boolean;
  role:
    | "project_owner"
    | "enterprise_admin"
    | "participant_manager"
    | "participant_viewer";
}

export interface WorkspaceParticipantSummary {
  total: number;
  ready: number;
  blocked: number;
  archived: number;
}

export interface WorkspaceParticipantInput {
  externalReference?: string | null;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  participantType?: WorkspaceParticipantType;
  roleLabel?: string | null;
  engagementType?: WorkspaceParticipantEngagementType;
  workflowStatus?: WorkspaceParticipantWorkflowStatus;
  isMinor?: boolean;
  requiresContract?: boolean;
  requiresMediaConsent?: boolean;
  requiresCompensation?: boolean;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export type WorkspaceParticipantCreateInput = Omit<
  WorkspaceParticipantInput,
  "workflowStatus"
>;

export interface WorkspaceParticipantPatch extends Partial<WorkspaceParticipantInput> {
  version: number;
}

export interface WorkspaceParticipantListResponse {
  participants: WorkspaceProjectParticipant[];
  summary: WorkspaceParticipantSummary;
  access: WorkspaceParticipantAccess;
}

export interface WorkspaceParticipantBulkResponse {
  participants: WorkspaceProjectParticipant[];
  createdCount: number;
  existingCount: number;
  access: WorkspaceParticipantAccess;
}
