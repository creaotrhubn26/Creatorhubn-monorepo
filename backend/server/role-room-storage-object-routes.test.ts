import express, { type Express } from "express";
import type { Pool } from "pg";
import request from "supertest";
import type { S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import {
  buildOrganizationStorageObjectKey,
  registerRoleRoomStorageObjectRoutes,
} from "./role-room-storage-object-routes.js";
import type { RoleRoomObjectStorage } from "./role-room-object-storage.js";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const OBJECT_ID = "33333333-3333-4333-8333-333333333333";

function buildPool(options: {
  membershipRole?: string;
  projectMatches?: boolean;
  reserve?: boolean;
  objectStatus?: string;
  pendingCleanupSucceeds?: boolean;
} = {}) {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
    const sql = String(sqlValue);
    statements.push({ sql, params });
    if (sql.includes("FROM organizations o") && sql.includes("membership_role")) {
      return {
        rows: [{
          id: ORG_ID,
          name: "Filmhuset AS",
          contact_email: "owner@example.test",
          billing_email: null,
          stripe_customer_id: null,
          plan: "solo_free",
          owner_user_id: null,
          membership_role: options.membershipRole ?? "member",
          platform_role: "member",
        }],
        rowCount: 1,
      };
    }
    if (sql.includes("INSERT INTO role_room_storage_accounts")) {
      return {
        rows: [{
          id: ACCOUNT_ID,
          organization_id: ORG_ID,
          plan_key: "solo_free",
          base_quota_bytes: "5368709120",
          used_bytes: "0",
          reserved_bytes: "0",
          file_count: 0,
          stripe_subscription_id: null,
          stripe_subscription_status: null,
          stripe_current_period_end: null,
          stripe_cancel_at_period_end: false,
          billing_grace_until: null,
          status: "active",
        }],
        rowCount: 1,
      };
    }
    if (sql.includes("reservation_expires_at <= NOW()")) return { rows: [], rowCount: 0 };
    if (sql.includes("FROM casting_projects")) {
      return options.projectMatches === false ? { rows: [], rowCount: 0 } : { rows: [{ one: 1 }], rowCount: 1 };
    }
    if (sql.includes("role_room_reserve_storage")) {
      return { rows: [{ role_room_reserve_storage: options.reserve !== false }], rowCount: 1 };
    }
    if (sql.includes("SET status = 'deleted'") && sql.includes("status = 'pending'")) {
      return options.pendingCleanupSucceeds === false
        ? { rows: [], rowCount: 0 }
        : { rows: [{ id: OBJECT_ID }], rowCount: 1 };
    }
    if (sql.includes("FROM role_room_storage_objects object_row")) {
      return {
        rows: [{
          id: OBJECT_ID,
          storage_account_id: ACCOUNT_ID,
          object_key: `organizations/${ORG_ID}/members/user-1/uploads/${OBJECT_ID}/original.pdf`,
          display_name: "kontrakt.pdf",
          size_bytes: "12",
          content_type: "application/pdf",
          checksum_sha256: "ab".repeat(32),
          project_id: null,
          source_module: "contracts",
          created_by_user_id: "user-1",
          metadata: {},
          status: options.objectStatus ?? "active",
          created_at: new Date("2026-09-10T00:00:00Z"),
        }],
        rowCount: 1,
      };
    }
    if (sql.includes("SELECT status FROM role_room_storage_objects")) {
      return { rows: [{ status: options.objectStatus ?? "pending" }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
  const client = { query, release: vi.fn() };
  return { pool: { query, connect: vi.fn(async () => client) } as unknown as Pool, statements };
}

function buildApp(pool: Pool, options: {
  signer?: ReturnType<typeof vi.fn>;
  send?: ReturnType<typeof vi.fn>;
} = {}): Express {
  const app = express();
  app.use(express.json());
  const storage: RoleRoomObjectStorage = {
    client: { send: options.send ?? vi.fn() } as unknown as S3Client,
    bucket: "role-room-test",
    provider: "aws_s3",
    region: "eu-north-1",
  };
  registerRoleRoomStorageObjectRoutes({
    app,
    pool,
    storage,
    signer: options.signer ?? vi.fn(async () => "https://s3.test/signed"),
    activeSessions: new Map([["token", { userId: "user-1" }]]),
  });
  return app;
}

describe("Role Room organization storage object routes", () => {
  it("builds an opaque organization/project hierarchy without the filename", () => {
    const key = buildOrganizationStorageObjectKey({
      organizationId: ORG_ID,
      userId: "user-1",
      objectId: OBJECT_ID,
      displayName: "Kontrakt Med Navn.PDF",
      projectId: "project-7",
    });
    expect(key).toBe(
      `organizations/${ORG_ID}/projects/project-7/uploads/${OBJECT_ID}/original.pdf`,
    );
    expect(key).not.toContain("Kontrakt");
  });

  it("reserves pooled quota and returns a checksum-bound upload URL", async () => {
    const { pool, statements } = buildPool();
    const signer = vi.fn(async () => "https://s3.test/upload");
    const response = await request(buildApp(pool, { signer }))
      .post("/api/role-room/storage/objects/initiate")
      .set("Authorization", "Bearer token")
      .send({
        organizationId: ORG_ID,
        displayName: "kontrakt.pdf",
        sizeBytes: 12,
        contentType: "application/pdf",
        checksumSha256: "ab".repeat(32),
        sourceModule: "contracts",
      });

    expect(response.status).toBe(201);
    expect(response.body.uploadUrl).toBe("https://s3.test/upload");
    expect(response.body.requiredHeaders["x-amz-checksum-sha256"]).toBe(
      Buffer.from("ab".repeat(32), "hex").toString("base64"),
    );
    expect(statements.some(({ sql, params }) =>
      sql.includes("role_room_reserve_storage") && params[0] === ACCOUNT_ID && params[1] === 12,
    )).toBe(true);
    expect(signer).toHaveBeenCalledOnce();
  });

  it("does not allow a viewer to reserve or upload bytes", async () => {
    const { pool, statements } = buildPool({ membershipRole: "viewer" });
    const response = await request(buildApp(pool))
      .post("/api/role-room/storage/objects/initiate")
      .set("Authorization", "Bearer token")
      .send({
        organizationId: ORG_ID,
        displayName: "kontrakt.pdf",
        sizeBytes: 12,
        contentType: "application/pdf",
        checksumSha256: "ab".repeat(32),
      });

    expect(response.status).toBe(403);
    expect(statements.some(({ sql }) => sql.includes("role_room_reserve_storage"))).toBe(false);
  });

  it("retains reserved quota when a failed presign cannot clean up the pending row", async () => {
    const { pool, statements } = buildPool({ pendingCleanupSucceeds: false });
    const signer = vi.fn(async () => { throw new Error("signing unavailable"); });
    const response = await request(buildApp(pool, { signer }))
      .post("/api/role-room/storage/objects/initiate")
      .set("Authorization", "Bearer token")
      .send({
        organizationId: ORG_ID,
        displayName: "kontrakt.pdf",
        sizeBytes: 12,
        contentType: "application/pdf",
        checksumSha256: "ab".repeat(32),
      });

    expect(response.status).toBe(503);
    expect(statements.some(({ sql }) => sql.includes("role_room_release_storage_reservation"))).toBe(false);
  });

  it("rejects a project that belongs to a different organization", async () => {
    const { pool } = buildPool({ projectMatches: false });
    const response = await request(buildApp(pool))
      .post("/api/role-room/storage/objects/initiate")
      .set("Authorization", "Bearer token")
      .send({
        organizationId: ORG_ID,
        displayName: "scene.jpg",
        sizeBytes: 12,
        contentType: "image/jpeg",
        checksumSha256: "ab".repeat(32),
        projectId: "project-owned-elsewhere",
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("prosjekt_tilhorer_ikke_organisasjonen");
  });

  it("keeps video out of S3 because self-tapes use Cloudflare Stream", async () => {
    const { pool, statements } = buildPool();
    const response = await request(buildApp(pool))
      .post("/api/role-room/storage/objects/initiate")
      .set("Authorization", "Bearer token")
      .send({
        organizationId: ORG_ID,
        displayName: "self-tape.mp4",
        sizeBytes: 12,
        contentType: "video/mp4",
        checksumSha256: "ab".repeat(32),
      });

    expect(response.status).toBe(415);
    expect(response.body.error).toBe("filtype_ikke_tillatt");
    expect(statements.some(({ sql }) => sql.includes("role_room_reserve_storage"))).toBe(false);
  });

  it("returns only a short-lived signed download URL after org access", async () => {
    const { pool, statements } = buildPool({ objectStatus: "active" });
    const signer = vi.fn(async () => "https://s3.test/download");
    const response = await request(buildApp(pool, { signer }))
      .get(`/api/role-room/storage/objects/${OBJECT_ID}/download?organizationId=${ORG_ID}`)
      .set("Authorization", "Bearer token");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toEqual({ url: "https://s3.test/download", expiresInSeconds: 300 });
    expect(statements.some(({ sql, params }) =>
      sql.includes("INSERT INTO role_room_storage_daily_metrics")
      && params[0] === ACCOUNT_ID
      && params[1] === 12,
    )).toBe(true);
  });

  it("activates a pending object only after S3 size and SHA-256 verification", async () => {
    const { pool, statements } = buildPool({ objectStatus: "pending" });
    const send = vi.fn(async () => ({
      ContentLength: 12,
      ChecksumSHA256: Buffer.from("ab".repeat(32), "hex").toString("base64"),
    }));
    const response = await request(buildApp(pool, { send }))
      .post(`/api/role-room/storage/objects/${OBJECT_ID}/complete`)
      .set("Authorization", "Bearer token")
      .send({ organizationId: ORG_ID });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("active");
    expect(statements.some(({ sql }) => sql.includes("role_room_apply_storage_usage"))).toBe(true);
    expect(statements.some(({ sql }) => sql.includes("role_room_release_storage_reservation"))).toBe(true);
  });

  it("quarantines and releases a reservation when the S3 checksum differs", async () => {
    const { pool, statements } = buildPool({ objectStatus: "pending" });
    const send = vi.fn(async () => ({ ContentLength: 12, ChecksumSHA256: "wrong" }));
    const response = await request(buildApp(pool, { send }))
      .post(`/api/role-room/storage/objects/${OBJECT_ID}/complete`)
      .set("Authorization", "Bearer token")
      .send({ organizationId: ORG_ID });

    expect(response.status).toBe(422);
    expect(response.body.error).toBe("storrelse_eller_checksum_avviker");
    expect(statements.some(({ sql }) => sql.includes("status = 'quarantined'"))).toBe(true);
    expect(statements.some(({ sql }) => sql.includes("role_room_release_storage_reservation"))).toBe(true);
  });

  it("retains the reservation when a mismatched S3 object cannot be deleted", async () => {
    const { pool, statements } = buildPool({ objectStatus: "pending" });
    const send = vi.fn()
      .mockResolvedValueOnce({ ContentLength: 12, ChecksumSHA256: "wrong" })
      .mockRejectedValueOnce(new Error("s3 delete unavailable"));
    const response = await request(buildApp(pool, { send }))
      .post(`/api/role-room/storage/objects/${OBJECT_ID}/complete`)
      .set("Authorization", "Bearer token")
      .send({ organizationId: ORG_ID });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: "ugyldig_objekt_kunne_ikke_slettes",
      retryable: true,
    });
    expect(statements.some(({ sql }) => sql.includes("status = 'quarantined'"))).toBe(false);
    expect(statements.some(({ sql }) => sql.includes("role_room_release_storage_reservation"))).toBe(false);
  });
});
