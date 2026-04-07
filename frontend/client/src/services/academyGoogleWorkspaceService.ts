import { apiRequest } from "@/lib/queryClient";

export type AcademyGoogleWorkspaceConnectionState =
  | "disconnected"
  | "connected"
  | "expired"
  | "error";

export interface AcademyGoogleWorkspaceConnection {
  id: string;
  userId: string;
  googleEmail?: string | null;
  scopes: string[];
  state: AcademyGoogleWorkspaceConnectionState;
  expiryDate?: string | null;
}

export interface AcademyGoogleWorkspaceStatus {
  configured: boolean;
  missing: string[];
  state: AcademyGoogleWorkspaceConnectionState;
  connection: AcademyGoogleWorkspaceConnection | null;
}

export interface AcademyGoogleDriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: number | null;
  modifiedTime?: string | null;
  iconLink?: string | null;
  thumbnailLink?: string | null;
  webViewLink?: string | null;
  webContentLink?: string | null;
  version?: number | null;
  fileExtension?: string | null;
  parents?: string[];
}

export interface AcademyGoogleDriveFilesResponse {
  files?: AcademyGoogleDriveFileItem[];
}

export interface AcademyGoogleDriveShareResponse
  extends AcademyGoogleDriveFileItem {
  accessState?: string | null;
  shareMode?: string | null;
  sharingUpdated?: boolean;
}

const GOOGLE_DRIVE_SCOPES = new Set([
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.readonly",
]);

const GOOGLE_DOCS_SCOPE = "https://www.googleapis.com/auth/documents";

function readStoredAuthUser():
  | {
      id?: string;
      userId?: string;
      email?: string;
    }
  | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem("creatorhub_auth_user");
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object"
      ? {
          id: typeof parsed.id === "string" ? parsed.id : undefined,
          userId: typeof parsed.userId === "string" ? parsed.userId : undefined,
          email: typeof parsed.email === "string" ? parsed.email : undefined,
        }
      : null;
  } catch {
    return null;
  }
}

function buildQueryString(
  values: Record<string, string | number | null | undefined>,
): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }
    const normalized = String(value).trim();
    if (!normalized) {
      return;
    }
    params.set(key, normalized);
  });
  return params.toString();
}

export const academyGoogleWorkspaceService = {
  async getStatus(): Promise<AcademyGoogleWorkspaceStatus> {
    return apiRequest(
      "/api/creatorhub/google/status",
    ) as Promise<AcademyGoogleWorkspaceStatus>;
  },

  async startConnect(returnPath?: string): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    const storedUser = readStoredAuthUser();
    const response = (await apiRequest("/api/creatorhub/google/oauth/start", {
      method: "POST",
      body: {
        mode: "link",
        browserOrigin: window.location.origin,
        returnPath:
          returnPath ||
          `${window.location.pathname}${window.location.search}`,
        targetConnectionUserId:
          String(storedUser?.id || storedUser?.userId || "").trim() ||
          undefined,
        targetConnectionEmail:
          String(storedUser?.email || "").trim() || undefined,
      },
    })) as { authorizationUrl?: string };

    if (!response.authorizationUrl) {
      throw new Error("Kunne ikke starte Google-innloggingen.");
    }

    window.location.assign(response.authorizationUrl);
  },

  hasActiveConnection(status?: AcademyGoogleWorkspaceStatus | null): boolean {
    return status?.state === "connected";
  },

  hasDriveAccess(status?: AcademyGoogleWorkspaceStatus | null): boolean {
    return (
      status?.connection?.scopes?.some((scope) => GOOGLE_DRIVE_SCOPES.has(scope)) ||
      false
    );
  },

  hasDocsAccess(status?: AcademyGoogleWorkspaceStatus | null): boolean {
    return (
      status?.connection?.scopes?.includes(GOOGLE_DOCS_SCOPE) ||
      false
    );
  },

  async listDriveFiles(scope: {
    folderId?: string;
    search?: string;
    pageSize?: number;
  }): Promise<AcademyGoogleDriveFilesResponse> {
    const query = buildQueryString({
      folderId: scope.folderId,
      search: scope.search,
      pageSize: scope.pageSize,
    });
    return apiRequest(
      `/api/google/drive/files${query ? `?${query}` : ""}`,
    ) as Promise<AcademyGoogleDriveFilesResponse>;
  },

  async shareDriveFile(
    fileId: string,
    payload: {
      shareMode?: "private" | "recipient" | "domain" | "link";
      ensureAccessible?: boolean;
    } = {},
  ): Promise<AcademyGoogleDriveShareResponse> {
    return apiRequest(
      `/api/google/drive/files/${encodeURIComponent(fileId)}/share`,
      {
        method: "POST",
        body: {
          shareMode: payload.shareMode || "link",
          ensureAccessible: payload.ensureAccessible !== false,
        },
      },
    ) as Promise<AcademyGoogleDriveShareResponse>;
  },
};
