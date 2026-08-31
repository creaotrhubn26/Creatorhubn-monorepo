import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0473_leadgrid_discovery_platform.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Leadgrid Discovery platform database contract", () => {
  it("uses the repository's real identifier types", () => {
    expect(migration).toContain("project_id                  TEXT NOT NULL");
    expect(migration).toContain("organization_id            UUID NOT NULL");
    expect(migration).toContain(
      "created_by                  VARCHAR(255) REFERENCES users(id)",
    );
    expect(migration).toContain(
      "requested_by                VARCHAR(255) REFERENCES users(id)",
    );
    expect(migration).not.toMatch(/created_by\s+UUID\b/);
    expect(migration).not.toMatch(/requested_by\s+UUID\b/);
  });

  it("enforces organization and project agreement through composite keys", () => {
    expect(migration).toContain("leadgrid_projects_organization_id_id_key");
    expect(migration).toContain("UNIQUE (organization_id, id)");
    expect(migration).toContain("FOREIGN KEY (organization_id, project_id)");
    expect(migration).toContain(
      "REFERENCES leadgrid_projects(organization_id, id)",
    );
    expect(migration).toContain(
      "FOREIGN KEY (organization_id, project_id, run_id)",
    );
    expect(migration).toContain(
      "FOREIGN KEY (organization_id, project_id, candidate_id)",
    );
  });

  it("creates the normalized profile, run, candidate, occurrence and feedback model", () => {
    for (const table of [
      "leadgrid_discovery_profiles",
      "leadgrid_discovery_runs",
      "leadgrid_discovery_candidates",
      "leadgrid_discovery_run_candidates",
      "leadgrid_discovery_feedback",
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(migration).toContain("PRIMARY KEY (run_id, candidate_id)");
    expect(migration).toContain("ux_leadgrid_discovery_candidates_identity");
    expect(migration).not.toMatch(/google_(?:place_id|rating|review_count)/);
  });

  it("makes runs durable, replay-safe and queue-compatible", () => {
    expect(migration).toContain(
      "idempotency_key             VARCHAR(255) NOT NULL",
    );
    expect(migration).toContain(
      "request_hash                CHAR(64) NOT NULL",
    );
    expect(migration).toContain("ux_leadgrid_discovery_runs_idempotency");
    expect(migration).toContain(
      "background_job_id           UUID REFERENCES background_jobs(id)",
    );
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS lease_token UUID");
    expect(migration).toContain("execution_lease_token       UUID");
    expect(migration).toContain(
      "leadgrid_discovery_capacity_reservations_run_fkey",
    );
    expect(migration).toContain(
      "legacy_batch_id             UUID REFERENCES leadgrid_url_research_batches(id)",
    );
    expect(migration).toContain("'awaiting_confirmation'");
    expect(migration).toContain("'cancel_requested'");
    expect(migration).toContain("checkpoint                  JSONB NOT NULL");
    expect(migration).toContain("requested_count BETWEEN 1 AND 60");
    expect(migration).toContain("enrichment_count <= requested_count");
    expect(migration).toContain(
      "leadgrid_discovery_runs_enrichment_target_check",
    );
  });

  it("defines each late-added run field and reservation foreign key once", () => {
    expect(
      migration.match(/cancellation_requested_at\s+TIMESTAMPTZ/g),
    ).toHaveLength(1);
    expect(
      migration.match(
        /ADD CONSTRAINT leadgrid_discovery_capacity_reservations_run_fkey/g,
      ),
    ).toHaveLength(1);
    expect(migration).toMatch(
      /ADD CONSTRAINT leadgrid_discovery_capacity_reservations_run_fkey[\s\S]*?ON DELETE SET NULL;/,
    );
    expect(
      migration.match(
        /WHEN geography_lat IS NOT NULL AND geography_lng IS NOT NULL/g,
      ),
    ).toHaveLength(1);
  });

  it("keeps candidates out of CRM until an approval transaction links them", () => {
    expect(migration).toContain("Canonical project-level candidates");
    expect(migration).toContain(
      "imported_lead_id           UUID REFERENCES crm_customers(id)",
    );
    expect(migration).toContain("approval_mode               VARCHAR(16)");
    expect(migration).toContain("CHECK (approval_mode = 'manual')");
    expect(migration).not.toContain("approval_mode IN ('manual', 'rules')");
    expect(migration).not.toContain("'include_service_area_businesses'");
    expect(migration).toContain("'minimum_fit_score', 50");
    expect(migration).toContain("'ideal_customer', NULL");
    expect(migration).toContain("'goal', NULL");
    expect(migration).toContain("max_candidates_per_run BETWEEN 1 AND 60");
    expect(migration).toContain("enrichment_count <= max_candidates_per_run");
    expect(migration).toContain(
      "leadgrid_discovery_profiles_enrichment_target_check",
    );
    expect(migration).toContain("geography_radius_km BETWEEN 1 AND 50");
    expect(migration).not.toMatch(/INSERT\s+INTO\s+crm_customers/i);
    expect(migration).not.toMatch(/UPDATE\s+crm_customers/i);
  });

  it("stores explainable per-profile scoring and append-only learning events", () => {
    expect(migration).toContain("fit_score                   SMALLINT");
    expect(migration).toContain("fit_coverage BETWEEN 0 AND 1");
    expect(migration).toContain("data_quality_score          SMALLINT");
    expect(migration).toContain("data_quality_coverage BETWEEN 0 AND 1");
    expect(migration).toContain("excluded                    BOOLEAN NOT NULL");
    expect(migration).toContain("exclusion_matches           JSONB NOT NULL");
    expect(migration).toContain("score_components            JSONB NOT NULL");
    expect(migration).toContain("score_explanation           JSONB NOT NULL");
    expect(migration).toContain(
      "event_type IN ('decision', 'quality', 'correction', 'outcome')",
    );
    expect(migration).toContain("ux_leadgrid_discovery_feedback_idempotency");
    expect(migration).not.toMatch(/UPDATE\s+leadgrid_discovery_feedback/i);
    expect(migration).not.toMatch(
      /\b(overall_score|score_confidence|buying_signal_score|conversion_score)\b/,
    );
  });

  it("performs only a bounded profile compatibility backfill", () => {
    expect(migration).toContain("WITH legacy_profiles AS");
    expect(migration).toContain("JOIN leadgrid_projects p");
    expect(migration).toContain("p.organization_id IS NOT NULL");
    expect(migration).toContain("INSERT INTO leadgrid_discovery_profiles");
    expect(migration).toContain(
      "LEAST(50, GREATEST(1, COALESCE(c.geography_radius_km, 10)))",
    );
    expect(migration).toContain(
      "LEAST(60, GREATEST(1, c.count_per_run)) AS target_count",
    );
    expect(migration).not.toContain("INSERT INTO leadgrid_discovery_runs");
    expect(migration).not.toContain(
      "INSERT INTO leadgrid_discovery_candidates",
    );
    expect(migration).not.toMatch(
      /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?leadgrid_(?:project_discovery_config|url_research)/i,
    );
    expect(migration).toContain(
      "'legacy_auto_discover_enabled', auto_discover_enabled",
    );
    expect(migration).toContain("FALSE, '0 6 * * *', 'Europe/Oslo'");
  });

  it("creates shared single-use realtime tickets and auditable capacity", () => {
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS leadgrid_realtime_tickets",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS leadgrid_discovery_monthly_usage",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS leadgrid_discovery_capacity_reservations",
    );
  });

  it("keeps per-run review decisions queryable", () => {
    for (const disposition of [
      "'approved'",
      "'rejected'",
      "'imported'",
      "'duplicate'",
    ]) {
      expect(migration).toContain(disposition);
    }
  });
});
