import { apiRequest, getAuthHeader } from '@/lib/queryClient';

export type LightroomRecentRun = {
  id: string;
  status: string;
  exportId: string | null;
  driveFileId: string | null;
  showcaseItemId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string | null;
};

export type LightroomIntegrationStatus = {
  connected: boolean;
  pluginVersion: string;
  tokenPreview: string | null;
  workspaceConnected: boolean;
  googleEmail: string | null;
  storedScopes: string[];
  workspaceError: string | null;
  workspaceSource?: string | null;
  workspaceWarning?: string | null;
  driveRootFolderId: string | null;
  driveRootFolderName: string | null;
  driveRootFolderUrl: string | null;
  lastSyncAt: string | null;
  lastShowcaseItemId: string | null;
  lastDriveFileId: string | null;
  lastError: string | null;
  syncStatus: string;
  configuration: Record<string, unknown>;
  packageDownloadUrl: string;
  apiBaseUrl: string;
  recentRuns: LightroomRecentRun[];
};

export type LightroomTokenResponse = {
  token: string;
  tokenPreview: string | null;
  pluginVersion: string;
  workspaceConnected: boolean;
  googleEmail: string | null;
  workspaceSource?: string | null;
  workspaceWarning?: string | null;
  apiBaseUrl: string;
};

export type LightroomExportResult = {
  success: true;
  exportId: string;
  showcaseItemId: string;
  driveFileId: string;
  driveFolderId: string;
  driveFolderName: string;
  driveRootFolderId: string;
  driveRootFolderName: string;
  driveRootFolderUrl: string | null;
  driveWebViewLink: string | null;
  driveWebContentLink: string | null;
  imageUrl: string;
  thumbnailUrl: string;
  title: string;
  category: string;
};

async function downloadBlob(url: string, filename: string): Promise<void> {
  const authHeaders = await getAuthHeader();
  const response = await fetch(url, {
    headers: authHeaders,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${response.status}: ${errorText || 'Download failed'}`);
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  window.URL.revokeObjectURL(objectUrl);
  document.body.removeChild(link);
}

function getStoredAuthUser(): { id: string | null; email: string | null } {
  try {
    const storedUserRaw = localStorage.getItem('creatorhub_auth_user');
    const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
    const idCandidate = storedUser?.id || storedUser?.userId || localStorage.getItem('userId') || null;
    const emailCandidate = storedUser?.email || storedUser?.userEmail || null;

    return {
      id: typeof idCandidate === 'string' && idCandidate.trim().length > 0 ? idCandidate.trim() : null,
      email: typeof emailCandidate === 'string' && emailCandidate.trim().length > 0
        ? emailCandidate.trim().toLowerCase()
        : null,
    };
  } catch {
    return { id: null, email: null };
  }
}

export const lightroomIntegrationService = {
  async getStatus(): Promise<LightroomIntegrationStatus> {
    return apiRequest('/api/lightroom/status') as Promise<LightroomIntegrationStatus>;
  },

  async rotateToken(): Promise<LightroomTokenResponse> {
    return apiRequest('/api/lightroom/token', {
      method: 'POST',
      body: { rotate: true },
    }) as Promise<LightroomTokenResponse>;
  },

  async ensureToken(): Promise<LightroomTokenResponse> {
    return apiRequest('/api/lightroom/token', {
      method: 'POST',
      body: { rotate: false },
    }) as Promise<LightroomTokenResponse>;
  },

  async downloadPluginPackage(rotate = false): Promise<void> {
    const suffix = rotate ? '?rotate=true' : '';
    await downloadBlob(
      `/api/lightroom/download-plugin${suffix}`,
      'CreatorHubNorge-Lightroom-Plugin.zip',
    );
  },

  async runSmokeExport(): Promise<LightroomExportResult> {
    return apiRequest('/api/lightroom/smoke-export', {
      method: 'POST',
      body: {},
    }) as Promise<LightroomExportResult>;
  },

  async startGoogleWorkspaceReconnect(): Promise<void> {
    const authUser = getStoredAuthUser();
    const response = await apiRequest('/api/role-room/google/oauth/start', {
      method: 'POST',
      body: {
        mode: 'link',
        browserOrigin: window.location.origin,
        returnPath: `${window.location.pathname}${window.location.search}`,
        targetConnectionUserId: authUser.id,
        targetConnectionEmail: authUser.email,
      },
    }) as { authorizationUrl?: string };

    if (!response.authorizationUrl) {
      throw new Error('Kunne ikke starte Google Workspace-tilkoblingen.');
    }

    window.location.assign(response.authorizationUrl);
  },
};
