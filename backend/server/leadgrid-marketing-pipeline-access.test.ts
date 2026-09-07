import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0524_leadgrid_marketing_pipeline_access.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Leadgrid marketing pipeline role defaults", () => {
  it("lets operational marketing roles promote and follow up leads", () => {
    for (const role of ["markedssjef", "markedskoordinator"]) {
      expect(migration).toContain(`('${role}', 'leads.create')`);
      expect(migration).toContain(`('${role}', 'leads.update')`);
      expect(migration).toContain(`('${role}', 'visits.create')`);
      expect(migration).toContain(`('${role}', 'analytics.view_overview')`);
    }
  });

  it("keeps specialist roles read-only in the CRM", () => {
    for (const role of [
      "performance_marketer",
      "markedsanalytiker",
      "seo_spesialist",
      "content_ansvarlig",
    ]) {
      expect(migration).toContain(`('${role}', 'leads.view')`);
      expect(migration).not.toContain(`('${role}', 'leads.create')`);
      expect(migration).not.toContain(`('${role}', 'leads.update')`);
      expect(migration).not.toContain(`('${role}', 'leads.delete')`);
    }
  });

  it("does not grant destructive or administrative permissions", () => {
    expect(migration).not.toContain("'leads.delete'");
    expect(migration).not.toContain("'leads.assign'");
    expect(migration).not.toContain("'permissions.manage'");
    expect(migration).not.toContain("'members.change_role'");
  });
});
