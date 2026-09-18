import { apiRequest } from "@/lib/queryClient";
import type {
  WorkspaceParticipantDocumentIssueInput,
  WorkspaceParticipantDocumentListResponse,
  WorkspaceParticipantDocumentMutationResponse,
} from "@shared/workspace-participant-documents";
import { workspaceParticipantDocumentsError } from "./workspaceParticipantDocumentErrors";

export {
  WorkspaceParticipantDocumentsApiError,
  workspaceParticipantDocumentsError,
} from "./workspaceParticipantDocumentErrors";

async function managerRequest<T>(
  path: string,
  options?: Parameters<typeof apiRequest>[1],
): Promise<T> {
  try {
    return (await apiRequest(path, options)) as T;
  } catch (error) {
    throw workspaceParticipantDocumentsError(error);
  }
}

const documentsPath = (projectId: string, participantId: string): string =>
  `/api/projects/${encodeURIComponent(projectId)}/participants/${encodeURIComponent(participantId)}/documents`;

export const workspaceParticipantDocumentsApi = {
  list(
    projectId: string,
    participantId: string,
  ): Promise<WorkspaceParticipantDocumentListResponse> {
    return managerRequest(documentsPath(projectId, participantId));
  },

  issue(
    projectId: string,
    participantId: string,
    input: WorkspaceParticipantDocumentIssueInput,
  ): Promise<WorkspaceParticipantDocumentMutationResponse> {
    return managerRequest(`${documentsPath(projectId, participantId)}/issue`, {
      method: "POST",
      body: input as unknown as Record<string, unknown>,
    });
  },

  reissueLink(
    projectId: string,
    participantId: string,
    documentId: string,
  ): Promise<WorkspaceParticipantDocumentMutationResponse> {
    return managerRequest(
      `${documentsPath(projectId, participantId)}/${encodeURIComponent(documentId)}/reissue-link`,
      { method: "POST", body: {} },
    );
  },
};
