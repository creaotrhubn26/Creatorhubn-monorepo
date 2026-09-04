import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canManage: vi.fn(),
  canView: vi.fn(),
  resolveOrg: vi.fn(),
  startOutbox: vi.fn(),
}));

vi.mock("./leadgrid-sales-management-auth.js", () => ({
  canManageLeadgridSales: mocks.canManage,
  canViewLeadgridSales: mocks.canView,
}));
vi.mock("./leadgrid-org-resolver.js", () => ({
  resolveOrgIdForUser: mocks.resolveOrg,
}));
vi.mock("./leadgrid-sales-management-outbox.js", () => ({
  enqueueSalesManagementEvent: vi.fn(),
  startSalesManagementOutboxWorker: mocks.startOutbox,
}));

import {
  isAllowedAwardTransition,
  registerLeadgridSalesManagementRoutes,
} from "./leadgrid-sales-management-routes.js";

const organizationId = "00000000-0000-4000-8000-000000000001";

function createApp(pool: { query: ReturnType<typeof vi.fn>; connect?: ReturnType<typeof vi.fn> }) {
  const app = express();
  app.use(express.json());
  registerLeadgridSalesManagementRoutes({
    app,
    pool: pool as never,
    requireUserSession: () => ({
      userId: "seller-1",
      email: "seller@example.com",
      name: "Selger En",
      role: "member",
    }),
  });
  return app;
}

describe("Leadgrid sales-management routes", () => {
  beforeEach(() => {
    mocks.canManage.mockReset().mockResolvedValue(true);
    mocks.canView.mockReset().mockResolvedValue(true);
    mocks.resolveOrg.mockReset().mockResolvedValue(organizationId);
    mocks.startOutbox.mockReset();
  });

  it("uses the fulfillment workflow without forcing digital awards through address collection", () => {
    expect(isAllowedAwardTransition("pending", "ordered")).toBe(true);
    expect(isAllowedAwardTransition("ordered", "shipped")).toBe(true);
    expect(isAllowedAwardTransition("shipped", "received")).toBe(true);
    expect(isAllowedAwardTransition("awaiting_address", "ordered")).toBe(false);
    expect(isAllowedAwardTransition("pending", "shipped")).toBe(false);
  });

  it("calculates mileage on the server and preserves the idempotency key", async () => {
    const query = vi.fn().mockImplementation(async (sql: string, values: unknown[]) => {
      if (sql.includes("INSERT INTO leadgrid_mileage_claims")) {
        return {
          rows: [{
            id: 7,
            seller_user_id: "seller-1",
            seller_name: "Selger En",
            trip_date: "2026-09-04",
            route_text: "Oslo–Drammen",
            km: values[5],
            rate_nok_per_km: values[6],
            amount_nok: values[7],
            status: "pending",
            inserted: true,
          }],
        };
      }
      return { rows: [] };
    });
    const response = await request(createApp({ query }))
      .post("/api/leadgrid/sales-management/mileage")
      .set("Idempotency-Key", "trip-session-1")
      .send({ tripDate: "2026-09-04", routeText: "Oslo–Drammen", km: 10, amountNok: 99_999 });

    expect(response.status).toBe(201);
    expect(response.body.claim).toMatchObject({ km: 10, rateNokPerKm: 3.5, amountNok: 35 });
    const values = query.mock.calls.find((call) => String(call[0]).includes("INSERT INTO leadgrid_mileage_claims"))?.[1];
    expect(values?.at(-1)).toBe("trip-session-1");
  });

  it("rejects manager mutations when the active workspace permission is missing", async () => {
    mocks.canManage.mockResolvedValue(false);
    const query = vi.fn();
    const response = await request(createApp({ query }))
      .put("/api/leadgrid/sales-management/commission-config")
      .send({ preset: "custom", activeModels: ["base_percentage"], config: {} });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("sales_leadership_manage_required");
    expect(query).not.toHaveBeenCalled();
  });

  it("fails closed when the requested workspace cannot be resolved", async () => {
    mocks.resolveOrg.mockRejectedValue(new Error("not_organization_member"));
    const query = vi.fn();
    const response = await request(createApp({ query }))
      .post("/api/leadgrid/sales-management/mileage")
      .set("Idempotency-Key", "trip-session-2")
      .send({ tripDate: "2026-09-05", routeText: "Oslo", km: 5 });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("invalid_or_unavailable_organization");
    expect(query).not.toHaveBeenCalled();
  });
});
