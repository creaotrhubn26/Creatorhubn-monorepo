import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLeadgridSession: vi.fn(),
  loadAccessibleLeadgridProject: vi.fn(),
  resolveEffectivePermissions: vi.fn(),
  isModuleFeatureEnabled: vi.fn(),
}));

vi.mock("./leadgrid-project-access.js", () => ({
  getLeadgridSession: mocks.getLeadgridSession,
  loadAccessibleLeadgridProject: mocks.loadAccessibleLeadgridProject,
}));
vi.mock("./lead-map-permission-routes.js", () => ({
  resolveEffectivePermissions: mocks.resolveEffectivePermissions,
}));
vi.mock("./feature-flags/module-entitlement-resolver.js", () => ({
  isModuleFeatureEnabled: mocks.isModuleFeatureEnabled,
}));

import {
  createLeadgridMarketingBridge,
  findLeadgridMarketingProjectKey,
  getLeadgridMarketingAccess,
  isLeadgridMarketingProjectKey,
  leadgridMarketingAuthorizedFor,
  leadgridMarketingProjectKey,
  leadgridProjectIdFromMarketingKey,
  resolveLeadgridMarketingAccess,
} from "./leadgrid-marketing-bridge.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const leadgridProjectId = "salg-oslo";
const projectKey = `lg-${leadgridProjectId}`;
const session = { userId: "user-a", email: "a@example.com" };

function grantEverything() {
  mocks.loadAccessibleLeadgridProject.mockResolvedValue({
    id: leadgridProjectId,
    organizationId,
    name: "Salg Oslo",
  });
  mocks.resolveEffectivePermissions.mockResolvedValue({
    role: "markedssjef",
    permissions: new Set(["marketing.content.brief"]),
  });
  mocks.isModuleFeatureEnabled.mockResolvedValue(true);
}

function makePool(rows: Array<Record<string, unknown>> = []) {
  const query = vi.fn().mockResolvedValue({ rows, rowCount: rows.length });
  return { pool: { query } as unknown as Pool, query };
}

function makeReq(input: {
  path?: string;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
}): Request {
  return {
    path: input.path ?? "/",
    body: input.body ?? {},
    query: input.query ?? {},
    headers: {},
  } as unknown as Request;
}

function makeRes() {
  let status = 200;
  let body: unknown;
  const res = {
    status(value: number) {
      status = value;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  } as unknown as Response;
  return { res, read: () => ({ status, body }) };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("key helpers", () => {
  it("recognises and round-trips lg- keys", () => {
    expect(isLeadgridMarketingProjectKey(projectKey)).toBe(true);
    expect(isLeadgridMarketingProjectKey("lg-")).toBe(false);
    expect(isLeadgridMarketingProjectKey("lead-123")).toBe(false);
    expect(isLeadgridMarketingProjectKey(undefined)).toBe(false);
    expect(leadgridMarketingProjectKey(` ${leadgridProjectId} `)).toBe(projectKey);
    expect(leadgridProjectIdFromMarketingKey(projectKey)).toBe(leadgridProjectId);
    expect(leadgridProjectIdFromMarketingKey("casting-uuid")).toBeNull();
  });
});

describe("resolveLeadgridMarketingAccess", () => {
  it("rejects without a session", async () => {
    const { pool } = makePool();
    const r = await resolveLeadgridMarketingAccess(pool, { projectKey, session: null });
    expect(r).toMatchObject({ ok: false, status: 401, error: "innlogging_kreves" });
  });

  it("rejects non-lg keys and unknown projects with 404", async () => {
    const { pool } = makePool();
    mocks.loadAccessibleLeadgridProject.mockResolvedValue(null);
    expect(
      await resolveLeadgridMarketingAccess(pool, { projectKey: "casting-uuid", session }),
    ).toMatchObject({ ok: false, status: 404 });
    expect(
      await resolveLeadgridMarketingAccess(pool, { projectKey, session }),
    ).toMatchObject({ ok: false, status: 404, error: "project_not_found" });
    expect(mocks.loadAccessibleLeadgridProject).toHaveBeenCalledWith(
      pool,
      leadgridProjectId,
      session.userId,
    );
  });

  it("requires org membership, the marketing permission and the module", async () => {
    const { pool } = makePool();
    grantEverything();

    mocks.resolveEffectivePermissions.mockResolvedValueOnce({ role: null, permissions: new Set() });
    expect(
      await resolveLeadgridMarketingAccess(pool, { projectKey, session }),
    ).toMatchObject({ ok: false, status: 403, error: "ikke_medlem_av_org" });

    mocks.resolveEffectivePermissions.mockResolvedValueOnce({
      role: "selger",
      permissions: new Set(["leads.view"]),
    });
    expect(
      await resolveLeadgridMarketingAccess(pool, { projectKey, session }),
    ).toMatchObject({
      ok: false,
      status: 403,
      error: "mangler_tillatelse",
      required: "marketing.content.brief",
    });

    mocks.isModuleFeatureEnabled.mockResolvedValueOnce(false);
    expect(
      await resolveLeadgridMarketingAccess(pool, { projectKey, session }),
    ).toMatchObject({ ok: false, status: 403, error: "module_locked", module: "leadgrid:marketing" });
    expect(mocks.isModuleFeatureEnabled).toHaveBeenLastCalledWith(pool, {
      organizationId,
      moduleKey: "leadgrid",
      featureKey: "marketing",
      defaultState: "locked",
    });
  });

  it("returns the access record when everything passes", async () => {
    const { pool } = makePool();
    grantEverything();
    const r = await resolveLeadgridMarketingAccess(pool, { projectKey, session });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.access).toMatchObject({
      projectKey,
      leadgridProjectId,
      organizationId,
      projectName: "Salg Oslo",
      role: "markedssjef",
    });
    expect(r.access.permissions.has("marketing.content.brief")).toBe(true);
  });
});

describe("findLeadgridMarketingProjectKey", () => {
  it("ignores requests without any lg- reference", async () => {
    const { pool, query } = makePool();
    const r = await findLeadgridMarketingProjectKey(
      pool,
      makeReq({ path: "/casting-uuid", body: { projectId: "casting-uuid" } }),
    );
    expect(r).toEqual({ key: null, conflict: false });
    expect(query).not.toHaveBeenCalled();
  });

  it("reads the key from body, query and the first path segment", async () => {
    const { pool } = makePool();
    expect(
      await findLeadgridMarketingProjectKey(pool, makeReq({ body: { projectId: projectKey } })),
    ).toEqual({ key: projectKey, conflict: false });
    expect(
      await findLeadgridMarketingProjectKey(pool, makeReq({ query: { projectId: projectKey } })),
    ).toEqual({ key: projectKey, conflict: false });
    expect(
      await findLeadgridMarketingProjectKey(pool, makeReq({ path: `/${projectKey}/versions` })),
    ).toEqual({ key: projectKey, conflict: false });
  });

  it("resolves plan-, post- and pillar-keyed paths through the database", async () => {
    const planId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const { pool, query } = makePool([{ project_id: projectKey }]);
    expect(
      await findLeadgridMarketingProjectKey(pool, makeReq({ path: `/${planId}/posts` })),
    ).toEqual({ key: projectKey, conflict: false });
    expect(String(query.mock.calls[0]?.[0])).toContain("FROM role_room_marketing_plans");

    expect(
      await findLeadgridMarketingProjectKey(pool, makeReq({ path: `/posts/${planId}/accept` })),
    ).toEqual({ key: projectKey, conflict: false });
    expect(String(query.mock.calls[1]?.[0])).toContain("role_room_marketing_plan_posts");

    expect(
      await findLeadgridMarketingProjectKey(pool, makeReq({ path: `/pillars/${planId}` })),
    ).toEqual({ key: projectKey, conflict: false });
    expect(String(query.mock.calls[2]?.[0])).toContain("role_room_marketing_plan_pillars");
  });

  it("flags conflicting lg- keys in one request", async () => {
    const { pool } = makePool();
    const r = await findLeadgridMarketingProjectKey(
      pool,
      makeReq({ path: "/lg-a/scorecard", body: { projectId: "lg-b" } }),
    );
    expect(r).toEqual({ key: null, conflict: true });
  });
});

describe("createLeadgridMarketingBridge", () => {
  it("is a no-op for Role Room requests", async () => {
    const { pool } = makePool();
    const bridge = createLeadgridMarketingBridge({ pool, activeSessions: new Map() });
    const req = makeReq({ path: "/casting-uuid" });
    const { res, read } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await bridge(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(read().status).toBe(200);
    expect(getLeadgridMarketingAccess(req)).toBeNull();
    expect(mocks.getLeadgridSession).not.toHaveBeenCalled();
  });

  it("blocks lg- requests that fail Leadgrid authorization", async () => {
    const { pool } = makePool();
    mocks.getLeadgridSession.mockReturnValue(session);
    grantEverything();
    mocks.isModuleFeatureEnabled.mockResolvedValue(false);
    const bridge = createLeadgridMarketingBridge({ pool, activeSessions: new Map() });
    const req = makeReq({ path: `/${projectKey}` });
    const { res, read } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await bridge(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(read()).toEqual({
      status: 403,
      body: { success: false, error: "module_locked", module: "leadgrid:marketing" },
    });
  });

  it("attaches the access record for authorized lg- requests", async () => {
    const { pool } = makePool();
    mocks.getLeadgridSession.mockReturnValue(session);
    grantEverything();
    const bridge = createLeadgridMarketingBridge({ pool, activeSessions: new Map() });
    const req = makeReq({ body: { projectId: projectKey } });
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await bridge(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(getLeadgridMarketingAccess(req)?.projectKey).toBe(projectKey);
    expect(leadgridMarketingAuthorizedFor(req, projectKey)).toBe(true);
    expect(leadgridMarketingAuthorizedFor(req, "lg-other")).toBe(false);
    expect(leadgridMarketingAuthorizedFor(undefined, projectKey)).toBe(false);
  });
});
