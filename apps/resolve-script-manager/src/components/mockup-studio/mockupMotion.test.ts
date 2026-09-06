import { describe, expect, it } from "vitest";
import type { MockupBrandMotionSpec } from "./mockupStudioModel";
import { revealFromLocal } from "./mockupMotion";

const calm: MockupBrandMotionSpec = {
  profile: "calm-precise",
  source: "brand-guide",
  durationSeconds: 5.8,
  easing: "smooth",
  staggerSeconds: 0.16,
  revealDistance: 14,
  revealScale: 0.01,
  overshoot: 0,
  holdSeconds: 1.15,
  cameraPushIn: 0.06,
  beatPunch: 0,
  bpm: null,
  reducedMotion: "fade",
  rationale: ["tone:Trygg og presis"],
};

describe("brandstyrt mockup-motion", () => {
  it("keeps a calm clinical reveal subtle and without overshoot", () => {
    const start = revealFromLocal("image", 0, calm);
    const middle = revealFromLocal("image", 0.5, calm);

    expect(start.ty).toBeLessThanOrEqual(8);
    expect(start.scale).toBeGreaterThanOrEqual(0.98);
    expect(middle.scale).toBeLessThanOrEqual(1);
  });

  it("uses fade only when reduced motion is preferred", () => {
    const reveal = revealFromLocal("image", 0.5, calm, true);

    expect(reveal).toEqual({ p: 0.5, alpha: 0.6, ty: 0, scale: 1 });
  });

  it("preserves the legacy reveal when a document has no motion profile", () => {
    const reveal = revealFromLocal("device", 0);

    expect(reveal).toEqual({ p: 0, alpha: 0, ty: 46, scale: 0.98 });
  });
});
