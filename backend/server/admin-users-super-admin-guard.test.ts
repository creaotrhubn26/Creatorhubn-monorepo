import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { setupAdminUsersRoutes, type AdminUsersRoutesDeps } from "./admin-users-routes.js";

const TARGET_ID = "32a70fa9-fd46-49db-9460-a87b23639a3c";

const ROLE_IDS = new Set([
  "super_admin",
  "admin",
  "academy_admin",
  "user",
  "instructor",
  "vendor",
]);

function buildApp(sessionRole: string, targetRole: string) {
  const app = express();
  app.use(express.json());

  const upserts: Array<Record<string, unknown>> = [];

  setupAdminUsersRoutes({
    app,
    pool: {} as never,
    requireAdminSession: () => ({ userId: "admin-1", email: "admin@test", role: sessionRole }),
    activeSessions: new Map(),
    getAdminRoleCatalog: () => [],
    ADMIN_SESSION_ROLES: new Set(["admin", "super_admin"]),
    listAdminUsersSnapshot: async () => [],
    normalizeAdminRoleId: (role: unknown) => {
      const raw = String(role ?? "").trim().toLowerCase().replace(/\s+/g, "_");
      return ROLE_IDS.has(raw) ? raw : "user";
    },
    resolveAdminProfessionForPersistence: () => "admin",
    upsertAdminInviteRequest: async (input: Record<string, unknown>) => {
      upserts.push(input);
      return { id: "invite-1", email: input.email };
    },
    upsertAdminAccountUser: async (input: Record<string, unknown>) => {
      upserts.push(input);
      return { id: TARGET_ID, email: "target@test" };
    },
    ensureInviteRequestAccessProvisioning: async () => null,
    resolveAdminUserView: async () => ({
      id: TARGET_ID,
      accountUserId: TARGET_ID,
      inviteRequestId: null,
      email: "target@test",
      role: targetRole,
      profession: "admin",
    }),
    toAdminString: (value: unknown) =>
      typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
    toAdminBoolean: (value: unknown) => (typeof value === "boolean" ? value : null),
    findAdminInviteRequest: async () => null,
    findAdminAccountUser: async () => null,
    ensureCommunityAccessForApprovedInvite: async () => null,
    normalizeInvitePlanId: () => null,
    buildAdminRoleEntry: (role: string) => ({ id: role, name: role, description: "", permissions: [] }),
    persistAuthSession: async () => undefined,
  } as unknown as AdminUsersRoutesDeps);

  return { app, upserts };
}

describe("super_admin role assignment guard", () => {
  it("blocks an admin session from promoting anyone to super_admin", async () => {
    const { app, upserts } = buildApp("admin", "user");
    const res = await request(app)
      .patch(`/api/admin/users/${TARGET_ID}`)
      .send({ role: "super_admin" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("super_admin_tilgang_kreves");
    expect(upserts).toHaveLength(0);
  });

  it("blocks an admin session from demoting an existing super_admin", async () => {
    const { app, upserts } = buildApp("admin", "super_admin");
    const res = await request(app)
      .patch(`/api/admin/users/${TARGET_ID}`)
      .send({ role: "admin" });

    expect(res.status).toBe(403);
    expect(upserts).toHaveLength(0);
  });

  it("blocks an admin session from creating a super_admin user", async () => {
    const { app, upserts } = buildApp("admin", "user");
    const res = await request(app)
      .post("/api/admin/users")
      .send({ email: "ny@test", role: "super_admin" });

    expect(res.status).toBe(403);
    expect(upserts).toHaveLength(0);
  });

  it("lets a super_admin session assign super_admin", async () => {
    const { app, upserts } = buildApp("super_admin", "user");
    const res = await request(app)
      .patch(`/api/admin/users/${TARGET_ID}`)
      .send({ role: "super_admin" });

    expect(res.status).not.toBe(403);
    expect(upserts.some((entry) => entry.role === "super_admin")).toBe(true);
  });

  it("leaves ordinary role changes untouched for an admin session", async () => {
    const { app, upserts } = buildApp("admin", "user");
    const res = await request(app)
      .patch(`/api/admin/users/${TARGET_ID}`)
      .send({ role: "instructor" });

    expect(res.status).not.toBe(403);
    expect(upserts.some((entry) => entry.role === "instructor")).toBe(true);
  });
});
