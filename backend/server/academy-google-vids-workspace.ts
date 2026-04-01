import { google } from "googleapis";
import type { Pool } from "pg";
import {
  ensureDriveFolder,
  upsertPlainTextGoogleDocument,
} from "./customer-drive-sync.js";
import { resolveRoleRoomGoogleConnection } from "./contract-google-signing.js";

type AcademyGoogleVidsScopeInput = {
  userId?: string | null;
  courseId?: string | null;
  courseTitle?: string | null;
};

type AcademyGoogleVidsSyncInput = AcademyGoogleVidsScopeInput & {
  snapshot?: unknown;
};

type AcademyGoogleVidsWorkspaceRow = {
  id: string;
  workspace_key: string;
  user_id: string;
  course_id: string;
  title: string;
  subtitle: string | null;
  course_title: string | null;
  google_drive_folder_id: string | null;
  google_drive_folder_name: string | null;
  google_drive_folder_url: string | null;
  brief_google_doc_id: string | null;
  brief_google_doc_url: string | null;
  teleprompter_google_doc_id: string | null;
  teleprompter_google_doc_url: string | null;
  scene_count: number | null;
  readiness: number | null;
  primary_mode: string | null;
  metadata: unknown;
  created_at: string | null;
  updated_at: string | null;
  last_synced_at: string | null;
};

type AcademyGoogleVidsSceneInput = {
  id: string;
  title: string;
  objective: string | null;
  recordingMode: string;
  durationMinutes: number | null;
  visualCue: string | null;
  whyThisMode: string | null;
  teleprompterScript: string | null;
};

type AcademyGoogleVidsSnapshot = {
  courseId: string;
  title: string;
  subtitle: string | null;
  purpose: string | null;
  audience: string | null;
  transformation: string | null;
  competencies: string[];
  skills: string[];
  problemsSolved: string[];
  learningJourney: string | null;
  practiceDesign: string | null;
  proofOfLearning: string | null;
  readiness: number | null;
  primaryMode: string | null;
  totalDurationMinutes: number | null;
  missingFields: string[];
  setupChecklist: string[];
  productionNotes: string[];
  starterPrompt: string | null;
  brief: string | null;
  teleprompterScript: string | null;
  scenes: AcademyGoogleVidsSceneInput[];
  locale: string | null;
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

const GOOGLE_VIDS_HOME_URL = "https://docs.google.com/videos/";

let ensureAcademyGoogleVidsWorkspaceSchemaPromise: Promise<void> | null = null;

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
      return readStringArray(JSON.parse(value));
    } catch {
      return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
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

function normalizeRecordingMode(value: unknown): string | null {
  const candidate = readString(value);
  if (!candidate) {
    return null;
  }

  return [
    "camera",
    "camera-and-screen",
    "screen",
    "voiceover",
  ].includes(candidate)
    ? candidate
    : candidate;
}

function normalizeSceneInput(
  value: unknown,
  index: number,
): AcademyGoogleVidsSceneInput | null {
  const candidate = readJsonObject(value);
  const title = readString(candidate.title) || `Scene ${index + 1}`;

  return {
    id: readString(candidate.id) || `scene-${index + 1}`,
    title,
    objective: readString(candidate.objective),
    recordingMode: normalizeRecordingMode(candidate.recordingMode) || "camera",
    durationMinutes: readNumber(candidate.durationMinutes),
    visualCue: readString(candidate.visualCue),
    whyThisMode: readString(candidate.whyThisMode),
    teleprompterScript: readString(candidate.teleprompterScript),
  };
}

function normalizeSnapshot(
  input: unknown,
  fallbackCourseId?: string | null,
  fallbackCourseTitle?: string | null,
): AcademyGoogleVidsSnapshot | null {
  const candidate = readJsonObject(input);
  const courseId =
    readString(candidate.courseId) ||
    readString(candidate.id) ||
    readString(fallbackCourseId);
  const title =
    readString(candidate.title) ||
    readString(candidate.courseTitle) ||
    readString(fallbackCourseTitle) ||
    "Untitled course";

  if (!courseId) {
    return null;
  }

  const scenes = readJsonArray(candidate.scenes)
    .map((scene, index) => normalizeSceneInput(scene, index))
    .filter((scene): scene is AcademyGoogleVidsSceneInput => Boolean(scene));

  return {
    courseId,
    title,
    subtitle: readString(candidate.subtitle),
    purpose: readString(candidate.purpose),
    audience: readString(candidate.audience),
    transformation: readString(candidate.transformation),
    competencies: readStringArray(candidate.competencies),
    skills: readStringArray(candidate.skills),
    problemsSolved: readStringArray(candidate.problemsSolved),
    learningJourney: readString(candidate.learningJourney),
    practiceDesign: readString(candidate.practiceDesign),
    proofOfLearning: readString(candidate.proofOfLearning),
    readiness: readNumber(candidate.readiness),
    primaryMode: normalizeRecordingMode(candidate.primaryMode),
    totalDurationMinutes: readNumber(candidate.totalDurationMinutes),
    missingFields: readStringArray(candidate.missingFields),
    setupChecklist: readStringArray(candidate.setupChecklist),
    productionNotes: readStringArray(candidate.productionNotes),
    starterPrompt: readString(candidate.starterPrompt),
    brief: readString(candidate.brief),
    teleprompterScript: readString(candidate.teleprompterScript),
    scenes,
    locale: readString(candidate.locale),
  };
}

function buildWorkspaceKey(courseId: string): string {
  return `academy-google-vids:${courseId}`;
}

function mapSceneSummary(
  value: unknown,
  index: number,
): AcademyGoogleVidsSceneSummary | null {
  const candidate = readJsonObject(value);
  const title = readString(candidate.title);

  if (!title) {
    return null;
  }

  return {
    id: readString(candidate.id) || `scene-${index + 1}`,
    title,
    recordingMode: readString(candidate.recordingMode),
    durationMinutes: readNumber(candidate.durationMinutes),
  };
}

function mapWorkspaceRow(
  row: AcademyGoogleVidsWorkspaceRow,
): AcademyGoogleVidsWorkspaceSummary {
  const metadata = readJsonObject(row.metadata);

  return {
    id: row.id,
    workspaceKey: row.workspace_key,
    courseId: row.course_id,
    title: row.title,
    subtitle: row.subtitle,
    courseTitle: row.course_title,
    driveFolderId: row.google_drive_folder_id,
    driveFolderName: row.google_drive_folder_name,
    driveFolderUrl: row.google_drive_folder_url,
    briefDocumentId: row.brief_google_doc_id,
    briefDocumentUrl: row.brief_google_doc_url,
    teleprompterDocumentId: row.teleprompter_google_doc_id,
    teleprompterDocumentUrl: row.teleprompter_google_doc_url,
    sceneCount: Math.max(0, readNumber(row.scene_count) ?? 0),
    readiness: readNumber(row.readiness),
    primaryMode: readString(row.primary_mode),
    scenes: readJsonArray(metadata.scenes)
      .map((scene, index) => mapSceneSummary(scene, index))
      .filter((scene): scene is AcademyGoogleVidsSceneSummary =>
        Boolean(scene),
      ),
    lastSyncedAt: row.last_synced_at,
    metadata,
  };
}

async function ensureAcademyGoogleVidsWorkspaceSchema(pool: Pool) {
  if (!ensureAcademyGoogleVidsWorkspaceSchemaPromise) {
    ensureAcademyGoogleVidsWorkspaceSchemaPromise = pool
      .query(
        `
      CREATE TABLE IF NOT EXISTS academy_google_vids_workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_key VARCHAR NOT NULL UNIQUE,
        user_id VARCHAR NOT NULL,
        course_id VARCHAR NOT NULL,
        title VARCHAR NOT NULL,
        subtitle TEXT,
        course_title VARCHAR,
        google_drive_folder_id VARCHAR,
        google_drive_folder_name VARCHAR,
        google_drive_folder_url TEXT,
        brief_google_doc_id VARCHAR,
        brief_google_doc_url TEXT,
        teleprompter_google_doc_id VARCHAR,
        teleprompter_google_doc_url TEXT,
        scene_count INTEGER NOT NULL DEFAULT 0,
        readiness INTEGER,
        primary_mode VARCHAR,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_synced_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_academy_google_vids_workspaces_user_id
        ON academy_google_vids_workspaces(user_id);
      CREATE INDEX IF NOT EXISTS idx_academy_google_vids_workspaces_course_id
        ON academy_google_vids_workspaces(course_id);
    `,
      )
      .then(() => undefined);
  }

  return ensureAcademyGoogleVidsWorkspaceSchemaPromise;
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
  const result = await pool.query<AcademyGoogleVidsWorkspaceRow>(
    `SELECT *
       FROM academy_google_vids_workspaces
      WHERE workspace_key = $1
      LIMIT 1`,
    [workspaceKey],
  );

  return result.rows[0] || null;
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
      name: readString(response.data.name) || "Google Vids Production",
      webViewLink: readString(response.data.webViewLink),
    };
  } catch {
    return null;
  }
}

async function ensureAcademyGoogleVidsFolder(
  driveApi: ReturnType<typeof google.drive>,
  snapshot: AcademyGoogleVidsSnapshot,
  existingWorkspace: AcademyGoogleVidsWorkspaceRow | null,
) {
  const existingFolderId = readString(existingWorkspace?.google_drive_folder_id);
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
  return ensureDriveFolder(driveApi, "Google Vids Production", courseFolder.id);
}

function buildBriefDocumentContent(snapshot: AcademyGoogleVidsSnapshot): string {
  const useNorwegian = String(snapshot.locale || "")
    .toLowerCase()
    .startsWith("no");

  return [
    snapshot.brief || "",
    snapshot.starterPrompt
      ? [
          "",
          useNorwegian
            ? "Starterprompt for Google Vids:"
            : "Starter prompt for Google Vids:",
          snapshot.starterPrompt,
        ].join("\n")
      : "",
    snapshot.setupChecklist.length > 0
      ? [
          "",
          useNorwegian ? "Opptakssjekkliste:" : "Recording checklist:",
          ...snapshot.setupChecklist.map((item) => `- ${item}`),
        ].join("\n")
      : "",
    snapshot.productionNotes.length > 0
      ? [
          "",
          useNorwegian ? "Produksjonsnotater:" : "Production notes:",
          ...snapshot.productionNotes.map((item) => `- ${item}`),
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildTeleprompterDocumentContent(
  snapshot: AcademyGoogleVidsSnapshot,
): string {
  const useNorwegian = String(snapshot.locale || "")
    .toLowerCase()
    .startsWith("no");

  return [
    snapshot.teleprompterScript || "",
    snapshot.scenes.length > 0
      ? [
          "",
          useNorwegian ? "Sceneoversikt:" : "Scene overview:",
          ...snapshot.scenes.map((scene, index) => {
            const durationLabel = scene.durationMinutes
              ? ` (${scene.durationMinutes} min)`
              : "";
            return `${index + 1}. ${scene.title}${durationLabel}`;
          }),
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function getAcademyGoogleVidsWorkspaceStatus(
  pool: Pool,
  input: AcademyGoogleVidsScopeInput,
): Promise<AcademyGoogleVidsWorkspaceStatus> {
  await ensureAcademyGoogleVidsWorkspaceSchema(pool);
  const userId = readString(input.userId);
  const courseId = readString(input.courseId);
  const courseTitle = readString(input.courseTitle);

  if (!userId) {
    return {
      connected: false,
      googleEmail: null,
      vidsUrl: GOOGLE_VIDS_HOME_URL,
      workspaceReady: false,
      syncEligible: false,
      reason: "Brukeridentitet mangler for Academy Google Vids-synk.",
      scope: {
        courseId,
        courseTitle,
      },
      workspace: null,
    };
  }

  const connection = await fetchGoogleConnectionMeta(pool, userId);
  const workspaceRow = courseId
    ? await fetchWorkspaceRow(pool, buildWorkspaceKey(courseId))
    : null;
  const workspace = workspaceRow ? mapWorkspaceRow(workspaceRow) : null;
  const workspaceGoogleEmail =
    readString(workspace?.metadata.googleEmail) || null;
  const connected = Boolean(connection.connected);
  const googleEmail = connection.googleEmail || workspaceGoogleEmail;
  const syncEligible = Boolean(connection.connected && courseId);

  let reason: string | null = null;
  if (!connected) {
    reason =
      "Logg inn med Google-kontoen din for aa skrive Vids-brief og teleprompter til Drive.";
  } else if (!courseId) {
    reason = "Velg et kurs foer du synker Google Vids-dokumentene.";
  } else if (!workspace) {
    reason =
      "Foerste synk oppretter Google Docs for brief og teleprompter i en egen Drive-mappe.";
  }

  return {
    connected,
    googleEmail,
    vidsUrl: GOOGLE_VIDS_HOME_URL,
    workspaceReady: Boolean(workspace),
    syncEligible,
    reason,
    scope: {
      courseId,
      courseTitle: courseTitle || workspace?.courseTitle || null,
    },
    workspace,
  };
}

export async function syncAcademyGoogleVidsWorkspace(
  pool: Pool,
  input: AcademyGoogleVidsSyncInput,
): Promise<AcademyGoogleVidsWorkspaceSummary> {
  await ensureAcademyGoogleVidsWorkspaceSchema(pool);

  const userId = readString(input.userId);
  if (!userId) {
    throw new Error("Brukeridentitet mangler for Academy Google Vids-synk.");
  }

  const snapshot = normalizeSnapshot(
    input.snapshot,
    input.courseId,
    input.courseTitle,
  );
  if (!snapshot) {
    throw new Error(
      "Kurssnapshot mangler eller er ugyldig for Academy Google Vids-synk.",
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
  const targetFolder = await ensureAcademyGoogleVidsFolder(
    driveApi,
    snapshot,
    existingWorkspace,
  );

  const briefDocument = await upsertPlainTextGoogleDocument(docsApi, driveApi, {
    title: `${snapshot.title} · Google Vids brief`,
    content: buildBriefDocumentContent(snapshot),
    parentFolderId: targetFolder.id,
    existingDocumentId: readString(existingWorkspace?.brief_google_doc_id),
  });

  const teleprompterDocument = await upsertPlainTextGoogleDocument(
    docsApi,
    driveApi,
    {
      title: `${snapshot.title} · Teleprompter`,
      content: buildTeleprompterDocumentContent(snapshot),
      parentFolderId: targetFolder.id,
      existingDocumentId: readString(
        existingWorkspace?.teleprompter_google_doc_id,
      ),
    },
  );

  const metadata = {
    googleEmail: authorized.connection.googleEmail,
    starterPrompt: snapshot.starterPrompt,
    purpose: snapshot.purpose,
    audience: snapshot.audience,
    transformation: snapshot.transformation,
    competencies: snapshot.competencies,
    skills: snapshot.skills,
    problemsSolved: snapshot.problemsSolved,
    learningJourney: snapshot.learningJourney,
    practiceDesign: snapshot.practiceDesign,
    proofOfLearning: snapshot.proofOfLearning,
    totalDurationMinutes: snapshot.totalDurationMinutes,
    missingFields: snapshot.missingFields,
    setupChecklist: snapshot.setupChecklist,
    productionNotes: snapshot.productionNotes,
    scenes: snapshot.scenes.map((scene) => ({
      id: scene.id,
      title: scene.title,
      recordingMode: scene.recordingMode,
      durationMinutes: scene.durationMinutes,
    })),
    locale: snapshot.locale,
    syncedFrom: "academy-curriculum",
    syncedAt: new Date().toISOString(),
  };

  const result = await pool.query<AcademyGoogleVidsWorkspaceRow>(
    `INSERT INTO academy_google_vids_workspaces (
       workspace_key,
       user_id,
       course_id,
       title,
       subtitle,
       course_title,
       google_drive_folder_id,
       google_drive_folder_name,
       google_drive_folder_url,
       brief_google_doc_id,
       brief_google_doc_url,
       teleprompter_google_doc_id,
       teleprompter_google_doc_url,
       scene_count,
       readiness,
       primary_mode,
       metadata,
       updated_at,
       last_synced_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, NOW(), NOW()
     )
     ON CONFLICT (workspace_key) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           course_id = EXCLUDED.course_id,
           title = EXCLUDED.title,
           subtitle = EXCLUDED.subtitle,
           course_title = EXCLUDED.course_title,
           google_drive_folder_id = EXCLUDED.google_drive_folder_id,
           google_drive_folder_name = EXCLUDED.google_drive_folder_name,
           google_drive_folder_url = EXCLUDED.google_drive_folder_url,
           brief_google_doc_id = EXCLUDED.brief_google_doc_id,
           brief_google_doc_url = EXCLUDED.brief_google_doc_url,
           teleprompter_google_doc_id = EXCLUDED.teleprompter_google_doc_id,
           teleprompter_google_doc_url = EXCLUDED.teleprompter_google_doc_url,
           scene_count = EXCLUDED.scene_count,
           readiness = EXCLUDED.readiness,
           primary_mode = EXCLUDED.primary_mode,
           metadata = EXCLUDED.metadata,
           updated_at = NOW(),
           last_synced_at = NOW()
     RETURNING *`,
    [
      workspaceKey,
      userId,
      snapshot.courseId,
      `${snapshot.title} · Google Vids Production`,
      snapshot.subtitle,
      snapshot.title,
      targetFolder.id,
      targetFolder.name,
      targetFolder.webViewLink,
      briefDocument.fileId,
      briefDocument.webViewUrl || briefDocument.webContentLink || null,
      teleprompterDocument.fileId,
      teleprompterDocument.webViewUrl ||
        teleprompterDocument.webContentLink ||
        null,
      snapshot.scenes.length,
      snapshot.readiness,
      snapshot.primaryMode,
      JSON.stringify(metadata),
    ],
  );

  const mappedWorkspace = result.rows[0]
    ? mapWorkspaceRow(result.rows[0])
    : null;
  if (!mappedWorkspace) {
    throw new Error("Kunne ikke lagre Academy Google Vids-workspacet.");
  }

  return mappedWorkspace;
}
