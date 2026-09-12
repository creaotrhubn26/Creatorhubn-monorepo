import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const migration = source("../migrations/0471_users_is_active.sql");
const drizzleSchema = source("../migrations/schema.ts");
const sessionHelper = source("./lead-map-session-helper.ts");
const googleAuthRoutes = source("./leadgrid-google-auth-routes.ts");
const serverEntrypoint = source("./index.ts");

describe("Leadgrid users.is_active schema compatibility", () => {
  it("expands and backfills the users table idempotently", () => {
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",
    );
    expect(migration).toContain("ALTER COLUMN is_active SET DEFAULT TRUE");
    expect(migration).toContain(
      "SET is_active = TRUE\n WHERE is_active IS NULL",
    );
    expect(migration).toContain("ALTER COLUMN is_active SET NOT NULL");
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
    expect(drizzleSchema).toMatch(
      /export const users = pgTable\("users", \{[\s\S]*?isActive: boolean\("is_active"\)\.default\(true\)\.notNull\(\),[\s\S]*?\}\);/,
    );
  });

  it("keeps every native-auth query compatible before the migration lands", () => {
    for (const runtimeSource of [
      sessionHelper,
      googleAuthRoutes,
      serverEntrypoint,
    ]) {
      expect(runtimeSource).toContain("(to_jsonb(u)->>'is_active')::boolean");
      expect(runtimeSource).not.toMatch(/\bu\.is_active\b/);
    }
  });
});
