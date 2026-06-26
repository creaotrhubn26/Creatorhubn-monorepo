import { describe, it, expect } from "vitest";
import {
  triggerMatches,
  evaluateConditions,
  type WorkflowEvent,
} from "./leadgrid-workflow-engine.js";
import type {
  WorkflowCondition,
  WorkflowTrigger,
} from "./leadgrid-workflow-types.js";
import {
  WORKFLOW_TEMPLATES,
  findTemplate,
} from "./leadgrid-workflow-templates.js";

function ev(
  type: WorkflowTrigger["type"],
  data: Record<string, unknown> = {},
): WorkflowEvent {
  return {
    pool: undefined as unknown as WorkflowEvent["pool"],
    organizationId: "00000000-0000-0000-0000-000000000000",
    type,
    leadId: null,
    actorUserId: null,
    data,
  };
}

describe("triggerMatches", () => {
  it("lead.created matches alle lead.created events", () => {
    const t: WorkflowTrigger = { type: "lead.created" };
    expect(triggerMatches(t, ev("lead.created"))).toBe(true);
  });

  it("pipeline.stage_changed med to=won matcher KUN to=won", () => {
    const t: WorkflowTrigger = { type: "pipeline.stage_changed", to: "won" };
    expect(triggerMatches(t, ev("pipeline.stage_changed", { to: "won" }))).toBe(
      true,
    );
    expect(triggerMatches(t, ev("pipeline.stage_changed", { to: "lost" }))).toBe(
      false,
    );
  });

  it("pipeline.stage_changed med from+to matcher BÅDE", () => {
    const t: WorkflowTrigger = {
      type: "pipeline.stage_changed",
      from: "proposal",
      to: "negotiation",
    };
    expect(
      triggerMatches(
        t,
        ev("pipeline.stage_changed", { from: "proposal", to: "negotiation" }),
      ),
    ).toBe(true);
    expect(
      triggerMatches(
        t,
        ev("pipeline.stage_changed", { from: "qualified", to: "negotiation" }),
      ),
    ).toBe(false);
  });

  it("deal.probability_changed med min=80 matcher kun >= 80", () => {
    const t: WorkflowTrigger = { type: "deal.probability_changed", min: 80 };
    expect(
      triggerMatches(t, ev("deal.probability_changed", { new_probability: 85 })),
    ).toBe(true);
    expect(
      triggerMatches(t, ev("deal.probability_changed", { new_probability: 79 })),
    ).toBe(false);
  });

  it("lead.temperature_changed matcher kun spesifikk to", () => {
    const t: WorkflowTrigger = { type: "lead.temperature_changed", to: "hot" };
    expect(
      triggerMatches(t, ev("lead.temperature_changed", { to: "hot" })),
    ).toBe(true);
    expect(
      triggerMatches(t, ev("lead.temperature_changed", { to: "warm" })),
    ).toBe(false);
  });

  it("trigger-type mismatch returnerer false", () => {
    const t: WorkflowTrigger = { type: "lead.created" };
    expect(triggerMatches(t, ev("pipeline.stage_changed", { to: "won" }))).toBe(
      false,
    );
  });
});

describe("evaluateConditions", () => {
  const fakeLead = {
    id: "lead-1",
    business_name: "Test AS",
    lead_score: 75,
    lead_temperature: "hot",
    pipeline_stage: "qualified",
    industry_id: "restaurant",
    city: "Oslo",
    deal_amount: "150000.00",
    deal_probability: 50,
    owner_user_id: "user-1",
    email: "x@y.com",
    phone: null,
  };

  it("tom liste = OK", () => {
    expect(evaluateConditions([], fakeLead).ok).toBe(true);
  });

  it("lead.score > 70 = true for 75", () => {
    const c: WorkflowCondition[] = [
      { type: "lead.score", op: ">", value: 70 },
    ];
    expect(evaluateConditions(c, fakeLead).ok).toBe(true);
  });

  it("lead.score > 100 = false", () => {
    const c: WorkflowCondition[] = [
      { type: "lead.score", op: ">", value: 100 },
    ];
    const r = evaluateConditions(c, fakeLead);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failedAt).toBe(0);
  });

  it("deal.amount > 100000 = true (150k)", () => {
    const c: WorkflowCondition[] = [
      { type: "deal.amount", op: ">", value: 100000 },
    ];
    expect(evaluateConditions(c, fakeLead).ok).toBe(true);
  });

  it("city case-insensitive", () => {
    const c: WorkflowCondition[] = [{ type: "lead.city", value: "oslo" }];
    expect(evaluateConditions(c, fakeLead).ok).toBe(true);
  });

  it("industry_id eksakt match", () => {
    const c: WorkflowCondition[] = [
      { type: "lead.industry_id", value: "restaurant" },
    ];
    expect(evaluateConditions(c, fakeLead).ok).toBe(true);
    const c2: WorkflowCondition[] = [
      { type: "lead.industry_id", value: "hospitality" },
    ];
    expect(evaluateConditions(c2, fakeLead).ok).toBe(false);
  });

  it("ALL conditions må stemme (AND-logikk)", () => {
    const c: WorkflowCondition[] = [
      { type: "lead.score", op: ">", value: 70 },
      { type: "deal.amount", op: ">", value: 200000 }, // false (150k)
    ];
    const r = evaluateConditions(c, fakeLead);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failedAt).toBe(1);
  });

  it("lead.score null returnerer false m/ reason", () => {
    const c: WorkflowCondition[] = [
      { type: "lead.score", op: ">", value: 50 },
    ];
    const r = evaluateConditions(c, { ...fakeLead, lead_score: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("lead_score_null");
  });
});

describe("WORKFLOW_TEMPLATES", () => {
  it("har minst 15 templates (10 originale + 5 mig 0350)", () => {
    expect(WORKFLOW_TEMPLATES.length).toBeGreaterThanOrEqual(15);
  });

  it("alle templates har unike keys", () => {
    const keys = WORKFLOW_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("findTemplate finner kjent key", () => {
    expect(findTemplate("welcome_new_lead")).toBeDefined();
    expect(findTemplate("nonexistent")).toBeUndefined();
  });

  it("findTemplate finner nye mig-0350-templates", () => {
    expect(findTemplate("email_engagement_escalation")).toBeDefined();
    expect(findTemplate("click_to_call_pricing")).toBeDefined();
    expect(findTemplate("no_show_recovery")).toBeDefined();
    expect(findTemplate("auto_archive_cold_leads")).toBeDefined();
    expect(findTemplate("contract_signed_celebration")).toBeDefined();
  });

  it("hver template har minst 1 action", () => {
    for (const tpl of WORKFLOW_TEMPLATES) {
      expect(tpl.actions.length).toBeGreaterThan(0);
    }
  });

  it("hver template har gyldig trigger.type", () => {
    const valid = new Set([
      "lead.created",
      "lead.status_changed",
      "lead.temperature_changed",
      "pipeline.stage_changed",
      "deal.probability_changed",
      "deal.amount_changed",
      "deal.expected_close_changed",
      "recommendation.published",
      "manual",
      // mig 0350
      "email.opened",
      "email.link_clicked",
      "meeting.booked",
      "meeting.no_show",
      "proposal.opened",
      "contract.signed",
    ]);
    for (const tpl of WORKFLOW_TEMPLATES) {
      expect(valid.has(tpl.trigger.type)).toBe(true);
    }
  });
});
