import { useQuery } from "@tanstack/react-query";
import type { WorkspaceParticipantAccess } from "@shared/workspace-project-participants";
import {
  workspaceParticipantsApi,
  workspaceParticipantsError,
  type WorkspaceParticipantsApiError,
} from "./workspaceParticipantsApi";

export interface WorkspaceParticipantsAccessState {
  access: WorkspaceParticipantAccess | null;
  loading: boolean;
  error: WorkspaceParticipantsApiError | null;
}

/**
 * Project-bound access is authoritative. Enterprise membership by itself is
 * insufficient because one user can be associated with another organization
 * than the organization that owns this project.
 */
export function useWorkspaceParticipantsAccess(
  projectId: string,
  enabled: boolean,
): WorkspaceParticipantsAccessState {
  const query = useQuery<
    WorkspaceParticipantAccess,
    WorkspaceParticipantsApiError
  >({
    queryKey: ["/api/projects", projectId, "participants", "access"],
    enabled: enabled && !!projectId && projectId !== "sample",
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      try {
        return await workspaceParticipantsApi.getAccess(projectId);
      } catch (error) {
        throw workspaceParticipantsError(error);
      }
    },
  });

  return {
    access: query.data ?? null,
    loading: enabled && query.isLoading,
    error: query.error ?? null,
  };
}
