import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0554_leadgrid_discovery_campaign_runs.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Leadgrid Discovery campaign migration", () => {
  it("enforces project scope for campaign, item, attempt and command data", () => {
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS leadgrid_discovery_campaign_runs",
    );
    expect(migration.match(/organization_id UUID NOT NULL/g)).toHaveLength(4);
    expect(migration.match(/project_id TEXT NOT NULL/g)).toHaveLength(4);
    expect(migration).toContain(
      "REFERENCES leadgrid_projects(organization_id, id)",
    );
    expect(migration).toContain(
      "REFERENCES leadgrid_discovery_profiles(organization_id, project_id, id)",
    );
    expect(migration).toContain(
      "REFERENCES leadgrid_discovery_runs(organization_id, project_id, id)",
    );
  });

  it("persists ordering, attempt history and exactly one active campaign per project", () => {
    expect(migration).toContain("profile_ids UUID[] NOT NULL");
    expect(migration).toContain("current_position SMALLINT NOT NULL DEFAULT 0");
    expect(migration).toContain(
      "source_cursor_map_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb",
    );
    expect(migration).toContain("UNIQUE (campaign_id, profile_id)");
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS leadgrid_discovery_campaign_attempts",
    );
    expect(migration).toContain(
      "ux_leadgrid_discovery_campaign_runs_one_active",
    );
    expect(migration).toContain(
      "WHERE status IN ('queued', 'running', 'cancel_requested')",
    );
  });

  it("makes start and commands durable and replay-safe", () => {
    expect(migration).toContain(
      "ux_leadgrid_discovery_campaign_runs_idempotency",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS leadgrid_discovery_campaign_commands",
    );
    expect(migration).toContain(
      "organization_id, project_id, campaign_id, command, idempotency_key",
    );
    expect(migration).toContain("request_hash CHAR(64) NOT NULL");
    expect(migration).toContain(
      "requested_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL",
    );
    expect(migration).not.toMatch(
      /requested_by VARCHAR\(255\).*ON DELETE RESTRICT/,
    );
    expect(migration).toContain("cancellation_requested_by VARCHAR(255)");
  });
});
