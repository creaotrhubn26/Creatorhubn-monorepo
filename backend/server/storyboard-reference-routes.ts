import type { Request, RequestHandler, Response, Router } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import {
  builtInReferenceDescriptor,
  listStoryboardReferenceAssets,
  mapStoryboardReferenceAsset,
  readBuiltInStoryboardReference,
} from "./storyboard-reference-library.js";

type AuthedRequest = Request & { userId: string };

const reviewBody = z
  .object({
    approvalStatus: z.enum(["draft", "approved", "rejected"]),
    locked: z.boolean().optional(),
  })
  .strict();

export interface StoryboardReferenceRouteMiddleware {
  auth: RequestHandler;
  canView: RequestHandler;
  canManage: RequestHandler;
}

function imageUrl(projectId: string, assetId: string): string {
  return (
    `/api/role-room/projects/${encodeURIComponent(projectId)}` +
    `/storyboard-references/${encodeURIComponent(assetId)}/image`
  );
}

export function registerStoryboardReferenceRoutes(
  router: Router,
  pool: Pool,
  middleware: StoryboardReferenceRouteMiddleware,
): void {
  const { auth, canView, canManage } = middleware;

  router.get(
    "/projects/:projectId/storyboard-references",
    auth,
    canView,
    async (req, res) => {
      const projectId = String(req.params.projectId);
      try {
        const assets = await listStoryboardReferenceAssets(pool, projectId);
        res.json({
          success: true,
          data: assets.map((asset) => ({
            ...asset,
            referenceImageId: undefined,
            imageUrl: imageUrl(projectId, asset.id),
          })),
        });
      } catch (error) {
        if ((error as { code?: string } | null)?.code === "42P01") {
          res
            .status(503)
            .json({ error: "reference_library_migration_required" });
          return;
        }
        res
          .status(500)
          .json({
            error: "reference_library_failed",
            detail: "internal_error",
          });
      }
    },
  );

  router.get(
    "/projects/:projectId/storyboard-references/:assetId/image",
    auth,
    canView,
    async (req: Request, res: Response) => {
      const result = await pool.query<{
        id: string;
        project_id: string;
        reference_image_id: string;
      }>(
        `SELECT id, project_id, reference_image_id
           FROM storyboard_reference_assets
          WHERE id = $1 AND project_id = $2
          LIMIT 1`,
        [String(req.params.assetId), String(req.params.projectId)],
      );
      const row = result.rows[0];
      if (!row || !builtInReferenceDescriptor(row.reference_image_id)) {
        res.status(404).json({ error: "reference_not_found" });
        return;
      }
      try {
        const file = await readBuiltInStoryboardReference(
          row.reference_image_id,
        );
        res.setHeader("Content-Type", file.contentType);
        res.setHeader("Content-Length", String(file.bytes.length));
        res.setHeader("Cache-Control", "private, max-age=300");
        res.send(file.bytes);
      } catch {
        res.status(404).json({ error: "reference_image_unavailable" });
      }
    },
  );

  router.patch(
    "/projects/:projectId/storyboard-references/:assetId",
    auth,
    canManage,
    async (req, res) => {
      const parsed = reviewBody.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "invalid_request", details: parsed.error.format() });
        return;
      }
      const projectId = String(req.params.projectId);
      const assetId = String(req.params.assetId);
      const reviewerId = (req as AuthedRequest).userId;
      const approved = parsed.data.approvalStatus === "approved";
      const locked = approved ? (parsed.data.locked ?? true) : false;
      const result = await pool.query(
        `UPDATE storyboard_reference_assets
            SET approval_status = $1,
                locked = $2,
                approved_by = CASE WHEN $1 = 'approved' THEN $3 ELSE NULL END,
                approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE NULL END,
                updated_at = NOW()
          WHERE id = $4 AND project_id = $5
          RETURNING *`,
        [parsed.data.approvalStatus, locked, reviewerId, assetId, projectId],
      );
      if (!result.rows[0]) {
        res.status(404).json({ error: "reference_not_found" });
        return;
      }
      const asset = mapStoryboardReferenceAsset(result.rows[0]);
      res.json({
        success: true,
        data: {
          ...asset,
          referenceImageId: undefined,
          imageUrl: imageUrl(projectId, asset.id),
        },
      });
    },
  );
}
