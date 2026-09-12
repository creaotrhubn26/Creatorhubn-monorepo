import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  getLeadgridSession,
  getLeadgridProjectAccess,
  hasLeadgridProjectsViewAllAccess,
  loadAccessibleLeadgridProject,
  loadAccessibleLeadgridProjectForCompliance,
  requireLeadgridProjectAccess,
} from "./leadgrid-project-access.js";

describe("Leadgrid project access", () => {
  it("reads hydrated bearer and legacy cookie sessions", () => {
    const bearer = getLeadgridSession(
      { headers: { authorization: "Bearer token-a" } } as never,
      new Map([["token-a", { userId: "user-a", email: "a@example.no" }]]),
    );
    const cookie = getLeadgridSession(
      { headers: {}, session: { userId: "user-b", role: "admin" } } as never,
      new Map(),
    );

    expect(bearer).toMatchObject({ userId: "user-a" });
    expect(cookie).toEqual({ userId: "user-b", role: "admin" });
  });

  it("allows a project member and derives the selected project's organization", async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({
      rows: [
        {
          id: "project-a",
          organization_id: "11111111-1111-4111-8111-111111111111",
          name: "Outbound Norge",
          description: null,
          project_type: "b2b_sales",
          industry: "regnskap",
          status: "active",
          created_by: "owner-a",
          member_role: "selger",
        },
      ],
    }));

    const project = await getLeadgridProjectAccess(
      { query } as unknown as Pick<Pool, "query">,
      { projectId: " project-a ", userId: " user-a " },
    );

    expect(project).toEqual({
      id: "project-a",
      organizationId: "11111111-1111-4111-8111-111111111111",
      name: "Outbound Norge",
      description: null,
      projectType: "b2b_sales",
      industry: "regnskap",
      status: "active",
      createdBy: "owner-a",
      memberRole: "selger",
    });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("FROM leadgrid_projects p");
    expect(sql).toContain("LEFT JOIN organization_members om");
    expect(sql).toContain("om.organization_id = p.organization_id");
    expect(sql).toContain("om.user_id = $2");
    expect(sql).toContain("p.organization_id IS NOT NULL");
    expect(sql).toContain("LEFT JOIN leadgrid_project_members pm");
    expect(sql).toContain("pm.organization_id = p.organization_id");
    expect(sql).toContain("pm.project_id = p.id");
    expect(sql).toContain("pm.user_id = $2");
    expect(sql).toContain("p.created_by = $2");
    expect(sql).toContain("OR pm.user_id IS NOT NULL");
    expect(sql).not.toContain("ORDER BY");
    expect(params).toEqual(["project-a", "user-a"]);

    await expect(
      loadAccessibleLeadgridProject(
        { query } as unknown as Pick<Pool, "query">,
        "project-a",
        "user-a",
      ),
    ).resolves.toMatchObject({ id: "project-a" });
  });

  it("honors projects.view_all defaults, grants and explicit revokes", async () => {
    const query = vi.fn(async () => ({ rows: [] }));

    await expect(
      getLeadgridProjectAccess({ query } as unknown as Pick<Pool, "query">, {
        projectId: "project-a",
        userId: "user-a",
      }),
    ).resolves.toBeNull();

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("om.role = 'admin'");
    expect(sql).toContain("FROM role_permissions defaults");
    expect(sql).toContain("defaults.permission_key = 'projects.view_all'");
    expect(sql).toContain("FROM leadgrid_user_permission_overrides granted");
    expect(sql).toContain("granted.effect = 'grant'");
    expect(sql).toContain("FROM leadgrid_user_permission_overrides denied");
    expect(sql).toContain("denied.effect = 'revoke'");
    expect(sql).toContain("NOT EXISTS");
    const normalizedSql = sql.replace(/\s+/g, " ");
    expect(normalizedSql).toMatch(
      /om\.user_id IS NOT NULL AND NOT EXISTS \(.+denied\.effect = 'revoke'.+\) AND \( om\.role = 'admin' OR EXISTS/s,
    );
    expect(params).toEqual(["project-a", "user-a"]);
  });

  it("resolves organization view_all with revoke ahead of admin/default/grant", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ allowed: false }] })
      .mockResolvedValueOnce({ rows: [{ allowed: true }] });

    const input = {
      organizationId: "11111111-1111-4111-8111-111111111111",
      userId: "user-a",
    };
    await expect(
      hasLeadgridProjectsViewAllAccess(
        { query } as unknown as Pick<Pool, "query">,
        input,
      ),
    ).resolves.toBe(false);
    await expect(
      hasLeadgridProjectsViewAllAccess(
        { query } as unknown as Pick<Pool, "query">,
        input,
      ),
    ).resolves.toBe(true);

    const sql = query.mock.calls[0][0].replace(/\s+/g, " ");
    expect(sql).toMatch(
      /AND NOT EXISTS \(.+effect = 'revoke'.+\) AND \( om\.role = 'admin' OR EXISTS/s,
    );
    expect(query.mock.calls[0][1]).toEqual([input.organizationId, input.userId]);
  });

  it("does not authorize a foreign, archived or organization-null project", async () => {
    const query = vi.fn(async () => ({ rows: [] }));

    await expect(
      requireLeadgridProjectAccess(
        { query } as unknown as Pick<Pool, "query">,
        { projectId: "foreign-project", userId: "user-a" },
      ),
    ).rejects.toMatchObject({
      code: "project_not_found",
      status: 404,
    });
  });

  it("relaxes only project status for GDPR compliance access", async () => {
    const archived = {
      id: "project-a",
      organization_id: "11111111-1111-4111-8111-111111111111",
      name: "Arkivert kunde",
      description: null,
      project_type: "b2b_sales",
      industry: "tannhelse",
      status: "archived",
      created_by: "owner-a",
      member_role: "teamleder",
    };
    const query = vi.fn(async (sql: string) => ({
      rows: sql.includes("p.status IS NULL") ? [] : [archived],
    }));
    const pool = { query } as unknown as Pick<Pool, "query">;

    await expect(loadAccessibleLeadgridProject(
      pool, "project-a", "leader-a",
    )).resolves.toBeNull();
    await expect(loadAccessibleLeadgridProjectForCompliance(
      pool, "project-a", "leader-a",
    )).resolves.toMatchObject({ id: "project-a", status: "archived" });

    const operationalSql = query.mock.calls[0][0];
    const complianceSql = query.mock.calls[1][0];
    expect(operationalSql).toContain("p.status IS NULL");
    expect(complianceSql).not.toContain("p.status IS NULL");
    for (const aclFragment of [
      "p.project_type IS NULL",
      "LEFT JOIN organization_members om",
      "LEFT JOIN leadgrid_project_members pm",
      "p.created_by = $2",
      "OR pm.user_id IS NOT NULL",
      "denied.effect = 'revoke'",
      "granted.effect = 'grant'",
    ]) {
      expect(operationalSql).toContain(aclFragment);
      expect(complianceSql).toContain(aclFragment);
    }
    expect(query.mock.calls[0][1]).toEqual(["project-a", "leader-a"]);
    expect(query.mock.calls[1][1]).toEqual(["project-a", "leader-a"]);
  });

  it("rejects missing identifiers before querying", async () => {
    const query = vi.fn();

    await expect(
      getLeadgridProjectAccess({ query } as unknown as Pick<Pool, "query">, {
        projectId: " ",
        userId: "user-a",
      }),
    ).rejects.toMatchObject({ code: "invalid_project_id", status: 400 });
    await expect(
      getLeadgridProjectAccess({ query } as unknown as Pick<Pool, "query">, {
        projectId: "project-a",
        userId: " ",
      }),
    ).rejects.toMatchObject({ code: "invalid_user_id", status: 400 });
    expect(query).not.toHaveBeenCalled();
  });
});
