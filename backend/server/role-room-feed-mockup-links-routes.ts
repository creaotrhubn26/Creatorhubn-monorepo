import crypto from "node:crypto";
import express, { type Express, type Request, type Response } from "express";
import type { Pool, PoolClient } from "pg";
import { canAccessProject, canEditProject } from "./project-team-routes.js";
import {
  isSupportedPlatform,
  loadFeedPlan,
  type RoleRoomFeedPlatform,
} from "./role-room-feed-plan.js";
import { applyFeedPostImageLocked } from "./role-room-feed-post-image.js";
import { createFeedMockupProject } from "./role-room-research-mockups.js";
import {
  getUserFileContent,
  hardDeleteUserFile,
  uploadUserFile,
} from "./role-room-user-storage-service.js";
import {
  getMockupStudioProjectAccess,
  resolveMockupStudioActor,
  roleCanEditMockupProject,
  type MockupStudioActor,
  type MockupStudioSessionData,
} from "./role-room-mockup-studio-routes.js";

interface Deps {
  pool: Pool;
  activeSessions: Map<string, MockupStudioSessionData>;
}

interface FeedMockupLinkRow {
  id: string;
  workspace_project_id: string;
  platform: RoleRoomFeedPlatform;
  feed_post_id: string;
  mockup_project_id: string;
  mockup_created_by: string;
  mockup_name: string;
  mockup_revision: number;
  feed_post_title: string | null;
  feed_post_caption: string | null;
  last_applied_revision: number | null;
  last_applied_sha256: string | null;
  last_applied_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  variant_id: string;
  variant_label: string;
  variant_quality_status: "ready" | "limited" | "failed";
  variant_skill_runs: Array<Record<string, unknown>>;
  media_type: "image" | "carousel" | "reel";
  variant_active: boolean;
  output_position: number;
  sync_status: "building" | "not_sent" | "synced" | "stale" | "error";
  last_error: string | null;
  latest_output_id: string | null;
  latest_output_mime: string | null;
  ready_output_count: number;
  expected_output_count: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_OUTPUT_BYTES = 15 * 1024 * 1024;

function outputBytesMatchMime(mimeType: string, body: Buffer): boolean {
  if (mimeType === "image/png") {
    return body.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  }
  if (mimeType === "image/jpeg") {
    return body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  }
  if (mimeType === "image/webp") {
    return body.subarray(0, 4).toString("ascii") === "RIFF"
      && body.subarray(8, 12).toString("ascii") === "WEBP";
  }
  if (mimeType === "video/webm") {
    return body.subarray(0, 4).equals(Buffer.from("1a45dfa3", "hex"));
  }
  if (mimeType === "video/mp4" || mimeType === "video/quicktime") {
    return body.subarray(4, 8).toString("ascii") === "ftyp";
  }
  return false;
}

function parseOutputDataUrl(value: unknown): {
  dataUrl: string;
  mimeType: string;
  mediaType: "image" | "video";
  body: Buffer;
} | null {
  const dataUrl = typeof value === "string" ? value.trim() : "";
  const match =
    /^data:(image\/(?:png|jpeg|webp)|video\/(?:mp4|webm|quicktime));base64,([a-z0-9+/=]+)$/i.exec(
      dataUrl,
    );
  if (!match) return null;
  const body = Buffer.from(match[2], "base64");
  const mimeType = match[1].toLowerCase();
  if (
    !body.length
    || body.length > MAX_OUTPUT_BYTES
    || !outputBytesMatchMime(mimeType, body)
  ) return null;
  return {
    dataUrl,
    mimeType,
    mediaType: mimeType.startsWith("video/") ? "video" : "image",
    body,
  };
}

function cleanId(value: unknown, max = 255): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function mapLink(row: FeedMockupLinkRow) {
  const mockupRevision = Number(row.mockup_revision || 1);
  const lastAppliedRevision = row.last_applied_revision == null
    ? null
    : Number(row.last_applied_revision);
  return {
    id: String(row.id),
    workspaceProjectId: row.workspace_project_id,
    platform: row.platform,
    feedPostId: row.feed_post_id,
    feedPostTitle: row.feed_post_title || null,
    feedPostCaption: row.feed_post_caption || null,
    mockupProjectId: row.mockup_project_id,
    mockupName: row.mockup_name,
    mockupRevision,
    lastAppliedRevision,
    lastAppliedSha256: row.last_applied_sha256 || null,
    lastAppliedAt: row.last_applied_at || null,
    stale: lastAppliedRevision != null && lastAppliedRevision !== mockupRevision,
    variantId: row.variant_id,
    variantLabel: row.variant_label,
    qualityStatus: row.variant_quality_status || "limited",
    skillRuns: Array.isArray(row.variant_skill_runs) ? row.variant_skill_runs : [],
    mediaType: row.media_type,
    variantActive: row.variant_active,
    outputPosition: Number(row.output_position),
    syncStatus:
      lastAppliedRevision != null && lastAppliedRevision !== mockupRevision
        ? "stale"
        : row.sync_status,
    lastError: row.last_error,
    outputUrl: row.latest_output_id
      ? `/api/role-room/feed-mockup-outputs/${encodeURIComponent(row.latest_output_id)}/content`
      : null,
    outputMimeType: row.latest_output_mime,
    readyOutputCount: Number(row.ready_output_count || 0),
    expectedOutputCount: Number(row.expected_output_count || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const LINK_SELECT = `SELECT l.id::text, l.workspace_project_id, l.platform, l.feed_post_id,
    l.mockup_project_id, l.mockup_created_by, p.name AS mockup_name,
    l.variant_id::text, v.label AS variant_label,
    v.quality_status AS variant_quality_status,
    v.skill_runs AS variant_skill_runs, v.media_type,
    v.is_active AS variant_active, l.output_position, l.sync_status, l.last_error,
    COALESCE(ms.revision,1) AS mockup_revision,
    matched.post->>'title' AS feed_post_title,
    matched.post->>'caption' AS feed_post_caption,
    l.last_applied_revision, l.last_applied_sha256, l.last_applied_at,
    latest_output.id::text AS latest_output_id,
    latest_output.mime_type AS latest_output_mime,
    (SELECT count(DISTINCT sibling.output_position)::int FROM role_room_feed_mockup_outputs output
      JOIN role_room_feed_mockup_links sibling ON sibling.id=output.link_id
      WHERE sibling.variant_id=l.variant_id AND output.status='ready') AS ready_output_count,
    (SELECT count(*)::int FROM role_room_feed_mockup_links sibling
      WHERE sibling.variant_id=l.variant_id) AS expected_output_count,
    l.created_at, l.updated_at
  FROM role_room_feed_mockup_links l
  JOIN role_room_feed_mockup_variants v ON v.id=l.variant_id
  JOIN mockup_studio_project_state ms
    ON ms.project_id=l.mockup_project_id AND ms.created_by=l.mockup_created_by
  JOIN demo_studio_mockup_projects p
    ON p.id=l.mockup_project_id AND p.created_by=l.mockup_created_by
  LEFT JOIN role_room_feed_plans fp
    ON fp.project_id=l.workspace_project_id AND fp.platform=l.platform
  LEFT JOIN LATERAL (
    SELECT post
      FROM jsonb_array_elements(COALESCE(fp.posts,'[]'::jsonb)) AS post
     WHERE post->>'id'=l.feed_post_id
     LIMIT 1
  ) matched ON true
  LEFT JOIN LATERAL (
    SELECT output.id,output.mime_type
      FROM role_room_feed_mockup_outputs output
     WHERE output.link_id=l.id AND output.status='ready'
     ORDER BY output.created_at DESC LIMIT 1
  ) latest_output ON true`;

async function readLink(
  pool: Pool | PoolClient,
  id: string,
): Promise<FeedMockupLinkRow | null> {
  const result = await pool.query<FeedMockupLinkRow>(
    `${LINK_SELECT} WHERE l.id=$1::uuid LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

async function actorFor(
  pool: Pool,
  activeSessions: Map<string, MockupStudioSessionData>,
  req: Request,
  res: Response,
): Promise<MockupStudioActor | null> {
  const actor = await resolveMockupStudioActor(pool, activeSessions, req);
  if (!actor) res.status(401).json({ error: "krever_innlogging" });
  return actor;
}

async function canEditBothSides(
  pool: Pool,
  actor: MockupStudioActor,
  link: Pick<
    FeedMockupLinkRow,
    "workspace_project_id" | "mockup_project_id" | "mockup_created_by"
  >,
): Promise<boolean> {
  const [workspaceEditable, mockupAccess] = await Promise.all([
    canEditProject(pool, actor.userId, link.workspace_project_id),
    getMockupStudioProjectAccess(pool, actor, link.mockup_project_id),
  ]);
  return (
    workspaceEditable &&
    Boolean(
      mockupAccess &&
      mockupAccess.created_by === link.mockup_created_by &&
      roleCanEditMockupProject(mockupAccess.access_role),
    )
  );
}

export function registerRoleRoomFeedMockupLinkRoutes(
  app: Express,
  deps: Deps,
): void {
  const { pool, activeSessions } = deps;

  app.get(
    "/api/role-room/feed-mockup-links",
    async (req: Request, res: Response) => {
      const actor = await actorFor(pool, activeSessions, req, res);
      if (!actor) return;
      const workspaceProjectId = cleanId(req.query.workspaceProjectId);
      const mockupProjectId = cleanId(req.query.mockupProjectId);
      if (!workspaceProjectId && !mockupProjectId) {
        res
          .status(400)
          .json({ error: "workspaceProjectId_eller_mockupProjectId_pakrevd" });
        return;
      }

      try {
        if (
          workspaceProjectId &&
          !(await canAccessProject(pool, actor.userId, workspaceProjectId))
        ) {
          res.status(403).json({ error: "ingen_prosjekttilgang" });
          return;
        }
        const requestedMockupAccess = mockupProjectId
          ? await getMockupStudioProjectAccess(pool, actor, mockupProjectId)
          : null;
        if (mockupProjectId && !requestedMockupAccess) {
          res.status(403).json({ error: "ingen_mockup_tilgang" });
          return;
        }

        const clauses: string[] = [];
        const values: string[] = [];
        if (workspaceProjectId) {
          values.push(workspaceProjectId);
          clauses.push(`l.workspace_project_id=$${values.length}`);
        }
        if (mockupProjectId) {
          values.push(mockupProjectId);
          clauses.push(`l.mockup_project_id=$${values.length}`);
          values.push(requestedMockupAccess!.created_by);
          clauses.push(`l.mockup_created_by=$${values.length}`);
        }
        const result = await pool.query<FeedMockupLinkRow>(
          `${LINK_SELECT} WHERE ${clauses.join(" AND ")} ORDER BY l.updated_at DESC LIMIT 200`,
          values,
        );

        const visible: FeedMockupLinkRow[] = [];
        for (const row of result.rows) {
          const allowed = workspaceProjectId
            ? (
                await getMockupStudioProjectAccess(
                  pool,
                  actor,
                  row.mockup_project_id,
                )
              )?.created_by === row.mockup_created_by
            : await canAccessProject(
                pool,
                actor.userId,
                row.workspace_project_id,
              );
          if (allowed) visible.push(row);
        }
        res.json({ links: visible.map(mapLink) });
      } catch (error) {
        console.error("[feed-mockup-links/list]", error);
        res.status(500).json({ error: "list_feil", detail: "internal_error" });
      }
    },
  );

  app.post(
    "/api/role-room/feed-mockup-links",
    express.json({ limit: "100kb" }),
    async (req: Request, res: Response) => {
      const actor = await actorFor(pool, activeSessions, req, res);
      if (!actor) return;
      const workspaceProjectId = cleanId(req.body?.workspaceProjectId);
      const platform = req.body?.platform;
      const feedPostId = cleanId(req.body?.feedPostId);
      const mockupProjectId = cleanId(req.body?.mockupProjectId);
      if (
        !workspaceProjectId ||
        !isSupportedPlatform(platform) ||
        !feedPostId ||
        !mockupProjectId
      ) {
        res.status(400).json({ error: "ugyldig_kobling" });
        return;
      }

      try {
        const [workspaceEditable, mockupAccess, feedPlan] = await Promise.all([
          canEditProject(pool, actor.userId, workspaceProjectId),
          getMockupStudioProjectAccess(pool, actor, mockupProjectId),
          loadFeedPlan(pool, workspaceProjectId, platform),
        ]);
        if (!workspaceEditable) {
          res.status(403).json({ error: "ingen_prosjektredigering" });
          return;
        }
        if (
          !mockupAccess ||
          !roleCanEditMockupProject(mockupAccess.access_role)
        ) {
          res.status(403).json({ error: "ingen_mockup_redigering" });
          return;
        }
        if (!feedPlan) {
          res.status(404).json({ error: "feed_plan_ikke_funnet" });
          return;
        }
        const feedPost = feedPlan.posts.find((post) => post.id === feedPostId);
        if (!feedPost) {
          res.status(404).json({ error: "feed_post_ikke_funnet" });
          return;
        }
        const feedMediaType = ["image", "carousel", "reel"].includes(
          String(feedPost.mediaType),
        )
          ? (feedPost.mediaType as "image" | "carousel" | "reel")
          : "image";
        if (feedMediaType === "carousel") {
          res.status(409).json({
            error: "karusell_krever_slide_sett",
            detail:
              "Bruk Lag mockup for å opprette et komplett, posisjonert slidesett.",
          });
          return;
        }

        const client = await pool.connect();
        let row: FeedMockupLinkRow | null = null;
        try {
          await client.query("BEGIN");
          await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
            `feed-mockup-link::${workspaceProjectId}::${platform}::${feedPostId}`,
          ]);
          const existing = await client.query<{ id: string }>(
            `SELECT id::text FROM role_room_feed_mockup_links
              WHERE workspace_project_id=$1 AND platform=$2 AND feed_post_id=$3
                AND mockup_project_id=$4 AND mockup_created_by=$5 LIMIT 1`,
            [
              workspaceProjectId,
              platform,
              feedPostId,
              mockupAccess.id,
              mockupAccess.created_by,
            ],
          );
          let linkId = existing.rows[0]?.id;
          if (!linkId) {
            const variantKey = `linked-${crypto.createHash("sha256").update(`${mockupAccess.id}:${mockupAccess.created_by}`).digest("hex").slice(0, 20)}`;
            const variant = await client.query<{ id: string }>(
              `INSERT INTO role_room_feed_mockup_variants
              (workspace_project_id,platform,feed_post_id,variant_key,label,media_type,is_active,created_by_user_id)
             VALUES ($1,$2,$3,$4,$5,$7,NOT EXISTS (
               SELECT 1 FROM role_room_feed_mockup_variants
                WHERE workspace_project_id=$1 AND platform=$2 AND feed_post_id=$3 AND is_active
             ),$6)
             ON CONFLICT (workspace_project_id,platform,feed_post_id,variant_key) DO UPDATE SET
               updated_at=role_room_feed_mockup_variants.updated_at
             RETURNING id::text`,
              [
                workspaceProjectId,platform,
                feedPostId,
                variantKey,
                cleanId(mockupAccess.payload?.name, 160) || "Koblet design",
                actor.userId,
                feedMediaType,
              ],
            );
            const inserted = await client.query<{ id: string }>(
              `INSERT INTO role_room_feed_mockup_links
               (workspace_project_id,platform,feed_post_id,mockup_project_id,
                mockup_created_by,created_by_user_id,variant_id,output_position,sync_status,updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7::uuid,1,'not_sent',now())
             ON CONFLICT (
               workspace_project_id,platform,feed_post_id,mockup_project_id,mockup_created_by
             ) DO UPDATE SET updated_at=role_room_feed_mockup_links.updated_at
             RETURNING id::text`,
              [
                workspaceProjectId,
                platform,
                feedPostId,
                mockupAccess.id,
                mockupAccess.created_by,
                actor.userId,
                variant.rows[0].id,
              ],
            );
            linkId = inserted.rows[0].id;
          }
          row = await readLink(client, linkId);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK").catch(() => undefined);
          throw error;
        } finally {
          client.release();
        }
        res.status(201).json({ link: row ? mapLink(row) : null });
      } catch (error) {
        console.error("[feed-mockup-links/create]", error);
        res
          .status(500)
          .json({ error: "opprett_feil", detail: "internal_error" });
      }
    },
  );

  app.post(
    "/api/role-room/feed-mockup-links/create-project",
    express.json({ limit: "100kb" }),
    async (req: Request, res: Response) => {
      const actor = await actorFor(pool, activeSessions, req, res);
      if (!actor) return;
      const workspaceProjectId = cleanId(req.body?.workspaceProjectId);
      const platform = req.body?.platform;
      const feedPostId = cleanId(req.body?.feedPostId);
      const mediaType = ["image", "carousel", "reel"].includes(
        String(req.body?.mediaType),
      )
        ? (req.body.mediaType as "image" | "carousel" | "reel")
        : "image";
      const slideCount = Number(req.body?.slideCount);
      const label = cleanId(req.body?.label, 160);
      if (
        !workspaceProjectId ||
        !isSupportedPlatform(platform) ||
        !feedPostId
      ) {
        res.status(400).json({ error: "ugyldig_mockup_prosjekt" });
        return;
      }
      try {
        const [editable, feedPlan] = await Promise.all([
          canEditProject(pool, actor.userId, workspaceProjectId),
          loadFeedPlan(pool, workspaceProjectId, platform),
        ]);
        if (!editable) {
          res.status(403).json({ error: "ingen_prosjektredigering" });
          return;
        }
        const feedPost = feedPlan?.posts.find((post) => post.id === feedPostId);
        if (!feedPost) {
          res.status(404).json({ error: "feed_post_ikke_funnet" });
          return;
        }
        const created = await createFeedMockupProject(pool, {
          projectId: workspaceProjectId,
          platform,
          feedPost,
          actorId: actor.userId,
          mediaType,
          slideCount: Number.isFinite(slideCount) ? slideCount : undefined,
          label: label || undefined,
          brandSnapshot: feedPlan?.brandSnapshot,
        });
        const rows = await pool.query<FeedMockupLinkRow>(
          `${LINK_SELECT} WHERE l.variant_id=$1::uuid ORDER BY l.output_position`,
          [created.variantId],
        );
        res.status(201).json({ ...created, links: rows.rows.map(mapLink) });
      } catch (error) {
        console.error("[feed-mockup-links/create-project]", error);
        res
          .status(500)
          .json({ error: "opprett_mockup_feil", detail: "internal_error" });
      }
    },
  );

  app.delete(
    "/api/role-room/feed-mockup-links/:linkId",
    async (req: Request, res: Response) => {
      const actor = await actorFor(pool, activeSessions, req, res);
      if (!actor) return;
      const linkId = cleanId(req.params.linkId, 40);
      if (!UUID_PATTERN.test(linkId)) {
        res.status(400).json({ error: "ugyldig_kobling" });
        return;
      }
      try {
        const link = await readLink(pool, linkId);
        if (!link) {
          res.status(404).json({ error: "kobling_ikke_funnet" });
          return;
        }
        if (!(await canEditBothSides(pool, actor, link))) {
          res.status(403).json({ error: "ingen_redigeringstilgang" });
          return;
        }
        await pool.query(
          "DELETE FROM role_room_feed_mockup_links WHERE id=$1::uuid",
          [linkId],
        );
        res.json({ ok: true });
      } catch (error) {
        console.error("[feed-mockup-links/delete]", error);
        res.status(500).json({ error: "slett_feil", detail: "internal_error" });
      }
    },
  );

  app.post(
    "/api/role-room/feed-mockup-links/:linkId/apply-output",
    express.json({ limit: "22mb" }),
    async (req: Request, res: Response) => {
      const actor = await actorFor(pool, activeSessions, req, res);
      if (!actor) return;
      const linkId = cleanId(req.params.linkId, 40);
      const output = parseOutputDataUrl(
        req.body?.mediaDataUrl ?? req.body?.imageDataUrl,
      );
      const imageName =
        cleanId(req.body?.fileName, 200) || "mockup-studio-render.png";
      const requestedRevision = Number(req.body?.mockupRevision);
      if (!UUID_PATTERN.test(linkId) || !output) {
        res.status(400).json({ error: "ugyldig_output" });
        return;
      }

      try {
        const link = await readLink(pool, linkId);
        if (!link) {
          res.status(404).json({ error: "kobling_ikke_funnet" });
          return;
        }
        if (!(await canEditBothSides(pool, actor, link))) {
          res.status(403).json({ error: "ingen_redigeringstilgang" });
          return;
        }
        const revision = Number(link.mockup_revision || 1);
        if (
          Number.isSafeInteger(requestedRevision) &&
          requestedRevision > 0 &&
          requestedRevision !== revision
        ) {
          res
            .status(409)
            .json({
              error: "mockup_versjon_utdatert",
              currentRevision: revision,
            });
          return;
        }
        if ((link.media_type === "reel") !== (output.mediaType === "video")) {
          res.status(400).json({
            error:
              link.media_type === "reel"
                ? "reel_krever_video"
                : "postformat_krever_bilde",
          });
          return;
        }

        const sha256 = crypto
          .createHash("sha256")
          .update(output.body)
          .digest("hex");
        const reserved = await pool.query<{ id: string }>(
          `INSERT INTO role_room_feed_mockup_outputs
            (link_id,mockup_revision,output_position,sha256,media_type,mime_type,
             file_name,size_bytes,file_owner_user_id,status,created_by_user_id,updated_at)
           VALUES ($1::uuid,$2,$3,$4::varchar(64),$5,$6,$7,$8,$9,'uploading',$9,now())
           ON CONFLICT (link_id,mockup_revision,sha256) DO NOTHING
           RETURNING id::text`,
          [
            link.id,
            revision,
            link.output_position,
            sha256,
            output.mediaType,
            output.mimeType,
            imageName,
            output.body.length,
            actor.userId,
          ],
        );
        let outputId = reserved.rows[0]?.id;
        let outputRow:
          | {
              id: string;
              status: string;
              file_id: string | null;
              file_name: string;
              updated_at: Date | string;
            }
          | undefined;
        let storedFileName = imageName;
        if (!outputId) {
          const existing = await pool.query<{
            id: string;
            status: string;
            file_id: string | null;
            file_name: string;
            updated_at: Date | string;
          }>(
            `SELECT id::text,status,file_id::text,file_name,updated_at FROM role_room_feed_mockup_outputs
              WHERE link_id=$1::uuid AND mockup_revision=$2 AND sha256=$3::varchar(64) LIMIT 1`,
            [link.id, revision, sha256],
          );
          outputRow = existing.rows[0];
          outputId = outputRow?.id;
          if (!outputId) throw new Error("output_reservation_missing");
          storedFileName = outputRow.file_name || imageName;
          if (outputRow.status === "uploading") {
            const claimed = await pool.query<{ id: string }>(
              `UPDATE role_room_feed_mockup_outputs SET updated_at=now(),error_message=NULL
                WHERE id=$1::uuid AND status='uploading'
                  AND updated_at < now() - interval '5 minutes'
                RETURNING id::text`,
              [outputId],
            );
            if (!claimed.rows.length) {
              res.status(409).json({ error: "output_behandles", outputId });
              return;
            }
            outputRow = undefined;
          }
          if (outputRow?.status === "error") {
            const claimed = await pool.query<{ id: string }>(
              `UPDATE role_room_feed_mockup_outputs SET status='uploading',error_message=NULL,updated_at=now()
                WHERE id=$1::uuid AND status='error' RETURNING id::text`,
              [outputId],
            );
            if (!claimed.rows.length) {
              res.status(409).json({ error: "output_behandles", outputId });
              return;
            }
            outputRow = undefined;
          }
        }

        if (!outputRow?.file_id) {
          let uploaded: Awaited<ReturnType<typeof uploadUserFile>>;
          try {
            uploaded = await uploadUserFile(pool, {
              userId: actor.userId,
              displayName: storedFileName,
              body: output.body,
              contentType: output.mimeType,
              sourceModule: "feed-mockup-output",
              metadata: {
                linkId: link.id,
                variantId: link.variant_id,
                mockupRevision: revision,
                sha256,
                outputPosition: link.output_position,
              },
              context: {
                projectId: link.workspace_project_id,
                attachedToEntityType: "feed-mockup-output",
                attachedToEntityId: outputId,
                attachmentNote: `Mockup Studio-output ${link.output_position}/${link.expected_output_count}`,
              },
            });
          } catch (error) {
            await pool
              .query(
                `UPDATE role_room_feed_mockup_outputs
                  SET status='error',error_message='storage_exception',updated_at=now()
                WHERE id=$1::uuid`,
                [outputId],
              )
              .catch(() => undefined);
            throw error;
          }
          if (!uploaded.ok) {
            await pool.query(
              `UPDATE role_room_feed_mockup_outputs SET status='error',error_message=$2,updated_at=now() WHERE id=$1::uuid`,
              [outputId, uploaded.reason],
            );
            res
              .status(uploaded.reason === "quota_exceeded" ? 413 : 503)
              .json({ error: uploaded.reason });
            return;
          }
          try {
            await pool.query(
              `UPDATE role_room_feed_mockup_outputs
                  SET file_id=$2::uuid,status='ready',error_message=NULL,updated_at=now()
                WHERE id=$1::uuid`,
              [outputId, uploaded.file.id],
            );
          } catch (error) {
            await hardDeleteUserFile(pool, {
              userId: actor.userId,
              fileId: uploaded.file.id,
            }).catch(() => undefined);
            await pool
              .query(
                `UPDATE role_room_feed_mockup_outputs
                  SET status='error',error_message='registration_failed',updated_at=now()
                WHERE id=$1::uuid`,
                [outputId],
              )
              .catch(() => undefined);
            throw error;
          }
        }

        const variantOutputs = await pool.query<{
          url_id: string;
          file_name: string;
        }>(
          `SELECT DISTINCT ON (sibling.output_position)
             output.id::text AS url_id,output.file_name
           FROM role_room_feed_mockup_links sibling
           JOIN role_room_feed_mockup_outputs output ON output.link_id=sibling.id AND output.status='ready'
          WHERE sibling.variant_id=$1::uuid
          ORDER BY sibling.output_position,output.mockup_revision DESC,output.created_at DESC`,
          [link.variant_id],
        );
        const variantAssets = variantOutputs.rows.map((asset) => ({
          url: `/api/role-room/feed-mockup-outputs/${encodeURIComponent(asset.url_id)}/content`,
          name: asset.file_name,
        }));
        if (
          link.media_type === "carousel" &&
          variantAssets.length < link.expected_output_count
        ) {
          await pool.query(
            `UPDATE role_room_feed_mockup_links SET sync_status='building',last_error=NULL,updated_at=now()
              WHERE id=$1::uuid`,
            [link.id],
          );
          res.json({
            ok: true,
            changed: false,
            stored: true,
            outputId,
            variantComplete: false,
            readyOutputCount: variantAssets.length,
            expectedOutputCount: link.expected_output_count,
            approvalState: "draft",
          });
          return;
        }

        const result = await applyFeedPostImageLocked(pool, {
          workspaceProjectId: link.workspace_project_id,
          platform: link.platform,
          feedPostId: link.feed_post_id,
          imageDataUrl: output.dataUrl,
          imageName: storedFileName,
          assetUrl: `/api/role-room/feed-mockup-outputs/${encodeURIComponent(outputId)}/content`,
          assetSha256: sha256,
          mediaType: link.media_type,
          variantAssets,
          updatedBy: actor.userId,
          link: {
            id: link.id,
            mockupProjectId: link.mockup_project_id,
            mockupCreatedBy: link.mockup_created_by,
            revision,
            variantId: link.variant_id,
            outputPosition: link.output_position,
            confirmApprovedAssetChange:
              req.body?.confirmApprovedAssetChange === true,
          },
        });
        if (!result.ok) {
          const status =
            result.reason === "approval_confirmation_required"
              ? 409
              : result.reason === "published_post_locked"
                ? 409
                : 404;
          res
            .status(status)
            .json({
              error: result.reason,
              approvalState: result.approvalState ?? null,
            });
          return;
        }
        await pool.query(
          `UPDATE role_room_feed_mockup_links sibling SET
             sync_status='synced',last_error=NULL,
             last_applied_revision=source.mockup_revision,
             last_applied_sha256=source.sha256,last_applied_at=now(),updated_at=now()
           FROM (
             SELECT DISTINCT ON (output.link_id) output.link_id,output.mockup_revision,output.sha256
               FROM role_room_feed_mockup_outputs output
               JOIN role_room_feed_mockup_links linked ON linked.id=output.link_id
              WHERE linked.variant_id=$1::uuid AND output.status='ready'
              ORDER BY output.link_id,output.mockup_revision DESC,output.created_at DESC
           ) source
           WHERE sibling.id=source.link_id`,
          [link.variant_id],
        );
        res.json({ ...result, stored: true, outputId, variantComplete: true });
      } catch (error) {
        console.error("[feed-mockup-links/apply-output]", error);
        res.status(500).json({ error: "apply_feil", detail: "internal_error" });
      }
    },
  );

  app.get(
    "/api/role-room/feed-mockup-outputs/:outputId/content",
    async (req: Request, res: Response) => {
      const actor = await actorFor(pool, activeSessions, req, res);
      if (!actor) return;
      const outputId = cleanId(req.params.outputId, 40);
      if (!UUID_PATTERN.test(outputId)) {
        res.status(400).json({ error: "ugyldig_output" });
        return;
      }
      try {
        const found = await pool.query<{
          workspace_project_id: string;
          file_id: string;
          file_owner_user_id: string;
        }>(
          `SELECT link.workspace_project_id,output.file_id::text,output.file_owner_user_id
           FROM role_room_feed_mockup_outputs output
           JOIN role_room_feed_mockup_links link ON link.id=output.link_id
          WHERE output.id=$1::uuid AND output.status='ready' AND output.file_id IS NOT NULL LIMIT 1`,
          [outputId],
        );
        const row = found.rows[0];
        if (!row) {
          res.status(404).json({ error: "output_ikke_funnet" });
          return;
        }
        if (
          !(await canAccessProject(
            pool,
            actor.userId,
            row.workspace_project_id,
          ))
        ) {
          res.status(403).json({ error: "ingen_prosjekttilgang" });
          return;
        }
        const content = await getUserFileContent(pool, {
          userId: row.file_owner_user_id,
          fileId: row.file_id,
        });
        if (!content.ok) {
          res
            .status(content.reason === "not_found" ? 404 : 503)
            .json({ error: content.reason });
          return;
        }
        res.setHeader("Content-Type", content.contentType);
        res.setHeader("Content-Length", String(content.body.byteLength));
        res.setHeader("Cache-Control", "private, max-age=240");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.send(Buffer.from(content.body));
      } catch (error) {
        console.error("[feed-mockup-output/content]", error);
        res
          .status(500)
          .json({ error: "hent_output_feil", detail: "internal_error" });
      }
    },
  );
}
