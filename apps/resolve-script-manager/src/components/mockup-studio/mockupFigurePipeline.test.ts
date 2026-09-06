import { describe, expect, it } from "vitest";
import { appendUniqueFigureVariant, evaluateFigurePixelBuffer, FIGURE_LAYER_MANIFEST } from "./mockupFigurePipeline";
import type { MockupFigureVariant } from "./mockupStudioModel";

function variant(id: string, assetHash: string): MockupFigureVariant {
  return {
    id,
    assetHash,
    image: `mockup-cloud-file:project:${id.padEnd(8, "0")}-0000-4000-8000-000000000000`,
    label: id,
    kind: "pose",
    generatedAt: "2026-09-06T00:00:00.000Z",
  };
}

describe("high-fidelity figure pipeline", () => {
  it("keeps a deduplicated, capped variant history", () => {
    const first = variant("one", "same");
    const replacement = { ...variant("two", "same"), label: "newest" };
    expect(appendUniqueFigureVariant([first], replacement)).toEqual([replacement]);

    const many = Array.from({ length: 10 }, (_, index) => variant(`v${index}`, `hash-${index}`));
    expect(appendUniqueFigureVariant(many.slice(0, 9), many[9])).toHaveLength(8);
    expect(appendUniqueFigureVariant(many.slice(0, 9), many[9]).at(-1)?.assetHash).toBe("hash-9");
  });

  it("defines all eight semantic sprite layers once", () => {
    expect(FIGURE_LAYER_MANIFEST).toHaveLength(8);
    expect(new Set(FIGURE_LAYER_MANIFEST.map((layer) => layer.id)).size).toBe(8);
  });

  it("checks alpha, crop, visible silhouette and brand pixels from real RGBA values", () => {
    const width = 1024, height = 1024;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 160; y < 900; y += 1) {
      for (let x = 280; x < 760; x += 1) {
        const offset = (y * width + x) * 4;
        data[offset] = 16; data[offset + 1] = 42; data[offset + 2] = 67; data[offset + 3] = 255;
      }
    }
    const audit = evaluateFigurePixelBuffer({ width, height, data, primary: "#102A43", accent: "#2CB1A6" });
    expect(audit.passed).toBe(true);
    expect(audit.transparentRatio).toBeGreaterThan(.5);
    expect(audit.touchesEdge).toBe(false);
    expect(audit.checks.every((check) => check.passed)).toBe(true);
  });
});
