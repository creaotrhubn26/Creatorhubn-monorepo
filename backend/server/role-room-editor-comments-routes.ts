/**
 * Editor Collaboration — kommentarer, tråder, og @mentions inne i
 * agent-editor.
 *
 * Endepunkter:
 *   GET    /api/role-room/editor-comments?projectId=X[&since=ISO]
 *                                                  (full liste / delta-poll)
 *   POST   /api/role-room/editor-comments          (lag kommentar)
 *   PATCH  /api/role-room/editor-comments/:id      (oppdater status/text)
 *   DELETE /api/role-room/editor-comments/:id
 *   GET    /api/role-room/editor-comments/:id/replies
 *   GET    /api/role-room/editor-mentions?since=ISO (min innboks)
 *   POST   /api/role-room/editor-mentions/:id/seen
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { resolveClientPortalSession } from "./role-room-client-portal.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { pool: Pool; activeSessions: Map<string, SessionData>; }

const VALID_ANCHOR_TYPES = [
  // Post Agent editor-anchors:
  "timestamp", "pick", "cut", "lower_third",
  "caption", "broll", "music", "general",
  // Role Room content production-anchors:
  "content_post", "marketing_plan_post", "feed_plan_post",
  "gallery_image", "storyboard_frame",
];
const VALID_STATUSES = ["open", "in_progress", "resolved", "wontfix"];
const VALID_PRIORITIES = ["low", "normal", "high", "urgent"];

function getUserIdFromRequest(
  req: Request,
  activeSessions: Map<string, SessionData>,
): { userId: string; email: string | undefined } | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const session = activeSessions.get(token);
    if (session?.userId) return { userId: session.userId, email: session.email };
  }
  return null;
}

/** Resolve actor — støtter både Bearer-token (Bjarne/team) og
 * client-portal-session-token (klient via magic-link).
 * Klient-token kommer som ?clientToken=… eller X-Client-Portal-Token
 * header. */
async function resolveActor(
  pool: Pool,
  req: Request,
  activeSessions: Map<string, SessionData>,
): Promise<{
  userId: string;
  email: string | undefined;
  displayName: string | undefined;
  isClient: boolean;
  /** Hvis klient: prosjekt-id token tilhører. Tom for team. */
  clientProjectId: string | null;
} | null> {
  const bearer = getUserIdFromRequest(req, activeSessions);
  if (bearer) {
    return {
      userId: bearer.userId,
      email: bearer.email,
      displayName: undefined,
      isClient: false,
      clientProjectId: null,
    };
  }
  // Client-portal-token: query, body eller header
  const clientToken = (
    typeof req.query.clientToken === "string" ? req.query.clientToken
    : typeof (req.body as { clientToken?: unknown })?.clientToken === "string"
      ? (req.body as { clientToken: string }).clientToken
    : req.headers["x-client-portal-token"]
      ? String(req.headers["x-client-portal-token"])
    : ""
  ).trim();
  if (clientToken) {
    const session = await resolveClientPortalSession(pool, clientToken);
    if (session) {
      return {
        userId: `client:${session.id}`,
        email: session.clientEmail ?? undefined,
        displayName: session.clientName ?? undefined,
        isClient: true,
        clientProjectId: session.projectId,
      };
    }
  }
  return null;
}

async function viewerCanAccessProject(
  pool: Pool, projectId: string, viewerId: string,
): Promise<boolean> {
  const { rows } = await pool.query<{ owns: boolean; member: boolean }>(
    `SELECT
       EXISTS(SELECT 1 FROM casting_projects
               WHERE id = $1 AND created_by = $2) AS owns,
       EXISTS(SELECT 1 FROM casting_user_roles
               WHERE project_id = $1 AND user_id = $2
                 AND deactivated_at IS NULL) AS member`,
    [projectId, viewerId],
  );
  return rows[0]?.owns === true || rows[0]?.member === true;
}

/** Parse @mentions fra kommentar-tekst. Returnerer array av
 * brukernavn/IDer som ble tagget. Vi støtter @user-id og
 * @"Navn Navnesen"-syntax. */
function parseMentions(text: string): string[] {
  const mentions: string[] = [];
  // @"Navn med mellomrom"
  const quotedRegex = /@"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = quotedRegex.exec(text)) !== null) {
    mentions.push(match[1].trim());
  }
  // @user-id eller @username (alfanumerisk + bindestrek/punktum)
  const plainRegex = /@([a-zA-Z0-9_\-.]+)/g;
  while ((match = plainRegex.exec(text)) !== null) {
    // Hopper over hvis det er innenfor quoted-block
    const followsQuoted = text.lastIndexOf('@"', match.index) > -1
                          && text.indexOf('"', match.index) > match.index;
    if (!followsQuoted) mentions.push(match[1]);
  }
  // De-dup + filter tomme
  return Array.from(new Set(mentions.filter(m => m.length > 0)));
}

async function persistMentions(
  pool: Pool, commentId: string, projectId: string,
  mentionedIds: string[], byUserId: string,
): Promise<void> {
  if (mentionedIds.length === 0) return;
  const values: string[] = [];
  const params: unknown[] = [];
  for (const m of mentionedIds) {
    if (m === byUserId) continue; // skip self-mention
    const i = params.length / 4 + 1;
    values.push(`($${i}, $${i + 1}, $${i + 2}, $${i + 3})`);
    params.push(commentId, projectId, m, byUserId);
  }
  if (values.length === 0) return;
  await pool.query(
    `INSERT INTO role_room_editor_mentions
       (comment_id, project_id, mentioned_user_id, mentioned_by)
     VALUES ${values.join(", ")}`,
    params,
  );
}

export function registerRoleRoomEditorCommentsRoutes(
  app: Express, deps: Deps,
): void {
  const { pool, activeSessions } = deps;

  // Anchors som klient kan se/skrive (content production-side).
  // 'timestamp' er inkludert slik at klient kan kommentere på et
  // bestemt sekund i preview-videoen — anchor_ref MÅ peke på en
  // marketing_plan_post som tilhører klientens prosjekt (sjekkes i
  // POST-handleren).
  const CLIENT_VISIBLE_ANCHORS = new Set([
    "content_post", "marketing_plan_post", "feed_plan_post",
    "gallery_image", "storyboard_frame",
    "timestamp",
  ]);

  // GET comments — støtter ?since for polling-delta
  app.get("/api/role-room/editor-comments",
    async (req: Request, res: Response) => {
      const actor = await resolveActor(pool, req, activeSessions);
      if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const projectId = String(req.query.projectId ?? "").trim();
      const since = String(req.query.since ?? "").trim();
      if (!projectId) {
        res.status(400).json({ error: "mangler_project_id" }); return;
      }
      try {
        // Klient kan kun se kommentarer på SITT prosjekt
        if (actor.isClient) {
          if (actor.clientProjectId !== projectId) {
            res.status(403).json({ error: "ingen_tilgang" }); return;
          }
        } else {
          if (!await viewerCanAccessProject(pool, projectId, actor.userId)) {
            res.status(403).json({ error: "ingen_tilgang" }); return;
          }
        }
        const sinceClause = since ? "AND updated_at > $2" : "";
        const params = since ? [projectId, since] : [projectId];
        const { rows } = await pool.query(
          `SELECT id, project_id, anchor_type, anchor_ref, timestamp_sec,
                  agent_kind, comment_text, parent_id, status,
                  assigned_to, priority, author_id, author_display_name,
                  resolved_by, resolved_at, created_at, updated_at
             FROM role_room_editor_comments
            WHERE project_id = $1 ${sinceClause}
            ORDER BY parent_id NULLS FIRST, created_at ASC`,
          params,
        );
        // Også reply-count per top-level
        const { rows: countRows } = await pool.query(
          `SELECT parent_id, COUNT(*) AS count
             FROM role_room_editor_comments
            WHERE project_id = $1 AND parent_id IS NOT NULL
            GROUP BY parent_id`,
          [projectId],
        );
        const replyCounts = new Map<string, number>();
        for (const r of countRows) {
          replyCounts.set(r.parent_id, parseInt(r.count, 10));
        }
        // Klient: filtrer til kun content-anchors (skal ikke se Bjarne's
        // interne timestamp/pick/cut-kommentarer)
        const mapped = rows.map(r => ({
          id: r.id,
          projectId: r.project_id,
          anchorType: r.anchor_type,
          anchorRef: r.anchor_ref,
          timestampSec: r.timestamp_sec
            ? parseFloat(r.timestamp_sec) : null,
          agentKind: r.agent_kind,
          commentText: r.comment_text,
          parentId: r.parent_id,
          status: r.status,
          assignedTo: r.assigned_to,
          priority: r.priority,
          authorId: r.author_id,
          authorDisplayName: r.author_display_name,
          resolvedBy: r.resolved_by,
          resolvedAt: r.resolved_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          replyCount: replyCounts.get(r.id) || 0,
        }));
        const filtered = actor.isClient
          ? mapped.filter(c => CLIENT_VISIBLE_ANCHORS.has(c.anchorType))
          : mapped;
        res.json({
          comments: filtered,
          serverTime: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[editor-comments] GET failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // POST create comment
  app.post("/api/role-room/editor-comments",
    async (req: Request, res: Response) => {
      const actor = await resolveActor(pool, req, activeSessions);
      if (!actor) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const body = req.body as {
        projectId?: unknown; anchorType?: unknown;
        anchorRef?: unknown; timestampSec?: unknown;
        agentKind?: unknown; commentText?: unknown;
        parentId?: unknown; priority?: unknown;
        assignedTo?: unknown; authorDisplayName?: unknown;
      };
      const projectId = typeof body?.projectId === "string"
        ? body.projectId.trim() : "";
      const anchorType = typeof body?.anchorType === "string"
        ? body.anchorType : "general";
      const commentText = typeof body?.commentText === "string"
        ? body.commentText.trim().slice(0, 5000) : "";
      if (!projectId || !commentText) {
        res.status(400).json({ error: "mangler_felter" }); return;
      }
      if (!VALID_ANCHOR_TYPES.includes(anchorType)) {
        res.status(400).json({ error: "ugyldig_anchor_type" }); return;
      }
      try {
        if (actor.isClient) {
          if (actor.clientProjectId !== projectId) {
            res.status(403).json({ error: "ingen_tilgang" }); return;
          }
          if (!CLIENT_VISIBLE_ANCHORS.has(anchorType)) {
            res.status(403).json({ error: "klient_kan_ikke_kommentere_paa_denne" }); return;
          }
          // Timestamp-comments fra klient MÅ peke på en marketing_plan_
          // post i klientens prosjekt — ellers kan en klient skrive
          // timestamp-comments på andre prosjekter via vilkårlig
          // anchor_ref.
          if (anchorType === "timestamp") {
            const ref = typeof body?.anchorRef === "string" ? body.anchorRef : "";
            if (!ref) {
              res.status(400).json({ error: "timestamp_krever_anchor_ref" }); return;
            }
            const { rows: ck } = await pool.query<{ projectId: string }>(
              `SELECT mp.project_id AS "projectId"
                 FROM role_room_marketing_plan_posts p
                 JOIN role_room_marketing_plans mp ON mp.id = p.plan_id
                WHERE p.id = $1`,
              [ref],
            );
            if (ck[0]?.projectId !== projectId) {
              res.status(403).json({ error: "timestamp_post_ikke_i_prosjekt" }); return;
            }
          }
        } else {
          if (!await viewerCanAccessProject(pool, projectId, actor.userId)) {
            res.status(403).json({ error: "ingen_tilgang" }); return;
          }
        }
        const priority = typeof body?.priority === "string"
          && VALID_PRIORITIES.includes(body.priority)
          ? body.priority : "normal";
        const displayName = typeof body?.authorDisplayName === "string"
          ? body.authorDisplayName.slice(0, 200)
          : (actor.displayName
              || actor.email
              || actor.userId.slice(0, 200));
        const { rows } = await pool.query(
          `INSERT INTO role_room_editor_comments
             (project_id, anchor_type, anchor_ref, timestamp_sec,
              agent_kind, comment_text, parent_id, priority,
              assigned_to, author_id, author_display_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id, created_at`,
          [
            projectId, anchorType,
            typeof body?.anchorRef === "string"
              ? body.anchorRef.slice(0, 200) : null,
            typeof body?.timestampSec === "number" ? body.timestampSec : null,
            typeof body?.agentKind === "string"
              ? body.agentKind.slice(0, 50) : null,
            commentText,
            typeof body?.parentId === "string" ? body.parentId : null,
            priority,
            typeof body?.assignedTo === "string"
              ? body.assignedTo.slice(0, 200) : null,
            actor.userId, displayName,
          ],
        );
        // Parse @mentions + persistere — kun for ikke-klient (klient
        // kan ikke ping interne team-medlemmer fra utsiden)
        const mentions = actor.isClient ? [] : parseMentions(commentText);
        if (mentions.length > 0) {
          await persistMentions(pool, rows[0].id, projectId,
                                 mentions, actor.userId);
        }
        // Email-notify producer når klient kommenterer på en
        // marketing_plan_post — best-effort, ikke blokkerende.
        if (actor.isClient && anchorType === "marketing_plan_post"
            && typeof body?.anchorRef === "string") {
          const anchorRef = body.anchorRef;
          void (async () => {
            try {
              const mod = await import("./marketing-preview-email-service.js");
              await mod.notifyProducerOfClientComment({
                pool, projectId, postId: anchorRef,
                commentText, clientName: displayName,
              });
            } catch (e) {
              console.warn("[editor-comments] producer-email feilet", e);
            }
          })();
        }
        res.json({
          ok: true,
          id: rows[0].id,
          createdAt: rows[0].created_at,
          mentions,
        });
      } catch (err) {
        console.error("[editor-comments] POST failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // PATCH update comment (status/text/assignee)
  app.patch("/api/role-room/editor-comments/:id",
    async (req: Request, res: Response) => {
      const auth = getUserIdFromRequest(req, activeSessions);
      if (!auth) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const id = req.params.id;
      const body = req.body as Record<string, unknown>;
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }
      try {
        const { rows: existing } = await pool.query(
          `SELECT project_id, author_id FROM role_room_editor_comments WHERE id = $1`,
          [id]);
        if (existing.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, existing[0].project_id, auth.userId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        const updates: string[] = [];
        const values: unknown[] = [];
        let p = 1;
        if (typeof body?.commentText === "string") {
          // Bare forfatter kan editere selve teksten
          if (existing[0].author_id !== auth.userId) {
            res.status(403).json({ error: "kan_ikke_editere_andres_kommentar" }); return;
          }
          updates.push(`comment_text = $${p++}`);
          values.push(body.commentText.slice(0, 5000));
        }
        if (typeof body?.status === "string"
            && VALID_STATUSES.includes(body.status)) {
          updates.push(`status = $${p++}`);
          values.push(body.status);
          if (body.status === "resolved") {
            updates.push(`resolved_by = $${p++}`);
            values.push(auth.userId);
            updates.push(`resolved_at = now()`);
          }
        }
        if (typeof body?.priority === "string"
            && VALID_PRIORITIES.includes(body.priority)) {
          updates.push(`priority = $${p++}`);
          values.push(body.priority);
        }
        if (typeof body?.assignedTo === "string") {
          updates.push(`assigned_to = $${p++}`);
          values.push(body.assignedTo.slice(0, 200));
        }
        if (updates.length === 0) {
          res.status(400).json({ error: "ingen_endringer" }); return;
        }
        updates.push(`updated_at = now()`);
        values.push(id);
        await pool.query(
          `UPDATE role_room_editor_comments SET ${updates.join(", ")} WHERE id = $${p}`,
          values,
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[editor-comments] PATCH failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // DELETE comment (bare forfatter eller project-owner)
  app.delete("/api/role-room/editor-comments/:id",
    async (req: Request, res: Response) => {
      const auth = getUserIdFromRequest(req, activeSessions);
      if (!auth) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const id = req.params.id;
      try {
        const { rows: existing } = await pool.query(
          `SELECT c.project_id, c.author_id, p.created_by
             FROM role_room_editor_comments c
             JOIN casting_projects p ON p.id = c.project_id
            WHERE c.id = $1`,
          [id]);
        if (existing.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        const ex = existing[0];
        const isAuthor = ex.author_id === auth.userId;
        const isOwner = ex.created_by === auth.userId;
        if (!isAuthor && !isOwner) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        await pool.query(`DELETE FROM role_room_editor_comments WHERE id = $1`, [id]);
        res.json({ ok: true });
      } catch (err) {
        console.error("[editor-comments] DELETE failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // GET mentions (min innboks)
  app.get("/api/role-room/editor-mentions",
    async (req: Request, res: Response) => {
      const auth = getUserIdFromRequest(req, activeSessions);
      if (!auth) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const unreadOnly = String(req.query.unreadOnly ?? "") === "true";
      try {
        const where = unreadOnly
          ? "WHERE m.mentioned_user_id = $1 AND m.seen_at IS NULL"
          : "WHERE m.mentioned_user_id = $1";
        const { rows } = await pool.query(
          `SELECT m.id, m.comment_id, m.project_id, m.mentioned_by,
                  m.seen_at, m.created_at,
                  c.comment_text, c.author_display_name, c.status,
                  c.anchor_type, c.timestamp_sec
             FROM role_room_editor_mentions m
             JOIN role_room_editor_comments c ON c.id = m.comment_id
            ${where}
            ORDER BY m.created_at DESC
            LIMIT 50`,
          [auth.userId, ...(unreadOnly ? [] : [])],
        );
        res.json({
          mentions: rows.map(r => ({
            id: r.id,
            commentId: r.comment_id,
            projectId: r.project_id,
            mentionedBy: r.mentioned_by,
            seenAt: r.seen_at,
            createdAt: r.created_at,
            commentText: r.comment_text,
            authorDisplayName: r.author_display_name,
            commentStatus: r.status,
            anchorType: r.anchor_type,
            timestampSec: r.timestamp_sec
              ? parseFloat(r.timestamp_sec) : null,
          })),
          unreadCount: rows.filter(r => r.seen_at === null).length,
        });
      } catch (err) {
        console.error("[mentions] GET failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // POST mark mention as seen
  app.post("/api/role-room/editor-mentions/:id/seen",
    async (req: Request, res: Response) => {
      const auth = getUserIdFromRequest(req, activeSessions);
      if (!auth) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const id = req.params.id;
      try {
        await pool.query(
          `UPDATE role_room_editor_mentions
              SET seen_at = now()
            WHERE id = $1 AND mentioned_user_id = $2
              AND seen_at IS NULL`,
          [id, auth.userId]);
        res.json({ ok: true });
      } catch (err) {
        console.error("[mentions] seen failed:", err);
        res.status(500).json({ error: "intern_feil" });
      }
    });
}
