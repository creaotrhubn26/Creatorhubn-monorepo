import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/0605_project_photo_room_unification.sql", import.meta.url),
  "utf8",
);
const workspaceRoutes = readFileSync(
  new URL("./project-workspace-routes.ts", import.meta.url),
  "utf8",
);
const captureRepairMigration = readFileSync(
  new URL("../migrations/0675_capture_assets_updated_at_backfill.sql", import.meta.url),
  "utf8",
);

describe("Photo Room migration contract", () => {
  it("owns the review and comment schema with project and asset constraints", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS project_photo_review");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS project_photo_comments");
    expect(migration).toContain("project_photo_review_project_fk");
    expect(migration).toContain("project_photo_comments_asset_fk");
    expect(migration).toContain("project_photo_comments_status_check");
    expect(workspaceRoutes).not.toContain("CREATE TABLE IF NOT EXISTS project_photo_review");
    expect(workspaceRoutes).not.toContain("CREATE TABLE IF NOT EXISTS project_photo_comments");
  });

  it("links client galleries, Capture assets and proofing rounds", () => {
    expect(migration).toContain("photographer_client_galleries_project_fk");
    expect(migration).toContain("client_gallery_images_capture_asset_idx");
    expect(migration).toContain("proofing_round integer NOT NULL DEFAULT 1");
  });

  it("keeps capture flags as mirrors of the canonical review status", () => {
    expect(migration).toContain("sync_capture_asset_photo_review_status");
    expect(migration).toContain("sync_project_photo_review_from_capture_status");
    expect(migration).toContain("pg_trigger_depth() > 1");
    expect(migration).toContain("NEW.review_status = 'rejected'");
    expect(migration).toContain("NEW.review_status IN ('approved', 'flagged')");
  });

  it("records CreatorHub S3 as the permanent Photo Room output provider", () => {
    expect(migration).toContain("output_storage_provider");
    expect(migration).toContain("'creatorhub_s3'");
    expect(migration).toContain("generative_ai_jobs_legacy_billing_due_idx");
    expect(workspaceRoutes).toContain("Migration 0479 intentionally skips");
  });

  it("repairs the legacy Capture timestamp required by review mutations", () => {
    expect(captureRepairMigration).toContain("ALTER TABLE capture_assets");
    expect(captureRepairMigration).toContain("ADD COLUMN IF NOT EXISTS updated_at");
    expect(captureRepairMigration).toContain("COALESCE(updated_at, created_at, now())");
  });
});
