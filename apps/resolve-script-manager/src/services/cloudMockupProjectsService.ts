import { loadSettings } from "../components/SettingsModal";
import type { MockupDoc } from "../components/mockup-studio/mockupStudioModel";
import { sanitizeRemoteMockupProjectAssets } from "../components/mockup-studio/mockupPreflightRules";

export type MockupAccessRole = "owner" | "editor" | "commenter" | "approver" | "viewer";
export type MockupReviewStatus = "draft" | "in_review" | "changes_requested" | "approved" | "superseded";
export type MockupCommentStatus = "open" | "in_progress" | "resolved" | "wontfix";
export type MockupCommentPriority = "low" | "normal" | "high" | "urgent";
export type MockupReviewMarkKind = "freehand" | "arrow" | "rect";
export interface MockupReviewPoint {
  x: number;
  y: number;
}
export interface MockupReviewMark {
  id: string;
  kind: MockupReviewMarkKind;
  points: MockupReviewPoint[];
  color: string;
  width: number;
}

export interface CloudMockupProjectMeta {
  id: string;
  name: string;
  campaignId?: string;
  status?: string;
  revision: number;
  updatedAt: string;
  workspaceProjectId?: string | null;
  accessRole?: MockupAccessRole;
  openComments?: number;
}
export interface CloudMockupVersion {
  id: string;
  label: string;
  createdAt: string;
  sourceRevision?: number;
  reviewStatus?: MockupReviewStatus;
  note?: string | null;
  preview?: string | null;
  commentCount?: number;
}
export interface CloudMockupAttachment {
  id: string;
  commentId: string;
  displayName: string;
  contentType: string;
  sizeBytes: number;
  isRecording: boolean;
  createdAt: string;
}
export interface CloudMockupComment {
  id: string;
  projectId: string;
  versionId: string;
  number: number;
  parentId: string | null;
  authorKind: "user" | "reviewer" | "system";
  authorUserId: string | null;
  reviewerSessionId: string | null;
  authorDisplayName: string;
  body: string;
  anchorKind: "general" | "canvas" | "element";
  anchorRef: string | null;
  anchorX: number | null;
  anchorY: number | null;
  anchorOffsetX: number | null;
  anchorOffsetY: number | null;
  marks: MockupReviewMark[];
  context: Record<string, unknown>;
  status: MockupCommentStatus;
  priority: MockupCommentPriority;
  assignedTo: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: CloudMockupAttachment[];
  reactions: Record<string, number>;
}
export interface CloudMockupShare {
  id: string;
  versionId: string;
  versionLabel?: string;
  accessMode: "view" | "comment" | "approve";
  requireIdentity: boolean;
  allowRecordings: boolean;
  allowVersionHistory: boolean;
  commentsPaused: boolean;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}
export interface CloudMockupShareResult {
  url: string;
  reviewPath: string;
  shareId: string;
  versionId: string;
  expiresAt: string | null;
  reviewerNotifications?: { attempted: number; sent: number };
}
export interface CloudMockupCollaborator {
  id: string;
  userId?: string | null;
  email: string;
  displayName?: string | null;
  role: Exclude<MockupAccessRole, "owner">;
  acceptedAt?: string | null;
  createdAt: string;
}
export interface CloudMockupDecision {
  id: string;
  versionId: string;
  decision: "approved" | "changes_requested" | "reset";
  note?: string | null;
  actorDisplayName: string;
  createdAt: string;
}
export interface CloudMockupPresence {
  participantKey: string;
  displayName: string;
  cursorX: number | null;
  cursorY: number | null;
  lastSeenAt: string;
}
export interface CloudMockupReviewSummary {
  versions: Array<{
    versionId: string;
    label: string;
    reviewStatus: MockupReviewStatus;
    createdAt: string;
    totalComments: number;
    openComments: number;
  }>;
  decisions: CloudMockupDecision[];
  presence: CloudMockupPresence[];
  accessRole: MockupAccessRole;
}
export interface CloudMockupNotification {
  id: string;
  projectId: string;
  versionId?: string | null;
  kind: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown>;
  seenAt?: string | null;
  createdAt: string;
}
export interface CloudMockupWebhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  failureCount: number;
  lastDeliveredAt?: string | null;
  lastStatusCode?: number | null;
  createdAt: string;
}

export type CloudMockupChangeSetStatus = "proposed" | "rejected" | "applied";
export type CloudMockupChangeValue = string | number | boolean | null;
export interface CloudMockupChangeOperation {
  id: string;
  targetRef: string;
  targetLabel: string;
  field: string;
  label: string;
  before: CloudMockupChangeValue;
  value: CloudMockupChangeValue;
}
export interface CloudMockupChangeSet {
  id: string;
  projectId: string;
  versionId: string;
  sourceCommentIds: string[];
  sourceRevision: number;
  title: string;
  summary: string;
  status: CloudMockupChangeSetStatus;
  operations: CloudMockupChangeOperation[];
  generator: string;
  confidence: number;
  appliedVersionId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export function mockupCloudBaseUrl(): string {
  const settings = loadSettings();
  const base = settings.RR_POST_AGENT_BASE_URL || "https://www.creatorhubn.com/api/post-agent";
  return base.replace(/\/api\/post-agent\/?$/, "");
}
export function mockupCloudBearer(): string | null {
  return loadSettings().RR_BEARER_TOKEN?.trim() || null;
}
function headers(json = false): Record<string, string> {
  const bearer = mockupCloudBearer();
  if (!bearer) throw new Error("Ikke innlogget");
  return { Authorization: `Bearer ${bearer}`, ...(json ? { "Content-Type": "application/json" } : {}) };
}
async function responseError(res: Response): Promise<Error> {
  let detail = "";
  try {
    const json = await res.json() as { error?: string; detail?: string };
    detail = String(json.detail || json.error || "");
  } catch { /* no body */ }
  return new Error(detail || `HTTP ${res.status}`);
}
async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${mockupCloudBaseUrl()}${path}`, {
    ...init,
    headers: { ...headers(Boolean(init.body)), ...(init.headers || {}) },
  });
  if (!res.ok) throw await responseError(res);
  return await res.json() as T;
}
function projectPath(id: string): string {
  return `/api/role-room/mockup-projects/${encodeURIComponent(id)}`;
}
function camelShare(row: Record<string, unknown>): CloudMockupShare {
  return {
    id: String(row.id),
    versionId: String(row.version_id ?? row.versionId ?? ""),
    versionLabel: String(row.version_label ?? row.versionLabel ?? ""),
    accessMode: String(row.access_mode ?? row.accessMode ?? "approve") as CloudMockupShare["accessMode"],
    requireIdentity: Boolean(row.require_identity ?? row.requireIdentity),
    allowRecordings: Boolean(row.allow_recordings ?? row.allowRecordings),
    allowVersionHistory: Boolean(row.allow_version_history ?? row.allowVersionHistory),
    commentsPaused: Boolean(row.comments_paused_at ?? row.commentsPaused),
    expiresAt: (row.expires_at ?? row.expiresAt ?? null) as string | null,
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
    revokedAt: (row.revoked_at ?? row.revokedAt ?? null) as string | null,
  };
}

export async function pushCloudMockupProject(project: MockupDoc): Promise<{ revision: number; updatedAt: string }> {
  return requestJson(projectPath(project.id), {
    method: "PUT", body: JSON.stringify({ project }),
  });
}
export async function listCloudMockupProjects(): Promise<CloudMockupProjectMeta[]> {
  if (!mockupCloudBearer()) return [];
  const json = await requestJson<{ projects?: CloudMockupProjectMeta[] }>("/api/role-room/mockup-projects");
  return json.projects ?? [];
}
export async function pullCloudMockupProject(id: string): Promise<{ project: MockupDoc; revision: number; updatedAt: string; accessRole?: MockupAccessRole }> {
  const result = await requestJson<{ project: MockupDoc; revision: number; updatedAt: string; accessRole?: MockupAccessRole }>(projectPath(id));
  return { ...result, project: sanitizeRemoteMockupProjectAssets(result.project) };
}
export async function deleteCloudMockupProject(id: string): Promise<void> {
  if (!mockupCloudBearer()) return;
  await requestJson(projectPath(id), { method: "DELETE" });
}
export async function saveCloudMockupVersion(project: MockupDoc, label: string, note?: string): Promise<string> {
  const json = await requestJson<{ id: string }>(`${projectPath(project.id)}/versions`, {
    method: "POST", body: JSON.stringify({ project, label, note }),
  });
  return String(json.id);
}
export async function listCloudMockupVersions(id: string): Promise<CloudMockupVersion[]> {
  if (!mockupCloudBearer()) return [];
  const json = await requestJson<{ versions?: CloudMockupVersion[] }>(`${projectPath(id)}/versions`);
  return json.versions ?? [];
}
export async function loadCloudMockupVersion(id: string, versionId: string): Promise<{ version: CloudMockupVersion & { payload: MockupDoc }; comments: CloudMockupComment[] }> {
  const result = await requestJson<{ version: CloudMockupVersion & { payload: MockupDoc }; comments: CloudMockupComment[] }>(`${projectPath(id)}/versions/${encodeURIComponent(versionId)}`);
  return { ...result, version: { ...result.version, payload: sanitizeRemoteMockupProjectAssets(result.version.payload) } };
}
export async function listCloudMockupChangeSets(id: string, versionId?: string): Promise<CloudMockupChangeSet[]> {
  const query = versionId ? "?versionId=" + encodeURIComponent(versionId) : "";
  const json = await requestJson<{ changeSets?: CloudMockupChangeSet[] }>(projectPath(id) + "/change-sets" + query);
  return json.changeSets ?? [];
}
export async function generateCloudMockupChangeSet(id: string, versionId: string, commentIds: string[]): Promise<CloudMockupChangeSet> {
  const json = await requestJson<{ changeSet: CloudMockupChangeSet }>(projectPath(id) + "/change-sets/generate", {
    method: "POST", body: JSON.stringify({ versionId, commentIds }),
  });
  return json.changeSet;
}
export async function updateCloudMockupChangeSet(
  id: string,
  changeSetId: string,
  patch: { title?: string; summary?: string; operations?: CloudMockupChangeOperation[] },
): Promise<CloudMockupChangeSet> {
  const json = await requestJson<{ changeSet: CloudMockupChangeSet }>(
    projectPath(id) + "/change-sets/" + encodeURIComponent(changeSetId),
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return json.changeSet;
}
export async function rejectCloudMockupChangeSet(id: string, changeSetId: string, note?: string): Promise<CloudMockupChangeSet> {
  const json = await requestJson<{ changeSet: CloudMockupChangeSet }>(
    projectPath(id) + "/change-sets/" + encodeURIComponent(changeSetId) + "/reject",
    { method: "POST", body: JSON.stringify({ note }) },
  );
  return json.changeSet;
}
export async function applyCloudMockupChangeSet(
  id: string,
  changeSetId: string,
  project: MockupDoc,
): Promise<{ changeSet: CloudMockupChangeSet; project: MockupDoc; version: CloudMockupVersion; revision: number; updatedAt: string }> {
  return requestJson(projectPath(id) + "/change-sets/" + encodeURIComponent(changeSetId) + "/apply", {
    method: "POST", body: JSON.stringify({ project }),
  });
}

export async function createCloudMockupReview(
  id: string,
  options: {
    label?: string;
    note?: string;
    accessMode?: "view" | "comment" | "approve";
    expiresInDays?: number;
    requireIdentity?: boolean;
    allowRecordings?: boolean;
    allowVersionHistory?: boolean;
    notifyPreviousReviewers?: boolean;
  } = {},
): Promise<CloudMockupShareResult> {
  return requestJson(`${projectPath(id)}/share`, {
    method: "POST", body: JSON.stringify(options),
  });
}
export async function createCloudMockupShare(id: string): Promise<string> {
  return (await createCloudMockupReview(id)).url;
}
export async function listCloudMockupShares(id: string): Promise<CloudMockupShare[]> {
  const json = await requestJson<{ shares?: Record<string, unknown>[] }>(`${projectPath(id)}/shares`);
  return (json.shares ?? []).map(camelShare);
}
export async function updateCloudMockupShare(id: string, shareId: string, patch: {
  accessMode?: CloudMockupShare["accessMode"];
  commentsPaused?: boolean;
  allowRecordings?: boolean;
  allowVersionHistory?: boolean;
  expiresAt?: string;
}): Promise<void> {
  await requestJson(`${projectPath(id)}/shares/${encodeURIComponent(shareId)}`, {
    method: "PATCH", body: JSON.stringify(patch),
  });
}
export async function revokeCloudMockupShare(id: string, shareId: string): Promise<void> {
  await requestJson(`${projectPath(id)}/shares/${encodeURIComponent(shareId)}`, { method: "DELETE" });
}
export async function revokeCloudMockupShares(id: string): Promise<void> {
  await requestJson(`${projectPath(id)}/share`, { method: "DELETE" });
}
export async function listCloudMockupComments(id: string, versionId: string): Promise<{ comments: CloudMockupComment[]; accessRole: MockupAccessRole }> {
  return requestJson(`${projectPath(id)}/comments?versionId=${encodeURIComponent(versionId)}`);
}
export async function createCloudMockupComment(id: string, input: {
  versionId: string;
  body: string;
  parentId?: string | null;
  anchorKind?: "general" | "canvas" | "element";
  anchorRef?: string | null;
  anchorX?: number | null;
  anchorY?: number | null;
  anchorOffsetX?: number | null;
  anchorOffsetY?: number | null;
  marks?: MockupReviewMark[];
  context?: Record<string, unknown>;
}): Promise<CloudMockupComment> {
  const json = await requestJson<{ comment: CloudMockupComment }>(`${projectPath(id)}/comments`, {
    method: "POST", body: JSON.stringify(input),
  });
  return json.comment;
}
export async function updateCloudMockupComment(id: string, commentId: string, patch: {
  body?: string;
  status?: MockupCommentStatus;
  priority?: MockupCommentPriority;
  assignedTo?: string | null;
  anchorKind?: "general" | "canvas" | "element";
  anchorRef?: string | null;
  anchorX?: number | null;
  anchorY?: number | null;
  anchorOffsetX?: number | null;
  anchorOffsetY?: number | null;
  marks?: MockupReviewMark[];
}): Promise<void> {
  await requestJson(`${projectPath(id)}/comments/${encodeURIComponent(commentId)}`, {
    method: "PATCH", body: JSON.stringify(patch),
  });
}
export async function reactToCloudMockupComment(id: string, commentId: string, emoji: string): Promise<boolean> {
  const json = await requestJson<{ active: boolean }>(`${projectPath(id)}/comments/${encodeURIComponent(commentId)}/reactions`, {
    method: "POST", body: JSON.stringify({ emoji }),
  });
  return json.active;
}
export async function decideCloudMockupReview(id: string, versionId: string, decision: "approved" | "changes_requested" | "reset", note?: string): Promise<{ status: MockupReviewStatus }> {
  return requestJson(`${projectPath(id)}/decision`, {
    method: "POST", body: JSON.stringify({ versionId, decision, note }),
  });
}
export async function getCloudMockupReviewSummary(id: string): Promise<CloudMockupReviewSummary> {
  const json = await requestJson<Record<string, unknown>>(`${projectPath(id)}/review-summary`);
  return {
    versions: ((json.versions || []) as Array<Record<string, unknown>>).map((row) => ({
      versionId: String(row.version_id ?? row.versionId),
      label: String(row.label ?? ""),
      reviewStatus: String(row.review_status ?? row.reviewStatus) as MockupReviewStatus,
      createdAt: String(row.created_at ?? row.createdAt),
      totalComments: Number(row.total_comments ?? row.totalComments ?? 0),
      openComments: Number(row.open_comments ?? row.openComments ?? 0),
    })),
    decisions: ((json.decisions || []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id), versionId: String(row.version_id ?? row.versionId),
      decision: String(row.decision) as CloudMockupDecision["decision"],
      note: (row.note ?? null) as string | null,
      actorDisplayName: String(row.actor_display_name ?? row.actorDisplayName ?? ""),
      createdAt: String(row.created_at ?? row.createdAt),
    })),
    presence: ((json.presence || []) as Array<Record<string, unknown>>).map((row) => ({
      participantKey: String(row.participant_key ?? row.participantKey),
      displayName: String(row.display_name ?? row.displayName),
      cursorX: row.cursor_x == null ? null : Number(row.cursor_x),
      cursorY: row.cursor_y == null ? null : Number(row.cursor_y),
      lastSeenAt: String(row.last_seen_at ?? row.lastSeenAt),
    })),
    accessRole: String(json.accessRole || "viewer") as MockupAccessRole,
  };
}
export async function sendCloudMockupPresence(id: string, versionId: string, cursorX?: number | null, cursorY?: number | null): Promise<void> {
  await requestJson(`${projectPath(id)}/presence`, {
    method: "POST", body: JSON.stringify({ versionId, cursorX, cursorY }),
  });
}
export async function exportCloudMockupComments(id: string, versionId: string): Promise<Record<string, unknown>> {
  return requestJson(`${projectPath(id)}/comments/export?versionId=${encodeURIComponent(versionId)}`);
}
export async function listCloudMockupCollaborators(id: string): Promise<CloudMockupCollaborator[]> {
  const json = await requestJson<{ collaborators?: Record<string, unknown>[] }>(`${projectPath(id)}/collaborators`);
  return (json.collaborators ?? []).map((row) => ({
    id: String(row.id), userId: (row.user_id ?? null) as string | null,
    email: String(row.email), displayName: (row.display_name ?? null) as string | null,
    role: String(row.role) as CloudMockupCollaborator["role"],
    acceptedAt: (row.accepted_at ?? null) as string | null,
    createdAt: String(row.created_at ?? ""),
  }));
}
export async function inviteCloudMockupCollaborator(id: string, email: string, role: CloudMockupCollaborator["role"], displayName?: string): Promise<CloudMockupCollaborator> {
  const json = await requestJson<{ collaborator: Record<string, unknown> }>(`${projectPath(id)}/collaborators`, {
    method: "POST", body: JSON.stringify({ email, role, displayName }),
  });
  const row = json.collaborator;
  return {
    id: String(row.id), email: String(row.email), role: String(row.role) as CloudMockupCollaborator["role"],
    displayName: (row.display_name ?? null) as string | null,
    acceptedAt: (row.accepted_at ?? null) as string | null,
    createdAt: String(row.created_at ?? ""),
  };
}
export async function removeCloudMockupCollaborator(id: string, collaboratorId: string): Promise<void> {
  await requestJson(`${projectPath(id)}/collaborators/${encodeURIComponent(collaboratorId)}`, { method: "DELETE" });
}
export async function listCloudMockupNotifications(): Promise<{ notifications: CloudMockupNotification[]; unreadCount: number }> {
  const json = await requestJson<{ notifications?: Array<Record<string, unknown>>; unreadCount?: number }>("/api/role-room/mockup-notifications");
  return {
    unreadCount: Number(json.unreadCount || 0),
    notifications: (json.notifications ?? []).map((row) => ({
      id: String(row.id), projectId: String(row.project_id ?? ""),
      versionId: (row.version_id ?? null) as string | null, kind: String(row.kind),
      title: String(row.title), body: (row.body ?? null) as string | null,
      data: (row.data ?? {}) as Record<string, unknown>, seenAt: (row.seen_at ?? null) as string | null,
      createdAt: String(row.created_at ?? ""),
    })),
  };
}
export async function markCloudMockupNotificationSeen(id: string): Promise<void> {
  await requestJson(`/api/role-room/mockup-notifications/${encodeURIComponent(id)}/seen`, { method: "POST" });
}
export async function listCloudMockupWebhooks(id: string): Promise<CloudMockupWebhook[]> {
  const json = await requestJson<{ webhooks?: Array<Record<string, unknown>> }>(`${projectPath(id)}/webhooks`);
  return (json.webhooks ?? []).map((row) => ({
    id: String(row.id), url: String(row.url), events: (row.events || []) as string[],
    isActive: Boolean(row.is_active), failureCount: Number(row.failure_count || 0),
    lastDeliveredAt: (row.last_delivered_at ?? null) as string | null,
    lastStatusCode: row.last_status_code == null ? null : Number(row.last_status_code),
    createdAt: String(row.created_at ?? ""),
  }));
}
export async function createCloudMockupWebhook(id: string, url: string, events: string[]): Promise<{ webhook: CloudMockupWebhook; signingSecret: string }> {
  const json = await requestJson<{ webhook: Record<string, unknown>; signingSecret: string }>(`${projectPath(id)}/webhooks`, {
    method: "POST", body: JSON.stringify({ url, events }),
  });
  const row = json.webhook;
  return {
    signingSecret: json.signingSecret,
    webhook: {
      id: String(row.id), url: String(row.url), events: (row.events || []) as string[],
      isActive: true, failureCount: 0, createdAt: String(row.created_at ?? ""),
    },
  };
}
export async function removeCloudMockupWebhook(id: string, webhookId: string): Promise<void> {
  await requestJson(`${projectPath(id)}/webhooks/${encodeURIComponent(webhookId)}`, { method: "DELETE" });
}
export function cloudMockupAttachmentUrl(id: string, attachmentId: string): string {
  return `${mockupCloudBaseUrl()}${projectPath(id)}/attachments/${encodeURIComponent(attachmentId)}`;
}

export function buildMockupAssetForm(file: Blob, fileName: string, mockupProjectId: string): FormData {
  const form = new FormData();
  form.append("file", file, fileName);
  form.append("sourceModule", "mockup-studio");
  // `projectId` i storage-API-et er en FK til casting_projects. Et Mockup
  // Studio-dokument er en polymorf entity og skal derfor ikke bruke FK-feltet.
  form.append("metadata", JSON.stringify({ mockupProjectId }));
  form.append("attachedToEntityType", "mockup-project");
  form.append("attachedToEntityId", mockupProjectId);
  return form;
}
export async function uploadMockupAsset(file: Blob, fileName: string, mockupProjectId: string): Promise<string> {
  const form = buildMockupAssetForm(file, fileName, mockupProjectId);
  const res = await fetch(`${mockupCloudBaseUrl()}/api/role-room/storage/upload`, {
    method: "POST", headers: headers(), body: form,
  });
  if (!res.ok) throw await responseError(res);
  const json = await res.json() as { file?: { id?: string } };
  if (!json.file?.id) throw new Error("Opplastingen mangler fil-id");
  return json.file.id;
}
export async function downloadMockupAsset(fileId: string, mockupProjectId: string): Promise<Blob> {
  const res = await fetch(`${mockupCloudBaseUrl()}${projectPath(mockupProjectId)}/assets/${encodeURIComponent(fileId)}`, { headers: headers() });
  if (!res.ok) throw await responseError(res);
  return await res.blob();
}
