import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type StoredState = {
  payload: unknown;
  expiresAt: Date;
};

const mocks = vi.hoisted(() => ({
  states: new Map<string, StoredState>(),
  persistOauthState: vi.fn(),
  consumeOauthState: vi.fn(),
  buildAdsAuthUrl: vi.fn(),
  exchangeAdsCodeForToken: vi.fn(),
  upsertAdsOauthConnection: vi.fn(),
  adsOauthClientCreds: vi.fn(),
}));

vi.mock("./role-room-oauth-store.js", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("./role-room-oauth-store.js")
  >();
  return {
    ...actual,
    persistOauthState: mocks.persistOauthState,
    consumeOauthState: mocks.consumeOauthState,
  };
});

vi.mock("./role-room-ads-oauth.js", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("./role-room-ads-oauth.js")
  >();
  return {
    ...actual,
    ADS_OAUTH_SCOPES: {
      ...actual.ADS_OAUTH_SCOPES,
      linkedin: [
        "r_ads",
        "r_ads_reporting",
        "rw_ads",
        "r_organization_admin",
        "rw_dmp_segments",
      ],
    },
    buildAdsAuthUrl: mocks.buildAdsAuthUrl,
    exchangeAdsCodeForToken: mocks.exchangeAdsCodeForToken,
    upsertAdsOauthConnection: mocks.upsertAdsOauthConnection,
    adsOauthClientCreds: mocks.adsOauthClientCreds,
  };
});

import { setupClientAdsRoutes } from "./client-ads-routes.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  const pool = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
  setupClientAdsRoutes({
    app,
    pool: pool as unknown as Pool,
    getActiveSession: () => ({
      userId: "producer-1",
      email: "producer@example.test",
    }),
  });
  return { app, pool };
}

function stateFromAuthUrl(authUrl: string): string {
  return new URL(authUrl).searchParams.get("state") ?? "";
}

describe("client Ads LinkedIn OAuth state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.states.clear();
    vi.stubEnv("PUBLIC_BACKEND_URL", "https://theroleroom.com");
    mocks.adsOauthClientCreds.mockReturnValue({
      clientId: "linkedin-client-id",
      clientSecret: "linkedin-client-secret",
    });
    mocks.buildAdsAuthUrl.mockImplementation(
      (
        _platform: string,
        opts: { redirectUri: string; state: string },
      ) => {
        const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
        url.searchParams.set("redirect_uri", opts.redirectUri);
        url.searchParams.set("state", opts.state);
        return url.toString();
      },
    );
    mocks.exchangeAdsCodeForToken.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresInSec: 3600,
    });
    mocks.upsertAdsOauthConnection.mockResolvedValue(undefined);
    mocks.persistOauthState.mockImplementation(
      async (
        _pool: Pool,
        stateId: string,
        payload: unknown,
        expiresAt: Date,
      ) => {
        mocks.states.set(stateId, { payload, expiresAt });
        return true;
      },
    );
    mocks.consumeOauthState.mockImplementation(
      async (_pool: Pool, stateId: string) => {
        const stored = mocks.states.get(stateId);
        mocks.states.delete(stateId);
        if (!stored || stored.expiresAt.getTime() <= Date.now()) return null;
        return stored.payload;
      },
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("persists a short-lived opaque state and stores matched-audience scopes", async () => {
    const { app } = buildApp();
    const before = Date.now();

    const started = await request(app)
      .get(
        "/api/admin-room/agent/ads/oauth/linkedin/start?configId=config-1&browserOrigin=https%3A%2F%2Fwww.theroleroom.com",
      )
      .expect(200);
    const state = stateFromAuthUrl(started.body.authUrl);

    expect(state).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(mocks.persistOauthState).toHaveBeenCalledOnce();
    const [, persistedState, payload, expiresAt] =
      mocks.persistOauthState.mock.calls[0];
    expect(persistedState).toBe(state);
    expect(payload).toMatchObject({
      flow: "client_ads_linkedin",
      userId: "producer-1",
      configId: "config-1",
      redirectUri:
        "https://theroleroom.com/api/admin-room/agent/ads/oauth/linkedin/callback",
      browserOrigin: "https://www.theroleroom.com",
      createdAt: expect.any(Number),
    });
    expect((expiresAt as Date).getTime()).toBeGreaterThanOrEqual(
      before + 10 * 60 * 1000,
    );

    const callbackResponse = await request(app)
      .get(
        `/api/admin-room/agent/ads/oauth/linkedin/callback?code=one-time-code&state=${encodeURIComponent(state)}`,
      )
      .expect(302);
    expect(callbackResponse.headers.location).toBe(
      "https://www.theroleroom.com/admin-room?adminTab=role-room-agent&oauth_success=linkedin&config=config-1",
    );

    expect(mocks.exchangeAdsCodeForToken).toHaveBeenCalledWith(
      "linkedin",
      expect.objectContaining({
        code: "one-time-code",
        redirectUri:
          "https://theroleroom.com/api/admin-room/agent/ads/oauth/linkedin/callback",
      }),
    );
    expect(mocks.upsertAdsOauthConnection).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "producer-1",
        scopes: expect.arrayContaining(["rw_dmp_segments"]),
      }),
    );
  });

  it("falls back to the Role Room origin for an untrusted browser origin", async () => {
    const { app } = buildApp();
    const started = await request(app)
      .get(
        "/api/admin-room/agent/ads/oauth/linkedin/start?browserOrigin=https%3A%2F%2Fevil.example",
      )
      .expect(200);
    const state = stateFromAuthUrl(started.body.authUrl);
    const [, , payload] = mocks.persistOauthState.mock.calls[0];

    expect(payload).toMatchObject({
      browserOrigin: "https://theroleroom.com",
    });

    const callbackResponse = await request(app)
      .get(
        `/api/admin-room/agent/ads/oauth/linkedin/callback?code=oauth-code&state=${encodeURIComponent(state)}`,
      )
      .expect(302);
    expect(callbackResponse.headers.location).toBe(
      "https://theroleroom.com/admin-room?adminTab=role-room-agent&oauth_success=linkedin",
    );
  });

  it("rejects a replay before a second token exchange", async () => {
    const { app } = buildApp();
    const started = await request(app)
      .get("/api/admin-room/agent/ads/oauth/linkedin/start")
      .expect(200);
    const state = stateFromAuthUrl(started.body.authUrl);
    const callback =
      `/api/admin-room/agent/ads/oauth/linkedin/callback?code=oauth-code&state=${encodeURIComponent(state)}`;

    await request(app).get(callback).expect(302);
    await request(app).get(callback).expect(400);

    expect(mocks.exchangeAdsCodeForToken).toHaveBeenCalledOnce();
    expect(mocks.upsertAdsOauthConnection).toHaveBeenCalledOnce();
  });

  it("consumes state when consent returns without a code", async () => {
    const { app } = buildApp();
    const started = await request(app)
      .get("/api/admin-room/agent/ads/oauth/linkedin/start")
      .expect(200);
    const state = stateFromAuthUrl(started.body.authUrl);

    const denied = await request(app)
      .get(
        `/api/admin-room/agent/ads/oauth/linkedin/callback?error=user_cancelled&state=${encodeURIComponent(state)}`,
      )
      .expect(302);
    expect(denied.headers.location).toBe(
      "https://theroleroom.com/admin-room?adminTab=role-room-agent&oauth_error=linkedin_consent_denied",
    );
    await request(app)
      .get(
        `/api/admin-room/agent/ads/oauth/linkedin/callback?code=late-code&state=${encodeURIComponent(state)}`,
      )
      .expect(400);

    expect(mocks.exchangeAdsCodeForToken).not.toHaveBeenCalled();
  });

  it("fails closed when the state store is unavailable", async () => {
    mocks.persistOauthState.mockResolvedValueOnce(false);
    const { app } = buildApp();

    await request(app)
      .get("/api/admin-room/agent/ads/oauth/linkedin/start")
      .expect(503, { error: "OAuth state-lager er utilgjengelig" });
    expect(mocks.buildAdsAuthUrl).not.toHaveBeenCalled();
  });

  it("rejects expired and foreign-flow states before token exchange", async () => {
    const { app } = buildApp();
    const expiredState = "a".repeat(32);
    mocks.states.set(expiredState, {
      payload: {
        flow: "client_ads_linkedin",
        userId: "producer-1",
        configId: "",
        redirectUri:
          "https://theroleroom.com/api/admin-room/agent/ads/oauth/linkedin/callback",
        createdAt: Date.now() - 20 * 60 * 1000,
      },
      expiresAt: new Date(Date.now() - 1),
    });
    const foreignState = "b".repeat(32);
    mocks.states.set(foreignState, {
      payload: {
        flow: "client_ads_tiktok",
        userId: "producer-1",
        configId: "",
        redirectUri:
          "https://theroleroom.com/api/admin-room/agent/ads/oauth/tiktok/callback",
        createdAt: Date.now(),
      },
      expiresAt: new Date(Date.now() + 60_000),
    });

    await request(app)
      .get(
        `/api/admin-room/agent/ads/oauth/linkedin/callback?code=expired&state=${expiredState}`,
      )
      .expect(400);
    await request(app)
      .get(
        `/api/admin-room/agent/ads/oauth/linkedin/callback?code=foreign&state=${foreignState}`,
      )
      .expect(400);

    expect(mocks.exchangeAdsCodeForToken).not.toHaveBeenCalled();
  });
});
