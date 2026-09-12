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
import { canEditProject } from "./project-team-routes.js";
import { isSupportedPlatform } from "./role-room-feed-plan.js";
import { applyFeedPostImageLocked } from "./role-room-feed-post-image.js";

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
      if (!projectId || !isSupportedPlatform(platform) || !postId) {
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
        const allowed = await canEditProject(pool, viewerId, projectId);
        if (!allowed) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }

        const customImageName = fileName ?? `thumbnail-${postId.slice(0, 8)}.png`;
        const applied = await applyFeedPostImageLocked(pool, {
          workspaceProjectId: projectId,
          platform,
          feedPostId: postId,
          imageDataUrl: dataUrl,
          imageName: customImageName,
          updatedBy: viewerId,
        });
        if (!applied.ok) {
          const error = applied.reason === "feed_plan_not_found"
            ? "feed_plan_ikke_funnet"
            : "post_ikke_funnet_i_plan";
          res.status(404).json({ error }); return;
        }

        res.json({
          ok: true,
          postId,
          projectId,
          platform,
          customImageName,
          changed: applied.changed,
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
