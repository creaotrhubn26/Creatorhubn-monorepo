import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const anbud = fs.readFileSync(
  path.resolve(process.cwd(), "migrations/0580_leadgrid_anbud_project_scope.sql"),
  "utf8",
);
const canvas = fs.readFileSync(
  path.resolve(process.cwd(), "migrations/0581_leadgrid_canvas_project_scope.sql"),
  "utf8",
);

describe("Dentum surface project-scope migrations", () => {
  it("isolates watches and pipeline entries by Leadgrid project", () => {
    expect(anbud).toContain("leadgrid_doffin_watches_project_required_check");
    expect(anbud).toContain("leadgrid_anbud_pipeline_project_required_check");
    expect(anbud).toContain("FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)");
    expect(anbud).toContain("uq_anbud_pipeline_project_doffin");
    expect(anbud).toContain("(organization_id, project_id, doffin_id)");
  });

  it("recovers only unambiguous historical Anbud rows", () => {
    expect(anbud.match(/HAVING COUNT\(\*\) = 1/g)).toHaveLength(2);
    expect(anbud).not.toMatch(/LIMIT\s+1/i);
  });

  it("isolates Canvas notes and recovers linked notes from their lead", () => {
    expect(canvas).toContain("leadgrid_canvas_notater_project_required_check");
    expect(canvas).toContain("FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)");
    expect(canvas).toContain("note.lead_id = customer.id::text");
    expect(canvas).toContain("customer.project_id IS NOT NULL");
    expect(canvas.match(/HAVING COUNT\(\*\) = 1/g)).toHaveLength(1);
    expect(canvas).not.toMatch(/LIMIT\s+1/i);
  });
});
