/**
 * Communication Routes — Admin ↔ User Chat
 * 
 * Endpoints:
 *   GET  /api/communication/conversations   — list conversations for a user
 *   GET  /api/communication/messages/:channelId — messages in a channel
 *   POST /api/communication/messages          — send a message
 *   POST /api/chat/messages                   — alternative send (UniversalChatWidget)
 *   GET  /api/admin/communication/users       — list users with chat activity
 *   GET  /api/admin/communication/stats       — aggregate chat stats
 */

import multer from 'multer';
import { Router } from 'express';
import type { Request, Response } from 'express';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, and, sql, isNull } from 'drizzle-orm';
import type { Pool } from 'pg';
import { google } from 'googleapis';
import * as schema from '../migrations/schema.js';
import crypto from 'crypto';
import { Readable } from 'stream';
import { decryptGoogleToken as sharedDecryptGoogleToken } from './google-oauth-shared.js';
import { ensureContractsCompatibilitySchema } from './contract-google-signing.js';
import {
  getGoogleWorkspaceOauthConfig,
  normalizeGoogleWorkspaceOauthApp,
} from './google-workspace-oauth.js';

type DB = NodePgDatabase<typeof schema>;

type RoleRoomGoogleConnectionRow = {
  user_id: string | null;
  role_room_email?: string | null;
  google_email: string | null;
  google_subject: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  expiry_date: string | null;
  scopes?: unknown;
  oauth_app?: string | null;
};

type GoogleScopesCarrier = {
  scopes?: unknown;
} | null | undefined;

type DriveFolderReference = {
  id: string;
  name: string;
  webViewLink: string | null;
  parents?: string[];
};

type LiveGoogleChatContext = {
  accessToken: string;
  source: 'role_room_connection';
  connection: {
    userId: string | null;
    roleRoomEmail?: string | null;
    googleEmail: string | null;
    googleSubject: string | null;
    scopes: string[];
  };
};

type LiveGoogleWorkspaceContext = LiveGoogleChatContext & {
  oauthClient: InstanceType<typeof google.auth.OAuth2>;
};

type CrmConversationLinkRow = {
  id: string;
  provider: string;
  conversation_id: string;
  customer_id: string | null;
  deal_id: string | null;
  project_id: string | null;
  confidence: number | null;
  matched_by: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CrmCustomerDriveFolderRow = {
  id: string;
  user_id: string;
  customer_id: string;
  drive_folder_id: string | null;
  folder_name: string | null;
  folder_url: string | null;
  folder_structure: unknown;
  metadata: Record<string, unknown> | null;
  source: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CrmCustomerRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  profession: string | null;
  project_type: string | null;
  budget: string | number | null;
  status: string | null;
  tags: string[] | null;
  notes: string | null;
  source: string | null;
  custom_fields: Record<string, unknown> | null;
  project_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CrmDealRow = {
  id: string;
  title: string | null;
  value: string | number | null;
  currency: string | null;
  stage: string | null;
  probability: number | null;
  expected_close_date: string | null;
  service_type: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CrmActivityRow = {
  id: string;
  type: string | null;
  subject: string | null;
  description: string | null;
  scheduled_at: string | null;
  direction: string | null;
  outcome: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CrmTaskRow = {
  id: string;
  title: string | null;
  description: string | null;
  assigned_to: string | null;
  priority: string | null;
  status: string | null;
  due_date: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ConversationQuoteRow = {
  id: string;
  quote_number: string | null;
  title: string | null;
  total_amount: string | number | null;
  currency: string | null;
  status: string | null;
  valid_until: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  accepted_at: string | null;
  signature_status: string | null;
  contract_id: string | null;
  google_doc_url: string | null;
  client_id: string | null;
  project_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ConversationContractRow = {
  id: string;
  contract_number: string | null;
  contract_title: string | null;
  title: string | null;
  status: string | null;
  signature_status: string | null;
  total_amount: string | number | null;
  google_doc_url: string | null;
  signed_at: string | null;
  source_quote_id: string | null;
  client_id: string | null;
  project_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export function createCommunicationRouter(db: DB, pool: Pool): Router {
  const router = Router();
  const GMAIL_READ_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
  const GMAIL_DRAFT_SCOPES = ['https://www.googleapis.com/auth/gmail.compose'];
  const GMAIL_SEND_SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
  const GMAIL_WRITE_SCOPES = [...GMAIL_DRAFT_SCOPES, ...GMAIL_SEND_SCOPES];
  const PEOPLE_READ_SCOPES = [
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/contacts',
  ];
  const PEOPLE_WRITE_SCOPES = ['https://www.googleapis.com/auth/contacts'];
  const TASKS_READ_SCOPES = [
    'https://www.googleapis.com/auth/tasks.readonly',
    'https://www.googleapis.com/auth/tasks',
  ];
  const TASKS_WRITE_SCOPES = ['https://www.googleapis.com/auth/tasks'];
  const CONTEXTUAL_DRIVE_UPLOAD_MAX_BYTES = 512 * 1024 * 1024;
  const contextualDriveUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: CONTEXTUAL_DRIVE_UPLOAD_MAX_BYTES,
      files: 24,
    },
  });

  const toNonEmptyString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const normalizeChannelId = (raw: unknown): string => {
    const parsed = toNonEmptyString(raw);
    if (!parsed) return `chat-${crypto.randomUUID()}`;
    if (parsed.startsWith('spaces/')) return parsed.replace('spaces/', '');
    return parsed;
  };

  const normalizeGoogleSpaceName = (raw: unknown): string => {
    const parsed = toNonEmptyString(raw);
    if (!parsed) return `spaces/${crypto.randomUUID()}`;
    return parsed.startsWith('spaces/') ? parsed : `spaces/${parsed}`;
  };

  const normalizeFeedbackType = (category: unknown): 'bug' | 'feature' | 'usability' | 'general' | 'ui_ux' => {
    const normalized = toNonEmptyString(category)?.toLowerCase();
    if (normalized === 'bug' || normalized === 'technical_issue') return 'bug';
    if (normalized === 'feature_request' || normalized === 'feature') return 'feature';
    if (normalized === 'ui_ux' || normalized === 'design') return 'ui_ux';
    if (normalized === 'usability') return 'usability';
    return 'general';
  };

  const normalizePriority = (priority: unknown): 'low' | 'medium' | 'high' | 'critical' => {
    const normalized = toNonEmptyString(priority)?.toLowerCase();
    if (normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'critical') {
      return normalized;
    }
    return 'medium';
  };

  const normalizeStatus = (status: unknown): 'open' | 'in_progress' | 'resolved' | 'closed' => {
    const normalized = toNonEmptyString(status)?.toLowerCase();
    if (normalized === 'open' || normalized === 'in_progress' || normalized === 'resolved' || normalized === 'closed') {
      return normalized;
    }
    return 'open';
  };

  const normalizeCrmConversationProvider = (provider: unknown): 'internal-chat' | 'google-chat' | 'gmail' | 'evendi' => {
    const normalized = toNonEmptyString(provider)?.toLowerCase();
    if (normalized === 'google-chat' || normalized === 'google') {
      return 'google-chat';
    }
    if (normalized === 'gmail' || normalized === 'email' || normalized === 'google-mail') {
      return 'gmail';
    }
    if (normalized === 'evendi') {
      return 'evendi';
    }
    return 'internal-chat';
  };

  const normalizePhoneDigits = (value: unknown): string | null => {
    const parsed = toNonEmptyString(value);
    if (!parsed) {
      return null;
    }

    const digits = parsed.replace(/\D/g, '');
    return digits.length >= 5 ? digits : null;
  };

  const readStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry.length > 0);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return [];
      }
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        return readStringArray(parsed);
      } catch {
        return trimmed.split(/\s+/).map((entry) => entry.trim()).filter((entry) => entry.length > 0);
      }
    }

    return [];
  };

  const roleRoomGoogleConnectionHasScopes = (
    row: GoogleScopesCarrier,
    requiredScopes: string[],
  ): boolean => {
    const grantedScopes = new Set(readStringArray(row?.scopes).map((scope) => scope.toLowerCase()));
    return requiredScopes.every((scope) => grantedScopes.has(scope.toLowerCase()));
  };

  const roleRoomGoogleConnectionHasAnyScope = (
    row: GoogleScopesCarrier,
    acceptableScopes: string[],
  ): boolean => {
    const grantedScopes = new Set(readStringArray(row?.scopes).map((scope) => scope.toLowerCase()));
    return acceptableScopes.some((scope) => grantedScopes.has(scope.toLowerCase()));
  };

  const parseFiniteInteger = (value: unknown, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  };

  const readOptionalHeaderValue = (req: Request, headerName: string): string | null => {
    const raw = req.headers[headerName.toLowerCase()];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return toNonEmptyString(value);
  };

  const getPreferredGoogleWorkspaceIdentity = (
    req: Request,
    payload?: Record<string, unknown>,
  ): { userId: string | null; userEmail: string | null } => {
    const userId =
      readOptionalHeaderValue(req, 'x-role-room-user-id')
      || readOptionalHeaderValue(req, 'x-user-id')
      || toNonEmptyString(req.query.userId)
      || toNonEmptyString(payload?.userId)
      || null;

    const userEmail =
      readOptionalHeaderValue(req, 'x-role-room-email')
      || readOptionalHeaderValue(req, 'x-user-email')
      || toNonEmptyString(req.query.userEmail)
      || toNonEmptyString(payload?.userEmail)
      || null;

    return (
      {
        userId,
        userEmail: userEmail?.toLowerCase() || null,
      }
    );
  };

  const deriveRoleRoomGoogleEncryptionKey = (): Buffer | null => {
    const secret = readStringConfig(
      process.env.ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY
      ?? process.env.ROLE_ROOM_ENCRYPTION_KEY
      ?? process.env.SESSION_SECRET
      ?? process.env.JWT_SECRET
      ?? process.env.AUTH_SECRET,
    );

    if (!secret) {
      return null;
    }

    return crypto.createHash('sha256').update(secret).digest();
  };

  const readStringConfig = (value: unknown): string | null => {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  };

  // Slice 9X.80 — delegerer til shared dekryptor
  const decryptRoleRoomGoogleToken = (value: string | null | undefined): string | null => {
    return sharedDecryptGoogleToken(value);
  };

  const parseGoogleChatResponse = async (response: globalThis.Response): Promise<unknown> => {
    const bodyText = await response.text();
    if (!bodyText) {
      return null;
    }

    try {
      return JSON.parse(bodyText) as unknown;
    } catch {
      return bodyText;
    }
  };

  const formatGoogleChatError = (status: number, body: unknown): string => {
    const details = typeof body === 'string' ? body : JSON.stringify(body ?? {});
    return `Google Chat API svarte med ${status}: ${details}`;
  };

  const formatGoogleDriveError = (error: unknown): string => {
    if (error && typeof error === 'object') {
      const candidate = error as {
        message?: unknown;
        code?: unknown;
        response?: { status?: unknown; data?: unknown };
      };
      const status = typeof candidate.response?.status === 'number' ? candidate.response.status : candidate.code;
      const body = candidate.response?.data;
      if (typeof status === 'number') {
        return `Google Drive API svarte med ${status}: ${typeof body === 'string' ? body : JSON.stringify(body ?? {})}`;
      }
      if (typeof candidate.message === 'string' && candidate.message.trim().length > 0) {
        return candidate.message;
      }
    }

    return 'Google Drive-forespørselen feilet.';
  };

  const isRecord = (value: unknown): value is Record<string, unknown> => (
    !!value && typeof value === 'object' && !Array.isArray(value)
  );

  const GOOGLE_DRIVE_EXPORT_MIME_TYPES: Record<string, { mimeType: string; extension: string }> = {
    'application/vnd.google-apps.document': {
      mimeType: 'application/pdf',
      extension: 'pdf',
    },
    'application/vnd.google-apps.spreadsheet': {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
    },
    'application/vnd.google-apps.presentation': {
      mimeType: 'application/pdf',
      extension: 'pdf',
    },
    'application/vnd.google-apps.drawing': {
      mimeType: 'image/png',
      extension: 'png',
    },
  };

  const GOOGLE_DRIVE_FILE_FIELDS = [
    'id',
    'name',
    'mimeType',
    'size',
    'createdTime',
    'modifiedTime',
    'description',
    'iconLink',
    'thumbnailLink',
    'webViewLink',
    'webContentLink',
    'parents',
    'version',
    'fileExtension',
    'owners(displayName,emailAddress,photoLink)',
    'permissions(id,type,emailAddress,domain,role,allowFileDiscovery,deleted,pendingOwner)',
    'capabilities(canEdit,canDownload,canDelete,canRename,canShare)',
    'shared',
    'trashed',
  ].join(',');

  const GOOGLE_DRIVE_LIST_FIELDS = `nextPageToken, files(${GOOGLE_DRIVE_FILE_FIELDS})`;

  const buildDrivePermissionLabel = (permission: Record<string, unknown>): string => {
    const type = toNonEmptyString(permission.type) ?? 'unknown';
    if (type === 'user') {
      return toNonEmptyString(permission.emailAddress) ?? 'Bruker';
    }
    if (type === 'domain') {
      return toNonEmptyString(permission.domain) ?? 'Domene';
    }
    if (type === 'anyone') {
      return 'Alle med lenken';
    }
    return type;
  };

  const buildGoogleDrivePermissionRecord = (permission: unknown) => {
    const record = isRecord(permission) ? permission : {};
    return {
      id: toNonEmptyString(record.id) ?? crypto.randomUUID(),
      type: toNonEmptyString(record.type) ?? 'unknown',
      emailAddress: toNonEmptyString(record.emailAddress),
      domain: toNonEmptyString(record.domain),
      role: toNonEmptyString(record.role) ?? 'reader',
      allowFileDiscovery: record.allowFileDiscovery === true,
      deleted: record.deleted === true,
      pendingOwner: record.pendingOwner === true,
      label: buildDrivePermissionLabel(record),
    };
  };

  const buildGoogleDriveOwnerRecord = (owner: unknown) => {
    const record = isRecord(owner) ? owner : {};
    return {
      displayName: toNonEmptyString(record.displayName) ?? 'Ukjent eier',
      emailAddress: toNonEmptyString(record.emailAddress),
      photoLink: toNonEmptyString(record.photoLink),
    };
  };

  const buildGoogleDriveFileRecord = (file: Record<string, unknown>) => {
    const mimeType = toNonEmptyString(file.mimeType) ?? 'application/octet-stream';
    const owners = Array.isArray(file.owners)
      ? file.owners.map((entry) => buildGoogleDriveOwnerRecord(entry))
      : [];
    const permissions = Array.isArray(file.permissions)
      ? file.permissions.map((entry) => buildGoogleDrivePermissionRecord(entry))
      : [];
    const capabilities = isRecord(file.capabilities) ? file.capabilities : {};
    const exportFormat = GOOGLE_DRIVE_EXPORT_MIME_TYPES[mimeType] ?? null;

    return {
      id: toNonEmptyString(file.id) ?? crypto.randomUUID(),
      name: toNonEmptyString(file.name) ?? 'Uten navn',
      mimeType,
      isFolder: mimeType === 'application/vnd.google-apps.folder',
      size: file.size == null ? null : Number(file.size),
      createdTime: toNonEmptyString(file.createdTime),
      modifiedTime: toNonEmptyString(file.modifiedTime),
      description: toNonEmptyString(file.description),
      iconLink: toNonEmptyString(file.iconLink),
      thumbnailLink: toNonEmptyString(file.thumbnailLink),
      webViewLink: toNonEmptyString(file.webViewLink),
      webContentLink: toNonEmptyString(file.webContentLink),
      version: file.version == null ? null : Number(file.version),
      fileExtension: toNonEmptyString(file.fileExtension),
      parents: Array.isArray(file.parents) ? file.parents.filter((value): value is string => typeof value === 'string') : [],
      owners,
      owner: owners[0] ?? null,
      permissions,
      shared: file.shared === true,
      trashed: file.trashed === true,
      capabilities: {
        canEdit: capabilities.canEdit === true,
        canDownload: capabilities.canDownload === true,
        canDelete: capabilities.canDelete === true,
        canRename: capabilities.canRename === true,
        canShare: capabilities.canShare === true,
      },
      exportFormat,
    };
  };

  const mapDriveActivityAction = (activity: Record<string, unknown>): string => {
    const actions = isRecord(activity.primaryActionDetail) ? activity.primaryActionDetail : {};
    const actionMap: Array<[string, string]> = [
      ['create', 'Opprettet'],
      ['edit', 'Redigert'],
      ['move', 'Flyttet'],
      ['rename', 'Omdøpt'],
      ['delete', 'Slettet'],
      ['restore', 'Gjenopprettet'],
      ['permissionChange', 'Tilgang endret'],
      ['comment', 'Kommentert'],
      ['reference', 'Referert'],
      ['settingsChange', 'Innstillinger endret'],
    ];

    for (const [key, label] of actionMap) {
      if (isRecord(actions[key])) {
        return label;
      }
    }

    return 'Oppdatert';
  };

  const mapDriveActivityActors = (activity: Record<string, unknown>): string[] => {
    const actors = Array.isArray(activity.actors) ? activity.actors : [];
    return actors.flatMap((actor) => {
      if (!isRecord(actor) || !isRecord(actor.user)) {
        return [];
      }
      const knownUser = isRecord(actor.user.knownUser) ? actor.user.knownUser : {};
      const personName = toNonEmptyString(knownUser.personName);
      const isMe = knownUser.isCurrentUser === true;
      if (isMe) {
        return ['Deg'];
      }
      if (personName) {
        return [personName];
      }
      return ['Bruker'];
    });
  };

  const mapDriveActivityTargets = (activity: Record<string, unknown>): string[] => {
    const targets = Array.isArray(activity.targets) ? activity.targets : [];
    return targets.flatMap((target) => {
      if (!isRecord(target) || !isRecord(target.driveItem)) {
        return [];
      }
      const driveItem = target.driveItem;
      const title = isRecord(driveItem.title) ? driveItem.title : {};
      const itemTitle = toNonEmptyString(title.value);
      const name = toNonEmptyString(driveItem.name);
      return [itemTitle ?? name ?? 'Drive-element'];
    });
  };

  const mapDriveActivityTimestamp = (activity: Record<string, unknown>): string | null => {
    const timestamp = toNonEmptyString(activity.timestamp);
    if (timestamp) {
      return timestamp;
    }
    const timeRange = isRecord(activity.timeRange) ? activity.timeRange : {};
    return toNonEmptyString(timeRange.endTime) || toNonEmptyString(timeRange.startTime);
  };

  const formatGoogleWorkspaceApiError = (apiLabel: string, error: unknown): string => {
    if (error && typeof error === 'object') {
      const candidate = error as {
        message?: unknown;
        code?: unknown;
        response?: { status?: unknown; data?: unknown };
        errors?: unknown;
      };
      const status = typeof candidate.response?.status === 'number' ? candidate.response.status : candidate.code;
      const body = candidate.response?.data ?? candidate.errors;
      if (typeof status === 'number') {
        return `${apiLabel} svarte med ${status}: ${typeof body === 'string' ? body : JSON.stringify(body ?? {})}`;
      }
      if (typeof candidate.message === 'string' && candidate.message.trim().length > 0) {
        return candidate.message;
      }
    }

    return `${apiLabel} svarte med en ukjent feil.`;
  };

  const deriveGoogleWorkspaceReconnectIssue = (error: unknown): {
    status: 'needs_reconnect' | 'misconfigured';
    statusCode: number;
    message: string;
  } | null => {
    const rawMessage = error instanceof Error ? error.message : String(error ?? 'Google Workspace request failed');
    const payload = JSON.stringify((error as { response?: { data?: unknown } } | undefined)?.response?.data ?? {});
    const combined = `${rawMessage} ${payload}`.toLowerCase();

    if (combined.includes('invalid_rapt') || combined.includes('reauth related error')) {
      return {
        status: 'needs_reconnect',
        statusCode: 409,
        message: 'Google Workspace-koblingen krever ny innlogging. Koble Gmail på nytt for å fornye tilgangen.',
      };
    }

    if (combined.includes('invalid_grant') || combined.includes('token has been expired or revoked')) {
      return {
        status: 'needs_reconnect',
        statusCode: 409,
        message: 'Google Workspace-tilgangen har utløpt eller blitt tilbakekalt. Koble Gmail på nytt for å åpne e-postkanalen igjen.',
      };
    }

    if (combined.includes('unauthorized_client')) {
      return {
        status: 'misconfigured',
        statusCode: 500,
        message: 'Google Workspace-tokenet tilhører en annen OAuth-klient enn CreatorHub er konfigurert med.',
      };
    }

    return null;
  };

  const getGoogleWorkspaceApiStatus = (error: unknown): number => {
    const reconnectIssue = deriveGoogleWorkspaceReconnectIssue(error);
    if (reconnectIssue) {
      return reconnectIssue.statusCode;
    }

    if (error && typeof error === 'object') {
      const candidate = error as {
        code?: unknown;
        response?: { status?: unknown };
      };
      const responseStatus = candidate.response?.status;
      if (typeof responseStatus === 'number' && Number.isFinite(responseStatus)) {
        return responseStatus;
      }
      if (typeof candidate.code === 'number' && Number.isFinite(candidate.code)) {
        return candidate.code;
      }
    }

    return 500;
  };

  const getGmailHeaderValue = (
    headers: Array<{ name?: string | null; value?: string | null }> | undefined,
    name: string,
  ): string | null => {
    if (!Array.isArray(headers)) {
      return null;
    }

    const lowerName = name.toLowerCase();
    const match = headers.find((header) => header?.name?.toLowerCase() === lowerName);
    return toNonEmptyString(match?.value);
  };

  const parseMailboxHeader = (value: string | null) => {
    if (!value) {
      return { name: null, email: null };
    }

    const match = value.match(/^(?:"?([^"<]+)"?\s*)?<([^>]+)>$/);
    if (match) {
      return {
        name: toNonEmptyString(match[1]) || toNonEmptyString(match[2]),
        email: toNonEmptyString(match[2])?.toLowerCase() || null,
      };
    }

    const trimmed = value.trim();
    const emailMatch = trimmed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const email = toNonEmptyString(emailMatch?.[0])?.toLowerCase() || null;
    const withoutEmail = email ? trimmed.replace(email, '').replace(/[<>"]/g, '').trim() : trimmed;

    return {
      name: toNonEmptyString(withoutEmail) || email,
      email,
    };
  };

  const decodeGmailBodyData = (value: string | null | undefined): string | null => {
    const parsed = toNonEmptyString(value);
    if (!parsed) {
      return null;
    }

    try {
      const normalized = parsed.replace(/-/g, '+').replace(/_/g, '/');
      return Buffer.from(normalized, 'base64').toString('utf8');
    } catch {
      return null;
    }
  };

  const stripSimpleHtml = (value: string) => {
    return value
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  };

  const extractGmailPlainText = (payload: Record<string, unknown> | null | undefined): string | null => {
    if (!payload) {
      return null;
    }

    const mimeType = toNonEmptyString(payload.mimeType);
    const body = payload.body && typeof payload.body === 'object'
      ? payload.body as { data?: string | null }
      : undefined;

    if (mimeType === 'text/plain') {
      return decodeGmailBodyData(body?.data);
    }

    const parts = Array.isArray(payload.parts)
      ? payload.parts as Array<Record<string, unknown>>
      : [];

    for (const part of parts) {
      const nested = extractGmailPlainText(part);
      if (nested) {
        return nested;
      }
    }

    if (mimeType === 'text/html') {
      const html = decodeGmailBodyData(body?.data);
      return html ? stripSimpleHtml(html) : null;
    }

    return null;
  };

  const gmailPayloadHasAttachment = (payload: Record<string, unknown> | null | undefined): boolean => {
    if (!payload) {
      return false;
    }

    const filename = toNonEmptyString(payload.filename);
    const body = payload.body && typeof payload.body === 'object'
      ? payload.body as { attachmentId?: unknown }
      : undefined;

    if (filename || toNonEmptyString(body?.attachmentId)) {
      return true;
    }

    const parts = Array.isArray(payload.parts)
      ? payload.parts as Array<Record<string, unknown>>
      : [];

    return parts.some((part) => gmailPayloadHasAttachment(part));
  };

  const toIsoTimestamp = (value: string | number | null | undefined): string => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return new Date(value).toISOString();
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      if (/^\d+$/.test(value.trim())) {
        return new Date(Number(value.trim())).toISOString();
      }

      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) {
        return new Date(parsed).toISOString();
      }
    }

    return new Date().toISOString();
  };

  const buildGmailThreadUrl = (threadId: string) => `https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(threadId)}`;

  const deriveGmailCounterpart = (
    messages: Array<Record<string, unknown>>,
    authenticatedEmail: string | null,
  ) => {
    const normalizedAuthenticatedEmail = authenticatedEmail?.toLowerCase() ?? null;
    const parsedMessages = messages.map((message) => {
      const payload = message.payload && typeof message.payload === 'object'
        ? message.payload as { headers?: Array<{ name?: string | null; value?: string | null }> }
        : undefined;
      const headers = Array.isArray(payload?.headers) ? payload.headers : [];
      const from = parseMailboxHeader(getGmailHeaderValue(headers, 'From'));
      const replyTo = parseMailboxHeader(getGmailHeaderValue(headers, 'Reply-To'));
      const to = parseMailboxHeader(getGmailHeaderValue(headers, 'To'));
      const senderEmail = replyTo.email || from.email;
      const direction = normalizedAuthenticatedEmail && senderEmail === normalizedAuthenticatedEmail
        ? 'outbound'
        : 'inbound';

      return {
        direction,
        counterpart: direction === 'outbound' ? to : (replyTo.email ? replyTo : from),
      };
    });

    const preferredMessage =
      [...parsedMessages].reverse().find((entry) => entry.direction === 'inbound' && entry.counterpart.email)
      || [...parsedMessages].reverse().find((entry) => entry.counterpart.email)
      || parsedMessages[parsedMessages.length - 1]
      || null;

    return {
      name: preferredMessage?.counterpart.name || preferredMessage?.counterpart.email || 'Kontakt',
      email: preferredMessage?.counterpart.email || null,
      direction: preferredMessage?.direction || 'inbound',
    };
  };

  const buildReplySubject = (subject: string | null) => {
    const normalized = toNonEmptyString(subject) || 'Melding fra CreatorHub';
    return /^re:/i.test(normalized) ? normalized : `Re: ${normalized}`;
  };

  const mapGoogleTaskList = (taskList: Record<string, unknown>) => ({
    id: toNonEmptyString(taskList.id) || crypto.randomUUID(),
    title: toNonEmptyString(taskList.title) || 'Oppgaveliste',
    selfLink: toNonEmptyString(taskList.selfLink) || null,
    updated: toIsoTimestamp(toNonEmptyString(taskList.updated)),
  });

  const mapGoogleTask = (task: Record<string, unknown>) => ({
    id: toNonEmptyString(task.id) || crypto.randomUUID(),
    title: toNonEmptyString(task.title) || 'Oppgave',
    notes: toNonEmptyString(task.notes) || '',
    status: toNonEmptyString(task.status) === 'completed' ? 'completed' : 'needsAction',
    due: toNonEmptyString(task.due),
    completed: toNonEmptyString(task.completed),
    position: toNonEmptyString(task.position) || '',
    parent: toNonEmptyString(task.parent),
    links: Array.isArray(task.links)
      ? task.links
          .map((link) => {
            const linkRecord = link && typeof link === 'object' ? link as Record<string, unknown> : null;
            const type = toNonEmptyString(linkRecord?.type);
            const href = toNonEmptyString(linkRecord?.link);
            if (!type || !href) {
              return null;
            }
            return { type, link: href };
          })
          .filter((entry): entry is { type: string; link: string } => Boolean(entry))
      : [],
    selfLink: toNonEmptyString(task.selfLink) || '',
    updated: toIsoTimestamp(toNonEmptyString(task.updated)),
  });

  const buildGoogleTaskNotes = (payload: Record<string, unknown>) => {
    return [
      toNonEmptyString(payload.notes),
      toNonEmptyString(payload.projectId) ? `Prosjekt-ID: ${toNonEmptyString(payload.projectId)}` : null,
      toNonEmptyString(payload.projectName) ? `Prosjekt: ${toNonEmptyString(payload.projectName)}` : null,
      toNonEmptyString(payload.profession) ? `Profesjon: ${toNonEmptyString(payload.profession)}` : null,
      toNonEmptyString(payload.userId) ? `Bruker: ${toNonEmptyString(payload.userId)}` : null,
    ].filter((entry): entry is string => Boolean(entry)).join('\n\n');
  };

  const resolveGoogleTaskListId = async (
    workspaceContext: LiveGoogleWorkspaceContext,
    payload: Record<string, unknown>,
  ) => {
    const explicitListId = toNonEmptyString(payload.listId);
    if (explicitListId) {
      return explicitListId;
    }

    const tasksApi = google.tasks({ version: 'v1', auth: workspaceContext.oauthClient });
    const availableTaskLists = await tasksApi.tasklists.list({ maxResults: 100 });
    const taskLists = Array.isArray(availableTaskLists.data.items) ? availableTaskLists.data.items : [];

    const preferredNames = [
      toNonEmptyString(payload.projectName) ? `${toNonEmptyString(payload.projectName)} · CreatorHub` : null,
      toNonEmptyString(payload.profession) ? `CreatorHub · ${toNonEmptyString(payload.profession)}` : null,
      'CreatorHub Inbox',
    ].filter((entry): entry is string => Boolean(entry));

    const normalizedTaskLists = taskLists
      .map((taskList) => ({
        id: toNonEmptyString(taskList.id),
        title: toNonEmptyString(taskList.title),
      }))
      .filter((taskList): taskList is { id: string; title: string } => Boolean(taskList.id && taskList.title));

    for (const preferredName of preferredNames) {
      const match = normalizedTaskLists.find((taskList) => taskList.title.toLowerCase() === preferredName.toLowerCase());
      if (match) {
        return match.id;
      }
    }

    if (normalizedTaskLists[0]?.id) {
      return normalizedTaskLists[0].id;
    }

    const createdTaskList = await tasksApi.tasklists.insert({
      requestBody: {
        title: preferredNames[0] || 'CreatorHub Inbox',
      },
    });

    return toNonEmptyString(createdTaskList.data.id);
  };

  const shouldForceGoogleAccessTokenRefresh = (expiryTimestamp?: number | null): boolean => {
    return !Number.isFinite(expiryTimestamp) || Number(expiryTimestamp) <= Date.now() + 60_000;
  };

  const buildWorkspaceConnectionMetadata = (row: RoleRoomGoogleConnectionRow) => ({
    userId: readStringConfig(row.user_id),
    roleRoomEmail: readStringConfig(row.role_room_email),
    googleEmail: readStringConfig(row.google_email),
    googleSubject: readStringConfig(row.google_subject),
    scopes: readStringArray(row.scopes),
  });

  const resolveLiveGoogleWorkspaceContext = async (
    preferredUserId?: string | null,
    preferredUserEmail?: string | null,
  ): Promise<LiveGoogleWorkspaceContext | null> => {
    const configuredWorkspaceEmail = readStringConfig(process.env.GOOGLE_WORKSPACE_EMAIL);
    const configuredWorkspaceDomain = configuredWorkspaceEmail?.includes('@')
      ? configuredWorkspaceEmail.split('@')[1]?.toLowerCase() ?? null
      : null;

    const baseFilters = [
      `connection_state = 'connected'`,
      `(refresh_token_encrypted IS NOT NULL OR access_token_encrypted IS NOT NULL)`,
    ];
    const baseWhere = baseFilters.join(' AND ');
    const selectConnection = async (
      extraClause?: string,
      params: string[] = [],
    ): Promise<RoleRoomGoogleConnectionRow | null> => {
      const whereClause = extraClause
        ? `${baseWhere} AND ${extraClause}`
        : baseWhere;
      const result = await pool.query<RoleRoomGoogleConnectionRow>(
        `SELECT user_id, role_room_email, google_email, google_subject, access_token_encrypted, refresh_token_encrypted, expiry_date, scopes, oauth_app
         FROM role_room_google_connections
         WHERE ${whereClause}
         ORDER BY
           CASE WHEN refresh_token_encrypted IS NOT NULL THEN 0 ELSE 1 END,
           last_used_at DESC NULLS LAST,
           updated_at DESC NULLS LAST,
           created_at DESC NULLS LAST
         LIMIT 10`,
        params,
      );
      return (
        result.rows.find((entry) => normalizeGoogleWorkspaceOauthApp(entry.oauth_app, 'role_room') === 'creatorhub')
        ?? result.rows.find((entry) => normalizeGoogleWorkspaceOauthApp(entry.oauth_app, 'role_room') === 'role_room')
        ?? result.rows[0]
        ?? null
      );
    };

    let row: RoleRoomGoogleConnectionRow | null = null;
    if (preferredUserId) {
      row = await selectConnection(`user_id = $1`, [preferredUserId]);
    }

    if (!row && preferredUserEmail) {
      row = await selectConnection(`LOWER(google_email) = LOWER($1)`, [preferredUserEmail]);
    }

    if (!row && configuredWorkspaceDomain) {
      const workspaceDomainCount = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM role_room_google_connections
         WHERE ${baseWhere}
           AND LOWER(split_part(google_email, '@', 2)) = LOWER($1)`,
        [configuredWorkspaceDomain],
      );
      const matchingWorkspaceConnections = Number.parseInt(workspaceDomainCount.rows[0]?.count ?? '0', 10);
      if (matchingWorkspaceConnections === 1) {
        row = await selectConnection(
          `LOWER(split_part(google_email, '@', 2)) = LOWER($1)`,
          [configuredWorkspaceDomain],
        );
      }
    }

    if (!row) {
      const corporateConnectionCount = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM role_room_google_connections
         WHERE ${baseWhere}
           AND google_email IS NOT NULL
           AND LOWER(split_part(google_email, '@', 2)) NOT IN ('gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com', 'icloud.com')`,
      );
      const availableCorporateConnections = Number.parseInt(corporateConnectionCount.rows[0]?.count ?? '0', 10);
      if (availableCorporateConnections === 1) {
        row = await selectConnection(
          `google_email IS NOT NULL
           AND LOWER(split_part(google_email, '@', 2)) NOT IN ('gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com', 'icloud.com')`,
        );
      }
    }

    if (!row) {
      const countResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM role_room_google_connections
         WHERE ${baseWhere}`,
      );
      const availableConnections = Number.parseInt(countResult.rows[0]?.count ?? '0', 10);
      if (availableConnections === 1) {
        row = await selectConnection();
      }
    }

    if (!row) {
      return null;
    }
    const oauthApp = normalizeGoogleWorkspaceOauthApp(row.oauth_app, 'role_room');
    const oauthConfig = getGoogleWorkspaceOauthConfig(oauthApp);
    if (!oauthConfig.clientId || !oauthConfig.clientSecret || !oauthConfig.redirectUri) {
      return null;
    }
    const refreshToken = decryptRoleRoomGoogleToken(row.refresh_token_encrypted);
    const accessTokenSeed = decryptRoleRoomGoogleToken(row.access_token_encrypted);
    const expiryTimestamp = row.expiry_date ? Date.parse(row.expiry_date) : NaN;

    if (!refreshToken && !accessTokenSeed) {
      throw new Error('Fant ingen brukbar Google Chat-token i Role Room-koblingen.');
    }

    const oauthClient = new google.auth.OAuth2(
      oauthConfig.clientId,
      oauthConfig.clientSecret,
      oauthConfig.redirectUri,
    );

    oauthClient.setCredentials({
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
      ...(accessTokenSeed ? { access_token: accessTokenSeed } : {}),
      ...(Number.isFinite(expiryTimestamp) ? { expiry_date: expiryTimestamp } : {}),
    });

    let accessToken = accessTokenSeed;
    if (refreshToken) {
      try {
        if (shouldForceGoogleAccessTokenRefresh(expiryTimestamp)) {
          oauthClient.setCredentials({ refresh_token: refreshToken });
          // Slice 9X.80 — wrapper markerer needs_reauth ved invalid_grant
          const { refreshAccessTokenWithStateTracking } = await import('./google-oauth-shared.js');
          const refreshed = await refreshAccessTokenWithStateTracking(oauthClient, {
            pool,
            userId: row.user_id,
            context: 'communication_routes_refresh',
          });
          const refreshedCredentials = refreshed.credentials ?? oauthClient.credentials;
          accessToken = readStringConfig(refreshedCredentials.access_token ?? oauthClient.credentials.access_token);
        } else {
          const refreshed = await oauthClient.getAccessToken();
          accessToken = readStringConfig(refreshed.token ?? oauthClient.credentials.access_token) ?? accessToken;
        }
      } catch (error) {
        const wrappedError = error instanceof Error ? error : new Error(String(error));
        (wrappedError as Error & {
          workspaceConnection?: LiveGoogleWorkspaceContext['connection'];
          workspaceSource?: LiveGoogleWorkspaceContext['source'];
        }).workspaceConnection = buildWorkspaceConnectionMetadata(row);
        (wrappedError as Error & {
          workspaceConnection?: LiveGoogleWorkspaceContext['connection'];
          workspaceSource?: LiveGoogleWorkspaceContext['source'];
        }).workspaceSource = 'role_room_connection';
        throw wrappedError;
      }
    } else if (!accessTokenSeed || (Number.isFinite(expiryTimestamp) && expiryTimestamp <= Date.now())) {
      throw new Error('Google Chat-tilkoblingen mangler gyldig refresh-token.');
    }

    if (!accessToken) {
      throw new Error('Google returnerte ikke access token for Google Chat.');
    }

    return {
      accessToken,
      oauthClient,
      source: 'role_room_connection',
      connection: buildWorkspaceConnectionMetadata(row),
    };
  };

  const resolveLiveGoogleChatContext = async (
    preferredUserId?: string | null,
    preferredUserEmail?: string | null,
  ): Promise<LiveGoogleChatContext | null> => {
    const context = await resolveLiveGoogleWorkspaceContext(preferredUserId, preferredUserEmail);
    if (!context) {
      return null;
    }

    return {
      accessToken: context.accessToken,
      source: context.source,
      connection: context.connection,
    };
  };

  const sanitizeChatAttachments = (value: unknown) => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((attachment) => {
        const record = attachment && typeof attachment === 'object'
          ? attachment as Record<string, unknown>
          : null;
        const id = toNonEmptyString(record?.id) ?? crypto.randomUUID();
        const filename = toNonEmptyString(record?.filename ?? record?.name);
        const mimeType = toNonEmptyString(record?.mimeType) ?? 'application/octet-stream';
        const downloadUrl = toNonEmptyString(record?.downloadUrl ?? record?.webViewUrl ?? record?.webContentLink);
        const uploadedAt = toNonEmptyString(record?.uploadedAt) ?? new Date().toISOString();
        const fileSizeValue = Number(record?.fileSize ?? record?.size ?? 1);
        const fileSize = Number.isFinite(fileSizeValue) && fileSizeValue > 0
          ? Math.min(fileSizeValue, 50 * 1024 * 1024)
          : 1;
        const virusScanStatus = toNonEmptyString(record?.virusScanStatus) ?? 'clean';

        if (!filename || !downloadUrl) {
          return null;
        }

        return {
          id,
          filename,
          fileSize,
          mimeType,
          virusScanStatus,
          uploadedAt,
          downloadUrl,
        };
      })
      .filter((attachment): attachment is {
        id: string;
        filename: string;
        fileSize: number;
        mimeType: string;
        virusScanStatus: string;
        uploadedAt: string;
        downloadUrl: string;
      } => Boolean(attachment));
  };

  const getMessageMetadataRecord = (value: unknown): Record<string, unknown> => {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  };

  const tryLiveGoogleChatRequest = async (
    req: Request,
    endpoint: string,
    init: RequestInit = {},
    payload?: Record<string, unknown>,
  ): Promise<{
    context: LiveGoogleChatContext;
    response: globalThis.Response;
    body: unknown;
  } | null> => {
    const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req, payload);
    const context = await resolveLiveGoogleChatContext(preferredIdentity.userId, preferredIdentity.userEmail);
    if (!context) {
      return null;
    }

    const response = await fetch(`https://chat.googleapis.com/v1${endpoint}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${context.accessToken}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });

    const body = await parseGoogleChatResponse(response);
    return { context, response, body };
  };

  let crmConversationLinksTableReady: Promise<void> | null = null;
  const ensureCrmConversationLinksTable = async () => {
    if (!crmConversationLinksTableReady) {
      crmConversationLinksTableReady = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS crm_conversation_links (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider VARCHAR(64) NOT NULL,
            conversation_id VARCHAR(255) NOT NULL,
            customer_id VARCHAR(255),
            deal_id VARCHAR(255),
            project_id VARCHAR(255),
            confidence INTEGER NOT NULL DEFAULT 100,
            matched_by VARCHAR(64) NOT NULL DEFAULT 'manual',
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await pool.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_conversation_links_provider_conversation
            ON crm_conversation_links(provider, conversation_id)
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_crm_conversation_links_customer
            ON crm_conversation_links(customer_id)
        `);
      })().catch((error) => {
        crmConversationLinksTableReady = null;
        throw error;
      });
    }

    return crmConversationLinksTableReady;
  };

  let crmCustomerDriveFoldersTableReady: Promise<void> | null = null;
  const ensureCrmCustomerDriveFoldersTable = async () => {
    if (!crmCustomerDriveFoldersTableReady) {
      crmCustomerDriveFoldersTableReady = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS crm_customer_drive_folders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR(255) NOT NULL,
            customer_id VARCHAR(255) NOT NULL,
            drive_folder_id VARCHAR(255) NOT NULL,
            folder_name VARCHAR(255) NOT NULL,
            folder_url TEXT,
            folder_structure JSONB NOT NULL DEFAULT '[]'::jsonb,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            source VARCHAR(64) NOT NULL DEFAULT 'auto',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(user_id, customer_id)
          )
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_crm_customer_drive_folders_customer
            ON crm_customer_drive_folders(customer_id)
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_crm_customer_drive_folders_user
            ON crm_customer_drive_folders(user_id)
        `);
      })().catch((error) => {
        crmCustomerDriveFoldersTableReady = null;
        throw error;
      });
    }

    return crmCustomerDriveFoldersTableReady;
  };

  let googleDriveProjectsTableReady: Promise<void> | null = null;
  const ensureGoogleDriveProjectsTable = async () => {
    if (!googleDriveProjectsTableReady) {
      googleDriveProjectsTableReady = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS google_drive_projects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR(255) NOT NULL,
            project_id VARCHAR(255) NOT NULL,
            drive_folder_id VARCHAR(255) NOT NULL,
            folder_name VARCHAR(255) NOT NULL,
            folder_url TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await pool.query(`
          ALTER TABLE google_drive_projects
            ADD COLUMN IF NOT EXISTS drive_folder_id VARCHAR(255)
        `);
        await pool.query(`
          ALTER TABLE google_drive_projects
            ADD COLUMN IF NOT EXISTS folder_name VARCHAR(255)
        `);
        await pool.query(`
          ALTER TABLE google_drive_projects
            ADD COLUMN IF NOT EXISTS folder_url TEXT
        `);
        await pool.query(`
          ALTER TABLE google_drive_projects
            ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb
        `);
        await pool.query(`
          ALTER TABLE google_drive_projects
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        `);
        await pool.query(`
          ALTER TABLE google_drive_projects
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        `);
        await pool.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_google_drive_projects_user_project
            ON google_drive_projects(user_id, project_id)
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_google_drive_projects_project
            ON google_drive_projects(project_id)
        `);
      })().catch((error) => {
        googleDriveProjectsTableReady = null;
        throw error;
      });
    }

    return googleDriveProjectsTableReady;
  };

  const mapCrmCustomer = (row: CrmCustomerRow | null | undefined) => {
    if (!row) {
      return null;
    }

    const budgetValue = row.budget == null ? null : Number(row.budget);
    return {
      id: row.id,
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      company: row.company || '',
      profession: row.profession || '',
      projectType: row.project_type || '',
      budget: Number.isFinite(budgetValue) ? budgetValue : null,
      status: row.status || 'lead',
      tags: Array.isArray(row.tags) ? row.tags : [],
      notes: row.notes || '',
      source: row.source || '',
      customFields: row.custom_fields || {},
      projectId: row.project_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  };

  const mapCrmDeal = (row: CrmDealRow | null | undefined) => {
    if (!row) {
      return null;
    }

    const numericValue = row.value == null ? null : Number(row.value);
    return {
      id: row.id,
      title: row.title || 'Uten tittel',
      value: Number.isFinite(numericValue) ? numericValue : null,
      currency: row.currency || 'NOK',
      stage: row.stage || 'prospecting',
      probability: Number.isFinite(Number(row.probability)) ? Number(row.probability) : null,
      expectedCloseDate: row.expected_close_date,
      serviceType: row.service_type || null,
      notes: row.notes || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  };

  const mapCrmActivity = (row: CrmActivityRow | null | undefined) => {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      type: row.type || 'note',
      subject: row.subject || 'Uten emne',
      description: row.description || '',
      scheduledAt: row.scheduled_at,
      direction: row.direction || null,
      outcome: row.outcome || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  };

  const mapCrmTask = (row: CrmTaskRow | null | undefined) => {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      title: row.title || 'Uten tittel',
      description: row.description || '',
      assignedTo: row.assigned_to || null,
      priority: row.priority || 'medium',
      status: row.status || 'pending',
      dueDate: row.due_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  };

  const toFiniteNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const normalized = value.replace(',', '.');
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  };

  const mapConversationQuoteSummary = (row: ConversationQuoteRow | null | undefined) => {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      quoteNumber: row.quote_number || row.id,
      title: row.title || row.quote_number || 'Tilbud',
      totalAmount: toFiniteNumber(row.total_amount),
      currency: row.currency || 'NOK',
      status: row.status || 'draft',
      validUntil: row.valid_until,
      sentAt: row.sent_at,
      viewedAt: row.viewed_at,
      respondedAt: row.responded_at,
      acceptedAt: row.accepted_at,
      signatureStatus: row.signature_status || 'pending',
      contractId: row.contract_id || null,
      googleDocUrl: row.google_doc_url || null,
      clientId: row.client_id || null,
      projectId: row.project_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  };

  const mapConversationContractSummary = (row: ConversationContractRow | null | undefined) => {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      contractNumber: row.contract_number || row.id,
      title: row.contract_title || row.title || 'Kontrakt',
      status: row.status || 'draft',
      signatureStatus: row.signature_status || 'not_started',
      totalAmount: toFiniteNumber(row.total_amount),
      googleDocUrl: row.google_doc_url || null,
      signedAt: row.signed_at,
      sourceQuoteId: row.source_quote_id || null,
      clientId: row.client_id || null,
      projectId: row.project_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  };

  const buildCommercialTimeline = (
    quote: ReturnType<typeof mapConversationQuoteSummary>,
    contract: ReturnType<typeof mapConversationContractSummary>,
  ) => {
    const entries: Array<{
      id: string;
      kind: 'quote' | 'contract';
      label: string;
      timestamp: string;
      completed: boolean;
    }> = [];

    const pushEntry = (
      kind: 'quote' | 'contract',
      label: string,
      timestamp: string | null | undefined,
      completed = true,
    ) => {
      if (!timestamp) {
        return;
      }
      entries.push({
        id: `${kind}-${label}-${timestamp}`,
        kind,
        label,
        timestamp,
        completed,
      });
    };

    if (quote) {
      pushEntry('quote', 'Tilbud opprettet', quote.createdAt);
      pushEntry('quote', 'Tilbud sendt', quote.sentAt);
      pushEntry('quote', 'Tilbud åpnet', quote.viewedAt);
      pushEntry('quote', 'Tilbud akseptert', quote.acceptedAt);
      if (quote.status === 'rejected') {
        pushEntry('quote', 'Tilbud avslått', quote.respondedAt || quote.updatedAt);
      }
    }

    if (contract) {
      pushEntry('contract', 'Kontrakt opprettet', contract.createdAt);
      if (['prepared', 'sent', 'viewed', 'signed'].includes(contract.signatureStatus) || contract.status === 'pending_signatures') {
        pushEntry('contract', 'Kontrakt sendt til signering', contract.updatedAt || contract.createdAt);
      }
      pushEntry('contract', 'Kontrakt signert', contract.signedAt);
    }

    return entries.sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
  };

  const deriveCommercialFlow = (
    quote: ReturnType<typeof mapConversationQuoteSummary>,
    contract: ReturnType<typeof mapConversationContractSummary>,
  ) => {
    if (contract) {
      const isSigned = contract.signatureStatus === 'signed' || contract.status === 'signed';
      const isSentForSignature =
        ['prepared', 'sent', 'viewed'].includes(contract.signatureStatus) || contract.status === 'pending_signatures';

      if (isSigned) {
        return {
          stage: 'contract_signed',
          label: 'Kontrakt signert',
          detail: 'Avtalen er signert. Leveranse og videre oppfølging kan styres herfra.',
          nextAction: 'download_contract',
        } as const;
      }

      if (isSentForSignature) {
        return {
          stage: 'contract_sent',
          label: contract.signatureStatus === 'viewed' ? 'Kontrakt åpnet' : 'Kontrakt sendt',
          detail: contract.signatureStatus === 'viewed'
            ? 'Kontrakten er åpnet og venter på signatur.'
            : 'Kontrakten er sendt til signering og venter på respons.',
          nextAction: 'sync_contract',
        } as const;
      }

      return {
        stage: 'contract_ready',
        label: 'Kontrakt klar',
        detail: 'Tilbudet er landet. Send kontrakten til signering når du er klar.',
        nextAction: 'send_contract',
      } as const;
    }

    if (quote) {
      if (quote.status === 'accepted') {
        return {
          stage: 'quote_accepted',
          label: 'Tilbud godkjent',
          detail: 'Tilbudet er akseptert. Kontrakten skal nå følges opp.',
          nextAction: 'review_contract',
        } as const;
      }

      if (quote.status === 'rejected') {
        return {
          stage: 'quote_rejected',
          label: 'Tilbud avslått',
          detail: 'Tilbudet ble avslått. Revider innholdet eller opprett et nytt tilbud.',
          nextAction: 'create_quote',
        } as const;
      }

      if (quote.sentAt || quote.status === 'pending') {
        return {
          stage: 'quote_sent',
          label: 'Tilbud sendt',
          detail: 'Tilbudet er sendt og venter på svar fra kunden.',
          nextAction: 'follow_up_quote',
        } as const;
      }

      return {
        stage: 'quote_draft',
        label: 'Tilbud under arbeid',
        detail: 'Det finnes et tilbudsutkast for denne samtalen.',
        nextAction: 'create_quote',
      } as const;
    }

    return {
      stage: 'no_quote',
      label: 'Ingen tilbud sendt',
      detail: 'Start med et tilbud for å holde tilbud, kontrakt og CRM i samme flyt.',
      nextAction: 'create_quote',
    } as const;
  };

  const fetchCrmCustomerById = async (customerId: string | null) => {
    if (!customerId) {
      return null;
    }

    const result = await pool.query<CrmCustomerRow>(
      `SELECT id, name, email, phone, company, profession, project_type, budget, status, tags, notes, source, custom_fields, project_id, created_at, updated_at
         FROM crm_customers
        WHERE id::text = $1
        LIMIT 1`,
      [customerId],
    );
    return mapCrmCustomer(result.rows[0]);
  };

  const resolveInternalConversationHints = async (conversationId: string) => {
    const channelResult = await pool.query<{
      id: string;
      name: string | null;
      settings: Record<string, unknown> | null;
    }>(
      `SELECT id, name, settings
         FROM communication_channels
        WHERE id = $1
        LIMIT 1`,
      [conversationId],
    );

    const lastMessageResult = await pool.query<{
      content: string | null;
      created_at: string | null;
    }>(
      `SELECT content, created_at
         FROM communication_messages
        WHERE channel_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [conversationId],
    );

    const channel = channelResult.rows[0];
    const settings = channel?.settings || {};
    const lastMessage = lastMessageResult.rows[0] || null;

    return {
      name: toNonEmptyString(settings.clientName) || toNonEmptyString(channel?.name) || null,
      email: toNonEmptyString(settings.email) || null,
      phone: toNonEmptyString(settings.phone) || null,
      avatar: toNonEmptyString(settings.avatar) || null,
      lastMessage: toNonEmptyString(lastMessage?.content) || null,
      lastMessageAt: lastMessage?.created_at || null,
    };
  };

  const fetchSuggestedCrmCustomers = async (params: {
    customerId?: string | null;
    email?: string | null;
    phone?: string | null;
    name?: string | null;
  }) => {
    const candidates = new Map<string, ReturnType<typeof mapCrmCustomer> & {
      matchReason: string;
      matchStrength: number;
    }>();

    const addRows = (rows: CrmCustomerRow[], matchReason: string, matchStrength: number) => {
      rows.forEach((row) => {
        const mapped = mapCrmCustomer(row);
        if (!mapped || candidates.has(mapped.id)) {
          return;
        }
        candidates.set(mapped.id, { ...mapped, matchReason, matchStrength });
      });
    };

    if (params.customerId) {
      const result = await pool.query<CrmCustomerRow>(
        `SELECT id, name, email, phone, company, profession, project_type, budget, status, tags, notes, source, custom_fields, project_id, created_at, updated_at
           FROM crm_customers
          WHERE id::text = $1
          LIMIT 1`,
        [params.customerId],
      );
      addRows(result.rows, 'valgt klient', 100);
    }

    if (params.email) {
      const result = await pool.query<CrmCustomerRow>(
        `SELECT id, name, email, phone, company, profession, project_type, budget, status, tags, notes, source, custom_fields, project_id, created_at, updated_at
           FROM crm_customers
          WHERE LOWER(email) = LOWER($1)
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
          LIMIT 3`,
        [params.email],
      );
      addRows(result.rows, 'e-post', 96);
    }

    const phoneDigits = normalizePhoneDigits(params.phone);
    if (phoneDigits) {
      const result = await pool.query<CrmCustomerRow>(
        `SELECT id, name, email, phone, company, profession, project_type, budget, status, tags, notes, source, custom_fields, project_id, created_at, updated_at
           FROM crm_customers
          WHERE regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = $1
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
          LIMIT 3`,
        [phoneDigits],
      );
      addRows(result.rows, 'telefon', 88);
    }

    if (params.name && params.name.trim().length >= 2) {
      const normalizedName = params.name.trim();
      const result = await pool.query<CrmCustomerRow>(
        `SELECT id, name, email, phone, company, profession, project_type, budget, status, tags, notes, source, custom_fields, project_id, created_at, updated_at
           FROM crm_customers
          WHERE name ILIKE $1 OR company ILIKE $1
          ORDER BY
            CASE WHEN LOWER(name) = LOWER($2) THEN 0 ELSE 1 END,
            updated_at DESC NULLS LAST,
            created_at DESC NULLS LAST
          LIMIT 6`,
        [`%${normalizedName}%`, normalizedName],
      );
      addRows(result.rows, 'navn', 72);
    }

    return Array.from(candidates.values())
      .sort((left, right) => right.matchStrength - left.matchStrength)
      .slice(0, 6);
  };

  const fetchConversationCrmContext = async (params: {
    provider: 'internal-chat' | 'google-chat' | 'gmail' | 'evendi';
    conversationId: string;
    hintCustomerId?: string | null;
    hintName?: string | null;
    hintEmail?: string | null;
    hintPhone?: string | null;
    hintProjectId?: string | null;
    hintProjectName?: string | null;
    preferredUserId?: string | null;
  }) => {
    await ensureCrmConversationLinksTable();
    await ensureContractsCompatibilitySchema(pool);

    const normalizedProvider = normalizeCrmConversationProvider(params.provider);
    const linkResult = await pool.query<CrmConversationLinkRow>(
      `SELECT id, provider, conversation_id, customer_id, deal_id, project_id, confidence, matched_by, metadata, created_by, created_at, updated_at
         FROM crm_conversation_links
        WHERE provider = $1 AND conversation_id = $2
        LIMIT 1`,
      [normalizedProvider, params.conversationId],
    );

    const linkRow = linkResult.rows[0] || null;
    const internalHints = normalizedProvider === 'internal-chat'
      ? await resolveInternalConversationHints(params.conversationId)
      : {
          name: null,
          email: null,
          phone: null,
          avatar: null,
          lastMessage: null,
          lastMessageAt: null,
        };

    const hintName = params.hintName || internalHints.name;
    const hintEmail = params.hintEmail || internalHints.email;
    const hintPhone = params.hintPhone || internalHints.phone;

    const linkedCustomer = await fetchCrmCustomerById(toNonEmptyString(linkRow?.customer_id));
    const suggestedCustomers = await fetchSuggestedCrmCustomers({
      customerId: params.hintCustomerId || null,
      email: hintEmail,
      phone: hintPhone,
      name: hintName,
    });

    const recommendedCustomer = !linkedCustomer && suggestedCustomers.length > 0
      ? suggestedCustomers[0]
      : null;
    const resolvedCustomerId = linkedCustomer?.id || null;

    let activeDeal = null;
    let recentActivities: Array<ReturnType<typeof mapCrmActivity>> = [];
    let openTasks: Array<ReturnType<typeof mapCrmTask>> = [];

    if (resolvedCustomerId) {
      const dealResult = toNonEmptyString(linkRow?.deal_id)
        ? await pool.query<CrmDealRow>(
            `SELECT id, title, value, currency, stage, probability, expected_close_date, service_type, notes, created_at, updated_at
               FROM crm_deals
              WHERE id::text = $1
              LIMIT 1`,
            [linkRow?.deal_id],
          )
        : await pool.query<CrmDealRow>(
            `SELECT id, title, value, currency, stage, probability, expected_close_date, service_type, notes, created_at, updated_at
               FROM crm_deals
              WHERE customer_id::text = $1
              ORDER BY
                CASE WHEN stage IN ('closed_won', 'closed_lost') THEN 1 ELSE 0 END,
                updated_at DESC NULLS LAST,
                created_at DESC NULLS LAST
              LIMIT 1`,
            [resolvedCustomerId],
          );

      activeDeal = mapCrmDeal(dealResult.rows[0]);

      const activityResult = await pool.query<CrmActivityRow>(
        `SELECT id, type, subject, description, scheduled_at, direction, outcome, created_at, updated_at
           FROM crm_activities
          WHERE customer_id::text = $1
          ORDER BY COALESCE(scheduled_at, created_at) DESC NULLS LAST, created_at DESC NULLS LAST
          LIMIT 6`,
        [resolvedCustomerId],
      );
      recentActivities = activityResult.rows.map(mapCrmActivity).filter(Boolean);

      const taskResult = await pool.query<CrmTaskRow>(
        `SELECT id, title, description, assigned_to, priority, status, due_date, created_at, updated_at
           FROM crm_tasks
          WHERE customer_id::text = $1 AND status <> 'completed'
          ORDER BY due_date ASC NULLS LAST, created_at DESC NULLS LAST
          LIMIT 6`,
        [resolvedCustomerId],
      );
      openTasks = taskResult.rows.map(mapCrmTask).filter(Boolean);
    }

    const commercialProjectId =
      toNonEmptyString(linkRow?.project_id)
      || params.hintProjectId
      || linkedCustomer?.projectId
      || null;
    const commercialEmail = hintEmail || linkedCustomer?.email || null;
    let latestQuote: ReturnType<typeof mapConversationQuoteSummary> = null;
    let latestContract: ReturnType<typeof mapConversationContractSummary> = null;

    try {
      if (resolvedCustomerId || commercialProjectId || commercialEmail) {
        const quoteResult = await pool.query<ConversationQuoteRow>(
          `SELECT id, quote_number, title, total_amount, currency, status, valid_until, sent_at, viewed_at, responded_at, accepted_at,
                  signature_status, contract_id, google_doc_url, client_id, project_id, created_at, updated_at
             FROM quotes
            WHERE ($1::text IS NOT NULL AND client_id::text = $1)
               OR ($2::text IS NOT NULL AND project_id::text = $2)
               OR ($3::text IS NOT NULL AND LOWER(COALESCE(client_email, '')) = LOWER($3))
            ORDER BY
              CASE WHEN $2::text IS NOT NULL AND project_id::text = $2 THEN 0 ELSE 1 END,
              CASE WHEN $1::text IS NOT NULL AND client_id::text = $1 THEN 0 ELSE 1 END,
              COALESCE(accepted_at, responded_at, viewed_at, sent_at, updated_at, created_at) DESC NULLS LAST,
              created_at DESC NULLS LAST
            LIMIT 1`,
          [resolvedCustomerId, commercialProjectId, commercialEmail],
        );
        latestQuote = mapConversationQuoteSummary(quoteResult.rows[0]);
      }

      if (latestQuote?.contractId) {
        const contractResult = await pool.query<ConversationContractRow>(
          `SELECT id, contract_number, contract_title, title, status, signature_status, total_amount,
                  google_doc_url, signed_at, source_quote_id, client_id, project_id, created_at, updated_at
             FROM contracts
            WHERE id = $1
            LIMIT 1`,
          [latestQuote.contractId],
        );
        latestContract = mapConversationContractSummary(contractResult.rows[0]);
      }

      if (!latestContract && (resolvedCustomerId || commercialProjectId || latestQuote?.id)) {
        const contractResult = await pool.query<ConversationContractRow>(
          `SELECT id, contract_number, contract_title, title, status, signature_status, total_amount,
                  google_doc_url, signed_at, source_quote_id, client_id, project_id, created_at, updated_at
             FROM contracts
            WHERE ($1::text IS NOT NULL AND client_id::text = $1)
               OR ($2::text IS NOT NULL AND project_id::text = $2)
               OR ($3::text IS NOT NULL AND source_quote_id::text = $3)
            ORDER BY
              CASE WHEN $3::text IS NOT NULL AND source_quote_id::text = $3 THEN 0 ELSE 1 END,
              COALESCE(signed_at, updated_at, created_at) DESC NULLS LAST,
              created_at DESC NULLS LAST
            LIMIT 1`,
          [resolvedCustomerId, commercialProjectId, latestQuote?.id || null],
        );
        latestContract = mapConversationContractSummary(contractResult.rows[0]);
      }
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code !== '42P01') {
        console.warn('Commercial CRM context lookup skipped:', error instanceof Error ? error.message : error);
      }
    }

    const nextFollowUp = openTasks[0]?.dueDate
      ? `Følg opp ${new Date(openTasks[0].dueDate).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}`
      : recentActivities[0]?.scheduledAt
        ? `Aktivitet ${new Date(recentActivities[0].scheduledAt).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}`
        : null;

    const persistedDriveFolder =
      params.preferredUserId && resolvedCustomerId
        ? await getPersistedCustomerDriveFolder(params.preferredUserId, resolvedCustomerId)
        : null;
    const legacyDriveFolder = linkedCustomer
      ? getDriveFolderMetadataFromCustomFields(linkedCustomer.customFields as Record<string, unknown> | null | undefined)
      : null;
    const driveContext = persistedDriveFolder
      ? {
          folderId: persistedDriveFolder.id,
          folderName: persistedDriveFolder.name,
          folderUrl: persistedDriveFolder.webViewLink,
          folderStructure: persistedDriveFolder.folderStructure,
          source: persistedDriveFolder.source,
          status: 'ready' as const,
        }
      : legacyDriveFolder
        ? {
            folderId: legacyDriveFolder.folderId,
            folderName: legacyDriveFolder.folderName || 'Kundemappe',
            folderUrl: legacyDriveFolder.folderUrl || null,
            folderStructure: legacyDriveFolder.folderStructure,
            source: 'crm-custom-fields' as const,
            status: 'ready' as const,
          }
        : linkedCustomer
          ? {
            folderId: null,
            folderName: buildCustomerDriveFolderName({
              customerName: linkedCustomer.name,
              companyName: linkedCustomer.company,
            }),
              folderUrl: null,
              folderStructure: [],
              source: 'missing' as const,
              status: 'missing' as const,
            }
          : null;

    return {
      provider: normalizedProvider,
      conversationId: params.conversationId,
      relationshipState: linkedCustomer
        ? 'linked'
        : recommendedCustomer
          ? 'match_available'
          : 'unlinked',
      conversation: {
        id: params.conversationId,
        name: hintName || null,
        email: hintEmail || null,
        phone: hintPhone || null,
        projectId: params.hintProjectId || null,
        projectName: params.hintProjectName || null,
        avatar: internalHints.avatar,
        lastMessage: internalHints.lastMessage,
        lastMessageAt: internalHints.lastMessageAt,
      },
      link: linkRow
        ? {
            id: linkRow.id,
            provider: linkRow.provider,
            conversationId: linkRow.conversation_id,
            customerId: linkRow.customer_id,
            dealId: linkRow.deal_id,
            projectId: linkRow.project_id,
            confidence: linkRow.confidence ?? 100,
            matchedBy: linkRow.matched_by || 'manual',
            metadata: linkRow.metadata || {},
            createdBy: linkRow.created_by,
            createdAt: linkRow.created_at,
            updatedAt: linkRow.updated_at,
          }
        : null,
      customer: linkedCustomer,
      recommendedCustomer,
      suggestedCustomers,
      activeDeal,
      recentActivities,
      openTasks,
      summary: {
        nextFollowUp,
        openTaskCount: openTasks.length,
        recentActivityCount: recentActivities.length,
        pendingReplyHint: Boolean(internalHints.lastMessage),
      },
      commercial: {
        quote: latestQuote,
        contract: latestContract,
        timeline: buildCommercialTimeline(latestQuote, latestContract),
        ...deriveCommercialFlow(latestQuote, latestContract),
      },
      drive: driveContext,
    };
  };

  const resolveConversationCrmLink = async (
    provider: unknown,
    conversationId: string,
  ) => {
    await ensureCrmConversationLinksTable();

    const normalizedProvider = normalizeCrmConversationProvider(provider);
    const linkResult = await pool.query<CrmConversationLinkRow>(
      `SELECT id, provider, conversation_id, customer_id, deal_id, project_id, confidence, matched_by, metadata, created_by, created_at, updated_at
         FROM crm_conversation_links
        WHERE provider = $1 AND conversation_id = $2
        LIMIT 1`,
      [normalizedProvider, conversationId],
    );

    return linkResult.rows[0] || null;
  };

  const ensureChannelExists = async (channelId: string, channelName?: string, channelType: string = 'chat') => {
    const existing = await db
      .select({ id: schema.communicationChannels.id })
      .from(schema.communicationChannels)
      .where(eq(schema.communicationChannels.id, channelId))
      .limit(1);

    if (existing.length > 0) return;

    const now = new Date().toISOString();
    await db.insert(schema.communicationChannels).values({
      id: channelId,
      name: channelName || `Chat ${channelId}`,
      type: channelType,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  };

  const persistMessage = async (params: {
    id?: string;
    channelId: string;
    senderId: string;
    content: string;
    messageType: string;
    metadata?: Record<string, unknown>;
    timestamp?: string;
  }) => {
    const messageId = toNonEmptyString(params.id) || crypto.randomUUID();
    const now = new Date().toISOString();
    const createdAt = params.timestamp || now;

    try {
      await db.insert(schema.communicationMessages).values({
        id: messageId,
        channelId: params.channelId,
        senderId: params.senderId,
        messageType: params.messageType,
        content: params.content,
        metadata: params.metadata || {},
        isRead: false,
        isPriority: false,
        isSystemGenerated: false,
        createdAt,
        updatedAt: now,
      });
    } catch (error: any) {
      // The chat widget sends the same clientMessageId through WebSocket and HTTP.
      // If the WebSocket insert lands first, upgrade the stored row instead of
      // failing the HTTP request so attachments/metadata are merged in cleanly.
      const duplicateKeyCode = error?.code || error?.cause?.code;
      if (duplicateKeyCode !== '23505') {
        throw error;
      }

      await db
        .update(schema.communicationMessages)
        .set({
          channelId: params.channelId,
          senderId: params.senderId,
          messageType: params.messageType,
          content: params.content,
          metadata: params.metadata || {},
          updatedAt: now,
        })
        .where(eq(schema.communicationMessages.id, messageId));
    }

    await db
      .update(schema.communicationChannels)
      .set({ updatedAt: now })
      .where(eq(schema.communicationChannels.id, params.channelId));

    const persistedRows = await db
      .select({ createdAt: schema.communicationMessages.createdAt })
      .from(schema.communicationMessages)
      .where(eq(schema.communicationMessages.id, messageId))
      .limit(1);

    return {
      id: messageId,
      timestamp: persistedRows[0]?.createdAt || createdAt,
    };
  };

  router.get('/api/universal-crm/context/by-conversation', async (req, res) => {
    try {
      const rawConversationId = toNonEmptyString(req.query.conversationId);
      if (!rawConversationId) {
        return res.status(400).json({ error: 'conversationId is required' });
      }

      const context = await fetchConversationCrmContext({
        provider: normalizeCrmConversationProvider(req.query.provider),
        conversationId: rawConversationId,
        hintCustomerId: toNonEmptyString(req.query.customerId),
        hintName: toNonEmptyString(req.query.hintName),
        hintEmail: toNonEmptyString(req.query.hintEmail),
        hintPhone: toNonEmptyString(req.query.hintPhone),
        hintProjectId: toNonEmptyString(req.query.projectId),
        hintProjectName: toNonEmptyString(req.query.projectName),
        preferredUserId: readOptionalHeaderValue(req, 'x-user-id'),
      });

      return res.json(context);
    } catch (error) {
      console.error('CRM conversation context error:', error);
      return res.status(500).json({ error: 'Failed to fetch CRM context for conversation' });
    }
  });

  router.post('/api/universal-crm/context/link', async (req, res) => {
    try {
      await ensureCrmConversationLinksTable();

      const payload = (req.body || {}) as Record<string, unknown>;
      const conversationId = toNonEmptyString(payload.conversationId);
      const customerId = toNonEmptyString(payload.customerId);
      const provider = normalizeCrmConversationProvider(payload.provider);
      const matchedBy = toNonEmptyString(payload.matchedBy) || 'manual';
      const createdBy =
        toNonEmptyString(payload.createdBy) ||
        readOptionalHeaderValue(req, 'x-user-id') ||
        readOptionalHeaderValue(req, 'x-user-email');
      const projectId = toNonEmptyString(payload.projectId);
      const dealId = toNonEmptyString(payload.dealId);
      const confidence = Math.max(0, Math.min(100, parseFiniteInteger(payload.confidence, 100)));
      const metadata =
        typeof payload.metadata === 'object' && payload.metadata !== null
          ? payload.metadata as Record<string, unknown>
          : {};

      if (!conversationId || !customerId) {
        return res.status(400).json({ error: 'conversationId and customerId are required' });
      }

      await pool.query(
        `INSERT INTO crm_conversation_links (
           provider, conversation_id, customer_id, deal_id, project_id, confidence, matched_by, metadata, created_by, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, NOW(), NOW())
         ON CONFLICT (provider, conversation_id)
         DO UPDATE SET
           customer_id = EXCLUDED.customer_id,
           deal_id = EXCLUDED.deal_id,
           project_id = EXCLUDED.project_id,
           confidence = EXCLUDED.confidence,
           matched_by = EXCLUDED.matched_by,
           metadata = EXCLUDED.metadata,
           created_by = COALESCE(crm_conversation_links.created_by, EXCLUDED.created_by),
           updated_at = NOW()`,
        [
          provider,
          conversationId,
          customerId,
          dealId,
          projectId,
          confidence,
          matchedBy,
          JSON.stringify(metadata),
          createdBy,
        ],
      );

      const context = await fetchConversationCrmContext({
        provider,
        conversationId,
        hintCustomerId: customerId,
        preferredUserId: readOptionalHeaderValue(req, 'x-user-id'),
      });

      return res.json({ success: true, context });
    } catch (error) {
      console.error('CRM conversation link error:', error);
      return res.status(500).json({ error: 'Failed to link conversation to CRM customer' });
    }
  });

  router.post('/api/universal-crm/context/unlink', async (req, res) => {
    try {
      await ensureCrmConversationLinksTable();

      const payload = (req.body || {}) as Record<string, unknown>;
      const conversationId = toNonEmptyString(payload.conversationId);
      const provider = normalizeCrmConversationProvider(payload.provider);

      if (!conversationId) {
        return res.status(400).json({ error: 'conversationId is required' });
      }

      await pool.query(
        `DELETE FROM crm_conversation_links
          WHERE provider = $1 AND conversation_id = $2`,
        [provider, conversationId],
      );

      return res.json({ success: true });
    } catch (error) {
      console.error('CRM conversation unlink error:', error);
      return res.status(500).json({ error: 'Failed to unlink conversation from CRM' });
    }
  });

  router.post('/api/universal-crm/context/create-customer-link', async (req, res) => {
    try {
      await ensureCrmConversationLinksTable();

      const payload = (req.body || {}) as Record<string, unknown>;
      const conversationId = toNonEmptyString(payload.conversationId);
      const provider = normalizeCrmConversationProvider(payload.provider);
      const name = toNonEmptyString(payload.name);
      const email = toNonEmptyString(payload.email);
      const phone = toNonEmptyString(payload.phone);
      const company = toNonEmptyString(payload.company);
      const profession = toNonEmptyString(payload.profession);
      const projectId = toNonEmptyString(payload.projectId);
      const projectType = toNonEmptyString(payload.projectType);
      const source = toNonEmptyString(payload.source) || 'chat-conversation';
      const notes = toNonEmptyString(payload.notes);
      const createdBy =
        toNonEmptyString(payload.createdBy) ||
        readOptionalHeaderValue(req, 'x-user-id') ||
        readOptionalHeaderValue(req, 'x-user-email');
      const status = toNonEmptyString(payload.status) || 'lead';

      if (!conversationId || !name) {
        return res.status(400).json({ error: 'conversationId and name are required' });
      }

      const customerResult = await pool.query<CrmCustomerRow>(
        `INSERT INTO crm_customers (
           id, name, email, phone, company, profession, project_type, status, source, notes, custom_fields, created_at, updated_at
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW(), NOW()
         )
         RETURNING id, name, email, phone, company, profession, project_type, budget, status, tags, notes, source, custom_fields, project_id, created_at, updated_at`,
        [
          name,
          email,
          phone,
          company,
          profession,
          projectType,
          status,
          source,
          notes,
          JSON.stringify({
            conversationId,
            provider,
            createdFrom: 'universal-chat-widget',
          }),
        ],
      );

      const customer = mapCrmCustomer(customerResult.rows[0]);
      if (!customer) {
        return res.status(500).json({ error: 'Customer could not be created' });
      }

      await pool.query(
        `INSERT INTO crm_conversation_links (
           provider, conversation_id, customer_id, project_id, confidence, matched_by, metadata, created_by, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, 100, 'manual-create', $5::jsonb, $6, NOW(), NOW())
         ON CONFLICT (provider, conversation_id)
         DO UPDATE SET
           customer_id = EXCLUDED.customer_id,
           project_id = EXCLUDED.project_id,
           confidence = 100,
           matched_by = 'manual-create',
           metadata = EXCLUDED.metadata,
           created_by = COALESCE(crm_conversation_links.created_by, EXCLUDED.created_by),
           updated_at = NOW()`,
        [
          provider,
          conversationId,
          customer.id,
          projectId,
          JSON.stringify({ source: 'chat-create-link' }),
          createdBy,
        ],
      );

      const context = await fetchConversationCrmContext({
        provider,
        conversationId,
        hintCustomerId: customer.id,
        preferredUserId: readOptionalHeaderValue(req, 'x-user-id'),
      });

      return res.status(201).json({ success: true, customer, context });
    } catch (error) {
      console.error('CRM create customer and link error:', error);
      return res.status(500).json({ error: 'Failed to create CRM customer from conversation' });
    }
  });

  router.post('/api/universal-crm/context/drive-folder/ensure', async (req, res) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req, payload);
      const preferredUserId = preferredIdentity.userId;
      const customerId = toNonEmptyString(payload.customerId);
      if (!preferredUserId || !customerId) {
        return res.status(400).json({ error: 'customerId and authenticated user are required' });
      }

      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
      }

      const customerResult = await pool.query<CrmCustomerRow>(
        `SELECT id, name, email, phone, company, profession, project_type, budget, status, tags, notes, source, custom_fields, project_id, created_at, updated_at
           FROM crm_customers
          WHERE id::text = $1
          LIMIT 1`,
        [customerId],
      );
      const customer = customerResult.rows[0];
      if (!customer) {
        return res.status(404).json({ error: 'CRM-kunde ikke funnet' });
      }

      const folderStructure = dedupeStringArray([
        ...toStringArray(payload.customStructure),
        ...toStringArray(payload.folderStructure),
      ]);
      const ensuredFolder = await ensureCustomerDriveFolder({
        driveApi: google.drive({ version: 'v3', auth: workspaceContext.oauthClient }),
        userId: preferredUserId,
        customer,
        customerName: toNonEmptyString(payload.customerName) || customer.name,
        companyName: toNonEmptyString(payload.companyName) || customer.company,
        folderStructure: folderStructure.length > 0
          ? folderStructure
          : getDefaultDriveFolderStructure(toNonEmptyString(payload.profession) || customer.profession),
        quoteFolderName: toNonEmptyString(payload.quoteFolderName),
        contractFolderName: toNonEmptyString(payload.contractFolderName),
        conversationName: toNonEmptyString(payload.conversationName),
      });

      return res.json({
        success: true,
        source: workspaceContext.source,
        connection: workspaceContext.connection,
        drive: ensuredFolder,
      });
    } catch (error) {
      console.error('CRM customer drive folder ensure error:', error);
      return res.status(500).json({ error: formatGoogleDriveError(error) });
    }
  });

  router.post('/api/universal-crm/context/log-activity', async (req, res) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const conversationId = toNonEmptyString(payload.conversationId);
      const provider = normalizeCrmConversationProvider(payload.provider);
      const type = toNonEmptyString(payload.type);
      const subject = toNonEmptyString(payload.subject);
      const description = toNonEmptyString(payload.description);
      const direction = toNonEmptyString(payload.direction);
      const outcome = toNonEmptyString(payload.outcome);
      const scheduledAt = toNonEmptyString(payload.scheduledAt);
      const assignedTo =
        toNonEmptyString(payload.assignedTo) ||
        readOptionalHeaderValue(req, 'x-user-id') ||
        readOptionalHeaderValue(req, 'x-user-email');

      if (!conversationId || !type || !subject) {
        return res.status(400).json({ error: 'conversationId, type and subject are required' });
      }

      const link = await resolveConversationCrmLink(provider, conversationId);
      const customerId = toNonEmptyString(link?.customer_id);
      const dealId = toNonEmptyString(link?.deal_id);

      if (!customerId) {
        return res.status(409).json({ error: 'Conversation is not linked to a CRM customer' });
      }

      const activityResult = await pool.query<CrmActivityRow>(
        `INSERT INTO crm_activities (
           id, customer_id, deal_id, type, subject, description, scheduled_at, direction, outcome, created_at, updated_at
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
         )
         RETURNING id, type, subject, description, scheduled_at, direction, outcome, created_at, updated_at`,
        [
          customerId,
          dealId,
          type,
          subject,
          description,
          scheduledAt,
          direction,
          outcome,
        ],
      );

      let task = null;
      if (payload.task && typeof payload.task === 'object' && payload.task !== null) {
        const taskPayload = payload.task as Record<string, unknown>;
        const taskTitle = toNonEmptyString(taskPayload.title);
        if (taskTitle) {
          const taskDescription = toNonEmptyString(taskPayload.description);
          const taskPriority = toNonEmptyString(taskPayload.priority) || 'medium';
          const taskStatus = toNonEmptyString(taskPayload.status) || 'pending';
          const taskDueDate = toNonEmptyString(taskPayload.dueDate);

          const taskResult = await pool.query<CrmTaskRow>(
            `INSERT INTO crm_tasks (
               id, customer_id, deal_id, title, description, assigned_to, priority, status, due_date, created_at, updated_at
             ) VALUES (
               gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
             )
             RETURNING id, title, description, assigned_to, priority, status, due_date, created_at, updated_at`,
            [
              customerId,
              dealId,
              taskTitle,
              taskDescription,
              assignedTo,
              taskPriority,
              taskStatus,
              taskDueDate,
            ],
          );

          task = mapCrmTask(taskResult.rows[0]);
        }
      }

      return res.status(201).json({
        success: true,
        activity: mapCrmActivity(activityResult.rows[0]),
        task,
      });
    } catch (error) {
      console.error('CRM log activity error:', error);
      return res.status(500).json({ error: 'Failed to log CRM activity for conversation' });
    }
  });

  // ─── GET /api/communication/conversations ─────────────────
  router.get('/api/communication/conversations', async (req, res) => {
    try {
      const userEmail = (req.query.userEmail as string) || req.headers['x-user-email'] as string || '';

      // Get channels where user is a participant
      const channels = await db
        .select({
          id: schema.communicationChannels.id,
          name: schema.communicationChannels.name,
          type: schema.communicationChannels.type,
          description: schema.communicationChannels.description,
          isActive: schema.communicationChannels.isActive,
          settings: schema.communicationChannels.settings,
          createdAt: schema.communicationChannels.createdAt,
        })
        .from(schema.communicationChannels)
        .where(eq(schema.communicationChannels.isActive, true))
        .orderBy(desc(schema.communicationChannels.updatedAt))
        .limit(50);

      // Build conversations with last message info
      const conversations = await Promise.all(
        channels.map(async (channel) => {
          // Get last message in channel
          const lastMessages = await db
            .select({
              content: schema.communicationMessages.content,
              createdAt: schema.communicationMessages.createdAt,
              senderId: schema.communicationMessages.senderId,
            })
            .from(schema.communicationMessages)
            .where(eq(schema.communicationMessages.channelId, channel.id))
            .orderBy(desc(schema.communicationMessages.createdAt))
            .limit(1);

          const lastMsg = lastMessages[0] || null;

          // Count unread
          const unreadResult = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.communicationMessages)
            .where(
              and(
                eq(schema.communicationMessages.channelId, channel.id),
                eq(schema.communicationMessages.isRead, false)
              )
            );

          const settings = (channel.settings || {}) as Record<string, any>;

          return {
            id: channel.id,
            name: channel.name,
            clientName: settings.clientName || channel.name,
            email: settings.email || '',
            avatar: settings.avatar || null,
            isOnline: false,
            type: channel.type,
            createdAt: channel.createdAt,
            lastMessage: lastMsg
              ? { content: lastMsg.content, timestamp: lastMsg.createdAt }
              : null,
            unreadCount: unreadResult[0]?.count || 0,
          };
        })
      );

      res.json({ conversations });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  // ─── GET /api/communication/messages/:channelId ───────────
  router.get('/api/communication/messages/:channelId', async (req, res) => {
    try {
      const { channelId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;

      const messages = await db
        .select({
          id: schema.communicationMessages.id,
          channelId: schema.communicationMessages.channelId,
          senderId: schema.communicationMessages.senderId,
          recipientId: schema.communicationMessages.recipientId,
          messageType: schema.communicationMessages.messageType,
          content: schema.communicationMessages.content,
          metadata: schema.communicationMessages.metadata,
          isRead: schema.communicationMessages.isRead,
          isPriority: schema.communicationMessages.isPriority,
          isSystemGenerated: schema.communicationMessages.isSystemGenerated,
          parentMessageId: schema.communicationMessages.parentMessageId,
          createdAt: schema.communicationMessages.createdAt,
          readAt: schema.communicationMessages.readAt,
          deliveredAt: schema.communicationMessages.deliveredAt,
        })
        .from(schema.communicationMessages)
        .where(eq(schema.communicationMessages.channelId, channelId))
        .orderBy(schema.communicationMessages.createdAt)
        .limit(limit);

      const mappedMessages = messages.map((msg) => {
        const metadata = getMessageMetadataRecord(msg.metadata);
        const attachments = sanitizeChatAttachments(metadata.attachments);

        return {
        id: msg.id,
        senderId: msg.senderId,
        content: msg.content,
        timestamp: msg.createdAt,
        type: msg.messageType,
        status: msg.isRead ? 'read' : msg.deliveredAt ? 'delivered' : 'sent',
        attachments,
        metadata: msg.metadata,
        };
      });

      res.json({ messages: mappedMessages });
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  const handleSendCommunicationMessage = async (req: Request, res: Response) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const content = toNonEmptyString(payload.content) || toNonEmptyString(payload.message);
      const conversationId = normalizeChannelId(payload.conversationId || payload.contactId || payload.channelId);
      const senderId =
        toNonEmptyString(req.headers['x-user-id']) ||
        toNonEmptyString(req.headers['x-user-email']) ||
        'anonymous';
      const attachments = sanitizeChatAttachments(payload.attachments);
      const rawMetadata = getMessageMetadataRecord(payload.metadata);
      const persistedContent = content || (attachments.length > 0
        ? attachments.length === 1
          ? `Delte vedlegg: ${attachments[0]?.filename ?? 'vedlegg'}`
          : `Delte ${attachments.length} vedlegg fra Google Drive`
        : null);

      if (!persistedContent) {
        return res.status(400).json({ error: 'content is required' });
      }

      await ensureChannelExists(conversationId, `Chat ${conversationId}`, 'chat');
      const persisted = await persistMessage({
        id: toNonEmptyString(payload.id) || toNonEmptyString(payload.clientMessageId) || undefined,
        channelId: conversationId,
        senderId,
        content: persistedContent,
        messageType: attachments.length > 0 ? 'file' : 'text',
        metadata: attachments.length > 0
          ? {
              ...rawMetadata,
              attachments,
            }
          : rawMetadata,
      });

      res.json({
        success: true,
        message: {
          id: persisted.id,
          channelId: conversationId,
          senderId,
          content: persistedContent,
          timestamp: persisted.timestamp,
          type: attachments.length > 0 ? 'file' : 'text',
          status: 'sent',
          attachments,
        },
      });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  };

  // ─── POST /api/communication/messages ─────────────────────
  router.post('/api/communication/messages', async (req, res) => {
    await handleSendCommunicationMessage(req, res);
  });

  // Compatibility alias used by older chat widgets
  router.post('/api/communication/send-message', async (req, res) => {
    await handleSendCommunicationMessage(req, res);
  });

  // ─── POST /api/chat/messages ──────────────────────────────
  // Used by UniversalChatWidget (sends full ChatMessage object)
  router.post('/api/chat/messages', async (req, res) => {
    try {
      const msg = (req.body || {}) as Record<string, unknown>;
      const senderId =
        toNonEmptyString(msg.senderId) ||
        toNonEmptyString(req.headers['x-user-email']) ||
        'anonymous';
      const channelId = normalizeChannelId(msg.conversationId || 'general');
      const content = toNonEmptyString(msg.content);
      const attachments = sanitizeChatAttachments(msg.attachments);
      const rawMetadata = getMessageMetadataRecord(msg.metadata);
      const persistedContent = content || (attachments.length > 0
        ? attachments.length === 1
          ? `Delte vedlegg: ${attachments[0]?.filename ?? 'vedlegg'}`
          : `Delte ${attachments.length} vedlegg fra Google Drive`
        : null);

      if (!persistedContent) {
        return res.status(400).json({ error: 'Message content is required' });
      }

      await ensureChannelExists(channelId, `Chat ${channelId}`, 'chat');
      const persisted = await persistMessage({
        id: toNonEmptyString(msg.id) || undefined,
        channelId,
        senderId,
        messageType: attachments.length > 0
          ? 'file'
          : toNonEmptyString(msg.messageType) || 'text',
        content: persistedContent,
        metadata: attachments.length > 0
          ? {
              ...rawMetadata,
              attachments,
            }
          : rawMetadata,
        timestamp: toNonEmptyString(msg.timestamp) || undefined,
      });

      res.json({ success: true, id: persisted.id, attachments });
    } catch (error) {
      console.error('Error saving chat message:', error);
      res.status(500).json({ error: 'Failed to save message' });
    }
  });

  router.get('/api/communication/email/status', async (req, res) => {
    try {
      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.json({
          connected: false,
          status: 'disconnected',
          message: 'Google Workspace er ikke koblet til denne brukeren.',
        });
      }
      if (!roleRoomGoogleConnectionHasScopes({ scopes: workspaceContext.connection.scopes }, GMAIL_READ_SCOPES)) {
        return res.json({
          connected: false,
          status: 'needs_reconnect',
          message: 'Google Workspace er koblet til, men mangler Gmail-tilgang. Koble Gmail på nytt for å gi tilgang til inboxen.',
          connection: workspaceContext.connection,
          source: workspaceContext.source,
        });
      }

      return res.json({
        connected: true,
        status: 'active',
        message: 'Gmail er koblet til CreatorHub.',
        connection: workspaceContext.connection,
        source: workspaceContext.source,
      });
    } catch (error) {
      console.error('Error checking Gmail status:', error);
      const reconnectIssue = deriveGoogleWorkspaceReconnectIssue(error);
      const errorConnection = (error as {
        workspaceConnection?: LiveGoogleWorkspaceContext['connection'];
        workspaceSource?: LiveGoogleWorkspaceContext['source'];
      } | undefined)?.workspaceConnection;
      const errorSource = (error as {
        workspaceConnection?: LiveGoogleWorkspaceContext['connection'];
        workspaceSource?: LiveGoogleWorkspaceContext['source'];
      } | undefined)?.workspaceSource;
      if (reconnectIssue) {
        return res.json({
          connected: false,
          status: reconnectIssue.status,
          message: reconnectIssue.message,
          ...(errorConnection ? { connection: errorConnection } : {}),
          ...(errorSource ? { source: errorSource } : {}),
        });
      }
      return res.json({
        connected: false,
        status: 'error',
        message: formatGoogleWorkspaceApiError('Gmail API', error),
        ...(errorConnection ? { connection: errorConnection } : {}),
        ...(errorSource ? { source: errorSource } : {}),
      });
    }
  });

  router.get('/api/communication/email/threads', async (req, res) => {
    try {
      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren.' });
      }
      if (!roleRoomGoogleConnectionHasScopes({ scopes: workspaceContext.connection.scopes }, GMAIL_READ_SCOPES)) {
        return res.status(409).json({
          error: 'Google Workspace er koblet til, men mangler Gmail-tilgang. Koble Gmail på nytt for å gi tilgang til inboxen.',
        });
      }

      const gmail = google.gmail({ version: 'v1', auth: workspaceContext.oauthClient });
      const limit = Math.min(Math.max(parseFiniteInteger(req.query.limit, 20), 1), 50);
      const search = toNonEmptyString(req.query.search || req.query.q);
      const labelId = toNonEmptyString(req.query.labelId);
      const queryParts = ['in:inbox', '-in:chats'];
      if (search) {
        queryParts.push(search);
      }

      const threadList = await gmail.users.threads.list({
        userId: 'me',
        maxResults: limit,
        q: queryParts.join(' '),
        ...(labelId ? { labelIds: [labelId] } : {}),
      });

      const detailedThreads = await Promise.all(
        (threadList.data.threads ?? [])
          .map((thread) => toNonEmptyString(thread.id))
          .filter((threadId): threadId is string => Boolean(threadId))
          .map((threadId) =>
            gmail.users.threads.get({
              userId: 'me',
              id: threadId,
              format: 'metadata',
              metadataHeaders: ['From', 'To', 'Subject', 'Date', 'Reply-To', 'Message-ID', 'References'],
            })
          ),
      );

      const threads = detailedThreads.map((threadResponse) => {
        const thread = (threadResponse.data ?? {}) as Record<string, unknown>;
        const threadId = toNonEmptyString(thread.id) || crypto.randomUUID();
        const messages = Array.isArray(thread.messages)
          ? thread.messages as Array<Record<string, unknown>>
          : [];
        const lastMessage = messages[messages.length - 1] ?? null;
        const lastPayload = lastMessage?.payload && typeof lastMessage.payload === 'object'
          ? lastMessage.payload as { headers?: Array<{ name?: string | null; value?: string | null }> }
          : undefined;
        const headers = Array.isArray(lastPayload?.headers) ? lastPayload.headers : [];
        const subject = getGmailHeaderValue(headers, 'Subject') || '(uten emne)';
        const counterpart = deriveGmailCounterpart(messages, workspaceContext.connection.googleEmail);
        const unreadCount = messages.filter((message) => {
          const labelIds = Array.isArray(message.labelIds) ? message.labelIds : [];
          return labelIds.includes('UNREAD');
        }).length;

        return {
          id: threadId,
          threadId,
          subject,
          snippet: toNonEmptyString(thread.snippet) || toNonEmptyString(lastMessage?.snippet) || '',
          lastMessage: toNonEmptyString(thread.snippet) || toNonEmptyString(lastMessage?.snippet) || '',
          timestamp: toIsoTimestamp(
            (lastMessage?.internalDate as string | undefined)
            || getGmailHeaderValue(headers, 'Date')
            || Date.now(),
          ),
          unreadCount,
          counterpartName: counterpart.name,
          counterpartEmail: counterpart.email,
          direction: counterpart.direction,
          hasAttachments: messages.some((message) =>
            gmailPayloadHasAttachment(
              message.payload && typeof message.payload === 'object'
                ? message.payload as Record<string, unknown>
                : null,
            )
          ),
          labelIds: Array.from(new Set(messages.flatMap((message) =>
            Array.isArray(message.labelIds)
              ? message.labelIds.filter((entry): entry is string => typeof entry === 'string')
              : []
          ))),
          messageCount: messages.length,
          threadUrl: buildGmailThreadUrl(threadId),
        };
      });

      return res.json({
        threads,
        source: workspaceContext.source,
        connection: workspaceContext.connection,
      });
    } catch (error) {
      console.error('Error fetching Gmail threads:', error);
      const reconnectIssue = deriveGoogleWorkspaceReconnectIssue(error);
      if (reconnectIssue) {
        return res.status(reconnectIssue.statusCode).json({
          error: reconnectIssue.message,
          reconnectRequired: reconnectIssue.status === 'needs_reconnect',
        });
      }
      return res.status(getGoogleWorkspaceApiStatus(error)).json({ error: formatGoogleWorkspaceApiError('Gmail API', error) });
    }
  });

  router.get('/api/communication/email/messages', async (req, res) => {
    try {
      const threadId = toNonEmptyString(req.query.threadId || req.query.conversationId || req.query.channelId);
      if (!threadId) {
        return res.status(400).json({ error: 'threadId is required' });
      }

      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren.' });
      }
      if (!roleRoomGoogleConnectionHasScopes({ scopes: workspaceContext.connection.scopes }, GMAIL_READ_SCOPES)) {
        return res.status(409).json({
          error: 'Google Workspace er koblet til, men mangler Gmail-tilgang. Koble Gmail på nytt for å åpne e-posttrådene.',
        });
      }

      const gmail = google.gmail({ version: 'v1', auth: workspaceContext.oauthClient });
      const threadResponse = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full',
      });

      const thread = (threadResponse.data ?? {}) as Record<string, unknown>;
      const messages = Array.isArray(thread.messages)
        ? thread.messages as Array<Record<string, unknown>>
        : [];
      const counterpart = deriveGmailCounterpart(messages, workspaceContext.connection.googleEmail);

      const mappedMessages = messages.map((message) => {
        const payload = message.payload && typeof message.payload === 'object'
          ? message.payload as Record<string, unknown>
          : null;
        const headers = Array.isArray(payload?.headers)
          ? payload.headers as Array<{ name?: string | null; value?: string | null }>
          : [];
        const from = parseMailboxHeader(getGmailHeaderValue(headers, 'From'));
        const replyTo = parseMailboxHeader(getGmailHeaderValue(headers, 'Reply-To'));
        const sender = replyTo.email ? replyTo : from;
        const senderEmail = sender.email || 'unknown-sender';
        const direction = workspaceContext.connection.googleEmail?.toLowerCase() === senderEmail.toLowerCase()
          ? 'outbound'
          : 'inbound';

        return {
          id: toNonEmptyString(message.id) || crypto.randomUUID(),
          threadId,
          senderId: senderEmail,
          senderName: sender.name || senderEmail,
          senderEmail,
          subject: getGmailHeaderValue(headers, 'Subject') || '(uten emne)',
          content: extractGmailPlainText(payload) || toNonEmptyString(message.snippet) || '',
          snippet: toNonEmptyString(message.snippet) || '',
          timestamp: toIsoTimestamp(
            (message.internalDate as string | undefined)
            || getGmailHeaderValue(headers, 'Date')
            || Date.now(),
          ),
          direction,
          labelIds: Array.isArray(message.labelIds)
            ? message.labelIds.filter((entry): entry is string => typeof entry === 'string')
            : [],
          hasAttachments: gmailPayloadHasAttachment(payload),
        };
      });

      return res.json({
        thread: {
          id: threadId,
          threadId,
          subject:
            mappedMessages[mappedMessages.length - 1]?.subject
            || mappedMessages[0]?.subject
            || '(uten emne)',
          counterpartName: counterpart.name,
          counterpartEmail: counterpart.email,
          snippet: toNonEmptyString(thread.snippet) || mappedMessages[mappedMessages.length - 1]?.snippet || '',
          timestamp: mappedMessages[mappedMessages.length - 1]?.timestamp || new Date().toISOString(),
          threadUrl: buildGmailThreadUrl(threadId),
        },
        messages: mappedMessages,
        source: workspaceContext.source,
        connection: workspaceContext.connection,
      });
    } catch (error) {
      console.error('Error fetching Gmail thread messages:', error);
      const reconnectIssue = deriveGoogleWorkspaceReconnectIssue(error);
      if (reconnectIssue) {
        return res.status(reconnectIssue.statusCode).json({
          error: reconnectIssue.message,
          reconnectRequired: reconnectIssue.status === 'needs_reconnect',
        });
      }
      return res.status(getGoogleWorkspaceApiStatus(error)).json({ error: formatGoogleWorkspaceApiError('Gmail API', error) });
    }
  });

  router.post('/api/communication/email/drafts', async (req, res) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const to = toNonEmptyString(payload.to);
      const subject = toNonEmptyString(payload.subject) || 'Melding fra CreatorHub';
      const content = toNonEmptyString(payload.message) || toNonEmptyString(payload.content);
      const threadId = toNonEmptyString(payload.threadId || payload.conversationId || payload.channelId);

      if (!to) {
        return res.status(400).json({ error: 'to is required' });
      }

      if (!content) {
        return res.status(400).json({ error: 'message is required' });
      }

      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req, payload);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren.' });
      }

      if (!roleRoomGoogleConnectionHasAnyScope({ scopes: workspaceContext.connection.scopes }, GMAIL_DRAFT_SCOPES)) {
        return res.status(409).json({
          error: 'Google Workspace er koblet til, men mangler Gmail draft-tilgang. Koble Gmail på nytt for å opprette kladder fra CreatorHub.',
        });
      }

      const gmail = google.gmail({ version: 'v1', auth: workspaceContext.oauthClient });
      const rawMessage = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'MIME-Version: 1.0',
        '',
        content,
      ].join('\r\n');

      const response = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: Buffer.from(rawMessage, 'utf8').toString('base64url'),
            ...(threadId ? { threadId } : {}),
          },
        },
      });

      return res.status(201).json({
        success: true,
        draftId: toNonEmptyString(response.data.id),
        messageId: toNonEmptyString(response.data.message?.id),
        threadId: toNonEmptyString(response.data.message?.threadId) || threadId,
        source: workspaceContext.source,
        connection: workspaceContext.connection,
      });
    } catch (error) {
      console.error('Error creating Gmail draft:', error);
      const reconnectIssue = deriveGoogleWorkspaceReconnectIssue(error);
      if (reconnectIssue) {
        return res.status(reconnectIssue.statusCode).json({
          error: reconnectIssue.message,
          reconnectRequired: reconnectIssue.status === 'needs_reconnect',
        });
      }
      return res.status(getGoogleWorkspaceApiStatus(error)).json({ error: formatGoogleWorkspaceApiError('Gmail API', error) });
    }
  });

  router.post('/api/communication/email/reply', async (req, res) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const threadId = toNonEmptyString(payload.threadId || payload.conversationId || payload.channelId);
      const content = toNonEmptyString(payload.message) || toNonEmptyString(payload.content);
      const attachments = sanitizeChatAttachments(payload.attachments);
      const attachmentSection = attachments.length > 0
        ? ['Vedlegg fra Google Drive:', ...attachments.map((attachment) => `- ${attachment.filename}: ${attachment.downloadUrl}`)].join('\n')
        : '';
      const finalBody = [content, attachmentSection]
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        .join('\n\n');

      if (!threadId) {
        return res.status(400).json({ error: 'threadId is required' });
      }

      if (!finalBody) {
        return res.status(400).json({ error: 'message is required' });
      }

      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req, payload);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren.' });
      }
      if (
        !roleRoomGoogleConnectionHasScopes({ scopes: workspaceContext.connection.scopes }, GMAIL_READ_SCOPES)
        || !roleRoomGoogleConnectionHasAnyScope({ scopes: workspaceContext.connection.scopes }, GMAIL_WRITE_SCOPES)
      ) {
        return res.status(409).json({
          error: 'Google Workspace er koblet til, men mangler Gmail skrive-/draft-tilgang. Koble Gmail på nytt for å svare fra CreatorHub.',
        });
      }

      const gmail = google.gmail({ version: 'v1', auth: workspaceContext.oauthClient });
      const threadResponse = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Reply-To', 'Message-ID', 'References'],
      });

      const threadMessages = Array.isArray(threadResponse.data.messages)
        ? threadResponse.data.messages as Array<Record<string, unknown>>
        : [];
      const authenticatedEmail = workspaceContext.connection.googleEmail?.toLowerCase() || null;
      const lastInboundMessage = [...threadMessages].reverse().find((message) => {
        const payloadRecord = message.payload && typeof message.payload === 'object'
          ? message.payload as { headers?: Array<{ name?: string | null; value?: string | null }> }
          : undefined;
        const headers = Array.isArray(payloadRecord?.headers) ? payloadRecord.headers : [];
        const sender = parseMailboxHeader(
          getGmailHeaderValue(headers, 'Reply-To') || getGmailHeaderValue(headers, 'From'),
        );
        return sender.email && sender.email !== authenticatedEmail;
      }) || threadMessages[threadMessages.length - 1];

      const lastPayload = lastInboundMessage?.payload && typeof lastInboundMessage.payload === 'object'
        ? lastInboundMessage.payload as { headers?: Array<{ name?: string | null; value?: string | null }> }
        : undefined;
      const lastHeaders = Array.isArray(lastPayload?.headers) ? lastPayload.headers : [];
      const replyTarget = parseMailboxHeader(
        getGmailHeaderValue(lastHeaders, 'Reply-To') || getGmailHeaderValue(lastHeaders, 'From'),
      );
      const subject = buildReplySubject(
        toNonEmptyString(payload.subject) || getGmailHeaderValue(lastHeaders, 'Subject'),
      );
      const to = toNonEmptyString(payload.to) || replyTarget.email;
      const inReplyTo = getGmailHeaderValue(lastHeaders, 'Message-ID');
      const references = getGmailHeaderValue(lastHeaders, 'References') || inReplyTo;

      if (!to) {
        return res.status(400).json({ error: 'Fant ingen mottaker for Gmail-svaret.' });
      }

      const rawMessage = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'MIME-Version: 1.0',
        ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
        ...(references ? [`References: ${references}`] : []),
        '',
        finalBody,
      ].join('\r\n');

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: Buffer.from(rawMessage, 'utf8').toString('base64url'),
          threadId,
        },
      });

      return res.json({
        success: true,
        threadId,
        messageId: toNonEmptyString(response.data.id),
        threadUrl: buildGmailThreadUrl(threadId),
        source: workspaceContext.source,
        connection: workspaceContext.connection,
      });
    } catch (error) {
      console.error('Error replying to Gmail thread:', error);
      const reconnectIssue = deriveGoogleWorkspaceReconnectIssue(error);
      if (reconnectIssue) {
        return res.status(reconnectIssue.statusCode).json({
          error: reconnectIssue.message,
          reconnectRequired: reconnectIssue.status === 'needs_reconnect',
        });
      }
      return res.status(getGoogleWorkspaceApiStatus(error)).json({ error: formatGoogleWorkspaceApiError('Gmail API', error) });
    }
  });

  const handleSendEmail = async (req: Request, res: Response) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const conversationId = normalizeChannelId(payload.conversationId || payload.chatId || payload.threadId);
      const content = toNonEmptyString(payload.message) || toNonEmptyString(payload.content);
      const senderId =
        toNonEmptyString(req.headers['x-user-id']) ||
        toNonEmptyString(req.headers['x-user-email']) ||
        'anonymous';
      const recipient = toNonEmptyString(payload.to);
      const subject = toNonEmptyString(payload.subject) || 'Melding fra CreatorHub';

      if (!content) {
        return res.status(400).json({ error: 'message is required' });
      }
      if (!recipient) {
        return res.status(400).json({ error: 'to is required' });
      }

      // #7 — actually DELIVER via Gmail (this endpoint used to only persist a
      // row with status:'queued' and never send — a silent no-op). A "send"
      // that never sends is worse than an honest error.
      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req, payload);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren. Koble Gmail i Innstillinger for å sende e-post.' });
      }
      if (!roleRoomGoogleConnectionHasAnyScope({ scopes: workspaceContext.connection.scopes }, GMAIL_SEND_SCOPES)) {
        return res.status(409).json({
          error: 'Google Workspace er koblet til, men mangler Gmail send-tilgang. Koble Gmail på nytt for å sende e-post fra CreatorHub.',
        });
      }

      const gmail = google.gmail({ version: 'v1', auth: workspaceContext.oauthClient });
      const rawMessage = [
        `From: ${workspaceContext.connection.googleEmail ? `<${workspaceContext.connection.googleEmail}>` : 'CreatorHub'}`,
        `To: ${recipient}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'MIME-Version: 1.0',
        '',
        content,
      ].join('\r\n');
      const sent = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: Buffer.from(rawMessage, 'utf8').toString('base64url') },
      });
      const threadId = toNonEmptyString(sent.data.threadId);

      // Persist a log row reflecting the REAL delivery (not a fake queue).
      await ensureChannelExists(conversationId, `Email ${conversationId}`, 'email');
      const persisted = await persistMessage({
        channelId: conversationId,
        senderId,
        content,
        messageType: 'email',
        metadata: { to: recipient, subject, deliveryStatus: 'sent', transport: 'gmail', gmailMessageId: toNonEmptyString(sent.data.id), threadId },
      });

      res.json({
        success: true,
        message: {
          id: persisted.id,
          conversationId,
          senderId,
          to: recipient,
          subject,
          content,
          timestamp: persisted.timestamp,
          status: 'sent',
          gmailMessageId: toNonEmptyString(sent.data.id),
          threadId,
        },
      });
    } catch (error) {
      console.error('Error sending email:', error);
      const reconnectIssue = deriveGoogleWorkspaceReconnectIssue(error);
      if (reconnectIssue) {
        return res.status(reconnectIssue.statusCode).json({ error: reconnectIssue.message, reconnectRequired: reconnectIssue.status === 'needs_reconnect' });
      }
      res.status(getGoogleWorkspaceApiStatus(error)).json({ error: formatGoogleWorkspaceApiError('Gmail API', error) });
    }
  };

  // ─── POST /api/communication/email/send ───────────────────
  router.post('/api/communication/email/send', async (req, res) => {
    await handleSendEmail(req, res);
  });

  // Compatibility alias used by UniversalChatWidget
  router.post('/api/emails/send', async (req, res) => {
    await handleSendEmail(req, res);
  });

  router.get('/api/google-tasks/lists', async (req, res) => {
    try {
      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren.' });
      }

      if (!roleRoomGoogleConnectionHasAnyScope({ scopes: workspaceContext.connection.scopes }, TASKS_READ_SCOPES)) {
        return res.status(409).json({
          error: 'Google Workspace er koblet til, men mangler Google Tasks-tilgang. Koble Google Workspace på nytt for å åpne oppgavelistene.',
        });
      }

      const tasksApi = google.tasks({ version: 'v1', auth: workspaceContext.oauthClient });
      const response = await tasksApi.tasklists.list({ maxResults: 100 });
      const taskLists = Array.isArray(response.data.items)
        ? response.data.items.map((taskList) => mapGoogleTaskList(taskList as Record<string, unknown>))
        : [];

      return res.json(taskLists);
    } catch (error) {
      const reconnectIssue = deriveGoogleWorkspaceReconnectIssue(error);
      if (reconnectIssue) {
        return res.status(reconnectIssue.statusCode).json({ error: reconnectIssue.message });
      }
      return res.status(getGoogleWorkspaceApiStatus(error)).json({ error: formatGoogleWorkspaceApiError('Google Tasks API', error) });
    }
  });

  router.get('/api/google-tasks/lists/:listId/tasks', async (req, res) => {
    try {
      const listId = toNonEmptyString(req.params.listId);
      if (!listId) {
        return res.status(400).json({ error: 'listId er påkrevd.' });
      }

      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren.' });
      }

      if (!roleRoomGoogleConnectionHasAnyScope({ scopes: workspaceContext.connection.scopes }, TASKS_READ_SCOPES)) {
        return res.status(409).json({
          error: 'Google Workspace er koblet til, men mangler Google Tasks-tilgang. Koble Google Workspace på nytt for å åpne oppgavene.',
        });
      }

      const tasksApi = google.tasks({ version: 'v1', auth: workspaceContext.oauthClient });
      const response = await tasksApi.tasks.list({
        tasklist: listId,
        maxResults: 100,
        showCompleted: true,
        showHidden: false,
      });
      const tasks = Array.isArray(response.data.items)
        ? response.data.items.map((task) => mapGoogleTask(task as Record<string, unknown>))
        : [];

      return res.json(tasks);
    } catch (error) {
      const reconnectIssue = deriveGoogleWorkspaceReconnectIssue(error);
      if (reconnectIssue) {
        return res.status(reconnectIssue.statusCode).json({ error: reconnectIssue.message });
      }
      return res.status(getGoogleWorkspaceApiStatus(error)).json({ error: formatGoogleWorkspaceApiError('Google Tasks API', error) });
    }
  });

  router.post('/api/google-tasks/lists/:listId/tasks', async (req, res) => {
    try {
      const listId = toNonEmptyString(req.params.listId);
      const payload = (req.body || {}) as Record<string, unknown>;
      if (!listId) {
        return res.status(400).json({ error: 'listId er påkrevd.' });
      }

      const title = toNonEmptyString(payload.title);
      if (!title) {
        return res.status(400).json({ error: 'title er påkrevd.' });
      }

      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req, payload);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren.' });
      }

      if (!roleRoomGoogleConnectionHasAnyScope({ scopes: workspaceContext.connection.scopes }, TASKS_WRITE_SCOPES)) {
        return res.status(409).json({
          error: 'Google Workspace er koblet til, men mangler skrivetilgang til Google Tasks. Koble Google Workspace på nytt for å opprette oppgaver.',
        });
      }

      const tasksApi = google.tasks({ version: 'v1', auth: workspaceContext.oauthClient });
      const response = await tasksApi.tasks.insert({
        tasklist: listId,
        requestBody: {
          title,
          notes: buildGoogleTaskNotes(payload) || undefined,
          due: toNonEmptyString(payload.due) || undefined,
          parent: toNonEmptyString(payload.parent) || undefined,
        },
      });

      return res.status(201).json({
        ...mapGoogleTask(response.data as Record<string, unknown>),
        listId,
      });
    } catch (error) {
      const reconnectIssue = deriveGoogleWorkspaceReconnectIssue(error);
      if (reconnectIssue) {
        return res.status(reconnectIssue.statusCode).json({ error: reconnectIssue.message });
      }
      return res.status(getGoogleWorkspaceApiStatus(error)).json({ error: formatGoogleWorkspaceApiError('Google Tasks API', error) });
    }
  });

  router.post('/api/google-tasks/tasks', async (req, res) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const title = toNonEmptyString(payload.title);
      if (!title) {
        return res.status(400).json({ error: 'title er påkrevd.' });
      }

      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req, payload);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren.' });
      }

      if (!roleRoomGoogleConnectionHasAnyScope({ scopes: workspaceContext.connection.scopes }, TASKS_WRITE_SCOPES)) {
        return res.status(409).json({
          error: 'Google Workspace er koblet til, men mangler skrivetilgang til Google Tasks. Koble Google Workspace på nytt for å opprette oppgaver.',
        });
      }

      const listId = await resolveGoogleTaskListId(workspaceContext, payload);
      if (!listId) {
        return res.status(500).json({ error: 'Kunne ikke finne eller opprette en Google Tasks-liste.' });
      }

      const tasksApi = google.tasks({ version: 'v1', auth: workspaceContext.oauthClient });
      const response = await tasksApi.tasks.insert({
        tasklist: listId,
        requestBody: {
          title,
          notes: buildGoogleTaskNotes(payload) || undefined,
          due: toNonEmptyString(payload.due) || undefined,
          parent: toNonEmptyString(payload.parent) || undefined,
        },
      });

      return res.status(201).json({
        ...mapGoogleTask(response.data as Record<string, unknown>),
        listId,
      });
    } catch (error) {
      const reconnectIssue = deriveGoogleWorkspaceReconnectIssue(error);
      if (reconnectIssue) {
        return res.status(reconnectIssue.statusCode).json({ error: reconnectIssue.message });
      }
      return res.status(getGoogleWorkspaceApiStatus(error)).json({ error: formatGoogleWorkspaceApiError('Google Tasks API', error) });
    }
  });

  router.patch('/api/google-tasks/tasks/:taskId', async (req, res) => {
    try {
      const taskId = toNonEmptyString(req.params.taskId);
      const payload = (req.body || {}) as Record<string, unknown>;
      const listId = toNonEmptyString(payload.listId ?? req.query.listId);
      if (!taskId || !listId) {
        return res.status(400).json({ error: 'taskId og listId er påkrevd.' });
      }

      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req, payload);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren.' });
      }

      if (!roleRoomGoogleConnectionHasAnyScope({ scopes: workspaceContext.connection.scopes }, TASKS_WRITE_SCOPES)) {
        return res.status(409).json({
          error: 'Google Workspace er koblet til, men mangler skrivetilgang til Google Tasks. Koble Google Workspace på nytt for å oppdatere oppgaver.',
        });
      }

      const tasksApi = google.tasks({ version: 'v1', auth: workspaceContext.oauthClient });
      const current = await tasksApi.tasks.get({ tasklist: listId, task: taskId });
      const currentTask = (current.data || {}) as Record<string, unknown>;
      const response = await tasksApi.tasks.patch({
        tasklist: listId,
        task: taskId,
        requestBody: {
          title: toNonEmptyString(payload.title) || toNonEmptyString(currentTask.title) || undefined,
          notes: toNonEmptyString(payload.notes) ?? toNonEmptyString(currentTask.notes) ?? undefined,
          due: toNonEmptyString(payload.due) ?? toNonEmptyString(currentTask.due) ?? undefined,
          status: toNonEmptyString(payload.status) === 'completed' ? 'completed' : (toNonEmptyString(payload.status) ?? toNonEmptyString(currentTask.status) ?? undefined),
          parent: toNonEmptyString(payload.parent) ?? toNonEmptyString(currentTask.parent) ?? undefined,
        },
      });

      return res.json(mapGoogleTask(response.data as Record<string, unknown>));
    } catch (error) {
      const reconnectIssue = deriveGoogleWorkspaceReconnectIssue(error);
      if (reconnectIssue) {
        return res.status(reconnectIssue.statusCode).json({ error: reconnectIssue.message });
      }
      return res.status(getGoogleWorkspaceApiStatus(error)).json({ error: formatGoogleWorkspaceApiError('Google Tasks API', error) });
    }
  });

  router.delete('/api/google-tasks/tasks/:taskId', async (req, res) => {
    try {
      const taskId = toNonEmptyString(req.params.taskId);
      const listId = toNonEmptyString(req.query.listId);
      if (!taskId || !listId) {
        return res.status(400).json({ error: 'taskId og listId er påkrevd.' });
      }

      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren.' });
      }

      if (!roleRoomGoogleConnectionHasAnyScope({ scopes: workspaceContext.connection.scopes }, TASKS_WRITE_SCOPES)) {
        return res.status(409).json({
          error: 'Google Workspace er koblet til, men mangler skrivetilgang til Google Tasks. Koble Google Workspace på nytt for å slette oppgaver.',
        });
      }

      const tasksApi = google.tasks({ version: 'v1', auth: workspaceContext.oauthClient });
      await tasksApi.tasks.delete({ tasklist: listId, task: taskId });
      return res.json({ success: true, taskId, listId });
    } catch (error) {
      const reconnectIssue = deriveGoogleWorkspaceReconnectIssue(error);
      if (reconnectIssue) {
        return res.status(reconnectIssue.statusCode).json({ error: reconnectIssue.message });
      }
      return res.status(getGoogleWorkspaceApiStatus(error)).json({ error: formatGoogleWorkspaceApiError('Google Tasks API', error) });
    }
  });

  const escapeGoogleDriveQuery = (value: string) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';

  const toStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => toNonEmptyString(entry))
      .filter((entry): entry is string => Boolean(entry));
  };

  const parseFlexibleStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return toStringArray(value);
    }

    const parsed = toNonEmptyString(value);
    if (!parsed) {
      return [];
    }

    try {
      const maybeArray = JSON.parse(parsed) as unknown;
      if (Array.isArray(maybeArray)) {
        return toStringArray(maybeArray);
      }
    } catch {
      // Ignore parse errors and fall back to separator parsing.
    }

    return parsed
      .split(/[\n,]/)
      .map((entry) => toNonEmptyString(entry))
      .filter((entry): entry is string => Boolean(entry));
  };

  const normalizeDriveFolderName = (value: unknown): string | null => {
    const parsed = toNonEmptyString(value);
    if (!parsed) {
      return null;
    }

    return parsed
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  const dedupeStringArray = (values: Array<string | null | undefined>): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];

    values.forEach((value) => {
      const parsed = toNonEmptyString(value);
      if (!parsed) {
        return;
      }

      const normalized = normalizeDriveFolderName(parsed);
      if (!normalized || seen.has(normalized)) {
        return;
      }

      seen.add(normalized);
      result.push(parsed);
    });

    return result;
  };

  const getDefaultDriveFolderStructure = (profession: string | null): string[] => {
    const normalizedProfession = toNonEmptyString(profession)?.toLowerCase();
    if (normalizedProfession === 'videographer') {
      return [
        'Brief og pre-pro',
        'Produksjon',
        'Redigering',
        'Review',
        'Leveranser',
        'Kontrakter og dokumenter',
        'Kommunikasjon',
        'Arkiv',
      ];
    }

    if (normalizedProfession === 'music_producer') {
      return [
        'Brief og ideer',
        'Innspillinger',
        'Miks og mastering',
        'Leveranser',
        'Kontrakter og dokumenter',
        'Kommunikasjon',
        'Notater',
        'Arkiv',
      ];
    }

    return [
      'RAW - Originale bilder',
      'Bearbeidede bilder',
      'Leveranse til klient',
      'Kontrakter og dokumenter',
      'Kommunikasjon',
      'Timeline og notater',
      'Backup og sikkerhetskopier',
      'Referansebilder og inspirasjon',
    ];
  };

  const sanitizeGoogleDriveFolderName = (value: string): string => {
    return value
      .replace(/[\\/:*?"<>|#]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
  };

  const buildCustomerDriveFolderName = (params: {
    customerName?: string | null;
    companyName?: string | null;
  }) => {
    const customerName = toNonEmptyString(params.customerName);
    const companyName = toNonEmptyString(params.companyName);
    if (customerName && companyName && customerName.toLowerCase() !== companyName.toLowerCase()) {
      return sanitizeGoogleDriveFolderName(`${companyName} · ${customerName}`);
    }
    return sanitizeGoogleDriveFolderName(companyName || customerName || 'Kunde');
  };

  const getDriveFolderMetadataFromCustomFields = (customFields: Record<string, unknown> | null | undefined) => {
    if (!customFields || typeof customFields !== 'object') {
      return null;
    }

    const googleDriveRecord =
      customFields.googleDrive && typeof customFields.googleDrive === 'object'
        ? customFields.googleDrive as Record<string, unknown>
        : null;

    const folderId =
      toNonEmptyString(googleDriveRecord?.folderId)
      || toNonEmptyString(googleDriveRecord?.driveFolderId)
      || toNonEmptyString(customFields.googleDriveFolderId)
      || toNonEmptyString(customFields.driveFolderId);

    if (!folderId) {
      return null;
    }

    return {
      folderId,
      folderName:
        toNonEmptyString(googleDriveRecord?.folderName)
        || toNonEmptyString(customFields.googleDriveFolderName)
        || toNonEmptyString(customFields.driveFolderName),
      folderUrl:
        toNonEmptyString(googleDriveRecord?.folderUrl)
        || toNonEmptyString(customFields.googleDriveFolderUrl)
        || toNonEmptyString(customFields.driveFolderUrl),
      folderStructure: dedupeStringArray([
        ...toStringArray(googleDriveRecord?.folderStructure),
        ...toStringArray(customFields.googleDriveFolderStructure),
      ]),
    };
  };

  const getPersistedCustomerDriveFolder = async (
    userId: string,
    customerId: string,
  ) => {
    await ensureCrmCustomerDriveFoldersTable();

    const result = await pool.query<CrmCustomerDriveFolderRow>(
      `SELECT id, user_id, customer_id, drive_folder_id, folder_name, folder_url, folder_structure, metadata, source, created_at, updated_at
         FROM crm_customer_drive_folders
        WHERE user_id = $1 AND customer_id = $2
        LIMIT 1`,
      [userId, customerId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const folderId = toNonEmptyString(row.drive_folder_id);
    if (!folderId) {
      return null;
    }

    return {
      id: folderId,
      name: toNonEmptyString(row.folder_name) || 'Kundemappe',
      webViewLink: toNonEmptyString(row.folder_url),
      folderStructure: dedupeStringArray(toStringArray(row.folder_structure)),
      metadata: row.metadata || {},
      source: toNonEmptyString(row.source) || 'mapping',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  };

  const upsertCustomerDriveFolder = async (params: {
    userId: string;
    customerId: string;
    folderId: string;
    folderName: string;
    folderUrl?: string | null;
    folderStructure: string[];
    metadata?: Record<string, unknown>;
    source?: string | null;
  }) => {
    await ensureCrmCustomerDriveFoldersTable();

    await pool.query(
      `INSERT INTO crm_customer_drive_folders (
         user_id, customer_id, drive_folder_id, folder_name, folder_url, folder_structure, metadata, source, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, NOW(), NOW())
       ON CONFLICT (user_id, customer_id)
       DO UPDATE SET
         drive_folder_id = EXCLUDED.drive_folder_id,
         folder_name = EXCLUDED.folder_name,
         folder_url = EXCLUDED.folder_url,
         folder_structure = EXCLUDED.folder_structure,
         metadata = EXCLUDED.metadata,
         source = EXCLUDED.source,
         updated_at = NOW()`,
      [
        params.userId,
        params.customerId,
        params.folderId,
        params.folderName,
        params.folderUrl || null,
        JSON.stringify(params.folderStructure),
        JSON.stringify(params.metadata || {}),
        params.source || 'auto',
      ],
    );
  };

  const upsertProjectDriveFolder = async (params: {
    userId: string;
    projectId: string;
    folderId: string;
    folderName: string;
    folderUrl?: string | null;
    metadata?: Record<string, unknown>;
  }) => {
    await ensureGoogleDriveProjectsTable();

    await pool.query(
      `INSERT INTO google_drive_projects (
         user_id, project_id, drive_folder_id, folder_name, folder_url, metadata, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())
       ON CONFLICT (user_id, project_id)
       DO UPDATE SET
         drive_folder_id = EXCLUDED.drive_folder_id,
         folder_name = EXCLUDED.folder_name,
         folder_url = EXCLUDED.folder_url,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()`,
      [
        params.userId,
        params.projectId,
        params.folderId,
        params.folderName,
        params.folderUrl || null,
        JSON.stringify(params.metadata || {}),
      ],
    );
  };

  const syncCustomerDriveFolderToCrm = async (params: {
    customerId: string;
    folderId: string;
    folderName: string;
    folderUrl?: string | null;
    folderStructure: string[];
    source?: string | null;
  }) => {
    const currentResult = await pool.query<Pick<CrmCustomerRow, 'custom_fields'>>(
      `SELECT custom_fields
         FROM crm_customers
        WHERE id::text = $1
        LIMIT 1`,
      [params.customerId],
    );

    const currentCustomFields =
      currentResult.rows[0]?.custom_fields && typeof currentResult.rows[0].custom_fields === 'object'
        ? currentResult.rows[0].custom_fields as Record<string, unknown>
        : {};

    const nextCustomFields = {
      ...currentCustomFields,
      googleDriveFolderId: params.folderId,
      googleDriveFolderName: params.folderName,
      googleDriveFolderUrl: params.folderUrl || null,
      googleDriveFolderStructure: params.folderStructure,
      googleDrive: {
        ...(currentCustomFields.googleDrive && typeof currentCustomFields.googleDrive === 'object'
          ? currentCustomFields.googleDrive as Record<string, unknown>
          : {}),
        folderId: params.folderId,
        folderName: params.folderName,
        folderUrl: params.folderUrl || null,
        folderStructure: params.folderStructure,
        source: params.source || 'auto',
        updatedAt: new Date().toISOString(),
      },
    };

    await pool.query(
      `UPDATE crm_customers
          SET custom_fields = $2::jsonb,
              updated_at = NOW()
        WHERE id::text = $1`,
      [params.customerId, JSON.stringify(nextCustomFields)],
    );
  };

  const ensureDriveFolder = async (
    driveApi: ReturnType<typeof google.drive>,
    folderName: string,
    parentId?: string | null,
  ): Promise<DriveFolderReference> => {
    const safeFolderName = sanitizeGoogleDriveFolderName(folderName);
    if (!safeFolderName) {
      throw new Error('Drive-mappen mangler et gyldig navn.');
    }

    const existing = await findDriveFoldersByName(driveApi, safeFolderName, {
      exact: true,
      pageSize: 1,
      parentId,
    });
    const existingFolder = existing[0];
    if (existingFolder?.id) {
      return {
        id: String(existingFolder.id),
        name: toNonEmptyString(existingFolder.name) || safeFolderName,
        webViewLink: toNonEmptyString(existingFolder.webViewLink),
        parents: Array.isArray(existingFolder.parents)
          ? existingFolder.parents.filter((entry): entry is string => typeof entry === 'string')
          : (parentId ? [parentId] : []),
      };
    }

    const created = await driveApi.files.create({
      requestBody: {
        name: safeFolderName,
        mimeType: DRIVE_FOLDER_MIME,
        parents: parentId ? [parentId] : undefined,
      },
      fields: 'id,name,webViewLink',
      supportsAllDrives: true,
    });

    const createdId = toNonEmptyString(created.data.id);
    if (!createdId) {
      throw new Error(`Kunne ikke opprette Drive-mappen ${safeFolderName}`);
    }

    return {
      id: createdId,
      name: toNonEmptyString(created.data.name) || safeFolderName,
      webViewLink: toNonEmptyString(created.data.webViewLink),
      parents: parentId ? [parentId] : [],
    };
  };

  const ensureCustomerDriveFolder = async (params: {
    driveApi: ReturnType<typeof google.drive>;
    userId: string;
    customer: CrmCustomerRow;
    customerName?: string | null;
    companyName?: string | null;
    folderStructure: string[];
    quoteFolderName?: string | null;
    contractFolderName?: string | null;
    conversationName?: string | null;
  }) => {
    const { driveApi, userId, customer } = params;
    const customerId = toNonEmptyString(customer.id);
    if (!customerId) {
      return null;
    }
    const folderName = buildCustomerDriveFolderName({
      customerName: params.customerName || customer.name,
      companyName: params.companyName || customer.company,
    });

    const findAccessibleFolderById = async (folderId: string) => {
      try {
        const response = await driveApi.files.get({
          fileId: folderId,
          supportsAllDrives: true,
          fields: 'id,name,webViewLink',
        });
        const resolvedId = toNonEmptyString(response.data.id);
        if (!resolvedId) {
          return null;
        }
        return {
          id: resolvedId,
          name: toNonEmptyString(response.data.name) || folderName,
          webViewLink: toNonEmptyString(response.data.webViewLink),
        };
      } catch {
        return null;
      }
    };

    const existingMapping = await getPersistedCustomerDriveFolder(userId, customerId);
    const legacyFolder = getDriveFolderMetadataFromCustomFields(customer.custom_fields);
    const desiredStructure = dedupeStringArray([
      ...params.folderStructure,
      ...(existingMapping?.folderStructure || []),
      ...(legacyFolder?.folderStructure || []),
      params.quoteFolderName,
      params.contractFolderName,
      'Kommunikasjon',
    ]);
    let resolvedFolder = existingMapping
      ? await findAccessibleFolderById(existingMapping.id)
      : null;
    let mappingSource = existingMapping?.source || 'mapping';

    if (!resolvedFolder) {
      if (legacyFolder?.folderId) {
        resolvedFolder = await findAccessibleFolderById(legacyFolder.folderId);
        mappingSource = 'crm-custom-fields';
      }
    }

    if (!resolvedFolder) {
      const searchCandidates = dedupeStringArray([
        folderName,
        params.companyName,
        params.customerName,
        params.conversationName,
      ]);

      for (const candidate of searchCandidates) {
        const match = (await findDriveFoldersByName(driveApi, candidate, { exact: true, pageSize: 1 }))[0];
        if (match?.id) {
          resolvedFolder = {
            id: String(match.id),
            name: toNonEmptyString(match.name) || candidate,
            webViewLink: toNonEmptyString(match.webViewLink),
          };
          mappingSource = 'drive-search';
          break;
        }
      }
    }

    if (!resolvedFolder) {
      resolvedFolder = await ensureDriveFolder(driveApi, folderName);
      mappingSource = 'auto-create';
    }

    const ensuredSubfolders = await Promise.all(
      desiredStructure.map(async (subfolderName) => ensureDriveFolder(driveApi, subfolderName, resolvedFolder!.id)),
    );

    await upsertCustomerDriveFolder({
      userId,
      customerId,
      folderId: resolvedFolder.id,
      folderName: resolvedFolder.name,
      folderUrl: resolvedFolder.webViewLink,
      folderStructure: desiredStructure,
      metadata: {
        ensuredSubfolders: ensuredSubfolders.map((folder) => ({
          id: folder.id,
          name: folder.name,
        })),
      },
      source: mappingSource,
    });

    await syncCustomerDriveFolderToCrm({
      customerId,
      folderId: resolvedFolder.id,
      folderName: resolvedFolder.name,
      folderUrl: resolvedFolder.webViewLink,
      folderStructure: desiredStructure,
      source: mappingSource,
    });

    return {
      ...resolvedFolder,
      folderStructure: desiredStructure,
      subfolders: ensuredSubfolders,
      source: mappingSource,
      status: 'ready' as const,
    };
  };

  const findDriveFoldersByName = async (
    driveApi: ReturnType<typeof google.drive>,
    folderName: string,
    options?: {
      parentId?: string | null;
      exact?: boolean;
      pageSize?: number;
    },
  ) => {
    const normalizedFolderName = toNonEmptyString(folderName);
    if (!normalizedFolderName) {
      return [];
    }

    const filters = [
      `mimeType = '${DRIVE_FOLDER_MIME}'`,
      options?.parentId ? `'${escapeGoogleDriveQuery(options.parentId)}' in parents` : null,
      options?.exact === false
        ? `name contains '${escapeGoogleDriveQuery(normalizedFolderName)}'`
        : `name = '${escapeGoogleDriveQuery(normalizedFolderName)}'`,
      'trashed = false',
    ].filter((value): value is string => Boolean(value));

    const response = await driveApi.files.list({
      q: filters.join(' and '),
      pageSize: options?.pageSize ?? 10,
      orderBy: 'modifiedTime desc,name_natural',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink,parents)',
    });

    return Array.isArray(response.data.files) ? response.data.files : [];
  };

  const listDriveSubfolders = async (
    driveApi: ReturnType<typeof google.drive>,
    folderId: string,
  ) => {
    const response = await driveApi.files.list({
      q: [
        `'${escapeGoogleDriveQuery(folderId)}' in parents`,
        `mimeType = '${DRIVE_FOLDER_MIME}'`,
        'trashed = false',
      ].join(' and '),
      pageSize: 100,
      orderBy: 'name_natural,modifiedTime desc',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink,parents)',
    });

    return Array.isArray(response.data.files) ? response.data.files : [];
  };

  const listRecentDriveFolders = async (
    driveApi: ReturnType<typeof google.drive>,
    pageSize = 6,
  ) => {
    const response = await driveApi.files.list({
      q: `mimeType = '${DRIVE_FOLDER_MIME}' and trashed = false`,
      pageSize,
      orderBy: 'modifiedTime desc,name_natural',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink,parents)',
    });

    return Array.isArray(response.data.files) ? response.data.files : [];
  };

  const buildGoogleDriveContext = async (req: Request, res: Response) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req, payload);
      // Triage-fix: resolveLiveGoogleWorkspaceContext kunne throw når
      // OAuth-tokens var utløpt eller bruker mangler workspace-kobling
      // — outer try/catch konverterte det til 500. Wrap separat og
      // returner 400 (samme som "ikke koblet til") slik at frontend
      // ikke får falskt server-error.
      let workspaceContext: Awaited<ReturnType<typeof resolveLiveGoogleWorkspaceContext>> = null;
      try {
        workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      } catch (workspaceErr) {
        console.warn('[google-drive-context] workspace resolve failed (treating as not-connected):', workspaceErr);
      }
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
      }

      const driveApi = google.drive({ version: 'v3', auth: workspaceContext.oauthClient });
      const customerId = toNonEmptyString(req.query.customerId) || toNonEmptyString(payload.customerId);
      const projectId = toNonEmptyString(req.query.projectId) || toNonEmptyString(payload.projectId);
      let projectName = toNonEmptyString(req.query.projectName) || toNonEmptyString(payload.projectName);
      const profession = toNonEmptyString(req.query.profession) || toNonEmptyString(payload.profession);
      const conversationName = toNonEmptyString(req.query.conversationName) || toNonEmptyString(payload.conversationName);
      const customerNameHint = toNonEmptyString(req.query.customerName) || toNonEmptyString(payload.customerName);
      const companyNameHint = toNonEmptyString(req.query.companyName) || toNonEmptyString(payload.companyName);
      const quoteFolderName = toNonEmptyString(req.query.quoteFolderName) || toNonEmptyString(payload.quoteFolderName);
      const contractFolderName = toNonEmptyString(req.query.contractFolderName) || toNonEmptyString(payload.contractFolderName);
      const shouldEnsureProjectFolder = req.method.toUpperCase() === 'POST';
      const customStructure = dedupeStringArray([
        ...toStringArray(payload.customStructure),
        ...toStringArray(req.query.customStructure),
      ]);
      const preferredStructure = customStructure.length > 0
        ? customStructure
        : getDefaultDriveFolderStructure(profession);
      let crmCustomer: CrmCustomerRow | null = null;
      let crmCustomerName = customerNameHint;
      let crmCompanyName = companyNameHint;
      let crmCustomerProjectId = projectId;

      if (customerId) {
        const crmCustomerResult = await pool.query<CrmCustomerRow>(
          `SELECT id, name, email, phone, company, profession, project_type, budget, status, tags, notes, source, custom_fields, project_id, created_at, updated_at
           FROM crm_customers
           WHERE id = $1
           LIMIT 1`,
          [customerId],
        );
        crmCustomer = crmCustomerResult.rows[0] || null;
        crmCustomerName = toNonEmptyString(crmCustomer?.name) || crmCustomerName;
        crmCompanyName = toNonEmptyString(crmCustomer?.company) || crmCompanyName;
        crmCustomerProjectId = toNonEmptyString(crmCustomer?.project_id) || crmCustomerProjectId;
        projectName = projectName || crmCompanyName || crmCustomerName;
      }
      const resolvedProjectId = projectId || crmCustomerProjectId;

      const customerFolder = preferredIdentity.userId && crmCustomer
        ? await ensureCustomerDriveFolder({
            driveApi,
            userId: preferredIdentity.userId,
            customer: crmCustomer,
            customerName: crmCustomerName,
            companyName: crmCompanyName,
            folderStructure: preferredStructure,
            quoteFolderName,
            contractFolderName,
            conversationName,
          })
        : null;

      let projectFolder:
        | {
            id: string;
            name: string;
            webViewLink: string | null;
          }
        | null = null;

      if (preferredIdentity.userId && resolvedProjectId) {
        await ensureGoogleDriveProjectsTable();
        const projectMapping = await pool.query<{
          drive_folder_id: string | null;
          folder_name: string | null;
          folder_url: string | null;
        }>(
          `SELECT drive_folder_id, folder_name, folder_url
           FROM google_drive_projects
           WHERE user_id = $1 AND project_id = $2
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
           LIMIT 1`,
          [preferredIdentity.userId, resolvedProjectId],
        );

        const row = projectMapping.rows[0];
        const folderId = toNonEmptyString(row?.drive_folder_id);
        if (folderId) {
          projectFolder = {
            id: folderId,
            name: toNonEmptyString(row?.folder_name) || projectName || 'Prosjektmappe',
            webViewLink: toNonEmptyString(row?.folder_url),
          };
        }
      }

      if (!projectFolder && projectName) {
        const projectMatches = await findDriveFoldersByName(driveApi, projectName, { exact: true, pageSize: 3 });
        const fallbackProjectFolder = projectMatches[0];
        if (fallbackProjectFolder?.id) {
          projectFolder = {
            id: String(fallbackProjectFolder.id),
            name: toNonEmptyString(fallbackProjectFolder.name) || projectName,
            webViewLink: toNonEmptyString(fallbackProjectFolder.webViewLink),
          };
        }
      }

      if (!projectFolder && shouldEnsureProjectFolder && projectName) {
        projectFolder = await ensureDriveFolder(
          driveApi,
          projectName,
          customerFolder?.id || null,
        );
      }

      if (projectFolder && preferredIdentity.userId && resolvedProjectId && shouldEnsureProjectFolder) {
        await upsertProjectDriveFolder({
          userId: preferredIdentity.userId,
          projectId: resolvedProjectId,
          folderId: projectFolder.id,
          folderName: projectFolder.name,
          folderUrl: projectFolder.webViewLink,
          metadata: {
            customerFolderId: customerFolder?.id || null,
            customerFolderName: customerFolder?.name || null,
            source: customerFolder ? 'customer-context' : 'project-context',
          },
        });
      }

      if (!projectFolder && !customerFolder) {
        const customerFolderCandidates = dedupeStringArray([
          crmCompanyName,
          crmCustomerName,
          customerNameHint,
          companyNameHint,
          conversationName,
        ]);

        for (const candidate of customerFolderCandidates) {
          const candidateMatches = await findDriveFoldersByName(driveApi, candidate, { exact: true, pageSize: 1 });
          const candidateFolder = candidateMatches[0];
          if (candidateFolder?.id) {
            projectFolder = {
              id: String(candidateFolder.id),
              name: toNonEmptyString(candidateFolder.name) || candidate,
              webViewLink: toNonEmptyString(candidateFolder.webViewLink),
            };
            break;
          }
        }
      }

      const primaryContextFolder = projectFolder || customerFolder;
      const primaryContextScope = projectFolder ? 'project' : customerFolder ? 'customer' : 'project';

      if (projectFolder && shouldEnsureProjectFolder) {
        await Promise.all(
          preferredStructure.map(async (folderName) => ensureDriveFolder(driveApi, folderName, projectFolder!.id)),
        );
      }

      const projectSubfolders = primaryContextFolder
        ? await listDriveSubfolders(driveApi, primaryContextFolder.id)
        : [];
      const subfolderLookup = new Map(
        projectSubfolders
          .map((folder) => {
            const normalizedName = normalizeDriveFolderName(folder.name);
            const folderId = toNonEmptyString(folder.id);
            if (!normalizedName || !folderId) {
              return null;
            }
            return [
              normalizedName,
              {
                id: folderId,
                name: toNonEmptyString(folder.name) || 'Mappe',
                webViewLink: toNonEmptyString(folder.webViewLink),
                modifiedTime: toNonEmptyString(folder.modifiedTime),
              },
            ] as const;
          })
          .filter((entry): entry is readonly [string, {
            id: string;
            name: string;
            webViewLink: string | null;
            modifiedTime: string | null;
          }] => Boolean(entry)),
      );

      const sections: Array<Record<string, unknown>> = [];
      const addedSectionKeys = new Set<string>();

      const addSection = (section: {
        id: string;
        label: string;
        description: string;
        category: string;
        recommended?: boolean;
        folderId?: string | null;
        folderName?: string | null;
        query?: string | null;
        scope?: string | null;
      }) => {
        if (addedSectionKeys.has(section.id)) {
          return;
        }

        addedSectionKeys.add(section.id);
        sections.push({
          id: section.id,
          label: section.label,
          description: section.description,
          category: section.category,
          recommended: Boolean(section.recommended),
          folderId: section.folderId ?? null,
          folderName: section.folderName ?? null,
          query: section.query ?? null,
          scope: section.scope ?? null,
        });
      };

      if (customerFolder) {
        addSection({
          id: 'customer-root',
          label: 'Kundemappe',
          description: customerFolder.name,
          category: 'customer',
          recommended: !projectFolder,
          folderId: customerFolder.id,
          folderName: customerFolder.name,
          scope: 'customer',
        });
      }

      if (projectFolder && (!customerFolder || projectFolder.id !== customerFolder.id)) {
        addSection({
          id: 'project-root',
          label: 'Prosjektmappe',
          description: projectFolder.name,
          category: 'project',
          recommended: true,
          folderId: projectFolder.id,
          folderName: projectFolder.name,
          scope: 'project',
        });
      }

      const resolveSubfolderMatch = (names: string[]) => {
        for (const name of names) {
          const folder = subfolderLookup.get(normalizeDriveFolderName(name) || '');
          if (folder) {
            return folder;
          }
        }
        return null;
      };

      const structuredHints = [
        {
          id: 'communication',
          label: 'Kommunikasjon',
          description: conversationName
            ? `Knyttet til ${conversationName}`
            : 'Mapper for meldinger, brief og oppfølging',
          category: 'communication',
          names: ['Kommunikasjon', 'Communication'],
        },
        {
          id: 'contracts',
          label: 'Kontrakter',
          description: contractFolderName || 'Kontrakter og signering',
          category: 'contract',
          names: dedupeStringArray([
            contractFolderName,
            'Kontrakter og dokumenter',
            'Contracts & Documents',
            'Contracts',
          ]),
        },
        {
          id: 'quotes',
          label: 'Tilbud',
          description: quoteFolderName || 'Tilbud og prisforslag',
          category: 'quote',
          names: dedupeStringArray([
            quoteFolderName,
            'Quotes & Proposals',
            'Tilbud',
            'Proposals',
          ]),
        },
        {
          id: 'timeline',
          label: 'Møtenotater',
          description: 'Notater, timelines og oppsummeringer',
          category: 'timeline',
          names: ['Timeline og notater', 'Notater', 'Meeting Notes', 'Timeline'],
        },
        {
          id: 'references',
          label: 'Referanser',
          description: 'Moodboards, referanser og inspirasjon',
          category: 'reference',
          names: ['Referansebilder og inspirasjon', 'Referanser', 'Inspirasjon', 'References'],
        },
      ];

      for (const hint of structuredHints) {
        const matchedSubfolder = resolveSubfolderMatch(hint.names);
        if (matchedSubfolder) {
          addSection({
            id: hint.id,
            label: hint.label,
            description: hint.description,
            category: hint.category,
            recommended: true,
            folderId: matchedSubfolder.id,
            folderName: matchedSubfolder.name,
            scope: primaryContextScope,
          });
          continue;
        }

        const globalMatch = hint.names[0]
          ? (await findDriveFoldersByName(driveApi, hint.names[0], { exact: true, pageSize: 1 }))[0]
          : null;
        if (globalMatch?.id) {
          addSection({
            id: hint.id,
            label: hint.label,
            description: hint.description,
            category: hint.category,
            recommended: hint.id === 'contracts' || hint.id === 'quotes',
            folderId: String(globalMatch.id),
            folderName: toNonEmptyString(globalMatch.name),
            scope: 'global',
          });
        }
      }

      preferredStructure.slice(0, 10).forEach((folderName, index) => {
        const matchedSubfolder = resolveSubfolderMatch([folderName]);
        if (!matchedSubfolder) {
          return;
        }

        addSection({
          id: `structure-${index}`,
          label: matchedSubfolder.name,
          description: 'Fra din mappestruktur i dashboardet',
          category: 'folder-structure',
          folderId: matchedSubfolder.id,
          folderName: matchedSubfolder.name,
          scope: primaryContextScope,
        });
      });

      addSection({
        id: 'recent',
        label: 'Sist brukt',
        description: 'Nylig oppdaterte filer og mapper',
        category: 'recent',
        recommended: true,
      });

      addSection({
        id: 'all-drive',
        label: 'Hele Drive',
        description: 'Søk i hele Google Drive',
        category: 'root',
      });

      const recentFolders = await listRecentDriveFolders(driveApi, 6);

      return res.json({
        source: workspaceContext.source,
        connection: workspaceContext.connection,
        customerFolder,
        projectFolder,
        sections,
        recentFolders: recentFolders.map((folder) => ({
          id: toNonEmptyString(folder.id) ?? crypto.randomUUID(),
          name: toNonEmptyString(folder.name) ?? 'Mappe',
          webViewLink: toNonEmptyString(folder.webViewLink),
          modifiedTime: toNonEmptyString(folder.modifiedTime),
        })),
        folderStructure: {
          source: projectFolder
            ? 'project-linked'
            : customerFolder
              ? 'customer-linked'
              : customStructure.length > 0
                ? 'user-settings'
                : 'default',
          folders: preferredStructure,
          quoteFolderName: quoteFolderName || 'Quotes & Proposals',
          contractFolderName: contractFolderName || 'Contracts & Documents',
          primaryFolderId: primaryContextFolder?.id || null,
          primaryFolderName: primaryContextFolder?.name || null,
          primaryScope: primaryContextScope,
        },
        customerContext: {
          customerId: customerId || null,
          customerName: crmCustomerName || null,
          companyName: crmCompanyName || null,
          projectId: crmCustomerProjectId || null,
          folderId: customerFolder?.id || null,
          folderName: customerFolder?.name || null,
          folderReady: Boolean(customerFolder),
        },
      });
    } catch (error) {
      console.error('Error resolving google drive context:', error);
      return res.status(500).json({ error: formatGoogleDriveError(error) });
    }
  };

  const listGoogleDriveFiles = async (req: Request, res: Response) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req, payload);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
      }

      const driveApi = google.drive({ version: 'v3', auth: workspaceContext.oauthClient });
      const folderId = toNonEmptyString(req.query.folderId) || toNonEmptyString(payload.folderId);
      const search = toNonEmptyString(req.query.search) || toNonEmptyString(payload.search);
      const onlyImagesValue = req.query.onlyImages ?? payload.onlyImages;
      const onlyImages = onlyImagesValue === true || onlyImagesValue === 'true';
      const pageSize = Math.min(Math.max(parseFiniteInteger(req.query.pageSize ?? payload.pageSize, 40), 1), 100);
      const rawDriveQuery = toNonEmptyString(payload.query);

      const filters = [
        folderId ? `'${escapeGoogleDriveQuery(folderId)}' in parents` : null,
        onlyImages ? "(mimeType contains 'image/' or mimeType = 'application/vnd.google-apps.folder')" : null,
        search ? `name contains '${escapeGoogleDriveQuery(search)}'` : null,
        'trashed = false',
      ].filter((value): value is string => Boolean(value));

      const driveQuery = rawDriveQuery || filters.join(' and ');
      const response = await driveApi.files.list({
        q: driveQuery,
        pageSize,
        orderBy: folderId ? 'folder,name_natural,modifiedTime desc' : 'modifiedTime desc,name_natural',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        fields: GOOGLE_DRIVE_LIST_FIELDS,
      });

      const files = Array.isArray(response.data.files) ? response.data.files : [];

      return res.json({
        source: workspaceContext.source,
        connection: workspaceContext.connection,
        nextPageToken: response.data.nextPageToken ?? null,
        files: files.map((file) => buildGoogleDriveFileRecord(file as unknown as Record<string, unknown>)),
      });
    } catch (error) {
      console.error('Error listing google drive files:', error);
      return res.status(500).json({ error: formatGoogleDriveError(error) });
    }
  };

  const shareGoogleDriveFile = async (req: Request, res: Response) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const fileId = toNonEmptyString(req.params.fileId);
      if (!fileId) {
        return res.status(400).json({ error: 'fileId is required' });
      }

      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req, payload);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
      }

      const driveApi = google.drive({ version: 'v3', auth: workspaceContext.oauthClient });
      const recipientEmail = toNonEmptyString(payload.recipientEmail);
      const requestedShareMode = toNonEmptyString(payload.shareMode)?.toLowerCase();
      const ensureAccessible = payload.ensureAccessible === true || payload.ensureAccessible === 'true';
      const allowComment = payload.allowComment === true || payload.allowComment === 'true';
      const requestedRole = toNonEmptyString(payload.role)?.toLowerCase();
      const workspaceDomain = workspaceContext.connection.googleEmail?.split('@')[1] || null;
      const preferredRole = requestedRole && ['reader', 'commenter', 'writer'].includes(requestedRole)
        ? requestedRole
        : allowComment
          ? 'commenter'
          : 'reader';
      const listPermissions = async () => {
        const response = await driveApi.permissions.list({
          fileId,
          supportsAllDrives: true,
          fields: 'permissions(id,type,emailAddress,domain,role,allowFileDiscovery)',
        });
        return Array.isArray(response.data.permissions) ? response.data.permissions : [];
      };
      const fileResponse = await driveApi.files.get({
        fileId,
        supportsAllDrives: true,
        fields: GOOGLE_DRIVE_FILE_FIELDS,
      });

      const permissions = await listPermissions();
      const hasRecipientAccess = recipientEmail
        ? permissions.some((permission) =>
            toNonEmptyString(permission.emailAddress)?.toLowerCase() === recipientEmail.toLowerCase(),
          )
        : false;
      const hasDomainAccess = workspaceDomain
        ? permissions.some((permission) =>
            toNonEmptyString(permission.type) === 'domain'
            && toNonEmptyString(permission.domain)?.toLowerCase() === workspaceDomain.toLowerCase(),
          )
        : false;
      const hasLinkAccess = permissions.some((permission) => toNonEmptyString(permission.type) === 'anyone');

      let shareMode: 'private' | 'recipient' | 'domain' | 'link' =
        recipientEmail ? 'recipient' : 'private';
      if (requestedShareMode === 'domain') {
        shareMode = 'domain';
      } else if (requestedShareMode === 'link' || requestedShareMode === 'public') {
        shareMode = 'link';
      } else if (requestedShareMode === 'recipient') {
        shareMode = 'recipient';
      }

      let sharingUpdated = false;
      if (ensureAccessible) {
        if (shareMode === 'recipient' && recipientEmail && !hasRecipientAccess) {
          await driveApi.permissions.create({
            fileId,
            supportsAllDrives: true,
            sendNotificationEmail: false,
            requestBody: {
              type: 'user',
              role: preferredRole,
              emailAddress: recipientEmail,
            },
          });
          sharingUpdated = true;
        } else if (shareMode === 'domain' && workspaceDomain && !hasDomainAccess) {
          await driveApi.permissions.create({
            fileId,
            supportsAllDrives: true,
            requestBody: {
              type: 'domain',
              role: preferredRole,
              domain: workspaceDomain,
              allowFileDiscovery: false,
            },
          });
          sharingUpdated = true;
        } else if (shareMode === 'link' && !hasLinkAccess) {
          await driveApi.permissions.create({
            fileId,
            supportsAllDrives: true,
            requestBody: {
              type: 'anyone',
              role: preferredRole,
              allowFileDiscovery: false,
            },
          });
          sharingUpdated = true;
        }
      }

      const refreshedFileResponse = sharingUpdated
        ? await driveApi.files.get({
            fileId,
            supportsAllDrives: true,
            fields: GOOGLE_DRIVE_FILE_FIELDS,
          })
        : fileResponse;
      const refreshedPermissions = sharingUpdated ? await listPermissions() : permissions;
      const accessState = refreshedPermissions.some((permission) => toNonEmptyString(permission.type) === 'anyone')
        ? 'link'
        : refreshedPermissions.some((permission) => toNonEmptyString(permission.type) === 'domain')
          ? 'domain'
          : refreshedPermissions.some((permission) => toNonEmptyString(permission.emailAddress))
            ? 'recipient'
            : 'private';

      return res.json({
        source: workspaceContext.source,
        connection: workspaceContext.connection,
        ...buildGoogleDriveFileRecord(refreshedFileResponse.data as unknown as Record<string, unknown>),
        shareMode,
        accessState,
        sharingUpdated,
        recipientEmail: recipientEmail || null,
        workspaceDomain,
        permissions: refreshedPermissions.map((permission) => buildGoogleDrivePermissionRecord(permission as unknown)),
      });
    } catch (error) {
      console.error('Error sharing google drive file:', error);
      return res.status(500).json({ error: formatGoogleDriveError(error) });
    }
  };

  const getGoogleDriveFileDetails = async (req: Request, res: Response) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const fileId = toNonEmptyString(req.params.fileId);
      if (!fileId) {
        return res.status(400).json({ error: 'fileId is required' });
      }

      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req, payload);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
      }

      const driveApi = google.drive({ version: 'v3', auth: workspaceContext.oauthClient });
      const [fileResponse, permissionsResponse] = await Promise.all([
        driveApi.files.get({
          fileId,
          supportsAllDrives: true,
          fields: GOOGLE_DRIVE_FILE_FIELDS,
        }),
        driveApi.permissions.list({
          fileId,
          supportsAllDrives: true,
          fields: 'permissions(id,type,emailAddress,domain,role,allowFileDiscovery,deleted,pendingOwner)',
        }),
      ]);

      const fileRecord = buildGoogleDriveFileRecord(fileResponse.data as unknown as Record<string, unknown>);
      const permissions = Array.isArray(permissionsResponse.data.permissions)
        ? permissionsResponse.data.permissions.map((permission) => buildGoogleDrivePermissionRecord(permission as unknown))
        : [];

      return res.json({
        source: workspaceContext.source,
        connection: workspaceContext.connection,
        file: {
          ...fileRecord,
          permissions,
        },
      });
    } catch (error) {
      console.error('Error getting google drive file details:', error);
      return res.status(500).json({ error: formatGoogleDriveError(error) });
    }
  };

  const updateGoogleDriveFile = async (req: Request, res: Response) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const fileId = toNonEmptyString(req.params.fileId);
      if (!fileId) {
        return res.status(400).json({ error: 'fileId is required' });
      }

      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req, payload);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
      }

      const name = toNonEmptyString(payload.name);
      const description = toNonEmptyString(payload.description);
      const parentFolderId = toNonEmptyString(payload.parentFolderId) || toNonEmptyString(payload.targetFolderId);
      if (!name && description == null && !parentFolderId) {
        return res.status(400).json({ error: 'Send med navn, beskrivelse eller målmappe for å oppdatere filen.' });
      }

      const driveApi = google.drive({ version: 'v3', auth: workspaceContext.oauthClient });
      let addParents: string | undefined;
      let removeParents: string | undefined;
      if (parentFolderId) {
        const parentResponse = await driveApi.files.get({
          fileId,
          supportsAllDrives: true,
          fields: 'parents',
        });
        const currentParents = Array.isArray(parentResponse.data.parents)
          ? parentResponse.data.parents.filter((value): value is string => typeof value === 'string')
          : [];
        const normalizedParents = currentParents.filter((parentId) => parentId !== parentFolderId);
        addParents = currentParents.includes(parentFolderId) ? undefined : parentFolderId;
        removeParents = normalizedParents.length > 0 ? normalizedParents.join(',') : undefined;
      }

      const response = await driveApi.files.update({
        fileId,
        supportsAllDrives: true,
        ...(addParents ? { addParents } : {}),
        ...(removeParents ? { removeParents } : {}),
        requestBody: {
          ...(name ? { name } : {}),
          ...(description != null ? { description } : {}),
        },
        fields: GOOGLE_DRIVE_FILE_FIELDS,
      });

      return res.json({
        source: workspaceContext.source,
        connection: workspaceContext.connection,
        file: buildGoogleDriveFileRecord(response.data as unknown as Record<string, unknown>),
      });
    } catch (error) {
      console.error('Error updating google drive file:', error);
      return res.status(500).json({ error: formatGoogleDriveError(error) });
    }
  };

  const deleteGoogleDriveFile = async (req: Request, res: Response) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const fileId = toNonEmptyString(req.params.fileId);
      if (!fileId) {
        return res.status(400).json({ error: 'fileId is required' });
      }

      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req, payload);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
      }

      const driveApi = google.drive({ version: 'v3', auth: workspaceContext.oauthClient });
      const fileResponse = await driveApi.files.update({
        fileId,
        supportsAllDrives: true,
        requestBody: {
          trashed: true,
        },
        fields: GOOGLE_DRIVE_FILE_FIELDS,
      });

      return res.json({
        success: true,
        source: workspaceContext.source,
        connection: workspaceContext.connection,
        file: buildGoogleDriveFileRecord(fileResponse.data as unknown as Record<string, unknown>),
      });
    } catch (error) {
      console.error('Error deleting google drive file:', error);
      return res.status(500).json({ error: formatGoogleDriveError(error) });
    }
  };

  const revokeGoogleDrivePermission = async (req: Request, res: Response) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const fileId = toNonEmptyString(req.params.fileId);
      const permissionId = toNonEmptyString(req.params.permissionId);
      if (!fileId || !permissionId) {
        return res.status(400).json({ error: 'fileId and permissionId are required' });
      }

      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req, payload);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
      }

      const driveApi = google.drive({ version: 'v3', auth: workspaceContext.oauthClient });
      await driveApi.permissions.delete({
        fileId,
        permissionId,
        supportsAllDrives: true,
      });

      const permissionsResponse = await driveApi.permissions.list({
        fileId,
        supportsAllDrives: true,
        fields: 'permissions(id,type,emailAddress,domain,role,allowFileDiscovery,deleted,pendingOwner)',
      });

      return res.json({
        success: true,
        source: workspaceContext.source,
        connection: workspaceContext.connection,
        permissions: Array.isArray(permissionsResponse.data.permissions)
          ? permissionsResponse.data.permissions.map((permission) => buildGoogleDrivePermissionRecord(permission as unknown))
          : [],
      });
    } catch (error) {
      console.error('Error revoking google drive permission:', error);
      return res.status(500).json({ error: formatGoogleDriveError(error) });
    }
  };

  const downloadGoogleDriveFile = async (req: Request, res: Response) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const fileId = toNonEmptyString(req.params.fileId);
      if (!fileId) {
        return res.status(400).json({ error: 'fileId is required' });
      }

      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req, payload);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
      }

      const driveApi = google.drive({ version: 'v3', auth: workspaceContext.oauthClient });
      const metadataResponse = await driveApi.files.get({
        fileId,
        supportsAllDrives: true,
        fields: 'id,name,mimeType,fileExtension',
      });

      const file = metadataResponse.data as unknown as Record<string, unknown>;
      const mimeType = toNonEmptyString(file.mimeType) ?? 'application/octet-stream';
      const baseName = toNonEmptyString(file.name) ?? 'creatorhub-file';
      const exportFormat = GOOGLE_DRIVE_EXPORT_MIME_TYPES[mimeType] ?? null;

      if (exportFormat) {
        const exportResponse = await driveApi.files.export(
          {
            fileId,
            mimeType: exportFormat.mimeType,
          },
          {
            responseType: 'stream',
          },
        );
        res.setHeader('Content-Type', exportFormat.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.${exportFormat.extension}"`);
        (exportResponse.data as unknown as Readable).pipe(res);
        return;
      }

      const fileExtension = toNonEmptyString(file.fileExtension);
      const downloadResponse = await driveApi.files.get(
        {
          fileId,
          alt: 'media',
          supportsAllDrives: true,
        },
        {
          responseType: 'stream',
        },
      );
      res.setHeader('Content-Type', mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileExtension ? `${baseName}.${fileExtension}` : baseName}"`,
      );
      (downloadResponse.data as unknown as Readable).pipe(res);
    } catch (error) {
      console.error('Error downloading google drive file:', error);
      return res.status(500).json({ error: formatGoogleDriveError(error) });
    }
  };

  const listGoogleDriveActivity = async (req: Request, res: Response) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const fileId = toNonEmptyString(req.params.fileId);
      if (!fileId) {
        return res.status(400).json({ error: 'fileId is required' });
      }

      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req, payload);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
      }

      const driveActivityApi = google.driveactivity({ version: 'v2', auth: workspaceContext.oauthClient });
      const pageSize = Math.min(Math.max(parseFiniteInteger(req.query.pageSize ?? payload.pageSize, 20), 1), 50);
      const response = await driveActivityApi.activity.query({
        requestBody: {
          itemName: `items/${fileId}`,
          pageSize,
        },
      });

      const activities = Array.isArray(response.data.activities) ? response.data.activities : [];
      return res.json({
        source: workspaceContext.source,
        connection: workspaceContext.connection,
        activities: activities.map((activity) => {
          const record = activity as unknown as Record<string, unknown>;
          return {
            id: crypto.createHash('sha1').update(JSON.stringify(record)).digest('hex'),
            action: mapDriveActivityAction(record),
            actors: mapDriveActivityActors(record),
            targets: mapDriveActivityTargets(record),
            timestamp: mapDriveActivityTimestamp(record),
            raw: record,
          };
        }),
      });
    } catch (error) {
      console.error('Error listing google drive activity:', error);
      return res.status(500).json({ error: formatGoogleWorkspaceApiError('Google Drive Activity API', error) });
    }
  };

  router.get('/api/google/drive/context', async (req, res) => {
    await buildGoogleDriveContext(req, res);
  });

  router.post('/api/google/drive/context', async (req, res) => {
    await buildGoogleDriveContext(req, res);
  });

  router.get('/api/google/drive/files', async (req, res) => {
    await listGoogleDriveFiles(req, res);
  });

  router.get('/api/google/drive/files/:fileId/details', async (req, res) => {
    await getGoogleDriveFileDetails(req, res);
  });

  router.get('/api/google/drive/files/:fileId/download', async (req, res) => {
    await downloadGoogleDriveFile(req, res);
  });

  router.get('/api/google/drive/files/:fileId/activity', async (req, res) => {
    await listGoogleDriveActivity(req, res);
  });

  router.patch('/api/google/drive/files/:fileId', async (req, res) => {
    await updateGoogleDriveFile(req, res);
  });

  router.delete('/api/google/drive/files/:fileId', async (req, res) => {
    await deleteGoogleDriveFile(req, res);
  });

  router.delete('/api/google/drive/files/:fileId/permissions/:permissionId', async (req, res) => {
    await revokeGoogleDrivePermission(req, res);
  });

  router.post('/api/google/drive/upload-contextual', contextualDriveUpload.array('files', 24), async (req, res) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const files = Array.isArray(req.files)
        ? req.files as Array<{
            originalname: string;
            mimetype: string;
            buffer: Buffer;
            size: number;
          }>
        : [];

      if (files.length === 0) {
        return res.status(400).json({ error: 'Velg minst én fil å laste opp.' });
      }

      const preferredIdentity = getPreferredGoogleWorkspaceIdentity(req, payload);
      const workspaceContext = await resolveLiveGoogleWorkspaceContext(preferredIdentity.userId, preferredIdentity.userEmail);
      if (!workspaceContext) {
        return res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
      }

      const driveApi = google.drive({ version: 'v3', auth: workspaceContext.oauthClient });
      const customerId = toNonEmptyString(payload.customerId);
      const projectId = toNonEmptyString(payload.projectId);
      const projectName =
        toNonEmptyString(payload.projectName)
        || toNonEmptyString(payload.projectTitle)
        || 'Prosjekt';
      const profession = toNonEmptyString(payload.profession);
      const customerName = toNonEmptyString(payload.customerName);
      const companyName = toNonEmptyString(payload.companyName);
      const sectionId = toNonEmptyString(payload.sectionId);
      const sectionLabel = toNonEmptyString(payload.sectionLabel);
      const targetFolderId = toNonEmptyString(payload.targetFolderId) || toNonEmptyString(payload.folderId);
      const targetFolderName = toNonEmptyString(payload.targetFolderName) || toNonEmptyString(payload.folderName);
      const customStructure = dedupeStringArray([
        ...parseFlexibleStringArray(payload.folderStructureJson),
        ...parseFlexibleStringArray(payload.customStructureJson),
        ...parseFlexibleStringArray(payload.folderStructure),
        ...parseFlexibleStringArray(payload.customStructure),
      ]);
      const preferredStructure = customStructure.length > 0
        ? customStructure
        : getDefaultDriveFolderStructure(profession);

      const resolveDriveFolderById = async (folderId: string) => {
        try {
          const response = await driveApi.files.get({
            fileId: folderId,
            supportsAllDrives: true,
            fields: 'id,name,webViewLink,parents',
          });
          const resolvedId = toNonEmptyString(response.data.id);
          if (!resolvedId) {
            return null;
          }
          return {
            id: resolvedId,
            name: toNonEmptyString(response.data.name) || targetFolderName || 'Mappe',
            webViewLink: toNonEmptyString(response.data.webViewLink),
            parents: Array.isArray(response.data.parents)
              ? response.data.parents.filter((value: unknown): value is string => typeof value === 'string')
              : [],
          };
        } catch {
          return null;
        }
      };

      let crmCustomer: CrmCustomerRow | null = null;
      if (customerId) {
        const crmCustomerResult = await pool.query<CrmCustomerRow>(
          `SELECT id, name, email, phone, company, profession, project_type, budget, status, tags, notes, source, custom_fields, project_id, created_at, updated_at
             FROM crm_customers
            WHERE id::text = $1
            LIMIT 1`,
          [customerId],
        );
        crmCustomer = crmCustomerResult.rows[0] || null;
      }

      const customerFolder = preferredIdentity.userId && crmCustomer
        ? await ensureCustomerDriveFolder({
            driveApi,
            userId: preferredIdentity.userId,
            customer: crmCustomer,
            customerName: customerName || crmCustomer.name,
            companyName: companyName || crmCustomer.company,
            folderStructure: preferredStructure,
            quoteFolderName: null,
            contractFolderName: null,
            conversationName: sectionLabel,
          })
        : null;

      let projectFolder: DriveFolderReference | null = null;

      if (preferredIdentity.userId && projectId) {
        await ensureGoogleDriveProjectsTable();
        const projectMapping = await pool.query<{
          drive_folder_id: string | null;
          folder_name: string | null;
          folder_url: string | null;
        }>(
          `SELECT drive_folder_id, folder_name, folder_url
             FROM google_drive_projects
            WHERE user_id = $1 AND project_id = $2
            ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
            LIMIT 1`,
          [preferredIdentity.userId, projectId],
        );

        const mappedFolderId = toNonEmptyString(projectMapping.rows[0]?.drive_folder_id);
        if (mappedFolderId) {
          projectFolder = {
            id: mappedFolderId,
            name: toNonEmptyString(projectMapping.rows[0]?.folder_name) || projectName,
            webViewLink: toNonEmptyString(projectMapping.rows[0]?.folder_url),
            parents: [],
          };
        }
      }

      if (!projectFolder && projectName) {
        const matchedProjectFolder = (await findDriveFoldersByName(driveApi, projectName, { exact: true, pageSize: 1 }))[0];
        if (matchedProjectFolder?.id) {
          projectFolder = {
            id: String(matchedProjectFolder.id),
            name: toNonEmptyString(matchedProjectFolder.name) || projectName,
            webViewLink: toNonEmptyString(matchedProjectFolder.webViewLink),
            parents: Array.isArray(matchedProjectFolder.parents)
              ? matchedProjectFolder.parents.filter((entry): entry is string => typeof entry === 'string')
              : [],
          };
        }
      }

      let destinationFolder: DriveFolderReference | null = targetFolderId
        ? await resolveDriveFolderById(targetFolderId)
        : null;
      let destinationScope = toNonEmptyString(payload.targetScope) || toNonEmptyString(payload.scope) || null;

      if (!destinationFolder && targetFolderName && customerFolder) {
        destinationFolder = await ensureDriveFolder(driveApi, targetFolderName, customerFolder.id);
        destinationScope = destinationScope || 'customer';
      }

      if (!destinationFolder && projectFolder) {
        destinationFolder = projectFolder;
        destinationScope = destinationScope || 'project';
      }

      if (!destinationFolder && customerFolder) {
        destinationFolder = customerFolder;
        destinationScope = destinationScope || 'customer';
      }

      if (!destinationFolder && targetFolderName) {
        destinationFolder = await ensureDriveFolder(driveApi, targetFolderName);
        destinationScope = destinationScope || 'global';
      }

      if (!destinationFolder) {
        return res.status(400).json({
          error: 'Velg en kunde, et prosjekt eller en konkret mappe før opplasting.',
        });
      }

      const uploaded = await Promise.all(
        files.map(async (file) => {
          const fileName = sanitizeGoogleDriveFolderName(file.originalname || `Upload ${Date.now()}`);
          const appProperties = Object.fromEntries(
            Object.entries({
              creatorhubCustomerId: customerId,
              creatorhubProjectId: projectId,
              creatorhubSectionId: sectionId,
              creatorhubUserId: preferredIdentity.userId,
            }).filter((entry): entry is [string, string] => Boolean(entry[1])),
          );

          const created = await driveApi.files.create({
            requestBody: {
              name: fileName || `upload-${crypto.randomUUID()}`,
              parents: [destinationFolder!.id],
              appProperties,
              description: dedupeStringArray([
                sectionLabel,
                customerName || crmCustomer?.name,
                companyName || crmCustomer?.company,
                projectName,
              ]).join(' • '),
            },
            media: {
              mimeType: toNonEmptyString(file.mimetype) || 'application/octet-stream',
              body: Readable.from(file.buffer),
            },
            supportsAllDrives: true,
            fields: 'id,name,mimeType,size,modifiedTime,iconLink,thumbnailLink,webViewLink,webContentLink,parents',
          });

          return {
            id: toNonEmptyString(created.data.id) ?? crypto.randomUUID(),
            name: toNonEmptyString(created.data.name) ?? fileName,
            mimeType: toNonEmptyString(created.data.mimeType) ?? toNonEmptyString(file.mimetype) ?? 'application/octet-stream',
            size: created.data.size == null ? file.size : Number(created.data.size),
            modifiedTime: toNonEmptyString(created.data.modifiedTime),
            iconLink: toNonEmptyString(created.data.iconLink),
            thumbnailLink: toNonEmptyString(created.data.thumbnailLink),
            webViewLink: toNonEmptyString(created.data.webViewLink),
            webContentLink: toNonEmptyString(created.data.webContentLink),
            parents: Array.isArray(created.data.parents) ? created.data.parents.filter((value): value is string => typeof value === 'string') : [],
          };
        }),
      );

      return res.status(201).json({
        success: true,
        source: workspaceContext.source,
        connection: workspaceContext.connection,
        destinationFolder: {
          id: destinationFolder.id,
          name: destinationFolder.name,
          webViewLink: destinationFolder.webViewLink,
          scope: destinationScope || 'unknown',
          projectId: projectId || null,
          customerId: customerId || null,
          sectionId,
          sectionLabel,
        },
        uploaded,
      });
    } catch (error) {
      console.error('Error uploading contextual drive files:', error);
      return res.status(500).json({ error: formatGoogleDriveError(error) });
    }
  });

  router.post('/api/google-drive/files', async (req, res) => {
    await listGoogleDriveFiles(req, res);
  });

  router.post('/api/google-drive/files/:fileId/share', async (req, res) => {
    await shareGoogleDriveFile(req, res);
  });

  router.post('/api/google/drive/files/:fileId/share', async (req, res) => {
    await shareGoogleDriveFile(req, res);
  });

  // ─── POST /api/helpdesk/tickets ───────────────────────────
  router.post('/api/helpdesk/tickets', async (req, res) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const title = toNonEmptyString(payload.title);
      const description = toNonEmptyString(payload.description);
      const userId =
        toNonEmptyString(payload.userId) ||
        toNonEmptyString(req.headers['x-user-id']) ||
        'anonymous';
      const userEmail =
        toNonEmptyString(payload.userEmail) ||
        toNonEmptyString(req.headers['x-user-email']);
      const profession = toNonEmptyString(payload.profession) || 'general';
      const dashboardFeature = toNonEmptyString(payload.dashboardFeature) || 'chat-widget';
      const rawCategory = toNonEmptyString(payload.category) || 'question';

      if (!title || !description) {
        return res.status(400).json({ error: 'title and description are required' });
      }

      const ticketId = crypto.randomUUID();
      const now = new Date().toISOString();
      const isAnonymous = userId === 'anonymous' || Boolean(payload.isAnonymous);

      await db.insert(schema.prototypeFeedback).values({
        id: ticketId,
        userId,
        userEmail: userEmail || null,
        userName: toNonEmptyString(payload.userName),
        profession,
        dashboardType: dashboardFeature,
        feedbackType: normalizeFeedbackType(rawCategory),
        title,
        description,
        rating: Number.isFinite(Number(payload.rating)) ? Number(payload.rating) : 5,
        priority: normalizePriority(payload.priority),
        component: 'helpdesk',
        tags: [rawCategory, dashboardFeature],
        isAnonymous,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      });

      res.status(201).json({
        success: true,
        ticket: {
          id: ticketId,
          title,
          description,
          category: rawCategory,
          priority: normalizePriority(payload.priority),
          status: 'open',
          userId,
          userEmail,
          createdAt: now,
        },
      });
    } catch (error) {
      console.error('Error creating helpdesk ticket:', error);
      res.status(500).json({ error: 'Failed to create helpdesk ticket' });
    }
  });

  // ─── Google Chat bridge routes (database-backed fallback) ─
  router.get('/api/google/chat/spaces', async (req, res) => {
    try {
      const liveResponse = await tryLiveGoogleChatRequest(req, '/spaces?pageSize=50');
      if (liveResponse) {
        if (!liveResponse.response.ok) {
          return res.status(liveResponse.response.status).json({
            error: formatGoogleChatError(liveResponse.response.status, liveResponse.body),
            source: liveResponse.context.source,
            connection: liveResponse.context.connection,
          });
        }

        const liveSpaces = Array.isArray((liveResponse.body as { spaces?: unknown[] } | null)?.spaces)
          ? ((liveResponse.body as { spaces?: Array<Record<string, unknown>> }).spaces ?? [])
          : [];

        return res.json({
          spaces: liveSpaces.map((space) => ({
            name: toNonEmptyString(space.name) ?? `spaces/${crypto.randomUUID()}`,
            displayName: toNonEmptyString(space.displayName) ?? 'Google Chat Space',
            spaceType: toNonEmptyString(space.spaceType) ?? 'SPACE',
            lastActiveTime:
              toNonEmptyString(space.lastActiveTime)
              ?? toNonEmptyString(space.updateTime)
              ?? toNonEmptyString(space.createTime),
            spaceUri: toNonEmptyString(space.spaceUri),
            memberCount: Number.isFinite(Number((space.membershipCount as { joinedDirectHumanUserCount?: unknown } | undefined)?.joinedDirectHumanUserCount))
              ? Number((space.membershipCount as { joinedDirectHumanUserCount?: unknown } | undefined)?.joinedDirectHumanUserCount)
              : null,
            spaceDetails: {
              description:
                toNonEmptyString((space.spaceDetails as { description?: unknown } | undefined)?.description)
                ?? toNonEmptyString(space.description)
                ?? '',
            },
            lastMessage: null,
            metadata: {
              source: 'google-chat-live',
              type: toNonEmptyString(space.type),
              threaded: space.spaceThreadingState === 'THREADED_MESSAGES',
            },
          })),
        });
      }

      const channels = await db
        .select({
          id: schema.communicationChannels.id,
          name: schema.communicationChannels.name,
          description: schema.communicationChannels.description,
          type: schema.communicationChannels.type,
          updatedAt: schema.communicationChannels.updatedAt,
        })
        .from(schema.communicationChannels)
        .where(eq(schema.communicationChannels.isActive, true))
        .orderBy(desc(schema.communicationChannels.updatedAt))
        .limit(50);

      const spaces = await Promise.all(
        channels.map(async (channel) => {
          const last = await db
            .select({
              content: schema.communicationMessages.content,
              createdAt: schema.communicationMessages.createdAt,
            })
            .from(schema.communicationMessages)
            .where(eq(schema.communicationMessages.channelId, channel.id))
            .orderBy(desc(schema.communicationMessages.createdAt))
            .limit(1);

          return {
            name: `spaces/${channel.id}`,
            displayName: channel.name || `Space ${channel.id}`,
            spaceType: 'SPACE',
            lastActiveTime: last[0]?.createdAt || channel.updatedAt || null,
            spaceUri: null,
            memberCount: null,
            spaceDetails: {
              description: channel.description || '',
            },
            lastMessage: last[0]
              ? {
                  text: String(last[0].content || ''),
                  createTime: last[0].createdAt,
                }
              : null,
            metadata: {
              source: 'creatorhub-fallback',
              type: channel.type,
              updatedAt: channel.updatedAt,
            },
          };
        })
      );

      res.json({ spaces });
    } catch (error) {
      console.error('Error fetching google chat spaces:', error);
      res.status(500).json({ error: 'Failed to fetch Google Chat spaces' });
    }
  });

  router.get('/api/google/chat/messages', async (req, res) => {
    try {
      const rawSpace = toNonEmptyString(req.query.space || req.query.threadId || req.query.channelId);
      if (!rawSpace) {
        return res.status(400).json({ error: 'space is required' });
      }
      const liveResponse = await tryLiveGoogleChatRequest(
        req,
        `/${normalizeGoogleSpaceName(rawSpace)}/messages?pageSize=${Math.min(Math.max(Number.parseInt(String(req.query.limit || '100'), 10) || 100, 1), 200)}`,
      );

      if (liveResponse) {
        if (!liveResponse.response.ok) {
          return res.status(liveResponse.response.status).json({
            error: formatGoogleChatError(liveResponse.response.status, liveResponse.body),
            source: liveResponse.context.source,
            connection: liveResponse.context.connection,
          });
        }

        const liveMessages = Array.isArray((liveResponse.body as { messages?: unknown[] } | null)?.messages)
          ? ((liveResponse.body as { messages?: Array<Record<string, unknown>> }).messages ?? [])
          : [];

        return res.json({
          messages: liveMessages.map((message) => ({
            id: toNonEmptyString(message.name) ?? crypto.randomUUID(),
            senderId:
              toNonEmptyString((message.sender as { name?: unknown; displayName?: unknown } | undefined)?.displayName)
              ?? toNonEmptyString((message.sender as { name?: unknown } | undefined)?.name)
              ?? 'google-chat-user',
            content: toNonEmptyString(message.text) ?? '',
            timestamp: toNonEmptyString(message.createTime) ?? new Date().toISOString(),
            type: 'text',
            status: 'sent',
            sender: message.sender ?? null,
            threadName: (message.thread as { name?: unknown } | undefined)?.name ?? null,
          })),
        });
      }

      const channelId = normalizeChannelId(rawSpace);
      const limit = Number.parseInt(String(req.query.limit || '100'), 10) || 100;

      const messages = await db
        .select({
          id: schema.communicationMessages.id,
          senderId: schema.communicationMessages.senderId,
          content: schema.communicationMessages.content,
          messageType: schema.communicationMessages.messageType,
          isRead: schema.communicationMessages.isRead,
          deliveredAt: schema.communicationMessages.deliveredAt,
          createdAt: schema.communicationMessages.createdAt,
        })
        .from(schema.communicationMessages)
        .where(eq(schema.communicationMessages.channelId, channelId))
        .orderBy(schema.communicationMessages.createdAt)
        .limit(limit);

      res.json({
        messages: messages.map((message) => ({
          id: message.id,
          senderId: message.senderId,
          content: message.content,
          timestamp: message.createdAt,
          type: message.messageType || 'text',
          status: message.isRead ? 'read' : message.deliveredAt ? 'delivered' : 'sent',
        })),
      });
    } catch (error) {
      console.error('Error fetching google chat messages:', error);
      res.status(500).json({ error: 'Failed to fetch Google Chat messages' });
    }
  });

  const handleGoogleSend = async (req: Request, res: Response) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const rawSpace = toNonEmptyString(payload.space) || toNonEmptyString(payload.threadId) || toNonEmptyString(payload.conversationId);
      if (!rawSpace) {
        return res.status(400).json({ error: 'space is required' });
      }
      const channelId = normalizeChannelId(rawSpace);
      const content = toNonEmptyString(payload.message) || toNonEmptyString(payload.content);
      const attachments = sanitizeChatAttachments(payload.attachments);
      const senderId =
        toNonEmptyString(req.headers['x-user-id']) ||
        toNonEmptyString(req.headers['x-user-email']) ||
        'google-chat-user';
      const attachmentSection = attachments.length > 0
        ? ['Vedlegg fra Google Drive:', ...attachments.map((attachment) => `- ${attachment.filename}: ${attachment.downloadUrl}`)].join('\n')
        : '';
      const finalContent = [content, attachmentSection]
        .filter((part) => typeof part === 'string' && part.trim().length > 0)
        .join('\n\n');

      if (!finalContent) {
        return res.status(400).json({ error: 'message is required' });
      }

      const threadName = toNonEmptyString(payload.threadName);
      const liveResponse = await tryLiveGoogleChatRequest(
        req,
        `/${normalizeGoogleSpaceName(rawSpace)}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            text: finalContent,
            ...(threadName ? { thread: { name: threadName } } : {}),
          }),
        },
        payload,
      );

      if (liveResponse) {
        if (!liveResponse.response.ok) {
          return res.status(liveResponse.response.status).json({
            error: formatGoogleChatError(liveResponse.response.status, liveResponse.body),
            source: liveResponse.context.source,
            connection: liveResponse.context.connection,
          });
        }

        const liveMessage = (liveResponse.body ?? {}) as Record<string, unknown>;
        return res.json({
          success: true,
          messageId: toNonEmptyString(liveMessage.name),
          space: normalizeGoogleSpaceName(rawSpace),
          message: liveMessage,
          source: liveResponse.context.source,
          connection: liveResponse.context.connection,
        });
      }

      await ensureChannelExists(channelId, `Google Space ${channelId}`, 'team');
      const persisted = await persistMessage({
        channelId,
        senderId,
        content: finalContent,
        messageType: attachments.length > 0 ? 'file' : 'text',
        metadata: {
          source: 'google-chat-bridge',
          ...(attachments.length > 0 ? { attachments } : {}),
        },
      });

      res.json({
        success: true,
        messageId: persisted.id,
        space: `spaces/${channelId}`,
      });
    } catch (error) {
      console.error('Error sending google chat message:', error);
      res.status(500).json({ error: 'Failed to send Google Chat message' });
    }
  };

  router.post('/api/google/chat/send', async (req, res) => {
    await handleGoogleSend(req, res);
  });

  router.post('/api/google/chat/send-message', async (req, res) => {
    await handleGoogleSend(req, res);
  });

  router.delete('/api/google/chat/messages/:messageId', async (req, res) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const rawMessageId = toNonEmptyString(req.params.messageId);
      if (!rawMessageId) {
        return res.status(400).json({ error: 'messageId is required' });
      }

      const normalizedMessageName = rawMessageId.startsWith('spaces/')
        ? rawMessageId
        : `spaces/${rawMessageId}`;

      const liveResponse = await tryLiveGoogleChatRequest(
        req,
        `/${normalizedMessageName}`,
        {
          method: 'DELETE',
        },
        payload,
      );

      if (liveResponse) {
        if (!liveResponse.response.ok) {
          return res.status(liveResponse.response.status).json({
            error: formatGoogleChatError(liveResponse.response.status, liveResponse.body),
            source: liveResponse.context.source,
            connection: liveResponse.context.connection,
          });
        }

        return res.json({
          success: true,
          deletedMessageId: normalizedMessageName,
          source: liveResponse.context.source,
          connection: liveResponse.context.connection,
        });
      }

      return res.status(501).json({
        error: 'Google Chat delete støttes bare når en live Google Chat-kobling er aktiv.',
      });
    } catch (error) {
      console.error('Error deleting google chat message:', error);
      res.status(500).json({ error: 'Failed to delete Google Chat message' });
    }
  });

  router.post('/api/google/chat/create-space', async (req, res) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const displayName = toNonEmptyString(payload.displayName) || 'Nytt Google Chat-rom';
      const description = toNonEmptyString(payload.description);
      const liveResponse = await tryLiveGoogleChatRequest(
        req,
        `/spaces?requestId=${encodeURIComponent(crypto.randomUUID())}`,
        {
          method: 'POST',
          body: JSON.stringify({
            displayName,
            spaceType: toNonEmptyString(payload.spaceType) || 'SPACE',
            ...(description ? { spaceDetails: { description } } : {}),
          }),
        },
        payload,
      );

      if (liveResponse) {
        if (!liveResponse.response.ok) {
          return res.status(liveResponse.response.status).json({
            error: formatGoogleChatError(liveResponse.response.status, liveResponse.body),
            source: liveResponse.context.source,
            connection: liveResponse.context.connection,
          });
        }

        const liveSpace = (liveResponse.body ?? {}) as Record<string, unknown>;
        return res.status(201).json({
          success: true,
          space: {
            name: toNonEmptyString(liveSpace.name),
            displayName: toNonEmptyString(liveSpace.displayName) ?? displayName,
            spaceType: toNonEmptyString(liveSpace.spaceType) ?? (toNonEmptyString(payload.spaceType) || 'SPACE'),
            spaceDetails: liveSpace.spaceDetails ?? null,
          },
          source: liveResponse.context.source,
          connection: liveResponse.context.connection,
        });
      }

      const normalizedSlug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const channelId = `google-${normalizedSlug || 'space'}-${Date.now()}`;
      const now = new Date().toISOString();

      await db.insert(schema.communicationChannels).values({
        id: channelId,
        name: displayName,
        type: 'team',
        description,
        settings: {
          platform: 'google-chat',
          spaceType: toNonEmptyString(payload.spaceType) || 'SPACE',
          threaded: Boolean(payload.threaded),
        },
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      res.status(201).json({
        success: true,
        space: {
          name: `spaces/${channelId}`,
          displayName,
          spaceType: toNonEmptyString(payload.spaceType) || 'SPACE',
        },
      });
    } catch (error) {
      console.error('Error creating google chat space:', error);
      res.status(500).json({ error: 'Failed to create Google Chat space' });
    }
  });

  router.post('/api/google/chat/create-project-space', async (req, res) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const projectId = toNonEmptyString(payload.projectId) || crypto.randomUUID();
      const profession = toNonEmptyString(payload.profession) || 'project';
      const displayName = `Prosjekt ${projectId}`;
      const channelId = `gproject-${projectId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
      const now = new Date().toISOString();

      await db.insert(schema.communicationChannels).values({
        id: channelId,
        name: displayName,
        type: 'team',
        description: `Google project space for ${profession}`,
        settings: {
          platform: 'google-chat',
          projectId,
          profession,
          userId: toNonEmptyString(payload.userId),
        },
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      res.status(201).json({
        success: true,
        spaceId: `spaces/${channelId}`,
        spaceName: displayName,
        channelId,
      });
    } catch (error) {
      console.error('Error creating google project space:', error);
      res.status(500).json({ error: 'Failed to create Google project space' });
    }
  });

  router.get('/api/google-chat/project-spaces/current-user', async (_req, res) => {
    try {
      const channels = await db
        .select({
          id: schema.communicationChannels.id,
          name: schema.communicationChannels.name,
          description: schema.communicationChannels.description,
          settings: schema.communicationChannels.settings,
          updatedAt: schema.communicationChannels.updatedAt,
        })
        .from(schema.communicationChannels)
        .where(eq(schema.communicationChannels.isActive, true))
        .orderBy(desc(schema.communicationChannels.updatedAt))
        .limit(30);

      const spaces = channels.map((channel) => {
        const settings = (channel.settings || {}) as Record<string, unknown>;
        const projectId = toNonEmptyString(settings.projectId) || channel.id;
        const projectName = toNonEmptyString(settings.projectName) || channel.name || 'Prosjekt';
        const clientName = toNonEmptyString(settings.clientName) || 'Kunde';

        return {
          spaced: `spaces/${channel.id}`,
          spaceName: channel.name || `Space ${channel.id}`,
          projectType: toNonEmptyString(settings.projectType) || 'team',
          status: 'active',
          projectName,
          clientName,
          lastActivity: channel.updatedAt || new Date().toISOString(),
          unreadCount: 0,
          milestones: [],
          memberCount: Number(settings.memberCount || 2),
          projectId,
        };
      });

      res.json({ success: true, spaces });
    } catch (error) {
      console.error('Error fetching project spaces:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch project spaces' });
    }
  });

  router.get('/api/google/chat/threads', async (_req, res) => {
    try {
      const channels = await db
        .select({
          id: schema.communicationChannels.id,
          name: schema.communicationChannels.name,
          settings: schema.communicationChannels.settings,
          updatedAt: schema.communicationChannels.updatedAt,
        })
        .from(schema.communicationChannels)
        .where(eq(schema.communicationChannels.isActive, true))
        .orderBy(desc(schema.communicationChannels.updatedAt))
        .limit(30);

      const threads = channels.map((channel) => {
        const settings = (channel.settings || {}) as Record<string, unknown>;
        return {
          id: channel.id,
          subject: channel.name || 'Chat-tråd',
          participants: Array.isArray(settings.participants)
            ? settings.participants.filter((value): value is string => typeof value === 'string')
            : [],
          lastMessage: toNonEmptyString(settings.lastMessage) || '',
          lastActivity: channel.updatedAt || new Date().toISOString(),
          unreadCount: Number(settings.unreadCount || 0),
          status: 'active',
        };
      });

      res.json(threads);
    } catch (error) {
      console.error('Error fetching chat threads:', error);
      res.status(500).json({ error: 'Failed to fetch chat threads' });
    }
  });

  router.post('/api/google/chat/create-thread', async (req, res) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const threadId = `thread-${Date.now()}`;
      const emailId = toNonEmptyString(payload.emailId) || 'email';
      const now = new Date().toISOString();

      await db.insert(schema.communicationChannels).values({
        id: threadId,
        name: `Thread ${emailId}`,
        type: 'chat',
        settings: {
          platform: 'google-chat',
          sourceEmailId: emailId,
          participants: [],
          unreadCount: 0,
        },
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      res.status(201).json({ success: true, threadId });
    } catch (error) {
      console.error('Error creating chat thread:', error);
      res.status(500).json({ error: 'Failed to create chat thread' });
    }
  });

  // ─── POST /api/chat/analyze-message ───────────────────────
  router.post('/api/chat/analyze-message', async (req, res) => {
    const payload = (req.body || {}) as Record<string, unknown>;
    const content = toNonEmptyString(payload.content) || '';
    const lower = content.toLowerCase();

    const suggestions: string[] = [];
    if (lower.includes('pris') || lower.includes('tilbud') || lower.includes('kost')) {
      suggestions.push('Takk for interessen! Jeg kan sende et konkret pristilbud basert på behovene deres.');
    }
    if (lower.includes('når') || lower.includes('dato') || lower.includes('ledig')) {
      suggestions.push('Jeg kan sjekke tilgjengelighet med en gang. Hvilken dato vurderer dere?');
    }
    if (suggestions.length === 0) {
      suggestions.push('Takk for meldingen! Jeg følger opp så raskt jeg kan.');
      suggestions.push('Kan du dele litt mer kontekst, så kan jeg gi et mer presist svar?');
    }

    const sentiment = lower.includes('takk') || lower.includes('flott') ? 'positive' : 'neutral';
    const priority = lower.includes('haster') || lower.includes('urgent') ? 'high' : 'normal';

    res.json({ suggestions, sentiment, priority });
  });

  // ─── GET /api/admin/communication/users ───────────────────
  router.get('/api/admin/communication/users', async (_req, res) => {
    try {
      // Get distinct senders from messages
      const users = await db
        .selectDistinct({ senderId: schema.communicationMessages.senderId })
        .from(schema.communicationMessages)
        .limit(100);

      res.json({
        users: users.map((u) => ({
          id: u.senderId,
          email: u.senderId,
          name: u.senderId,
          isOnline: false,
        })),
      });
    } catch (error) {
      console.error('Error fetching communication users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // ─── GET /api/admin/communication/stats ───────────────────
  router.get('/api/admin/communication/stats', async (_req, res) => {
    try {
      const totalMessages = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.communicationMessages);

      const totalChannels = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.communicationChannels)
        .where(eq(schema.communicationChannels.isActive, true));

      const unreadMessages = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.communicationMessages)
        .where(eq(schema.communicationMessages.isRead, false));

      res.json({
        totalMessages: totalMessages[0]?.count || 0,
        totalChannels: totalChannels[0]?.count || 0,
        unreadMessages: unreadMessages[0]?.count || 0,
        activeUsers: 0,
      });
    } catch (error) {
      console.error('Error fetching communication stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  return router;
}
