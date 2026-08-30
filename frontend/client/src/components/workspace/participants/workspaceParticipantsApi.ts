import { apiRequest } from "@/lib/queryClient";
import type {
  WorkspaceParticipantAccess,
  WorkspaceParticipantBulkResponse,
  WorkspaceParticipantCreateInput,
  WorkspaceParticipantType,
  WorkspaceParticipantListResponse,
  WorkspaceParticipantPatch,
  WorkspaceParticipantWorkflowStatus,
  WorkspaceProjectParticipant,
} from "@shared/workspace-project-participants";

export type WorkspaceParticipantsErrorCode =
  | "auth_required"
  | "authentication_unavailable"
  | "enterprise_required"
  | "enterprise_feature_denied"
  | "project_access_denied"
  | "project_scope_owner_required"
  | "participant_manage_denied"
  | "participant_authorization_unavailable"
  | "participant_persistence_failed"
  | "project_not_found"
  | "participant_not_found"
  | "ambiguous_enterprise_scope"
  | "project_scope_conflict"
  | "version_conflict"
  | "workflow_transition_invalid"
  | "legal_configuration_locked"
  | "requirements_manage_denied"
  | "duplicate_participant"
  | "validation_error"
  | "workspace_participants_unavailable"
  | "unknown";

export class WorkspaceParticipantsApiError extends Error {
  readonly status?: number;
  readonly code: WorkspaceParticipantsErrorCode;
  readonly details: Record<string, unknown> | null;

  constructor(args: {
    message: string;
    status?: number;
    code?: WorkspaceParticipantsErrorCode;
    details?: Record<string, unknown> | null;
  }) {
    super(args.message);
    this.name = "WorkspaceParticipantsApiError";
    this.status = args.status;
    this.code = args.code ?? "unknown";
    this.details = args.details ?? null;
  }
}

function toApiError(error: unknown): WorkspaceParticipantsApiError {
  if (error instanceof WorkspaceParticipantsApiError) return error;
  const source =
    error && typeof error === "object"
      ? (error as { message?: unknown; status?: unknown; details?: unknown })
      : null;
  const details =
    source?.details && typeof source.details === "object"
      ? (source.details as Record<string, unknown>)
      : null;
  const codeValue =
    typeof details?.error === "string"
      ? details.error
      : typeof details?.code === "string"
        ? details.code
        : "unknown";
  return new WorkspaceParticipantsApiError({
    message: String(
      details?.message ?? source?.message ?? "Kunne ikke kontakte tjenesten.",
    ),
    status: typeof source?.status === "number" ? source.status : undefined,
    code: codeValue as WorkspaceParticipantsErrorCode,
    details,
  });
}

async function request<T>(
  url: string,
  options?: Parameters<typeof apiRequest>[1],
): Promise<T> {
  try {
    return (await apiRequest(url, options)) as T;
  } catch (error) {
    throw toApiError(error);
  }
}

const projectParticipantsPath = (projectId: string) =>
  `/api/projects/${encodeURIComponent(projectId)}/participants`;

export const workspaceParticipantsApi = {
  async getAccess(projectId: string): Promise<WorkspaceParticipantAccess> {
    const response = await request<{ access: WorkspaceParticipantAccess }>(
      `${projectParticipantsPath(projectId)}/access`,
    );
    return response.access;
  },

  async list(
    projectId: string,
    options?: {
      includeArchived?: boolean;
      workflowStatus?: WorkspaceParticipantWorkflowStatus;
      participantType?: WorkspaceParticipantType;
      search?: string;
    },
  ): Promise<WorkspaceParticipantListResponse> {
    const params = new URLSearchParams();
    if (options?.includeArchived) params.set("includeArchived", "true");
    if (options?.workflowStatus)
      params.set("workflowStatus", options.workflowStatus);
    if (options?.participantType)
      params.set("participantType", options.participantType);
    if (options?.search?.trim()) params.set("search", options.search.trim());
    const query = params.toString();
    return request<WorkspaceParticipantListResponse>(
      `${projectParticipantsPath(projectId)}${query ? `?${query}` : ""}`,
    );
  },

  async create(
    projectId: string,
    input: WorkspaceParticipantCreateInput,
  ): Promise<WorkspaceProjectParticipant> {
    const response = await request<{
      participant: WorkspaceProjectParticipant;
      access: WorkspaceParticipantAccess;
    }>(projectParticipantsPath(projectId), {
      method: "POST",
      body: input as unknown as Record<string, unknown>,
    });
    return response.participant;
  },

  async bulkCreate(
    projectId: string,
    participants: WorkspaceParticipantCreateInput[],
  ): Promise<WorkspaceParticipantBulkResponse> {
    return request<WorkspaceParticipantBulkResponse>(
      `${projectParticipantsPath(projectId)}/bulk`,
      { method: "POST", body: { participants } },
    );
  },

  async update(
    projectId: string,
    participantId: string,
    patch: WorkspaceParticipantPatch,
  ): Promise<WorkspaceProjectParticipant> {
    const response = await request<{
      participant: WorkspaceProjectParticipant;
      access: WorkspaceParticipantAccess;
    }>(
      `${projectParticipantsPath(projectId)}/${encodeURIComponent(participantId)}`,
      {
        method: "PATCH",
        body: patch as unknown as Record<string, unknown>,
      },
    );
    return response.participant;
  },

  async archive(
    projectId: string,
    participantId: string,
    version: number,
  ): Promise<void> {
    await request(
      `${projectParticipantsPath(projectId)}/${encodeURIComponent(participantId)}/archive`,
      { method: "POST", body: { version } },
    );
  },
};

export function workspaceParticipantsError(
  error: unknown,
): WorkspaceParticipantsApiError {
  return toApiError(error);
}
