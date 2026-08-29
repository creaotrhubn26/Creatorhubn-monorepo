import express from "express";
import type { Pool, PoolClient, QueryResult } from "pg";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAuthoritativeAuthSession } from "./auth-session-authority.js";
import { registerIpadPairRoutes } from "./ipad-pair-routes.js";

type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  auth_session_version: string;
};

const ACTIVE_USER: CurrentUser = {
  id: "user-1",
  email: "owner@example.test",
  name: "Leadgrid Owner",
  role: "admin",
  is_active: true,
  auth_session_version: "9",
};

function queryResult(rows: unknown[]): QueryResult<any> {
  return {
    command: "SELECT",
    rowCount: rows.length,
    oid: 0,
    fields: [],
    rows,
  };
}

function setup(options?: {
  user?: CurrentUser | null;
  failCanonicalPersistence?: boolean;
  pairingAuthSessionVersion?: string | null;
  authorityStatus?: "authenticated" | "unauthenticated" | "unavailable";
}) {
  const user = options?.user === undefined ? ACTIVE_USER : options.user;
  const events: string[] = [];
  const canonicalSessions = new Map<string, Record<string, unknown>>();

  const clientQuery = vi.fn(
    async (sqlValue: unknown, values?: readonly unknown[]) => {
      const sql = String(sqlValue);
      if (sql === "BEGIN") {
        events.push("BEGIN");
        return queryResult([]);
      }
      if (sql === "COMMIT") {
        events.push("COMMIT");
        return queryResult([]);
      }
      if (sql === "ROLLBACK") {
        events.push("ROLLBACK");
        return queryResult([]);
      }
      if (sql.includes("FROM ipad_pair_tokens")) {
        events.push("pair_lookup");
        return queryResult([{
          token: "pair-token",
          user_id: "user-1",
          email: "stale@example.test",
          issued_auth_session_version:
            options && Object.hasOwn(options, "pairingAuthSessionVersion")
              ? options.pairingAuthSessionVersion
              : ACTIVE_USER.auth_session_version,
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          used_at: null,
        }]);
      }
      if (sql.includes("UPDATE ipad_pair_tokens")) {
        events.push("pair_claim");
        return queryResult([{ token: "pair-token" }]);
      }
      if (sql.includes("FROM users")) {
        events.push("user_authority");
        return queryResult(user ? [user] : []);
      }
      if (sql.includes("INSERT INTO creatorhub_auth_sessions")) {
        events.push("canonical_persist");
        if (options?.failCanonicalPersistence) {
          throw new Error("database unavailable");
        }
        canonicalSessions.set(
          String(values?.[0]),
          JSON.parse(String(values?.[1])) as Record<string, unknown>,
        );
        return queryResult([]);
      }
      throw new Error(`unexpected transaction query: ${sql}`);
    },
  );
  const client = {
    query: clientQuery,
    release: vi.fn(() => events.push("release")),
  } as unknown as PoolClient;

  const poolQuery = vi.fn(
    async (sqlValue: unknown, values?: readonly unknown[]) => {
      const sql = String(sqlValue);
      if (sql.includes("SELECT 1 FROM ipad_pair_tokens")) {
        return queryResult([]);
      }
      if (sql.includes("INSERT INTO ipad_pair_tokens")) {
        events.push("pair_issued");
        return queryResult([]);
      }
      if (sql.includes("SELECT short_code") && sql.includes("FROM ipad_pair_tokens")) {
        return queryResult([]);
      }
      if (sql.includes("FROM creatorhub_auth_sessions")) {
        const snapshot = canonicalSessions.get(String(values?.[0]));
        return queryResult(snapshot && user ? [{
          session_data: snapshot,
          user_id: user.id,
          user_email: user.email,
          user_role: user.role,
          user_is_active: user.is_active,
          auth_session_version: user.auth_session_version,
        }] : []);
      }
      throw new Error(`unexpected pool query: ${sql}`);
    },
  );
  const pool = {
    connect: vi.fn(async () => client),
    query: poolQuery,
  } as unknown as Pool;
  const activeSessions = new Map<string, any>();
  const setInCache = activeSessions.set.bind(activeSessions);
  vi.spyOn(activeSessions, "set").mockImplementation((token, session) => {
    events.push("cache");
    return setInCache(token, session);
  });

  const app = express();
  app.use(express.json());
  const resolveAuthoritativeSession = vi.fn(async () => {
    const status = options?.authorityStatus ?? "authenticated";
    if (status !== "authenticated") return { status } as const;
    return {
      status: "authenticated" as const,
      session: {
        userId: ACTIVE_USER.id,
        email: ACTIVE_USER.email,
        name: ACTIVE_USER.name ?? ACTIVE_USER.email,
        role: ACTIVE_USER.role,
        loginAt: "2026-08-30T10:00:00.000Z",
        authSessionVersion: ACTIVE_USER.auth_session_version,
      },
    };
  });
  registerIpadPairRoutes({
    app,
    pool,
    activeSessions,
    resolveAuthoritativeSession,
  });

  return {
    app,
    pool,
    clientQuery,
    poolQuery,
    activeSessions,
    canonicalSessions,
    events,
    resolveAuthoritativeSession,
  };
}

describe("iPad pairing exchange canonical session authority", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists a complete current-user snapshot before commit/cache and the bearer resolves authoritatively", async () => {
    const context = setup();
    const response = await request(context.app)
      .post("/api/ipad-tokens/exchange")
      .send({
        token: "pair-token",
        deviceInfo: { model: "iPad" },
      });

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: ACTIVE_USER.id,
      email: ACTIVE_USER.email,
      name: ACTIVE_USER.name,
      role: ACTIVE_USER.role,
    });
    expect(response.body.bearer).toMatch(/^[a-f0-9]{64}$/);

    const snapshot = context.canonicalSessions.get(response.body.bearer);
    expect(snapshot).toMatchObject({
      userId: ACTIVE_USER.id,
      email: ACTIVE_USER.email,
      name: ACTIVE_USER.name,
      role: ACTIVE_USER.role,
      authSessionVersion: ACTIVE_USER.auth_session_version,
      isAdmin: true,
    });
    expect(snapshot?.loginAt).toEqual(expect.any(String));
    expect(context.activeSessions.get(response.body.bearer)).toEqual(snapshot);
    expect(context.events.indexOf("canonical_persist"))
      .toBeLessThan(context.events.indexOf("COMMIT"));
    expect(context.events.indexOf("COMMIT"))
      .toBeLessThan(context.events.indexOf("cache"));
    const userAuthoritySql = String(
      context.clientQuery.mock.calls.find(([sql]) =>
        String(sql).includes("FROM users"),
      )?.[0] ?? "",
    );
    expect(userAuthoritySql).toContain("CONCAT_WS");
    expect(userAuthoritySql).not.toContain("name::text");
    expect(userAuthoritySql).not.toContain("username");

    const resolverCache = new Map<string, any>();
    const resolution = await resolveAuthoritativeAuthSession({
      pool: context.pool,
      token: response.body.bearer,
      activeSessions: resolverCache,
    });
    expect(resolution).toMatchObject({
      status: "authenticated",
      session: {
        userId: ACTIVE_USER.id,
        role: ACTIVE_USER.role,
        authSessionVersion: ACTIVE_USER.auth_session_version,
      },
    });
  });

  it("rolls back without consuming the code when authority changed after generation", async () => {
    const context = setup({ pairingAuthSessionVersion: "8" });
    const response = await request(context.app)
      .post("/api/ipad-tokens/exchange")
      .send({ token: "pair-token" });

    expect(response.status).toBe(410);
    expect(response.body).toEqual({ error: "pairing_authority_changed" });
    expect(context.events).toContain("pair_claim");
    expect(context.events).toContain("ROLLBACK");
    expect(context.events).not.toContain("canonical_persist");
    expect(context.events).not.toContain("COMMIT");
    expect(context.activeSessions.size).toBe(0);
  });

  it("rejects a pre-migration pairing row with no issued authority version", async () => {
    const context = setup({ pairingAuthSessionVersion: null });
    const response = await request(context.app)
      .post("/api/ipad-tokens/exchange")
      .send({ token: "pair-token" });

    expect(response.status).toBe(410);
    expect(response.body).toEqual({ error: "pairing_authority_changed" });
    expect(context.events).toContain("ROLLBACK");
    expect(context.events).not.toContain("canonical_persist");
    expect(context.activeSessions.size).toBe(0);
  });

  it("fails closed for an inactive current user and rolls back the pairing claim", async () => {
    const context = setup({
      user: { ...ACTIVE_USER, is_active: false },
    });
    const response = await request(context.app)
      .post("/api/ipad-tokens/exchange")
      .send({ token: "pair-token" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "bruker_ikke_aktiv" });
    expect(context.events).toContain("pair_claim");
    expect(context.events).toContain("ROLLBACK");
    expect(context.events).not.toContain("canonical_persist");
    expect(context.events).not.toContain("COMMIT");
    expect(context.activeSessions.size).toBe(0);
  });

  it("fails closed and rolls back when canonical persistence is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const context = setup({ failCanonicalPersistence: true });
    const response = await request(context.app)
      .post("/api/ipad-tokens/exchange")
      .send({ token: "pair-token" });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "session_store_unavailable" });
    expect(context.events).toContain("canonical_persist");
    expect(context.events).toContain("ROLLBACK");
    expect(context.events).not.toContain("COMMIT");
    expect(context.canonicalSessions.size).toBe(0);
    expect(context.activeSessions.size).toBe(0);
  });
});

describe("iPad pairing issuance authority", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("binds a new pair code to the exact authoritative session version", async () => {
    const context = setup();
    const response = await request(context.app)
      .post("/api/admin-room/ipad-tokens/generate")
      .set("authorization", "Bearer web-session")
      .send({});

    expect(response.status).toBe(200);
    const insertCall = context.poolQuery.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO ipad_pair_tokens"),
    );
    expect(String(insertCall?.[0])).toContain("auth_session_version");
    expect(insertCall?.[1]?.[4]).toBe(ACTIVE_USER.auth_session_version);
    expect(context.resolveAuthoritativeSession).toHaveBeenCalledOnce();
  });

  it.each([
    ["unauthenticated", 401, "Innlogging kreves"],
    ["unavailable", 503, "session_authority_unavailable"],
  ] as const)(
    "rejects generate when authority is %s",
    async (authorityStatus, expectedStatus, expectedError) => {
      const context = setup({ authorityStatus });
      const response = await request(context.app)
        .post("/api/admin-room/ipad-tokens/generate")
        .send({});
      expect(response.status).toBe(expectedStatus);
      expect(response.body).toEqual({ error: expectedError });
      expect(context.poolQuery).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["unauthenticated", 401, "Innlogging kreves"],
    ["unavailable", 503, "session_authority_unavailable"],
  ] as const)(
    "rejects recent when authority is %s",
    async (authorityStatus, expectedStatus, expectedError) => {
      const context = setup({ authorityStatus });
      const response = await request(context.app)
        .get("/api/admin-room/ipad-tokens/recent");
      expect(response.status).toBe(expectedStatus);
      expect(response.body).toEqual({ error: expectedError });
      expect(context.poolQuery).not.toHaveBeenCalled();
    },
  );
});
