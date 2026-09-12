import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0593_leadgrid_discovery_external_contact_references.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("migration 0593 external Discovery contact references", () => {
  it("adds a tenant-scoped idempotency key without persisting raw HPR", () => {
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS source_reference VARCHAR(64)",
    );
    expect(migration).toContain(
      "organization_id, project_id, customer_id, source, source_reference",
    );
    expect(migration).toContain("WHERE source_reference IS NOT NULL");
    expect(migration).toContain(
      "idx_leadgrid_customer_contacts_person_privacy_review",
    );
    expect(migration).toContain("WHERE subject_kind = 'person'");
    expect(migration).not.toMatch(/ADD COLUMN[^;]*hpr/iu);
  });
});
