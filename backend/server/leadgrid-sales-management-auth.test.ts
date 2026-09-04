import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveEffectivePermissions } = vi.hoisted(() => ({
  resolveEffectivePermissions: vi.fn(),
}));
vi.mock("./lead-map-permission-routes.js", () => ({ resolveEffectivePermissions }));

import { canManageLeadgridSales, canViewLeadgridSales } from "./leadgrid-sales-management-auth.js";

describe("Leadgrid sales-management authorization", () => {
  beforeEach(() => resolveEffectivePermissions.mockReset());

  it("does not trust a stale global admin role outside the active organization", async () => {
    resolveEffectivePermissions.mockResolvedValue({ role: "member", permissions: new Set() });
    expect(await canManageLeadgridSales({} as never, "org-1", "user-1", "admin")).toBe(false);
  });

  it("allows organization managers and explicit manage permissions", async () => {
    resolveEffectivePermissions.mockResolvedValueOnce({ role: "owner", permissions: new Set() });
    expect(await canManageLeadgridSales({} as never, "org-1", "owner-1", "member")).toBe(true);

    resolveEffectivePermissions.mockResolvedValueOnce({ role: "salgssjef", permissions: new Set() });
    expect(await canManageLeadgridSales({} as never, "org-1", "user-1", "member")).toBe(true);

    resolveEffectivePermissions.mockResolvedValueOnce({
      role: "member",
      permissions: new Set(["sales_leadership.manage"]),
    });
    expect(await canManageLeadgridSales({} as never, "org-1", "user-2", "member")).toBe(true);
  });

  it("allows team leaders to view but not mutate", async () => {
    resolveEffectivePermissions.mockResolvedValue({ role: "teamleder", permissions: new Set() });
    expect(await canViewLeadgridSales({} as never, "org-1", "user-1", "member")).toBe(true);
    expect(await canManageLeadgridSales({} as never, "org-1", "user-1", "member")).toBe(false);
  });

  it("keeps the explicit super-admin bypass and fails closed on invalid resolver results", async () => {
    expect(await canManageLeadgridSales({} as never, "org-1", "root", "super_admin")).toBe(true);
    resolveEffectivePermissions.mockResolvedValue(null);
    expect(await canViewLeadgridSales({} as never, "org-1", "user-1", "member")).toBe(false);
  });
});
