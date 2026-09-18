import { readFileSync } from "node:fs";
import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import {
  enforceOrgStatus,
  isLeadgridOrgStatusExempt,
  resolveCanonicalOrgAccess,
} from "./org-status-enforcement.js";

type Scenario = {
  statuses?: Record<string, {
    status: string;
    pause_reason?: string | null;
    pause_resume_at?: string | null;
  }>;
  users?: Record<string, {
    role: string;
    active_org_id?: string | null;
    is_active?: boolean;
  }>;
  overrides?: Record<string, string | null>;
  orgMemberships?: Record<string, string[]>;
  enterpriseMemberships?: Record<string, string[]>;
  orgOwners?: Record<string, string>;
  resourceOrgs?: Record<string, string | null>;
  failStatus?: boolean;
};

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "33333333-3333-4333-8333-333333333333";
const USER = "22222222-2222-4222-8222-222222222222";
const LEAD = "44444444-4444-4444-8444-444444444444";

function fakePool(scenario: Scenario = {}) {
  const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
    const sql = String(sqlValue);
    const id = String(params[0] ?? "");
    if (/FROM\s+users\b/i.test(sql)) {
      const row = scenario.users?.[id];
      return {
        rows: row ? [{ ...row, is_active: row.is_active ?? true }] : [],
        rowCount: row ? 1 : 0,
      };
    }
    if (/FROM\s+leadgrid_org_overrides\b/i.test(sql)) {
      const value = scenario.overrides?.[id];
      return {
        rows: value == null ? [] : [{ override_org_id: value }],
        rowCount: value == null ? 0 : 1,
      };
    }
    if (/FROM\s+organization_members\b/i.test(sql)) {
      if (/organization_id::text\s*=\s*\$1/i.test(sql)) {
        const organizationId = String(params[0] ?? "");
        const userId = String(params[1] ?? "");
        const allowed = (scenario.orgMemberships?.[userId] ?? [])
          .includes(organizationId);
        return { rows: allowed ? [{ '?column?': 1 }] : [], rowCount: allowed ? 1 : 0 };
      }
      const rows = (scenario.orgMemberships?.[id] ?? [])
        .map((organization_id) => ({ organization_id }));
      return { rows, rowCount: rows.length };
    }
    if (/FROM\s+enterprise_team_members\b/i.test(sql)) {
      if (/organization_id::text\s*=\s*\$1/i.test(sql)) {
        const organizationId = String(params[0] ?? "");
        const userId = String(params[1] ?? "");
        const allowed = (scenario.enterpriseMemberships?.[userId] ?? [])
          .includes(organizationId);
        return { rows: allowed ? [{ '?column?': 1 }] : [], rowCount: allowed ? 1 : 0 };
      }
      const rows = (scenario.enterpriseMemberships?.[id] ?? [])
        .map((organization_id) => ({ organization_id }));
      return { rows, rowCount: rows.length };
    }
    if (/FROM\s+crm_customers\s+c/i.test(sql)) {
      const organization_id = scenario.resourceOrgs?.[id];
      return {
        rows: organization_id === undefined ? [] : [{ organization_id }],
        rowCount: organization_id === undefined ? 0 : 1,
      };
    }
    if (/SELECT\s+status[\s\S]*FROM\s+organizations/i.test(sql)) {
      if (scenario.failStatus) throw new Error("db unavailable");
      const row = scenario.statuses?.[id];
      return {
        rows: row ? [{ pause_reason: null, pause_resume_at: null, ...row }] : [],
        rowCount: row ? 1 : 0,
      };
    }
    if (/FROM\s+organizations\b/i.test(sql)) {
      const organizationId = String(params[0] ?? "");
      const userId = String(params[1] ?? "");
      const allowed = scenario.orgOwners?.[organizationId] === userId;
      return { rows: allowed ? [{ '?column?': 1 }] : [], rowCount: allowed ? 1 : 0 };
    }
    throw new Error(`Unexpected SQL in test: ${sql}`);
  });
  return { pool: { query } as unknown as Pool, query };
}

function appFor(
  scenario: Scenario = {},
  session?: { token: string; userId: string; role?: string } | null,
  options: Parameters<typeof enforceOrgStatus>[2] = {},
) {
  const effectiveScenario: Scenario = {
    ...scenario,
    users: {
      [USER]: { role: "user", active_org_id: null },
      ...scenario.users,
    },
    orgMemberships: {
      [USER]: [ORG],
      ...scenario.orgMemberships,
    },
  };
  const effectiveSession = session === undefined
    ? { token: "session-a", userId: USER }
    : session;
  const { pool, query } = fakePool(effectiveScenario);
  const sessions = new Map<string, { userId: string; role?: string; email?: string }>();
  if (effectiveSession) {
    sessions.set(effectiveSession.token, {
      userId: effectiveSession.userId,
      role: effectiveSession.role,
    });
  }
  const app = express();
  app.use(express.json());
  if (effectiveSession) {
    app.use((req, _res, next) => {
      if (!req.headers.authorization) {
        req.headers.authorization = `Bearer ${effectiveSession.token}`;
      }
      next();
    });
  }
  const guard = enforceOrgStatus(pool, sessions, {
    isExempt: isLeadgridOrgStatusExempt,
    ...options,
  });
  app.use("/api/admin-room/lead-map", guard);
  app.use("/api/leadgrid", guard);
  app.use((_req, res) => res.status(200).json({ ok: true }));
  return { app, query };
}

describe("Leadgrid organization status enforcement", () => {
  it("is mounted once on both prefixes before the first Leadgrid route", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const firstRoute = source.indexOf('app.get("/api/leadgrid/ai-queue/health"');
    const leadgridMount = source.indexOf(
      'app.use("/api/leadgrid", leadgridOrgStatusGuard)',
    );
    const leadMapMount = source.indexOf(
      'app.use("/api/admin-room/lead-map", leadgridOrgStatusGuard)',
    );
    expect(firstRoute).toBeGreaterThan(-1);
    expect(leadgridMount).toBeGreaterThan(-1);
    expect(leadMapMount).toBeGreaterThan(-1);
    expect(leadgridMount).toBeLessThan(firstRoute);
    expect(leadMapMount).toBeLessThan(firstRoute);
    expect(source.match(/app\.use\("\/api\/leadgrid", leadgridOrgStatusGuard\)/g))
      .toHaveLength(1);
    expect(source.match(/app\.use\("\/api\/admin-room\/lead-map", leadgridOrgStatusGuard\)/g))
      .toHaveLength(1);
    expect(source).toContain("resolveSession: resolveActiveSessionFromRequest");
  });

  it.each([
    ["active", 200, 200],
    ["paused", 200, 423],
    ["read_only", 200, 423],
    ["suspended", 403, 403],
    ["closed", 403, 403],
  ])("enforces the core matrix for %s", async (status, getStatus, postStatus) => {
    const { app } = appFor({ statuses: { [ORG]: { status } } });
    await request(app)
      .get(`/api/leadgrid/protected?organization_id=${ORG}`)
      .expect(getStatus);
    await request(app)
      .post("/api/leadgrid/protected")
      .send({ organization_id: ORG })
      .expect(postStatus);
  });

  it("protects both Leadgrid prefixes", async () => {
    const { app } = appFor({ statuses: { [ORG]: { status: "paused" } } });
    await request(app)
      .post("/api/leadgrid/protected")
      .send({ organization_id: ORG })
      .expect(423);
    await request(app)
      .post("/api/admin-room/lead-map/protected")
      .send({ organization_id: ORG })
      .expect(423);
  });

  it("fails closed for writes without context but keeps legacy reads compatible", async () => {
    const { app, query } = appFor({}, null);
    await request(app).get("/api/leadgrid/protected").expect(200);
    const response = await request(app).post("/api/leadgrid/protected").expect(401);
    expect(response.body.error).toBe("authentication_required");
    expect(query).not.toHaveBeenCalled();
  });

  it("fails closed for Canvas reads without an authenticated session", async () => {
    const { app, query } = appFor({}, null);
    const response = await request(app)
      .get("/API/Leadgrid/Canvas")
      .expect(401);
    expect(response.body.error).toBe("authentication_required");
    expect(query).not.toHaveBeenCalled();
  });

  it("fails closed for Canvas reads when membership is no longer current", async () => {
    const { app } = appFor({
      users: { [USER]: { role: "user", active_org_id: ORG } },
      orgMemberships: { [USER]: [] },
      statuses: { [ORG]: { status: "active" } },
    });
    const response = await request(app)
      .get("/api/leadgrid/canvas")
      .expect(403);
    expect(response.body.error).toBe("org_access_denied");
  });

  it("rejects an unknown explicit organization on write", async () => {
    const { app } = appFor();
    const response = await request(app)
      .post("/api/leadgrid/protected")
      .send({ organization_id: ORG })
      .expect(403);
    expect(response.body.error).toBe("org_context_invalid");
  });

  it("blocks writes for an unexpected status and allows reads", async () => {
    const { app } = appFor({ statuses: { [ORG]: { status: "migrating" } } });
    await request(app)
      .get(`/api/leadgrid/protected?organization_id=${ORG}`)
      .expect(200);
    const response = await request(app)
      .post("/api/leadgrid/protected")
      .send({ organization_id: ORG })
      .expect(423);
    expect(response.body.error).toBe("org_status_not_allowed");
  });

  it("fails closed on status DB errors for writes only", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { app } = appFor({ failStatus: true });
    await request(app)
      .get(`/api/leadgrid/protected?organization_id=${ORG}`)
      .expect(200);
    const response = await request(app)
      .post("/api/leadgrid/protected")
      .send({ organization_id: ORG })
      .expect(503);
    expect(response.body.error).toBe("org_status_unavailable");
    errorSpy.mockRestore();
  });

  it("fails closed on status DB errors and unknown states for Canvas reads", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unavailable = appFor({
      users: { [USER]: { role: "user", active_org_id: ORG } },
      statuses: { [ORG]: { status: "active" } },
      failStatus: true,
    });
    const unavailableResponse = await request(unavailable.app)
      .get("/api/leadgrid/canvas")
      .expect(503);
    expect(unavailableResponse.body.error).toBe("org_status_unavailable");

    const unknown = appFor({
      users: { [USER]: { role: "user", active_org_id: ORG } },
      statuses: { [ORG]: { status: "migrating" } },
    });
    const unknownResponse = await request(unknown.app)
      .get("/api/leadgrid/canvas")
      .expect(423);
    expect(unknownResponse.body.error).toBe("org_status_not_allowed");
    errorSpy.mockRestore();
  });

  it("resolves a session's active org before a write", async () => {
    const { app, query } = appFor({
      users: { [USER]: { role: "user", active_org_id: ORG } },
      statuses: { [ORG]: { status: "paused" } },
    }, { token: "session-a", userId: USER });

    await request(app)
      .post("/api/leadgrid/protected")
      .set("Authorization", "Bearer session-a")
      .expect(423);

    const sql = query.mock.calls.map((call) => String(call[0]));
    expect(sql[0]).toContain("FROM users");
    expect(sql[1]).toContain("FROM leadgrid_org_overrides");
    expect(sql[2]).toContain("FROM organization_members");
    expect(sql[3]).toContain("FROM organizations");
  });

  it("does not guess between ambiguous memberships", async () => {
    const { app, query } = appFor({
      users: { [USER]: { role: "user", active_org_id: null } },
      orgMemberships: { [USER]: [ORG] },
      enterpriseMemberships: { [USER]: [OTHER_ORG] },
    }, { token: "session-a", userId: USER });

    const response = await request(app)
      .post("/api/leadgrid/protected")
      .set("Authorization", "Bearer session-a")
      .expect(403);
    expect(response.body.error).toBe("org_context_required");
    expect(query.mock.calls.map((call) => String(call[0])))
      .not.toEqual(expect.arrayContaining([expect.stringContaining("FROM organizations")]));
  });

  it("trusts only the database super_admin role for bypass", async () => {
    const bypass = appFor({
      users: { [USER]: { role: "super_admin", active_org_id: null } },
      statuses: { [ORG]: { status: "suspended" } },
    }, { token: "session-a", userId: USER, role: "user" });
    await request(bypass.app)
      .post("/api/leadgrid/protected")
      .set("Authorization", "Bearer session-a")
      .send({ organization_id: ORG })
      .expect(200);
    expect(bypass.query).toHaveBeenCalledTimes(1);

    const noBypass = appFor({
      users: { [USER]: { role: "user", active_org_id: null } },
      statuses: { [ORG]: { status: "suspended" } },
    }, { token: "session-b", userId: USER, role: "super_admin" });
    await request(noBypass.app)
      .post("/api/leadgrid/protected")
      .set("Authorization", "Bearer session-b")
      .send({ organization_id: ORG })
      .expect(403);
  });

  it("never interprets a generic resource id as an organization", async () => {
    const { app, query } = appFor({}, null);
    const response = await request(app)
      .post("/api/leadgrid/leads/resource-id/status")
      .expect(401);
    expect(response.body.error).toBe("authentication_required");
    expect(query).not.toHaveBeenCalled();
  });

  it("uses the lead's canonical org and rejects a conflicting body org", async () => {
    const { app, query } = appFor({
      resourceOrgs: { [LEAD]: ORG },
      statuses: {
        [ORG]: { status: "paused" },
        [OTHER_ORG]: { status: "active" },
      },
      orgMemberships: { [USER]: [ORG, OTHER_ORG] },
    });
    const response = await request(app)
      .patch(`/api/admin-room/lead-map/leads/${LEAD}/status`)
      .send({ organization_id: OTHER_ORG, status: "won" })
      .expect(403);
    expect(response.body.error).toBe("org_context_mismatch");
    expect(query.mock.calls.map((call) => String(call[0])))
      .not.toEqual(expect.arrayContaining([expect.stringContaining("SELECT status")]));
  });

  it("does not reveal org status to a session without membership", async () => {
    const { app, query } = appFor({
      statuses: { [OTHER_ORG]: { status: "paused", pause_reason: "private" } },
      orgMemberships: { [USER]: [ORG] },
    });
    const response = await request(app)
      .post("/api/leadgrid/protected")
      .send({ organization_id: OTHER_ORG })
      .expect(403);
    expect(response.body).toEqual({ error: "org_access_denied" });
    expect(query.mock.calls.map((call) => String(call[0])))
      .not.toEqual(expect.arrayContaining([expect.stringContaining("SELECT status")]));
  });

  it.each([
    ["GET", "/api/leadgrid/auth/google/start"],
    ["GET", "/api/leadgrid/ai-queue/health"],
    ["GET", "/api/leadgrid/realtime/health"],
    ["POST", "/api/leadgrid/events/email/opened"],
    ["POST", "/api/leadgrid/cron/backfill-organization-id"],
    ["POST", "/api/leadgrid/testimonials"],
    ["POST", "/api/leadgrid/self-onboard"],
    ["POST", "/api/leadgrid/self-onboard/consume-magic"],
    ["GET", "/api/leadgrid/p/public-token"],
    ["POST", "/api/leadgrid/intent/token/sign"],
    ["PUT", "/api/leadgrid/portal/token/notification-prefs"],
    ["GET", "/api/admin-room/lead-map/pitch-deck/p/token.pix"],
    ["POST", "/api/admin-room/lead-map/organizations"],
  ])("exempts only the intended public/service contract: %s %s", async (method, path) => {
    const { app, query } = appFor({ statuses: { [ORG]: { status: "suspended" } } });
    const response = method === "POST"
      ? await request(app).post(path).send({ organization_id: ORG })
      : method === "PUT"
        ? await request(app).put(path).send({ organization_id: ORG })
        : await request(app).get(`${path}?organization_id=${ORG}`);
    expect(response.status).toBe(200);
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    "/api/leadgrid/auth/admin",
    "/api/leadgrid/events/admin",
  ])("does not exempt unknown routes under public prefixes: %s", async (path) => {
    const { app, query } = appFor({}, null);
    const response = await request(app).post(path).send({}).expect(401);
    expect(response.body.error).toBe("authentication_required");
    expect(query).not.toHaveBeenCalled();
  });

  it("does not exempt webhook management routes", async () => {
    const { app } = appFor({ statuses: { [ORG]: { status: "paused" } } });
    await request(app)
      .post("/api/leadgrid/workflows/webhooks")
      .send({ organization_id: ORG })
      .expect(423);
    await request(app)
      .post("/api/leadgrid/webhooks/id/rotate-secret")
      .send({ organization_id: ORG })
      .expect(423);
  });

  it("allowedStatuses only tightens the core policy", async () => {
    const active = appFor(
      { statuses: { [ORG]: { status: "active" } } },
      undefined,
      { allowedStatuses: ["paused"] },
    );
    await request(active.app)
      .post("/api/leadgrid/protected")
      .send({ organization_id: ORG })
      .expect(423);

    const paused = appFor(
      { statuses: { [ORG]: { status: "paused" } } },
      undefined,
      { allowedStatuses: ["paused"] },
    );
    await request(paused.app)
      .post("/api/leadgrid/protected")
      .send({ organization_id: ORG })
      .expect(423);
  });
});

describe("canonical organization access for non-HTTP transports", () => {
  it.each([
    ["active", true, true],
    ["paused", true, false],
    ["read_only", true, false],
    ["suspended", false, false],
    ["closed", false, false],
    ["migrating", false, false],
  ])("maps %s to read=%s write=%s", async (status, canRead, canWrite) => {
    const { pool } = fakePool({
      users: { [USER]: { role: "user", is_active: true } },
      orgMemberships: { [USER]: [ORG] },
      statuses: { [ORG]: { status } },
    });
    await expect(resolveCanonicalOrgAccess(pool, USER, ORG)).resolves.toMatchObject({
      organizationId: ORG,
      status,
      canRead,
      canWrite,
      superAdminBypass: false,
    });
  });

  it("rejects inactive users and users without current membership", async () => {
    const inactive = fakePool({
      users: { [USER]: { role: "user", is_active: false } },
      orgMemberships: { [USER]: [ORG] },
      statuses: { [ORG]: { status: "active" } },
    });
    await expect(resolveCanonicalOrgAccess(inactive.pool, USER, ORG))
      .resolves.toBeNull();

    const removed = fakePool({
      users: { [USER]: { role: "user", is_active: true } },
      statuses: { [ORG]: { status: "active" } },
    });
    await expect(resolveCanonicalOrgAccess(removed.pool, USER, ORG))
      .resolves.toBeNull();
  });

  it("uses only the current database super-admin role for bypass", async () => {
    const { pool } = fakePool({
      users: { [USER]: { role: "super_admin", is_active: true } },
      statuses: { [ORG]: { status: "suspended" } },
    });
    await expect(resolveCanonicalOrgAccess(pool, USER, ORG)).resolves.toEqual({
      organizationId: ORG,
      status: "super_admin",
      canRead: true,
      canWrite: true,
      superAdminBypass: true,
    });
  });
});
