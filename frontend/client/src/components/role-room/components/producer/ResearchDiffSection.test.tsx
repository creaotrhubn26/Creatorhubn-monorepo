import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ResearchDiff } from "../../utils/researchDiff";
import ResearchDiffSection from "./ResearchDiffSection";

function listDiff(added: string[] = [], removed: string[] = []) {
  return { added, removed, unchanged: 0 };
}

describe("ResearchDiffSection", () => {
  it("shows current additions but never repeats removed stale values as visible findings", () => {
    const diff: ResearchDiff = {
      isFirst: false,
      isSameResearch: false,
      previousCapturedAt: "2026-09-02T12:00:00.000Z",
      industry: {
        from: "Rekruttering og employer branding",
        to: "Helseteknologi og programvare",
      },
      subIndustry: null,
      businessModel: null,
      targetAudience: listDiff(["Leger og helsepersonell"], ["Jobbsøkere"]),
      tone: listDiff(),
      competitors: listDiff([], ["Hub 33 ATL"]),
      socialProfiles: listDiff(),
      localOpportunities: listDiff(
        ["Spaces Kvadraturen"],
        ["Roam Buckhead - Piedmont"],
      ),
      merchSuppliers: listDiff(),
      brandColors: listDiff(),
      hasAnyChange: true,
    };

    render(<ResearchDiffSection diff={diff} />);

    expect(screen.getByText("Helseteknologi og programvare")).toBeTruthy();
    expect(screen.getByText("Leger og helsepersonell")).toBeTruthy();
    expect(screen.getByText("Spaces Kvadraturen")).toBeTruthy();
    expect(
      screen.queryByText("Rekruttering og employer branding"),
    ).toBeNull();
    expect(screen.queryByText("Jobbsøkere")).toBeNull();
    expect(screen.queryByText("Hub 33 ATL")).toBeNull();
    expect(
      screen.queryByText("Roam Buckhead - Piedmont"),
    ).toBeNull();
    expect(
      screen.getAllByText(
        /tidligere treff er fjernet og vises ikke som aktive/i,
      ),
    ).toHaveLength(3);
  });
});
