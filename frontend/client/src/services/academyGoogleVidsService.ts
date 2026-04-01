import { apiRequest } from "@/lib/queryClient";

export const ACADEMY_GOOGLE_VIDS_URL = "https://docs.google.com/videos/";

export type AcademyGoogleVidsSceneSnapshot = {
  id: string;
  title: string;
  objective?: string | null;
  recordingMode?: string | null;
  durationMinutes?: number | null;
  visualCue?: string | null;
  whyThisMode?: string | null;
  teleprompterScript?: string | null;
};

export type AcademyGoogleVidsWorkspaceSnapshot = {
  courseId: string;
  title: string;
  subtitle?: string | null;
  purpose?: string | null;
  audience?: string | null;
  transformation?: string | null;
  competencies: string[];
  skills: string[];
  problemsSolved: string[];
  learningJourney?: string | null;
  practiceDesign?: string | null;
  proofOfLearning?: string | null;
  readiness?: number | null;
  primaryMode?: string | null;
  totalDurationMinutes?: number | null;
  missingFields: string[];
  setupChecklist: string[];
  productionNotes: string[];
  starterPrompt?: string | null;
  brief?: string | null;
  teleprompterScript?: string | null;
  scenes: AcademyGoogleVidsSceneSnapshot[];
  locale?: string | null;
};

export type AcademyGoogleVidsSceneSummary = {
  id: string;
  title: string;
  recordingMode: string | null;
  durationMinutes: number | null;
};

export type AcademyGoogleVidsWorkspaceSummary = {
  id: string;
  workspaceKey: string;
  courseId: string;
  title: string;
  subtitle: string | null;
  courseTitle: string | null;
  driveFolderId: string | null;
  driveFolderName: string | null;
  driveFolderUrl: string | null;
  briefDocumentId: string | null;
  briefDocumentUrl: string | null;
  teleprompterDocumentId: string | null;
  teleprompterDocumentUrl: string | null;
  sceneCount: number;
  readiness: number | null;
  primaryMode: string | null;
  scenes: AcademyGoogleVidsSceneSummary[];
  lastSyncedAt: string | null;
  metadata: Record<string, unknown>;
};

export type AcademyGoogleVidsWorkspaceStatus = {
  connected: boolean;
  googleEmail: string | null;
  vidsUrl: string;
  workspaceReady: boolean;
  syncEligible: boolean;
  reason: string | null;
  scope: {
    courseId: string | null;
    courseTitle: string | null;
  };
  workspace: AcademyGoogleVidsWorkspaceSummary | null;
};

type AcademyGoogleVidsScope = {
  userId?: string;
  courseId?: string;
  courseTitle?: string;
};

type AcademyGoogleVidsSyncPayload = AcademyGoogleVidsScope & {
  snapshot: AcademyGoogleVidsWorkspaceSnapshot;
};

function toQueryString(scope: AcademyGoogleVidsScope): string {
  const params = new URLSearchParams();
  Object.entries(scope).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim().length > 0) {
      params.set(key, value.trim());
    }
  });
  return params.toString();
}

function openExternalUrl(url?: string | null): void {
  if (typeof window === "undefined" || !url) {
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

export const academyGoogleVidsService = {
  async getStatus(
    scope: AcademyGoogleVidsScope,
  ): Promise<AcademyGoogleVidsWorkspaceStatus> {
    const query = toQueryString(scope);
    return apiRequest(
      `/api/academy/google-vids/status${query ? `?${query}` : ""}`,
    ) as Promise<AcademyGoogleVidsWorkspaceStatus>;
  },

  async sync(
    payload: AcademyGoogleVidsSyncPayload,
  ): Promise<AcademyGoogleVidsWorkspaceStatus> {
    return apiRequest("/api/academy/google-vids/sync", {
      method: "POST",
      body: payload,
    }) as Promise<AcademyGoogleVidsWorkspaceStatus>;
  },

  openGoogleVids(url?: string | null): void {
    openExternalUrl(url || ACADEMY_GOOGLE_VIDS_URL);
  },

  openExternalUrl,
};
