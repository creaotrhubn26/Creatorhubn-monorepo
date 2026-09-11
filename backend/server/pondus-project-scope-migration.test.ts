import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.resolve(process.cwd(), "migrations/0575_pondus_project_scope.sql"),
  "utf8",
);

describe("Pondus project scope migration", () => {
  it("binds templates and usage to the canonical organization/project pair", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS project_id TEXT");
    expect(migration).toContain("FOREIGN KEY (org_id, project_id)");
    expect(migration).toContain("FOREIGN KEY (organization_id, project_id)");
    expect(migration).toContain("REFERENCES leadgrid_projects(organization_id, id)");
  });

  it("does not guess a project for historical usage without a lead", () => {
    expect(migration).toContain("pu.lead_id = c.id");
    expect(migration).not.toMatch(/LIMIT\s+1/i);
  });
});
