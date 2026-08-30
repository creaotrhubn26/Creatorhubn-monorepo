import { describe, expect, it, vi } from "vitest";

import {
  classifyExpiry,
  severity,
  isAlertable,
  expiryBand,
  alertKeyFor,
  alertRank,
  secretTransition,
  runSecretWatch,
  type SecretStatus,
} from "./control-center-secret-watch.js";

describe("classifyExpiry", () => {
  it("innenfor terskel → expiring", () => {
    expect(classifyExpiry(5, 14)).toBe("expiring");
    expect(classifyExpiry(14, 14)).toBe("expiring");
    expect(classifyExpiry(0, 14)).toBe("expiring");
  });
  it("utenfor terskel → ok", () => {
    expect(classifyExpiry(30, 14)).toBe("ok");
  });
  it("ukjent utløp (null) → ok", () => {
    expect(classifyExpiry(null, 14)).toBe("ok");
  });
});

describe("severity (visning)", () => {
  it("invalid > expiring > error > ok > not_configured", () => {
    expect(severity("invalid")).toBeGreaterThan(severity("expiring"));
    expect(severity("expiring")).toBeGreaterThan(severity("error"));
    expect(severity("error")).toBeGreaterThan(severity("ok"));
    expect(severity("ok")).toBeGreaterThan(severity("not_configured"));
  });
});

describe("isAlertable", () => {
  it("kun invalid/expiring — IKKE error/ok/not_configured", () => {
    expect(isAlertable("invalid")).toBe(true);
    expect(isAlertable("expiring")).toBe(true);
    expect(isAlertable("error")).toBe(false);
    expect(isAlertable("ok")).toBe(false);
    expect(isAlertable("not_configured")).toBe(false);
  });
});

describe("expiryBand", () => {
  it("faller inn i tetteste bånd <= daysLeft", () => {
    expect(expiryBand(10, 14)).toBe(14);
    expect(expiryBand(6, 14)).toBe(7);
    expect(expiryBand(2, 14)).toBe(3);
    expect(expiryBand(1, 14)).toBe(1);
    expect(expiryBand(0, 14)).toBe(1);
  });
  it("utenfor warn → null (ikke expiring)", () => {
    expect(expiryBand(30, 14)).toBeNull();
    expect(expiryBand(null, 14)).toBeNull();
  });
});

describe("alertRank", () => {
  it("invalid > tettere expiring-bånd > løsere; ok/none = 0", () => {
    expect(alertRank("invalid")).toBeGreaterThan(alertRank("expiring:1"));
    expect(alertRank("expiring:1")).toBeGreaterThan(alertRank("expiring:7"));
    expect(alertRank("expiring:7")).toBeGreaterThan(alertRank("expiring:14"));
    expect(alertRank("ok")).toBe(0);
    expect(alertRank("none")).toBe(0);
    expect(alertRank(null)).toBe(0);
  });
});

describe("secretTransition", () => {
  it("ok → expiring(14) → alert", () => {
    expect(secretTransition("ok", "expiring", 14)).toEqual({ action: "alert", newKey: "expiring:14" });
  });
  it("re-nudge: expiring:14 → expiring:7 → alert (tettere bånd)", () => {
    expect(secretTransition("expiring:14", "expiring", 7)).toEqual({ action: "alert", newKey: "expiring:7" });
  });
  it("samme bånd → none (ingen spam)", () => {
    expect(secretTransition("expiring:7", "expiring", 7)).toEqual({ action: "none", newKey: "expiring:7" });
  });
  it("expiring → invalid → alert (forverring)", () => {
    expect(secretTransition("expiring:7", "invalid", null)).toEqual({ action: "alert", newKey: "invalid" });
  });
  it("invalid → invalid → none", () => {
    expect(secretTransition("invalid", "invalid", null)).toEqual({ action: "none", newKey: "invalid" });
  });
  it("invalid → ok → recover", () => {
    expect(secretTransition("invalid", "ok", null)).toEqual({ action: "recover", newKey: "ok" });
  });
  it("invalid → error → none OG beholder prev-nøkkel (ingen falsk recover)", () => {
    expect(secretTransition("invalid", "error", null)).toEqual({ action: "none", newKey: "invalid" });
  });
  it("aldri sett (null) → error → none", () => {
    expect(secretTransition(null, "error", null)).toEqual({ action: "none", newKey: null });
  });
  it("aldri sett (null) → ok → none", () => {
    expect(secretTransition(null, "ok", null)).toEqual({ action: "none", newKey: null });
  });
});

// ── runSecretWatch integrasjon (injisert probe/pool/spies) ──────────────────

function makeFakePool(prevAlertByKey: Record<string, SecretStatus>) {
  const upserts: Array<{ key: string; status: string; lastAlert: string | null }> = [];
  const pool = {
    query: vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes("SELECT last_alert_status")) {
        const key = params[0] as string;
        if (!(key in prevAlertByKey)) return { rows: [] };
        return { rows: [{ last_alert_status: prevAlertByKey[key] }] };
      }
      if (sql.includes("INSERT INTO control_center_secret_status")) {
        upserts.push({ key: params[0] as string, status: params[2] as string, lastAlert: (params[7] as string) ?? null });
        return { rows: [] };
      }
      return { rows: [] };
    }),
  };
  return { pool, upserts };
}

const makeProbe = (key: string, status: SecretStatus, configured = true) => ({
  key,
  label: `Nøkkel ${key}`,
  configured: () => configured,
  run: vi.fn(async () => ({ status, httpStatus: status === "ok" ? 200 : 401, expiresAt: null, daysLeft: null, message: `msg-${status}` })),
});

describe("runSecretWatch", () => {
  it("ugyldig nøkkel (ny) → incident + alert; ok-nøkkel → ingen", async () => {
    const { pool, upserts } = makeFakePool({});
    const logErrorFn = vi.fn().mockResolvedValue("id");
    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const probes = [makeProbe("stripe", "invalid"), makeProbe("render", "ok")];

    const summary = await runSecretWatch(pool as never, {
      probes: probes as never,
      logErrorFn,
      notifyFn,
      env: {} as NodeJS.ProcessEnv,
    });

    expect(summary.configured).toBe(2);
    expect(summary.problems).toBe(1);
    expect(logErrorFn).toHaveBeenCalledTimes(1);
    expect(logErrorFn.mock.calls[0][1]).toMatchObject({ errorName: "SecretWatch" });
    expect(notifyFn).toHaveBeenCalledTimes(1);
    expect(notifyFn.mock.calls[0][1].title).toContain("ugyldig");
    // stripe upsertet med last_alert_status='invalid', render med null
    expect(upserts.find((u) => u.key === "stripe")?.lastAlert).toBe("invalid");
    expect(upserts.find((u) => u.key === "render")?.lastAlert).toBeNull();
  });

  it("vedvarende ugyldig (prevAlert=invalid) → ingen ny e-post", async () => {
    const { pool } = makeFakePool({ stripe: "invalid" });
    const notifyFn = vi.fn().mockResolvedValue(undefined);
    await runSecretWatch(pool as never, {
      probes: [makeProbe("stripe", "invalid")] as never,
      notifyFn,
      logErrorFn: vi.fn().mockResolvedValue("id"),
      env: {} as NodeJS.ProcessEnv,
    });
    expect(notifyFn).not.toHaveBeenCalled();
  });

  it("expiring-nøkkel varsler med «utløper»-tittel", async () => {
    const { pool } = makeFakePool({});
    const notifyFn = vi.fn().mockResolvedValue(undefined);
    await runSecretWatch(pool as never, {
      probes: [makeProbe("github", "expiring")] as never,
      notifyFn,
      logErrorFn: vi.fn().mockResolvedValue("id"),
      env: {} as NodeJS.ProcessEnv,
    });
    expect(notifyFn).toHaveBeenCalledTimes(1);
    expect(notifyFn.mock.calls[0][1].title).toContain("utløper");
  });

  it("not_configured → verken incident eller varsel", async () => {
    const { pool, upserts } = makeFakePool({});
    const logErrorFn = vi.fn();
    const notifyFn = vi.fn();
    const summary = await runSecretWatch(pool as never, {
      probes: [makeProbe("render", "ok", false)] as never,
      logErrorFn,
      notifyFn,
      env: {} as NodeJS.ProcessEnv,
    });
    expect(summary.configured).toBe(0);
    expect(logErrorFn).not.toHaveBeenCalled();
    expect(notifyFn).not.toHaveBeenCalled();
    expect(upserts[0].status).toBe("not_configured");
  });
});
