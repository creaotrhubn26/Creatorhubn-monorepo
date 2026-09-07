import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0539_leadgrid_agency_lead_promotion_scope.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("agency lead promotion migration", () => {
  it("stores one complete organization/project/CRM mapping on the source lead", () => {
    expect(migration).toContain("leadgrid_organization_id UUID");
    expect(migration).toContain("leadgrid_project_id TEXT");
    expect(migration).toContain("leadgrid_customer_id UUID");
    expect(migration).toContain("leadgrid_promoted_at TIMESTAMPTZ");
    expect(migration).toContain("agency_leads_leadgrid_mapping_complete_check");
    expect(migration).toMatch(
      /leadgrid_organization_id IS NULL[\s\S]+leadgrid_project_id IS NULL[\s\S]+leadgrid_customer_id IS NULL[\s\S]+leadgrid_promoted_at IS NULL[\s\S]+OR[\s\S]+leadgrid_organization_id IS NOT NULL[\s\S]+leadgrid_project_id IS NOT NULL[\s\S]+leadgrid_customer_id IS NOT NULL[\s\S]+leadgrid_promoted_at IS NOT NULL/,
    );
  });

  it("enforces both project and CRM tenant tuples in PostgreSQL", () => {
    expect(migration).toMatch(
      /FOREIGN KEY \(leadgrid_organization_id, leadgrid_project_id\)[\s\S]+REFERENCES leadgrid_projects\(organization_id, id\)/,
    );
    expect(migration).toMatch(
      /FOREIGN KEY \([\s\S]+leadgrid_organization_id,[\s\S]+leadgrid_project_id,[\s\S]+leadgrid_customer_id[\s\S]+\)[\s\S]+REFERENCES crm_customers\(organization_id, project_id, id\)/,
    );
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_agency_leads_leadgrid_customer");
  });

  it("only backfills unambiguous legacy project/customer relationships", () => {
    expect(migration).toContain("project.metadata ->> 'source_lead_id'");
    expect(migration).toContain("legacy_customer_scope");
    expect(migration).toMatch(
      /UPDATE crm_customers customer[\s\S]+SET organization_id = scope.organization_id/,
    );
    expect(migration).toContain("customer.organization_id IS NULL");
    expect(migration).toContain("HAVING COUNT(DISTINCT customer.id) = 1");
    expect(migration).toContain(
      "COUNT(DISTINCT (project.organization_id, project.id)) = 1",
    );
    expect(migration).toContain("source.leadgrid_customer_id IS NULL");
  });

  it("keeps promotion statuses explicit without adding another migration", () => {
    expect(migration).toContain("'converted', 'rejected'");
    expect(migration).not.toMatch(/CREATE TABLE IF NOT EXISTS leadgrid_projects/i);
  });
});
