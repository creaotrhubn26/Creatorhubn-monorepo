import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  evaluateRulesForLead,
  RuleEvaluationLeadNotFoundError,
  type LeadRuleSnapshot,
} from "./lead-rules-engine.js";
import {
  runScoutForLead,
  ScoutLeadNotFoundError,
} from "./lead-scout-service.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "dentum-oslo";
const leadId = "22222222-2222-4222-8222-222222222222";
const ruleId = "33333333-3333-4333-8333-333333333333";
const evaluationId = "44444444-4444-4444-8444-444444444444";
const key = "55555555-5555-4555-8555-555555555555";

function scoutRequestHash(websiteUrl: string): string {
  return createHash("sha256").update(JSON.stringify({
    organizationId,
    projectId,
    customerId: leadId,
    websiteUrl,
  })).digest("hex");
}

const snapshot: LeadRuleSnapshot & {
  last_contacted_at: string | null;
  updated_at: string;
} = {
  id: leadId,
  organization_id: organizationId,
  project_id: projectId,
  status: "active",
  lead_status: "new",
  ai_opportunity_score: 50,
  next_follow_up_at: null,
  last_visit_at: null,
  last_contacted_at: null,
  owner_user_id: "owner-user",
  assigned_user_id: "assigned-user",
  custom_fields: {},
  updated_at: new Date().toISOString(),
  days_since_status_change: 0,
  days_since_last_visit: null,
  days_since_last_contact: null,
  has_follow_up: false,
};

function rulesPool(mode: "run" | "replay" | "missing") {
  const query = vi.fn(async (statement: unknown, values?: unknown[]) => {
    const sql = String(statement);
    if (sql.includes("FROM crm_customers")) {
      return mode === "missing"
        ? { rows: [], rowCount: 0 }
        : { rows: [snapshot], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO lead_automation_evaluations")) {
      return mode === "replay"
        ? { rows: [], rowCount: 0 }
        : { rows: [{ id: evaluationId }], rowCount: 1 };
    }
    if (sql.includes("FROM lead_automation_evaluations")) {
      return {
        rows: [{
          id: evaluationId,
          request_hash: values?.[3] ?? "unused",
          status: "completed",
          result_payload: null,
        }],
        rowCount: 1,
      };
    }
    if (sql.includes("FROM lead_automation_rules")) {
      return {
        rows: [{
          id: ruleId,
          organization_id: organizationId,
          project_id: projectId,
          name: "Prioriter ny lead",
          trigger_on: ["lead_update"],
          condition: { field: "lead_status", op: "eq", value: "new" },
          actions: [{ type: "set_priority", params: { level: "high" } }],
          priority: 10,
          throttle_minutes: 0,
        }],
        rowCount: 1,
      };
    }
    if (sql.includes("UPDATE crm_customers")) return { rows: [], rowCount: 1 };
    if (sql.includes("INSERT INTO lead_automation_runs")) {
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("UPDATE lead_automation_evaluations")) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
  const release = vi.fn();
  const client = { query, release };
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
  return { pool, query, release };
}

describe("project-scoped rule engine", () => {
  it("runs rule reads, lead mutations and audit writes in one exact tuple", async () => {
    const fake = rulesPool("run");
    const result = await evaluateRulesForLead(fake.pool, {
      organizationId,
      projectId,
      customerId: leadId,
      event: "lead_update",
      idempotencyKey: key,
    });

    expect(result).toMatchObject({
      organization_id: organizationId,
      project_id: projectId,
      customer_id: leadId,
      rules_matched: 1,
      actions_executed: 1,
      idempotent_replay: false,
    });
    const calls = fake.query.mock.calls.map(([sql, values]) => [String(sql), values] as const);
    const ruleRead = calls.find(([sql]) => sql.includes("FROM lead_automation_rules"));
    expect(ruleRead?.[0]).toContain("organization_id=$1::uuid AND project_id=$2");
    expect(ruleRead?.[1]).toEqual([organizationId, projectId, "lead_update"]);
    const mutation = calls.find(([sql]) => sql.includes("SET ai_opportunity_score"));
    expect(mutation?.[0]).toContain("organization_id=$2::uuid AND project_id=$3");
    expect(mutation?.[1]?.slice(0, 3)).toEqual([leadId, organizationId, projectId]);
    const audit = calls.find(([sql]) => sql.includes("INSERT INTO lead_automation_runs"));
    expect(audit?.[0]).toContain("organization_id,project_id,evaluation_id");
    expect(fake.release).toHaveBeenCalledOnce();
  });

  it("rolls back without actions when the lead is outside the exact tuple", async () => {
    const fake = rulesPool("missing");
    await expect(evaluateRulesForLead(fake.pool, {
      organizationId,
      projectId,
      customerId: leadId,
      event: "lead_update",
      idempotencyKey: key,
    })).rejects.toBeInstanceOf(RuleEvaluationLeadNotFoundError);
    expect(fake.query.mock.calls.some(([sql]) =>
      String(sql).includes("UPDATE crm_customers"))).toBe(false);
    expect(fake.query.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO lead_automation_runs"))).toBe(false);
    expect(fake.query).toHaveBeenCalledWith("ROLLBACK");
  });
});

describe("Scout retry envelope", () => {
  it("hides a lead that no longer exists in the supplied project tuple", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const pool = { query } as unknown as Pool;
    await expect(runScoutForLead(pool, {
      customerId: leadId,
      organizationId,
      projectId,
      leadName: "Dentum",
      websiteUrl: "https://dentum.no",
      triggeredBy: "user-1",
      idempotencyKey: key,
    })).rejects.toBeInstanceOf(ScoutLeadNotFoundError);
  });

  it("reuses a failed run safely with the same key instead of creating a duplicate", async () => {
    const priorHash = scoutRequestHash("https://no-such-host.invalid/");
    const query = vi.fn(async (statement: unknown) => {
      const sql = String(statement);
      if (sql.includes("INSERT INTO crm_customer_scout_runs")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("SELECT id::text, customer_id, request_hash")) {
        return {
          rows: [{
            id: evaluationId,
            customer_id: leadId,
            request_hash: priorHash,
            status: "failed",
            result_payload: null,
            stale: false,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("SET triggered_by = $4") && sql.includes("status = 'running'")) {
        return { rows: [{ id: evaluationId }], rowCount: 1 };
      }
      if (sql.includes("SET status = 'failed'")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const pool = { query } as unknown as Pool;
    const result = await runScoutForLead(pool, {
      customerId: leadId,
      organizationId,
      projectId,
      leadName: "Dentum",
      websiteUrl: "https://no-such-host.invalid",
      triggeredBy: "user-1",
      idempotencyKey: key,
    });
    expect(result).toMatchObject({
      scout_run_id: evaluationId,
      organization_id: organizationId,
      project_id: projectId,
      idempotent_replay: false,
      observations: { fetched: false },
    });
    const reset = query.mock.calls.find(([sql]) =>
      String(sql).includes("status = 'running'")
        && String(sql).includes("request_hash = $6"));
    expect(reset?.[1]).toEqual([
      evaluationId,
      organizationId,
      projectId,
      "user-1",
      "https://no-such-host.invalid/",
      priorHash,
    ]);
    expect(query.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO crm_customer_scout_runs"))).toHaveLength(1);
  });

  it("replays a committed Scout result without crawling or reconnecting", async () => {
    const persisted = {
      scout_run_id: evaluationId,
      organization_id: organizationId,
      project_id: projectId,
      needs_count: 2,
      signals_count: 3,
      scores_count: 4,
      composite_score: 82,
      observations: { fetched: true },
      idempotent_replay: false,
    };
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{
          id: evaluationId,
          customer_id: leadId,
          request_hash: scoutRequestHash("https://dentum.no/"),
          status: "completed",
          result_payload: persisted,
          stale: false,
        }],
        rowCount: 1,
      });
    const connect = vi.fn();
    const pool = { query, connect } as unknown as Pool;
    const replay = await runScoutForLead(pool, {
      customerId: leadId,
      organizationId,
      projectId,
      leadName: "Dentum",
      websiteUrl: "https://dentum.no",
      triggeredBy: "user-1",
      idempotencyKey: key,
    });
    expect(replay).toEqual({ ...persisted, idempotent_replay: true });
    expect(query).toHaveBeenCalledTimes(2);
    expect(connect).not.toHaveBeenCalled();
  });
});
