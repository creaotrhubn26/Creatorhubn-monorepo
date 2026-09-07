import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0522_leadgrid_discovery_profile_targeting.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Leadgrid Discovery profile targeting migration", () => {
  it("stores queryable territory and only confirmed Google Place IDs", () => {
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS discovery_territory_code VARCHAR(48)",
    );
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS google_place_id_confirmed_at TIMESTAMPTZ",
    );
    expect(migration).toContain(
      "idx_crm_customers_org_project_discovery_territory",
    );
    expect(migration).toContain(
      "google_place_id_confirmed_at IS NULL OR google_place_id IS NOT NULL",
    );
    expect(migration).not.toMatch(
      /ADD COLUMN IF NOT EXISTS google_(?:rating|phone|website|name)/,
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS leadgrid_discovery_place_confirmations",
    );
    expect(migration).toContain("CHECK (expires_at > issued_at)");
    expect(migration).not.toMatch(
      /leadgrid_discovery_place_confirmations[\s\S]{0,1200}(?:display_name|rating|phone|website_uri)/i,
    );
  });

  it("enforces one active territory per project and durable batch replay", () => {
    expect(migration).toContain("uq_leadgrid_discovery_profile_territory");
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS leadgrid_discovery_profile_batches",
    );
    expect(migration).toContain(
      "PRIMARY KEY (organization_id, project_id, idempotency_key)",
    );
    expect(migration).toContain("FOREIGN KEY (organization_id, project_id)");
    expect(migration).toContain(
      "REFERENCES leadgrid_projects(organization_id, id)",
    );
    expect(migration).toContain(
      "CHECK (cardinality(profile_ids) BETWEEN 1 AND 10)",
    );
  });

  it("prevents candidate and feedback lead links from crossing project scope", () => {
    expect(migration).toContain("UNIQUE (id, organization_id, project_id)");
    expect(migration).toContain(
      "leadgrid_discovery_candidates_existing_lead_scope_fk",
    );
    expect(migration).toContain(
      "leadgrid_discovery_candidates_imported_lead_scope_fk",
    );
    expect(migration).toContain("leadgrid_discovery_feedback_lead_scope_fk");
    expect(
      migration.match(
        /REFERENCES crm_customers\(id, organization_id, project_id\)/g,
      ),
    ).toHaveLength(3);
  });
});
