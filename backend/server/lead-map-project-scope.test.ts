import { readFileSync } from "node:fs";

import type { Request } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  LeadMapProjectScopeError,
  requestedLeadMapProjectId,
  resolveLeadMapProjectScope,
} from "./lead-map-project-scope.js";
import { updateLeadStatus } from "./lead-map-service.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const leadId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";

function request(query: Record<string, unknown>): Request {
  return { query, body: {} } as unknown as Request;
}

describe("Lead Map customer-project mutation scope", () => {
  it("rejects blank and multi-valued project selectors", () => {
    expect(() => requestedLeadMapProjectId(request({ projectId: " " })))
      .toThrowError(LeadMapProjectScopeError);
    expect(() => requestedLeadMapProjectId(request({ projectId: [projectId] })))
      .toThrowError(LeadMapProjectScopeError);
  });

  it("derives workspace identity from an accessible project", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        id: projectId,
        organization_id: organizationId,
        name: "Dentum – klinikkpilot Oslo og omegn",
        description: null,
        industry: "86.230",
        status: "active",
        created_by: "user-a",
        member_role: "marketer",
      }],
    });

    await expect(resolveLeadMapProjectScope(
      { query } as unknown as Pick<Pool, "query">,
      { userId: "user-a", organizationId: null, requestedProjectId: projectId },
    )).resolves.toEqual({ organizationId, projectId });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("organization_members"), [
      projectId,
      "user-a",
    ]);
  });

  it("fails closed when project and selected workspace disagree", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        id: projectId,
        organization_id: organizationId,
        name: "Dentum",
        description: null,
        industry: null,
        status: "active",
        created_by: "user-a",
        member_role: "admin",
      }],
    });

    await expect(resolveLeadMapProjectScope(
      { query } as unknown as Pick<Pool, "query">,
      {
        userId: "user-a",
        organizationId: "33333333-3333-4333-8333-333333333333",
        requestedProjectId: projectId,
      },
    )).rejects.toMatchObject({ status: 404, code: "project_not_found" });
  });

  it("adds project_id to both locked read and status update", async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ lead_status: "unvisited" }] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;

    await expect(updateLeadStatus(pool, {
      ownerUserId: "user-a",
      organizationId,
      projectId,
      leadId,
      status: "won",
    })).resolves.toMatchObject({ ok: true, previous: "unvisited" });

    const [lockedSql, lockedParams] = client.query.mock.calls[1];
    const [updateSql, updateParams] = client.query.mock.calls[2];
    expect(String(lockedSql)).toContain("project_id = $3");
    expect(lockedParams).toEqual([leadId, organizationId, projectId]);
    expect(String(updateSql)).toContain("project_id = $4");
    expect(updateParams).toEqual(["won", leadId, organizationId, projectId]);
  });

  it("wires resolved project scope through status and visit handlers", () => {
    const routes = readFileSync(new URL("./lead-map-routes.ts", import.meta.url), "utf8");
    expect(routes).toContain("const scope = await leadProjectScope(req, session.userId, req.params.id)");
    expect(routes).toContain("organizationId: scope.organizationId");
    expect(routes).toContain("projectId: scope.projectId");
    expect(routes).toContain("sendLeadMapProjectScopeError(err, res)");
  });
});
