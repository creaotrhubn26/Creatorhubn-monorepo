import { createHash, randomBytes, randomUUID } from "node:crypto";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import type { Pool } from "pg";
import { loadPersistedAuthSession } from "./auth-session-store.js";
import { broadcastUserEvent } from "./realtime-user-events.js";
import {
  getUserFileDownloadUrl,
  uploadUserFile,
} from "./role-room-user-storage-service.js";
import {
  createMockupWebhookSecret,
  emitMockupWebhook,
  MOCKUP_WEBHOOK_EVENTS,
  validateMockupWebhookUrl,
  type MockupWebhookEvent,
} from "./mockup-review-webhook-service.js";
import { sendTransactionalEmail } from "./transactional-email-service.js";
import {
  applyMockupChangeOperations,
  generateLocalMockupChangeDraft,
  normalizeMockupChangeOperations,
  StaleMockupChangeError,
  submittedProjectMatchesApplied,
  type MockupChangeComment,
  type MockupChangeOperation,
} from "./mockup-change-set-service.js";

type SessionData = { userId: string; role: string; email: string; name: string; loginAt: string; [key: string]: unknown };
interface Deps { pool: Pool; activeSessions: Map<string, SessionData> }
interface Actor { userId: string; email: string; displayName: string }
type AccessRole = "owner" | "editor" | "commenter" | "approver" | "viewer";
interface ProjectAccess {
  id: string;
  created_by: string;
  payload: Record<string, unknown>;
  revision: number;
  status: string;
  workspace_project_id: string | null;
  project_updated_at: number;
  updated_at: Date | string;
  access_role: AccessRole;
}
interface PublicLink {
  token_hash: string;
  share_id: string;
  project_id: string;
  created_by: string;
  version_id: string | null;
  access_mode: "view" | "comment" | "approve";
  require_identity: boolean;
  allow_recordings: boolean;
  allow_version_history: boolean;
  comments_paused_at: Date | string | null;
  expires_at: Date | string | null;
  revoked_at: Date | string | null;
  project_name: string;
  project_payload: Record<string, unknown>;
  project_updated_at: Date | string;
  version_label: string | null;
  version_payload: Record<string, unknown> | null;
  review_status: string | null;
  source_revision: number | null;
}
interface ReviewerSession {
  id: string;
  display_name: string;
  email: string | null;
  share_token_hash: string;
}

const MAX_PROJECT_BYTES = 12_000_000;
const MAX_REVIEW_UPLOAD_BYTES = 25 * 1024 * 1024;
const VALID_STATUS = new Set(["draft", "review", "approved", "ready", "exported", "archived"]);
const VALID_COMMENT_STATUS = new Set(["open", "in_progress", "resolved", "wontfix"]);
const VALID_PRIORITY = new Set(["low", "normal", "high", "urgent"]);
const VALID_ACCESS = new Set(["view", "comment", "approve"]);
const VALID_ROLE = new Set(["editor", "commenter", "approver", "viewer"]);
const VALID_DECISION = new Set(["approved", "changes_requested", "reset"]);
const REVIEW_EVENTS = new Set<string>(MOCKUP_WEBHOOK_EVENTS);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const uploadReviewAttachment = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_REVIEW_UPLOAD_BYTES, files: 1, fields: 4 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "application/pdf", "text/plain",
      "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm",
      "video/mp4", "video/webm", "video/quicktime",
    ]);
    if (allowed.has(file.mimetype)) cb(null, true);
    else cb(new Error("Filtype ikke tillatt"));
  },
});

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function nullableText(value: unknown, max: number): string | null {
  const text = cleanText(value, max);
  return text || null;
}
function normalizeEmail(value: unknown): string {
  const email = cleanText(value, 320).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}
function boundedNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}
type ReviewMark = {
  id: string;
  kind: "freehand" | "arrow" | "rect";
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
};
type PublicReviewElement = {
  ref: string;
  kind: "device" | "image" | "text" | "annotation";
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  path?: Array<{ x: number; y: number }>;
};
function normalizeReviewMarks(value: unknown): ReviewMark[] {
  if (!Array.isArray(value)) return [];
  const marks: ReviewMark[] = [];
  for (const raw of value.slice(0, 24)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    const kind = String(item.kind);
    if (!["freehand", "arrow", "rect"].includes(kind) || !Array.isArray(item.points)) continue;
    const points = item.points.slice(0, 500).flatMap((point) => {
      if (!point || typeof point !== "object" || Array.isArray(point)) return [];
      const typed = point as Record<string, unknown>;
      const x = boundedNumber(typed.x), y = boundedNumber(typed.y);
      return x == null || y == null ? [] : [{ x, y }];
    });
    if (points.length < (kind === "freehand" ? 2 : 2)) continue;
    const requestedColor = cleanText(item.color, 16);
    const color = /^#[0-9a-f]{6}$/i.test(requestedColor) ? requestedColor : "#f97316";
    const widthNumber = Number(item.width);
    marks.push({
      id: cleanText(item.id, 80) || randomUUID(),
      kind: kind as ReviewMark["kind"],
      points,
      color,
      width: Number.isFinite(widthNumber) ? Math.max(1, Math.min(12, widthNumber)) : 3,
    });
  }
  return marks;
}
function sanitizeReviewElements(value: unknown): PublicReviewElement[] {
  if (!Array.isArray(value)) return [];
  const elements: PublicReviewElement[] = [];
  for (const raw of value.slice(0, 1_500)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    const ref = cleanText(item.ref, 200);
    const kind = cleanText(item.kind, 20);
    const label = cleanText(item.label, 160);
    const x = boundedNumber(item.x), y = boundedNumber(item.y);
    const w = boundedNumber(item.w), h = boundedNumber(item.h);
    if (!ref || !["device", "image", "text", "annotation"].includes(kind)
      || x == null || y == null || w == null || h == null || w <= 0 || h <= 0) continue;
    const element: PublicReviewElement = {
      ref,
      kind: kind as PublicReviewElement["kind"],
      label: label || "Element",
      x,
      y,
      w: Math.min(w, 1 - x),
      h: Math.min(h, 1 - y),
    };
    if (element.w <= 0 || element.h <= 0) continue;
    if (Array.isArray(item.path) && item.path.length === 2) {
      const points = item.path.flatMap((point) => {
        if (!point || typeof point !== "object" || Array.isArray(point)) return [];
        const typed = point as Record<string, unknown>;
        const px = boundedNumber(typed.x), py = boundedNumber(typed.y);
        return px == null || py == null ? [] : [{ x: px, y: py }];
      });
      if (points.length === 2) element.path = points;
    }
    elements.push(element);
  }
  return elements;
}
function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = (Array.isArray(forwarded) ? forwarded[0] : forwarded) || req.socket.remoteAddress || "unknown";
  return String(raw).split(",")[0].trim().slice(0, 120);
}
function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] || char);
}
function readProject(value: unknown, routeId: string): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const project = value as Record<string, unknown>;
  return project.id === routeId && typeof project.name === "string" && project.version === 1 ? project : null;
}
function publicAppBase(): string {
  return String(process.env.ROLE_ROOM_PUBLIC_URL || process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://theroleroom.com").replace(/\/+$/, "");
}
function isExpired(link: PublicLink): boolean {
  return Boolean(link.expires_at && new Date(link.expires_at).getTime() <= Date.now());
}
function roleCanEdit(role: AccessRole): boolean {
  return role === "owner" || role === "editor";
}
function roleCanComment(role: AccessRole): boolean {
  return role !== "viewer";
}
function roleCanApprove(role: AccessRole): boolean {
  return role === "owner" || role === "editor" || role === "approver";
}

const attempts = new Map<string, { count: number; resetAt: number }>();
function rateLimited(key: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const item = attempts.get(key);
  if (!item || item.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  item.count += 1;
  return item.count > limit;
}

async function resolveActor(
  pool: Pool,
  activeSessions: Map<string, SessionData>,
  req: Request,
): Promise<Actor | null> {
  const raw = req.headers.authorization;
  if (!raw?.match(/^Bearer\s+/i)) return null;
  const token = raw.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  let session = activeSessions.get(token) ?? null;
  if (!session) {
    session = await loadPersistedAuthSession<SessionData>(pool, token).catch(() => null);
    if (session) activeSessions.set(token, session);
  }
  if (!session?.userId) return null;
  const email = normalizeEmail(session.email);
  return {
    userId: session.userId,
    email,
    displayName: cleanText(session.name, 200) || email || session.userId.slice(0, 200),
  };
}

async function projectAccess(pool: Pool, actor: Actor, projectId: string): Promise<ProjectAccess | null> {
  const result = await pool.query<ProjectAccess>(
    `SELECT p.id, p.created_by, p.payload, COALESCE(ms.revision,1) AS revision,
       p.status, ms.workspace_project_id, p.project_updated_at, p.updated_at,
       CASE
         WHEN p.created_by=$2 THEN 'owner'
         WHEN c.role IS NOT NULL THEN c.role
         WHEN cur.user_id IS NOT NULL THEN
           CASE WHEN lower(COALESCE(cur.role,'')) IN ('owner','admin','producer','editor','creative') THEN 'editor' ELSE 'commenter' END
         ELSE NULL
       END AS access_role
     FROM demo_studio_mockup_projects p
     LEFT JOIN mockup_studio_project_state ms
       ON ms.project_id=p.id AND ms.created_by=p.created_by
     LEFT JOIN LATERAL (
       SELECT role, user_id
       FROM mockup_studio_collaborators
       WHERE project_id=p.id AND created_by=p.created_by AND revoked_at IS NULL
         AND (user_id=$2 OR ($3<>'' AND lower(email)=$3))
       ORDER BY user_id=$2 DESC, created_at ASC LIMIT 1
     ) c ON true
     LEFT JOIN casting_user_roles cur
       ON cur.project_id=ms.workspace_project_id AND cur.user_id=$2 AND cur.deactivated_at IS NULL
     WHERE p.id=$1
       AND (p.created_by=$2 OR c.role IS NOT NULL OR cur.user_id IS NOT NULL)
     ORDER BY (p.created_by=$2) DESC, (c.user_id=$2) DESC NULLS LAST
     LIMIT 1`,
    [projectId, actor.userId, actor.email],
  );
  const access = result.rows[0] ?? null;
  if (access) {
    await pool.query(
      `INSERT INTO mockup_studio_project_state (project_id,created_by)
       VALUES ($1,$2) ON CONFLICT (project_id,created_by) DO NOTHING`,
      [access.id, access.created_by],
    );
  }
  if (access && actor.email) {
    await pool.query(
      `UPDATE mockup_studio_collaborators SET user_id=COALESCE(user_id,$1), accepted_at=COALESCE(accepted_at,now()), updated_at=now()
       WHERE project_id=$2 AND created_by=$3 AND lower(email)=$4 AND revoked_at IS NULL`,
      [actor.userId, access.id, access.created_by, actor.email],
    ).catch(() => undefined);
  }
  return access;
}

async function loadPublicLink(pool: Pool, rawToken: string): Promise<PublicLink | null> {
  if (!rawToken || rawToken.length > 200) return null;
  const result = await pool.query<PublicLink>(
    `SELECT s.token_hash, s.id::text AS share_id, s.project_id, s.created_by,
       s.version_id::text, s.access_mode, s.require_identity, s.allow_recordings,
       s.allow_version_history, s.comments_paused_at, s.expires_at, s.revoked_at,
       p.name AS project_name, p.payload AS project_payload, p.updated_at AS project_updated_at,
       v.label AS version_label, v.payload AS version_payload, v.review_status, v.source_revision
     FROM mockup_studio_share_links s
     JOIN demo_studio_mockup_projects p ON p.id=s.project_id AND p.created_by=s.created_by
     LEFT JOIN mockup_studio_versions v ON v.id=s.version_id
     WHERE s.token_hash=$1 AND s.revoked_at IS NULL
     LIMIT 1`,
    [hashToken(rawToken)],
  );
  return result.rows[0] ?? null;
}

async function reviewerSession(pool: Pool, req: Request, link: PublicLink): Promise<ReviewerSession | null> {
  const token = cleanText(req.headers["x-mockup-reviewer"], 300);
  if (!token) return null;
  const result = await pool.query<ReviewerSession>(
    `UPDATE mockup_studio_review_sessions SET last_seen_at=now()
     WHERE reviewer_token_hash=$1 AND share_token_hash=$2
     RETURNING id::text, display_name, email, share_token_hash`,
    [hashToken(token), link.token_hash],
  );
  return result.rows[0] ?? null;
}

function mapAttachment(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    commentId: String(row.comment_id),
    displayName: row.display_name,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    isRecording: Boolean(row.is_recording),
    createdAt: row.created_at,
  };
}

function mapChangeSet(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    versionId: String(row.version_id),
    sourceCommentIds: Array.isArray(row.source_comment_ids) ? row.source_comment_ids.map(String) : [],
    sourceRevision: Number(row.source_revision),
    title: String(row.title),
    summary: String(row.summary || ""),
    status: String(row.status),
    operations: Array.isArray(row.operations) ? row.operations : [],
    generator: String(row.generator || "local-rules-v1"),
    confidence: Number(row.confidence || 0),
    appliedVersionId: row.applied_version_id ? String(row.applied_version_id) : null,
    reviewedAt: row.reviewed_at || null,
    reviewNote: row.review_note || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listComments(pool: Pool, versionId: string): Promise<Array<Record<string, unknown>>> {
  const [commentsResult, attachmentsResult, reactionsResult] = await Promise.all([
    pool.query(
      `SELECT id::text, project_id, version_id::text, comment_number, parent_id::text,
         author_kind, author_user_id, reviewer_session_id::text, author_display_name,
         body, anchor_kind, anchor_ref, anchor_x, anchor_y, anchor_offset_x, anchor_offset_y,
         marks, status, priority, assigned_to,
         context, resolved_by, resolved_at, edited_at, created_at, updated_at
       FROM mockup_studio_comments WHERE version_id=$1
       ORDER BY comment_number ASC, parent_id NULLS FIRST, created_at ASC`,
      [versionId],
    ),
    pool.query(
      `SELECT a.id::text, a.comment_id::text, a.display_name, a.content_type,
         a.size_bytes, a.is_recording, a.created_at
       FROM mockup_studio_comment_attachments a
       JOIN mockup_studio_comments c ON c.id=a.comment_id
       WHERE c.version_id=$1 ORDER BY a.created_at ASC`,
      [versionId],
    ),
    pool.query(
      `SELECT r.comment_id::text, r.emoji, count(*)::int AS count
       FROM mockup_studio_comment_reactions r
       JOIN mockup_studio_comments c ON c.id=r.comment_id
       WHERE c.version_id=$1 GROUP BY r.comment_id, r.emoji`,
      [versionId],
    ),
  ]);
  const attachments = new Map<string, unknown[]>();
  for (const row of attachmentsResult.rows) {
    const key = String(row.comment_id);
    attachments.set(key, [...(attachments.get(key) || []), mapAttachment(row)]);
  }
  const reactions = new Map<string, Record<string, number>>();
  for (const row of reactionsResult.rows) {
    const key = String(row.comment_id);
    reactions.set(key, { ...(reactions.get(key) || {}), [String(row.emoji)]: Number(row.count) });
  }
  return commentsResult.rows.map((row) => ({
    id: String(row.id),
    projectId: row.project_id,
    versionId: String(row.version_id),
    number: Number(row.comment_number),
    parentId: row.parent_id ? String(row.parent_id) : null,
    authorKind: row.author_kind,
    authorUserId: row.author_user_id,
    reviewerSessionId: row.reviewer_session_id ? String(row.reviewer_session_id) : null,
    authorDisplayName: row.author_display_name,
    body: row.body,
    anchorKind: row.anchor_kind,
    anchorRef: row.anchor_ref,
    anchorX: row.anchor_x == null ? null : Number(row.anchor_x),
    anchorY: row.anchor_y == null ? null : Number(row.anchor_y),
    anchorOffsetX: row.anchor_offset_x == null ? null : Number(row.anchor_offset_x),
    anchorOffsetY: row.anchor_offset_y == null ? null : Number(row.anchor_offset_y),
    marks: Array.isArray(row.marks) ? row.marks : [],
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to,
    context: row.context || {},
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    editedAt: row.edited_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attachments: attachments.get(String(row.id)) || [],
    reactions: reactions.get(String(row.id)) || {},
  }));
}

async function createComment(
  pool: Pool,
  args: {
    projectId: string;
    createdBy: string;
    versionId: string;
    parentId: string | null;
    authorKind: "user" | "reviewer";
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
    marks: ReviewMark[];
    context: Record<string, unknown>;
  },
): Promise<Record<string, unknown>> {
  const inserted = await pool.query(
    `WITH lock_version AS (
       SELECT pg_advisory_xact_lock(hashtext($3::text))
     ), version_ok AS (
       SELECT 1 FROM mockup_studio_versions
       WHERE id=$3 AND project_id=$1 AND created_by=$2
     ), next_number AS (
       SELECT COALESCE(MAX(comment_number),0)+1 AS value
       FROM mockup_studio_comments WHERE version_id=$3
     ), parent_ok AS (
       SELECT CASE WHEN $4::uuid IS NULL THEN true ELSE EXISTS(
         SELECT 1 FROM mockup_studio_comments WHERE id=$4::uuid AND version_id=$3
       ) END AS ok
     )
     INSERT INTO mockup_studio_comments
       (project_id, created_by, version_id, comment_number, parent_id,
        author_kind, author_user_id, reviewer_session_id, author_display_name,
        body, anchor_kind, anchor_ref, anchor_x, anchor_y,
        anchor_offset_x, anchor_offset_y, marks, context)
     SELECT $1,$2,$3,(SELECT value FROM next_number),$4::uuid,
       $5,$6,$7::uuid,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb
     FROM lock_version, version_ok, parent_ok WHERE parent_ok.ok
     RETURNING id::text`,
    [
      args.projectId, args.createdBy, args.versionId, args.parentId,
      args.authorKind, args.authorUserId, args.reviewerSessionId, args.authorDisplayName,
      args.body, args.anchorKind, args.anchorRef, args.anchorX, args.anchorY,
      args.anchorOffsetX, args.anchorOffsetY, JSON.stringify(args.marks),
      JSON.stringify(args.context),
    ],
  );
  const id = inserted.rows[0]?.id;
  if (!id) throw new Error("ugyldig_parent");
  const comments = await listComments(pool, args.versionId);
  return comments.find((comment) => comment.id === id) || { id };
}

async function notifyReviewParticipants(
  pool: Pool,
  project: { id: string; created_by: string },
  versionId: string | null,
  kind: string,
  title: string,
  body: string,
  actorUserId?: string | null,
): Promise<void> {
  const recipients = await pool.query<{ user_id: string }>(
    `SELECT $2::text AS user_id
     UNION
     SELECT user_id FROM mockup_studio_collaborators
     WHERE project_id=$1 AND created_by=$2 AND revoked_at IS NULL AND user_id IS NOT NULL`,
    [project.id, project.created_by],
  );
  for (const recipient of recipients.rows) {
    if (!recipient.user_id || recipient.user_id === actorUserId) continue;
    await pool.query(
      `INSERT INTO mockup_studio_notifications
         (recipient_user_id, project_id, created_by, version_id, kind, title, body)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [recipient.user_id, project.id, project.created_by, versionId, kind, title, body],
    ).catch(() => undefined);
    broadcastUserEvent(recipient.user_id, {
      kind: "mockup.review-updated",
      projectId: project.id,
      versionId,
      reason: kind.includes("comment") ? "comment" : kind.includes("decision") ? "decision" : "review",
      timestamp: new Date().toISOString(),
    });
  }
}

async function notifyCommentMentions(
  pool: Pool,
  args: {
    projectId: string;
    createdBy: string;
    versionId: string;
    commentId: string;
    body: string;
    authorDisplayName: string;
    actorUserId?: string | null;
  },
): Promise<void> {
  if (!args.body.includes("@")) return;
  const candidates = await pool.query<{ user_id: string; display_name: string }>(
    `SELECT user_id, COALESCE(NULLIF(display_name,''),split_part(email,'@',1)) AS display_name
     FROM mockup_studio_collaborators
     WHERE project_id=$1 AND created_by=$2 AND revoked_at IS NULL AND user_id IS NOT NULL`,
    [args.projectId, args.createdBy],
  );
  const body = args.body.toLocaleLowerCase("nb-NO");
  for (const candidate of candidates.rows) {
    const name = cleanText(candidate.display_name, 200);
    if (!candidate.user_id || !name || candidate.user_id === args.actorUserId) continue;
    const fullMention = "@" + name.toLocaleLowerCase("nb-NO");
    const firstMention = "@" + name.split(/\s+/)[0].toLocaleLowerCase("nb-NO");
    if (!body.includes(fullMention) && !body.includes(firstMention)) continue;
    const inserted = await pool.query(
      `INSERT INTO mockup_studio_comment_mentions
         (comment_id,mentioned_user_id,display_name)
       VALUES ($1::uuid,$2,$3)
       ON CONFLICT DO NOTHING RETURNING id`,
      [args.commentId, candidate.user_id, name],
    );
    if (!inserted.rows.length) continue;
    await pool.query(
      `INSERT INTO mockup_studio_notifications
         (recipient_user_id,project_id,created_by,version_id,kind,title,body,data)
       VALUES ($1,$2,$3,$4,'comment.mentioned',$5,$6,$7::jsonb)`,
      [
        candidate.user_id, args.projectId, args.createdBy, args.versionId,
        args.authorDisplayName + " nevnte deg",
        args.body.slice(0, 500),
        JSON.stringify({ commentId: args.commentId }),
      ],
    );
    broadcastUserEvent(candidate.user_id, {
      kind: "mockup.review-updated",
      projectId: args.projectId,
      versionId: args.versionId,
      reason: "comment",
      timestamp: new Date().toISOString(),
    });
  }
}

async function publicDecisionTimeline(pool: Pool, versionId: string): Promise<Array<Record<string, unknown>>> {
  const result = await pool.query(
    `SELECT id::text,version_id::text,decision,note,actor_display_name,created_at
     FROM mockup_studio_review_decisions
     WHERE version_id=$1::uuid
     ORDER BY created_at DESC LIMIT 100`,
    [versionId],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    versionId: String(row.version_id),
    decision: cleanText(row.decision, 40),
    note: nullableText(row.note, 2_000),
    actorDisplayName: cleanText(row.actor_display_name, 200) || "Reviewer",
    createdAt: row.created_at,
  }));
}

async function emailPreviousReviewers(
  pool: Pool,
  args: {
    projectId: string;
    createdBy: string;
    newShareTokenHash: string;
    reviewUrl: string;
    projectName: string;
    actor: Actor;
  },
): Promise<{ attempted: number; sent: number }> {
  const result = await pool.query<{ email: string; display_name: string }>(
    `SELECT DISTINCT ON (lower(rs.email)) lower(rs.email) AS email,rs.display_name
     FROM mockup_studio_review_sessions rs
     JOIN mockup_studio_share_links s ON s.token_hash=rs.share_token_hash
     WHERE s.project_id=$1 AND s.created_by=$2 AND rs.email IS NOT NULL
       AND rs.share_token_hash<>$3
       AND ($4='' OR lower(rs.email)<>$4)
     ORDER BY lower(rs.email),rs.last_seen_at DESC
     LIMIT 50`,
    [args.projectId, args.createdBy, args.newShareTokenHash, args.actor.email],
  );
  const recipients = result.rows.flatMap((row) => {
    const email = normalizeEmail(row.email);
    return email ? [{ email, name: cleanText(row.display_name, 200) || "Reviewer" }] : [];
  });
  const sends = await Promise.all(recipients.map(({ email, name }) => sendTransactionalEmail({
    to: email,
    subject: `Ny gjennomgang: ${args.projectName}`,
    text: `Hei ${name},\n\n${args.actor.displayName} har startet en ny review-runde for ${args.projectName}.\n\nÅpne gjennomgangen: ${args.reviewUrl}`,
    html: `<p>Hei ${escapeHtml(name)},</p><p><strong>${escapeHtml(args.actor.displayName)}</strong> har startet en ny review-runde for <strong>${escapeHtml(args.projectName)}</strong>.</p><p><a href="${escapeHtml(args.reviewUrl)}">Åpne gjennomgangen</a></p>`,
    replyTo: args.actor.email || null,
    kind: "mockup_review_new_round",
    projectId: args.projectId,
    sentByUserId: args.actor.userId,
    pool,
  })));
  return { attempted: recipients.length, sent: sends.filter((item) => item.sent).length };
}

function reviewContext(req: Request): Record<string, unknown> {
  const supplied = req.body?.context && typeof req.body.context === "object" && !Array.isArray(req.body.context)
    ? req.body.context as Record<string, unknown>
    : {};
  return {
    clientFingerprint: hashToken(clientIp(req)).slice(0, 24),
    userAgent: cleanText(req.headers["user-agent"], 400) || null,
    viewportWidth: Number(req.body?.viewportWidth) || null,
    viewportHeight: Number(req.body?.viewportHeight) || null,
    transcript: cleanText(supplied.transcript, 8_000) || null,
    recordingDurationMs: Math.max(0, Math.min(600_000, Number(supplied.recordingDurationMs) || 0)) || null,
  };
}

export function registerRoleRoomMockupStudioRoutes(app: Express, deps: Deps): void {
  const { pool, activeSessions } = deps;

  app.get("/api/role-room/mockup-projects", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    try {
      const { rows } = await pool.query(
        `SELECT DISTINCT ON (p.id, p.created_by)
           p.id, p.name, ms.campaign_id, p.status, p.template_id, p.project_updated_at,
           COALESCE(ms.revision,1) AS revision, p.updated_at, ms.workspace_project_id,
           CASE WHEN p.created_by=$1 THEN 'owner'
             WHEN c.role IS NOT NULL THEN c.role
             ELSE 'commenter' END AS access_role,
           (SELECT count(*)::int FROM mockup_studio_comments mc
             WHERE mc.project_id=p.id AND mc.created_by=p.created_by AND mc.status<>'resolved') AS open_comments
         FROM demo_studio_mockup_projects p
         LEFT JOIN mockup_studio_project_state ms
           ON ms.project_id=p.id AND ms.created_by=p.created_by
         LEFT JOIN mockup_studio_collaborators c
           ON c.project_id=p.id AND c.created_by=p.created_by AND c.revoked_at IS NULL
           AND (c.user_id=$1 OR ($2<>'' AND lower(c.email)=$2))
         LEFT JOIN casting_user_roles cur
           ON cur.project_id=ms.workspace_project_id AND cur.user_id=$1 AND cur.deactivated_at IS NULL
         WHERE p.created_by=$1 OR c.id IS NOT NULL OR cur.user_id IS NOT NULL
         ORDER BY p.id, p.created_by, p.updated_at DESC LIMIT 200`,
        [actor.userId, actor.email],
      );
      res.json({ projects: rows.map((row) => ({
        id: row.id, name: row.name, campaignId: row.campaign_id,
        status: row.status, template: row.template_id ?? "",
        projectUpdatedAt: Number(row.project_updated_at), syncedAt: row.updated_at,
        revision: row.revision, updatedAt: row.updated_at,
        workspaceProjectId: row.workspace_project_id,
        accessRole: row.access_role, openComments: Number(row.open_comments || 0),
      })) });
    } catch (error) {
      console.error("[mockup-projects/list]", error);
      res.status(500).json({ error: "list_feil", detail: "internal_error" });
    }
  });

  app.get("/api/role-room/mockup-projects/:id", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    try {
      const access = await projectAccess(pool, actor, String(req.params.id));
      if (!access) { res.status(404).json({ error: "finnes_ikke" }); return; }
      res.json({
        project: access.payload, revision: access.revision, updatedAt: access.updated_at,
        projectUpdatedAt: Number(access.project_updated_at), accessRole: access.access_role,
      });
    } catch {
      res.status(500).json({ error: "hent_feil", detail: "internal_error" });
    }
  });

  app.put("/api/role-room/mockup-projects/:id", express.json({ limit: "13mb" }), async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const id = String(req.params.id);
    const project = readProject(req.body?.project, id);
    if (!project) { res.status(400).json({ error: "ugyldig_prosjekt" }); return; }
    const raw = JSON.stringify(project);
    if (Buffer.byteLength(raw, "utf8") > MAX_PROJECT_BYTES) { res.status(413).json({ error: "for_stor" }); return; }
    const projectUpdatedAt = Number(project.updatedAt);
    if (!Number.isSafeInteger(projectUpdatedAt) || projectUpdatedAt <= 0) {
      res.status(400).json({ error: "ugyldig_prosjekt" }); return;
    }
    const status = VALID_STATUS.has(String(project.status)) ? String(project.status) : "draft";
    const workspaceProjectId = nullableText(project.workspaceProjectId, 255);
    try {
      const access = await projectAccess(pool, actor, id);
      if (access) {
        if (!roleCanEdit(access.access_role)) {
          res.status(403).json({ error: "ingen_redigeringstilgang" }); return;
        }
        const updated = await pool.query(
          `UPDATE demo_studio_mockup_projects SET
             name=$3, status=$4, template_id=$5, project_updated_at=$6,
             payload=$7::jsonb, updated_at=now()
           WHERE id=$1 AND created_by=$2 AND project_updated_at <= $6
           RETURNING updated_at`,
          [
            id, access.created_by, String(project.name).slice(0, 200),
            status, nullableText(project.template, 200), projectUpdatedAt, raw,
          ],
        );
        if (!updated.rows.length) {
          res.json({ ok: true, updated: false, revision: access.revision, updatedAt: access.updated_at });
          return;
        }
        const state = await pool.query(
          `INSERT INTO mockup_studio_project_state
             (project_id,created_by,campaign_id,workspace_project_id,revision,updated_at)
           VALUES ($1,$2,$3,$4,1,now())
           ON CONFLICT (project_id,created_by) DO UPDATE SET
             campaign_id=EXCLUDED.campaign_id, workspace_project_id=EXCLUDED.workspace_project_id,
             revision=mockup_studio_project_state.revision+1, updated_at=now()
           RETURNING revision,updated_at`,
          [id, access.created_by, nullableText(project.campaignId, 200), workspaceProjectId],
        );
        res.json({ ok: true, updated: true, revision: state.rows[0].revision, updatedAt: updated.rows[0].updated_at });
        return;
      }
      const inserted = await pool.query(
        `INSERT INTO demo_studio_mockup_projects
           (id, created_by, name, status, template_id, project_updated_at, payload, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,now()) RETURNING updated_at`,
        [id, actor.userId, String(project.name).slice(0, 200), status, nullableText(project.template, 200), projectUpdatedAt, raw],
      );
      const state = await pool.query(
        `INSERT INTO mockup_studio_project_state
           (project_id,created_by,campaign_id,workspace_project_id,revision,updated_at)
         VALUES ($1,$2,$3,$4,1,now())
         ON CONFLICT (project_id,created_by) DO UPDATE SET
           campaign_id=EXCLUDED.campaign_id,workspace_project_id=EXCLUDED.workspace_project_id,updated_at=now()
         RETURNING revision`,
        [id, actor.userId, nullableText(project.campaignId, 200), workspaceProjectId],
      );
      res.json({ ok: true, updated: true, revision: state.rows[0].revision, updatedAt: inserted.rows[0].updated_at });
    } catch (error) {
      console.error("[mockup-projects/save]", error);
      res.status(500).json({ error: "lagre_feil", detail: "internal_error" });
    }
  });

  app.delete("/api/role-room/mockup-projects/:id", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access || access.access_role !== "owner") { res.status(403).json({ error: "kun_eier_kan_slette" }); return; }
    await pool.query("DELETE FROM mockup_studio_project_state WHERE project_id=$1 AND created_by=$2", [access.id, access.created_by]);
    await pool.query("DELETE FROM demo_studio_mockup_projects WHERE id=$1 AND created_by=$2", [access.id, access.created_by]);
    res.json({ ok: true });
  });

  app.get("/api/role-room/mockup-projects/:id/versions", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access) { res.status(404).json({ error: "finnes_ikke" }); return; }
    const { rows } = await pool.query(
      `SELECT v.id::text, v.label, v.source_revision, v.review_status, v.note, v.created_at,
         (v.payload->>'reviewPreview') AS preview,
         (SELECT count(*)::int FROM mockup_studio_comments c WHERE c.version_id=v.id) AS comment_count
       FROM mockup_studio_versions v
       WHERE v.project_id=$1 AND v.created_by=$2 ORDER BY v.created_at DESC LIMIT 100`,
      [access.id, access.created_by],
    );
    res.json({ versions: rows.map((row) => ({
      id: row.id, label: row.label, sourceRevision: row.source_revision,
      reviewStatus: row.review_status, note: row.note, createdAt: row.created_at,
      preview: row.preview, commentCount: Number(row.comment_count || 0),
    })) });
  });

  app.get("/api/role-room/mockup-projects/:id/versions/:versionId", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access) { res.status(404).json({ error: "finnes_ikke" }); return; }
    const { rows } = await pool.query(
      `SELECT id::text, label, payload, source_revision, review_status, note, created_at
       FROM mockup_studio_versions WHERE id=$1 AND project_id=$2 AND created_by=$3`,
      [String(req.params.versionId), access.id, access.created_by],
    );
    if (!rows.length) { res.status(404).json({ error: "versjon_finnes_ikke" }); return; }
    res.json({ version: rows[0], comments: await listComments(pool, String(req.params.versionId)) });
  });

  app.post("/api/role-room/mockup-projects/:id/versions", express.json({ limit: "13mb" }), async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const id = String(req.params.id);
    const access = await projectAccess(pool, actor, id);
    if (!access || !roleCanEdit(access.access_role)) { res.status(403).json({ error: "ingen_redigeringstilgang" }); return; }
    const project = readProject(req.body?.project, id);
    if (!project) { res.status(400).json({ error: "ugyldig_prosjekt" }); return; }
    const raw = JSON.stringify(project);
    if (Buffer.byteLength(raw, "utf8") > MAX_PROJECT_BYTES) { res.status(413).json({ error: "for_stor" }); return; }
    const { rows } = await pool.query(
      `INSERT INTO mockup_studio_versions
         (project_id, created_by, label, payload, source_revision, review_status, created_by_user_id, note)
       VALUES ($1,$2,$3,$4::jsonb,$5,'draft',$6,$7)
       RETURNING id::text, created_at`,
      [
        id, access.created_by, cleanText(req.body?.label, 120) || "Versjon",
        raw, access.revision, actor.userId, nullableText(req.body?.note, 1000),
      ],
    );
    void emitMockupWebhook(pool, id, access.created_by, "version.created", { projectId: id, versionId: rows[0].id });
    res.json({ ok: true, id: rows[0].id, createdAt: rows[0].created_at });
  });

  app.get("/api/role-room/mockup-projects/:id/change-sets", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access) { res.status(404).json({ error: "finnes_ikke" }); return; }
    const versionId = cleanText(req.query.versionId, 40);
    if (versionId && !/^\d+$/.test(versionId)) { res.status(400).json({ error: "ugyldig_versjon" }); return; }
    const { rows } = await pool.query(
      `SELECT * FROM mockup_studio_change_sets
       WHERE project_id=$1 AND created_by=$2 AND ($3::bigint IS NULL OR version_id=$3)
       ORDER BY created_at DESC LIMIT 100`,
      [access.id, access.created_by, versionId || null],
    );
    res.json({ changeSets: rows.map(mapChangeSet), accessRole: access.access_role });
  });

  app.post("/api/role-room/mockup-projects/:id/change-sets/generate", express.json({ limit: "200kb" }), async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access || !roleCanEdit(access.access_role)) { res.status(403).json({ error: "ingen_redigeringstilgang" }); return; }
    const versionId = cleanText(req.body?.versionId, 40);
    const commentIds: string[] = Array.isArray(req.body?.commentIds)
      ? Array.from(new Set<string>((req.body.commentIds as unknown[]).map((value) => cleanText(value, 80)))).slice(0, 20)
      : [];
    if (!/^\d+$/.test(versionId) || !commentIds.length || commentIds.some((id) => !UUID_PATTERN.test(id))) {
      res.status(400).json({ error: "ugyldig_grunnlag" }); return;
    }
    try {
      const versionResult = await pool.query(
        `SELECT payload, source_revision FROM mockup_studio_versions
         WHERE id=$1 AND project_id=$2 AND created_by=$3`,
        [versionId, access.id, access.created_by],
      );
      if (!versionResult.rows.length) { res.status(404).json({ error: "versjon_finnes_ikke" }); return; }
      const commentsResult = await pool.query(
        `SELECT id::text, comment_number, body, anchor_kind, anchor_ref, anchor_x, anchor_y
         FROM mockup_studio_comments
         WHERE version_id=$1 AND project_id=$2 AND created_by=$3
           AND id=ANY($4::uuid[]) AND parent_id IS NULL
         ORDER BY comment_number`,
        [versionId, access.id, access.created_by, commentIds],
      );
      if (commentsResult.rows.length !== commentIds.length) {
        res.status(400).json({ error: "kommentarer_tilhører_ikke_versjonen" }); return;
      }
      const comments: MockupChangeComment[] = commentsResult.rows.map((row) => ({
        id: String(row.id), number: Number(row.comment_number), body: String(row.body),
        anchorKind: String(row.anchor_kind), anchorRef: row.anchor_ref ? String(row.anchor_ref) : null,
        anchorX: row.anchor_x == null ? null : Number(row.anchor_x),
        anchorY: row.anchor_y == null ? null : Number(row.anchor_y),
      }));
      const draft = generateLocalMockupChangeDraft(versionResult.rows[0].payload, comments);
      const inserted = await pool.query(
        `INSERT INTO mockup_studio_change_sets
           (project_id,created_by,version_id,source_comment_ids,source_revision,title,summary,
            operations,generator,confidence,created_by_user_id)
         VALUES ($1,$2,$3,$4::uuid[],$5,$6,$7,$8::jsonb,$9,$10,$11)
         RETURNING *`,
        [
          access.id, access.created_by, versionId, commentIds,
          Number(versionResult.rows[0].source_revision || 0), draft.title, draft.summary,
          JSON.stringify(draft.operations), draft.model, draft.confidence, actor.userId,
        ],
      );
      res.status(201).json({ changeSet: mapChangeSet(inserted.rows[0]) });
    } catch (error) {
      if (error instanceof Error && error.message === "ingen_gjennomfoerbare_endringer") {
        res.status(422).json({
          error: "ingen_gjennomfoerbare_endringer",
          detail: "Feedbacken må beskrive en konkret flytting, størrelse, tekst i anførselstegn, farge eller bildeutsnitt.",
        });
        return;
      }
      console.error("[mockup-change-sets/generate]", error);
      res.status(500).json({ error: "generering_feilet", detail: "internal_error" });
    }
  });

  app.patch("/api/role-room/mockup-projects/:id/change-sets/:changeSetId", express.json({ limit: "200kb" }), async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access || !roleCanEdit(access.access_role)) { res.status(403).json({ error: "ingen_redigeringstilgang" }); return; }
    const changeSetId = String(req.params.changeSetId);
    if (!UUID_PATTERN.test(changeSetId)) { res.status(400).json({ error: "ugyldig_change_set" }); return; }
    const current = await pool.query(
      `SELECT cs.*, v.payload
       FROM mockup_studio_change_sets cs
       JOIN mockup_studio_versions v ON v.id=cs.version_id
       WHERE cs.id=$1 AND cs.project_id=$2 AND cs.created_by=$3`,
      [changeSetId, access.id, access.created_by],
    );
    if (!current.rows.length) { res.status(404).json({ error: "change_set_finnes_ikke" }); return; }
    if (current.rows[0].status !== "proposed") { res.status(409).json({ error: "change_set_er_låst" }); return; }
    const operations = req.body?.operations === undefined
      ? current.rows[0].operations as MockupChangeOperation[]
      : normalizeMockupChangeOperations(current.rows[0].payload, req.body.operations);
    if (!operations.length) { res.status(400).json({ error: "ingen_gyldige_endringer" }); return; }
    const title = req.body?.title === undefined ? String(current.rows[0].title) : cleanText(req.body.title, 160);
    if (!title) { res.status(400).json({ error: "tittel_påkrevd" }); return; }
    const summary = req.body?.summary === undefined ? String(current.rows[0].summary || "") : cleanText(req.body.summary, 1_500);
    const updated = await pool.query(
      `UPDATE mockup_studio_change_sets
       SET title=$4,summary=$5,operations=$6::jsonb,updated_at=now()
       WHERE id=$1 AND project_id=$2 AND created_by=$3 AND status='proposed'
       RETURNING *`,
      [changeSetId, access.id, access.created_by, title, summary, JSON.stringify(operations)],
    );
    res.json({ changeSet: mapChangeSet(updated.rows[0]) });
  });

  app.post("/api/role-room/mockup-projects/:id/change-sets/:changeSetId/reject", express.json({ limit: "20kb" }), async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access || !roleCanEdit(access.access_role)) { res.status(403).json({ error: "ingen_redigeringstilgang" }); return; }
    const changeSetId = String(req.params.changeSetId);
    if (!UUID_PATTERN.test(changeSetId)) { res.status(400).json({ error: "ugyldig_change_set" }); return; }
    const updated = await pool.query(
      `UPDATE mockup_studio_change_sets
       SET status='rejected',reviewed_by_user_id=$4,reviewed_at=now(),
           review_note=$5,updated_at=now()
       WHERE id=$1 AND project_id=$2 AND created_by=$3 AND status='proposed'
       RETURNING *`,
      [changeSetId, access.id, access.created_by, actor.userId, nullableText(req.body?.note, 500)],
    );
    if (!updated.rows.length) { res.status(409).json({ error: "change_set_kan_ikke_avvises" }); return; }
    res.json({ changeSet: mapChangeSet(updated.rows[0]) });
  });

  app.post("/api/role-room/mockup-projects/:id/change-sets/:changeSetId/apply", express.json({ limit: "13mb" }), async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const id = String(req.params.id);
    const access = await projectAccess(pool, actor, id);
    if (!access || !roleCanEdit(access.access_role)) { res.status(403).json({ error: "ingen_redigeringstilgang" }); return; }
    const changeSetId = String(req.params.changeSetId);
    const submitted = readProject(req.body?.project, id);
    if (!UUID_PATTERN.test(changeSetId) || !submitted) { res.status(400).json({ error: "ugyldig_forespørsel" }); return; }
    const raw = JSON.stringify(submitted);
    if (Buffer.byteLength(raw, "utf8") > MAX_PROJECT_BYTES) { res.status(413).json({ error: "for_stor" }); return; }
    const submittedUpdatedAt = Number(submitted.updatedAt);
    if (!Number.isSafeInteger(submittedUpdatedAt) || submittedUpdatedAt <= 0) {
      res.status(400).json({ error: "ugyldig_prosjekt" }); return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const changeResult = await client.query(
        `SELECT * FROM mockup_studio_change_sets
         WHERE id=$1 AND project_id=$2 AND created_by=$3 FOR UPDATE`,
        [changeSetId, access.id, access.created_by],
      );
      const change = changeResult.rows[0];
      if (!change) { await client.query("ROLLBACK"); res.status(404).json({ error: "change_set_finnes_ikke" }); return; }
      if (change.status !== "proposed") { await client.query("ROLLBACK"); res.status(409).json({ error: "change_set_er_låst" }); return; }
      const projectResult = await client.query(
        `SELECT payload,project_updated_at FROM demo_studio_mockup_projects
         WHERE id=$1 AND created_by=$2 FOR UPDATE`,
        [access.id, access.created_by],
      );
      const currentProject = projectResult.rows[0]?.payload as Record<string, unknown> | undefined;
      if (!currentProject) { await client.query("ROLLBACK"); res.status(404).json({ error: "finnes_ikke" }); return; }
      const operations = change.operations as MockupChangeOperation[];
      const applied = applyMockupChangeOperations(currentProject, operations);
      if (!submittedProjectMatchesApplied(applied, submitted)) {
        await client.query("ROLLBACK"); res.status(400).json({ error: "prosjektet_matcher_ikke_forslaget" }); return;
      }
      if (submittedUpdatedAt <= Number(projectResult.rows[0].project_updated_at || 0)) {
        await client.query("ROLLBACK"); res.status(409).json({ error: "prosjektet_er_endret" }); return;
      }
      await client.query(
        `UPDATE demo_studio_mockup_projects
         SET name=$3,status=$4,template_id=$5,project_updated_at=$6,payload=$7::jsonb,updated_at=now()
         WHERE id=$1 AND created_by=$2`,
        [
          access.id, access.created_by, String(submitted.name).slice(0, 200),
          VALID_STATUS.has(String(submitted.status)) ? String(submitted.status) : "draft",
          nullableText(submitted.template, 200), submittedUpdatedAt, raw,
        ],
      );
      const stateResult = await client.query(
        `UPDATE mockup_studio_project_state
         SET campaign_id=$3,workspace_project_id=$4,revision=revision+1,updated_at=now()
         WHERE project_id=$1 AND created_by=$2 RETURNING revision,updated_at`,
        [
          access.id, access.created_by, nullableText(submitted.campaignId, 200),
          nullableText(submitted.workspaceProjectId, 255),
        ],
      );
      const revision = Number(stateResult.rows[0]?.revision || access.revision + 1);
      const versionResult = await client.query(
        `INSERT INTO mockup_studio_versions
           (project_id,created_by,label,payload,source_revision,review_status,created_by_user_id,note)
         VALUES ($1,$2,$3,$4::jsonb,$5,'draft',$6,$7)
         RETURNING id::text,label,source_revision,review_status,note,created_at`,
        [
          access.id, access.created_by, `Applied · ${String(change.title).slice(0, 100)}`,
          raw, revision, actor.userId, String(change.summary || "").slice(0, 1_000) || null,
        ],
      );
      await client.query(
        `UPDATE mockup_studio_comments
         SET status='resolved',resolved_by=$3,resolved_at=now(),updated_at=now()
         WHERE version_id=$1 AND id=ANY($2::uuid[]) AND status NOT IN ('resolved','wontfix')`,
        [change.version_id, change.source_comment_ids, actor.userId],
      );
      const appliedChange = await client.query(
        `UPDATE mockup_studio_change_sets
         SET status='applied',reviewed_by_user_id=$4,reviewed_at=now(),
             applied_version_id=$5,updated_at=now()
         WHERE id=$1 AND project_id=$2 AND created_by=$3 RETURNING *`,
        [changeSetId, access.id, access.created_by, actor.userId, versionResult.rows[0].id],
      );
      await client.query("COMMIT");
      void emitMockupWebhook(pool, access.id, access.created_by, "version.created", {
        projectId: access.id, versionId: versionResult.rows[0].id, source: "change-set",
      });
      res.json({
        project: submitted,
        revision,
        updatedAt: stateResult.rows[0]?.updated_at,
        version: {
          id: versionResult.rows[0].id, label: versionResult.rows[0].label,
          sourceRevision: versionResult.rows[0].source_revision,
          reviewStatus: versionResult.rows[0].review_status,
          note: versionResult.rows[0].note, createdAt: versionResult.rows[0].created_at,
        },
        changeSet: mapChangeSet(appliedChange.rows[0]),
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (error instanceof StaleMockupChangeError) {
        res.status(409).json({
          error: "stale_change_set",
          detail: `${error.operation.targetLabel} · ${error.operation.label} er endret siden forslaget ble laget.`,
        });
        return;
      }
      if (error instanceof Error && ["ugyldige_operasjoner", "ugyldig_maal"].includes(error.message)) {
        res.status(400).json({ error: error.message }); return;
      }
      console.error("[mockup-change-sets/apply]", error);
      res.status(500).json({ error: "apply_feilet", detail: "internal_error" });
    } finally {
      client.release();
    }
  });

  app.post("/api/role-room/mockup-projects/:id/share", express.json({ limit: "1mb" }), async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access || !roleCanEdit(access.access_role)) { res.status(403).json({ error: "ingen_delingsrettighet" }); return; }
    const accessMode = VALID_ACCESS.has(String(req.body?.accessMode)) ? String(req.body.accessMode) : "approve";
    const expiresInDays = Math.max(1, Math.min(365, Number(req.body?.expiresInDays) || 30));
    const label = cleanText(req.body?.label, 120) || `Review ${new Date().toLocaleDateString("no-NO")}`;
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const version = await client.query(
        `INSERT INTO mockup_studio_versions
           (project_id, created_by, label, payload, source_revision, review_status, created_by_user_id, note)
         VALUES ($1,$2,$3,$4::jsonb,$5,'in_review',$6,$7)
         RETURNING id::text`,
        [
          access.id, access.created_by, label, JSON.stringify(access.payload),
          access.revision, actor.userId, nullableText(req.body?.note, 1000),
        ],
      );
      const versionId = version.rows[0].id;
      await client.query(
        `UPDATE mockup_studio_versions SET review_status='superseded'
         WHERE project_id=$1 AND created_by=$2 AND id<>$3 AND review_status='in_review'`,
        [access.id, access.created_by, versionId],
      );
      const share = await client.query(
        `INSERT INTO mockup_studio_share_links
           (token_hash, project_id, created_by, version_id, access_mode, require_identity,
            allow_recordings, allow_version_history, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now()+($9::text||' days')::interval)
         RETURNING id::text, expires_at`,
        [
          tokenHash, access.id, access.created_by, versionId, accessMode,
          req.body?.requireIdentity !== false,
          req.body?.allowRecordings !== false,
          Boolean(req.body?.allowVersionHistory),
          String(expiresInDays),
        ],
      );
      await client.query(
        `UPDATE mockup_studio_project_state SET
           active_review_version_id=$3, updated_at=now()
         WHERE project_id=$1 AND created_by=$2`,
        [access.id, access.created_by, versionId],
      );
      await client.query("COMMIT");
      const url = `${publicAppBase()}/mockup-review/${token}`;
      const reviewerNotifications = req.body?.notifyPreviousReviewers === false
        ? { attempted: 0, sent: 0 }
        : await emailPreviousReviewers(pool, {
          projectId: access.id,
          createdBy: access.created_by,
          newShareTokenHash: tokenHash,
          reviewUrl: url,
          projectName: cleanText(access.payload.name, 200) || "Mockup",
          actor,
        }).catch((error) => {
          console.error("[mockup-review/notify-previous]", error instanceof Error ? error.message : String(error));
          return { attempted: 0, sent: 0 };
        });
      await notifyReviewParticipants(pool, access, versionId, "review.created", "Ny gjennomgang", `${access.payload.name || "Mockup"} er klar for gjennomgang.`, actor.userId);
      void emitMockupWebhook(pool, access.id, access.created_by, "review.created", { projectId: access.id, versionId, shareId: share.rows[0].id });
      res.json({
        token, path: `/api/role-room/mockup-shared/${token}`, reviewPath: `/mockup-review/${token}`,
        url, shareId: share.rows[0].id, versionId, expiresAt: share.rows[0].expires_at,
        reviewerNotifications,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[mockup-review/create]", error);
      res.status(500).json({ error: "deling_feil", detail: "internal_error" });
    } finally { client.release(); }
  });

  app.get("/api/role-room/mockup-projects/:id/shares", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access) { res.status(404).json({ error: "finnes_ikke" }); return; }
    const { rows } = await pool.query(
      `SELECT s.id::text, s.version_id::text, s.access_mode, s.require_identity,
         s.allow_recordings, s.allow_version_history, s.comments_paused_at,
         s.expires_at, s.created_at, s.revoked_at, v.label AS version_label
       FROM mockup_studio_share_links s
       LEFT JOIN mockup_studio_versions v ON v.id=s.version_id
       WHERE s.project_id=$1 AND s.created_by=$2
       ORDER BY s.created_at DESC LIMIT 100`,
      [access.id, access.created_by],
    );
    res.json({ shares: rows });
  });

  app.patch("/api/role-room/mockup-projects/:id/shares/:shareId", express.json({ limit: "100kb" }), async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access || !roleCanEdit(access.access_role)) { res.status(403).json({ error: "ingen_delingsrettighet" }); return; }
    const accessMode = VALID_ACCESS.has(String(req.body?.accessMode)) ? String(req.body.accessMode) : null;
    const expiresAt = typeof req.body?.expiresAt === "string" && !Number.isNaN(Date.parse(req.body.expiresAt)) ? req.body.expiresAt : null;
    await pool.query(
      `UPDATE mockup_studio_share_links SET
         access_mode=COALESCE($4,access_mode),
         comments_paused_at=CASE WHEN $5::boolean IS NULL THEN comments_paused_at WHEN $5 THEN now() ELSE NULL END,
         allow_recordings=COALESCE($6,allow_recordings),
         allow_version_history=COALESCE($7,allow_version_history),
         expires_at=COALESCE($8::timestamptz,expires_at), updated_at=now()
       WHERE id=$1::uuid AND project_id=$2 AND created_by=$3 AND revoked_at IS NULL
       RETURNING id`,
      [
        String(req.params.shareId), access.id, access.created_by, accessMode, typeof req.body?.commentsPaused === "boolean" ? req.body.commentsPaused : null,
        typeof req.body?.allowRecordings === "boolean" ? req.body.allowRecordings : null,
        typeof req.body?.allowVersionHistory === "boolean" ? req.body.allowVersionHistory : null,
        expiresAt,
      ],
    );
    res.json({ ok: true });
  });

  app.delete("/api/role-room/mockup-projects/:id/share", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access || !roleCanEdit(access.access_role)) { res.status(403).json({ error: "ingen_delingsrettighet" }); return; }
    await pool.query(
      `UPDATE mockup_studio_share_links SET revoked_at=now(), updated_at=now()
       WHERE project_id=$1 AND created_by=$2 AND revoked_at IS NULL`,
      [access.id, access.created_by],
    );
    res.json({ ok: true });
  });

  app.delete("/api/role-room/mockup-projects/:id/shares/:shareId", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access || !roleCanEdit(access.access_role)) { res.status(403).json({ error: "ingen_delingsrettighet" }); return; }
    await pool.query(
      `UPDATE mockup_studio_share_links SET revoked_at=now(), updated_at=now()
       WHERE id=$1::uuid AND project_id=$2 AND created_by=$3`,
      [String(req.params.shareId), access.id, access.created_by],
    );
    res.json({ ok: true });
  });

  app.get("/api/role-room/mockup-projects/:id/comments", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access) { res.status(404).json({ error: "finnes_ikke" }); return; }
    const versionId = cleanText(req.query.versionId, 40);
    if (!versionId) { res.status(400).json({ error: "mangler_version_id" }); return; }
    const belongs = await pool.query("SELECT 1 FROM mockup_studio_versions WHERE id=$1 AND project_id=$2 AND created_by=$3", [versionId, access.id, access.created_by]);
    if (!belongs.rows.length) { res.status(404).json({ error: "versjon_finnes_ikke" }); return; }
    res.json({ comments: await listComments(pool, versionId), accessRole: access.access_role });
  });

  app.post("/api/role-room/mockup-projects/:id/comments", express.json({ limit: "100kb" }), async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access || !roleCanComment(access.access_role)) { res.status(403).json({ error: "ingen_kommentartilgang" }); return; }
    const versionId = cleanText(req.body?.versionId, 40);
    const body = cleanText(req.body?.body, 5000);
    if (!versionId || !body) { res.status(400).json({ error: "mangler_felter" }); return; }
    const anchorKind = ["general", "canvas", "element"].includes(String(req.body?.anchorKind)) ? req.body.anchorKind : "general";
    const anchorX = anchorKind === "general" ? null : boundedNumber(req.body?.anchorX);
    const anchorY = anchorKind === "general" ? null : boundedNumber(req.body?.anchorY);
    const anchorOffsetX = anchorKind === "element" ? boundedNumber(req.body?.anchorOffsetX) : null;
    const anchorOffsetY = anchorKind === "element" ? boundedNumber(req.body?.anchorOffsetY) : null;
    if (anchorKind !== "general" && (anchorX == null || anchorY == null)) {
      res.status(400).json({ error: "ugyldig_anker" }); return;
    }
    if (anchorKind === "element" && (!nullableText(req.body?.anchorRef, 200) || anchorOffsetX == null || anchorOffsetY == null)) {
      res.status(400).json({ error: "ugyldig_elementanker" }); return;
    }
    try {
      const comment = await createComment(pool, {
        projectId: access.id, createdBy: access.created_by, versionId,
        parentId: nullableText(req.body?.parentId, 40),
        authorKind: "user", authorUserId: actor.userId, reviewerSessionId: null,
        authorDisplayName: actor.displayName, body,
        anchorKind, anchorRef: nullableText(req.body?.anchorRef, 200),
        anchorX, anchorY, anchorOffsetX, anchorOffsetY,
        marks: normalizeReviewMarks(req.body?.marks), context: reviewContext(req),
      });
      await notifyCommentMentions(pool, {
        projectId: access.id, createdBy: access.created_by, versionId,
        commentId: String(comment.id), body, authorDisplayName: actor.displayName,
        actorUserId: actor.userId,
      });
      await notifyReviewParticipants(pool, access, versionId, "comment.created", "Ny mockup-kommentar", body.slice(0, 180), actor.userId);
      void emitMockupWebhook(pool, access.id, access.created_by, "comment.created", { projectId: access.id, versionId, commentId: comment.id });
      res.status(201).json({ comment });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "kommentar_feilet" });
    }
  });

  app.patch("/api/role-room/mockup-projects/:id/comments/:commentId", express.json({ limit: "100kb" }), async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access || !roleCanComment(access.access_role)) { res.status(403).json({ error: "ingen_kommentartilgang" }); return; }
    const existing = await pool.query<{ author_user_id: string | null; version_id: string }>(
      `SELECT author_user_id, version_id::text FROM mockup_studio_comments
       WHERE id=$1::uuid AND project_id=$2 AND created_by=$3`,
      [String(req.params.commentId), access.id, access.created_by],
    );
    if (!existing.rows.length) { res.status(404).json({ error: "kommentar_finnes_ikke" }); return; }
    const updates: string[] = [];
    const values: unknown[] = [];
    if (typeof req.body?.body === "string") {
      if (existing.rows[0].author_user_id !== actor.userId) { res.status(403).json({ error: "kan_ikke_redigere_andres_tekst" }); return; }
      values.push(cleanText(req.body.body, 5000)); updates.push(`body=$${values.length}`); updates.push("edited_at=now()");
    }
    if (VALID_COMMENT_STATUS.has(String(req.body?.status))) {
      values.push(String(req.body.status)); updates.push(`status=$${values.length}`);
      if (req.body.status === "resolved") {
        values.push(actor.userId); updates.push(`resolved_by=$${values.length}`); updates.push("resolved_at=now()");
      } else { updates.push("resolved_by=NULL"); updates.push("resolved_at=NULL"); }
    }
    if (VALID_PRIORITY.has(String(req.body?.priority))) {
      values.push(String(req.body.priority)); updates.push(`priority=$${values.length}`);
    }
    if (typeof req.body?.assignedTo === "string" || req.body?.assignedTo === null) {
      values.push(nullableText(req.body.assignedTo, 200)); updates.push(`assigned_to=$${values.length}`);
    }
    const wantsAnchorUpdate = ["anchorKind", "anchorRef", "anchorX", "anchorY", "anchorOffsetX", "anchorOffsetY"]
      .some((key) => Object.prototype.hasOwnProperty.call(req.body || {}, key));
    if (wantsAnchorUpdate) {
      if (existing.rows[0].author_user_id !== actor.userId && !roleCanEdit(access.access_role)) {
        res.status(403).json({ error: "kan_ikke_flytte_andres_pin" }); return;
      }
      const anchorKind = ["general", "canvas", "element"].includes(String(req.body?.anchorKind))
        ? String(req.body.anchorKind) : "";
      const anchorX = anchorKind === "general" ? null : boundedNumber(req.body?.anchorX);
      const anchorY = anchorKind === "general" ? null : boundedNumber(req.body?.anchorY);
      const anchorRef = anchorKind === "element" ? nullableText(req.body?.anchorRef, 200) : null;
      const anchorOffsetX = anchorKind === "element" ? boundedNumber(req.body?.anchorOffsetX) : null;
      const anchorOffsetY = anchorKind === "element" ? boundedNumber(req.body?.anchorOffsetY) : null;
      if (!anchorKind || (anchorKind !== "general" && (anchorX == null || anchorY == null))
        || (anchorKind === "element" && (!anchorRef || anchorOffsetX == null || anchorOffsetY == null))) {
        res.status(400).json({ error: "ugyldig_anker" }); return;
      }
      for (const [column, value] of [
        ["anchor_kind", anchorKind], ["anchor_ref", anchorRef], ["anchor_x", anchorX],
        ["anchor_y", anchorY], ["anchor_offset_x", anchorOffsetX], ["anchor_offset_y", anchorOffsetY],
      ] as Array<[string, unknown]>) {
        values.push(value); updates.push(`${column}=$${values.length}`);
      }
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "marks")) {
      if (existing.rows[0].author_user_id !== actor.userId && !roleCanEdit(access.access_role)) {
        res.status(403).json({ error: "kan_ikke_endre_andres_markering" }); return;
      }
      values.push(JSON.stringify(normalizeReviewMarks(req.body?.marks)));
      updates.push(`marks=$${values.length}::jsonb`);
    }
    if (!updates.length) { res.status(400).json({ error: "ingen_endringer" }); return; }
    values.push(String(req.params.commentId), access.id, access.created_by);
    await pool.query(
      `UPDATE mockup_studio_comments SET ${updates.join(",")}, updated_at=now()
       WHERE id=$${values.length - 2}::uuid AND project_id=$${values.length - 1} AND created_by=$${values.length}`,
      values,
    );
    if (req.body?.status === "resolved") {
      await notifyReviewParticipants(pool, access, existing.rows[0].version_id, "comment.resolved", "Kommentar løst", access.payload.name as string || "Mockup", actor.userId);
      void emitMockupWebhook(pool, access.id, access.created_by, "comment.resolved", { projectId: access.id, versionId: existing.rows[0].version_id, commentId: req.params.commentId });
    }
    res.json({ ok: true });
  });

  app.post("/api/role-room/mockup-projects/:id/comments/:commentId/reactions", express.json({ limit: "20kb" }), async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access || !roleCanComment(access.access_role)) { res.status(403).json({ error: "ingen_kommentartilgang" }); return; }
    const emoji = cleanText(req.body?.emoji, 32);
    if (!emoji) { res.status(400).json({ error: "mangler_emoji" }); return; }
    const removed = await pool.query(
      `DELETE FROM mockup_studio_comment_reactions r USING mockup_studio_comments c
       WHERE r.comment_id=c.id AND c.id=$1::uuid AND c.project_id=$2 AND c.created_by=$3
         AND r.actor_key=$4 AND r.emoji=$5 RETURNING r.comment_id`,
      [String(req.params.commentId), access.id, access.created_by, `user:${actor.userId}`, emoji],
    );
    if (!removed.rows.length) {
      await pool.query(
        `INSERT INTO mockup_studio_comment_reactions (comment_id,actor_key,emoji)
         SELECT id,$4,$5 FROM mockup_studio_comments WHERE id=$1::uuid AND project_id=$2 AND created_by=$3
         ON CONFLICT DO NOTHING`,
        [String(req.params.commentId), access.id, access.created_by, `user:${actor.userId}`, emoji],
      );
    }
    res.json({ ok: true, active: !removed.rows.length });
  });

  app.post("/api/role-room/mockup-projects/:id/decision", express.json({ limit: "100kb" }), async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access || !roleCanApprove(access.access_role)) { res.status(403).json({ error: "ingen_godkjenningsrettighet" }); return; }
    const versionId = cleanText(req.body?.versionId, 40);
    const decision = String(req.body?.decision);
    if (!versionId || !VALID_DECISION.has(decision)) { res.status(400).json({ error: "ugyldig_beslutning" }); return; }
    const status = decision === "approved" ? "approved" : decision === "reset" ? "in_review" : "changes_requested";
    const result = await pool.query(
      `WITH version_update AS (
         UPDATE mockup_studio_versions SET review_status=$4
         WHERE id=$1 AND project_id=$2 AND created_by=$3 RETURNING id
       )
       INSERT INTO mockup_studio_review_decisions
         (project_id,created_by,version_id,decision,note,actor_kind,actor_user_id,actor_display_name,context)
       SELECT $2,$3,$1,$5,$6,'user',$7,$8,$9::jsonb FROM version_update
       RETURNING id::text, created_at`,
      [versionId, access.id, access.created_by, status, decision, nullableText(req.body?.note, 2000), actor.userId, actor.displayName, JSON.stringify(reviewContext(req))],
    );
    if (!result.rows.length) { res.status(404).json({ error: "versjon_finnes_ikke" }); return; }
    const decisionTitle = decision === "approved" ? "Mockup godkjent" : decision === "reset" ? "Godkjenning tilbakestilt" : "Endringer ønsket";
    await notifyReviewParticipants(pool, access, versionId, "decision.created", decisionTitle, nullableText(req.body?.note, 500) || access.payload.name as string || "Mockup", actor.userId);
    if (decision !== "reset") {
      const event = decision === "approved" ? "review.approved" : "review.changes_requested";
      void emitMockupWebhook(pool, access.id, access.created_by, event, { projectId: access.id, versionId, decisionId: result.rows[0].id });
    }
    res.json({ ok: true, status, decisionId: result.rows[0].id });
  });

  app.get("/api/role-room/mockup-projects/:id/review-summary", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access) { res.status(404).json({ error: "finnes_ikke" }); return; }
    const [summary, decisions, presence] = await Promise.all([
      pool.query(
        `SELECT v.id::text AS version_id, v.label, v.review_status, v.created_at,
           count(c.id)::int AS total_comments,
           count(c.id) FILTER (WHERE c.status NOT IN ('resolved','wontfix'))::int AS open_comments
         FROM mockup_studio_versions v
         LEFT JOIN mockup_studio_comments c ON c.version_id=v.id
         WHERE v.project_id=$1 AND v.created_by=$2
         GROUP BY v.id ORDER BY v.created_at DESC LIMIT 100`,
        [access.id, access.created_by],
      ),
      pool.query(
        `SELECT id::text, version_id::text, decision, note, actor_display_name, created_at
         FROM mockup_studio_review_decisions WHERE project_id=$1 AND created_by=$2
         ORDER BY created_at DESC LIMIT 100`,
        [access.id, access.created_by],
      ),
      pool.query(
        `SELECT participant_key, display_name, cursor_x, cursor_y, last_seen_at
         FROM mockup_studio_presence WHERE project_id=$1 AND created_by=$2
           AND last_seen_at>now()-interval '20 seconds' ORDER BY display_name`,
        [access.id, access.created_by],
      ),
    ]);
    res.json({ versions: summary.rows, decisions: decisions.rows, presence: presence.rows, accessRole: access.access_role });
  });

  app.get("/api/role-room/mockup-projects/:id/comments/export", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access) { res.status(404).json({ error: "finnes_ikke" }); return; }
    const versionId = cleanText(req.query.versionId, 40);
    const comments = await listComments(pool, versionId);
    res.json({
      format: "figma-comment-import-v1",
      projectId: access.id,
      versionId,
      comments: comments.filter((comment) => !comment.parentId).map((comment) => ({
        message: `#${comment.number} ${comment.body}`,
        nodeId: comment.anchorKind === "element" ? comment.anchorRef : null,
        position: comment.anchorX == null ? null : { x: comment.anchorX, y: comment.anchorY },
        status: comment.status,
        replies: comments.filter((reply) => reply.parentId === comment.id).map((reply) => reply.body),
      })),
    });
  });

  app.get("/api/role-room/mockup-projects/:id/collaborators", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access) { res.status(404).json({ error: "finnes_ikke" }); return; }
    const result = await pool.query(
      `SELECT id::text, user_id, email, display_name, role, accepted_at, created_at
       FROM mockup_studio_collaborators
       WHERE project_id=$1 AND created_by=$2 AND revoked_at IS NULL ORDER BY created_at`,
      [access.id, access.created_by],
    );
    res.json({ collaborators: result.rows });
  });

  app.post("/api/role-room/mockup-projects/:id/collaborators", express.json({ limit: "50kb" }), async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access || access.access_role !== "owner") { res.status(403).json({ error: "kun_eier_kan_invitere" }); return; }
    const email = normalizeEmail(req.body?.email);
    const role = VALID_ROLE.has(String(req.body?.role)) ? String(req.body.role) : "commenter";
    if (!email) { res.status(400).json({ error: "ugyldig_epost" }); return; }
    const result = await pool.query(
      `INSERT INTO mockup_studio_collaborators
         (project_id,created_by,email,display_name,role,invited_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (project_id,created_by,(lower(email))) WHERE revoked_at IS NULL
       DO UPDATE SET role=EXCLUDED.role, display_name=EXCLUDED.display_name, updated_at=now()
       RETURNING id::text,email,display_name,role,accepted_at,created_at`,
      [access.id, access.created_by, email, nullableText(req.body?.displayName, 200), role, actor.userId],
    );
    res.status(201).json({ collaborator: result.rows[0], postAgentUrl: `${publicAppBase()}/link` });
  });

  app.delete("/api/role-room/mockup-projects/:id/collaborators/:collaboratorId", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access || access.access_role !== "owner") { res.status(403).json({ error: "kun_eier_kan_fjerne" }); return; }
    await pool.query(
      `UPDATE mockup_studio_collaborators SET revoked_at=now(),updated_at=now()
       WHERE id=$1::uuid AND project_id=$2 AND created_by=$3`,
      [String(req.params.collaboratorId), access.id, access.created_by],
    );
    res.json({ ok: true });
  });

  app.get("/api/role-room/mockup-notifications", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const result = await pool.query(
      `SELECT id::text,project_id,version_id::text,kind,title,body,data,seen_at,created_at
       FROM mockup_studio_notifications WHERE recipient_user_id=$1
       ORDER BY created_at DESC LIMIT 100`,
      [actor.userId],
    );
    res.json({ notifications: result.rows, unreadCount: result.rows.filter((row) => !row.seen_at).length });
  });

  app.post("/api/role-room/mockup-notifications/:id/seen", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    await pool.query(
      `UPDATE mockup_studio_notifications SET seen_at=COALESCE(seen_at,now())
       WHERE id=$1::uuid AND recipient_user_id=$2`,
      [String(req.params.id), actor.userId],
    );
    res.json({ ok: true });
  });

  app.post("/api/role-room/mockup-projects/:id/presence", express.json({ limit: "20kb" }), async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access) { res.status(404).json({ error: "finnes_ikke" }); return; }
    const versionId = cleanText(req.body?.versionId, 40);
    await pool.query(
      `INSERT INTO mockup_studio_presence
         (project_id,created_by,version_id,participant_key,display_name,cursor_x,cursor_y,last_seen_at)
       SELECT $1,$2,id,$4,$5,$6,$7,now() FROM mockup_studio_versions
       WHERE id=$3 AND project_id=$1 AND created_by=$2
       ON CONFLICT (version_id,participant_key) DO UPDATE SET
         display_name=EXCLUDED.display_name,cursor_x=EXCLUDED.cursor_x,
         cursor_y=EXCLUDED.cursor_y,last_seen_at=now()`,
      [access.id, access.created_by, versionId, `user:${actor.userId}`, actor.displayName, boundedNumber(req.body?.cursorX), boundedNumber(req.body?.cursorY)],
    );
    res.json({ ok: true });
  });

  app.get("/api/role-room/mockup-projects/:id/webhooks", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access || access.access_role !== "owner") { res.status(403).json({ error: "kun_eier" }); return; }
    const result = await pool.query(
      `SELECT id::text,url,events,is_active,failure_count,last_delivered_at,last_status_code,created_at
       FROM mockup_studio_webhook_subscriptions
       WHERE project_id=$1 AND created_by=$2 ORDER BY created_at`,
      [access.id, access.created_by],
    );
    res.json({ webhooks: result.rows });
  });

  app.post("/api/role-room/mockup-projects/:id/webhooks", express.json({ limit: "50kb" }), async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access || access.access_role !== "owner") { res.status(403).json({ error: "kun_eier" }); return; }
    let url: string;
    try { url = await validateMockupWebhookUrl(cleanText(req.body?.url, 2000)); }
    catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "ugyldig_url" }); return; }
    const events = Array.isArray(req.body?.events)
      ? Array.from(new Set(req.body.events.map(String).filter((event: string) => REVIEW_EVENTS.has(event))))
      : [...MOCKUP_WEBHOOK_EVENTS];
    if (!events.length) { res.status(400).json({ error: "mangler_events" }); return; }
    const secret = createMockupWebhookSecret();
    const result = await pool.query(
      `INSERT INTO mockup_studio_webhook_subscriptions
         (project_id,created_by,url,signing_secret,events)
       VALUES ($1,$2,$3,$4,$5::text[]) RETURNING id::text,url,events,created_at`,
      [access.id, access.created_by, url, secret, events],
    );
    res.status(201).json({ webhook: result.rows[0], signingSecret: secret });
  });

  app.delete("/api/role-room/mockup-projects/:id/webhooks/:webhookId", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access || access.access_role !== "owner") { res.status(403).json({ error: "kun_eier" }); return; }
    await pool.query(
      `UPDATE mockup_studio_webhook_subscriptions SET is_active=false,updated_at=now()
       WHERE id=$1::uuid AND project_id=$2 AND created_by=$3`,
      [String(req.params.webhookId), access.id, access.created_by],
    );
    res.json({ ok: true });
  });

  app.get("/api/role-room/mockup-projects/:id/attachments/:attachmentId", async (req: Request, res: Response) => {
    const actor = await resolveActor(pool, activeSessions, req);
    if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const access = await projectAccess(pool, actor, String(req.params.id));
    if (!access) { res.status(404).json({ error: "finnes_ikke" }); return; }
    const result = await pool.query<{ file_id: string }>(
      `SELECT a.file_id::text FROM mockup_studio_comment_attachments a
       JOIN mockup_studio_comments c ON c.id=a.comment_id
       WHERE a.id=$1::uuid AND c.project_id=$2 AND c.created_by=$3`,
      [String(req.params.attachmentId), access.id, access.created_by],
    );
    if (!result.rows.length) { res.status(404).json({ error: "vedlegg_finnes_ikke" }); return; }
    const download = await getUserFileDownloadUrl(pool, { userId: access.created_by, fileId: result.rows[0].file_id, expiresInSeconds: 300 });
    if (!download.ok) { res.status(404).json({ error: "reason" in download ? download.reason : "download_failed" }); return; }
    res.redirect(302, download.url);
  });

  app.get("/api/role-room/mockup-shared/:token", async (req: Request, res: Response) => {
    try {
      const link = await loadPublicLink(pool, String(req.params.token));
      if (!link) { res.status(404).json({ error: "finnes_ikke" }); return; }
      if (isExpired(link)) { res.status(410).json({ error: "utlopt" }); return; }
      res.setHeader("Cache-Control", "private, no-store");
      const project = link.version_payload || link.project_payload;
      const versionId = link.version_id;
      if (!String(req.headers.accept || "").includes("text/html")) {
        const versionHistory = link.allow_version_history
          ? await pool.query(
            `SELECT id::text,label,review_status,source_revision,created_at,
               (payload->>'reviewPreview') AS preview
             FROM mockup_studio_versions
             WHERE project_id=$1 AND created_by=$2 ORDER BY created_at DESC LIMIT 50`,
            [link.project_id, link.created_by],
          )
          : { rows: [] as Array<Record<string, unknown>> };
        const [comments, decisions] = versionId
          ? await Promise.all([listComments(pool, versionId), publicDecisionTimeline(pool, versionId)])
          : [[], []];
        res.json({
          project: {
            id: link.project_id,
            name: link.project_name || project.name,
            variantLabel: project.variantLabel || null,
            preview: typeof project.reviewPreview === "string" ? project.reviewPreview : null,
            canvas: project.canvas && typeof project.canvas === "object"
              ? { width: (project.canvas as Record<string, unknown>).w, height: (project.canvas as Record<string, unknown>).h }
              : null,
            reviewElements: sanitizeReviewElements(project.reviewElements),
          },
          version: { id: versionId, label: link.version_label, reviewStatus: link.review_status, sourceRevision: link.source_revision },
          share: {
            id: link.share_id, accessMode: link.access_mode, requireIdentity: link.require_identity,
            allowRecordings: link.allow_recordings, allowVersionHistory: link.allow_version_history,
            commentsPaused: Boolean(link.comments_paused_at), expiresAt: link.expires_at,
          },
          comments,
          decisions,
          versions: versionHistory.rows.map((row) => ({
            id: String(row.id), label: row.label, reviewStatus: row.review_status,
            sourceRevision: row.source_revision, createdAt: row.created_at, preview: row.preview,
          })),
          updatedAt: link.project_updated_at,
        });
        return;
      }
      const previewCandidate = typeof project.reviewPreview === "string" ? project.reviewPreview : "";
      const preview = previewCandidate.length <= 4_000_000
        && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(previewCandidate)
        ? previewCandidate : "";
      const name = escapeHtml(link.project_name || project.name || "Mockup");
      const reviewUrl = `${publicAppBase()}/mockup-review/${encodeURIComponent(String(req.params.token))}`;
      res.setHeader("Content-Security-Policy", "default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
      res.type("html").send(`<!doctype html><html lang="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gjennomgang – ${name}</title><style>body{margin:0;background:#0b0d13;color:#eef1f8;font:15px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:980px;margin:0 auto;padding:32px 20px}h1{font-size:24px}.preview{display:block;width:100%;height:auto;border-radius:14px;background:#12151f}.empty{padding:80px 20px;text-align:center;background:#12151f;border-radius:14px;color:#94a3b8}a{display:inline-block;margin-top:18px;border-radius:9px;background:#22d3ee;color:#04121a;font-weight:750;padding:11px 18px;text-decoration:none}</style></head><body><main class="wrap"><h1>${name}</h1>${preview ? `<img class="preview" src="${preview}" alt="Forhåndsvisning av ${name}">` : '<div class="empty">Forhåndsvisning mangler.</div>'}<a href="${escapeHtml(reviewUrl)}">Åpne interaktiv gjennomgang</a></main></body></html>`);
    } catch (error) {
      console.error("[mockup-shared/get]", error);
      res.status(500).json({ error: "deling_feil", detail: "internal_error" });
    }
  });

  app.post("/api/role-room/mockup-shared/:token/session", express.json({ limit: "50kb" }), async (req: Request, res: Response) => {
    if (rateLimited(`session:${clientIp(req)}`, 20, 10 * 60_000)) { res.status(429).json({ error: "for_mange_forsok" }); return; }
    const link = await loadPublicLink(pool, String(req.params.token));
    if (!link || isExpired(link)) { res.status(404).json({ error: "finnes_ikke" }); return; }
    const displayName = cleanText(req.body?.displayName, 200) || (link.require_identity ? "" : "Gjest");
    const email = normalizeEmail(req.body?.email) || null;
    if (!displayName) { res.status(400).json({ error: "mangler_navn" }); return; }
    const reviewerToken = randomBytes(32).toString("base64url");
    const result = await pool.query(
      `INSERT INTO mockup_studio_review_sessions
         (share_token_hash,reviewer_token_hash,display_name,email)
       VALUES ($1,$2,$3,$4) RETURNING id::text,display_name,email`,
      [link.token_hash, hashToken(reviewerToken), displayName, email],
    );
    res.status(201).json({ reviewerToken, reviewer: result.rows[0] });
  });

  app.post("/api/role-room/mockup-shared/:token/comments", express.json({ limit: "100kb" }), async (req: Request, res: Response) => {
    if (rateLimited(`comment:${clientIp(req)}`, 45, 10 * 60_000)) { res.status(429).json({ error: "for_mange_kommentarer" }); return; }
    const link = await loadPublicLink(pool, String(req.params.token));
    if (!link || isExpired(link) || !link.version_id) { res.status(404).json({ error: "finnes_ikke" }); return; }
    if (link.access_mode === "view" || link.comments_paused_at) { res.status(403).json({ error: link.comments_paused_at ? "kommentarer_pauset" : "kun_visning" }); return; }
    const session = await reviewerSession(pool, req, link);
    if (!session) { res.status(401).json({ error: "reviewer_session_kreves" }); return; }
    const body = cleanText(req.body?.body, 5000);
    if (!body) { res.status(400).json({ error: "mangler_tekst" }); return; }
    const anchorKind = ["general", "canvas", "element"].includes(String(req.body?.anchorKind)) ? req.body.anchorKind : "general";
    const anchorX = anchorKind === "general" ? null : boundedNumber(req.body?.anchorX);
    const anchorY = anchorKind === "general" ? null : boundedNumber(req.body?.anchorY);
    const anchorOffsetX = anchorKind === "element" ? boundedNumber(req.body?.anchorOffsetX) : null;
    const anchorOffsetY = anchorKind === "element" ? boundedNumber(req.body?.anchorOffsetY) : null;
    if (anchorKind !== "general" && (anchorX == null || anchorY == null)) { res.status(400).json({ error: "ugyldig_anker" }); return; }
    if (anchorKind === "element" && (!nullableText(req.body?.anchorRef, 200) || anchorOffsetX == null || anchorOffsetY == null)) {
      res.status(400).json({ error: "ugyldig_elementanker" }); return;
    }
    try {
      const comment = await createComment(pool, {
        projectId: link.project_id, createdBy: link.created_by, versionId: link.version_id,
        parentId: nullableText(req.body?.parentId, 40),
        authorKind: "reviewer", authorUserId: null, reviewerSessionId: session.id,
        authorDisplayName: session.display_name, body,
        anchorKind, anchorRef: nullableText(req.body?.anchorRef, 200),
        anchorX, anchorY, anchorOffsetX, anchorOffsetY,
        marks: normalizeReviewMarks(req.body?.marks), context: reviewContext(req),
      });
      await notifyCommentMentions(pool, {
        projectId: link.project_id, createdBy: link.created_by, versionId: link.version_id,
        commentId: String(comment.id), body, authorDisplayName: session.display_name,
      });
      await notifyReviewParticipants(pool, { id: link.project_id, created_by: link.created_by }, link.version_id, "comment.created", `${session.display_name} kommenterte`, body.slice(0, 180));
      void emitMockupWebhook(pool, link.project_id, link.created_by, "comment.created", { projectId: link.project_id, versionId: link.version_id, commentId: comment.id });
      res.status(201).json({ comment });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "kommentar_feilet" });
    }
  });

  app.patch("/api/role-room/mockup-shared/:token/comments/:commentId", express.json({ limit: "50kb" }), async (req: Request, res: Response) => {
    const link = await loadPublicLink(pool, String(req.params.token));
    if (!link || isExpired(link) || !link.version_id || link.comments_paused_at) { res.status(403).json({ error: "ikke_tillatt" }); return; }
    const session = await reviewerSession(pool, req, link);
    if (!session) { res.status(401).json({ error: "reviewer_session_kreves" }); return; }
    const status = VALID_COMMENT_STATUS.has(String(req.body?.status)) ? String(req.body.status) : null;
    const body = typeof req.body?.body === "string" ? cleanText(req.body.body, 5000) : null;
    const wantsAnchorUpdate = ["anchorKind", "anchorRef", "anchorX", "anchorY", "anchorOffsetX", "anchorOffsetY"]
      .some((key) => Object.prototype.hasOwnProperty.call(req.body || {}, key));
    const wantsMarksUpdate = Object.prototype.hasOwnProperty.call(req.body || {}, "marks");
    if (!status && !body && !wantsAnchorUpdate && !wantsMarksUpdate) { res.status(400).json({ error: "ingen_endringer" }); return; }
    const updates: string[] = [];
    const values: unknown[] = [];
    if (body) { values.push(body); updates.push(`body=$${values.length}`); updates.push("edited_at=now()"); }
    if (status) {
      values.push(status); updates.push(`status=$${values.length}`);
      if (status === "resolved") { values.push(`reviewer:${session.id}`); updates.push(`resolved_by=$${values.length}`); updates.push("resolved_at=now()"); }
      else { updates.push("resolved_by=NULL"); updates.push("resolved_at=NULL"); }
    }
    if (wantsAnchorUpdate) {
      const anchorKind = ["general", "canvas", "element"].includes(String(req.body?.anchorKind))
        ? String(req.body.anchorKind) : "";
      const anchorX = anchorKind === "general" ? null : boundedNumber(req.body?.anchorX);
      const anchorY = anchorKind === "general" ? null : boundedNumber(req.body?.anchorY);
      const anchorRef = anchorKind === "element" ? nullableText(req.body?.anchorRef, 200) : null;
      const anchorOffsetX = anchorKind === "element" ? boundedNumber(req.body?.anchorOffsetX) : null;
      const anchorOffsetY = anchorKind === "element" ? boundedNumber(req.body?.anchorOffsetY) : null;
      if (!anchorKind || (anchorKind !== "general" && (anchorX == null || anchorY == null))
        || (anchorKind === "element" && (!anchorRef || anchorOffsetX == null || anchorOffsetY == null))) {
        res.status(400).json({ error: "ugyldig_anker" }); return;
      }
      for (const [column, value] of [
        ["anchor_kind", anchorKind], ["anchor_ref", anchorRef], ["anchor_x", anchorX],
        ["anchor_y", anchorY], ["anchor_offset_x", anchorOffsetX], ["anchor_offset_y", anchorOffsetY],
      ] as Array<[string, unknown]>) {
        values.push(value); updates.push(`${column}=$${values.length}`);
      }
    }
    if (wantsMarksUpdate) {
      values.push(JSON.stringify(normalizeReviewMarks(req.body?.marks)));
      updates.push(`marks=$${values.length}::jsonb`);
    }
    values.push(String(req.params.commentId), link.version_id, session.id);
    const result = await pool.query(
      `UPDATE mockup_studio_comments SET ${updates.join(",")},updated_at=now()
       WHERE id=$${values.length - 2}::uuid AND version_id=$${values.length - 1}
         AND reviewer_session_id=$${values.length}::uuid RETURNING id`,
      values,
    );
    if (!result.rows.length) { res.status(403).json({ error: "kan_kun_endre_egne_kommentarer" }); return; }
    res.json({ ok: true });
  });

  app.post("/api/role-room/mockup-shared/:token/comments/:commentId/reactions", express.json({ limit: "20kb" }), async (req: Request, res: Response) => {
    const link = await loadPublicLink(pool, String(req.params.token));
    if (!link || isExpired(link) || !link.version_id || link.access_mode === "view") { res.status(403).json({ error: "ikke_tillatt" }); return; }
    const session = await reviewerSession(pool, req, link);
    if (!session) { res.status(401).json({ error: "reviewer_session_kreves" }); return; }
    const emoji = cleanText(req.body?.emoji, 32);
    if (!emoji) { res.status(400).json({ error: "mangler_emoji" }); return; }
    const actorKey = `reviewer:${session.id}`;
    const removed = await pool.query(
      `DELETE FROM mockup_studio_comment_reactions r USING mockup_studio_comments c
       WHERE r.comment_id=c.id AND c.id=$1::uuid AND c.version_id=$2 AND r.actor_key=$3 AND r.emoji=$4
       RETURNING r.comment_id`,
      [String(req.params.commentId), link.version_id, actorKey, emoji],
    );
    if (!removed.rows.length) {
      await pool.query(
        `INSERT INTO mockup_studio_comment_reactions(comment_id,actor_key,emoji)
         SELECT id,$3,$4 FROM mockup_studio_comments WHERE id=$1::uuid AND version_id=$2
         ON CONFLICT DO NOTHING`,
        [String(req.params.commentId), link.version_id, actorKey, emoji],
      );
    }
    res.json({ ok: true, active: !removed.rows.length });
  });

  const publicUploadAuth = async (req: Request, res: Response, next: NextFunction) => {
    if (rateLimited(`upload:${clientIp(req)}`, 15, 10 * 60_000)) { res.status(429).json({ error: "for_mange_opplastinger" }); return; }
    const link = await loadPublicLink(pool, String(req.params.token));
    if (!link || isExpired(link) || !link.version_id || link.access_mode === "view" || link.comments_paused_at) {
      res.status(403).json({ error: "opplasting_ikke_tillatt" }); return;
    }
    const session = await reviewerSession(pool, req, link);
    if (!session) { res.status(401).json({ error: "reviewer_session_kreves" }); return; }
    (req as Request & { mockupLink?: PublicLink; mockupReviewer?: ReviewerSession }).mockupLink = link;
    (req as Request & { mockupLink?: PublicLink; mockupReviewer?: ReviewerSession }).mockupReviewer = session;
    next();
  };

  app.post(
    "/api/role-room/mockup-shared/:token/comments/:commentId/attachments",
    publicUploadAuth,
    uploadReviewAttachment.single("file"),
    async (req: Request, res: Response) => {
      const typed = req as Request & { mockupLink?: PublicLink; mockupReviewer?: ReviewerSession; file?: Express.Multer.File };
      const link = typed.mockupLink!;
      const session = typed.mockupReviewer!;
      const file = typed.file;
      if (!file?.buffer?.length) { res.status(400).json({ error: "mangler_fil" }); return; }
      const comment = await pool.query(
        `SELECT id FROM mockup_studio_comments
         WHERE id=$1::uuid AND version_id=$2 AND reviewer_session_id=$3::uuid`,
        [String(req.params.commentId), link.version_id, session.id],
      );
      if (!comment.rows.length) { res.status(403).json({ error: "kan_kun_legge_ved_paa_egen_kommentar" }); return; }
      const isRecording = String(req.body?.isRecording) === "true";
      if (isRecording && !link.allow_recordings) { res.status(403).json({ error: "opptak_ikke_tillatt" }); return; }
      const uploaded = await uploadUserFile(pool, {
        userId: link.created_by,
        displayName: file.originalname || (isRecording ? "review-opptak.webm" : "vedlegg"),
        body: file.buffer,
        contentType: file.mimetype,
        sourceModule: "mockup-review",
        metadata: { reviewerSessionId: session.id, isRecording },
        context: {
          attachedToEntityType: "mockup-review-comment",
          attachedToEntityId: String(req.params.commentId),
          attachmentNote: `Review-vedlegg fra ${session.display_name}`,
        },
      });
      if (!uploaded.ok) {
        const reason = "reason" in uploaded ? uploaded.reason : "upload_failed";
        const detail = "detail" in uploaded ? uploaded.detail : undefined;
        res.status(reason === "quota_exceeded" ? 507 : 502).json({ error: reason, detail });
        return;
      }
      const inserted = await pool.query(
        `INSERT INTO mockup_studio_comment_attachments
           (comment_id,file_id,display_name,content_type,size_bytes,is_recording)
         VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6)
         RETURNING id::text,comment_id::text,display_name,content_type,size_bytes,is_recording,created_at`,
        [String(req.params.commentId), uploaded.file.id, uploaded.file.displayName, uploaded.file.contentType || file.mimetype, uploaded.file.sizeBytes, isRecording],
      );
      res.status(201).json({ attachment: mapAttachment(inserted.rows[0]) });
    },
  );

  app.get("/api/role-room/mockup-shared/:token/attachments/:attachmentId", async (req: Request, res: Response) => {
    const link = await loadPublicLink(pool, String(req.params.token));
    if (!link || isExpired(link) || !link.version_id) { res.status(404).json({ error: "finnes_ikke" }); return; }
    const attachment = await pool.query<{ file_id: string }>(
      `SELECT a.file_id::text FROM mockup_studio_comment_attachments a
       JOIN mockup_studio_comments c ON c.id=a.comment_id
       WHERE a.id=$1::uuid AND c.version_id=$2`,
      [String(req.params.attachmentId), link.version_id],
    );
    if (!attachment.rows.length) { res.status(404).json({ error: "vedlegg_finnes_ikke" }); return; }
    const download = await getUserFileDownloadUrl(pool, { userId: link.created_by, fileId: attachment.rows[0].file_id, expiresInSeconds: 300 });
    if (!download.ok) { res.status(404).json({ error: "reason" in download ? download.reason : "download_failed" }); return; }
    res.redirect(302, download.url);
  });

  app.post("/api/role-room/mockup-shared/:token/decision", express.json({ limit: "100kb" }), async (req: Request, res: Response) => {
    if (rateLimited(`decision:${clientIp(req)}`, 15, 10 * 60_000)) { res.status(429).json({ error: "for_mange_forsok" }); return; }
    const link = await loadPublicLink(pool, String(req.params.token));
    if (!link || isExpired(link) || !link.version_id) { res.status(404).json({ error: "finnes_ikke" }); return; }
    if (link.access_mode !== "approve") { res.status(403).json({ error: "godkjenning_ikke_tillatt" }); return; }
    const session = await reviewerSession(pool, req, link);
    if (!session) { res.status(401).json({ error: "reviewer_session_kreves" }); return; }
    const decision = String(req.body?.decision);
    if (!["approved", "changes_requested"].includes(decision)) { res.status(400).json({ error: "ugyldig_beslutning" }); return; }
    const status = decision === "approved" ? "approved" : "changes_requested";
    const result = await pool.query(
      `WITH updated AS (
         UPDATE mockup_studio_versions SET review_status=$4
         WHERE id=$1 AND project_id=$2 AND created_by=$3 RETURNING id
       )
       INSERT INTO mockup_studio_review_decisions
         (project_id,created_by,version_id,decision,note,actor_kind,reviewer_session_id,actor_display_name,context)
       SELECT $2,$3,$1,$4,$5,'reviewer',$6::uuid,$7,$8::jsonb FROM updated
       RETURNING id::text`,
      [link.version_id, link.project_id, link.created_by, status, nullableText(req.body?.note, 2000), session.id, session.display_name, JSON.stringify(reviewContext(req))],
    );
    if (!result.rows.length) { res.status(404).json({ error: "versjon_finnes_ikke" }); return; }
    await notifyReviewParticipants(pool, { id: link.project_id, created_by: link.created_by }, link.version_id, "decision.created", decision === "approved" ? "Mockup godkjent" : "Endringer ønsket", nullableText(req.body?.note, 500) || session.display_name);
    const event = decision === "approved" ? "review.approved" : "review.changes_requested";
    void emitMockupWebhook(pool, link.project_id, link.created_by, event, { projectId: link.project_id, versionId: link.version_id, decisionId: result.rows[0].id });
    res.json({ ok: true, status, decisionId: result.rows[0].id });
  });

  app.post("/api/role-room/mockup-shared/:token/approve", express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
    try {
      const { rows } = await pool.query(
        `UPDATE demo_studio_mockup_projects p SET
           status='ready',
           payload=jsonb_set(p.payload,'{status}',to_jsonb('ready'::text),true),
           updated_at=now()
         FROM mockup_studio_share_links s
         WHERE s.project_id=p.id AND s.created_by=p.created_by
           AND s.token_hash=$1 AND s.revoked_at IS NULL
           AND (s.expires_at IS NULL OR s.expires_at>now())
         RETURNING p.name`,
        [hashToken(String(req.params.token))],
      );
      if (!rows.length) { res.status(404).json({ error: "finnes_ikke" }); return; }
      if (!String(req.headers.accept || "").includes("text/html")) { res.json({ ok: true, status: "approved" }); return; }
      const name = escapeHtml(rows[0].name);
      res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
      res.type("html").send(`<!doctype html><html lang="no"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Godkjent</title><body style="margin:0;background:#0b0d13;color:#eef1f8;font:16px -apple-system,sans-serif;display:grid;place-items:center;min-height:100vh"><main style="text-align:center;padding:30px"><div style="font-size:42px;color:#34d399">✓</div><h1>Godkjent</h1><p>${name} er markert som godkjent.</p></main></body></html>`);
    } catch {
      res.status(500).json({ error: "godkjenning_feil", detail: "internal_error" });
    }
  });

  app.post("/api/role-room/mockup-shared/:token/presence", express.json({ limit: "20kb" }), async (req: Request, res: Response) => {
    const link = await loadPublicLink(pool, String(req.params.token));
    if (!link || isExpired(link) || !link.version_id) { res.status(404).json({ error: "finnes_ikke" }); return; }
    const session = await reviewerSession(pool, req, link);
    if (!session) { res.status(401).json({ error: "reviewer_session_kreves" }); return; }
    await pool.query(
      `INSERT INTO mockup_studio_presence
         (project_id,created_by,version_id,participant_key,display_name,cursor_x,cursor_y,last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now())
       ON CONFLICT (version_id,participant_key) DO UPDATE SET
         display_name=EXCLUDED.display_name,cursor_x=EXCLUDED.cursor_x,
         cursor_y=EXCLUDED.cursor_y,last_seen_at=now()`,
      [link.project_id, link.created_by, link.version_id, `reviewer:${session.id}`, session.display_name, boundedNumber(req.body?.cursorX), boundedNumber(req.body?.cursorY)],
    );
    res.json({ ok: true });
  });

  app.get("/api/role-room/mockup-shared/:token/presence", async (req: Request, res: Response) => {
    const link = await loadPublicLink(pool, String(req.params.token));
    if (!link || isExpired(link) || !link.version_id) { res.status(404).json({ error: "finnes_ikke" }); return; }
    const result = await pool.query(
      `SELECT participant_key,display_name,cursor_x,cursor_y,last_seen_at
       FROM mockup_studio_presence WHERE version_id=$1
         AND last_seen_at>now()-interval '20 seconds' ORDER BY display_name`,
      [link.version_id],
    );
    res.json({ presence: result.rows });
  });

  app.get("/api/role-room/mockup-shared/:token/versions/:versionId", async (req: Request, res: Response) => {
    const link = await loadPublicLink(pool, String(req.params.token));
    if (!link || isExpired(link) || !link.allow_version_history) { res.status(403).json({ error: "historikk_ikke_tillatt" }); return; }
    const result = await pool.query(
      `SELECT id::text,label,review_status,created_at,
         (payload->>'reviewPreview') AS preview,
         (payload->'reviewElements') AS review_elements
       FROM mockup_studio_versions WHERE id=$1 AND project_id=$2 AND created_by=$3`,
      [String(req.params.versionId), link.project_id, link.created_by],
    );
    if (!result.rows.length) { res.status(404).json({ error: "versjon_finnes_ikke" }); return; }
    const row = result.rows[0];
    const versionId = String(req.params.versionId);
    const [comments, decisions] = await Promise.all([
      listComments(pool, versionId),
      publicDecisionTimeline(pool, versionId),
    ]);
    res.json({
      version: {
        id: String(row.id), label: row.label, reviewStatus: row.review_status,
        createdAt: row.created_at, preview: row.preview,
      },
      project: { preview: row.preview, reviewElements: sanitizeReviewElements(row.review_elements) },
      comments,
      decisions,
    });
  });
}
