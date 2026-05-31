/**
 * Thumbnail-upload til feed-plan-post.
 *
 * Bjarne lager en thumbnail i Creative Editor (ThumbnailCreator) og
 * pusher den valgte PNGen tilbake til Role Room's feed planner som
 * customImageUrl på en spesifikk post.
 *
 * Endepunkt:
 *   POST /api/role-room/feed-plan/:projectId/:platform/post/:postId/thumbnail
 *   Body: { imageDataUrl: "data:image/png;base64,...", fileName?: string,
 *           sourceLayout?: string, sourceFrameSec?: number }
 *
 * Auth: RR_BEARER_TOKEN via activeSessions. Brukeren må eie prosjektet
 * eller være medlem (samme tilgangs-modell som upcoming-jobs).
 *
 * Lagring: oppdaterer kun den ene posten i role_room_feed_plans.posts
 * JSONB-arrayen. customImageUrl lagres som data: URL (≤2 MB matcher
 * eksisterende MAX_CUSTOM_IMAGE_LENGTH).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

const MAX_DATA_URL_LENGTH = 2_000_000;
const MAX_FILE_NAME_LENGTH = 200;

function getUserIdFromRequest(
  req: Request,
  activeSessions: Map<string, SessionData>,
): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const session = activeSessions.get(token);
    if (session?.userId) return session.userId;
  }
  return null;
}

async function viewerCanEditProject(
  pool: Pool,
  projectId: string,
  viewerId: string,
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

export function registerRoleRoomFeedPlanThumbnailRoutes(
  app: Express, deps: Deps,
): void {
  const { pool, activeSessions } = deps;

  app.post(
    "/api/role-room/feed-plan/:projectId/:platform/post/:postId/thumbnail",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }

      const { projectId, platform, postId } = req.params;
      if (!projectId || !platform || !postId) {
        res.status(400).json({ error: "mangler_parametere" }); return;
      }

      const body = req.body as {
        imageDataUrl?: unknown;
        fileName?: unknown;
        sourceLayout?: unknown;
        sourceFrameSec?: unknown;
      } | undefined;

      const dataUrl = typeof body?.imageDataUrl === "string"
        ? body.imageDataUrl.trim() : "";
      if (!dataUrl.startsWith("data:image/")) {
        res.status(400).json({ error: "ugyldig_data_url" }); return;
      }
      if (dataUrl.length > MAX_DATA_URL_LENGTH) {
        res.status(413).json({
          error: "thumbnail_for_stor",
          maxBytes: MAX_DATA_URL_LENGTH,
          gotBytes: dataUrl.length,
        }); return;
      }

      const fileName = typeof body?.fileName === "string"
        ? body.fileName.slice(0, MAX_FILE_NAME_LENGTH) : null;

      try {
        const allowed = await viewerCanEditProject(pool, projectId, viewerId);
        if (!allowed) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }

        const { rows } = await pool.query(
          `SELECT posts FROM role_room_feed_plans
            WHERE project_id = $1 AND platform = $2
            LIMIT 1`,
          [projectId, platform],
        );
        if (rows.length === 0) {
          res.status(404).json({ error: "feed_plan_ikke_funnet" }); return;
        }

        const posts = Array.isArray(rows[0].posts)
          ? (rows[0].posts as Array<Record<string, unknown>>) : [];
        const idx = posts.findIndex(p => String(p.id) === postId);
        if (idx === -1) {
          res.status(404).json({ error: "post_ikke_funnet_i_plan" }); return;
        }

        // Oppdater kun customImageUrl + customImageName på den ene posten.
        // Vi beholder all annen state (approval, hashtags, schedule, etc).
        posts[idx] = {
          ...posts[idx],
          customImageUrl: dataUrl,
          customImageName: fileName ?? `thumbnail-${postId.slice(0, 8)}.png`,
        };

        await pool.query(
          `UPDATE role_room_feed_plans
              SET posts = $1::jsonb,
                  updated_by = $2,
                  updated_at = now()
            WHERE project_id = $3 AND platform = $4`,
          [JSON.stringify(posts), viewerId, projectId, platform],
        );

        res.json({
          ok: true,
          postId,
          projectId,
          platform,
          customImageName: posts[idx].customImageName,
          sourceLayout: typeof body?.sourceLayout === "string"
            ? body.sourceLayout : null,
          sourceFrameSec: typeof body?.sourceFrameSec === "number"
            ? body.sourceFrameSec : null,
        });
      } catch (err) {
        console.error("[feed-plan-thumbnail] upload failed:", err);
        res.status(500).json({
          error: "intern_feil",
          detail: (err as Error).message,
        });
      }
    },
  );
}
