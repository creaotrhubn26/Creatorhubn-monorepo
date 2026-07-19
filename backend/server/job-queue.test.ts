import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearJobHandlers,
  computeBackoffMs,
  processNextJob,
  registerJobHandler,
  transitionForFailure,
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

  it("ukjent jobbtype → dead m/ forklaring (aldri stille)", async () => {
    const { pool, calls } = fakePool({ ...JOB, job_type: "finnes_ikke" });
    expect(await processNextJob(pool)).toBe("no_handler");
    expect(String(calls[calls.length - 1].params[1])).toContain("Ingen handler");
  });

  it("dobbelt-registrering av handler kaster", () => {
    registerJobHandler("test_job", async () => undefined);
    expect(() => registerJobHandler("test_job", async () => undefined)).toThrow();
  });
});
