import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEIGHTS,
  computeChurnRisk,
  computeConversionProbability,
  computeConversionRate,
  computeExpectedRouteValue,
  computeExpectedValue,
  computeFollowUpDecay,
  computeFollowUpPriority,
  computeLeadScore,
  computePipelineVelocity,
  computeResponseRate,
  computeRouteEfficiency,
  determineNextBestAction,
  scoreToTemperature,
  type IntelligenceFacets,
} from "../leadgrid-intelligence-engine";
import { computeSignature } from "../webhook-emitter";

const FULL_FACETS: IntelligenceFacets = {
  categoryFit: 100,
  digitalNeed: 100,
  budgetPotential: 100,
  engagement: 100,
  timing: 100,
  locationFit: 100,
};

const ZERO_FACETS: IntelligenceFacets = {
  categoryFit: 0,
  digitalNeed: 0,
  budgetPotential: 0,
  engagement: 0,
  timing: 0,
  locationFit: 0,
};

describe("computeFollowUpDecay", () => {
  it("returnerer 1.0 for samme dag", () => {
    expect(computeFollowUpDecay(0)).toBe(1.0);
    expect(computeFollowUpDecay(1)).toBe(1.0);
  });

  it("returnerer 0.80 for 2-3 dager", () => {
    expect(computeFollowUpDecay(2)).toBe(0.80);
    expect(computeFollowUpDecay(3)).toBe(0.80);
  });

  it("returnerer 0.55 for 4-7 dager", () => {
    expect(computeFollowUpDecay(7)).toBe(0.55);
  });

  it("returnerer 0.30 for 8-14 dager", () => {
    expect(computeFollowUpDecay(14)).toBe(0.30);
  });

  it("returnerer 0.10 for over 14 dager", () => {
    expect(computeFollowUpDecay(30)).toBe(0.10);
    expect(computeFollowUpDecay(365)).toBe(0.10);
  });

  it("håndterer negative/Infinity gracefully", () => {
    expect(computeFollowUpDecay(-1)).toBe(1.0);
    expect(computeFollowUpDecay(NaN)).toBe(1.0);
  });
});

describe("scoreToTemperature", () => {
  it("maper score til riktig temperatur", () => {
    expect(scoreToTemperature(0)).toBe("cold");
    expect(scoreToTemperature(39)).toBe("cold");
    expect(scoreToTemperature(40)).toBe("warm");
    expect(scoreToTemperature(69)).toBe("warm");
    expect(scoreToTemperature(70)).toBe("hot");
    expect(scoreToTemperature(89)).toBe("hot");
    expect(scoreToTemperature(90)).toBe("ready");
    expect(scoreToTemperature(100)).toBe("ready");
  });
});

describe("computeLeadScore", () => {
  it("returnerer 100 for full-facets med default-vekter", () => {
    expect(computeLeadScore(FULL_FACETS)).toBe(100);
  });

  it("returnerer 0 for zero-facets", () => {
    expect(computeLeadScore(ZERO_FACETS)).toBe(0);
  });

  it("vekter facets riktig — digitalNeed (0.25) dominerer over locationFit (0.10)", () => {
    const facets: IntelligenceFacets = {
      ...ZERO_FACETS,
      digitalNeed: 100,
    };
    // 100 * 0.25 = 25
    expect(computeLeadScore(facets)).toBe(25);
  });

  it("default-vekter summerer til 1.0", () => {
    const sum =
      DEFAULT_WEIGHTS.categoryFit + DEFAULT_WEIGHTS.digitalNeed +
      DEFAULT_WEIGHTS.budgetPotential + DEFAULT_WEIGHTS.engagement +
      DEFAULT_WEIGHTS.timing + DEFAULT_WEIGHTS.locationFit;
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("normaliserer hvis vekter ikke summerer til 1", () => {
    const weights = {
      categoryFit: 1, digitalNeed: 1, budgetPotential: 1,
      engagement: 1, timing: 1, locationFit: 1, // sum=6
    };
    // facets alle 60 → 60 * 6 / 6 = 60
    const f: IntelligenceFacets = {
      categoryFit: 60, digitalNeed: 60, budgetPotential: 60,
      engagement: 60, timing: 60, locationFit: 60,
    };
    expect(computeLeadScore(f, weights)).toBe(60);
  });
});

describe("computeConversionProbability", () => {
  it("starter på pipeline-base for new", () => {
    const p = computeConversionProbability({
      pipelineStage: "new",
      leadStatus: "unvisited",
      recentActivityCount: 0,
      positiveSignalCount: 0,
      negativeSignalCount: 0,
      daysSinceContact: null,
    });
    expect(p).toBeCloseTo(0.05, 2);
  });

  it("won = 1.0", () => {
    const p = computeConversionProbability({
      pipelineStage: "won",
      leadStatus: "won",
      recentActivityCount: 0,
      positiveSignalCount: 0,
      negativeSignalCount: 0,
      daysSinceContact: null,
    });
    expect(p).toBeCloseTo(1.0, 2);
  });

  it("aktivitet booster sannsynligheten", () => {
    const low = computeConversionProbability({
      pipelineStage: "qualified",
      leadStatus: "visited",
      recentActivityCount: 0,
      positiveSignalCount: 0,
      negativeSignalCount: 0,
      daysSinceContact: 0,
    });
    const high = computeConversionProbability({
      pipelineStage: "qualified",
      leadStatus: "visited",
      recentActivityCount: 10,
      positiveSignalCount: 2,
      negativeSignalCount: 0,
      daysSinceContact: 0,
    });
    expect(high).toBeGreaterThan(low);
  });

  it("decay reduserer sannsynligheten ved lang stillhet", () => {
    const fresh = computeConversionProbability({
      pipelineStage: "qualified",
      leadStatus: "visited",
      recentActivityCount: 5,
      positiveSignalCount: 0,
      negativeSignalCount: 0,
      daysSinceContact: 0,
    });
    const stale = computeConversionProbability({
      pipelineStage: "qualified",
      leadStatus: "visited",
      recentActivityCount: 5,
      positiveSignalCount: 0,
      negativeSignalCount: 0,
      daysSinceContact: 60,
    });
    expect(stale).toBeLessThan(fresh);
  });

  it("klamper til [0, 1]", () => {
    const p = computeConversionProbability({
      pipelineStage: "qualified",
      leadStatus: "visited",
      recentActivityCount: 0,
      positiveSignalCount: 0,
      negativeSignalCount: 100, // massiv negativ
      daysSinceContact: 100,
    });
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });
});

describe("computeExpectedValue", () => {
  it("ganger estimated_value med probability", () => {
    expect(computeExpectedValue(10_000, 0.5)).toBe(5000);
    expect(computeExpectedValue(50_000, 0.65)).toBe(32500);
  });

  it("returnerer 0 for null/undefined", () => {
    expect(computeExpectedValue(null, 0.5)).toBe(0);
    expect(computeExpectedValue(undefined, 0.5)).toBe(0);
  });
});

describe("computeFollowUpPriority", () => {
  it("kombinerer score, prob og EV", () => {
    const p = computeFollowUpPriority({
      score: 80,
      probability: 0.6,
      expectedValue: 30_000,
      daysSinceContact: 2,
      urgentFlag: false,
      negativeSignalCount: 0,
    });
    expect(p).toBeGreaterThan(40);
    expect(p).toBeLessThanOrEqual(100);
  });

  it("urgent_flag øker prioriteten", () => {
    const a = computeFollowUpPriority({
      score: 60, probability: 0.4, expectedValue: 10_000,
      daysSinceContact: 1, urgentFlag: false, negativeSignalCount: 0,
    });
    const b = computeFollowUpPriority({
      score: 60, probability: 0.4, expectedValue: 10_000,
      daysSinceContact: 1, urgentFlag: true, negativeSignalCount: 0,
    });
    expect(b).toBeGreaterThan(a);
  });

  it("klampes til [0, 100]", () => {
    expect(computeFollowUpPriority({
      score: 100, probability: 1.0, expectedValue: 1_000_000,
      daysSinceContact: 0, urgentFlag: true, negativeSignalCount: 0,
    })).toBeLessThanOrEqual(100);
    expect(computeFollowUpPriority({
      score: 0, probability: 0, expectedValue: 0,
      daysSinceContact: null, urgentFlag: false, negativeSignalCount: 99,
    })).toBeGreaterThanOrEqual(0);
  });
});

describe("computeResponseRate / computeConversionRate / computePipelineVelocity", () => {
  it("response rate", () => {
    expect(computeResponseRate(3, 10)).toBe(0.3);
    expect(computeResponseRate(0, 0)).toBe(0);
  });
  it("conversion rate", () => {
    expect(computeConversionRate(5, 20)).toBe(0.25);
    expect(computeConversionRate(0, 0)).toBe(0);
  });
  it("pipeline velocity = (active * winRate * avgDeal) / avgCycleDays", () => {
    expect(computePipelineVelocity(20, 0.25, 50_000, 30)).toBe(8333);
    expect(computePipelineVelocity(0, 0.5, 50_000, 30)).toBe(0);
  });
});

describe("computeRouteEfficiency / computeExpectedRouteValue", () => {
  it("route efficiency = visits per hour", () => {
    expect(computeRouteEfficiency(6, 3600)).toBe(6);
    expect(computeRouteEfficiency(6, 7200)).toBe(3);
    expect(computeRouteEfficiency(0, 0)).toBe(0);
  });
  it("expected route value = sum - travelCost", () => {
    expect(computeExpectedRouteValue(
      [{ expectedValue: 5000 }, { expectedValue: 8000 }],
      1500,
    )).toBe(11500);
  });
});

describe("computeChurnRisk", () => {
  it("low for won/lost", () => {
    expect(computeChurnRisk({ daysSinceContact: 365, hadPositiveEngagement: true, pipelineStage: "won" })).toBe("low");
    expect(computeChurnRisk({ daysSinceContact: 365, hadPositiveEngagement: true, pipelineStage: "lost" })).toBe("low");
  });
  it("high når engaged + lang stillhet", () => {
    expect(computeChurnRisk({ daysSinceContact: 45, hadPositiveEngagement: true, pipelineStage: "qualified" })).toBe("high");
  });
  it("high når >60d uten engasjement", () => {
    expect(computeChurnRisk({ daysSinceContact: 75, hadPositiveEngagement: false, pipelineStage: "qualified" })).toBe("high");
  });
  it("low for nye leads", () => {
    expect(computeChurnRisk({ daysSinceContact: 2, hadPositiveEngagement: false, pipelineStage: "new" })).toBe("low");
  });
});

// ─────────────────────────────────────────────────────────────────────
// NBA — alle 14 regler
// ─────────────────────────────────────────────────────────────────────

const NBA_BASE = {
  leadStatus: "unvisited",
  pipelineStage: "new",
  temperature: "warm" as const,
  score: 50,
  probability: 0.3,
  daysSinceContact: 5,
  decay: 0.55,
  recentActivityCount: 2,
  hasEmail: true,
  hasPhone: true,
  hasEnrichment: true,
  hasGeo: false,
  hasMeetingBooked: false,
  hasMeetingPast: false,
  isInProspectingTerritory: false,
};

describe("determineNextBestAction", () => {
  it("regel 1: do_not_contact", () => {
    const r = determineNextBestAction({ ...NBA_BASE, leadStatus: "do_not_contact" });
    expect(r.action).toBe("do_not_contact");
    expect(r.confidence).toBe(1.0);
  });

  it("regel 2: lost", () => {
    const r = determineNextBestAction({ ...NBA_BASE, leadStatus: "lost" });
    expect(r.action).toBe("mark_lost");
  });

  it("regel 3: mangler email + phone", () => {
    const r = determineNextBestAction({ ...NBA_BASE, hasEmail: false, hasPhone: false });
    expect(r.action).toBe("add_missing_info");
  });

  it("regel 4: ingen enrichment", () => {
    const r = determineNextBestAction({ ...NBA_BASE, hasEnrichment: false });
    expect(r.action).toBe("run_research");
  });

  it("regel 5: ready uten meeting → call_now/phone urgent", () => {
    const r = determineNextBestAction({
      ...NBA_BASE,
      temperature: "ready",
      hasMeetingBooked: false,
    });
    expect(r.action).toBe("call_now");
    expect(r.channel).toBe("phone");
    expect(r.priority).toBe("urgent");
  });

  it("regel 6: hot + 2+ dager → call_now urgent", () => {
    const r = determineNextBestAction({
      ...NBA_BASE,
      temperature: "hot",
      daysSinceContact: 3,
    });
    expect(r.action).toBe("call_now");
    expect(r.priority).toBe("urgent");
  });

  it("regel 7: proposal_sent + 3+ dager → call_now", () => {
    const r = determineNextBestAction({
      ...NBA_BASE,
      leadStatus: "proposal_sent",
      daysSinceContact: 4,
    });
    expect(r.action).toBe("call_now");
  });

  it("regel 8: interested + 1+ dager → book_meeting", () => {
    const r = determineNextBestAction({
      ...NBA_BASE,
      leadStatus: "interested",
      daysSinceContact: 2,
    });
    expect(r.action).toBe("book_meeting");
  });

  it("regel 9: meeting passed → send_proposal", () => {
    const r = determineNextBestAction({
      ...NBA_BASE,
      pipelineStage: "meeting",
      hasMeetingPast: true,
    });
    expect(r.action).toBe("send_proposal");
  });

  it("regel 10: qualified + 5+ dager → send_email", () => {
    const r = determineNextBestAction({
      ...NBA_BASE,
      pipelineStage: "qualified",
      daysSinceContact: 6,
      temperature: "warm",
    });
    expect(r.action).toBe("send_email");
  });

  it("regel 11: warm + 7+ dager → send_follow_up_email", () => {
    const r = determineNextBestAction({
      ...NBA_BASE,
      temperature: "warm",
      daysSinceContact: 10,
    });
    expect(r.action).toBe("send_follow_up_email");
  });

  it("regel 12a: lav decay + OK score → reassign", () => {
    const r = determineNextBestAction({
      ...NBA_BASE,
      decay: 0.1,
      score: 60,
      temperature: "warm",
      daysSinceContact: 3, // ikke trigger regel 11
    });
    expect(r.action).toBe("reassign");
  });

  it("regel 12b: lav decay + lav score → wait", () => {
    const r = determineNextBestAction({
      ...NBA_BASE,
      decay: 0.1,
      score: 20,
      temperature: "cold",
      daysSinceContact: 3,
      recentActivityCount: 1,
    });
    expect(r.action).toBe("wait");
  });

  it("regel 13: 14d+ uten aktivitet + score <30 → mark_lost", () => {
    const r = determineNextBestAction({
      ...NBA_BASE,
      recentActivityCount: 0,
      score: 20,
      daysSinceContact: 20,
      decay: 0.5, // unngå regel 12
      temperature: "cold",
    });
    expect(r.action).toBe("mark_lost");
  });

  it("regel 14a: fallback med geo + warm → visit", () => {
    const r = determineNextBestAction({
      ...NBA_BASE,
      hasGeo: true,
      isInProspectingTerritory: true,
      temperature: "warm",
      daysSinceContact: 1, // ikke trigger regel 11
      decay: 0.9,
    });
    expect(r.action).toBe("visit");
  });

  it("regel 14b: fallback uten geo → wait", () => {
    const r = determineNextBestAction({
      ...NBA_BASE,
      hasGeo: false,
      temperature: "cold",
      daysSinceContact: 1,
      decay: 0.9,
      recentActivityCount: 1,
    });
    expect(r.action).toBe("wait");
  });
});

// ─────────────────────────────────────────────────────────────────────
// Webhook signature
// ─────────────────────────────────────────────────────────────────────

describe("computeSignature (webhook-emitter)", () => {
  it("returnerer sha256=hex og deterministisk for samme input", () => {
    const sig1 = computeSignature("secret", 1700000000000, '{"foo":"bar"}');
    const sig2 = computeSignature("secret", 1700000000000, '{"foo":"bar"}');
    expect(sig1).toBe(sig2);
    expect(sig1.startsWith("sha256=")).toBe(true);
    expect(sig1).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("endrer signaturen når body endres", () => {
    const a = computeSignature("secret", 1700000000000, '{"foo":"bar"}');
    const b = computeSignature("secret", 1700000000000, '{"foo":"baz"}');
    expect(a).not.toBe(b);
  });

  it("endrer signaturen når timestamp endres", () => {
    const a = computeSignature("secret", 1700000000000, "{}");
    const b = computeSignature("secret", 1700000000001, "{}");
    expect(a).not.toBe(b);
  });
});
