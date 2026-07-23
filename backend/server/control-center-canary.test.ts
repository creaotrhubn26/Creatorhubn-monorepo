import { describe, expect, it, vi } from "vitest";

import {
  classifyOk,
  transitionAction,
  executeCheck,
  runCanaries,
  buildCanaryChecks,
  type CanaryCheckDef,
} from "./control-center-canary.js";

// ── Ren klassifisering ──────────────────────────────────────────────────────

describe("classifyOk", () => {
  it("200 er OK for reachability [200,401]", () => {
    expect(classifyOk([200, 401], 200)).toBe(true);
    expect(classifyOk([200, 401], 401)).toBe(true);
  });
  it("500/404 er IKKE OK for guard [401]", () => {
    expect(classifyOk([401], 401)).toBe(true);
    expect(classifyOk([401], 500)).toBe(false); // ødelagt rute
    expect(classifyOk([401], 200)).toBe(false); // auth-bypass
    expect(classifyOk([401], 404)).toBe(false); // rute borte
  });
  it("null status (nettverksfeil) er aldri OK", () => {
    expect(classifyOk([200], null)).toBe(false);
  });
});

// ── Varsel-overgangslogikk ──────────────────────────────────────────────────

describe("transitionAction", () => {
  it("ny feil (aldri sett før) → alert", () => {
    expect(transitionAction(null, false)).toBe("alert");
  });
  it("ok → feil → alert", () => {
    expect(transitionAction(true, false)).toBe("alert");
  });
  it("feil → feil → none (ingen spam)", () => {
    expect(transitionAction(false, false)).toBe("none");
  });
  it("feil → ok → recover", () => {
    expect(transitionAction(false, true)).toBe("recover");
  });
  it("ok → ok → none", () => {
    expect(transitionAction(true, true)).toBe("none");
  });
  it("første kjøring som er OK → none", () => {
    expect(transitionAction(null, true)).toBe("none");
  });
});

// ── executeCheck (injisert fetch) ───────────────────────────────────────────

const guardCheck: CanaryCheckDef = {
  key: "t-guard",
  label: "Guard",
  vertical: "roleroom",
  url: "https://example.test/api/x",
  acceptable: [401],
  note: "guard",
};

describe("executeCheck", () => {
  it("guard som gir 401 → ok", async () => {
    const fake = vi.fn().mockResolvedValue({ status: 401 }) as unknown as typeof fetch;
    const r = await executeCheck(guardCheck, fake);
    expect(r.ok).toBe(true);
    expect(r.httpStatus).toBe(401);
  });
  it("guard som gir 500 → ikke ok, med melding", async () => {
    const fake = vi.fn().mockResolvedValue({ status: 500 }) as unknown as typeof fetch;
    const r = await executeCheck(guardCheck, fake);
    expect(r.ok).toBe(false);
    expect(r.httpStatus).toBe(500);
    expect(r.message).toContain("500");
  });
  it("nettverksfeil → ok=false, httpStatus=null", async () => {
    const fake = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;
    const r = await executeCheck(guardCheck, fake);
    expect(r.ok).toBe(false);
    expect(r.httpStatus).toBeNull();
    expect(r.message).toContain("Nettverksfeil");
  });
});

// ── runCanaries: incident + varsel-styring ──────────────────────────────────

/** Minimal fake-pool: styrer prevOk per journey og teller inserts. */
function makeFakePool(prevOkByKey: Record<string, boolean>) {
  const inserts: Array<{ key: string; ok: boolean }> = [];
  const pool = {
    query: vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes("SELECT ok FROM control_center_canary_runs")) {
        const key = params[0] as string;
        if (!(key in prevOkByKey)) return { rows: [] };
        return { rows: [{ ok: prevOkByKey[key] }] };
      }
      if (sql.includes("INSERT INTO control_center_canary_runs")) {
        inserts.push({ key: params[0] as string, ok: params[3] as boolean });
        return { rows: [] };
      }
      return { rows: [] };
    }),
  };
  return { pool, inserts };
}

describe("runCanaries", () => {
  const okCheck: CanaryCheckDef = {
    key: "c-ok",
    label: "OK-sjekk",
    vertical: "platform",
    url: "https://example.test/api/health",
    acceptable: [200],
    note: "ok",
  };
  const failCheck: CanaryCheckDef = {
    key: "c-fail",
    label: "Feil-sjekk",
    vertical: "roleroom",
    url: "https://example.test/api/guard",
    acceptable: [401],
    note: "guard",
  };

  it("feilende sjekk logger incident; passerende gjør ikke", async () => {
    const { pool, inserts } = makeFakePool({});
    const logErrorFn = vi.fn().mockResolvedValue("id");
    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes("health") ? { status: 200 } : { status: 500 },
    ) as unknown as typeof fetch;

    const summary = await runCanaries(pool as never, {
      checks: [okCheck, failCheck],
      fetchImpl,
      logErrorFn,
      notifyFn,
    });

    expect(summary.ran).toBe(2);
    expect(summary.ok).toBe(1);
    expect(summary.failed).toBe(1);
    expect(inserts).toEqual([
      { key: "c-ok", ok: true },
      { key: "c-fail", ok: false },
    ]);
    // Incident kun for den feilende
    expect(logErrorFn).toHaveBeenCalledTimes(1);
    expect(logErrorFn.mock.calls[0][1]).toMatchObject({
      errorName: "CanaryFailure",
      statusCode: 500,
    });
    // Første gang feil (prevOk=null) → varsel
    expect(notifyFn).toHaveBeenCalledTimes(1);
    expect(notifyFn.mock.calls[0][1].title).toContain("NEDE");
  });

  it("vedvarende feil (prevOk=false) varsler IKKE på nytt", async () => {
    const { pool } = makeFakePool({ "c-fail": false });
    const logErrorFn = vi.fn().mockResolvedValue("id");
    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn(async () => ({ status: 500 })) as unknown as typeof fetch;

    await runCanaries(pool as never, {
      checks: [failCheck],
      fetchImpl,
      logErrorFn,
      notifyFn,
    });

    expect(logErrorFn).toHaveBeenCalledTimes(1); // incident dedup-er selv, men logges
    expect(notifyFn).not.toHaveBeenCalled(); // ingen ny e-post
  });

  it("recovery (prevOk=false → ok) sender «tilbake»-varsel", async () => {
    const { pool } = makeFakePool({ "c-ok": false });
    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn(async () => ({ status: 200 })) as unknown as typeof fetch;

    await runCanaries(pool as never, {
      checks: [okCheck],
      fetchImpl,
      notifyFn,
      logErrorFn: vi.fn(),
    });

    expect(notifyFn).toHaveBeenCalledTimes(1);
    expect(notifyFn.mock.calls[0][1].title).toContain("tilbake");
  });
});

// ── buildCanaryChecks (env-styring) ─────────────────────────────────────────

describe("buildCanaryChecks", () => {
  it("uten Stripe-nøkkel → ingen payments-sjekk (ærlig-inaktiv)", () => {
    const checks = buildCanaryChecks({} as NodeJS.ProcessEnv);
    expect(checks.some((c) => c.vertical === "payments")).toBe(false);
    expect(checks.some((c) => c.key === "roleroom-my-tabs-guard")).toBe(true);
  });
  it("med Stripe-nøkkel → payments-sjekk med Bearer", () => {
    const checks = buildCanaryChecks({ STRIPE_SECRET_KEY: "sk_live_x" } as NodeJS.ProcessEnv);
    const stripe = checks.find((c) => c.vertical === "payments");
    expect(stripe).toBeTruthy();
    expect(stripe?.acceptable).toEqual([200]);
    expect(stripe?.headers?.Authorization).toContain("sk_live_x");
  });
  it("respekterer CANARY_ROLEROOM_URL-overstyring", () => {
    const checks = buildCanaryChecks({ CANARY_ROLEROOM_URL: "https://staging.test" } as NodeJS.ProcessEnv);
    const guard = checks.find((c) => c.key === "roleroom-my-tabs-guard");
    expect(guard?.url.startsWith("https://staging.test/")).toBe(true);
  });
});
