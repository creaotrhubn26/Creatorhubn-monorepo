/**
 * useWorklogCollaboration Hook
 * Invites project collaborators from worklog surfaces
 */

import { useState, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';

export interface CollaboratorEmail {
  email: string;
  name?: string;
  role?: 'viewer' | 'editor';
}

export function useWorklogCollaboration() {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  /**
   * Invite collaborators to the project from a worklog context
   */
  const addCollaborators = useCallback(async (
    projectId: string,
    worklogId: string,
    emails: string[]
  ) => {
    setAdding(true);
    setError(null);

    try {
      const normalizedProjectId = String(projectId || '').trim();
      if (!normalizedProjectId) {
        throw new Error('Project id is required to invite collaborators');
      }

      const result = await Promise.all(
        emails.map((email) =>
          apiRequest(`/api/projects/${encodeURIComponent(normalizedProjectId)}/collaborators/invite`, {
            method: 'POST',
            body: JSON.stringify({
              email,
              role: 'viewer',
              source: 'worklog',
              worklogId,
            }),
          }),
        ),
      );

      // Refresh worklog queries
      await queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/projects', normalizedProjectId, 'collaborators'] });

      setAdding(false);
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to add collaborators');
      setAdding(false);
      throw err;
    }
  }, [queryClient]);

  /**
   * Remove collaborator from the linked project collaboration list
   */
  const removeCollaborator = useCallback(async (
    projectId: string,
    collaboratorId: string
  ) => {
    setAdding(true);
    setError(null);

    try {
      const normalizedProjectId = String(projectId || '').trim();
      if (!normalizedProjectId) {
        throw new Error('Project id is required to remove collaborators');
      }

      const result = await apiRequest(
        `/api/projects/${encodeURIComponent(normalizedProjectId)}/collaborators/${encodeURIComponent(collaboratorId)}`,
        {
          method: 'DELETE',
        },
      );

      await queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/projects', normalizedProjectId, 'collaborators'] });

      setAdding(false);
      return result;
    } catch (err: any) {
      setError(err.message ||'Failed to remove collaborator');
      setAdding(false);
      throw err;
    }
  }, [queryClient]);

  /**
   * Share worklog context by inviting collaborators to the project
   */
  const shareViaEmail = useCallback(async (
    projectId: string,
    worklogId: string,
    emails: string[],
    message?: string
  ) => {
    return addCollaborators(projectId, worklogId, emails);
  }, [addCollaborators]);

  return {
    addCollaborators,
    removeCollaborator,
    shareViaEmail,
    adding,
    error
  };
}

