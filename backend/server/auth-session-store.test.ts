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
    expect(query.mock.calls.at(-1)?.[0]).toContain(
      "session_data->>'impersonatorId' = $1",
    );
    expect(query.mock.calls.at(-1)?.[0]).toContain("UPDATE ipad_tokens");
    expect(query.mock.calls.at(-1)?.[1]).toEqual(["user-42"]);
  });

  it("revokes the matching native bearer atomically with a single-token logout", async () => {
    const store = await import("./auth-session-store.js");
    const query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    const client = { query };

    await store.deletePersistedAuthSessionStrict(client as never, "native-token");

    const sql = String(query.mock.calls.at(-1)?.[0]);
    expect(sql).toContain("UPDATE ipad_tokens");
    expect(sql).toContain("DELETE FROM creatorhub_auth_sessions");
    expect(query.mock.calls.at(-1)?.[1]).toEqual(["native-token"]);
  });

  it("persists an absolute impersonation expiry instead of the sliding TTL", async () => {
    const store = await import("./auth-session-store.js");
    const query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    const client = { query };
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await store.persistAuthSessionInTransaction(
      client as never,
      "impersonation-token",
      {
        userId: "user-42",
        email: "target@example.test",
        name: "Target User",
        role: "member",
        loginAt: "2026-08-30T12:00:00.000Z",
        authSessionVersion: "3",
        impersonatedByAdmin: true,
        impersonationExpiresAt: expiresAt.getTime(),
      },
      { expiresAt },
    );

    const sql = String(query.mock.calls.at(-1)?.[0]);
    expect(sql).toContain("$3::timestamptz");
    expect(sql).toContain("expires_at = EXCLUDED.expires_at");
    expect(query.mock.calls.at(-1)?.[1]).toEqual([
      "impersonation-token",
      expect.any(String),
      expiresAt.toISOString(),
    ]);
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
