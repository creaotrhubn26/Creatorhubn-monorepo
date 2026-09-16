import { describe, expect, it } from "vitest";
import {
  deriveMarketingFlowState,
  describeMissingField,
  summarizeStep,
  type MarketingFlowInput,
  type MarketingFlowStatus,
} from "./marketingFlowState";

const org = (over: Partial<MarketingFlowStatus["organization"] & object> = {}) => ({
  name: "Nordvest Bygg AS",
  website: "https://nordvestbygg.no",
  orgNumber: "912345678",
  naceCode: "41.200",
  naceDescription: "Oppføring av bygninger",
  industry: null,
  canBootstrap: true,
  canEditProfile: false,
  orgNumberEditable: false,
  ...over,
});

const status = (over: Partial<MarketingFlowStatus> = {}): MarketingFlowStatus => ({
  organization: org(),
  bootstrap: { available: false, versionNumber: null, generatedAt: null, ready: false, missingFields: [] },
  plan: { exists: false },
  ...over,
});

const base = (over: Partial<MarketingFlowInput> = {}): MarketingFlowInput => ({
  moduleLoading: false,
  moduleEnabled: true,
  projectId: "leadgrid-abc",
  statusLoading: false,
  statusError: null,
  status: status(),
  mapping: false,
  mapFailed: false,
  planning: false,
  planFailed: false,
  activating: false,
  postsProgress: null,
  ...over,
});

describe("deriveMarketingFlowState — gating and loading", () => {
  it("shows loading while the module or status resolves", () => {
    expect(deriveMarketingFlowState(base({ moduleLoading: true })).state.kind).toBe("loading");
    expect(deriveMarketingFlowState(base({ statusLoading: true, status: null })).state.kind).toBe("loading");
  });

  it("locks when the module is off, or when the backend says module_locked", () => {
    expect(deriveMarketingFlowState(base({ moduleEnabled: false })).state.kind).toBe("locked");
    expect(
      deriveMarketingFlowState(base({ statusError: { error: "module_locked" }, status: null })).state.kind,
    ).toBe("locked");
  });

  it("asks for a project before anything else", () => {
    const v = deriveMarketingFlowState(base({ projectId: null }));
    expect(v.state.kind).toBe("no_project");
    expect(v.primaryAction).toBeNull();
  });

  it("maps permission errors to a designed access_denied state", () => {
    const v = deriveMarketingFlowState(
      base({ statusError: { error: "mangler_tillatelse", required: "marketing.content.brief" }, status: null }),
    );
    expect(v.state).toMatchObject({ kind: "access_denied", reason: "mangler_tillatelse", required: "marketing.content.brief" });
    expect(deriveMarketingFlowState(base({ statusError: { error: "boom" }, status: null })).state).toMatchObject({
      kind: "access_denied",
      reason: "other",
    });
  });
});

describe("deriveMarketingFlowState — step 1 (kartlegging)", () => {
  it("prevents the error up front: org without website/org.nr. gets an edit action only for editors", () => {
    const cannot = deriveMarketingFlowState(
      base({ status: status({ organization: org({ canBootstrap: false, canEditProfile: false }) }) }),
    );
    expect(cannot.state).toMatchObject({ kind: "org_incomplete", canEdit: false });
    expect(cannot.primaryAction).toBeNull();
    expect(cannot.activeStep).toBe("map");

    const can = deriveMarketingFlowState(
      base({ status: status({ organization: org({ canBootstrap: false, canEditProfile: true, orgNumberEditable: true }) }) }),
    );
    expect(can.state).toMatchObject({ kind: "org_incomplete", canEdit: true, orgNumberEditable: true });
    expect(can.primaryAction).toBe("edit_org_profile");
  });

  it("offers exactly one primary action when ready to map", () => {
    const v = deriveMarketingFlowState(base());
    expect(v.state).toEqual({ kind: "ready_to_map", remap: false });
    expect(v.primaryAction).toBe("map");
    expect(v.secondaryActions).toEqual([]);
    expect(v.completedSteps).toEqual([]);
  });

  it("has no primary action while mapping, and a retry after failure", () => {
    expect(deriveMarketingFlowState(base({ mapping: true })).primaryAction).toBeNull();
    const failed = deriveMarketingFlowState(base({ mapFailed: true }));
    expect(failed.state.kind).toBe("map_failed");
    expect(failed.primaryAction).toBe("retry_map");
  });

  it("stays on step 1 with the missing fields when the mapping is incomplete", () => {
    const v = deriveMarketingFlowState(
      base({
        status: status({
          bootstrap: {
            available: true,
            versionNumber: 1,
            generatedAt: "2026-09-16T10:00:00Z",
            ready: false,
            missingFields: ["companyProfile.targetAudience"],
          },
        }),
      }),
    );
    expect(v.state).toEqual({ kind: "mapped_incomplete", missing: ["companyProfile.targetAudience"] });
    expect(v.primaryAction).toBe("remap");
    expect(v.activeStep).toBe("map");
  });
});

const mapped = (over: Partial<MarketingFlowStatus> = {}) =>
  status({
    bootstrap: { available: true, versionNumber: 2, generatedAt: "2026-09-16T10:00:00Z", ready: true, missingFields: [] },
    ...over,
  });

describe("deriveMarketingFlowState — step 2 and 3", () => {
  it("moves to plan with map completed", () => {
    const v = deriveMarketingFlowState(base({ status: mapped() }));
    expect(v.state.kind).toBe("ready_to_plan");
    expect(v.activeStep).toBe("plan");
    expect(v.completedSteps).toEqual(["map"]);
    expect(v.primaryAction).toBe("generate_plan");
    expect(v.secondaryActions).toEqual(["remap"]);
  });

  it("shows planning progress and a retry after failure", () => {
    expect(deriveMarketingFlowState(base({ status: mapped(), planning: true })).state.kind).toBe("planning");
    const failed = deriveMarketingFlowState(base({ status: mapped(), planFailed: true }));
    expect(failed.state.kind).toBe("plan_failed");
    expect(failed.primaryAction).toBe("retry_plan");
  });

  it("asks to activate a draft plan", () => {
    const v = deriveMarketingFlowState(
      base({ status: mapped({ plan: { exists: true, id: "p1", status: "draft", horizonDays: 30 } }) }),
    );
    expect(v.state).toEqual({ kind: "plan_draft", planId: "p1" });
    expect(v.activeStep).toBe("posts");
    expect(v.completedSteps).toEqual(["map", "plan"]);
    expect(v.primaryAction).toBe("activate_plan");
  });

  it("reports post generation with a counter and no primary action", () => {
    const v = deriveMarketingFlowState(
      base({
        status: mapped({ plan: { exists: true, id: "p1", status: "active", horizonDays: 30 } }),
        postsProgress: { generated: 12, expected: 30, complete: false },
      }),
    );
    expect(v.state).toEqual({ kind: "generating_posts", planId: "p1", generated: 12, expected: 30 });
    expect(v.primaryAction).toBeNull();
    expect(v.steady).toBe(false);
  });

  it("enters steady-state once posts are complete, with setup actions demoted", () => {
    const v = deriveMarketingFlowState(
      base({
        status: mapped({ plan: { exists: true, id: "p1", status: "active", horizonDays: 30 } }),
        postsProgress: { generated: 30, expected: 30, complete: true },
      }),
    );
    expect(v.state).toEqual({ kind: "active", planId: "p1" });
    expect(v.steady).toBe(true);
    expect(v.activeStep).toBeNull();
    expect(v.completedSteps).toEqual(["map", "plan", "posts"]);
    expect(v.primaryAction).toBe("open_chat");
    expect(v.secondaryActions).toEqual(["new_plan", "remap"]);
  });
});

describe("copy helpers", () => {
  it("translates readiness keys to human labels with a fix hint", () => {
    expect(describeMissingField("companyProfile.targetAudience").label).toBe("Målgruppe");
    expect(describeMissingField("unknown.key")).toMatchObject({ label: "unknown.key" });
  });

  it("summarizes completed steps in one line", () => {
    const s = mapped({ plan: { exists: true, id: "p1", status: "active", horizonDays: 30 } });
    expect(summarizeStep("map", s)).toContain("Oppføring av bygninger (41.200)");
    expect(summarizeStep("map", s)).toContain("nettsted ok");
    expect(summarizeStep("plan", s)).toBe("Plan aktiv · 30 dager");
    expect(summarizeStep("posts", s)).toBe("Poster klare");
    expect(summarizeStep("plan", null)).toBe("");
  });
});
