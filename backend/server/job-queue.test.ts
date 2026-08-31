import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearJobHandlers,
  computeBackoffMs,
  MISSING_HANDLER_DEFER_MS,
  MISSING_HANDLER_MAX_AGE_MS,
  processNextJob,
  registerJobHandler,
  transitionForFailure,
  transitionForMissingHandler,
} from "./job-queue.js";

afterEach(() => clearJobHandlers());

describe("computeBackoffMs / transitionForFailure", () => {
  it("eksponentiell backoff m/ 30 min-tak", () => {
    expect(computeBackoffMs(1)).toBe(30_000);
    expect(computeBackoffMs(2)).toBe(120_000);
    expect(computeBackoffMs(3)).toBe(480_000);
    expect(computeBackoffMs(10)).toBe(30 * 60_000);
  });

  it("re-kø til forsøkene er brukt, deretter dead", () => {
    expect(transitionForFailure(1, 3)).toEqual({ status: "queued", delayMs: 30_000 });
    expect(transitionForFailure(2, 3)).toEqual({ status: "queued", delayMs: 120_000 });
    expect(transitionForFailure(3, 3)).toEqual({ status: "dead", delayMs: 0 });
  });

  it("defers missing handlers during a bounded rolling-deploy window", () => {
    const now = new Date("2026-08-30T12:00:00.000Z");
    expect(
      transitionForMissingHandler("2026-08-30T11:59:00.000Z", now),
    ).toEqual({ status: "queued", delayMs: MISSING_HANDLER_DEFER_MS });
    expect(
      transitionForMissingHandler(
        new Date(now.valueOf() - MISSING_HANDLER_MAX_AGE_MS),
        now,
      ),
    ).toEqual({ status: "dead", delayMs: 0 });
    expect(transitionForMissingHandler("not-a-date", now)).toEqual({
      status: "dead",
      delayMs: 0,
    });
  });
});

/** Fake pool: første query = claim-svar, resten fanges for inspeksjon. */
function fakePool(claimRow: unknown) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (calls.length === 1) {
        return { rows: claimRow ? [claimRow] : [], rowCount: claimRow ? 1 : 0 };
      }
      return { rows: [], rowCount: 1 };
    }),
  };
  return { pool: pool as never, calls };
}

const JOB = {
  id: "00000000-0000-0000-0000-000000000001",
  job_type: "test_job",
  payload: { x: 1 },
  attempts: 1,
  max_attempts: 3,
  created_at: new Date().toISOString(),
  lease_token: "11111111-1111-4111-8111-111111111111",
};

describe("processNextJob", () => {
  it("tom kø → idle uten flere queries", async () => {
    const { pool, calls } = fakePool(null);
    expect(await processNextJob(pool)).toBe("idle");
    expect(calls).toHaveLength(1);
  });

  it("suksess → completed m/ result og nullstilt feil", async () => {
    registerJobHandler("test_job", async (_p, payload) => ({ ok: true, got: payload.x }));
    const { pool, calls } = fakePool(JOB);
    expect(await processNextJob(pool)).toBe("completed");
    const done = calls.find((c) => c.sql.includes("'completed'"));
    expect(done).toBeTruthy();
    expect(String(done!.params[1])).toContain('"got":1');
  });

  it("handler-feil → re-kø m/ backoff; siste forsøk → dead m/ last_error", async () => {
    registerJobHandler("test_job", async () => {
      throw new Error("BRREG nede");
    });
    const first = fakePool({ ...JOB, attempts: 1 });
    expect(await processNextJob(first.pool)).toBe("requeued");
    const requeue = first.calls[first.calls.length - 1];
    expect(requeue.params[1]).toBe("queued");
    expect(requeue.params[2]).toBe("30000");
    expect(String(requeue.params[3])).toContain("BRREG nede");

    const last = fakePool({ ...JOB, attempts: 3 });
    expect(await processNextJob(last.pool)).toBe("dead");
    expect(last.calls[last.calls.length - 1].params[1]).toBe("dead");
  });

  it("fresh unknown job type is deferred without consuming an attempt", async () => {
    const { pool, calls } = fakePool({ ...JOB, job_type: "finnes_ikke" });
    expect(await processNextJob(pool)).toBe("no_handler");
    const update = calls[calls.length - 1];
    expect(update.params[1]).toBe("queued");
    expect(update.params[2]).toBe(String(MISSING_HANDLER_DEFER_MS));
    expect(String(update.params[3])).toContain("Ingen handler");
    expect(update.sql).toContain("GREATEST(attempts - 1, 0)");
  });

  it("old unknown job type becomes dead instead of being stranded forever", async () => {
    const { pool, calls } = fakePool({
      ...JOB,
      job_type: "finnes_ikke",
      created_at: new Date(
        Date.now() - MISSING_HANDLER_MAX_AGE_MS - 1_000,
      ).toISOString(),
    });
    expect(await processNextJob(pool)).toBe("no_handler");
    const update = calls[calls.length - 1];
    expect(update.params[1]).toBe("dead");
    expect(update.params[2]).toBe("0");
    expect(String(update.params[3])).toContain("defer-vinduet");
  });

  it("dobbelt-registrering av handler kaster", () => {
    registerJobHandler("test_job", async () => undefined);
    expect(() => registerJobHandler("test_job", async () => undefined)).toThrow();
  });

  it("aborts the handler and cannot finalize after its lease is lost", async () => {
    let signal: AbortSignal | undefined;
    registerJobHandler("test_job", async (_pool, _payload, _job, context) => {
      signal = context.signal;
      await new Promise<never>((_resolve, reject) => {
        context.signal.addEventListener(
          "abort",
          () => reject(context.signal.reason),
          { once: true },
        );
      });
    });
    let call = 0;
    const query = vi.fn(async (sql: string) => {
      call += 1;
      if (call === 1) return { rows: [JOB], rowCount: 1 };
      if (sql.includes("SET heartbeat_at = now()")) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(
      processNextJob({ query } as never, { heartbeatMs: 1 }),
    ).resolves.toBe("lease_lost");
    expect(signal?.aborted).toBe(true);
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("AND lease_token = $5::uuid"),
      ),
    ).toBe(true);
  });
});
