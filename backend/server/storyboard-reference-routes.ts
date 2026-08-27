import { randomUUID } from "node:crypto";
import type { Request, RequestHandler, Response, Router } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import {
  isSupportedStoryboardReferenceContentType,
  listStoryboardReferenceAssets,
  mapStoryboardReferenceAsset,
  MAX_REFERENCE_IMAGE_BYTES,
  readStoryboardReference,
  storageFileReferenceId,
} from "./storyboard-reference-library.js";

type AuthedRequest = Request & { userId: string };

const reviewBody = z
  .object({
    approvalStatus: z.enum(["draft", "approved", "rejected"]),
    locked: z.boolean().optional(),
  })
  .strict();

const createBody = z
  .object({
    storageFileId: z.string().uuid(),
    name: z.string().trim().min(1).max(300),
    description: z.string().trim().max(2_000).default(""),
    entityType: z.enum([
      "character",
      "wardrobe",
      "location",
      "prop",
      "storyboard",
    ]),
    entityId: z.string().trim().max(255).default(""),
    sceneIds: z.array(z.string().trim().min(1).max(255)).max(200).default([]),
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
        const [assets, projectResult] = await Promise.all([
          listStoryboardReferenceAssets(pool, projectId),
          pool.query<{ name: string }>(
            `SELECT name FROM casting_projects WHERE id = $1 LIMIT 1`,
            [projectId],
          ),
        ]);
        res.json({
          success: true,
          project: {
            id: projectId,
            name: projectResult.rows[0]?.name || "Produksjon",
          },
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
        res.status(500).json({
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
      if (!row) {
        res.status(404).json({ error: "reference_not_found" });
        return;
      }
      try {
        const file = await readStoryboardReference(
          pool,
          row.project_id,
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

  router.post(
    "/projects/:projectId/storyboard-references",
    auth,
    canManage,
    async (req, res) => {
      const parsed = createBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "invalid_request",
          details: parsed.error.format(),
        });
        return;
      }
      const projectId = String(req.params.projectId);
      const creatorId = (req as AuthedRequest).userId;
      const fileResult = await pool.query<{
        id: string;
        size_bytes: string | number;
        content_type: string | null;
      }>(
        `SELECT id::text, size_bytes, content_type
           FROM role_room_user_files
          WHERE id = $1::uuid
            AND user_id = $2
            AND project_id = $3
            AND deleted_at IS NULL
          LIMIT 1`,
        [parsed.data.storageFileId, creatorId, projectId],
      );
      const file = fileResult.rows[0];
      if (!file) {
        res.status(404).json({ error: "storage_file_not_found" });
        return;
      }
      if (
        !isSupportedStoryboardReferenceContentType(file.content_type) ||
        Number(file.size_bytes) <= 0 ||
        Number(file.size_bytes) > MAX_REFERENCE_IMAGE_BYTES
      ) {
        res.status(415).json({ error: "unsupported_reference_image" });
        return;
      }

      const assetId = `reference-${randomUUID()}`;
      const sceneIds = [...new Set(parsed.data.sceneIds)];
      try {
        const result = await pool.query(
          `INSERT INTO storyboard_reference_assets
             (id, project_id, pack_id, pack_version, entity_type, entity_id,
              scene_ids, name, description, reference_image_id,
              approval_status, locked, metadata, created_by, created_at, updated_at)
           VALUES
             ($1::varchar, $2::varchar, 'project-production-bible', 'v1',
              $3::varchar, NULLIF($4::varchar, ''), $5::jsonb, $6::varchar,
              $7::text, $8::varchar, 'draft', FALSE,
              $9::jsonb, $10::varchar, NOW(), NOW())
           RETURNING *`,
          [
            assetId,
            projectId,
            parsed.data.entityType,
            parsed.data.entityId,
            JSON.stringify(sceneIds),
            parsed.data.name,
            parsed.data.description,
            storageFileReferenceId(parsed.data.storageFileId),
            JSON.stringify({
              source: "storyboard_room_upload",
              requiresHumanApproval: true,
            }),
            creatorId,
          ],
        );
        const asset = mapStoryboardReferenceAsset(result.rows[0]);
        res.status(201).json({
          success: true,
          data: {
            ...asset,
            referenceImageId: undefined,
            imageUrl: imageUrl(projectId, asset.id),
          },
        });
      } catch (error) {
        if ((error as { code?: string } | null)?.code === "23505") {
          res.status(409).json({ error: "reference_already_exists" });
          return;
        }
        console.error("[storyboard-reference] create failed", {
          code: (error as { code?: string } | null)?.code ?? "unknown",
          projectId,
        });
        res.status(500).json({
          error: "reference_create_failed",
          detail: "internal_error",
        });
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
      const locked = approved;
      let result;
      try {
        result = await pool.query(
          `UPDATE storyboard_reference_assets
              SET approval_status = $1::varchar,
                  locked = $2::boolean,
                  approved_by = CASE
                    WHEN $1::varchar = 'approved' THEN $3::varchar
                    ELSE NULL
                  END,
                  approved_at = CASE
                    WHEN $1::varchar = 'approved' THEN NOW()
                    ELSE NULL
                  END,
                  updated_at = NOW()
            WHERE id = $4::varchar AND project_id = $5::varchar
            RETURNING *`,
          [parsed.data.approvalStatus, locked, reviewerId, assetId, projectId],
        );
      } catch (error) {
        const code = (error as { code?: string } | null)?.code ?? "unknown";
        console.error("[storyboard-reference] review update failed", {
          code,
          projectId,
        });
        if (!res.headersSent && !res.writableEnded) {
          res.status(code === "57014" ? 503 : 500).json({
            error: "reference_review_failed",
            detail: code === "57014" ? "database_timeout" : "internal_error",
          });
        }
        return;
      }
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
