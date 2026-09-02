import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationDirectory = fileURLToPath(
  new URL("../migrations/", import.meta.url),
);

const appliedMigrationChecksums = {
  "0474_contract_signature_delivery.sql":
    "09e9513078b330d71a6cf5e740aef4357e8f37561a70326817207441f355f957",
  "0475_storyboard_migrator_reference_privileges.sql":
    "9dc934a03a182f4fd14f074981a8e1a347f8e23ed888ab7430a3c2fcbdecc6b0",
  "0476_storyboard_ai_image_versions.sql":
    "78b1205c1979346d75c5e963423c3785d2e654aea6cf661b5ccee0f9c214915a",
  "0477_storyboard_ai_image_idempotency.sql":
    "6256a04c778cbb8297f96026ebb3e548d2edc68272dc64ae5fa5b3d5d25cc966",
  "0478_storyboard_ai_video_provider_lifecycle.sql":
    "9ae1e4a9ba4e35e5951f3bacdd16e23839ac3cf1ada1df7e79da07506b511335",
  "0479_legacy_generative_ai_billing_due_index.sql":
    "027e06cc93529b82011146665cde0d5bbabb8b07d72b22f080f925482666e480",
  "0480_storyboard_ai_image_billing_outbox.sql":
    "cb5feb0a420ba2d329b9b5da6aa84ba370de86df3752476081075804db79a031",
  "0481_storyboard_mentions_identity_scope.sql":
    "6cdb1236a33fc8cc456ef520d2b8778de29dc6456e8a9c6b38a3b9ce99cc7c36",
  "0482_project_video_direct_upload_registration.sql":
    "ba426732bdce5e436cd49f45ed5a183a9a592ead044aec16a484cb6c83644c46",
  "0483_storyboard_tenant_parent_identity.sql":
    "e803c9dc2a68f615d2e7cbaf10c16cd960d281a9425e342c21bc63a0b7bfb69f",
  "0484_storyboard_tenant_identity.sql":
    "ccff79ee1e4f3af557d259e0d8c3c4367c5c7577baa0ae8116ebdd5039e1cab2",
  "0485_leadgrid_add_lead_profile_fields.sql":
    "8b70aa32b9f986a73363f3004e1004fd29a6178cef357d904053095d9ec7b1b3",
  "0486_workspace_project_bookings.sql":
    "8e73c07f5cb74aad2cba424e668899b230cd1dcde51fcdfbe250e661cbd114f8",
  "0487_workspace_project_equipment.sql":
    "d959324092f0cf1c79d9ff12e7614faac99f153e7bfe7fd73f17e066bcd2958e",
  "0488_storyboard_project_identity_search_path.sql":
    "c218bc266196b3ef6c844c3b154882a8029e78a521347616bd75c3deec5e5eff",
  "0489_leadgrid_lead_creation_idempotency.sql":
    "48c8fa47155e917e35e9917f0828489ecb751d411909662f72469c6c39d9bdab",
} as const;

const occupiedMigrationBasenames = [
  "0472_leadgrid_project_soft_references.sql",
  "0473_leadgrid_discovery_platform.sql",
  ...Object.keys(appliedMigrationChecksums),
] as const;

const readMigration = (basename: string): string =>
  readFileSync(new URL(`../migrations/${basename}`, import.meta.url), "utf8");

const compactSQL = (value: string): string => value.replace(/\s+/g, " ").trim();

const versions = compactSQL(
  readMigration("0476_storyboard_ai_image_versions.sql"),
);
const operations = compactSQL(
  readMigration("0477_storyboard_ai_image_idempotency.sql"),
);
const videoLifecycle = compactSQL(
  readMigration("0478_storyboard_ai_video_provider_lifecycle.sql"),
);
const legacyBilling = compactSQL(
  readMigration("0479_legacy_generative_ai_billing_due_index.sql"),
);
const imageBilling = compactSQL(
  readMigration("0480_storyboard_ai_image_billing_outbox.sql"),
);
const mentionIdentity = compactSQL(
  readMigration("0481_storyboard_mentions_identity_scope.sql"),
);
const projectVideoUpload = compactSQL(
  readMigration("0482_project_video_direct_upload_registration.sql"),
);
const tenantParentIdentity = compactSQL(
  readMigration("0483_storyboard_tenant_parent_identity.sql"),
);
const tenantIdentity = compactSQL(
  readMigration("0484_storyboard_tenant_identity.sql"),
);
const tenantIdentityHardening = compactSQL(
  readMigration("0488_storyboard_project_identity_search_path.sql"),
);

describe("Storyboard Room migration integrity", () => {
  it("uses one unique, contiguous migration filename for 0472 through 0489", () => {
    const files = readdirSync(migrationDirectory)
      .filter((filename) => /^(?:047[2-9]|048[0-9])_.*\.sql$/.test(filename))
      .sort();

    expect(files).toEqual([...occupiedMigrationBasenames]);
    expect(new Set(files.map((filename) => filename.slice(0, 4))).size).toBe(
      18,
    );

    const obsoleteBasenames = [
      "0454_storyboard_ai_image_versions.sql",
      "0455_storyboard_ai_image_idempotency.sql",
      "0456_storyboard_ai_video_provider_lifecycle.sql",
      "0457_legacy_generative_ai_billing_due_index.sql",
      "0458_storyboard_ai_image_billing_outbox.sql",
      "0475_storyboard_schema_owner_boundary.sql",
      "0488_storyboard_schema_owner_boundary.sql",
      "0489_storyboard_project_identity_search_path.sql",
    ];
    for (const basename of obsoleteBasenames) {
      expect(
        existsSync(new URL(`../migrations/${basename}`, import.meta.url)),
      ).toBe(false);
    }
  });

  it("pins every externally applied migration byte for byte", () => {
    for (const [basename, expectedChecksum] of Object.entries(
      appliedMigrationChecksums,
    )) {
      const bytes = readFileSync(
        new URL(`../migrations/${basename}`, import.meta.url),
      );
      expect(createHash("sha256").update(bytes).digest("hex"), basename).toBe(
        expectedChecksum,
      );
    }
  });

  it("keeps role-specific migration dataflow compatible with both runners", () => {
    const hardeningSource = readMigration(
      "0488_storyboard_project_identity_search_path.sql",
    );
    expect(hardeningSource).toMatch(
      /^-- migration-role: creatorhub_migrator\n/,
    );
    expect(tenantIdentityHardening).toContain(
      "CREATE OR REPLACE FUNCTION public.enforce_storyboard_project_identity()",
    );

    const leadgridIdempotency = readMigration(
      "0489_leadgrid_lead_creation_idempotency.sql",
    );
    expect(leadgridIdempotency).not.toMatch(/^-- migration-role:/m);

    const runner = readFileSync(
      new URL("../migrate.sh", import.meta.url),
      "utf8",
    );
    expect(runner).toContain("exec node scripts/run-production-migrations.mjs");
    expect(runner).not.toContain("drizzle-kit");
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
      "FOREIGN KEY (storyboard_id, project_id) REFERENCES casting_storyboards (id, project_id) ON DELETE CASCADE NOT VALID",
    );
    expect(tenantParentIdentity).toContain(
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

  it("keeps durable guards and hardens their function forward", () => {
    const lastTrigger = tenantIdentity.indexOf(
      "CREATE TRIGGER storyboard_ai_video_jobs_tenant_identity",
    );
    const durableAudit = tenantIdentity.indexOf(
      "DO $storyboard_durable_tenant_identity$",
    );

    expect(tenantIdentity).toContain(
      "CREATE OR REPLACE FUNCTION enforce_storyboard_project_identity() RETURNS TRIGGER LANGUAGE plpgsql",
    );
    expect(tenantIdentity).not.toContain(
      "SET search_path TO pg_catalog, pg_temp",
    );
    expect(tenantIdentity).toContain(
      "PERFORM 1 FROM casting_storyboards WHERE id = NEW.storyboard_id AND project_id = NEW.project_id FOR KEY SHARE",
    );
    expect(
      tenantIdentity.match(
        /EXECUTE FUNCTION enforce_storyboard_project_identity\(/g,
      ),
    ).toHaveLength(2);
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

    expect(tenantIdentityHardening).toContain(
      "CREATE OR REPLACE FUNCTION public.enforce_storyboard_project_identity() RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO pg_catalog, pg_temp",
    );
    expect(tenantIdentityHardening).toContain(
      "PERFORM 1 FROM public.casting_storyboards WHERE id = NEW.storyboard_id AND project_id = NEW.project_id FOR KEY SHARE",
    );
    expect(tenantIdentityHardening).toContain("DETAIL = pg_catalog.format(");
    expect(tenantIdentityHardening).not.toContain(
      "PERFORM 1 FROM casting_storyboards WHERE id = NEW.storyboard_id",
    );
    expect(tenantIdentityHardening).not.toContain("CREATE TRIGGER");
  });

  it("keeps optional legacy indexing replay-safe in the active workspace route", () => {
    expect(legacyBilling).toContain(
      "IF to_regclass('public.generative_ai_jobs') IS NOT NULL THEN",
    );
    expect(legacyBilling).toContain(
      "CREATE INDEX IF NOT EXISTS generative_ai_jobs_legacy_billing_due_idx",
    );

    const workspaceRoutes = readFileSync(
      new URL("./project-workspace-routes.ts", import.meta.url),
      "utf8",
    );

    expect(workspaceRoutes).toContain("Migration 0479 intentionally skips");
    expect(workspaceRoutes).not.toMatch(/(?:Migration|migration) 045[6-7]/);
  });
});
