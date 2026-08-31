import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationDirectory = fileURLToPath(
  new URL("../migrations/", import.meta.url),
);

const migrationBasenames = [
  "0474_storyboard_ai_image_versions.sql",
  "0475_storyboard_ai_image_idempotency.sql",
  "0476_storyboard_ai_video_provider_lifecycle.sql",
  "0477_legacy_generative_ai_billing_due_index.sql",
  "0478_storyboard_ai_image_billing_outbox.sql",
  "0479_storyboard_mentions_identity_scope.sql",
  "0480_project_video_direct_upload_registration.sql",
  "0481_storyboard_tenant_identity.sql",
] as const;

const occupiedMigrationBasenames = [
  "0472_leadgrid_project_soft_references.sql",
  "0473_leadgrid_discovery_platform.sql",
  ...migrationBasenames,
] as const;

const migrations = Object.fromEntries(
  migrationBasenames.map((basename) => [
    basename,
    readFileSync(new URL(`../migrations/${basename}`, import.meta.url), "utf8"),
  ]),
) as Record<(typeof migrationBasenames)[number], string>;

const compactSQL = (value: string): string => value.replace(/\s+/g, " ").trim();

const versions = compactSQL(migrations[migrationBasenames[0]]);
const operations = compactSQL(migrations[migrationBasenames[1]]);
const videoLifecycle = compactSQL(migrations[migrationBasenames[2]]);
const legacyBilling = compactSQL(migrations[migrationBasenames[3]]);
const imageBilling = compactSQL(migrations[migrationBasenames[4]]);
const mentionIdentity = compactSQL(migrations[migrationBasenames[5]]);
const projectVideoUpload = compactSQL(migrations[migrationBasenames[6]]);
const tenantIdentity = compactSQL(migrations[migrationBasenames[7]]);

describe("Storyboard Room migration integrity", () => {
  it("uses one unique, contiguous migration filename for 0472 through 0481", () => {
    const files = readdirSync(migrationDirectory)
      .filter((filename) => /^(?:047[2-9]|048[01])_.*\.sql$/.test(filename))
      .sort();

    expect(files).toEqual([...occupiedMigrationBasenames]);
    expect(new Set(files.map((filename) => filename.slice(0, 4))).size).toBe(10);

    const obsoleteBasenames = [
      "0454_storyboard_ai_image_versions.sql",
      "0455_storyboard_ai_image_idempotency.sql",
      "0456_storyboard_ai_video_provider_lifecycle.sql",
      "0457_legacy_generative_ai_billing_due_index.sql",
      "0458_storyboard_ai_image_billing_outbox.sql",
    ];
    for (const basename of obsoleteBasenames) {
      expect(existsSync(new URL(`../migrations/${basename}`, import.meta.url))).toBe(false);
    }
  });

  it("converges a runtime-created image-version table to named constraints", () => {
    const createPosition = versions.indexOf(
      "CREATE TABLE IF NOT EXISTS storyboard_ai_image_versions",
    );
    const repairPosition = versions.indexOf(
      "ALTER TABLE storyboard_ai_image_versions DROP CONSTRAINT IF EXISTS",
    );
    const addPosition = versions.indexOf(
      "ADD CONSTRAINT storyboard_ai_image_versions_stage_check",
    );

    expect(createPosition).toBeGreaterThanOrEqual(0);
    expect(repairPosition).toBeGreaterThan(createPosition);
    expect(addPosition).toBeGreaterThan(repairPosition);
    expect(versions).toContain(
      "ADD CONSTRAINT storyboard_ai_image_versions_status_check CHECK (status IN ('source', 'generated', 'approved', 'stale'))",
    );
    expect(versions).toContain(
      "ADD CONSTRAINT storyboard_ai_image_versions_parent_version_id_fkey FOREIGN KEY (parent_version_id) REFERENCES storyboard_ai_image_versions(id) ON DELETE SET NULL",
    );
  });

  it("converges operation constraints and installs both recovery foreign keys", () => {
    const createPosition = operations.indexOf(
      "CREATE TABLE IF NOT EXISTS storyboard_ai_image_operations",
    );
    const repairPosition = operations.indexOf(
      "ALTER TABLE storyboard_ai_image_operations DROP CONSTRAINT IF EXISTS",
    );
    const addPosition = operations.indexOf(
      "ADD CONSTRAINT storyboard_ai_image_operations_stage_check",
    );

    expect(createPosition).toBeGreaterThanOrEqual(0);
    expect(repairPosition).toBeGreaterThan(createPosition);
    expect(addPosition).toBeGreaterThan(repairPosition);
    expect(operations).toContain(
      "ADD CONSTRAINT storyboard_ai_image_operations_status_check CHECK (status IN ('claimed', 'processing', 'completed', 'failed'))",
    );
    expect(operations).toContain(
      "ADD CONSTRAINT storyboard_ai_image_operations_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES storyboard_ai_image_usage(id) ON DELETE SET NULL",
    );
    expect(operations).toContain(
      "ADD CONSTRAINT storyboard_ai_image_usage_operation_id_fkey FOREIGN KEY (operation_id) REFERENCES storyboard_ai_image_operations(id) ON DELETE SET NULL",
    );
  });

  it("indexes every nullable image-lineage and operation foreign key", () => {
    expect(versions).toContain(
      "CREATE INDEX IF NOT EXISTS storyboard_ai_image_versions_parent_idx ON storyboard_ai_image_versions (parent_version_id) WHERE parent_version_id IS NOT NULL",
    );
    expect(operations).toContain(
      "CREATE INDEX IF NOT EXISTS storyboard_ai_image_operations_storyboard_idx ON storyboard_ai_image_operations (storyboard_id)",
    );
    expect(operations).toContain(
      "CREATE INDEX IF NOT EXISTS storyboard_ai_image_operations_reservation_idx ON storyboard_ai_image_operations (reservation_id) WHERE reservation_id IS NOT NULL",
    );
    expect(operations).toContain(
      "CREATE INDEX IF NOT EXISTS storyboard_ai_image_operations_version_idx ON storyboard_ai_image_operations (version_id) WHERE version_id IS NOT NULL",
    );
    expect(operations).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS storyboard_ai_image_usage_operation_idx ON storyboard_ai_image_usage (operation_id) WHERE operation_id IS NOT NULL",
    );
  });

  it("keeps the archived-output constraint safe for the previous Render version", () => {
    expect(videoLifecycle).toContain(
      "ADD CONSTRAINT storyboard_ai_video_jobs_archived_output_check -- Migrations run before the new Render instance is deployed. The previous -- server can still write output_b2_key without archive_status during that -- window, so enforce the safe direction until a later two-phase tightening. CHECK (archive_status <> 'archived' OR output_b2_key IS NOT NULL)",
    );
    expect(videoLifecycle).not.toMatch(
      /\(archive_status = 'archived'\)\s*=\s*\(output_b2_key IS NOT NULL\)/,
    );
  });

  it("retains durable child foreign keys in video and image billing", () => {
    expect(videoLifecycle).toContain(
      "FOREIGN KEY (job_id) REFERENCES storyboard_ai_video_jobs(id) ON DELETE RESTRICT",
    );
    expect(videoLifecycle).toContain(
      "job_id UUID NOT NULL REFERENCES storyboard_ai_video_jobs(id) ON DELETE CASCADE",
    );
    expect(imageBilling).toContain(
      "FOREIGN KEY (usage_id) REFERENCES storyboard_ai_image_usage(id) ON DELETE RESTRICT",
    );
  });

  it("binds mention inboxes to verified user and project identities", () => {
    expect(mentionIdentity).toContain(
      "ADD CONSTRAINT storyboard_mentions_project_id_fkey FOREIGN KEY (project_id) REFERENCES casting_projects(id) ON DELETE CASCADE NOT VALID",
    );
    expect(mentionIdentity).toContain(
      "ADD CONSTRAINT storyboard_mentions_user_id_fkey FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID",
    );
    expect(mentionIdentity).toContain(
      "CREATE INDEX IF NOT EXISTS idx_sb_mentions_recipient ON storyboard_mention_notifications (mentioned_user_id, read_at, created_at DESC) WHERE mentioned_user_id IS NOT NULL",
    );
    expect(mentionIdentity).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_sb_mentions_delivery_dedupe ON storyboard_mention_notifications (mentioned_user_id, frame_id, comment_id)",
    );
    expect(mentionIdentity).toContain(
      "ALTER TABLE casting_user_roles ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ",
    );
    expect(mentionIdentity).toContain(
      "GROUP BY lower(btrim(email)) HAVING COUNT(*) = 1",
    );
    expect(mentionIdentity).toContain(
      "u.email_key = lower(btrim(n.mentioned_email))",
    );
    expect(mentionIdentity).not.toMatch(/lower\(mentioned_name\)/i);
  });

  it("pins confirmed project-video uploads to immutable storage versions", () => {
    expect(projectVideoUpload).toContain(
      "ALTER TABLE IF EXISTS project_video_versions",
    );
    expect(projectVideoUpload).toContain(
      "ADD COLUMN IF NOT EXISTS content_type text",
    );
    expect(projectVideoUpload).toContain(
      "ADD COLUMN IF NOT EXISTS size_bytes bigint",
    );
    expect(projectVideoUpload).toContain(
      "ADD COLUMN IF NOT EXISTS upload_expires_at timestamptz",
    );
    expect(projectVideoUpload).toContain(
      "ADD COLUMN IF NOT EXISTS storage_version_id text",
    );
  });

  it("binds AI image identities to one storyboard tenant", () => {
    const versionGuard = tenantIdentity.indexOf(
      "ADD CONSTRAINT storyboard_ai_image_versions_storyboard_project_fkey",
    );
    const versionBackfill = tenantIdentity.indexOf(
      "UPDATE storyboard_ai_image_versions AS image_version SET project_id = storyboard.project_id",
    );
    const versionValidation = tenantIdentity.indexOf(
      "VALIDATE CONSTRAINT storyboard_ai_image_versions_storyboard_project_fkey",
    );
    const operationGuard = tenantIdentity.indexOf(
      "ADD CONSTRAINT storyboard_ai_image_operations_storyboard_project_fkey",
    );
    const collisionGuard = tenantIdentity.indexOf(
      "DO $storyboard_operation_identity_collision$",
    );
    const operationBackfill = tenantIdentity.indexOf(
      "UPDATE storyboard_ai_image_operations AS image_operation SET project_id = storyboard.project_id",
    );
    const operationValidation = tenantIdentity.indexOf(
      "VALIDATE CONSTRAINT storyboard_ai_image_operations_storyboard_project_fkey",
    );

    expect(tenantIdentity).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS casting_storyboards_id_project_uidx ON casting_storyboards (id, project_id)",
    );
    expect(tenantIdentity).toContain(
      "ADD CONSTRAINT storyboard_ai_image_versions_storyboard_project_fkey FOREIGN KEY (storyboard_id, project_id) REFERENCES casting_storyboards (id, project_id) ON DELETE CASCADE NOT VALID",
    );
    expect(tenantIdentity).toContain(
      "ADD CONSTRAINT storyboard_ai_image_operations_storyboard_project_fkey FOREIGN KEY (storyboard_id, project_id) REFERENCES casting_storyboards (id, project_id) ON DELETE CASCADE NOT VALID",
    );
    expect(versionGuard).toBeGreaterThanOrEqual(0);
    expect(versionBackfill).toBeGreaterThan(versionGuard);
    expect(versionValidation).toBeGreaterThan(versionBackfill);
    expect(operationGuard).toBeGreaterThan(versionValidation);
    expect(collisionGuard).toBeGreaterThan(operationGuard);
    expect(operationBackfill).toBeGreaterThan(collisionGuard);
    expect(operationValidation).toBeGreaterThan(operationBackfill);
    expect(tenantIdentity).toContain("HAVING COUNT(*) > 1");
    expect(tenantIdentity).toContain(
      "FOREIGN KEY (parent_version_id, storyboard_id, project_id) REFERENCES storyboard_ai_image_versions (id, storyboard_id, project_id) ON DELETE SET NULL (parent_version_id) NOT VALID",
    );
    expect(tenantIdentity).toContain(
      "FOREIGN KEY (version_id, storyboard_id, project_id) REFERENCES storyboard_ai_image_versions (id, storyboard_id, project_id) ON DELETE SET NULL (version_id) NOT VALID",
    );
    expect(tenantIdentity).toContain(
      "FOREIGN KEY (reservation_id, storyboard_id, project_id) REFERENCES storyboard_ai_image_usage (id, storyboard_id, project_id) ON DELETE SET NULL (reservation_id) NOT VALID",
    );
    expect(tenantIdentity).toContain(
      "FOREIGN KEY (operation_id, storyboard_id, project_id) REFERENCES storyboard_ai_image_operations (id, storyboard_id, project_id) ON DELETE SET NULL (operation_id) NOT VALID",
    );
  });

  it("guards new durable image usage and video jobs without cascading history", () => {
    const lastTrigger = tenantIdentity.indexOf(
      "CREATE TRIGGER storyboard_ai_video_jobs_tenant_identity",
    );
    const durableAudit = tenantIdentity.indexOf("DO $storyboard_durable_tenant_identity$");
    expect(tenantIdentity).toContain(
      "CREATE OR REPLACE FUNCTION enforce_storyboard_project_identity() RETURNS TRIGGER",
    );
    expect(tenantIdentity).toContain(
      "WHERE id = NEW.storyboard_id AND project_id = NEW.project_id FOR KEY SHARE",
    );
    expect(tenantIdentity).toContain(
      "BEFORE INSERT OR UPDATE OF storyboard_id, project_id ON storyboard_ai_image_usage",
    );
    expect(tenantIdentity).toContain(
      "BEFORE INSERT OR UPDATE OF storyboard_id, project_id ON storyboard_ai_video_jobs",
    );
    expect(tenantIdentity).not.toContain(
      "ALTER TABLE storyboard_ai_video_jobs ADD CONSTRAINT",
    );
    expect(lastTrigger).toBeGreaterThanOrEqual(0);
    expect(durableAudit).toBeGreaterThan(lastTrigger);
    expect(tenantIdentity).toContain(
      "storyboard image usage has a conflicting durable project identity",
    );
    expect(tenantIdentity).toContain(
      "storyboard video job has a conflicting durable project identity",
    );
    expect(tenantIdentity).not.toContain("UPDATE storyboard_ai_image_usage AS");
    expect(tenantIdentity).not.toContain("UPDATE storyboard_ai_video_jobs AS");
  });

  it("keeps optional legacy indexing replay-safe and references renumbered files", () => {
    expect(legacyBilling).toContain(
      "IF to_regclass('public.generative_ai_jobs') IS NOT NULL THEN",
    );
    expect(legacyBilling).toContain(
      "CREATE INDEX IF NOT EXISTS generative_ai_jobs_legacy_billing_due_idx",
    );

    const evidence = readFileSync(
      new URL("../../docs/evidence/2026-08-higgsfield-generation-retry.yaml", import.meta.url),
      "utf8",
    );
    const reconciler = readFileSync(
      new URL("./storyboard-ai-video-reconciler.ts", import.meta.url),
      "utf8",
    );
    const workspaceRoutes = readFileSync(
      new URL("./project-workspace-routes.ts", import.meta.url),
      "utf8",
    );

    expect(evidence).toContain("Migration 0474");
    expect(reconciler).toContain("after migration 0474 has run");
    expect(workspaceRoutes).toContain("Migration 0475 intentionally skips");
    expect(`${evidence}\n${reconciler}\n${workspaceRoutes}`).not.toMatch(
      /(?:Migration|migration) 045[6-7]/,
    );
  });
});
