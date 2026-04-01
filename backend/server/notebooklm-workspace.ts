import { google } from 'googleapis';
import type { Pool } from 'pg';
import {
  ensureCustomerWorkflowFolder,
  upsertStructuredGoogleDocument,
  type StructuredGoogleDocumentBlock,
} from './customer-drive-sync.js';
import { resolveRoleRoomGoogleConnection } from './contract-google-signing.js';

type NotebookLmWorkspaceScopeInput = {
  userId?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  profession?: string | null;
  meetingId?: string | null;
  projectTitle?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  latestMeetingTitle?: string | null;
};

type NotebookLmResolvedScope = {
  userId: string;
  projectId: string | null;
  clientId: string | null;
  profession: string | null;
  meetingId: string | null;
  projectTitle: string | null;
  clientName: string | null;
  clientEmail: string | null;
  latestMeetingTitle: string | null;
};

type NotebookLmWorkspaceRow = {
  id: string;
  workspace_key: string;
  user_id: string;
  project_id: string | null;
  client_id: string | null;
  profession: string | null;
  title: string;
  description: string | null;
  google_drive_folder_id: string | null;
  google_drive_folder_name: string | null;
  google_drive_folder_url: string | null;
  google_doc_id: string | null;
  google_doc_url: string | null;
  source_document_ids: unknown;
  latest_meeting_id: string | null;
  meeting_note_count: number | null;
  metadata: unknown;
  created_at: string | null;
  updated_at: string | null;
  last_synced_at: string | null;
};

type MeetingNoteRow = {
  meeting_id: string | null;
  creator_id: string | null;
  project_id: string | null;
  client_id: string | null;
  profession: string | null;
  meeting_title: string | null;
  meeting_date: string | null;
  meeting_type: string | null;
  project_title?: string | null;
  practical_info: unknown;
  google_doc_id: string | null;
  is_client_visible: boolean | null;
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

const NOTEBOOK_LM_HOME_URL = 'https://notebooklm.google.com/';

let ensureNotebookLmWorkspaceSchemaPromise: Promise<void> | null = null;

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
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
    return [...new Set(value.map((entry) => readString(entry)).filter((entry): entry is string => Boolean(entry)))];
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return readStringArray(parsed);
    } catch {
      return [];
    }
  }

  return [];
}

function formatNorwegianDate(value: string | null | undefined): string {
  if (!value) {
    return 'Ukjent dato';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Ukjent dato';
  }

  return parsed.toLocaleString('no-NO');
}

function buildWorkspaceKey(scope: NotebookLmResolvedScope): string | null {
  if (scope.projectId) {
    return `project:${scope.projectId}`;
  }

  if (scope.clientId) {
    return `client:${scope.clientId}`;
  }

  return null;
}

function buildWorkspaceTitle(scope: NotebookLmResolvedScope): string {
  const label = scope.projectTitle || scope.clientName || scope.latestMeetingTitle || 'Møtenotater';
  return `${label} · NotebookLM Workspace`;
}

function sanitizeDriveFolderName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function buildWorkspaceDescription(scope: NotebookLmResolvedScope, meetingNoteCount: number, sourceDocumentCount: number): string {
  const scopeLabel = scope.projectTitle || scope.clientName || 'arbeidsrommet';
  return [
    `Sentral notehub for ${scopeLabel}.`,
    `${meetingNoteCount} møtenotater og ${sourceDocumentCount} Google Docs er klargjort som kilder for NotebookLM.`,
  ].join(' ');
}

function mapWorkspaceRow(row: NotebookLmWorkspaceRow): NotebookLmWorkspaceSummary {
  return {
    id: row.id,
    workspaceKey: row.workspace_key,
    title: row.title,
    description: row.description,
    projectId: row.project_id,
    clientId: row.client_id,
    profession: row.profession,
    driveFolderId: row.google_drive_folder_id,
    driveFolderName: row.google_drive_folder_name,
    driveFolderUrl: row.google_drive_folder_url,
    workspaceDocumentId: row.google_doc_id,
    workspaceDocumentUrl: row.google_doc_url,
    latestMeetingId: row.latest_meeting_id,
    meetingNoteCount: Number(row.meeting_note_count || 0),
    sourceDocumentIds: readStringArray(row.source_document_ids),
    lastSyncedAt: row.last_synced_at,
    metadata: readJsonObject(row.metadata),
  };
}

function mapSourceDocument(row: MeetingNoteRow): NotebookLmSourceDocument {
  const practicalInfo = readJsonObject(row.practical_info);
  return {
    meetingId: readString(row.meeting_id),
    meetingTitle: readString(row.meeting_title),
    meetingDate: readString(row.meeting_date),
    meetingType: readString(row.meeting_type),
    googleDocId: readString(row.google_doc_id),
    googleDocUrl: readString(practicalInfo.googleDocUrl),
    clientVisible: Boolean(row.is_client_visible),
  };
}

function buildNotebookLmBlocks(scope: NotebookLmResolvedScope, sourceDocuments: NotebookLmSourceDocument[]): StructuredGoogleDocumentBlock[] {
  const title = buildWorkspaceTitle(scope);
  const sourceDocumentCount = sourceDocuments.filter((entry) => entry.googleDocId || entry.googleDocUrl).length;
  const latestSource = sourceDocuments[0] || null;
  const recentMeetingLines = sourceDocuments.slice(0, 12).map((entry) => {
    const dateLabel = formatNorwegianDate(entry.meetingDate);
    const visibilityLabel = entry.clientVisible ? 'Klientsynlig' : 'Internt';
    return `${dateLabel} · ${entry.meetingTitle || 'Møtenotat'} · ${visibilityLabel}`;
  });
  const sourceLinkLines = sourceDocuments
    .filter((entry) => entry.googleDocUrl)
    .slice(0, 12)
    .map((entry) => `${entry.meetingTitle || 'Kilde'}: ${entry.googleDocUrl}`);

  const blocks: StructuredGoogleDocumentBlock[] = [
    { type: 'eyebrow', text: 'CreatorHub x Google Workspace' },
    { type: 'title', text: title },
    {
      type: 'subtitle',
      text: [
        scope.projectTitle || scope.clientName || null,
        scope.profession || null,
        scope.meetingId ? `Siste møte: ${scope.meetingId}` : null,
      ].filter(Boolean).join(' · '),
    },
    {
      type: 'spotlight',
      label: 'NotebookLM-kilder',
      value: `${sourceDocumentCount} Google Docs`,
      note: `${sourceDocuments.length} møtenotater i arbeidsrommet`,
    },
    {
      type: 'callout',
      title: 'Slik brukes arbeidsrommet',
      body: [
        'CreatorHub synker møtenotater til Google Docs i denne prosjektmappen.',
        'Åpne NotebookLM og legg til dokumentene fra denne mappen som kilder for oppsummering, Q&A og møtereferat.',
        'Dette arbeidsdokumentet fungerer som en sentral oversikt over siste møtenotater og kilder.',
      ].join('\n\n'),
    },
    { type: 'heading', text: 'Status' },
    {
      type: 'meta-list',
      items: [
        { label: 'Prosjekt', value: scope.projectTitle || null },
        { label: 'Klient', value: scope.clientName || null },
        { label: 'Møtenotater', value: String(sourceDocuments.length) },
        { label: 'Google Docs-kilder', value: String(sourceDocumentCount) },
        { label: 'NotebookLM', value: NOTEBOOK_LM_HOME_URL },
      ],
    },
  ];

  if (latestSource) {
    blocks.push(
      { type: 'heading', text: 'Siste møtenotat' },
      {
        type: 'callout',
        title: latestSource.meetingTitle || 'Nyeste kilde',
        body: [
          `Dato: ${formatNorwegianDate(latestSource.meetingDate)}`,
          `Type: ${latestSource.meetingType || 'Møte'}`,
          latestSource.googleDocUrl ? `Google Doc: ${latestSource.googleDocUrl}` : 'Google Doc opprettes ved neste synk.',
        ].join('\n'),
      },
    );
  }

  if (recentMeetingLines.length > 0) {
    blocks.push(
      { type: 'heading', text: 'Møtelogg' },
      { type: 'bullet-list', items: recentMeetingLines },
    );
  } else {
    blocks.push(
      { type: 'heading', text: 'Møtelogg' },
      {
        type: 'paragraph',
        text: 'Ingen møtenotater er synket ennå. Første notat fra CreatorHub vil automatisk bli lagt til som kilde.',
      },
    );
  }

  if (sourceLinkLines.length > 0) {
    blocks.push(
      { type: 'heading', text: 'Kildelinker' },
      { type: 'bullet-list', items: sourceLinkLines },
    );
  }

  return blocks;
}

async function ensureNotebookLmWorkspaceSchema(pool: Pool) {
  if (!ensureNotebookLmWorkspaceSchemaPromise) {
    ensureNotebookLmWorkspaceSchemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS notebooklm_workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_key VARCHAR NOT NULL UNIQUE,
        user_id VARCHAR NOT NULL,
        project_id VARCHAR,
        client_id VARCHAR,
        profession VARCHAR,
        title VARCHAR NOT NULL,
        description TEXT,
        google_drive_folder_id VARCHAR,
        google_drive_folder_name VARCHAR,
        google_drive_folder_url TEXT,
        google_doc_id VARCHAR,
        google_doc_url TEXT,
        source_document_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        latest_meeting_id VARCHAR,
        meeting_note_count INTEGER NOT NULL DEFAULT 0,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_synced_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_notebooklm_workspaces_user_id ON notebooklm_workspaces(user_id);
      CREATE INDEX IF NOT EXISTS idx_notebooklm_workspaces_project_id ON notebooklm_workspaces(project_id);
      CREATE INDEX IF NOT EXISTS idx_notebooklm_workspaces_client_id ON notebooklm_workspaces(client_id);
    `).then(() => undefined);
  }

  return ensureNotebookLmWorkspaceSchemaPromise;
}

async function fetchProjectContext(pool: Pool, projectId?: string | null) {
  const normalizedProjectId = readString(projectId);
  if (!normalizedProjectId) {
    return null;
  }

  const result = await pool.query(
    `SELECT id, customer_id, client_name, client_email, title, name, profession
       FROM legacy.projects
      WHERE id = $1
      LIMIT 1`,
    [normalizedProjectId],
  ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));

  return result.rows[0] || null;
}

async function fetchMeetingNote(pool: Pool, meetingId?: string | null) {
  const normalizedMeetingId = readString(meetingId);
  if (!normalizedMeetingId) {
    return null;
  }

  const result = await pool.query<MeetingNoteRow>(
    `SELECT meeting_id, creator_id, project_id, client_id, profession, meeting_title, meeting_date, meeting_type, practical_info, google_doc_id, is_client_visible
       FROM meeting_notes
      WHERE meeting_id = $1 OR id::text = $1
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1`,
    [normalizedMeetingId],
  ).catch(() => ({ rows: [] as MeetingNoteRow[] }));

  return result.rows[0] || null;
}

async function resolveScope(pool: Pool, input: NotebookLmWorkspaceScopeInput): Promise<NotebookLmResolvedScope | null> {
  const explicitUserId = readString(input.userId);
  const note = await fetchMeetingNote(pool, input.meetingId);
  const projectId = readString(input.projectId) || readString(note?.project_id);
  const projectContext = await fetchProjectContext(pool, projectId);
  const userId = explicitUserId || readString(note?.creator_id);

  if (!userId) {
    return null;
  }

  return {
    userId,
    projectId,
    clientId: readString(input.clientId) || readString(note?.client_id) || readString(projectContext?.customer_id),
    profession: readString(input.profession) || readString(note?.profession) || readString(projectContext?.profession),
    meetingId: readString(input.meetingId) || readString(note?.meeting_id),
    projectTitle:
      readString(input.projectTitle)
      || readString(projectContext?.title)
      || readString(projectContext?.name),
    clientName: readString(input.clientName) || readString(projectContext?.client_name),
    clientEmail: readString(input.clientEmail) || readString(projectContext?.client_email),
    latestMeetingTitle: readString(input.latestMeetingTitle) || readString(note?.meeting_title),
  };
}

async function fetchGoogleConnectionMeta(pool: Pool, userId: string) {
  const result = await pool.query(
    `SELECT google_email
       FROM role_room_google_connections
      WHERE user_id = $1
        AND connection_state = 'connected'
      ORDER BY last_used_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT 1`,
    [userId],
  ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));

  return {
    connected: Boolean(result.rows[0]),
    googleEmail: readString(result.rows[0]?.google_email),
  };
}

async function fetchWorkspaceRow(pool: Pool, workspaceKey: string) {
  const result = await pool.query<NotebookLmWorkspaceRow>(
    `SELECT *
       FROM notebooklm_workspaces
      WHERE workspace_key = $1
      LIMIT 1`,
    [workspaceKey],
  );

  return result.rows[0] || null;
}

async function fetchWorkspaceMeetingNotes(pool: Pool, scope: NotebookLmResolvedScope): Promise<MeetingNoteRow[]> {
  const params: string[] = [scope.userId];
  const whereParts = ['creator_id = $1'];

  if (scope.projectId) {
    params.push(scope.projectId);
    whereParts.push(`project_id = $${params.length}`);
  } else if (scope.clientId) {
    params.push(scope.clientId);
    whereParts.push(`client_id = $${params.length}`);
  } else {
    return [];
  }

  const result = await pool.query<MeetingNoteRow>(
    `SELECT meeting_id, creator_id, project_id, client_id, profession, meeting_title, meeting_date, meeting_type, practical_info, google_doc_id, is_client_visible
       FROM meeting_notes
      WHERE ${whereParts.join(' AND ')}
      ORDER BY meeting_date DESC NULLS LAST, updated_at DESC NULLS LAST
      LIMIT 50`,
    params,
  ).catch(() => ({ rows: [] as MeetingNoteRow[] }));

  return result.rows;
}

async function ensureDriveFolder(
  driveApi: ReturnType<typeof google.drive>,
  folderName: string,
  parentFolderId?: string | null,
) {
  const normalizedFolderName = sanitizeDriveFolderName(folderName) || 'CreatorHub';
  const queryParts = [
    `mimeType = 'application/vnd.google-apps.folder'`,
    'trashed = false',
    `name = '${normalizedFolderName.replace(/'/g, "\\'")}'`,
  ];

  if (parentFolderId) {
    queryParts.push(`'${parentFolderId}' in parents`);
  }

  const existing = await driveApi.files.list({
    q: queryParts.join(' and '),
    pageSize: 1,
    fields: 'files(id,name,webViewLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existingFolder = Array.isArray(existing.data.files) ? existing.data.files[0] : null;
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
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : undefined,
    },
    fields: 'id,name,webViewLink',
    supportsAllDrives: true,
  });

  return {
    id: readString(created.data.id) || crypto.randomUUID(),
    name: readString(created.data.name) || normalizedFolderName,
    webViewLink: readString(created.data.webViewLink),
  };
}

async function ensureNotebookLmFallbackFolder(
  driveApi: ReturnType<typeof google.drive>,
  scope: NotebookLmResolvedScope,
) {
  const rootFolderName = scope.clientName || scope.projectTitle || 'CreatorHub Workspace';
  const rootFolder = await ensureDriveFolder(driveApi, rootFolderName);
  const targetFolder = await ensureDriveFolder(driveApi, 'NotebookLM Workspace', rootFolder.id);

  return {
    id: targetFolder.id,
    name: targetFolder.name,
    webViewLink: targetFolder.webViewLink,
  };
}

export async function getNotebookLmWorkspaceStatus(
  pool: Pool,
  input: NotebookLmWorkspaceScopeInput,
): Promise<NotebookLmWorkspaceStatus> {
  await ensureNotebookLmWorkspaceSchema(pool);
  const scope = await resolveScope(pool, input);

  if (!scope) {
    return {
      connected: false,
      googleEmail: null,
      notebookLmUrl: NOTEBOOK_LM_HOME_URL,
      workspaceReady: false,
      syncEligible: false,
      reason: 'Brukeridentitet mangler for NotebookLM-arbeidsrommet.',
      scope: {
        projectId: null,
        clientId: null,
        profession: null,
        meetingId: null,
        projectTitle: null,
        clientName: null,
      },
      meetingNoteCount: 0,
      sourceDocumentCount: 0,
      latestMeetingId: null,
      sourceDocuments: [],
      workspace: null,
    };
  }

  const workspaceKey = buildWorkspaceKey(scope);
  const connection = await fetchGoogleConnectionMeta(pool, scope.userId);
  const sourceDocuments = workspaceKey
    ? (await fetchWorkspaceMeetingNotes(pool, scope)).map(mapSourceDocument)
    : [];
  const sourceDocumentCount = sourceDocuments.filter((entry) => entry.googleDocId || entry.googleDocUrl).length;
  const workspaceRow = workspaceKey ? await fetchWorkspaceRow(pool, workspaceKey) : null;
  const syncEligible = Boolean(connection.connected && workspaceKey && (scope.projectId || scope.clientId));

  let reason: string | null = null;
  if (!connection.connected) {
    reason = 'Koble Google Workspace for å gjøre møtenotatene NotebookLM-klare.';
  } else if (!workspaceKey) {
    reason = 'Velg et prosjekt eller en klientkoblet møteflate for å bygge NotebookLM-arbeidsrommet.';
  } else if (!workspaceRow && sourceDocuments.length === 0) {
    reason = 'Første møtenotat oppretter arbeidsrommet og de første kildene automatisk.';
  } else if (!workspaceRow) {
    reason = 'Kildene er klare. Synk arbeidsrommet for å opprette sentral NotebookLM-oversikt.';
  }

  return {
    connected: connection.connected,
    googleEmail: connection.googleEmail,
    notebookLmUrl: NOTEBOOK_LM_HOME_URL,
    workspaceReady: Boolean(workspaceRow),
    syncEligible,
    reason,
    scope: {
      projectId: scope.projectId,
      clientId: scope.clientId,
      profession: scope.profession,
      meetingId: scope.meetingId,
      projectTitle: scope.projectTitle,
      clientName: scope.clientName,
    },
    meetingNoteCount: sourceDocuments.length,
    sourceDocumentCount,
    latestMeetingId: sourceDocuments[0]?.meetingId || scope.meetingId || null,
    sourceDocuments,
    workspace: workspaceRow ? mapWorkspaceRow(workspaceRow) : null,
  };
}

export async function syncNotebookLmWorkspaceForScope(
  pool: Pool,
  input: NotebookLmWorkspaceScopeInput,
): Promise<NotebookLmWorkspaceSummary | null> {
  await ensureNotebookLmWorkspaceSchema(pool);
  const scope = await resolveScope(pool, input);
  const workspaceKey = scope ? buildWorkspaceKey(scope) : null;

  if (!scope || !workspaceKey) {
    return null;
  }

  const authorized = await resolveRoleRoomGoogleConnection(pool, scope.userId);
  const driveApi = google.drive({ version: 'v3', auth: authorized.oauthClient });
  const docsApi = google.docs({ version: 'v1', auth: authorized.oauthClient });
  const notes = await fetchWorkspaceMeetingNotes(pool, scope);
  const sourceDocuments = notes.map(mapSourceDocument);
  const existingWorkspace = await fetchWorkspaceRow(pool, workspaceKey);
  const workspaceTitle = buildWorkspaceTitle(scope);
  const workspaceDescription = buildWorkspaceDescription(
    scope,
    sourceDocuments.length,
    sourceDocuments.filter((entry) => entry.googleDocId || entry.googleDocUrl).length,
  );

  let targetFolder:
    | {
        id: string;
        name: string;
        webViewLink: string | null;
      }
    | null = null;

  try {
    const folder = await ensureCustomerWorkflowFolder(pool, driveApi, {
      userId: scope.userId,
      customerId: scope.clientId,
      customerName: scope.clientName,
      customerEmail: scope.clientEmail,
      projectId: scope.projectId,
      profession: scope.profession,
      category: 'meeting_notes',
    });
    targetFolder = folder.targetFolder;
  } catch {
    targetFolder = null;
  }

  if (!targetFolder) {
    targetFolder = await ensureNotebookLmFallbackFolder(driveApi, scope);
  }

  const document = await upsertStructuredGoogleDocument(docsApi, driveApi, {
    title: workspaceTitle,
    blocks: buildNotebookLmBlocks(scope, sourceDocuments),
    parentFolderId: targetFolder.id,
    existingDocumentId: existingWorkspace?.google_doc_id || null,
  });

  const metadata = {
    notebookLmUrl: NOTEBOOK_LM_HOME_URL,
    latestSourceDocumentUrl: sourceDocuments.find((entry) => entry.googleDocUrl)?.googleDocUrl || null,
    googleEmail: authorized.connection.googleEmail,
    sourceDocumentCount: sourceDocuments.filter((entry) => entry.googleDocId || entry.googleDocUrl).length,
  };

  const result = await pool.query<NotebookLmWorkspaceRow>(
    `INSERT INTO notebooklm_workspaces (
       workspace_key,
       user_id,
       project_id,
       client_id,
       profession,
       title,
       description,
       google_drive_folder_id,
       google_drive_folder_name,
       google_drive_folder_url,
       google_doc_id,
       google_doc_url,
       source_document_ids,
       latest_meeting_id,
       meeting_note_count,
       metadata,
       updated_at,
       last_synced_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16::jsonb, NOW(), NOW()
     )
     ON CONFLICT (workspace_key) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           project_id = EXCLUDED.project_id,
           client_id = EXCLUDED.client_id,
           profession = EXCLUDED.profession,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           google_drive_folder_id = EXCLUDED.google_drive_folder_id,
           google_drive_folder_name = EXCLUDED.google_drive_folder_name,
           google_drive_folder_url = EXCLUDED.google_drive_folder_url,
           google_doc_id = EXCLUDED.google_doc_id,
           google_doc_url = EXCLUDED.google_doc_url,
           source_document_ids = EXCLUDED.source_document_ids,
           latest_meeting_id = EXCLUDED.latest_meeting_id,
           meeting_note_count = EXCLUDED.meeting_note_count,
           metadata = EXCLUDED.metadata,
           updated_at = NOW(),
           last_synced_at = NOW()
     RETURNING *`,
    [
      workspaceKey,
      scope.userId,
      scope.projectId,
      scope.clientId,
      scope.profession,
      workspaceTitle,
      workspaceDescription,
      targetFolder.id,
      targetFolder.name,
      targetFolder.webViewLink,
      document.fileId,
      document.webViewUrl || document.webContentLink || null,
      JSON.stringify(
        [...new Set(sourceDocuments.map((entry) => entry.googleDocId).filter((entry): entry is string => Boolean(entry)))],
      ),
      sourceDocuments[0]?.meetingId || scope.meetingId || null,
      sourceDocuments.length,
      JSON.stringify(metadata),
    ],
  );

  return result.rows[0] ? mapWorkspaceRow(result.rows[0]) : null;
}

export async function syncNotebookLmWorkspaceForMeetingNote(
  pool: Pool,
  noteRow: { creator_id?: string | null; project_id?: string | null; client_id?: string | null; profession?: string | null; meeting_id?: string | null; meeting_title?: string | null },
  preferredUserId?: string | null,
): Promise<NotebookLmWorkspaceSummary | null> {
  return syncNotebookLmWorkspaceForScope(pool, {
    userId: readString(preferredUserId) || readString(noteRow.creator_id),
    projectId: readString(noteRow.project_id),
    clientId: readString(noteRow.client_id),
    profession: readString(noteRow.profession),
    meetingId: readString(noteRow.meeting_id),
    latestMeetingTitle: readString(noteRow.meeting_title),
  });
}
