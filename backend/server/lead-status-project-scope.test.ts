import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  buildWonLostStats,
  registerLeadStatusRoutes,
} from "./lead-status-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";

describe("Leadgrid Won/Lost customer-project scope", () => {
  it("applies organization and project to every aggregate query", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{}] });
    await buildWonLostStats({ query } as unknown as Pick<Pool, "query">, {
      organizationId,
      projectId: "dentum",
      days: 30,
    });

    expect(query).toHaveBeenCalledTimes(5);
    for (const [sql, params] of query.mock.calls) {
      expect(String(sql)).toContain("c.organization_id = $1::uuid");
      expect(String(sql)).toContain("c.project_id = $2");
      expect(params[0]).toBe(organizationId);
      expect(params[1]).toBe("dentum");
    }
  });

  it("rejects a report request without an explicit project before querying", async () => {
    const query = vi.fn();
    const routes = new Map<string, RequestHandler[]>();
    const app = {
      get: (path: string, ...handlers: RequestHandler[]) =>
        routes.set(`GET ${path}`, handlers),
      put: (path: string, ...handlers: RequestHandler[]) =>
        routes.set(`PUT ${path}`, handlers),
    } as unknown as Express;
    registerLeadStatusRoutes({
      app,
      pool: { query } as unknown as Pool,
      activeSessions: new Map([["token-a", { userId: "user-a" }]]),
    });

    const handler = routes.get("GET /api/leadgrid/won-lost-stats")?.at(-1);
    if (!handler) throw new Error("Won/Lost route was not registered");
    const req = {
      headers: { authorization: "Bearer token-a" },
      query: { period: "30d" },
    } as unknown as Request;
    let status = 200;
    let body: unknown;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(payload: unknown) {
        body = payload;
        return this;
      },
    } as unknown as Response;

    await handler(req, res, vi.fn());

    expect(status).toBe(400);
    expect(body).toEqual({ error: "project_id_required" });
    expect(query).not.toHaveBeenCalled();
  });
});
