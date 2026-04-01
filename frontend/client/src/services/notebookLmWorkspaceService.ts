import { apiRequest } from '@/lib/queryClient';

export const NOTEBOOK_LM_HOME_URL = 'https://notebooklm.google.com/';

export type NotebookLmWorkspaceScope = {
  userId?: string;
  meetingId?: string;
  projectId?: string;
  clientId?: string;
  profession?: string;
  projectTitle?: string;
  clientName?: string;
  clientEmail?: string;
  latestMeetingTitle?: string;
};

export type NotebookLmSourceDocument = {
  meetingId: string | null;
  meetingTitle: string | null;
  meetingDate: string | null;
  meetingType: string | null;
  googleDocId: string | null;
  googleDocUrl: string | null;
  clientVisible: boolean;
};

export type NotebookLmWorkspaceSummary = {
  id: string;
  workspaceKey: string;
  title: string;
  description: string | null;
  projectId: string | null;
  clientId: string | null;
  profession: string | null;
  driveFolderId: string | null;
  driveFolderName: string | null;
  driveFolderUrl: string | null;
  workspaceDocumentId: string | null;
  workspaceDocumentUrl: string | null;
  latestMeetingId: string | null;
  meetingNoteCount: number;
  sourceDocumentIds: string[];
  lastSyncedAt: string | null;
  metadata: Record<string, unknown>;
};

export type NotebookLmWorkspaceStatus = {
  connected: boolean;
  googleEmail: string | null;
  notebookLmUrl: string;
  workspaceReady: boolean;
  syncEligible: boolean;
  reason: string | null;
  scope: {
    projectId: string | null;
    clientId: string | null;
    profession: string | null;
    meetingId: string | null;
    projectTitle: string | null;
    clientName: string | null;
  };
  meetingNoteCount: number;
  sourceDocumentCount: number;
  latestMeetingId: string | null;
  sourceDocuments: NotebookLmSourceDocument[];
  workspace: NotebookLmWorkspaceSummary | null;
};

function toQueryString(scope: NotebookLmWorkspaceScope): string {
  const params = new URLSearchParams();
  Object.entries(scope).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      params.set(key, value.trim());
    }
  });
  return params.toString();
}

export const notebookLmWorkspaceService = {
  async getStatus(scope: NotebookLmWorkspaceScope): Promise<NotebookLmWorkspaceStatus> {
    const query = toQueryString(scope);
    return apiRequest(`/api/notebooklm/workspace/status${query ? `?${query}` : ''}`) as Promise<NotebookLmWorkspaceStatus>;
  },

  async sync(scope: NotebookLmWorkspaceScope): Promise<NotebookLmWorkspaceStatus> {
    return apiRequest('/api/notebooklm/workspace/sync', {
      method: 'POST',
      body: scope,
    }) as Promise<NotebookLmWorkspaceStatus>;
  },

  openNotebookLm(url?: string | null): void {
    window.open(url || NOTEBOOK_LM_HOME_URL, '_blank', 'noopener,noreferrer');
  },
};
