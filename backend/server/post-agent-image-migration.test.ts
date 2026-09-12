import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/0511_post_agent_ai_image_log.sql", import.meta.url),
  "utf8",
);

describe("Post Agent figure asset migration", () => {
  it("matches the varchar user identity contract and stores only references", () => {
    expect(migration).toContain("user_id VARCHAR(255) REFERENCES users(id)");
    expect(migration).toContain("asset_file_id UUID REFERENCES role_room_user_files(id)");
    expect(migration).toContain("visual_audit JSONB");
    expect(migration).not.toMatch(/image_(?:data|base64)\s+(?:TEXT|BYTEA)/i);
  });

  it("deduplicates image bytes inside the project access boundary", () => {
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS role_room_user_files_mockup_ai_sha_unique");
    expect(migration).toContain("user_id, attached_to_entity_id, (metadata->>'sha256')");
    expect(migration).toContain("attached_to_entity_type = 'mockup-project'");
  });
});
