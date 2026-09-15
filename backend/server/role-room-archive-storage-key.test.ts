// Arkivhierarkiet fra b2-archive-helper skal overleve flyttingen til S3 som
// lesbare stier, og server og migrasjonsskript må være enige om hvor hvert
// objekt havner — ellers peker appen ett sted og de migrerte filene et annet.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { canonicalizeRoleRoomStorageKey } from "./role-room-storage-key.js";

const migrationScript = readFileSync(
  new URL("../scripts/migrate-role-room-storage-to-s3.mjs", import.meta.url),
  "utf8",
);

const ARCHIVE_KEYS = [
  "newsletters/issues/2026-09/issue-1.html",
  "funding-apps/innovasjon-norge/app-1-role-room-sent.pdf",
  "decks/deck-1-role-room/slides/01.html",
  "business-plans/snapshots/2026-09-15-snapshot.json",
  "casting-call-posters/project-1/role-1-portrait.png",
  "marketing-reports/weekly/2026-09-15.json",
  "ad-hoc/manuell-opplasting.pdf",
];

describe("archive keys in the private S3 bucket", () => {
  it("keeps the documented hierarchy readable under platform/archives", () => {
    for (const key of ARCHIVE_KEYS) {
      expect(canonicalizeRoleRoomStorageKey(key)).toBe(`platform/archives/${key}`);
    }
  });

  it("does not fall through to the opaque legacy mapping", () => {
    for (const key of ARCHIVE_KEYS) {
      expect(canonicalizeRoleRoomStorageKey(key)).not.toMatch(/\/original\.[a-z0-9]+$/);
    }
  });

  it("is idempotent — a key already under platform/ is left alone", () => {
    const canonical = canonicalizeRoleRoomStorageKey(ARCHIVE_KEYS[0]);
    expect(canonicalizeRoleRoomStorageKey(canonical)).toBe(canonical);
  });

  it("lists the same prefixes in the migration script", () => {
    for (const key of ARCHIVE_KEYS) {
      const prefix = `${key.split("/", 1)[0]}/`;
      expect(migrationScript).toContain(`"${prefix}"`);
    }
  });

  it("still sends an unknown prefix to the legacy archive mapping", () => {
    expect(canonicalizeRoleRoomStorageKey("scratch/whatever.bin"))
      .toMatch(/^platform\/archives\/scratch\/[0-9a-f-]+\/original\.bin$/);
  });
});
