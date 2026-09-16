import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveLeadgridMarketingAccess: vi.fn(),
  loadAccessibleLeadgridProject: vi.fn(),
  isModuleFeatureEnabled: vi.fn(),
}));

vi.mock("./leadgrid-marketing-bridge.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./leadgrid-marketing-bridge.js")>();
  return {
    ...actual,
    resolveLeadgridMarketingAccess: mocks.resolveLeadgridMarketingAccess,
  };
});
vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: mocks.loadAccessibleLeadgridProject,
}));
vi.mock("./feature-flags/module-entitlement-resolver.js", () => ({
  isModuleFeatureEnabled: mocks.isModuleFeatureEnabled,
}));

import { resolveLeadgridAgentProject } from "./leadgrid-agent-access.js";

const pool = { query: vi.fn() } as unknown as Pool;
const organizationId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("resolveLeadgridAgentProject", () => {
  it("returns null for empty input without touching the database", async () => {
    expect(await resolveLeadgridAgentProject(pool, { projectId: "", userId: "u" })).toBeNull();
    expect(await resolveLeadgridAgentProject(pool, { projectId: "lg-x", userId: "" })).toBeNull();
    expect(mocks.resolveLeadgridMarketingAccess).not.toHaveBeenCalled();
    expect(mocks.loadAccessibleLeadgridProject).not.toHaveBeenCalled();
  });

  it("maps an authorized lg- key to marketing mode", async () => {
    mocks.resolveLeadgridMarketingAccess.mockResolvedValue({
      ok: true,
      access: {
        projectKey: "lg-salg-oslo",
        leadgridProjectId: "salg-oslo",
        organizationId,
        projectName: "Salg Oslo",
        role: "markedssjef",
        permissions: new Set(["marketing.content.brief"]),
        session: { userId: "u" },
      },
    });
    const r = await resolveLeadgridAgentProject(pool, { projectId: "lg-salg-oslo", userId: "u" });
    expect(r).toEqual({
      kind: "leadgrid_marketing",
      projectKey: "lg-salg-oslo",
      leadgridProjectId: "salg-oslo",
      organizationId,
      projectName: "Salg Oslo",
      role: "markedssjef",
    });
    expect(mocks.loadAccessibleLeadgridProject).not.toHaveBeenCalled();
  });

  it("returns null when the marketing module is locked or the bridge throws", async () => {
    mocks.resolveLeadgridMarketingAccess.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: "module_locked",
    });
    expect(await resolveLeadgridAgentProject(pool, { projectId: "lg-x", userId: "u" })).toBeNull();
    mocks.resolveLeadgridMarketingAccess.mockRejectedValueOnce(new Error("db down"));
    expect(await resolveLeadgridAgentProject(pool, { projectId: "lg-x", userId: "u" })).toBeNull();
  });

  it("maps an accessible bare Leadgrid project to sales mode when leadgrid:core is enabled", async () => {
    mocks.loadAccessibleLeadgridProject.mockResolvedValue({
      id: "leadgrid-abc",
      organizationId,
      name: "Feltsalg Vest",
      memberRole: "selger",
    });
    mocks.isModuleFeatureEnabled.mockResolvedValue(true);
    const r = await resolveLeadgridAgentProject(pool, { projectId: "leadgrid-abc", userId: "u" });
    expect(r).toEqual({
      kind: "leadgrid_sales",
      projectKey: "leadgrid-abc",
      leadgridProjectId: "leadgrid-abc",
      organizationId,
      projectName: "Feltsalg Vest",
      role: "selger",
    });
    expect(mocks.loadAccessibleLeadgridProject).toHaveBeenCalledWith(pool, "leadgrid-abc", "u");
    expect(mocks.isModuleFeatureEnabled).toHaveBeenCalledWith(pool, {
      organizationId,
      moduleKey: "leadgrid",
      featureKey: "core",
      defaultState: "included",
    });
  });

  it("returns null for bare ids the caller cannot access, locked core module, or loader errors", async () => {
    mocks.loadAccessibleLeadgridProject.mockResolvedValueOnce(null);
    expect(await resolveLeadgridAgentProject(pool, { projectId: "casting-uuid", userId: "u" })).toBeNull();
    expect(mocks.isModuleFeatureEnabled).not.toHaveBeenCalled();

    mocks.loadAccessibleLeadgridProject.mockResolvedValueOnce({
      id: "leadgrid-abc",
      organizationId,
      name: "X",
      memberRole: "selger",
    });
    mocks.isModuleFeatureEnabled.mockResolvedValueOnce(false);
    expect(await resolveLeadgridAgentProject(pool, { projectId: "leadgrid-abc", userId: "u" })).toBeNull();

    mocks.loadAccessibleLeadgridProject.mockRejectedValueOnce(new Error("invalid"));
    expect(await resolveLeadgridAgentProject(pool, { projectId: "weird", userId: "u" })).toBeNull();
  });
});
