import { describe, expect, it } from "vitest";
import {
  ROLE_ROOM_MOCKUP_SKILL_DEFINITIONS,
  buildBrandBasedMockupPlan,
  buildRoleRoomMockupFingerprint,
} from "./role-room-agent-mockup-skills.js";

const logo = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10H0z"/></svg>',
).toString("base64")}`;

describe("Role Room brand-based mockup skills", () => {
  it("defines six unique, versioned skills with valid dependencies", () => {
    const ids = ROLE_ROOM_MOCKUP_SKILL_DEFINITIONS.map((skill) => skill.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    for (const skill of ROLE_ROOM_MOCKUP_SKILL_DEFINITIONS) {
      expect(skill.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(skill.dependsOn.every((id) => ids.includes(id))).toBe(true);
      expect(skill.instruction.length).toBeGreaterThan(60);
    }
  });

  it("uses a stable fingerprint for semantically identical input", () => {
    expect(buildRoleRoomMockupFingerprint({ b: 2, a: { d: 4, c: 3 } })).toBe(
      buildRoleRoomMockupFingerprint({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });

  it("creates a ready brand plan whose six skill runs affect the render", () => {
    const plan = buildBrandBasedMockupPlan({
      companyName: "MedSide",
      title: "Journalnotat på kortere tid",
      caption: "En dokumentert arbeidsflyt for norske klinikere.",
      callToAction: "Prøv gratis",
      concept: "product_highlight",
      mediaType: "image",
      primaryColor: "#102A43",
      accentColor: "#2CB67D",
      preferredTextColor: "#ffffff",
      logoDataUrl: logo,
      logoPlacement: "top-right",
      toneOfVoice: "Trygg og presis",
      visualStyle: "Ren klinisk teknologi",
      researchId: "00000000-0000-4000-8000-000000000010",
    });

    expect(plan.qualityStatus).toBe("ready");
    expect(plan.skillRuns).toHaveLength(6);
    expect(new Set(plan.skillRuns.map((skill) => skill.id)).size).toBe(6);
    expect(
      plan.skillRuns.every((skill) =>
        skill.executionKey.startsWith(plan.inputFingerprint),
      ),
    ).toBe(true);
    expect(plan.primaryColor).toBe("#102A43");
    expect(plan.accentColor).toBe("#2CB67D");
    expect(plan.logoPlacement).toBe("top-right");
    expect(plan.logoDataUrl).toBe(logo);
    expect(plan.slides).toEqual([
      expect.objectContaining({
        ordinal: 1,
        title: "Journalnotat på kortere tid",
        callToAction: "Prøv gratis",
      }),
    ]);
  });

  it("builds a unique ordered carousel and reports unverified brand inputs", () => {
    const plan = buildBrandBasedMockupPlan({
      companyName: "Eksempel",
      title: "Tre dokumenterte fordeler",
      caption: "Researchgrunnlag",
      callToAction: "Les mer",
      concept: "educational",
      mediaType: "carousel",
      slideCount: 14,
      proofPoints: ["Fordel A", "Fordel A", "Fordel B"],
    });

    expect(plan.qualityStatus).toBe("limited");
    expect(plan.slides).toHaveLength(10);
    expect(plan.slides.map((slide) => slide.ordinal)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(
      plan.skillRuns.find((skill) => skill.id === "resolve_mockup_brand")
        ?.limitations,
    ).toEqual(
      expect.arrayContaining([
        "brand_palette_not_fully_verified",
        "brand_logo_not_materialized",
      ]),
    );
    expect(
      plan.skillRuns
        .find((skill) => skill.id === "audit_mockup_dataflow")
        ?.checks?.every((check) => check.passed),
    ).toBe(true);
  });
});
