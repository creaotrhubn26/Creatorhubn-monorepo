import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  evaluate: vi.fn(),
}));

vi.mock("./lead-rules-engine.js", async () => {
  const actual = await vi.importActual<typeof import("./lead-rules-engine.js")>(
    "./lead-rules-engine.js",
  );
  return { ...actual, evaluateRulesForLead: mocks.evaluate };
});

import {
  dispatchRulesForWorkflowEvent,
  ruleEventIdempotencyKey,
} from "./lead-rules-dispatcher.js";
import {
  _stopLeadRulesCron,
  runLeadRulesCronTick,
  scheduleBucket,
} from "./lead-rules-cron.js";
import type { WorkflowEvent } from "./leadgrid-workflow-engine.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const leadId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";

function workflowEvent(
  type: WorkflowEvent["type"],
  data: Record<string, unknown> = {},
): WorkflowEvent {
  return {
    pool: {} as Pool,
    organizationId,
    projectId,
    type,
    leadId,
    actorUserId: "user-1",
    data,
  };
}

beforeEach(() => {
  _stopLeadRulesCron();
  mocks.evaluate.mockReset();
  mocks.evaluate.mockResolvedValue({ idempotent_replay: false });
});

describe("canonical event to automation rule bridge", () => {
  it("maps lead creation and status changes to an exact project tuple", async () => {
    const created = workflowEvent("lead.created", {
      source: "discovery", occurred_at: "2026-09-06T10:00:00.000Z",
    });
    const status = workflowEvent("lead.status_changed", { from: "new", to: "won" });

    await dispatchRulesForWorkflowEvent(created);
    await dispatchRulesForWorkflowEvent(status);

    expect(mocks.evaluate).toHaveBeenNthCalledWith(1, created.pool,
      expect.objectContaining({
        organizationId, projectId, customerId: leadId, event: "lead_create",
      }));
    expect(mocks.evaluate).toHaveBeenNthCalledWith(2, status.pool,
      expect.objectContaining({
        organizationId, projectId, customerId: leadId, event: "status_change",
      }));
  });

  it("does not dispatch unrelated workflow events and canonicalizes key order", async () => {
    const first = workflowEvent("meeting.booked", { b: 2, a: { y: 2, x: 1 } });
    expect(await dispatchRulesForWorkflowEvent(first)).toBeNull();
    expect(mocks.evaluate).not.toHaveBeenCalled();

    const left = workflowEvent("lead.created", { b: 2, a: { y: 2, x: 1 } });
    const right = workflowEvent("lead.created", { a: { x: 1, y: 2 }, b: 2 });
    right.actorUserId = "system-replay";
    expect(ruleEventIdempotencyKey(left, "lead_create"))
      .toBe(ruleEventIdempotencyKey(right, "lead_create"));
  });
});

describe("durable automation rule cron", () => {
  it("uses deterministic UTC hourly and daily buckets", () => {
    const now = new Date("2026-09-06T14:37:28.123Z");
    expect(scheduleBucket(now, "cron_hourly")).toBe("2026-09-06T14:00:00.000Z");
    expect(scheduleBucket(now, "cron_daily")).toBe("2026-09-06T00:00:00.000Z");
  });

  it("materializes and evaluates only exact queued project tuples", async () => {
    const query = vi.fn(async (statement: unknown, values?: unknown[]) => {
      const sql = String(statement);
      if (sql.includes("INSERT INTO lead_automation_scheduled_jobs")) {
        expect(sql).toContain("project.id = rule.project_id");
        expect(sql).toContain("lead.project_id = rule.project_id");
        expect(sql).toContain("lead.archived_at IS NULL");
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("WITH candidates AS")) {
        return {
          rows: [{
            id: "33333333-3333-4333-8333-333333333333",
            organization_id: organizationId,
            project_id: projectId,
            customer_id: leadId,
            trigger_event: "cron_hourly",
            schedule_bucket: "2026-09-06 14:00:00+00",
            attempts: 1,
            lease_token: "44444444-4444-4444-8444-444444444444",
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("UPDATE lead_automation_scheduled_jobs")) {
        expect(values?.slice(0, 6)).toEqual([
          "33333333-3333-4333-8333-333333333333",
          organizationId, projectId, leadId, "cron_hourly",
          "44444444-4444-4444-8444-444444444444",
        ]);
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const pool = { query } as unknown as Pool;

    const result = await runLeadRulesCronTick(
      pool, new Date("2026-09-06T14:37:28.123Z"),
    );

    expect(result).toEqual({ enqueued: 2, processed: 1 });
    expect(mocks.evaluate).toHaveBeenCalledWith(pool, {
      organizationId,
      projectId,
      customerId: leadId,
      event: "cron_hourly",
      idempotencyKey: "scheduled-rule-33333333-3333-4333-8333-333333333333",
    });
  });

  it("does not rescan every lead again inside the same schedule bucket", async () => {
    const query = vi.fn(async (statement: unknown) => {
      const sql = String(statement);
      if (sql.includes("INSERT INTO lead_automation_scheduled_jobs")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("WITH candidates AS")) {
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const pool = { query } as unknown as Pool;
    const now = new Date("2026-09-06T14:37:28.123Z");

    await runLeadRulesCronTick(pool, now);
    await runLeadRulesCronTick(pool, new Date("2026-09-06T14:58:00.000Z"));

    expect(query.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO lead_automation_scheduled_jobs")))
      .toHaveLength(2);
    expect(query.mock.calls.filter(([sql]) =>
      String(sql).includes("WITH candidates AS")))
      .toHaveLength(2);
  });
});
