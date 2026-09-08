import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0560_leadgrid_domain_project_onboarding.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Leadgrid domain onboarding migration", () => {
  it("binds previews to actor, tenant, expiry and the committed project", () => {
    expect(migration).toContain("leadgrid_project_onboarding_previews");
    expect(migration).toMatch(/organization_id\s+UUID NOT NULL/);
    expect(migration).toMatch(/created_by\s+VARCHAR\(255\) NOT NULL/);
    expect(migration).toContain("expires_at");
    expect(migration).toContain("leadgrid_project_onboarding_commit_pair_check");
    expect(migration).toContain("FOREIGN KEY (organization_id, committed_project_id)");
    expect(migration).toContain("REFERENCES leadgrid_projects(organization_id, id)");
  });

  it("keeps the analysis plan structured and expired previews indexable", () => {
    expect(migration).toContain("CHECK (jsonb_typeof(plan) = 'object')");
    expect(migration).toContain("idx_leadgrid_project_onboarding_expiry");
    expect(migration).toContain("WHERE committed_at IS NULL");
  });
});
