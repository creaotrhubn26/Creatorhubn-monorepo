import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0564_leadgrid_discovery_clinic_grouping.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("migration 0564 clinic grouping", () => {
  it("adds bounded candidate classifications and a scoped location index", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS entity_kind");
    expect(migration).toContain("normalized_location_key");
    expect(migration).toContain(
      "idx_leadgrid_discovery_candidates_clinic_location",
    );
    expect(migration).toContain("multiple clinic candidates");
    expect(migration).toContain("dental_entity_with_employees");
    expect(migration).toContain("dental_entity_with_public_website");
  });

  it("stores contacts under the same organization, project and customer", () => {
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS leadgrid_customer_contacts",
    );
    expect(migration).toContain(
      "FOREIGN KEY (customer_id, organization_id, project_id)",
    );
    expect(migration).toContain(
      "FOREIGN KEY (organization_id, project_id, source_candidate_id)",
    );
    expect(migration).toContain(
      "ux_leadgrid_customer_contacts_discovery_source",
    );
  });
});
