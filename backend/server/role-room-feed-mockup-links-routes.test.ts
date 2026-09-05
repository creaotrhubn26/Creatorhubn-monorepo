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
vi.mock("./role-room-mockup-studio-routes.js", () => ({
  resolveMockupStudioActor: mocks.resolveActor,
  getMockupStudioProjectAccess: mocks.projectAccess,
  roleCanEditMockupProject: (role: string) => role === "owner" || role === "editor",
}));

import { registerRoleRoomFeedMockupLinkRoutes } from "./role-room-feed-mockup-links-routes.js";

type Handler = (req: Request, res: Response) => Promise<void> | void;

const LINK_ID = "00000000-0000-4000-8000-000000000001";
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
};

function response() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  } as unknown as Response & { statusCode: number; body: unknown };
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
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("INSERT INTO role_room_feed_mockup_links")) return { rows: [{ id: LINK_ID }] };
    if (sql.includes("FROM role_room_feed_mockup_links")) return { rows: [linkRow] };
    return { rows: [] };
  });
  registerRoleRoomFeedMockupLinkRoutes(app, {
    pool: { query } as unknown as Pool,
    activeSessions: new Map(),
  });
  return { handlers, query };
}

function request(body: Record<string, unknown>, params: Record<string, string> = {}) {
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
    mocks.resolveActor.mockResolvedValue({ userId: "user-1", email: "user@example.no", displayName: "User" });
    mocks.canAccessProject.mockResolvedValue(true);
    mocks.canEditProject.mockResolvedValue(true);
    mocks.projectAccess.mockResolvedValue({
      id: "mockup-1",
      created_by: "owner-1",
      revision: 3,
      access_role: "owner",
    });
    mocks.loadFeedPlan.mockResolvedValue({ posts: [{ id: "post-1" }] });
    mocks.applyFeedPostImageLocked.mockResolvedValue({ ok: true, changed: true, approvalState: "draft" });
  });

  it("rejects link creation without an authenticated actor", async () => {
    mocks.resolveActor.mockResolvedValueOnce(null);
    const { handlers, query } = harness();
    const res = response();
    await handlers.get("POST /api/role-room/feed-mockup-links")!(request({}), res);
    expect(res.statusCode).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it("requires edit access to both workspace and Mockup Studio project", async () => {
    mocks.projectAccess.mockResolvedValueOnce({
      id: "mockup-1", created_by: "owner-1", revision: 3, access_role: "viewer",
    });
    const { handlers, query } = harness();
    const res = response();
    await handlers.get("POST /api/role-room/feed-mockup-links")!(request({
      workspaceProjectId: "workspace-1",
      platform: "instagram",
      feedPostId: "post-1",
      mockupProjectId: "mockup-1",
    }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "ingen_mockup_redigering" });
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO role_room_feed_mockup_links"), expect.anything());
  });

  it("validates that the JSONB feed post exists before creating the relation", async () => {
    mocks.loadFeedPlan.mockResolvedValueOnce({ posts: [{ id: "another-post" }] });
    const { handlers, query } = harness();
    const res = response();
    await handlers.get("POST /api/role-room/feed-mockup-links")!(request({
      workspaceProjectId: "workspace-1",
      platform: "instagram",
      feedPostId: "post-1",
      mockupProjectId: "mockup-1",
    }), res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "feed_post_ikke_funnet" });
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
    const insertCalls = query.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO role_room_feed_mockup_links"));
    expect(insertCalls).toHaveLength(2);
    expect(String(insertCalls[0][0])).toContain("ON CONFLICT");
  });

  it("checks both sides again before applying a rendered output", async () => {
    mocks.canEditProject.mockResolvedValueOnce(false);
    const { handlers } = harness();
    const res = response();
    await handlers.get("POST /api/role-room/feed-mockup-links/:linkId/apply-output")!(
      request({ imageDataUrl: "data:image/png;base64,QUJD", mockupRevision: 3 }, { linkId: LINK_ID }),
      res,
    );
    expect(res.statusCode).toBe(403);
    expect(mocks.applyFeedPostImageLocked).not.toHaveBeenCalled();
  });
});
