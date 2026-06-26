import { describe, it, expect } from "vitest";
import {
  validateTrigger,
  validateCondition,
  validateAction,
  validateWorkflowPayload,
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
