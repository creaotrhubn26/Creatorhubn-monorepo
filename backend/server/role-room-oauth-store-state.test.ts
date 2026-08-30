import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  consumeOauthState,
  deleteOauthState,
  loadOauthState,
  persistOauthState,
} from "./role-room-oauth-store.js";

type StoredState = {
  payload: unknown;
  expiresAt: Date;
};

function createStatePool() {
  const states = new Map<string, StoredState>();
  const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
    const sql = String(sqlValue);

    if (
      sql.includes("CREATE TABLE IF NOT EXISTS role_room_oauth_pending_state")
    ) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("INSERT INTO role_room_oauth_pending_state")) {
      states.set(String(params[0]), {
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
      const stored = states.get(stateId);
      states.delete(stateId);
      return {
        rows:
          stored && stored.expiresAt.getTime() > Date.now()
            ? [{ payload: stored.payload }]
            : [],
        rowCount: stored ? 1 : 0,
      };
    }
    if (
      sql.includes("DELETE FROM role_room_oauth_pending_state") &&
      sql.includes("expires_at < NOW()")
    ) {
      for (const [stateId, stored] of states) {
        if (stored.expiresAt.getTime() <= Date.now()) states.delete(stateId);
      }
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("SELECT payload FROM role_room_oauth_pending_state")) {
      const stored = states.get(String(params[0]));
      return {
        rows:
          stored && stored.expiresAt.getTime() > Date.now()
            ? [{ payload: stored.payload }]
            : [],
        rowCount: stored ? 1 : 0,
      };
    }
    if (sql.includes("DELETE FROM role_room_oauth_pending_state")) {
      const deleted = states.delete(String(params[0]));
      return { rows: [], rowCount: deleted ? 1 : 0 };
    }

    throw new Error(`Unexpected OAuth state SQL: ${sql}`);
  });

  return {
    pool: { query } as unknown as Pool,
    query,
    states,
  };
}

describe("database-backed OAuth state", () => {
  it("loads state without consuming it, then consumes it exactly once", async () => {
    const { pool, query, states } = createStatePool();
    const expiresAt = new Date(Date.now() + 60_000);

    await expect(
      persistOauthState(pool, "shared-state", { platform: "ios" }, expiresAt),
    ).resolves.toBe(true);
    await expect(loadOauthState(pool, "shared-state")).resolves.toEqual({
      platform: "ios",
    });
    expect(states.has("shared-state")).toBe(true);

    await expect(consumeOauthState(pool, "shared-state")).resolves.toEqual({
      platform: "ios",
    });
    await expect(consumeOauthState(pool, "shared-state")).resolves.toBeNull();
    expect(
      query.mock.calls.filter(
        ([sql]) =>
          String(sql).includes("DELETE FROM role_room_oauth_pending_state") &&
          String(sql).includes("RETURNING payload"),
      ),
    ).toHaveLength(2);
  });

  it("rejects expired state and supports explicit invalidation", async () => {
    const { pool, states } = createStatePool();

    await expect(
      persistOauthState(
        pool,
        "expired-state",
        { platform: "web" },
        new Date(Date.now() - 1_000),
      ),
    ).resolves.toBe(true);
    await expect(loadOauthState(pool, "expired-state")).resolves.toBeNull();
    expect(states.has("expired-state")).toBe(false);

    await expect(
      persistOauthState(
        pool,
        "denied-state",
        { platform: "web" },
        new Date(Date.now() + 60_000),
      ),
    ).resolves.toBe(true);
    await deleteOauthState(pool, "denied-state");
    await expect(loadOauthState(pool, "denied-state")).resolves.toBeNull();
  });
});
