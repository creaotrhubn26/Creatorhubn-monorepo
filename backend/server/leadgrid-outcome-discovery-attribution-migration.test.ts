import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0553_leadgrid_outcome_discovery_attribution.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Leadgrid outcome Discovery attribution migration", () => {
  it("adds nullable, project-scoped first-touch attribution", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS discovery_candidate_id UUID");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS discovery_run_id UUID");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS discovery_profile_id UUID");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS discovery_attributed_at TIMESTAMPTZ");
    expect(migration).toContain(
      "FOREIGN KEY (organization_id, project_id, discovery_candidate_id)",
    );
    expect(migration).toContain(
      "FOREIGN KEY (organization_id, project_id, discovery_run_id)",
    );
    expect(migration).toContain(
      "FOREIGN KEY (organization_id, project_id, discovery_profile_id)",
    );
    expect(migration).toContain(
      "FOREIGN KEY (discovery_run_id, discovery_candidate_id)",
    );
    expect(migration).toContain("leadgrid_outcome_events_discovery_shape_check");
  });

  it("backfills only authoritative imports at or before the outcome", () => {
    expect(migration).toContain("candidate.imported_lead_id = outcome.lead_id");
    expect(migration).toContain("feedback.organization_id = outcome.organization_id");
    expect(migration).toContain("feedback.project_id = outcome.project_id");
    expect(migration).toContain("occurrence.disposition = 'imported'");
    expect(migration).toContain("feedback.event_type = 'decision'");
    expect(migration).toContain("feedback.value = 'approve'");
    expect(migration).toContain("feedback.occurred_at <= outcome.occurred_at");
    expect(migration).toMatch(
      /ORDER BY feedback\.occurred_at ASC,\s+feedback\.created_at ASC,\s+feedback\.id ASC/,
    );
    expect(migration).not.toContain("campaign_ref");
    expect(migration).not.toContain("territory_code");
  });

  it("adds lookup and project/profile cohort indexes", () => {
    expect(migration).toContain(
      "idx_leadgrid_discovery_feedback_outcome_attribution",
    );
    expect(migration).toContain(
      "idx_leadgrid_outcome_events_discovery_profile_cohort",
    );
  });
});
