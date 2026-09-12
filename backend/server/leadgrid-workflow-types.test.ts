import { describe, it, expect } from "vitest";
import {
  validateTrigger,
  validateCondition,
  validateAction,
  validateWorkflowPayload,
  isValidCronExpression,
} from "./leadgrid-workflow-types.js";

describe("validateTrigger", () => {
  it("accepts lead.created uten ekstra felt", () => {
    const r = validateTrigger({ type: "lead.created" });
    expect(r.ok).toBe(true);
  });

  it("rejects ukjent trigger-type", () => {
    const r = validateTrigger({ type: "garbage.event" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("trigger_type_invalid");
  });

  it("krever 'to' for pipeline.stage_changed", () => {
    const r = validateTrigger({ type: "pipeline.stage_changed" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("trigger_missing_to");
  });

  it("accepts pipeline.stage_changed med to", () => {
    const r = validateTrigger({ type: "pipeline.stage_changed", to: "won" });
    expect(r.ok).toBe(true);
  });

  it("rejects invalid temperature", () => {
    const r = validateTrigger({
      type: "lead.temperature_changed",
      to: "lukewarm",
    });
    expect(r.ok).toBe(false);
  });
});

describe("validateCondition", () => {
  it("accepts lead.score med op + value", () => {
    const r = validateCondition({ type: "lead.score", op: ">", value: 70 });
    expect(r.ok).toBe(true);
  });

  it("rejects lead.score uten op", () => {
    const r = validateCondition({ type: "lead.score", value: 50 });
    expect(r.ok).toBe(false);
  });

  it("accepts deal.amount", () => {
    const r = validateCondition({
      type: "deal.amount",
      op: ">",
      value: 100000,
    });
    expect(r.ok).toBe(true);
  });

  it("accepts lead.industry_id", () => {
    const r = validateCondition({
      type: "lead.industry_id",
      value: "restaurant",
    });
    expect(r.ok).toBe(true);
  });
});

describe("validateAction", () => {
  it("send_email krever template_id", () => {
    const ok = validateAction({ type: "send_email", template_id: "welcome" });
    expect(ok.ok).toBe(true);
    const bad = validateAction({ type: "send_email" });
    expect(bad.ok).toBe(false);
  });

  it("create_task krever title", () => {
    const ok = validateAction({ type: "create_task", title: "Ring kunde" });
    expect(ok.ok).toBe(true);
    const bad = validateAction({ type: "create_task" });
    expect(bad.ok).toBe(false);
  });

  it("change_pipeline_stage krever stage", () => {
    const ok = validateAction({ type: "change_pipeline_stage", stage: "won" });
    expect(ok.ok).toBe(true);
  });

  it("wait krever duration_minutes > 0 og <= 30 dager", () => {
    const ok = validateAction({ type: "wait", duration_minutes: 60 });
    expect(ok.ok).toBe(true);
    const tooLong = validateAction({
      type: "wait",
      duration_minutes: 60 * 24 * 31,
    });
    expect(tooLong.ok).toBe(false);
    const tooShort = validateAction({ type: "wait", duration_minutes: 0 });
    expect(tooShort.ok).toBe(false);
  });

  it("notify_channel validates channel + message_template", () => {
    const ok = validateAction({
      type: "notify_channel",
      channel: "slack",
      message_template: "Hi",
    });
    expect(ok.ok).toBe(true);
    const badChan = validateAction({
      type: "notify_channel",
      channel: "carrier_pigeon",
      message_template: "Hi",
    });
    expect(badChan.ok).toBe(false);
  });

  it("ai_pitch_generate krever save_to_notes:boolean", () => {
    const ok = validateAction({
      type: "ai_pitch_generate",
      save_to_notes: true,
    });
    expect(ok.ok).toBe(true);
    const bad = validateAction({ type: "ai_pitch_generate" });
    expect(bad.ok).toBe(false);
  });
});

describe("validateWorkflowPayload", () => {
  it("krever name + trigger + minst 1 action", () => {
    const r = validateWorkflowPayload({
      name: "Test",
      trigger_type: "lead.created",
      actions: [{ type: "send_email", template_id: "welcome" }],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects 0 actions", () => {
    const r = validateWorkflowPayload({
      name: "Test",
      trigger_type: "lead.created",
      actions: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("actions_required");
  });

  it("accepts flat trigger_type + trigger_config", () => {
    const r = validateWorkflowPayload({
      name: "Test",
      trigger_type: "pipeline.stage_changed",
      trigger_config: { type: "pipeline.stage_changed", to: "won" },
      actions: [{ type: "add_tag", tag: "celebration" }],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects 0 actions med tom liste", () => {
    const r = validateWorkflowPayload({
      name: "",
      trigger_type: "lead.created",
      actions: [{ type: "send_email", template_id: "w" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("name_required");
  });

  it("kapper på maks 30 actions", () => {
    const actions = Array.from({ length: 31 }, () => ({
      type: "send_email" as const,
      template_id: "w",
    }));
    const r = validateWorkflowPayload({
      name: "Too many",
      trigger_type: "lead.created",
      actions,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("actions_too_many");
  });
});

// =====================================================================
// Mig 0353 — schedule.cron + leadgrid.discover_leads validators
// =====================================================================

describe("isValidCronExpression", () => {
  it("godtar 5-felt cron", () => {
    expect(isValidCronExpression("0 6 * * *")).toBe(true);
    expect(isValidCronExpression("*/15 * * * *")).toBe(true);
    expect(isValidCronExpression("0 0 1 * *")).toBe(true);
    expect(isValidCronExpression("0 9-17 * * 1-5")).toBe(true);
  });
  it("godtar 6-felt cron (med sekunder)", () => {
    expect(isValidCronExpression("0 0 6 * * *")).toBe(true);
  });
  it("avviser ugyldig syntax", () => {
    expect(isValidCronExpression("")).toBe(false);
    expect(isValidCronExpression("not a cron")).toBe(false);
    expect(isValidCronExpression("a b c d e")).toBe(false);
    expect(isValidCronExpression("0 6 *")).toBe(false); // for få felter
    expect(isValidCronExpression(null)).toBe(false);
    expect(isValidCronExpression(undefined)).toBe(false);
    expect(isValidCronExpression(123)).toBe(false);
  });
});

describe("validateTrigger — schedule.cron (mig 0353)", () => {
  it("accepts daglig cron 06:00", () => {
    const r = validateTrigger({
      type: "schedule.cron",
      cron: "0 6 * * *",
      timezone: "Europe/Oslo",
    });
    expect(r.ok).toBe(true);
  });
  it("rejects ugyldig cron", () => {
    const r = validateTrigger({
      type: "schedule.cron",
      cron: "ugyldig",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("trigger_cron_invalid");
  });
  it("accepts cron med project_id", () => {
    const r = validateTrigger({
      type: "schedule.cron",
      cron: "0 6 * * *",
      project_id: "proj-123",
    });
    expect(r.ok).toBe(true);
  });
});

describe("validateAction — leadgrid.discover_leads (mig 0353)", () => {
  it("accepts uten params (project_id tas fra trigger)", () => {
    const r = validateAction({ type: "leadgrid.discover_leads" });
    expect(r.ok).toBe(true);
  });
  it("accepts med count + industry_query", () => {
    const r = validateAction({
      type: "leadgrid.discover_leads",
      count: 15,
      industry_query: "fotograf",
      city: "Oslo",
    });
    expect(r.ok).toBe(true);
  });
  it("rejects count utenfor [1, 50]", () => {
    expect(
      validateAction({ type: "leadgrid.discover_leads", count: 0 }).ok,
    ).toBe(false);
    expect(
      validateAction({ type: "leadgrid.discover_leads", count: 51 }).ok,
    ).toBe(false);
    expect(
      validateAction({ type: "leadgrid.discover_leads", count: 3.5 }).ok,
    ).toBe(false);
  });
  it("rejects ikke-string industry_query", () => {
    expect(
      validateAction({
        type: "leadgrid.discover_leads",
        industry_query: 123,
      }).ok,
    ).toBe(false);
  });
});
