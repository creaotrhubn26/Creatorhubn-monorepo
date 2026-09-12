import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/0590_protools_producer_suite.sql", import.meta.url),
  "utf8",
);

describe("Pro Tools producer suite migration", () => {
  it("keeps snapshots and delivery jobs scoped through an owned Companion session", () => {
    for (const table of ["protools_session_snapshots", "protools_delivery_jobs"]) {
      expect(migration).toMatch(new RegExp(
        `CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?session_id\\s+UUID NOT NULL REFERENCES protools_companion_sessions\\(id\\) ON DELETE CASCADE`,
      ));
      expect(migration).toMatch(new RegExp(
        `CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?user_id\\s+VARCHAR\\(64\\) NOT NULL`,
      ));
    }
  });

  it("makes snapshot identity deterministic per session", () => {
    expect(migration).toContain("UNIQUE (session_id, fingerprint)");
    expect(migration).toContain("review_version_id       UUID REFERENCES audio_review_versions(id) ON DELETE SET NULL");
    expect(migration).toContain("'pre_recall','post_recall'");
  });

  it("persists QC and lineage on every rendered bounce", () => {
    expect(migration).toContain("snapshot_id UUID REFERENCES protools_session_snapshots(id) ON DELETE SET NULL");
    expect(migration).toContain("delivery_job_id UUID REFERENCES protools_delivery_jobs(id) ON DELETE SET NULL");
    expect(migration).toContain("qc_report JSONB NOT NULL DEFAULT '{}'::jsonb");
    expect(migration).toContain("CHECK (progress BETWEEN 0 AND 100)");
  });
});
