import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const oauthStore = vi.hoisted(() => {
  const states = new Map<string, unknown>();
  const transfers = new Map<string, unknown>();
  return {
    states,
    transfers,
    persistOauthState: vi.fn(async (_pool: unknown, id: string, payload: unknown) => {
      states.set(id, payload);
      return true;
    }),
    consumeOauthState: vi.fn(async (_pool: unknown, id: string) => {
      const payload = states.get(id) ?? null;
      states.delete(id);
      return payload;
    }),
    persistOauthTransfer: vi.fn(async (_pool: unknown, id: string, payload: unknown) => {
      transfers.set(id, payload);
      return true;
    }),
    consumeOauthTransfer: vi.fn(async (_pool: unknown, id: string) => {
      const payload = transfers.get(id) ?? null;
      transfers.delete(id);
      return payload;
    }),
  };
});

vi.mock("./role-room-oauth-store.js", () => ({
  persistOauthState: oauthStore.persistOauthState,
  consumeOauthState: oauthStore.consumeOauthState,
  persistOauthTransfer: oauthStore.persistOauthTransfer,
  consumeOauthTransfer: oauthStore.consumeOauthTransfer,
}));

const sessionStore = vi.hoisted(() => ({ persistAuthSession: vi.fn(async () => undefined) }));
vi.mock("./auth-session-store.js", () => ({ persistAuthSession: sessionStore.persistAuthSession }));

const login = vi.hoisted(() => ({
  exchangeLinkedInCodeForProfile: vi.fn(),
  resolveOrCreateUserFromLinkedIn: vi.fn(),
}));
vi.mock("./linkedin-login.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./linkedin-login.js")>();
  return {
    ...actual,
    exchangeLinkedInCodeForProfile: login.exchangeLinkedInCodeForProfile,
    resolveOrCreateUserFromLinkedIn: login.resolveOrCreateUserFromLinkedIn,
  };
});

import { registerLinkedInLoginRoutes } from "./linkedin-login-routes";

const ENV_KEYS = ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "ROLE_ROOM_LINKEDIN_CLIENT_ID", "ROLE_ROOM_LINKEDIN_CLIENT_SECRET", "ROLE_ROOM_LINKEDIN_REDIRECT_URI", "LINKEDIN_LOGIN_ENABLED", "ROLE_ROOM_AGENT_RATE_LIMIT"] as const;
const savedEnv: Record<string, string | undefined> = {};

function buildApp(env: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}) {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, {
    ROLE_ROOM_LINKEDIN_CLIENT_ID: "cid",
    ROLE_ROOM_LINKEDIN_CLIENT_SECRET: "sec",
    ROLE_ROOM_LINKEDIN_REDIRECT_URI: "https://api.example.test/api/auth/linkedin/callback",
    ROLE_ROOM_AGENT_RATE_LIMIT: "off",
    ...env,
  });
  const app = express();
  app.use(express.json());
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    query: vi.fn(async (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      return { rows: [] };
    }),
  } as unknown as Pool;
  const activeSessions = new Map<string, { userId: string; email?: string; role?: string; name?: string; loginAt?: string }>();
  const uploadImage = vi.fn(async () => "https://cdn/x.jpg");
  registerLinkedInLoginRoutes({ app, pool, activeSessions, uploadImage });
  return { app, pool, queries, activeSessions, uploadImage };
}

const resolvedUser = {
  userId: "user-1",
  email: "kari@example.com",
  role: "member",
  name: "Kari Nordmann",
  firstName: "Kari",
  lastName: "Nordmann",
  picture: "https://cdn/x.jpg",
  isNew: false,
  matchedBy: "email" as const,
  organizationId: "org-1",
};

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  oauthStore.states.clear();
  oauthStore.transfers.clear();
  vi.clearAllMocks();
  login.exchangeLinkedInCodeForProfile.mockResolvedValue({
    ok: true,
    profile: { sub: "li-1", email: "kari@example.com", emailVerified: true, name: "Kari Nordmann", givenName: "Kari", familyName: "Nordmann", picture: null, locale: null, raw: {} },
  });
  login.resolveOrCreateUserFromLinkedIn.mockResolvedValue({ ok: true, user: resolvedUser });
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("login-status", () => {
  it("is enabled with credentials and disabled when flagged off or unconfigured", async () => {
    expect((await request(buildApp().app).get("/api/auth/linkedin/login-status")).body).toEqual({ enabled: true });
    expect((await request(buildApp({ LINKEDIN_LOGIN_ENABLED: "off" }).app).get("/api/auth/linkedin/login-status")).body).toEqual({ enabled: false });
    const { app } = buildApp();
    delete process.env.ROLE_ROOM_LINKEDIN_CLIENT_SECRET;
    expect((await request(app).get("/api/auth/linkedin/login-status")).body).toEqual({ enabled: false });
  });
});

describe("web flow", () => {
  it("starts with a DB-persisted lgn_ state, sanitised return path and trusted origin only", async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post("/api/auth/linkedin/oauth/start")
      .send({ returnPath: "https://evil.example/x", browserOrigin: "https://evil.example" });
    expect(res.status).toBe(200);
    const url = new URL(res.body.authorizationUrl);
    expect(url.origin + url.pathname).toBe("https://www.linkedin.com/oauth/v2/authorization");
    expect(url.searchParams.get("scope")).toBe("openid profile email");
    const state = url.searchParams.get("state")!;
    expect(state).toMatch(/^lgn_[a-f0-9]{32}$/);
    expect(oauthStore.states.get(state)).toMatchObject({ kind: "linkedin_login", platform: "web", returnPath: "/login", browserOrigin: null });

    const trusted = await request(app)
      .post("/api/auth/linkedin/oauth/start")
      .send({ returnPath: "/leadgrid/markedsforing?x=1", browserOrigin: "https://creatorhubn.com" });
    expect(oauthStore.states.get(new URL(trusted.body.authorizationUrl).searchParams.get("state")!)).toMatchObject({
      returnPath: "/leadgrid/markedsforing?x=1",
      browserOrigin: "https://creatorhubn.com",
    });
  });

  it("refuses to start when the flag is off", async () => {
    const res = await request(buildApp({ LINKEDIN_LOGIN_ENABLED: "off" }).app).post("/api/auth/linkedin/oauth/start").send({});
    expect(res.status).toBe(503);
  });

  it("creates a session, hands it over via a one-shot transfer and redirects to the return path", async () => {
    const { app, activeSessions } = buildApp();
    const start = await request(app).post("/api/auth/linkedin/oauth/start").send({ returnPath: "/workspace", browserOrigin: "https://creatorhubn.com" });
    const state = new URL(start.body.authorizationUrl).searchParams.get("state")!;

    const cb = await request(app).get(`/api/auth/linkedin/login-callback?code=abc&state=${state}`);
    expect(cb.status).toBe(302);
    const location = new URL(cb.headers.location);
    expect(location.origin + location.pathname).toBe("https://creatorhubn.com/workspace");
    expect(location.searchParams.get("chLinkedInStatus")).toBe("success");
    const transferId = location.searchParams.get("chLinkedInTransfer")!;
    expect(transferId).toBeTruthy();

    expect(login.exchangeLinkedInCodeForProfile).toHaveBeenCalledWith(
      expect.objectContaining({ code: "abc", clientId: "cid", clientSecret: "sec", redirectUri: "https://api.example.test/api/auth/linkedin/callback" }),
      undefined,
    );
    expect(sessionStore.persistAuthSession).toHaveBeenCalledTimes(1);
    const [, token, session] = sessionStore.persistAuthSession.mock.calls[0] as unknown as [unknown, string, Record<string, unknown>];
    expect(activeSessions.get(token)).toMatchObject({ userId: "user-1", role: "member" });
    expect(session).toMatchObject({ email: "kari@example.com", name: "Kari Nordmann", verified_email: true, picture: "https://cdn/x.jpg" });

    const result = await request(app).get(`/api/auth/linkedin/session-result/${transferId}`);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true, sessionToken: token, user: { id: "user-1", email: "kari@example.com", picture: "https://cdn/x.jpg" } });
    expect((await request(app).get(`/api/auth/linkedin/session-result/${transferId}`)).status).toBe(404);
    expect(oauthStore.states.has(state)).toBe(false);
  });

  it("redirects with a Norwegian message when LinkedIn or the resolver says no", async () => {
    const { app } = buildApp();
    const startState = async () => {
      const start = await request(app).post("/api/auth/linkedin/oauth/start").send({ returnPath: "/login" });
      return new URL(start.body.authorizationUrl).searchParams.get("state")!;
    };

    const cancelled = await request(app).get(`/api/auth/linkedin/login-callback?error=user_cancelled_login&state=${await startState()}`);
    expect(new URL(cancelled.headers.location, "https://x").searchParams.get("chLinkedInMessage")).toBe("Innloggingen ble avbrutt.");

    login.resolveOrCreateUserFromLinkedIn.mockResolvedValueOnce({ ok: false, reason: "email_not_verified", message: "E-posten er ikke verifisert." });
    const rejected = await request(app).get(`/api/auth/linkedin/login-callback?code=abc&state=${await startState()}`);
    const rejectedUrl = new URL(rejected.headers.location, "https://x");
    expect(rejectedUrl.pathname).toBe("/login");
    expect(rejectedUrl.searchParams.get("chLinkedInStatus")).toBe("error");
    expect(rejectedUrl.searchParams.get("chLinkedInMessage")).toBe("E-posten er ikke verifisert.");
    expect(sessionStore.persistAuthSession).not.toHaveBeenCalled();
  });

  it("rejects unknown, foreign or reused states", async () => {
    const { app } = buildApp();
    expect((await request(app).get("/api/auth/linkedin/login-callback?code=abc&state=chg_1234")).status).toBe(400);
    expect((await request(app).get(`/api/auth/linkedin/login-callback?code=abc&state=lgn_${"a".repeat(32)}`)).status).toBe(400);
  });
});

describe("iOS flow", () => {
  it("starts, deep-links back with a transfer and exchanges it for a bearer once", async () => {
    const { app, queries, activeSessions } = buildApp();
    const start = await request(app).get("/api/leadgrid/auth/linkedin/start?platform=ios");
    expect(start.status).toBe(200);
    expect(start.body.state).toMatch(/^lgn_/);
    expect(new URL(start.body.auth_url).searchParams.get("state")).toBe(start.body.state);

    const cb = await request(app).get(`/api/auth/linkedin/login-callback?code=abc&state=${start.body.state}`);
    expect(cb.status).toBe(302);
    const deepLink = new URL(cb.headers.location);
    expect(deepLink.protocol).toBe("leadgrid:");
    expect(deepLink.host).toBe("oauth");
    const transfer = deepLink.searchParams.get("linkedin_transfer")!;
    expect(sessionStore.persistAuthSession).not.toHaveBeenCalled();

    const exchange = await request(app)
      .post("/api/leadgrid/auth/linkedin/exchange")
      .send({ transfer, deviceInfo: { name: "Daniels iPad", model: "iPad", osVersion: "iPadOS 26", appVersion: "3.1 (9)" } });
    expect(exchange.status).toBe(200);
    expect(exchange.body).toMatchObject({ user: { id: "user-1", email: "kari@example.com", role: "member" }, is_new_user: false, organization_id: "org-1" });
    expect(exchange.body.bearer).toMatch(/^[a-f0-9]{64}$/);
    expect(activeSessions.get(exchange.body.bearer)).toMatchObject({ userId: "user-1" });
    const insert = queries.find((q) => /INSERT INTO ipad_tokens/.test(q.sql))!;
    expect(insert.sql).toContain("'linkedin_signin'");
    expect(insert.params).toEqual([exchange.body.bearer, "user-1", "Daniels iPad", "iPad", "iPadOS 26", "3.1 (9)"]);

    expect((await request(app).post("/api/leadgrid/auth/linkedin/exchange").send({ transfer })).status).toBe(404);
  });

  it("deep-links errors back to the app and never hands an iOS transfer to the web result route", async () => {
    const { app } = buildApp();
    const start = await request(app).get("/api/leadgrid/auth/linkedin/start?platform=ios");
    login.exchangeLinkedInCodeForProfile.mockResolvedValueOnce({ ok: false, reason: "token_exchange_failed", message: "Koden er brukt" });
    const cb = await request(app).get(`/api/auth/linkedin/login-callback?code=abc&state=${start.body.state}`);
    expect(cb.headers.location).toBe("leadgrid://oauth?error=Koden+er+brukt");

    const again = await request(app).get("/api/leadgrid/auth/linkedin/start?platform=ios");
    const ok = await request(app).get(`/api/auth/linkedin/login-callback?code=abc&state=${again.body.state}`);
    const transfer = new URL(ok.headers.location).searchParams.get("linkedin_transfer")!;
    expect((await request(app).get(`/api/auth/linkedin/session-result/${transfer}`)).status).toBe(404);
  });
});
