import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

const mocks = vi.hoisted(() => ({
  canAccessProject: vi.fn(),
  canEditProject: vi.fn(),
  loadFeedPlan: vi.fn(),
  applyFeedPostImageLocked: vi.fn(),
  resolveActor: vi.fn(),
  projectAccess: vi.fn(),
  createFeedMockupProject: vi.fn(),
  uploadUserFile: vi.fn(),
  hardDeleteUserFile: vi.fn(),
  getUserFileContent: vi.fn(),
}));

vi.mock("./project-team-routes.js", () => ({
  canAccessProject: mocks.canAccessProject,
  canEditProject: mocks.canEditProject,
}));
vi.mock("./role-room-feed-plan.js", () => ({
  isSupportedPlatform: (value: unknown) => ["instagram", "tiktok", "linkedin"].includes(String(value)),
  loadFeedPlan: mocks.loadFeedPlan,
}));
vi.mock("./role-room-feed-post-image.js", () => ({
  applyFeedPostImageLocked: mocks.applyFeedPostImageLocked,
}));
vi.mock("./role-room-research-mockups.js", () => ({
  createFeedMockupProject: mocks.createFeedMockupProject,
}));
vi.mock("./role-room-user-storage-service.js", () => ({
  uploadUserFile: mocks.uploadUserFile,
  hardDeleteUserFile: mocks.hardDeleteUserFile,
  getUserFileContent: mocks.getUserFileContent,
}));
vi.mock("./role-room-mockup-studio-routes.js", () => ({
  resolveMockupStudioActor: mocks.resolveActor,
  getMockupStudioProjectAccess: mocks.projectAccess,
  roleCanEditMockupProject: (role: string) => role === "owner" || role === "editor",
}));

import { registerRoleRoomFeedMockupLinkRoutes } from "./role-room-feed-mockup-links-routes.js";

type Handler = (req: Request, res: Response) => Promise<void> | void;

const LINK_ID = "00000000-0000-4000-8000-000000000001";
const TEST_PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgo=";
const linkRow = {
  id: LINK_ID,
  workspace_project_id: "workspace-1",
  platform: "instagram",
  feed_post_id: "post-1",
  mockup_project_id: "mockup-1",
  mockup_created_by: "owner-1",
  mockup_name: "MedSide feed",
  mockup_revision: 3,
  feed_post_title: "Trygg journalføring",
  feed_post_caption: "Caption",
  last_applied_revision: null,
  last_applied_sha256: null,
  last_applied_at: null,
  created_at: "2026-09-05T10:00:00.000Z",
  updated_at: "2026-09-05T10:00:00.000Z",
  variant_id: "00000000-0000-4000-8000-000000000002",
  variant_label: "Primær",
  media_type: "image",
  variant_active: true,
  output_position: 1,
  sync_status: "not_sent",
  last_error: null,
  latest_output_id: null,
  latest_output_mime: null,
  ready_output_count: 0,
  expected_output_count: 1,
};

function response() {
  const headers = new Map<string, string>();
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
    setHeader(name: string, value: string) {
      headers.set(name, value);
      return this;
    },
    send(body: unknown) {
      this.body = body;
      return this;
    },
    headers,
  } as unknown as Response & { statusCode: number; body: unknown;
    headers: Map<string, string>;
  };
}

function harness() {
  const handlers = new Map<string, Handler>();
  const register = (method: string) => (path: string, ...values: unknown[]) => {
    handlers.set(`${method} ${path}`, values.at(-1) as Handler);
    };
  const app = {
    get: register("GET"),
    post: register("POST"),
    delete: register("DELETE"),
  } as unknown as Express;
  let linked = false;
  let outputStored = false;
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("SELECT link.workspace_project_id,output.file_id::text")) {
      return {
        rows: [
          {
            workspace_project_id: "workspace-1",
            file_id: "00000000-0000-4000-8000-000000000004",
            file_owner_user_id: "user-1",
          },
        ],
      };
    }
    if (sql.includes("SELECT id::text FROM role_room_feed_mockup_links")) {
      return { rows: linked ? [{ id: LINK_ID }] : [] };
    }
    if (sql.includes("INSERT INTO role_room_feed_mockup_variants")) {
      return { rows: [{ id: linkRow.variant_id }] };
    }
    if (sql.includes("INSERT INTO role_room_feed_mockup_links")) {
      linked = true;
      return { rows: [{ id: LINK_ID }] };
    }
    if (sql.includes("INSERT INTO role_room_feed_mockup_outputs")) {
      if (outputStored) return { rows: [] };
      outputStored = true;
      return { rows: [{ id: "00000000-0000-4000-8000-000000000003" }] };
    }
    if (
      sql.includes(
        "SELECT id::text,status,file_id::text,file_name,updated_at FROM role_room_feed_mockup_outputs",
      )
    ) {
      return {
        rows: [
          {
            id: "00000000-0000-4000-8000-000000000003",
            status: "ready",
            file_id: "00000000-0000-4000-8000-000000000004",
            file_name: "first-render.png",
            updated_at: "2026-09-05T10:00:00.000Z",
          },
        ],
      };
    }
    if (sql.includes("SELECT DISTINCT ON (sibling.output_position)")) {
      return {
        rows: [
          {
            url_id: "00000000-0000-4000-8000-000000000003",
            file_name: "first-render.png",
          },
        ],
      };
    }
    if (sql.includes("FROM role_room_feed_mockup_links"))
      return { rows: [linkRow] };
    return { rows: [] };
  });
  const release = vi.fn();
  registerRoleRoomFeedMockupLinkRoutes(app, {
    pool: {
      query,
      connect: vi.fn(async () => ({ query, release })),
    } as unknown as Pool,
    activeSessions: new Map(),
  });
  return { handlers, query };
}

function request(
  body: Record<string, unknown>,
  params: Record<string, string> = {},
) {
  return {
    body,
    params,
    query: {},
    headers: { authorization: "Bearer test" },
  } as unknown as Request;
}

describe("Role Room feed/mockup link routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveActor.mockResolvedValue({
      userId: "user-1",
      email: "user@example.no",
      displayName: "User",
    });
    mocks.canAccessProject.mockResolvedValue(true);
    mocks.canEditProject.mockResolvedValue(true);
    mocks.projectAccess.mockResolvedValue({
      id: "mockup-1",
      created_by: "owner-1",
      revision: 3,
      access_role: "owner",
    });
    mocks.loadFeedPlan.mockResolvedValue({ posts: [{ id: "post-1" }] });
    mocks.applyFeedPostImageLocked.mockResolvedValue({
      ok: true,
      changed: true,
      approvalState: "draft",
    });
    mocks.uploadUserFile.mockResolvedValue({
      ok: true,
      file: { id: "00000000-0000-4000-8000-000000000004" },
    });
    mocks.getUserFileContent.mockResolvedValue({
      ok: true,
      body: new Uint8Array([65, 66, 67]),
      displayName: "first-render.png",
      contentType: "image/png",
    });
  });

  it("rejects link creation without an authenticated actor", async () => {
    mocks.resolveActor.mockResolvedValueOnce(null);
    const { handlers, query } = harness();
    const res = response();
    await handlers.get("POST /api/role-room/feed-mockup-links")!(
      request({}),
      res,
    );
    expect(res.statusCode).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it("requires edit access to both workspace and Mockup Studio project", async () => {
    mocks.projectAccess.mockResolvedValueOnce({
      id: "mockup-1",
      created_by: "owner-1",
      revision: 3,
      access_role: "viewer",
    });
    const { handlers, query } = harness();
    const res = response();
    await handlers.get("POST /api/role-room/feed-mockup-links")!(
      request({
        workspaceProjectId: "workspace-1",
        platform: "instagram",
        feedPostId: "post-1",
        mockupProjectId: "mockup-1",
      }),
      res,
    );
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "ingen_mockup_redigering" });
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO role_room_feed_mockup_links"),
      expect.anything(),
    );
  });

  it("validates that the JSONB feed post exists before creating the relation", async () => {
    mocks.loadFeedPlan.mockResolvedValueOnce({
      posts: [{ id: "another-post" }],
    });
    const { handlers, query } = harness();
    const res = response();
    await handlers.get("POST /api/role-room/feed-mockup-links")!(
      request({
        workspaceProjectId: "workspace-1",
        platform: "instagram",
        feedPostId: "post-1",
        mockupProjectId: "mockup-1",
      }),
      res,
    );
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "feed_post_ikke_funnet" });
    expect(query).not.toHaveBeenCalled();
  });

  it("requires a generated slide set instead of linking one project to a carousel", async () => {
    mocks.loadFeedPlan.mockResolvedValueOnce({
      posts: [{ id: "post-1", mediaType: "carousel" }],
    });
    const { handlers, query } = harness();
    const res = response();
    await handlers.get("POST /api/role-room/feed-mockup-links")!(
      request({
        workspaceProjectId: "workspace-1",
        platform: "instagram",
        feedPostId: "post-1",
        mockupProjectId: "mockup-1",
      }),
      res,
    );
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual(
      expect.objectContaining({ error: "karusell_krever_slide_sett" }),
    );
    expect(query).not.toHaveBeenCalled();
  });

  it("uses ON CONFLICT and returns the same stable link on repeated creation", async () => {
    const { handlers, query } = harness();
    const handler = handlers.get("POST /api/role-room/feed-mockup-links")!;
    const body = {
      workspaceProjectId: "workspace-1",
      platform: "instagram",
      feedPostId: "post-1",
      mockupProjectId: "mockup-1",
    };
    const first = response();
    const second = response();
    await handler(request(body), first);
    await handler(request(body), second);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect((first.body as { link: { id: string } }).link.id).toBe(LINK_ID);
    expect((second.body as { link: { id: string } }).link.id).toBe(LINK_ID);
    const insertCalls = query.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO role_room_feed_mockup_links"),
    );
    expect(insertCalls).toHaveLength(1);
    expect(String(insertCalls[0][0])).toContain("ON CONFLICT");
  });

  it("checks both sides again before applying a rendered output", async () => {
    mocks.canEditProject.mockResolvedValueOnce(false);
    const { handlers } = harness();
    const res = response();
    await handlers.get(
      "POST /api/role-room/feed-mockup-links/:linkId/apply-output",
    )!(
      request(
        { imageDataUrl: TEST_PNG_DATA_URL, mockupRevision: 3 },
        { linkId: LINK_ID },
      ),
      res,
    );
    expect(res.statusCode).toBe(403);
    expect(mocks.applyFeedPostImageLocked).not.toHaveBeenCalled();
  });

  it("stores one durable output and reuses it when the same revision and bytes are sent twice", async () => {
    const { handlers, query } = harness();
    const handler = handlers.get(
      "POST /api/role-room/feed-mockup-links/:linkId/apply-output",
    )!;
    const body = {
      mediaDataUrl: TEST_PNG_DATA_URL,
      fileName: "first-render.png",
      mockupRevision: 3,
    };
    const first = response();
    const second = response();
    await handler(request(body, { linkId: LINK_ID }), first);
    mocks.applyFeedPostImageLocked.mockResolvedValueOnce({
      ok: true,
      changed: false,
      approvalState: "draft",
    });
    await handler(
      request({ ...body, fileName: "renamed.png" }, { linkId: LINK_ID }),
      second,
    );

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(mocks.uploadUserFile).toHaveBeenCalledTimes(1);
    expect(mocks.applyFeedPostImageLocked).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        imageName: "first-render.png",
        assetUrl:
          "/api/role-room/feed-mockup-outputs/00000000-0000-4000-8000-000000000003/content",
      }),
    );
    expect(
      query.mock.calls.filter(([sql]) =>
        String(sql).includes("INSERT INTO role_room_feed_mockup_outputs"),
      ),
    ).toHaveLength(2);
  });

  it("marks the durable output as failed when storage throws before registration", async () => {
    mocks.uploadUserFile.mockRejectedValueOnce(
      new Error("storage unavailable"),
    );
    const { handlers, query } = harness();
    const res = response();
    await handlers.get(
      "POST /api/role-room/feed-mockup-links/:linkId/apply-output",
    )!(
      request(
        { mediaDataUrl: TEST_PNG_DATA_URL, mockupRevision: 3 },
        { linkId: LINK_ID },
      ),
      res,
    );
    expect(res.statusCode).toBe(500);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("error_message='storage_exception'"),
      ["00000000-0000-4000-8000-000000000003"],
    );
  });

  it("rejects content whose bytes do not match its declared image type", async () => {
    const { handlers } = harness();
    const res = response();
    await handlers.get(
      "POST /api/role-room/feed-mockup-links/:linkId/apply-output",
    )!(
      request(
        { mediaDataUrl: "data:image/png;base64,QUJD", mockupRevision: 3 },
        { linkId: LINK_ID },
      ),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(mocks.uploadUserFile).not.toHaveBeenCalled();
  });

  it("streams protected output bytes after project access is verified", async () => {
    const { handlers } = harness();
    const res = response();
    const handler = handlers.get(
      "GET /api/role-room/feed-mockup-outputs/:outputId/content",
    )!;
    await handler(
      request({}, { outputId: "00000000-0000-4000-8000-000000000003" }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(mocks.canAccessProject).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "workspace-1",
    );
    expect(mocks.getUserFileContent).toHaveBeenCalledWith(expect.anything(), {
      userId: "user-1",
      fileId: "00000000-0000-4000-8000-000000000004",
    });
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(
      (res as unknown as { headers: Map<string, string> }).headers.get(
        "Content-Type",
      ),
    ).toBe("image/png");
  });
});
