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
