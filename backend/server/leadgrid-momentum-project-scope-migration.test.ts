import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL(
    "../migrations/0538_leadgrid_momentum_project_scope.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("0538 Leadgrid momentum project scope migration", () => {
  it("creates strict project-bound goal and snapshot identities", () => {
    expect(sql).toContain(
      "CREATE TABLE IF NOT EXISTS leadgrid_project_sales_goals",
    );
    expect(sql).toContain(
      "CREATE TABLE IF NOT EXISTS leadgrid_project_momentum_snapshots",
    );
    expect(sql.match(/project_id TEXT NOT NULL/g)?.length).toBe(2);
    expect(sql.match(
      /FOREIGN KEY \(organization_id, project_id\)[\s\S]*?REFERENCES leadgrid_projects\(organization_id, id\)/g,
    )?.length).toBe(2);
    expect(sql).toContain(
      "UNIQUE (organization_id, project_id, year_month)",
    );
    expect(sql).toContain(
      "UNIQUE (organization_id, project_id, snapshot_date)",
    );
  });

  it("copies goal configuration to project baselines without sharing future rows", () => {
    expect(sql).toMatch(
      /INSERT INTO leadgrid_project_sales_goals[\s\S]*FROM leadgrid_org_sales_goals legacy[\s\S]*JOIN leadgrid_projects project/,
    );
    expect(sql).toContain(
      "ON CONFLICT (organization_id, project_id, year_month) DO NOTHING",
    );
  });

  it("only backfills derived snapshots when project attribution is unambiguous", () => {
    expect(sql).toMatch(
      /WITH single_project AS \([\s\S]*GROUP BY organization_id[\s\S]*HAVING COUNT\(\*\) = 1[\s\S]*INSERT INTO leadgrid_project_momentum_snapshots/,
    );
    expect(sql).toMatch(
      /FROM leadgrid_momentum_snapshots legacy[\s\S]*JOIN single_project project/,
    );
    expect(sql).toContain(
      "ON CONFLICT (organization_id, project_id, snapshot_date) DO NOTHING",
    );
  });

  it("retains legacy organization rows only as migration audit/rollback data", () => {
    expect(sql).toContain("COMMENT ON TABLE leadgrid_org_sales_goals");
    expect(sql).toContain("COMMENT ON TABLE leadgrid_momentum_snapshots");
    expect(sql).not.toMatch(/DELETE FROM leadgrid_(org_sales_goals|momentum_snapshots)/);
  });
});
