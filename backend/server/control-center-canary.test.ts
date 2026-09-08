import { describe, expect, it, vi } from "vitest";

import {
  CanaryRunInProgressError,
  CanaryStoreUnavailableError,
  buildCanaryChecks,
  buildExternalCanaryChecks,
  classifyOk,
  executeCheck,
  getCanaryStatus,
  isConfirmedDown,
  parseExternalFrontdoorProbe,
  runCanaries,
  transitionAction,
  type CanaryCheckDef,
  type CanaryOutcome,
} from "./control-center-canary.js";

// ── Ren klassifisering ──────────────────────────────────────────────────────

describe("classifyOk", () => {
  it("200 og 401 er OK når reachability tillater begge", () => {
    expect(classifyOk([200, 401], 200)).toBe(true);
    expect(classifyOk([200, 401], 401)).toBe(true);
  });

  it("500/404/200 er ikke OK for en ren 401-guard", () => {
    expect(classifyOk([401], 401)).toBe(true);
    expect(classifyOk([401], 500)).toBe(false);
    expect(classifyOk([401], 200)).toBe(false);
    expect(classifyOk([401], 404)).toBe(false);
  });

  it("null status (transportfeil) er aldri OK", () => {
    expect(classifyOk([200], null)).toBe(false);
  });
});

// ── Varsel-overgangslogikk ──────────────────────────────────────────────────

const okOutcome: CanaryOutcome = { ok: true, httpStatus: 401 };
const transportFailure: CanaryOutcome = { ok: false, httpStatus: null };
const serverFailure: CanaryOutcome = { ok: false, httpStatus: 500 };
const authBypassFailure: CanaryOutcome = { ok: false, httpStatus: 200 };

describe("transitionAction", () => {
  it("varsler auth-kontraktsbrudd umiddelbart", () => {
    expect(transitionAction([], authBypassFailure)).toBe("alert");
    expect(isConfirmedDown([authBypassFailure])).toBe(true);
  });

  it("venter på to midlertidige feil på rad", () => {
    expect(transitionAction([], transportFailure)).toBe("none");
    expect(transitionAction([okOutcome], transportFailure)).toBe("none");
    expect(transitionAction([], serverFailure)).toBe("none");
    expect(
      transitionAction([transportFailure, okOutcome], transportFailure),
    ).toBe("alert");
    expect(transitionAction([serverFailure, okOutcome], serverFailure)).toBe(
      "alert",
    );
  });

  it("varsler ikke på nytt ved vedvarende bekreftet transportfeil", () => {
    expect(
      transitionAction([transportFailure, transportFailure], transportFailure),
    ).toBe("none");
  });

  it("sender recovery bare etter en bekreftet feil", () => {
    expect(transitionAction([transportFailure, okOutcome], okOutcome)).toBe(
      "none",
    );
    expect(
      transitionAction([transportFailure, transportFailure], okOutcome),
    ).toBe("recover");
    expect(transitionAction([authBypassFailure], okOutcome)).toBe("recover");
    expect(transitionAction([serverFailure], okOutcome)).toBe("none");
  });
});

// ── executeCheck: retry + presis feilklassifisering ─────────────────────────

const guardCheck: CanaryCheckDef = {
  key: "t-guard",
  label: "Guard",
  vertical: "roleroom",
  url: "https://example.test/api/x",
  acceptable: [401],
  note: "guard",
};

describe("executeCheck", () => {
  it("401 passerer uten retry", async () => {
    const fake = vi
      .fn()
      .mockResolvedValue({ status: 401 }) as unknown as typeof fetch;
    const result = await executeCheck(guardCheck, fake);

    expect(result).toMatchObject({
      ok: true,
      httpStatus: 401,
      attempts: 1,
      failureKind: null,
    });
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it.each([200, 201, 204])(
    "auth-bypass %s klassifiseres som hard feil uten retry",
    async (status) => {
      const fake = vi
        .fn()
        .mockResolvedValue({ status }) as unknown as typeof fetch;
      const result = await executeCheck(guardCheck, fake);

      expect(result).toMatchObject({
        ok: false,
        httpStatus: status,
        attempts: 1,
        failureKind: "auth_bypass",
      });
      expect(fake).toHaveBeenCalledTimes(1);
    },
  );

  it("500 klassifiseres som serverfeil uten retry", async () => {
    const fake = vi
      .fn()
      .mockResolvedValue({ status: 500 }) as unknown as typeof fetch;
    const result = await executeCheck(guardCheck, fake);

    expect(result).toMatchObject({
      ok: false,
      httpStatus: 500,
      attempts: 1,
      failureKind: "server_error",
    });
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it("retryer en transportfeil og godtar neste 401", async () => {
    const fake = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce({ status: 401 }) as unknown as typeof fetch;

    const result = await executeCheck(guardCheck, fake, undefined, {
      retryDelayMs: 0,
    });

    expect(result).toMatchObject({
      ok: true,
      httpStatus: 401,
      attempts: 2,
      failureKind: null,
    });
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it("rapporterer nettverksfeil først etter siste forsøk", async () => {
    const fake = vi
      .fn()
      .mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;
    const result = await executeCheck(guardCheck, fake, undefined, {
      retryDelayMs: 0,
    });

    expect(result).toMatchObject({
      ok: false,
      httpStatus: null,
      attempts: 2,
      failureKind: "network",
    });
    expect(result.message).toContain("2 forsøk");
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it("aborterer og retryer ekte timeout, og rydder timere", async () => {
    vi.useFakeTimers();
    try {
      const fake = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            },
            { once: true },
          );
        });
      }) as unknown as typeof fetch;

      const pending = executeCheck(guardCheck, fake, undefined, {
        timeoutMs: 10,
        retryDelayMs: 0,
      });
      await vi.runAllTimersAsync();
      const result = await pending;

      expect(result).toMatchObject({
        ok: false,
        httpStatus: null,
        attempts: 2,
        failureKind: "timeout",
      });
      expect(fake).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── Ekstern observasjon: nullstill aldri serverens fasit ────────────────────

describe("parseExternalFrontdoorProbe", () => {
  it("aksepterer HTTP-observasjon og ignorerer client-sendt ok", () => {
    expect(
      parseExternalFrontdoorProbe({
        httpStatus: 500,
        latencyMs: 42,
        attempts: 2,
        ok: true,
      }),
    ).toEqual({ httpStatus: 500, latencyMs: 42, attempts: 2 });
  });

  it("aksepterer timeout uten HTTP-status", () => {
    expect(
      parseExternalFrontdoorProbe({
        httpStatus: null,
        latencyMs: 20_000,
        error: "timeout",
      }),
    ).toEqual({ httpStatus: null, latencyMs: 20_000, error: "timeout" });
  });

  it.each([
    null,
    { httpStatus: 99, latencyMs: 1 },
    { httpStatus: 600, latencyMs: 1 },
    { httpStatus: 200, latencyMs: -1 },
    { httpStatus: 200, latencyMs: 120_001 },
    { httpStatus: null, latencyMs: 1 },
    { httpStatus: 200, latencyMs: 1, error: "network" },
    { httpStatus: 200, latencyMs: 1, attempts: 0 },
    { httpStatus: 200, latencyMs: 1, attempts: 3 },
    { httpStatus: 200, latencyMs: 1, attempts: 1.5 },
  ])("avviser ugyldig observasjon %#", (value) => {
    expect(() => parseExternalFrontdoorProbe(value)).toThrow();
  });
});

// ── runCanaries: historikk, incident og varselstyring ───────────────────────

type StoredOutcome = { ok: boolean; httpStatus: number | null };

function makeFakePool(
  initial: Record<string, StoredOutcome[]> = {},
  options: {
    missingTable?: boolean;
    lockAvailable?: boolean;
    unlockAvailable?: boolean;
  } = {},
) {
  const history = new Map(
    Object.entries(initial).map(([key, values]) => [
      key,
      values.map((value) => ({ ...value })),
    ]),
  );
  const inserts: Array<{
    key: string;
    ok: boolean;
    httpStatus: number | null;
  }> = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes("pg_try_advisory_lock")) {
      return { rows: [{ locked: options.lockAvailable ?? true }] };
    }
    if (sql.includes("pg_advisory_unlock")) {
      return { rows: [{ unlocked: options.unlockAvailable ?? true }] };
    }
    if (options.missingTable && sql.includes("control_center_canary_runs")) {
      throw Object.assign(new Error("relation does not exist"), {
        code: "42P01",
      });
    }
    if (
      sql.includes("SELECT ok, http_status FROM control_center_canary_runs")
    ) {
      const key = params[0] as string;
      return {
        rows: (history.get(key) ?? []).slice(0, 2).map((value) => ({
          ok: value.ok,
          http_status: value.httpStatus,
        })),
      };
    }
    if (sql.includes("INSERT INTO control_center_canary_runs")) {
      const value = {
        ok: params[3] as boolean,
        httpStatus: (params[4] as number | null) ?? null,
      };
      const key = params[0] as string;
      history.set(key, [value, ...(history.get(key) ?? [])]);
      inserts.push({ key, ...value });
      return { rows: [] };
    }
    return { rows: [] };
  });
  const client = { query, release: vi.fn() };
  const pool = {
    query,
    connect: vi.fn(async () => client),
  };
  return { pool, history, inserts, query, client };
}

describe("runCanaries", () => {
  it("logger og varsler et auth-brudd umiddelbart", async () => {
    const { pool, inserts } = makeFakePool();
    const logErrorFn = vi.fn().mockResolvedValue("id");
    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ status: 200 }) as unknown as typeof fetch;

    const summary = await runCanaries(pool as never, {
      checks: [guardCheck],
      fetchImpl,
      logErrorFn,
      notifyFn,
    });

    expect(summary).toMatchObject({ ran: 1, ok: 0, failed: 1, skipped: 1 });
    expect(inserts).toEqual([{ key: "t-guard", ok: false, httpStatus: 200 }]);
    expect(logErrorFn).toHaveBeenCalledTimes(1);
    expect(notifyFn).toHaveBeenCalledTimes(1);
    expect(notifyFn.mock.calls[0][1].title).toContain("NEDE");
  });

  it("venter på to 5xx-funn før incident og varsel", async () => {
    const { pool } = makeFakePool({ "t-guard": [okOutcome] });
    const logErrorFn = vi.fn().mockResolvedValue("id");
    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ status: 500 }) as unknown as typeof fetch;
    const deps = {
      checks: [guardCheck],
      fetchImpl,
      logErrorFn,
      notifyFn,
    };

    await runCanaries(pool as never, deps);
    expect(logErrorFn).not.toHaveBeenCalled();
    expect(notifyFn).not.toHaveBeenCalled();

    await runCanaries(pool as never, deps);
    expect(logErrorFn).toHaveBeenCalledTimes(1);
    expect(notifyFn).toHaveBeenCalledTimes(1);
  });

  it("første transportfeil blir rådata uten incident eller varsel", async () => {
    const { pool } = makeFakePool({
      "t-guard": [okOutcome],
    });
    const logErrorFn = vi.fn();
    const notifyFn = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error("ECONNRESET")) as unknown as typeof fetch;

    await runCanaries(pool as never, {
      checks: [guardCheck],
      fetchImpl,
      logErrorFn,
      notifyFn,
      executeOptions: { transportRetries: 0 },
    });

    expect(logErrorFn).not.toHaveBeenCalled();
    expect(notifyFn).not.toHaveBeenCalled();
  });

  it("to transportfeil på rad gir ett NEDE-varsel", async () => {
    const { pool } = makeFakePool({
      "t-guard": [okOutcome],
    });
    const logErrorFn = vi.fn().mockResolvedValue("id");
    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error("ECONNRESET")) as unknown as typeof fetch;
    const deps = {
      checks: [guardCheck],
      fetchImpl,
      logErrorFn,
      notifyFn,
      executeOptions: { transportRetries: 0 },
    };

    await runCanaries(pool as never, deps);
    await runCanaries(pool as never, deps);
    await runCanaries(pool as never, deps);

    expect(notifyFn).toHaveBeenCalledTimes(1);
    expect(notifyFn.mock.calls[0][1].title).toContain("NEDE");
    expect(logErrorFn).toHaveBeenCalledTimes(2);
  });

  it("sender ikke recovery etter bare én, aldri-varslet transportfeil", async () => {
    const { pool } = makeFakePool({
      "t-guard": [transportFailure, okOutcome],
    });
    const notifyFn = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ status: 401 }) as unknown as typeof fetch;

    await runCanaries(pool as never, {
      checks: [guardCheck],
      fetchImpl,
      notifyFn,
      logErrorFn: vi.fn(),
    });

    expect(notifyFn).not.toHaveBeenCalled();
  });

  it("sender én recovery etter bekreftet transportfeil", async () => {
    const { pool } = makeFakePool({
      "t-guard": [transportFailure, transportFailure],
    });
    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ status: 401 }) as unknown as typeof fetch;

    await runCanaries(pool as never, {
      checks: [guardCheck],
      fetchImpl,
      notifyFn,
      logErrorFn: vi.fn(),
    });

    expect(notifyFn).toHaveBeenCalledTimes(1);
    expect(notifyFn.mock.calls[0][1].title).toContain("tilbake");
  });

  it("behandler manglende ekstern observasjon som skipped", async () => {
    const { pool, inserts } = makeFakePool();
    const summary = await runCanaries(pool as never, {
      checks: [],
      fetchImpl: vi.fn() as unknown as typeof fetch,
      notifyFn: vi.fn(),
      logErrorFn: vi.fn(),
    });

    expect(summary).toMatchObject({ ran: 0, ok: 0, failed: 0, skipped: 1 });
    expect(inserts).toHaveLength(0);
  });

  it("serialiserer kjøringen med PostgreSQL advisory lock", async () => {
    const { pool, query, client } = makeFakePool();

    await runCanaries(pool as never, {
      checks: [],
      fetchImpl: vi.fn() as unknown as typeof fetch,
      notifyFn: vi.fn(),
      logErrorFn: vi.fn(),
    });

    expect(query.mock.calls[0][0]).toContain("pg_try_advisory_lock");
    expect(query.mock.calls.at(-1)?.[0]).toContain("pg_advisory_unlock");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("avviser overlapp straks uten å holde en ventende pool-klient", async () => {
    const { pool, query, client } = makeFakePool({}, { lockAvailable: false });

    await expect(
      runCanaries(pool as never, {
        checks: [],
        fetchImpl: vi.fn() as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(CanaryRunInProgressError);

    expect(query).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("feiler tydelig uten varsel når historikktabellen mangler", async () => {
    const { pool, client } = makeFakePool({}, { missingTable: true });
    const notifyFn = vi.fn();
    const logErrorFn = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ status: 200 }) as unknown as typeof fetch;

    await expect(
      runCanaries(pool as never, {
        checks: [guardCheck],
        fetchImpl,
        notifyFn,
        logErrorFn,
      }),
    ).rejects.toBeInstanceOf(CanaryStoreUnavailableError);

    expect(logErrorFn).not.toHaveBeenCalled();
    expect(notifyFn).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledWith(undefined);
  });

  it("destruerer pool-klienten hvis advisory unlock ikke lykkes", async () => {
    const { pool, client } = makeFakePool({}, { unlockAvailable: false });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      await runCanaries(pool as never, {
        checks: [],
        fetchImpl: vi.fn() as unknown as typeof fetch,
      });
      expect(client.release).toHaveBeenCalledWith(expect.any(Error));
      expect(warn).toHaveBeenCalledWith(
        "[canary] advisory unlock failed:",
        "pg_advisory_unlock returned false",
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("klassifiserer ekstern auth-bypass server-side", async () => {
    const { pool, inserts } = makeFakePool();
    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const logErrorFn = vi.fn().mockResolvedValue("id");
    const probe = parseExternalFrontdoorProbe({
      httpStatus: 200,
      latencyMs: 42,
      attempts: 2,
      ok: true,
    });

    const summary = await runCanaries(pool as never, {
      checks: [],
      frontdoorProbe: probe,
      fetchImpl: vi.fn() as unknown as typeof fetch,
      notifyFn,
      logErrorFn,
    });

    expect(summary).toMatchObject({ ran: 1, ok: 0, failed: 1, skipped: 0 });
    expect(summary.results[0]).toMatchObject({
      key: "roleroom-frontdoor-auth-guard",
      httpStatus: 200,
      ok: false,
      attempts: 2,
      failureKind: "auth_bypass",
    });
    expect(inserts[0]).toMatchObject({
      key: "roleroom-frontdoor-auth-guard",
      ok: false,
      httpStatus: 200,
    });
    expect(notifyFn).toHaveBeenCalledTimes(1);
  });
});

// ── buildCanaryChecks: intern app vs ekstern front-door ─────────────────────

describe("buildCanaryChecks", () => {
  it("holder direkte auth-prober unna offentlig front-door", () => {
    const env = {
      CANARY_BACKEND_URL: "https://backend.test/",
      CANARY_INTERNAL_BACKEND_URL: "http://127.0.0.1:4321/",
      CANARY_ROLEROOM_URL: "https://front.test/",
    } as NodeJS.ProcessEnv;

    const internal = buildCanaryChecks(env);
    const guards = internal.filter((check) => check.key.includes("direct"));
    const external = buildExternalCanaryChecks(env);

    expect(guards).toHaveLength(2);
    expect(
      guards.every((check) => check.url.startsWith("http://127.0.0.1:4321/")),
    ).toBe(true);
    expect(internal.find((check) => check.key === "platform-health")?.url).toBe(
      "https://backend.test/api/health",
    );
    expect(external).toEqual([
      expect.objectContaining({
        key: "roleroom-frontdoor-auth-guard",
        url: "https://front.test/api/role-room/projects/00000000-0000-0000-0000-0000000ca0a1/my-tabs",
        acceptable: [401],
      }),
    ]);
  });

  it("bruker PORT som loopback-default", () => {
    const checks = buildCanaryChecks({ PORT: "9876" } as NodeJS.ProcessEnv);
    const guard = checks.find(
      (check) => check.key === "roleroom-direct-my-tabs-guard",
    );
    expect(guard?.url).toMatch(/^http:\/\/127\.0\.0\.1:9876\//);
  });

  it("uten Stripe-nøkkel finnes ingen payments-sjekk", () => {
    const checks = buildCanaryChecks({} as NodeJS.ProcessEnv);
    expect(checks.some((check) => check.vertical === "payments")).toBe(false);
  });

  it("med Stripe-nøkkel brukes Bearer-header", () => {
    const checks = buildCanaryChecks({
      STRIPE_SECRET_KEY: "sk_live_x",
    } as NodeJS.ProcessEnv);
    const stripe = checks.find((check) => check.vertical === "payments");
    expect(stripe).toBeTruthy();
    expect(stripe?.acceptable).toEqual([200]);
    expect(stripe?.headers?.Authorization).toContain("sk_live_x");
  });
});

// ── getCanaryStatus: dashboard følger bekreftet tilstand ────────────────────

function makeStatusPool(rows: Array<Record<string, unknown>>) {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("ROW_NUMBER() OVER")) return { rows };
      if (sql.includes("ROUND(100.0")) return { rows: [] };
      if (sql.includes("WHERE ok = false")) return { rows: [] };
      return { rows: [] };
    }),
  };
}

describe("getCanaryStatus", () => {
  const journeyKey = "roleroom-direct-my-tabs-guard";
  const checkedAt = "2026-09-07T20:00:00.000Z";
  const now = () => Date.parse("2026-09-07T20:05:00.000Z");

  it("viser første transportfeil som ubekreftet, ikke NEDE", async () => {
    const pool = makeStatusPool([
      {
        journey_key: journeyKey,
        ok: false,
        http_status: null,
        latency_ms: 8_000,
        expected: "401",
        message: "Timeout",
        checked_at: checkedAt,
      },
      {
        journey_key: journeyKey,
        ok: true,
        http_status: 401,
        latency_ms: 10,
        expected: "401",
        message: "OK 401",
        checked_at: "2026-09-07T19:50:00.000Z",
      },
    ]);

    const status = await getCanaryStatus(pool as never, {}, { now });
    const journey = status.journeys.find((item) => item.key === journeyKey);

    expect(journey).toMatchObject({
      status: "unknown",
      pending: true,
      stale: false,
      httpStatus: null,
    });
    expect(journey?.message).toContain("Ubekreftet midlertidig feil");
    expect(status.overall).toBe("unknown");
  });

  it("viser to transportfeil på rad som NEDE", async () => {
    const pool = makeStatusPool([
      {
        journey_key: journeyKey,
        ok: false,
        http_status: null,
        latency_ms: 8_000,
        expected: "401",
        message: "Timeout 2",
        checked_at: checkedAt,
      },
      {
        journey_key: journeyKey,
        ok: false,
        http_status: null,
        latency_ms: 8_000,
        expected: "401",
        message: "Timeout 1",
        checked_at: "2026-09-07T19:50:00.000Z",
      },
    ]);

    const status = await getCanaryStatus(pool as never, {}, { now });
    const journey = status.journeys.find((item) => item.key === journeyKey);

    expect(journey).toMatchObject({
      status: "down",
      pending: false,
      stale: false,
      httpStatus: null,
    });
    expect(journey?.message).toBe("Timeout 2");
    expect(status.overall).toBe("down");
  });

  it("viser en gammel grønn måling som stale/ukjent", async () => {
    const pool = makeStatusPool([
      {
        journey_key: journeyKey,
        ok: true,
        http_status: 401,
        latency_ms: 10,
        expected: "401",
        message: "OK 401",
        checked_at: "2026-09-07T19:00:00.000Z",
      },
    ]);

    const status = await getCanaryStatus(pool as never, {}, { now });
    const journey = status.journeys.find((item) => item.key === journeyKey);

    expect(journey).toMatchObject({
      status: "unknown",
      pending: false,
      stale: true,
    });
    expect(journey?.message).toContain("Ingen fersk måling");
    expect(status.overall).toBe("unknown");
  });
});
