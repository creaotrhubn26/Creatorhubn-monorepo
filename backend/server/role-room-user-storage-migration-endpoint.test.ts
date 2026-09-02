import { readFileSync } from "node:fs";
import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { registerRoleRoomUserStorageRoutes } from "./role-room-user-storage-routes.js";

const retiredEndpoint = "/api/role-room/storage/admin/run-storage-migrations";

describe("Role Room storage migration endpoint", () => {
  it("is permanently retired without touching the database", async () => {
    const query = vi.fn();
    const app = express();
    registerRoleRoomUserStorageRoutes(app, {
      pool: { query } as unknown as Pool,
      activeSessions: new Map(),
    });

    const requests = [
      request(app).post(retiredEndpoint),
      request(app)
        .post(retiredEndpoint)
        .set("x-cron-trigger-token", "formerly-valid-token"),
      request(app).post(`${retiredEndpoint}?force=true`),
    ];

    for (const pendingRequest of requests) {
      const response = await pendingRequest;
      expect(response.status).toBe(410);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body).toEqual({ error: "migration_endpoint_retired" });
    }
    expect(query).not.toHaveBeenCalled();
  });

  it("contains no embedded ledger or migration executor", () => {
    const source = readFileSync(
      new URL("./role-room-user-storage-routes.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("_migrations_applied");
    for (const filename of [
      "267_role_room_per_user_storage.sql",
      "268_role_room_byo_migration_jobs.sql",
      "269_role_room_user_files_context.sql",
    ]) {
      expect(source).not.toContain(filename);
    }
  });
});
