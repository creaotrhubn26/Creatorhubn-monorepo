import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = resolve(SERVER_DIR, "..");
const MIGRATIONS_DIR = resolve(BACKEND_DIR, "migrations");

const NEW_ROLE_ROOM_MIGRATIONS = [
  "0490_role_room_reconcile_applied_schema.sql",
  "0491_role_room_core_runtime_schema.sql",
  "0492_role_room_marketing_runtime_schema.sql",
  "0493_role_room_billing_runtime_schema.sql",
  "0494_auth_verification_runtime_schema.sql",
  "0495_role_room_notification_dedup.sql",
  "0496_notification_delivery_log_schema.sql",
  "0497_casting_schedules_audition_link.sql",
] as const;

function migrationSql(files = readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith(".sql"))): string {
  return files.map((file) => readFileSync(resolve(MIGRATIONS_DIR, file), "utf8")).join("\n");
}

function createdTables(sql: string): string[] {
  const uncommented = sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  return [...uncommented.matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["']?([a-z_][a-z0-9_]*)/gi)]
    .map((match) => match[1].toLowerCase())
    .filter((table) => table !== "if");
}

describe("Role Room schema/dataflow contract", () => {
  it("gives every literal runtime-created Role Room table a canonical migration", () => {
    const sourceFiles = readdirSync(SERVER_DIR).filter((file) =>
      /^(?:role-room|admin-room-role-room).*\.ts$/.test(file) && !file.endsWith(".test.ts"),
    );
    // These shared modules are direct Role Room dependencies but do not use
    // the role-room filename prefix.
    sourceFiles.push("admin-inbound-alerts-routes.ts", "contract-google-signing.ts");
    const runtimeSql = sourceFiles
      .map((file) => readFileSync(resolve(SERVER_DIR, file), "utf8"))
      .join("\n");
    const migrationTables = new Set(createdTables(migrationSql()));
    const runtimeTables = new Set(createdTables(runtimeSql));
    // role-room-routes interpolates this constant into the CREATE statement.
    runtimeTables.add("legacy_compat_store");
    const uncovered = [...runtimeTables]
      .filter((table) => !migrationTables.has(table))
      .sort();

    expect(uncovered).toEqual([]);
  });

  it("assigns each new table to exactly one of the new migration sets", () => {
    const owners = new Map<string, string[]>();
    for (const file of NEW_ROLE_ROOM_MIGRATIONS) {
      for (const table of createdTables(migrationSql([file]))) {
        owners.set(table, [...(owners.get(table) ?? []), file]);
      }
    }
    const duplicates = [...owners.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([table, files]) => ({ table, files }));

    expect(owners.size).toBe(64);
    expect(duplicates).toEqual([]);
  });

  it("uses live-compatible text keys and explicit billing periods", () => {
    const reconciliation = migrationSql([NEW_ROLE_ROOM_MIGRATIONS[0]]);
    expect(reconciliation).toMatch(/role_room_client_intake_versions[\s\S]*?project_id\s+(?:VAR)?CHAR|role_room_client_intake_versions[\s\S]*?project_id\s+TEXT/i);
    expect(reconciliation).not.toMatch(/(?:project_id|generated_by_user_id|producer_user_id)\s+UUID/i);
    expect(reconciliation).toMatch(/billing_period\s+VARCHAR\(7\)\s+NOT NULL/i);
    expect(reconciliation).not.toMatch(/billing_period[\s\S]{0,120}GENERATED\s+ALWAYS/i);
  });

  it("never persists publish-provider tokens as plaintext", () => {
    const source = readFileSync(resolve(SERVER_DIR, "role-room-publish-providers.ts"), "utf8");
    const migration = migrationSql([NEW_ROLE_ROOM_MIGRATIONS[2]]);

    expect(source).toContain("access_token_encrypted");
    expect(source).toContain("refresh_token_encrypted");
    expect(source).toContain("crypto.timingSafeEqual");
    expect(source).not.toMatch(/\baccess_token\s+TEXT\s+NOT NULL/i);
    expect(source).not.toContain('?? "publish-state"');
    expect(migration).toContain("access_token_encrypted TEXT NOT NULL");
    expect(migration).not.toMatch(/\baccess_token\s+TEXT\s+NOT NULL/i);
  });

  it("serializes version allocation and accepts non-UUID CreatorHub user IDs", () => {
    for (const file of [
      "role-room-intake-versions-routes.ts",
      "role-room-plan-versions-routes.ts",
    ]) {
      const source = readFileSync(resolve(SERVER_DIR, file), "utf8");
      expect(source).toContain("pg_advisory_xact_lock");
      expect(source.indexOf("pg_advisory_xact_lock")).toBeLessThan(source.indexOf("MAX(version_number)"));
    }
    for (const file of [
      "client-meta-suite.ts",
      "client-linkedin-suite.ts",
      "client-google-customer-match.ts",
    ]) {
      const source = readFileSync(resolve(SERVER_DIR, file), "utf8");
      expect(source).not.toMatch(/producer_user_id\s*=\s*\$[12]::uuid/i);
      expect(source).not.toMatch(/VALUES\s*\(\$1::uuid,\s*\$2::uuid/i);
    }
  });

  it("migrates the Role Room auth dependencies and their duplicate guards", () => {
    const migration = migrationSql([NEW_ROLE_ROOM_MIGRATIONS[4]]);
    const emailService = readFileSync(resolve(SERVER_DIR, "email-verification-service.ts"), "utf8");
    const totpService = readFileSync(resolve(SERVER_DIR, "totp-2fa-service.ts"), "utf8");

    expect(migration).toContain("email_verification_codes");
    expect(migration).toContain("user_totp_secrets");
    expect(migration).toContain("user_totp_backup_codes");
    expect(migration).toContain("last_used_window BIGINT");
    expect(migration).toContain("uq_email_verif_codes_one_active");
    expect(emailService).toContain("pg_advisory_xact_lock");
    expect(totpService).toContain("ADD COLUMN IF NOT EXISTS last_used_window BIGINT");
  });

  it("uses one canonical notification table with an atomic database dedup key", () => {
    const migration = migrationSql([NEW_ROLE_ROOM_MIGRATIONS[5]]);
    const helper = readFileSync(resolve(SERVER_DIR, "role-room-producer-notifications.ts"), "utf8");
    const activeWriters = [
      "role-room-agent-core-routes.ts",
      "role-room-agent-daily-scan.ts",
      "talent-selftapes-routes.ts",
    ].map((file) => readFileSync(resolve(SERVER_DIR, file), "utf8")).join("\n");

    expect(migration).toContain("uq_rr_project_notifications_logical_event");
    expect(helper).toContain("ON CONFLICT");
    expect(activeWriters).not.toContain("producer_project_notifications");
    expect(activeWriters).toContain("upsertProducerProjectNotification");
  });

  it("owns and deduplicates reminder delivery logging", () => {
    const migration = migrationSql([NEW_ROLE_ROOM_MIGRATIONS[6]]);
    const runner = readFileSync(resolve(SERVER_DIR, "casting-reminder-runner.ts"), "utf8");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS notification_delivery_log");
    expect(migration).toContain("uq_notification_delivery_log_channel");
    expect(runner).toContain("ON CONFLICT (notification_id, delivery_method)");
  });

  it("uses the canonical casting schedule table throughout auditions", () => {
    const migration = migrationSql([NEW_ROLE_ROOM_MIGRATIONS[7]]);
    const auditions = readFileSync(resolve(SERVER_DIR, "role-room-auditions-routes.ts"), "utf8");

    expect(migration).toContain("ALTER TABLE casting_schedules");
    expect(migration).toContain("casting_schedules_audition_id_fkey");
    expect(auditions).not.toMatch(/\b(?:FROM|JOIN|UPDATE) schedules\b/i);
    expect(auditions).toContain("casting_schedules");
  });

  it("maps gallery, brand, publish KPI, and user lookup flows to real canonical relations", () => {
    const gallery = readFileSync(resolve(SERVER_DIR, "role-room-carousel-gallery-match.ts"), "utf8");
    const brand = readFileSync(resolve(SERVER_DIR, "role-room-carousel-image-resolver.ts"), "utf8");
    const kpis = readFileSync(resolve(SERVER_DIR, "role-room-kpi-connectors.ts"), "utf8");
    const notifier = readFileSync(resolve(SERVER_DIR, "social-publish-failure-notifier.ts"), "utf8");

    expect(gallery).not.toMatch(/\bFROM showcase_assets\b/i);
    expect(gallery).toMatch(/\bFROM showcase_items\b/i);
    expect(brand).not.toMatch(/\bFROM brand_assets\b/i);
    expect(brand).toMatch(/\bFROM role_room_brand_assets\b/i);
    expect(kpis).not.toMatch(/\bFROM role_room_feed_plan_posts\b/i);
    expect(kpis).toMatch(/\bFROM role_room_instagram_publish_jobs\b/i);
    expect(notifier).not.toMatch(/\bFROM creatorhub_users\b/i);
    expect(notifier).toMatch(/\bFROM users\b/i);
  });
});
