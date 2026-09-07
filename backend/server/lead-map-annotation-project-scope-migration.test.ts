import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Lead Map annotation project-scope migration", () => {
  const migration = readFileSync(
    new URL(
      "../migrations/0535_leadgrid_map_annotation_project_scope.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("replaces the stale casting project reference with a tenant tuple FK", () => {
    expect(migration).toContain(
      "DROP CONSTRAINT IF EXISTS map_annotations_project_id_fkey",
    );
    expect(migration).toContain(
      "FOREIGN KEY (organization_id, project_id)\n  REFERENCES leadgrid_projects(organization_id, id)",
    );
    expect(migration).toContain(
      "VALIDATE CONSTRAINT map_annotations_leadgrid_project_fkey",
    );
  });

  it("backfills target-lead projects only through an exact organization tuple", () => {
    expect(migration).toContain("annotation.target_lead_id = lead.id");
    expect(migration).toContain(
      "annotation.organization_id = lead.organization_id",
    );
    expect(migration).toContain(
      "project.organization_id = lead.organization_id",
    );
  });

  it("fails closed on unresolved projects or cross-scope target leads", () => {
    expect(migration).toContain("invalid_projects BIGINT");
    expect(migration).toContain("invalid_targets BIGINT");
    expect(migration).toContain(
      "lead.organization_id = annotation.organization_id",
    );
    expect(migration).toContain("lead.project_id = annotation.project_id");
  });

  it("enforces the target lead tuple and adds the list index", () => {
    expect(migration).toContain(
      "CHECK (target_lead_id IS NULL OR project_id IS NOT NULL)",
    );
    expect(migration).toContain(
      "FOREIGN KEY (target_lead_id, organization_id, project_id)",
    );
    expect(migration).toContain(
      "REFERENCES crm_customers(id, organization_id, project_id)",
    );
    expect(migration).toContain(
      "ON map_annotations (organization_id, project_id, created_at DESC)",
    );
  });
});
