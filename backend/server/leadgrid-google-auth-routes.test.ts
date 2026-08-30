import express, { type Express } from "express";
import type { Pool } from "pg";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

type OAuthState = {
  payload: unknown;
  expiresAt: Date;
};

type FakeDatabaseOptions = {
  userId?: string;
  userRole?: string;
  organizationId?: string;
};

function createFakeDatabase(options: FakeDatabaseOptions = {}) {
  const userId = options.userId ?? "user-google-1";
  const userRole = options.userRole ?? "admin";
  const organizationId = options.organizationId ?? "org-google-1";
  const oauthStates = new Map<string, OAuthState>();
  const poolStatements: Array<{ sql: string; params: unknown[] }> = [];
  const clientStatements: Array<{ sql: string; params: unknown[] }> = [];

  const client = {
    query: vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue).trim();
      clientStatements.push({ sql, params });

      if (sql.includes("FROM users WHERE LOWER(email)")) {
        return {
          rows: [{
            id: userId,
            role: userRole,
            auth_session_version: "9",
            is_active: true,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("FROM organization_members om")) {
        return { rows: [{ id: organizationId }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    }),
    release: vi.fn(),
  };

  const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
    const sql = String(sqlValue).trim();
    poolStatements.push({ sql, params });

    if (sql.includes("CREATE TABLE IF NOT EXISTS role_room_oauth_pending_state")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("INSERT INTO role_room_oauth_pending_state")) {
      oauthStates.set(String(params[0]), {
        payload: JSON.parse(String(params[1])),
        expiresAt: params[2] as Date,
      });
      return { rows: [], rowCount: 1 };
    }
    if (
      sql.includes("DELETE FROM role_room_oauth_pending_state") &&
      sql.includes("RETURNING payload")
    ) {
      const stateId = String(params[0]);
      const stored = oauthStates.get(stateId);
      if (!stored || stored.expiresAt.getTime() <= Date.now()) {
        oauthStates.delete(stateId);
        return { rows: [], rowCount: 0 };
      }
      // The delete happens before this async function yields, mirroring the
      // atomic DELETE ... RETURNING guarantee used by PostgreSQL.
      oauthStates.delete(stateId);
      return { rows: [{ payload: stored.payload }], rowCount: 1 };
    }
    if (
      sql.includes("DELETE FROM role_room_oauth_pending_state") &&
      sql.includes("expires_at < NOW()")
    ) {
      for (const [stateId, stored] of oauthStates) {
        if (stored.expiresAt.getTime() <= Date.now()) oauthStates.delete(stateId);
      }
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("SELECT payload FROM role_room_oauth_pending_state")) {
      const stored = oauthStates.get(String(params[0]));
      return stored && stored.expiresAt.getTime() > Date.now()
        ? { rows: [{ payload: stored.payload }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (sql.includes("DELETE FROM role_room_oauth_pending_state")) {
      const deleted = oauthStates.delete(String(params[0]));
      return { rows: [], rowCount: deleted ? 1 : 0 };
    }

    if (
      sql.includes("creatorhub_auth_sessions") ||
      sql.includes("idx_creatorhub_auth_sessions_expires_at")
    ) {
      return { rows: [], rowCount: 0 };
    }

    throw new Error(`Unexpected pool query: ${sql}`);
  });

  const pool = {
    query,
    connect: vi.fn(async () => client),
  } as unknown as Pool;

  return {
    pool,
    client,
    oauthStates,
    poolStatements,
    clientStatements,
  };
}

type BuildOptions = {
  webClientId?: string;
  webClientSecret?: string;
  iosClientId?: string;
  captureClientId?: string;
  database?: ReturnType<typeof createFakeDatabase>;
};

async function buildApp(options: BuildOptions = {}) {
  vi.stubEnv("CREATORHUB_GOOGLE_CLIENT_ID", options.webClientId ?? "");
  vi.stubEnv("GOOGLE_CLIENT_ID", "");
  vi.stubEnv("CREATORHUB_GOOGLE_CLIENT_SECRET", options.webClientSecret ?? "");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
  vi.stubEnv("LEADGRID_IOS_GOOGLE_CLIENT_ID", options.iosClientId ?? "");
  vi.stubEnv("CAPTUREAPP_GOOGLE_CLIENT_ID", options.captureClientId ?? "");
  vi.stubEnv("ROLE_ROOM_PUBLIC_URL", "https://leadgrid.example.test");
  vi.resetModules();

  const { registerLeadgridGoogleAuthRoutes } = await import(
    "./leadgrid-google-auth-routes.js"
  );
  const database = options.database ?? createFakeDatabase();
  const activeSessions = new Map<string, any>();
  const app: Express = express();
  app.use(express.json());
  registerLeadgridGoogleAuthRoutes({
    app,
    pool: database.pool,
    activeSessions,
  });

  return { app, activeSessions, ...database };
}

function googleTokenInfo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    email: "Daniel@Example.Test",
    name: "Daniel Qazi",
    sub: "google-subject-1",
    aud: "leadgrid-web-client",
    email_verified: "true",
    ...overrides,
  };
}

function jsonFetchResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(async () => body),
    text: vi.fn(async () => JSON.stringify(body)),
  } as any;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Leadgrid Google authentication contract", () => {
  it("fails closed when no Google audience is configured", async () => {
    const fetchMock = vi.fn(async () =>
      jsonFetchResponse(googleTokenInfo({ aud: "attacker-client" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { app, pool } = await buildApp();

    await request(app)
      .post("/api/leadgrid/auth/google/exchange")
      .send({ id_token: "otherwise-valid-token" })
      .expect(401, { error: "Ugyldig Google-token" });

    await request(app)
      .get("/api/leadgrid/auth/google/start?platform=web")
      .expect(500, { error: "Google client_id ikke konfigurert" });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("rejects a token whose audience differs from every configured client", async () => {
    const fetchMock = vi.fn(async () =>
      jsonFetchResponse(googleTokenInfo({ aud: "hostile-client" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { app, pool } = await buildApp({
      webClientId: "leadgrid-web-client",
      iosClientId: "leadgrid-ios-client",
    });

    await request(app)
      .post("/api/leadgrid/auth/google/exchange")
      .send({ id_token: "wrong-audience-token" })
      .expect(401, { error: "Ugyldig Google-token" });

    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("persists the complete organization-bound session before commit", async () => {
    const fetchMock = vi.fn(async () => jsonFetchResponse(googleTokenInfo()));
    vi.stubGlobal("fetch", fetchMock);
    const database = createFakeDatabase({
      userId: "daniel-user",
      userRole: "admin",
      organizationId: "leadgrid-org",
    });
    const { app, activeSessions, client, clientStatements } = await buildApp({
      webClientId: "leadgrid-web-client",
      webClientSecret: "google-secret",
      database,
    });

    const response = await request(app)
      .post("/api/leadgrid/auth/google/exchange")
      .send({
        id_token: "valid-google-token",
        platform: "web",
        deviceInfo: {
          deviceName: "Leadgrid Web",
          model: "Browser",
          osVersion: "macOS",
          appVersion: "1.0",
        },
      })
      .expect(200);

    expect(response.body).toMatchObject({
      bearer: expect.stringMatching(/^[a-f0-9]{64}$/),
      user: {
        id: "daniel-user",
        email: "daniel@example.test",
        name: "Daniel Qazi",
        displayName: "Daniel Qazi",
        role: "admin",
        isAdmin: true,
        verified_email: true,
      },
      is_new_user: false,
      organization_id: "leadgrid-org",
    });
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");

    const sessionInsertIndex = clientStatements.findIndex(({ sql }) =>
      sql.includes("INSERT INTO creatorhub_auth_sessions"),
    );
    const commitIndex = clientStatements.findIndex(({ sql }) => sql === "COMMIT");
    expect(sessionInsertIndex).toBeGreaterThan(-1);
    expect(commitIndex).toBeGreaterThan(sessionInsertIndex);

    const sessionInsert = clientStatements[sessionInsertIndex];
    expect(sessionInsert.params[0]).toBe(response.body.bearer);
    const persistedSession = JSON.parse(String(sessionInsert.params[1]));
    expect(persistedSession).toMatchObject({
      userId: "daniel-user",
      email: "daniel@example.test",
      name: "Daniel Qazi",
      displayName: "Daniel Qazi",
      role: "admin",
      authSessionVersion: "9",
      activeOrganizationId: "leadgrid-org",
      loginAt: expect.any(String),
      isAdmin: true,
      verified_email: true,
    });
    expect(activeSessions.get(response.body.bearer)).toEqual(persistedSession);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("atomically consumes OAuth state once and rejects a replayed callback", async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url === "https://oauth2.googleapis.com/token") {
        return jsonFetchResponse({ id_token: "google-id-token" });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { app, oauthStates, poolStatements } = await buildApp({
      webClientId: "leadgrid-web-client",
      webClientSecret: "google-secret",
    });

    const started = await request(app)
      .get("/api/leadgrid/auth/google/start?platform=web")
      .expect(200);
    const state = String(started.body.state);
    expect(state).toMatch(/^[a-f0-9]{32}$/);
    expect(oauthStates.has(state)).toBe(true);

    const callbacks = await Promise.all([
      request(app)
        .post("/api/leadgrid/auth/google/callback")
        .send({ code: "one-time-code", state }),
      request(app)
        .post("/api/leadgrid/auth/google/callback")
        .send({ code: "replayed-code", state }),
    ]);

    expect(callbacks.map(({ status }) => status).sort()).toEqual([200, 400]);
    expect(callbacks.find(({ status }) => status === 200)?.body).toEqual({
      id_token: "google-id-token",
    });
    expect(callbacks.find(({ status }) => status === 400)?.body).toEqual({
      error: "Ugyldig state",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(oauthStates.has(state)).toBe(false);

    const consumes = poolStatements.filter(
      ({ sql }) =>
        sql.includes("DELETE FROM role_room_oauth_pending_state") &&
        sql.includes("RETURNING payload"),
    );
    expect(consumes).toHaveLength(2);
    expect(consumes.every(({ params }) => params[0] === state)).toBe(true);
  });

  it("keeps the web authorization code out of the next HTTP request URL", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { app, oauthStates } = await buildApp({
      webClientId: "leadgrid-web-client",
      webClientSecret: "google-secret",
    });

    const started = await request(app)
      .get("/api/leadgrid/auth/google/start?platform=web")
      .expect(200);
    const state = String(started.body.state);
    const callback = await request(app)
      .get("/api/leadgrid/auth/google/web-callback")
      .query({ code: "one-time-code", state })
      .expect(302);

    expect(callback.headers.location).toBe(
      `https://leadgrid.example.test/leadgrid/welcome#google_code=one-time-code&state=${state}`,
    );
    expect(callback.headers["cache-control"]).toContain("no-store");
    expect(callback.headers["referrer-policy"]).toBe("no-referrer");
    // GET only peeks so the following POST can atomically consume the state.
    expect(oauthStates.has(state)).toBe(true);
  });

  it("rejects invalid platforms and malformed or unknown state before Google", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { app, oauthStates, poolStatements } = await buildApp({
      webClientId: "leadgrid-web-client",
      webClientSecret: "google-secret",
    });

    await request(app)
      .get("/api/leadgrid/auth/google/start?platform=android")
      .expect(400, { error: "Ugyldig platform" });
    expect(
      poolStatements.some(({ sql }) =>
        sql.includes("INSERT INTO role_room_oauth_pending_state"),
      ),
    ).toBe(false);

    await request(app)
      .post("/api/leadgrid/auth/google/callback")
      .send({ code: "code", state: "not-a-valid-state" })
      .expect(400, { error: "Ugyldig state" });

    await request(app)
      .post("/api/leadgrid/auth/google/callback")
      .send({ code: "code", state: "ab".repeat(16) })
      .expect(400, { error: "Ugyldig state" });

    const invalidPayloadState = "cd".repeat(16);
    oauthStates.set(invalidPayloadState, {
      payload: { platform: "android", createdAt: Date.now() },
      expiresAt: new Date(Date.now() + 60_000),
    });
    await request(app)
      .post("/api/leadgrid/auth/google/callback")
      .send({ code: "code", state: invalidPayloadState })
      .expect(400, { error: "Ugyldig state" });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
