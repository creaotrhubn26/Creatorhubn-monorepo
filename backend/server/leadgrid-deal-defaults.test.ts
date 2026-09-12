import { describe, it, expect } from "vitest";
import {
  DEFAULT_PROBABILITY_BY_STAGE,
  LEADGRID_STAGES,
  defaultProbabilityFor,
  isLeadgridStage,
} from "./leadgrid-deal-defaults.js";

describe("leadgrid-deal-defaults", () => {
  it("har 8 stages som matcher mig 313 enum", () => {
    expect(LEADGRID_STAGES).toEqual([
      "new",
      "first_contact",
      "qualified",
      "meeting",
      "proposal",
      "negotiation",
      "won",
      "lost",
    ]);
  });

  it("default-probability er monotont stigende fra new til negotiation", () => {
    expect(DEFAULT_PROBABILITY_BY_STAGE.new).toBe(10);
    expect(DEFAULT_PROBABILITY_BY_STAGE.first_contact).toBeGreaterThan(
      DEFAULT_PROBABILITY_BY_STAGE.new,
    );
    expect(DEFAULT_PROBABILITY_BY_STAGE.qualified).toBeGreaterThan(
      DEFAULT_PROBABILITY_BY_STAGE.first_contact,
    );
    expect(DEFAULT_PROBABILITY_BY_STAGE.meeting).toBeGreaterThan(
      DEFAULT_PROBABILITY_BY_STAGE.qualified,
    );
    expect(DEFAULT_PROBABILITY_BY_STAGE.proposal).toBeGreaterThan(
      DEFAULT_PROBABILITY_BY_STAGE.meeting,
    );
    expect(DEFAULT_PROBABILITY_BY_STAGE.negotiation).toBeGreaterThan(
      DEFAULT_PROBABILITY_BY_STAGE.proposal,
    );
  });

  it("won = 100, lost = 0", () => {
    expect(DEFAULT_PROBABILITY_BY_STAGE.won).toBe(100);
    expect(DEFAULT_PROBABILITY_BY_STAGE.lost).toBe(0);
  });

  it("alle defaults er i [0,100]", () => {
    for (const v of Object.values(DEFAULT_PROBABILITY_BY_STAGE)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("isLeadgridStage validates korrekt", () => {
    expect(isLeadgridStage("new")).toBe(true);
    expect(isLeadgridStage("won")).toBe(true);
    expect(isLeadgridStage("contacted")).toBe(false); // prompt-spec stage
    expect(isLeadgridStage("proposal_sent")).toBe(false);
    expect(isLeadgridStage("")).toBe(false);
    expect(isLeadgridStage(123)).toBe(false);
    expect(isLeadgridStage(null)).toBe(false);
  });

  it("defaultProbabilityFor returnerer null for ukjent stage", () => {
    expect(defaultProbabilityFor("new")).toBe(10);
    expect(defaultProbabilityFor("won")).toBe(100);
    expect(defaultProbabilityFor("ukjent")).toBeNull();
  });
});
