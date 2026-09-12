import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

describe("Leadgrid project reporting migration", () => {
  it("reconciles scheduled-report storage and binds project to organization", () => {
    const migration = readFileSync(
      new URL(
        "../migrations/0525_leadgrid_scheduled_reports_project_scope.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS leadgrid_scheduled_reports");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS project_id TEXT");
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ",
    );
    expect(migration).toContain("column_name = 'sent_at'");
    expect(migration).toContain("ALTER COLUMN created_at SET NOT NULL");
    expect(migration).toContain("FOREIGN KEY (organization_id, project_id)");
    expect(migration).toContain("REFERENCES leadgrid_projects(organization_id, id)");
    expect(migration).toContain("idx_leadgrid_scheduled_reports_due_project");
    expect(migration).toContain("leadgrid_scheduled_report_log");
  });
});
