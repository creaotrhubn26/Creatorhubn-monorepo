import type { Request } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  canManageLeadgridBilling,
  resolveBillingOrganizationId,
} from "./leadgrid-billing-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";

function request(options: {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  header?: string;
} = {}): Request {
  return {
    body: options.body ?? {},
    query: options.query ?? {},
    get(name: string) {
      return name.toLowerCase() === "x-leadgrid-organization-id"
        ? options.header
        : undefined;
    },
  } as unknown as Request;
}

describe("Leadgrid billing workspace access", () => {
  it("uses an explicit body organization and supports the native workspace header", () => {
    expect(resolveBillingOrganizationId(request({ body: { orgId: organizationId } })))
      .toEqual({ organizationId });
    expect(resolveBillingOrganizationId(request({ header: organizationId })))
      .toEqual({ organizationId });
  });

  it("rejects missing and malformed organization identifiers before SQL", () => {
    expect(resolveBillingOrganizationId(request()))
      .toEqual({ organizationId: null, error: "orgId_påkrevd" });
    expect(resolveBillingOrganizationId(request({ query: { orgId: "not-a-uuid" } })))
      .toEqual({ organizationId: null, error: "ugyldig_orgId" });
  });

  it("requires an organization admin and never grants access from platform role", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ allowed: true }] });
    const allowed = await canManageLeadgridBilling(
      { query } as unknown as Pool,
      "user-1",
      organizationId,
    );

    expect(allowed).toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("role = 'admin'"),
      [organizationId, "user-1"],
    );
    expect(String(query.mock.calls[0][0])).not.toContain("role = 'super_admin'");
  });

  it("fails closed for members without billing authority", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [{ allowed: false }] }),
    } as unknown as Pool;
    await expect(canManageLeadgridBilling(pool, "seller-1", organizationId))
      .resolves.toBe(false);
  });
});
