import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Discovery run observation snapshot migration", () => {
  const expandMigration = readFileSync(
    new URL(
      "../migrations/0532_leadgrid_discovery_observation_snapshots.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const contractMigration = readFileSync(
    new URL(
      "../migrations/0534_leadgrid_discovery_observation_snapshot_contract.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("expands first, then backfills and contracts in a separate migration", () => {
    expect(expandMigration).toContain(
      "ADD COLUMN IF NOT EXISTS observation_snapshot JSONB",
    );
    expect(expandMigration).not.toContain(
      "ALTER COLUMN observation_snapshot SET NOT NULL",
    );
    expect(expandMigration).toContain(
      "leadgrid_discovery_run_candidates_snapshot_object_check",
    );
    expect(expandMigration).toContain("observation_snapshot ?& ARRAY[");
    expect(contractMigration).toContain(
      "FROM leadgrid_discovery_candidates candidate",
    );
    expect(contractMigration).toContain(
      "ALTER COLUMN observation_snapshot SET NOT NULL",
    );
    expect(contractMigration).toContain("pending_backfill > 100000");
    expect(contractMigration).toContain(
      "leadgrid_discovery_run_candidates_snapshot_not_null_check",
    );
    expect(contractMigration).toContain(
      "CHECK (observation_snapshot IS NOT NULL) NOT VALID",
    );
    expect(contractMigration).toContain(
      "VALIDATE CONSTRAINT\n    leadgrid_discovery_run_candidates_snapshot_not_null_check",
    );
    expect(contractMigration).not.toContain(
      "ALTER COLUMN observation_snapshot SET DEFAULT",
    );
    expect(contractMigration).toContain(
      "'snapshot_origin', 'legacy_backfill_current_canonical'",
    );
    expect(contractMigration).toContain("'observed_at', NULL");
  });

  it("keeps rolling writes safe and rejects later snapshot mutation", () => {
    expect(expandMigration).toContain(
      "leadgrid_fill_discovery_observation_snapshot",
    );
    expect(expandMigration).toContain(
      "BEFORE INSERT ON leadgrid_discovery_run_candidates",
    );
    expect(expandMigration).toContain(
      "leadgrid_guard_discovery_observation_snapshot",
    );
    expect(expandMigration).toContain(
      "BEFORE UPDATE OF observation_snapshot",
    );
    expect(expandMigration).toContain("snapshot is immutable");
  });
});

describe("Discovery run observation snapshot read paths", () => {
  const discoveryService = readFileSync(
    new URL("./leadgrid-discovery-service.ts", import.meta.url),
    "utf8",
  );
  const placesService = readFileSync(
    new URL("./leadgrid-discovery-places-details.ts", import.meta.url),
    "utf8",
  );
  const intelligenceService = readFileSync(
    new URL("./leadgrid-discovery-intelligence-service.ts", import.meta.url),
    "utf8",
  );

  it("uses the run observation for transient Places matching", () => {
    expect(placesService).toContain("rc.observation_snapshot->>'name'");
    expect(placesService).toContain("rc.observation_snapshot->'latitude'");
  });

  it("writes one immutable snapshot and uses it for review and promotion", () => {
    expect(discoveryService).toContain(
      "score_model_version, score_components, score_explanation, evidence,\n          observation_snapshot",
    );
    expect(discoveryService).toContain("JSON.stringify(observationSnapshot)");
    expect(discoveryService).toContain("observation.raw_data->>'source_uri'");
    expect(discoveryService).toContain("observation.enrichment_data");
    expect(discoveryService).toContain("AS observation_origin");
    expect(discoveryService).toContain("is_approximate:");
    expect(discoveryService).toContain("source: \"brreg_open_data\",\n          observation,");
    expect(discoveryService).toContain(
      "MAX(history_rc.created_at) AS last_seen_at",
    );
    expect(discoveryService).toContain(
      "observation_snapshot is immutable for this run occurrence",
    );
    expect(discoveryService).not.toContain(
      "observation_snapshot = EXCLUDED.observation_snapshot",
    );
  });

  it("uses the run observation for marketing evidence", () => {
    expect(intelligenceService).toContain(
      "rc.observation_snapshot->>'organization_number'",
    );
    expect(intelligenceService).toContain(
      "rc.observation_snapshot->'raw_data'",
    );
  });
});
