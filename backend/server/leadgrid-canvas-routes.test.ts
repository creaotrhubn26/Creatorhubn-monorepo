import { afterEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import {
  applyCanvasRateDecision,
  assertCanvasResponseBudget,
  consumeCanvasRateLimit,
  requestCanvasRevision,
  resolveCanvasRouteOrganization,
  serializeCanvasResponse,
} from "./leadgrid-canvas-routes.js";

afterEach(() => {
  delete process.env.CANVAS_REQUIRE_IF_MATCH;
  delete process.env.CANVAS_ALLOW_MISSING_IF_MATCH;
});

describe("Canvas route If-Match transition", () => {
  it("accepts the current weak ETag contract", () => {
    expect(
      requestCanvasRevision({
        headers: { "if-match": 'W/"12"' },
      } as never),
    ).toBe(12);
  });

  it("always rejects a supplied malformed precondition", () => {
    expect(() =>
      requestCanvasRevision({
        headers: { "if-match": "12" },
      } as never),
    ).toThrowError(
      expect.objectContaining({
        status: 400,
        code: "invalid_if_match",
      }),
    );
  });

  it("requires a revision by default with an explicit legacy escape hatch", () => {
    expect(() => requestCanvasRevision({ headers: {} } as never)).toThrowError(
      expect.objectContaining({ status: 428, code: "revision_required" }),
    );
    process.env.CANVAS_ALLOW_MISSING_IF_MATCH = "true";
    expect(requestCanvasRevision({ headers: {} } as never)).toBeNull();
  });
});

describe("Canvas bounded per-user rate policy", () => {
  it("rejects requests beyond the window and resets deterministically", () => {
    const key = `test-${Math.random()}`;
    expect(consumeCanvasRateLimit(key, 2, 1_000, 10_000)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(consumeCanvasRateLimit(key, 2, 1_000, 10_100)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(consumeCanvasRateLimit(key, 2, 1_000, 10_200)).toMatchObject({
      allowed: false,
      retryAfterSeconds: 1,
    });
    expect(consumeCanvasRateLimit(key, 2, 1_000, 11_001)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
  });

  it("only exposes Retry-After when the request is actually throttled", () => {
    const headers = new Map<string, string>();
    const status = vi.fn(() => response);
    const json = vi.fn(() => response);
    const response = {
      setHeader: vi.fn((name: string, value: string) => {
        headers.set(name, value);
        return response;
      }),
      status,
      json,
    } as never;

    expect(applyCanvasRateDecision(response, {
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 30,
      source: "postgres",
    })).toBe(true);
    expect(headers.has("Retry-After")).toBe(false);
    expect(status).not.toHaveBeenCalled();

    expect(applyCanvasRateDecision(response, {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 12,
      source: "postgres",
    })).toBe(false);
    expect(headers.get("Retry-After")).toBe("12");
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({ error: "canvas_rate_limited" });
  });
});

describe("Canvas response budgets", () => {
  it("rejects oversized stored collections with a stable 413 contract", () => {
    expect(() => assertCanvasResponseBudget(1_001, 1_000, "canvas_list_too_large", 4))
      .toThrowError(expect.objectContaining({
        status: 413,
        code: "canvas_list_too_large",
        details: { maxBytes: 1_000, itemCount: 4 },
      }));
    expect(() => assertCanvasResponseBudget("1000", 1_000, "ignored", 1))
      .not.toThrow();
  });

  it("caps the exact serialized JSON rather than only the preflight estimate", () => {
    expect(() => serializeCanvasResponse(
      { value: "\n".repeat(20) },
      30,
      "canvas_list_too_large",
      1,
    )).toThrowError(expect.objectContaining({
      status: 413,
      code: "canvas_list_too_large",
    }));
  });
});

describe("Canvas canonical route organization", () => {
  function accessPool(options: {
    status?: string;
    member?: boolean;
    entitlementState?: string | null;
    failEntitlement?: boolean;
  }) {
    const organizationId = `org-${Math.random()}`;
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM leadgrid_org_overrides")) {
        return { rows: [{ override_org_id: organizationId }], rowCount: 1 };
      }
      if (sql.includes("FROM users")) {
        return { rows: [{ role: "user", is_active: true }], rowCount: 1 };
      }
      if (sql.includes("FROM organization_members")) {
        const allowed = options.member !== false;
        return { rows: allowed ? [{ present: 1 }] : [], rowCount: allowed ? 1 : 0 };
      }
      if (sql.includes("owner_user_id")) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM enterprise_team_members")) return { rows: [], rowCount: 0 };
      if (sql.includes("SELECT status") && sql.includes("FROM organizations")) {
        return {
          rows: [{ status: options.status ?? "active" }],
          rowCount: 1,
        };
      }
      if (sql.includes("FROM leadgrid_org_entitlements")) {
        if (options.failEntitlement) throw new Error("entitlement unavailable");
        return {
          rows: options.entitlementState
            ? [{ state: options.entitlementState }]
            : [],
          rowCount: options.entitlementState ? 1 : 0,
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    return {
      pool: { query } as unknown as Pool,
      userId: `user-${Math.random()}`,
      organizationId,
    };
  }

  it("re-proves current membership/status for the exact resolver organization", async () => {
    const readOnly = accessPool({ status: "read_only" });
    await expect(resolveCanvasRouteOrganization(
      readOnly.pool,
      readOnly.userId,
      false,
    )).resolves.toBe(readOnly.organizationId);
    await expect(resolveCanvasRouteOrganization(
      readOnly.pool,
      readOnly.userId,
      true,
    )).rejects.toEqual(expect.objectContaining({
      status: 423,
      code: "org_read_only",
    }));

    const revoked = accessPool({ member: false });
    await expect(resolveCanvasRouteOrganization(
      revoked.pool,
      revoked.userId,
      false,
    )).rejects.toEqual(expect.objectContaining({
      status: 403,
      code: "org_access_denied",
    }));
  });

  it("keeps no-row compatibility but fails closed on locked/indeterminate entitlement", async () => {
    const legacy = accessPool({});
    await expect(resolveCanvasRouteOrganization(
      legacy.pool,
      legacy.userId,
      false,
    )).resolves.toBe(legacy.organizationId);

    const locked = accessPool({ entitlementState: "locked" });
    await expect(resolveCanvasRouteOrganization(
      locked.pool,
      locked.userId,
      false,
    )).rejects.toEqual(expect.objectContaining({
      status: 403,
      code: "entitlement_locked",
    }));

    const unavailable = accessPool({ failEntitlement: true });
    await expect(resolveCanvasRouteOrganization(
      unavailable.pool,
      unavailable.userId,
      false,
    )).rejects.toEqual(expect.objectContaining({
      status: 503,
      code: "canvas_authorization_unavailable",
    }));
  });
});
