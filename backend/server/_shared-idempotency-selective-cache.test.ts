import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { idempotencyMiddleware } from "./_shared-idempotency.js";

describe("selective idempotency response caching", () => {
  it("prøver schema-init på nytt etter en transient DB-feil", async () => {
    vi.resetModules();
    const { ensureIdempotencyTable } = await import("./_shared-idempotency.js");
    let firstAttempt = true;
    const query = vi.fn(async () => {
      if (firstAttempt) {
        firstAttempt = false;
        throw new Error("database warming up");
      }
      return { rows: [], rowCount: 0 };
    });
    const pool = { query } as unknown as Pool;

    await expect(ensureIdempotencyTable(pool)).resolves.toBe(false);
    await expect(ensureIdempotencyTable(pool)).resolves.toBe(true);
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("retries transient 5xx but replays a successful response", async () => {
    const stored = new Map<string, {
      request_hash: string;
      response_status: number;
      response_body: unknown;
      created_at: Date;
    }>();
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      if (sql.includes("CREATE TABLE") || sql.includes("CREATE INDEX")) {
        return { rows: [], rowCount: 0 };
      }
      if (
        sql.includes("INSERT INTO idempotency_keys_v1") &&
        sql.includes("RETURNING idempotency_key")
      ) {
        const key = String(params[3]);
        if (stored.has(key)) return { rows: [], rowCount: 0 };
        stored.set(key, {
          request_hash: String(params[4]),
          response_status: 102,
          response_body: JSON.parse(String(params[5])),
          created_at: new Date(),
        });
        return { rows: [{ idempotency_key: key }], rowCount: 1 };
      }
      if (sql.includes("SELECT request_hash")) {
        const key = String(params[3]);
        const row = stored.get(key);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      if (sql.includes("UPDATE idempotency_keys_v1")) {
        const key = String(params[3]);
        const row = stored.get(key);
        if (row && row.request_hash === params[4] && row.response_status === 102) {
          row.response_status = Number(params[5]);
          row.response_body = JSON.parse(String(params[6]));
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("DELETE FROM idempotency_keys_v1")) {
        stored.delete(String(params[3]));
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const app = express();
    app.use(express.json());
    const middleware = idempotencyMiddleware({
      pool: { query } as unknown as Pool,
      scope: "leadgrid-native-test",
      shouldCacheResponse: (status) => status >= 200 && status < 300,
    });
    let status = 503;
    let handlerCalls = 0;
    app.post("/retry", middleware, (_req, res) => {
      handlerCalls += 1;
      res.status(status).json({ status, handlerCalls });
    });

    const firstFailure = await request(app)
      .post("/retry")
      .set("Idempotency-Key", "transient-key")
      .send({ value: 1 })
      .expect(503);
    const secondFailure = await request(app)
      .post("/retry")
      .set("Idempotency-Key", "transient-key")
      .send({ value: 1 })
      .expect(503);
    expect(firstFailure.body.handlerCalls).toBe(1);
    expect(secondFailure.body.handlerCalls).toBe(2);
    expect(stored.has("transient-key")).toBe(false);

    status = 200;
    const success = await request(app)
      .post("/retry")
      .set("Idempotency-Key", "success-key")
      .send({ value: 1 })
      .expect(200);
    const replay = await request(app)
      .post("/retry")
      .set("Idempotency-Key", "success-key")
      .send({ value: 1 })
      .expect(200);
    expect(success.body.handlerCalls).toBe(3);
    expect(replay.body.handlerCalls).toBe(3);
    expect(replay.headers["idempotent-replayed"]).toBe("true");
    expect(handlerCalls).toBe(3);
  });

  it("atomisk claim hindrer to samtidige handlers for samme nøkkel", async () => {
    const stored = new Map<string, {
      request_hash: string;
      response_status: number;
      response_body: unknown;
      created_at: Date;
    }>();
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      if (sql.includes("CREATE TABLE") || sql.includes("CREATE INDEX")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO idempotency_keys_v1")) {
        const key = String(params[3]);
        if (stored.has(key)) return { rows: [], rowCount: 0 };
        stored.set(key, {
          request_hash: String(params[4]),
          response_status: 102,
          response_body: JSON.parse(String(params[5])),
          created_at: new Date(),
        });
        return { rows: [{ idempotency_key: key }], rowCount: 1 };
      }
      if (sql.includes("SELECT request_hash")) {
        const row = stored.get(String(params[3]));
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      if (sql.includes("UPDATE idempotency_keys_v1")) {
        const row = stored.get(String(params[3]));
        if (row) {
          row.response_status = Number(params[5]);
          row.response_body = JSON.parse(String(params[6]));
        }
        return { rows: [], rowCount: row ? 1 : 0 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let handlerCalls = 0;
    const app = express();
    app.use(express.json());
    const middleware = idempotencyMiddleware({
      pool: { query } as unknown as Pool,
      scope: "leadgrid-concurrency-test",
      shouldCacheResponse: (status) => status >= 200 && status < 300,
      failClosedOnUnavailable: true,
    });
    app.post("/visit", middleware, async (_req, res) => {
      handlerCalls += 1;
      await gate;
      res.json({ ok: true });
    });

    const first = request(app)
      .post("/visit")
      .set("Idempotency-Key", "same-action")
      .send({ lead: "one" })
      .then((response) => response);
    await vi.waitFor(() => expect(handlerCalls).toBe(1));

    const concurrent = await request(app)
      .post("/visit")
      .set("Idempotency-Key", "same-action")
      .send({ lead: "one" })
      .expect(409);
    expect(concurrent.body.error).toBe("idempotency_request_in_progress");
    expect(handlerCalls).toBe(1);

    release?.();
    await first.then((response) => expect(response.status).toBe(200));
    const replay = await request(app)
      .post("/visit")
      .set("Idempotency-Key", "same-action")
      .send({ lead: "one" })
      .expect(200);
    expect(replay.headers["idempotent-replayed"]).toBe("true");
    expect(handlerCalls).toBe(1);
  });
});
