import { describe, expect, it } from "vitest";
import {
  LEADGRID_AGENT_TOOL_NAMES,
  LEADGRID_MARKETING_AGENT_SYSTEM_PROMPT,
  LEADGRID_SALES_AGENT_SYSTEM_PROMPT,
  ROLE_ROOM_AGENT_SYSTEM_PROMPT,
  ROLE_ROOM_AGENT_TOOLS,
  agentSystemPromptForMode,
  agentToolsForMode,
} from "./role-room-agent-definition.js";

const CASTING_ONLY_TOOLS = [
  "summarize_brief_gaps",
  "draft_review_request",
  "propose_timeline_item",
  "flag_scope_impact",
  "suggest_next_decision",
];

describe("agentToolsForMode", () => {
  it("keeps the full Role Room tool set for casting", () => {
    expect(agentToolsForMode("casting")).toBe(ROLE_ROOM_AGENT_TOOLS);
  });

  it("offers only product-agnostic tools in Leadgrid modes", () => {
    for (const mode of ["leadgrid_marketing", "leadgrid_sales"] as const) {
      const names = agentToolsForMode(mode).map((t) => t.name);
      expect(names.sort()).toEqual([...LEADGRID_AGENT_TOOL_NAMES].sort());
      for (const castingTool of CASTING_ONLY_TOOLS) {
        expect(names).not.toContain(castingTool);
      }
    }
  });

  it("every allowed Leadgrid tool name exists in the Role Room schema list", () => {
    const all = new Set(ROLE_ROOM_AGENT_TOOLS.map((t) => t.name));
    for (const name of LEADGRID_AGENT_TOOL_NAMES) expect(all.has(name)).toBe(true);
  });
});

describe("agentSystemPromptForMode", () => {
  it("returns the unchanged Role Room prompt for casting", () => {
    expect(agentSystemPromptForMode("casting")).toBe(ROLE_ROOM_AGENT_SYSTEM_PROMPT);
  });

  it("returns distinct Leadgrid personas that keep the no-autonomy and no-fabrication rules", () => {
    const marketing = agentSystemPromptForMode("leadgrid_marketing");
    const sales = agentSystemPromptForMode("leadgrid_sales");
    expect(marketing).toBe(LEADGRID_MARKETING_AGENT_SYSTEM_PROMPT);
    expect(sales).toBe(LEADGRID_SALES_AGENT_SYSTEM_PROMPT);
    expect(marketing).not.toBe(sales);
    for (const prompt of [marketing, sales]) {
      expect(prompt).toContain("Ingen autonomi");
      expect(prompt).toContain("tool_use");
      expect(prompt).toContain("Ingen oppdiktede tall");
      expect(prompt).not.toContain("summarize_brief_gaps");
      expect(prompt).not.toContain("draft_review_request");
    }
    expect(marketing).toContain("Kahneman");
    expect(marketing).toContain("Tapsaversjon");
    expect(sales).toContain("pipeline");
  });
});
