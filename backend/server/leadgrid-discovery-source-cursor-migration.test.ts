import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0555_leadgrid_discovery_source_cursor_map.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Leadgrid Discovery source cursor migration", () => {
  it("adds a re-runnable JSONB cursor map without guessing from legacy pages", () => {
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS source_cursor_map JSONB NOT NULL DEFAULT '{}'::jsonb",
    );
    expect(migration).toContain("CREATE OR REPLACE FUNCTION");
    expect(migration).toContain("IF NOT EXISTS (");
    expect(migration).not.toMatch(/UPDATE\s+leadgrid_discovery_profiles/i);
    expect(migration).toContain(
      "Legacy rotation_index is deliberately not converted",
    );
    expect(migration).toContain("BRREG offset pages are not a snapshot");
    expect(migration).toContain("rare skips");
    expect(migration).not.toContain("Lossless Discovery rotation state");
  });

  it("enforces fingerprint keys and bounded integer offsets", () => {
    expect(migration).toContain("entry.key !~ '^[a-f0-9]{64}$'");
    expect(migration).toContain("jsonb_typeof(entry.value) = 'number'");
    expect(migration).toContain("BETWEEN 0 AND 2147483647");
    expect(migration).toContain(
      "CHECK (leadgrid_discovery_source_cursor_map_is_valid(source_cursor_map))",
    );
    expect(migration).toContain(
      "VALIDATE CONSTRAINT leadgrid_discovery_profiles_source_cursor_map_check",
    );
    expect(migration).toContain(
      "CHECK (\n        leadgrid_discovery_source_cursor_map_is_valid(source_cursor_map_snapshot)",
    );
    expect(migration).toContain(
      "VALIDATE CONSTRAINT leadgrid_discovery_campaign_items_cursor_snapshot_check",
    );
  });
});
