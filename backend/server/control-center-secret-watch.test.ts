import { describe, expect, it, vi } from "vitest";

import {
  classifyExpiry,
  severity,
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

describe("severity", () => {
  it("rangerer riktig", () => {
    expect(severity("ok")).toBe(0);
    expect(severity("expiring")).toBe(1);
    expect(severity("invalid")).toBe(2);
    expect(severity("error")).toBe(2);
    expect(severity("not_configured")).toBe(-1);
  });
});

describe("secretTransition", () => {
  it("ok → expiring → alert", () => {
    expect(secretTransition("ok", "expiring")).toBe("alert");
  });
  it("ok → invalid → alert", () => {
    expect(secretTransition("ok", "invalid")).toBe("alert");
  });
  it("expiring → invalid → alert (forverring)", () => {
    expect(secretTransition("expiring", "invalid")).toBe("alert");
  });
  it("invalid → invalid → none (ingen spam)", () => {
    expect(secretTransition("invalid", "invalid")).toBe("none");
  });
  it("invalid → ok → recover", () => {
    expect(secretTransition("invalid", "ok")).toBe("recover");
  });
  it("aldri sett (null) → expiring → alert", () => {
    expect(secretTransition(null, "expiring")).toBe("alert");
  });
  it("aldri sett (null) → ok → none", () => {
    expect(secretTransition(null, "ok")).toBe("none");
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
      probes: [makeProbe("vercel", "ok", false)] as never,
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
