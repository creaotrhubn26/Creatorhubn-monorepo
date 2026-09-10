import { Router } from "express";
import { describe, expect, it, vi } from "vitest";
import { createCreatorHubGoogleRouter } from "./creatorhub-google-routes.js";
import {
  consumeOauthState,
  consumeOauthTransfer,
  persistOauthState,
  persistOauthTransfer,
} from "./role-room-oauth-store.js";

type QueryResult = { rows: Array<Record<string, unknown>> };

function createOauthPool() {
  const states = new Map<string, unknown>();
  const transfers = new Map<string, unknown>();
  const query = vi.fn(
    async (sqlValue: unknown, params: unknown[] = []): Promise<QueryResult> => {
      const sql = String(sqlValue);
      if (
        sql.includes("CREATE TABLE IF NOT EXISTS role_room_oauth_pending_state")
      ) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO role_room_oauth_pending_state")) {
        states.set(String(params[0]), JSON.parse(String(params[1])));
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO role_room_oauth_pending_transfer")) {
        transfers.set(String(params[0]), JSON.parse(String(params[1])));
        return { rows: [] };
      }
      if (
        sql.includes("DELETE FROM role_room_oauth_pending_state") &&
        sql.includes("RETURNING payload")
      ) {
        const id = String(params[0]);
        const payload = states.get(id);
        states.delete(id);
        return { rows: payload ? [{ payload }] : [] };
      }
      if (
        sql.includes("DELETE FROM role_room_oauth_pending_transfer") &&
        sql.includes("RETURNING payload")
      ) {
        const id = String(params[0]);
        const payload = transfers.get(id);
        transfers.delete(id);
        return { rows: payload ? [{ payload }] : [] };
      }
      if (
        sql.includes("SELECT payload FROM role_room_oauth_pending_transfer")
      ) {
        const payload = transfers.get(String(params[0]));
        return { rows: payload ? [{ payload }] : [] };
      }
      if (sql.includes("DELETE FROM role_room_oauth_pending_")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL in OAuth scaling test: ${sql}`);
    },
  );
  return {
    pool: { query } as any,
    query,
    states,
    transfers,
  };
}

function routeHandler(router: Router, method: string, path: string): any {
  const layer = (router as any).stack.find(
    (candidate: any) =>
      candidate.route &&
      candidate.route.path === path &&
      candidate.route.methods[method.toLowerCase()],
  );
  return layer?.route?.stack.at(-1)?.handle;
}

function makeResponse() {
  const response: any = { statusCode: 200, body: undefined };
  response.status = (statusCode: number) => {
    response.statusCode = statusCode;
    return response;
  };
  response.json = (body: unknown) => {
    response.body = body;
    return response;
  };
  return response;
}

describe("shared CreatorHub Google OAuth handoff", () => {
  it("keeps the Google callback on CreatorHub while returning a trusted EaseVerse login to EaseVerse", async () => {
    const previousClientId = process.env.CREATORHUB_GOOGLE_CLIENT_ID;
    const previousClientSecret = process.env.CREATORHUB_GOOGLE_CLIENT_SECRET;
    const previousRedirectUri = process.env.CREATORHUB_GOOGLE_REDIRECT_URI;
    process.env.CREATORHUB_GOOGLE_CLIENT_ID = "google-client";
    process.env.CREATORHUB_GOOGLE_CLIENT_SECRET = "google-secret";
    process.env.CREATORHUB_GOOGLE_REDIRECT_URI =
      "https://creatorhubn.com/api/creatorhub/google/oauth/callback";

    try {
      const { pool, states } = createOauthPool();
      const router = createCreatorHubGoogleRouter(pool);
      const handler = routeHandler(router, "POST", "/oauth/start");
      const response = makeResponse();
      await handler(
        {
          body: {
            mode: "login",
            browserOrigin: "https://easeverse.netlify.app",
            returnPath: "/auth/callback?native=1",
          },
          headers: {},
          get: () => "creatorhub-backend-rtbl.onrender.com",
          protocol: "https",
        },
        response,
      );

      expect(response.statusCode).toBe(200);
      const state = Array.from(states.values())[0] as Record<string, unknown>;
      expect(state).toMatchObject({
        browserOrigin: "https://easeverse.netlify.app",
        redirectUri:
          "https://creatorhubn.com/api/creatorhub/google/oauth/callback",
        returnPath: "/auth/callback?native=1",
      });
    } finally {
      if (previousClientId === undefined) delete process.env.CREATORHUB_GOOGLE_CLIENT_ID;
      else process.env.CREATORHUB_GOOGLE_CLIENT_ID = previousClientId;
      if (previousClientSecret === undefined) delete process.env.CREATORHUB_GOOGLE_CLIENT_SECRET;
      else process.env.CREATORHUB_GOOGLE_CLIENT_SECRET = previousClientSecret;
      if (previousRedirectUri === undefined) delete process.env.CREATORHUB_GOOGLE_REDIRECT_URI;
      else process.env.CREATORHUB_GOOGLE_REDIRECT_URI = previousRedirectUri;
    }
  });

  it("rejects an untrusted final OAuth origin", async () => {
    const previousClientId = process.env.CREATORHUB_GOOGLE_CLIENT_ID;
    const previousClientSecret = process.env.CREATORHUB_GOOGLE_CLIENT_SECRET;
    const previousRedirectUri = process.env.CREATORHUB_GOOGLE_REDIRECT_URI;
    process.env.CREATORHUB_GOOGLE_CLIENT_ID = "google-client";
    process.env.CREATORHUB_GOOGLE_CLIENT_SECRET = "google-secret";
    process.env.CREATORHUB_GOOGLE_REDIRECT_URI =
      "https://creatorhubn.com/api/creatorhub/google/oauth/callback";

    try {
      const { pool, states } = createOauthPool();
      const router = createCreatorHubGoogleRouter(pool);
      const handler = routeHandler(router, "POST", "/oauth/start");
      const response = makeResponse();
      await handler(
        {
          body: {
            mode: "login",
            browserOrigin: "https://attacker.example",
            returnPath: "/steal",
          },
          headers: {},
          get: () => "creatorhub-backend-rtbl.onrender.com",
          protocol: "https",
        },
        response,
      );

      expect(response.statusCode).toBe(200);
      const state = Array.from(states.values())[0] as Record<string, unknown>;
      expect(state.browserOrigin).toBe("https://creatorhubn.com");
    } finally {
      if (previousClientId === undefined) delete process.env.CREATORHUB_GOOGLE_CLIENT_ID;
      else process.env.CREATORHUB_GOOGLE_CLIENT_ID = previousClientId;
      if (previousClientSecret === undefined) delete process.env.CREATORHUB_GOOGLE_CLIENT_SECRET;
      else process.env.CREATORHUB_GOOGLE_CLIENT_SECRET = previousClientSecret;
      if (previousRedirectUri === undefined) delete process.env.CREATORHUB_GOOGLE_REDIRECT_URI;
      else process.env.CREATORHUB_GOOGLE_REDIRECT_URI = previousRedirectUri;
    }
  });

  it("hands an authenticated Workspace session to EaseVerse exactly once without returning the token", async () => {
    const { pool, transfers } = createOauthPool();
    const activeSessions = new Map([
      [
        "workspace-session-token",
        {
          userId: "user-1",
          email: "producer@example.com",
          role: "music_producer",
          name: "Music Producer",
          displayName: "Music Producer",
          verified_email: true,
          loginAt: new Date().toISOString(),
        },
      ],
    ]);
    const router = createCreatorHubGoogleRouter(pool, activeSessions);
    const transferHandler = routeHandler(
      router,
      "POST",
      "/oauth/satellite-transfer",
    );
    const response = makeResponse();

    await transferHandler(
      {
        body: { browserOrigin: "https://easeverse.netlify.app" },
        headers: { authorization: "Bearer workspace-session-token" },
      },
      response,
    );

    expect(response.statusCode).toBe(201);
    expect(response.body).toMatchObject({
      browserOrigin: "https://easeverse.netlify.app",
    });
    expect(response.body).not.toHaveProperty("sessionToken");
    const transferId = String(response.body.transferId);
    expect(transfers.get(transferId)).toMatchObject({
      mode: "login",
      sessionToken: "workspace-session-token",
      user: { id: "user-1", email: "producer@example.com" },
    });

    const resultHandler = routeHandler(
      router,
      "GET",
      "/oauth/session-result/:transferId",
    );
    const firstResult = makeResponse();
    await resultHandler({ params: { transferId } }, firstResult);
    expect(firstResult.statusCode).toBe(200);
    expect(firstResult.body).toMatchObject({
      mode: "login",
      sessionToken: "workspace-session-token",
    });
    const replay = makeResponse();
    await resultHandler({ params: { transferId } }, replay);
    expect(replay.statusCode).toBe(404);
  });

  it("rejects missing sessions and untrusted satellite origins", async () => {
    const { pool, transfers } = createOauthPool();
    const activeSessions = new Map([
      [
        "workspace-session-token",
        {
          userId: "user-1",
          email: "producer@example.com",
          role: "music_producer",
          name: "Music Producer",
          loginAt: new Date().toISOString(),
        },
      ],
    ]);
    const router = createCreatorHubGoogleRouter(pool, activeSessions);
    const handler = routeHandler(router, "POST", "/oauth/satellite-transfer");

    const anonymous = makeResponse();
    await handler(
      { body: { browserOrigin: "https://easeverse.netlify.app" }, headers: {} },
      anonymous,
    );
    expect(anonymous.statusCode).toBe(401);

    const attacker = makeResponse();
    await handler(
      {
        body: { browserOrigin: "https://attacker.example" },
        headers: { authorization: "Bearer workspace-session-token" },
      },
      attacker,
    );
    expect(attacker.statusCode).toBe(400);
    expect(transfers.size).toBe(0);
  });

  it("persists and atomically consumes state and login transfers", async () => {
    const { pool } = createOauthPool();
    const expiresAt = new Date(Date.now() + 60_000);

    await expect(
      persistOauthState(pool, "state-1", { mode: "login" }, expiresAt),
    ).resolves.toBe(true);
    await expect(consumeOauthState(pool, "state-1")).resolves.toEqual({
      mode: "login",
    });
    await expect(consumeOauthState(pool, "state-1")).resolves.toBeNull();

    await expect(
      persistOauthTransfer(pool, "transfer-1", { mode: "login" }, expiresAt),
    ).resolves.toBe(true);
    await expect(consumeOauthTransfer(pool, "transfer-1")).resolves.toEqual({
      mode: "login",
    });
    await expect(consumeOauthTransfer(pool, "transfer-1")).resolves.toBeNull();
  });

  it("serves a login transfer from the shared store exactly once on a map miss", async () => {
    const { pool, transfers, query } = createOauthPool();
    const transferId = `cross-pod-login-${Date.now()}`;
    transfers.set(transferId, {
      mode: "login",
      createdAt: Date.now(),
      sessionToken: "session-token",
      user: {
        id: "user-1",
        email: "user@example.com",
        role: "photographer",
        name: "Test User",
        display_name: "Test User",
      },
      googleEmail: "user@example.com",
      googleSubject: "google-subject",
      profile: { email: "user@example.com" },
    });
    const router = createCreatorHubGoogleRouter(pool);
    const handler = routeHandler(
      router,
      "GET",
      "/oauth/session-result/:transferId",
    );

    const firstResponse = makeResponse();
    await handler({ params: { transferId } }, firstResponse);
    expect(firstResponse.statusCode).toBe(200);
    expect(firstResponse.body).toMatchObject({
      success: true,
      mode: "login",
      sessionToken: "session-token",
    });

    const replayResponse = makeResponse();
    await handler({ params: { transferId } }, replayResponse);
    expect(replayResponse.statusCode).toBe(404);
    expect(
      query.mock.calls.some(
        ([sql]) =>
          String(sql).includes(
            "DELETE FROM role_room_oauth_pending_transfer",
          ) && String(sql).includes("RETURNING payload"),
      ),
    ).toBe(true);
  });

  it("keeps link transfers available until POST /link completes them", async () => {
    const { pool, transfers } = createOauthPool();
    const transferId = `cross-pod-link-${Date.now()}`;
    transfers.set(transferId, {
      mode: "link",
      createdAt: Date.now(),
      createdByUserId: "user-1",
      targetConnectionUserId: "user-1",
      googleEmail: "user@example.com",
      googleSubject: "google-subject",
      profile: { email: "user@example.com" },
      tokenBundle: { scopes: ["openid"] },
    });
    const activeSessions = new Map([
      [
        "session-user-1",
        {
          userId: "user-1",
          email: "user@example.com",
          role: "photographer",
          name: "Test User",
          loginAt: new Date().toISOString(),
        },
      ],
    ]);
    const router = createCreatorHubGoogleRouter(pool, activeSessions);
    const handler = routeHandler(
      router,
      "GET",
      "/oauth/session-result/:transferId",
    );

    const firstResponse = makeResponse();
    const request = {
      params: { transferId },
      headers: { authorization: "Bearer session-user-1" },
    };
    await handler(request, firstResponse);
    const secondResponse = makeResponse();
    await handler(request, secondResponse);

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);
    expect(transfers.has(transferId)).toBe(true);
  });

  it("rejects link completion without an authenticated session", async () => {
    const { pool, transfers } = createOauthPool();
    const transferId = `unauthenticated-link-${Date.now()}`;
    transfers.set(transferId, {
      mode: "link",
      createdAt: Date.now(),
      createdByUserId: "user-1",
      targetConnectionUserId: "user-1",
      googleEmail: "user@example.com",
      googleSubject: "google-subject",
      profile: { email: "user@example.com" },
      tokenBundle: { scopes: ["openid"] },
    });
    const router = createCreatorHubGoogleRouter(pool);
    const handler = routeHandler(router, "POST", "/link");
    const response = makeResponse();

    await handler({ body: { transferId }, headers: {} }, response);

    expect(response.statusCode).toBe(401);
    expect(transfers.has(transferId)).toBe(true);
  });
});
