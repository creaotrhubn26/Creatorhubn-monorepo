import { describe, expect, it } from "vitest";
import {
  applyMockupChangeOperations,
  generateLocalMockupChangeDraft,
  normalizeMockupChangeOperations,
  StaleMockupChangeError,
  submittedProjectMatchesApplied,
} from "./mockup-change-set-service.js";

const project = () => ({
  id: "campaign",
  name: "Kampanje",
  version: 1,
  updatedAt: 100,
  canvas: { w: 1080, h: 1080, accent: "#123456", accent2: "#abcdef", background: "light", bgStyle: "clean" },
  devices: [],
  texts: [{ id: "headline", text: "Før", x: 100, y: 80, w: 700, size: 72, weight: 700, color: "#111111", align: "left", lineHeight: 1.1, tracking: 0, uppercase: false }],
  images: [{ id: "card", image: "data:image/png;base64,secret", x: 220, y: 500, w: 640, h: 360, radius: 20, fit: "cover", rotation: 0, shadow: true }],
  annotations: [],
  reviewElements: [
    { ref: "text:headline", kind: "text", id: "headline", label: "Overskrift", x: .1, y: .07, w: .7, h: .1 },
    { ref: "image:card", kind: "image", id: "card", label: "PreVisit-kort", x: .2, y: .46, w: .6, h: .34 },
  ],
});

describe("Mockup Change Sets", () => {
  it("gjør festet, konkret feedback om til redigerbare før/etter-operasjoner lokalt", () => {
    const draft = generateLocalMockupChangeDraft(project(), [{
      id: "11111111-1111-4111-8111-111111111111",
      number: 4,
      body: "Flytt kortet litt opp",
      anchorKind: "canvas",
      anchorRef: null,
      anchorX: .52,
      anchorY: .48,
    }]);
    expect(draft.model).toBe("local-rules-v1");
    expect(draft.operations).toEqual([expect.objectContaining({
      targetRef: "image:card",
      field: "y",
      before: 500,
      value: 446,
    })]);
  });

  it("tillater bare eksplisitte skalarfelt og aldri bildeinnhold", () => {
    const operations = normalizeMockupChangeOperations(project(), [
      { targetRef: "image:card", field: "image", value: "https://attacker.invalid/pixel" },
      { targetRef: "image:card", field: "w", value: 720 },
      { targetRef: "missing:id", field: "x", value: 10 },
    ]);
    expect(operations).toHaveLength(1);
    expect(operations[0]).toEqual(expect.objectContaining({ field: "w", before: 640, value: 720 }));
  });

  it("avviser et forslag hvis førverdien har blitt endret siden opprettelsen", () => {
    const operations = normalizeMockupChangeOperations(project(), [
      { targetRef: "text:headline", field: "text", value: "Etter" },
    ]);
    const newer = project();
    newer.texts[0].text = "Endret av designer";
    expect(() => applyMockupChangeOperations(newer, operations)).toThrow(StaleMockupChangeError);
  });

  it("tillater ny review-preview, men ikke skjulte dokumentendringer ved apply", () => {
    const expected = project();
    const submitted = { ...project(), updatedAt: 200, reviewPreview: "data:image/png;base64,new" };
    expect(submittedProjectMatchesApplied(expected, submitted)).toBe(true);
    submitted.name = "Uventet navn";
    expect(submittedProjectMatchesApplied(expected, submitted)).toBe(false);
  });
});
