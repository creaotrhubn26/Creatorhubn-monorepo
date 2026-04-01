import { apiRequest } from "@/lib/queryClient";

export const NOTEBOOK_LM_HOME_URL = "https://notebooklm.google.com/";

export type AcademyNotebookLmResourceSnapshot = {
  id: string;
  title: string;
  type: string;
  url?: string | null;
  description?: string | null;
  videoSourceType?: string | null;
  googleDriveWebViewLink?: string | null;
  googleDrivePlaybackUrl?: string | null;
};

export type AcademyNotebookLmLessonSnapshot = {
  id: string;
  title: string;
  description?: string | null;
  duration?: number | null;
  order: number;
  isPreview?: boolean;
  videoUrl?: string | null;
  videoSourceType?: string | null;
  googleDriveWebViewLink?: string | null;
  googleDrivePlaybackUrl?: string | null;
  resources: AcademyNotebookLmResourceSnapshot[];
};

export type AcademyNotebookLmCourseSnapshot = {
  courseId: string;
  title: string;
  description?: string | null;
  duration?: number | null;
  level?: string | null;
  category?: string | null;
  tags: string[];
  prerequisites: string[];
  learningOutcomes: string[];
  instructorName?: string | null;
  videoUrl?: string | null;
  videoSourceType?: string | null;
  googleDriveWebViewLink?: string | null;
  googleDrivePlaybackUrl?: string | null;
  resources: AcademyNotebookLmResourceSnapshot[];
  lessons: AcademyNotebookLmLessonSnapshot[];
  focusLessonId?: string | null;
};

export type AcademyNotebookLmSourceDocument = {
  id: string;
  kind: "course-overview" | "lesson";
  title: string;
  lessonId: string | null;
  description: string | null;
  googleDocId: string | null;
  googleDocUrl: string | null;
  order: number;
};

export type AcademyNotebookLmCourseSummary = {
  courseId: string;
  courseTitle: string;
  lessonCount: number;
  resourceCount: number;
  videoSourceCount: number;
  learningOutcomeCount: number;
  estimatedDurationMinutes: number | null;
  focusLessonId: string | null;
  focusLessonTitle: string | null;
  tags: string[];
};

export type AcademyNotebookLmWorkspaceSummary = {
  id: string;
  workspaceKey: string;
  courseId: string;
  lessonId: string | null;
  title: string;
  description: string | null;
  courseTitle: string | null;
  driveFolderId: string | null;
  driveFolderName: string | null;
  driveFolderUrl: string | null;
  workspaceDocumentId: string | null;
  workspaceDocumentUrl: string | null;
  sourceDocuments: AcademyNotebookLmSourceDocument[];
  courseSummary: AcademyNotebookLmCourseSummary | null;
  lastSyncedAt: string | null;
  metadata: Record<string, unknown>;
};

export type AcademyNotebookLmWorkspaceStatus = {
  connected: boolean;
  googleEmail: string | null;
  notebookLmUrl: string;
  workspaceReady: boolean;
  syncEligible: boolean;
  reason: string | null;
  scope: {
    courseId: string | null;
    lessonId: string | null;
    courseTitle: string | null;
  };
  sourceDocumentCount: number;
  sourceDocuments: AcademyNotebookLmSourceDocument[];
  courseSummary: AcademyNotebookLmCourseSummary | null;
  workspace: AcademyNotebookLmWorkspaceSummary | null;
};

type AcademyNotebookLmScope = {
  userId?: string;
  courseId?: string;
  lessonId?: string;
  courseTitle?: string;
};

type AcademyNotebookLmSyncPayload = AcademyNotebookLmScope & {
  snapshot: AcademyNotebookLmCourseSnapshot;
};

function toQueryString(scope: AcademyNotebookLmScope): string {
  const params = new URLSearchParams();
  Object.entries(scope).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim().length > 0) {
      params.set(key, value.trim());
    }
  });
  return params.toString();
}

export const academyNotebookLmService = {
  async getStatus(
    scope: AcademyNotebookLmScope,
  ): Promise<AcademyNotebookLmWorkspaceStatus> {
    const query = toQueryString(scope);
    return apiRequest(
      `/api/academy/notebooklm/status${query ? `?${query}` : ""}`,
    ) as Promise<AcademyNotebookLmWorkspaceStatus>;
  },

  async sync(
    payload: AcademyNotebookLmSyncPayload,
  ): Promise<AcademyNotebookLmWorkspaceStatus> {
    return apiRequest("/api/academy/notebooklm/sync", {
      method: "POST",
      body: payload,
    }) as Promise<AcademyNotebookLmWorkspaceStatus>;
  },

  openNotebookLm(url?: string | null): void {
    window.open(url || NOTEBOOK_LM_HOME_URL, "_blank", "noopener,noreferrer");
  },
};
