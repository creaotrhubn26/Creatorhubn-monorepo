import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  getLeadgridSession,
  getLeadgridProjectAccess,
  loadAccessibleLeadgridProject,
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

  it("derives the organization from the selected project membership", async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({
      rows: [
        {
          id: "project-a",
          organization_id: "11111111-1111-4111-8111-111111111111",
          name: "Outbound Norge",
          description: null,
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
      industry: "regnskap",
      status: "active",
      createdBy: "owner-a",
      memberRole: "selger",
    });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("FROM leadgrid_projects p");
    expect(sql).toContain("JOIN organization_members om");
    expect(sql).toContain("om.organization_id = p.organization_id");
    expect(sql).toContain("om.user_id = $2");
    expect(sql).toContain("p.organization_id IS NOT NULL");
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
