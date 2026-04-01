import { google } from "googleapis";
import type { Pool } from "pg";
import {
  upsertStructuredGoogleDocument,
  type StructuredGoogleDocumentBlock,
} from "./customer-drive-sync.js";
import { resolveRoleRoomGoogleConnection } from "./contract-google-signing.js";

type AcademyNotebookLmScopeInput = {
  userId?: string | null;
  courseId?: string | null;
  lessonId?: string | null;
  courseTitle?: string | null;
};

type AcademyNotebookLmSyncInput = AcademyNotebookLmScopeInput & {
  snapshot?: unknown;
};

type AcademyNotebookLmWorkspaceRow = {
  id: string;
  workspace_key: string;
  user_id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  description: string | null;
  course_title: string | null;
  google_drive_folder_id: string | null;
  google_drive_folder_name: string | null;
  google_drive_folder_url: string | null;
  google_doc_id: string | null;
  google_doc_url: string | null;
  source_documents: unknown;
  course_summary: unknown;
  metadata: unknown;
  created_at: string | null;
  updated_at: string | null;
  last_synced_at: string | null;
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

type AcademyNotebookLmResourceInput = {
  id: string;
  title: string;
  type: string;
  url: string | null;
  description: string | null;
  videoSourceType: string | null;
  googleDriveWebViewLink: string | null;
  googleDrivePlaybackUrl: string | null;
};

type AcademyNotebookLmLessonInput = {
  id: string;
  title: string;
  description: string | null;
  duration: number | null;
  order: number;
  isPreview: boolean;
  videoUrl: string | null;
  videoSourceType: string | null;
  googleDriveWebViewLink: string | null;
  googleDrivePlaybackUrl: string | null;
  resources: AcademyNotebookLmResourceInput[];
};

type AcademyNotebookLmCourseSnapshot = {
  courseId: string;
  title: string;
  description: string | null;
  duration: number | null;
  level: string | null;
  category: string | null;
  tags: string[];
  prerequisites: string[];
  learningOutcomes: string[];
  instructorName: string | null;
  videoUrl: string | null;
  videoSourceType: string | null;
  googleDriveWebViewLink: string | null;
  googleDrivePlaybackUrl: string | null;
  resources: AcademyNotebookLmResourceInput[];
  lessons: AcademyNotebookLmLessonInput[];
  focusLessonId: string | null;
};

const NOTEBOOK_LM_HOME_URL = "https://notebooklm.google.com/";

let ensureAcademyNotebookLmWorkspaceSchemaPromise: Promise<void> | null = null;

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function readJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map((entry) => readString(entry))
          .filter((entry): entry is string => Boolean(entry)),
      ),
    ];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return readStringArray(parsed);
    } catch {
      return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function readJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function sanitizeDriveFolderName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function formatDurationLabel(value: number | null | undefined): string {
  const seconds = readNumber(value);
  if (!seconds || seconds <= 0) {
    return "Ikke angitt";
  }

  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} t ${minutes} min` : `${hours} t`;
}

function normalizeResourceInput(
  value: unknown,
  index: number,
): AcademyNotebookLmResourceInput | null {
  const candidate = readJsonObject(value);
  const title =
    readString(candidate.title) ||
    readString(candidate.description) ||
    `Ressurs ${index + 1}`;
  const resourceId = readString(candidate.id) || `resource-${index + 1}`;
  const type = readString(candidate.type) || "link";
  const url = readString(candidate.url);
  const description = readString(candidate.description);
  const videoSourceType = readString(candidate.videoSourceType);
  const googleDriveWebViewLink = readString(candidate.googleDriveWebViewLink);
  const googleDrivePlaybackUrl = readString(candidate.googleDrivePlaybackUrl);

  if (!url && !googleDriveWebViewLink && !googleDrivePlaybackUrl) {
    return null;
  }

  return {
    id: resourceId,
    title,
    type,
    url,
    description,
    videoSourceType,
    googleDriveWebViewLink,
    googleDrivePlaybackUrl,
  };
}

function normalizeLessonInput(
  value: unknown,
  index: number,
): AcademyNotebookLmLessonInput | null {
  const candidate = readJsonObject(value);
  const lessonId = readString(candidate.id) || `lesson-${index + 1}`;
  const title = readString(candidate.title) || `Ferdighet ${index + 1}`;
  const description = readString(candidate.description);
  const order = readNumber(candidate.order) ?? index + 1;
  const resources = Array.isArray(candidate.resources)
    ? candidate.resources
        .map((resource, resourceIndex) =>
          normalizeResourceInput(resource, resourceIndex),
        )
        .filter((resource): resource is AcademyNotebookLmResourceInput =>
          Boolean(resource),
        )
    : [];

  return {
    id: lessonId,
    title,
    description,
    duration: readNumber(candidate.duration),
    order,
    isPreview: readBoolean(candidate.isPreview),
    videoUrl: readString(candidate.videoUrl),
    videoSourceType: readString(candidate.videoSourceType),
    googleDriveWebViewLink: readString(candidate.googleDriveWebViewLink),
    googleDrivePlaybackUrl: readString(candidate.googleDrivePlaybackUrl),
    resources,
  };
}

function normalizeCourseSnapshot(
  input: unknown,
  fallbackCourseId?: string | null,
  fallbackLessonId?: string | null,
): AcademyNotebookLmCourseSnapshot | null {
  const candidate = readJsonObject(input);
  const courseId =
    readString(candidate.courseId) ||
    readString(candidate.id) ||
    readString(fallbackCourseId);
  const title = readString(candidate.title) || "Untitled course";

  if (!courseId) {
    return null;
  }

  const resources = Array.isArray(candidate.resources)
    ? candidate.resources
        .map((resource, index) => normalizeResourceInput(resource, index))
        .filter((resource): resource is AcademyNotebookLmResourceInput =>
          Boolean(resource),
        )
    : [];
  const lessons = Array.isArray(candidate.lessons)
    ? candidate.lessons
        .map((lesson, index) => normalizeLessonInput(lesson, index))
        .filter((lesson): lesson is AcademyNotebookLmLessonInput =>
          Boolean(lesson),
        )
        .sort((a, b) => a.order - b.order)
    : [];

  return {
    courseId,
    title,
    description: readString(candidate.description),
    duration: readNumber(candidate.duration),
    level: readString(candidate.level),
    category: readString(candidate.category),
    tags: readStringArray(candidate.tags),
    prerequisites: readStringArray(candidate.prerequisites),
    learningOutcomes: readStringArray(candidate.learningOutcomes),
    instructorName: readString(candidate.instructorName),
    videoUrl: readString(candidate.videoUrl),
    videoSourceType: readString(candidate.videoSourceType),
    googleDriveWebViewLink: readString(candidate.googleDriveWebViewLink),
    googleDrivePlaybackUrl: readString(candidate.googleDrivePlaybackUrl),
    resources,
    lessons,
    focusLessonId:
      readString(candidate.focusLessonId) || readString(fallbackLessonId),
  };
}

function buildWorkspaceKey(courseId: string): string {
  return `academy-course:${courseId}`;
}

function buildWorkspaceTitle(courseTitle: string): string {
  return `${courseTitle} · NotebookLM Workspace`;
}

function mapSourceDocument(
  value: unknown,
  index: number,
): AcademyNotebookLmSourceDocument | null {
  const candidate = readJsonObject(value);
  const title = readString(candidate.title);
  if (!title) {
    return null;
  }

  return {
    id: readString(candidate.id) || `source-${index + 1}`,
    kind:
      readString(candidate.kind) === "lesson" ? "lesson" : "course-overview",
    title,
    lessonId: readString(candidate.lessonId),
    description: readString(candidate.description),
    googleDocId: readString(candidate.googleDocId),
    googleDocUrl: readString(candidate.googleDocUrl),
    order: readNumber(candidate.order) ?? index,
  };
}

function mapCourseSummary(
  value: unknown,
): AcademyNotebookLmCourseSummary | null {
  const candidate = readJsonObject(value);
  const courseId = readString(candidate.courseId);
  const courseTitle = readString(candidate.courseTitle);

  if (!courseId || !courseTitle) {
    return null;
  }

  return {
    courseId,
    courseTitle,
    lessonCount: Math.max(0, readNumber(candidate.lessonCount) ?? 0),
    resourceCount: Math.max(0, readNumber(candidate.resourceCount) ?? 0),
    videoSourceCount: Math.max(0, readNumber(candidate.videoSourceCount) ?? 0),
    learningOutcomeCount: Math.max(
      0,
      readNumber(candidate.learningOutcomeCount) ?? 0,
    ),
    estimatedDurationMinutes: readNumber(candidate.estimatedDurationMinutes),
    focusLessonId: readString(candidate.focusLessonId),
    focusLessonTitle: readString(candidate.focusLessonTitle),
    tags: readStringArray(candidate.tags),
  };
}

function mapWorkspaceRow(
  row: AcademyNotebookLmWorkspaceRow,
): AcademyNotebookLmWorkspaceSummary {
  const sourceDocuments = readJsonArray(row.source_documents);

  return {
    id: row.id,
    workspaceKey: row.workspace_key,
    courseId: row.course_id,
    lessonId: row.lesson_id,
    title: row.title,
    description: row.description,
    courseTitle: row.course_title,
    driveFolderId: row.google_drive_folder_id,
    driveFolderName: row.google_drive_folder_name,
    driveFolderUrl: row.google_drive_folder_url,
    workspaceDocumentId: row.google_doc_id,
    workspaceDocumentUrl: row.google_doc_url,
    sourceDocuments: sourceDocuments
      .map((entry, index) => mapSourceDocument(entry, index))
      .filter((entry): entry is AcademyNotebookLmSourceDocument =>
        Boolean(entry),
      )
      .sort((a, b) => a.order - b.order),
    courseSummary: mapCourseSummary(row.course_summary),
    lastSyncedAt: row.last_synced_at,
    metadata: readJsonObject(row.metadata),
  };
}

function buildWorkspaceDescription(
  snapshot: AcademyNotebookLmCourseSnapshot,
  summary: AcademyNotebookLmCourseSummary,
): string {
  return [
    `NotebookLM-kilder for ${snapshot.title}.`,
    `${summary.lessonCount} ferdigheter og ${summary.resourceCount} ressurser er klargjort som Google Docs-kilder fra CreatorHub.`,
  ].join(" ");
}

function buildCourseSummary(
  snapshot: AcademyNotebookLmCourseSnapshot,
): AcademyNotebookLmCourseSummary {
  const lessonCount = snapshot.lessons.length;
  const resourceCount =
    snapshot.resources.length +
    snapshot.lessons.reduce((sum, lesson) => sum + lesson.resources.length, 0);
  const videoSourceCount = [
    snapshot.videoUrl ||
    snapshot.googleDrivePlaybackUrl ||
    snapshot.googleDriveWebViewLink
      ? "course"
      : null,
    ...snapshot.lessons.map((lesson) =>
      lesson.videoUrl ||
      lesson.googleDrivePlaybackUrl ||
      lesson.googleDriveWebViewLink
        ? lesson.id
        : null,
    ),
  ].filter(Boolean).length;
  const estimatedDurationMinutes = snapshot.duration
    ? Math.max(1, Math.round(snapshot.duration / 60))
    : snapshot.lessons.length > 0
      ? Math.round(
          snapshot.lessons.reduce(
            (sum, lesson) => sum + Math.max(0, lesson.duration || 0),
            0,
          ) / 60,
        ) || null
      : null;
  const focusLesson =
    snapshot.lessons.find((lesson) => lesson.id === snapshot.focusLessonId) ||
    null;

  return {
    courseId: snapshot.courseId,
    courseTitle: snapshot.title,
    lessonCount,
    resourceCount,
    videoSourceCount,
    learningOutcomeCount: snapshot.learningOutcomes.length,
    estimatedDurationMinutes,
    focusLessonId: focusLesson?.id || snapshot.focusLessonId || null,
    focusLessonTitle: focusLesson?.title || null,
    tags: snapshot.tags,
  };
}

function buildVideoSourceLines(input: {
  videoUrl: string | null;
  videoSourceType: string | null;
  googleDriveWebViewLink: string | null;
  googleDrivePlaybackUrl: string | null;
}): string[] {
  const lines: string[] = [];
  const sourceType = input.videoSourceType || "direct";

  if (sourceType === "google-vids") {
    lines.push(
      "Google Vids brukes som redigerbar kilde og bør åpnes i nettleser/NotebookLM.",
    );
  }
  if (sourceType === "google-drive-video") {
    lines.push("Google Drive MP4 er klar for direkte videoreferanse.");
  }
  if (sourceType === "external-link") {
    lines.push("Ekstern videolenke er registrert for denne enheten.");
  }
  if (input.googleDrivePlaybackUrl) {
    lines.push(`Drive playback: ${input.googleDrivePlaybackUrl}`);
  }
  if (input.googleDriveWebViewLink) {
    lines.push(`Drive/Google Vids: ${input.googleDriveWebViewLink}`);
  }
  if (
    input.videoUrl &&
    input.videoUrl !== input.googleDrivePlaybackUrl &&
    input.videoUrl !== input.googleDriveWebViewLink
  ) {
    lines.push(`Video URL: ${input.videoUrl}`);
  }

  return lines;
}

function buildResourceLines(
  resources: AcademyNotebookLmResourceInput[],
): string[] {
  return resources.map((resource) => {
    const link =
      resource.googleDriveWebViewLink ||
      resource.googleDrivePlaybackUrl ||
      resource.url ||
      "";
    const typeLabel =
      resource.videoSourceType === "google-vids"
        ? "Google Vids"
        : resource.videoSourceType === "google-drive-video"
          ? "Drive video"
          : resource.type;

    return link
      ? `${resource.title} (${typeLabel}): ${link}`
      : `${resource.title} (${typeLabel})`;
  });
}

function buildOverviewBlocks(
  snapshot: AcademyNotebookLmCourseSnapshot,
  summary: AcademyNotebookLmCourseSummary,
  lessonDocuments: AcademyNotebookLmSourceDocument[],
): StructuredGoogleDocumentBlock[] {
  const videoLines = buildVideoSourceLines(snapshot);
  const lessonLines = lessonDocuments.map(
    (document) =>
      `${document.order}. ${document.title}${document.googleDocUrl ? `: ${document.googleDocUrl}` : ""}`,
  );
  const courseResourceLines = buildResourceLines(snapshot.resources);
  const blocks: StructuredGoogleDocumentBlock[] = [
    { type: "eyebrow", text: "CreatorHub Academy" },
    { type: "title", text: buildWorkspaceTitle(snapshot.title) },
    {
      type: "subtitle",
      text: [
        snapshot.level || null,
        snapshot.category || null,
        snapshot.instructorName
          ? `Instruktør: ${snapshot.instructorName}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      type: "spotlight",
      label: "NotebookLM Studio",
      value: `${summary.lessonCount} ferdighetsdokumenter`,
      note: `${summary.resourceCount} kursressurser er klargjort som kilder`,
    },
    {
      type: "callout",
      title: "Anbefalt Studio-flyt",
      body: [
        "Bruk Audio Overview for rask repetisjon, onboarding og recap på tvers av ferdigheter.",
        "Bruk Video Overview, Slide Deck eller Infographic når kursinnholdet skal pakkes om til nye formater.",
        "Bruk Study Guide, FAQ, quiz-spørsmål og Mind Map når du vil lage læringsstøtte og sjekke dekning mot læringsmål.",
      ].join("\n\n"),
    },
    { type: "heading", text: "Kursstatus" },
    {
      type: "meta-list",
      items: [
        { label: "Kurs", value: snapshot.title },
        { label: "Varighet", value: formatDurationLabel(snapshot.duration) },
        { label: "Ferdigheter", value: String(summary.lessonCount) },
        { label: "Ressurser", value: String(summary.resourceCount) },
        { label: "NotebookLM", value: NOTEBOOK_LM_HOME_URL },
      ],
    },
  ];

  if (snapshot.description) {
    blocks.push(
      { type: "heading", text: "Kursbeskrivelse" },
      { type: "paragraph", text: snapshot.description },
    );
  }

  if (snapshot.learningOutcomes.length > 0) {
    blocks.push(
      { type: "heading", text: "Læringsmål" },
      { type: "bullet-list", items: snapshot.learningOutcomes },
    );
  }

  if (snapshot.prerequisites.length > 0) {
    blocks.push(
      { type: "heading", text: "Forutsetninger" },
      { type: "bullet-list", items: snapshot.prerequisites },
    );
  }

  if (videoLines.length > 0) {
    blocks.push(
      { type: "heading", text: "Videokilder" },
      { type: "bullet-list", items: videoLines },
    );
  }

  if (lessonLines.length > 0) {
    blocks.push(
      { type: "heading", text: "Ferdighetsdokumenter" },
      { type: "numbered-list", items: lessonLines },
    );
  }

  if (courseResourceLines.length > 0) {
    blocks.push(
      { type: "heading", text: "Kursressurser" },
      { type: "bullet-list", items: courseResourceLines },
    );
  }

  if (summary.focusLessonTitle) {
    blocks.push(
      { type: "heading", text: "Aktiv ferdighet i Studio" },
      {
        type: "callout",
        title: summary.focusLessonTitle,
        body: "Denne ferdigheten var aktiv i CreatorHub da synken ble kjørt. Bruk den som startpunkt i NotebookLM for spørsmål, oppsummering og avledede assets.",
      },
    );
  }

  return blocks;
}

function buildLessonBlocks(
  snapshot: AcademyNotebookLmCourseSnapshot,
  lesson: AcademyNotebookLmLessonInput,
): StructuredGoogleDocumentBlock[] {
  const resourceLines = buildResourceLines(lesson.resources);
  const videoLines = buildVideoSourceLines(lesson);
  const blocks: StructuredGoogleDocumentBlock[] = [
    { type: "eyebrow", text: "CreatorHub Academy Skill" },
    { type: "title", text: lesson.title },
    {
      type: "subtitle",
      text: [
        snapshot.title,
        `Ferdighet ${lesson.order}`,
        lesson.isPreview ? "Preview" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      type: "spotlight",
      label: "Varighet",
      value: formatDurationLabel(lesson.duration),
      note: `${lesson.resources.length} tilknyttede ressurser`,
    },
    {
      type: "callout",
      title: "Bruk denne ferdigheten i NotebookLM Studio",
      body: [
        "Lag en kort oppsummering og en versjon for nye deltakere.",
        "Be om et quiz-sett, study guide eller FAQ basert på denne ferdigheten og kursmålet.",
        "Bruk Video Overview eller Slide Deck hvis ferdigheten skal repakkes til et nytt distribusjonsformat.",
      ].join("\n\n"),
    },
    { type: "heading", text: "Ferdighetsinfo" },
    {
      type: "meta-list",
      items: [
        { label: "Kurs", value: snapshot.title },
        { label: "Orden", value: String(lesson.order) },
        { label: "Varighet", value: formatDurationLabel(lesson.duration) },
        { label: "Preview", value: lesson.isPreview ? "Ja" : "Nei" },
      ],
    },
  ];

  if (lesson.description) {
    blocks.push(
      { type: "heading", text: "Beskrivelse" },
      { type: "paragraph", text: lesson.description },
    );
  }

  if (videoLines.length > 0) {
    blocks.push(
      { type: "heading", text: "Videokilde" },
      { type: "bullet-list", items: videoLines },
    );
  }

  if (resourceLines.length > 0) {
    blocks.push(
      { type: "heading", text: "Ressurser" },
      { type: "bullet-list", items: resourceLines },
    );
  }

  return blocks;
}

async function ensureAcademyNotebookLmWorkspaceSchema(pool: Pool) {
  if (!ensureAcademyNotebookLmWorkspaceSchemaPromise) {
    ensureAcademyNotebookLmWorkspaceSchemaPromise = pool
      .query(
        `
      CREATE TABLE IF NOT EXISTS academy_notebooklm_workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_key VARCHAR NOT NULL UNIQUE,
        user_id VARCHAR NOT NULL,
        course_id VARCHAR NOT NULL,
        lesson_id VARCHAR,
        title VARCHAR NOT NULL,
        description TEXT,
        course_title VARCHAR,
        google_drive_folder_id VARCHAR,
        google_drive_folder_name VARCHAR,
        google_drive_folder_url TEXT,
        google_doc_id VARCHAR,
        google_doc_url TEXT,
        source_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
        course_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_synced_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_academy_notebooklm_workspaces_user_id
        ON academy_notebooklm_workspaces(user_id);
      CREATE INDEX IF NOT EXISTS idx_academy_notebooklm_workspaces_course_id
        ON academy_notebooklm_workspaces(course_id);
      CREATE INDEX IF NOT EXISTS idx_academy_notebooklm_workspaces_lesson_id
        ON academy_notebooklm_workspaces(lesson_id);
    `,
      )
      .then(() => undefined);
  }

  return ensureAcademyNotebookLmWorkspaceSchemaPromise;
}

async function fetchGoogleConnectionMeta(pool: Pool, userId: string) {
  const result = await pool
    .query(
      `SELECT google_email
       FROM role_room_google_connections
      WHERE user_id = $1
        AND connection_state = 'connected'
      ORDER BY last_used_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT 1`,
      [userId],
    )
    .catch(() => ({ rows: [] as Array<Record<string, unknown>> }));

  return {
    connected: Boolean(result.rows[0]),
    googleEmail: readString(result.rows[0]?.google_email),
  };
}

async function fetchWorkspaceRow(pool: Pool, workspaceKey: string) {
  const result = await pool.query<AcademyNotebookLmWorkspaceRow>(
    `SELECT *
       FROM academy_notebooklm_workspaces
      WHERE workspace_key = $1
      LIMIT 1`,
    [workspaceKey],
  );

  return result.rows[0] || null;
}

async function ensureDriveFolder(
  driveApi: ReturnType<typeof google.drive>,
  folderName: string,
  parentFolderId?: string | null,
) {
  const normalizedFolderName =
    sanitizeDriveFolderName(folderName) || "CreatorHub Academy";
  const queryParts = [
    `mimeType = 'application/vnd.google-apps.folder'`,
    "trashed = false",
    `name = '${normalizedFolderName.replace(/'/g, "\\'")}'`,
  ];

  if (parentFolderId) {
    queryParts.push(`'${parentFolderId}' in parents`);
  }

  const existing = await driveApi.files.list({
    q: queryParts.join(" and "),
    pageSize: 1,
    fields: "files(id,name,webViewLink)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existingFolder = Array.isArray(existing.data.files)
    ? existing.data.files[0]
    : null;
  if (existingFolder?.id) {
    return {
      id: existingFolder.id,
      name: readString(existingFolder.name) || normalizedFolderName,
      webViewLink: readString(existingFolder.webViewLink),
    };
  }

  const created = await driveApi.files.create({
    requestBody: {
      name: normalizedFolderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentFolderId ? [parentFolderId] : undefined,
    },
    fields: "id,name,webViewLink",
    supportsAllDrives: true,
  });

  return {
    id: readString(created.data.id) || normalizedFolderName,
    name: readString(created.data.name) || normalizedFolderName,
    webViewLink: readString(created.data.webViewLink),
  };
}

async function getDriveFolderById(
  driveApi: ReturnType<typeof google.drive>,
  folderId: string,
) {
  try {
    const response = await driveApi.files.get({
      fileId: folderId,
      fields: "id,name,webViewLink",
      supportsAllDrives: true,
    });

    return {
      id: readString(response.data.id) || folderId,
      name: readString(response.data.name) || "NotebookLM Workspace",
      webViewLink: readString(response.data.webViewLink),
    };
  } catch {
    return null;
  }
}

async function ensureAcademyNotebookLmFolder(
  driveApi: ReturnType<typeof google.drive>,
  snapshot: AcademyNotebookLmCourseSnapshot,
  existingWorkspace: AcademyNotebookLmWorkspaceRow | null,
) {
  const existingFolderId = readString(
    existingWorkspace?.google_drive_folder_id,
  );
  if (existingFolderId) {
    const existingFolder = await getDriveFolderById(driveApi, existingFolderId);
    if (existingFolder) {
      return existingFolder;
    }
  }

  const rootFolder = await ensureDriveFolder(driveApi, "CreatorHub Academy");
  const courseFolder = await ensureDriveFolder(
    driveApi,
    sanitizeDriveFolderName(snapshot.title) || `Course ${snapshot.courseId}`,
    rootFolder.id,
  );
  return ensureDriveFolder(driveApi, "NotebookLM Workspace", courseFolder.id);
}

export async function getAcademyNotebookLmWorkspaceStatus(
  pool: Pool,
  input: AcademyNotebookLmScopeInput,
): Promise<AcademyNotebookLmWorkspaceStatus> {
  await ensureAcademyNotebookLmWorkspaceSchema(pool);
  const userId = readString(input.userId);
  const courseId = readString(input.courseId);
  const lessonId = readString(input.lessonId);
  const courseTitle = readString(input.courseTitle);

  if (!userId) {
    return {
      connected: false,
      googleEmail: null,
      notebookLmUrl: NOTEBOOK_LM_HOME_URL,
      workspaceReady: false,
      syncEligible: false,
      reason: "Brukeridentitet mangler for Academy NotebookLM-arbeidsrommet.",
      scope: {
        courseId,
        lessonId,
        courseTitle,
      },
      sourceDocumentCount: 0,
      sourceDocuments: [],
      courseSummary: null,
      workspace: null,
    };
  }

  const connection = await fetchGoogleConnectionMeta(pool, userId);
  const workspaceRow = courseId
    ? await fetchWorkspaceRow(pool, buildWorkspaceKey(courseId))
    : null;
  const workspace = workspaceRow ? mapWorkspaceRow(workspaceRow) : null;
  const syncEligible = Boolean(connection.connected && courseId);

  let reason: string | null = null;
  if (!connection.connected) {
    reason =
      "Koble Google Workspace for å klargjøre kurset som NotebookLM-kilder.";
  } else if (!courseId) {
    reason = "Velg et kurs før du synker NotebookLM-kildene.";
  } else if (!workspace) {
    reason =
      "Første synk oppretter kursoversikt, ferdighetsdokumenter og Drive-mappe for NotebookLM.";
  }

  return {
    connected: connection.connected,
    googleEmail: connection.googleEmail,
    notebookLmUrl: NOTEBOOK_LM_HOME_URL,
    workspaceReady: Boolean(workspace),
    syncEligible,
    reason,
    scope: {
      courseId,
      lessonId,
      courseTitle:
        courseTitle ||
        workspace?.courseTitle ||
        workspace?.courseSummary?.courseTitle ||
        null,
    },
    sourceDocumentCount: workspace?.sourceDocuments.length || 0,
    sourceDocuments: workspace?.sourceDocuments || [],
    courseSummary: workspace?.courseSummary || null,
    workspace,
  };
}

export async function syncAcademyNotebookLmWorkspace(
  pool: Pool,
  input: AcademyNotebookLmSyncInput,
): Promise<AcademyNotebookLmWorkspaceSummary> {
  await ensureAcademyNotebookLmWorkspaceSchema(pool);

  const userId = readString(input.userId);
  if (!userId) {
    throw new Error("Brukeridentitet mangler for Academy NotebookLM-synk.");
  }

  const snapshot = normalizeCourseSnapshot(
    input.snapshot,
    input.courseId,
    input.lessonId,
  );
  if (!snapshot) {
    throw new Error(
      "Kurssnapshot mangler eller er ugyldig for Academy NotebookLM-synk.",
    );
  }

  const workspaceKey = buildWorkspaceKey(snapshot.courseId);
  const existingWorkspace = await fetchWorkspaceRow(pool, workspaceKey);
  const authorized = await resolveRoleRoomGoogleConnection(pool, userId, {
    allowFallbackToAnyUser: false,
  });
  const driveApi = google.drive({
    version: "v3",
    auth: authorized.oauthClient,
  });
  const docsApi = google.docs({ version: "v1", auth: authorized.oauthClient });
  const targetFolder = await ensureAcademyNotebookLmFolder(
    driveApi,
    snapshot,
    existingWorkspace,
  );
  const existingMetadata = readJsonObject(existingWorkspace?.metadata);
  const existingLessonDocuments = readJsonObject(
    existingMetadata.lessonDocuments,
  );

  const lessonDocuments: AcademyNotebookLmSourceDocument[] = [];
  for (const lesson of snapshot.lessons) {
    const existingDocument = readJsonObject(existingLessonDocuments[lesson.id]);
    const lessonTitle =
      `${snapshot.title} · ${lesson.order}. ${lesson.title}`.slice(0, 180);
    const lessonDocument = await upsertStructuredGoogleDocument(
      docsApi,
      driveApi,
      {
        title: lessonTitle,
        blocks: buildLessonBlocks(snapshot, lesson),
        parentFolderId: targetFolder.id,
        existingDocumentId: readString(existingDocument.googleDocId),
      },
    );

    lessonDocuments.push({
      id: `lesson:${lesson.id}`,
      kind: "lesson",
      title: lesson.title,
      lessonId: lesson.id,
      description: lesson.description,
      googleDocId: lessonDocument.fileId,
      googleDocUrl:
        lessonDocument.webViewUrl || lessonDocument.webContentLink || null,
      order: lesson.order,
    });
  }

  const summary = buildCourseSummary(snapshot);
  const workspaceTitle = buildWorkspaceTitle(snapshot.title);
  const overviewDocument = await upsertStructuredGoogleDocument(
    docsApi,
    driveApi,
    {
      title: workspaceTitle,
      blocks: buildOverviewBlocks(snapshot, summary, lessonDocuments),
      parentFolderId: targetFolder.id,
      existingDocumentId: readString(existingWorkspace?.google_doc_id),
    },
  );

  const sourceDocuments: AcademyNotebookLmSourceDocument[] = [
    {
      id: `course:${snapshot.courseId}`,
      kind: "course-overview",
      title: `${snapshot.title} · Kursoversikt`,
      lessonId: null,
      description: snapshot.description,
      googleDocId: overviewDocument.fileId,
      googleDocUrl:
        overviewDocument.webViewUrl || overviewDocument.webContentLink || null,
      order: 0,
    },
    ...lessonDocuments,
  ];

  const metadata = {
    notebookLmUrl: NOTEBOOK_LM_HOME_URL,
    googleEmail: authorized.connection.googleEmail,
    lessonDocuments: Object.fromEntries(
      lessonDocuments.map((document) => [
        document.lessonId || document.id,
        {
          googleDocId: document.googleDocId,
          googleDocUrl: document.googleDocUrl,
          title: document.title,
          order: document.order,
        },
      ]),
    ),
    syncedFrom: "academy",
    syncedAt: new Date().toISOString(),
  };

  const result = await pool.query<AcademyNotebookLmWorkspaceRow>(
    `INSERT INTO academy_notebooklm_workspaces (
       workspace_key,
       user_id,
       course_id,
       lesson_id,
       title,
       description,
       course_title,
       google_drive_folder_id,
       google_drive_folder_name,
       google_drive_folder_url,
       google_doc_id,
       google_doc_url,
       source_documents,
       course_summary,
       metadata,
       updated_at,
       last_synced_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15::jsonb, NOW(), NOW()
     )
     ON CONFLICT (workspace_key) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           course_id = EXCLUDED.course_id,
           lesson_id = EXCLUDED.lesson_id,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           course_title = EXCLUDED.course_title,
           google_drive_folder_id = EXCLUDED.google_drive_folder_id,
           google_drive_folder_name = EXCLUDED.google_drive_folder_name,
           google_drive_folder_url = EXCLUDED.google_drive_folder_url,
           google_doc_id = EXCLUDED.google_doc_id,
           google_doc_url = EXCLUDED.google_doc_url,
           source_documents = EXCLUDED.source_documents,
           course_summary = EXCLUDED.course_summary,
           metadata = EXCLUDED.metadata,
           updated_at = NOW(),
           last_synced_at = NOW()
     RETURNING *`,
    [
      workspaceKey,
      userId,
      snapshot.courseId,
      summary.focusLessonId,
      workspaceTitle,
      buildWorkspaceDescription(snapshot, summary),
      snapshot.title,
      targetFolder.id,
      targetFolder.name,
      targetFolder.webViewLink,
      overviewDocument.fileId,
      overviewDocument.webViewUrl || overviewDocument.webContentLink || null,
      JSON.stringify(sourceDocuments),
      JSON.stringify(summary),
      JSON.stringify(metadata),
    ],
  );

  const mappedWorkspace = result.rows[0]
    ? mapWorkspaceRow(result.rows[0])
    : null;
  if (!mappedWorkspace) {
    throw new Error("Kunne ikke lagre Academy NotebookLM-arbeidsrommet.");
  }

  return mappedWorkspace;
}
