/**
 * Activity-feed for markedsplanen — én kronologisk strøm av alt
 * som har skjedd: plan-versjoner, klient-kommentarer, klient-reviews,
 * preview-uploads, inline-edits.
 *
 * Brukt av AuditTimeline-komponenten i MarketingPlanWorkspace til å
 * vise hva som har skjedd på planen siden start.
 *
 * Endepunkt:
 *   GET /api/role-room/marketing-plan/:projectId/activity-feed
 *
 * Respons: { ok: true, events: ActivityEvent[] } sortert nyest først.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getUserIdFromRequest(
  req: Request, activeSessions: Map<string, SessionData>,
): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const session = activeSessions.get(token);
    if (session?.userId) return session.userId;
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

export type ActivityEventKind =
  | 'plan_version'         // Ny plan-versjon lagret
  | 'client_comment'        // Klient kommenterte på post (anchorType='marketing_plan_post' eller 'timestamp')
  | 'team_comment'          // Bjarne/team kommenterte
  | 'client_review_approved'
  | 'client_review_changes_requested'
  | 'preview_uploaded'      // Bjarne lastet opp preview-video
  | 'post_edited';          // Inline-edit fra dashboard

export interface ActivityEvent {
  kind: ActivityEventKind;
  at: string; // ISO
  actor: { kind: 'user' | 'agent' | 'client'; name: string | null };
  title: string;
  detail?: string | null;
  /** Reference til posten (hvis hendelsen er post-spesifikk). */
  postId?: string | null;
  postHook?: string | null;
}

export function registerRoleRoomMarketingActivityFeedRoutes(
  app: Express, deps: Deps,
): void {
  const { pool, activeSessions } = deps;

  app.get(
    "/api/role-room/marketing-plan/:projectId/activity-feed",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }
      const projectId = req.params.projectId;
      if (!await viewerCanAccessProject(pool, projectId, viewerId)) {
        res.status(403).json({ error: "ingen_tilgang" }); return;
      }

      const events: ActivityEvent[] = [];

      // 1. Plan-versjoner
      try {
        const { rows } = await pool.query<{
          versionNumber: number; label: string | null;
          generatedByKind: string; createdAt: string;
          generatedByName: string | null;
        }>(
          `SELECT v.version_number AS "versionNumber", v.label,
                  v.generated_by_kind AS "generatedByKind",
                  v.created_at AS "createdAt",
                  u.email AS "generatedByName"
             FROM role_room_marketing_plans_versions v
             LEFT JOIN users u ON u.id = v.generated_by_user_id
            WHERE v.project_id = $1
            ORDER BY v.created_at DESC LIMIT 100`,
          [projectId],
        );
        for (const r of rows) {
          events.push({
            kind: 'plan_version',
            at: r.createdAt,
            actor: {
              kind: r.generatedByKind === 'agent' ? 'agent' : 'user',
              name: r.generatedByName?.split('@')[0] ?? null,
            },
            title: `Plan-versjon v${r.versionNumber} lagret${r.label ? ` — ${r.label}` : ''}`,
          });
        }
      } catch (e) { console.warn("[activity-feed] plan-versions feilet", e); }

      // 2. Klient + team-kommentarer på marketing-plan-posts
      try {
        const { rows } = await pool.query<{
          anchorType: string; anchorRef: string | null;
          commentText: string;
          authorDisplayName: string | null;
          authorId: string | null;
          createdAt: string;
          postHook: string | null;
        }>(
          `SELECT c.anchor_type AS "anchorType",
                  c.anchor_ref AS "anchorRef",
                  LEFT(c.comment_text, 200) AS "commentText",
                  c.author_display_name AS "authorDisplayName",
                  c.author_id::text AS "authorId",
                  c.created_at AS "createdAt",
                  p.hook AS "postHook"
             FROM role_room_editor_comments c
             LEFT JOIN role_room_marketing_plan_posts p
               ON p.id::text = c.anchor_ref
            WHERE c.project_id = $1
              AND c.anchor_type IN ('marketing_plan_post', 'timestamp')
            ORDER BY c.created_at DESC LIMIT 100`,
          [projectId],
        );
        for (const r of rows) {
          // Klient-kommentarer har author_id som starter med 'client:'
          // (fra resolveActor i editor-comments-routes). Ingen prefix
          // hvis det er en team-bruker.
          const isClient = !r.authorId
            || (typeof r.authorId === 'string' && r.authorId.startsWith('client:'));
          events.push({
            kind: isClient ? 'client_comment' : 'team_comment',
            at: r.createdAt,
            actor: {
              kind: isClient ? 'client' : 'user',
              name: r.authorDisplayName,
            },
            title: isClient ? 'Klient kommenterte' : 'Team kommenterte',
            detail: r.commentText,
            postId: r.anchorRef,
            postHook: r.postHook,
          });
        }
      } catch (e) { console.warn("[activity-feed] comments feilet", e); }

      // 3. Klient-reviews (approved + changes_requested)
      try {
        const { rows } = await pool.query<{
          postId: string; postHook: string;
          reviewStatus: string; reviewAt: string;
          note: string | null;
          clientName: string | null;
        }>(
          `SELECT p.id::text AS "postId", p.hook AS "postHook",
                  p.client_review_status AS "reviewStatus",
                  p.client_review_at AS "reviewAt",
                  p.client_review_note AS "note",
                  s.client_name AS "clientName"
             FROM role_room_marketing_plan_posts p
             JOIN role_room_marketing_plans mp ON mp.id = p.plan_id
             LEFT JOIN client_portal_sessions s ON s.id = p.client_review_session_id
            WHERE mp.project_id = $1
              AND p.client_review_status <> 'pending'
              AND p.client_review_at IS NOT NULL
            ORDER BY p.client_review_at DESC LIMIT 100`,
          [projectId],
        );
        for (const r of rows) {
          events.push({
            kind: r.reviewStatus === 'approved'
              ? 'client_review_approved' : 'client_review_changes_requested',
            at: r.reviewAt,
            actor: { kind: 'client', name: r.clientName },
            title: r.reviewStatus === 'approved'
              ? 'Klient godkjente post'
              : 'Klient ba om endring',
            detail: r.note,
            postId: r.postId,
            postHook: r.postHook,
          });
        }
      } catch (e) { console.warn("[activity-feed] reviews feilet", e); }

      // 4. Preview-uploads
      try {
        const { rows } = await pool.query<{
          postId: string; postHook: string;
          uploadedAt: string;
        }>(
          `SELECT p.id::text AS "postId", p.hook AS "postHook",
                  p.preview_video_uploaded_at AS "uploadedAt"
             FROM role_room_marketing_plan_posts p
             JOIN role_room_marketing_plans mp ON mp.id = p.plan_id
            WHERE mp.project_id = $1
              AND p.preview_video_uploaded_at IS NOT NULL
            ORDER BY p.preview_video_uploaded_at DESC LIMIT 100`,
          [projectId],
        );
        for (const r of rows) {
          events.push({
            kind: 'preview_uploaded',
            at: r.uploadedAt,
            actor: { kind: 'user', name: null },
            title: 'Preview-video lastet opp',
            postId: r.postId,
            postHook: r.postHook,
          });
        }
      } catch (e) { console.warn("[activity-feed] previews feilet", e); }

      // 5. Inline-edits (last_edited_at)
      try {
        const { rows } = await pool.query<{
          postId: string; postHook: string;
          lastEditedAt: string; lastEditedByName: string | null;
        }>(
          `SELECT p.id::text AS "postId", p.hook AS "postHook",
                  p.last_edited_at AS "lastEditedAt",
                  u.email AS "lastEditedByName"
             FROM role_room_marketing_plan_posts p
             JOIN role_room_marketing_plans mp ON mp.id = p.plan_id
             LEFT JOIN users u ON u.id = p.last_edited_by_user_id
            WHERE mp.project_id = $1
              AND p.last_edited_at IS NOT NULL
            ORDER BY p.last_edited_at DESC LIMIT 100`,
          [projectId],
        );
        for (const r of rows) {
          events.push({
            kind: 'post_edited',
            at: r.lastEditedAt,
            actor: {
              kind: 'user',
              name: r.lastEditedByName?.split('@')[0] ?? null,
            },
            title: 'Post redigert i dashboard',
            postId: r.postId,
            postHook: r.postHook,
          });
        }
      } catch (e) { console.warn("[activity-feed] last-edited feilet", e); }

      // Sortér nyest først + paginer via ?before=<iso> + ?limit
      events.sort((a, b) => b.at.localeCompare(a.at));

      const before = typeof req.query.before === "string" ? req.query.before : null;
      const limit = Math.max(1, Math.min(200,
        parseInt(String(req.query.limit ?? "50"), 10) || 50));

      let filtered = events;
      if (before) {
        filtered = events.filter(e => e.at < before);
      }
      const page = filtered.slice(0, limit);
      const hasMore = filtered.length > limit;
      const nextCursor = hasMore && page.length > 0
        ? page[page.length - 1].at : null;

      res.status(200).json({
        ok: true,
        events: page,
        hasMore,
        nextCursor,
      });
    },
  );
}
