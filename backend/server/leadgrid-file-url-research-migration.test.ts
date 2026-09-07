import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("0536 Leadgrid file and URL-research project scope", () => {
  const migration = readFileSync(
    new URL("../migrations/0536_leadgrid_file_url_research_project_scope.sql", import.meta.url),
    "utf8",
  );

  it("backfills only from authoritative persisted lead relationships", () => {
    expect(migration).toContain("FROM crm_customers lead");
    expect(migration).toContain("lead.id = attachment.lead_id");
    expect(migration).toContain("lead.organization_id = attachment.organization_id");
    expect(migration).toContain("lead.import_batch_id = batch.id");
    expect(migration).toContain("HAVING COUNT(DISTINCT lead.project_id) = 1");
    expect(migration).not.toContain("discovery_meta");
  });

  it("keeps unresolved legacy rows nullable and explicitly fail-closed", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS project_id TEXT");
    expect(migration).not.toContain("ALTER COLUMN project_id SET NOT NULL");
    expect(migration).toContain("NULL legacy rows fail closed");
    expect(migration).toContain("NULL means unresolved legacy data and is never user-readable");
  });

  it("enforces tuple foreign keys and project-feed indexes", () => {
    expect(migration).toContain("FOREIGN KEY (organization_id, project_id, lead_id)");
    expect(migration).toContain("REFERENCES crm_customers(organization_id, project_id, id)");
    expect(migration).toContain("leadgrid_lead_files_project_scope_fkey");
    expect(migration).toContain("leadgrid_url_research_batches_project_scope_fkey");
    expect(migration).toContain("idx_leadgrid_lead_files_project_feed");
    expect(migration).toContain("idx_leadgrid_url_research_batches_project_feed");
    expect(migration).toContain("idx_leadgrid_url_research_batches_project_active");
  });
});
