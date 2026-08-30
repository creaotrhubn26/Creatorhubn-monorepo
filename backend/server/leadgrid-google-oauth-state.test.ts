import express, { type Express } from "express";
import type { Pool } from "pg";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type StoredState = {
  platform: string;
  createdAt: number;
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

async function buildAppPair() {
  vi.stubEnv("CREATORHUB_GOOGLE_CLIENT_ID", "leadgrid-web-client");
  vi.stubEnv("CREATORHUB_GOOGLE_CLIENT_SECRET", "leadgrid-web-secret");
  vi.stubEnv("GOOGLE_CLIENT_ID", "");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
  vi.stubEnv("ROLE_ROOM_PUBLIC_URL", "https://leadgrid.example.test");
  vi.resetModules();

  const { registerLeadgridGoogleAuthRoutes } =
    await import("./leadgrid-google-auth-routes.js");
  const pool = {} as Pool;
  const apps = [express(), express()];

  for (const app of apps) {
    app.use(express.json());
    registerLeadgridGoogleAuthRoutes({
      app: app as Express,
      pool,
      activeSessions: new Map(),
    });
  }

  return { first: apps[0], second: apps[1] };
}

beforeEach(() => {
  oauthStore.states.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Leadgrid Google OAuth state", () => {
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
