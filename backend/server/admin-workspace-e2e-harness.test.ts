import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Pool } from "pg";
import {
  ADMIN_WORKSPACE_E2E_USER_ID,
  canUseAdminWorkspaceE2eSession,
  createAdminWorkspaceE2eApp,
  readAdminWorkspaceE2eHarnessConfig,
} from "./admin-workspace-e2e-harness";
import {
  ADMIN_WORKSPACE_E2E_MIGRATIONS,
  ensureAdminWorkspaceE2eSchema,
} from "./admin-workspace-e2e-schema";

const DATABASE_URL =
  "postgresql://127.0.0.1:5432/creatorhub_admin_workspace_e2e";

describe("Admin Workspace E2E harness boot gate", () => {
  it("accepts an explicitly enabled test process and fixes the listener to loopback", () => {
    expect(
      readAdminWorkspaceE2eHarnessConfig({
        NODE_ENV: "test",
        CREATORHUB_ENABLE_ADMIN_WORKSPACE_E2E_HARNESS: " true ",
        ADMIN_WORKSPACE_E2E_PORT: "4317",
        ADMIN_WORKSPACE_E2E_DATABASE_URL: DATABASE_URL,
      }),
    ).toEqual({
      environment: "test",
      explicitlyEnabled: true,
      host: "127.0.0.1",
      port: 4317,
      databaseUrl: DATABASE_URL,
    });
  });

  it.each([
    {
      NODE_ENV: "production",
      CREATORHUB_ENABLE_ADMIN_WORKSPACE_E2E_HARNESS: "true",
    },
    {
      NODE_ENV: "development",
      CREATORHUB_ENABLE_ADMIN_WORKSPACE_E2E_HARNESS: "false",
    },
    {
      NODE_ENV: "staging",
      CREATORHUB_ENABLE_ADMIN_WORKSPACE_E2E_HARNESS: "true",
    },
  ])("refuses unsafe boot configuration %#", (unsafe) => {
    expect(() =>
      readAdminWorkspaceE2eHarnessConfig({ ...unsafe, DATABASE_URL }),
    ).toThrow();
  });

  it.each(["0", "1023", "65536", "3317.5", "not-a-port"])(
    "refuses invalid port %s",
    (port) => {
      expect(() =>
        readAdminWorkspaceE2eHarnessConfig({
          NODE_ENV: "test",
          CREATORHUB_ENABLE_ADMIN_WORKSPACE_E2E_HARNESS: "true",
          ADMIN_WORKSPACE_E2E_PORT: port,
          ADMIN_WORKSPACE_E2E_DATABASE_URL: DATABASE_URL,
        }),
      ).toThrow(/ADMIN_WORKSPACE_E2E_PORT/u);
    },
  );

  it.each([
    "postgresql://user@example.com:5432/creatorhub_admin_workspace_e2e",
    "postgresql://127.0.0.1:5432/creatorhub",
    "postgresql://127.0.0.1:5544/creatorhub_admin_workspace_e2e",
  ])("refuses non-local or incorrectly named database %s", (databaseUrl) => {
    expect(() =>
      readAdminWorkspaceE2eHarnessConfig({
        NODE_ENV: "test",
        CREATORHUB_ENABLE_ADMIN_WORKSPACE_E2E_HARNESS: "true",
        ADMIN_WORKSPACE_E2E_DATABASE_URL: databaseUrl,
      }),
    ).toThrow(/creatorhub_admin_workspace_e2e/u);
  });
});

describe("Admin Workspace E2E schema boundary", () => {
  function createPoolIdentity(
    databaseName: string,
    serverAddress: string | null = "127.0.0.1",
    serverPort: number | null = 5432,
  ) {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("current_database()")) {
        return {
          rows: [
            {
              database_name: databaseName,
              server_address: serverAddress,
              server_port: serverPort,
            },
          ],
        };
      }
      return { rows: [] };
    });
    const release = vi.fn();
    const pool = {
      connect: vi.fn(async () => ({ query, release })),
    } as unknown as Pool;
    return { pool, query, release };
  }

  it("refuses schema writes and rolls back outside the exact local E2E database", async () => {
    const { pool, query, release } = createPoolIdentity("neondb");

    await expect(ensureAdminWorkspaceE2eSchema(pool)).rejects.toThrow(
      /dedikerte lokale databasen/u,
    );
    expect(query).toHaveBeenCalledWith("ROLLBACK");
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("CREATE EXTENSION"),
      ),
    ).toBe(false);
    expect(release).toHaveBeenCalledOnce();
  });

  it("applies only the whitelist and resets mutable rows before commit", async () => {
    const { pool, query, release } = createPoolIdentity(
      "creatorhub_admin_workspace_e2e",
    );

    await ensureAdminWorkspaceE2eSchema(pool);

    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements).toHaveLength(ADMIN_WORKSPACE_E2E_MIGRATIONS.length + 6);
    expect(statements[0]).toBe("BEGIN");
    expect(statements[2]).toBe("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    expect(statements.at(-2)).toMatch(/TRUNCATE TABLE[\s\S]*admin_documents/u);
    expect(statements.at(-1)).toBe("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });
});

describe("Admin Workspace E2E harness request gate", () => {
  const valid = {
    environment: "test",
    explicitlyEnabled: true,
    authorization: "Bearer dev-admin-local-session",
    remoteAddress: "127.0.0.1",
    host: "127.0.0.1:4317",
    origin: "http://127.0.0.1:5317",
    fetchSite: "same-origin",
  } as const;

  it("accepts only the known token from a loopback browser/request path", () => {
    expect(canUseAdminWorkspaceE2eSession(valid)).toBe(true);
  });

  it.each([
    { authorization: "Bearer wrong-token" },
    { authorization: undefined },
    { remoteAddress: "10.0.0.8" },
    { host: "attacker.example" },
    { origin: "https://attacker.example" },
    { fetchSite: "cross-site" },
    { explicitlyEnabled: false },
    { environment: "production" },
  ])("rejects an unsafe request variant %#", (override) => {
    expect(canUseAdminWorkspaceE2eSession({ ...valid, ...override })).toBe(
      false,
    );
  });
});

describe("Admin Workspace E2E-only HTTP contracts", () => {
  const app = createAdminWorkspaceE2eApp({
    pool: {} as Pool,
    ownerUserId: ADMIN_WORKSPACE_E2E_USER_ID,
    config: { environment: "test", explicitlyEnabled: true },
  });

  it("returns the synthetic local admin only for the known loopback token", async () => {
    const authenticated = await request(app)
      .get("/api/auth/user")
      .set("Host", "127.0.0.1:3317")
      .set("Authorization", "Bearer dev-admin-local-session");
    expect(authenticated.status).toBe(200);
    expect(authenticated.body).toMatchObject({
      authenticated: true,
      user: {
        id: "local-admin",
        email: "admin@local.dev",
        role: "admin",
        isAdmin: true,
      },
    });

    const anonymous = await request(app)
      .get("/api/auth/user")
      .set("Host", "127.0.0.1:3317");
    expect(anonymous.status).toBe(200);
    expect(anonymous.body).toEqual({ authenticated: false, user: null });
  });

  it("rejects DNS-rebound Hosts before health and auth routes", async () => {
    const response = await request(app)
      .get("/__admin-workspace-e2e/health")
      .set("Host", "attacker.example");
    expect(response.status).toBe(403);
  });

  it("keeps broad shell feeds authenticated and empty", async () => {
    const response = await request(app)
      .get("/api/admin-room/workspace/today-agenda")
      .set("Host", "127.0.0.1:3317")
      .set("Authorization", "Bearer dev-admin-local-session");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
  });
});
