import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn(async () => "hashed-password"),
  },
}));

function createPool(options: { failRevocation?: boolean } = {}) {
  const poolStatements: string[] = [];
  const clientStatements: string[] = [];
  const client = {
    query: vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      clientStatements.push(sql.trim());
      if (sql.includes("UPDATE password_reset_tokens")) {
        return { rows: [{ email: "owner@example.test" }], rowCount: 1 };
      }
      if (
        sql.includes("UPDATE users") &&
        sql.includes("auth_session_version = auth_session_version + 1")
      ) {
        return { rows: [{ id: "user-42" }], rowCount: 1 };
      }
      if (
        options.failRevocation &&
        sql.includes("DELETE FROM creatorhub_auth_sessions")
      ) {
        throw new Error("session delete unavailable");
      }
      return { rows: [], rowCount: 1 };
    }),
    release: vi.fn(),
  };
  const pool = {
    query: vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      poolStatements.push(sql.trim());
      if (sql.includes("SELECT email, expires_at, used_at")) {
        return {
          rows: [
            {
              email: "owner@example.test",
              expires_at: new Date(Date.now() + 60_000),
              used_at: null,
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }),
    connect: vi.fn(async () => client),
  } as unknown as Pool;
  return { client, clientStatements, pool, poolStatements };
}

describe("password reset session revocation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("revokes sessions on the transaction client before commit", async () => {
    const { consumeResetToken } = await import("./password-reset-service.js");
    const { client, clientStatements, pool, poolStatements } = createPool();

    const result = await consumeResetToken(pool, "reset-token", "new-password");

    expect(result).toMatchObject({ ok: true, userId: "user-42" });
    const passwordUpdate = clientStatements.find((sql) =>
      sql.includes("UPDATE users"),
    );
    expect(passwordUpdate).toContain(
      "auth_session_version = auth_session_version + 1",
    );
    const revokeIndex = clientStatements.findIndex((sql) =>
      sql.includes("DELETE FROM creatorhub_auth_sessions"),
    );
    const commitIndex = clientStatements.findIndex((sql) => sql === "COMMIT");
    expect(revokeIndex).toBeGreaterThan(-1);
    expect(commitIndex).toBeGreaterThan(revokeIndex);
    expect(
      poolStatements.some((sql) =>
        sql.includes("DELETE FROM creatorhub_auth_sessions"),
      ),
    ).toBe(false);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("rolls back password and token consumption when revocation fails", async () => {
    const { consumeResetToken } = await import("./password-reset-service.js");
    const { client, clientStatements, pool } = createPool({
      failRevocation: true,
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await consumeResetToken(pool, "reset-token", "new-password");

    expect(result).toMatchObject({ ok: false, error: "db_error" });
    expect(clientStatements).toContain("ROLLBACK");
    expect(clientStatements).not.toContain("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });
});
