import express, { type Express } from "express";
import type { Pool } from "pg";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type StoredState = {
  platform: string;
  createdAt: number;
  clientId?: string;
  redirectUri?: string;
};

const oauthStore = vi.hoisted(() => {
  const states = new Map<string, StoredState>();

  return {
    states,
    persist: vi.fn(
      async (_pool: unknown, state: string, payload: StoredState) => {
        states.set(state, payload);
        return true;
      },
    ),
    load: vi.fn(
      async (_pool: unknown, state: string) => states.get(state) ?? null,
    ),
    consume: vi.fn(async (_pool: unknown, state: string) => {
      const payload = states.get(state) ?? null;
      states.delete(state);
      return payload;
    }),
  };
});

vi.mock("./role-room-oauth-store", () => ({
  persistOauthState: oauthStore.persist,
  loadOauthState: oauthStore.load,
  consumeOauthState: oauthStore.consume,
}));

const googleVerifier = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken = googleVerifier.verifyIdToken;
  },
}));

type GoogleEnvOverrides = Partial<{
  LEADGRID_GOOGLE_CLIENT_ID: string;
  LEADGRID_GOOGLE_CLIENT_SECRET: string;
  CREATORHUB_GOOGLE_CLIENT_ID: string;
  CREATORHUB_GOOGLE_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  LEADGRID_PUBLIC_URL: string;
  ROLE_ROOM_PUBLIC_URL: string;
  ROLE_ROOM_GOOGLE_CLIENT_ID: string;
  CAPTUREAPP_GOOGLE_CLIENT_ID: string;
  LEADGRID_IOS_GOOGLE_CLIENT_ID: string;
}>;

async function buildAppPair(
  overrides: GoogleEnvOverrides = {},
  poolOverride?: Pool,
) {
  const env = {
    LEADGRID_GOOGLE_CLIENT_ID: "",
    LEADGRID_GOOGLE_CLIENT_SECRET: "",
    CREATORHUB_GOOGLE_CLIENT_ID: "leadgrid-web-client",
    CREATORHUB_GOOGLE_CLIENT_SECRET: "leadgrid-web-secret",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    LEADGRID_PUBLIC_URL: "",
    ROLE_ROOM_PUBLIC_URL: "https://leadgrid.example.test",
    ROLE_ROOM_GOOGLE_CLIENT_ID: "",
    CAPTUREAPP_GOOGLE_CLIENT_ID: "",
    LEADGRID_IOS_GOOGLE_CLIENT_ID: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  vi.resetModules();

  const { registerLeadgridGoogleAuthRoutes } =
    await import("./leadgrid-google-auth-routes.js");
  const pool = poolOverride ?? ({} as Pool);
  const apps = [express(), express()];
  const sessionMaps = [new Map(), new Map()];

  for (const [index, app] of apps.entries()) {
    app.use(express.json());
    registerLeadgridGoogleAuthRoutes({
      app: app as Express,
      pool,
      activeSessions: sessionMaps[index],
    });
  }

  return {
    first: apps[0],
    second: apps[1],
    sessionMaps,
  };
}

beforeEach(() => {
  oauthStore.states.clear();
  vi.clearAllMocks();
  googleVerifier.verifyIdToken.mockRejectedValue(
    new Error("test token rejected"),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Leadgrid Google OAuth state", () => {
  it("prefers the dedicated Leadgrid client and callback base consistently", async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => ({
        ok: true,
        json: vi.fn(async () => ({ id_token: "dedicated-id-token" })),
        text: vi.fn(async () => ""),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { first } = await buildAppPair({
      LEADGRID_GOOGLE_CLIENT_ID: " dedicated-leadgrid-client ",
      LEADGRID_GOOGLE_CLIENT_SECRET: " dedicated-leadgrid-secret ",
      CREATORHUB_GOOGLE_CLIENT_ID: "shared-creatorhub-client",
      CREATORHUB_GOOGLE_CLIENT_SECRET: "shared-creatorhub-secret",
      GOOGLE_CLIENT_ID: "generic-google-client",
      GOOGLE_CLIENT_SECRET: "generic-google-secret",
      LEADGRID_PUBLIC_URL: " https://leadgrid.example.test/ ",
      ROLE_ROOM_PUBLIC_URL: "https://role-room.example.test",
    });

    const started = await request(first)
      .get("/api/leadgrid/auth/google/start?platform=web")
      .expect(200);
    const authUrl = new URL(String(started.body.auth_url));
    expect(authUrl.searchParams.get("client_id")).toBe(
      "dedicated-leadgrid-client",
    );
    expect(authUrl.searchParams.get("redirect_uri")).toBe(
      "https://leadgrid.example.test/api/leadgrid/auth/google/web-callback",
    );
    expect(authUrl.searchParams.has("access_type")).toBe(false);

    await request(first)
      .post("/api/leadgrid/auth/google/callback")
      .send({ code: "one-time-code", state: started.body.state })
      .expect(200, { id_token: "dedicated-id-token" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const tokenRequest = fetchMock.mock.calls[0]?.[1];
    const tokenBody = new URLSearchParams(String(tokenRequest?.body));
    expect(tokenBody.get("client_id")).toBe("dedicated-leadgrid-client");
    expect(tokenBody.get("client_secret")).toBe("dedicated-leadgrid-secret");
    expect(tokenBody.get("redirect_uri")).toBe(
      "https://leadgrid.example.test/api/leadgrid/auth/google/web-callback",
    );
  });

  it("keeps the existing CreatorHub and Role Room configuration as fallback", async () => {
    const { first } = await buildAppPair();

    const started = await request(first)
      .get("/api/leadgrid/auth/google/start?platform=web")
      .expect(200);
    const authUrl = new URL(String(started.body.auth_url));

    expect(authUrl.searchParams.get("client_id")).toBe("leadgrid-web-client");
    expect(authUrl.searchParams.get("redirect_uri")).toBe(
      "https://leadgrid.example.test/api/leadgrid/auth/google/web-callback",
    );
  });

  it("uses the complete generic pair when CreatorHub is only partially configured", async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => ({
        ok: true,
        json: vi.fn(async () => ({ id_token: "generic-id-token" })),
        text: vi.fn(async () => ""),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { first } = await buildAppPair({
      CREATORHUB_GOOGLE_CLIENT_ID: "partial-creatorhub-client",
      CREATORHUB_GOOGLE_CLIENT_SECRET: "  ",
      GOOGLE_CLIENT_ID: "generic-google-client",
      GOOGLE_CLIENT_SECRET: "generic-google-secret",
    });

    const started = await request(first)
      .get("/api/leadgrid/auth/google/start?platform=web")
      .expect(200);
    const authUrl = new URL(String(started.body.auth_url));

    expect(authUrl.searchParams.get("client_id")).toBe("generic-google-client");

    await request(first)
      .post("/api/leadgrid/auth/google/callback")
      .send({ code: "one-time-code", state: started.body.state })
      .expect(200, { id_token: "generic-id-token" });

    const tokenRequest = fetchMock.mock.calls[0]?.[1];
    const tokenBody = new URLSearchParams(String(tokenRequest?.body));
    expect(tokenBody.get("client_id")).toBe("generic-google-client");
    expect(tokenBody.get("client_secret")).toBe("generic-google-secret");
  });

  it.each([
    ["client ID only", "dedicated-leadgrid-client", ""],
    ["client secret only", "", "dedicated-leadgrid-secret"],
  ])(
    "fails closed before state creation for partial dedicated config: %s",
    async (_case, clientId, clientSecret) => {
      const { first } = await buildAppPair({
        LEADGRID_GOOGLE_CLIENT_ID: clientId,
        LEADGRID_GOOGLE_CLIENT_SECRET: clientSecret,
      });

      await request(first)
        .get("/api/leadgrid/auth/google/start?platform=web")
        .expect(500, {
          error: "Leadgrid Google credentials er ufullstendig konfigurert",
        });

      expect(oauthStore.persist).not.toHaveBeenCalled();

      await request(first)
        .post("/api/leadgrid/auth/google/exchange")
        .send({ id_token: "otherwise-valid-google-token" })
        .expect(503, {
          error: "Leadgrid Google OAuth er ufullstendig konfigurert",
        });
      expect(googleVerifier.verifyIdToken).not.toHaveBeenCalled();
    },
  );

  it("fails closed on direct exchange when no Leadgrid credential pair exists", async () => {
    const { first } = await buildAppPair({
      CREATORHUB_GOOGLE_CLIENT_ID: "",
      CREATORHUB_GOOGLE_CLIENT_SECRET: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    });

    await request(first)
      .post("/api/leadgrid/auth/google/exchange")
      .send({ id_token: "otherwise-valid-google-token" })
      .expect(503, {
        error: "Leadgrid Google OAuth er ufullstendig konfigurert",
      });
    expect(googleVerifier.verifyIdToken).not.toHaveBeenCalled();
  });

  it("limits Leadgrid token verification to Leadgrid audiences", async () => {
    googleVerifier.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        aud: "capture-app-client",
        email: "daniel@example.test",
        email_verified: true,
        sub: "google-user",
      }),
    });
    const { first } = await buildAppPair({
      LEADGRID_GOOGLE_CLIENT_ID: "dedicated-leadgrid-client",
      LEADGRID_GOOGLE_CLIENT_SECRET: "dedicated-leadgrid-secret",
      LEADGRID_IOS_GOOGLE_CLIENT_ID: "leadgrid-ios-a, leadgrid-ios-b",
      CAPTUREAPP_GOOGLE_CLIENT_ID: "capture-app-client",
      CREATORHUB_GOOGLE_CLIENT_ID: "shared-creatorhub-client",
      CREATORHUB_GOOGLE_CLIENT_SECRET: "shared-creatorhub-secret",
    });

    await request(first)
      .post("/api/leadgrid/auth/google/exchange")
      .send({ id_token: "capture-token" })
      .expect(401, { error: "Ugyldig Google-token" });

    expect(googleVerifier.verifyIdToken).toHaveBeenCalledWith({
      idToken: "capture-token",
      audience: [
        "dedicated-leadgrid-client",
        "leadgrid-ios-a",
        "leadgrid-ios-b",
      ],
    });
  });

  it("commits the native bearer before caching a complete local session", async () => {
    googleVerifier.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        aud: "dedicated-leadgrid-client",
        email: "leadgrid@example.test",
        email_verified: true,
        name: "Leadgrid User",
        sub: "google-user",
      }),
    });
    const clientQuery = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (sql.includes("SELECT id, role")) {
        return {
          rows: [{ id: "user-1", role: "super_admin", is_active: true }],
        };
      }
      if (sql.includes("FROM organization_members om")) {
        return { rows: [{ id: "org-1" }] };
      }
      if (sql.includes("INSERT INTO ipad_tokens")) return { rows: [] };
      throw new Error(`Unexpected SQL in test: ${sql}`);
    });
    const release = vi.fn();
    const pool = {
      connect: vi.fn(async () => ({ query: clientQuery, release })),
    } as unknown as Pool;
    const { first, sessionMaps } = await buildAppPair(
      {
        LEADGRID_GOOGLE_CLIENT_ID: "dedicated-leadgrid-client",
        LEADGRID_GOOGLE_CLIENT_SECRET: "dedicated-leadgrid-secret",
      },
      pool,
    );

    const exchanged = await request(first)
      .post("/api/leadgrid/auth/google/exchange")
      .send({ id_token: "valid-leadgrid-token", platform: "ios_native_app" })
      .expect(200);

    expect(exchanged.body.bearer).toMatch(/^[a-f0-9]{64}$/);
    expect(sessionMaps[0].get(exchanged.body.bearer)).toMatchObject({
      userId: "user-1",
      email: "leadgrid@example.test",
      role: "super_admin",
      name: "Leadgrid User",
      loginAt: expect.any(String),
    });
    expect(clientQuery.mock.calls.map(([sql]) => String(sql))).toEqual([
      "BEGIN",
      expect.stringContaining("SELECT id, role"),
      expect.stringContaining("FROM organization_members om"),
      expect.stringContaining("INSERT INTO ipad_tokens"),
      "COMMIT",
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it("rejects an inactive existing account before minting a bearer", async () => {
    googleVerifier.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        aud: "dedicated-leadgrid-client",
        email: "inactive@example.test",
        email_verified: true,
        name: "Inactive User",
        sub: "google-user",
      }),
    });
    const clientQuery = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("SELECT id, role")) {
        return {
          rows: [{ id: "inactive-user", role: "member", is_active: false }],
        };
      }
      throw new Error(`Unexpected SQL in test: ${sql}`);
    });
    const release = vi.fn();
    const pool = {
      connect: vi.fn(async () => ({ query: clientQuery, release })),
    } as unknown as Pool;
    const { first, sessionMaps } = await buildAppPair(
      {
        LEADGRID_GOOGLE_CLIENT_ID: "dedicated-leadgrid-client",
        LEADGRID_GOOGLE_CLIENT_SECRET: "dedicated-leadgrid-secret",
      },
      pool,
    );

    await request(first)
      .post("/api/leadgrid/auth/google/exchange")
      .send({ id_token: "inactive-account-token" })
      .expect(403, { error: "account_inactive" });

    expect(clientQuery.mock.calls.map(([sql]) => String(sql))).toEqual([
      "BEGIN",
      expect.stringContaining("SELECT id, role"),
      "ROLLBACK",
    ]);
    expect(sessionMaps[0].size).toBe(0);
    expect(release).toHaveBeenCalledOnce();
  });

  it("keeps legacy Storyboard starts on the shared client and Role Room host", async () => {
    const { first } = await buildAppPair({
      LEADGRID_GOOGLE_CLIENT_ID: "dedicated-leadgrid-client",
      LEADGRID_GOOGLE_CLIENT_SECRET: "dedicated-leadgrid-secret",
      LEADGRID_PUBLIC_URL: "https://leadgrid.example.test",
      CREATORHUB_GOOGLE_CLIENT_ID: "shared-creatorhub-client",
      CREATORHUB_GOOGLE_CLIENT_SECRET: "shared-creatorhub-secret",
      ROLE_ROOM_PUBLIC_URL: "https://role-room.example.test",
    });

    const started = await request(first)
      .get("/api/leadgrid/auth/google/start?platform=ios-storyboard")
      .expect(200);
    const authUrl = new URL(String(started.body.auth_url));

    expect(authUrl.searchParams.get("client_id")).toBe(
      "shared-creatorhub-client",
    );
    expect(authUrl.searchParams.get("redirect_uri")).toBe(
      "https://role-room.example.test/api/leadgrid/auth/google/web-callback",
    );
  });

  it("rejects a callback when the OAuth client changed after state creation", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const original = await buildAppPair({
      LEADGRID_GOOGLE_CLIENT_ID: "leadgrid-client-a",
      LEADGRID_GOOGLE_CLIENT_SECRET: "leadgrid-secret-a",
    });
    const started = await request(original.first)
      .get("/api/leadgrid/auth/google/start?platform=web")
      .expect(200);

    const changed = await buildAppPair({
      LEADGRID_GOOGLE_CLIENT_ID: "leadgrid-client-b",
      LEADGRID_GOOGLE_CLIENT_SECRET: "leadgrid-secret-b",
    });
    await request(changed.second)
      .post("/api/leadgrid/auth/google/callback")
      .send({ code: "one-time-code", state: started.body.state })
      .expect(409, {
        error:
          "Google OAuth-konfigurasjonen ble endret. Start innloggingen på nytt.",
      });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("survives a callback on another instance and is atomically consumed once", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: vi.fn(async () => ({ id_token: "google-id-token" })),
      text: vi.fn(async () => ""),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { first, second } = await buildAppPair();

    const started = await request(first)
      .get("/api/leadgrid/auth/google/start?platform=ios")
      .expect(200);
    const state = String(started.body.state);

    expect(state).toMatch(/^[a-f0-9]{32}$/);
    expect(new URL(started.body.auth_url).searchParams.get("state")).toBe(
      state,
    );
    expect(oauthStore.states.get(state)?.platform).toBe("ios");

    const browserCallback = await request(second)
      .get("/api/leadgrid/auth/google/web-callback")
      .query({ code: "one-time-code", state })
      .expect(302);

    expect(browserCallback.headers.location).toBe(
      `leadgrid://oauth?code=one-time-code&state=${state}`,
    );
    expect(oauthStore.states.has(state)).toBe(true);

    const callbacks = await Promise.all([
      request(first)
        .post("/api/leadgrid/auth/google/callback")
        .send({ code: "one-time-code", state }),
      request(second)
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
    expect(oauthStore.consume).toHaveBeenCalledTimes(2);
    expect(oauthStore.states.has(state)).toBe(false);
  });

  it("fails closed when the shared state store is unavailable", async () => {
    oauthStore.persist.mockResolvedValueOnce(false);
    const { first } = await buildAppPair();

    await request(first)
      .get("/api/leadgrid/auth/google/start?platform=web")
      .expect(503, { error: "OAuth state-lager er utilgjengelig" });

    expect(oauthStore.states.size).toBe(0);
  });

  it("deletes denied state and preserves the initiating app scheme", async () => {
    const { first, second } = await buildAppPair();
    const started = await request(first)
      .get("/api/leadgrid/auth/google/start?platform=ios-storyboard")
      .expect(200);
    const state = String(started.body.state);

    const denied = await request(second)
      .get("/api/leadgrid/auth/google/web-callback")
      .query({ error: "access_denied", state })
      .expect(302);

    expect(denied.headers.location).toBe(
      "storyboardstudio://oauth?error=access_denied",
    );
    expect(oauthStore.states.has(state)).toBe(false);
    expect(oauthStore.consume).toHaveBeenCalledWith(expect.anything(), state);

    await request(first)
      .get("/api/leadgrid/auth/google/web-callback")
      .query({ code: "late-code", state })
      .expect(400, "Ugyldig state");
  });

  it("keeps web success state for POST and consumes web denial state", async () => {
    const { first, second } = await buildAppPair();
    const successfulStart = await request(first)
      .get("/api/leadgrid/auth/google/start?platform=web")
      .expect(200);
    const successfulState = String(successfulStart.body.state);

    const successfulCallback = await request(second)
      .get("/api/leadgrid/auth/google/web-callback")
      .query({ code: "web-code", state: successfulState })
      .expect(302);

    expect(successfulCallback.headers.location).toBe(
      `https://leadgrid.example.test/leadgrid/welcome?google_code=web-code&state=${successfulState}`,
    );
    expect(oauthStore.states.has(successfulState)).toBe(true);

    const deniedStart = await request(first)
      .get("/api/leadgrid/auth/google/start?platform=web")
      .expect(200);
    const deniedState = String(deniedStart.body.state);
    const deniedCallback = await request(second)
      .get("/api/leadgrid/auth/google/web-callback")
      .query({ error: "access_denied", state: deniedState })
      .expect(302);

    expect(deniedCallback.headers.location).toBe(
      "https://leadgrid.example.test/leadgrid/welcome?google_error=access_denied",
    );
    expect(oauthStore.states.has(deniedState)).toBe(false);
  });

  it("rejects unsupported platforms and malformed state before database lookup", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { first } = await buildAppPair();

    await request(first)
      .get("/api/leadgrid/auth/google/start?platform=android")
      .expect(400, { error: "Ugyldig platform" });

    await request(first)
      .post("/api/leadgrid/auth/google/callback")
      .send({ code: "code", state: "not-a-valid-state" })
      .expect(400, { error: "Ugyldig state" });

    expect(oauthStore.persist).not.toHaveBeenCalled();
    expect(oauthStore.consume).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
