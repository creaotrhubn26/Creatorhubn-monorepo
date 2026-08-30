import type { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";

const baseSession = {
  userId: "target-user",
  email: "target@example.test",
  name: "Target User",
  role: "user",
  loginAt: "2026-08-30T10:00:00.000Z",
};

afterEach(() => {
  vi.useRealTimers();
});

describe("persisted auth session impersonation policy", () => {
  it("persists the full impersonation markers with an outer expiry capped to the inner deadline", async () => {
    vi.resetModules();
    const { persistAuthSession } = await import("./auth-session-store.js");
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const pool = { query } as unknown as Pool;
    const impersonationExpiresAt = Date.parse("2026-08-30T10:30:00.000Z");
    const session = {
      ...baseSession,
      impersonatedByAdmin: true,
      impersonatorId: "admin-user",
      impersonationExpiresAt,
    };

    await persistAuthSession(pool, "target-token", session);

    const insertCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO creatorhub_auth_sessions"),
    );
    expect(insertCall).toBeDefined();
    expect(String(insertCall?.[0])).toContain("LEAST");
    expect(insertCall?.[1]).toEqual([
      "target-token",
      JSON.stringify(session),
      "2026-08-30T10:30:00.000Z",
    ]);
  });

  it("rejects and prunes an inner-expired record before sliding renewal", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T10:31:00.000Z"));
    vi.resetModules();
    const { loadPersistedAuthSession } = await import("./auth-session-store.js");
    const expiredSession = {
      ...baseSession,
      impersonatedByAdmin: true,
      impersonatorId: "admin-user",
      impersonationExpiresAt: Date.parse("2026-08-30T10:30:00.000Z"),
    };
    const query = vi.fn(async (sql: unknown) => {
      if (String(sql).includes("SELECT session_data")) {
        return { rows: [{ session_data: expiredSession }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const loaded = await loadPersistedAuthSession(
      { query } as unknown as Pool,
      "expired-token",
    );

    expect(loaded).toBeNull();
    expect(query.mock.calls.some(([sql, values]) =>
      String(sql).includes("DELETE FROM creatorhub_auth_sessions") &&
      Array.isArray(values) &&
      values[0] === "expired-token",
    )).toBe(true);
    expect(query.mock.calls.some(([sql]) =>
      String(sql).includes("Failed to renew") ||
      String(sql).includes("SET expires_at = CASE"),
    )).toBe(false);
  });

  it("never renews an active impersonation beyond its fixed inner deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T10:00:00.000Z"));
    vi.resetModules();
    const { loadPersistedAuthSession } = await import("./auth-session-store.js");
    const impersonationExpiresAt = Date.parse("2026-08-30T10:30:00.000Z");
    const activeSession = {
      ...baseSession,
      impersonatedByAdmin: true,
      impersonatorId: "admin-user",
      impersonationExpiresAt,
    };
    const query = vi.fn(async (sql: unknown) => {
      if (String(sql).includes("SELECT session_data")) {
        return { rows: [{ session_data: activeSession }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const loaded = await loadPersistedAuthSession(
      { query } as unknown as Pool,
      "active-token",
    );
    await Promise.resolve();

    expect(loaded).toEqual(activeSession);
    const renewalCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("SET expires_at = CASE"),
    );
    expect(String(renewalCall?.[0])).toContain("LEAST");
    expect(renewalCall?.[1]).toEqual([
      "active-token",
      "2026-08-30T10:30:00.000Z",
    ]);
  });

  it("hydrates active sessions but rejects expired and mismatched impersonation rows", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T10:00:00.000Z"));
    vi.resetModules();
    const { hydratePersistedAuthSessions } = await import("./auth-session-store.js");
    const now = Date.now();
    const rows = [
      { token: "ordinary", session_data: baseSession },
      {
        token: "active-standalone",
        session_data: {
          ...baseSession,
          impersonatedByAdmin: true,
          impersonatorId: "admin-user",
          impersonationExpiresAt: now + 60_000,
        },
      },
      {
        token: "expired-standalone",
        session_data: {
          ...baseSession,
          impersonatedByAdmin: true,
          impersonatorId: "admin-user",
          impersonationExpiresAt: now - 1,
        },
      },
      {
        token: "mismatched-snapshot",
        session_data: {
          ...baseSession,
          impersonatedByAdmin: true,
          impersonatorId: "admin-user",
          impersonatorEmail: "admin@example.test",
          impersonatorSnapshot: {
            userId: "other-admin",
            email: "admin@example.test",
            name: "Admin",
            role: "super_admin",
          },
          impersonationExpiresAt: now + 60_000,
        },
      },
    ];
    const query = vi.fn(async (sql: unknown) => {
      if (String(sql).includes("SELECT token, session_data")) {
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: 0 };
    });
    const target = new Map<string, typeof baseSession>();

    const hydrated = await hydratePersistedAuthSessions(
      { query } as unknown as Pool,
      target,
    );

    expect(hydrated).toBe(2);
    expect([...target.keys()]).toEqual(["ordinary", "active-standalone"]);
    const pruneCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("token = ANY($1::text[])"),
    );
    expect(pruneCall?.[1]).toEqual([
      ["expired-standalone", "mismatched-snapshot"],
    ]);
  });
});
