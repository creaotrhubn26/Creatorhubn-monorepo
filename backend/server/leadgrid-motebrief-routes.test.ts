import { readFileSync } from "node:fs";
import type { Request, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  assertMotebriefSelectedOrgEntitled,
  resolveMotebriefSelectedOrganization,
} from "./leadgrid-motebrief-routes.js";

function responseRecorder() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { json, response: { status } as unknown as Response, status };
}

describe("meeting and Canvas-task tenant binding", () => {
  it("validates the exact selected membership instead of membership order", async () => {
    const query = vi.fn(async (sqlValue: unknown, values?: unknown[]) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM users")) {
        return { rows: [{ role: "user", is_active: true }], rowCount: 1 };
      }
      if (sql.includes("FROM organization_members")) {
        expect(values).toEqual(["org-b", "user-1"]);
        return { rows: [{ present: 1 }], rowCount: 1 };
      }
      if (sql.includes("SELECT status") && sql.includes("FROM organizations")) {
        expect(values).toEqual(["org-b"]);
        return { rows: [{ status: "active" }], rowCount: 1 };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const { response, status } = responseRecorder();

    await expect(resolveMotebriefSelectedOrganization(
      { query } as unknown as Pool,
      { headers: { "x-organization-id": "org-b" } } as unknown as Request,
      response,
      "user-1",
      true,
    )).resolves.toBe("org-b");

    expect(status).not.toHaveBeenCalled();
    expect(query.mock.calls.some(([, values]) =>
      Array.isArray(values) && values[0] === "org-a"))
      .toBe(false);
  });

  it("requires an explicit organization context", async () => {
    const query = vi.fn();
    const { json, response, status } = responseRecorder();

    await expect(resolveMotebriefSelectedOrganization(
      { query } as unknown as Pool,
      { headers: {} } as unknown as Request,
      response,
      "user-1",
      false,
    )).resolves.toBeNull();

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: "organization_context_required",
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("checks entitlements in the selected organization only", async () => {
    const query = vi.fn(async (_sql: unknown, values?: unknown[]) => {
      const selected = String(values?.[0]);
      return {
        rows: [{ state: selected === "org-b" ? "locked" : "included" }],
        rowCount: 1,
      };
    });
    const locked = responseRecorder();
    const open = responseRecorder();

    await expect(assertMotebriefSelectedOrgEntitled(
      { query } as unknown as Pool,
      "org-b",
      ["canvasAnalyse", "moteBrief"],
      locked.response,
    )).resolves.toBe(false);
    expect(locked.status).toHaveBeenCalledWith(403);

    await expect(assertMotebriefSelectedOrgEntitled(
      { query } as unknown as Pool,
      "org-a",
      ["canvasAnalyse", "moteBrief"],
      open.response,
    )).resolves.toBe(true);
    expect(open.status).not.toHaveBeenCalled();
    expect(query.mock.calls.map(([, values]) => (values as unknown[])[0]))
      .toEqual(["org-b", "org-a"]);
  });

  it("scopes task reads and updates by the selected organization", () => {
    const source = readFileSync(
      new URL("./leadgrid-motebrief-routes.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain(
      "WHERE organization_id = $1 AND user_id = $2 AND status = $3",
    );
    expect(source).toContain(
      "WHERE id = $2 AND user_id = $3 AND organization_id = $4",
    );
    expect(source.match(/resolveMotebriefSelectedOrganization\(/gu)?.length)
      .toBeGreaterThanOrEqual(6);
  });
});
