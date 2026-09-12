import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  LeadgridOrganizationAccessError,
  leadgridOrganizationContextMiddleware,
  resolveOrgIdForUser,
} from "./leadgrid-org-resolver.js";

const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";

async function inRequest<T>(organizationId: string | null, operation: () => Promise<T>): Promise<T> {
  const req = {
    get(name: string) {
      return name.toLowerCase() === "x-leadgrid-organization-id"
        ? organizationId ?? undefined
        : undefined;
    },
  } as unknown as Request;
  return new Promise<T>((resolve, reject) => {
    const next = (() => { operation().then(resolve, reject); }) as NextFunction;
    leadgridOrganizationContextMiddleware(req, {} as Response, next);
  });
}

describe("Leadgrid request-local organization context", () => {
  it("uses the selected member workspace and does not leak it to a concurrent request", async () => {
    const query = vi.fn(async (_sql: string, params?: unknown[]) => ({
      rows: params?.[1] === "user-a" ? [{ exists: 1 }] : [],
    }));
    const pool = { query } as unknown as Pool;

    const [a, b] = await Promise.all([
      inRequest(orgA, () => resolveOrgIdForUser(pool, "user-a")),
      inRequest(orgB, () => resolveOrgIdForUser(pool, "user-a")),
    ]);

    expect(a).toBe(orgA);
    expect(b).toBe(orgB);
    expect(query.mock.calls.map(([, params]) => params?.[0])).toEqual(
      expect.arrayContaining([orgA, orgB]),
    );
  });

  it("fails closed when the selected workspace is not a membership", async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [] }) } as unknown as Pool;
    await expect(inRequest(orgA, () => resolveOrgIdForUser(pool, "user-a")))
      .rejects.toMatchObject<Partial<LeadgridOrganizationAccessError>>({
        code: "not_organization_member",
      });
  });

  it("rejects malformed workspace headers before querying the database", async () => {
    const query = vi.fn();
    const pool = { query } as unknown as Pool;
    await expect(inRequest("not-a-uuid", () => resolveOrgIdForUser(pool, "user-a")))
      .rejects.toMatchObject<Partial<LeadgridOrganizationAccessError>>({
        code: "invalid_organization_id",
      });
    expect(query).not.toHaveBeenCalled();
  });
});
