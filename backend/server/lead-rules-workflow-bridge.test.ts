import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ dispatch: vi.fn() }));
vi.mock("./lead-rules-dispatcher.js", () => ({
  dispatchRulesForWorkflowEvent: mocks.dispatch,
}));

import { publishEvent } from "./leadgrid-workflow-engine.js";

describe("workflow event bridge", () => {
  it("dispatches rules even when the project has no Smart Workflows", async () => {
    mocks.dispatch.mockResolvedValueOnce(null);
    const query = vi.fn(async (statement: unknown) => {
      const sql = String(statement);
      if (sql.includes("SELECT EXISTS")) {
        return { rows: [{ allowed: true }], rowCount: 1 };
      }
      if (sql.includes("FROM leadgrid_workflows")) {
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const pool = { query } as unknown as Pool;
    const event = {
      pool,
      organizationId: "11111111-1111-4111-8111-111111111111",
      projectId: "dentum-oslo",
      type: "lead.created" as const,
      leadId: "22222222-2222-4222-8222-222222222222",
      actorUserId: "user-1",
      data: { source: "discovery" },
    };

    await publishEvent(event);

    expect(mocks.dispatch).toHaveBeenCalledOnce();
    expect(mocks.dispatch).toHaveBeenCalledWith(event);
  });

  it("drops both workflows and rules when the project tuple is invalid", async () => {
    mocks.dispatch.mockReset();
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [{ allowed: false }], rowCount: 1 }),
    } as unknown as Pool;

    await publishEvent({
      pool,
      organizationId: "11111111-1111-4111-8111-111111111111",
      projectId: "foreign-project",
      type: "lead.created",
      leadId: "22222222-2222-4222-8222-222222222222",
      actorUserId: "user-1",
      data: {},
    });

    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});
