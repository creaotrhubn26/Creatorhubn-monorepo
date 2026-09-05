import express, { type Express, type Request, type Response } from "express";
import type { Pool } from "pg";
import { canAccessProject, canEditProject } from "./project-team-routes.js";
import {
  isSupportedPlatform,
  loadFeedPlan,
  type RoleRoomFeedPlatform,
} from "./role-room-feed-plan.js";
import { applyFeedPostImageLocked } from "./role-room-feed-post-image.js";
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
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DATA_URL_LENGTH = 2_000_000;

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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const LINK_SELECT = `SELECT l.id::text, l.workspace_project_id, l.platform, l.feed_post_id,
    l.mockup_project_id, l.mockup_created_by, p.name AS mockup_name,
    COALESCE(ms.revision,1) AS mockup_revision,
    matched.post->>'title' AS feed_post_title,
    matched.post->>'caption' AS feed_post_caption,
    l.last_applied_revision, l.last_applied_sha256, l.last_applied_at,
    l.created_at, l.updated_at
  FROM role_room_feed_mockup_links l
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
  ) matched ON true`;

async function readLink(pool: Pool, id: string): Promise<FeedMockupLinkRow | null> {
  const result = await pool.query<FeedMockupLinkRow>(`${LINK_SELECT} WHERE l.id=$1::uuid LIMIT 1`, [id]);
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
  link: Pick<FeedMockupLinkRow, "workspace_project_id" | "mockup_project_id" | "mockup_created_by">,
): Promise<boolean> {
  const [workspaceEditable, mockupAccess] = await Promise.all([
    canEditProject(pool, actor.userId, link.workspace_project_id),
    getMockupStudioProjectAccess(pool, actor, link.mockup_project_id),
  ]);
  return workspaceEditable && Boolean(
    mockupAccess
    && mockupAccess.created_by === link.mockup_created_by
    && roleCanEditMockupProject(mockupAccess.access_role),
  );
}

export function registerRoleRoomFeedMockupLinkRoutes(app: Express, deps: Deps): void {
  const { pool, activeSessions } = deps;

  app.get("/api/role-room/feed-mockup-links", async (req: Request, res: Response) => {
    const actor = await actorFor(pool, activeSessions, req, res);
    if (!actor) return;
    const workspaceProjectId = cleanId(req.query.workspaceProjectId);
    const mockupProjectId = cleanId(req.query.mockupProjectId);
    if (!workspaceProjectId && !mockupProjectId) {
      res.status(400).json({ error: "workspaceProjectId_eller_mockupProjectId_pakrevd" }); return;
    }

    try {
      if (workspaceProjectId && !await canAccessProject(pool, actor.userId, workspaceProjectId)) {
        res.status(403).json({ error: "ingen_prosjekttilgang" }); return;
      }
      const requestedMockupAccess = mockupProjectId
        ? await getMockupStudioProjectAccess(pool, actor, mockupProjectId)
        : null;
      if (mockupProjectId && !requestedMockupAccess) {
        res.status(403).json({ error: "ingen_mockup_tilgang" }); return;
      }

      const clauses: string[] = [];
      const values: string[] = [];
      if (workspaceProjectId) {
        values.push(workspaceProjectId); clauses.push(`l.workspace_project_id=$${values.length}`);
      }
      if (mockupProjectId) {
        values.push(mockupProjectId); clauses.push(`l.mockup_project_id=$${values.length}`);
        values.push(requestedMockupAccess!.created_by); clauses.push(`l.mockup_created_by=$${values.length}`);
      }
      const result = await pool.query<FeedMockupLinkRow>(
        `${LINK_SELECT} WHERE ${clauses.join(" AND ")} ORDER BY l.updated_at DESC LIMIT 200`,
        values,
      );

      const visible: FeedMockupLinkRow[] = [];
      for (const row of result.rows) {
        const allowed = workspaceProjectId
          ? (await getMockupStudioProjectAccess(pool, actor, row.mockup_project_id))?.created_by === row.mockup_created_by
          : await canAccessProject(pool, actor.userId, row.workspace_project_id);
        if (allowed) visible.push(row);
      }
      res.json({ links: visible.map(mapLink) });
    } catch (error) {
      console.error("[feed-mockup-links/list]", error);
      res.status(500).json({ error: "list_feil", detail: "internal_error" });
    }
  });

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
      if (!workspaceProjectId || !isSupportedPlatform(platform) || !feedPostId || !mockupProjectId) {
        res.status(400).json({ error: "ugyldig_kobling" }); return;
      }

      try {
        const [workspaceEditable, mockupAccess, feedPlan] = await Promise.all([
          canEditProject(pool, actor.userId, workspaceProjectId),
          getMockupStudioProjectAccess(pool, actor, mockupProjectId),
          loadFeedPlan(pool, workspaceProjectId, platform),
        ]);
        if (!workspaceEditable) {
          res.status(403).json({ error: "ingen_prosjektredigering" }); return;
        }
        if (!mockupAccess || !roleCanEditMockupProject(mockupAccess.access_role)) {
          res.status(403).json({ error: "ingen_mockup_redigering" }); return;
        }
        if (!feedPlan) {
          res.status(404).json({ error: "feed_plan_ikke_funnet" }); return;
        }
        if (!feedPlan.posts.some((post) => post.id === feedPostId)) {
          res.status(404).json({ error: "feed_post_ikke_funnet" }); return;
        }

        const inserted = await pool.query<{ id: string }>(
          `INSERT INTO role_room_feed_mockup_links
             (workspace_project_id,platform,feed_post_id,mockup_project_id,
              mockup_created_by,created_by_user_id,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,now())
           ON CONFLICT (
             workspace_project_id,platform,feed_post_id,mockup_project_id,mockup_created_by
           ) DO UPDATE SET updated_at=role_room_feed_mockup_links.updated_at
           RETURNING id::text`,
          [
            workspaceProjectId, platform, feedPostId, mockupAccess.id,
            mockupAccess.created_by, actor.userId,
          ],
        );
        const row = await readLink(pool, inserted.rows[0].id);
        res.status(201).json({ link: row ? mapLink(row) : null });
      } catch (error) {
        console.error("[feed-mockup-links/create]", error);
        res.status(500).json({ error: "opprett_feil", detail: "internal_error" });
      }
    },
  );

  app.delete("/api/role-room/feed-mockup-links/:linkId", async (req: Request, res: Response) => {
    const actor = await actorFor(pool, activeSessions, req, res);
    if (!actor) return;
    const linkId = cleanId(req.params.linkId, 40);
    if (!UUID_PATTERN.test(linkId)) { res.status(400).json({ error: "ugyldig_kobling" }); return; }
    try {
      const link = await readLink(pool, linkId);
      if (!link) { res.status(404).json({ error: "kobling_ikke_funnet" }); return; }
      if (!await canEditBothSides(pool, actor, link)) {
        res.status(403).json({ error: "ingen_redigeringstilgang" }); return;
      }
      await pool.query("DELETE FROM role_room_feed_mockup_links WHERE id=$1::uuid", [linkId]);
      res.json({ ok: true });
    } catch (error) {
      console.error("[feed-mockup-links/delete]", error);
      res.status(500).json({ error: "slett_feil", detail: "internal_error" });
    }
  });

  app.post(
    "/api/role-room/feed-mockup-links/:linkId/apply-output",
    express.json({ limit: "3mb" }),
    async (req: Request, res: Response) => {
      const actor = await actorFor(pool, activeSessions, req, res);
      if (!actor) return;
      const linkId = cleanId(req.params.linkId, 40);
      const imageDataUrl = typeof req.body?.imageDataUrl === "string" ? req.body.imageDataUrl.trim() : "";
      const imageName = cleanId(req.body?.fileName, 200) || "mockup-studio-render.png";
      const requestedRevision = Number(req.body?.mockupRevision);
      if (!UUID_PATTERN.test(linkId) || !/^data:image\/(?:png|jpeg|webp);base64,/i.test(imageDataUrl)) {
        res.status(400).json({ error: "ugyldig_output" }); return;
      }
      if (imageDataUrl.length > MAX_DATA_URL_LENGTH) {
        res.status(413).json({ error: "output_for_stor", maxBytes: MAX_DATA_URL_LENGTH }); return;
      }

      try {
        const link = await readLink(pool, linkId);
        if (!link) { res.status(404).json({ error: "kobling_ikke_funnet" }); return; }
        if (!await canEditBothSides(pool, actor, link)) {
          res.status(403).json({ error: "ingen_redigeringstilgang" }); return;
        }
        const revision = Number(link.mockup_revision || 1);
        if (Number.isSafeInteger(requestedRevision) && requestedRevision > 0 && requestedRevision !== revision) {
          res.status(409).json({ error: "mockup_versjon_utdatert", currentRevision: revision }); return;
        }

        const result = await applyFeedPostImageLocked(pool, {
          workspaceProjectId: link.workspace_project_id,
          platform: link.platform,
          feedPostId: link.feed_post_id,
          imageDataUrl,
          imageName,
          updatedBy: actor.userId,
          link: {
            id: link.id,
            mockupProjectId: link.mockup_project_id,
            mockupCreatedBy: link.mockup_created_by,
            revision,
            confirmApprovedAssetChange: req.body?.confirmApprovedAssetChange === true,
          },
        });
        if (!result.ok) {
          const status = result.reason === "approval_confirmation_required" ? 409
            : result.reason === "published_post_locked" ? 409 : 404;
          res.status(status).json({ error: result.reason, approvalState: result.approvalState ?? null }); return;
        }
        res.json(result);
      } catch (error) {
        console.error("[feed-mockup-links/apply-output]", error);
        res.status(500).json({ error: "apply_feil", detail: "internal_error" });
      }
    },
  );
}
