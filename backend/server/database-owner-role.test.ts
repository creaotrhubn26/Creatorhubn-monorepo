import { describe, expect, it, vi } from "vitest";
import {
  expectedDatabaseRoles,
  EXPECTED_DATABASE_LOGIN_ROLE,
  EXPECTED_DATABASE_OWNER_ROLE,
  verifyDatabaseOwnerSession,
} from "./database-owner-role";

const productionEnv = {
  DATABASE_LOGIN_ROLE: EXPECTED_DATABASE_LOGIN_ROLE,
  DATABASE_OWNER_ROLE: EXPECTED_DATABASE_OWNER_ROLE,
  NODE_ENV: "production",
};

function identity(overrides: Record<string, unknown> = {}) {
  return {
    session_user: EXPECTED_DATABASE_LOGIN_ROLE,
    current_user: EXPECTED_DATABASE_OWNER_ROLE,
    statement_timeout: "30s",
    runtime_role_setting_count: 1,
    exact_runtime_role_setting_count: 1,
    runtime_timeout_setting_count: 1,
    exact_runtime_timeout_setting_count: 1,
    login_can_login: true,
    login_inherits: false,
    login_is_superuser: false,
    login_can_create_role: false,
    login_can_create_database: false,
    login_can_replicate: false,
    login_bypasses_rls: false,
    owner_can_login: false,
    owner_inherits: false,
    owner_is_superuser: false,
    owner_can_create_role: false,
    owner_can_create_database: false,
    owner_can_replicate: false,
    owner_bypasses_rls: false,
    login_membership_count: 1,
    exact_owner_membership_count: 1,
    owner_membership_count: 0,
    owner_direct_member_count: 4,
    owner_admin_grant_count: 2,
    owner_admin_creator_grant_count: 1,
    owner_admin_member_count: 1,
    owner_migration_member_count: 1,
    owner_runtime_member_count: 1,
    ...overrides,
  };
}

function poolWith(row: Record<string, unknown> | undefined) {
  return {
    query: vi.fn(async () => ({ rows: row ? [row] : [] })),
  };
}

describe("database owner role configuration", () => {
  it("requires both fixed roles in production", () => {
    expect(() => expectedDatabaseRoles({ NODE_ENV: "production" })).toThrow(
      /must both be configured/,
    );
    expect(() =>
      expectedDatabaseRoles({
        ...productionEnv,
        DATABASE_LOGIN_ROLE: "creatorhub_migrator",
      }),
    ).toThrow(/must be exactly creatorhub_runtime_login/);
    expect(() =>
      expectedDatabaseRoles({
        ...productionEnv,
        DATABASE_OWNER_ROLE: "neondb_owner",
      }),
    ).toThrow(/must be exactly creatorhub_schema_owner/);
  });

  it("lets disposable local and test databases opt out", () => {
    expect(expectedDatabaseRoles({ NODE_ENV: "test" })).toBeNull();
  });
});

describe("database owner role boot verification", () => {
  it("accepts the exact login/default-owner topology", async () => {
    const pool = poolWith(identity());
    await expect(
      verifyDatabaseOwnerSession(pool as never, productionEnv),
    ).resolves.toBeUndefined();
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("pg_auth_members"),
      [
        EXPECTED_DATABASE_LOGIN_ROLE,
        EXPECTED_DATABASE_OWNER_ROLE,
        "neondb_owner",
        "creatorhub_migration_login",
        EXPECTED_DATABASE_LOGIN_ROLE,
        "30s",
      ],
    );
  });

  it("rejects a missing owner role", async () => {
    await expect(
      verifyDatabaseOwnerSession(poolWith(undefined) as never, productionEnv),
    ).rejects.toThrow(/does not exist/);
  });

  it.each([
    ["wrong login", { session_user: "creatorhub_migrator" }, /session_user/],
    ["owner not active", { current_user: "neondb_owner" }, /default role/],
    ["timeout not active", { statement_timeout: "0" }, /statement_timeout/],
    [
      "extra role setting",
      { runtime_role_setting_count: 2 },
      /runtime settings/,
    ],
    [
      "wrong role setting",
      { exact_runtime_role_setting_count: 0 },
      /runtime settings/,
    ],
    [
      "wrong timeout setting",
      { exact_runtime_timeout_setting_count: 0 },
      /runtime settings/,
    ],
    ["login is NOLOGIN", { login_can_login: false }, /login role has unsafe/],
    ["login inherits", { login_inherits: true }, /login role has unsafe/],
    [
      "login is superuser",
      { login_is_superuser: true },
      /login role has unsafe/,
    ],
    [
      "login can create roles",
      { login_can_create_role: true },
      /login role has unsafe/,
    ],
    [
      "login can create databases",
      { login_can_create_database: true },
      /login role has unsafe/,
    ],
    [
      "login can replicate",
      { login_can_replicate: true },
      /login role has unsafe/,
    ],
    [
      "login bypasses RLS",
      { login_bypasses_rls: true },
      /login role has unsafe/,
    ],
    ["owner can login", { owner_can_login: true }, /unsafe role attributes/],
    ["owner inherits", { owner_inherits: true }, /unsafe role attributes/],
    [
      "owner is superuser",
      { owner_is_superuser: true },
      /unsafe role attributes/,
    ],
    [
      "owner can create roles",
      { owner_can_create_role: true },
      /unsafe role attributes/,
    ],
    [
      "owner can create databases",
      { owner_can_create_database: true },
      /unsafe role attributes/,
    ],
    [
      "owner can replicate",
      { owner_can_replicate: true },
      /unsafe role attributes/,
    ],
    [
      "owner bypasses RLS",
      { owner_bypasses_rls: true },
      /unsafe role attributes/,
    ],
    [
      "login has an extra membership",
      { login_membership_count: 2 },
      /exactly one/,
    ],
    [
      "login membership options differ",
      { exact_owner_membership_count: 0 },
      /exactly one/,
    ],
    [
      "owner is a member",
      { owner_membership_count: 1 },
      /must not be a member/,
    ],
    [
      "owner has an unexpected member",
      { owner_direct_member_count: 5 },
      /unexpected direct members/,
    ],
    [
      "owner admin grant count differs",
      { owner_admin_grant_count: 1 },
      /unexpected direct members/,
    ],
    [
      "owner automatic creator grant options differ",
      { owner_admin_creator_grant_count: 0 },
      /unexpected direct members/,
    ],
    [
      "owner SET membership options differ",
      { owner_admin_member_count: 0 },
      /unexpected direct members/,
    ],
    [
      "migration membership options differ",
      { owner_migration_member_count: 0 },
      /unexpected direct members/,
    ],
    [
      "runtime membership options differ",
      { owner_runtime_member_count: 0 },
      /unexpected direct members/,
    ],
  ])("rejects %s", async (_label, overrides, expected) => {
    await expect(
      verifyDatabaseOwnerSession(
        poolWith(identity(overrides)) as never,
        productionEnv,
      ),
    ).rejects.toThrow(expected as RegExp);
  });

  it("does not query a disposable database without role configuration", async () => {
    const pool = poolWith(identity());
    await verifyDatabaseOwnerSession(pool as never, { NODE_ENV: "test" });
    expect(pool.query).not.toHaveBeenCalled();
  });
});
