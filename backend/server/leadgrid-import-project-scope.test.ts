import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { __test } from "./leadgrid-import-routes.js";

describe("Leadgrid CSV import project data flow", () => {
  it("deduplicates inside the authoritative organization/project tuple", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    await __test.findDuplicate(
      { query } as never,
      {
        ownerUserId: "user-1",
        organizationId: "00000000-0000-4000-8000-000000000001",
        projectId: "dentum-oslo",
        strategy: "email",
        lead: {
          name: "Dentum Clinic",
          city: "Oslo",
          email: "Hei@Dentum.no",
          phone: null,
        },
      },
    );

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("organization_id = $2::uuid");
    expect(sql).toContain("project_id = $3");
    expect(sql).not.toContain("OR owner_user_id");
    expect(params).toEqual([
      "hei@dentum.no",
      "00000000-0000-4000-8000-000000000001",
      "dentum-oslo",
    ]);
  });

  it("persists all mapped fields and binds leads plus batches to project", () => {
    const source = readFileSync(fileURLToPath(import.meta.url.replace(
      /leadgrid-import-project-scope\.test\.ts$/,
      "leadgrid-import-routes.ts",
    )), "utf8");

    expect(source).toContain("owner_user_id, organization_id, project_id");
    expect(source).toContain("lead_category, notes, linkedin_url, instagram_url, facebook_url");
    expect(source).toContain("employee_count_estimate, ai_opportunity_score");
    expect(source).toContain("id, organization_id, project_id, owner_user_id");
    expect(source).toContain("pg_advisory_xact_lock");
    expect(source).toContain("commit_key_hash");
    expect(source).toContain("import_project_changed");
  });

  it("ships a project FK, retry key and project-history index", () => {
    const migration = readFileSync(
      fileURLToPath(new URL(
        "../migrations/0540_leadgrid_csv_import_project_scope.sql",
        import.meta.url,
      )),
      "utf8",
    );
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS project_id TEXT");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS commit_key_hash TEXT");
    expect(migration).toContain("leadgrid_import_batches_project_scope_fkey");
    expect(migration).toContain("uq_leadgrid_import_batches_commit_key");
    expect(migration).toContain("COUNT(DISTINCT project_id) = 1");
  });
});
