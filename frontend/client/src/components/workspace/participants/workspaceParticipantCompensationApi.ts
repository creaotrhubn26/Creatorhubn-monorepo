import { apiRequest } from "@/lib/queryClient";
import {
  workspaceParticipantCompensationCurrentPath,
  workspaceParticipantCompensationHistoryPath,
  workspaceParticipantCompensationPath,
  type WorkspaceParticipantCompensationCreateResponse,
  type WorkspaceParticipantCompensationCurrentResponse,
  type WorkspaceParticipantCompensationHistoryResponse,
  type WorkspaceParticipantCompensationRequest,
} from "@shared/workspace-participant-compensation";

export class WorkspaceParticipantCompensationApiError extends Error {
  readonly status?: number;
  readonly code: string;
  readonly details: unknown;

  constructor(args: {
    message: string;
    status?: number;
    code?: string;
    details?: unknown;
  }) {
    super(args.message);
    this.name = "WorkspaceParticipantCompensationApiError";
    this.status = args.status;
    this.code = args.code ?? "unknown";
    this.details = args.details ?? null;
  }
}

function toCompensationApiError(
  error: unknown,
): WorkspaceParticipantCompensationApiError {
  if (error instanceof WorkspaceParticipantCompensationApiError) return error;
  const source =
    error && typeof error === "object"
      ? (error as { message?: unknown; status?: unknown; details?: unknown })
      : null;
  const details =
    source?.details && typeof source.details === "object"
      ? (source.details as Record<string, unknown>)
      : null;
  return new WorkspaceParticipantCompensationApiError({
    message: String(
      details?.message ??
        source?.message ??
        "Kunne ikke kontakte honorartjenesten.",
    ),
    status: typeof source?.status === "number" ? source.status : undefined,
    code:
      typeof details?.error === "string"
        ? details.error
        : typeof details?.code === "string"
          ? details.code
          : "unknown",
    details,
  });
}

async function compensationRequest<T>(
  path: string,
  options?: Parameters<typeof apiRequest>[1],
): Promise<T> {
  try {
    return (await apiRequest(path, options)) as T;
  } catch (error) {
    throw toCompensationApiError(error);
  }
}

export const workspaceParticipantCompensationApi = {
  current(
    projectId: string,
    participantId: string,
  ): Promise<WorkspaceParticipantCompensationCurrentResponse> {
    return compensationRequest(
      workspaceParticipantCompensationCurrentPath(projectId, participantId),
    );
  },

  history(
    projectId: string,
    participantId: string,
  ): Promise<WorkspaceParticipantCompensationHistoryResponse> {
    return compensationRequest(
      workspaceParticipantCompensationHistoryPath(projectId, participantId),
    );
  },

  createVersion(
    projectId: string,
    participantId: string,
    input: WorkspaceParticipantCompensationRequest,
  ): Promise<WorkspaceParticipantCompensationCreateResponse> {
    return compensationRequest(
      workspaceParticipantCompensationPath(projectId, participantId),
      {
        method: "POST",
        body: input as unknown as Record<string, unknown>,
      },
    );
  },
};

export function workspaceParticipantCompensationError(
  error: unknown,
): WorkspaceParticipantCompensationApiError {
  return toCompensationApiError(error);
}
