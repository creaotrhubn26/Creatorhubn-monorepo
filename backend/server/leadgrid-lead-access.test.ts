import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const projectAccess = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: projectAccess.load,
}));

import { loadAccessibleLeadgridLead } from "./leadgrid-lead-access.js";

const leadId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-project";
const userId = "seller-a";

function poolWithLead(
  row: Record<string, unknown> | null = {
    id: leadId,
    organization_id: organizationId,
    project_id: projectId,
  },
) {
  const query = vi.fn(async (_sql: string, _params?: readonly unknown[]) => ({
    rows: row ? [row] : [],
  }));
  return { pool: { query } as unknown as Pick<Pool, "query">, query };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authoritative Leadgrid lead access", () => {
  it("returns null without consulting project access for an unknown or foreign lead", async () => {
    const { pool, query } = poolWithLead(null);

    await expect(
      loadAccessibleLeadgridLead(pool, { leadId, userId }),
    ).resolves.toBeNull();

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("c.id = $1::uuid"),
      [leadId],
    );
    expect(projectAccess.load).not.toHaveBeenCalled();
  });

  it("returns the same null for a hidden project in the caller's organization", async () => {
    const { pool } = poolWithLead();
    projectAccess.load.mockResolvedValue(null);

    await expect(
      loadAccessibleLeadgridLead(pool, { leadId, userId }),
    ).resolves.toBeNull();

    expect(projectAccess.load).toHaveBeenCalledWith(pool, projectId, userId);
  });

  it.each([
    ["foreign organization", "33333333-3333-4333-8333-333333333333", projectId],
    ["different project", organizationId, "another-project"],
  ])(
    "rejects a persisted/project-access %s mismatch",
    async (_label, projectOrg, accessibleProjectId) => {
      const { pool } = poolWithLead();
      projectAccess.load.mockResolvedValue({
        id: accessibleProjectId,
        organizationId: projectOrg,
      });

      await expect(
        loadAccessibleLeadgridLead(pool, { leadId, userId }),
      ).resolves.toBeNull();
    },
  );

  it("returns only the authoritative tuple for an authorized lead", async () => {
    const { pool, query } = poolWithLead();
    projectAccess.load.mockResolvedValue({
      id: projectId,
      organizationId,
      name: "Dentum",
    });

    await expect(
      loadAccessibleLeadgridLead(pool, { leadId, userId }),
    ).resolves.toEqual({ id: leadId, organizationId, projectId });

    const [sql] = query.mock.calls[0];
    expect(sql).toContain("c.organization_id IS NOT NULL");
    expect(sql).toContain("c.project_id IS NOT NULL");
  });

  it("fails closed for malformed identifiers without querying", async () => {
    const { pool, query } = poolWithLead();

    await expect(
      loadAccessibleLeadgridLead(pool, { leadId: "not-a-uuid", userId }),
    ).resolves.toBeNull();

    expect(query).not.toHaveBeenCalled();
    expect(projectAccess.load).not.toHaveBeenCalled();
  });
});
