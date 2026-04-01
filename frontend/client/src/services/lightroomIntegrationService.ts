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

function buildLightroomUrl(pathname: string, userId?: string | null): string {
  const normalizedUserId = typeof userId === 'string' && userId.trim().length > 0 ? userId.trim() : null;
  if (!normalizedUserId) {
    return pathname;
  }

  const separator = pathname.includes('?') ? '&' : '?';
  return `${pathname}${separator}userId=${encodeURIComponent(normalizedUserId)}`;
}

function getStoredAuthUser(): { id: string | null; email: string | null } {
  try {
    const storedUserRaw = localStorage.getItem('creatorhub_auth_user');
    const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
    const idCandidate = storedUser?.id || storedUser?.userId || localStorage.getItem('userId') || null;
    const emailCandidate = storedUser?.email || storedUser?.userEmail || null;
    const resolvedUser = {
      id: typeof idCandidate === 'string' && idCandidate.trim().length > 0 ? idCandidate.trim() : null,
      email: typeof emailCandidate === 'string' && emailCandidate.trim().length > 0
        ? emailCandidate.trim().toLowerCase()
        : null,
    };

    if (resolvedUser.id || resolvedUser.email) {
      return resolvedUser;
    }

    return getDevFallbackAuthUser();
  } catch {
    return getDevFallbackAuthUser();
  }
}

function getDevFallbackAuthUser(): { id: string | null; email: string | null } {
  const isDevelopment = typeof window !== 'undefined'
    && (import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (!isDevelopment) {
    return { id: null, email: null };
  }

  return {
    id: 'local-admin',
    email: 'admin@local.dev',
  };
}

function resolveRequestedUserId(userId?: string | null): string | null {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  if (normalizedUserId && normalizedUserId.toLowerCase() !== 'guest') {
    return normalizedUserId;
  }

  const storedAuthUser = getStoredAuthUser();
  return storedAuthUser.id;
}

export const lightroomIntegrationService = {
  async getStatus(userId?: string): Promise<LightroomIntegrationStatus> {
    try {
      return await apiRequest(buildLightroomUrl('/api/lightroom/status', resolveRequestedUserId(userId))) as LightroomIntegrationStatus;
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error
        ? (error as { status?: unknown }).status
        : undefined;
      if (status === 401) {
        return {
          connected: false,
          pluginVersion: '1.0.0',
          tokenPreview: null,
          workspaceConnected: false,
          googleEmail: null,
          storedScopes: [],
          workspaceError: 'Brukeridentitet mangler.',
          workspaceSource: null,
          workspaceWarning: 'Logg inn eller velg bruker før Lightroom kobles til.',
          driveRootFolderId: null,
          driveRootFolderName: null,
          driveRootFolderUrl: null,
          lastSyncAt: null,
          lastShowcaseItemId: null,
          lastDriveFileId: null,
          lastError: null,
          syncStatus: 'idle',
          configuration: {},
          packageDownloadUrl: '/api/lightroom/download-plugin',
          apiBaseUrl: window.location.origin,
          recentRuns: [],
        };
      }

      throw error;
    }
  },

  async rotateToken(userId?: string): Promise<LightroomTokenResponse> {
    const resolvedUserId = resolveRequestedUserId(userId);
    return apiRequest('/api/lightroom/token', {
      method: 'POST',
      body: { rotate: true, userId: resolvedUserId },
    }) as Promise<LightroomTokenResponse>;
  },

  async ensureToken(userId?: string): Promise<LightroomTokenResponse> {
    const resolvedUserId = resolveRequestedUserId(userId);
    return apiRequest('/api/lightroom/token', {
      method: 'POST',
      body: { rotate: false, userId: resolvedUserId },
    }) as Promise<LightroomTokenResponse>;
  },

  async downloadPluginPackage(rotate = false, userId?: string): Promise<void> {
    const suffix = rotate ? '?rotate=true' : '';
    await downloadBlob(
      buildLightroomUrl(`/api/lightroom/download-plugin${suffix}`, resolveRequestedUserId(userId)),
      'CreatorHubNorge-Lightroom-Plugin.zip',
    );
  },

  async runSmokeExport(userId?: string): Promise<LightroomExportResult> {
    const resolvedUserId = resolveRequestedUserId(userId);
    return apiRequest('/api/lightroom/smoke-export', {
      method: 'POST',
      body: { userId: resolvedUserId },
    }) as Promise<LightroomExportResult>;
  },

  async startGoogleWorkspaceReconnect(userId?: string): Promise<void> {
    const authUser = getStoredAuthUser();
    const resolvedUserId = resolveRequestedUserId(userId);
    const targetConnectionEmail =
      authUser.email && !authUser.email.endsWith('@local.dev')
        ? authUser.email
        : null;
    const response = await apiRequest('/api/role-room/google/oauth/start', {
      method: 'POST',
      body: {
        mode: 'link',
        browserOrigin: window.location.origin,
        returnPath: `${window.location.pathname}${window.location.search}`,
        targetConnectionUserId: resolvedUserId,
        targetConnectionEmail,
      },
    }) as { authorizationUrl?: string };

    if (!response.authorizationUrl) {
      throw new Error('Kunne ikke starte Google Workspace-tilkoblingen.');
    }

    window.location.assign(response.authorizationUrl);
  },
};
