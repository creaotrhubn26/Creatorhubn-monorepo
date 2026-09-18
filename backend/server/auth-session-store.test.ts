import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("strict persisted auth-session revocation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("throws a typed availability error when schema readiness fails", async () => {
    const store = await import("./auth-session-store.js");
    const pool = {
      query: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    } as unknown as Pool;

    const operation = store.deletePersistedAuthSessionStrict(pool, "token-a");

    await expect(operation).rejects.toBeInstanceOf(
      store.AuthSessionStoreUnavailableError,
    );
    await expect(operation).rejects.toMatchObject({
      message: "auth_session_store_unavailable:ensure",
    });
  });

  it("throws instead of swallowing a token-delete failure", async () => {
    const store = await import("./auth-session-store.js");
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("DELETE FROM creatorhub_auth_sessions")) {
        throw new Error("delete unavailable");
      }
      return { rows: [], rowCount: 0 };
    });
    const pool = { query } as unknown as Pool;

    await expect(
      store.deletePersistedAuthSessionStrict(pool, " token-b "),
    ).rejects.toMatchObject({
      message: "auth_session_store_unavailable:delete_token",
    });
    expect(query.mock.calls.at(-1)?.[1]).toEqual(["token-b"]);
  });

  it("deletes every persisted session for a user through the supplied client", async () => {
    const store = await import("./auth-session-store.js");
    const query = vi.fn(async () => ({ rows: [], rowCount: 2 }));
    const client = { query };

    await store.deletePersistedAuthSessionsByUserIdStrict(
      client as never,
      " user-42 ",
    );

    expect(query.mock.calls.at(-1)?.[0]).toContain(
      "session_data->>'userId' = $1",
    );
    expect(query.mock.calls.at(-1)?.[1]).toEqual(["user-42"]);
  });

  it("keeps the legacy delete helper best-effort for non-critical callers", async () => {
    const store = await import("./auth-session-store.js");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pool = {
      query: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    } as unknown as Pool;

    await expect(
      store.deletePersistedAuthSession(pool, "token-c"),
    ).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalled();
  });
});
