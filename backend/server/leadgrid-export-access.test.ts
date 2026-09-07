import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const projectAccess = vi.hoisted(() => ({ load: vi.fn() }));
const permissionAccess = vi.hoisted(() => ({ resolve: vi.fn() }));

vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: projectAccess.load,
}));
vi.mock("./lead-map-permission-routes.js", () => ({
  resolveEffectivePermissions: permissionAccess.resolve,
}));

import {
  parseRequiredExportProjectId,
  requireLeadgridExportProject,
} from "./leadgrid-export-access.js";

const pool = { query: vi.fn() } as unknown as Pick<Pool, "query">;

describe("Leadgrid export access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires one explicit customer project", () => {
    expect(() => parseRequiredExportProjectId(undefined)).toThrowError(
      expect.objectContaining({ code: "project_id_required", status: 400 }),
    );
  });

  it("hides inaccessible, archived and casting projects behind not-found", async () => {
    projectAccess.load.mockResolvedValue(null);
    await expect(
      requireLeadgridExportProject(pool, {
        userId: "user-a",
        projectId: "foreign-project",
      }),
    ).rejects.toMatchObject({ code: "project_not_found", status: 404 });
    expect(permissionAccess.resolve).not.toHaveBeenCalled();
  });

  it("requires the effective leads.export permission", async () => {
    projectAccess.load.mockResolvedValue({
      id: "dentum",
      organizationId: "11111111-1111-4111-8111-111111111111",
      name: "Dentum",
    });
    permissionAccess.resolve.mockResolvedValue({
      role: "member",
      permissions: new Set(["leads.view"]),
    });

    await expect(
      requireLeadgridExportProject(pool, {
        userId: "user-a",
        projectId: "dentum",
      }),
    ).rejects.toMatchObject({ code: "mangler_tillatelse", status: 403 });
  });

  it("returns the project only when membership and export permission agree", async () => {
    const project = {
      id: "dentum",
      organizationId: "11111111-1111-4111-8111-111111111111",
      name: "Dentum",
    };
    projectAccess.load.mockResolvedValue(project);
    permissionAccess.resolve.mockResolvedValue({
      role: "markedssjef",
      permissions: new Set(["leads.export"]),
    });

    await expect(
      requireLeadgridExportProject(pool, {
        userId: "user-a",
        projectId: "dentum",
      }),
    ).resolves.toMatchObject(project);
  });
});
