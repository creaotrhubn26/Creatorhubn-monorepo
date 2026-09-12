import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const migration = source(
  "../migrations/0561_user_subscriptions_canonical_contract.sql",
);
const drizzleSchema = source("../migrations/schema.ts");
const serverEntrypoint = source("./index.ts");

describe("user_subscriptions canonical schema compatibility", () => {
  it("adds and backfills the plan-based contract without removing legacy data", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS plan_id VARCHAR");
    expect(migration).toContain("SET plan_id = NULLIF(BTRIM(package_id), '')");
    expect(migration).toContain(
      "ARRAY['profession', 'package_id', 'package_tier']",
    );
    expect(migration).toContain("ALTER COLUMN %I DROP NOT NULL");
    expect(migration).toContain(
      "ALTER TABLE user_subscriptions ALTER COLUMN plan_id SET NOT NULL",
    );
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
  });

  it("keeps every runtime insert on the canonical plan columns", () => {
    const inserts = [
      ...serverEntrypoint.matchAll(
        /INSERT INTO user_subscriptions\s*\(([^)]+)\)/g,
      ),
    ];

    expect(inserts).toHaveLength(3);
    for (const insert of inserts) {
      expect(insert[1]).toContain("user_id");
      expect(insert[1]).toContain("plan_id");
      expect(insert[1]).not.toContain("package_id");
      expect(insert[1]).not.toContain("package_tier");
    }

    expect(drizzleSchema).toMatch(
      /export const userSubscriptions = pgTable\("user_subscriptions", \{[\s\S]*?planId: varchar\("plan_id"\)\.notNull\(\),[\s\S]*?\}\);/,
    );
  });
});
