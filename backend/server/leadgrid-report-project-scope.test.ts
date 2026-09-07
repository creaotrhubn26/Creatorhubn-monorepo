import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: access.load,
}));

import {
  parseOptionalReportProjectId,
  resolveAccessibleReportProject,
} from "./leadgrid-report-project-scope.js";

const organizationId = "11111111-1111-4111-8111-111111111111";

describe("Leadgrid report project scope", () => {
  it("keeps missing project optional", () => {
    expect(parseOptionalReportProjectId(undefined)).toBeNull();
    expect(parseOptionalReportProjectId("")).toBeNull();
  });

  it("accepts only an active project resolved through current membership", async () => {
    access.load.mockResolvedValue({
      id: "project-a",
      organizationId,
      name: "Dentum",
    });
    await expect(resolveAccessibleReportProject(
      { query: vi.fn() } as unknown as Pick<Pool, "query">,
      { userId: "user-a", organizationId, projectId: " project-a " },
    )).resolves.toEqual({ id: "project-a", name: "Dentum" });
  });

  it("hides a project from another organization", async () => {
    access.load.mockResolvedValue({
      id: "project-b",
      organizationId: "99999999-9999-4999-8999-999999999999",
      name: "Other",
    });
    await expect(resolveAccessibleReportProject(
      { query: vi.fn() } as unknown as Pick<Pool, "query">,
      { userId: "user-a", organizationId, projectId: "project-b" },
    )).rejects.toMatchObject({ code: "project_not_found", status: 404 });
  });
});
