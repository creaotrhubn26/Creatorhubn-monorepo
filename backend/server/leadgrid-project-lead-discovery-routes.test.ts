import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

import { __test } from "./leadgrid-project-lead-discovery-routes.js";

const softReferenceMigration = readFileSync(
  fileURLToPath(
    new URL(
      "../migrations/0472_leadgrid_project_soft_references.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("Leadgrid project discovery context", () => {
  it("loads the selected project from Leadgrid with tenant scope", async () => {
    const projectId = "leadgrid-project-1";
    const userId = "user-1";
    const organizationId = "11111111-1111-4111-8111-111111111111";
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM leadgrid_projects p")) {
        return {
          rows: [
            {
              id: projectId,
              name: "Leadgrid salg",
              description: "Vi hjelper økonomiteam med automatisering.",
              industry: "regnskapsbyråer",
              organization_id: organizationId,
            },
          ],
        };
      }
      if (sql.includes("FROM brand_kits")) return { rows: [] };
      if (sql.includes("FROM market_scans")) return { rows: [] };
      if (sql.includes("FROM organizations")) {
        expect(params).toEqual([organizationId]);
        return {
          rows: [
            {
              org_number: null,
              nace_code: "",
              nace_description: null,
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const context = await __test.loadProjectContext(
      { query } as unknown as Pool,
      projectId,
      userId,
    );

    expect(context).toMatchObject({
      id: projectId,
      name: "Leadgrid salg",
      organizationId,
      ownerUserId: userId,
      industryHint: "regnskapsbyråer",
      brandDescriptionHint: "Vi hjelper økonomiteam med automatisering.",
    });
    const [projectSql, projectParams] = query.mock.calls[0];
    expect(String(projectSql)).toContain("FROM leadgrid_projects p");
    expect(String(projectSql)).toContain("FROM organization_members om");
    expect(String(projectSql)).toContain("p.organization_id IS NULL");
    expect(String(projectSql)).toContain("p.created_by = $2");
    expect(String(projectSql)).toContain("'archived', 'deleted'");
    expect(String(projectSql)).not.toContain("casting_projects");
    expect(projectParams).toEqual([projectId, userId]);
  });

  it("does not expose a project outside the user's tenant", async () => {
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      expect(sql).toContain("FROM leadgrid_projects p");
      expect(sql).toContain("om.user_id = $2");
      expect(sql).toContain("p.organization_id IS NULL AND p.created_by = $2");
      expect(sql).not.toContain("owned_lead");
      expect(params).toEqual(["foreign-project", "user-1"]);
      return { rows: [] };
    });

    const project = await __test.loadAccessibleLeadgridProject(
      { query } as unknown as Pool,
      "foreign-project",
      "user-1",
    );

    expect(project).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("lets valid map coordinates override a stale project city", async () => {
    const context = {
      id: "leadgrid-project-1",
      name: "Leadgrid salg",
      ownerUserId: "user-1",
      organizationId: null,
      industryHint: "regnskapsbyråer",
      cityHint: "Bergen",
      positioningSummary: null,
      websiteUrl: null,
      targetAudienceHint: null,
      brandDescriptionHint: null,
      industryCategoryRaw: null,
      sellerNaceDescription: null,
      sellerNaceCode: null,
    };

    const resolved = await __test.buildDiscoveryQuery(
      context,
      { geo: { lat: 0, lng: 0, radius_km: 5 } },
      "test-user",
    );

    expect(__test.hasValidDiscoveryGeo({ lat: 0, lng: 0 })).toBe(true);
    expect(resolved).toEqual({
      query: "regnskapsbyråer",
      industry: "regnskapsbyråer",
      city: "",
    });
  });

  it("binds result batches to creator, tenant, category and project metadata", async () => {
    const organizationId = "11111111-1111-4111-8111-111111111111";
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      expect(sql).toContain("b.created_by::text = $3");
      expect(sql).toContain("b.organization_id IS NOT DISTINCT FROM $4::uuid");
      expect(sql).toContain("b.category = 'lead_discovery'");
      expect(sql).toContain("b.discovery_meta->>'project_id' = $2");
      expect(params).toEqual([
        "22222222-2222-4222-8222-222222222222",
        "leadgrid-project-1",
        "user-1",
        organizationId,
      ]);
      return {
        rows: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            organization_id: organizationId,
            discovery_meta: { project_id: "leadgrid-project-1" },
          },
        ],
      };
    });

    const batch = await __test.loadAccessibleDiscoveryBatch(
      { query } as unknown as Pool,
      "22222222-2222-4222-8222-222222222222",
      "leadgrid-project-1",
      "user-1",
      organizationId,
    );

    expect(batch?.discovery_meta.project_id).toBe("leadgrid-project-1");
  });

  it("returns no result batch when persisted scope does not match", async () => {
    const query = vi.fn(async () => ({ rows: [] }));

    const batch = await __test.loadAccessibleDiscoveryBatch(
      { query } as unknown as Pool,
      "22222222-2222-4222-8222-222222222222",
      "different-project",
      "user-1",
      "11111111-1111-4111-8111-111111111111",
    );

    expect(batch).toBeNull();
  });

  it("removes stale casting-project foreign keys without inferring ownership from child rows", () => {
    expect(softReferenceMigration).toContain(
      "DROP CONSTRAINT IF EXISTS crm_customers_project_id_fkey",
    );
    expect(softReferenceMigration).toContain(
      "DROP CONSTRAINT IF EXISTS market_scan_competitors_project_id_fkey",
    );
    expect(softReferenceMigration).toContain("FROM pg_constraint");
    expect(softReferenceMigration).toContain(
      "to_regclass('crm_customers')",
    );
    expect(softReferenceMigration).not.toContain("UPDATE leadgrid_projects");
    expect(softReferenceMigration).not.toContain("FROM brand_kits");
    expect(softReferenceMigration).not.toContain("FROM crm_customers");
  });
});
