import { describe, expect, it } from "vitest";
import { applyHydratedMockupChangeSet, applyMockupChangeSet, StaleLocalMockupChangeError } from "./mockupChangeSets";
import type { MockupDoc } from "./mockupStudioModel";

function doc(): MockupDoc {
  return {
    id: "p1", name: "Kampanje", version: 1, template: "blank", updatedAt: 100,
    canvas: { w: 1080, h: 1080, accent: "#123456", accent2: "#abcdef", background: "light", bgStyle: "clean" },
    devices: [],
    texts: [{ id: "headline", role: "title", text: "Før", x: 100, y: 100, w: 800, size: 80, weight: 700, color: "#111111", align: "left", lineHeight: 1, tracking: 0, uppercase: false }],
  };
}

describe("applyMockupChangeSet", () => {
  it("lager et nytt redigerbart dokument og lar originalen stå urørt", () => {
    const original = doc();
    const next = applyMockupChangeSet(original, [{
      id: "op1", targetRef: "text:headline", targetLabel: "Overskrift", field: "text",
      label: "Oppdater tekst", before: "Før", value: "Etter",
    }], 200);
    expect(next.texts[0].text).toBe("Etter");
    expect(next.updatedAt).toBe(200);
    expect(original.texts[0].text).toBe("Før");
  });

  it("stopper stale forslag før lokal state endres", () => {
    const current = doc();
    current.texts[0].text = "Nyere tekst";
    expect(() => applyMockupChangeSet(current, [{
      id: "op1", targetRef: "text:headline", targetLabel: "Overskrift", field: "text",
      label: "Oppdater tekst", before: "Før", value: "Etter",
    }])).toThrow(StaleLocalMockupChangeError);
  });

  it("beholder allerede hydrerte assets når serveren har anvendt endringen", () => {
    const current = doc();
    current.images = [{
      id: "patient", image: "data:image/png;base64,local", x: 0, y: 0, w: 400, h: 400,
      rotation: 0, radius: 0, fit: "cover", focusX: .5, focusY: .5, shadow: false,
    }];
    const applied = structuredClone(current);
    applied.updatedAt = 300;
    applied.images![0].image = "mockup-cloud-file:asset-id";
    applied.reviewPreview = "data:image/png;base64,preview";
    applied.reviewElements = [];
    const next = applyHydratedMockupChangeSet(current, [{
      id: "op1", targetRef: "text:headline", targetLabel: "Overskrift", field: "text",
      label: "Oppdater tekst", before: "Før", value: "Etter",
    }], applied);
    expect(next.texts[0].text).toBe("Etter");
    expect(next.images![0].image).toBe("data:image/png;base64,local");
    expect(next.reviewPreview).toBe("data:image/png;base64,preview");
    expect(next.updatedAt).toBe(300);
  });
});
