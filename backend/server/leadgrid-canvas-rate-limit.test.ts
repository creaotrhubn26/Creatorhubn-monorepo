import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import {
  CanvasRateLimitUnavailableError,
  consumeSharedCanvasRateLimit,
} from "./leadgrid-canvas-rate-limit.js";

describe("Canvas shared PostgreSQL rate limiting", () => {
  it("uses an atomic shared bucket without persisting the raw identity", async () => {
    const query = vi.fn(async () => ({
      rows: [{ allowed: true, remaining: 4, retry_after_seconds: 12 }],
      rowCount: 1,
    }));
    const decision = await consumeSharedCanvasRateLimit(
      { query } as unknown as Pool,
      {
        operation: "canvas-write",
        identity: "raw-user-id",
        limit: 5,
        windowMs: 60_000,
        mode: "write",
      },
    );
    expect(decision).toEqual({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 12,
      source: "postgres",
    });
    const [sql, values] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("leadgrid_public_rate_limit_buckets");
    expect(sql).toContain("ON CONFLICT");
    expect(sql).toMatch(/stale AS[\s\S]*LIMIT 500[\s\S]*DELETE FROM/u);
    expect(values[0]).toBe("leadgrid_canvas_canvas-write");
    expect(values[1]).toMatch(/^[a-f0-9]{64}$/u);
    expect(values).not.toContain("raw-user-id");
  });

  it("uses the bounded local fallback only for reads missing migration 0461", async () => {
    const missingTable = Object.assign(new Error("missing table"), { code: "42P01" });
    const pool = {
      query: vi.fn(async () => { throw missingTable; }),
    } as unknown as Pool;
    await expect(consumeSharedCanvasRateLimit(pool, {
      operation: "canvas-list",
      identity: `reader-${Math.random()}`,
      limit: 2,
      windowMs: 60_000,
      mode: "read",
    })).resolves.toMatchObject({
      allowed: true,
      remaining: 1,
      source: "local-read-fallback",
    });
    await expect(consumeSharedCanvasRateLimit(pool, {
      operation: "canvas-write",
      identity: "writer",
      limit: 2,
      windowMs: 60_000,
      mode: "write",
    })).rejects.toBeInstanceOf(CanvasRateLimitUnavailableError);
  });

  it("fails closed for writes and handshakes on arbitrary database errors", async () => {
    const pool = {
      query: vi.fn(async () => { throw new Error("database unavailable"); }),
    } as unknown as Pool;
    for (const mode of ["write", "handshake"] as const) {
      await expect(consumeSharedCanvasRateLimit(pool, {
        operation: mode === "write" ? "canvas-write" : "realtime-handshake",
        identity: "identity",
        limit: 10,
        windowMs: 60_000,
        mode,
      })).rejects.toBeInstanceOf(CanvasRateLimitUnavailableError);
    }
  });

  it("does not use the rollout fallback for generic read failures", async () => {
    const pool = {
      query: vi.fn(async () => { throw new Error("database unavailable"); }),
    } as unknown as Pool;
    await expect(consumeSharedCanvasRateLimit(pool, {
      operation: "canvas-list",
      identity: "reader",
      limit: 10,
      windowMs: 60_000,
      mode: "read",
    })).rejects.toBeInstanceOf(CanvasRateLimitUnavailableError);
  });

  it("fails closed on malformed counter values", async () => {
    const pool = {
      query: vi.fn(async () => ({
        rows: [{ allowed: true, remaining: "NaN", retry_after_seconds: 1 }],
        rowCount: 1,
      })),
    } as unknown as Pool;
    await expect(consumeSharedCanvasRateLimit(pool, {
      operation: "canvas-write",
      identity: "writer",
      limit: 10,
      windowMs: 60_000,
      mode: "write",
    })).rejects.toBeInstanceOf(CanvasRateLimitUnavailableError);
  });
});
