import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  apiKeyAllowsProject,
  requireApiKey,
  type ApiKeyContext,
} from "./leadgrid-api-key-auth.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const apiKeyId = "22222222-2222-4222-8222-222222222222";

function responseHarness(): {
  response: Response;
  status: () => number;
  body: () => unknown;
} {
  let status = 200;
  let body: unknown;
  const response = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;
  return { response, status: () => status, body: () => body };
}

describe("Leadgrid API-key project authorization", () => {
  it("hydrates the immutable project binding into the auth context", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT k.id::text")) {
        return {
          rows: [
            {
              id: apiKeyId,
              organization_id: organizationId,
              project_id: "dentum-oslo",
              access_scope: "project",
              scopes: ["leads.read"],
              rate_limit_rpm: 60,
            },
          ],
        };
      }
      return { rows: [], rowCount: 1 };
    });
    const middleware = requireApiKey({ query } as unknown as Pool, [
      "leads.read",
    ]);
    const request = {
      headers: { authorization: "Bearer lgk_live_project_scope_test" },
    } as unknown as Request;
    const response = responseHarness();
    const next = vi.fn() as unknown as NextFunction;

    await middleware(request, response.response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(request.apiKey).toMatchObject({
      apiKeyId,
      organizationId,
      projectId: "dentum-oslo",
      accessScope: "project",
    });
    const lookupSql = String(query.mock.calls[0]?.[0]);
    expect(lookupSql).toContain("LEFT JOIN leadgrid_projects p");
    expect(lookupSql).toContain("p.organization_id = k.organization_id");
    expect(lookupSql).toContain("k.access_scope = 'project'");
    expect(lookupSql).toContain("p.project_type NOT IN");
  });

  it("rejects a key when the scoped lookup cannot prove a valid binding", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const middleware = requireApiKey({ query } as unknown as Pool, [
      "leads.read",
    ]);
    const request = {
      headers: { authorization: "Bearer lgk_live_invalid_binding" },
    } as unknown as Request;
    const response = responseHarness();
    const next = vi.fn() as unknown as NextFunction;

    await middleware(request, response.response, next);

    expect(response.status()).toBe(401);
    expect(response.body()).toEqual({ error: "invalid_or_revoked_api_key" });
    expect(next).not.toHaveBeenCalled();
  });

  it("allows only the bound project while preserving explicit organization keys", () => {
    const projectKey: ApiKeyContext = {
      apiKeyId,
      organizationId,
      projectId: "dentum-oslo",
      accessScope: "project",
      scopes: ["*"],
      rateLimitRpm: 60,
    };
    const organizationKey: ApiKeyContext = {
      ...projectKey,
      projectId: null,
      accessScope: "organization",
    };

    expect(apiKeyAllowsProject(projectKey, "dentum-oslo")).toBe(true);
    expect(apiKeyAllowsProject(projectKey, "another-customer")).toBe(false);
    expect(apiKeyAllowsProject(organizationKey, "dentum-oslo")).toBe(true);
    expect(
      apiKeyAllowsProject(
        { ...organizationKey, projectId: "malformed" },
        "dentum-oslo",
      ),
    ).toBe(false);
  });
});
