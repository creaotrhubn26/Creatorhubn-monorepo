import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0533_leadgrid_project_team_scope.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Leadgrid project team scope migration", () => {
  it("creates dedicated tenant-bound member and invitation stores", () => {
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS leadgrid_project_members",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS leadgrid_project_invitations",
    );
    expect(migration.match(
      /FOREIGN KEY \(organization_id, project_id\)[\s\S]{0,100}REFERENCES leadgrid_projects\(organization_id, id\)/g,
    )).toHaveLength(2);
    expect(migration).toContain(
      "UNIQUE (organization_id, project_id, user_id)",
    );
    expect(migration).toContain("token VARCHAR(128) NOT NULL UNIQUE");
  });

  it("does not repurpose or drop the Role Room casting membership stores", () => {
    expect(migration).not.toMatch(/ALTER TABLE project_members/i);
    expect(migration).not.toMatch(/ALTER TABLE project_invitations/i);
    expect(migration).not.toMatch(/DROP TABLE/i);
    expect(migration).toContain("FROM project_members legacy");
    expect(migration).toContain("information_schema.columns");
    expect(migration).toContain("column_name = 'last_active_at'");
    expect(migration).toContain("column_name = 'meta'");
    expect(migration).toContain("NULL::TIMESTAMPTZ");
    expect(migration).toContain("FROM project_invitations legacy");
  });

  it("backfills creators as owners and scopes all conflicts by tenant", () => {
    expect(migration).toContain("project.created_by");
    expect(migration).toContain("'owner'");
    expect(migration).toContain(
      "ON CONFLICT (organization_id, project_id, user_id) DO UPDATE",
    );
    expect(migration).toContain("SET role = 'owner'");
  });

  it("backfills a non-privileged organization role for direct project members", () => {
    expect(migration).toContain("INSERT INTO organization_members");
    expect(migration).toContain("FROM leadgrid_project_members member");
    expect(migration).toContain("BOOL_AND(member.role = 'viewer')");
    expect(migration).toContain("ELSE 'member'");
    expect(migration).toContain(
      "ON CONFLICT (organization_id, user_id) DO NOTHING",
    );
    expect(migration).not.toMatch(
      /INSERT INTO organization_members[\s\S]+?THEN 'admin'/,
    );
  });

  it("maps every legacy project-invitation role into the strict new contract", () => {
    expect(migration).toContain("WHEN legacy.role = 'owner' THEN 'owner'");
    expect(migration).toContain("WHEN legacy.role = 'viewer' THEN 'viewer'");
    expect(migration).toContain("ELSE 'member'");
    expect(migration).not.toContain(
      "legacy.role IN ('owner', 'member', 'viewer')",
    );
  });

  it("normalizes inconsistent legacy acceptance pairs without failing", () => {
    expect(migration).toContain(
      "(legacy.accepted_at IS NULL) <> (legacy.accepted_by_user_id IS NULL)",
    );
    expect(migration).toContain("THEN LEAST(legacy.expires_at, NOW())");
    expect(migration).toContain(
      "leadgrid_project_invitations_acceptance_check",
    );
  });
});
