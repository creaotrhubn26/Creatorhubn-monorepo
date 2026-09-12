import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { enforceOrgStatus } from "./org-status-enforcement.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const otherOrganizationId = "22222222-2222-4222-8222-222222222222";
const leadId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function callMiddleware(input: {
  method: string;
  path: string;
  organizationId?: string;
  query: Pool["query"];
}) {
  const req = {
    method: input.method,
    path: input.path,
    body: {},
    query: {},
    params: {},
    get: (name: string) => name.toLowerCase() === "x-leadgrid-organization-id"
      ? input.organizationId
      : undefined,
    headers: {},
  } as unknown as Request;
  let status = 200;
  let payload: unknown;
  const res = {
    status(code: number) { status = code; return this; },
    json(body: unknown) { payload = body; return this; },
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  await enforceOrgStatus(
    { query: input.query } as unknown as Pool,
    new Map(),
  )(req, res, next);
  return { status, payload, next };
}

describe("Leadgrid organization read-only enforcement", () => {
  it("blocks mutations but allows reads for a read-only organization", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ status: "read_only", pause_reason: "billing_past_due", pause_resume_at: null }],
    });
    const write = await callMiddleware({
      method: "POST", path: "/canvas", organizationId, query,
    });
    const read = await callMiddleware({
      method: "GET", path: "/canvas", organizationId, query,
    });
    expect(write.status).toBe(423);
    expect(write.payload).toMatchObject({ status: "read_only", reason: "billing_past_due" });
    expect(write.next).not.toHaveBeenCalled();
    expect(read.next).toHaveBeenCalledOnce();
  });

  it("keeps Customer Portal available during billing recovery", async () => {
    const query = vi.fn();
    const result = await callMiddleware({
      method: "POST", path: "/billing/portal-session", organizationId, query,
    });
    expect(result.next).toHaveBeenCalledOnce();
    expect(query).not.toHaveBeenCalled();
  });

  it("derives a lead tenant from PostgreSQL and rejects a spoofed workspace header", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM crm_customers")) {
        return { rows: [{ organization_id: organizationId }] };
      }
      return { rows: [{ status: "active", pause_reason: null, pause_resume_at: null }] };
    }) as unknown as Pool["query"];
    const result = await callMiddleware({
      method: "PATCH",
      path: `/leads/${leadId}`,
      organizationId: otherOrganizationId,
      query,
    });
    expect(result.status).toBe(409);
    expect(result.payload).toMatchObject({
      error: "leadgrid_organization_context_mismatch",
    });
    expect(result.next).not.toHaveBeenCalled();
  });

  it("fails closed when organization status cannot be read", async () => {
    const result = await callMiddleware({
      method: "POST",
      path: "/canvas",
      organizationId,
      query: vi.fn().mockRejectedValue(new Error("postgres unavailable")) as unknown as Pool["query"],
    });
    expect(result.status).toBe(503);
    expect(result.payload).toMatchObject({ error: "org_status_unavailable" });
    expect(result.next).not.toHaveBeenCalled();
  });
});
