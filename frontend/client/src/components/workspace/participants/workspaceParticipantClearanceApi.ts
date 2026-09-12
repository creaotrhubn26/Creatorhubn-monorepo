import { apiRequest } from "@/lib/queryClient";
import {
  workspaceParticipantWorkPermitClearancePath,
  type WorkspaceParticipantWorkPermitClearanceRequest,
  type WorkspaceParticipantWorkPermitClearanceResponse,
  type WorkspaceParticipantWorkPermitClearanceUpdateResponse,
} from "@shared/workspace-participant-clearance";

export class WorkspaceParticipantClearanceApiError extends Error {
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
    this.name = "WorkspaceParticipantClearanceApiError";
    this.status = args.status;
    this.code = args.code ?? "unknown";
    this.details = args.details ?? null;
  }
}

export function workspaceParticipantClearanceError(
  error: unknown,
): WorkspaceParticipantClearanceApiError {
  if (error instanceof WorkspaceParticipantClearanceApiError) return error;
  const source =
    error && typeof error === "object"
      ? (error as { message?: unknown; status?: unknown; details?: unknown })
      : null;
  const details =
    source?.details && typeof source.details === "object"
      ? (source.details as Record<string, unknown>)
      : null;
  return new WorkspaceParticipantClearanceApiError({
    message: String(
      details?.message ??
        source?.message ??
        "Arbeidstillatelsen kunne ikke behandles.",
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

async function clearanceRequest<T>(
  path: string,
  options?: Parameters<typeof apiRequest>[1],
): Promise<T> {
  try {
    return (await apiRequest(path, options)) as T;
  } catch (error) {
    throw workspaceParticipantClearanceError(error);
  }
}

export const workspaceParticipantClearanceApi = {
  get(
    projectId: string,
    participantId: string,
  ): Promise<WorkspaceParticipantWorkPermitClearanceResponse> {
    return clearanceRequest(
      workspaceParticipantWorkPermitClearancePath(projectId, participantId),
    );
  },

  update(
    projectId: string,
    participantId: string,
    input: WorkspaceParticipantWorkPermitClearanceRequest,
  ): Promise<WorkspaceParticipantWorkPermitClearanceUpdateResponse> {
    return clearanceRequest(
      workspaceParticipantWorkPermitClearancePath(projectId, participantId),
      {
        method: "POST",
        body: input as unknown as Record<string, unknown>,
      },
    );
  },
};
