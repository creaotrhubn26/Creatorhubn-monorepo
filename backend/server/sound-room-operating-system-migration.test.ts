import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/0588_sound_room_producer_operating_system.sql", import.meta.url),
  "utf8",
);

describe("Sound Room Producer OS migration", () => {
  it("keeps every new domain entity scoped through an owned audio project", () => {
    for (const table of [
      "audio_review_activity",
      "audio_review_listens",
      "audio_revision_briefs",
      "audio_decision_rooms",
      "audio_review_signoffs",
      "audio_delivery_manifests",
    ]) {
      expect(migration).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?project_id\\s+UUID NOT NULL REFERENCES audio_review_projects\\(id\\) ON DELETE CASCADE`));
    }
  });

  it("preserves one vote per reviewer and one sign-off per version stage", () => {
    expect(migration).toContain("UNIQUE (decision_id, voter_key)");
    expect(migration).toContain("UNIQUE (project_id, version_id, member_id, stage)");
  });

  it("distinguishes metadata identity checksums from file-content hashes", () => {
    expect(migration).toContain("DEFAULT 'sha256-metadata'");
  });
});
