import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  emitWebhook: vi.fn(),
}));

vi.mock("./webhook-emitter.js", () => ({
  emitWebhook: mocks.emitWebhook,
}));

import { executeWorkflow, type WorkflowEvent } from "./leadgrid-workflow-engine.js";

describe("Leadgrid workflow wait safety", () => {
  it("fails closed instead of running the next action when wait persistence fails", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("INSERT INTO leadgrid_workflow_executions")) {
        return { rows: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }] };
      }
      if (sql.includes("INSERT INTO leadgrid_workflow_resume_jobs")) {
        throw new Error("database unavailable");
      }
      return { rows: [], rowCount: 1 };
    });
    const pool = { query } as unknown as Pool;
    const event: WorkflowEvent = {
      pool,
      organizationId: "11111111-1111-4111-8111-111111111111",
      projectId: "dentum-oslo",
      type: "manual",
      leadId: null,
      actorUserId: "user-1",
      data: {},
    };

    const result = await executeWorkflow(
      pool,
      {
        id: "22222222-2222-4222-8222-222222222222",
        organization_id: event.organizationId,
        project_id: event.projectId,
        name: "Vent før oppfølging",
        trigger_type: "manual",
        trigger_config: { type: "manual" },
        conditions: [],
        actions: [
          { type: "wait", duration_minutes: 60 * 24 * 7 },
          { type: "send_email", template_id: "follow_up" },
        ],
        is_active: true,
      } as never,
      event,
    );

    expect(result.status).toBe("failed");
    expect(result.actionResults).toHaveLength(1);
    expect(result.actionResults[0]).toMatchObject({
      index: 0,
      type: "wait",
      status: "error",
    });
    const finishCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("UPDATE leadgrid_workflow_executions"),
    );
    expect(finishCall?.[0]).toContain("organization_id = $6::uuid");
    expect(finishCall?.[0]).toContain("project_id = $7");
    expect(finishCall?.[1]).toEqual([
      "failed",
      expect.any(String),
      expect.any(Number),
      expect.stringContaining("wait_schedule_failed"),
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      event.organizationId,
      event.projectId,
    ]);
  });
});
