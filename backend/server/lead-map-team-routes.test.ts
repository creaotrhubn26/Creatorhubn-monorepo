import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mail = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("./transactional-email-service.js", () => ({
  sendTransactionalEmail: mail.send,
}));

import { registerLeadMapOrgRoutes } from "./lead-map-org-routes.js";
import { registerLeadMapTeamRoutes } from "./lead-map-team-routes.js";

const actorId = "user-a";
const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "dentum-oslo";
const token = "session-token";

type CallOptions = {
  body?: unknown;
  params?: Record<string, string>;
  authorization?: string;
  session?: Record<string, unknown>;
};

function accessibleProject(overrides: Record<string, unknown> = {}) {
  return {
    id: projectId,
    organization_id: organizationId,
    name: "Dentum – klinikkpilot Oslo",
    description: null,
    project_type: "b2b_sales",
    industry: "tannhelse",
    status: "active",
    created_by: actorId,
    member_role: "owner",
    ...overrides,
  };
}

function makeHarness(pool: Pool) {
  const routes = new Map<string, RequestHandler[]>();
  const app = {
    get: (path: string, ...handlers: RequestHandler[]) =>
      routes.set(`GET ${path}`, handlers),
    post: (path: string, ...handlers: RequestHandler[]) =>
      routes.set(`POST ${path}`, handlers),
    delete: (path: string, ...handlers: RequestHandler[]) =>
      routes.set(`DELETE ${path}`, handlers),
    patch: (path: string, ...handlers: RequestHandler[]) =>
      routes.set(`PATCH ${path}`, handlers),
  } as unknown as Express;
  registerLeadMapTeamRoutes({
    app,
    pool,
    activeSessions: new Map([[token, { userId: actorId }]]),
  });

  return {
    async call(method: string, path: string, options: CallOptions = {}) {
      const handler = routes.get(`${method} ${path}`)?.at(-1);
      if (!handler) throw new Error(`Missing route ${method} ${path}`);
      const req = {
        body: options.body ?? {},
        params: options.params ?? {},
        query: {},
        headers: options.authorization
          ? { authorization: options.authorization }
          : {},
        session: options.session,
      } as unknown as Request;
      let status = 200;
      let body: unknown;
      const res = {
        status(code: number) {
          status = code;
          return this;
        },
        json(payload: unknown) {
          body = payload;
          return this;
        },
      } as unknown as Response;
      await handler(req, res, vi.fn());
      return { status, body };
    },
  };
}

describe("Leadgrid project team routes", () => {
  beforeEach(() => {
    vi.stubEnv("LEADGRID_PUBLIC_URL", "https://app.leadgrid.no");
    mail.send.mockReset();
    mail.send.mockResolvedValue({
      sent: true,
      reason: null,
      provider: "resend",
      messageId: "mail-1",
      accepted: ["invitee@example.no"],
      errorMessage: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("denies member reads before touching team data when project ACL fails", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const response = await makeHarness({ query } as unknown as Pool).call(
      "GET",
      "/api/admin-room/lead-map/projects/:id/members",
      {
        authorization: `Bearer ${token}`,
        params: { id: "foreign-project" },
      },
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "project_not_found" });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("FROM leadgrid_projects p");
  });

  it("creates a tenant-scoped invitation and never emits Role Room branding", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM leadgrid_projects p")) {
        return { rows: [accessibleProject()] };
      }
      if (sql.includes("SELECT pm.id::text")) return { rows: [] };
      if (sql.includes("SELECT name, email FROM users")) {
        return { rows: [{ name: "Daniel Qazi", email: "daniel@example.no" }] };
      }
      if (sql.includes("INSERT INTO leadgrid_project_invitations")) {
        return { rows: [{ id: "invite-1" }] };
      }
      return { rows: [], rowCount: 1 };
    });

    const response = await makeHarness({ query } as unknown as Pool).call(
      "POST",
      "/api/admin-room/lead-map/projects/:id/invitations",
      {
        authorization: `Bearer ${token}`,
        params: { id: projectId },
        body: { email: "invitee@example.no", role: "viewer" },
      },
    );

    expect(response.status).toBe(200);
    const invitationInsert = query.mock.calls.find(([sql]) =>
      sql.includes("INSERT INTO leadgrid_project_invitations"),
    );
    expect(invitationInsert?.[1]?.slice(0, 4)).toEqual([
      organizationId,
      projectId,
      "invitee@example.no",
      "viewer",
    ]);
    expect(mail.send).toHaveBeenCalledTimes(1);
    const email = mail.send.mock.calls[0][0];
    expect(email.text).toContain("https://app.leadgrid.no/lead-map/accept?token=");
    expect(email.html).toContain("Leadgrid · leadgrid.no");
    expect(email.fromLabel).toBe("Leadgrid");
    expect(`${email.subject} ${email.text} ${email.html}`).not.toContain("theroleroom.com");
  });

  it("does not let a regular project member mutate the team", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM leadgrid_projects p")) {
        return {
          rows: [accessibleProject({ created_by: "owner-b", member_role: "member" })],
        };
      }
      if (sql.includes("SELECT role FROM leadgrid_project_members")) {
        return { rows: [{ role: "member" }] };
      }
      return { rows: [] };
    });

    const response = await makeHarness({ query } as unknown as Pool).call(
      "POST",
      "/api/admin-room/lead-map/projects/:id/invitations",
      {
        authorization: `Bearer ${token}`,
        params: { id: projectId },
        body: { email: "invitee@example.no", role: "member" },
      },
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "kun_eier_kan_invitere" });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("keeps the immutable project creator as an owner", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM leadgrid_projects p")) {
        return { rows: [accessibleProject()] };
      }
      return { rows: [], rowCount: 1 };
    });
    const harness = makeHarness({ query } as unknown as Pool);

    const demote = await harness.call(
      "PATCH",
      "/api/admin-room/lead-map/projects/:id/members/:userId",
      {
        authorization: `Bearer ${token}`,
        params: { id: projectId, userId: actorId },
        body: { role: "viewer" },
      },
    );
    const remove = await harness.call(
      "DELETE",
      "/api/admin-room/lead-map/projects/:id/members/:userId",
      {
        authorization: `Bearer ${token}`,
        params: { id: projectId, userId: actorId },
      },
    );

    expect(demote.status).toBe(409);
    expect(demote.body).toEqual({ error: "prosjektoppretter_ma_forbli_eier" });
    expect(remove.status).toBe(409);
    expect(remove.body).toEqual({ error: "prosjektoppretter_kan_ikke_fjernes" });
    expect(query.mock.calls.some(([sql]) => sql.includes("UPDATE leadgrid_project_members"))).toBe(false);
    expect(query.mock.calls.some(([sql]) => sql.includes("DELETE FROM leadgrid_project_members"))).toBe(false);
  });

  it("accepts a project invitation atomically using the verified DB email", async () => {
    const clientQuery = vi.fn(async (sql: string) => {
      if (sql.includes("FROM users")) {
        return { rows: [{ email: "invitee@example.no" }] };
      }
      if (sql.includes("FROM leadgrid_project_invitations pi")) {
        return {
          rows: [{
            id: "invite-1",
            organization_id: organizationId,
            project_id: projectId,
            email: "Invitee@Example.no",
            role: "viewer",
            expires_at: "2099-01-01T00:00:00.000Z",
            accepted_at: null,
          }],
        };
      }
      if (sql.includes("INSERT INTO leadgrid_project_members")) {
        return { rows: [{ role: "viewer" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    const release = vi.fn();
    const connect = vi.fn(async () => ({ query: clientQuery, release }));

    const response = await makeHarness({
      query: vi.fn(),
      connect,
    } as unknown as Pool).call(
      "POST",
      "/api/lead-map/invitations/:token/accept",
      {
        authorization: `Bearer ${token}`,
        params: { token: "project-invite-token" },
      },
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      target: "project",
      targetId: projectId,
      projectId,
      role: "viewer",
    });
    expect(clientQuery.mock.calls.map(([sql]) => sql.trim())).toEqual(
      expect.arrayContaining(["BEGIN", "COMMIT"]),
    );
    expect(clientQuery.mock.calls.find(([sql]) =>
      sql.includes("FROM leadgrid_project_invitations pi"),
    )?.[0]).toContain("FOR UPDATE OF pi");
    expect(clientQuery.mock.calls.find(([sql]) =>
      sql.includes("INSERT INTO leadgrid_project_members"),
    )?.[1]).toEqual([organizationId, projectId, actorId, "viewer"]);
    expect(clientQuery.mock.calls.find(([sql]) =>
      sql.includes("INSERT INTO organization_members"),
    )?.[1]).toEqual([organizationId, actorId, "viewer"]);
    expect(clientQuery.mock.calls.find(([sql]) =>
      sql.includes("INSERT INTO organization_members"),
    )?.[0]).toContain("ON CONFLICT (organization_id, user_id) DO NOTHING");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("fails closed and rolls back when the verified DB email does not match", async () => {
    const clientQuery = vi.fn(async (sql: string) => {
      if (sql.includes("FROM users")) {
        return { rows: [{ email: "wrong@example.no" }] };
      }
      if (sql.includes("FROM leadgrid_project_invitations pi")) {
        return {
          rows: [{
            id: "invite-1",
            organization_id: organizationId,
            project_id: projectId,
            email: "invitee@example.no",
            role: "member",
            expires_at: "2099-01-01T00:00:00.000Z",
            accepted_at: null,
          }],
        };
      }
      return { rows: [], rowCount: 1 };
    });
    const release = vi.fn();
    const connect = vi.fn(async () => ({ query: clientQuery, release }));

    const response = await makeHarness({ query: vi.fn(), connect } as unknown as Pool).call(
      "POST",
      "/api/lead-map/invitations/:token/accept",
      {
        authorization: `Bearer ${token}`,
        params: { token: "project-invite-token" },
      },
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "feil_bruker" });
    expect(clientQuery.mock.calls.map(([sql]) => sql.trim())).toContain("ROLLBACK");
    expect(clientQuery.mock.calls.some(([sql]) =>
      sql.includes("INSERT INTO leadgrid_project_members"),
    )).toBe(false);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("accepts an organization invitation through the same locked route", async () => {
    const clientQuery = vi.fn(async (sql: string) => {
      if (sql.includes("FROM users")) {
        return { rows: [{ email: "invitee@example.no" }] };
      }
      if (sql.includes("FROM leadgrid_project_invitations pi")) return { rows: [] };
      if (sql.includes("FROM project_invitations pi")) {
        return {
          rows: [{
            id: "org-invite-1",
            organization_id: organizationId,
            email: "invitee@example.no",
            role: "markedssjef",
            sales_team_id: null,
            expires_at: "2099-01-01T00:00:00.000Z",
            accepted_at: null,
          }],
        };
      }
      if (sql.includes("INSERT INTO organization_members")) {
        return { rows: [{ role: "markedssjef" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    const release = vi.fn();
    const connect = vi.fn(async () => ({ query: clientQuery, release }));

    const response = await makeHarness({ query: vi.fn(), connect } as unknown as Pool).call(
      "POST",
      "/api/lead-map/invitations/:token/accept",
      {
        authorization: `Bearer ${token}`,
        params: { token: "org-invite-token" },
      },
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      target: "organization",
      targetId: organizationId,
      role: "markedssjef",
    });
    expect(clientQuery.mock.calls.find(([sql]) =>
      sql.includes("FROM project_invitations pi"),
    )?.[0]).toContain("FOR UPDATE OF pi");
    expect(clientQuery.mock.calls.map(([sql]) => sql.trim())).toContain("COMMIT");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("previews both invitation target types through one public route", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{
          email: "project@example.no",
          role: "viewer",
          expires_at: "2099-01-01T00:00:00.000Z",
          target_type: "project",
          target_name: "Dentum",
          inviter_name: "Daniel",
          accepted_at: null,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          email: "org@example.no",
          role: "member",
          expires_at: "2099-01-01T00:00:00.000Z",
          target_type: "organization",
          target_name: "CreatorHub",
          inviter_name: "Daniel",
          accepted_at: null,
        }],
      });
    const harness = makeHarness({ query } as unknown as Pool);

    const project = await harness.call("GET", "/api/lead-map/invitations/:token", {
      params: { token: "project-token" },
    });
    const organization = await harness.call("GET", "/api/lead-map/invitations/:token", {
      params: { token: "org-token" },
    });

    expect(project.body).toMatchObject({ targetType: "project", targetName: "Dentum" });
    expect(organization.body).toMatchObject({
      targetType: "organization",
      targetName: "CreatorHub",
    });
    expect(query.mock.calls[0][0]).toContain("UNION ALL");
  });

  it("registers the canonical public token routes exactly once", () => {
    const registrations: Array<{ method: string; path: string }> = [];
    const app = {
      get: (path: string) => registrations.push({ method: "GET", path }),
      post: (path: string) => registrations.push({ method: "POST", path }),
      delete: (path: string) => registrations.push({ method: "DELETE", path }),
      patch: (path: string) => registrations.push({ method: "PATCH", path }),
    } as unknown as Express;
    const pool = { query: vi.fn() } as unknown as Pool;
    const sessions = new Map<string, { userId: string }>();

    registerLeadMapTeamRoutes({ app, pool, activeSessions: sessions });
    registerLeadMapOrgRoutes({ app, pool, activeSessions: sessions });

    expect(registrations.filter(({ method, path }) =>
      method === "GET" && path === "/api/lead-map/invitations/:token",
    )).toHaveLength(1);
    expect(registrations.filter(({ method, path }) =>
      method === "POST" && path === "/api/lead-map/invitations/:token/accept",
    )).toHaveLength(1);
  });
});
