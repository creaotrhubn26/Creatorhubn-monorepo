import { describe, expect, it, vi } from "vitest";
import {
  resolveCreatorHubDelegatedProjectAccess,
  resolveCreatorHubEnterpriseAccess,
} from "./creatorhub-enterprise-access.js";
import { listProjectsForCaptureUser } from "./capture-projects-service.js";
import { setupCreatorHubBookingRoutes } from "./creatorhub-booking-routes.js";
import { setupCreatorHubTimesheetsRoutes } from "./creatorhub-timesheets-routes.js";
import { mapCreatorHubVendorProduct, setupCreatorHubVendorProductsRoutes } from "./creatorhub-vendor-products-routes.js";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function appHarness() {
  const routes = new Map<string, Handler>();
  const app: any = {};
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    app[method] = (path: string, ...handlers: Handler[]) => {
      routes.set(`${method.toUpperCase()} ${path}`, handlers.at(-1)!);
      return app;
    };
  }
  return { app, routes };
}

function response() {
  const res: any = { statusCode: 200, body: undefined, headers: new Map<string,string>() };
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((body: unknown) => { res.body = body; return res; });
  res.end = vi.fn(() => res);
  res.setHeader = vi.fn((name: string, value: string) => { res.headers.set(name, value); return res; });
  return res;
}

const membership = (overrides: Record<string, unknown> = {}) => ({
  organization_id: "org-1", role: "admin", entitlement_status: "active", valid_until: null,
  permission_level: "all", allowed_roles: ["admin","member"], admin_only_features: [], disabled_features: [],
  ...overrides,
});

describe("CreatorHub Enterprise access", () => {
  it("grants the one active tenant from authoritative membership and policy", async () => {
    const query = vi.fn(async () => ({ rows: [membership()] }));
    const access = await resolveCreatorHubEnterpriseAccess({ query } as never, { userId: "user-1", featureId: "public-booking-page" });
    expect(access).toMatchObject({ organizationId: "org-1", role: "admin", canWrite: true, canAdminister: true });
    expect(query.mock.calls[0][1]).toEqual(["user-1", "public-booking-page", null]);
  });

  it("fails closed for ambiguous organizations", async () => {
    const query = vi.fn(async () => ({ rows: [membership(), membership({ organization_id: "org-2" })] }));
    await expect(resolveCreatorHubEnterpriseAccess({ query } as never, { userId: "user-1", featureId: "vendor-product-api" })).rejects.toMatchObject({ statusCode: 409, code: "enterprise_organization_required" });
  });

  it("rejects disabled features and expired entitlements", async () => {
    const disabled = vi.fn(async () => ({ rows: [membership({ disabled_features: ["native-timesheets-approvals"] })] }));
    await expect(resolveCreatorHubEnterpriseAccess({ query: disabled } as never, { userId: "user-1", featureId: "native-timesheets-approvals" })).rejects.toMatchObject({ code: "enterprise_feature_denied" });
    const expired = vi.fn(async () => ({ rows: [membership({ valid_until: "2020-01-01T00:00:00.000Z" })] }));
    await expect(resolveCreatorHubEnterpriseAccess({ query: expired } as never, { userId: "user-1", featureId: "public-booking-page" })).rejects.toMatchObject({ code: "enterprise_entitlement_inactive" });
  });

  it("allows a verified project member at member policy without organization-wide membership", async () => {
    const query = vi.fn(async () => ({ rows: [{
      entitlement_status: "active", valid_until: null,
      permission_level: "custom", allowed_roles: ["admin", "member"],
      admin_only_features: [], disabled_features: [],
    }] }));
    const access = await resolveCreatorHubDelegatedProjectAccess({ query } as never, {
      userId: "crew-1", organizationId: "org-1", featureId: "native-timesheets-approvals",
    });
    expect(access).toMatchObject({ organizationId: "org-1", userId: "crew-1", role: "member", canWrite: true, canAdminister: false });
    expect(String(query.mock.calls[0][0])).not.toContain("enterprise_team_members");
  });

  it("does not let delegated project access bypass an admin-only policy", async () => {
    const query = vi.fn(async () => ({ rows: [{
      entitlement_status: "active", valid_until: null,
      permission_level: "admin_only", allowed_roles: ["admin"],
      admin_only_features: [], disabled_features: [],
    }] }));
    await expect(resolveCreatorHubDelegatedProjectAccess({ query } as never, {
      userId: "crew-1", organizationId: "org-1", featureId: "native-timesheets-approvals",
    })).rejects.toMatchObject({ code: "enterprise_feature_denied" });
  });
});

describe("CreatorHub timesheet boundary", () => {
  const ownerPool = (clientQuery: ReturnType<typeof vi.fn>) => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("SELECT 1 FROM projects")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("SELECT 1 FROM legacy.projects") || sql.includes("SELECT 1 FROM casting_projects")) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM public.projects project")) return { rows: [{ project_id: "project-1", project_owner_user_id: "owner-1", organization_id: "org-1" }], rowCount: 1 };
      if (sql.includes("FROM enterprise_team_members member")) return { rows: [membership()], rowCount: 1 };
      throw new Error(`Unexpected pool SQL: ${sql}`);
    });
    return {
      query,
      connect: vi.fn(async () => ({ query: clientQuery, release: vi.fn() })),
    };
  };

  it("does no database work when authoritative authentication is unavailable", async () => {
    const { app, routes } = appHarness(); const query = vi.fn();
    setupCreatorHubTimesheetsRoutes({ app, pool: { query } as never, resolveAuthoritativeSessionFromRequest: vi.fn(async () => ({ status: "unavailable" as const })) });
    const res = response();
    await routes.get("GET /api/projects/:projectId/timesheets")!({ params: { projectId: "project-1" }, body: {}, query: {} }, res);
    expect(res.statusCode).toBe(503); expect(query).not.toHaveBeenCalled();
  });

  it("rejects an invalid timer entry before access or persistence", async () => {
    const { app, routes } = appHarness(); const query = vi.fn(); const auth = vi.fn();
    setupCreatorHubTimesheetsRoutes({ app, pool: { query } as never, resolveAuthoritativeSessionFromRequest: auth });
    const res = response();
    await routes.get("POST /api/projects/:projectId/timesheets/:periodId/entries")!({ params: { projectId: "project-1", periodId: "11111111-1111-4111-8111-111111111111" }, body: { idempotencyKey: "22222222-2222-4222-8222-222222222222", workDate: "2026-09-25", activity: "Opptak", durationMinutes: 30, breakMinutes: 30, billable: true, source: "timer" }, query: {} }, res);
    expect(res.statusCode).toBe(400); expect(res.body.error).toBe("validation_error"); expect(auth).not.toHaveBeenCalled(); expect(query).not.toHaveBeenCalled();
  });

  it("never accepts an employee identity from the Capture current-period request", async () => {
    const { app, routes } = appHarness(); const query = vi.fn(); const auth = vi.fn();
    setupCreatorHubTimesheetsRoutes({ app, pool: { query } as never, resolveAuthoritativeSessionFromRequest: auth });
    const res = response();
    await routes.get("POST /api/projects/:projectId/timesheets/current")!({
      params: { projectId: "project-1" },
      body: { periodStart: "2026-09-21", periodEnd: "2026-09-27", employeeUserId: "victim-1" },
      query: {},
    }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("validation_error");
    expect(auth).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("returns an idempotent entry retry even after its period has been submitted", async () => {
    const { app, routes } = appHarness();
    const entry = {
      id: "33333333-3333-4333-8333-333333333333", period_id: "11111111-1111-4111-8111-111111111111",
      idempotency_key: "22222222-2222-4222-8222-222222222222", work_date: "2026-09-25",
      activity: "Opptak", description: null, task_id: null, started_at: null, ended_at: null,
      duration_minutes: 30, break_minutes: 0, billable: true, source: "manual", version: 1,
      created_at: "2026-09-25T08:00:00Z", updated_at: "2026-09-25T08:00:00Z",
    };
    const clientQuery = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
      if (sql.includes("FROM creatorhub_timesheet_periods") && sql.includes("FOR UPDATE")) return { rows: [{
        organization_id: "org-1", project_id: "project-1", id: "11111111-1111-4111-8111-111111111111",
        employee_user_id: "owner-1", status: "submitted", period_start: "2026-09-21", period_end: "2026-09-27",
      }] };
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [{}] };
      if (sql.includes("idempotency_key=$2")) return { rows: [entry] };
      throw new Error(`A completed retry must not mutate data: ${sql}`);
    });
    const pool = ownerPool(clientQuery);
    setupCreatorHubTimesheetsRoutes({ app, pool: pool as never, resolveAuthoritativeSessionFromRequest: vi.fn(async () => ({ status: "authenticated" as const, session: { userId: "owner-1" } })) });
    const res = response();
    await routes.get("POST /api/projects/:projectId/timesheets/:periodId/entries")!({
      method: "POST", params: { projectId: "project-1", periodId: "11111111-1111-4111-8111-111111111111" },
      body: { idempotencyKey: entry.idempotency_key, workDate: "2026-09-25", activity: "Opptak", durationMinutes: 30, breakMinutes: 0, billable: true, source: "manual" }, query: {},
    }, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.entry.id).toBe(entry.id);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO creatorhub_time_entries"))).toBe(false);
  });

  it("rejects an edited timer interval that overlaps another entry", async () => {
    const { app, routes } = appHarness();
    const clientQuery = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
      if (sql.includes("FROM creatorhub_time_entries entry JOIN") && sql.includes("FOR UPDATE")) return { rows: [{
        id: "33333333-3333-4333-8333-333333333333", employee_user_id: "owner-1",
        status: "draft", period_start: "2026-09-21", period_end: "2026-09-27",
        work_date: "2026-09-25", duration_minutes: 60, break_minutes: 0,
        started_at: "2026-09-25T08:00:00.000Z", ended_at: "2026-09-25T09:00:00.000Z",
      }] };
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [{}] };
      if (sql.includes("id<>$3::uuid")) return { rows: [{ id: "overlap" }] };
      throw new Error(`Overlap must stop before update: ${sql}`);
    });
    const pool = ownerPool(clientQuery);
    setupCreatorHubTimesheetsRoutes({ app, pool: pool as never, resolveAuthoritativeSessionFromRequest: vi.fn(async () => ({ status: "authenticated" as const, session: { userId: "owner-1" } })) });
    const res = response();
    await routes.get("PATCH /api/projects/:projectId/timesheets/:periodId/entries/:entryId")!({
      method: "PATCH",
      params: { projectId: "project-1", periodId: "11111111-1111-4111-8111-111111111111", entryId: "33333333-3333-4333-8333-333333333333" },
      body: { version: 1, startedAt: "2026-09-25T10:00:00.000Z", endedAt: "2026-09-25T11:00:00.000Z" }, query: {},
    }, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("time_entry_overlap");
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith("UPDATE creatorhub_time_entries"))).toBe(false);
  });
});

describe("Capture project assignment boundary", () => {
  it("lists only owned or active readable project assignments for the signed-in user", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    await listProjectsForCaptureUser({ query } as never, "crew-1", 500);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("member.user_id=$1");
    expect(String(sql)).toContain("member.status='active'");
    expect(String(sql)).toContain("member.deactivated_at IS NULL");
    expect(String(sql)).toContain("permissions @> '{\"canRead\":true}'::jsonb");
    expect(params).toEqual(["crew-1", 200]);
  });
});

describe("CreatorHub booking boundary", () => {
  it("does not expose unpublished or unentitled public booking profiles", async () => {
    const { app, routes } = appHarness();
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    setupCreatorHubBookingRoutes({ app, pool: { query } as never, resolveAuthoritativeSessionFromRequest: vi.fn() });
    const res = response();
    await routes.get("GET /api/public/booking/:slug")!({ params: { slug: "hidden-studio" }, body: {}, query: {}, headers: {}, socket: {} }, res);
    expect(res.statusCode).toBe(404); expect(res.body.error).toBe("booking_page_not_found");
    expect(String(query.mock.calls[0][0])).toContain("profile.is_published=TRUE");
    expect(String(query.mock.calls[0][0])).toContain("entitlement.status IN ('active','grace')");
  });

  it("requires explicit privacy consent before a public booking write", async () => {
    const { app, routes } = appHarness(); const query = vi.fn();
    setupCreatorHubBookingRoutes({ app, pool: { query } as never, resolveAuthoritativeSessionFromRequest: vi.fn() });
    const res = response();
    await routes.get("POST /api/public/booking/:slug/bookings")!({ params: { slug: "studio" }, body: { serviceId: "11111111-1111-4111-8111-111111111111", startsAt: "2026-10-01T10:00:00.000Z", customerName: "Test Kunde", customerEmail: "test@example.no", privacyConsent: false, idempotencyKey: "22222222-2222-4222-8222-222222222222" }, query: {}, headers: {}, socket: {} }, res);
    expect(res.statusCode).toBe(400); expect(query).not.toHaveBeenCalled();
  });

  it("checks an idempotency retry before availability and conflict queries", async () => {
    const { app, routes } = appHarness();
    const clientQuery = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (["BEGIN","COMMIT","ROLLBACK"].includes(sql)) return { rows: [] };
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [{}] };
      if (sql.includes("idempotency_key")) return { rows: [{ request_fingerprint: "different-request" }] };
      throw new Error(`Availability must not run for an idempotency retry: ${sql}`);
    });
    const pool = {
      query: vi.fn(async () => ({ rows: [{ organization_id: "org-1", status: "active", valid_until: null, slug: "studio", owner_user_id: "admin-1", business_name: "Studio", timezone: "Europe/Oslo", currency: "NOK", minimum_notice_hours: 24, maximum_advance_days: 180, slot_interval_minutes: 30, is_published: true }] })),
      connect: vi.fn(async () => ({ query: clientQuery, release: vi.fn() })),
    };
    setupCreatorHubBookingRoutes({ app, pool: pool as never, resolveAuthoritativeSessionFromRequest: vi.fn() });
    const res = response();
    await routes.get("POST /api/public/booking/:slug/bookings")!({ params: { slug: "studio" }, body: { serviceId: "11111111-1111-4111-8111-111111111111", startsAt: "2026-10-01T10:00:00.000Z", customerName: "Test Kunde", customerEmail: "test@example.no", privacyConsent: true, idempotencyKey: "22222222-2222-4222-8222-222222222222" }, query: {}, headers: {}, socket: {} }, res);
    expect(res.statusCode).toBe(409); expect(res.body.error).toBe("idempotency_key_reused");
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes("creatorhub_booking_availability"))).toBe(false);
  });
});

describe("CreatorHub Vendor API boundary", () => {
  it("maps the canonical product contract for both old UI and versioned API", () => {
    const mapped = mapCreatorHubVendorProduct({ id: "p1", slug: "album", name: "Album", owner_user_id: "user-1", description: null, product_type: "physical", category: "print", sku: null, version: "1.0", price_amount: "2500.00", currency: "NOK", stock_quantity: 4, track_inventory: true, status: "draft", image_urls: ["https://cdn.example.no/a.jpg"], tags: ["album"], metadata: {}, revision: 2, created_at: "2026-09-25T08:00:00Z", updated_at: "2026-09-25T09:00:00Z" });
    expect(mapped).toMatchObject({ id: "p1", status: "draft", price: 2500, stockQuantity: 4, revision: 2 });
    expect(mapCreatorHubVendorProduct({ id: "p1", slug: "album", name: "Album", owner_user_id: "user-1", description: null, product_type: "physical", category: "print", sku: null, version: "1.0", price_amount: "2500.00", currency: "NOK", stock_quantity: 4, track_inventory: true, status: "draft", image_urls: [], tags: [], metadata: {}, revision: 2, created_at: "2026-09-25T08:00:00Z", updated_at: "2026-09-25T09:00:00Z" }, true).status).toBe("pending");
  });

  it("prevents a logged-in vendor from enumerating another user path", async () => {
    const { app, routes } = appHarness();
    const query = vi.fn(async (sql: unknown) => String(sql).includes("FROM enterprise_team_members") ? { rows: [membership()] } : { rows: [], rowCount: 0 });
    setupCreatorHubVendorProductsRoutes({ app, pool: { query } as never, resolveAuthoritativeSessionFromRequest: vi.fn(async () => ({ status: "authenticated" as const, session: { userId: "user-1" } })) });
    const res = response();
    await routes.get("GET /api/vendor/products/:userId")!({ params: { userId: "user-2" }, body: {}, query: {}, headers: {} }, res);
    expect(res.statusCode).toBe(404);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("FROM creatorhub_vendor_products"))).toBe(false);
  });

  it("binds an API-key product listing to the key organization", async () => {
    const { app, routes } = appHarness(); const calls: Array<{ sql: string; params: unknown[] }> = [];
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue); calls.push({ sql, params });
      if (sql.includes("UPDATE creatorhub_vendor_api_keys")) return { rows: [{ id: "key-1", organization_id: "org-key", created_by: "admin-1", scopes: ["products:read"], rate_limit_per_minute: 120 }] };
      if (sql.includes("INSERT INTO creatorhub_vendor_api_rate_limits")) return { rows: [{ request_count: 1 }] };
      if (sql.includes("FROM creatorhub_vendor_products")) return { rows: [], rowCount: 0 };
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    setupCreatorHubVendorProductsRoutes({ app, pool: { query } as never, resolveAuthoritativeSessionFromRequest: vi.fn() });
    const res = response();
    await routes.get("GET /api/v1/vendor/products")!({ params: {}, body: {}, query: {}, headers: { authorization: `Bearer chv_live_${"a".repeat(40)}` } }, res);
    expect(res.statusCode).toBe(200);
    const list = calls.find((call) => call.sql.includes("FROM creatorhub_vendor_products"));
    expect(list?.params[0]).toBe("org-key");
    expect(list?.sql).toContain("organization_id=$1");
  });
});
